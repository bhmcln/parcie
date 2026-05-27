"use client";

import { useMemo, useState } from "react";
import { SKUS } from "@/lib/data";

const objectiveDefaults = [
  { key: "density",     label: "Volume utilisation", weight: 40 },
  { key: "pickability", label: "Pickability",        weight: 35 },
  { key: "stability",   label: "Stack stability",    weight: 20 },
  { key: "clustering",  label: "SKU clustering",     weight: 5  },
];

const initialRules = [
  "Frozen items picked last",
  "Fragile only in top two layers",
  "Heavy ≤ 3 layers from base",
  "Aisle order: A1 → A6 per trip",
  "Centre of mass within ±10 cm of pallet centre",
];

export default function ConstraintsPanel() {
  const initialMatrix = useMemo(() => {
    return SKUS.map((top) =>
      SKUS.map((bottom) => top.weightKg <= bottom.maxStackKg),
    );
  }, []);

  const [matrix, setMatrix] = useState(initialMatrix);
  const [weights, setWeights] = useState(
    Object.fromEntries(objectiveDefaults.map((o) => [o.key, o.weight])) as Record<string, number>,
  );
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState("");

  const total = Object.values(weights).reduce((s, w) => s + w, 0);

  const toggle = (i: number, j: number) => {
    setMatrix((prev) =>
      prev.map((row, ri) =>
        ri === i ? row.map((cell, ci) => (ci === j ? !cell : cell)) : row,
      ),
    );
  };

  const forbiddenCount = matrix.flat().filter((c) => !c).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-medium">Constraints</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">
          Inputs to the engine. Changes regenerate the pallet and route on the next solve.
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Stacking compatibility</div>
          <div className="text-xs text-[var(--text-muted)]">
            row on column · {forbiddenCount} forbidden pair{forbiddenCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-[var(--text-muted)] font-normal px-2 py-1">
                  on top ↓ / bottom →
                </th>
                {SKUS.map((sku) => (
                  <th key={sku.id} className="px-1 py-1 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: sku.ramp.fill, border: `1px solid ${sku.ramp.stroke}` }}
                      />
                      {sku.id}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SKUS.map((rowSku, i) => (
                <tr key={rowSku.id}>
                  <th className="text-left font-normal px-2 py-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: rowSku.ramp.fill, border: `1px solid ${rowSku.ramp.stroke}` }}
                      />
                      <span>
                        {rowSku.id} · {rowSku.category}
                      </span>
                      <span className="text-[var(--text-faint)]">({rowSku.weightKg} kg)</span>
                    </span>
                  </th>
                  {SKUS.map((colSku, j) => {
                    const allowed = matrix[i][j];
                    return (
                      <td key={colSku.id} className="text-center">
                        <button
                          onClick={() => toggle(i, j)}
                          className={`w-7 h-7 rounded-md border transition text-xs ${
                            allowed
                              ? "bg-[#9FE1CB]/30 border-[#0F6E56]/30 text-[#0F6E56] hover:bg-[#9FE1CB]/50"
                              : "bg-[#F5C4B3]/30 border-[#993C1D]/30 text-[#993C1D] hover:bg-[#F5C4B3]/50"
                          }`}
                          aria-label={`${rowSku.id} on ${colSku.id}: ${allowed ? "allowed" : "forbidden"}`}
                          title={
                            allowed
                              ? `${rowSku.id} on ${colSku.id} · allowed`
                              : `${rowSku.id} on ${colSku.id} · ${rowSku.weightKg} kg > ${colSku.maxStackKg} kg cap`
                          }
                        >
                          {allowed ? "✓" : "✕"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] text-[var(--text-faint)]">
          Default derived from per-SKU max stack capacity. Toggle to override; the engine will treat
          forbidden pairs as hard constraints.
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">Objective weights</div>
            <div className="text-xs text-[var(--text-muted)]">total {total}</div>
          </div>
          <div className="space-y-3">
            {objectiveDefaults.map((obj) => (
              <div key={obj.key}>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span>{obj.label}</span>
                  <span className="font-mono tabular-nums text-[var(--text-muted)]">
                    {weights[obj.key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[obj.key]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [obj.key]: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--foreground)]"
                />
              </div>
            ))}
          </div>
          <div className="text-[11px] text-[var(--text-faint)]">
            Weights are normalised before solving. Sliding pickability up will trade volume for
            cleaner aisle ordering.
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">Per-SKU properties</div>
            <div className="text-xs text-[var(--text-muted)]">read-only</div>
          </div>
          <ul className="text-xs space-y-1.5">
            {SKUS.map((sku) => (
              <li key={sku.id} className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: sku.ramp.fill, border: `1px solid ${sku.ramp.stroke}` }}
                />
                <span className="flex-1">
                  {sku.id} · {sku.category}
                </span>
                <span className="text-[var(--text-muted)] font-mono tabular-nums">
                  {sku.weightKg} kg
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    sku.fragility === "high"
                      ? "bg-[#F5C4B3]/40 text-[#993C1D]"
                      : sku.fragility === "medium"
                      ? "bg-[#FAC775]/40 text-[#854F0B]"
                      : "bg-[#9FE1CB]/30 text-[#0F6E56]"
                  }`}
                >
                  {sku.fragility}
                </span>
                <span className="text-[var(--text-faint)] font-mono tabular-nums w-14 text-right">
                  ≤ {sku.maxStackKg} kg
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Custom rules</div>
          <div className="text-xs text-[var(--text-muted)]">
            {rules.length} active · plain-language constraints
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rules.map((rule, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-full px-3 py-1 text-xs"
            >
              {rule}
              <button
                onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                className="text-[var(--text-faint)] hover:text-[var(--foreground)] transition"
                aria-label={`Remove rule: ${rule}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (trimmed) {
              setRules((r) => [...r, trimmed]);
              setDraft("");
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Chilled items on the same pallet must finish ≤ 4 layers"
            className="flex-1 h-9 px-3 text-xs rounded-md bg-[var(--background)] border border-[var(--border)] focus:border-[var(--border-strong)] focus:outline-none"
          />
          <button
            type="submit"
            className="h-9 px-3 text-xs rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition"
          >
            Add rule
          </button>
        </form>
        <div className="text-[11px] text-[var(--text-faint)]">
          Rules are parsed into CP-SAT terms by the engine. Anything it can&apos;t parse is flagged
          rather than silently dropped.
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-xs text-[var(--text-muted)]">
          Changes are local in this prototype. Press <span className="font-mono">Re-solve</span> on
          the engine view to apply.
        </div>
        <button className="h-9 px-4 text-sm rounded-md bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition">
          Save & solve
        </button>
      </div>
    </div>
  );
}
