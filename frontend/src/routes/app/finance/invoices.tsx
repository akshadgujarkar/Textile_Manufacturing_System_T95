import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Plus, Printer, CheckCircle2, DollarSign } from "lucide-react";
import { invoices } from "@/data/tms";
import { inr, date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Sales Invoices · Everest Textile Mills";
const description = "Customer billing generated from verified dispatches, PDF printing, and aging balances.";

export const Route = createFileRoute("/app/finance/invoices")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: SalesInvoicesPage,
});

function SalesInvoicesPage() {
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paid, 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Finance", "Invoices"]}
        title="Sales Invoices & Receivables"
        description="View generated customer invoices, outstanding balances, and print PDF bills."
        actions={
          <button
            onClick={() => toast.success("New invoice generation dialog opened.")}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create Invoice
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Invoiced Value" value={inr(totalInvoiced)} tone="primary" icon={FileText} />
        <MetricCard label="Total Payments Collected" value={inr(totalPaid)} tone="success" icon={CheckCircle2} />
        <MetricCard label="Outstanding Balance" value={inr(totalOutstanding)} tone={totalOutstanding ? "warning" : "success"} icon={DollarSign} />
      </div>

      <DataTable
        rows={invoices}
        rowKey={(i) => i.no}
        emptyMessage="No sales invoices found."
        columns={[
          { key: "no", header: "Invoice #", render: (i) => <CodeChip code={i.no} /> },
          { key: "buyer", header: "Buyer", render: (i) => <span className="font-semibold">{i.buyer}</span> },
          { key: "date", header: "Invoice Date", render: (i) => date(i.date) },
          { key: "dispatch", header: "Dispatch #", render: (i) => <CodeChip code={i.dispatch} /> },
          { key: "total", header: "Total Amount", align: "right", className: "font-mono font-bold", render: (i) => inr(i.total) },
          { key: "paid", header: "Amount Paid", align: "right", className: "font-mono text-emerald-600", render: (i) => inr(i.paid) },
          { key: "balance", header: "Outstanding Balance", align: "right", className: "font-mono font-bold text-amber-600", render: (i) => inr(i.total - i.paid) },
          {
            key: "status",
            header: "Status",
            render: (i) => {
              const bal = i.total - i.paid;
              return (
                <StatusBadge
                  label={bal === 0 ? "PAID FULL" : i.paid > 0 ? "PARTIAL" : "UNPAID"}
                  tone={bal === 0 ? "success" : i.paid > 0 ? "warning" : "danger"}
                />
              );
            },
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (i) => (
              <button
                onClick={() => {
                  toast.success(`Printing Tax Invoice ${i.no}`);
                  window.print();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border bg-card hover:bg-accent rounded"
              >
                <Printer className="size-3.5" /> PDF
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
