import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, ShoppingCart, Truck, CheckCircle2, Clock } from "lucide-react";
import { orders, type Order, orderTotals, stageLabels } from "@/data/tms";
import { inr, qty, date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

export function OrdersListPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const matches = !q || o.no.toLowerCase().includes(q) || o.buyer.toLowerCase().includes(q);
      const stageMatch = stageFilter === "all" || o.stage === stageFilter;
      return matches && stageMatch;
    });
  }, [search, stageFilter]);

  const totalOrders = orders.length;
  const activeProd = orders.filter((o) => o.stage === "in_production" || o.stage === "production_scheduled").length;
  const readyDispatched = orders.filter((o) => o.stage === "ready_for_dispatch" || o.stage === "partially_dispatched" || o.stage === "fully_dispatched").length;
  const totalValue = orders.reduce((acc, o) => acc + orderTotals(o).value, 0);

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Orders", "Active Orders"]}
        title="Customer Orders Catalog"
        description="Track buyer orders from raw material check through production, QC, and dispatch."
        actions={
          <Link
            to="/app/orders/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create New Order
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Orders" value={String(totalOrders)} icon={ShoppingCart} />
        <MetricCard label="In Production" value={String(activeProd)} tone="info" icon={Clock} />
        <MetricCard label="Ready / Dispatched" value={String(readyDispatched)} tone="success" icon={Truck} />
        <MetricCard label="Total Order Value" value={inr(totalValue)} tone="primary" icon={CheckCircle2} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or buyer..."
            className="h-9 w-64 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Operational Stages</option>
            <option value="awaiting_material">Awaiting Material</option>
            <option value="production_scheduled">Production Scheduled</option>
            <option value="in_production">In Production</option>
            <option value="ready_for_dispatch">Ready for Dispatch</option>
            <option value="partially_dispatched">Partially Dispatched</option>
            <option value="fully_dispatched">Fully Dispatched</option>
          </select>
        </div>
      </div>

      <DataTable<Order>
        rows={filteredOrders}
        rowKey={(o) => o.no}
        emptyMessage="No customer orders found matching your search."
        columns={[
          {
            key: "no",
            header: "Order #",
            render: (o) => (
              <Link to={`/app/orders/${o.no}`} className="hover:underline">
                <CodeChip code={o.no} />
              </Link>
            ),
          },
          { key: "buyer", header: "Buyer Name", render: (o) => <span className="font-semibold">{o.buyer}</span> },
          { key: "orderDate", header: "Order Date", render: (o) => date(o.orderDate) },
          { key: "promised", header: "Promised Delivery", render: (o) => date(o.promised) },
          {
            key: "stage",
            header: "Stage",
            render: (o) => {
              const label = stageLabels[o.stage] || o.stage;
              let tone: "success" | "warning" | "danger" | "info" | "neutral" = "info";
              if (o.stage === "fully_dispatched") tone = "success";
              else if (o.stage === "awaiting_material") tone = "warning";
              else if (o.stage === "ready_for_dispatch") tone = "success";
              return <StatusBadge label={label} tone={tone} />;
            },
          },
          {
            key: "progress",
            header: "Production Progress",
            render: (o) => {
              const t = orderTotals(o);
              const pct = t.ordered ? Math.round((t.produced / t.ordered) * 100) : 0;
              return (
                <div className="w-36">
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span>{qty(t.produced, "m")}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            },
          },
          {
            key: "value",
            header: "Order Value",
            align: "right",
            className: "font-mono tabular-nums font-medium",
            render: (o) => inr(orderTotals(o).value),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (o) => (
              <div className="flex justify-end gap-2">
                <Link
                  to={`/app/orders/${o.no}`}
                  className="rounded px-2 py-1 text-xs font-medium border bg-card hover:bg-accent"
                >
                  View Spine
                </Link>
                <Link
                  to={`/app/orders/tracking?q=${encodeURIComponent(o.no)}`}
                  className="rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Track Phone
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
