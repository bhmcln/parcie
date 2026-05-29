import { ENGINE, SOLUTION } from "@/lib/data";

export const metadata = {
  title: "Engine · parcie",
};

const kindClass = "text-[11px] text-[var(--text-faint)] uppercase tracking-wider";

export default function EnginePage() {
  const optimal = ENGINE.status === "OPTIMAL";
  const utilPct = Math.round(ENGINE.utilisation * 100);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-medium">Solver</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            CP-SAT (OR-Tools) · {ENGINE.workers} workers · time limit {ENGINE.timeLimitS.toFixed(1)} s
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
            {optimal ? "Optimal" : ENGINE.status}
          </span>
          <button className="h-9 px-3 text-sm rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition">
            Re-solve
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-xl p-4">
        <div className="grid grid-cols-4 gap-4">
          <Metric label="Objective" value={`${ENGINE.objectiveCm} cm`} sub="stack height, minimised" />
          <Metric
            label="Optimality gap"
            value={`${ENGINE.gapPct.toFixed(2)}%`}
            sub={optimal ? "proved optimal" : `bound ${ENGINE.bestBoundCm} cm`}
          />
          <Metric
            label="Wall time"
            value={`${ENGINE.wallTimeS.toFixed(2)} s`}
            sub={`of ${ENGINE.timeLimitS.toFixed(1)} s budget`}
          />
          <Metric
            label="Search branches"
            value={ENGINE.branches.toLocaleString()}
            sub={`${ENGINE.conflicts.toLocaleString()} conflicts`}
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
                <span className="font-mono tabular-nums">{ENGINE.utilisation.toFixed(3)}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[var(--surface-2)]" />
                <span className="flex-1 text-[var(--text-muted)]">Headroom above pack</span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  {(1 - ENGINE.utilisation).toFixed(3)}
                </span>
              </li>
            </ul>
            <div className="text-[11px] text-[var(--text-faint)]">
              The model minimises the {SOLUTION.heightCm} cm stack envelope. For a fixed carton set
              that is equivalent to maximising volume utilisation.
            </div>
          </div>
        </Card>

        <Card title="Search" subtitle="post-presolve">
          <ul className="text-xs space-y-1.5">
            <StatRow label="Booleans" value={ENGINE.booleans.toLocaleString()} />
            <StatRow label="Branches" value={ENGINE.branches.toLocaleString()} />
            <StatRow label="Conflicts" value={ENGINE.conflicts.toLocaleString()} />
            <StatRow label="Best bound" value={`${ENGINE.bestBoundCm} cm`} />
            <StatRow label="Wall time" value={`${ENGINE.wallTimeS.toFixed(2)} s`} />
          </ul>
        </Card>

        <Card title="Decision variables" subtitle={`${ENGINE.numVars.toLocaleString()} total`}>
          <ul className="text-xs space-y-1.5">
            {ENGINE.decisionVars.map((v) => (
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

        <Card title="Constraints" subtitle={`${ENGINE.numConstraints.toLocaleString()} as built`}>
          <ul className="text-xs space-y-1.5">
            {ENGINE.constraintGroups.map((g) => (
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
          {ENGINE.log}
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
