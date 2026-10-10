import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Invoice } from '../../types';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { FileText, Plus, RefreshCw, Download, CheckCircle, CreditCard } from 'lucide-react';

export const InvoicingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New Invoice Form
  const [customerName, setCustomerName] = useState<string>('Raymond Apparels Ltd');
  const [customerGstin, setCustomerGstin] = useState<string>('27AAACR1234F1Z5');
  const [orderId, setOrderId] = useState<string>('ORD-2026-001');
  const [subtotal, setSubtotal] = useState<number>(380000);
  const [taxRate, setTaxRate] = useState<number>(5); // 5% GST for textiles

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.finance.getInvoices();
      if (res.data && res.data.length > 0) {
        setInvoices(res.data);
      } else {
        setInvoices(fallbackInvoices);
      }
    } catch {
      setInvoices(fallbackInvoices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const newInv: Invoice = {
      id: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      orderId,
      customerName,
      customerGstin,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      subtotal,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      status: 'Issued',
    };

    try {
      await api.finance.createInvoice(newInv);
      setInvoices((prev) => [newInv, ...prev]);
    } catch {
      setInvoices((prev) => [newInv, ...prev]);
    }
    setShowCreateModal(false);
  };

  const columns = [
    {
      header: 'Invoice No.',
      accessor: (inv: Invoice) => (
        <span className="font-mono font-bold text-[var(--color-primary)]">{inv.id}</span>
      ),
      sortable: true,
    },
    {
      header: 'Buyer / GSTIN',
      accessor: (inv: Invoice) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{inv.customerName}</div>
          <div className="text-[11px] font-mono text-[var(--color-on-surface-variant)]">{inv.customerGstin}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Order Ref',
      accessor: (inv: Invoice) => <span className="font-mono text-xs">{inv.orderId}</span>,
    },
    {
      header: 'Date / Due',
      accessor: (inv: Invoice) => (
        <div className="text-xs">
          <div>{inv.invoiceDate}</div>
          <div className="text-[11px] text-[var(--color-on-surface-variant)]">Due: {inv.dueDate}</div>
        </div>
      ),
    },
    {
      header: 'Tax (5% GST)',
      accessor: (inv: Invoice) => (
        <span className="font-mono text-xs text-[var(--color-on-surface-variant)]">
          ₹{(inv.taxAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Total Amount',
      accessor: (inv: Invoice) => (
        <span className="font-mono font-bold text-sm text-[var(--color-on-surface)]">
          ₹{(inv.totalAmount || inv.total_amount || 0).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Payment Status',
      accessor: (inv: Invoice) => <StatusBadge status={inv.status} />,
    },
    {
      header: 'Action',
      accessor: (inv: Invoice) => (
        <button
          onClick={() => setSelectedInvoice(inv)}
          className="m3-btn m3-btn-tonal text-xs py-1 px-3"
        >
          View Tax Doc
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
            GST Tax Invoicing & Accounts Receivable
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Issue textile GST invoices, calculate HSN 5208 5% GST, and track buyer payments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadInvoices} className="m3-btn m3-btn-outlined text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="m3-btn m3-btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Generate GST Invoice
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={invoices}
        columns={columns}
        keyExtractor={(i) => i.id || i.invoice_no || 'invoice'}
        searchPlaceholder="Search invoice no, buyer, GSTIN..."
        searchFilter={(i, q) =>
          (i.id || '').toLowerCase().includes(q.toLowerCase()) ||
          (i.customerName || '').toLowerCase().includes(q.toLowerCase()) ||
          (i.customerGstin || '').toLowerCase().includes(q.toLowerCase()) ||
          (i.orderId || '').toLowerCase().includes(q.toLowerCase())
        }
        loading={loading}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Generate Commercial Tax Invoice (GST)"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Customer / Buyer Name
            </label>
            <input
              type="text"
              className="m3-input font-bold"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Buyer GSTIN
              </label>
              <input
                type="text"
                className="m3-input font-mono uppercase"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Order Reference
              </label>
              <input
                type="text"
                className="m3-input font-mono"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Taxable Subtotal (₹)
              </label>
              <input
                type="number"
                className="m3-input font-mono font-bold"
                value={subtotal}
                onChange={(e) => setSubtotal(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                GST Rate (%)
              </label>
              <select
                className="m3-input font-bold"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              >
                <option value={5}>5% (Textile Woven Fabric HSN 5208)</option>
                <option value={12}>12% (Apparel & Made-ups)</option>
                <option value={18}>18% (Technical / Synthetic)</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-[var(--color-surface-container)] rounded-2xl space-y-1">
            <div className="flex justify-between text-xs text-[var(--color-on-surface-variant)]">
              <span>Taxable Value:</span>
              <span className="font-mono">₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--color-on-surface-variant)]">
              <span>GST ({taxRate}%):</span>
              <span className="font-mono">₹{Math.round((subtotal * taxRate) / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-[var(--color-primary)] pt-1 border-t border-[var(--color-surface-container-high)]">
              <span>Grand Total:</span>
              <span className="font-mono">₹{(subtotal + Math.round((subtotal * taxRate) / 100)).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-surface-container-high)]">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="m3-btn m3-btn-outlined"
            >
              Cancel
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              Issue Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`GST Tax Invoice: ${selectedInvoice.id}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl text-zinc-900 space-y-4 shadow-sm">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[var(--color-primary)]">
                    EVEREST TEXTILE MILLS LTD
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Plot 45-48, Industrial Area Phase II, Surat, Gujarat - 395002
                  </p>
                  <p className="text-xs font-mono text-zinc-500">
                    GSTIN: 24AAACE9912K1ZQ | CIN: U17111GJ2015PLC089200
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase bg-purple-100 text-purple-900 px-3 py-1 rounded-full">
                    Tax Invoice
                  </span>
                  <div className="text-lg font-bold font-mono mt-1 text-[var(--color-primary)]">
                    {selectedInvoice.id}
                  </div>
                  <div className="text-xs text-zinc-500">Date: {selectedInvoice.invoiceDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-zinc-500 uppercase mb-0.5">Billed To (Customer):</div>
                  <div className="font-bold text-sm">{selectedInvoice.customerName}</div>
                  <div className="font-mono text-zinc-600">GSTIN: {selectedInvoice.customerGstin}</div>
                  <div className="text-zinc-600">Ref: {selectedInvoice.orderId}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-zinc-500 uppercase mb-0.5">Payment Terms:</div>
                  <div>Net 30 Days</div>
                  <div className="text-zinc-600">Due Date: {selectedInvoice.dueDate}</div>
                  <div className="font-bold text-purple-700 mt-1">Status: {selectedInvoice.status}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-zinc-600 border-b">
                    <tr>
                      <th className="py-2 text-left">Description</th>
                      <th className="py-2 text-center">HSN</th>
                      <th className="py-2 text-right">Taxable Amount</th>
                      <th className="py-2 text-right">GST</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 font-medium">100% Cotton Woven Greige Fabric (Grade A)</td>
                      <td className="py-3 text-center font-mono">5208</td>
                      <td className="py-3 text-right font-mono">₹{(selectedInvoice.subtotal || 0).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono">₹{(selectedInvoice.taxAmount || 0).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono font-bold">₹{(selectedInvoice.totalAmount || 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t font-bold text-base">
                <span>Total Payable (INR):</span>
                <span className="text-lg font-mono text-[var(--color-primary)]">
                  ₹{(selectedInvoice.totalAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="m3-btn m3-btn-outlined text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
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

const fallbackInvoices: Invoice[] = [
  {
    id: 'INV-2026-108',
    orderId: 'ORD-2026-001',
    customerName: 'Raymond Apparels Ltd',
    customerGstin: '27AAACR1234F1Z5',
    invoiceDate: '2026-10-10',
    dueDate: '2026-11-09',
    subtotal: 380000,
    taxAmount: 19000,
    totalAmount: 399000,
    paidAmount: 399000,
    status: 'Paid',
  },
  {
    id: 'INV-2026-109',
    orderId: 'ORD-2026-002',
    customerName: 'Arvind Garments Division',
    customerGstin: '24AAACA9876G1Z2',
    invoiceDate: '2026-10-10',
    dueDate: '2026-11-09',
    subtotal: 520000,
    taxAmount: 26000,
    totalAmount: 546000,
    paidAmount: 200000,
    status: 'Partial',
  },
  {
    id: 'INV-2026-110',
    orderId: 'ORD-2026-003',
    customerName: 'Welspun India Export Corp',
    customerGstin: '27AAACW5544B1ZV',
    invoiceDate: '2026-10-09',
    dueDate: '2026-11-08',
    subtotal: 290000,
    taxAmount: 14500,
    totalAmount: 304500,
    paidAmount: 0,
    status: 'Issued',
  },
];
