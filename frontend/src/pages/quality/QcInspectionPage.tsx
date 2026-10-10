import React, { useState } from 'react';
import { api } from '../../api/client';
import { FabricRoll } from '../../types';
import { ZplThermalLabelModal } from '../../components/ui/ZplThermalLabelModal';
import { QrCode, Sparkles, CheckCircle2, Tag, ShieldCheck, Printer } from 'lucide-react';

export const QcInspectionPage: React.FC = () => {
  const [rollId, setRollId] = useState<string>('ROLL-2026-901');
  const [jobId, setJobId] = useState<string>('JOB-902');
  const [lotNumber, setLotNumber] = useState<string>('LOT-COT-2026-08');
  const [lengthMeters, setLengthMeters] = useState<number>(120);
  const [weightKg, setWeightKg] = useState<number>(24.5);
  const [gsm, setGsm] = useState<number>(185);
  const [widthInches, setWidthInches] = useState<number>(58);
  const [inspectorName, setInspectorName] = useState<string>('Neha Sharma (QC Lead)');
  const [shelfLocation, setShelfLocation] = useState<string>('RACK-B-04');

  // Defect Scoring (ASTM D5430 4-Point System)
  const [points1, setPoints1] = useState<number>(2); // 1-point defects (minor slubs)
  const [points2, setPoints2] = useState<number>(1); // 2-point defects (oil spots)
  const [points3, setPoints3] = useState<number>(0); // 3-point defects (broken ends)
  const [points4, setPoints4] = useState<number>(0); // 4-point defects (holes)

  const [selectedDefects, setSelectedDefects] = useState<string[]>(['Minor Slub', 'Oil Spot']);
  const [saving, setSaving] = useState<boolean>(false);
  const [inspectedRoll, setInspectedRoll] = useState<FabricRoll | null>(null);
  const [showZplModal, setShowZplModal] = useState<boolean>(false);

  const availableDefects = [
    'Minor Slub',
    'Warp Streak',
    'Oil Spot',
    'Broken Pick',
    'Reed Mark',
    'Color Shading (Delta E)',
    'Hole / Tear',
    'Selvedge Defect',
  ];

  const totalPenaltyPoints = points1 * 1 + points2 * 2 + points3 * 3 + points4 * 4;
  const pointsPer100SqYards = lengthMeters > 0
    ? Number(((totalPenaltyPoints * 3600) / (lengthMeters * 1.0936 * widthInches)).toFixed(1))
    : 0;

  // Auto-Grade calculation
  let calculatedGrade: 'A' | 'B' | 'C' | 'Rejection' = 'A';
  if (pointsPer100SqYards > 28) calculatedGrade = 'Rejection';
  else if (pointsPer100SqYards > 18) calculatedGrade = 'C';
  else if (pointsPer100SqYards > 10) calculatedGrade = 'B';
  else calculatedGrade = 'A';

  const toggleDefect = (defect: string) => {
    setSelectedDefects((prev) =>
      prev.includes(defect) ? prev.filter((d) => d !== defect) : [...prev, defect]
    );
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const rollData: FabricRoll = {
      id: rollId,
      rollBarcode: `BC-${rollId}`,
      jobId,
      lotNumber,
      grade: calculatedGrade,
      lengthMeters: Number(lengthMeters),
      weightKg: Number(weightKg),
      gsm: Number(gsm),
      widthInches: Number(widthInches),
      defectPoints: totalPenaltyPoints,
      defectsList: selectedDefects,
      inspectedBy: inspectorName,
      inspectionDate: new Date().toISOString(),
      shelfLocation,
      status: calculatedGrade === 'Rejection' ? 'Damaged' : 'In Stock',
    };

    try {
      await api.quality.submitInspection(rollData);
      setInspectedRoll(rollData);
    } catch {
      setInspectedRoll(rollData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Fabric Roll QC Inspection & 4-Point Grading
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Record physical parameters, defect penalties, auto-classify grades, and issue roll barcodes.
          </p>
        </div>
      </div>

      {/* Success Banner if Inspected */}
      {inspectedRoll && (
        <div className="p-6 m3-card bg-emerald-50 border-emerald-300 text-emerald-900 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl">
                {inspectedRoll.grade}
              </div>
              <div>
                <h3 className="font-bold text-lg text-emerald-950">
                  Inspection Approved & Stocked: {inspectedRoll.id}
                </h3>
                <p className="text-xs text-emerald-800">
                  Total Penalty: {inspectedRoll.defectPoints} pts ({pointsPer100SqYards} pts / 100 sq. yd) | Location: {inspectedRoll.shelfLocation}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowZplModal(true)}
                className="m3-btn m3-btn-primary text-sm bg-emerald-800 hover:bg-emerald-900 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Roll Barcode (ZPL)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Entry Form */}
      <form onSubmit={handleInspectSubmit} className="m3-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-container-high)]">
          <div className="flex items-center gap-2 font-bold text-[var(--color-on-surface)]">
            <QrCode className="w-5 h-5 text-[var(--color-primary)]" />
            Roll Identification & Source Job
          </div>
          <button
            type="button"
            onClick={() => setRollId(`ROLL-2026-${Math.floor(100 + Math.random() * 900)}`)}
            className="text-xs text-[var(--color-primary)] font-bold hover:underline"
          >
            Generate New ID
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Roll Barcode ID
            </label>
            <input
              type="text"
              className="m3-input font-mono font-bold"
              value={rollId}
              onChange={(e) => setRollId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Source Production Job
            </label>
            <input
              type="text"
              className="m3-input font-mono"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Origin Yarn Lot Number
            </label>
            <input
              type="text"
              className="m3-input font-mono"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Physical Specs */}
        <div className="p-4 bg-[var(--color-surface-container)] rounded-2xl space-y-3">
          <div className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
            Physical Dimensions & Lab Metrics
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-on-surface-variant)] mb-1">
                Net Length (Meters)
              </label>
              <input
                type="number"
                step="0.5"
                className="m3-input font-mono font-bold"
                value={lengthMeters}
                onChange={(e) => setLengthMeters(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-on-surface-variant)] mb-1">
                Weight (Kg)
              </label>
              <input
                type="number"
                step="0.1"
                className="m3-input font-mono"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-on-surface-variant)] mb-1">
                Measured GSM
              </label>
              <input
                type="number"
                className="m3-input font-mono"
                value={gsm}
                onChange={(e) => setGsm(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-on-surface-variant)] mb-1">
                Usable Width (Inches)
              </label>
              <input
                type="number"
                className="m3-input font-mono"
                value={widthInches}
                onChange={(e) => setWidthInches(Number(e.target.value))}
                required
              />
            </div>
          </div>
        </div>

        {/* 4-Point System Defect Counter */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              ASTM D5430 4-Point Defect Penalty Breakdown
            </div>
            <div className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)]">
              Total Score: {pointsPer100SqYards} pts / 100 sq. yd
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[var(--color-surface-container-low)] rounded-2xl text-center">
              <div className="text-xs text-[var(--color-on-surface-variant)] font-bold">1 Point (&lt;3 in)</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPoints1((p) => Math.max(0, p - 1))}
                  className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-800 font-bold"
                >
                  -
                </button>
                <span className="font-mono font-bold text-lg">{points1}</span>
                <button
                  type="button"
                  onClick={() => setPoints1((p) => p + 1)}
                  className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container-low)] rounded-2xl text-center">
              <div className="text-xs text-[var(--color-on-surface-variant)] font-bold">2 Points (3-6 in)</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPoints2((p) => Math.max(0, p - 1))}
                  className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-800 font-bold"
                >
                  -
                </button>
                <span className="font-mono font-bold text-lg">{points2}</span>
                <button
                  type="button"
                  onClick={() => setPoints2((p) => p + 1)}
                  className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container-low)] rounded-2xl text-center">
              <div className="text-xs text-[var(--color-on-surface-variant)] font-bold">3 Points (6-9 in)</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPoints3((p) => Math.max(0, p - 1))}
                  className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-800 font-bold"
                >
                  -
                </button>
                <span className="font-mono font-bold text-lg">{points3}</span>
                <button
                  type="button"
                  onClick={() => setPoints3((p) => p + 1)}
                  className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-3 bg-[var(--color-surface-container-low)] rounded-2xl text-center">
              <div className="text-xs text-[var(--color-on-surface-variant)] font-bold">4 Points (&gt;9 in / Hole)</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPoints4((p) => Math.max(0, p - 1))}
                  className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-800 font-bold"
                >
                  -
                </button>
                <span className="font-mono font-bold text-lg">{points4}</span>
                <button
                  type="button"
                  onClick={() => setPoints4((p) => p + 1)}
                  className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Defect Tags Multi-Select */}
        <div>
          <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-2 uppercase flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Observed Defect Classifications (Click to Tag)
          </label>
          <div className="flex flex-wrap gap-2">
            {availableDefects.map((d) => {
              const isSelected = selectedDefects.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDefect(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)]'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade Auto-Evaluation Card */}
        <div className="p-4 rounded-2xl border flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
          <div>
            <div className="text-xs font-bold text-purple-900 uppercase">Calculated Commercial Quality Grade</div>
            <div className="text-2xl font-black text-[var(--color-primary)]">
              Grade {calculatedGrade} —{' '}
              {calculatedGrade === 'A'
                ? 'Export Prime (&lt;10 pts)'
                : calculatedGrade === 'B'
                ? 'Domestic Standard (11-18 pts)'
                : calculatedGrade === 'C'
                ? 'Discounted Secondary (19-28 pts)'
                : 'Defective Rejection (&gt;28 pts)'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-black text-2xl shadow-sm">
            {calculatedGrade}
          </div>
        </div>

        {/* Warehouse Storage Location & Inspector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Warehouse Rack / Bay Assignment
            </label>
            <input
              type="text"
              className="m3-input font-bold uppercase"
              value={shelfLocation}
              onChange={(e) => setShelfLocation(e.target.value)}
              placeholder="e.g. RACK-B-04"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Lead QC Inspector
            </label>
            <input
              type="text"
              className="m3-input"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-full bg-[var(--color-primary)] text-white font-bold text-base shadow hover:bg-[var(--color-primary)]/90 transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            {saving ? 'Submitting Inspection...' : 'Commit QC Inspection & Register Roll in Warehouse'}
          </button>
        </div>
      </form>

      {/* Barcode Modal */}
      {inspectedRoll && (
        <ZplThermalLabelModal
          isOpen={showZplModal}
          onClose={() => setShowZplModal(false)}
          title={`Roll Barcode Label (${inspectedRoll.id})`}
          lotDetails={{
            lotNumber: inspectedRoll.id,
            materialName: `Cotton Greige Fabric (Grade ${inspectedRoll.grade})`,
            supplier: `Job: ${inspectedRoll.jobId} | Lot: ${inspectedRoll.lotNumber}`,
            quantity: `${inspectedRoll.lengthMeters} M (${inspectedRoll.weightKg} kg)`,
            receivedDate: inspectedRoll.inspectionDate,
          }}
        />
      )}
    </div>
  );
};
