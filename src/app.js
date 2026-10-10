'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const { checkDatabaseHealth } = require('./config/database');
const requestId = require('./middleware/request-id');
const errorHandler = require('./middleware/error-handler');
const notFound = require('./middleware/not-found');
const { success } = require('./utils/response');

// Route modules
const healthRouter = require('./routes/health');
const employeesRouter = require('./modules/employees/employees.routes');
const suppliersRouter = require('./modules/suppliers/suppliers.routes');
const buyersRouter = require('./modules/buyers/buyers.routes');
const unitsRouter = require('./modules/inventory/units.routes');
const yarnTypesRouter = require('./modules/inventory/yarn-types.routes');
const yarnItemsRouter = require('./modules/inventory/yarn-items.routes');
const fabricProductsRouter = require('./modules/inventory/fabric-products.routes');
const processStagesRouter = require('./modules/inventory/process-stages.routes');
const machinesRouter = require('./modules/inventory/machines.routes');
const purchaseOrdersRouter = require('./modules/procurement/purchase-orders.routes');
const goodsReceiptsRouter = require('./modules/procurement/goods-receipts.routes');
const stockMovementsRouter = require('./modules/procurement/stock-movements.routes');
const customerOrdersRouter = require('./modules/orders/customer-orders.routes');
const orderMaterialReqRouter = require('./modules/orders/order-material-req.routes');
const productionJobsRouter = require('./modules/production/production-jobs.routes');
const productionLogsRouter = require('./modules/production/production-logs.routes');
const fabricRollsRouter = require('./modules/quality/fabric-rolls.routes');
const qcInspectionsRouter = require('./modules/quality/qc-inspections.routes');
const qcDefectsRouter = require('./modules/quality/qc-defects.routes');
const dispatchesRouter = require('./modules/dispatch/dispatches.routes');
const invoicesRouter = require('./modules/invoicing/invoices.routes');
const buyerPaymentsRouter = require('./modules/payments/buyer-payments.routes');
const attendanceRouter = require('./modules/workforce/attendance.routes');
const wageRecordsRouter = require('./modules/workforce/wages.routes');
const costEntriesRouter = require('./modules/costing/cost-entries.routes');
const reportsRouter = require('./modules/reporting/reports.routes');

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
}));

// ── Request tracking ─────────────────────────────────────────────────────────
app.use(requestId);

// ── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms :req[x-request-id]'));
}

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Routes ───────────────────────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}`, healthRouter);
app.use(`${API}/employees`, employeesRouter);
app.use(`${API}/suppliers`, suppliersRouter);
app.use(`${API}/buyers`, buyersRouter);
app.use(`${API}/units-of-measure`, unitsRouter);
app.use(`${API}/yarn-types`, yarnTypesRouter);
app.use(`${API}/yarn-items`, yarnItemsRouter);
app.use(`${API}/fabric-products`, fabricProductsRouter);
app.use(`${API}/process-stages`, processStagesRouter);
app.use(`${API}/machines`, machinesRouter);
app.use(`${API}/purchase-orders`, purchaseOrdersRouter);
app.use(`${API}/goods-receipts`, goodsReceiptsRouter);
app.use(`${API}/yarn-stock-movements`, stockMovementsRouter);
app.use(`${API}/customer-orders`, customerOrdersRouter);
app.use(`${API}/order-material-requirements`, orderMaterialReqRouter);
app.use(`${API}/production-jobs`, productionJobsRouter);
app.use(`${API}/production-logs`, productionLogsRouter);
app.use(`${API}/fabric-rolls`, fabricRollsRouter);
app.use(`${API}/qc-inspections`, qcInspectionsRouter);
app.use(`${API}/qc-defects`, qcDefectsRouter);
app.use(`${API}/dispatches`, dispatchesRouter);
app.use(`${API}/invoices`, invoicesRouter);
app.use(`${API}/buyer-payments`, buyerPaymentsRouter);
app.use(`${API}/attendance-records`, attendanceRouter);
app.use(`${API}/wage-records`, wageRecordsRouter);
app.use(`${API}/cost-entries`, costEntriesRouter);
app.use(`${API}/reports`, reportsRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(notFound);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
