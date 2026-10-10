import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Calendar,
  Building,
  ArrowRight,
  ShieldCheck,
  FileText,
  RotateCcw,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function ProcurementView() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'grns'
  const [pos, setPos] = useState([]);
  const [grns, setGrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [yarnItems, setYarnItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Modals
  const [showPoModal, setShowPoModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);

  // Form States
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    notes: '',
    items: [{ yarn_item_id: '', quantity: 500, agreed_rate: 250 }]
  });

  const [grnForm, setGrnForm] = useState({
    purchase_order_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    supplier_delivery_note: '',
    vehicle_number: '',
    received_by_employee_id: 1,
    notes: '',
    items: []
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [posRes, grnsRes, supRes, yarnRes] = await Promise.all([
        api.getPurchaseOrders().catch(() => ({ data: [] })),
        api.getGoodsReceipts().catch(() => ({ data: [] })),
        api.getSuppliers().catch(() => ({ data: [] })),
        api.getYarnItems().catch(() => ({ data: [] }))
      ]);

      setPos(posRes.data || []);
      setGrns(grnsRes.data || []);
      setSuppliers(supRes.data || []);
      setYarnItems(yarnRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle PO Creation
  const handleAddItemRow = () => {
    setPoForm({
      ...poForm,
      items: [...poForm.items, { yarn_item_id: '', quantity: 500, agreed_rate: 250 }]
    });
  };

  const handleRemoveItemRow = (idx) => {
    const updated = poForm.items.filter((_, i) => i !== idx);
    setPoForm({ ...poForm, items: updated });
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...poForm.items];
    updated[idx][field] = field === 'yarn_item_id' ? Number(val) : Number(val);
    setPoForm({ ...poForm, items: updated });
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!poForm.supplier_id || poForm.items.length === 0) {
      alert('Please select a supplier and add at least one item');
      return;
    }
    try {
      setSubmitting(true);
      const poNo = `PO-${Date.now().toString().slice(-6)}`;
      await api.createPurchaseOrder({
        po_no: poNo,
        supplier_id: Number(poForm.supplier_id),
        order_date: poForm.order_date,
        expected_delivery_date: poForm.expected_delivery_date || null,
        created_by: 1,
        items: poForm.items.map(it => ({
          yarn_item_id: Number(it.yarn_item_id),
          quantity: Number(it.quantity),
          agreed_rate: Number(it.agreed_rate || it.unit_price || 250)
        }))
      });
      setShowPoModal(false);
      setPoForm({
        supplier_id: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        notes: '',
        items: [{ yarn_item_id: '', quantity: 500, agreed_rate: 250 }]
      });
      loadData();
    } catch (err) {
      alert(`Failed to create PO: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open GRN Inward Modal for a PO
  const handleOpenGrnForPo = (po) => {
    setSelectedPo(po);
    const poItems = po.items || [];
    const defaultYarnId = poItems[0]?.yarn_item_id || yarnItems[0]?.yarn_item_id || yarnItems[0]?.id || 1;
    
    const initialItems = poItems.map(item => ({
      purchase_order_item_id: item.po_item_id || item.id,
      yarn_item_id: item.yarn_item_id,
      yarn_item_name: item.yarn_type_name || item.yarn_item_name || `Yarn #${item.yarn_item_id}`,
      lot_number: `LOT-${Date.now().toString().slice(-6)}`,
      gross_weight: Number(item.quantity || 500),
      tare_weight: 5,
      net_quantity: Math.max(0, Number(item.quantity || 500) - 5),
      unit_cost: Number(item.agreed_rate || 250),
      storage_location: 'BAY-A1'
    }));

    setGrnForm({
      purchase_order_id: po.po_id || po.id,
      supplier_id: po.supplier_id,
      receipt_date: new Date().toISOString().split('T')[0],
      supplier_delivery_note: `DN-${Date.now().toString().slice(-5)}`,
      vehicle_number: 'MH-12-TX-8821',
      received_by_employee_id: 1,
      notes: `Inward for PO #${po.po_no || po.id}`,
      items: initialItems.length > 0 ? initialItems : [
        {
          purchase_order_item_id: null,
          yarn_item_id: defaultYarnId,
          yarn_item_name: yarnItems[0]?.yarn_type_name || '100% Combed Cotton',
          lot_number: `LOT-${Date.now().toString().slice(-6)}`,
          gross_weight: 500,
          tare_weight: 5,
          net_quantity: 495,
          unit_cost: 250,
          storage_location: 'BAY-A1'
        }
      ]
    });
    setShowGrnModal(true);
  };

  const handleGrnItemChange = (idx, field, val) => {
    const updated = [...grnForm.items];
    updated[idx][field] = val;
    if (field === 'gross_weight' || field === 'tare_weight') {
      const gross = Number(field === 'gross_weight' ? val : updated[idx].gross_weight) || 0;
      const tare = Number(field === 'tare_weight' ? val : updated[idx].tare_weight) || 0;
      updated[idx].net_quantity = Math.max(0, gross - tare);
    }
    setGrnForm({ ...grnForm, items: updated });
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    if (grnForm.items.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    const clientRequestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    const supplierId = grnForm.supplier_id || selectedPo?.supplier_id || suppliers[0]?.supplier_id || suppliers[0]?.id || 1;
    const receiptNo = `GRN-${Date.now().toString().slice(-6)}`;

    try {
      setSubmitting(true);
      await api.createGoodsReceipt({
        receipt_no: receiptNo,
        supplier_id: Number(supplierId),
        po_id: grnForm.purchase_order_id ? Number(grnForm.purchase_order_id) : null,
        supplier_challan_no: grnForm.supplier_delivery_note || `CH-${Date.now().toString().slice(-6)}`,
        vehicle_number: grnForm.vehicle_number || 'MH-12-TX-8821',
        received_by_employee_id: Number(grnForm.received_by_employee_id || 1),
        client_request_id: clientRequestId,
        items: grnForm.items.map(it => ({
          yarn_item_id: Number(it.yarn_item_id),
          lot_code: it.lot_number || `LOT-${Date.now().toString().slice(-6)}`,
          quantity_received: Number(it.net_quantity),
          unit_cost: Number(it.unit_cost || 250),
          storage_location: it.storage_location || 'BAY-A1'
        }))
      });
      setShowGrnModal(false);
      setActiveTab('grns');
      loadData();
    } catch (err) {
      alert(`Failed to inward GRN: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelGrn = async (grnId) => {
    const reason = window.prompt('Enter reason for Goods Receipt cancellation (ledger stock will be rolled back):');
    if (!reason) return;
    try {
      await api.cancelGoodsReceipt(grnId, { reason, employee_id: 1 });
      alert(`Goods Receipt #${grnId} cancelled and stock movement rolled back!`);
      loadData();
    } catch (err) {
      alert(`Failed to cancel GRN: ${err.message}`);
    }
  };

  const handleSendPo = async (poId) => {
    try {
      await api.updatePurchaseOrderStatus(poId, 'sent');
      loadData();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const filteredPos = pos.filter(p =>
    (p.po_no || p.po_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredGrns = grns.filter(g =>
    (g.receipt_no || g.grn_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.supplier_challan_no || g.supplier_delivery_note || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.vehicle_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Procurement & Goods Inward
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Manage raw material purchase orders, vendor deliveries, and gate pass inward lot creation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="md-btn md-btn-tonal flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {activeTab === 'pos' ? (
            <button
              onClick={() => setShowPoModal(true)}
              className="md-btn md-btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          ) : (
            <button
              onClick={() => {
                setSelectedPo(null);
                const defaultYarn = yarnItems[0]?.yarn_item_id || yarnItems[0]?.id || 1;
                setGrnForm({
                  purchase_order_id: '',
                  supplier_id: suppliers[0]?.supplier_id || suppliers[0]?.id || 1,
                  receipt_date: new Date().toISOString().split('T')[0],
                  supplier_delivery_note: `DN-${Date.now().toString().slice(-5)}`,
                  vehicle_number: 'MH-12-TX-8821',
                  received_by_employee_id: 1,
                  notes: 'Direct Inward Gate Pass',
                  items: [
                    {
                      purchase_order_item_id: null,
                      yarn_item_id: defaultYarn,
                      yarn_item_name: yarnItems[0]?.yarn_type_name || 'Yarn SKU',
                      lot_number: `LOT-${Date.now().toString().slice(-6)}`,
                      gross_weight: 500,
                      tare_weight: 5,
                      net_quantity: 495,
                      unit_cost: 250,
                      storage_location: 'BAY-A1'
                    }
                  ]
                });
                setShowGrnModal(true);
              }}
              className="md-btn md-btn-primary flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Direct Inward GRN
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--md-sys-color-outline-variant)]">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'pos'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Orders ({pos.length})
        </button>

        <button
          onClick={() => setActiveTab('grns')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'grns'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <Truck className="w-4 h-4" />
          Goods Receipts / Inward GRN ({grns.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="md-card p-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-[var(--md-sys-color-outline)]" />
        <input
          type="text"
          placeholder={activeTab === 'pos' ? 'Search by PO number or supplier...' : 'Search by GRN number, delivery note, or vehicle...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm text-[var(--md-sys-color-on-surface)] outline-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Tab 1: Purchase Orders */}
      {activeTab === 'pos' && (
        <div className="md-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">PO Number</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Supplier</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Order Date</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Expected Delivery</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Total Amount</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {filteredPos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                      No purchase orders found. Click "+ New Purchase Order" to raise a vendor order.
                    </td>
                  </tr>
                ) : (
                  filteredPos.map((po) => {
                    const poId = po.po_id || po.id;
                    const statusColors = {
                      draft: 'bg-slate-100 text-slate-700',
                      sent: 'bg-purple-100 text-purple-800',
                      partially_received: 'bg-amber-100 text-amber-800',
                      closed: 'bg-emerald-100 text-emerald-800',
                      cancelled: 'bg-rose-100 text-rose-800'
                    };

                    return (
                      <tr key={poId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                        <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">
                          {po.po_no || `PO-${poId}`}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold">{po.supplier_name || `Supplier #${po.supplier_id}`}</div>
                          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{po.supplier_code}</div>
                        </td>
                        <td className="p-4">{po.order_date?.split('T')[0] || po.order_date}</td>
                        <td className="p-4 text-[var(--md-sys-color-on-surface-variant)]">
                          {po.expected_delivery_date?.split('T')[0] || 'Flexible'}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusColors[po.status] || 'bg-slate-100 text-slate-800'}`}>
                            {po.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-semibold">
                          ₹{Number(po.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {po.status === 'draft' && (
                              <button
                                onClick={() => handleSendPo(poId)}
                                className="md-btn md-btn-tonal text-xs py-1 px-2.5"
                              >
                                Send to Vendor
                              </button>
                            )}
                            {po.status !== 'closed' && po.status !== 'cancelled' && (
                              <button
                                onClick={() => handleOpenGrnForPo(po)}
                                className="md-btn md-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                Receive Inward
                              </button>
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
      )}

      {/* Tab 2: Goods Receipts (GRN) */}
      {activeTab === 'grns' && (
        <div className="md-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Receipt No</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Receipt Date</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Supplier / PO Ref</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Challan / Vehicle</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Total Received (kg)</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                      No Goods Receipts found. Create an inward gate pass from an open Purchase Order.
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map((grn) => {
                    const grnId = grn.receipt_id || grn.id;
                    const isCancelled = grn.status === 'cancelled';
                    return (
                      <tr key={grnId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                        <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">
                          {grn.receipt_no || `GRN-${grnId}`}
                        </td>
                        <td className="p-4">{grn.receipt_date?.split('T')[0] || grn.receipt_date}</td>
                        <td className="p-4">
                          <div className="font-semibold">{grn.supplier_name || `Supplier #${grn.supplier_id}`}</div>
                          <div className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)]">
                            {grn.po_no || (grn.po_id ? `PO-${grn.po_id}` : 'Direct Receipt')}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{grn.supplier_challan_no || 'N/A'}</div>
                          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">{grn.vehicle_number || 'Internal'}</div>
                        </td>
                        <td className="p-4 font-mono font-semibold">
                          {Number(grn.total_received_kg || grn.total_quantity || 0).toLocaleString()} kg
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isCancelled ? 'Cancelled / Reversed' : 'Stock Inwarded'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelGrn(grnId)}
                              className="md-btn md-btn-tonal text-xs py-1 px-2.5 text-rose-600 hover:bg-rose-50 ml-auto flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Cancel GRN
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
        </div>
      )}

      {/* Modal 1: Create Purchase Order */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Raise Purchase Order
              </h2>
              <button
                onClick={() => setShowPoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Supplier *
                  </label>
                  <select
                    value={poForm.supplier_id}
                    onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                    required
                    className="md-input w-full"
                  >
                    <option value="">Select Vendor...</option>
                    {suppliers.map(s => {
                      const supId = s.supplier_id || s.id;
                      return (
                        <option key={supId} value={supId}>
                          {s.name} ({s.code || s.supplier_code}) - GSTIN: {s.gstin || 'N/A'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={poForm.order_date}
                    onChange={(e) => setPoForm({ ...poForm, order_date: e.target.value })}
                    required
                    className="md-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poForm.expected_delivery_date}
                    onChange={(e) => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                    className="md-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Procurement Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ring spun high strength yarn"
                    value={poForm.notes}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                    className="md-input w-full"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                    Yarn Line Items ({poForm.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-[var(--md-sys-color-primary)] flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add SKU Row
                  </button>
                </div>

                {poForm.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-[var(--md-sys-color-surface-container-low)] rounded-2xl flex flex-col md:flex-row items-center gap-3">
                    <div className="flex-1 w-full">
                      <select
                        value={it.yarn_item_id}
                        onChange={(e) => handleItemChange(idx, 'yarn_item_id', e.target.value)}
                        required
                        className="md-input w-full text-xs"
                      >
                        <option value="">Select Yarn SKU...</option>
                        {yarnItems.map(y => {
                          const yarnId = y.yarn_item_id || y.id;
                          return (
                            <option key={yarnId} value={yarnId}>
                              {y.yarn_type_name || y.name} ({y.colour_name || y.colour_code}) - SKU #{yarnId}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="w-full md:w-32">
                      <input
                        type="number"
                        placeholder="Qty (kg)"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                        min="1"
                        className="md-input w-full text-xs font-mono"
                      />
                    </div>

                    <div className="w-full md:w-32">
                      <input
                        type="number"
                        placeholder="₹ / kg"
                        value={it.agreed_rate}
                        onChange={(e) => handleItemChange(idx, 'agreed_rate', e.target.value)}
                        required
                        min="0"
                        step="0.01"
                        className="md-input w-full text-xs font-mono"
                      />
                    </div>

                    {poForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="md-btn md-btn-tonal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="md-btn md-btn-primary flex items-center gap-2"
                >
                  {submitting ? 'Generating PO...' : 'Confirm & Issue PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Inward Goods Receipt (GRN) */}
      {showGrnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Truck className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Goods Inward Gate Pass (GRN)
              </h2>
              <button
                onClick={() => setShowGrnModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    value={grnForm.receipt_date}
                    onChange={(e) => setGrnForm({ ...grnForm, receipt_date: e.target.value })}
                    required
                    className="md-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Delivery Note / Challan No. *
                  </label>
                  <input
                    type="text"
                    value={grnForm.supplier_delivery_note}
                    onChange={(e) => setGrnForm({ ...grnForm, supplier_delivery_note: e.target.value })}
                    required
                    className="md-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MH-12-TX-8821"
                    value={grnForm.vehicle_number}
                    onChange={(e) => setGrnForm({ ...grnForm, vehicle_number: e.target.value })}
                    className="md-input w-full"
                  />
                </div>
              </div>

              {/* Inward Items */}
              <div className="space-y-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                  Inward Lots & Weight Measurement ({grnForm.items.length})
                </h3>

                {grnForm.items.map((it, idx) => (
                  <div key={idx} className="p-4 bg-[var(--md-sys-color-surface-container-low)] rounded-2xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Yarn Item SKU *
                        </label>
                        <select
                          value={it.yarn_item_id}
                          onChange={(e) => handleGrnItemChange(idx, 'yarn_item_id', e.target.value)}
                          required
                          className="md-input w-full text-xs"
                        >
                          {yarnItems.map(y => {
                            const yId = y.yarn_item_id || y.id;
                            return (
                              <option key={yId} value={yId}>
                                {y.yarn_type_name || y.name} ({y.colour_name || y.colour_code})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Assigned Lot Code *
                        </label>
                        <input
                          type="text"
                          value={it.lot_number}
                          onChange={(e) => handleGrnItemChange(idx, 'lot_number', e.target.value)}
                          required
                          className="md-input w-full text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Storage Bay *
                        </label>
                        <input
                          type="text"
                          value={it.storage_location}
                          onChange={(e) => handleGrnItemChange(idx, 'storage_location', e.target.value)}
                          required
                          placeholder="e.g. BAY-A1"
                          className="md-input w-full text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Gross Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={it.gross_weight}
                          onChange={(e) => handleGrnItemChange(idx, 'gross_weight', e.target.value)}
                          required
                          min="0"
                          step="0.01"
                          className="md-input w-full text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Tare Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={it.tare_weight}
                          onChange={(e) => handleGrnItemChange(idx, 'tare_weight', e.target.value)}
                          required
                          min="0"
                          step="0.01"
                          className="md-input w-full text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">
                          Net Quantity Received (kg)
                        </label>
                        <input
                          type="number"
                          value={it.net_quantity}
                          readOnly
                          className="md-input w-full text-xs font-mono bg-slate-100 font-bold text-emerald-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="md-btn md-btn-tonal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="md-btn md-btn-primary flex items-center gap-2"
                >
                  {submitting ? 'Inwarding Stock...' : 'Confirm Inward Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
