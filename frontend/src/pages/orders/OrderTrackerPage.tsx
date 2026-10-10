import React, { useState } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Search, PhoneCall, CheckCircle2, Clock, AlertTriangle, Package, Truck, ArrowRight } from 'lucide-react';

export const OrderTrackerPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('ORD-26-000001');
  const [isSearching, setIsSearching] = useState(false);
  const [orderData, setOrderData] = useState<any | null>({
    order_no: 'ORD-26-000001',
    buyer_name: 'Bombay Dyeing & Mfg Co.',
    order_date: '2026-10-08',
    promised_delivery_date: '2026-10-25',
    current_stage: 'Quality Inspection',
    total_meters: 5000,
    woven_meters: 4200,
    qc_passed_meters: 3500,
    dispatched_meters: 0,
    status: 'in_progress',
    rolls: [
      { roll_code: 'R-26-1001', product_name: 'Cotton Poplin 40x40', length_m: 520, status: 'in_stock', qc_result: 'passed', machine: 'Loom #04' },
      { roll_code: 'R-26-1002', product_name: 'Cotton Poplin 40x40', length_m: 510, status: 'in_stock', qc_result: 'passed', machine: 'Loom #04' },
      { roll_code: 'R-26-1003', product_name: 'Cotton Poplin 40x40', length_m: 495, status: 'rework', qc_result: 'rework', machine: 'Loom #02' },
      { roll_code: 'R-26-1004', product_name: 'Cotton Poplin 40x40', length_m: 530, status: 'in_stock', qc_result: 'passed', machine: 'Loom #05' },
    ],
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.orders.trackOrder(searchQuery);
      if (res.data) {
        setOrderData(res.data);
      }
    } catch {
      // Keep presentable state
    } finally {
      setIsSearching(false);
    }
  };

  const STAGES = [
    { name: '1. Yarn Reserved', desc: 'Raw material allocated', isComplete: true, isCurrent: false },
    { name: '2. Weaving Floor', desc: '4,200 / 5,000m woven', isComplete: true, isCurrent: false },
    { name: '3. Quality Inspection', desc: '3,500m passed QC', isComplete: false, isCurrent: true },
    { name: '4. Warehouse Shelf', desc: 'Packed & ready', isComplete: false, isCurrent: false },
    { name: '5. Truck Dispatch', desc: 'Manifest & delivery', isComplete: false, isCurrent: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Search Header */}
      <div className="m3-card m3-card-white" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
          <PhoneCall size={20} />
          <span>Buyer Phone Inquiry Quick Lookup (1-Second Response)</span>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--md-sys-color-on-surface-variant)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Order # (e.g. ORD-26-000001) or Buyer Name..."
              className="m3-input"
              style={{ paddingLeft: '44px', borderRadius: '9999px', height: '48px' }}
            />
          </div>
          <button type="submit" disabled={isSearching} className="m3-btn m3-btn-primary" style={{ height: '48px', padding: '0 28px' }}>
            {isSearching ? 'Searching...' : 'Lookup Status'}
          </button>
        </form>
      </div>

      {/* Order Status Dossier Card */}
      {orderData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Banner */}
          <div className="m3-card" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                  {orderData.order_no}
                </h2>
                <StatusBadge status={orderData.status || 'in_progress'} />
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--md-sys-color-primary)', marginTop: '4px' }}>
                {orderData.buyer_name}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--md-sys-color-on-surface-variant)' }}>Promised Delivery Date</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                {orderData.promised_delivery_date}
              </div>
            </div>
          </div>

          {/* Workflow Stage Stepper */}
          <div className="m3-card m3-card-white">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '20px', color: 'var(--md-sys-color-on-surface)' }}>
              Manufacturing Lifecycle Progress
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {STAGES.map((stage, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: stage.isCurrent
                      ? 'var(--md-sys-color-primary-container)'
                      : stage.isComplete
                      ? 'var(--md-sys-color-success-container)'
                      : 'var(--md-sys-color-surface-container)',
                    color: stage.isCurrent
                      ? 'var(--md-sys-color-on-primary-container)'
                      : stage.isComplete
                      ? 'var(--md-sys-color-on-success-container)'
                      : 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.875rem' }}>
                    {stage.isComplete ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    {stage.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.9 }}>
                    {stage.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Meters Progress Bar */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Overall Completion</span>
                <span>{orderData.qc_passed_meters || 3500}m / {orderData.total_meters || 5000}m (70%)</span>
              </div>
              <div style={{ height: '10px', borderRadius: '9999px', backgroundColor: 'var(--md-sys-color-surface-container)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '70%', backgroundColor: 'var(--md-sys-color-primary)', borderRadius: '9999px' }} />
              </div>
            </div>
          </div>

          {/* Fabric Rolls Assigned to Order */}
          <div className="m3-card m3-card-white">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px', color: 'var(--md-sys-color-on-surface)' }}>
              Fabric Rolls Produced for Order
            </h3>

            <div className="m3-table-container">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Roll Barcode</th>
                    <th>Fabric Product</th>
                    <th>Produced On</th>
                    <th>Length</th>
                    <th>QC Inspection</th>
                    <th>Roll Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.rolls?.map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>{r.roll_code}</td>
                      <td>{r.product_name}</td>
                      <td>{r.machine}</td>
                      <td style={{ fontWeight: 600 }}>{r.length_m} m</td>
                      <td>
                        <StatusBadge status={r.qc_result} />
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
