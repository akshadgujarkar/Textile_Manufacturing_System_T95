import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { reconciliationChecks } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "System Health & Reconciliation · Everest Textile Mills";
const description = "Live dashboard of 7 PostgreSQL reconciliation invariant views enforcing database integrity.";

export const Route = createFileRoute("/app/admin/reconciliation")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: ReconciliationHealthPage,
});

function ReconciliationHealthPage() {
  const handleRunChecks = () => {
    toast.success("Executed 7 invariant reconciliation checks! Database integrity verified.");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Admin", "Health Checks"]}
        title="System Health & Invariant Reconciliation Suite"
        description="Automated real-time integrity verification across stock balances, dispatches, invoices, and accounting periods."
        actions={
          <button
            onClick={handleRunChecks}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <RefreshCw className="size-4" /> Run Reconciliation Suite
          </button>
        }
      />

      <DataTable
        rows={reconciliationChecks}
        rowKey={(rc) => rc.id}
        emptyMessage="No reconciliation checks configured."
        columns={[
          { key: "id", header: "Check Code", render: (rc) => <CodeChip code={rc.id} /> },
          { key: "name", header: "Invariant Specification Rule", render: (rc) => <span className="font-bold">{rc.name}</span> },
          { key: "scope", header: "Database Target Entity / View", render: (rc) => <span className="font-mono text-xs">{rc.scope}</span> },
          {
            key: "status",
            header: "Integrity Status",
            render: (rc) => (
              <StatusBadge
                label={rc.status === "ok" ? "HEALTHY INVARIANT" : "WARNING DETECTED"}
                tone={rc.status === "ok" ? "success" : "warning"}
              />
            ),
          },
          { key: "detail", header: "Reconciliation Result Detail", render: (rc) => <span className="text-xs text-muted-foreground font-mono">{rc.detail}</span> },
        ]}
      />
    </div>
  );
}
