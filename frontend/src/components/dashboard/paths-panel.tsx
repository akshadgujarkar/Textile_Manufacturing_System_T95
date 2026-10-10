import {
  PATHS,
  channelById,
  creditedSteps,
  type AttributionModel,
  type ConversionPath,
} from "@/data/attribution";
import { percent } from "@/lib/format";
import { Panel } from "./panel";

/** The share bar carries the palette too: under first and last touch it takes
 *  the credited channel's colour, under linear it segments across the path. */
function ShareBar({ path, model }: { path: ConversionPath; model: AttributionModel }) {
  const width = Math.min(100, (path.share / 0.12) * 100);
  const credited = creditedSteps(path, model);
  const creditedColors = path.steps.filter((_, i) => credited[i]).map((s) => channelById[s].color);
  const unique = Array.from(new Set(creditedColors));
  const background =
    unique.length === 1
      ? unique[0]
      : `linear-gradient(to right, ${unique
          .map((c, i) => `${c} ${(i / unique.length) * 100}%, ${c} ${((i + 1) / unique.length) * 100}%`)
          .join(", ")})`;

  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width,background] duration-500"
        style={{ width: `${width}%`, background }}
      />
    </div>
  );
}

export function PathsPanel({ model }: { model: AttributionModel }) {
  // The panel reads from the same PATHS that drive credit everywhere else.
  // Single-touch closes exist in the data but are not journeys to draw.
  const journeys = [...PATHS]
    .filter((p) => p.steps.length > 1)
    .sort((a, b) => b.share - a.share)
    .slice(0, 7);
  const shown = journeys.reduce((s, p) => s + p.share, 0);
  const single = PATHS.filter((p) => p.steps.length === 1).reduce((s, p) => s + p.share, 0);

  return (
    <Panel
      eyebrow="Journeys are the same in every model"
      title="The journeys behind the credit"
      subtitle="The most common multi-touch journeys this quarter. Highlighted steps are the ones receiving credit under the selected model."
      className="h-full"
    >
      <ul className="flex flex-col divide-y divide-border">
        {journeys.map((path) => {
          const credited = creditedSteps(path, model);
          return (
            <li
              key={path.steps.join(">")}
              className="flex min-h-[3.75rem] flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div className="flex min-w-0 flex-1 basis-0 flex-wrap items-center gap-x-1.5 gap-y-1.5">
                {path.steps.map((step, i) => {
                  const ch = channelById[step];
                  const isCredited = credited[i];
                  return (
                    <span key={`${step}-${i}`} className="flex shrink-0 items-center gap-1.5">
                      <span
                        className="rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap transition-all duration-500"
                        style={{
                          color: isCredited ? ch.color : "var(--color-muted-foreground)",
                          borderColor: isCredited ? ch.color : "var(--color-border)",
                          backgroundColor: isCredited
                            ? `color-mix(in oklab, ${ch.color} 12%, transparent)`
                            : "transparent",
                          opacity: isCredited ? 1 : 0.6,
                        }}
                      >
                        {ch.name}
                      </span>
                      {i < path.steps.length - 1 ? (
                        <svg
                          width="14"
                          height="10"
                          viewBox="0 0 14 10"
                          className="shrink-0 text-muted-foreground"
                          aria-hidden
                        >
                          <path
                            d="M0 5h11M8 1.5 11.5 5 8 8.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center gap-5 tnum">
                <div className="flex items-center gap-2.5">
                  <ShareBar path={path} model={model} />
                  <span className="w-11 text-right text-xs text-foreground">
                    {percent(path.share)}
                  </span>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {path.daysToClose.toFixed(1)} days
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[0.7rem] text-muted-foreground">
        Top {journeys.length} multi-touch journeys · {percent(shown, 0)} of conversions ·
        single-touch closes ({percent(single, 0)}) not shown · days measure first touch to close
      </p>
    </Panel>
  );
}
