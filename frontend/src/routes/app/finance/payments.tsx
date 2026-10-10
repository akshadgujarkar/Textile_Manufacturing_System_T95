import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Landmark, CheckCircle2, DollarSign, Wand2 } from "lucide-react";
import { buyers, invoices } from "@/data/tms";
import { inr, date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Buyer Payment Allocation · Everest Textile Mills";
const description = "Record customer receipts and allocate funds across unpaid sales invoices.";

export const Route = createFileRoute("/app/finance/payments")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: BuyerPaymentAllocationPage,
});

function BuyerPaymentAllocationPage() {
  const [buyerId, setBuyerId] = useState(buyers[0].id);
  const [paymentDate, setPaymentDate] = useState("2026-10-10");
  const [amountReceived, setAmountReceived] = useState<number>(150000);
  const [paymentMode, setPaymentMode] = useState("NEFT / Bank Transfer");
  const [utrRef, setUtrRef] = useState("UTR-8899220011");

  const selectedBuyerName = buyers.find((b) => b.id === buyerId)?.name || buyers[0].name;

  // Filter open invoices for buyer
  const openInvoices = useMemo(() => {
    return invoices.filter((i) => i.buyer === selectedBuyerName && i.total - i.paid > 0);
  }, [selectedBuyerName]);

  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const handleAutoAllocate = () => {
    let rem = amountReceived;
    const newAlloc: Record<string, number> = {};
    for (const inv of openInvoices) {
      const bal = inv.total - inv.paid;
      if (rem <= 0) {
        newAlloc[inv.no] = 0;
      } else if (rem >= bal) {
        newAlloc[inv.no] = bal;
        rem -= bal;
      } else {
        newAlloc[inv.no] = rem;
        rem = 0;
      }
    }
    setAllocations(newAlloc);
    toast.success("Auto-allocated payment amount across oldest open invoices!");
  };

  const totalAllocated = Object.values(allocations).reduce((s, a) => s + (a || 0), 0);
  const unallocatedAdvance = Math.max(0, amountReceived - totalAllocated);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountReceived <= 0) {
      toast.error("Please enter a valid received amount.");
      return;
    }
    toast.success(`Payment of ${inr(amountReceived)} recorded for ${selectedBuyerName}! Allocations posted.`);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumb={["App", "Finance", "Payments"]}
        title="Buyer Payment & Invoice Allocation"
        description="Record incoming bank transfer/cheque payments and allocate across outstanding invoices."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Header Form */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Landmark className="size-5 text-primary" /> Receipt Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Select Buyer *
              </label>
              <select
                value={buyerId}
                onChange={(e) => {
                  setBuyerId(e.target.value);
                  setAllocations({});
                }}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none"
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
                Payment Received Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Amount Received (₹) *
              </label>
              <input
                type="number"
                min="1"
                value={amountReceived}
                onChange={(e) => setAmountReceived(Number(e.target.value))}
                className="w-full h-9 font-mono font-bold text-base rounded-md border bg-background px-3 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Payment Mode *
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm outline-none"
              >
                <option value="NEFT / Bank Transfer">NEFT / RTGS / Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Bank UTR / Instrument Ref No
              </label>
              <input
                type="text"
                value={utrRef}
                onChange={(e) => setUtrRef(e.target.value)}
                className="w-full h-9 font-mono rounded-md border bg-background px-3 text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {/* Invoice Allocation Grid */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Unpaid Open Invoices for {selectedBuyerName}</h3>
            <button
              type="button"
              onClick={handleAutoAllocate}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 px-3 text-xs font-bold hover:bg-indigo-100"
            >
              <Wand2 className="size-3.5" /> Auto-Allocate Oldest First
            </button>
          </div>

          {openInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-right">Already Paid</th>
                    <th className="p-3 text-right">Outstanding Balance</th>
                    <th className="p-3 text-right">Allocate This Payment (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {openInvoices.map((inv) => {
                    const bal = inv.total - inv.paid;
                    const alloc = allocations[inv.no] || 0;
                    return (
                      <tr key={inv.no}>
                        <td className="p-3">
                          <CodeChip code={inv.no} />
                        </td>
                        <td className="p-3">{date(inv.date)}</td>
                        <td className="p-3 text-right font-mono">{inr(inv.total)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{inr(inv.paid)}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-600">{inr(bal)}</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={bal}
                            value={alloc}
                            onChange={(e) =>
                              setAllocations({ ...allocations, [inv.no]: Number(e.target.value) })
                            }
                            className="h-8 w-32 text-right font-mono font-bold rounded border bg-background px-2 text-sm outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open unpaid invoices for this buyer.</p>
          )}
        </div>

        {/* Unallocated Advance Banner */}
        {unallocatedAdvance > 0 && (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-800 p-4 text-sm text-indigo-900 dark:text-indigo-200 font-medium">
            Remaining unallocated funds: <strong>{inr(unallocatedAdvance)}</strong> will be preserved as buyer credit balance advance.
          </div>
        )}

        {/* Submit Footer */}
        <div className="flex items-center justify-between rounded-2xl border bg-card p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase font-semibold text-muted-foreground">Total Allocated</p>
            <p className="text-2xl font-bold font-mono text-emerald-600">{inr(totalAllocated)}</p>
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow hover:bg-primary/90"
          >
            <CheckCircle2 className="size-5" /> Record Payment & Post Allocations
          </button>
        </div>
      </form>
    </div>
  );
}
