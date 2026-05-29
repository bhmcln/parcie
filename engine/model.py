"""
CP-SAT model for heterogeneous 3D pallet packing.

The whole model is built by `build_model`. Everything downstream (solve, tests)
goes through that one entrypoint rather than poking at individual constraint
groups, so the model is only ever exercised as a coherent whole.

Geometry follows the orthogonal-packing formulation: two cartons do not overlap
iff they are separated on at least one of the x, y, z axes. CP-SAT expresses
that disjunction directly with a bool-or over reified separations, which is far
cleaner than the Big-M encoding a MIP would need.
"""

from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from .data import Carton, Pallet, Sku, can_stack


@dataclass
class PackingVars:
    """
    Handles on the decision variables, returned by `build_model` so callers can
    read the solution back out without re-deriving variable names.
    """

    x: list[cp_model.IntVar]
    y: list[cp_model.IntVar]
    z: list[cp_model.IntVar]
    w: list[cp_model.IntVar]  # effective width after orientation
    d: list[cp_model.IntVar]  # effective depth after orientation
    h: list[int]  # height is fixed; cartons are never tipped onto their side
    rotated: list[cp_model.IntVar]  # bool: footprint rotated 90 deg
    on_floor: list[cp_model.IntVar]  # bool: carton sits on the pallet deck
    rests_on: dict[tuple[int, int], cp_model.IntVar]  # (i, j) -> i rests on j
    height: cp_model.IntVar  # stack envelope height, the objective


def build_model(
    cartons: list[Carton],
    pallet: Pallet,
    skus: list[Sku],
) -> tuple[cp_model.CpModel, PackingVars]:
    """
    Build the full packing model: orientation, pallet bounding box, pairwise
    3D non-overlap, support (no floating cartons), and stacking compatibility.
    Objective minimises the stack envelope height, which maximises volume
    utilisation for a fixed set of cartons.
    """
    model = cp_model.CpModel()
    n = len(cartons)
    W, D, Hmax = pallet.width, pallet.depth, pallet.max_height

    x = [model.new_int_var(0, W, f"x{i}") for i in range(n)]
    y = [model.new_int_var(0, D, f"y{i}") for i in range(n)]
    z = [model.new_int_var(0, Hmax, f"z{i}") for i in range(n)]

    rotated = [model.new_bool_var(f"rot{i}") for i in range(n)]
    w = [model.new_int_var(0, max(W, D), f"w{i}") for i in range(n)]
    d = [model.new_int_var(0, max(W, D), f"d{i}") for i in range(n)]
    h = [c.h for c in cartons]

    # Orientation: either keep (w, d) or swap to (d, w). Height is fixed.
    for i, c in enumerate(cartons):
        model.add(w[i] == c.w).only_enforce_if(rotated[i].Not())
        model.add(d[i] == c.d).only_enforce_if(rotated[i].Not())
        model.add(w[i] == c.d).only_enforce_if(rotated[i])
        model.add(d[i] == c.w).only_enforce_if(rotated[i])
        # A square footprint has nothing to gain from rotating; pin it.
        if c.w == c.d:
            model.add(rotated[i] == 0)

    # Pallet bounding box.
    for i in range(n):
        model.add(x[i] + w[i] <= W)
        model.add(y[i] + d[i] <= D)
        model.add(z[i] + h[i] <= Hmax)

    # Pairwise 3D non-overlap: separated on at least one axis.
    for i in range(n):
        for j in range(i + 1, n):
            left = model.new_bool_var(f"left_{i}_{j}")  # i is left of j
            right = model.new_bool_var(f"right_{i}_{j}")
            front = model.new_bool_var(f"front_{i}_{j}")
            back = model.new_bool_var(f"back_{i}_{j}")
            below = model.new_bool_var(f"below_{i}_{j}")
            above = model.new_bool_var(f"above_{i}_{j}")

            model.add(x[i] + w[i] <= x[j]).only_enforce_if(left)
            model.add(x[j] + w[j] <= x[i]).only_enforce_if(right)
            model.add(y[i] + d[i] <= y[j]).only_enforce_if(front)
            model.add(y[j] + d[j] <= y[i]).only_enforce_if(back)
            model.add(z[i] + h[i] <= z[j]).only_enforce_if(below)
            model.add(z[j] + h[j] <= z[i]).only_enforce_if(above)

            model.add_bool_or(left, right, front, back, below, above)

    # Support: every carton either sits on the deck or rests directly on top of
    # at least one carton whose footprint it overlaps and which can bear it.
    on_floor = [model.new_bool_var(f"floor{i}") for i in range(n)]
    rests_on: dict[tuple[int, int], cp_model.IntVar] = {}

    for i in range(n):
        model.add(z[i] == 0).only_enforce_if(on_floor[i])
        model.add(z[i] >= 1).only_enforce_if(on_floor[i].Not())

        supporters = []
        for j in range(n):
            if i == j:
                continue
            # Stacking compatibility is a hard gate: if SKU i cannot rest on
            # SKU j, the support literal never exists, so it cannot be chosen.
            if not can_stack(cartons[i].sku, cartons[j].sku):
                continue

            r = model.new_bool_var(f"rest_{i}_on_{j}")
            rests_on[(i, j)] = r
            # Bottom of i flush with top of j.
            model.add(z[i] == z[j] + h[j]).only_enforce_if(r)
            # Footprints must overlap by at least 1 cm in both x and y.
            model.add(x[i] <= x[j] + w[j] - 1).only_enforce_if(r)
            model.add(x[j] <= x[i] + w[i] - 1).only_enforce_if(r)
            model.add(y[i] <= y[j] + d[j] - 1).only_enforce_if(r)
            model.add(y[j] <= y[i] + d[i] - 1).only_enforce_if(r)
            supporters.append(r)

        # If not on the floor, at least one supporter must hold it up.
        if supporters:
            model.add(sum(supporters) >= 1).only_enforce_if(on_floor[i].Not())
        else:
            # Nothing can legally support this carton: it must be on the deck.
            model.add(on_floor[i] == 1)

    # Symmetry breaking: identical cartons (same SKU, same dims) are
    # interchangeable. Force a lexicographic ordering on their base corner so
    # the solver does not waste time on permutations of the same layout.
    for i in range(n):
        for j in range(i + 1, n):
            if cartons[i] == cartons[j]:
                # z[i] <= z[j], and ties broken on (x, y). Encoded as a single
                # ordering on a flattened coordinate.
                key_i = z[i] * (W + 1) * (D + 1) + x[i] * (D + 1) + y[i]
                key_j = z[j] * (W + 1) * (D + 1) + x[j] * (D + 1) + y[j]
                model.add(key_i <= key_j)

    # Objective: minimise the stacking envelope height. With a fixed carton set
    # this maximises volume utilisation (packed volume / footprint x height).
    height = model.new_int_var(0, Hmax, "height")
    for i in range(n):
        model.add(height >= z[i] + h[i])
    model.minimize(height)

    return model, PackingVars(
        x=x,
        y=y,
        z=z,
        w=w,
        d=d,
        h=h,
        rotated=rotated,
        on_floor=on_floor,
        rests_on=rests_on,
        height=height,
    )


