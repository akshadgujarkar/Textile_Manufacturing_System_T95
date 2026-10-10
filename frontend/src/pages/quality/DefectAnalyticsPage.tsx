import React, { useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Award, PieChart } from 'lucide-react';

export const DefectAnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('month');

  const defectPareto = [
    { defect: 'Minor Slubs / Thick Ends', count: 142, percentage: 38.5, penaltyPoints: 284, rootCause: 'Raw yarn flyer variation' },
    { defect: 'Oil & Grease Spots', count: 86, percentage: 23.3, penaltyPoints: 172, rootCause: 'Over-lubricated loom cam box' },
    { defect: 'Broken Warp Picks', count: 54, percentage: 14.6, penaltyPoints: 162, rootCause: 'Warp tension sensor spike' },
    { defect: 'Selvedge Fraying', count: 42, percentage: 11.4, penaltyPoints: 84, rootCause: 'Cutter blade dullness' },
    { defect: 'Color Shading (Delta E)', count: 28, percentage: 7.6, penaltyPoints: 84, rootCause: 'Dye vat temperature fluctuation' },
    { defect: 'Reed Marks / Gaps', count: 17, percentage: 4.6, penaltyPoints: 51, rootCause: 'Reed dent wear' },
  ];

  const totalDefects = defectPareto.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Quality Defect Pareto & Root-Cause Analytics
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Statistical analysis of 4-point ASTM penalties across loom sheds, operators, and yarn batches.
          </p>
        </div>

        <div className="flex gap-2">
          {['week', 'month', 'quarter'].map((t) => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                timeRange === t
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]'
              }`}
            >
              This {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">First-Pass Yield</div>
          <div className="text-3xl font-black text-emerald-700 mt-1">94.8%</div>
          <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> +1.2% vs last month
          </div>
        </div>

        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Avg 4-Point Score</div>
          <div className="text-3xl font-black text-[var(--color-primary)] mt-1">6.4 <span className="text-sm font-normal text-[var(--color-on-surface-variant)]">pts/100yd</span></div>
          <div className="text-xs text-purple-600 mt-1 font-semibold">Grade A Benchmark &lt; 10 pts</div>
        </div>

        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Total Logged Faults</div>
          <div className="text-3xl font-black text-[var(--color-on-surface)] mt-1">{totalDefects}</div>
          <div className="text-xs text-[var(--color-on-surface-variant)] mt-1">Across 1,240 fabric rolls</div>
        </div>

        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Estimated Defect Loss</div>
          <div className="text-3xl font-black text-rose-700 mt-1">₹42,800</div>
          <div className="text-xs text-rose-600 mt-1 font-semibold">0.42% of gross fabric revenue</div>
        </div>
      </div>

      {/* Defect Pareto Chart & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 m3-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-[var(--color-on-surface)] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
              Pareto 80/20 Defect Breakdown
            </h3>
            <span className="text-xs text-[var(--color-on-surface-variant)] font-bold">
              Cumulative Top 3 = 76.4%
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {defectPareto.map((item) => (
              <div key={item.defect} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--color-on-surface)]">{item.defect}</span>
                  <span className="font-mono text-[var(--color-on-surface-variant)]">
                    {item.count} occurrences ({item.percentage}%)
                  </span>
                </div>
                <div className="h-3 bg-[var(--color-surface-container)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage * 2.5}%` }}
                  />
                </div>
                <div className="text-[11px] text-[var(--color-on-surface-variant)] italic">
                  Root Cause: {item.rootCause}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Action Directives */}
        <div className="m3-card p-6 space-y-4">
          <h3 className="font-bold text-lg text-[var(--color-on-surface)] flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            Quality Action Items
          </h3>

          <div className="space-y-3">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <div className="text-xs font-bold text-amber-900 mb-1">Loom Oil Seals Service</div>
              <p className="text-xs text-amber-800">
                Loom Shed B accounts for 72% of oil spots. Schedule cam box gasket replacements on LOOM-03 and LOOM-04.
              </p>
            </div>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
              <div className="text-xs font-bold text-purple-900 mb-1">Yarn Flyer Tension Audit</div>
              <p className="text-xs text-purple-800">
                Supplier Vardhman lot #LOT-COT-2026-08 had 12% higher slub count. Lab supplier feedback initiated.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="text-xs font-bold text-emerald-900 mb-1">Operator Excellence Reward</div>
              <p className="text-xs text-emerald-800">
                Shift A achieved zero broken picks across 450 meters woven today.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
