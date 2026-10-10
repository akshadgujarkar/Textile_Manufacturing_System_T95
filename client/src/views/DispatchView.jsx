import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Truck, Plus, Scan, CheckCircle2, AlertTriangle, ArrowRight, X, ShieldAlert, Package, Trash2, Layers, RotateCcw } from 'lucide-react';

export default function DispatchView() {
  const [dispatches, setDispatches] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [scanRollId, setScanRollId] = useState('');

  const [newDispatch, setNewDispatch] = useState({
    buyer_id: '',
    order_id: '',
    invoice_id: '',
    vehicle_no: 'MH-12-TX-9988',
    driver_name: 'Ramesh Yadav',
    driver_phone: '+91-9822011223',
    destination: 'Nhava Sheva Port CFS',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dispRes, buyerRes, orderRes, invRes, rollRes] = await Promise.all([
        api.getDispatches({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
        api.getBuyers().catch(() => ({ data: [] })),
        api.getCustomerOrders().catch(() => ({ data: [] })),
        api.getInvoices().catch(() => ({ data: [] })),
        api.getFabricRolls().catch(() => ({ data: [] })),
      ]);

      setDispatches(dispRes.data || []);
      setBuyers(buyerRes.data || []);
      setOrders(orderRes.data || []);
      setInvoices(invRes.data || []);
      setRolls(rollRes.data || []);
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    if (!newDispatch.buyer_id || !newDispatch.order_id) {
      alert('Please select a buyer and order');
      return;
    }
    setSubmitting(true);
    setMsg(null);

    const dispatchNo = `DISP-${Date.now().toString().slice(-6)}`;

    try {
      await api.createDispatch({
        dispatch_no: dispatchNo, // Fix: required by validator
        buyer_id: parseInt(newDispatch.buyer_id),
        order_id: parseInt(newDispatch.order_id),
        invoice_id: newDispatch.invoice_id ? parseInt(newDispatch.invoice_id) : undefined,
        vehicle_no: newDispatch.vehicle_no || 'MH-12-TX-9988',
        driver_name: newDispatch.driver_name || 'Driver',
        driver_phone: newDispatch.driver_phone || '+91-9822011223',
        destination: newDispatch.destination || 'Factory Gate Outward',
      });

      setMsg({ type: 'success', text: `Dispatch manifest ${dispatchNo} generated successfully!` });
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create dispatch' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanRoll = async (e) => {
    e.preventDefault();
    if (!selectedDispatch || !scanRollId) return;
    setSubmitting(true);
    setMsg(null);

    try {
      const dispatchId = selectedDispatch.dispatch_id || selectedDispatch.id;
      await api.addDispatchItem(dispatchId, parseInt(scanRollId), 1);
      setMsg({ type: 'success', text: `Roll #${scanRollId} scanned & locked to manifest ${selectedDispatch.dispatch_no || dispatchId}` });
      setShowScanModal(false);
      setScanRollId('');
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Double-dispatch collision or scan error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!selectedDispatch) return;
    if (!window.confirm('Remove this roll from dispatch manifest?')) return;
    try {
      const dispatchId = selectedDispatch.dispatch_id || selectedDispatch.id;
      await api.removeDispatchItem(dispatchId, itemId);
      setMsg({ type: 'success', text: `Roll removed from manifest and released back to stock.` });
      setShowItemsModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to remove roll' });
    }
  };

  const handleFinalizeGateDeparture = async (dispatch) => {
    const dispatchId = dispatch.dispatch_id || dispatch.id;
    if (!window.confirm(`Finalize and release transport gate pass for Manifest #${dispatch.dispatch_no || dispatchId}?`)) return;
    try {
      await api.finalizeDispatch(dispatchId, dispatch.version || 1);
      setMsg({ type: 'success', text: `Manifest #${dispatch.dispatch_no || dispatchId} finalized and released through factory gate!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to finalize dispatch' });
    }
  };

  const handleCancelManifest = async (dispatch) => {
    const dispatchId = dispatch.dispatch_id || dispatch.id;
    if (!window.confirm(`Cancel Dispatch Manifest #${dispatch.dispatch_no || dispatchId}?`)) return;
    try {
      await api.cancelDispatch(dispatchId, dispatch.version || 1);
      setMsg({ type: 'success', text: `Manifest #${dispatch.dispatch_no || dispatchId} cancelled and scanned rolls released.` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to cancel dispatch' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <Truck className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Logistics & Transport Dispatches
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Roll barcode scanning, double-dispatch lock protection, gate passes, and manifest release.
          </p>
        </div>

        <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Create Dispatch Manifest
        </button>
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

      {/* Dispatches Table */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Manifest No.</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Buyer / Order</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Vehicle & Driver</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Destination</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Scanned Rolls</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    Loading dispatches...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    No dispatch manifests recorded.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => {
                  const dispatchId = d.dispatch_id || d.id;
                  const statusColors = {
                    draft: 'bg-slate-100 text-slate-800',
                    loading: 'bg-amber-100 text-amber-800',
                    dispatched: 'bg-emerald-100 text-emerald-800',
                    cancelled: 'bg-rose-100 text-rose-800',
                  };

                  return (
                    <tr key={dispatchId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-[var(--md-sys-color-primary)]">
                          {d.dispatch_no || `DISP-${dispatchId}`}
                        </div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">ID #{dispatchId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{d.buyer_name || `Buyer #${d.buyer_id}`}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          Order: {d.order_no || d.order_id} {d.invoice_no ? `• Inv: ${d.invoice_no}` : ''}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold">{d.vehicle_no || 'Vehicle Pending'}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {d.driver_name || 'Driver'} ({d.driver_phone || 'N/A'})
                        </div>
                      </td>
                      <td className="p-4">{d.destination || 'Port / CFS'}</td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedDispatch(d);
                            setShowItemsModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-[var(--md-sys-color-primary)] border border-purple-200 rounded-full text-xs font-bold hover:bg-purple-100 transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" />
                          {d.items?.length || d.active_roll_count || 0} Rolls
                        </button>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            statusColors[d.status] || 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {d.status !== 'dispatched' && d.status !== 'cancelled' && (
                            <>
                              <button
                                className="md-btn md-btn-tonal text-xs py-1 px-2.5 flex items-center gap-1"
                                onClick={() => {
                                  setSelectedDispatch(d);
                                  setShowScanModal(true);
                                }}
                              >
                                <Scan className="w-3.5 h-3.5" /> Scan Roll
                              </button>
                              <button
                                className="md-btn md-btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                                onClick={() => handleFinalizeGateDeparture(d)}
                              >
                                <Truck className="w-3.5 h-3.5" /> Release Gate
                              </button>
                              <button
                                className="md-btn md-btn-tonal text-xs py-1 px-2 text-rose-600 hover:bg-rose-50"
                                onClick={() => handleCancelManifest(d)}
                                title="Cancel manifest"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {d.status === 'dispatched' && (
                            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Released
                            </span>
                          )}
                          {d.status === 'cancelled' && (
                            <span className="text-xs text-rose-700 font-semibold">
                              Cancelled
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

      {/* Scanned Items Breakdown Drawer / Modal */}
      {showItemsModal && selectedDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  Manifest Rolls: {selectedDispatch.dispatch_no || `DISP-${selectedDispatch.dispatch_id || selectedDispatch.id}`}
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Vehicle: {selectedDispatch.vehicle_no} &bull; Destination: {selectedDispatch.destination}
                </p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                    <th className="p-3 uppercase font-semibold">Roll Code</th>
                    <th className="p-3 uppercase font-semibold">Length (m)</th>
                    <th className="p-3 uppercase font-semibold">Weight (kg)</th>
                    <th className="p-3 uppercase font-semibold">Grade</th>
                    <th className="p-3 uppercase font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {(!selectedDispatch.items || selectedDispatch.items.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">
                        No rolls scanned yet. Click "Scan Roll" to add rolls to this manifest.
                      </td>
                    </tr>
                  ) : (
                    selectedDispatch.items.map((item) => {
                      const itemId = item.dispatch_item_id || item.id;
                      return (
                        <tr key={itemId} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-[var(--md-sys-color-primary)]">
                            {item.roll_code || `ROL-${item.roll_id}`}
                          </td>
                          <td className="p-3 font-mono">{item.length_m || '200.0'} m</td>
                          <td className="p-3 font-mono">{item.weight_kg || '35.0'} kg</td>
                          <td className="p-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              {item.grade || 'Grade A'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {selectedDispatch.status !== 'dispatched' && (
                              <button
                                onClick={() => handleRemoveItem(itemId)}
                                className="text-red-500 hover:text-red-700 font-bold p-1"
                                title="Remove from manifest"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
              <button type="button" onClick={() => setShowItemsModal(false)} className="md-btn md-btn-tonal">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Dispatch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Truck className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                New Transport Dispatch Manifest
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Target Buyer *</label>
                <select
                  className="md-input w-full"
                  required
                  value={newDispatch.buyer_id}
                  onChange={(e) => setNewDispatch({ ...newDispatch, buyer_id: e.target.value })}
                >
                  <option value="">Select Buyer...</option>
                  {buyers.map((b) => {
                    const bId = b.buyer_id || b.id;
                    return (
                      <option key={bId} value={bId}>
                        {b.name} ({b.buyer_code || b.code})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Customer Order *</label>
                  <select
                    className="md-input w-full"
                    required
                    value={newDispatch.order_id}
                    onChange={(e) => setNewDispatch({ ...newDispatch, order_id: e.target.value })}
                  >
                    <option value="">Select Order...</option>
                    {orders.map((o) => {
                      const oId = o.order_id || o.id;
                      return (
                        <option key={oId} value={oId}>
                          {o.order_no} ({o.buyer_name || 'Buyer'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Linked Tax Invoice</label>
                  <select
                    className="md-input w-full"
                    value={newDispatch.invoice_id}
                    onChange={(e) => setNewDispatch({ ...newDispatch, invoice_id: e.target.value })}
                  >
                    <option value="">Select Invoice (Optional)...</option>
                    {invoices.map((inv) => {
                      const invId = inv.invoice_id || inv.id;
                      return (
                        <option key={invId} value={invId}>
                          {inv.invoice_no} (₹{parseFloat(inv.total_amount).toFixed(2)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. MH-12-TX-9988"
                    value={newDispatch.vehicle_no}
                    onChange={(e) => setNewDispatch({ ...newDispatch, vehicle_no: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Destination / CFS *</label>
                  <input
                    type="text"
                    required
                    className="md-input w-full"
                    placeholder="e.g. Nhava Sheva CFS Port"
                    value={newDispatch.destination}
                    onChange={(e) => setNewDispatch({ ...newDispatch, destination: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Driver Name</label>
                  <input
                    type="text"
                    className="md-input w-full"
                    placeholder="e.g. Ramesh Yadav"
                    value={newDispatch.driver_name}
                    onChange={(e) => setNewDispatch({ ...newDispatch, driver_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Driver Phone</label>
                  <input
                    type="text"
                    className="md-input w-full"
                    placeholder="e.g. +91-9822011223"
                    value={newDispatch.driver_phone}
                    onChange={(e) => setNewDispatch({ ...newDispatch, driver_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Manifest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner / Scan Roll Modal */}
      {showScanModal && selectedDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Scan className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  Scan Roll: {selectedDispatch.dispatch_no || `DISP-${selectedDispatch.dispatch_id || selectedDispatch.id}`}
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Vehicle: {selectedDispatch.vehicle_no} &bull; Destination: {selectedDispatch.destination}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowScanModal(false)}>
                ✕
              </button>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600" />
              <div className="text-xs">
                <strong>Double-Dispatch Protection:</strong> Any roll already assigned to an ongoing dispatch will be rejected by the MySQL virtual unique index constraint.
              </div>
            </div>

            <form onSubmit={handleScanRoll} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Select Fabric Roll to Scan *</label>
                <select
                  className="md-input w-full"
                  required
                  value={scanRollId}
                  onChange={(e) => setScanRollId(e.target.value)}
                >
                  <option value="">Select Roll Barcode...</option>
                  {rolls.map((r) => {
                    const rollId = r.roll_id || r.id;
                    const rollCode = r.roll_code || r.barcode || `ROL-${rollId}`;
                    return (
                      <option key={rollId} value={rollId}>
                        {rollCode} ({parseFloat(r.length_m || r.length_meters || 0).toFixed(1)}m, {parseFloat(r.weight_kg || 0).toFixed(1)}kg) - Status: {r.status}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowScanModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Scanning...' : 'Add to Manifest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
