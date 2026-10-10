import React, { useState } from 'react';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { CreditCard, Plus, ArrowDownRight, RefreshCw, CheckCircle2 } from 'lucide-react';

interface PaymentReceipt {
  id: string;
  invoiceId: string;
  customerName: string;
  amount: number;
  paymentMode: 'NEFT/RTGS' | 'Cheque' | 'UPI' | 'LC (Letter of Credit)';
  referenceNumber: string;
  receiptDate: string;
  status: 'Reconciled' | 'Pending Clearing';
}

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentReceipt[]>(fallbackPayments);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [invoiceId, setInvoiceId] = useState<string>('INV-2026-109');
  const [customerName, setCustomerName] = useState<string>('Arvind Garments Division');
  const [amount, setAmount] = useState<number>(346000);
  const [paymentMode, setPaymentMode] = useState<PaymentReceipt['paymentMode']>('NEFT/RTGS');
  const [referenceNumber, setReferenceNumber] = useState<string>('HDFC9988771122');

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const newPayment: PaymentReceipt = {
      id: `RCT-2026-${Math.floor(100 + Math.random() * 900)}`,
      invoiceId,
      customerName,
      amount: Number(amount),
      paymentMode,
      referenceNumber,
      receiptDate: new Date().toISOString().split('T')[0],
      status: 'Reconciled',
    };
    setPayments((prev) => [newPayment, ...prev]);
    setShowModal(false);
  };

  const columns = [
    {
      header: 'Receipt ID',
      accessor: (p: PaymentReceipt) => <span className="font-mono font-bold text-[var(--color-primary)]">{p.id}</span>,
      sortable: true,
    },
    {
      header: 'Customer / Invoice',
      accessor: (p: PaymentReceipt) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{p.customerName}</div>
          <div className="text-xs font-mono text-[var(--color-on-surface-variant)]">{p.invoiceId}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Mode / Ref No.',
      accessor: (p: PaymentReceipt) => (
        <div>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-container)] text-[var(--color-on-surface)]">
            {p.paymentMode}
          </span>
          <div className="text-[11px] font-mono text-[var(--color-on-surface-variant)] mt-0.5">{p.referenceNumber}</div>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (p: PaymentReceipt) => <span className="text-xs font-mono">{p.receiptDate}</span>,
    },
    {
      header: 'Amount (INR)',
      accessor: (p: PaymentReceipt) => (
        <span className="font-mono font-bold text-sm text-emerald-700">
          +₹{p.amount.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (p: PaymentReceipt) => <StatusBadge status={p.status === 'Reconciled' ? 'Completed' : 'Pending'} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Customer Payments & Cash Inflow
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Record bank NEFT/RTGS collections, match invoices, and reconcile accounts receivable.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="m3-btn m3-btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Record Bank Receipt
        </button>
      </div>

      <DataTable
        data={payments}
        columns={columns}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search receipt, customer, UTR reference..."
        searchFilter={(p, q) =>
          p.id.toLowerCase().includes(q.toLowerCase()) ||
          p.customerName.toLowerCase().includes(q.toLowerCase()) ||
          p.referenceNumber.toLowerCase().includes(q.toLowerCase()) ||
          p.invoiceId.toLowerCase().includes(q.toLowerCase())
        }
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record Customer Payment Receipt"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Customer Name
            </label>
            <input
              type="text"
              className="m3-input font-bold"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Invoice Reference
              </label>
              <input
                type="text"
                className="m3-input font-mono"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Amount Received (₹)
              </label>
              <input
                type="number"
                className="m3-input font-mono font-bold"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Payment Mode
              </label>
              <select
                className="m3-input font-semibold"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
              >
                <option value="NEFT/RTGS">NEFT / RTGS</option>
                <option value="Cheque">Cheque Deposit</option>
                <option value="UPI">UPI Direct</option>
                <option value="LC (Letter of Credit)">Letter of Credit (LC)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Bank UTR / Cheque Ref
              </label>
              <input
                type="text"
                className="m3-input font-mono"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-surface-container-high)]">
            <button type="button" onClick={() => setShowModal(false)} className="m3-btn m3-btn-outlined">
              Cancel
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              Post Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const fallbackPayments: PaymentReceipt[] = [
  {
    id: 'RCT-2026-081',
    invoiceId: 'INV-2026-108',
    customerName: 'Raymond Apparels Ltd',
    amount: 399000,
    paymentMode: 'NEFT/RTGS',
    referenceNumber: 'AXIS9912048123',
    receiptDate: '2026-10-10',
    status: 'Reconciled',
  },
  {
    id: 'RCT-2026-082',
    invoiceId: 'INV-2026-109',
    customerName: 'Arvind Garments Division',
    amount: 200000,
    paymentMode: 'NEFT/RTGS',
    referenceNumber: 'HDFC1092837482',
    receiptDate: '2026-10-10',
    status: 'Reconciled',
  },
];
