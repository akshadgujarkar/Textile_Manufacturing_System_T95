import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supplierBills } from "@/data/tms";
import { inr, date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Supplier Bill Reconciliation · Everest Textile Mills";
const description = "Match incoming raw yarn supplier invoices against gate receipts GRN and detect rate variances.";

export const Route = createFileRoute("/app/finance/supplier-bills")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: SupplierBillsPage,
});

function SupplierBillsPage() {
  const [bills, setBills] = useState(supplierBills);

  const toggleMatch = (billNo: string) => {
    setBills((prev) =>
      prev.map((b) => (b.bill === billNo ? { ...b, matched: true, variance: 0 } : b))
    );
    toast.success(`Supplier Bill ${billNo} approved and matched to GRN!`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Finance", "Supplier Bills"]}
        title="Supplier Inward Bill 3-Way Match"
        description="Verify raw yarn supplier invoices against physical goods receipt notes (GRNs)."
      />

      <DataTable
        rows={bills}
        rowKey={(b) => b.bill}
        emptyMessage="No supplier bills found."
        columns={[
          { key: "bill", header: "Supplier Bill #", render: (b) => <CodeChip code={b.bill} /> },
          { key: "supplier", header: "Supplier Name", render: (b) => <span className="font-semibold">{b.supplier}</span> },
          { key: "grn", header: "Matched GRN", render: (b) => <CodeChip code={b.grn} /> },
          { key: "date", header: "Bill Date", render: (b) => date(b.date) },
          { key: "amount", header: "Billed Amount", align: "right", className: "font-mono font-bold", render: (b) => inr(b.amount) },
          {
            key: "variance",
            header: "Rate / Qty Variance",
            align: "right",
            className: "font-mono font-bold",
            render: (b) =>
              b.variance > 0 ? (
                <span className="text-destructive flex items-center justify-end gap-1">
                  <AlertTriangle className="size-3.5" /> +{inr(b.variance)}
                </span>
              ) : (
                <span className="text-emerald-600">Zero Variance</span>
              ),
          },
          {
            key: "status",
            header: "3-Way Match Status",
            render: (b) => (
              <StatusBadge
                label={b.matched ? "MATCHED & POSTED" : "VARIANCE DETECTED"}
                tone={b.matched ? "success" : "danger"}
              />
            ),
          },
          {
            key: "actions",
            header: "Action",
            align: "right",
            render: (b) =>
              !b.matched ? (
                <button
                  onClick={() => toggleMatch(b.bill)}
                  className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Approve Variance
                </button>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">Approved</span>
              ),
          },
        ]}
      />
    </div>
  );
}
