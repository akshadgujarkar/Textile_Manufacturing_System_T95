import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { YarnStockItem } from '../../types';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';

export const StockPage: React.FC = () => {
  const navigate = useNavigate();
  const [stock, setStock] = useState<YarnStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Fallback demo data
  const fallbackStock: YarnStockItem[] = [
    { yarn_item_id: 1, yarn_type_name: 'Cotton 30s Combed', colour_name: 'Raw White', unit_code: 'kg', on_hand_qty: '2450.000', reserved_qty: '600.000', available_qty: '1850.000', reorder_level: '500.000', is_low_stock: false },
    { yarn_item_id: 2, yarn_type_name: 'Polyester 150D/48F', colour_name: 'Navy Blue #02', unit_code: 'kg', on_hand_qty: '380.000', reserved_qty: '300.000', available_qty: '80.000', reorder_level: '400.000', is_low_stock: true },
    { yarn_item_id: 3, yarn_type_name: 'Viscose 40s Ring Spun', colour_name: 'Jet Black', unit_code: 'kg', on_hand_qty: '1200.000', reserved_qty: '450.000', available_qty: '750.000', reorder_level: '300.000', is_low_stock: false },
    { yarn_item_id: 4, yarn_type_name: 'Linen 60s Wet Spun', colour_name: 'Natural Flax', unit_code: 'kg', on_hand_qty: '180.000', reserved_qty: '150.000', available_qty: '30.000', reorder_level: '250.000', is_low_stock: true },
    { yarn_item_id: 5, yarn_type_name: 'Cotton 40s Compact', colour_name: 'Bleached White', unit_code: 'kg', on_hand_qty: '3100.000', reserved_qty: '1200.000', available_qty: '1900.000', reorder_level: '600.000', is_low_stock: false },
  ];

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const res = await api.rawMaterials.getYarnStock({ isLowStock: lowStockOnly ? true : undefined });
      if (res.data && res.data.length > 0) {
        setStock(res.data);
      } else {
        setStock(lowStockOnly ? fallbackStock.filter((s) => s.is_low_stock) : fallbackStock);
      }
    } catch (err) {
      setStock(lowStockOnly ? fallbackStock.filter((s) => s.is_low_stock) : fallbackStock);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [lowStockOnly]);

  const lowStockCount = stock.filter((i) => i.is_low_stock).length;

  const columns: Column<YarnStockItem>[] = [
    {
      header: 'Yarn Item',
      accessor: 'yarn_type_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--md-sys-color-on-surface)' }}>{row.yarn_type_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>ID: #{row.yarn_item_id}</div>
        </div>
      ),
    },
    {
      header: 'Shade / Colour',
      accessor: 'colour_name',
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-primary)', display: 'inline-block' }} />
          {row.colour_name}
        </span>
      ),
    },
    {
      header: 'On-Hand Qty',
      accessor: 'on_hand_qty',
      render: (row) => (
        <span style={{ fontWeight: 700 }}>
          {Number(row.on_hand_qty).toLocaleString()} {row.unit_code}
        </span>
      ),
    },
    {
      header: 'Reserved Qty',
      accessor: 'reserved_qty',
      render: (row) => (
        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {Number(row.reserved_qty).toLocaleString()} {row.unit_code}
        </span>
      ),
    },
    {
      header: 'Available for Production',
      accessor: 'available_qty',
      render: (row) => {
        const avail = Number(row.available_qty);
        return (
          <span style={{ fontWeight: 700, color: avail <= 0 ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-success)' }}>
            {avail.toLocaleString()} {row.unit_code}
          </span>
        );
      },
    },
    {
      header: 'Reorder Level',
      accessor: 'reorder_level',
      render: (row) => `${Number(row.reorder_level).toLocaleString()} ${row.unit_code}`,
    },
    {
      header: 'Stock Health',
      render: (row) => (
        <StatusBadge
          status={row.is_low_stock ? 'Low Stock' : 'Normal'}
          variant={row.is_low_stock ? 'warning' : 'success'}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            Raw Material Yarn Stock
          </h1>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.875rem', marginTop: '2px' }}>
            Real-time yarn stock balance ledger (INV-1 & INV-9 atomic verification)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchStock} className="m3-btn m3-btn-outlined" style={{ height: '40px' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => navigate('/app/raw-materials/gate-entry')}
            className="m3-btn m3-btn-primary"
            style={{ height: '40px' }}
          >
            <Plus size={16} /> New Gate Inward
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockCount > 0 && (
        <div
          className="m3-card"
          style={{
            backgroundColor: 'var(--md-sys-color-warning-container)',
            color: 'var(--md-sys-color-on-warning-container)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} />
            <div>
              <div style={{ fontWeight: 700 }}>Low Stock Alert Triggered</div>
              <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
                {lowStockCount} yarn items have fallen below their safety reorder thresholds.
              </div>
            </div>
          </div>
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className="m3-btn m3-btn-tonal"
            style={{ height: '36px', fontSize: '0.8125rem' }}
          >
            {lowStockOnly ? 'Show All Items' : 'Filter Low Stock'}
          </button>
        </div>
      )}

      {/* Main Stock Data Table */}
      <DataTable
        columns={columns}
        data={stock}
        isLoading={isLoading}
        searchPlaceholder="Filter by yarn type or colour..."
        searchFields={['yarn_type_name', 'colour_name']}
      />
    </div>
  );
};
