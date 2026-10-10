import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle2, AlertTriangle, Calculator, Plus, Eye, X, Scissors, Tag, Trash2, ShieldCheck, RotateCcw } from 'lucide-react';

export default function QualityView() {
  const [rolls, setRolls] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showQcModal, setShowQcModal] = useState(false);
  const [showDoffModal, setShowDoffModal] = useState(false);
  const [selectedRoll, setSelectedRoll] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Doff Roll Form
  const [doffForm, setDoffForm] = useState({
    job_id: '',
    operator_id: '1',
    roll_code: '',
    length_m: '250',
    gross_weight_kg: '42.5',
    tare_weight_kg: '1.2',
    cuttable_width_inches: '58.0',
    gsm: '140',
    shelf_location: 'BAY-QC-01'
  });

  // QC Form
  const [qcForm, setQcForm] = useState({
    roll_id: '',
    inspector_id: '',
    attempt_no: 1,
    remarks: 'ASTM D5430 Standard Inspection',
    defects: [
      { defect_type: 'Slub', meter_position: '42.0', points: 2 },
      { defect_type: 'Broken Pick', meter_position: '115.5', points: 1 }
    ]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rollRes, jobRes, empRes] = await Promise.all([
        api.getFabricRolls({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
        api.getProductionJobs({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
        api.getEmployees().catch(() => ({ data: [] })),
      ]);

      setRolls(rollRes.data || []);
      setJobs(jobRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Failed to load quality data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Doff New Roll
  const handleDoffRoll = async (e) => {
    e.preventDefault();
    if (!doffForm.job_id) {
      alert('Please select an active production job');
      return;
    }
    setSubmitting(true);
    try {
      const netWeight = Math.max(0.1, parseFloat(doffForm.gross_weight_kg) - parseFloat(doffForm.tare_weight_kg));
      const rollCode = doffForm.roll_code || `ROL-${Date.now().toString().slice(-6)}`;

      await api.createFabricRoll({
        roll_code: rollCode,
        job_id: parseInt(doffForm.job_id),
        operator_id: parseInt(doffForm.operator_id || 1), // Fix: required by validator
        length_m: parseFloat(doffForm.length_m),
        weight_kg: parseFloat(netWeight.toFixed(2)),
        gsm: parseFloat(doffForm.gsm || 140),
        width_inches: parseFloat(doffForm.cuttable_width_inches || 58), // Fix: mapped to width_inches
        shelf_location: doffForm.shelf_location || 'BAY-QC-01',
      });

      setMsg({ type: 'success', text: `Fabric roll ${rollCode} successfully doffed and staged for ASTM QC Inspection!` });
      setShowDoffModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to doff fabric roll' });
    } finally {
      setSubmitting(false);
    }
  };

  const openQcDialog = (roll) => {
    setSelectedRoll(roll);
    setQcForm({
      roll_id: roll.roll_id || roll.id,
      inspector_id: employees.find((e) => e.designation?.includes('QC'))?.employee_id || employees[0]?.employee_id || employees[0]?.id || 1,
      attempt_no: 1,
      remarks: 'ASTM D5430 Standard Inspection',
      defects: [
        { defect_type: 'Slub', meter_position: '35.0', points: 2 },
        { defect_type: 'Warp Streak', meter_position: '88.2', points: 1 }
      ]
    });
    setShowQcModal(true);
  };

  // Defect list management in QC
  const handleAddDefectRow = () => {
    setQcForm({
      ...qcForm,
      defects: [...qcForm.defects, { defect_type: 'Slub', meter_position: '0.0', points: 1 }]
    });
  };

  const handleRemoveDefectRow = (idx) => {
    setQcForm({
      ...qcForm,
      defects: qcForm.defects.filter((_, i) => i !== idx)
    });
  };

  const handleDefectChange = (idx, field, val) => {
    const updated = [...qcForm.defects];
    updated[idx][field] = field === 'points' ? Number(val) : val;
    setQcForm({ ...qcForm, defects: updated });
  };

  // Live ASTM 4-Point Calculation
  const rollLength = selectedRoll ? parseFloat(selectedRoll.length_m) || 200 : 200;
  const rollLengthYards = rollLength * 1.09361;
  const rollWidthInches = selectedRoll ? parseFloat(selectedRoll.width_inches || selectedRoll.cuttable_width_inches) || 58 : 58;
  const totalPenaltyPoints = qcForm.defects.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);

  const calculatedPointsPer100SqYd =
    rollLengthYards > 0 && rollWidthInches > 0
      ? (totalPenaltyPoints * 3600) / (rollLengthYards * rollWidthInches)
      : 0;

  let assignedGrade = 'A';
  let result = 'passed';
  if (calculatedPointsPer100SqYd <= 20) {
    assignedGrade = 'A';
    result = 'passed';
  } else if (calculatedPointsPer100SqYd <= 40) {
    assignedGrade = 'B';
    result = 'passed';
  } else if (calculatedPointsPer100SqYd <= 50) {
    assignedGrade = 'C';
    result = 'rework';
  } else {
    assignedGrade = 'Rejection';
    result = 'rejected';
  }

  const handlePerformQc = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      await api.createQcInspection({
        roll_id: parseInt(qcForm.roll_id),
        inspector_id: parseInt(qcForm.inspector_id || 1),
        result: result, // 'passed' | 'rework' | 'rejected'
        assigned_grade: assignedGrade, // 'A' | 'B' | 'C' | 'Rejection'
        remarks: qcForm.remarks,
        defects: qcForm.defects.map((def) => ({
          defect_code: def.defect_type.toUpperCase().replace(/\s+/g, '_'),
          defect_name: def.defect_type,
          penalty_points: parseInt(def.points || 1),
          position_meters: parseFloat(def.meter_position || 0),
          severity: def.points >= 3 ? 'critical' : def.points === 2 ? 'major' : 'minor',
        })),
      });

      setMsg({ type: 'success', text: `ASTM QC Certified: Grade ${assignedGrade} (${calculatedPointsPer100SqYd.toFixed(2)} pts/100 sq.yd) - Status: ${result.toUpperCase()}` });
      setShowQcModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to submit QC inspection' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <Calculator className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Fabric Rolls & ASTM 4-Point Quality Control
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Roll barcode tracking, shop-floor doffing, itemized defect position logs, and ASTM D5430 grading.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setDoffForm({
                job_id: jobs[0]?.job_id || jobs[0]?.id || '',
                operator_id: employees[0]?.employee_id || employees[0]?.id || '1',
                roll_code: `ROL-${Date.now().toString().slice(-6)}`,
                length_m: '250',
                gross_weight_kg: '42.5',
                tare_weight_kg: '1.2',
                cuttable_width_inches: '58.0',
                gsm: '140',
                shelf_location: 'BAY-QC-01'
              });
              setShowDoffModal(true);
            }}
            className="md-btn md-btn-primary flex items-center gap-2"
          >
            <Scissors className="w-4 h-4" />
            Doff New Fabric Roll
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 border ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{msg.text}</span>
        </div>
      )}

      {/* ASTM 4-Point Formula Information Box */}
      <div className="md-card p-5 border-l-4 border-l-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container-low)]">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5 text-[var(--md-sys-color-primary)]" />
          <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            ASTM D5430 Standard 4-Point Inspection System
          </h3>
        </div>
        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-1">
          <p>
            <strong>Standard Formula:</strong> Points per 100 sq. yd = (Total Penalty Points &times; 3600) / (Length in Yards &times; Width in Inches)
          </p>
          <div className="flex flex-wrap gap-4 pt-1 font-semibold">
            <span className="text-emerald-700">Grade A: &le; 20.0 pts (First Quality Export)</span>
            <span className="text-blue-700">Grade B: 20.1 &ndash; 40.0 pts (Commercial Standard)</span>
            <span className="text-amber-700">Grade C: 40.1 &ndash; 50.0 pts (Secondary)</span>
            <span className="text-rose-700">Reject: &gt; 50.0 pts</span>
          </div>
        </div>
      </div>

      {/* Fabric Rolls Table */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Roll Barcode</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Product / Job</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Length & Weight</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Specs (GSM / Width)</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Shelf Location</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    Loading fabric rolls...
                  </td>
                </tr>
              ) : rolls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    No fabric rolls doffed yet. Click "Doff New Fabric Roll" to cut a roll from a running loom job.
                  </td>
                </tr>
              ) : (
                rolls.map((r) => {
                  const rollId = r.roll_id || r.id;
                  const rollCode = r.roll_code || r.barcode || `ROL-${rollId}`;
                  return (
                    <tr key={rollId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-[var(--md-sys-color-primary)]">{rollCode}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">ID #{rollId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{r.product_name || `Job #${r.job_id}`}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{r.job_no || `Job ID ${r.job_id}`}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold">{parseFloat(r.length_m || r.length_meters || 0).toFixed(1)} m</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">Net: {parseFloat(r.weight_kg || 0).toFixed(2)} kg</div>
                      </td>
                      <td className="p-4 text-xs font-mono">
                        {r.gsm || 140} GSM &bull; {r.width_inches || r.cuttable_width_inches || 58}&quot;
                      </td>
                      <td className="p-4 font-mono text-xs">{r.shelf_location || 'BAY-QC-01'}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            r.status === 'passed' || r.status === 'in_stock'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'dispatched'
                              ? 'bg-purple-100 text-purple-800'
                              : r.status === 'pending_qc'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {r.status === 'pending_qc' || r.status === 'in_stock' ? (
                          <button
                            className="md-btn md-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                            onClick={() => openQcDialog(r)}
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            Inspect ASTM QC
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium">
                            {r.status === 'dispatched' ? 'Dispatched' : 'Certified'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doff Fabric Roll Modal */}
      {showDoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Scissors className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Doff & Cut Fabric Roll from Loom
              </h2>
              <button onClick={() => setShowDoffModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleDoffRoll} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Select Active Production Job *</label>
                  <select
                    value={doffForm.job_id}
                    onChange={(e) => setDoffForm({ ...doffForm, job_id: e.target.value })}
                    required
                    className="md-input w-full"
                  >
                    <option value="">Select Job...</option>
                    {jobs.map((j) => {
                      const jobId = j.job_id || j.id;
                      return (
                        <option key={jobId} value={jobId}>
                          {j.job_no || `Job #${jobId}`} - {j.product_name || 'Fabric Product'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Operator *</label>
                  <select
                    value={doffForm.operator_id}
                    onChange={(e) => setDoffForm({ ...doffForm, operator_id: e.target.value })}
                    required
                    className="md-input w-full"
                  >
                    {employees.map((emp) => {
                      const empId = emp.employee_id || emp.id;
                      return (
                        <option key={empId} value={empId}>
                          {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Assigned Barcode</label>
                  <input
                    type="text"
                    value={doffForm.roll_code}
                    onChange={(e) => setDoffForm({ ...doffForm, roll_code: e.target.value })}
                    className="md-input w-full font-mono"
                    placeholder="e.g. ROL-882910"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Doffed Length (Meters) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={doffForm.length_m}
                    onChange={(e) => setDoffForm({ ...doffForm, length_m: e.target.value })}
                    required
                    className="md-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Width (Inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={doffForm.cuttable_width_inches}
                    onChange={(e) => setDoffForm({ ...doffForm, cuttable_width_inches: e.target.value })}
                    className="md-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Gross Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={doffForm.gross_weight_kg}
                    onChange={(e) => setDoffForm({ ...doffForm, gross_weight_kg: e.target.value })}
                    required
                    className="md-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Tare Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={doffForm.tare_weight_kg}
                    onChange={(e) => setDoffForm({ ...doffForm, tare_weight_kg: e.target.value })}
                    className="md-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Fabric GSM</label>
                  <input
                    type="number"
                    value={doffForm.gsm}
                    onChange={(e) => setDoffForm({ ...doffForm, gsm: e.target.value })}
                    className="md-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">QC Staging Bay</label>
                  <input
                    type="text"
                    value={doffForm.shelf_location}
                    onChange={(e) => setDoffForm({ ...doffForm, shelf_location: e.target.value })}
                    className="md-input w-full font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" onClick={() => setShowDoffModal(false)} className="md-btn md-btn-tonal">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="md-btn md-btn-primary flex items-center gap-2">
                  {submitting ? 'Doffing...' : 'Doff Roll to QC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASTM QC Inspection Modal with Itemized Defects */}
      {showQcModal && selectedRoll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calculator className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  ASTM 4-Point QC: {selectedRoll.roll_code || selectedRoll.barcode}
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Length: {rollLength}m ({rollLengthYards.toFixed(1)} yds) &bull; Width: {rollWidthInches}&quot;
                </p>
              </div>
              <button onClick={() => setShowQcModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handlePerformQc} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">QC Inspector *</label>
                  <select
                    value={qcForm.inspector_id}
                    onChange={(e) => setQcForm({ ...qcForm, inspector_id: e.target.value })}
                    required
                    className="md-input w-full"
                  >
                    {employees.map((emp) => {
                      const empId = emp.employee_id || emp.id;
                      return (
                        <option key={empId} value={empId}>
                          {emp.full_name || `${emp.first_name} ${emp.last_name}`} ({emp.designation || 'Staff'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Inspection Attempt</label>
                  <input
                    type="number"
                    min="1"
                    value={qcForm.attempt_no}
                    onChange={(e) => setQcForm({ ...qcForm, attempt_no: e.target.value })}
                    className="md-input w-full font-mono"
                  />
                </div>
              </div>

              {/* Itemized Defect Table */}
              <div className="space-y-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[var(--md-sys-color-primary)]" />
                    Observed Defect Points ({qcForm.defects.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddDefectRow}
                    className="text-xs font-semibold text-[var(--md-sys-color-primary)] flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Defect Point
                  </button>
                </div>

                {qcForm.defects.map((def, idx) => (
                  <div key={idx} className="p-3 bg-[var(--md-sys-color-surface-container-low)] rounded-2xl flex items-center gap-3">
                    <div className="flex-1">
                      <select
                        value={def.defect_type}
                        onChange={(e) => handleDefectChange(idx, 'defect_type', e.target.value)}
                        className="md-input w-full text-xs"
                      >
                        <option value="Slub">Slub (Thick yarn segment)</option>
                        <option value="Broken Pick">Broken Pick / Missing Weft</option>
                        <option value="Warp Streak">Warp Streak / Mixed Count</option>
                        <option value="Float">Float (Weft unattached)</option>
                        <option value="Hole">Hole / Reed Mark</option>
                        <option value="Stain">Oil / Grease Stain</option>
                      </select>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Pos (m)"
                        value={def.meter_position}
                        onChange={(e) => handleDefectChange(idx, 'meter_position', e.target.value)}
                        className="md-input w-full text-xs font-mono"
                      />
                    </div>

                    <div className="w-24">
                      <select
                        value={def.points}
                        onChange={(e) => handleDefectChange(idx, 'points', e.target.value)}
                        className="md-input w-full text-xs font-mono font-bold"
                      >
                        <option value="1">1 pt (&lt;3")</option>
                        <option value="2">2 pts (3-6")</option>
                        <option value="3">3 pts (6-9")</option>
                        <option value="4">4 pts (&gt;9")</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDefectRow(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Live ASTM 4-Point Calculated Output Card */}
              <div className="p-4 bg-[var(--md-sys-color-surface-container-high)] rounded-2xl flex items-center justify-between border border-[var(--md-sys-color-outline-variant)]">
                <div>
                  <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] uppercase font-semibold">
                    Total Defect Points: {totalPenaltyPoints} pts
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--md-sys-color-primary)]">
                    {calculatedPointsPer100SqYd.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-[var(--md-sys-color-on-surface-variant)]">pts / 100 sq. yd</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] uppercase font-semibold">
                    ASTM Grade Result
                  </div>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                      assignedGrade === 'A'
                        ? 'bg-emerald-100 text-emerald-800'
                        : assignedGrade === 'B'
                        ? 'bg-blue-100 text-blue-800'
                        : assignedGrade === 'C'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Grade {assignedGrade} ({result})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Inspector Comments</label>
                <input
                  type="text"
                  value={qcForm.remarks}
                  onChange={(e) => setQcForm({ ...qcForm, remarks: e.target.value })}
                  className="md-input w-full"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" onClick={() => setShowQcModal(false)} className="md-btn md-btn-tonal">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="md-btn md-btn-primary flex items-center gap-2">
                  {submitting ? 'Certifying...' : 'Certify ASTM Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
