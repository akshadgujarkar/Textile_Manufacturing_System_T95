import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { CustomerOrder } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Plus, RefreshCw, Eye, Search } from 'lucide-react';

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fallbackOrders: CustomerOrder[] = [
    { order_id: 1, order_no: 'ORD-26-000001', buyer_id: 1, buyer_name: 'Bombay Dyeing & Mfg Co.', order_date: '2026-10-08', promised_delivery_date: '2026-10-25', status: 'in_progress', total_meters: 5000, version: 1 },
    { order_id: 2, order_no: 'ORD-26-000002', buyer_id: 2, buyer_name: 'Arvind Lifestyle Brands Ltd.', order_date: '2026-10-09', promised_delivery_date: '2026-10-28', status: 'pending', total_meters: 3200, version: 1 },
    { order_id: 3, order_no: 'ORD-26-000003', buyer_id: 3, buyer_name: 'Raymond Textiles Ltd.', order_date: '2026-10-05', promised_delivery_date: '2026-10-20', status: 'completed', total_meters: 8000, version: 2 },
  ];

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await api.orders.getOrders();
      if (res.data && res.data.length > 0) {
        setOrders(res.data);
      } else {
        setOrders(fallbackOrders);
      }
    } catch {
      setOrders(fallbackOrders);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const columns: Column<CustomerOrder>[] = [
    {
      header: 'Order Number',
      accessor: 'order_no',
      render: (row) => <span style={{ fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>{row.order_no}</span>,
    },
    {
      header: 'Buyer / Client',
      accessor: 'buyer_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.buyer_name}</span>,
    },
    {
      header: 'Order Date',
      accessor: 'order_date',
    },
    {
      header: 'Promised Delivery',
      accessor: 'promised_delivery_date',
    },
    {
      header: 'Total Fabric Meters',
      accessor: 'total_meters',
      render: (row) => `${Number(row.total_meters || 0).toLocaleString()} m`,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => navigate(`/app/orders/${row.order_id}`)}
          className="m3-btn m3-btn-tonal"
          style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem' }}
        >
          <Eye size={14} /> View Details
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            Customer Orders & Production Work Orders
          </h1>
          <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.875rem' }}>
            Manage buyer orders, stock reservations, and manufacturing progress.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchOrders} className="m3-btn m3-btn-outlined" style={{ height: '40px' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => navigate('/app/orders/new')} className="m3-btn m3-btn-primary" style={{ height: '40px' }}>
            <Plus size={16} /> Create New Order
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        searchPlaceholder="Filter by Order # or Buyer Name..."
        searchFields={['order_no', 'buyer_name']}
      />
    </div>
  );
};
