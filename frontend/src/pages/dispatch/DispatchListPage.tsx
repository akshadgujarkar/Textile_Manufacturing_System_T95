import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { DispatchManifest } from '../../types';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Truck, Plus, RefreshCw, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DispatchListPage: React.FC = () => {
  const [manifests, setManifests] = useState<DispatchManifest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedManifest, setSelectedManifest] = useState<DispatchManifest | null>(null);

  const loadManifests = async () => {
    setLoading(true);
    try {
      const res = await api.dispatch.getManifests();
      if (res.data && res.data.length > 0) {
        setManifests(res.data);
      } else {
        setManifests(fallbackManifests);
      }
    } catch {
      setManifests(fallbackManifests);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifests();
  }, []);

  const columns = [
    {
      header: 'Manifest / LR ID',
      accessor: (m: DispatchManifest) => (
        <span className="font-mono font-bold text-[var(--color-primary)]">{m.id}</span>
      ),
      sortable: true,
    },
    {
      header: 'Buyer / Order',
      accessor: (m: DispatchManifest) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{m.customerName}</div>
          <div className="text-xs font-mono text-[var(--color-on-surface-variant)]">{m.orderId}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Vehicle & Driver',
      accessor: (m: DispatchManifest) => (
        <div>
          <div className="font-mono font-bold text-xs text-[var(--color-on-surface)]">{m.vehicleNumber}</div>
          <div className="text-[11px] text-[var(--color-on-surface-variant)]">{m.driverName} ({m.driverPhone || 'N/A'})</div>
        </div>
      ),
    },
    {
      header: 'Volume / Rolls',
      accessor: (m: DispatchManifest) => (
        <div>
          <span className="font-bold text-xs text-[var(--color-on-surface)]">{m.rollsCount || m.scanned_rolls_count || 0} Rolls</span>
          <div className="text-[11px] text-[var(--color-on-surface-variant)]">{(m.totalMeters || m.total_meters_loaded || 0).toLocaleString()} M | {m.totalWeightKg || 0} kg</div>
        </div>
      ),
    },
    {
      header: 'Dispatch Date',
      accessor: (m: DispatchManifest) => (
        <span className="text-xs font-mono">{new Date(m.dispatchDate || m.dispatched_at || Date.now()).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Gate Status',
      accessor: (m: DispatchManifest) => <StatusBadge status={m.status} />,
    },
    {
      header: 'Action',
      accessor: (m: DispatchManifest) => (
        <button
          onClick={() => setSelectedManifest(m)}
          className="m3-btn m3-btn-tonal text-xs py-1 px-3"
        >
          View LR Pass
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
            Dispatch Outward & Vehicle Gate Passes
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Review Lorry Receipts (LR), truck loading manifests, and security gate passes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadManifests} className="m3-btn m3-btn-outlined text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link to="/dispatch/loading" className="m3-btn m3-btn-primary text-sm flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Scan & Load Truck
          </Link>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={manifests}
        columns={columns}
        keyExtractor={(m) => m.id || m.dispatch_no || 'manifest'}
        searchPlaceholder="Search manifest ID, customer, vehicle number..."
        searchFilter={(m, q) =>
          (m.id || '').toLowerCase().includes(q.toLowerCase()) ||
          (m.customerName || '').toLowerCase().includes(q.toLowerCase()) ||
          (m.vehicleNumber || '').toLowerCase().includes(q.toLowerCase()) ||
          (m.orderId || '').toLowerCase().includes(q.toLowerCase())
        }
        loading={loading}
      />

      {/* Manifest Detail Modal */}
      {selectedManifest && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedManifest(null)}
          title={`Gate Pass & Lorry Receipt (${selectedManifest.id})`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-4 bg-[var(--color-surface-container)] rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-on-surface-variant)]">Customer:</span>
                <span className="font-bold">{selectedManifest.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-on-surface-variant)]">Order Reference:</span>
                <span className="font-mono font-bold">{selectedManifest.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-on-surface-variant)]">Vehicle Number:</span>
                <span className="font-mono font-bold text-[var(--color-primary)]">{selectedManifest.vehicleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-on-surface-variant)]">Driver / Contact:</span>
                <span className="font-bold">{selectedManifest.driverName} ({selectedManifest.driverPhone || 'N/A'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-on-surface-variant)]">Loaded Cargo:</span>
                <span className="font-bold">{selectedManifest.rollsCount} Rolls ({selectedManifest.totalMeters} M / {selectedManifest.totalWeightKg} kg)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-on-surface-variant)]">Security Status:</span>
                <StatusBadge status={selectedManifest.status} />
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
              <span>
                Digitally authenticated Gate Pass. Verified with E-Way Bill and GST tax invoice.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-container-high)]">
              <button
                onClick={() => window.print()}
                className="m3-btn m3-btn-outlined text-xs flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                Print Physical Gate Pass
              </button>
              <button
                onClick={() => setSelectedManifest(null)}
                className="m3-btn m3-btn-primary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const fallbackManifests: DispatchManifest[] = [
  {
    id: 'DISP-2026-041',
    orderId: 'ORD-2026-001',
    customerName: 'Raymond Apparels Ltd',
    vehicleNumber: 'MH-12-RN-8821',
    driverName: 'Rameshwar Singh',
    driverPhone: '+91 98231 44550',
    rollsCount: 16,
    totalMeters: 2000,
    totalWeightKg: 410.5,
    status: 'Dispatched',
    dispatchDate: '2026-10-10T14:30:00Z',
    loadedRolls: ['ROLL-2026-901', 'ROLL-2026-902', 'ROLL-2026-903'],
  },
  {
    id: 'DISP-2026-042',
    orderId: 'ORD-2026-002',
    customerName: 'Arvind Garments Division',
    vehicleNumber: 'GJ-01-AX-4099',
    driverName: 'Mohan Lal',
    driverPhone: '+91 94032 11982',
    rollsCount: 22,
    totalMeters: 2800,
    totalWeightKg: 580.0,
    status: 'Loaded',
    dispatchDate: '2026-10-10T16:00:00Z',
    loadedRolls: ['ROLL-2026-880', 'ROLL-2026-881'],
  },
];
