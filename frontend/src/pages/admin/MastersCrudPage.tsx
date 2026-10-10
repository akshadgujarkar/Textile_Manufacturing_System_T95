import React, { useState } from 'react';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Database, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

interface MasterRecord {
  id: string;
  category: 'Yarn Types' | 'Suppliers' | 'Buyers' | 'Machines' | 'Tax Codes';
  code: string;
  name: string;
  details: string;
  status: 'Active' | 'Inactive';
}

export const MastersCrudPage: React.FC = () => {
  const [category, setCategory] = useState<MasterRecord['category']>('Yarn Types');
  const [records, setRecords] = useState<MasterRecord[]>(fallbackMasters);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form states
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [details, setDetails] = useState<string>('');

  const filteredRecords = records.filter((r) => r.category === category);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: MasterRecord = {
      id: `MST-${Date.now().toString().slice(-4)}`,
      category,
      code,
      name,
      details,
      status: 'Active',
    };
    setRecords((prev) => [newRecord, ...prev]);
    setShowModal(false);
    setCode('');
    setName('');
    setDetails('');
  };

  const columns = [
    {
      header: 'Code / Identifier',
      accessor: (r: MasterRecord) => <span className="font-mono font-bold text-[var(--color-primary)]">{r.code}</span>,
      sortable: true,
    },
    {
      header: 'Name / Title',
      accessor: (r: MasterRecord) => <span className="font-bold text-sm text-[var(--color-on-surface)]">{r.name}</span>,
      sortable: true,
    },
    {
      header: 'Specification / Parameters',
      accessor: (r: MasterRecord) => <span className="text-xs text-[var(--color-on-surface-variant)]">{r.details}</span>,
    },
    {
      header: 'Status',
      accessor: (r: MasterRecord) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            System Master Data Catalogs
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Configure yarn counts, spinning suppliers, customer registries, looms, and HSN tax codes.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="m3-btn m3-btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add New {category.slice(0, -1)}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['Yarn Types', 'Suppliers', 'Buyers', 'Machines', 'Tax Codes'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              category === cat
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredRecords}
        columns={columns}
        keyExtractor={(r) => r.id}
        searchPlaceholder={`Search ${category}...`}
        searchFilter={(r, q) =>
          r.code.toLowerCase().includes(q.toLowerCase()) ||
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.details.toLowerCase().includes(q.toLowerCase())
        }
      />

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Register New ${category.slice(0, -1)}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              System Code / Short ID
            </label>
            <input
              type="text"
              className="m3-input font-mono uppercase font-bold"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. YARN-COT-40S"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Official Name
            </label>
            <input
              type="text"
              className="m3-input font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 40s Ne Combed Ring Spun Cotton"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-on-surface-variant)] mb-1 uppercase">
              Technical Specifications / Attributes
            </label>
            <textarea
              className="m3-input"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. 100% Giza Cotton, CSP 2800, TPI 24.5"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-surface-container-high)]">
            <button type="button" onClick={() => setShowModal(false)} className="m3-btn m3-btn-outlined">
              Cancel
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              Save to Master Registry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const fallbackMasters: MasterRecord[] = [
  {
    id: 'MST-001',
    category: 'Yarn Types',
    code: 'YARN-30S-COT',
    name: '30s Ne Combed Cotton',
    details: '100% Cotton, CSP 2750, Warp quality',
    status: 'Active',
  },
  {
    id: 'MST-002',
    category: 'Yarn Types',
    code: 'YARN-150D-POLY',
    name: '150D / 48F Polyester Textured',
    details: 'Semi-Dull, Intermingled, Weft quality',
    status: 'Active',
  },
  {
    id: 'MST-003',
    category: 'Suppliers',
    code: 'SUPP-VARD',
    name: 'Vardhman Textiles Ltd',
    details: 'Ludhiana, Punjab | GSTIN: 03AAACV1234F1Z1',
    status: 'Active',
  },
  {
    id: 'MST-004',
    category: 'Buyers',
    code: 'BUY-RAYMOND',
    name: 'Raymond Apparels Ltd',
    details: 'Thane, Maharashtra | GSTIN: 27AAACR1234F1Z5',
    status: 'Active',
  },
  {
    id: 'MST-005',
    category: 'Machines',
    code: 'LOOM-04',
    name: 'Toyota JAT810 Air Jet Loom',
    details: 'Speed 950 RPM, Width 210 cm, Shed B',
    status: 'Active',
  },
  {
    id: 'MST-006',
    category: 'Tax Codes',
    code: 'HSN-5208',
    name: 'Woven Cotton Fabrics',
    details: '5% GST Rate (CGST 2.5% + SGST 2.5%)',
    status: 'Active',
  },
];
