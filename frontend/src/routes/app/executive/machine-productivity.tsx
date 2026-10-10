import { createFileRoute } from "@tanstack/react-router";
import { Factory, Wrench, BarChart2 } from "lucide-react";
import { machineProductivity } from "@/data/tms";
import { qty } from "@/lib/tms-format";
import { PageHeader } from "@/components/tms/page-header";
import { DataTable } from "@/components/tms/data-table";
import { CodeChip } from "@/components/tms/code-chip";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const title = "Machine Productivity & Downtime · Everest Textile Mills";
const description = "Analyze loom output meters produced vs machine breakdown hours.";

export const Route = createFileRoute("/app/executive/machine-productivity")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: MachineProductivityPage,
});

function MachineProductivityPage() {
  const mp = machineProductivity;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Executive", "Productivity"]}
        title="Machine Efficiency & Stoppage Analytics"
        description="Compare output meter production against breakdown downtime hours across spinning, weaving, and dyeing machines."
      />

      {/* Chart */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <BarChart2 className="size-5 text-primary" /> Output Meters vs Breakdown Hours
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mp}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="machine" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="output" fill="#059669" name="Output Meters" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="downtimeHrs" fill="#E11D48" name="Downtime (Hrs)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        rows={mp}
        rowKey={(m) => m.machine}
        emptyMessage="No productivity data."
        columns={[
          { key: "machine", header: "Machine Code", render: (m) => <CodeChip code={m.machine} /> },
          { key: "output", header: "Total Output Produced", align: "right", className: "font-mono font-bold text-emerald-600", render: (m) => qty(m.output, "m") },
          { key: "downtime", header: "Downtime Stoppage", align: "right", className: "font-mono font-bold text-rose-600", render: (m) => `${m.downtimeHrs} hrs` },
        ]}
      />
    </div>
  );
}
