"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Box, PALLET, SKUS } from "@/lib/data";
import { useSolution } from "@/lib/solution-store";

const PALLET_W = PALLET.w;
const PALLET_D = PALLET.d;
const PALLET_H = PALLET.h;
const PITCH = Math.atan(1 / Math.sqrt(2));

const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
const FACE_TOP = [4, 5, 6, 7];
const FACE_RIGHT = [1, 2, 6, 5];
const FACE_FRONT = [0, 1, 5, 4];

type Projected = { x: number; y: number; depth: number };

function project(
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
): Projected {
  const cx = x - PALLET_W / 2;
  const cy = y - PALLET_D / 2;
  const rx = cx * Math.cos(yaw) - cy * Math.sin(yaw);
  const ry = cx * Math.sin(yaw) + cy * Math.cos(yaw);
  return {
    x: rx * scale,
    y: (ry * Math.sin(PITCH) - z * Math.cos(PITCH)) * scale,
    depth: ry * Math.cos(PITCH) + z * Math.sin(PITCH),
  };
}

function projectBoxVerts(b: Box, yaw: number, scale: number): Projected[] {
  return [
    project(b.x,       b.y,       b.z,       yaw, scale),
    project(b.x + b.w, b.y,       b.z,       yaw, scale),
    project(b.x + b.w, b.y + b.d, b.z,       yaw, scale),
    project(b.x,       b.y + b.d, b.z,       yaw, scale),
    project(b.x,       b.y,       b.z + b.h, yaw, scale),
    project(b.x + b.w, b.y,       b.z + b.h, yaw, scale),
    project(b.x + b.w, b.y + b.d, b.z + b.h, yaw, scale),
    project(b.x,       b.y + b.d, b.z + b.h, yaw, scale),
  ];
}

const facePts = (v: Projected[], idxs: number[]) =>
  idxs.map((i) => `${v[i].x},${v[i].y}`).join(" ");

