import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ProductionJob } from '../../types';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Play, Plus, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);

  // Form state
  const [orderId, setOrderId] = useState<string>('ORD-2026-001');
  const [stage, setStage] = useState<'Spinning' | 'Weaving' | 'Dyeing' | 'Finishing'>('Spinning');
  const [plannedMeters, setPlannedMeters] = useState<number>(2500);
  const [assignedShift, setAssignedShift] = useState<string>('Shift A (Day)');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('High');

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await api.production.getJobs();
      if (res.data && res.data.length > 0) {
        setJobs(res.data);
      } else {
        setJobs(fallbackJobs);
      }
    } catch {
      setJobs(fallbackJobs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        orderId,
        stage,
        plannedMeters: Number(plannedMeters),
        assignedShift,
        priority,
        status: 'Scheduled' as const,
      };
      const res = await api.production.createJob(payload);
      const newJob: ProductionJob = res.data || {
        ...payload,
        id: `JOB-${Date.now().toString().slice(-4)}`,
        actualMeters: 0,
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      setShowCreateModal(false);
    } catch {
      const newJob: ProductionJob = {
        id: `JOB-${Date.now().toString().slice(-4)}`,
        orderId,
        stage,
        plannedMeters: Number(plannedMeters),
        actualMeters: 0,
        assignedShift,
        priority,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (jobId: string, newStatus: ProductionJob['status']) => {
    try {
      await api.production.updateJob(jobId, { status: newStatus });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );
    }
  };

  const columns = [
    {
      header: 'Job ID',
      accessor: (j: ProductionJob) => (
        <span className="font-bold text-[var(--color-primary)] font-mono">{j.id}</span>
      ),
      sortable: true,
    },
    {
      header: 'Order Ref',
      accessor: (j: ProductionJob) => (
        <span className="font-mono text-sm">{j.orderId}</span>
      ),
    },
    {
      header: 'Stage',
      accessor: (j: ProductionJob) => (
        <span className="px-3 py-1 bg-[var(--color-surface-container)] rounded-full text-xs font-semibold text-[var(--color-on-surface)]">
          {j.stage}
        </span>
      ),
    },
    {
      header: 'Machine / Shift',
      accessor: (j: ProductionJob) => (
        <div>
          <div className="font-semibold text-xs text-[var(--color-on-surface)]">{j.machineId || 'Pending Assignment'}</div>
          <div className="text-[11px] text-[var(--color-on-surface-variant)]">{j.assignedShift || 'General'}</div>
        </div>
      ),
    },
    {
      header: 'Progress',
      accessor: (j: ProductionJob) => {
        const pct = Math.min(100, Math.round(((j.actualMeters || 0) / (j.plannedMeters || 1)) * 100));
        return (
          <div className="w-36">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>{j.actualMeters || 0}m</span>
              <span className="text-[var(--color-on-surface-variant)]">/ {j.plannedMeters}m ({pct}%)</span>
            </div>
            <div className="h-2 bg-[var(--color-surface-container-high)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 100 ? 'bg-emerald-500' : 'bg-[var(--color-primary)]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Priority',
      accessor: (j: ProductionJob) => {
        const colors: Record<string, string> = {
          Urgent: 'bg-rose-100 text-rose-800 border-rose-200',
          High: 'bg-amber-100 text-amber-800 border-amber-200',
          Medium: 'bg-blue-100 text-blue-800 border-blue-200',
          Low: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[j.priority || 'Medium']}`}>
            {j.priority || 'Medium'}
          </span>
        );
      },
    },
    {
      header: 'Status',
      accessor: (j: ProductionJob) => <StatusBadge status={j.status} />,
    },
    {
      header: 'Actions',
      accessor: (j: ProductionJob) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedJob(j);
          }}
          className="m3-btn m3-btn-tonal text-xs py-1 px-3"
        >
          Manage
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Production Scheduling & Work Orders
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Create work tickets, assign machines, and track stage-wise output quotas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadJobs} className="m3-btn m3-btn-outlined text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="m3-btn m3-btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Schedule New Job
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-medium">Scheduled</div>
            <div className="text-xl font-bold text-[var(--color-on-surface)]">
              {jobs.filter((j) => j.status === 'Scheduled').length}
            </div>
          </div>
        </div>

        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-medium">In Progress</div>
            <div className="text-xl font-bold text-[var(--color-on-surface)]">
              {jobs.filter((j) => j.status === 'In Progress').length}
            </div>
          </div>
        </div>

        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-medium">Completed</div>
            <div className="text-xl font-bold text-[var(--color-on-surface)]">
              {jobs.filter((j) => j.status === 'Completed').length}
            </div>
          </div>
        </div>

        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-medium">On Hold / Interrupted</div>
            <div className="text-xl font-bold text-[var(--color-on-surface)]">
              {jobs.filter((j) => j.status === 'Paused' || j.status === 'Cancelled').length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={jobs}
        columns={columns}
        keyExtractor={(j) => j.id || j.job_no || 'job'}
        searchPlaceholder="Search by job ID, order, stage, machine..."
        searchFilter={(j, q) =>
          (j.id || '').toLowerCase().includes(q.toLowerCase()) ||
          (j.orderId || '').toLowerCase().includes(q.toLowerCase()) ||
          (j.stage || '').toLowerCase().includes(q.toLowerCase()) ||
          (j.machineId || '').toLowerCase().includes(q.toLowerCase())
        }
        loading={loading}
      />

      {/* Create Job Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Schedule Production Work Ticket"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase tracking-wider">
              Customer Order Reference
            </label>
            <input
              type="text"
              className="m3-input"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-2026-001"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase tracking-wider">
                Manufacturing Stage
              </label>
              <select
                className="m3-input"
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
              >
                <option value="Spinning">Spinning (Yarn to Spool)</option>
                <option value="Weaving">Weaving (Loom Production)</option>
                <option value="Dyeing">Dyeing & Bleaching</option>
                <option value="Finishing">Finishing & Compacting</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase tracking-wider">
                Planned Output (Meters)
              </label>
              <input
                type="number"
                className="m3-input"
                value={plannedMeters}
                onChange={(e) => setPlannedMeters(Number(e.target.value))}
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase tracking-wider">
                Assigned Shift
              </label>
              <select
                className="m3-input"
                value={assignedShift}
                onChange={(e) => setAssignedShift(e.target.value)}
              >
                <option value="Shift A (Day)">Shift A (07:00 - 15:30)</option>
                <option value="Shift B (Evening)">Shift B (15:30 - 00:00)</option>
                <option value="Shift C (Night)">Shift C (00:00 - 07:00)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase tracking-wider">
                Priority
              </label>
              <select
                className="m3-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent / Priority 1</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-container-high)]">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="m3-btn m3-btn-outlined"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="m3-btn m3-btn-primary"
            >
              {creating ? 'Scheduling...' : 'Dispatch Ticket to Floor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Job Detail Modal */}
      {selectedJob && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedJob(null)}
          title={`Job Status: ${selectedJob.id}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-[var(--color-surface-container)] rounded-2xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Order Reference:</span>
                <span className="font-bold">{selectedJob.orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Stage:</span>
                <span className="font-bold">{selectedJob.stage}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Machine:</span>
                <span className="font-bold">{selectedJob.machineId || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Progress:</span>
                <span className="font-bold">{selectedJob.actualMeters || 0} / {selectedJob.plannedMeters} Meters</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-[var(--color-on-surface-variant)]">Current Status:</span>
                <StatusBadge status={selectedJob.status} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-2 uppercase">
                Change State
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedJob.id || '', 'In Progress')}
                  className="m3-btn m3-btn-tonal text-xs py-2 bg-amber-100 text-amber-900 hover:bg-amber-200"
                >
                  Set In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedJob.id || '', 'Completed')}
                  className="m3-btn m3-btn-tonal text-xs py-2 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedJob.id || '', 'Paused')}
                  className="m3-btn m3-btn-tonal text-xs py-2 bg-rose-100 text-rose-900 hover:bg-rose-200"
                >
                  Pause / Hold
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedJob.id || '', 'Scheduled')}
                  className="m3-btn m3-btn-tonal text-xs py-2"
                >
                  Reset to Scheduled
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--color-surface-container-high)]">
              <button
                onClick={() => setSelectedJob(null)}
                className="m3-btn m3-btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const fallbackJobs: ProductionJob[] = [
  {
    id: 'JOB-901',
    orderId: 'ORD-2026-001',
    stage: 'Spinning',
    machineId: 'SPIN-01',
    operatorId: 'OPR-401',
    plannedMeters: 5000,
    actualMeters: 4800,
    status: 'In Progress',
    priority: 'Urgent',
    assignedShift: 'Shift A (Day)',
    createdAt: '2026-10-10T08:00:00Z',
  },
  {
    id: 'JOB-902',
    orderId: 'ORD-2026-001',
    stage: 'Weaving',
    machineId: 'LOOM-04',
    operatorId: 'OPR-402',
    plannedMeters: 3000,
    actualMeters: 1200,
    status: 'In Progress',
    priority: 'High',
    assignedShift: 'Shift A (Day)',
    createdAt: '2026-10-10T09:30:00Z',
  },
  {
    id: 'JOB-903',
    orderId: 'ORD-2026-002',
    stage: 'Dyeing',
    machineId: 'DYE-02',
    operatorId: 'OPR-405',
    plannedMeters: 1800,
    actualMeters: 1800,
    status: 'Completed',
    priority: 'Medium',
    assignedShift: 'Shift B (Evening)',
    createdAt: '2026-10-09T14:00:00Z',
  },
  {
    id: 'JOB-904',
    orderId: 'ORD-2026-003',
    stage: 'Finishing',
    machineId: 'FIN-01',
    operatorId: 'OPR-406',
    plannedMeters: 2200,
    actualMeters: 0,
    status: 'Scheduled',
    priority: 'High',
    assignedShift: 'Shift A (Day)',
    createdAt: '2026-10-10T10:00:00Z',
  },
];
