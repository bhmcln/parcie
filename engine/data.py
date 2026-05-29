"""
Domain data for the pallet-packing engine.

Mirrors the SKU definitions in `src/lib/data.ts` so the engine output can be
compared against (and eventually replace) the hand-placed boxes the front-end
ships with. Lengths are centimetres, weights kilograms.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Sku:
    """
    A stock-keeping unit. `max_stack_kg` is how much weight a carton of this
    SKU can bear on its top face before it is crushed.
    """

    id: str
    name: str
    category: str
    weight_kg: float
    fragility: str  # "low" | "medium" | "high"
    max_stack_kg: float
    fill: str
    stroke: str


@dataclass(frozen=True)
class Pallet:
    """
    The pallet footprint and the usable stacking height above it, in cm.
    """

    width: int
    depth: int
    max_height: int


@dataclass(frozen=True)
class Carton:
    """
    A single physical carton to be placed. `sku` indexes into `SKUS`.
    Dimensions are the carton's natural (unrotated) width, depth, height.
    """

    sku: int
    w: int
    d: int
    h: int


# Mirrors SKUS in src/lib/data.ts.
SKUS: list[Sku] = [
    Sku("A", "Tinned tomatoes", "Tinned & jars", 9.6, "low", 120, "#B5D4F4", "#185FA5"),
    Sku("B", "Pasta & dry goods", "Dry goods", 4.2, "low", 60, "#9FE1CB", "#0F6E56"),
    Sku("C", "Cereal cartons", "Cereal", 2.8, "medium", 18, "#F5C4B3", "#993C1D"),
    Sku("D", "Sliced bread", "Bakery", 0.6, "high", 2, "#FAC775", "#854F0B"),
]

PALLET = Pallet(width=100, depth=80, max_height=220)

# (sku index, w, d, h, quantity). Totals 14 cartons, matching BOXES in data.ts.
_CARTON_SPEC: list[tuple[int, int, int, int, int]] = [
    (0, 50, 40, 30, 4),
    (1, 35, 35, 25, 6),
    (2, 40, 80, 35, 2),
    (3, 20, 80, 18, 2),
]

CARTONS: list[Carton] = [
    Carton(sku, w, d, h)
    for (sku, w, d, h, qty) in _CARTON_SPEC
    for _ in range(qty)
]


def can_stack(top: int, bottom: int) -> bool:
    """
    True if a carton of SKU `top` may rest directly on a carton of SKU `bottom`,
    i.e. the top carton's weight does not exceed the bottom carton's load cap.
    """
    return SKUS[top].weight_kg <= SKUS[bottom].max_stack_kg
