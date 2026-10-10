import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface NewOrderItem {
  productId: number;
  productName: string;
  colourId: number;
  colourName: string;
  orderedLengthM: number;
  unitRate: number;
}

export const NewOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [buyerId, setBuyerId] = useState(1);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [promisedDeliveryDate, setPromisedDeliveryDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<NewOrderItem[]>([
    { productId: 1, productName: '100% Cotton Poplin 40x40/133x72', colourId: 1, colourName: 'Raw White', orderedLengthM: 2500, unitRate: 145.0 },
  ]);

  const PRODUCT_OPTIONS = [
    { id: 1, name: '100% Cotton Poplin 40x40/133x72', defaultRate: 145.0 },
    { id: 2, name: 'Poly-Cotton Shirting 50/50 45x45', defaultRate: 120.0 },
    { id: 3, name: 'Viscose Rayon Twill 30s/68x64', defaultRate: 165.0 },
    { id: 4, name: 'Linen-Cotton Blend Suiting 60s', defaultRate: 280.0 },
  ];

  const COLOUR_OPTIONS = [
    { id: 1, name: 'Raw White' },
    { id: 2, name: 'Navy Blue #02' },
    { id: 3, name: 'Jet Black' },
    { id: 4, name: 'Bleached White' },
    { id: 5, name: 'Natural Flax' },
  ];

  const handleAddItem = () => {
    const nextProd = PRODUCT_OPTIONS[items.length % PRODUCT_OPTIONS.length];
    setItems((prev) => [
      ...prev,
      {
        productId: nextProd.id,
        productName: nextProd.name,
        colourId: 1,
        colourName: 'Raw White',
        orderedLengthM: 1000,
        unitRate: nextProd.defaultRate,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof NewOrderItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'productId') {
        const prod = PRODUCT_OPTIONS.find((p) => p.id === Number(value));
        updated[index] = {
          ...updated[index],
          productId: Number(value),
          productName: prod?.name || '',
          unitRate: prod?.defaultRate || updated[index].unitRate,
        };
      } else if (field === 'colourId') {
        const col = COLOUR_OPTIONS.find((c) => c.id === Number(value));
        updated[index] = {
          ...updated[index],
          colourId: Number(value),
          colourName: col?.name || '',
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        buyerId,
        orderDate,
        promisedDeliveryDate,
        clientRequestId: `ord_req_${Date.now()}`,
        items: items.map((i) => ({
          productId: i.productId,
          colourId: i.colourId,
          orderedLengthM: Number(i.orderedLengthM),
          unitRate: Number(i.unitRate),
        })),
      };

      await api.orders.createOrder(payload);
      navigate('/app/orders/list');
    } catch {
      navigate('/app/orders/list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalMeters = items.reduce((sum, i) => sum + Number(i.orderedLengthM || 0), 0);
  const totalValuation = items.reduce((sum, i) => sum + Number(i.orderedLengthM || 0) * Number(i.unitRate || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={() => navigate('/app/orders/list')} className="m3-btn m3-btn-outlined" style={{ height: '38px', padding: '0 12px' }}>
          <ArrowLeft size={16} /> Back to Orders
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            Create Customer Work Order (WF-4)
          </h1>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.875rem' }}>
            Multi-item order placement with automated raw material reservation and feasibility checks.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Buyer & Delivery Schedule */}
        <div className="m3-card m3-card-white">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px', color: 'var(--md-sys-color-on-surface)' }}>
            1. Buyer Information & Promised Delivery
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="m3-form-group">
              <label className="m3-label">Buyer / Client</label>
              <select value={buyerId} onChange={(e) => setBuyerId(Number(e.target.value))} className="m3-select">
                <option value={1}>Bombay Dyeing & Mfg Co. (Credit: ₹50,00,000)</option>
                <option value={2}>Arvind Lifestyle Brands Ltd. (Credit: ₹35,00,000)</option>
                <option value={3}>Raymond Textiles Ltd. (Credit: ₹1,00,00,000)</option>
                <option value={4}>Page Industries (Jockey India) (Credit: ₹75,00,000)</option>
              </select>
            </div>

            <div className="m3-form-group">
              <label className="m3-label">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="m3-input"
              />
            </div>

            <div className="m3-form-group">
              <label className="m3-label">Promised Dispatch Date</label>
              <input
                type="date"
                value={promisedDeliveryDate}
                onChange={(e) => setPromisedDeliveryDate(e.target.value)}
                required
                className="m3-input"
              />
            </div>
          </div>
        </div>

        {/* Order Line Items */}
        <div className="m3-card m3-card-white">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              2. Ordered Fabric Specifications & Length
            </h3>
            <button type="button" onClick={handleAddItem} className="m3-btn m3-btn-tonal" style={{ height: '36px', fontSize: '0.8125rem' }}>
              <Plus size={16} /> Add Another Fabric Item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '14px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  borderRadius: '16px',
                }}
              >
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Fabric Product #{idx + 1}
                  </label>
                  <select
                    value={item.productId}
                    onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                    className="m3-select"
                    style={{ height: '44px', marginTop: '4px' }}
                  >
                    {PRODUCT_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Shade / Colour
                  </label>
                  <select
                    value={item.colourId}
                    onChange={(e) => handleItemChange(idx, 'colourId', e.target.value)}
                    className="m3-select"
                    style={{ height: '44px', marginTop: '4px' }}
                  >
                    {COLOUR_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Length (Meters)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="10"
                    value={item.orderedLengthM}
                    onChange={(e) => handleItemChange(idx, 'orderedLengthM', parseFloat(e.target.value) || 0)}
                    required
                    className="m3-input"
                    style={{ height: '44px', marginTop: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Rate (₹/m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={item.unitRate}
                    onChange={(e) => handleItemChange(idx, 'unitRate', parseFloat(e.target.value) || 0)}
                    required
                    className="m3-input"
                    style={{ height: '44px', marginTop: '4px' }}
                  />
                </div>

                <div style={{ paddingTop: '18px' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length === 1}
                    className="m3-btn m3-btn-text"
                    style={{ color: 'var(--md-sys-color-error)', padding: '8px' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '24px',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(121, 116, 126, 0.12)',
              fontSize: '0.9375rem',
            }}
          >
            <div>Total Length: <strong>{totalMeters.toLocaleString()} meters</strong></div>
            <div>Order Value: <strong>₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={() => navigate('/app/orders/list')} className="m3-btn m3-btn-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="m3-btn m3-btn-primary"
            style={{ height: '48px', padding: '0 32px' }}
          >
            {isSubmitting ? 'Validating Feasibility...' : 'Place Order & Auto-Reserve Yarn'}
          </button>
        </div>
      </form>
    </div>
  );
};
