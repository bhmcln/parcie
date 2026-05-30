"use client";

import { useSolution } from "@/lib/solution-store";

const kindClass = "text-[11px] text-[var(--text-faint)] uppercase tracking-wider";

export default function EnginePanel() {
  const { solution, solving, error, resolve } = useSolution();
  const engine = solution.engine;
  const optimal = engine.status === "OPTIMAL";
  const utilPct = Math.round(engine.utilisation * 100);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-medium">Solver</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            CP-SAT (OR-Tools) · {engine.workers} workers · time limit {engine.timeLimitS.toFixed(1)} s
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border ${
              optimal
                ? "bg-[#9FE1CB]/30 text-[#0F6E56] border-[#0F6E56]/30"
                : "bg-[#FAC775]/30 text-[#854F0B] border-[#854F0B]/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${optimal ? "bg-[#0F6E56]" : "bg-[#854F0B]"}`}
            />
            {optimal ? "Optimal" : engine.status}
          </span>
          {engine.stabilityApplied && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border bg-[#B5D4F4]/30 text-[#185FA5] border-[#185FA5]/30">
              heavy-low tie-break
            </span>
          )}
          <button
            onClick={() => resolve()}
            disabled={solving}
            className="h-9 px-3 text-sm rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {solving ? "Solving..." : "Re-solve"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-md bg-[#F5C4B3]/30 border border-[#993C1D]/30 text-[#993C1D]">
          {error}
        </div>
      )}

      <div className="bg-[var(--surface)] rounded-xl p-4">
        <div className="grid grid-cols-4 gap-4">
          <Metric label="Objective" value={`${engine.objectiveCm} cm`} sub="stack height, minimised" />
          <Metric
            label="Optimality gap"
            value={`${engine.gapPct.toFixed(2)}%`}
            sub={optimal ? "proved optimal" : `bound ${engine.bestBoundCm} cm`}
          />
          <Metric
            label="Wall time"
            value={`${engine.wallTimeS.toFixed(2)} s`}
            sub={`of ${engine.timeLimitS.toFixed(1)} s budget`}
          />
          <Metric
            label="Search branches"
            value={engine.branches.toLocaleString()}
            sub={`${engine.conflicts.toLocaleString()} conflicts`}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Objective" subtitle="minimise envelope height">
          <div className="space-y-3">
            <div className="flex h-4 rounded-md overflow-hidden bg-[var(--surface-2)]">
              <div
                style={{ width: `${utilPct}%`, background: "#9FE1CB" }}
                title={`packed volume: ${utilPct}%`}
              />
            </div>
            <ul className="text-xs space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#9FE1CB]" />
                <span className="flex-1">Volume utilisation</span>
                <span className="font-mono tabular-nums">{engine.utilisation.toFixed(3)}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--surface-2)]" />
                <span className="flex-1 text-[var(--text-muted)]">Headroom above pack</span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  {(1 - engine.utilisation).toFixed(3)}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#B5D4F4]" />
                <span className="flex-1">Vertical centre of mass</span>
                <span className="font-mono tabular-nums">{engine.comZcm.toFixed(1)} cm</span>
              </li>
            </ul>
            <div className="text-[11px] text-[var(--text-faint)]">
              The model minimises the {solution.heightCm} cm stack envelope. For a fixed carton set
              that is equivalent to maximising volume utilisation.
              {engine.stabilityApplied
                ? " The stability tie-break then settled the centre of mass low without adding height."
                : " Enable the stability lever on Constraints to settle heavy cartons low."}
            </div>
          </div>
        </Card>

        <Card title="Search" subtitle="post-presolve">
          <ul className="text-xs space-y-1.5">
            <StatRow label="Booleans" value={engine.booleans.toLocaleString()} />
            <StatRow label="Branches" value={engine.branches.toLocaleString()} />
            <StatRow label="Conflicts" value={engine.conflicts.toLocaleString()} />
            <StatRow label="Best bound" value={`${engine.bestBoundCm} cm`} />
            <StatRow label="Wall time" value={`${engine.wallTimeS.toFixed(2)} s`} />
          </ul>
        </Card>

        <Card title="Decision variables" subtitle={`${engine.numVars.toLocaleString()} total`}>
          <ul className="text-xs space-y-1.5">
            {engine.decisionVars.map((v) => (
              <li key={v.name} className="flex items-baseline gap-2">
                <span className="flex-1">{v.name}</span>
                <span className="text-[var(--text-muted)] text-[11px]">{v.formula}</span>
                <span className="font-mono tabular-nums w-12 text-right">
                  {v.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Constraints" subtitle={`${engine.numConstraints.toLocaleString()} as built`}>
          <ul className="text-xs space-y-1.5">
            {engine.constraintGroups.map((g) => (
              <li key={g.name} className="flex items-baseline gap-2">
                <span className="flex-1">{g.name}</span>
                <span className={kindClass}>{g.kind}</span>
                <span className="font-mono tabular-nums w-12 text-right">
                  {g.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Solver log" subtitle="CpSolverResponse summary">
        <pre className="text-[11px] leading-relaxed font-mono overflow-x-auto whitespace-pre text-[var(--text-muted)]">
          {engine.log}
        </pre>
      </Card>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="flex-1">{label}</span>
      <span className="font-mono tabular-nums text-[var(--text-muted)]">{value}</span>
    </li>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-medium font-mono tabular-nums mt-0.5">{value}</div>
      <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{sub}</div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
