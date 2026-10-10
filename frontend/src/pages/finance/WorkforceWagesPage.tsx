import React, { useState } from 'react';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Users, DollarSign, Award, CheckCircle2 } from 'lucide-react';

interface OperatorPayroll {
  operatorId: string;
  operatorName: string;
  role: string;
  shift: string;
  metersProduced: number;
  pieceRatePerMeter: number;
  baseSalary: number;
  bonus: number;
  grossWages: number;
  status: 'Calculated' | 'Approved' | 'Disbursed';
}

export const WorkforceWagesPage: React.FC = () => {
  const [payrolls, setPayrolls] = useState<OperatorPayroll[]>(fallbackPayroll);

  const totalDisbursement = payrolls.reduce((a, b) => a + b.grossWages, 0);
  const totalMeters = payrolls.reduce((a, b) => a + b.metersProduced, 0);

  const columns = [
    {
      header: 'Operator',
      accessor: (p: OperatorPayroll) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-on-surface)]">{p.operatorName}</div>
          <div className="text-xs font-mono text-[var(--color-on-surface-variant)]">{p.operatorId} | {p.role}</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Shift',
      accessor: (p: OperatorPayroll) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-surface-container)] text-[var(--color-on-surface)]">
          {p.shift}
        </span>
      ),
    },
    {
      header: 'Meters Woven',
      accessor: (p: OperatorPayroll) => (
        <div>
          <span className="font-mono font-bold text-sm text-[var(--color-primary)]">{p.metersProduced.toLocaleString()} M</span>
          <div className="text-[11px] text-[var(--color-on-surface-variant)]">@ ₹{p.pieceRatePerMeter}/meter</div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Base + Bonus',
      accessor: (p: OperatorPayroll) => (
        <div className="text-xs">
          <div>Base: ₹{p.baseSalary.toLocaleString()}</div>
          <div className="text-emerald-700 font-bold">+ Bonus: ₹{p.bonus.toLocaleString()}</div>
        </div>
      ),
    },
    {
      header: 'Total Gross Wages',
      accessor: (p: OperatorPayroll) => (
        <span className="font-mono font-bold text-sm text-[var(--color-on-surface)]">
          ₹{p.grossWages.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (p: OperatorPayroll) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            Floor Workforce Piece-Rate & Wage Calculations
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Automated meterage piece-rate payroll calculation directly connected with loom shift logs.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Total Operators Active</div>
          <div className="text-2xl font-black text-[var(--color-on-surface)] mt-1">{payrolls.length} Masters & Techs</div>
        </div>

        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Total Woven Meterage</div>
          <div className="text-2xl font-black text-[var(--color-primary)] mt-1">{totalMeters.toLocaleString()} Meters</div>
        </div>

        <div className="m3-card p-4">
          <div className="text-xs text-[var(--color-on-surface-variant)] font-bold uppercase">Estimated Gross Payroll</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">₹{totalDisbursement.toLocaleString()}</div>
        </div>
      </div>

      <DataTable
        data={payrolls}
        columns={columns}
        keyExtractor={(p) => p.operatorId}
        searchPlaceholder="Search operator name, ID, shift..."
        searchFilter={(p, q) =>
          p.operatorName.toLowerCase().includes(q.toLowerCase()) ||
          p.operatorId.toLowerCase().includes(q.toLowerCase()) ||
          p.role.toLowerCase().includes(q.toLowerCase())
        }
      />
    </div>
  );
};

const fallbackPayroll: OperatorPayroll[] = [
  {
    operatorId: 'OPR-401',
    operatorName: 'Rajesh Kumar',
    role: 'Grade A Loom Master',
    shift: 'Shift A (Day)',
    metersProduced: 4800,
    pieceRatePerMeter: 3.5,
    baseSalary: 12000,
    bonus: 2500,
    grossWages: 31300,
    status: 'Approved',
  },
  {
    operatorId: 'OPR-402',
    operatorName: 'Suresh Patel',
    role: 'Dyeing Vessel Tech',
    shift: 'Shift B (Evening)',
    metersProduced: 3200,
    pieceRatePerMeter: 3.0,
    baseSalary: 11500,
    bonus: 1800,
    grossWages: 22900,
    status: 'Approved',
  },
  {
    operatorId: 'OPR-403',
    operatorName: 'Amit Verma',
    role: 'Spinning Frame Operator',
    shift: 'Shift A (Day)',
    metersProduced: 5200,
    pieceRatePerMeter: 2.2,
    baseSalary: 10500,
    bonus: 1500,
    grossWages: 23440,
    status: 'Calculated',
  },
];
