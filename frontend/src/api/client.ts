import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('tms_auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Error Extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'An unexpected error occurred';
    const code = errorData?.code || 'NETWORK_ERROR';

    const isAuthEndpoint = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isAuthEndpoint && window.location.pathname !== '/login') {
      const existingToken = localStorage.getItem('tms_auth_token');
      if (existingToken && !existingToken.startsWith('mock_')) {
        localStorage.removeItem('tms_auth_token');
        localStorage.removeItem('tms_auth_user');
        window.dispatchEvent(new Event('tms_session_expired'));
      }
    }

    return Promise.reject({
      status: error.response?.status,
      code,
      message,
      data: error.response?.data,
    });
  }
);

export const api = {
  // 1. Authentication
  auth: {
    login: async (credentials: { username: string; password: string }) => {
      const res = await apiClient.post('/auth/login', credentials);
      return res.data;
    },
    getProfile: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
  },

  // 2. Raw Materials & Gate Inward (W1)
  rawMaterials: {
    getYarnStock: async (params?: { isLowStock?: boolean; yarnTypeId?: number; search?: string }) => {
      const res = await apiClient.get('/raw-materials/stock', { params });
      return res.data;
    },
    createGateReceipt: async (payload: any) => {
      const res = await apiClient.post('/raw-materials/gate-receipts', payload);
      return res.data;
    },
    getReceipts: async (params?: any) => {
      const res = await apiClient.get('/raw-materials/receipts', { params });
      return res.data;
    },
    getPrintPayload: async (receiptId: number) => {
      const res = await apiClient.get(`/raw-materials/receipts/${receiptId}/print-payload`);
      return res.data;
    },
  },

  // 3. Customer Orders & Reservations (W4)
  orders: {
    getOrders: async (params?: any) => {
      const res = await apiClient.get('/orders', { params });
      return res.data;
    },
    getOrderById: async (orderId: number) => {
      const res = await apiClient.get(`/orders/${orderId}`);
      return res.data;
    },
    createOrder: async (payload: any) => {
      const res = await apiClient.post('/orders', payload);
      return res.data;
    },
    checkMaterialFeasibility: async (orderId: number) => {
      const res = await apiClient.get(`/orders/${orderId}/feasibility`);
      return res.data;
    },
    trackOrder: async (query: string) => {
      const res = await apiClient.get('/orders/tracking/lookup', { params: { query } });
      return res.data;
    },
  },

  // 4. Production Floor & Machines (W2)
  production: {
    getFloorStatus: async () => {
      const res = await apiClient.get('/production/floor-matrix');
      return res.data;
    },
    getFloorMatrix: async () => {
      const res = await apiClient.get('/production/floor-matrix');
      return res.data;
    },
    getJobs: async (params?: any) => {
      const res = await apiClient.get('/production/jobs', { params });
      return res.data;
    },
    createJob: async (payload: any) => {
      const res = await apiClient.post('/production/jobs', payload);
      return res.data;
    },
    startJob: async (jobId: number, version: number) => {
      const res = await apiClient.post(`/production/jobs/${jobId}/start`, { version });
      return res.data;
    },
    completeJob: async (jobId: number, version: number) => {
      const res = await apiClient.post(`/production/jobs/${jobId}/complete`, { version });
      return res.data;
    },
    logShiftOutput: async (payload: any) => {
      const res = await apiClient.post('/production/logs', payload);
      return res.data;
    },
    recordBreakdown: async (payload: any) => {
      const res = await apiClient.post('/production/breakdowns', payload);
      return res.data;
    },
    resolveDowntime: async (eventId: any, payload?: any) => {
      const res = await apiClient.post(`/production/breakdowns/${eventId}/resolve`, payload || {});
      return res.data;
    },
    getDowntimeHistory: async (params?: any) => {
      const res = await apiClient.get('/production/downtime-history', { params });
      return res.data;
    },
    getDowntime: async (params?: any) => {
      const res = await apiClient.get('/production/downtime-history', { params });
      return res.data;
    },
    logDowntime: async (payload: any) => {
      const res = await apiClient.post('/production/breakdowns', payload);
      return res.data;
    },
    updateJob: async (jobId: any, payload: any) => {
      const res = await apiClient.put(`/production/jobs/${jobId}`, payload);
      return res.data;
    },
  },

  // 5. Quality Control & Traceability (W3)
  quality: {
    getRollByCode: async (rollCode: string) => {
      const res = await apiClient.get(`/quality/rolls/${rollCode}`);
      return res.data;
    },
    getRolls: async (params?: any) => {
      const res = await apiClient.get('/quality/shelf-inventory', { params });
      return res.data;
    },
    submitInspection: async (payload: any) => {
      const res = await apiClient.post('/quality/inspections', payload);
      return res.data;
    },
    recordInspection: async (payload: any) => {
      const res = await apiClient.post('/quality/inspections', payload);
      return res.data;
    },
    getShelfInventory: async (params?: any) => {
      const res = await apiClient.get('/quality/shelf-inventory', { params });
      return res.data;
    },
    getTraceability: async (rollCode: string) => {
      const res = await apiClient.get(`/quality/traceability/${rollCode}`);
      return res.data;
    },
    getTraceDossier: async (rollCode: string) => {
      const res = await apiClient.get(`/quality/traceability/${rollCode}`);
      return res.data;
    },
    getDefectAnalytics: async () => {
      const [byMachine, byOperator] = await Promise.all([
        apiClient.get('/quality/defect-analytics/machines'),
        apiClient.get('/quality/defect-analytics/operators'),
      ]);
      return {
        byMachine: byMachine.data?.data || [],
        byOperator: byOperator.data?.data || [],
      };
    },
  },

  // 6. Dispatch & Loading (W5)
  dispatch: {
    getDispatches: async (params?: any) => {
      const res = await apiClient.get('/dispatches', { params });
      return res.data;
    },
    getManifests: async (params?: any) => {
      const res = await apiClient.get('/dispatches', { params });
      return res.data;
    },
    getDispatchById: async (dispatchId: number) => {
      const res = await apiClient.get(`/dispatches/${dispatchId}`);
      return res.data;
    },
    createDispatch: async (payload: any) => {
      const res = await apiClient.post('/dispatches', payload);
      return res.data;
    },
    createManifest: async (payload: any) => {
      const res = await apiClient.post('/dispatches', payload);
      return res.data;
    },
    startLoading: async (dispatchId: number, version: number) => {
      const res = await apiClient.post(`/dispatches/${dispatchId}/start-loading`, { version });
      return res.data;
    },
    scanRoll: async (dispatchId: number, rollCode: string) => {
      const res = await apiClient.post(`/dispatches/${dispatchId}/scan-roll`, { rollCode });
      return res.data;
    },
    removeRoll: async (dispatchId: number, dispatchItemId: number, reason: string) => {
      const res = await apiClient.post(`/dispatches/${dispatchId}/items/${dispatchItemId}/remove`, { reason });
      return res.data;
    },
    completeDispatch: async (dispatchId: number, vehicleNo: string, version: number) => {
      const res = await apiClient.post(`/dispatches/${dispatchId}/complete`, { vehicleNo, version });
      return res.data;
    },
  },

  // 7. Finance, Invoicing & Supplier Bills (W6)
  finance: {
    generateInvoiceFromDispatch: async (dispatchId: number) => {
      const res = await apiClient.post(`/finance/invoices/from-dispatch/${dispatchId}`);
      return res.data;
    },
    getInvoices: async (params?: any) => {
      const res = await apiClient.get('/finance/invoices', { params });
      return res.data;
    },
    createInvoice: async (payload: any) => {
      const res = await apiClient.post('/finance/invoices', payload);
      return res.data;
    },
    getInvoiceById: async (invoiceId: number) => {
      const res = await apiClient.get(`/finance/invoices/${invoiceId}`);
      return res.data;
    },
    issueInvoice: async (invoiceId: number, version: number) => {
      const res = await apiClient.post(`/finance/invoices/${invoiceId}/issue`, { version });
      return res.data;
    },
    voidInvoice: async (invoiceId: number, reason: string) => {
      const res = await apiClient.post(`/finance/invoices/${invoiceId}/void`, { reason });
      return res.data;
    },
    getInvoiceBalances: async (params?: any) => {
      const res = await apiClient.get('/finance/invoices/balances', { params });
      return res.data;
    },
    recordSupplierBill: async (payload: any) => {
      const res = await apiClient.post('/finance/supplier-bills', payload);
      return res.data;
    },
    getSupplierBillVariances: async () => {
      const res = await apiClient.get('/finance/supplier-bills/variances');
      return res.data;
    },
    recordBuyerPayment: async (payload: any) => {
      const res = await apiClient.post('/finance/payments', payload);
      return res.data;
    },
    getBuyerLedger: async (buyerId: number) => {
      const res = await apiClient.get(`/finance/buyers/${buyerId}/ledger`);
      return res.data;
    },
    getPeriods: async () => {
      const res = await apiClient.get('/finance/periods');
      return res.data;
    },
    closePeriod: async (periodId: number) => {
      const res = await apiClient.post(`/finance/periods/${periodId}/close`);
      return res.data;
    },
  },

  // 8. Workforce & Wages (W6)
  workforce: {
    recordAttendance: async (records: any[]) => {
      const res = await apiClient.post('/workforce/attendance', { records });
      return res.data;
    },
    getAttendance: async (params?: any) => {
      const res = await apiClient.get('/workforce/attendance', { params });
      return res.data;
    },
    generateMonthlyWages: async (periodId: number) => {
      const res = await apiClient.post('/workforce/wages/generate', { periodId });
      return res.data;
    },
    getWageSummary: async (params?: { periodId?: number }) => {
      const res = await apiClient.get('/workforce/wages', { params });
      return res.data;
    },
    approveWage: async (wageId: number) => {
      const res = await apiClient.post(`/workforce/wages/${wageId}/approve`);
      return res.data;
    },
    reverseWage: async (wageId: number, reason: string) => {
      const res = await apiClient.post(`/workforce/wages/${wageId}/reverse`, { reason });
      return res.data;
    },
  },

  // 9. Executive Reporting & Analytics
  executive: {
    getPLStatement: async (periodId?: number) => {
      const res = await apiClient.get('/executive/pl-statement', { params: { periodId } });
      return res.data;
    },
    getMonthlyPL: async (month?: string) => {
      const res = await apiClient.get('/executive/pl-statement', { params: { month } });
      return res.data;
    },
    getOrderCosting: async (orderId?: number) => {
      const res = await apiClient.get('/executive/order-costing', { params: { orderId } });
      return res.data;
    },
    getRollCosting: async (rollId?: number) => {
      const res = await apiClient.get('/executive/roll-costing', { params: { rollId } });
      return res.data;
    },
    getMachineProductivity: async (params?: { periodId?: number; machineId?: number }) => {
      const res = await apiClient.get('/executive/machine-productivity', { params });
      return res.data;
    },
  },

  // 10. Admin & System Health
  admin: {
    getHealthCheck: async () => {
      const res = await apiClient.get('/admin/health-check');
      return res.data;
    },
    getAuditLogs: async (params?: any) => {
      const res = await apiClient.get('/admin/audit-logs', { params });
      return res.data;
    },
    getSuppliers: async (activeOnly = false) => {
      const res = await apiClient.get('/admin/masters/suppliers', { params: { activeOnly } });
      return res.data;
    },
    createSupplier: async (data: any) => {
      const res = await apiClient.post('/admin/masters/suppliers', data);
      return res.data;
    },
    getBuyers: async (activeOnly = false) => {
      const res = await apiClient.get('/admin/masters/buyers', { params: { activeOnly } });
      return res.data;
    },
    createBuyer: async (data: any) => {
      const res = await apiClient.post('/admin/masters/buyers', data);
      return res.data;
    },
    getYarnItems: async () => {
      const res = await apiClient.get('/admin/masters/yarn-items');
      return res.data;
    },
    createYarnItem: async (data: any) => {
      const res = await apiClient.post('/admin/masters/yarn-items', data);
      return res.data;
    },
    getFabricProducts: async () => {
      const res = await apiClient.get('/admin/masters/fabric-products');
      return res.data;
    },
    createFabricProduct: async (data: any) => {
      const res = await apiClient.post('/admin/masters/fabric-products', data);
      return res.data;
    },
    getMachines: async () => {
      const res = await apiClient.get('/admin/masters/machines');
      return res.data;
    },
    createMachine: async (data: any) => {
      const res = await apiClient.post('/admin/masters/machines', data);
      return res.data;
    },
    getDefectTypes: async () => {
      const res = await apiClient.get('/admin/masters/defect-types');
      return res.data;
    },
    createDefectType: async (data: { name: string }) => {
      const res = await apiClient.post('/admin/masters/defect-types', data);
      return res.data;
    },
    getEmployees: async () => {
      const res = await apiClient.get('/admin/masters/employees');
      return res.data;
    },
    createEmployee: async (data: any) => {
      const res = await apiClient.post('/admin/masters/employees', data);
      return res.data;
    },
    getShifts: async () => {
      const res = await apiClient.get('/admin/masters/shifts');
      return res.data;
    },
    createShift: async (data: any) => {
      const res = await apiClient.post('/admin/masters/shifts', data);
      return res.data;
    },
  },
};
