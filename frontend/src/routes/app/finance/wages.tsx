import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, CheckCircle2, Clock } from "lucide-react";
import { wageSummary } from "@/data/tms";
import { inr } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "Workforce Wages & Payroll · Everest Textile Mills";
const description = "Monthly employee attendance ledger and gross wage calculations approval.";

export const Route = createFileRoute("/app/finance/wages")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: WagesPayrollPage,
});

function WagesPayrollPage() {
  const [wages, setWages] = useState(wageSummary);

  const approveWage = (worker: string) => {
    setWages((prev) =>
      prev.map((w) => (w.worker === worker ? { ...w, status: "approved" as const } : w))
    );
    toast.success(`Wage record approved for ${worker}`);
  };

  const totalGross = wages.reduce((s, w) => s + w.gross, 0);

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Finance", "Wages & Payroll"]}
        title="Workforce Attendance & Wage Ledger"
        description="Review shop-floor shift attendance records, overtime hours, and approve monthly payroll."
      />

      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Monthly Payroll" value={inr(totalGross)} tone="primary" icon={Users} />
        <MetricCard label="Total Workforce Roster" value={String(wages.length)} tone="info" icon={Users} />
        <MetricCard label="Approved Wages" value={`${wages.filter((w) => w.status === "approved").length} / ${wages.length}`} tone="success" icon={CheckCircle2} />
      </div>

      <DataTable
        rows={wages}
        rowKey={(w) => w.worker}
        emptyMessage="No wage records found."
        columns={[
          { key: "worker", header: "Worker Name", render: (w) => <span className="font-bold">{w.worker}</span> },
          { key: "role", header: "Role & Department", render: (w) => <span className="text-xs text-muted-foreground">{w.role}</span> },
          { key: "days", header: "Days Present", align: "right", className: "font-mono font-semibold", render: (w) => `${w.daysPresent} days` },
          { key: "overtime", header: "Overtime Hours", align: "right", className: "font-mono", render: (w) => `${w.overtimeHrs} hrs` },
          { key: "gross", header: "Gross Wage Payable", align: "right", className: "font-mono font-bold text-primary", render: (w) => inr(w.gross) },
          {
            key: "status",
            header: "Status",
            render: (w) => (
              <StatusBadge
                label={w.status.toUpperCase()}
                tone={w.status === "approved" ? "success" : "warning"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (w) =>
              w.status === "pending" ? (
                <button
                  onClick={() => approveWage(w.worker)}
                  className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Approve Wage
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
