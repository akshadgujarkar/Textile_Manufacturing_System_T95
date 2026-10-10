import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BusinessRole } from '../../types';
import {
  Layers,
  Package,
  ClipboardList,
  Cpu,
  CheckCircle,
  Truck,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  UserCheck,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  roles?: BusinessRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AppShell: React.FC = () => {
  const { user, logout, switchRole, hasRole } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const ALL_ROLES: BusinessRole[] = [
    'admin',
    'owner',
    'accounts',
    'production_manager',
    'operator',
    'quality_checker',
    'gate_store',
    'dispatch',
    'sales',
    'staff_readonly',
  ];

  const navigationSections: NavSection[] = [
    {
      title: 'Command Hub',
      items: [
        { name: 'Dashboard', path: '/app/dashboard', icon: <Layers size={18} /> },
      ],
    },
    {
      title: 'W1: Raw Materials',
      items: [
        { name: 'Yarn Stock & Alerts', path: '/app/raw-materials/stock', icon: <Package size={18} /> },
        { name: 'Gate Inward Entry', path: '/app/raw-materials/gate-entry', icon: <Package size={18} />, roles: ['gate_store', 'admin', 'owner'] },
        { name: 'Goods Receipts (GRN)', path: '/app/raw-materials/receipts', icon: <Package size={18} /> },
      ],
    },
    {
      title: 'W4: Orders & Feasibility',
      items: [
        { name: 'Active Orders', path: '/app/orders/list', icon: <ClipboardList size={18} /> },
        { name: 'New Customer Order', path: '/app/orders/new', icon: <ClipboardList size={18} />, roles: ['sales', 'admin', 'owner'] },
        { name: 'Quick Order Tracker', path: '/app/orders/tracking', icon: <ClipboardList size={18} /> },
      ],
    },
    {
      title: 'W2: Production Floor',
      items: [
        { name: 'Live Machine Matrix', path: '/app/production/floor', icon: <Cpu size={18} /> },
        { name: 'Job Scheduling', path: '/app/production/jobs', icon: <Cpu size={18} /> },
        { name: 'Touch Shift Logger', path: '/app/production/log-output', icon: <Cpu size={18} />, roles: ['operator', 'production_manager', 'admin', 'owner'] },
        { name: 'Downtime History', path: '/app/production/downtime', icon: <Cpu size={18} /> },
      ],
    },
    {
      title: 'W3: QC & Traceability',
      items: [
        { name: 'Roll QC Inspection', path: '/app/quality/inspect', icon: <CheckCircle size={18} />, roles: ['quality_checker', 'admin', 'owner'] },
        { name: 'Finished Rolls Shelf', path: '/app/quality/shelf', icon: <CheckCircle size={18} /> },
        { name: 'Roll Traceability Spine', path: '/app/quality/traceability', icon: <CheckCircle size={18} /> },
        { name: 'Defect Analytics', path: '/app/quality/defect-analytics', icon: <CheckCircle size={18} /> },
      ],
    },
    {
      title: 'W5: Dispatch & Loading',
      items: [
        { name: 'Dispatch Manifests', path: '/app/dispatch/list', icon: <Truck size={18} /> },
        { name: 'Truck Loading Scanner', path: '/app/dispatch/load', icon: <Truck size={18} />, roles: ['dispatch', 'admin', 'owner'] },
      ],
    },
    {
      title: 'W6: Finance & Payroll',
      items: [
        { name: 'Sales Invoices', path: '/app/finance/invoices', icon: <DollarSign size={18} /> },
        { name: 'Buyer Payments & Ledger', path: '/app/finance/payments', icon: <DollarSign size={18} /> },
        { name: 'Supplier Bills & Variances', path: '/app/finance/supplier-bills', icon: <DollarSign size={18} /> },
        { name: 'Workforce Wages & Attendance', path: '/app/finance/wages', icon: <DollarSign size={18} /> },
        { name: 'Accounting Period Close', path: '/app/finance/period-close', icon: <DollarSign size={18} />, roles: ['accounts', 'owner', 'admin'] },
      ],
    },
    {
      title: 'Executive Analytics',
      items: [
        { name: 'Executive P&L Statement', path: '/app/executive/pl-statement', icon: <TrendingUp size={18} />, roles: ['owner', 'admin', 'accounts', 'staff_readonly'] },
        { name: 'Order & Roll Costing', path: '/app/executive/cost-analysis', icon: <TrendingUp size={18} /> },
        { name: 'Machine Productivity', path: '/app/executive/machine-productivity', icon: <TrendingUp size={18} /> },
      ],
    },
    {
      title: 'System & Security',
      items: [
        { name: 'Invariant Health Checks', path: '/app/admin/reconciliation', icon: <ShieldCheck size={18} />, roles: ['admin', 'owner', 'staff_readonly'] },
        { name: 'Audit Trail Search', path: '/app/admin/audit-logs', icon: <ShieldCheck size={18} />, roles: ['admin', 'owner', 'staff_readonly'] },
        { name: 'Master Catalogs CRUD', path: '/app/admin/masters', icon: <ShieldCheck size={18} />, roles: ['admin', 'owner'] },
      ],
    },
  ];

  const currentRole = user?.roles?.[0] || 'admin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--md-sys-color-background)', position: 'relative' }}>
      {/* Material You Ambient Glows */}
      <div className="material-you-ambient" aria-hidden="true">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
      </div>

      {/* Sidebar Navigation Drawer */}
      <aside
        style={{
          width: '280px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          borderRight: '1px solid rgba(121, 116, 126, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transition: 'transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-easing)',
          transform: isMobileMenuOpen ? 'translateX(0)' : undefined,
        }}
        className={`app-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(121, 116, 126, 0.10)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
            }}
          >
            E
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--md-sys-color-on-surface)' }}>
              Everest TMS
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Textile Manufacturing System
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {navigationSections.map((section, sIdx) => {
            const visibleItems = section.items.filter((item) => !item.roles || item.roles.some((r) => hasRole(r)));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--md-sys-color-outline)', padding: '0 12px 6px' }}>
                  {section.title}
                </div>
                {visibleItems.map((item, iIdx) => (
                  <NavLink
                    key={iIdx}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                      backgroundColor: isActive ? 'var(--md-sys-color-primary-container)' : 'transparent',
                      textDecoration: 'none',
                      transition: 'all 150ms ease',
                      marginBottom: '3px',
                    })}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>

        {/* Bottom User Profile Section */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(121, 116, 126, 0.12)', backgroundColor: 'var(--md-sys-color-surface-container)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ maxWidth: '140px' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.fullName || user?.username}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'capitalize' }}>
                  {currentRole.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--md-sys-color-error)',
                padding: '6px',
                borderRadius: '50%',
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, marginLeft: '280px', display: 'flex', flexDirection: 'column', minHeight: '100vh', zIndex: 1 }} className="main-content-area">
        {/* Top App Bar */}
        <header
          style={{
            height: '68px',
            backgroundColor: 'rgba(255, 251, 254, 0.85)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(121, 116, 126, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="mobile-menu-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--md-sys-color-on-surface)',
                display: 'none',
              }}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-success)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                Everest Textile Mills — Production System Active
              </span>
            </div>
          </div>

          {/* Quick Role Switcher Pill for Interactive Testing & Live Demos */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="m3-btn m3-btn-tonal"
              style={{ height: '38px', padding: '0 16px', fontSize: '0.8125rem' }}
            >
              <UserCheck size={16} />
              <span>Role: <strong>{currentRole.replace(/_/g, ' ')}</strong></span>
              <ChevronDown size={14} />
            </button>

            {isRoleDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  width: '240px',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  borderRadius: '16px',
                  padding: '8px',
                  boxShadow: 'var(--md-sys-elevation-3)',
                  border: '1px solid rgba(121, 116, 126, 0.16)',
                  zIndex: 200,
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '6px 12px', color: 'var(--md-sys-color-outline)' }}>
                  SWITCH PERSONA / ROLE
                </div>
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setIsRoleDropdownOpen(false);
                      navigate('/app/dashboard');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: r === currentRole ? 'var(--md-sys-color-primary-container)' : 'transparent',
                      color: r === currentRole ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                      fontSize: '0.8125rem',
                      fontWeight: r === currentRole ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textTransform: 'capitalize',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <span>{r.replace(/_/g, ' ')}</span>
                    {r === currentRole && <Sparkles size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Page Container */}
        <main style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
