import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Lock, History } from "lucide-react";
import { auditLog } from "@/data/tms";
import { date } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";

const title = "System Audit Ledger · Everest Textile Mills";
const description = "Immutable chronological audit log of all sensitive system actions and state changes.";

export const Route = createFileRoute("/app/admin/audit-log")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: AuditLogPage,
});

function AuditLogPage() {
  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Admin", "Audit Log"]}
        title="Immutable System Security Audit Log"
        description="Chronological ledger recording user activities, gate submissions, breakdown logs, and payment allocations."
      />

      <DataTable
        rows={auditLog}
        rowKey={(a, i) => a.time + i}
        emptyMessage="No audit logs recorded."
        columns={[
          { key: "time", header: "Timestamp (IST)", render: (a) => <span className="font-mono text-xs">{date(a.time)}</span> },
          { key: "user", header: "User / Operator", render: (a) => <span className="font-bold">{a.user}</span> },
          { key: "action", header: "Action Performed", render: (a) => <span className="font-semibold text-primary">{a.action}</span> },
          { key: "entity", header: "Entity Ref", render: (a) => <CodeChip code={a.entity} /> },
          { key: "detail", header: "Action Detail", render: (a) => <span className="text-xs text-muted-foreground">{a.detail}</span> },
        ]}
      />
    </div>
  );
}
