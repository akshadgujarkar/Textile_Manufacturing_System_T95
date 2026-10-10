import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, DollarSign, Plus, CheckCircle2, AlertTriangle, ArrowRight, X, CreditCard, RotateCcw, Building } from 'lucide-react';

export default function FinanceView() {
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'payments'
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [orders, setOrders] = useState([]);

  const [newInvoice, setNewInvoice] = useState({
    invoice_no: `INV-${Date.now().toString().slice(-6)}`,
    buyer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    tax_rate: '5.00',
    items: [
      {
        order_item_id: '1',
        hsn_code: '5208',
        quantity: '200',
        rate: '325.00',
      },
    ],
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_ref: `PAY-${Date.now().toString().slice(-6)}`,
    amount: '',
    mode: 'NEFT/RTGS',
    received_on: new Date().toISOString().split('T')[0],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, buyerRes, payRes, ordRes] = await Promise.all([
        api.getInvoices({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
        api.getBuyers().catch(() => ({ data: [] })),
        api.getBuyerPayments({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
        api.getCustomerOrders({ page: 1, pageSize: 50 }).catch(() => ({ data: [] })),
      ]);

      setInvoices(invRes.data || []);
      setBuyers(buyerRes.data || []);
      setPayments(payRes.data || []);
      setOrders(ordRes.data || []);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPaymentModal = (inv) => {
    setSelectedInvoice(inv);
    setPaymentForm({
      payment_ref: `PAY-${Date.now().toString().slice(-6)}`,
      amount: inv.outstanding_balance || inv.total_amount,
      mode: 'NEFT/RTGS',
      received_on: new Date().toISOString().split('T')[0],
    });
    setShowPaymentModal(true);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const generatedInvNo = newInvoice.invoice_no?.trim() || `INV-${Date.now().toString().slice(-6)}`;
      await api.createInvoice({
        invoice_no: generatedInvNo,
        buyer_id: parseInt(newInvoice.buyer_id),
        invoice_date: newInvoice.invoice_date,
        due_date: newInvoice.due_date || null,
        tax_rate: parseFloat(newInvoice.tax_rate || 5),
        items: newInvoice.items.map((i) => ({
          order_item_id: parseInt(i.order_item_id || 1),
          hsn_code: i.hsn_code || '5208',
          quantity: parseFloat(i.quantity),
          rate: parseFloat(i.rate),
        })),
      });

      setMsg({ type: 'success', text: `GST Tax invoice ${generatedInvNo} generated successfully with auto line-total precision!` });
      setShowInvoiceModal(false);
      setNewInvoice({
        invoice_no: `INV-${Date.now().toString().slice(-6)}`,
        buyer_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        tax_rate: '5.00',
        items: [{ order_item_id: '1', hsn_code: '5208', quantity: '200', rate: '325.00' }],
      });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create tax invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueInvoice = async (inv) => {
    const invId = inv.invoice_id || inv.id;
    try {
      await api.issueInvoice(invId, inv.version || 1);
      setMsg({ type: 'success', text: `Invoice ${inv.invoice_no || invId} officially issued to buyer!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to issue invoice' });
    }
  };

  const handleVoidInvoice = async (inv) => {
    const invId = inv.invoice_id || inv.id;
    if (!window.confirm(`Void tax invoice ${inv.invoice_no || invId}? This action cannot be undone.`)) return;
    try {
      await api.voidInvoice(invId, inv.version || 1);
      setMsg({ type: 'success', text: `Invoice ${inv.invoice_no || invId} marked as VOID.` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to void invoice' });
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSubmitting(true);
    setMsg(null);

    const clientRequestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    try {
      const payRef = paymentForm.payment_ref?.trim() || `PAY-${Date.now().toString().slice(-6)}`;
      await api.createBuyerPayment({
        payment_ref: payRef,
        invoice_id: selectedInvoice.invoice_id || selectedInvoice.id,
        buyer_id: selectedInvoice.buyer_id,
        amount: parseFloat(paymentForm.amount),
        mode: paymentForm.mode,
        received_on: paymentForm.received_on,
        client_request_id: clientRequestId,
        created_by_employee_id: 1,
      });

      setMsg({ type: 'success', text: `Payment ${payRef} of ₹${paymentForm.amount} reconciled against ${selectedInvoice.invoice_no}` });
      setShowPaymentModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to post buyer payment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReversePayment = async (paymentId) => {
    if (!window.confirm(`Reverse payment #${paymentId}? This will recalculate the invoice balance.`)) return;
    try {
      await api.reverseBuyerPayment(paymentId);
      setMsg({ type: 'success', text: `Payment #${paymentId} reversed and invoice balance updated!` });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to reverse payment' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            GST Invoicing & Accounts Receivable
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            GST compliant tax invoices, line total calculations, payments, and payment reversals.
          </p>
        </div>

        <button className="md-btn md-btn-primary flex items-center gap-2" onClick={() => setShowInvoiceModal(true)}>
          <Plus className="w-4 h-4" /> Generate GST Invoice
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--md-sys-color-outline-variant)]">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Tax Invoices ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Transactions ({payments.length})
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

      {/* Tab 1: Tax Invoices */}
      {activeTab === 'invoices' && (
        <div className="md-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Invoice No.</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Buyer</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Date / Due Date</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Subtotal</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">GST (5%)</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Total Amount</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Outstanding</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">Loading invoices...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">No tax invoices generated yet.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const invId = inv.invoice_id || inv.id;
                    const total = parseFloat(inv.total_amount) || 0;
                    const outstanding = parseFloat(inv.outstanding_balance || 0);

                    return (
                      <tr key={invId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                        <td className="p-4">
                          <div className="font-mono font-bold text-[var(--md-sys-color-primary)]">{inv.invoice_no || `INV-${invId}`}</div>
                          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">ID #{invId}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold">{inv.buyer_name || `Buyer #${inv.buyer_id}`}</div>
                          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{inv.buyer_code}</div>
                        </td>
                        <td className="p-4 text-xs">
                          <div>{inv.invoice_date?.split('T')[0] || inv.invoice_date}</div>
                          <div className="text-[var(--md-sys-color-on-surface-variant)]">
                            Due: {inv.due_date ? inv.due_date.split('T')[0] : '—'}
                          </div>
                        </td>
                        <td className="p-4 font-mono">₹{parseFloat(inv.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 font-mono">₹{parseFloat(inv.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">
                          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 font-mono font-bold">
                          <span className={outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            ₹{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'partial' || inv.status === 'partially_paid'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {inv.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.status === 'draft' && (
                              <button
                                className="md-btn md-btn-tonal text-xs py-1 px-2.5 flex items-center gap-1 text-blue-600 hover:bg-blue-50"
                                onClick={() => handleIssueInvoice(inv)}
                              >
                                <ArrowRight className="w-3.5 h-3.5" /> Issue
                              </button>
                            )}

                            {outstanding > 0 && inv.status !== 'void' && (
                              <button className="md-btn md-btn-primary text-xs py-1 px-2.5 flex items-center gap-1" onClick={() => openPaymentModal(inv)}>
                                <CreditCard className="w-3.5 h-3.5" /> Pay
                              </button>
                            )}

                            {inv.status !== 'void' && inv.status !== 'paid' && (
                              <button
                                className="md-btn md-btn-tonal text-xs py-1 px-2 flex items-center gap-1 text-rose-600 hover:bg-rose-50"
                                onClick={() => handleVoidInvoice(inv)}
                                title="Void Invoice"
                              >
                                Void
                              </button>
                            )}

                            {inv.status === 'paid' && (
                              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
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
      )}

      {/* Tab 2: Buyer Payment Ledger & Reversals */}
      {activeTab === 'payments' && (
        <div className="md-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Payment Ref</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Buyer</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Invoice Ref</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Payment Mode</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Amount (INR)</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Date</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                      No buyer payment transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const payId = p.id || p.payment_id;
                    return (
                      <tr key={payId} className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                        <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">
                          {p.payment_ref || `PAY-${payId}`}
                        </td>
                        <td className="p-4 font-semibold">{p.buyer_name || `Buyer #${p.buyer_id}`}</td>
                        <td className="p-4 font-mono text-xs">{p.invoice_no || `INV-${p.invoice_id}`}</td>
                        <td className="p-4 text-xs">{p.payment_mode || p.mode || 'NEFT/RTGS'}</td>
                        <td className="p-4 font-mono font-bold text-emerald-700">
                          ₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-xs">{p.payment_date?.split('T')[0] || p.received_on || 'Today'}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                              p.status === 'reversed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.status || 'recorded'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {p.status !== 'reversed' && (
                            <button
                              onClick={() => handleReversePayment(payId)}
                              className="md-btn md-btn-tonal text-xs py-1 px-2.5 flex items-center gap-1 text-rose-600 hover:bg-rose-50 ml-auto"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Void / Reverse
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

      {/* Generate Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Generate GST Tax Invoice
              </h2>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowInvoiceModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    className="md-input w-full font-mono text-xs"
                    value={newInvoice.invoice_no}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_no: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Target Buyer *</label>
                  <select
                    className="md-input w-full"
                    required
                    value={newInvoice.buyer_id}
                    onChange={(e) => setNewInvoice({ ...newInvoice, buyer_id: e.target.value })}
                  >
                    <option value="">Select Buyer...</option>
                    {buyers.map((b) => (
                      <option key={b.buyer_id || b.id} value={b.buyer_id || b.id}>
                        {b.name} ({b.buyer_code || b.code}) - GST: {b.gstin || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    className="md-input w-full"
                    value={newInvoice.invoice_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    className="md-input w-full"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Link Customer Order Item ID *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="md-input w-full font-mono text-xs"
                    placeholder="e.g. 1"
                    value={newInvoice.items[0].order_item_id}
                    onChange={(e) => {
                      const items = [...newInvoice.items];
                      items[0].order_item_id = e.target.value;
                      setNewInvoice({ ...newInvoice, items });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">GST Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="md-input w-full font-mono"
                    value={newInvoice.tax_rate}
                    onChange={(e) => setNewInvoice({ ...newInvoice, tax_rate: e.target.value })}
                  />
                </div>
              </div>

              <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] pt-2">
                Invoice Line Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">HSN Code</label>
                  <input
                    type="text"
                    required
                    className="md-input w-full font-mono text-xs"
                    value={newInvoice.items[0].hsn_code}
                    onChange={(e) => {
                      const items = [...newInvoice.items];
                      items[0].hsn_code = e.target.value;
                      setNewInvoice({ ...newInvoice, items });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">Quantity (m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="md-input w-full font-mono text-xs"
                    value={newInvoice.items[0].quantity}
                    onChange={(e) => {
                      const items = [...newInvoice.items];
                      items[0].quantity = e.target.value;
                      setNewInvoice({ ...newInvoice, items });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] mb-1">Unit Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="md-input w-full font-mono text-xs"
                    value={newInvoice.items[0].rate}
                    onChange={(e) => {
                      const items = [...newInvoice.items];
                      items[0].rate = e.target.value;
                      setNewInvoice({ ...newInvoice, items });
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowInvoiceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Generating...' : 'Create Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Buyer Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                  Record Payment: {selectedInvoice.invoice_no || `INV-${selectedInvoice.invoice_id || selectedInvoice.id}`}
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Buyer: {selectedInvoice.buyer_name} &bull; Outstanding: ₹{parseFloat(selectedInvoice.outstanding_balance || selectedInvoice.total_amount).toFixed(2)}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-lg font-bold" onClick={() => setShowPaymentModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  className="md-input w-full font-mono text-lg font-bold text-emerald-700"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Mode *</label>
                  <select
                    className="md-input w-full"
                    value={paymentForm.mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                  >
                    <option value="NEFT/RTGS">NEFT / RTGS Bank Transfer</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="UPI">UPI Instant</option>
                    <option value="LC">Letter of Credit (LC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    className="md-input w-full"
                    value={paymentForm.received_on}
                    onChange={(e) => setPaymentForm({ ...paymentForm, received_on: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Posting...' : 'Reconcile Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
