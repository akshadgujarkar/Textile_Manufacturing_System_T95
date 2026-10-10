import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';

// Auth Pages
import { Login } from './pages/Login';

// Dashboard
import { DashboardHub } from './pages/DashboardHub';

// Raw Materials
import { StockPage } from './pages/raw-materials/StockPage';
import { GateInwardPage } from './pages/raw-materials/GateInwardPage';
import { ReceiptsPage } from './pages/raw-materials/ReceiptsPage';

// Orders & Sales
import { OrdersListPage } from './pages/orders/OrdersListPage';
import { NewOrderPage } from './pages/orders/NewOrderPage';
import { OrderTrackerPage } from './pages/orders/OrderTrackerPage';

// Production & Floor
import { FloorMatrixPage } from './pages/production/FloorMatrixPage';
import { JobsPage } from './pages/production/JobsPage';
import { TouchShiftLoggerPage } from './pages/production/TouchShiftLoggerPage';
import { DowntimePage } from './pages/production/DowntimePage';

// Quality & Finished Goods
import { QcInspectionPage } from './pages/quality/QcInspectionPage';
import { ShelfInventoryPage } from './pages/quality/ShelfInventoryPage';
import { RollTraceabilityPage } from './pages/quality/RollTraceabilityPage';
import { DefectAnalyticsPage } from './pages/quality/DefectAnalyticsPage';

// Dispatch & Logistics
import { DispatchListPage } from './pages/dispatch/DispatchListPage';
import { TruckLoadingPage } from './pages/dispatch/TruckLoadingPage';

// Finance & Workforce
import { InvoicingPage } from './pages/finance/InvoicingPage';
import { PaymentsPage } from './pages/finance/PaymentsPage';
import { SupplierBillsPage } from './pages/finance/SupplierBillsPage';
import { WorkforceWagesPage } from './pages/finance/WorkforceWagesPage';
import { PeriodClosePage } from './pages/finance/PeriodClosePage';

// Executive & Admin
import { ExecutiveDashboardPage } from './pages/executive/ExecutiveDashboardPage';
import { ReconciliationHealthPage } from './pages/admin/ReconciliationHealthPage';
import { AuditTrailPage } from './pages/admin/AuditTrailPage';
import { MastersCrudPage } from './pages/admin/MastersCrudPage';

const ProtectedLayout: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardHub />} />

            {/* Raw Materials */}
            <Route path="/raw-materials" element={<StockPage />} />
            <Route path="/raw-materials/gate-inward" element={<GateInwardPage />} />
            <Route path="/raw-materials/receipts" element={<ReceiptsPage />} />

            {/* Orders */}
            <Route path="/orders" element={<OrdersListPage />} />
            <Route path="/orders/new" element={<NewOrderPage />} />
            <Route path="/orders/tracker" element={<OrderTrackerPage />} />

            {/* Production */}
            <Route path="/production" element={<FloorMatrixPage />} />
            <Route path="/production/jobs" element={<JobsPage />} />
            <Route path="/production/shift-logger" element={<TouchShiftLoggerPage />} />
            <Route path="/production/downtime" element={<DowntimePage />} />

            {/* Quality & Finished Goods */}
            <Route path="/quality" element={<QcInspectionPage />} />
            <Route path="/quality/rolls" element={<ShelfInventoryPage />} />
            <Route path="/quality/traceability" element={<RollTraceabilityPage />} />
            <Route path="/quality/defects" element={<DefectAnalyticsPage />} />

            {/* Dispatch */}
            <Route path="/dispatch" element={<DispatchListPage />} />
            <Route path="/dispatch/loading" element={<TruckLoadingPage />} />

            {/* Finance & Workforce */}
            <Route path="/finance/invoicing" element={<InvoicingPage />} />
            <Route path="/finance/payments" element={<PaymentsPage />} />
            <Route path="/finance/supplier-bills" element={<SupplierBillsPage />} />
            <Route path="/finance/wages" element={<WorkforceWagesPage />} />
            <Route path="/finance/period-close" element={<PeriodClosePage />} />

            {/* Executive & Admin */}
            <Route path="/executive" element={<ExecutiveDashboardPage />} />
            <Route path="/admin/health" element={<ReconciliationHealthPage />} />
            <Route path="/admin/audit" element={<AuditTrailPage />} />
            <Route path="/admin/masters" element={<MastersCrudPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

