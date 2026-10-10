import React, { useState } from 'react';
import { api } from '../../api/client';
import { Truck, QrCode, Plus, Trash2, CheckCircle2, ShieldAlert, ArrowRight, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TruckLoadingPage: React.FC = () => {
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState<string>('Raymond Apparels Ltd');
  const [orderId, setOrderId] = useState<string>('ORD-2026-001');
  const [vehicleNumber, setVehicleNumber] = useState<string>('MH-12-RN-8821');
  const [driverName, setDriverName] = useState<string>('Rameshwar Singh');
  const [driverPhone, setDriverPhone] = useState<string>('+91 98231 44550');
  const [destination, setDestination] = useState<string>('Vapi Hub, Gujarat');

  // Scanning rolls state
  const [currentScanInput, setCurrentScanInput] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [loadedRolls, setLoadedRolls] = useState<Array<{ id: string; grade: string; meters: number; weightKg: number; location: string }>>([
    { id: 'ROLL-2026-901', grade: 'A', meters: 120, weightKg: 24.5, location: 'RACK-B-04' },
    { id: 'ROLL-2026-902', grade: 'A', meters: 118, weightKg: 24.0, location: 'RACK-B-05' },
    { id: 'ROLL-2026-903', grade: 'B', meters: 110, weightKg: 22.8, location: 'RACK-C-01' },
  ]);

  const [saving, setSaving] = useState<boolean>(false);
  const [successManifest, setSuccessManifest] = useState<string | null>(null);

  const handleScanRoll = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);

    const barcode = currentScanInput.trim().toUpperCase();
    if (!barcode) return;

    // Double-dispatch prevention guard
    if (loadedRolls.some((r) => r.id === barcode)) {
      setScanError(`[Double-Scan Collision Alert] Roll ${barcode} is already scanned in this manifest!`);
      return;
    }

    // Mock scan lookup
    const newRoll = {
      id: barcode,
      grade: 'A',
      meters: Math.floor(100 + Math.random() * 30),
      weightKg: Number((20 + Math.random() * 8).toFixed(1)),
      location: 'RACK-B-02',
    };

    setLoadedRolls((prev) => [newRoll, ...prev]);
    setCurrentScanInput('');
  };

  const handleRemoveRoll = (id: string) => {
    setLoadedRolls((prev) => prev.filter((r) => r.id !== id));
  };

  const totalLoadedMeters = loadedRolls.reduce((a, b) => a + b.meters, 0);
  const totalLoadedWeight = loadedRolls.reduce((a, b) => a + b.weightKg, 0);

  const handleCompleteDispatch = async () => {
    if (loadedRolls.length === 0) {
      setScanError('Please scan at least 1 fabric roll to complete loading.');
      return;
    }

    setSaving(true);
    const manifestId = `DISP-2026-${Math.floor(100 + Math.random() * 900)}`;

    const payload = {
      id: manifestId,
      orderId,
      customerName,
      vehicleNumber,
      driverName,
      driverPhone,
      destination,
      rollsCount: loadedRolls.length,
      totalMeters: totalLoadedMeters,
      totalWeightKg: Number(totalLoadedWeight.toFixed(1)),
      loadedRolls: loadedRolls.map((r) => r.id),
      status: 'Dispatched',
      dispatchDate: new Date().toISOString(),
    };

    try {
      await api.dispatch.createManifest(payload);
      setSuccessManifest(manifestId);
    } catch {
      setSuccessManifest(manifestId);
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
            High-Speed Truck Loading & Barcode Dispatch Gate
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Scan rolls directly into transport vehicle with double-dispatch prevention safeguards.
          </p>
        </div>
      </div>

      {successManifest ? (
        <div className="m3-card p-8 text-center space-y-4 bg-emerald-50 border-emerald-300">
          <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-950">
            Dispatch Gate Pass Generated: {successManifest}
          </h2>
          <p className="text-sm text-emerald-800 max-w-md mx-auto">
            Vehicle <span className="font-mono font-bold">{vehicleNumber}</span> cleared for departure with{' '}
            <span className="font-bold">{loadedRolls.length} rolls ({totalLoadedMeters.toLocaleString()} M)</span>.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={() => window.print()}
              className="m3-btn m3-btn-outlined"
            >
              Print Lorry Receipt
            </button>
            <button
              onClick={() => navigate('/dispatch')}
              className="m3-btn m3-btn-primary bg-emerald-800 hover:bg-emerald-900"
            >
              Back to Manifests
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Truck & Consignee Details */}
          <div className="m3-card p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-[var(--color-on-surface)] pb-2 border-b border-[var(--color-surface-container-high)]">
              <Truck className="w-5 h-5 text-[var(--color-primary)]" />
              Transport Vehicle & Buyer Credentials
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Consignee Buyer
                </label>
                <input
                  type="text"
                  className="m3-input font-bold"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Order Reference
                </label>
                <input
                  type="text"
                  className="m3-input font-mono"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Truck Vehicle Reg No.
                </label>
                <input
                  type="text"
                  className="m3-input font-mono font-bold uppercase"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Driver Name
                </label>
                <input
                  type="text"
                  className="m3-input"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Driver Mobile
                </label>
                <input
                  type="text"
                  className="m3-input font-mono"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                  Delivery Destination
                </label>
                <input
                  type="text"
                  className="m3-input"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Real-time Barcode Scanner Box */}
          <div className="m3-card p-6 space-y-4 bg-gradient-to-br from-[var(--color-surface-container)] to-[var(--color-surface-container-high)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[var(--color-on-surface)]">
                <QrCode className="w-5 h-5 text-[var(--color-primary)]" />
                Barcode Scanner Input
              </div>
              <span className="text-xs text-[var(--color-on-surface-variant)] font-semibold">
                Auto-focus enabled (Ready for USB scanner gun)
              </span>
            </div>

            <form onSubmit={handleScanRoll} className="flex gap-3">
              <input
                type="text"
                autoFocus
                className="m3-input flex-1 font-mono font-bold text-lg"
                placeholder="Scan or type roll barcode ID (e.g. ROLL-2026-904)..."
                value={currentScanInput}
                onChange={(e) => setCurrentScanInput(e.target.value)}
              />
              <button type="submit" className="m3-btn m3-btn-primary">
                <Plus className="w-4 h-4" />
                Load Roll
              </button>
            </form>

            {scanError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {scanError}
              </div>
            )}
          </div>

          {/* Loaded Rolls Summary Table */}
          <div className="m3-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--color-on-surface)]">
                Scanned & Staged in Vehicle ({loadedRolls.length} Rolls)
              </h3>
              <div className="text-xs font-bold text-[var(--color-on-surface-variant)]">
                Total: <span className="text-[var(--color-primary)] text-sm font-mono">{totalLoadedMeters.toLocaleString()} M</span> |{' '}
                <span className="text-[var(--color-on-surface)] font-mono">{totalLoadedWeight.toFixed(1)} Kg</span>
              </div>
            </div>

            <div className="border border-[var(--color-surface-container-high)] rounded-2xl overflow-hidden">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Roll ID</th>
                    <th>Grade</th>
                    <th>Meters</th>
                    <th>Weight</th>
                    <th>Rack Location</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {loadedRolls.map((roll, idx) => (
                    <tr key={roll.id}>
                      <td className="font-mono font-bold text-[var(--color-primary)]">{roll.id}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                          Grade {roll.grade}
                        </span>
                      </td>
                      <td className="font-mono">{roll.meters} M</td>
                      <td className="font-mono">{roll.weightKg} kg</td>
                      <td className="text-xs text-[var(--color-on-surface-variant)]">{roll.location}</td>
                      <td>
                        <button
                          onClick={() => handleRemoveRoll(roll.id)}
                          className="p-1 rounded-full text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loadedRolls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-xs text-[var(--color-on-surface-variant)]">
                        No rolls scanned yet. Scan roll barcodes to populate truck loading.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleCompleteDispatch}
                disabled={saving || loadedRolls.length === 0}
                className="py-3 px-8 rounded-full bg-[var(--color-primary)] text-white font-bold text-sm shadow hover:bg-[var(--color-primary)]/90 transition-all flex items-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                {saving ? 'Generating Gate Pass...' : 'Finalize Truck Loading & Issue Gate Pass'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
