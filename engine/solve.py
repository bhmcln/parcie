"""
Solve entrypoint.

    uv run -m engine.solve                       # solution JSON to stdout
    uv run -m engine.solve --quiet               # suppress solver log
    uv run -m engine.solve --out src/lib/solution.json   # write for the app

Output is a JSON object { boxes, heightCm, utilisation, status }. Each box
matches the `Box` shape in `src/lib/data.ts`, so the front-end can import it
directly.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys

from ortools.sat.python import cp_model

from .data import CARTONS, PALLET, SKUS
from .model import build_model, extract_solution, model_dimensions


def solve(time_limit_s: float = 30.0, workers: int = 8, log: bool = True):
    """
    Build and solve the packing model. Returns (status, solver, model, pv, boxes).
    """
    model, pv = build_model(CARTONS, PALLET, SKUS)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_search_workers = workers
    solver.parameters.log_search_progress = log
    if log:
        solver.log_callback = lambda line: print(line, file=sys.stderr)

    status = solver.solve(model)
    boxes = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        boxes = extract_solution(solver, CARTONS, pv)
    return status, solver, model, pv, boxes


def engine_stats(solver, status, model, pv, utilisation, time_limit_s, workers):
    """
    Real solver and model statistics for the `/engine` view. Variable and
    constraint totals are the model as built (pre-presolve); booleans/branches
    /conflicts are the solver's post-presolve search counts.
    """
    obj = solver.objective_value
    bound = solver.best_objective_bound
    gap = abs(obj - bound) / max(1e-9, abs(obj)) if obj else 0.0
    decision_vars, constraint_groups = model_dimensions(CARTONS)
    return {
        "status": solver.status_name(status),
        "objectiveCm": int(obj),
        "bestBoundCm": int(bound),
        "gapPct": round(100 * gap, 2),
        "utilisation": round(utilisation, 3),
        "wallTimeS": round(solver.wall_time, 3),
        "timeLimitS": time_limit_s,
        "workers": workers,
        "booleans": solver.num_booleans,
        "branches": solver.num_branches,
        "conflicts": solver.num_conflicts,
        "numVars": len(model.proto.variables),
        "numConstraints": len(model.proto.constraints),
        "decisionVars": decision_vars,
        "constraintGroups": constraint_groups,
        "log": solver.response_stats(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Solve the parcie pallet packing model.")
    parser.add_argument("--time-limit", type=float, default=30.0, help="solver time limit (s)")
    parser.add_argument("--workers", type=int, default=8, help="search workers")
    parser.add_argument("--quiet", action="store_true", help="suppress solver log")
    parser.add_argument("--out", type=str, default=None, help="write solution JSON to this path")
    args = parser.parse_args()

    status, solver, model, pv, boxes = solve(
        time_limit_s=args.time_limit, workers=args.workers, log=not args.quiet
    )

    status_name = solver.status_name(status)
    if not boxes:
        print(f"No solution found: {status_name}", file=sys.stderr)
        return 1

    height_cm = int(solver.value(pv.height))
    packed = sum(b.w * b.d * b.h for b in boxes)
    envelope = PALLET.width * PALLET.depth * height_cm
    utilisation = packed / envelope if envelope else 0.0

    solution = {
        "boxes": [dataclasses.asdict(b) for b in boxes],
        "heightCm": height_cm,
        "utilisation": round(utilisation, 3),
        "status": status_name,
        "engine": engine_stats(
            solver, status, model, pv, utilisation, args.time_limit, args.workers
        ),
    }

    print(
        f"\n{status_name}  height={height_cm}cm  "
        f"utilisation={utilisation:.3f}  "
        f"wall={solver.wall_time:.2f}s  "
        f"boxes={len(boxes)}",
        file=sys.stderr,
    )

    payload = json.dumps(solution, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(payload + "\n")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
