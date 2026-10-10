import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Layers, PieChart } from "lucide-react";
import { orderMargins, rolls } from "@/data/tms";
import { inr, qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Cost & Contribution Analysis · Everest Textile Mills";
const description = "Order contribution margin and unit roll manufacturing cost breakdown.";

export const Route = createFileRoute("/app/executive/cost-analysis")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: CostAnalysisPage,
});

function CostAnalysisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Executive", "Cost Analysis"]}
        title="Unit Cost & Order Profitability Analysis"
        description="Analyze direct yarn cost, machine operating overhead, and gross margin per order and roll."
      />

      {/* Order Profitability DataGrid */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <PieChart className="size-5 text-primary" /> Customer Order Margin Analysis
        </h3>
        <DataTable
          rows={orderMargins}
          rowKey={(om) => om.order}
          emptyMessage="No order cost data."
          columns={[
            { key: "order", header: "Order #", render: (om) => <CodeChip code={om.order} /> },
            { key: "buyer", header: "Buyer", render: (om) => <span className="font-semibold">{om.buyer}</span> },
            { key: "revenue", header: "Total Revenue", align: "right", className: "font-mono font-bold", render: (om) => inr(om.revenue) },
            { key: "cost", header: "Direct Manufacturing Cost", align: "right", className: "font-mono text-muted-foreground", render: (om) => inr(om.cost) },
            { key: "margin", header: "Contribution Margin", align: "right", className: "font-mono font-bold text-emerald-600", render: (om) => `${om.margin}%` },
          ]}
        />
      </div>

      {/* Fabric Roll Unit Cost Table */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Layers className="size-5 text-primary" /> Fabric Roll Unit Manufacturing Cost Breakdown
        </h3>
        <DataTable
          rows={rolls}
          rowKey={(r) => r.code}
          emptyMessage="No roll cost data."
          columns={[
            { key: "code", header: "Roll Code", render: (r) => <CodeChip code={r.code} /> },
            { key: "product", header: "Product", render: (r) => r.product },
            { key: "length", header: "Length", align: "right", className: "font-mono", render: (r) => qty(r.length, "m") },
            { key: "weight", header: "Weight", align: "right", className: "font-mono", render: (r) => qty(r.weight, "kg") },
            { key: "unitCost", header: "Estimated Unit Cost", align: "right", className: "font-mono font-bold text-primary", render: (r) => inr(r.weight * 312) },
          ]}
        />
      </div>
    </div>
  );
}
