"use client";

import { useMemo, useState } from "react";
import { BOXES, SKUS } from "@/lib/data";
import {
  AISLES,
  NAIVE_ROUTE,
  OPTIMIZED_ROUTE,
  PICKS,
  type Route,
  WAREHOUSE,
  estimateMinutes,
  pickPosition,
  pickSku,
} from "@/lib/warehouse";

type Mode = "optimized" | "naive";

function formatMinutes(min: number) {
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function RouteViewer() {
  const [mode, setMode] = useState<Mode>("optimized");
  const [selected, setSelected] = useState<number | null>(null);

  const route: Route = mode === "optimized" ? OPTIMIZED_ROUTE : NAIVE_ROUTE;
  const orderMap = useMemo(() => {
    const map = new Map<number, number>();
    route.order.forEach((pickIdx, step) => map.set(pickIdx, step + 1));
    return map;
  }, [route]);

  const stats = [
    {
      label: "Distance",
      value: `${route.distanceM} m`,
      delta:
        mode === "optimized"
          ? `−${Math.round((1 - route.distanceM / NAIVE_ROUTE.distanceM) * 100)}% vs naive`
          : null,
    },
    {
      label: "Pick time",
      value: formatMinutes(estimateMinutes(route.distanceM, PICKS.length)),
      delta: null,
    },
    {
      label: "Aisle revisits",
      value: `${route.aisleRevisits}`,
      delta: mode === "optimized" ? "0 backtracks" : `${route.aisleRevisits} backtracks`,
    },
    {
      label: "Picks",
      value: `${PICKS.length}`,
      delta: `${new Set(PICKS.map((p) => p.aisleId)).size} aisles`,
    },
  ];

  const selectedPick = selected !== null ? PICKS[selected] : null;
  const selectedBox = selectedPick ? BOXES[selectedPick.boxIdx] : null;
  const selectedSku = selectedPick ? SKUS[pickSku(selectedPick)] : null;

  const { viewBox } = WAREHOUSE;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-medium">Pick route</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {PICKS.length} picks · {new Set(PICKS.map((p) => p.aisleId)).size} aisles ·{" "}
            {route.distanceM} m total walking
          </div>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border border-[var(--border-strong)] overflow-hidden text-sm">
            <button
              onClick={() => setMode("optimized")}
              className={`px-3 h-9 transition ${
                mode === "optimized"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "hover:bg-[var(--surface-2)]"
              }`}
            >
              Optimized
            </button>
            <button
              onClick={() => setMode("naive")}
              className={`px-3 h-9 border-l border-[var(--border-strong)] transition ${
                mode === "naive"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "hover:bg-[var(--surface-2)]"
              }`}
            >
              Naive
            </button>
          </div>
        </div>
      </div>

      <div className="relative bg-[var(--surface)] rounded-xl p-4">
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="block w-full h-[440px] select-none"
          role="img"
          aria-label="Top-down warehouse pick route"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <rect
            x={20}
            y={20}
            width={viewBox.w - 40}
            height={viewBox.h - 40}
            rx={10}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={0.75}
            strokeDasharray="2 3"
          />

          {AISLES.map((aisle) => {
            const shelfH =
              WAREHOUSE.aisleSpan.bottom - WAREHOUSE.aisleSpan.top;
            const shelfW = 32;
            const sku = aisle.skuFilter !== undefined ? SKUS[aisle.skuFilter] : null;
            return (
              <g key={aisle.id}>
                <text
                  x={aisle.x}
                  y={32}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={500}
                  fill="var(--foreground)"
                >
                  {aisle.id}
                </text>
                <text
                  x={aisle.x}
                  y={WAREHOUSE.viewBox.h - 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-muted)"
                >
                  {aisle.name}
                </text>
                {(["L", "R"] as const).map((side) => {
                  const sx =
                    aisle.x + (side === "L" ? -WAREHOUSE.bayOffsetX - shelfW / 2 : WAREHOUSE.bayOffsetX - shelfW / 2);
                  return (
                    <g key={side}>
                      <rect
                        x={sx}
                        y={WAREHOUSE.aisleSpan.top}
                        width={shelfW}
                        height={shelfH}
                        rx={2}
                        fill={sku ? sku.ramp.fill : "var(--surface-2)"}
                        fillOpacity={sku ? 0.18 : 0.5}
                        stroke="var(--border)"
                        strokeWidth={0.5}
                      />
                      {Array.from({ length: WAREHOUSE.baysPerSide - 1 }, (_, i) => (
                        <line
                          key={i}
                          x1={sx}
                          x2={sx + shelfW}
                          y1={WAREHOUSE.aisleSpan.top + (i + 1) * WAREHOUSE.bayHeight}
                          y2={WAREHOUSE.aisleSpan.top + (i + 1) * WAREHOUSE.bayHeight}
                          stroke="var(--border)"
                          strokeWidth={0.5}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>
            );
          })}

          <path
            d={route.pathD}
            fill="none"
            stroke="var(--foreground)"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={mode === "naive" ? "4 3" : undefined}
            style={{ pointerEvents: "none" }}
          />

          <g style={{ pointerEvents: "none" }}>
            <circle
              cx={WAREHOUSE.dock.x}
              cy={WAREHOUSE.dock.y}
              r={6}
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={1.2}
            />
            <text
              x={WAREHOUSE.dock.x}
              y={WAREHOUSE.dock.y + 18}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted)"
            >
              Dock
            </text>
          </g>

          {PICKS.map((pick, idx) => {
            const pos = pickPosition(pick);
            const sku = SKUS[pickSku(pick)];
            const isSelected = selected === idx;
            const isDimmed = selected !== null && !isSelected;
            const order = orderMap.get(idx);
            return (
              <g
                key={idx}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected((s) => (s === idx ? null : idx));
                }}
              >
                <rect
                  x={pos.x - 6}
                  y={pos.y - 6}
                  width={12}
                  height={12}
                  rx={2}
                  fill={sku.ramp.fill}
                  fillOpacity={isDimmed ? 0.25 : 1}
                  stroke={sku.ramp.stroke}
                  strokeWidth={isSelected ? 1.6 : 0.8}
                  strokeOpacity={isDimmed ? 0.4 : 1}
                />
                {order !== undefined && (
                  <text
                    x={pos.x}
                    y={pos.y + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={600}
                    fill={sku.ramp.stroke}
                    fillOpacity={isDimmed ? 0.5 : 1}
                    style={{ pointerEvents: "none" }}
                  >
                    {order}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-muted)] pointer-events-none">
          {mode === "optimized" ? "engine-optimized" : "naive ordering"}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[var(--background)] border border-[var(--border)] rounded-md px-3 py-2.5"
          >
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            <div className="text-base font-medium mt-0.5">{s.value}</div>
            {s.delta && (
              <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{s.delta}</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {SKUS.map((sku, i) => {
          const count = PICKS.filter((p) => pickSku(p) === i).length;
          return (
            <div
              key={sku.id}
              className="inline-flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: sku.ramp.fill, border: `1px solid ${sku.ramp.stroke}` }}
              />
              <span>
                {sku.id} · {sku.category}
              </span>
              <span className="text-[var(--text-muted)]">· {count}</span>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-[var(--text-muted)] min-h-[1.5rem]">
        {selectedPick && selectedBox && selectedSku ? (
          <span>
            <strong className="text-[var(--foreground)] font-medium">
              Step {orderMap.get(selected!)}
            </strong>
            {" · "}
            {selectedSku.name}
            {" · "}aisle {selectedPick.aisleId} bay {selectedPick.bay + 1}{" "}
            {selectedPick.side === "L" ? "left" : "right"}
            {" · "}
            {selectedBox.w}×{selectedBox.d}×{selectedBox.h} cm · {selectedSku.weightKg} kg
          </span>
        ) : (
          <>Click a pick to inspect. {PICKS.length} picks across the route.</>
        )}
      </div>
    </div>
  );
}