export default function PalletViewer() {
  const { solution } = useSolution();
  const BOXES = solution.boxes;
  const [yaw, setYaw] = useState(Math.PI / 4);
  const [scale, setScale] = useState(2.4);
  const [selected, setSelected] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragDistRef = useRef(0);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setScale((s) => Math.max(1.2, Math.min(5, s * delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // A fresh solve changes the box set; drop any stale selection.
  useEffect(() => setSelected(null), [BOXES]);

  const sortedBoxes = useMemo(() => {
    return BOXES.map((b, idx) => {
      const v = projectBoxVerts(b, yaw, scale);
      const depth = v.reduce((s, p) => s + p.depth, 0) / 8;
      return { box: b, v, idx, depth };
    }).sort((a, b) => a.depth - b.depth);
  }, [yaw, scale, BOXES]);

  const pallet = useMemo(() => {
    const v: Projected[] = [
      project(0, 0, 0, yaw, scale),
      project(PALLET_W, 0, 0, yaw, scale),
      project(PALLET_W, PALLET_D, 0, yaw, scale),
      project(0, PALLET_D, 0, yaw, scale),
      project(0, 0, -PALLET_H, yaw, scale),
      project(PALLET_W, 0, -PALLET_H, yaw, scale),
      project(PALLET_W, PALLET_D, -PALLET_H, yaw, scale),
      project(0, PALLET_D, -PALLET_H, yaw, scale),
    ];
    const slats = Array.from({ length: 5 }, (_, i) => {
      const yOff = (i / 5) * PALLET_D;
      return [
        project(0, yOff, 0, yaw, scale),
        project(PALLET_W, yOff, 0, yaw, scale),
      ] as const;
    });
    return { v, slats };
  }, [yaw, scale]);

  const axes = useMemo(
    () => ({
      o: project(-8, -8, 0, yaw, scale),
      x: project(8, -8, 0, yaw, scale),
      y: project(-8, 8, 0, yaw, scale),
      z: project(-8, -8, 16, yaw, scale),
    }),
    [yaw, scale],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    let lastX = e.clientX;
    dragDistRef.current = 0;
    const onMove = (ev: PointerEvent) => {
      if (!ev.isPrimary) return;
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      dragDistRef.current += Math.abs(dx);
      setYaw((y) => y + dx * 0.012);
    };
    const onUp = (ev: PointerEvent) => {
      if (!ev.isPrimary) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragDistRef.current > 4) return;
    if (e.target === e.currentTarget) setSelected(null);
  };

  const onBoxClick = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragDistRef.current > 4) return;
    setSelected((s) => (s === idx ? null : idx));
  };

  const onPalletClick = () => {
    if (dragDistRef.current > 4) return;
    setSelected(null);
  };

  const selectedBox = selected !== null ? BOXES[selected] : null;
  const selectedSku = selectedBox ? SKUS[selectedBox.sku] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-medium">Pallet packing solution</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {BOXES.length} boxes · {SKUS.length} SKUs · {Math.round(solution.utilisation * 100)}% volume utilisation · {solution.heightCm} cm
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setYaw((y) => y - Math.PI / 12)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] active:scale-95 transition"
            aria-label="Rotate left"
            title="Rotate left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "scaleX(-1)" }}>
              <path d="M19.95 11a8 8 0 1 0-.5 4m.5 5v-5h-5" />
            </svg>
          </button>
          <button
            onClick={() => setYaw((y) => y + Math.PI / 12)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] active:scale-95 transition"
            aria-label="Rotate right"
            title="Rotate right"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.95 11a8 8 0 1 0-.5 4m.5 5v-5h-5" />
            </svg>
          </button>
          <button
            onClick={() => {
              setYaw(Math.PI / 4);
              setScale(2.4);
              setSelected(null);
            }}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] active:scale-95 transition"
            aria-label="Reset view"
            title="Reset view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative bg-[var(--surface)] rounded-xl p-4">
        <svg
          ref={svgRef}
          viewBox="-340 -260 680 480"
          className="block w-full h-[440px] select-none cursor-grab active:cursor-grabbing touch-none"
          role="img"
          aria-label="Isometric 3D wireframe of pallet packing solution"
          onPointerDown={onPointerDown}
          onClick={onBackgroundClick}
        >
          <g onClick={onPalletClick}>
            <polygon points={facePts(pallet.v, [0, 1, 2, 3])} fill="var(--surface-2)" fillOpacity={0.6} />
            <polygon points={facePts(pallet.v, [4, 5, 1, 0])} fill="var(--surface-2)" fillOpacity={0.45} />
            <polygon points={facePts(pallet.v, [5, 6, 2, 1])} fill="var(--surface-2)" fillOpacity={0.35} />
            {pallet.slats.map(([a, b], i) => (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--border-strong)" strokeWidth={0.5} strokeOpacity={0.7}
              />
            ))}
            {EDGES.map(([a, b], i) => (
              <line
                key={i}
                x1={pallet.v[a].x} y1={pallet.v[a].y} x2={pallet.v[b].x} y2={pallet.v[b].y}
                stroke="var(--text-muted)" strokeWidth={0.75} strokeOpacity={0.6} strokeLinecap="round"
              />
            ))}
          </g>

          <g opacity={0.5} style={{ pointerEvents: "none" }}>
            <line x1={axes.o.x} y1={axes.o.y} x2={axes.x.x} y2={axes.x.y} stroke="var(--text-faint)" strokeWidth={0.75} />
            <line x1={axes.o.x} y1={axes.o.y} x2={axes.y.x} y2={axes.y.y} stroke="var(--text-faint)" strokeWidth={0.75} />
            <line x1={axes.o.x} y1={axes.o.y} x2={axes.z.x} y2={axes.z.y} stroke="var(--text-faint)" strokeWidth={0.75} />
            <text x={axes.x.x + 4} y={axes.x.y + 4} fontSize={9} fill="var(--text-faint)">x</text>
            <text x={axes.y.x + 4} y={axes.y.y + 4} fontSize={9} fill="var(--text-faint)">y</text>
            <text x={axes.z.x - 4} y={axes.z.y - 4} fontSize={9} fill="var(--text-faint)">z</text>
          </g>

          {sortedBoxes.map(({ box: b, v, idx }) => {
            const ramp = SKUS[b.sku].ramp;
            const isSelected = selected === idx;
            const isDimmed = selected !== null && !isSelected;
            const fillOpacity = isSelected ? 0.5 : isDimmed ? 0.06 : 0.18;
            const strokeOpacity = isDimmed ? 0.25 : 1;
            const strokeWidth = isSelected ? 1.6 : 1;
            return (
              <g key={idx} style={{ cursor: "pointer" }} onClick={onBoxClick(idx)}>
                <polygon points={facePts(v, FACE_FRONT)} fill={ramp.fill} fillOpacity={fillOpacity} stroke="none" />
                <polygon points={facePts(v, FACE_RIGHT)} fill={ramp.fill} fillOpacity={fillOpacity * 0.75} stroke="none" />
                <polygon points={facePts(v, FACE_TOP)} fill={ramp.fill} fillOpacity={fillOpacity * 1.2} stroke="none" />
                {EDGES.map(([a, c], i) => (
                  <line
                    key={i}
                    x1={v[a].x} y1={v[a].y} x2={v[c].x} y2={v[c].y}
                    stroke={ramp.stroke}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-muted)] pointer-events-none">
          drag to rotate · scroll to zoom
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SKUS.map((sku, i) => {
          const count = BOXES.filter((b) => b.sku === i).length;
          return (
            <div
              key={sku.id}
              className="inline-flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: sku.ramp.fill, border: `1px solid ${sku.ramp.stroke}` }}
              />
              <span>{sku.id}</span>
              <span className="text-[var(--text-muted)]">· {count}</span>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-[var(--text-muted)] min-h-[1.5rem]">
        {selectedBox && selectedSku ? (
          <span>
            <strong className="text-[var(--foreground)] font-medium">{selectedSku.name}</strong>
            {" · "}position ({selectedBox.x}, {selectedBox.y}, {selectedBox.z}) cm
            {" · "}{selectedBox.w}×{selectedBox.d}×{selectedBox.h} cm
            {" · "}{((selectedBox.w * selectedBox.d * selectedBox.h) / 1000).toFixed(1)} L
          </span>
        ) : (
          <>Click a box to inspect. Showing all {BOXES.length} boxes.</>
        )}
      </div>
    </div>
  );
}
