import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Plus, Trash2, ShieldCheck } from "lucide-react";
import { buyers, fabricProducts, yarnStock } from "@/data/tms";
import { inr, qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { toast } from "sonner";

const title = "New Customer Order · Everest Textile Mills";
const description = "Create a customer order with instant real-time yarn feasibility checking.";

export const Route = createFileRoute("/app/orders/new")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
    ],
  }),
  component: NewOrderPage,
});

interface OrderLine {
  id: string;
  productId: string;
  colour: string;
  orderedQty: number;
  agreedRate: number;
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const [buyerId, setBuyerId] = useState(buyers[0].id);
  const [orderDate, setOrderDate] = useState("2026-10-10");
  const [promisedDate, setPromisedDate] = useState("2026-10-25");
  const [lines, setLines] = useState<OrderLine[]>([
    { id: "line-1", productId: fabricProducts[0].id, colour: "White", orderedQty: 2500, agreedRate: 98 },
  ]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        productId: fabricProducts[0].id,
        colour: "White",
        orderedQty: 1000,
        agreedRate: 95,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      toast.error("At least one order line is required.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof OrderLine, val: any) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
  };

  const totalValue = lines.reduce((acc, l) => acc + l.orderedQty * l.agreedRate, 0);

  // Simple feasibility calculation based on available yarn
  const estYarnNeed = lines.reduce((acc, l) => acc + Math.round(l.orderedQty * 0.22), 0);
  const totalYarnAvailable = yarnStock.reduce((acc, y) => acc + (y.onHand - y.reserved), 0);
  const isFeasible = totalYarnAvailable >= estYarnNeed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerId) {
      toast.error("Please select a buyer.");
      return;
    }
    const orderNo = `ORD-26-${Math.floor(100000 + Math.random() * 900000)}`;
    toast.success(`Order ${orderNo} created successfully! Yarn reserved.`);
    void navigate({ to: "/app/orders/list" });
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        breadcrumb={["App", "Orders", "New Order Stepper"]}
        title="Create Customer Order"
        description="Fill buyer commercial details and check yarn stock availability per fabric line."
        actions={
          <button
            onClick={() => history.back()}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Cancel
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buyer & Date Details */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Commercial & Customer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Select Buyer / Customer *
              </label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Order Date *
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Promised Delivery Date *
              </label>
              <input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Fabric Line Items Table */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Order Item Lines</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-secondary px-3 text-xs font-medium hover:bg-secondary/80"
            >
              <Plus className="size-3.5" /> Add Fabric Line
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                  <th className="p-2.5">Fabric Product</th>
                  <th className="p-2.5">Colour / Shade</th>
                  <th className="p-2.5 text-right">Ordered Length (m)</th>
                  <th className="p-2.5 text-right">Agreed Rate (₹/m)</th>
                  <th className="p-2.5 text-right">Line Total (₹)</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => {
                  const lineTotal = l.orderedQty * l.agreedRate;
                  return (
                    <tr key={l.id}>
                      <td className="p-2.5">
                        <select
                          value={l.productId}
                          onChange={(e) => updateLine(l.id, "productId", e.target.value)}
                          className="h-8 w-full rounded border bg-background px-2 text-sm outline-none"
                        >
                          {fabricProducts.map((fp) => (
                            <option key={fp.id} value={fp.id}>
                              {fp.name} (GSM {fp.gsm})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={l.colour}
                          onChange={(e) => updateLine(l.id, "colour", e.target.value)}
                          className="h-8 w-full rounded border bg-background px-2 text-sm outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="1"
                          value={l.orderedQty}
                          onChange={(e) => updateLine(l.id, "orderedQty", Number(e.target.value))}
                          className="h-8 w-28 text-right font-mono rounded border bg-background px-2 text-sm outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={l.agreedRate}
                          onChange={(e) => updateLine(l.id, "agreedRate", Number(e.target.value))}
                          className="h-8 w-24 text-right font-mono rounded border bg-background px-2 text-sm outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-medium">{inr(lineTotal)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(l.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Yarn Feasibility Checker Card */}
        <div className={`rounded-xl border p-5 shadow-sm ${isFeasible ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800" : "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800"}`}>
          <div className="flex items-start gap-3">
            {isFeasible ? (
              <CheckCircle2 className="size-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="text-base font-bold">
                {isFeasible ? "Yarn Material Feasibility Confirmed" : "Yarn Stock Deficit Warning"}
              </h3>
              <p className="text-sm">
                Estimated raw yarn required: <strong>{qty(estYarnNeed, "kg")}</strong>. Total unreserved yarn available on floor: <strong>{qty(totalYarnAvailable, "kg")}</strong>.
              </p>
              {!isFeasible && (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Submitting will create order in "Awaiting Material" stage and notify store manager for yarn procurement.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Footer */}
        <div className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground">Total Order Value</p>
            <p className="text-2xl font-bold font-mono text-primary">{inr(totalValue)}</p>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <CheckCircle2 className="size-5" /> Submit Order & Reserve Yarn
          </button>
        </div>
      </form>
    </div>
  );
}
