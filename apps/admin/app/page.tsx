const foundationChecks = ['API health', 'Database schema', 'CI quality gates'] as const;

export default function AdminHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-black/10 bg-white p-8 shadow-sm md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Operations console
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Thriftage Admin</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-black/65">
          The engineering foundation is ready. Marketplace operations will be introduced through
          approved, role-protected feature phases.
        </p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {foundationChecks.map((check) => (
            <li key={check} className="rounded-2xl bg-stone-100 px-5 py-4 text-sm font-medium">
              {check}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
