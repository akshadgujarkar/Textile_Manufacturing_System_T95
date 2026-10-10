import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MODELS,
  QUARTER,
  getModelData,
  type AttributionModel,
  type ChannelMetrics,
} from "@/data/attribution";
import { currency, lerp, percent } from "@/lib/format";
import { Panel } from "./panel";

interface Slot {
  index: number;
  start: number;
  value: number;
}

function layoutFor(model: AttributionModel): Record<string, Slot> {
  const sorted = [...getModelData(model)].sort((a, b) => b.revenue - a.revenue);
  const out: Record<string, Slot> = {};
  let cursor = 0;
  sorted.forEach((c, i) => {
    out[c.id] = { index: i, start: cursor, value: c.revenue };
    cursor += c.revenue;
  });
  return out;
}

const W = 720;
/** Fallback aspect height before the container is measured. */
const BASE_H = 400;
const PAD = { top: 34, right: 12, bottom: 46, left: 56 };

/** Round tick steps rather than fractions of the total, so the axis reads
 *  as money and not as an arbitrary division of 2.3M. */
const TICK_STEP = 500_000;

/** Below this share of the total a bar has no drawable height, so it gets an
 *  explicit empty-slot treatment instead of a one-pixel sliver. */
const ZERO_EPSILON = 0.004;

/** Every channel with credit keeps a visible bar, however small its share. */
const MIN_BAR = 6;