def model_dimensions(cartons: list[Carton]) -> tuple[list[dict], list[dict]]:
    """
    Analytic breakdown of the decision variables and constraints `build_model`
    creates, grouped for display. Counts are derived from the same structure
    the model uses; `test_model_dimensions_match_proto` asserts the totals
    equal the built model's proto, so this cannot silently drift.
    """
    n = len(cartons)
    pairs = n * (n - 1) // 2
    supports = sum(
        1
        for i in range(n)
        for j in range(n)
        if i != j and can_stack(cartons[i].sku, cartons[j].sku)
    )
    squares = sum(1 for c in cartons if c.w == c.d)
    twins = sum(
        1
        for i in range(n)
        for j in range(i + 1, n)
        if cartons[i] == cartons[j]
    )

    decision_vars = [
        {"name": "Position (x, y, z)", "formula": f"{n} cartons x 3 axes", "count": 3 * n},
        {"name": "Effective footprint", "formula": f"{n} x (w, d)", "count": 2 * n},
        {"name": "Orientation flags", "formula": f"{n} cartons", "count": n},
        {"name": "Floor flags", "formula": f"{n} cartons", "count": n},
        {"name": "Separation literals", "formula": f"{pairs} pairs x 6 axes", "count": 6 * pairs},
        {"name": "Support literals", "formula": "compatible (i on j)", "count": supports},
        {"name": "Envelope height", "formula": "objective", "count": 1},
    ]

    constraint_groups = [
        {"name": "Orientation linking", "kind": "geometric", "count": 4 * n + squares},
        {"name": "Pallet bounding box", "kind": "geometric", "count": 3 * n},
        {"name": "Non-overlap (cuboids)", "kind": "geometric", "count": 7 * pairs},
        {"name": "Support & stacking", "kind": "stability", "count": 3 * n + 5 * supports},
        {"name": "Envelope height", "kind": "objective", "count": n},
        {"name": "Symmetry breaking", "kind": "search", "count": twins},
    ]

    return decision_vars, constraint_groups


@dataclass
class PlacedBox:
    """
    A solved carton placement, in the same shape as the front-end `Box` type.
    """

    x: int
    y: int
    z: int
    w: int
    d: int
    h: int
    sku: int


def extract_solution(
    solver: cp_model.CpSolver,
    cartons: list[Carton],
    pv: PackingVars,
) -> list[PlacedBox]:
    """
    Read the placed boxes out of a solved model.
    """
    boxes = []
    for i, c in enumerate(cartons):
        boxes.append(
            PlacedBox(
                x=int(solver.value(pv.x[i])),
                y=int(solver.value(pv.y[i])),
                z=int(solver.value(pv.z[i])),
                w=int(solver.value(pv.w[i])),
                d=int(solver.value(pv.d[i])),
                h=pv.h[i],
                sku=c.sku,
            )
        )
    return boxes
