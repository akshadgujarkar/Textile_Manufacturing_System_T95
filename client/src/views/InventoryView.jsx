import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Layers, Plus, History, AlertCircle, CheckCircle2, ArrowDownRight, ArrowUpRight, X, RotateCcw } from 'lucide-react';

export default function InventoryView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [formData, setFormData] = useState({
    yarn_item_id: '',
    movement_type: 'receipt',
    quantity: '',
    unit_cost: '',
    reason: '',
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.getYarnItems({ page: 1, pageSize: 50 });
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openLedger = async (item) => {
    setSelectedItem(item);
    setLedgerLoading(true);
    try {
      const res = await api.getYarnItemLedger(item.yarn_item_id || item.id);
      setLedger(res.data || []);
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleCreateMovement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      await api.createYarnStockMovement({
        yarn_item_id: parseInt(formData.yarn_item_id),
        movement_type: formData.movement_type,
        quantity: parseFloat(formData.quantity),
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
        reason: formData.reason || 'Manual ledger adjustment',
        created_by_employee_id: 1, // Fix: matched to created_by_employee_id in validator
      });

      setMsg({ type: 'success', text: 'Stock movement recorded successfully into double-entry ledger!' });
      setShowMovementModal(false);
      setFormData({ yarn_item_id: '', movement_type: 'receipt', quantity: '', unit_cost: '', reason: '' });
      fetchInventory();
      if (selectedItem) {
        openLedger(selectedItem);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to record movement' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseMovement = async (movementId) => {
    const reason = window.prompt('Enter reason for movement reversal:');
    if (!reason) return;
    try {
      await api.reverseYarnStockMovement(movementId, {
        reason,
        created_by_employee_id: 1,
      });
      setMsg({ type: 'success', text: `Movement #${movementId} successfully reversed in ledger!` });
      fetchInventory();
      if (selectedItem) {
        openLedger(selectedItem);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to reverse movement' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <Layers className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Raw Material Yarn Inventory
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Append-only double-entry stock ledger. Balances strictly calculated from transaction movements.
          </p>
        </div>

        <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => setShowMovementModal(true)}>
          <Plus className="w-4 h-4" /> Record Stock Movement
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
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{msg.text}</span>
        </div>
      )}

      {/* Yarn SKUs Table */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">SKU / Yarn Type</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Color & Code</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Unit</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Reorder Level</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Current Stock</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    No yarn items found.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const itemId = item.yarn_item_id || item.id;
                  const currentStock = parseFloat(item.current_stock || item.current_stock_qty || 0);
                  const isLow = currentStock <= parseFloat(item.reorder_level || 0);

                  return (
                    <tr key={itemId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      <td className="p-4">
                        <strong className="text-[var(--md-sys-color-on-surface)]">{item.yarn_type_name || item.name}</strong>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">SKU #{itemId}</div>
                      </td>
                      <td className="p-4">
                        <div>{item.colour_name}</div>
                        <span className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)]">{item.colour_code}</span>
                      </td>
                      <td className="p-4 font-mono">{item.unit_code || 'kg'}</td>
                      <td className="p-4 font-mono">{parseFloat(item.reorder_level || 0).toFixed(1)}</td>
                      <td className="p-4 font-mono font-bold">
                        <span className={isLow ? 'text-rose-600' : 'text-emerald-700'}>
                          {currentStock.toFixed(2)} kg
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLow ? 'Reorder Alert' : 'Healthy Stock'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          className="md-btn md-btn-tonal text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                          onClick={() => openLedger(item)}
                        >
                          <History className="w-3.5 h-3.5" /> View Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  Stock Ledger: {selectedItem.yarn_type_name || selectedItem.name} ({selectedItem.colour_name})
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  SKU #{selectedItem.yarn_item_id || selectedItem.id} &bull; Reorder Level: {selectedItem.reorder_level} kg
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setSelectedItem(null)}>
                ✕
              </button>
            </div>

            {ledgerLoading ? (
              <div className="p-8 text-center text-slate-500">Loading double-entry ledger transactions...</div>
            ) : !ledger || ledger.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No stock movements recorded for this SKU.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                      <th className="p-3 uppercase font-semibold">Date & Time</th>
                      <th className="p-3 uppercase font-semibold">Type</th>
                      <th className="p-3 uppercase font-semibold">Quantity</th>
                      <th className="p-3 uppercase font-semibold">Unit Cost</th>
                      <th className="p-3 uppercase font-semibold">Reason / Reference</th>
                      <th className="p-3 uppercase font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] font-mono">
                    {ledger.map((m) => {
                      const qty = parseFloat(m.quantity || 0);
                      const isPositive = qty > 0;
                      return (
                        <tr key={m.movement_id || m.id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{new Date(m.created_at || m.timestamp || Date.now()).toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {m.movement_type}
                            </span>
                          </td>
                          <td className={`p-3 font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isPositive ? `+${qty.toFixed(2)}` : qty.toFixed(2)} kg
                          </td>
                          <td className="p-3">₹{parseFloat(m.unit_cost || 0).toFixed(2)}</td>
                          <td className="p-3 font-sans text-slate-700">{m.reason || 'Standard movement'}</td>
                          <td className="p-3 text-right">
                            {m.movement_type !== 'reversal' && (
                              <button
                                onClick={() => handleReverseMovement(m.movement_id || m.id)}
                                className="text-rose-600 hover:text-rose-800 font-sans font-bold flex items-center gap-1 ml-auto"
                                title="Reverse movement"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
              <button type="button" className="md-btn md-btn-tonal" onClick={() => setSelectedItem(null)}>
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Stock Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Record Stock Movement
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowMovementModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Target Yarn SKU *</label>
                <select
                  className="md-input w-full"
                  required
                  value={formData.yarn_item_id}
                  onChange={(e) => setFormData({ ...formData, yarn_item_id: e.target.value })}
                >
                  <option value="">Select Yarn SKU...</option>
                  {items.map((it) => {
                    const itemId = it.yarn_item_id || it.id;
                    return (
                      <option key={itemId} value={itemId}>
                        {it.yarn_type_name || it.name} ({it.colour_name || it.colour_code}) - Stock: {parseFloat(it.current_stock || it.current_stock_qty || 0).toFixed(1)} kg
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Movement Type *</label>
                  <select
                    className="md-input w-full"
                    value={formData.movement_type}
                    onChange={(e) => setFormData({ ...formData, movement_type: e.target.value })}
                  >
                    <option value="receipt">receipt (Inward +)</option>
                    <option value="issue">issue (Issue to Production -)</option>
                    <option value="return">return (Shopfloor Return +)</option>
                    <option value="adjustment">adjustment (Audit Correction +/-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Quantity (kg) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. 250.00"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Unit Cost (₹ / kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="md-input w-full font-mono"
                  placeholder="e.g. 250.00"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Reason / Journal Reference</label>
                <input
                  type="text"
                  className="md-input w-full"
                  placeholder="e.g. Manual warehouse stock verification"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowMovementModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Commit to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