export function WaterfallPanel({
  channels,
  from,
  to,
  t,
  focus = [],
}: {
  channels: ChannelMetrics[];
  from: AttributionModel;
  to: AttributionModel;
  t: number;
  focus?: string[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const layoutA = useMemo(() => layoutFor(from), [from]);
  const layoutB = useMemo(() => layoutFor(to), [to]);
  const gradientId = useId();

  // The viewBox height tracks the rendered container so the plot fills the
  // tile top to bottom instead of letterboxing inside a fixed aspect.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [H, setH] = useState(BASE_H);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setH(Math.max(340, Math.round((height / width) * W)));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slots = channels.length + 1;
  const slotW = plotW / slots;
  const barW = slotW * 0.58;
  const max = QUARTER.totalRevenue;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const ticks: number[] = [];
  for (let v = 0; v <= max; v += TICK_STEP) ticks.push(v);

  const bars = channels
    .map((c) => {
      const a = layoutA[c.id];
      const b = layoutB[c.id];
      return {
        c,
        index: lerp(a.index, b.index, t),
        start: lerp(a.start, b.start, t),
        value: c.revenue,
      };
    })
    .sort((a, b) => a.index - b.index);

  const barX = (index: number) => PAD.left + index * slotW + (slotW - barW) / 2;
  const totalX = PAD.left + channels.length * slotW + (slotW - barW) / 2;

  const geometry = bars.map((bar) => {
    const isZero = bar.value / max < ZERO_EPSILON;
    const raw = y(bar.start) - y(bar.start + bar.value);
    const height = isZero ? 0 : Math.max(MIN_BAR, raw);
    const top = y(bar.start) - height;
    return { ...bar, isZero, height, top };
  });

  const hovered = hover ? channels.find((c) => c.id === hover) : null;
  const otherModels = MODELS.filter((m) => m.id !== to);
  const shareElsewhere = hovered
    ? otherModels.map((m) => ({
        label: m.label,
        share: getModelData(m.id).find((c) => c.id === hovered.id)?.share ?? 0,
      }))
    : [];

  return (
    <Panel
      title="Where the credit lands"
      subtitle="Each channel's credited revenue stacks left to right, building to the quarter total. Ordering follows contribution; colour always follows the channel."
      surface="raised"
      className="h-full"
      action={
        <div className="text-right">
          <p className="text-[0.7rem] text-muted-foreground">Total attributed</p>
          <p className="kpi-value text-lg font-semibold tracking-tight">
            {currency(QUARTER.totalRevenue, { compact: true })}
          </p>
        </div>
      }
      bodyClassName="flex flex-col"
    >
      <div className="relative min-h-0 flex-1">
        <div className="scroll-x h-full overflow-x-auto">
          <div ref={wrapRef} className="h-full min-w-[520px]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-full min-h-[320px] w-full"
              role="img"
            >
              <defs>
                {/* The total column is literally made of the channel colours,
                    in contribution order, so it reads as their sum. */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  {geometry.map((bar, i) => (
                    <stop
                      key={bar.c.id}
                      offset={`${(i / Math.max(1, geometry.length - 1)) * 100}%`}
                      stopColor={bar.c.color}
                      stopOpacity={0.42}
                    />
                  ))}
                </linearGradient>
              </defs>

              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="var(--panel-grid)"
                    strokeWidth={1}
                    strokeDasharray={v === 0 ? undefined : "3 5"}
                  />
                  <text
                    x={PAD.left - 10}
                    y={y(v) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground tnum"
                    fontSize={11}
                  >
                    {currency(v, { compact: true })}
                  </text>
                </g>
              ))}

              {/* Quarter total reference, sitting above the round money ticks. */}
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(max)}
                y2={y(max)}
                stroke="var(--foreground)"
                strokeOpacity={0.28}
                strokeWidth={1}
              />

              {/* Step connectors: each bar hands its running total to the next,
                  which is what makes the stack legible as a waterfall. */}
              {geometry.slice(0, -1).map((bar, i) => {
                const next = geometry[i + 1];
                const level = bar.isZero ? y(bar.start) : bar.top;
                return (
                  <line
                    key={`link-${bar.c.id}`}
                    x1={barX(bar.index) + barW}
                    x2={barX(next.index)}
                    y1={level}
                    y2={level}
                    stroke="var(--foreground)"
                    strokeOpacity={0.28}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                );
              })}
              {geometry.length > 0 ? (
                <line
                  x1={barX(geometry[geometry.length - 1].index) + barW}
                  x2={totalX}
                  y1={y(max)}
                  y2={y(max)}
                  stroke="var(--foreground)"
                  strokeOpacity={0.28}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              ) : null}

              {geometry.map(({ c, index, start, value, isZero, height, top }) => {
                const x = barX(index);
                const dim =
                  (hover !== null && hover !== c.id) ||
                  (focus.length > 0 && !focus.includes(c.id));
                return (
                  <g
                    key={c.id}
                    onMouseEnter={() => setHover(c.id)}
                    onMouseLeave={() => setHover(null)}
                    style={{ opacity: dim ? 0.28 : 1, transition: "opacity 200ms" }}
                  >
                    {isZero ? (
                      /* No credit under this model: an empty slot reads as a
                         finding, a one-pixel bar reads as a broken render. */
                      <>
                        <rect
                          x={x}
                          y={y(start) - 26}
                          width={barW}
                          height={26}
                          rx={7}
                          fill="none"
                          stroke={c.color}
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        <text
                          x={x + barW / 2}
                          y={y(start) - 35}
                          textAnchor="middle"
                          className="fill-muted-foreground"
                          fontSize={10}
                        >
                          no credit
                        </text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={x}
                          y={top}
                          width={barW}
                          height={height}
                          rx={Math.min(7, Math.min(barW, height) / 2)}
                          fill={c.color}
                        />
                        <text
                          x={x + barW / 2}
                          y={top - 9}
                          textAnchor="middle"
                          className="fill-foreground tnum"
                          fontSize={12}
                          fontWeight={600}
                        >
                          {currency(value, { compact: true })}
                        </text>
                      </>
                    )}
                    {/* Generous hit area so thin bars stay hoverable. */}
                    <rect
                      x={x}
                      y={PAD.top}
                      width={barW}
                      height={plotH}
                      fill="transparent"
                    />
                    <text
                      x={x + barW / 2}
                      y={H - PAD.bottom + 20}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={11}
                    >
                      {c.short}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={H - PAD.bottom + 36}
                      textAnchor="middle"
                      className="fill-muted-foreground tnum"
                      fontSize={10}
                      opacity={0.75}
                    >
                      {percent(c.share, 0)}
                    </text>
                  </g>
                );
              })}

              {/* Total column, filled with the channel palette in contribution
                  order so it reads as the sum of the bars beside it. */}
              <g style={{ opacity: hover ? 0.5 : 1, transition: "opacity 200ms" }}>
                <rect
                  x={totalX}
                  y={y(max)}
                  width={barW}
                  height={plotH}
                  rx={Math.min(7, barW / 2)}
                  fill={`url(#${gradientId})`}
                  className="stroke-foreground"
                  strokeOpacity={0.45}
                  strokeWidth={1.25}
                />
                <text
                  x={totalX + barW / 2}
                  y={y(max) - 12}
                  textAnchor="middle"
                  className="fill-foreground tnum"
                  fontSize={12}
                  fontWeight={600}
                >
                  {currency(max, { compact: true })}
                </text>
                <text
                  x={totalX + barW / 2}
                  y={H - PAD.bottom + 20}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={11}
                >
                  Total
                </text>
              </g>
            </svg>
          </div>
        </div>

        {hovered ? (
          <div className="pointer-events-none absolute top-3 right-6 rounded-lg border border-border bg-popover/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
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
    </Panel>
  );
}
