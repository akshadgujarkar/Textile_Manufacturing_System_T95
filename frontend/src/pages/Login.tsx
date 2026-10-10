import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BusinessRole } from '../types';
import { Layers, ArrowRight, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [selectedRole, setSelectedRole] = useState<BusinessRole>('admin');
  const [isLoading, setIsLoading] = useState(false);

  const QUICK_ROLES: Array<{ role: BusinessRole; title: string; desc: string }> = [
    { role: 'admin', title: 'System Admin', desc: 'Full system control, audit logs & master setup' },
    { role: 'owner', title: 'Mill Owner', desc: 'Executive P&L, throughput & order contribution' },
    { role: 'production_manager', title: 'Production Mgr', desc: 'Live floor matrix, machine status & jobs' },
    { role: 'operator', title: 'Floor Operator', desc: 'Touchscreen shift output & breakdown logging' },
    { role: 'quality_checker', title: 'Quality Checker', desc: 'Roll QR scanner, multi-defect tagging' },
    { role: 'gate_store', title: 'Gate & Store', desc: 'Raw yarn gate inward & thermal barcode tags' },
    { role: 'dispatch', title: 'Dispatch Staff', desc: 'Truck loading scanner & double-dispatch guard' },
    { role: 'accounts', title: 'Finance & Accounts', desc: 'Invoicing, supplier bills & payment ledger' },
    { role: 'sales', title: 'Sales & Orders', desc: 'Order creation, feasibility & tracking' },
    { role: 'staff_readonly', title: 'Internal Auditor', desc: 'Compliance & invariant health checks' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, selectedRole);
      navigate('/app/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: BusinessRole) => {
    setIsLoading(true);
    try {
      await login(role, role);
      navigate('/app/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        backgroundColor: 'var(--md-sys-color-background)',
      }}
    >
      {/* Material You Ambient Glows */}
      <div className="material-you-ambient" aria-hidden="true">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
      </div>

      <div
        style={{
          maxWidth: '1040px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          zIndex: 1,
        }}
        className="login-container-grid"
      >
        {/* Left Side: Brand & Quick Role Switcher */}
        <div className="m3-card" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '6px 14px', borderRadius: '9999px', backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px' }}>
              <Sparkles size={16} /> Everest Textile Mills
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)', lineHeight: 1.2 }}>
              Textile Manufacturing System
            </h1>
            <p style={{ marginTop: '10px', fontSize: '0.9375rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Unified operational command center: zero double-dispatches, 100% fabric roll traceability, live floor telemetry, and automated financial reconciliation.
            </p>
          </div>

          <div style={{ marginTop: '28px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--md-sys-color-outline)', marginBottom: '12px' }}>
              Select Operational Persona (1-Click Demo)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {QUICK_ROLES.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => handleQuickLogin(r.role)}
                  className="m3-card m3-card-interactive"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '14px',
                    backgroundColor: selectedRole === r.role ? 'var(--md-sys-color-primary-container)' : '#FFFFFF',
                    border: '1px solid rgba(121, 116, 126, 0.14)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: selectedRole === r.role ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)' }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--md-sys-color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '20px', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="var(--md-sys-color-success)" />
            PostgreSQL 15+ Single Instance Integrity • 11 Invariants Active
          </div>
        </div>

        {/* Right Side: Direct Login Form */}
        <div className="m3-card m3-card-white" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              Sign In to TMS
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
              Enter your assigned staff credentials or select a persona
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="m3-form-group">
              <label className="m3-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="m3-input"
                placeholder="e.g. admin or suresh_patil"
              />
            </div>

            <div className="m3-form-group">
              <label className="m3-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="m3-input"
                placeholder="••••••••••••"
              />
            </div>

            <div className="m3-form-group">
              <label className="m3-label">Default Target Workspace Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as BusinessRole)}
                className="m3-select"
              >
                {QUICK_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.title} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="m3-btn m3-btn-primary"
              style={{ width: '100%', height: '48px', marginTop: '16px', fontSize: '0.9375rem' }}
            >
              {isLoading ? 'Authenticating...' : 'Enter Operational Portal'} <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
