/**
 * Centralized API client for Everest Textile Manufacturing ERP Backend
 */

const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.message || `HTTP ${response.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: () => request('/health'),
  getDatabaseHealth: () => request('/health/database'),

  // Master Data
  getEmployees: (params = {}) => request(`/employees?${new URLSearchParams(params)}`),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),

  getSuppliers: (params = {}) => request(`/suppliers?${new URLSearchParams(params)}`),
  createSupplier: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),

  getBuyers: (params = {}) => request(`/buyers?${new URLSearchParams(params)}`),
  createBuyer: (data) => request('/buyers', { method: 'POST', body: JSON.stringify(data) }),

  getYarnItems: (params = {}) => request(`/yarn-items?${new URLSearchParams(params)}`),
  createYarnItem: (data) => request('/yarn-items', { method: 'POST', body: JSON.stringify(data) }),
  getYarnItemStock: (id) => request(`/yarn-items/${id}/stock`),
  getYarnItemLedger: (id) => request(`/yarn-items/${id}/stock-ledger`),

  getFabricProducts: (params = {}) => request(`/fabric-products?${new URLSearchParams(params)}`),
  createFabricProduct: (data) => request('/fabric-products', { method: 'POST', body: JSON.stringify(data) }),

  getMachines: (params = {}) => request(`/machines?${new URLSearchParams(params)}`),
  createMachine: (data) => request('/machines', { method: 'POST', body: JSON.stringify(data) }),
  updateMachine: (id, data) => request(`/machines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getProcessStages: (params = {}) => request(`/process-stages?${new URLSearchParams(params)}`),
  getUnitsOfMeasure: (params = {}) => request(`/units-of-measure?${new URLSearchParams(params)}`),
  getYarnTypes: (params = {}) => request(`/yarn-types?${new URLSearchParams(params)}`),

  // Procurement & Inventory
  getPurchaseOrders: (params = {}) => request(`/purchase-orders?${new URLSearchParams(params)}`),
  createPurchaseOrder: (data) => request('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  addPurchaseOrderItem: (id, data) => request(`/purchase-orders/${id}/items`, { method: 'POST', body: JSON.stringify(data) }),
  updatePurchaseOrderStatus: (id, status) => request(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelPurchaseOrder: (id) => request(`/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),

  getGoodsReceipts: (params = {}) => request(`/goods-receipts?${new URLSearchParams(params)}`),
  createGoodsReceipt: (data) => request('/goods-receipts', { method: 'POST', body: JSON.stringify(data) }),
  cancelGoodsReceipt: (id, data = {}) => request(`/goods-receipts/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),

  getYarnStockMovements: (params = {}) => request(`/yarn-stock-movements?${new URLSearchParams(params)}`),
  createYarnStockMovement: (data) => request('/yarn-stock-movements', { method: 'POST', body: JSON.stringify(data) }),
  reverseYarnStockMovement: (id, data = {}) => request(`/yarn-stock-movements/${id}/reverse`, { method: 'POST', body: JSON.stringify(data) }),

  // Sales Orders & BOM
  getCustomerOrders: (params = {}) => request(`/customer-orders?${new URLSearchParams(params)}`),
  createCustomerOrder: (data) => request('/customer-orders', { method: 'POST', body: JSON.stringify(data) }),

  getOrderMaterialRequirements: (params = {}) => request(`/order-material-requirements?${new URLSearchParams(params)}`),
  createOrderMaterialRequirement: (data) => request('/order-material-requirements', { method: 'POST', body: JSON.stringify(data) }),
  checkMaterialSufficiency: (orderId) => request(`/order-material-requirements/check/${orderId}`),

  // Production Execution
  getProductionJobs: (params = {}) => request(`/production-jobs?${new URLSearchParams(params)}`),
  createProductionJob: (data) => request('/production-jobs', { method: 'POST', body: JSON.stringify(data) }),
  startProductionJob: (id, version = 1) => request(`/production-jobs/${id}/start`, { method: 'POST', body: JSON.stringify({ version }) }),
  completeProductionJob: (id, version = 1) => request(`/production-jobs/${id}/complete`, { method: 'POST', body: JSON.stringify({ version }) }),
  cancelProductionJob: (id, version = 1) => request(`/production-jobs/${id}/cancel`, { method: 'POST', body: JSON.stringify({ version }) }),

  getProductionLogs: (params = {}) => request(`/production-logs?${new URLSearchParams(params)}`),
  createProductionLog: (data) => request('/production-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Fabric Rolls & Quality Control
  getFabricRolls: (params = {}) => request(`/fabric-rolls?${new URLSearchParams(params)}`),
  createFabricRoll: (data) => request('/fabric-rolls', { method: 'POST', body: JSON.stringify(data) }),
  updateFabricRollStatus: (id, status, version = 1) => request(`/fabric-rolls/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, version }) }),

  getQcInspections: (params = {}) => request(`/qc-inspections?${new URLSearchParams(params)}`),
  createQcInspection: (data) => request('/qc-inspections', { method: 'POST', body: JSON.stringify(data) }),

  getQcDefects: (params = {}) => request(`/qc-defects?${new URLSearchParams(params)}`),
  createQcDefect: (data) => request('/qc-defects', { method: 'POST', body: JSON.stringify(data) }),

  // Dispatch & Logistics
  getDispatches: (params = {}) => request(`/dispatches?${new URLSearchParams(params)}`),
  createDispatch: (data) => request('/dispatches', { method: 'POST', body: JSON.stringify(data) }),
  addDispatchItem: (dispatchId, rollId, scannedByEmployeeId = 1) => request(`/dispatches/${dispatchId}/items`, { method: 'POST', body: JSON.stringify({ roll_id: rollId, scanned_by_employee_id: scannedByEmployeeId }) }),
  removeDispatchItem: (dispatchId, itemId) => request(`/dispatches/${dispatchId}/items/${itemId}/remove`, { method: 'POST' }),
  finalizeDispatch: (dispatchId, version = 1) => request(`/dispatches/${dispatchId}/dispatch`, { method: 'POST', body: JSON.stringify({ version }) }),
  cancelDispatch: (dispatchId, version = 1) => request(`/dispatches/${dispatchId}/cancel`, { method: 'POST', body: JSON.stringify({ version }) }),

  // Finance & Payments
  getInvoices: (params = {}) => request(`/invoices?${new URLSearchParams(params)}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  issueInvoice: (id, version = 1) => request(`/invoices/${id}/issue`, { method: 'POST', body: JSON.stringify({ version }) }),
  voidInvoice: (id, version = 1) => request(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ version }) }),

  getBuyerPayments: (params = {}) => request(`/buyer-payments?${new URLSearchParams(params)}`),
  createBuyerPayment: (data) => request('/buyer-payments', { method: 'POST', body: JSON.stringify(data) }),
  reverseBuyerPayment: (id) => request(`/buyer-payments/${id}/reverse`, { method: 'POST' }),

  // Workforce & Costing
  getAttendanceRecords: (params = {}) => request(`/attendance-records?${new URLSearchParams(params)}`),
  createAttendanceRecord: (data) => request('/attendance-records', { method: 'POST', body: JSON.stringify(data) }),

  getWageRecords: (params = {}) => request(`/wage-records?${new URLSearchParams(params)}`),
  createWageRecord: (data) => request('/wage-records', { method: 'POST', body: JSON.stringify(data) }),
  approveWageRecord: (id) => request(`/wage-records/${id}/approve`, { method: 'POST' }),
  disburseWageRecord: (id) => request(`/wage-records/${id}/disburse`, { method: 'POST' }),
  reverseWageRecord: (id) => request(`/wage-records/${id}/reverse`, { method: 'POST' }),

  getCostEntries: (params = {}) => request(`/cost-entries?${new URLSearchParams(params)}`),
  createCostEntry: (data) => request('/cost-entries', { method: 'POST', body: JSON.stringify(data) }),

  // Operational Reporting & System Invariant Checks
  getInventorySummaryReport: () => request('/reports/inventory-summary'),
  getReorderAlertsReport: () => request('/reports/reorder-alerts'),
  getOrderProgressReport: () => request('/reports/order-progress'),
  getProductionOutputReport: (params = {}) => request(`/reports/production-output?${new URLSearchParams(params)}`),
  getRollQualityReport: (params = {}) => request(`/reports/roll-quality?${new URLSearchParams(params)}`),
  getInvoiceOutstandingReport: () => request('/reports/invoice-outstanding'),
  getCostByOrderReport: (params = {}) => request(`/reports/cost-by-order?${new URLSearchParams(params)}`),
  getCostByMachineReport: (params = {}) => request(`/reports/cost-by-machine?${new URLSearchParams(params)}`),
  getWageSummaryReport: () => request('/reports/wage-summary'),
  getReconciliationReport: () => request('/reports/reconciliation'),
};
