import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Package, PackagePlus } from "lucide-react";
import { yarnStock, type YarnStockRow } from "@/data/tms";
import { inr, qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";

const title = "Raw Material Stock · Everest Textile Mills";
const description = "Live yarn stock with on-hand, reserved and available quantities, reorder-level warnings and stock valuation.";

export const Route = createFileRoute("/app/raw-materials/stock")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: StockPage,
});

function stockStatus(y: YarnStockRow): "ok" | "low" | "critical" {
  const available = y.onHand - y.reserved;
  if (available <= 0) return "critical";
  if (y.onHand <= y.reorderLevel) return "low";
  return "ok";
}

function StockPage() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const rows = useMemo(
    () =>
      yarnStock.filter((y) => {
        const q = search.toLowerCase();
        const matches = !q || y.yarnType.toLowerCase().includes(q) || y.colour.toLowerCase().includes(q);
        return matches && (!lowOnly || stockStatus(y) !== "ok");
      }),
    [search, lowOnly],
  );

  const totalOnHand = yarnStock.reduce((s, y) => s + y.onHand, 0);
  const totalReserved = yarnStock.reduce((s, y) => s + y.reserved, 0);
  const lowCount = yarnStock.filter((y) => stockStatus(y) !== "ok").length;

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Raw Materials", "Live Stock"]}
        title="Raw Material Stock"
        description="Real-time on-hand, reserved and available yarn — no physical floor checks needed."
        actions={
          <Link
            to="/app/raw-materials/gate-entry"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <PackagePlus className="size-4" /> New Gate Entry
          </Link>
        }
      />

      {lowCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            <strong>{lowCount} yarn items</strong> are at or below reorder level. Create purchase orders to avoid production stoppage.
          </span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Yarn On-Hand" value={qty(totalOnHand, "kg")} icon={Package} />
        <MetricCard label="Reserved for Orders" value={qty(totalReserved, "kg")} tone="info" />
        <MetricCard label="Available Unreserved" value={qty(totalOnHand - totalReserved, "kg")} tone="success" />
        <MetricCard label="Low-Stock Alerts" value={String(lowCount)} tone={lowCount ? "danger" : "success"} icon={AlertTriangle} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search yarn type or colour…"
          aria-label="Search yarn stock"
          className="h-9 w-64 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="size-4 accent-[#4F46E5]" />
          Low stock only
        </label>
      </div>

      <DataTable<YarnStockRow>
        rows={rows}
        rowKey={(y) => y.yarnType + y.colour}
        emptyMessage="No yarn matches this filter."
        columns={[
          { key: "type", header: "Yarn Type", render: (y) => <span className="font-medium">{y.yarnType}</span> },
          { key: "colour", header: "Colour", render: (y) => y.colour },
          { key: "onhand", header: "On-Hand", align: "right", className: "font-mono tabular-nums", render: (y) => qty(y.onHand, "kg") },
          { key: "reserved", header: "Reserved", align: "right", className: "font-mono tabular-nums", render: (y) => qty(y.reserved, "kg") },
          { key: "available", header: "Available", align: "right", className: "font-mono tabular-nums", render: (y) => qty(y.onHand - y.reserved, "kg") },
          { key: "reorder", header: "Reorder Level", align: "right", className: "font-mono tabular-nums", render: (y) => qty(y.reorderLevel, "kg") },
          { key: "cost", header: "Avg Cost", align: "right", className: "font-mono tabular-nums", render: (y) => inr(y.avgCost) + "/kg" },
          { key: "valuation", header: "Valuation", align: "right", className: "font-mono tabular-nums", render: (y) => inr(y.onHand * y.avgCost) },
          {
            key: "status",
            header: "Status",
            render: (y) => {
              const s = stockStatus(y);
              return s === "ok" ? (
                <StatusBadge label="NORMAL" tone="success" />
              ) : s === "low" ? (
                <StatusBadge label="LOW STOCK" tone="warning" />
              ) : (
                <StatusBadge label="CRITICAL DEFICIT" tone="danger" />
              );
            },
          },
        ]}
      />
    </div>
  );
}
