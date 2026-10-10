import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/tms/page-header";
import { StatusBadge } from "@/components/tms/status-badge";
import { toast } from "sonner";

const title = "Month-End Period Lock · Everest Textile Mills";
const description = "Reconcile mill accounting ledgers and lock accounting periods to prevent retroactive tampering.";

export const Route = createFileRoute("/app/finance/period-close")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: PeriodClosePage,
});

interface Period {
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "locked";
  reconciled: boolean;
}

const initialPeriods: Period[] = [
  { name: "October 2026", startDate: "2026-10-01", endDate: "2026-10-31", status: "open", reconciled: true },
  { name: "September 2026", startDate: "2026-09-01", endDate: "2026-09-30", status: "locked", reconciled: true },
  { name: "August 2026", startDate: "2026-08-01", endDate: "2026-08-31", status: "locked", reconciled: true },
];

function PeriodClosePage() {
  const [periods, setPeriods] = useState(initialPeriods);

  const lockPeriod = (name: string) => {
    setPeriods((prev) =>
      prev.map((p) => (p.name === name ? { ...p, status: "locked" as const } : p))
    );
    toast.success(`Accounting Period '${name}' locked permanently! Transactions frozen.`);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumb={["App", "Finance", "Period Close"]}
        title="Month-End Accounting Period Lock"
        description="Reconcile financial ledgers and freeze accounting periods (INV-7 invariant protection)."
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-primary border-b pb-4">
          <ShieldCheck className="size-6 text-emerald-600" />
          <div>
            <h2 className="text-lg font-bold">Immutable Period Integrity Rules</h2>
            <p className="text-xs text-muted-foreground">Once locked, no prior invoices, stock movements, or wage entries can be edited.</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mill Accounting Periods</h3>
          <div className="divide-y rounded-xl border bg-background">
            {periods.map((p) => (
              <div key={p.name} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base flex items-center gap-2">
                    {p.name}
                    <StatusBadge
                      label={p.status.toUpperCase()}
                      tone={p.status === "locked" ? "neutral" : "success"}
                    />
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.startDate} to {p.endDate} | Reconciliation Check:{" "}
                    <span className="text-emerald-600 font-semibold">100% Balanced</span>
                  </p>
                </div>
                {p.status === "open" ? (
                  <button
                    onClick={() => lockPeriod(p.name)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold shadow hover:bg-destructive/90"
                  >
                    <Lock className="size-4" /> Lock Period Now
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-muted-foreground">
                    <Lock className="size-3.5 text-muted-foreground" /> Period Locked
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
