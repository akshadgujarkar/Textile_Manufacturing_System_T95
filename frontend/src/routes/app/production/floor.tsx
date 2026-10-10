import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Factory, AlertOctagon, Clock, Wrench, PlayCircle, PlusCircle, Layers } from "lucide-react";
import { machines, type Machine } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";

const title = "Live Floor Command Matrix · Everest Textile Mills";
const description = "Real-time visual floor matrix across Spinning, Weaving, and Dyeing stages.";

export function FloorMatrixPage() {
  const [activeStage, setActiveStage] = useState<string>("All");

  const filteredMachines = useMemo(() => {
    if (activeStage === "All") return machines;
    return machines.filter((m) => m.stage === activeStage);
  }, [activeStage]);

  const runningCount = machines.filter((m) => m.status === "running").length;
  const idleCount = machines.filter((m) => m.status === "idle").length;
  const breakdownCount = machines.filter((m) => m.status === "breakdown").length;
  const maintenanceCount = machines.filter((m) => m.status === "maintenance").length;

  const totalShiftMeters = machines.reduce((acc, m) => acc + (m.todayOutput || 0), 0);

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Production", "Live Floor Command Matrix"]}
        title="Live Production Floor Matrix"
        description="Monitor real-time status of all factory looms, ring frames, and dyeing jets."
        actions={
          <div className="flex gap-2">
            <Link
              to="/app/production/log-output"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <PlusCircle className="size-4" /> Touch Shift Logger
            </Link>
            <Link
              to="/app/production/downtime"
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent"
            >
              <Wrench className="size-4" /> Log Breakdown
            </Link>
          </div>
        }
      />

      {/* KPI Metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Running Machines" value={String(runningCount)} tone="success" icon={PlayCircle} />
        <MetricCard label="Idle Machines" value={String(idleCount)} tone="neutral" icon={Clock} />
        <MetricCard label="In Breakdown" value={String(breakdownCount)} tone="danger" icon={AlertOctagon} />
        <MetricCard label="Maintenance" value={String(maintenanceCount)} tone="warning" icon={Wrench} />
        <MetricCard label="Shift Output Today" value={qty(totalShiftMeters, "m")} tone="info" icon={Factory} />
      </div>

      {/* Stage Filter Tabs */}
      <div className="mb-6 flex border-b">
        {["All", "Spinning", "Weaving", "Dyeing"].map((stage) => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeStage === stage
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {stage === "All" ? "All Factory Machines" : `${stage} Stage`}
          </button>
        ))}
      </div>

      {/* 3-Column Responsive Machine Card Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMachines.map((m) => {
          const pct = m.planned ? Math.round(((m.produced || 0) / m.planned) * 100) : 0;
          return (
            <div
              key={m.code}
              className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">{m.name}</h3>
                      <CodeChip code={m.code} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.stage} Stage</p>
                  </div>
                  <StatusBadge
                    label={m.status.toUpperCase()}
                    tone={
                      m.status === "running"
                        ? "success"
                        : m.status === "breakdown"
                        ? "danger"
                        : m.status === "maintenance"
                        ? "warning"
                        : "neutral"
                    }
                  />
                </div>

                {/* State Info */}
                <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>
                    Status duration: <strong>{m.stateDuration}</strong>
                  </span>
                  {m.stateNote && (
                    <span className="text-destructive font-medium ml-1">({m.stateNote})</span>
                  )}
                </div>

                {/* Active Job Content */}
                {m.jobNo ? (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">{m.buyer}</span>
                      <CodeChip code={m.jobNo} />
                    </div>
                    <p className="text-xs text-foreground font-medium">{m.product}</p>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1">
                        <span>{qty(m.produced || 0, "m")} produced</span>
                        <span>{pct}% of {qty(m.planned || 0, "m")}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span>Shift: <strong>{m.shift}</strong></span>
                      <span>Operator: <strong>{m.operator}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground mb-4">
                    No active job allocated to this machine.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Link
                  to="/app/production/log-output"
                  className="flex-1 text-center py-1.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                >
                  Log Shift Output
                </Link>
                <Link
                  to="/app/production/downtime"
                  className="flex-1 text-center py-1.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                >
                  Flag Downtime
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
