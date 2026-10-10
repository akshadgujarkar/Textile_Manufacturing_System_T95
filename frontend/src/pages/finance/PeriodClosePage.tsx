import React, { useState } from 'react';
import { Lock, Unlock, ShieldAlert, CheckCircle2, DollarSign, Archive } from 'lucide-react';

export const PeriodClosePage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [locking, setLocking] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggleLock = () => {
    setLocking(true);
    setSuccessMsg(null);
    setTimeout(() => {
      setIsLocked(!isLocked);
      setLocking(false);
      setSuccessMsg(
        !isLocked
          ? `Period ${selectedMonth} has been officially locked. Further modifications to vouchers, GRNs, and invoices in this period are frozen.`
          : `Period ${selectedMonth} unlocked for authorized audit adjustments.`
      );
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
          Accounting Period Close & Financial Freeze
        </h1>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Lock monthly general ledgers, finalize inventory valuations (FIFO / Weighted Average), and prevent back-dated journal edits.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm font-semibold">{successMsg}</div>
        </div>
      )}

      {/* Control Card */}
      <div className="m3-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-surface-container-high)]">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase mb-1">
              Select Financial Accounting Period
            </label>
            <select
              className="m3-input font-bold"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="2026-10">October 2026 (Active Period)</option>
              <option value="2026-09">September 2026 (Prior Month)</option>
              <option value="2026-08">August 2026 (Audited)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLocked ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              {isLocked ? '🔒 Period Locked' : '🔓 Period Open'}
            </span>
          </div>
        </div>

        {/* Audit Readiness Checklist */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[var(--color-on-surface)] uppercase tracking-wider">
            Pre-Close Verification Checklist
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-surface-container)] rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-[var(--color-on-surface)]">Raw Yarn Stock Valuation</div>
                <div className="text-[11px] text-[var(--color-on-surface-variant)]">All GRNs matched with supplier bills</div>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container)] rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-[var(--color-on-surface)]">WIP & Greige Fabric Costing</div>
                <div className="text-[11px] text-[var(--color-on-surface-variant)]">Floor shift scrap and power allocated</div>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container)] rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-[var(--color-on-surface)]">GST GSTR-1 vs Sales Ledger</div>
                <div className="text-[11px] text-[var(--color-on-surface-variant)]">Zero variance across 18 tax invoices</div>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container)] rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-[var(--color-on-surface)]">Workforce Wages Reconciled</div>
                <div className="text-[11px] text-[var(--color-on-surface-variant)]">Piece-rate meters matched with loom logs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lock / Unlock Action */}
        <div className="pt-4 border-t border-[var(--color-surface-container-high)] flex justify-end">
          <button
            type="button"
            disabled={locking}
            onClick={handleToggleLock}
            className={`py-3 px-6 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${
              isLocked
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-rose-600 text-white hover:bg-rose-700'
            }`}
          >
            {isLocked ? (
              <>
                <Unlock className="w-4 h-4" />
                {locking ? 'Unlocking...' : 'Unlock Period for Corrections'}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {locking ? 'Freezing...' : 'Lock & Finalize Accounting Month'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
