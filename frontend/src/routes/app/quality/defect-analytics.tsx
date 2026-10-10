import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, BarChart3, TrendingDown, ShieldAlert } from "lucide-react";
import { defectAnalytics } from "@/data/tms";
import { PageHeader } from "@/components/tms/page-header";
import { MetricCard } from "@/components/tms/metric-card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const title = "QC Defect Analytics · Everest Textile Mills";
const description = "Root-cause analytics: machine-wise, operator-wise, and defect type aggregations.";

export const Route = createFileRoute("/app/quality/defect-analytics")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: DefectAnalyticsPage,
});

function DefectAnalyticsPage() {
  const d = defectAnalytics;
  const totalDefects = d.byType.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["App", "Quality", "Defect Analytics"]}
        title="Quality Defect & Root Cause Analytics"
        description="Identify quality bottlenecks by analyzing defect distribution across machines and machine operators."
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Defect Incidents" value={String(totalDefects)} tone="danger" icon={ShieldAlert} />
        <MetricCard label="Top Defect Cause" value="Bad Weaving (11)" tone="warning" icon={AlertCircle} />
        <MetricCard label="Highest Defect Machine" value="MCH-WEAV-02 (14)" tone="neutral" icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Machine-Wise Defects Chart */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Defect Distribution by Machine
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byMachine}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="machine" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="defects" fill="#E11D48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operator-Wise Defects Chart */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <TrendingDown className="size-4 text-primary" /> Defect Distribution by Operator
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byOperator}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="operator" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="defects" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Defect Type Aggregation Table */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold">Defect Classification & Frequency</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                <th className="p-3">Defect Category</th>
                <th className="p-3 text-right">Incidents Count</th>
                <th className="p-3 text-right">Share of Total (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.byType.map((dt) => {
                const pct = Math.round((dt.count / totalDefects) * 100);
                return (
                  <tr key={dt.type}>
                    <td className="p-3 font-semibold">{dt.type}</td>
                    <td className="p-3 text-right font-mono font-bold text-destructive">{dt.count}</td>
                    <td className="p-3 text-right font-mono">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
