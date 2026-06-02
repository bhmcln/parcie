"""
End-to-end tests for the packing engine.

Every test builds the full model through `build_model` and asserts on the
solved placement. There are no tests of individual constraint groups in
isolation: a single constraint is a fragment, not a model.
"""

from __future__ import annotations

from ortools.sat.python import cp_model

from engine.data import CARTONS, PALLET, SKUS, can_stack
from engine.model import PlacedBox, build_model, extract_solution, model_dimensions
from engine.schema import SolveRequest, default_stacking
from engine.solve import solve_from_config


def _solve(allowed=None):
    model, pv = build_model(CARTONS, PALLET, SKUS, allowed=allowed)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 8
    status = solver.solve(model)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE), solver.status_name(status)
    return solver, pv, extract_solution(solver, CARTONS, pv)


def _overlaps(a: PlacedBox, b: PlacedBox) -> bool:
    sep_x = a.x + a.w <= b.x or b.x + b.w <= a.x
    sep_y = a.y + a.d <= b.y or b.y + b.d <= a.y
    sep_z = a.z + a.h <= b.z or b.z + b.h <= a.z
    return not (sep_x or sep_y or sep_z)


def test_all_cartons_placed():
    _, _, boxes = _solve()
    assert len(boxes) == len(CARTONS)


def test_within_pallet_bounds():
    _, _, boxes = _solve()
    for b in boxes:
        assert 0 <= b.x and b.x + b.w <= PALLET.width
        assert 0 <= b.y and b.y + b.d <= PALLET.depth
        assert 0 <= b.z and b.z + b.h <= PALLET.max_height


def test_no_overlap():
    _, _, boxes = _solve()
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            assert not _overlaps(boxes[i], boxes[j]), f"boxes {i} and {j} overlap"


def test_every_box_supported():
    """
    No carton floats or cantilevers: each elevated carton's footprint centre
    sits strictly over a carton it is flush on top of. Centres are doubled to
    stay integer, matching the model's `2*x + w` encoding.
    """
    _, _, boxes = _solve()
    for i, b in enumerate(boxes):
        if b.z == 0:
            continue
        cx2, cy2 = 2 * b.x + b.w, 2 * b.y + b.d
        supported = False
        for j, other in enumerate(boxes):
            if i == j:
                continue
            flush = other.z + other.h == b.z
            centre_over_x = 2 * other.x < cx2 < 2 * other.x + 2 * other.w
            centre_over_y = 2 * other.y < cy2 < 2 * other.y + 2 * other.d
            if flush and centre_over_x and centre_over_y:
                supported = True
                break
        assert supported, f"box {i} at z={b.z} centre is not over a supporter"


def test_model_dimensions_match_proto():
    """
    The displayed variable/constraint breakdown must sum to the real model, so
    the `/engine` page never shows fabricated counts.
    """
    model, _ = build_model(CARTONS, PALLET, SKUS)
    decision_vars, constraint_groups = model_dimensions(CARTONS, SKUS)
    assert sum(v["count"] for v in decision_vars) == len(model.proto.variables)
    assert sum(g["count"] for g in constraint_groups) == len(model.proto.constraints)


def test_custom_stacking_matrix_matches_proto():
    """
    An overridden stacking matrix must thread identically into `build_model`
    and `model_dimensions`: the displayed counts still equal the real proto, so
    a constraint change on `/constraints` never desyncs the `/engine` view.
    """
    allowed = default_stacking()
    allowed[2][2] = False  # forbid cereal-on-cereal, otherwise permitted
    model, _ = build_model(CARTONS, PALLET, SKUS, allowed=allowed)
    decision_vars, constraint_groups = model_dimensions(CARTONS, SKUS, allowed)
    assert sum(v["count"] for v in decision_vars) == len(model.proto.variables)
    assert sum(g["count"] for g in constraint_groups) == len(model.proto.constraints)


def test_solve_from_config_default():
    """
    The shared core that both the CLI and FastAPI call returns a placement for
    every carton, with the engine stats the `/engine` view renders.
    """
    solution = solve_from_config(SolveRequest())
    assert solution["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(solution["boxes"]) == len(CARTONS)
    assert solution["heightCm"] > 0
    engine = solution["engine"]
    assert engine["numVars"] > 0 and engine["numConstraints"] > 0


def test_stability_tie_break_lowers_com_without_adding_height():
    """
    The lexicographic stability tie-break must keep the optimal height and not
    raise the load's centre of mass: it picks a better packing among equal-height
    solutions, it never pays height for stability.
    """
    off = solve_from_config(SolveRequest(stability=False))
    on = solve_from_config(SolveRequest(stability=True))
    assert off["status"] in ("OPTIMAL", "FEASIBLE")
    assert on["status"] in ("OPTIMAL", "FEASIBLE")
    assert on["heightCm"] == off["heightCm"]
    assert on["engine"]["comZcm"] <= off["engine"]["comZcm"]
    assert on["engine"]["stabilityApplied"] is True
    assert off["engine"]["stabilityApplied"] is False
    # The tie-break must not change the reported model size (counts are the
    # height phase, captured before phase two mutates the model).
    assert on["engine"]["numConstraints"] == off["engine"]["numConstraints"]


def test_stacking_compatibility_respected():
    """
    Wherever one carton rests flush on another sharing footprint, the top SKU
    must be allowed to load the bottom SKU.
    """
    _, _, boxes = _solve()
    for i, top in enumerate(boxes):
        for j, bottom in enumerate(boxes):
            if i == j:
                continue
            flush = bottom.z + bottom.h == top.z
            overlap_x = top.x < bottom.x + bottom.w and bottom.x < top.x + top.w
            overlap_y = top.y < bottom.y + bottom.d and bottom.y < top.y + top.d
            if flush and overlap_x and overlap_y:
                assert can_stack(top.sku, bottom.sku), (
                    f"SKU {SKUS[top.sku].id} resting on {SKUS[bottom.sku].id} "
                    f"exceeds its load cap"
                )
