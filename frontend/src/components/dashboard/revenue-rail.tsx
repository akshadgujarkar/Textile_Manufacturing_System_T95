import { useEffect, useMemo, useRef, useState } from "react";
import {
  MODELS,
  QUARTER,
  getModelData,
  type AttributionModel,
  type ChannelMetrics,
} from "@/data/attribution";
import { currency, lerp, percent } from "@/lib/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface Slot {
  index: number;
  start: number;
}

/** Same ordering rule as the waterfall: contribution, descending. */
function layoutFor(model: AttributionModel): Record<string, Slot> {
  const sorted = [...getModelData(model)].sort((a, b) => b.revenue - a.revenue);
  const out: Record<string, Slot> = {};
  let cursor = 0;
  sorted.forEach((c, i) => {
    out[c.id] = { index: i, start: cursor };
    cursor += c.revenue;
  });
  return out;
}

/** Narrower than this in pixels and an inline label clips, so it is suppressed. */
const LABEL_MIN_PX = 78;

export function RevenueRail({
  channels,
  from,
  to,
  t,
}: {
  channels: ChannelMetrics[];
  from: AttributionModel;
  to: AttributionModel;
  t: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [railW, setRailW] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRailW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layoutA = useMemo(() => layoutFor(from), [from]);
  const layoutB = useMemo(() => layoutFor(to), [to]);
  const progress = reduced ? 1 : t;

  const total = QUARTER.totalRevenue;

  const segments = channels
    .map((c) => {
      const a = layoutA[c.id];
      const b = layoutB[c.id];
      return {
        c,
        index: lerp(a.index, b.index, progress),
        start: lerp(a.start, b.start, progress),
      };
    })
    .sort((x, y) => x.index - y.index);

  const hovered = hover ? channels.find((c) => c.id === hover) : null;
  const shareElsewhere = hovered
    ? MODELS.filter((m) => m.id !== to).map((m) => ({
        label: m.label,
        share: getModelData(m.id).find((c) => c.id === hovered.id)?.share ?? 0,
      }))
    : [];

  return (
    <div className="relative">
      <div className="relative">
        {/* End ticks anchoring the fixed measure. */}
        <div
          aria-hidden
          className="absolute -top-2 -bottom-2 left-0 w-px bg-foreground/30"
        />
        <div
          aria-hidden
          className="absolute -top-2 -bottom-2 right-0 w-px bg-foreground/30"
        />

        <div
          ref={railRef}
          className="relative h-9 overflow-hidden rounded-full sm:h-[52px]"
          role="list"
          aria-label="Credited revenue by channel"
        >
          {segments.map(({ c, start }) => {
            const left = (start / total) * 100;
            const width = (c.revenue / total) * 100;
            const dim = hover !== null && hover !== c.id;
            const showLabel = railW > 0 && (width / 100) * railW >= LABEL_MIN_PX;
            return (
              <button
                key={c.id}
                type="button"
                role="listitem"
                aria-label={`${c.name}, ${currency(c.revenue)} credited, ${percent(c.share)} of total`}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.id)}
                onBlur={() => setHover(null)}
                className="absolute inset-y-0 flex items-center justify-center overflow-hidden px-2 text-left outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-foreground/60"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: c.color,
                  opacity: dim ? 0.3 : 1,
                  transition: "opacity 200ms",
                  // Hairline separation drawn inside the segment so the rail's
                  // outer length stays mathematically exact.
                  boxShadow:
                    "inset 1px 0 0 var(--color-card), inset -1px 0 0 var(--color-card)",
                }}
              >
                {showLabel ? (
                  <span className="pointer-events-none flex w-full min-w-0 flex-col items-center leading-tight text-background">
                    <span className="w-full truncate text-center text-[0.7rem] font-medium">
                      {c.name}
                    </span>
                    <span className="tnum text-[0.65rem] opacity-80">
                      {percent(c.share, 0)}
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[0.7rem] text-muted-foreground">
        <span className="tnum">$0</span>
        <span className="tnum">{currency(total, { compact: true })}</span>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        The bar is always the same length. Changing the model only moves the cuts.
      </p>

      {hovered ? (
        <div className="pointer-events-none absolute top-full right-0 z-20 mt-1 rounded-lg border border-border bg-popover/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: hovered.color }}
              aria-hidden
            />
            {hovered.name}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-muted-foreground tnum">
            <dt>Credited</dt>
            <dd className="text-right text-foreground">{currency(hovered.revenue)}</dd>
            <dt>Share</dt>
            <dd className="text-right text-foreground">{percent(hovered.share)}</dd>
            {shareElsewhere.map((s) => (
              <div key={s.label} className="contents">
                <dt>{s.label}</dt>
                <dd className="text-right text-foreground/80">{percent(s.share)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
