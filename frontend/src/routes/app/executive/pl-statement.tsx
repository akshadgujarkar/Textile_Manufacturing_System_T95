import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DollarSign, TrendingUp, PieChart, ShoppingBag, Factory } from "lucide-react";
import { plStatement, orderMargins, machineProductivity } from "@/data/tms";
import { inr } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Executive Monthly P&L Dashboard · Everest Textile Mills";
const description = "Single-click executive overview of net profit/loss, revenue, yarn costs, and order contribution margins.";

export const Route = createFileRoute("/app/executive/pl-statement")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: ExecutivePLDashboardPage,
});

function ExecutivePLDashboardPage() {
  const pl = plStatement;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Executive", "P&L Statement"]}
        title="Executive Monthly Profit & Loss Statement"
        description="Mill Owner command overview: Invoiced Sales minus Material, Labor Wages, and Factory Overheads."
      />

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Gross Revenue (Invoiced)" value={inr(pl.revenue)} tone="primary" icon={DollarSign} />
        <MetricCard label="Direct Material Cost (Yarn)" value={inr(pl.material)} tone="warning" icon={PieChart} />
        <MetricCard label="Workforce Wages" value={inr(pl.wages)} tone="info" icon={Factory} />
        <MetricCard label="Net Operating Profit" value={`${inr(pl.net)} (${pl.margin}%)`} tone="success" icon={TrendingUp} />
      </div>

      {/* Waterfall Expense & Profit Summary */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold">Profit & Loss Waterfall Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          <div className="rounded-xl border bg-indigo-50 dark:bg-indigo-950 p-4">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Gross Revenue</span>
            <p className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-300">{inr(pl.revenue)}</p>
          </div>
          <div className="rounded-xl border bg-amber-50 dark:bg-amber-950 p-4">
            <span className="text-xs text-muted-foreground uppercase font-semibold">- Material Cost</span>
            <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300">{inr(pl.material)}</p>
          </div>
          <div className="rounded-xl border bg-sky-50 dark:bg-sky-950 p-4">
            <span className="text-xs text-muted-foreground uppercase font-semibold">- Wages Payroll</span>
            <p className="text-lg font-bold font-mono text-sky-700 dark:text-sky-300">{inr(pl.wages)}</p>
          </div>
          <div className="rounded-xl border bg-purple-50 dark:bg-purple-950 p-4">
            <span className="text-xs text-muted-foreground uppercase font-semibold">- Factory Overheads</span>
            <p className="text-lg font-bold font-mono text-purple-700 dark:text-purple-300">{inr(pl.overhead)}</p>
          </div>
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950 p-4">
            <span className="text-xs text-muted-foreground uppercase font-semibold text-emerald-800">Net Profit</span>
            <p className="text-lg font-black font-mono text-emerald-600">{inr(pl.net)}</p>
          </div>
        </div>
      </div>

      {/* Order Contribution Margins DataGrid */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" /> Order Contribution Margin Rankings
        </h3>
        <DataTable
          rows={orderMargins}
          rowKey={(om) => om.order}
          emptyMessage="No order margin data available."
          columns={[
            { key: "order", header: "Order #", render: (om) => <CodeChip code={om.order} /> },
            { key: "buyer", header: "Buyer", render: (om) => <span className="font-semibold">{om.buyer}</span> },
            { key: "revenue", header: "Revenue (₹)", align: "right", className: "font-mono font-bold", render: (om) => inr(om.revenue) },
            { key: "cost", header: "Total Cost (₹)", align: "right", className: "font-mono text-muted-foreground", render: (om) => inr(om.cost) },
            {
              key: "margin",
              header: "Margin (%)",
              align: "right",
              className: "font-mono font-bold text-emerald-600",
              render: (om) => `${om.margin}%`,
            },
          ]}
        />
      </div>
    </div>
  );
}
