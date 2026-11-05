import type { AreaReps } from "@/lib/area-reps";
import { LEVEL_NAMES, levelOrder, spansSeveralWards, type Rep } from "@/lib/representatives";
import { Panel } from "./cause-parts";
import { RepLookup } from "./cause-forms";
import { ContactForm, CopyEmail } from "./contact-parts";

type CauseForBox = {
  id: string;
  country: string;
  placeName: string;
  category: string;
  fixer: string;
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
};

function Person({ name, detail, email, url }: { name: string; detail: string; email?: string | null; url?: string | null }) {
  return (
    <li className="py-2.5 text-sm">
      <p className="font-medium">{name}</p>
      <p className="text-muted">{detail}</p>
      {(email || url) && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {email && <CopyEmail email={email} />}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-link underline">
              Website
            </a>
          )}
        </p>
      )}
    </li>
  );
}

const repDetail = (r: Rep) => [r.office, r.district, r.party].filter(Boolean).join(" · ");

/**
 * "Who can fix this": the area's councillor, provincial rep and MP (Canada),
 * most relevant level first, plus anyone the leader added by hand.
 */
export function WhoCanFix({ cause, areaReps, isLeader }: { cause: CauseForBox; areaReps: AreaReps | null; isLeader: boolean }) {
  const canada = cause.country === "CA";
  const reps = areaReps?.reps ?? [];
  const order = levelOrder(cause.fixer, cause.category);

  return (
    <Panel title="Who can fix this" id="who">
      <div className="space-y-5">
        {cause.contactName && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Added by whoever started this cause</h3>
            <ul>
              <Person name={cause.contactName} detail={cause.contactRole ?? ""} email={cause.contactEmail} />
            </ul>
          </section>
        )}

        {canada && areaReps && (
          <>
            {spansSeveralWards(reps) && (
              <p className="rounded-md bg-mustard/20 p-3 text-sm">
                Around {cause.placeName} spans more than one ward, so you&apos;ll see more than one councillor. Enter your full postal code
                below to see yours.
              </p>
            )}
            {order.map((level) => {
              const atLevel = reps.filter((r) => r.level === level);
              return (
                <section key={level}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{LEVEL_NAMES[level]}</h3>
                  {atLevel.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {atLevel.map((r) => (
                        <Person key={`${r.office}-${r.name}`} name={r.name} detail={repDetail(r)} email={r.email} url={r.url} />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-sm text-muted">
                      {level === "municipal"
                        ? "We don't have city councillors for this area yet. Whoever started this cause can add who to contact."
                        : "Not found for this area."}
                    </p>
                  )}
                </section>
              );
            })}
          </>
        )}

        {canada && !areaReps && <p className="text-sm text-muted">We couldn&apos;t look up representatives right now. Try again later.</p>}

        {isLeader && <ContactForm causeId={cause.id} name={cause.contactName} role={cause.contactRole} email={cause.contactEmail} />}

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold">{canada ? "Find your own representatives" : "Find your representatives"}</h3>
          <RepLookup country={cause.country} />
        </div>
      </div>
    </Panel>
  );
}
