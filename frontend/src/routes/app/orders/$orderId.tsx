import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ShoppingCart, Factory, ShieldCheck, Truck, FileText } from "lucide-react";
import { orders, rolls, dispatches, invoices, orderTotals, stageLabels } from "@/data/tms";
import { date, qty, inr } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Order Spine & Details · Everest Textile Mills";
const description = "Full order breakdown: item lines, production jobs, produced rolls, dispatches, and billing.";

export const Route = createFileRoute("/app/orders/$orderId")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();

  const order = useMemo(() => {
    return orders.find((o) => o.no === orderId) || orders[0];
  }, [orderId]);

  const orderRolls = useMemo(() => {
    return rolls.filter((r) => r.order === order.no);
  }, [order.no]);

  const orderDispatches = useMemo(() => {
    return dispatches.filter((d) => d.order === order.no);
  }, [order.no]);

  const totals = orderTotals(order);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Orders", order.no]}
        title={`Order Details: ${order.no}`}
        description={`Buyer: ${order.buyer} | Status: ${stageLabels[order.stage]}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => history.back()}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            <Link
              to="/app/orders/tracking"
              search={{ q: order.no }}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <PhoneCallIcon className="size-4" /> Phone Tracker
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Ordered</p>
          <p className="text-xl font-bold font-mono text-primary">{qty(totals.ordered, "m")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Produced</p>
          <p className="text-xl font-bold font-mono text-indigo-600">{qty(totals.produced, "m")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Passed QC</p>
          <p className="text-xl font-bold font-mono text-emerald-600">{qty(totals.passed, "m")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Commercial Value</p>
          <p className="text-xl font-bold font-mono text-purple-600">{inr(totals.value)}</p>
        </div>
      </div>

      {/* Order Item Specifications */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <ShoppingCart className="size-4 text-primary" /> Order Items & Specifications
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                <th className="p-3">Product Name</th>
                <th className="p-3">Colour</th>
                <th className="p-3 text-right">Ordered Qty</th>
                <th className="p-3 text-right">Produced</th>
                <th className="p-3 text-right">Passed QC</th>
                <th className="p-3 text-right">Dispatched</th>
                <th className="p-3 text-right">Rate (₹/m)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-semibold">{item.product}</td>
                  <td className="p-3">{item.colour}</td>
                  <td className="p-3 text-right font-mono">{qty(item.orderedQty, "m")}</td>
                  <td className="p-3 text-right font-mono text-indigo-600">{qty(item.producedQty, "m")}</td>
                  <td className="p-3 text-right font-mono text-emerald-600">{qty(item.passedQty, "m")}</td>
                  <td className="p-3 text-right font-mono text-purple-600">{qty(item.dispatchedQty, "m")}</td>
                  <td className="p-3 text-right font-mono">{inr(item.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Produced Fabric Rolls */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Factory className="size-4 text-primary" /> Produced Fabric Rolls ({orderRolls.length})
        </h3>
        {orderRolls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="p-3">Roll Code</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Length (m)</th>
                  <th className="p-3 text-right">Weight (kg)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orderRolls.map((r) => (
                  <tr key={r.code}>
                    <td className="p-3">
                      <CodeChip code={r.code} />
                    </td>
                    <td className="p-3 font-mono text-xs">{r.machine}</td>
                    <td className="p-3">{r.product}</td>
                    <td className="p-3 text-right font-mono">{qty(r.length, "m")}</td>
                    <td className="p-3 text-right font-mono">{qty(r.weight, "kg")}</td>
                    <td className="p-3 text-center">
                      <StatusBadge label={r.status.toUpperCase()} tone={r.status === "in_stock" ? "success" : "info"} />
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to="/app/quality/traceability"
                        search={{ code: r.code }}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        View Dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No rolls produced yet for this order.</p>
        )}
      </div>
    </div>
  );
}

function PhoneCallIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
