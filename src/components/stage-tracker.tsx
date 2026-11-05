import { nextStep, STAGE_LABELS, type Stage } from "@/lib/stages";

const TRACK: Stage[] = ["raised", "gathering", "organizing", "taking_action", "won"];

/**
 * Where a cause has got to: Raised → Gathering → Organizing → Taking action → Won,
 * with the next step in plain words. Skipped stages are simply passed.
 */
export function StageTracker({ stage, members }: { stage: Stage; members: number }) {
  if (stage === "closed") return null; // the closed notice says it
  const at = TRACK.indexOf(stage);
  const step = nextStep(stage, members);
  return (
    <div className="mt-4" aria-label={`Stage: ${STAGE_LABELS[stage]}`}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {TRACK.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                i === at
                  ? s === "won"
                    ? "bg-sage/40 text-foreground ring-[1.5px] ring-ink"
                    : "bg-mustard/40 text-foreground ring-[1.5px] ring-ink"
                  : i < at
                    ? "bg-border text-foreground"
                    : "border border-dashed border-border text-muted"
              }`}
              aria-current={i === at ? "step" : undefined}
            >
              {i < at && <span aria-hidden="true">✓ </span>}
              {s === "won" && i === at ? "✓ Won" : STAGE_LABELS[s]}
            </span>
            {i < TRACK.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
          </li>
        ))}
      </ol>
      {step && <p className="mt-2 text-sm text-muted">{step}</p>}
    </div>
  );
}
