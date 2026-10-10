import { goodsReceipts } from "@/data/tms";
import { inr, istDate, qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";

type Receipt = (typeof goodsReceipts)[number];

export function ReceiptsPage() {
  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Raw Materials", "Receipts"]}
        title="Goods Receipt Archive"
        description="Every gate inward receipt, newest first."
      />
      <DataTable<Receipt>
        rows={goodsReceipts}
        rowKey={(r) => r.grn}
        columns={[
          { key: "grn", header: "GRN", render: (r) => <CodeChip code={r.grn} /> },
          { key: "supplier", header: "Supplier", render: (r) => <span className="font-medium">{r.supplier}</span> },
          { key: "challan", header: "Challan", className: "font-mono text-xs", render: (r) => r.challan },
          { key: "truck", header: "Vehicle", className: "font-mono text-xs", render: (r) => r.truck },
          { key: "date", header: "Received", render: (r) => istDate(r.date, true) },
          { key: "lots", header: "Lots", align: "right", className: "font-mono", render: (r) => r.lots },
          { key: "weight", header: "Net Weight", align: "right", className: "font-mono", render: (r) => qty(r.weight, "kg") },
          { key: "value", header: "Gate Value", align: "right", className: "font-mono", render: (r) => inr(r.value) },
        ]}
      />
    </div>
  );
}
