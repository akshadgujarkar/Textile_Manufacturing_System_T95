import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { TrendingUp, RefreshCw, Layers, ShoppingBag, DollarSign, Award, Activity, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ReportsView() {
  const [activeReport, setActiveReport] = useState('inventory');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async (reportType) => {
    setLoading(true);
    setData(null);
    try {
      let res;
      switch (reportType) {
        case 'inventory':
          res = await api.getInventorySummaryReport();
          setData(res.data || []);
          break;
        case 'reorder':
          res = await api.getReorderAlertsReport();
          setData(res.data || []);
          break;
        case 'order-progress':
          res = await api.getOrderProgressReport();
          setData(res.data || []);
          break;
        case 'production-output':
          res = await api.getProductionOutputReport();
          setData(res.data || []);
          break;
        case 'roll-quality':
          res = await api.getRollQualityReport();
          setData(res.data || []);
          break;
        case 'invoice-outstanding':
          res = await api.getInvoiceOutstandingReport();
          setData(res.data || []);
          break;
        case 'cost-by-order':
          res = await api.getCostByOrderReport();
          setData(res.data || []);
          break;
        case 'cost-by-machine':
          res = await api.getCostByMachineReport();
          setData(res.data || []);
          break;
        case 'wage-summary':
          res = await api.getWageSummaryReport();
          setData(res.data || []);
          break;
        case 'reconciliation':
          res = await api.getReconciliationReport();
          setData(res.data || null);
          break;
        default:
          setData([]);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Operational Intelligence & System Auditing
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Real-time analytics across stock valuation, machine productivity, ASTM QC grades, and financial ledger invariants.
          </p>
        </div>

        <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => fetchReport(activeReport)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex gap-2 flex-wrap pb-2 border-b border-[var(--md-sys-color-outline-variant)]">
        <button
          className={`md-btn md-btn-sm ${activeReport === 'inventory' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('inventory')}
        >
          <Layers size={14} /> Inventory Valuation
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'reorder' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('reorder')}
        >
          <AlertTriangle size={14} /> Reorder Alerts
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'order-progress' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('order-progress')}
        >
          <ShoppingBag size={14} /> Sales Order Progress
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'production-output' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('production-output')}
        >
          <Activity size={14} /> Production by Stage
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'roll-quality' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('roll-quality')}
        >
          <Award size={14} /> Roll QC Grading
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'invoice-outstanding' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('invoice-outstanding')}
        >
          <DollarSign size={14} /> AR Aging & Unpaid
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'cost-by-order' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('cost-by-order')}
        >
          <TrendingUp size={14} /> Cost by Order
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'cost-by-machine' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('cost-by-machine')}
        >
          <Activity size={14} /> Cost by Machine
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'wage-summary' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveReport('wage-summary')}
        >
          <DollarSign size={14} /> Monthly Wage Summary
        </button>
        <button
          className={`md-btn md-btn-sm ${activeReport === 'reconciliation' ? 'md-btn-primary' : 'md-btn-tonal'} font-bold`}
          onClick={() => setActiveReport('reconciliation')}
        >
          <ShieldCheck size={14} /> System Invariants & Reconciliation
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="md-card p-12 text-center text-[var(--md-sys-color-on-surface-variant)]">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-[var(--md-sys-color-primary)]" />
          <p className="text-sm font-medium">Executing multi-table analytical query across MySQL views...</p>
        </div>
      )}

      {/* Special Reconciliation Report Tab */}
      {!loading && activeReport === 'reconciliation' && data && (
        <div className="space-y-6">
          {/* Section 1: Yarn Stock Invariant Integrity */}
          <div className="md-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                1. Yarn Stock Invariant: Allocated + Available = Current Stock
              </h2>
              <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">
                Audited at: {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                    <th className="p-3 uppercase font-semibold">Stock ID</th>
                    <th className="p-3 uppercase font-semibold">Yarn Code / Type</th>
                    <th className="p-3 uppercase font-semibold">Warehouse</th>
                    <th className="p-3 uppercase font-semibold">Current Stock (kg)</th>
                    <th className="p-3 uppercase font-semibold">Allocated (kg)</th>
                    <th className="p-3 uppercase font-semibold">Available (kg)</th>
                    <th className="p-3 uppercase font-semibold">Delta</th>
                    <th className="p-3 uppercase font-semibold">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {(!data.yarn_stock_invariants || data.yarn_stock_invariants.length === 0) ? (
                    <tr><td colSpan={8} className="p-4 text-center">No yarn stock records</td></tr>
                  ) : (
                    data.yarn_stock_invariants.map((y) => (
                      <tr key={y.stock_id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold">{y.stock_id}</td>
                        <td className="p-3 font-semibold">{y.yarn_code} ({y.yarn_type})</td>
                        <td className="p-3">{y.warehouse_code}</td>
                        <td className="p-3 font-mono font-bold">{parseFloat(y.current_stock_kg).toFixed(2)}</td>
                        <td className="p-3 font-mono">{parseFloat(y.allocated_quantity).toFixed(2)}</td>
                        <td className="p-3 font-mono">{parseFloat(y.available_quantity).toFixed(2)}</td>
                        <td className="p-3 font-mono">{parseFloat(y.delta).toFixed(4)}</td>
                        <td className="p-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            y.integrity_status === 'BALANCED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {y.integrity_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Financial Integrity */}
          <div className="md-card p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              2. Financial Ledger: Invoiced vs Collections vs Outstanding Balances
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                    <th className="p-3 uppercase font-semibold">Invoice No</th>
                    <th className="p-3 uppercase font-semibold">Buyer</th>
                    <th className="p-3 uppercase font-semibold">Status</th>
                    <th className="p-3 uppercase font-semibold">Total Invoiced</th>
                    <th className="p-3 uppercase font-semibold">Collected Amount</th>
                    <th className="p-3 uppercase font-semibold">Remaining Balance</th>
                    <th className="p-3 uppercase font-semibold">Payment Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {(!data.financial_reconciliation || data.financial_reconciliation.length === 0) ? (
                    <tr><td colSpan={7} className="p-4 text-center">No invoices recorded</td></tr>
                  ) : (
                    data.financial_reconciliation.map((f) => (
                      <tr key={f.invoice_id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-[var(--md-sys-color-primary)]">{f.invoice_no}</td>
                        <td className="p-3 font-semibold">{f.buyer_name}</td>
                        <td className="p-3 uppercase font-mono">{f.status}</td>
                        <td className="p-3 font-mono font-bold">₹{parseFloat(f.total_amount).toFixed(2)}</td>
                        <td className="p-3 font-mono text-emerald-700 font-bold">₹{parseFloat(f.total_collected).toFixed(2)}</td>
                        <td className="p-3 font-mono text-rose-700 font-bold">₹{parseFloat(f.remaining_balance).toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            f.payment_health === 'FULLY_PAID' ? 'bg-emerald-100 text-emerald-800' :
                            f.payment_health === 'PARTIAL_PAID' ? 'bg-amber-100 text-amber-800' :
                            f.payment_health === 'VOIDED' ? 'bg-slate-100 text-slate-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {f.payment_health}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Standard Tabular Report Output */}
      {!loading && activeReport !== 'reconciliation' && (
        <div className="md-card overflow-hidden">
          {!data || data.length === 0 ? (
            <div className="p-12 text-center text-[var(--md-sys-color-on-surface-variant)]">
              No records returned for this analytical report.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                    {Object.keys(data[0]).map((col) => (
                      <th key={col} className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} className="p-4">
                          {typeof val === 'number' || (!isNaN(val) && val !== null && val !== '') ? (
                            String(val).includes('.') ? parseFloat(val).toFixed(2) : val
                          ) : val ? (
                            String(val)
                          ) : (
                            '—'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
