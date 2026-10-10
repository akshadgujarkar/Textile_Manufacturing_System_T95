import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Pause, Plus, Factory, CheckCircle2 } from "lucide-react";
import { machines, orders } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { StatusBadge } from "@/components/tms/status-badge";
import { CodeChip } from "@/components/tms/code-chip";
import { toast } from "sonner";

const title = "Job Scheduler · Everest Textile Mills";
const description = "Assign order lines to looms and machines, start or pause production jobs.";

export const Route = createFileRoute("/app/production/jobs")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: JobSchedulerPage,
});

interface Job {
  jobNo: string;
  orderNo: string;
  buyer: string;
  machineCode: string;
  product: string;
  planned: number;
  produced: number;
  status: "running" | "paused" | "completed";
}

const initialJobs: Job[] = [
  { jobNo: "JOB-26-000104", orderNo: "ORD-26-000042", buyer: "Apex Garments Ltd", machineCode: "MCH-SPIN-01", product: "Cotton 30s Combed", planned: 2400, produced: 1650, status: "running" },
  { jobNo: "JOB-26-000105", orderNo: "ORD-26-000045", buyer: "Metro Fashions", machineCode: "MCH-SPIN-02", product: "PC Blend 52/48", planned: 1800, produced: 980, status: "running" },
  { jobNo: "JOB-26-000098", orderNo: "ORD-26-000042", buyer: "Apex Garments Ltd", machineCode: "MCH-WEAV-01", product: "Poplin Shirting 58\"", planned: 5000, produced: 3420, status: "running" },
  { jobNo: "JOB-26-000099", orderNo: "ORD-26-000043", buyer: "Sunrise Exports", machineCode: "MCH-WEAV-02", product: "Twill Suiting 60\"", planned: 3000, produced: 1210, status: "paused" },
  { jobNo: "JOB-26-000101", orderNo: "ORD-26-000044", buyer: "Kaveri Textiles", machineCode: "MCH-WEAV-03", product: "Voile Dupatta 44\"", planned: 1200, produced: 760, status: "running" },
];

function JobSchedulerPage() {
  const [jobsList, setJobsList] = useState<Job[]>(initialJobs);

  const toggleStatus = (jobNo: string) => {
    setJobsList((prev) =>
      prev.map((j) => {
        if (j.jobNo === jobNo) {
          const next = j.status === "running" ? "paused" : "running";
          toast.info(`Job ${jobNo} status changed to ${next.toUpperCase()}`);
          return { ...j, status: next };
        }
        return j;
      })
    );
  };

  return (
    <div>
      <PageHeader
        breadcrumb={["App", "Production", "Job Scheduler"]}
        title="Production Job Scheduler"
        description="Schedule order execution across spinning ring frames, looms, and dyeing jets."
        actions={
          <button
            onClick={() => toast.success("New Job Dispatch modal opened.")}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Schedule New Job
          </button>
        }
      />

      <DataTable<Job>
        rows={jobsList}
        rowKey={(j) => j.jobNo}
        emptyMessage="No active production jobs scheduled."
        columns={[
          { key: "jobNo", header: "Job No", render: (j) => <CodeChip code={j.jobNo} /> },
          { key: "orderNo", header: "Order #", render: (j) => <CodeChip code={j.orderNo} /> },
          { key: "buyer", header: "Buyer", render: (j) => <span className="font-semibold">{j.buyer}</span> },
          { key: "machine", header: "Machine", render: (j) => <span className="font-mono text-xs">{j.machineCode}</span> },
          { key: "product", header: "Fabric Product", render: (j) => j.product },
          { key: "planned", header: "Planned Qty", align: "right", className: "font-mono", render: (j) => qty(j.planned, "m") },
          { key: "produced", header: "Produced Qty", align: "right", className: "font-mono font-medium text-indigo-600", render: (j) => qty(j.produced, "m") },
          {
            key: "status",
            header: "Status",
            render: (j) => (
              <StatusBadge
                label={j.status.toUpperCase()}
                tone={j.status === "running" ? "success" : j.status === "completed" ? "info" : "warning"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (j) => (
              <button
                onClick={() => toggleStatus(j.jobNo)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border ${
                  j.status === "running"
                    ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                }`}
              >
                {j.status === "running" ? <Pause className="size-3" /> : <Play className="size-3" />}
                {j.status === "running" ? "Pause Job" : "Start Job"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
