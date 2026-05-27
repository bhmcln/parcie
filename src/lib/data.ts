export type Sku = {
  id: string;
  name: string;
  category: string;
  weightKg: number;
  fragility: "low" | "medium" | "high";
  maxStackKg: number;
  ramp: { fill: string; stroke: string };
};

export type Box = {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  sku: number;
};

export const SKUS: Sku[] = [
  {
    id: "A",
    name: "Tinned tomatoes",
    category: "Tinned & jars",
    weightKg: 9.6,
    fragility: "low",
    maxStackKg: 120,
    ramp: { fill: "#B5D4F4", stroke: "#185FA5" },
  },
  {
    id: "B",
    name: "Pasta & dry goods",
    category: "Dry goods",
    weightKg: 4.2,
    fragility: "low",
    maxStackKg: 60,
    ramp: { fill: "#9FE1CB", stroke: "#0F6E56" },
  },
  {
    id: "C",
    name: "Cereal cartons",
    category: "Cereal",
    weightKg: 2.8,
    fragility: "medium",
    maxStackKg: 18,
    ramp: { fill: "#F5C4B3", stroke: "#993C1D" },
  },
  {
    id: "D",
    name: "Sliced bread",
    category: "Bakery",
    weightKg: 0.6,
    fragility: "high",
    maxStackKg: 2,
    ramp: { fill: "#FAC775", stroke: "#854F0B" },
  },
];

export const BOXES: Box[] = [
  { x: 0,  y: 0,  z: 0,  w: 50, d: 40, h: 30, sku: 0 },
  { x: 50, y: 0,  z: 0,  w: 50, d: 40, h: 30, sku: 0 },
  { x: 0,  y: 40, z: 0,  w: 50, d: 40, h: 30, sku: 0 },
  { x: 50, y: 40, z: 0,  w: 50, d: 40, h: 30, sku: 0 },
  { x: 0,  y: 0,  z: 30, w: 35, d: 35, h: 25, sku: 1 },
  { x: 35, y: 0,  z: 30, w: 35, d: 35, h: 25, sku: 1 },
  { x: 70, y: 0,  z: 30, w: 30, d: 35, h: 25, sku: 1 },
  { x: 0,  y: 35, z: 30, w: 35, d: 45, h: 25, sku: 1 },
  { x: 35, y: 35, z: 30, w: 35, d: 45, h: 25, sku: 1 },
  { x: 70, y: 35, z: 30, w: 30, d: 45, h: 25, sku: 1 },
  { x: 0,  y: 0,  z: 55, w: 40, d: 80, h: 35, sku: 2 },
  { x: 40, y: 0,  z: 55, w: 40, d: 80, h: 35, sku: 2 },
  { x: 80, y: 0,  z: 55, w: 20, d: 80, h: 20, sku: 3 },
  { x: 80, y: 0,  z: 75, w: 20, d: 80, h: 15, sku: 3 },
];

export const PALLET = { w: 100, d: 80, h: 8 };
