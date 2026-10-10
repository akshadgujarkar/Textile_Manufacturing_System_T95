import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, DollarSign, Plus, CheckCircle2, AlertTriangle, Clock, Activity, X } from 'lucide-react';

export default function WorkforceView() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [wages, setWages] = useState([]);
  const [costs, setCosts] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showWageModal, setShowWageModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [attForm, setAttForm] = useState({
    employee_id: '',
    work_date: new Date().toISOString().split('T')[0],
    shift_code: 'shift_1',
    status: 'present',
    hours_worked: '8.00',
  });

  const [wageForm, setWageForm] = useState({
    employee_id: '',
    payroll_month: new Date().toISOString().slice(0, 7) + '-01',
    base_amount: '35000',
    piece_rate_amount: '0',
    bonus_overtime: '0',
  });

  const [costForm, setCostForm] = useState({
    cost_type: 'wage',
    amount: '4500',
    cost_date: new Date().toISOString().split('T')[0],
    order_id: '1',
    machine_id: '1',
    roll_id: '1',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, attRes, wageRes, costRes] = await Promise.all([
        api.getEmployees(),
        api.getAttendanceRecords({ page: 1, pageSize: 50 }),
        api.getWageRecords({ page: 1, pageSize: 50 }),
        api.getCostEntries({ page: 1, pageSize: 50 }),
      ]);

      setEmployees(empRes.data || []);
      setAttendance(attRes.data || []);
      setWages(wageRes.data || []);
      setCosts(costRes.data || []);
    } catch (err) {
      console.error('Failed to load workforce & costing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAttendance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      await api.createAttendanceRecord({
        employee_id: parseInt(attForm.employee_id),
        work_date: attForm.work_date,
        shift_code: attForm.shift_code,
        status: attForm.status,
        hours_worked: parseFloat(attForm.hours_worked),
      });

      setMsg({ type: 'success', text: 'Daily muster attendance marked successfully!' });
      setShowAttendanceModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to mark attendance' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWage = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      await api.createWageRecord({
        employee_id: parseInt(wageForm.employee_id),
        payroll_month: wageForm.payroll_month,
        base_amount: parseFloat(wageForm.base_amount),
        piece_rate_amount: parseFloat(wageForm.piece_rate_amount || 0),
        bonus_overtime: parseFloat(wageForm.bonus_overtime || 0),
      });

      setMsg({ type: 'success', text: 'Monthly payroll wage record processed!' });
      setShowWageModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to process payroll wage' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCost = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      await api.createCostEntry({
        cost_type: costForm.cost_type,
        amount: parseFloat(costForm.amount),
        cost_date: costForm.cost_date,
        order_id: costForm.order_id ? parseInt(costForm.order_id) : undefined,
        machine_id: costForm.machine_id ? parseInt(costForm.machine_id) : undefined,
        roll_id: costForm.roll_id ? parseInt(costForm.roll_id) : undefined,
      });

      setMsg({ type: 'success', text: 'Direct manufacturing cost absorbed into ledger!' });
      setShowCostModal(false);
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to add cost entry' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>
            Workforce Muster, Wages & Direct Costing
          </h1>
          <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.875rem' }}>
            Shift muster attendance, payroll disbursement calculation, and machine/order cost absorption.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'attendance' && (
            <button className="md-btn md-btn-primary" onClick={() => setShowAttendanceModal(true)}>
              <Plus size={16} /> Mark Muster Attendance
            </button>
          )}
          {activeTab === 'wages' && (
            <button className="md-btn md-btn-primary" onClick={() => setShowWageModal(true)}>
              <Plus size={16} /> Process Wage Record
            </button>
          )}
          {activeTab === 'costing' && (
            <button className="md-btn md-btn-primary" onClick={() => setShowCostModal(true)}>
              <Plus size={16} /> Log Cost Absorption
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            backgroundColor: msg.type === 'success' ? 'var(--md-success-container)' : 'var(--md-error-container)',
            color: msg.type === 'success' ? 'var(--md-on-success-container)' : 'var(--md-on-error-container)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 500,
          }}
        >
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {msg.text}
        </div>
      )}

      {/* Tonal Sub-Navigation Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`md-btn ${activeTab === 'attendance' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={16} /> Attendance Muster ({attendance.length})
        </button>
        <button
          className={`md-btn ${activeTab === 'wages' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveTab('wages')}
        >
          <DollarSign size={16} /> Wage & Payroll ({wages.length})
        </button>
        <button
          className={`md-btn ${activeTab === 'costing' ? 'md-btn-primary' : 'md-btn-tonal'}`}
          onClick={() => setActiveTab('costing')}
        >
          <Activity size={16} /> Cost Absorption ({costs.length})
        </button>
      </div>

      {/* Tab 1: Attendance Muster */}
      {activeTab === 'attendance' && (
        <div className="md-table-container">
          <table className="md-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work Date</th>
                <th>Shift</th>
                <th>Hours Worked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading muster records...</td>
                </tr>
              ) : attendance.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No attendance muster logs recorded.</td>
                </tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a.attendance_id}>
                    <td>
                      <strong>{a.full_name || `Employee #${a.employee_id}`}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                        {a.employee_code} • {a.designation}
                      </div>
                    </td>
                    <td>{new Date(a.work_date).toLocaleDateString()}</td>
                    <td>
                      <span className="md-chip md-chip-primary">{a.shift_code}</span>
                    </td>
                    <td>
                      <strong>{parseFloat(a.hours_worked).toFixed(1)} hrs</strong>
                    </td>
                    <td>
                      <span className="md-chip md-chip-success">{a.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Wages */}
      {activeTab === 'wages' && (
        <div className="md-table-container">
          <table className="md-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Payroll Month</th>
                <th>Base Amount</th>
                <th>Piece Rate</th>
                <th>Bonus / Overtime</th>
                <th>Gross Disbursed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading wage records...</td>
                </tr>
              ) : wages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No wage records processed.</td>
                </tr>
              ) : (
                wages.map((w) => (
                  <tr key={w.wage_id}>
                    <td>
                      <strong>{w.full_name || `Employee #${w.employee_id}`}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                        {w.employee_code} • {w.designation}
                      </div>
                    </td>
                    <td>{new Date(w.payroll_month).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</td>
                    <td>₹{parseFloat(w.base_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(w.piece_rate_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(w.bonus_overtime).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <strong style={{ color: 'var(--md-primary)', fontSize: '1rem' }}>
                        ₹{parseFloat(w.gross_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>
                      <span className="md-chip md-chip-success">{w.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Cost Absorption */}
      {activeTab === 'costing' && (
        <div className="md-table-container">
          <table className="md-table">
            <thead>
              <tr>
                <th>Cost Type</th>
                <th>Date</th>
                <th>Associated Order / Machine / Roll</th>
                <th>Absorbed Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading cost entries...</td>
                </tr>
              ) : costs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No direct cost entries logged.</td>
                </tr>
              ) : (
                costs.map((c) => (
                  <tr key={c.cost_id}>
                    <td>
                      <span className="md-chip md-chip-primary">{c.cost_type}</span>
                    </td>
                    <td>{new Date(c.cost_date).toLocaleDateString()}</td>
                    <td>
                      {c.order_id && <span>Order #{c.order_id} </span>}
                      {c.machine_id && <span>• Machine #{c.machine_id} </span>}
                      {c.roll_id && <span>• Roll #{c.roll_id}</span>}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--md-tertiary)', fontSize: '1rem' }}>
                        ₹{parseFloat(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showAttendanceModal && (
        <div className="md-modal-backdrop" onClick={() => setShowAttendanceModal(false)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Mark Daily Attendance Muster</h2>
              <button className="md-btn md-btn-text md-btn-sm" onClick={() => setShowAttendanceModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance}>
              <div className="md-field">
                <label className="md-field-label">Employee *</label>
                <select
                  className="md-input"
                  required
                  value={attForm.employee_id}
                  onChange={(e) => setAttForm({ ...attForm, employee_id: e.target.value })}
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.full_name} ({emp.employee_code} - {emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="md-field">
                  <label className="md-field-label">Work Date *</label>
                  <input
                    type="date"
                    required
                    className="md-input"
                    value={attForm.work_date}
                    onChange={(e) => setAttForm({ ...attForm, work_date: e.target.value })}
                  />
                </div>

                <div className="md-field">
                  <label className="md-field-label">Shift *</label>
                  <select
                    className="md-input"
                    value={attForm.shift_code}
                    onChange={(e) => setAttForm({ ...attForm, shift_code: e.target.value })}
                  >
                    <option value="shift_1">Shift 1 (08:00 - 16:00)</option>
                    <option value="shift_2">Shift 2 (16:00 - 00:00)</option>
                    <option value="shift_3">Shift 3 (00:00 - 08:00)</option>
                    <option value="general">General Shift</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="md-field">
                  <label className="md-field-label">Muster Status *</label>
                  <select
                    className="md-input"
                    value={attForm.status}
                    onChange={(e) => setAttForm({ ...attForm, status: e.target.value })}
                  >
                    <option value="present">Present</option>
                    <option value="half_day">Half Day</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                <div className="md-field">
                  <label className="md-field-label">Hours Worked (0 - 24) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    className="md-input"
                    value={attForm.hours_worked}
                    onChange={(e) => setAttForm({ ...attForm, hours_worked: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowAttendanceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Muster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Wage Modal */}
      {showWageModal && (
        <div className="md-modal-backdrop" onClick={() => setShowWageModal(false)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Process Monthly Wage Record</h2>
              <button className="md-btn md-btn-text md-btn-sm" onClick={() => setShowWageModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWage}>
              <div className="md-field">
                <label className="md-field-label">Employee *</label>
                <select
                  className="md-input"
                  required
                  value={wageForm.employee_id}
                  onChange={(e) => setWageForm({ ...wageForm, employee_id: e.target.value })}
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.full_name} ({emp.designation} - Rate: ₹{parseFloat(emp.pay_rate).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md-field">
                <label className="md-field-label">Payroll Month (YYYY-MM-01) *</label>
                <input
                  type="date"
                  required
                  className="md-input"
                  value={wageForm.payroll_month}
                  onChange={(e) => setWageForm({ ...wageForm, payroll_month: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="md-field">
                  <label className="md-field-label">Base Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="md-input"
                    value={wageForm.base_amount}
                    onChange={(e) => setWageForm({ ...wageForm, base_amount: e.target.value })}
                  />
                </div>

                <div className="md-field">
                  <label className="md-field-label">Piece Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="md-input"
                    value={wageForm.piece_rate_amount}
                    onChange={(e) => setWageForm({ ...wageForm, piece_rate_amount: e.target.value })}
                  />
                </div>

                <div className="md-field">
                  <label className="md-field-label">Bonus / Overtime (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="md-input"
                    value={wageForm.bonus_overtime}
                    onChange={(e) => setWageForm({ ...wageForm, bonus_overtime: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowWageModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Disburse Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Cost Modal */}
      {showCostModal && (
        <div className="md-modal-backdrop" onClick={() => setShowCostModal(false)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Log Direct Manufacturing Cost</h2>
              <button className="md-btn md-btn-text md-btn-sm" onClick={() => setShowCostModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCost}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="md-field">
                  <label className="md-field-label">Cost Type *</label>
                  <select
                    className="md-input"
                    value={costForm.cost_type}
                    onChange={(e) => setCostForm({ ...costForm, cost_type: e.target.value })}
                  >
                    <option value="material">material (Raw Yarn & Chemical Absorption)</option>
                    <option value="wage">wage (Direct Operator Labor)</option>
                    <option value="power">power (Machine Electricity & Energy)</option>
                    <option value="maintenance">maintenance (Loom Maintenance & Spare Parts)</option>
                    <option value="overhead">overhead (General Plant Overhead)</option>
                  </select>
                </div>

                <div className="md-field">
                  <label className="md-field-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="md-input"
                    value={costForm.amount}
                    onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="md-btn md-btn-tonal" onClick={() => setShowCostModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="md-btn md-btn-primary" disabled={submitting}>
                  {submitting ? 'Absorbing...' : 'Record Cost Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
