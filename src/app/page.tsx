import Link from "next/link";

const inputs = [
  {
    href: "/constraints",
    title: "Constraints",
    description:
      "Stacking rules, fragility, weight caps, pick policies, and objective weights — the inputs the solver works with.",
  },
];

const engine = {
  href: "/engine",
  title: "Engine",
  description:
    "CP-SAT solver running on OR-Tools. Objective decomposition, decision variables, constraints, and iteration log.",
};

const outputs = [
  {
    href: "/pallet",
    title: "Pallet",
    description:
      "Isometric build of the optimised pallet. Layer by layer, with fragility-aware stacking respected.",
  },
  {
    href: "/route",
    title: "Route",
    description:
      "Pickable route through the DC. Aisle-aware ordering keeps the picker from doubling back.",
  },
];

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">parcie</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
          Constraint-driven pallet packing for grocery distribution. Generates pallets that respect
          stacking, fragility, and weight limits — and an aisle-aware pick route that builds them
          without backtracking.
        </p>
      </header>

      <Section heading="Inputs" caption="What you tell the engine">
        {inputs.map((v) => (
          <ViewCard key={v.href} {...v} />
        ))}
      </Section>

      <Section heading="Engine" caption="What runs in the middle">
        <ViewCard {...engine} />
      </Section>

      <Section heading="Outputs" caption="What the engine returns">
        {outputs.map((v) => (
          <ViewCard key={v.href} {...v} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  heading,
  caption,
  children,
}: {
  heading: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wider text-[var(--text-faint)]">{heading}</h2>
        <span className="text-xs text-[var(--text-faint)]">{caption}</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function ViewCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--border-strong)] transition-colors h-full"
      >
        <div className="font-medium">{title}</div>
        <div className="mt-1 text-sm text-[var(--text-muted)] leading-relaxed">{description}</div>
      </Link>
    </li>
  );
}
