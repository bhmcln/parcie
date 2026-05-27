import { BOXES, SKUS } from "@/lib/data";

export const metadata = {
  title: "Engine · parcie",
};

const objectiveTerms = [
  { name: "Volume utilisation", weight: 0.4,  value: 0.348, fill: "#9FE1CB" },
  { name: "Pickability",        weight: 0.35, value: 0.307, fill: "#B5D4F4" },
  { name: "Stack stability",    weight: 0.2,  value: 0.172, fill: "#F5C4B3" },
  { name: "SKU clustering",     weight: 0.05, value: 0.045, fill: "#FAC775" },
];

const constraintGroups = [
  { name: "Non-overlap (cuboids)",          count: 91, kind: "geometric" },
  { name: "Support / centre-of-mass",       count: 38, kind: "stability" },
  { name: "Stacking compatibility (SKU×SKU)", count: 24, kind: "product" },
  { name: "Layer weight capacity",          count: 14, kind: "stability" },
  { name: "Aisle adjacency (pickability)",  count: 6,  kind: "routing" },
  { name: "Pallet bounding box",            count: 4,  kind: "geometric" },
];

const decisionVars = [
  { name: "Position cells",        formula: `${BOXES.length} boxes × 80 cells`, count: BOXES.length * 80 },
  { name: "Orientation flags",     formula: `${BOXES.length} × 6 rotations`,    count: BOXES.length * 6 },
  { name: "Pick-order indicators", formula: "linearised over visits",            count: 182 },
  { name: "Aisle assignments",     formula: `${SKUS.length} SKUs × 6 aisles`,    count: SKUS.length * 6 },
];

const logLines = [
  { t: "0.000s", tag: "presolve",  msg: "removed 47 redundant rows" },
  { t: "0.167s", tag: "presolve",  msg: "reduced to 1,284 vars, 1,612 constraints" },
  { t: "0.335s", tag: "search",    msg: "starting CP-SAT, 8 workers" },
  { t: "0.346s", tag: "bound",     msg: "UB=0.872, LB=0.000" },
  { t: "0.589s", tag: "bound",     msg: "UB=0.872, LB=0.412" },
  { t: "0.862s", tag: "bound",     msg: "UB=0.872, LB=0.689" },
  { t: "1.267s", tag: "solution",  msg: "feasible obj=0.781" },
  { t: "1.646s", tag: "solution",  msg: "feasible obj=0.852" },
  { t: "1.839s", tag: "bound",     msg: "UB=0.872, LB=0.872 — gap closed" },
  { t: "1.842s", tag: "done",      msg: "OPTIMAL obj=0.872" },
];

const phases = [
  { name: "Presolve", duration: 0.335, fill: "var(--surface-2)" },
  { name: "Branch & bound", duration: 1.31, fill: "#B5D4F4" },
  { name: "Proof", duration: 0.197, fill: "#9FE1CB" },
];

function tagClass(tag: string) {
  switch (tag) {
    case "done":
      return "text-[#0F6E56]";
    case "solution":
      return "text-[#185FA5]";
    case "bound":
      return "text-[var(--text-muted)]";
    default:
      return "text-[var(--text-faint)]";
  }
}

export default function EnginePage() {
  const totalConstraints = constraintGroups.reduce((s, g) => s + g.count, 0);
  const totalVars = decisionVars.reduce((s, v) => s + v.count, 0);
  const totalDuration = phases.reduce((s, p) => s + p.duration, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-medium">Solver</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            CP-SAT (OR-Tools) · 8 threads · time limit 30.0 s
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-[#9FE1CB]/30 text-[#0F6E56] border border-[#0F6E56]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F6E56]" />
            Optimal
          </span>
          <button className="h-9 px-3 text-sm rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition">
            Re-solve
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-xl p-4">
        <div className="grid grid-cols-4 gap-4">
          <Metric label="Objective" value="0.872" sub="of 1.000 max" />
          <Metric label="Optimality gap" value="0.00%" sub="proved optimal" />
          <Metric label="Wall time" value="1.84 s" sub="of 30.0 s budget" />
          <Metric label="Search nodes" value="2,841" sub="across 8 workers" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Objective breakdown" subtitle={`weighted sum · final 0.872`}>
          <div className="space-y-3">
            <div className="flex h-4 rounded-md overflow-hidden bg-[var(--surface-2)]">
              {objectiveTerms.map((t) => (
                <div
                  key={t.name}
                  style={{ width: `${t.value * 100}%`, background: t.fill }}
                  title={`${t.name}: ${t.value.toFixed(3)}`}
                />
              ))}
            </div>
            <ul className="text-xs space-y-1.5">
              {objectiveTerms.map((t) => (
                <li key={t.name} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: t.fill }}
                  />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-[var(--text-muted)]">w={t.weight}</span>
                  <span className="font-mono tabular-nums">{t.value.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Solve phases" subtitle={`${totalDuration.toFixed(2)} s end-to-end`}>
          <div className="space-y-3">
            <div className="flex h-4 rounded-md overflow-hidden bg-[var(--surface-2)]">
              {phases.map((p) => (
                <div
                  key={p.name}
                  style={{
                    width: `${(p.duration / totalDuration) * 100}%`,
                    background: p.fill,
                  }}
                  title={`${p.name}: ${p.duration.toFixed(2)}s`}
                />
              ))}
            </div>
            <ul className="text-xs space-y-1.5">
              {phases.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: p.fill }}
                  />
                  <span className="flex-1">{p.name}</span>
                  <span className="font-mono tabular-nums text-[var(--text-muted)]">
                    {p.duration.toFixed(2)} s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Decision variables" subtitle={`${totalVars.toLocaleString()} total`}>
          <ul className="text-xs space-y-1.5">
            {decisionVars.map((v) => (
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

        <Card title="Constraints" subtitle={`${totalConstraints} active`}>
          <ul className="text-xs space-y-1.5">
            {constraintGroups.map((g) => (
              <li key={g.name} className="flex items-baseline gap-2">
                <span className="flex-1">{g.name}</span>
                <span className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider">
                  {g.kind}
                </span>
                <span className="font-mono tabular-nums w-8 text-right">{g.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Solver log" subtitle="abridged">
        <pre className="text-[11px] leading-relaxed font-mono overflow-x-auto whitespace-pre">
          {logLines.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[var(--text-faint)] w-14 shrink-0">{line.t}</span>
              <span className={`w-20 shrink-0 ${tagClass(line.tag)}`}>[{line.tag}]</span>
              <span className="text-[var(--foreground)]">{line.msg}</span>
            </div>
          ))}
        </pre>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
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
        {subtitle && (
          <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}
