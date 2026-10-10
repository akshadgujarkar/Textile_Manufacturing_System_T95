import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Factory,
  Layers,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Truck,
  FileText,
  DollarSign,
  Activity,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    stockSummary: [],
    orderProgress: [],
    reorderAlerts: [],
    dbHealth: null,
    machines: [],
    jobs: [],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stockRes, orderRes, alertRes, healthRes, machineRes, jobRes] = await Promise.all([
        api.getInventorySummaryReport().catch(() => ({ data: [] })),
        api.getOrderProgressReport().catch(() => ({ data: [] })),
        api.getReorderAlertsReport().catch(() => ({ data: [] })),
        api.getDatabaseHealth().catch(() => ({ data: { ok: false } })),
        api.getMachines().catch(() => ({ data: [] })),
        api.getProductionJobs().catch(() => ({ data: [] })),
      ]);

      setStats({
        stockSummary: stockRes.data || [],
        orderProgress: orderRes.data || [],
        reorderAlerts: alertRes.data || [],
        dbHealth: healthRes.data,
        machines: machineRes.data || [],
        jobs: jobRes.data || [],
      });
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalStockKg = stats.stockSummary.reduce(
    (acc, curr) => acc + (parseFloat(curr.current_stock_qty) || 0),
    0
  );

  const activeMachines = stats.machines.filter((m) => m.current_status === 'running').length;
  const runningJobs = stats.jobs.filter((j) => j.status === 'running').length;

  return (
    <div>
      {/* Hero Section */}
      <div className="md-hero-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span className="md-chip md-chip-primary">
                <Factory size={14} /> Shop Floor Active
              </span>
              {stats.dbHealth?.ok ? (
                <span className="md-chip md-chip-success">
                  <CheckCircle2 size={14} /> MySQL 8.0 Live ({stats.dbHealth.latency_ms}ms)
                </span>
              ) : (
                <span className="md-chip md-chip-error">
                  <AlertTriangle size={14} /> Database Connecting
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--md-on-surface)', lineHeight: 1.2 }}>
              Everest Textile Manufacturing ERP
            </h1>
            <p style={{ color: 'var(--md-on-surface-variant)', marginTop: '0.5rem', maxWidth: '640px', fontSize: '1.05rem' }}>
              Real-time plant execution, append-only yarn stock ledger, ASTM 4-point QC grading, and GST dispatch management.
            </p>
          </div>

          <button className="md-btn md-btn-primary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Telemetry
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="md-stat-card">
          <div className="md-stat-icon" style={{ backgroundColor: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
            <Layers size={26} />
          </div>
          <div>
            <div className="md-stat-val">{totalStockKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</div>
            <div className="md-stat-lbl">Active Yarn Stock (Ledger)</div>
          </div>
        </div>

        <div className="md-stat-card">
          <div className="md-stat-icon" style={{ backgroundColor: 'var(--md-success-container)', color: 'var(--md-on-success-container)' }}>
            <Factory size={26} />
          </div>
          <div>
            <div className="md-stat-val">{activeMachines} / {stats.machines.length || 4}</div>
            <div className="md-stat-lbl">Running Loom Fleet</div>
          </div>
        </div>

        <div className="md-stat-card">
          <div className="md-stat-icon" style={{ backgroundColor: 'var(--md-info-container)', color: 'var(--md-on-info-container)' }}>
            <Activity size={26} />
          </div>
          <div>
            <div className="md-stat-val">{runningJobs} Active</div>
            <div className="md-stat-lbl">Production Jobs In Progress</div>
          </div>
        </div>

        <div className="md-stat-card">
          <div className="md-stat-icon" style={{ backgroundColor: stats.reorderAlerts.length > 0 ? 'var(--md-warning-container)' : 'var(--md-surface-container-high)', color: stats.reorderAlerts.length > 0 ? 'var(--md-on-warning-container)' : 'var(--md-on-surface-variant)' }}>
            <AlertTriangle size={26} />
          </div>
          <div>
            <div className="md-stat-val">{stats.reorderAlerts.length} Alerts</div>
            <div className="md-stat-lbl">Low Stock Yarn SKUs</div>
          </div>
        </div>
      </div>

      {/* Grid: Order Progression & Live Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Sales Order Progression */}
        <div className="md-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>
              Active Sales Order Progression
            </h2>
            <button className="md-btn md-btn-text md-btn-sm" onClick={() => onNavigate('orders')}>
              View Orders <ArrowRight size={14} />
            </button>
          </div>

          {stats.orderProgress.length === 0 ? (
            <p style={{ color: 'var(--md-on-surface-variant)', padding: '1rem 0' }}>No active sales orders in progress.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {stats.orderProgress.map((order) => {
                const ordered = parseFloat(order.total_ordered_meters) || 1;
                const produced = parseFloat(order.total_produced_meters) || 0;
                const passed = parseFloat(order.total_passed_qc_meters) || 0;
                const dispatched = parseFloat(order.total_dispatched_meters) || 0;
                const pct = Math.min(100, Math.round((produced / ordered) * 100));

                return (
                  <div key={order.order_id} style={{ backgroundColor: 'var(--md-surface-container-low)', borderRadius: '20px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{order.order_no}</span>
                      <span className="md-chip md-chip-primary">{order.order_status}</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.75rem' }}>
                      Buyer: <strong>{order.buyer_name}</strong> • Delivery: {new Date(order.promised_delivery_date).toLocaleDateString()}
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--md-outline-variant)', borderRadius: '9999px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--md-primary)', borderRadius: '9999px', transition: 'width 500ms ease' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                      <span>Ordered: <strong>{ordered}m</strong></span>
                      <span>Produced: <strong>{produced}m</strong></span>
                      <span>Passed QC: <strong>{passed}m</strong></span>
                      <span>Dispatched: <strong>{dispatched}m</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reorder Alerts & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Reorder Warnings */}
          <div className="md-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>
                Yarn Reorder Alerts
              </h2>
              <button className="md-btn md-btn-text md-btn-sm" onClick={() => onNavigate('inventory')}>
                Manage Stock <ArrowRight size={14} />
              </button>
            </div>

            {stats.reorderAlerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--md-success)', padding: '0.5rem 0' }}>
                <CheckCircle2 size={18} /> All raw material yarn SKUs are above reorder thresholds.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats.reorderAlerts.map((alert) => (
                  <div
                    key={alert.yarn_item_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      backgroundColor: 'var(--md-warning-container)',
                      color: 'var(--md-on-warning-container)',
                      borderRadius: '16px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                        {alert.yarn_type_name} ({alert.colour_name})
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                        Current Stock: {parseFloat(alert.current_stock).toFixed(1)} kg • Reorder Level: {parseFloat(alert.reorder_level).toFixed(1)} kg
                      </div>
                    </div>
                    <span className="md-chip md-chip-error" style={{ fontSize: '0.75rem' }}>
                      Deficit: -{parseFloat(alert.deficit_qty).toFixed(1)} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="md-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '1rem' }}>
              Manufacturing Quick Actions
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button className="md-btn md-btn-tonal" onClick={() => onNavigate('production')} style={{ justifyContent: 'flex-start' }}>
                <Factory size={16} /> Log Shift Output
              </button>
              <button className="md-btn md-btn-tonal" onClick={() => onNavigate('quality')} style={{ justifyContent: 'flex-start' }}>
                <CheckCircle2 size={16} /> ASTM 4-Pt QC
              </button>
              <button className="md-btn md-btn-tonal" onClick={() => onNavigate('dispatch')} style={{ justifyContent: 'flex-start' }}>
                <Truck size={16} /> Dispatch Manifest
              </button>
              <button className="md-btn md-btn-tonal" onClick={() => onNavigate('reports')} style={{ justifyContent: 'flex-start' }}>
                <TrendingUp size={16} /> Live Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
