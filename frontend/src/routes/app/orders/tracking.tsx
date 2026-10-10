import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PhoneCall, Search, PackageCheck, Truck, Factory, ShieldCheck } from "lucide-react";
import { orders, type Order, orderTotals, stageLabels } from "@/data/tms";
import { date, qty, inr } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Buyer Phone Order Status Desk · Everest Textile Mills";
const description = "Zero-latency customer inquiry desk for 1-second phone call status lookup.";

export const Route = createFileRoute("/app/orders/tracking")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
    ],
  }),
  component: PhoneTrackingPage,
});

function PhoneTrackingPage() {
  const { q } = Route.useSearch();
  const [query, setQuery] = useState(q || "ORD-26-000042");

  const matchedOrder = useMemo(() => {
    if (!query) return orders[0];
    const searchLow = query.toLowerCase().trim();
    return (
      orders.find((o) => o.no.toLowerCase().includes(searchLow) || o.buyer.toLowerCase().includes(searchLow)) || null
    );
  }, [query]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumb={["App", "Orders", "Phone Tracking"]}
        title="Customer Support Phone Inquiry Desk"
        description="Instant single-input order lookup to answer buyer phone queries in under 1 second."
      />

      {/* Hero Search Box */}
      <div className="mb-6 rounded-2xl border bg-card p-6 shadow-md">
        <label className="block text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <PhoneCall className="size-4 text-primary" /> Enter Buyer Name or Order # (e.g. Apex or ORD-26-000042)
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type buyer or order code..."
            autoFocus
            className="h-12 w-full rounded-xl border bg-background pl-12 pr-4 text-lg font-medium outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {matchedOrder ? (
        <div className="space-y-6">
          {/* Order Details Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{matchedOrder.buyer}</h2>
                  <CodeChip code={matchedOrder.no} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ordered on <strong>{date(matchedOrder.orderDate)}</strong> | Promised Delivery:{" "}
                  <strong className="text-primary">{date(matchedOrder.promised)}</strong>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Commercial Value</p>
                <p className="text-xl font-bold font-mono text-primary">{inr(orderTotals(matchedOrder).value)}</p>
              </div>
            </div>

            {/* Dynamic Operational Stage Banner */}
            <div className="rounded-xl border bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Live Operational Status
              </p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  {stageLabels[matchedOrder.stage]}
                </h3>
                <StatusBadge label={matchedOrder.stage.toUpperCase()} tone="info" />
              </div>
            </div>

            {/* Progress Meters */}
            {(() => {
              const t = orderTotals(matchedOrder);
              const prodPct = t.ordered ? Math.round((t.produced / t.ordered) * 100) : 0;
              const dispPct = t.ordered ? Math.round((t.dispatched / t.ordered) * 100) : 0;

              return (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl border bg-muted/30 p-4">
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Ordered</span>
                    <p className="text-lg font-bold font-mono">{qty(t.ordered, "m")}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Produced ({prodPct}%)</span>
                    <p className="text-lg font-bold font-mono text-indigo-600">{qty(t.produced, "m")}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Passed QC</span>
                    <p className="text-lg font-bold font-mono text-emerald-600">{qty(t.passed, "m")}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Dispatched ({dispPct}%)</span>
                    <p className="text-lg font-bold font-mono text-purple-600">{qty(t.dispatched, "m")}</p>
                  </div>
                </div>
              );
            })()}

            {/* Itemized Fabric Lines */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Itemized Fabric Specifications & Progress</h4>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                      <th className="p-3">Fabric Product</th>
                      <th className="p-3">Colour</th>
                      <th className="p-3 text-right">Ordered</th>
                      <th className="p-3 text-right">Produced</th>
                      <th className="p-3 text-right">Passed QC</th>
                      <th className="p-3 text-right">Dispatched</th>
                      <th className="p-3 text-right">Unit Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {matchedOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-semibold">{item.product}</td>
                        <td className="p-3">{item.colour}</td>
                        <td className="p-3 text-right font-mono">{qty(item.orderedQty, "m")}</td>
                        <td className="p-3 text-right font-mono text-indigo-600">{qty(item.producedQty, "m")}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{qty(item.passedQty, "m")}</td>
                        <td className="p-3 text-right font-mono text-purple-600">{qty(item.dispatchedQty, "m")}</td>
                        <td className="p-3 text-right font-mono">{inr(item.rate)}/m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          <p className="text-base font-semibold">No order found matching "{query}"</p>
          <p className="text-xs mt-1">Try searching for "Apex", "Metro", or "ORD-26-000042".</p>
        </div>
      )}
    </div>
  );
}
