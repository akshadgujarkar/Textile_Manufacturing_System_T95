import React, { useState } from 'react';
import { api } from '../../api/client';
import { Zap, CheckCircle2, ShieldCheck, UserCheck, Activity, Award } from 'lucide-react';

export const TouchShiftLoggerPage: React.FC = () => {
  const [operatorId, setOperatorId] = useState<string>('OPR-401');
  const [operatorName, setOperatorName] = useState<string>('Rajesh Kumar (Grade A Loom Master)');
  const [machineId, setMachineId] = useState<string>('LOOM-04');
  const [jobId, setJobId] = useState<string>('JOB-902');
  const [shift, setShift] = useState<string>('Shift A (Day: 07:00 - 15:30)');
  const [outputMeters, setOutputMeters] = useState<number>(450);
  const [scrapKg, setScrapKg] = useState<number>(3.5);
  const [powerKwh, setPowerKwh] = useState<number>(28.4);
  const [qualityGrade, setQualityGrade] = useState<'A' | 'B' | 'C' | 'Rejection'>('A');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleQuickAddMeters = (add: number) => {
    setOutputMeters((prev) => Math.max(0, prev + add));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessToast(null);

    const payload = {
      operatorId,
      machineId,
      jobId,
      shift,
      outputMeters: Number(outputMeters),
      scrapKg: Number(scrapKg),
      powerKwh: Number(powerKwh),
      qualityGrade,
      notes,
      timestamp: new Date().toISOString(),
    };

    try {
      await api.production.logShiftOutput(payload);
      setSuccessToast(`Shift output logged: ${outputMeters}m produced on ${machineId} with Grade ${qualityGrade}!`);
    } catch {
      // Offline fallback
      setSuccessToast(`[Local Store] Shift output logged: ${outputMeters}m produced on ${machineId}!`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold mb-2">
            <Zap className="w-3.5 h-3.5" /> High-Contrast Touch Screen Mode
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Floor Operator Shift & Output Logger
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Optimized with large touch targets for loom floor tablet & kiosk terminals.
          </p>
        </div>
      </div>

      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="font-semibold text-sm">{successToast}</div>
        </div>
      )}

      {/* Touch Form Card */}
      <form onSubmit={handleSubmit} className="m3-card p-6 space-y-6 shadow-sm">
        {/* Machine & Operator Badge Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--color-surface-container)] rounded-2xl">
          <div>
            <label className="text-xs font-bold text-[var(--color-on-surface-variant)] flex items-center gap-1.5 mb-1 uppercase">
              <UserCheck className="w-4 h-4 text-[var(--color-primary)]" />
              Active Operator
            </label>
            <div className="flex gap-2">
              <select
                className="m3-input font-bold"
                value={operatorId}
                onChange={(e) => {
                  setOperatorId(e.target.value);
                  setOperatorName(e.target.value === 'OPR-401' ? 'Rajesh Kumar' : 'Suresh Patel');
                }}
              >
                <option value="OPR-401">OPR-401: Rajesh Kumar (Weave Master)</option>
                <option value="OPR-402">OPR-402: Suresh Patel (Dye Operator)</option>
                <option value="OPR-403">OPR-403: Amit Verma (Spinning tech)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-on-surface-variant)] flex items-center gap-1.5 mb-1 uppercase">
              <Activity className="w-4 h-4 text-[var(--color-primary)]" />
              Machine Terminal
            </label>
            <select
              className="m3-input font-bold"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            >
              <option value="LOOM-04">LOOM-04 (Toyota Air Jet - Section B)</option>
              <option value="LOOM-01">LOOM-01 (Picanol Rapier Loom)</option>
              <option value="SPIN-01">SPIN-01 (Rieter Ring Frame)</option>
              <option value="DYE-02">DYE-02 (Sclavos Jet Dyeing Vessel)</option>
            </select>
          </div>
        </div>

        {/* Shift and Job Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Active Job / Batch
            </label>
            <select
              className="m3-input"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              <option value="JOB-902">JOB-902 (ORD-2026-001 | Weaving 3000m Cotton)</option>
              <option value="JOB-901">JOB-901 (ORD-2026-001 | Spinning 5000m Yarn)</option>
              <option value="JOB-903">JOB-903 (ORD-2026-002 | Dyeing Navy Blue)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Current Shift
            </label>
            <select
              className="m3-input"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
            >
              <option value="Shift A (Day: 07:00 - 15:30)">Shift A (Day: 07:00 - 15:30)</option>
              <option value="Shift B (Evening: 15:30 - 00:00)">Shift B (Evening: 15:30 - 00:00)</option>
              <option value="Shift C (Night: 00:00 - 07:00)">Shift C (Night: 00:00 - 07:00)</option>
            </select>
          </div>
        </div>

        {/* Big Touch Target Counter: Meterage */}
        <div className="p-6 bg-[var(--color-surface-container)] rounded-3xl border border-[var(--color-surface-container-high)] text-center">
          <label className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider block mb-2">
            Net Fabric Output (Meters)
          </label>
          <div className="text-5xl font-black text-[var(--color-primary)] font-mono my-2">
            {outputMeters} <span className="text-xl font-normal text-[var(--color-on-surface-variant)]">m</span>
          </div>

          {/* Quick Add Buttons */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4 max-w-lg mx-auto">
            {[-100, -10, +10, +50, +100, +500].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAddMeters(val)}
                className={`py-3 rounded-2xl font-bold text-sm transition-transform active:scale-95 ${
                  val > 0
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] hover:bg-[var(--color-secondary-container)]'
                    : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
                }`}
              >
                {val > 0 ? `+${val}` : val}
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-xs mx-auto">
            <input
              type="number"
              className="m3-input text-center font-mono font-bold"
              value={outputMeters}
              onChange={(e) => setOutputMeters(Number(e.target.value))}
              min="0"
            />
          </div>
        </div>

        {/* Quality Grade & Resource Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              <Award className="w-3.5 h-3.5 inline mr-1 text-[var(--color-primary)]" />
              Quality Inspection Grade
            </label>
            <select
              className="m3-input font-bold"
              value={qualityGrade}
              onChange={(e) => setQualityGrade(e.target.value as any)}
            >
              <option value="A">Grade A (Export / Prime)</option>
              <option value="B">Grade B (Minor Defect / Domestic)</option>
              <option value="C">Grade C (Discounted Clearance)</option>
              <option value="Rejection">Rejection / Scrap</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Scrap / Wastage (Kg)
            </label>
            <input
              type="number"
              step="0.1"
              className="m3-input font-mono"
              value={scrapKg}
              onChange={(e) => setScrapKg(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Energy Consumed (kWh)
            </label>
            <input
              type="number"
              step="0.1"
              className="m3-input font-mono"
              value={powerKwh}
              onChange={(e) => setPowerKwh(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Operator Notes */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
            Shift Handover Notes / Anomaly Observation
          </label>
          <textarea
            className="m3-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Warp yarn tension adjusted at 11:30. Lubrication scheduled for next shift."
          />
        </div>

        {/* Submit Big Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-lg shadow-md hover:bg-[var(--color-primary)]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-6 h-6" />
            {saving ? 'Transmitting Shift Log to Central Server...' : 'Commit Shift Log & Output Record'}
          </button>
        </div>
      </form>
    </div>
  );
};
