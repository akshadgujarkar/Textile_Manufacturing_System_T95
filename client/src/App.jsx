import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  ShoppingBag,
  Factory,
  CheckCircle2,
  Truck,
  FileText,
  Users,
  TrendingUp,
  Cpu,
  Database,
  Menu,
  X,
} from 'lucide-react';

import DashboardView from './views/DashboardView';
import InventoryView from './views/InventoryView';
import ProcurementView from './views/ProcurementView';
import OrdersView from './views/OrdersView';
import ProductionView from './views/ProductionView';
import QualityView from './views/QualityView';
import DispatchView from './views/DispatchView';
import FinanceView from './views/FinanceView';
import WorkforceView from './views/WorkforceView';
import ReportsView from './views/ReportsView';
import MasterDataView from './views/MasterDataView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Plant Dashboard', icon: LayoutDashboard, category: 'Overview' },
    { id: 'procurement', label: 'Procurement & GRN', icon: ShoppingBag, category: 'Supply Chain' },
    { id: 'inventory', label: 'Yarn Stock Ledger', icon: Layers, category: 'Supply Chain' },
    { id: 'orders', label: 'Sales Orders & BOM', icon: FileText, category: 'Supply Chain' },
    { id: 'production', label: 'Loom Execution', icon: Factory, category: 'Manufacturing' },
    { id: 'quality', label: 'ASTM 4-Point QC', icon: CheckCircle2, category: 'Manufacturing' },
    { id: 'dispatch', label: 'Transport Manifests', icon: Truck, category: 'Logistics' },
    { id: 'finance', label: 'GST Invoices & AR', icon: FileText, category: 'Finance' },
    { id: 'workforce', label: 'Muster, Wages & Cost', icon: Users, category: 'Finance' },
    { id: 'reports', label: 'Operational Reports', icon: TrendingUp, category: 'Intelligence' },
    { id: 'masterdata', label: 'Master Data Hub', icon: Database, category: 'Administration' },
  ];

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setActiveTab(tab)} />;
      case 'procurement':
        return <ProcurementView />;
      case 'inventory':
        return <InventoryView />;
      case 'orders':
        return <OrdersView />;
      case 'production':
        return <ProductionView />;
      case 'quality':
        return <QualityView />;
      case 'dispatch':
        return <DispatchView />;
      case 'finance':
        return <FinanceView />;
      case 'workforce':
        return <WorkforceView />;
      case 'reports':
        return <ReportsView />;
      case 'masterdata':
        return <MasterDataView />;
      default:
        return <DashboardView onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="app-container">
      {/* Material You Navigation Rail / Sidebar */}
      <aside className={`md-nav-rail ${mobileMenuOpen ? 'block' : ''}`}>
        <div className="md-nav-header">
          <div className="md-nav-logo">E</div>
          <div>
            <div className="md-nav-title">EVEREST</div>
            <div className="md-nav-subtitle">Textile Manufacturing</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', flex: 1 }}>
          <div className="md-nav-group-title">Supply Chain</div>
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`md-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="md-nav-group-title">Shop Floor & QC</div>
          {navItems.slice(4, 7).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`md-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="md-nav-group-title">Finance & Analytics</div>
          {navItems.slice(7, 10).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`md-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="md-nav-group-title">Administration</div>
          {navItems.slice(10).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`md-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info / System Badge */}
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--md-surface-container-high)',
            borderRadius: '20px',
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-primary-container)',
              color: 'var(--md-on-primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8125rem',
            }}
          >
            RS
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Rajesh Sharma
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)' }}>Plant Head</div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <main className="md-main-layout">
        {/* Top App Bar */}
        <header className="md-top-app-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="md-top-title">
              {navItems.find((n) => n.id === activeTab)?.label || 'Plant Dashboard'}
            </div>
          </div>

          <div className="md-top-actions">
            <span className="md-chip md-chip-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Cpu size={14} /> MySQL 8.0 Active (30 Tables)
            </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="md-content-area">{renderActiveView()}</div>
      </main>
    </div>
  );
}
