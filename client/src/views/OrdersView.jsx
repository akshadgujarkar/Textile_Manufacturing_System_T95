import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShoppingBag, Plus, Layers, CheckCircle2, AlertCircle, Calendar, User, FileText, X, ShieldCheck, Truck, ShoppingCart } from 'lucide-react';

export default function OrdersView() {
  const [orders, setOrders] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [products, setProducts] = useState([]);
  const [yarns, setYarns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [showSufficiencyModal, setShowSufficiencyModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sufficiencyData, setSufficiencyData] = useState(null);
  const [checkingSufficiency, setCheckingSufficiency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [newOrder, setNewOrder] = useState({
    buyer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    promised_delivery_date: '',
    items: [
      {
        product_id: '',
        ordered_qty: '2000',
        agreed_rate: '325.00',
        colour_code: 'RAW-WHT',
        unit_id: 2, // Meters
      },
    ],
  });

  const [bomData, setBomData] = useState({
    order_item_id: '',
    yarn_item_id: '',
    required_qty: '400',
    waste_factor_pct: '2.5',
    reserved_qty: '400',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderRes, buyerRes, prodRes, yarnRes] = await Promise.all([
        api.getCustomerOrders({ page: 1, pageSize: 50 }),
        api.getBuyers(),
        api.getFabricProducts(),
        api.getYarnItems(),
      ]);

      setOrders(orderRes.data || []);
      setBuyers(buyerRes.data || []);
      setProducts(prodRes.data || []);
      setYarns(yarnRes.data || []);
    } catch (err) {
      console.error('Failed to load orders data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenSufficiency = async (order) => {
    setSelectedOrder(order);
    setShowSufficiencyModal(true);
    setCheckingSufficiency(true);
    setSufficiencyData(null);
    try {
      const res = await api.checkMaterialSufficiency(order.order_id || order.id);
      setSufficiencyData(res.data);
    } catch (err) {
      alert(`Failed to check material sufficiency: ${err.message}`);
      setShowSufficiencyModal(false);
    } finally {
      setCheckingSufficiency(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.buyer_id || !newOrder.items[0].product_id) {
      alert('Please select a buyer and fabric product');
      return;
    }
    setSubmitting(true);
    setMsg(null);

    const orderNo = `SO-${Date.now().toString().slice(-6)}`;

    try {
      await api.createCustomerOrder({
        order_no: orderNo,
        buyer_id: parseInt(newOrder.buyer_id),
        order_date: newOrder.order_date,
        promised_delivery_date: newOrder.promised_delivery_date || null,
        created_by_employee_id: 1, // Fix: matched to validator
        items: newOrder.items.map((item, idx) => ({
          line_no: idx + 1, // Fix: required by orderItemInputSchema
          product_id: parseInt(item.product_id),
          ordered_qty: parseFloat(item.ordered_qty),
          agreed_rate: parseFloat(item.agreed_rate),
          colour_code: item.colour_code || 'RAW-WHT',
          unit_id: parseInt(item.unit_id || 2),
        })),
      });

      setMsg({ type: 'success', text: `Sales Order ${orderNo} created successfully with line item specifications!` });
      setShowCreateModal(false);
      setNewOrder({
        buyer_id: '',
        order_date: new Date().toISOString().split('T')[0],
        promised_delivery_date: '',
        items: [{ product_id: '', ordered_qty: '2000', agreed_rate: '325.00', colour_code: 'RAW-WHT', unit_id: 2 }],
      });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create sales order' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBom = async (e) => {
    e.preventDefault();
    if (!bomData.order_item_id || !bomData.yarn_item_id) {
      alert('Please select Order Item ID and Yarn SKU');
      return;
    }
    setSubmitting(true);

    try {
      await api.createOrderMaterialRequirement({
        order_item_id: parseInt(bomData.order_item_id),
        yarn_item_id: parseInt(bomData.yarn_item_id),
        required_qty: parseFloat(bomData.required_qty),
        waste_factor_pct: parseFloat(bomData.waste_factor_pct || 0),
        reserved_qty: parseFloat(bomData.reserved_qty || 0),
      });

      setMsg({ type: 'success', text: 'BOM material requirement allocated and stock reserved successfully!' });
      setShowBomModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to allocate material' });
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
            <ShoppingBag className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Customer Orders & Material Requirements (BOM)
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Sales order contracts, fabric meterage requirements, and real-time yarn stock shortfall checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="md-btn md-btn-tonal flex items-center gap-2" onClick={() => setShowBomModal(true)}>
            <Layers className="w-4 h-4" /> Allocate BOM Yarn
          </button>
          <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> Create Sales Order
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
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{msg.text}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Order Number</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Buyer</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Order Date</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Promised Delivery</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Order Value</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">Loading customer orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">No sales orders recorded.</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const orderId = o.order_id || o.id;
                  return (
                    <tr key={orderId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                      <td className="p-4">
                        <div className="font-mono font-bold text-[var(--md-sys-color-primary)]">{o.order_no}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">ID #{orderId}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold">{o.buyer_name}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Code: {o.buyer_code}</div>
                      </td>
                      <td className="p-4 text-xs">{new Date(o.order_date).toLocaleDateString()}</td>
                      <td className="p-4 text-xs">
                        <span className="font-medium">
                          {o.promised_delivery_date ? new Date(o.promised_delivery_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">
                        ₹{parseFloat(o.total_order_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            o.status === 'in_production'
                              ? 'bg-purple-100 text-purple-800'
                              : o.status === 'dispatched'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenSufficiency(o)}
                          className="md-btn md-btn-tonal text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Check Yarn Stock
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

      {/* Material Sufficiency & Shortfall Check Modal */}
      {showSufficiencyModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  Yarn Sufficiency Check: {selectedOrder.order_no}
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Buyer: {selectedOrder.buyer_name} &bull; Delivery: {selectedOrder.promised_delivery_date ? new Date(selectedOrder.promised_delivery_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <button onClick={() => setShowSufficiencyModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            {checkingSufficiency ? (
              <div className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                <p className="text-sm font-medium">Calculating stock reserves and open purchase orders...</p>
              </div>
            ) : !sufficiencyData || !sufficiencyData.items || sufficiencyData.items.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No BOM material requirements registered for this sales order yet. Click "Allocate BOM Yarn" to link required yarn SKUs.
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  sufficiencyData.all_sufficient
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {sufficiencyData.all_sufficient ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  )}
                  <div className="text-xs">
                    <strong className="block font-bold">
                      {sufficiencyData.all_sufficient ? 'All Yarn Materials Sufficient for Production' : 'Material Shortfall Detected — Vendor Purchase Required'}
                    </strong>
                    {sufficiencyData.all_sufficient
                      ? 'You have adequate free on-hand stock or active purchase orders to fulfill this entire weaving order.'
                      : 'Free on-hand stock and active open POs are insufficient. Raise a purchase order for the shortfall.'}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                        <th className="p-3 uppercase font-semibold">Yarn SKU</th>
                        <th className="p-3 uppercase font-semibold">Required (kg)</th>
                        <th className="p-3 uppercase font-semibold">Free Stock (kg)</th>
                        <th className="p-3 uppercase font-semibold">Open POs (kg)</th>
                        <th className="p-3 uppercase font-semibold">Must-Buy Shortfall</th>
                        <th className="p-3 uppercase font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                      {sufficiencyData.items.map((it) => {
                        const mustBuy = parseFloat(it.must_buy || 0);
                        const isSufficient = mustBuy <= 0;
                        return (
                          <tr key={it.requirement_id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <div className="font-semibold">{it.yarn_type_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{it.yarn_colour_name} ({it.yarn_colour_code})</div>
                            </td>
                            <td className="p-3 font-mono font-bold">{parseFloat(it.required_qty).toFixed(2)}</td>
                            <td className="p-3 font-mono text-blue-700">{parseFloat(it.free_stock).toFixed(2)}</td>
                            <td className="p-3 font-mono text-purple-700">{parseFloat(it.on_order_po).toFixed(2)}</td>
                            <td className="p-3 font-mono font-bold text-rose-700">
                              {mustBuy > 0 ? `${mustBuy.toFixed(2)} kg` : '0.00 kg'}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isSufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isSufficient ? 'Sufficient' : 'Shortfall'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
              <button type="button" onClick={() => setShowSufficiencyModal(false)} className="md-btn md-btn-tonal">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                New Customer Sales Order
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Target Buyer Client *</label>
                <select
                  className="md-input w-full"
                  required
                  value={newOrder.buyer_id}
                  onChange={(e) => setNewOrder({ ...newOrder, buyer_id: e.target.value })}
                >
                  <option value="">Select Buyer...</option>
                  {buyers.map((b) => {
                    const buyerId = b.buyer_id || b.id;
                    return (
                      <option key={buyerId} value={buyerId}>
                        {b.name} ({b.buyer_code || b.code}) - GST: {b.gstin || 'N/A'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Order Date *</label>
                  <input
                    type="date"
                    required
                    className="md-input w-full"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({ ...newOrder, order_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Promised Delivery Date *</label>
                  <input
                    type="date"
                    required
                    className="md-input w-full"
                    value={newOrder.promised_delivery_date}
                    onChange={(e) => setNewOrder({ ...newOrder, promised_delivery_date: e.target.value })}
                  />
                </div>
              </div>

              <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] pt-2">
                Order Line Item Specification
              </h3>

              <div>
                <label className="block text-xs font-medium mb-1">Fabric Product *</label>
                <select
                  className="md-input w-full"
                  required
                  value={newOrder.items[0].product_id}
                  onChange={(e) => {
                    const items = [...newOrder.items];
                    items[0].product_id = e.target.value;
                    setNewOrder({ ...newOrder, items });
                  }}
                >
                  <option value="">Select Fabric Product...</option>
                  {products.map((p) => {
                    const prodId = p.product_id || p.id;
                    return (
                      <option key={prodId} value={prodId}>
                        {p.name} ({p.product_code || p.code}) - {p.weave_type} {p.nominal_gsm || p.gsm} GSM
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Ordered Length (Meters) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. 2000"
                    value={newOrder.items[0].ordered_qty}
                    onChange={(e) => {
                      const items = [...newOrder.items];
                      items[0].ordered_qty = e.target.value;
                      setNewOrder({ ...newOrder, items });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Agreed Rate (₹ / Meter) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. 325.00"
                    value={newOrder.items[0].agreed_rate}
                    onChange={(e) => {
                      const items = [...newOrder.items];
                      items[0].agreed_rate = e.target.value;
                      setNewOrder({ ...newOrder, items });
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Creating Order...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate BOM Modal */}
      {showBomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Allocate BOM Material Requirement
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowBomModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Order Item ID *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="md-input w-full font-mono"
                  placeholder="Order Item ID (e.g. 1)"
                  value={bomData.order_item_id}
                  onChange={(e) => setBomData({ ...bomData, order_item_id: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Raw Material Yarn SKU *</label>
                <select
                  className="md-input w-full"
                  required
                  value={bomData.yarn_item_id}
                  onChange={(e) => setBomData({ ...bomData, yarn_item_id: e.target.value })}
                >
                  <option value="">Select Yarn SKU...</option>
                  {yarns.map((y) => {
                    const yId = y.yarn_item_id || y.id;
                    return (
                      <option key={yId} value={yId}>
                        {y.yarn_type_name || y.name} ({y.colour_name || y.colour_code}) - Stock: {parseFloat(y.current_stock || 0).toFixed(1)} kg
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Required Qty (kg) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    className="md-input w-full font-mono"
                    placeholder="e.g. 400"
                    value={bomData.required_qty}
                    onChange={(e) => setBomData({ ...bomData, required_qty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Planned Waste Factor (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="md-input w-full font-mono"
                    placeholder="e.g. 2.5"
                    value={bomData.waste_factor_pct}
                    onChange={(e) => setBomData({ ...bomData, waste_factor_pct: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Reserved Qty (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="md-input w-full font-mono"
                  placeholder="e.g. 400"
                  value={bomData.reserved_qty}
                  onChange={(e) => setBomData({ ...bomData, reserved_qty: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowBomModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Allocating...' : 'Reserve BOM Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
