import { BOXES } from "./data";

export type Aisle = {
  id: string;
  name: string;
  x: number;
  skuFilter?: number;
};

export type Pick = {
  boxIdx: number;
  aisleId: string;
  bay: number;
  side: "L" | "R";
};

export const WAREHOUSE = {
  viewBox: { x: 0, y: 0, w: 760, h: 500 },
  bayHeight: 40,
  baysPerSide: 8,
  topCrossY: 40,
  bottomCrossY: 400,
  aisleSpan: { top: 50, bottom: 390 },
  bayOffsetX: 22,
  dock: { x: 380, y: 460 },
  pxPerMeter: 8,
};

export const AISLES: Aisle[] = [
  { id: "A1", name: "Beverages",     x: 80  },
  { id: "A2", name: "Tinned & jars", x: 200, skuFilter: 0 },
  { id: "A3", name: "Dry goods",     x: 320, skuFilter: 1 },
  { id: "A4", name: "Cereal",        x: 440, skuFilter: 2 },
  { id: "A5", name: "Bakery",        x: 560, skuFilter: 3 },
  { id: "A6", name: "Frozen",        x: 680 },
];

export const PICKS: Pick[] = [
  { boxIdx: 0,  aisleId: "A2", bay: 0, side: "L" },
  { boxIdx: 1,  aisleId: "A2", bay: 1, side: "R" },
  { boxIdx: 2,  aisleId: "A2", bay: 3, side: "L" },
  { boxIdx: 3,  aisleId: "A2", bay: 5, side: "R" },
  { boxIdx: 4,  aisleId: "A3", bay: 0, side: "R" },
  { boxIdx: 5,  aisleId: "A3", bay: 1, side: "L" },
  { boxIdx: 6,  aisleId: "A3", bay: 2, side: "R" },
  { boxIdx: 7,  aisleId: "A3", bay: 4, side: "L" },
  { boxIdx: 8,  aisleId: "A3", bay: 5, side: "R" },
  { boxIdx: 9,  aisleId: "A3", bay: 7, side: "L" },
  { boxIdx: 10, aisleId: "A4", bay: 2, side: "L" },
  { boxIdx: 11, aisleId: "A4", bay: 5, side: "R" },
  { boxIdx: 12, aisleId: "A5", bay: 1, side: "R" },
  { boxIdx: 13, aisleId: "A5", bay: 6, side: "L" },
];

export function pickPosition(pick: Pick) {
  const aisle = AISLES.find((a) => a.id === pick.aisleId)!;
  return {
    x: aisle.x + (pick.side === "L" ? -WAREHOUSE.bayOffsetX : WAREHOUSE.bayOffsetX),
    y: WAREHOUSE.aisleSpan.top + (pick.bay + 0.5) * WAREHOUSE.bayHeight,
  };
}

export type Route = {
  order: number[];
  pathD: string;
  distancePx: number;
  distanceM: number;
  aisleVisits: number;
  aisleRevisits: number;
};

function buildOptimizedRoute(): Route {
  const aisleOrder = AISLES.filter((a) => a.skuFilter !== undefined).map((a) => a.id);

  let path = "";
  let distancePx = 0;
  const order: number[] = [];
  let cur = { ...WAREHOUSE.dock };

  const moveTo = (x: number, y: number) => {
    path += `L ${x} ${y} `;
    distancePx += Math.abs(x - cur.x) + Math.abs(y - cur.y);
    cur = { x, y };
  };

  path = `M ${cur.x} ${cur.y} `;
  moveTo(cur.x, WAREHOUSE.bottomCrossY);

  let goingUp = true;
  for (const aisleId of aisleOrder) {
    const aisle = AISLES.find((a) => a.id === aisleId)!;
    const aislePicks = PICKS.map((p, i) => ({ pick: p, idx: i }))
      .filter(({ pick }) => pick.aisleId === aisleId)
      .sort((a, b) => {
        const ya = pickPosition(a.pick).y;
        const yb = pickPosition(b.pick).y;
        return goingUp ? yb - ya : ya - yb;
      });

    moveTo(aisle.x, cur.y);

    for (const { pick, idx } of aislePicks) {
      const pos = pickPosition(pick);
      moveTo(aisle.x, pos.y);
      moveTo(pos.x, pos.y);
      moveTo(aisle.x, pos.y);
      order.push(idx);
    }

    moveTo(aisle.x, goingUp ? WAREHOUSE.topCrossY : WAREHOUSE.bottomCrossY);
    goingUp = !goingUp;
  }

  moveTo(WAREHOUSE.dock.x, cur.y);
  moveTo(WAREHOUSE.dock.x, WAREHOUSE.dock.y);

  return {
    order,
    pathD: path.trim(),
    distancePx,
    distanceM: Math.round(distancePx / WAREHOUSE.pxPerMeter),
    aisleVisits: aisleOrder.length,
    aisleRevisits: 0,
  };
}

function buildNaiveRoute(): Route {
  // Naive: pick in pallet-build order, but the engine hasn't aligned
  // SKU→aisle assignment — so it bounces between aisles. We fake that
  // by re-shuffling some picks to force aisle revisits.
  const interleaved: Pick[] = [
    PICKS[0], PICKS[4], PICKS[10], PICKS[1], PICKS[5], PICKS[12],
    PICKS[6], PICKS[2], PICKS[11], PICKS[7], PICKS[13], PICKS[3],
    PICKS[8], PICKS[9],
  ];

  let path = "";
  let distancePx = 0;
  let cur = { ...WAREHOUSE.dock };
  let lastAisle: string | null = null;
  let revisits = 0;
  const seenAisles = new Set<string>();

  const moveTo = (x: number, y: number) => {
    path += `L ${x} ${y} `;
    distancePx += Math.abs(x - cur.x) + Math.abs(y - cur.y);
    cur = { x, y };
  };

  path = `M ${cur.x} ${cur.y} `;
  moveTo(cur.x, WAREHOUSE.bottomCrossY);

  for (const pick of interleaved) {
    const aisle = AISLES.find((a) => a.id === pick.aisleId)!;
    const pos = pickPosition(pick);
    if (lastAisle && lastAisle !== pick.aisleId && seenAisles.has(pick.aisleId)) {
      revisits++;
    }
    seenAisles.add(pick.aisleId);
    moveTo(aisle.x, cur.y);
    moveTo(aisle.x, pos.y);
    moveTo(pos.x, pos.y);
    moveTo(aisle.x, pos.y);
    lastAisle = pick.aisleId;
  }

  moveTo(cur.x, WAREHOUSE.bottomCrossY);
  moveTo(WAREHOUSE.dock.x, WAREHOUSE.bottomCrossY);
  moveTo(WAREHOUSE.dock.x, WAREHOUSE.dock.y);

  return {
    order: interleaved.map((p) => PICKS.indexOf(p)),
    pathD: path.trim(),
    distancePx,
    distanceM: Math.round(distancePx / WAREHOUSE.pxPerMeter),
    aisleVisits: seenAisles.size + revisits,
    aisleRevisits: revisits,
  };
}

export const OPTIMIZED_ROUTE = buildOptimizedRoute();
export const NAIVE_ROUTE = buildNaiveRoute();

export function pickSku(pick: Pick): number {
  return BOXES[pick.boxIdx].sku;
}

export function estimateMinutes(distanceM: number, pickCount: number) {
  const walkSeconds = distanceM / 1.0;
  const pickSeconds = pickCount * 12;
  return (walkSeconds + pickSeconds) / 60;
}
