"""
Solve entrypoint.

    uv run -m engine.solve                                # defaults, JSON to stdout
    uv run -m engine.solve --quiet                        # suppress solver log
    uv run -m engine.solve -i config.json                 # solve a config from the app
    uv run -m engine.solve -o src/lib/solution.json       # write the seed for the app

`solve_from_config` is the shared core: the click CLI here and the FastAPI
service in `engine.api` both call it, so the CLI and the HTTP API can never
drift. Output is a JSON object { boxes, heightCm, utilisation, status, engine }.
Each box matches the `Box` shape in `src/lib/data.ts`.
"""

from __future__ import annotations

import dataclasses
import json
import sys

import click
from ortools.sat.python import cp_model

from .data import CARTONS, PALLET, SKUS
from .model import (
    build_model,
    extract_solution,
    model_dimensions,
    stability_objective,
    vertical_com_cm,
)
from .schema import SolveRequest, stacking_matrix


def _apply_params(solver: cp_model.CpSolver, req: SolveRequest, log: bool) -> None:
    """
    Copy the request's solver budget onto a CpSolver.
    """
    solver.parameters.max_time_in_seconds = req.solver.timeLimitS
    solver.parameters.num_search_workers = req.solver.workers
    solver.parameters.log_search_progress = log
    if log:
        solver.log_callback = lambda line: print(line, file=sys.stderr)


def solve_from_config(req: SolveRequest, log: bool = False) -> dict:
    """
    Build and solve the packing model for one request, returning the solution
    JSON the front-end consumes. Raises nothing on infeasibility: the returned
    dict carries the status and an empty `boxes` list.

    With `req.stability` set, the solve is lexicographic: phase one minimises
    the envelope height, phase two fixes that height and minimises the load's
    vertical centre of mass. The reported objective and search stats are always
    the height phase, since that is the objective the `/engine` view describes.
    """
    allowed = stacking_matrix(req)
    model, pv = build_model(CARTONS, PALLET, SKUS, allowed=allowed)

    # Counts are the height model as built, captured before the stability phase
    # mutates it, so they keep matching `model_dimensions`.
    num_vars = len(model.proto.variables)
    num_constraints = len(model.proto.constraints)
    decision_vars, constraint_groups = model_dimensions(CARTONS, SKUS, allowed)

    solver = cp_model.CpSolver()
    _apply_params(solver, req, log)
    status = solver.solve(model)
    status_name = solver.status_name(status)

    base_engine = {
        "status": status_name,
        "timeLimitS": req.solver.timeLimitS,
        "workers": req.solver.workers,
        "booleans": solver.num_booleans,
        "branches": solver.num_branches,
        "conflicts": solver.num_conflicts,
        "numVars": num_vars,
        "numConstraints": num_constraints,
        "decisionVars": decision_vars,
        "constraintGroups": constraint_groups,
        "log": solver.response_stats(),
    }

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "boxes": [],
            "heightCm": 0,
            "utilisation": 0.0,
            "status": status_name,
            "engine": {
                **base_engine,
                "objectiveCm": 0,
                "bestBoundCm": 0,
                "gapPct": 0.0,
                "utilisation": 0.0,
                "wallTimeS": round(solver.wall_time, 3),
                "stabilityApplied": False,
                "comZcm": 0.0,
            },
        }

    # Phase one result: the minimum envelope height and its search stats.
    height_cm = int(solver.value(pv.height))
    best_bound = solver.best_objective_bound
    gap = abs(height_cm - best_bound) / max(1e-9, abs(height_cm)) if height_cm else 0.0
    wall = solver.wall_time
    boxes = extract_solution(solver, CARTONS, pv)
    stability_applied = False

    # Phase two: among equal-height packings, settle the centre of mass low.
    if req.stability:
        model.add(pv.height == height_cm)
        model.minimize(stability_objective(CARTONS, SKUS, pv))
        phase_two = cp_model.CpSolver()
        _apply_params(phase_two, req, log)
        status2 = phase_two.solve(model)
        if status2 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            boxes = extract_solution(phase_two, CARTONS, pv)
            stability_applied = True
            wall += phase_two.wall_time

    packed = sum(b.w * b.d * b.h for b in boxes)
    envelope = PALLET.width * PALLET.depth * height_cm
    utilisation = packed / envelope if envelope else 0.0

    return {
        "boxes": [dataclasses.asdict(b) for b in boxes],
        "heightCm": height_cm,
        "utilisation": round(utilisation, 3),
        "status": status_name,
        "engine": {
            **base_engine,
            "objectiveCm": height_cm,
            "bestBoundCm": int(best_bound),
            "gapPct": round(100 * gap, 2),
            "utilisation": round(utilisation, 3),
            "wallTimeS": round(wall, 3),
            "stabilityApplied": stability_applied,
            "comZcm": round(vertical_com_cm(boxes, SKUS), 1),
        },
    }


@click.command()
@click.option(
    "--input",
    "-i",
    "input_path",
    type=click.Path(exists=True, dir_okay=False),
    default=None,
    help="config JSON to solve; omit to solve the shipped defaults.",
)
@click.option(
    "--out",
    "-o",
    "out_path",
    type=click.Path(dir_okay=False),
    default=None,
    help="write the solution JSON here; omit to print to stdout.",
)
@click.option("--time-limit", type=float, default=None, help="override solver time limit (s).")
@click.option("--workers", type=int, default=None, help="override search workers.")
@click.option("--quiet", is_flag=True, help="suppress the CP-SAT search log.")
def main(input_path, out_path, time_limit, workers, quiet) -> None:
    """
    Solve the parcie pallet packing model and emit solution JSON.
    """
    if input_path:
        with open(input_path) as f:
            req = SolveRequest.model_validate_json(f.read())
    else:
        req = SolveRequest()

    if time_limit is not None:
        req.solver.timeLimitS = time_limit
    if workers is not None:
        req.solver.workers = workers

    solution = solve_from_config(req, log=not quiet)

    boxes = solution["boxes"]
    click.echo(
        f"\n{solution['status']}  height={solution['heightCm']}cm  "
        f"utilisation={solution['utilisation']:.3f}  "
        f"boxes={len(boxes)}",
        err=True,
    )
    if not boxes:
        raise SystemExit(1)

    payload = json.dumps(solution, indent=2)
    if out_path:
        with open(out_path, "w") as f:
            f.write(payload + "\n")
        click.echo(f"wrote {out_path}", err=True)
    else:
        click.echo(payload)


if __name__ == "__main__":
    main()
