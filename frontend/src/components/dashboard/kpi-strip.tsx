import {
  BLENDED_ROAS,
  QUARTER,
  TOTAL_SPEND,
  bestRoasChannel,
  type AttributionModel,
  type ChannelMetrics,
} from "@/data/attribution";
import { currency, number, percent, roas } from "@/lib/format";

function Kpi({
  label,
  value,
  detail,
  note,
  chip,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  note?: string;
  chip?: string;
  accent?: string;
}) {
  return (
    <div className="surface-raised px-5 py-5 sm:col-span-6 sm:px-6 xl:col-span-3">
      <div className="flex items-center gap-2">
        {accent ? (
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
        ) : null}
        <p className="text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {label}
        </p>
        {chip ? (
          <span
            className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={
              accent
                ? {
                    color: accent,
                    borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${accent} 12%, transparent)`,
                  }
                : undefined
            }
          >
            {chip}
          </span>
        ) : null}
      </div>
      <p className="kpi-value mt-3 text-[1.7rem] leading-none font-bold tracking-tight text-foreground sm:text-[1.9rem]">
        {value}
      </p>
      <p className="mt-2.5 text-xs text-muted-foreground tnum">{detail}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground/80">{note}</p> : null}
    </div>
  );
}

/** Renders four sibling tiles; the parent bento grid places them. */
export function KpiStrip({
  channels,
  model,
}: {
  channels: ChannelMetrics[];
  model: AttributionModel;
}) {
  const top = [...channels].sort((a, b) => b.revenue - a.revenue)[0];
  const best = bestRoasChannel(model);

  return (
    <>
      <Kpi
        label="Attributed revenue"
        value={currency(QUARTER.totalRevenue, { compact: true })}
        detail={`${number(QUARTER.totalConversions)} conversions · ${QUARTER.label}`}
      />
      <Kpi
        label="Blended ROAS"
        value={roas(BLENDED_ROAS)}
        detail={`${currency(TOTAL_SPEND, { compact: true })} spend · best is ${best.name} at ${roas(best.roas)}`}
        note="Organic and direct carry no media spend, which lifts the blended figure above most single channels."
      />
      <Kpi
        label="Top channel"
        value={top.name}
        detail={`${currency(top.revenue, { compact: true })} · ${percent(top.share)} of credited revenue`}
        accent={top.color}
        chip="Changes with model"
      />
      <Kpi
        label="Avg touchpoints"
        value={QUARTER.avgTouchpoints.toFixed(1)}
        detail="Per converting journey, across all paths"
      />
    </>
  );
}
