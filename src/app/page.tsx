import { PostalSearch } from "@/components/postal-search";

const STEPS = [
  {
    title: "See what's happening",
    body: "Your postal code shows the issues neighbours have raised nearby — from unsafe crossings to rent hikes.",
  },
  {
    title: "Connect & meet up",
    body: "Add your voice to an issue, talk it through, and organize meetups in person or online.",
  },
  {
    title: "Push for change",
    body: "Turn shared concern into a clear ask: gather signatures and send a letter to the people who can act.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:pt-28">
        <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-link">
          Now in the United States &amp; Canada
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          What matters where you live?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Find the issues your neighbours care about, meet the people working on them, and make your community
          heard.
        </p>
        <div className="mx-auto mt-10 max-w-2xl">
          <PostalSearch />
        </div>
        <p className="mt-3 text-xs text-muted">
          We only use the first part of your postal code — never your exact address.
        </p>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title}>
              <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-link">
                {i + 1}
              </div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
