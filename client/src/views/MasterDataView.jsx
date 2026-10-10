import React, { useState, useEffect } from 'react';
import {
  Database,
  Building,
  Users,
  Layers,
  Cpu,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Tag
} from 'lucide-react';
import { api } from '../services/api';

export default function MasterDataView() {
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'buyers' | 'employees' | 'yarns' | 'fabrics' | 'machines'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Datasets
  const [suppliers, setSuppliers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [yarns, setYarns] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [machines, setMachines] = useState([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    payment_terms: '30 Days Net'
  });

  const [buyerForm, setBuyerForm] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    billing_address: '',
    shipping_address: '',
    gstin: '',
    credit_limit_inr: 500000,
    payment_terms_days: 30
  });

  const [employeeForm, setEmployeeForm] = useState({
    first_name: '',
    last_name: '',
    employee_code: '',
    department: 'Weaving',
    designation: 'Loom Operator',
    pay_basis: 'piece_rate',
    hourly_rate: 0,
    piece_rate: 4.50,
    is_active: true
  });

  const [machineForm, setMachineForm] = useState({
    machine_code: '',
    name: '',
    machine_type: 'Air Jet Loom',
    max_rpm: 850,
    reed_space_inches: 75.0,
    power_rating_kw: 7.5,
    status: 'idle'
  });

  const [yarnForm, setYarnForm] = useState({
    item_code: '',
    name: '',
    yarn_type_id: 1,
    count_value: 30,
    count_system: 'Ne',
    unit_of_measure_id: 1,
    safety_stock_kg: 500,
    reorder_point_kg: 1000,
    standard_cost_per_kg: 240
  });

  const [fabricForm, setFabricForm] = useState({
    product_code: '',
    name: '',
    weave_type: 'Plain',
    target_gsm: 140,
    target_width_inches: 58.0,
    ends_per_inch: 68,
    picks_per_inch: 68,
    standard_cost_per_meter: 85
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [sRes, bRes, eRes, yRes, fRes, mRes] = await Promise.all([
        api.getSuppliers().catch(() => ({ data: [] })),
        api.getBuyers().catch(() => ({ data: [] })),
        api.getEmployees().catch(() => ({ data: [] })),
        api.getYarnItems().catch(() => ({ data: [] })),
        api.getFabricProducts().catch(() => ({ data: [] })),
        api.getMachines().catch(() => ({ data: [] }))
      ]);

      setSuppliers(sRes.data || []);
      setBuyers(bRes.data || []);
      setEmployees(eRes.data || []);
      setYarns(yRes.data || []);
      setFabrics(fRes.data || []);
      setMachines(mRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (activeTab === 'suppliers') {
        await api.createSupplier(supplierForm);
      } else if (activeTab === 'buyers') {
        await api.createBuyer({
          ...buyerForm,
          credit_limit_inr: Number(buyerForm.credit_limit_inr),
          payment_terms_days: Number(buyerForm.payment_terms_days)
        });
      } else if (activeTab === 'employees') {
        await api.createEmployee({
          ...employeeForm,
          hourly_rate: Number(employeeForm.hourly_rate),
          piece_rate: Number(employeeForm.piece_rate)
        });
      } else if (activeTab === 'machines') {
        await api.createMachine({
          ...machineForm,
          max_rpm: Number(machineForm.max_rpm),
          reed_space_inches: Number(machineForm.reed_space_inches),
          power_rating_kw: Number(machineForm.power_rating_kw)
        });
      } else if (activeTab === 'yarns') {
        await api.createYarnItem({
          ...yarnForm,
          count_value: Number(yarnForm.count_value),
          safety_stock_kg: Number(yarnForm.safety_stock_kg),
          reorder_point_kg: Number(yarnForm.reorder_point_kg),
          standard_cost_per_kg: Number(yarnForm.standard_cost_per_kg)
        });
      } else if (activeTab === 'fabrics') {
        await api.createFabricProduct({
          ...fabricForm,
          target_gsm: Number(fabricForm.target_gsm),
          target_width_inches: Number(fabricForm.target_width_inches),
          ends_per_inch: Number(fabricForm.ends_per_inch),
          picks_per_inch: Number(fabricForm.picks_per_inch),
          standard_cost_per_meter: Number(fabricForm.standard_cost_per_meter)
        });
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      alert(`Creation Failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-3">
            <Database className="w-8 h-8 text-[var(--md-sys-color-primary)]" />
            Master Data Administration
          </h1>
          <p className="text-[var(--md-sys-color-on-surface-variant)] text-sm mt-1">
            Maintain plant masters: Suppliers, Buyers, Staff, Machines, Yarn SKUs, and Fabric Weave Specs.
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

          <button
            onClick={() => setShowModal(true)}
            className="md-btn md-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab.slice(0, -1).toUpperCase()}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-[var(--md-sys-color-outline-variant)]">
        {[
          { key: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Building },
          { key: 'buyers', label: `Buyers (${buyers.length})`, icon: Briefcase },
          { key: 'employees', label: `Employees (${employees.length})`, icon: Users },
          { key: 'machines', label: `Loom Fleet (${machines.length})`, icon: Cpu },
          { key: 'yarns', label: `Yarn SKUs (${yarns.length})`, icon: Tag },
          { key: 'fabrics', label: `Fabric Products (${fabrics.length})`, icon: Layers },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
                  : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Tab Contents */}
      <div className="md-card overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'suppliers' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Code</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Vendor Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Contact</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">GSTIN</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{s.code}</td>
                    <td className="p-4 font-semibold">{s.name}</td>
                    <td className="p-4">
                      <div>{s.contact_person || 'N/A'}</div>
                      <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{s.phone} | {s.email}</div>
                    </td>
                    <td className="p-4 font-mono text-xs">{s.gstin || 'Unregistered'}</td>
                    <td className="p-4 text-xs">{s.payment_terms || 'Standard'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'buyers' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Code</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Client Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Contact</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">GSTIN</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Credit Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {buyers.map(b => (
                  <tr key={b.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{b.code}</td>
                    <td className="p-4 font-semibold">{b.name}</td>
                    <td className="p-4">
                      <div>{b.contact_person || 'N/A'}</div>
                      <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{b.phone} | {b.email}</div>
                    </td>
                    <td className="p-4 font-mono text-xs">{b.gstin || 'Unregistered'}</td>
                    <td className="p-4 font-mono font-semibold">
                      ₹{Number(b.credit_limit_inr || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'employees' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Code</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Staff Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Department</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Designation</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Pay Model</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {employees.map(e => (
                  <tr key={e.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{e.employee_code}</td>
                    <td className="p-4 font-semibold">{e.first_name} {e.last_name}</td>
                    <td className="p-4">{e.department}</td>
                    <td className="p-4 text-xs">{e.designation}</td>
                    <td className="p-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-purple-100 text-purple-800">
                        {e.pay_basis}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold">
                      {e.pay_basis === 'piece_rate' ? `₹${e.piece_rate} / m` : `₹${e.hourly_rate} / hr`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'machines' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Loom ID</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Model / Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Type</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Max RPM</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Reed Space</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {machines.map(m => (
                  <tr key={m.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{m.machine_code}</td>
                    <td className="p-4 font-semibold">{m.name}</td>
                    <td className="p-4">{m.machine_type}</td>
                    <td className="p-4 font-mono">{m.max_rpm} RPM</td>
                    <td className="p-4 font-mono">{m.reed_space_inches}"</td>
                    <td className="p-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-800">
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'yarns' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Item Code</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Yarn SKU Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Count</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Safety Stock</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Std Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {yarns.map(y => (
                  <tr key={y.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{y.item_code}</td>
                    <td className="p-4 font-semibold">{y.name}</td>
                    <td className="p-4 font-mono">{y.count_value} {y.count_system}</td>
                    <td className="p-4 font-mono">{y.safety_stock_kg} kg</td>
                    <td className="p-4 font-mono font-semibold">₹{y.standard_cost_per_kg} / kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'fabrics' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Product Code</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Fabric Name</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Weave</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">GSM / Width</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">EPI x PPI</th>
                  <th className="p-4 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase">Std Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] text-sm">
                {fabrics.map(f => (
                  <tr key={f.id} className="hover:bg-[var(--md-sys-color-surface-container-low)]">
                    <td className="p-4 font-mono font-bold text-[var(--md-sys-color-primary)]">{f.product_code}</td>
                    <td className="p-4 font-semibold">{f.name}</td>
                    <td className="p-4">{f.weave_type}</td>
                    <td className="p-4 font-mono">{f.target_gsm} GSM / {f.target_width_inches}"</td>
                    <td className="p-4 font-mono">{f.ends_per_inch} x {f.picks_per_inch}</td>
                    <td className="p-4 font-mono font-semibold">₹{f.standard_cost_per_meter} / m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="md-card max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-6 h-6 text-[var(--md-sys-color-primary)]" />
                Register New {activeTab.slice(0, -1).toUpperCase()}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {activeTab === 'suppliers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Supplier Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. SUP-99"
                      value={supplierForm.code}
                      onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Vardhman Spinners"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">GSTIN</label>
                    <input
                      type="text"
                      placeholder="27AAACV1111A1Z5"
                      value={supplierForm.gstin}
                      onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={supplierForm.contact_person}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                      className="md-input w-full"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium mb-1">Address</label>
                    <input
                      type="text"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      className="md-input w-full"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'buyers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Buyer Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. BUY-101"
                      value={buyerForm.code}
                      onChange={(e) => setBuyerForm({ ...buyerForm, code: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Buyer Company Name *</label>
                    <input
                      type="text"
                      value={buyerForm.name}
                      onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={buyerForm.gstin}
                      onChange={(e) => setBuyerForm({ ...buyerForm, gstin: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Credit Limit (INR)</label>
                    <input
                      type="number"
                      value={buyerForm.credit_limit_inr}
                      onChange={(e) => setBuyerForm({ ...buyerForm, credit_limit_inr: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'employees' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Employee Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-088"
                      value={employeeForm.employee_code}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, employee_code: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">First Name *</label>
                    <input
                      type="text"
                      value={employeeForm.first_name}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      value={employeeForm.last_name}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Department</label>
                    <select
                      value={employeeForm.department}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                      className="md-input w-full"
                    >
                      <option value="Weaving">Weaving</option>
                      <option value="Warping">Warping</option>
                      <option value="Quality Inspection">Quality Inspection</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Stores">Stores</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pay Basis</label>
                    <select
                      value={employeeForm.pay_basis}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, pay_basis: e.target.value })}
                      className="md-input w-full"
                    >
                      <option value="piece_rate">Piece Rate (₹/meter)</option>
                      <option value="hourly">Hourly (₹/hour)</option>
                      <option value="salaried">Salaried Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={employeeForm.pay_basis === 'piece_rate' ? employeeForm.piece_rate : employeeForm.hourly_rate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (employeeForm.pay_basis === 'piece_rate') {
                          setEmployeeForm({ ...employeeForm, piece_rate: val });
                        } else {
                          setEmployeeForm({ ...employeeForm, hourly_rate: val });
                        }
                      }}
                      className="md-input w-full font-mono"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'machines' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Loom Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. LOOM-12"
                      value={machineForm.machine_code}
                      onChange={(e) => setMachineForm({ ...machineForm, machine_code: e.target.value })}
                      required
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Loom Model / Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Picanol OmniPlus-I"
                      value={machineForm.name}
                      onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Max RPM</label>
                    <input
                      type="number"
                      value={machineForm.max_rpm}
                      onChange={(e) => setMachineForm({ ...machineForm, max_rpm: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Reed Space (Inches)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={machineForm.reed_space_inches}
                      onChange={(e) => setMachineForm({ ...machineForm, reed_space_inches: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'yarns' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Yarn SKU Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. YARN-C40S"
                      value={yarnForm.item_code}
                      onChange={(e) => setYarnForm({ ...yarnForm, item_code: e.target.value })}
                      required
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">SKU Description *</label>
                    <input
                      type="text"
                      placeholder="e.g. 40s Combed Compact Ring Spun"
                      value={yarnForm.name}
                      onChange={(e) => setYarnForm({ ...yarnForm, name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Count Value</label>
                    <input
                      type="number"
                      value={yarnForm.count_value}
                      onChange={(e) => setYarnForm({ ...yarnForm, count_value: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Standard Cost (₹/kg)</label>
                    <input
                      type="number"
                      value={yarnForm.standard_cost_per_kg}
                      onChange={(e) => setYarnForm({ ...yarnForm, standard_cost_per_kg: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'fabrics' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Fabric Product Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. FAB-POPLIN-60"
                      value={fabricForm.product_code}
                      onChange={(e) => setFabricForm({ ...fabricForm, product_code: e.target.value })}
                      required
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Fabric Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Cotton Poplin Shirting 60x60"
                      value={fabricForm.name}
                      onChange={(e) => setFabricForm({ ...fabricForm, name: e.target.value })}
                      required
                      className="md-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Target GSM</label>
                    <input
                      type="number"
                      value={fabricForm.target_gsm}
                      onChange={(e) => setFabricForm({ ...fabricForm, target_gsm: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Width (Inches)</label>
                    <input
                      type="number"
                      value={fabricForm.target_width_inches}
                      onChange={(e) => setFabricForm({ ...fabricForm, target_width_inches: e.target.value })}
                      className="md-input w-full font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="md-btn md-btn-tonal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="md-btn md-btn-primary flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : 'Save Master Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
