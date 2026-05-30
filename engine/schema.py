"""
Request schema for a solve.

This is the contract between the `/constraints` page (which builds the config),
the FastAPI service, and the click CLI. Field names are camelCase to match the
JSON the front-end sends and the `solution.json` the front-end reads back.

Only `stacking` and `solver` change the solve today. `objectiveWeights` and
`rules` are accepted and echoed so the schema is complete, but the model has a
single objective (minimise envelope height), so they do not yet steer it. That
is called out rather than faked.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .data import SKUS, can_stack


class SolverParams(BaseModel):
    """
    Search budget passed straight to CP-SAT.
    """

    timeLimitS: float = 30.0
    workers: int = 8


class SolveRequest(BaseModel):
    """
    Everything the engine needs for one solve. Every field has a default, so an
    empty body `{}` solves the shipped scenario.
    """

    stacking: list[list[bool]] | None = None
    # When set, run the lexicographic stability tie-break: among equal-height
    # packings, pick the one with the lowest vertical centre of mass.
    stability: bool = False
    objectiveWeights: dict[str, float] = Field(default_factory=dict)
    rules: list[str] = Field(default_factory=list)
    solver: SolverParams = Field(default_factory=SolverParams)


def default_stacking() -> list[list[bool]]:
    """
    The weight-derived compatibility matrix: entry [top][bottom] is True when a
    carton of SKU `top` may rest on SKU `bottom`. This is the same rule as
    `can_stack`, materialised so the front-end can show and override it.
    """
    n = len(SKUS)
    return [[can_stack(top, bottom) for bottom in range(n)] for top in range(n)]


def stacking_matrix(req: SolveRequest) -> list[list[bool]]:
    """
    Resolve the request's stacking matrix, falling back to the weight-derived
    default when the request omits one. Validates the shape so a malformed
    override fails loudly instead of silently packing wrong.
    """
    if req.stacking is None:
        return default_stacking()
    n = len(SKUS)
    if len(req.stacking) != n or any(len(row) != n for row in req.stacking):
        raise ValueError(f"stacking must be a {n}x{n} matrix, one cell per SKU pair")
    return [[bool(cell) for cell in row] for row in req.stacking]
