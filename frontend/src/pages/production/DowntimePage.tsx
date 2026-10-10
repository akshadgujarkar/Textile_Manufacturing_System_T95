import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { AlertOctagon, Wrench, Plus, CheckCircle, Clock, BarChart3, RefreshCw } from 'lucide-react';

interface DowntimeEvent {
  id: string;
  machineId: string;
  stage: string;
  reason: string;
  category: 'Mechanical' | 'Electrical' | 'Yarn Breakage' | 'Operator' | 'Scheduled Maintenance' | 'Power Outage';
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  technician?: string;
  resolution?: string;
  status: 'Active' | 'Resolved';
}

export const DowntimePage: React.FC = () => {
  const [events, setEvents] = useState<DowntimeEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<DowntimeEvent | null>(null);

  // Form states
  const [machineId, setMachineId] = useState<string>('LOOM-04');
  const [category, setCategory] = useState<DowntimeEvent['category']>('Mechanical');
  const [reason, setReason] = useState<string>('');
  const [technician, setTechnician] = useState<string>('Anil Sharma (Maintenance)');

  const [resolveNotes, setResolveNotes] = useState<string>('');

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await api.production.getDowntime();
      if (res.data && res.data.length > 0) {
        setEvents(res.data);
      } else {
        setEvents(fallbackDowntime);
      }
    } catch {
      setEvents(fallbackDowntime);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleLogDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: DowntimeEvent = {
      id: `DT-${Date.now().toString().slice(-4)}`,
      machineId,
      stage: machineId.startsWith('LOOM') ? 'Weaving' : machineId.startsWith('SPIN') ? 'Spinning' : 'Dyeing',
      category,
      reason,
      technician,
      startTime: new Date().toISOString(),
      status: 'Active',
    };

    try {
      await api.production.logDowntime(newEvent);
      setEvents((prev) => [newEvent, ...prev]);
    } catch {
      setEvents((prev) => [newEvent, ...prev]);
    }
    setShowLogModal(false);
    setReason('');
  };

  const handleResolveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    const endTime = new Date().toISOString();
    const duration = Math.round((new Date(endTime).getTime() - new Date(selectedEvent.startTime).getTime()) / 60000);

    const updated: DowntimeEvent = {
      ...selectedEvent,
      endTime,
      durationMinutes: duration > 0 ? duration : 45,
      resolution: resolveNotes,
      status: 'Resolved',
    };

    try {
      await api.production.resolveDowntime(selectedEvent.id, {
        resolution: resolveNotes,
        endTime,
      });
      setEvents((prev) => prev.map((item) => (item.id === selectedEvent.id ? updated : item)));
    } catch {
      setEvents((prev) => prev.map((item) => (item.id === selectedEvent.id ? updated : item)));
    }
    setSelectedEvent(null);
    setResolveNotes('');
  };

  const activeCount = events.filter((e) => e.status === 'Active').length;
  const totalMinutesLost = events.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

  const columns = [
    {
      header: 'Incident ID',
      accessor: (e: DowntimeEvent) => <span className="font-mono font-bold text-[var(--color-primary)]">{e.id}</span>,
      sortable: true,
    },
    {
      header: 'Machine',
      accessor: (e: DowntimeEvent) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{e.machineId}</div>
          <div className="text-xs text-[var(--color-on-surface-variant)]">{e.stage}</div>
        </div>
      ),
    },
    {
      header: 'Category / Reason',
      accessor: (e: DowntimeEvent) => (
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]">
            {e.category}
          </span>
          <div className="text-xs text-[var(--color-on-surface-variant)] mt-1 max-w-xs truncate">{e.reason}</div>
        </div>
      ),
    },
    {
      header: 'Started At',
      accessor: (e: DowntimeEvent) => (
        <span className="text-xs font-mono">{new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      ),
    },
    {
      header: 'Duration',
      accessor: (e: DowntimeEvent) => (
        <span className="font-mono text-xs font-bold text-[var(--color-on-surface)]">
          {e.durationMinutes ? `${e.durationMinutes} mins` : 'Ongoing'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (e: DowntimeEvent) => <StatusBadge status={e.status === 'Active' ? 'Down' : 'Completed'} />,
    },
    {
      header: 'Actions',
      accessor: (e: DowntimeEvent) => (
        e.status === 'Active' ? (
          <button
            onClick={() => setSelectedEvent(e)}
            className="m3-btn m3-btn-primary text-xs py-1 px-3 bg-emerald-600 hover:bg-emerald-700"
          >
            Resolve
          </button>
        ) : (
          <button
            onClick={() => setSelectedEvent(e)}
            className="m3-btn m3-btn-tonal text-xs py-1 px-3"
          >
            Details
          </button>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Machine Downtime & Maintenance Tracker
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Log breakdowns, monitor root-cause Pareto trends, and track Mean Time to Repair (MTTR).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadEvents} className="m3-btn m3-btn-outlined text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowLogModal(true)} className="m3-btn m3-btn-primary text-sm bg-rose-600 hover:bg-rose-700">
            <Plus className="w-4 h-4" />
            Log Machine Stoppage
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Active Stoppages</div>
            <div className="text-2xl font-black text-rose-700">{activeCount} Machines</div>
          </div>
        </div>

        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Cumulative Loss (Today)</div>
            <div className="text-2xl font-black text-[var(--color-on-surface)]">{totalMinutesLost} Mins</div>
          </div>
        </div>

        <div className="m3-card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Plant OEE Availability</div>
            <div className="text-2xl font-black text-emerald-700">93.4%</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={events}
        columns={columns}
        keyExtractor={(e) => e.id}
        searchPlaceholder="Filter by machine ID, category, technician..."
        searchFilter={(e, q) =>
          e.id.toLowerCase().includes(q.toLowerCase()) ||
          e.machineId.toLowerCase().includes(q.toLowerCase()) ||
          e.category.toLowerCase().includes(q.toLowerCase()) ||
          (e.technician || '').toLowerCase().includes(q.toLowerCase())
        }
        loading={loading}
      />

      {/* Log Stoppage Modal */}
      <Modal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Report Machine Breakdown / Stoppage"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleLogDowntime} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Machine ID
            </label>
            <select
              className="m3-input font-bold"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            >
              <option value="LOOM-01">LOOM-01 (Rapier Loom)</option>
              <option value="LOOM-04">LOOM-04 (Air Jet Loom)</option>
              <option value="SPIN-01">SPIN-01 (Ring Frame)</option>
              <option value="DYE-02">DYE-02 (Jet Dyeing Vessel)</option>
              <option value="FIN-01">FIN-01 (Stenter Finishing)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Failure Root Category
            </label>
            <select
              className="m3-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="Mechanical">Mechanical (Belt, Gear, Loom Shaft)</option>
              <option value="Electrical">Electrical (Sensor, Drive Inverter, PLC)</option>
              <option value="Yarn Breakage">Yarn Breakage / Warp Stop Motion</option>
              <option value="Operator">Operator Setting / Beam Change</option>
              <option value="Scheduled Maintenance">Preventive Oil & Lube Maintenance</option>
              <option value="Power Outage">Power Grid Fluctuations</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Description / Symptoms
            </label>
            <textarea
              className="m3-input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Heald frame vibration warning triggered, warp wire snapped."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Assigned Maintenance Tech
            </label>
            <input
              type="text"
              className="m3-input"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-container-high)]">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className="m3-btn m3-btn-outlined"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="m3-btn m3-btn-primary bg-rose-600 hover:bg-rose-700"
            >
              Broadcast Downtime Alert
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Stoppage Modal */}
      {selectedEvent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
          title={`Incident ${selectedEvent.id} (${selectedEvent.machineId})`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-[var(--color-surface-container)] rounded-2xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Machine:</span>
                <span className="font-bold">{selectedEvent.machineId} ({selectedEvent.stage})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Category:</span>
                <span className="font-bold">{selectedEvent.category}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Stoppage Reason:</span>
                <span className="font-medium text-xs">{selectedEvent.reason}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-on-surface-variant)]">Reported At:</span>
                <span className="font-mono text-xs">{new Date(selectedEvent.startTime).toLocaleString()}</span>
              </div>
              {selectedEvent.resolution && (
                <div className="pt-2 border-t border-[var(--color-surface-container-high)]">
                  <span className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase block mb-1">
                    Recorded Resolution:
                  </span>
                  <p className="text-sm font-medium">{selectedEvent.resolution}</p>
                </div>
              )}
            </div>

            {selectedEvent.status === 'Active' && (
              <form onSubmit={handleResolveEvent} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                    Corrective Action & Root Cause Fix
                  </label>
                  <textarea
                    className="m3-input"
                    rows={3}
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Describe how the machine was repaired and recalibrated..."
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-surface-container-high)]">
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="m3-btn m3-btn-outlined"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="m3-btn m3-btn-primary bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Repair & Resume Loom
                  </button>
                </div>
              </form>
            )}

            {selectedEvent.status === 'Resolved' && (
              <div className="flex justify-end pt-3 border-t border-[var(--color-surface-container-high)]">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="m3-btn m3-btn-primary"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

const fallbackDowntime: DowntimeEvent[] = [
  {
    id: 'DT-104',
    machineId: 'LOOM-04',
    stage: 'Weaving',
    category: 'Yarn Breakage',
    reason: 'Warp yarn tension drop at spool 14, auto-cutoff triggered.',
    technician: 'Anil Sharma (Maintenance)',
    startTime: '2026-10-10T09:15:00Z',
    status: 'Active',
  },
  {
    id: 'DT-103',
    machineId: 'SPIN-01',
    stage: 'Spinning',
    category: 'Mechanical',
    reason: 'Roller bearing thermal threshold exceeded 75°C.',
    technician: 'Ramesh Patel',
    startTime: '2026-10-10T07:45:00Z',
    endTime: '2026-10-10T08:30:00Z',
    durationMinutes: 45,
    resolution: 'Replaced bearing lubricant and tightened drive belt alignment.',
    status: 'Resolved',
  },
  {
    id: 'DT-102',
    machineId: 'DYE-02',
    stage: 'Dyeing',
    category: 'Electrical',
    reason: 'Pressure relief sensor calibration error on main vessel.',
    technician: 'Vikas Gupta',
    startTime: '2026-10-09T14:10:00Z',
    endTime: '2026-10-09T14:50:00Z',
    durationMinutes: 40,
    resolution: 'Recalibrated PLC pressure transducer.',
    status: 'Resolved',
  },
];
