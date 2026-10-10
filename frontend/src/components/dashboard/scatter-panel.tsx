import { useId, useState } from "react";
import { QUARTER, roasAtSpend, type ChannelMetrics } from "@/data/attribution";
import { currency, roas } from "@/lib/format";
import { Panel } from "./panel";

const W = 720;
const H = 400;
const PAD = { top: 26, right: 46, bottom: 48, left: 56 };

/** SVG path sampling a channel's modeled ROAS curve between two spend levels. */
function curveD(
  c: ChannelMetrics,
  x: (v: number) => number,
  y: (v: number) => number,
  from: number,
  to: number,
) {
  let d = "";
  for (let i = 0; i <= 32; i++) {
    const s = from + ((to - from) * i) / 32;
    const v = roasAtSpend(c, s);
    if (!Number.isFinite(v)) continue;
    d += `${d ? "L" : "M"}${x(s).toFixed(1)} ${y(v).toFixed(1)}`;
  }
  return d;
}

/** Nice tick step for the current y range. */
function stepFor(domain: number) {
  if (domain > 24) return 8;
  if (domain > 12) return 4;
  if (domain > 6) return 2;
  return 1;
}

export function ScatterPanel({
  channels,
  focus = [],
}: {
  channels: ChannelMetrics[];
  focus?: string[];
}) {
  const [hover, setHover] = useState<ChannelMetrics | null>(null);
  const clipId = useId();

  const paid = channels.filter((c) => c.spend > 0);
  const unpaid = channels.filter((c) => c.spend === 0);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // The domain follows the interpolated data, so it eases with the transition
  // instead of being frozen at the worst case of all three models. Without
  // this, the default view wastes the top half of the plot on empty space.
  const maxRoas = Math.max(QUARTER.roasTarget * 1.4, ...paid.map((c) => c.roas));
  const domain = maxRoas * 1.16;
  const step = stepFor(domain);

  const maxSpend = 205_000;
  const maxBubbleSpend = Math.max(...paid.map((c) => c.spend));
  const minBubbleSpend = Math.min(...paid.map((c) => c.spend));

  const x = (v: number) => PAD.left + (v / maxSpend) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / domain) * plotH;
  const r = (spend: number) => 10 + Math.sqrt(spend / maxBubbleSpend) * 26;

  const xTicks = [0, 50_000, 100_000, 150_000, 200_000];
  const yTicks: number[] = [];
  for (let v = 0; v <= domain; v += step) yTicks.push(v);

  return (
    <Panel
      title="Spend vs return"
      subtitle="Bubble size is media budget. Curves model how return decays as spend scales, dashed past current spend."
      surface="raised"
      className="h-full"
      bodyClassName="flex flex-col"
    >
      {/* Grows to match the taller paths panel beside it instead of leaving a
          block of empty card below the plot. */}
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full max-h-[460px] w-full"
          role="img"
        >

          {yTicks.map((v) => (
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
                {v}x
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={v}>
              <line
                x1={x(v)}
                x2={x(v)}
                y1={y(0)}
                y2={y(0) + 5}
                stroke="var(--panel-grid)"
                strokeWidth={1}
              />
              <text
                x={x(v)}
                y={H - PAD.bottom + 22}
                textAnchor="middle"
                className="fill-muted-foreground tnum"
                fontSize={11}
              >
                {currency(v, { compact: true })}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(QUARTER.roasTarget)}
            y2={y(QUARTER.roasTarget)}
            stroke="var(--foreground)"
            strokeOpacity={0.45}
            strokeWidth={1.25}
            strokeDasharray="6 6"
          />
          <text
            x={W - PAD.right}
            y={y(QUARTER.roasTarget) - 8}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {roas(QUARTER.roasTarget)} ROAS target
          </text>

          {/* Modeled response curves: solid up to each channel's current
              spend, dashed where the curve extrapolates beyond it. */}
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            {paid.map((c) => {
              const dim =
                (hover && hover.id !== c.id) || (focus.length > 0 && !focus.includes(c.id));
              const hot = hover?.id === c.id;
              return (
                <g
                  key={c.id}
                  style={{
                    opacity: dim ? 0.08 : hot ? 0.95 : 0.18,
                    transition: "opacity 200ms",
                  }}
                >
                  <path
                    d={curveD(c, x, y, maxSpend * 0.02, c.spend)}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={1.5}
                  />
                  <path
                    d={curveD(c, x, y, c.spend, maxSpend * 0.985)}
                    fill="none"
                    stroke={c.color}
                    strokeWidth={1.5}
                    strokeDasharray="2 5"
                  />
                </g>
              );
            })}
          </g>

          {paid.map((c) => {
            const dim = (hover && hover.id !== c.id) || (focus.length > 0 && !focus.includes(c.id));
            const radius = r(c.spend);
            const cx = Math.min(Math.max(x(c.spend), PAD.left + radius), W - PAD.right - radius);
            const cy = Math.min(Math.max(y(c.roas), PAD.top + radius), y(0) - 4);
            // Label above unless that would clip the top of the plot.
            const above = cy - radius - 8 > PAD.top + 8;
            return (
              <g
                key={c.id}
                onMouseEnter={() => setHover(c)}
                onMouseLeave={() => setHover(null)}
                style={{ opacity: dim ? 0.3 : 1, transition: "opacity 200ms" }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={c.color}
                  fillOpacity={0.22}
                  stroke={c.color}
                  strokeWidth={1.5}
                />
                <circle cx={cx} cy={cy} r={3.5} fill={c.color} />
                <text
                  x={cx}
                  y={above ? cy - radius - 8 : cy + radius + 15}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize={11}
                  fontWeight={500}
                  stroke="var(--card)"
                  strokeWidth={3}
                  strokeOpacity={0.85}
                  paintOrder="stroke"
                >
                  {c.short}
                </text>
              </g>
            );
          })}

          <text
            x={PAD.left + plotW / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            Media spend
          </text>
        </svg>

        {hover ? (
          <div className="pointer-events-none absolute top-3 right-3 rounded-lg border border-border bg-popover/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: hover.color }}
                aria-hidden
              />
              {hover.name}
            </div>
            <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-muted-foreground tnum">
              <dt>Spend</dt>
              <dd className="text-right text-foreground">{currency(hover.spend)}</dd>
              <dt>ROAS</dt>
              <dd className="text-right text-foreground">{roas(hover.roas)}</dd>
              <dt>Attributed</dt>
              <dd className="text-right text-foreground">{currency(hover.revenue)}</dd>
            </dl>
          </div>
        ) : null}
      </div>

      {/* Unpaid channels cannot be plotted against spend; keep them visible
          here instead of silently dropping them from the panel. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <svg width="46" height="26" viewBox="0 0 46 26" aria-hidden className="shrink-0">
            <circle cx="30" cy="13" r="11" fill="none" stroke="currentColor" strokeOpacity="0.5" />
            <circle cx="13" cy="17" r="6" fill="none" stroke="currentColor" strokeOpacity="0.5" />
          </svg>
          <span className="tnum">
            {currency(minBubbleSpend, { compact: true })} to{" "}
            {currency(maxBubbleSpend, { compact: true })} media spend
          </span>
        </span>
        <span className="h-3 w-px bg-border" aria-hidden />
        <span className="font-medium text-foreground/70">No media spend</span>
        {unpaid.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1.5 tnum"
            style={{
              opacity: focus.length > 0 && !focus.includes(c.id) ? 0.35 : 1,
              transition: "opacity 200ms",
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: c.color }}
              aria-hidden
            />
            {c.name}
            <span className="font-medium text-foreground">
              {currency(c.revenue, { compact: true })}
            </span>
            attributed
          </span>
        ))}
      </div>
    </Panel>
  );
}
