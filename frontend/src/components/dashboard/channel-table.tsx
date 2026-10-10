import { useState } from "react";
import { motion } from "framer-motion";
import type { ChannelMetrics } from "@/data/attribution";
import { currency, number, roas } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { Sparkline } from "./sparkline";

type SortKey = "name" | "spend" | "revenue" | "roas" | "conversions" | "cpa";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Channel", align: "left" },
  { key: "spend", label: "Spend", align: "right" },
  { key: "revenue", label: "Attributed revenue", align: "right" },
  { key: "roas", label: "ROAS", align: "right" },
  { key: "conversions", label: "Conversions", align: "right" },
  { key: "cpa", label: "CPA", align: "right" },
];

function delta(values: number[]) {
  const first = values[0];
  const last = values[values.length - 1];
  if (!first) return null;
  return (last - first) / first;
}

export function ChannelTable({
  channels,
  focus = [],
}: {
  channels: ChannelMetrics[];
  focus?: string[];
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "revenue",
    dir: "desc",
  });

  const rows = [...channels]
    .filter((c) => (focus.length ? focus.includes(c.id) : true))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      // Dash cells (NaN ROAS/CPA on unpaid channels) always sort to the bottom.
      const va = a[sort.key] as number;
      const vb = b[sort.key] as number;
      const na = Number.isFinite(va) ? va : -Infinity;
      const nb = Number.isFinite(vb) ? vb : -Infinity;
      return (na - nb) * dir;
    });

  // One domain for every sparkline, so a flat line for a small channel reads
  // as small rather than as its own auto-scaled story.
  const allTrend = channels.flatMap((c) => c.trend);
  const domain: [number, number] = [0, Math.max(...allTrend, 1)];

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  return (
    <Panel
      surface="sunken"
      title="Channel detail"
      subtitle="Sort any column. Rows re-order as the attribution model changes; colours stay pinned to the channel. Trends share one scale."
      bodyClassName="px-0 sm:px-0"
    >
      <div className="scroll-x overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-y border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-xs font-medium text-muted-foreground first:pl-5 sm:first:pl-6",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <button
                    onClick={() => toggle(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                      sort.key === col.key && "text-foreground",
                    )}
                  >
                    {col.label}
                    <span className="text-[9px] leading-none opacity-70">
                      {sort.key === col.key ? (sort.dir === "desc" ? "▼" : "▲") : ""}
                    </span>
                  </button>
                </th>
              ))}
              <th
                scope="col"
                className="w-[210px] px-3 py-2.5 pr-5 pl-8 text-left text-xs font-medium text-muted-foreground sm:pr-6"
              >
                12-week trend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const d = delta(c.trend);
              return (
                <motion.tr
                  key={c.id}
                  layout
                  transition={{ duration: 0.72, ease: [0.65, 0, 0.35, 1] }}
                  className="border-b border-border/70 last:border-0 hover:bg-muted/50"
                >
                  <td className="px-3 py-3 pl-5 sm:pl-6">
                    <span className="flex items-center gap-2.5 font-medium text-foreground">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color }}
                        aria-hidden
                      />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground tnum">
                    {c.spend > 0 ? currency(c.spend) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-foreground tnum">
                    {currency(c.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right text-foreground tnum">{roas(c.roas)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground tnum">
                    {number(c.conversions)}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground tnum">
                    {Number.isFinite(c.cpa) ? currency(c.cpa) : "—"}
                  </td>
                  <td className="px-3 py-3 pr-5 pl-8 sm:pr-6">
                    <span className="flex items-center gap-3">
                      <Sparkline values={c.trend} color={c.color} domain={domain} />
                      <span className="w-12 text-right text-xs text-muted-foreground tnum">
                        {d === null
                          ? "—"
                          : `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(0)}%`}
                      </span>
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
