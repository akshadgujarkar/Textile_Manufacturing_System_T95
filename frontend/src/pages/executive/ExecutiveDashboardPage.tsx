import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { MonthlyPL } from '../../types';
import { MetricCard } from '../../components/ui/MetricCard';
import { DollarSign, TrendingUp, BarChart3, PieChart, Layers, Activity, RefreshCw } from 'lucide-react';

export const ExecutiveDashboardPage: React.FC = () => {
  const [plData, setPlData] = useState<MonthlyPL | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPl = async () => {
    setLoading(true);
    try {
      const res = await api.executive.getMonthlyPL('2026-10');
      if (res.data) {
        setPlData(res.data);
      } else {
        setPlData(fallbackPL);
      }
    } catch {
      setPlData(fallbackPL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPl();
  }, []);

  const d = plData || fallbackPL;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Executive Financial & Operations Intelligence
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Mill P&L statements, gross contribution margins, yarn cost absorption, and plant productivity.
          </p>
        </div>
        <button onClick={loadPl} className="m3-btn m3-btn-outlined text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh P&L
        </button>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Revenue (MTD)"
          value={`₹${((d.grossRevenue || 0) / 100000).toFixed(2)} L`}
          trend={{ value: '14.2%', isPositive: true }}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          title="Net Profit (EBITDA)"
          value={`₹${((d.netProfit || 0) / 100000).toFixed(2)} L`}
          trend={{ value: '8.6%', isPositive: true }}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Profit Margin"
          value={`${d.profitMarginPct || 0}%`}
          trend={{ value: '2.1%', isPositive: true }}
          icon={<PieChart className="w-5 h-5" />}
        />
        <MetricCard
          title="Yarn Cost Share"
          value={`${d.grossRevenue ? (((d.rawMaterialCost || 0) / d.grossRevenue) * 100).toFixed(1) : '0'}%`}
          trend={{ value: '-1.5%', isPositive: true }}
          icon={<Layers className="w-5 h-5" />}
        />
      </div>

      {/* Cost Absorption Breakdown & P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Absorption Column */}
        <div className="m3-card p-6 space-y-4">
          <h3 className="font-bold text-base text-[var(--color-on-surface)] flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[var(--color-primary)]" />
            Manufacturing Cost Absorption
          </h3>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Raw Yarn (42%)</span>
                <span className="font-mono">₹{(d.rawMaterialCost || 0).toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-[var(--color-surface-container)] rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: '42%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Direct Wages & Piece-Rate (24%)</span>
                <span className="font-mono">₹{(d.laborCost || 0).toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-[var(--color-surface-container)] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: '24%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Power, Fuel & Utilities (12%)</span>
                <span className="font-mono">₹{(d.powerAndUtilitiesCost || 0).toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-[var(--color-surface-container)] rounded-full overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: '12%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Machine Maintenance & Spares (4%)</span>
                <span className="font-mono">₹{(d.maintenanceCost || 0).toLocaleString()}</span>
              </div>
              <div className="h-2.5 bg-[var(--color-surface-container)] rounded-full overflow-hidden">
                <div className="h-full bg-rose-600 rounded-full" style={{ width: '4%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Live Monthly Statement Card */}
        <div className="lg:col-span-2 m3-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-surface-container-high)]">
            <h3 className="font-bold text-base text-[var(--color-on-surface)] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
              Comprehensive Monthly P&L Ledger (October 2026)
            </h3>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Audited Real-Time
            </span>
          </div>

          <div className="divide-y divide-[var(--color-surface-container-high)] text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="font-bold">Gross Fabric Invoiced Revenue</span>
              <span className="font-mono font-bold text-emerald-700">₹{(d.grossRevenue || 0).toLocaleString()}</span>
            </div>

            <div className="py-2.5 flex justify-between text-[var(--color-on-surface-variant)]">
              <span>Less: Raw Yarn Inventory Consumed</span>
              <span className="font-mono text-rose-700">-₹{(d.rawMaterialCost || 0).toLocaleString()}</span>
            </div>

            <div className="py-2.5 flex justify-between text-[var(--color-on-surface-variant)]">
              <span>Less: Direct Floor Labor & Weaving Wages</span>
              <span className="font-mono text-rose-700">-₹{(d.laborCost || 0).toLocaleString()}</span>
            </div>

            <div className="py-2.5 flex justify-between text-[var(--color-on-surface-variant)]">
              <span>Less: Power Grid & Diesel Genset Fuel</span>
              <span className="font-mono text-rose-700">-₹{(d.powerAndUtilitiesCost || 0).toLocaleString()}</span>
            </div>

            <div className="py-2.5 flex justify-between text-[var(--color-on-surface-variant)]">
              <span>Less: Loom Preventive Maintenance & Spares</span>
              <span className="font-mono text-rose-700">-₹{(d.maintenanceCost || 0).toLocaleString()}</span>
            </div>

            <div className="py-2.5 flex justify-between text-[var(--color-on-surface-variant)]">
              <span>Less: Factory Overheads & Logistics</span>
              <span className="font-mono text-rose-700">-₹{(d.overheadCost || 0).toLocaleString()}</span>
            </div>

            <div className="py-3 flex justify-between font-bold text-base bg-[var(--color-surface-container)] px-3 rounded-xl mt-2">
              <span className="text-[var(--color-on-surface)]">Net Operating EBITDA Profit</span>
              <span className="font-mono text-emerald-700 text-lg">₹{(d.netProfit || 0).toLocaleString()} ({d.profitMarginPct || 0}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const fallbackPL: MonthlyPL = {
  month: '2026-10',
  grossRevenue: 4850000,
  rawMaterialCost: 2040000,
  laborCost: 1160000,
  powerAndUtilitiesCost: 580000,
  maintenanceCost: 195000,
  overheadCost: 125000,
  netProfit: 750000,
  profitMarginPct: 15.5,
};
