import React, { useState } from 'react';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ShoppingCart, Plus, CheckCircle } from 'lucide-react';

interface SupplierBill {
  id: string;
  supplierName: string;
  grnNumber: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  status: 'Pending Approval' | 'Approved' | 'Paid';
}

export const SupplierBillsPage: React.FC = () => {
  const [bills, setBills] = useState<SupplierBill[]>(fallbackBills);
  const [showModal, setShowModal] = useState<boolean>(false);

  const [supplierName, setSupplierName] = useState<string>('Vardhman Textiles Ltd');
  const [grnNumber, setGrnNumber] = useState<string>('GRN-2026-088');
  const [billNumber, setBillNumber] = useState<string>('VARD-OCT-991');
  const [amount, setAmount] = useState<number>(1400000);

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    const tax = Math.round(amount * 0.05);
    const newBill: SupplierBill = {
      id: `AP-2026-${Math.floor(100 + Math.random() * 900)}`,
      supplierName,
      grnNumber,
      billNumber,
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
      amount: amount + tax,
      taxAmount: tax,
      status: 'Approved',
    };
    setBills((prev) => [newBill, ...prev]);
    setShowModal(false);
  };

  const columns = [
    {
      header: 'Voucher ID',
      accessor: (b: SupplierBill) => <span className="font-mono font-bold text-[var(--color-primary)]">{b.id}</span>,
      sortable: true,
    },
    {
      header: 'Supplier / Invoice No.',
      accessor: (b: SupplierBill) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{b.supplierName}</div>
          <div className="text-xs font-mono text-[var(--color-on-surface-variant)]">Bill: {b.billNumber}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Matched GRN',
      accessor: (b: SupplierBill) => <span className="font-mono text-xs font-bold">{b.grnNumber}</span>,
    },
    {
      header: 'Due Date',
      accessor: (b: SupplierBill) => <span className="text-xs font-mono">{b.dueDate}</span>,
    },
    {
      header: 'Payable Amount',
      accessor: (b: SupplierBill) => (
        <span className="font-mono font-bold text-sm text-[var(--color-on-surface)]">
          ₹{b.amount.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (b: SupplierBill) => <StatusBadge status={b.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Supplier Purchase Bills & Accounts Payable
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            3-way match raw yarn vendor invoices against physical warehouse GRN receipts.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="m3-btn m3-btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Enter Supplier Bill
        </button>
      </div>

      <DataTable
        data={bills}
        columns={columns}
        keyExtractor={(b) => b.id}
        searchPlaceholder="Search supplier, GRN, bill number..."
        searchFilter={(b, q) =>
          b.supplierName.toLowerCase().includes(q.toLowerCase()) ||
          b.grnNumber.toLowerCase().includes(q.toLowerCase()) ||
          b.billNumber.toLowerCase().includes(q.toLowerCase())
        }
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record Supplier Purchase Voucher"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Yarn Spinner / Supplier
            </label>
            <input
              type="text"
              className="m3-input font-bold"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Warehouse GRN Ref
              </label>
              <input
                type="text"
                className="m3-input font-mono"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
                Vendor Bill No.
              </label>
              <input
                type="text"
                className="m3-input font-mono"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Taxable Amount (₹)
            </label>
            <input
              type="number"
              className="m3-input font-mono font-bold"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-surface-container-high)]">
            <button type="button" onClick={() => setShowModal(false)} className="m3-btn m3-btn-outlined">
              Cancel
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              Approve & Post Bill
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const fallbackBills: SupplierBill[] = [
  {
    id: 'AP-2026-041',
    supplierName: 'Vardhman Textiles Ltd',
    grnNumber: 'GRN-2026-088',
    billNumber: 'VARD-OCT-991',
    billDate: '2026-10-08',
    dueDate: '2026-11-22',
    amount: 1470000,
    taxAmount: 70000,
    status: 'Approved',
  },
  {
    id: 'AP-2026-042',
    supplierName: 'Alok Industries Spinning Division',
    grnNumber: 'GRN-2026-089',
    billNumber: 'ALOK-2026-441',
    billDate: '2026-10-09',
    dueDate: '2026-11-23',
    amount: 882000,
    taxAmount: 42000,
    status: 'Pending Approval',
  },
];
