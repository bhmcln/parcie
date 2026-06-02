"""
FastAPI wrapper around the packing engine.

    uv run uvicorn engine.api:app --reload        # dev server on :8000

The Next.js app posts a config to `/solve` (through its own `/api/solve`
proxy) and renders the returned solution on `/pallet` and `/engine`. The body
and response shapes are the same `SolveRequest` and solution dict the click CLI
uses, so the two entrypoints stay in lockstep.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .schema import SolveRequest, default_stacking
from .solve import solve_from_config

app = FastAPI(title="parcie engine", version="0.1.0")


@app.get("/health")
def health() -> dict:
    """
    Liveness check, plus the weight-derived stacking matrix the front-end uses
    as the default before any override.
    """
    return {"status": "ok", "defaultStacking": default_stacking()}


@app.post("/solve")
def solve(req: SolveRequest) -> dict:
    """
    Solve one packing request. Returns the solution JSON; a bad stacking matrix
    is a 422.
    """
    try:
        return solve_from_config(req, log=False)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
