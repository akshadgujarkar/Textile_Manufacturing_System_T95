import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Factory, Play, Pause, CheckCircle2, AlertTriangle, Zap, Cpu, Clock, Plus, X, StopCircle, RefreshCw, Wrench } from 'lucide-react';

export default function ProductionView() {
  const [jobs, setJobs] = useState([]);
  const [machines, setMachines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [logForm, setLogForm] = useState({
    job_id: '',
    shift_code: 'shift_1',
    operator_id: '',
    output_qty: '',
    scrap_qty: '0',
    power_kwh: '45.0',
  });

  const [jobForm, setJobForm] = useState({
    order_item_id: '1',
    stage_id: '5', // Weaving
    machine_id: '1',
    planned_qty: '1000',
    priority: 'Medium',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jobRes, machRes, empRes] = await Promise.all([
        api.getProductionJobs({ page: 1, pageSize: 50 }),
        api.getMachines(),
        api.getEmployees(),
      ]);

      setJobs(jobRes.data || []);
      setMachines(machRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Failed to load production data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartJob = async (job) => {
    try {
      const jobId = job.job_id || job.id;
      await api.startProductionJob(jobId, job.version || 1);
      setMsg({ type: 'success', text: `Job #${job.job_no || jobId} started on loom and marked RUNNING!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to start job' });
    }
  };

  const handleCompleteJob = async (job) => {
    if (!window.confirm(`Complete and close Production Job #${job.job_no || job.job_id}?`)) return;
    try {
      const jobId = job.job_id || job.id;
      await api.completeProductionJob(jobId, job.version || 1);
      setMsg({ type: 'success', text: `Job #${job.job_no || jobId} marked COMPLETED!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to complete job' });
    }
  };

  const handleCancelJob = async (job) => {
    if (!window.confirm(`Halt / Cancel Production Job #${job.job_no || job.job_id}?`)) return;
    try {
      const jobId = job.job_id || job.id;
      await api.cancelProductionJob(jobId, job.version || 1);
      setMsg({ type: 'success', text: `Job #${job.job_no || jobId} CANCELLED/HALTED!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to cancel job' });
    }
  };

  const handleMachineStatusChange = async (machineId, newStatus) => {
    try {
      await api.updateMachine(machineId, { current_status: newStatus });
      setMsg({ type: 'success', text: `Machine #${machineId} status updated to ${newStatus.toUpperCase()}` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update machine status' });
    }
  };

  const handleLogShift = async (e) => {
    e.preventDefault();
    if (!logForm.job_id || !logForm.operator_id) {
      alert('Please select a job and operator');
      return;
    }
    setSubmitting(true);
    setMsg(null);

    const clientRequestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    try {
      await api.createProductionLog({
        job_id: parseInt(logForm.job_id),
        shift_code: logForm.shift_code,
        operator_id: parseInt(logForm.operator_id),
        output_qty: parseFloat(logForm.output_qty),
        scrap_qty: parseFloat(logForm.scrap_qty || 0),
        power_kwh: parseFloat(logForm.power_kwh || 0),
        client_request_id: clientRequestId,
      });

      setMsg({ type: 'success', text: 'Shift production log saved with kiosk idempotency verification!' });
      setShowLogModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to log shift output' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const jobNo = `JOB-${Date.now().toString().slice(-6)}`;

    try {
      await api.createProductionJob({
        job_no: jobNo,
        order_item_id: parseInt(jobForm.order_item_id),
        stage_id: parseInt(jobForm.stage_id),
        machine_id: parseInt(jobForm.machine_id),
        planned_qty: parseFloat(jobForm.planned_qty),
        priority: jobForm.priority, // 'Low' | 'Medium' | 'High' | 'Urgent'
      });

      setMsg({ type: 'success', text: `Production Job ${jobNo} scheduled on loom successfully!` });
      setShowJobModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create job' });
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
            <Factory className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Loom Execution & Machine Shop-Floor
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Real-time Air Jet / Rapier loom scheduling, shift logs, and operational machine controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="md-btn md-btn-tonal flex items-center gap-2" onClick={() => setShowLogModal(true)}>
            <Clock className="w-4 h-4" /> Log Shift Output
          </button>
          <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => setShowJobModal(true)}>
            <Plus className="w-4 h-4" /> Schedule Weaving Job
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

      {/* Machine Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {machines.map((m) => {
          const machId = m.machine_id || m.id;
          const statusColors = {
            running: 'bg-emerald-500',
            idle: 'bg-amber-400',
            maintenance: 'bg-blue-500',
            stopped: 'bg-rose-500',
          };

          return (
            <div key={machId} className="md-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[var(--md-sys-color-primary)]" />
                  {m.machine_code}
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${statusColors[m.current_status] || 'bg-slate-400'} animate-pulse`} />
              </div>

              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-1">
                <div>Model: <strong>{m.make_model || 'Picanol OmniPlus'}</strong></div>
                <div>Rated RPM: <strong>{m.rated_rpm || 850} RPM</strong></div>
                <div className="pt-1 flex items-center justify-between">
                  <span>State:</span>
                  <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                    {m.current_status}
                  </span>
                </div>
              </div>

              {/* Machine Controls */}
              <div className="pt-2 border-t border-[var(--md-sys-color-outline-variant)] flex items-center justify-between gap-1">
                <button
                  onClick={() => handleMachineStatusChange(machId, 'running')}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold"
                  title="Mark Running"
                >
                  Run
                </button>
                <button
                  onClick={() => handleMachineStatusChange(machId, 'idle')}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-bold"
                  title="Mark Idle"
                >
                  Idle
                </button>
                <button
                  onClick={() => handleMachineStatusChange(machId, 'maintenance')}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-[10px] font-bold"
                  title="Maintenance"
                >
                  Maint
                </button>
                <button
                  onClick={() => handleMachineStatusChange(machId, 'stopped')}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-[10px] font-bold"
                  title="Halt / Stop"
                >
                  Stop
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Jobs Table */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Job Number</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Product / Order</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Assigned Loom</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Planned Qty</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Priority</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">Loading production jobs...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">No manufacturing jobs currently scheduled.</td>
                </tr>
              ) : (
                jobs.map((j) => {
                  const jobId = j.job_id || j.id;
                  const statusColors = {
                    planned: 'bg-slate-100 text-slate-800',
                    running: 'bg-emerald-100 text-emerald-800',
                    interrupted: 'bg-amber-100 text-amber-800',
                    completed: 'bg-purple-100 text-purple-800',
                    cancelled: 'bg-rose-100 text-rose-800',
                  };

                  return (
                    <tr key={jobId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-[var(--md-sys-color-primary)]">{j.job_no || `JOB-${jobId}`}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">ID #{jobId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{j.product_name || `Order Item #${j.order_item_id}`}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Order #{j.order_id || j.order_no || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold">{j.machine_code || `Machine #${j.machine_id}`}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{j.stage_name || 'Weaving'}</div>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {parseFloat(j.planned_qty || 0).toLocaleString()} m
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          j.priority === 'Urgent' || j.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {j.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusColors[j.status] || 'bg-slate-100 text-slate-800'}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {j.status === 'planned' && (
                            <button
                              onClick={() => handleStartJob(j)}
                              className="md-btn md-btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Start Weaving
                            </button>
                          )}
                          {j.status === 'running' && (
                            <>
                              <button
                                onClick={() => handleCompleteJob(j)}
                                className="md-btn md-btn-primary text-xs py-1 px-2.5 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Complete
                              </button>
                              <button
                                onClick={() => handleCancelJob(j)}
                                className="md-btn md-btn-tonal text-xs py-1 px-2 text-rose-600 hover:bg-rose-50"
                                title="Halt job"
                              >
                                <StopCircle className="w-3 h-3" /> Halt
                              </button>
                            </>
                          )}
                          {(j.status === 'completed' || j.status === 'cancelled') && (
                            <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Shift Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Shop-Floor Shift Production Log
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowLogModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleLogShift} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Target Production Job *</label>
                <select
                  className="md-input w-full"
                  required
                  value={logForm.job_id}
                  onChange={(e) => setLogForm({ ...logForm, job_id: e.target.value })}
                >
                  <option value="">Select Job...</option>
                  {jobs.map((j) => {
                    const jobId = j.job_id || j.id;
                    return (
                      <option key={jobId} value={jobId}>
                        {j.job_no || `JOB-${jobId}`} - {j.product_name || 'Fabric Product'} (Status: {j.status})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Shift *</label>
                  <select
                    className="md-input w-full"
                    value={logForm.shift_code}
                    onChange={(e) => setLogForm({ ...logForm, shift_code: e.target.value })}
                  >
                    <option value="shift_1">Shift 1 (Morning: 08:00 - 16:00)</option>
                    <option value="shift_2">Shift 2 (Evening: 16:00 - 00:00)</option>
                    <option value="shift_3">Shift 3 (Night: 00:00 - 08:00)</option>
                    <option value="general">General Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Operator *</label>
                  <select
                    className="md-input w-full"
                    required
                    value={logForm.operator_id}
                    onChange={(e) => setLogForm({ ...logForm, operator_id: e.target.value })}
                  >
                    <option value="">Select Operator...</option>
                    {employees.map((emp) => {
                      const empId = emp.employee_id || emp.id;
                      return (
                        <option key={empId} value={empId}>
                          {emp.full_name || `${emp.first_name} ${emp.last_name}`} ({emp.designation || 'Operator'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Output (Meters) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    className="md-input w-full font-mono font-bold text-emerald-700"
                    placeholder="e.g. 250"
                    value={logForm.output_qty}
                    onChange={(e) => setLogForm({ ...logForm, output_qty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Scrap (Meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="md-input w-full font-mono text-rose-700"
                    placeholder="e.g. 5"
                    value={logForm.scrap_qty}
                    onChange={(e) => setLogForm({ ...logForm, scrap_qty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Energy (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="md-input w-full font-mono text-blue-700"
                    placeholder="e.g. 45.0"
                    value={logForm.power_kwh}
                    onChange={(e) => setLogForm({ ...logForm, power_kwh: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Commit Shift Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Factory className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Schedule Weaving Production Job
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowJobModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Order Item ID *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="md-input w-full font-mono"
                  placeholder="Order Item ID (e.g. 1)"
                  value={jobForm.order_item_id}
                  onChange={(e) => setJobForm({ ...jobForm, order_item_id: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Process Stage *</label>
                  <select
                    className="md-input w-full"
                    value={jobForm.stage_id}
                    onChange={(e) => setJobForm({ ...jobForm, stage_id: e.target.value })}
                  >
                    <option value="5">Weaving (Loom Stage)</option>
                    <option value="1">Spinning / Ring Frame</option>
                    <option value="2">Winding</option>
                    <option value="3">Warping</option>
                    <option value="4">Sizing</option>
                    <option value="6">Inspection & Folding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Target Loom / Machine *</label>
                  <select
                    className="md-input w-full"
                    value={jobForm.machine_id}
                    onChange={(e) => setJobForm({ ...jobForm, machine_id: e.target.value })}
                  >
                    {machines.map((m) => {
                      const mId = m.machine_id || m.id;
                      return (
                        <option key={mId} value={mId}>
                          {m.machine_code} - {m.make_model || 'Air Jet'} ({m.current_status})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Planned Quantity (Meters) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. 1000"
                    value={jobForm.planned_qty}
                    onChange={(e) => setJobForm({ ...jobForm, planned_qty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Production Priority *</label>
                  <select
                    className="md-input w-full"
                    value={jobForm.priority}
                    onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowJobModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Scheduling...' : 'Schedule Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
