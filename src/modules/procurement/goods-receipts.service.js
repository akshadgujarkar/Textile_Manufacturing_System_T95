'use strict';

const GoodsReceiptsRepository = require('./goods-receipts.repository');
const StockMovementsRepository = require('./stock-movements.repository');
const PurchaseOrdersRepository = require('./purchase-orders.repository');
const SupplierRepository = require('../suppliers/suppliers.repository');
const EmployeeRepository = require('../employees/employees.repository');
const YarnItemsRepository = require('../inventory/yarn-items.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const GoodsReceiptsService = {
  async listGoodsReceipts(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await GoodsReceiptsRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      supplier_id: query.supplier_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getGoodsReceiptById(receiptId) {
    const receipt = await GoodsReceiptsRepository.findById(receiptId);
    if (!receipt) {
      throw createError(`Goods receipt with ID ${receiptId} not found`, 404, 'NOT_FOUND');
    }
    return receipt;
  },

  async createGoodsReceipt(data) {
    // 1. Idempotency Check: if client_request_id exists, return already created receipt
    const existingReq = await GoodsReceiptsRepository.findByClientRequestId(data.client_request_id);
    if (existingReq) {
      return GoodsReceiptsRepository.findById(existingReq.receipt_id);
    }

    // 2. Validate supplier
    const supplier = await SupplierRepository.findById(data.supplier_id);
    if (!supplier) {
      throw createError(`Supplier with ID ${data.supplier_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // 3. Validate receiving employee
    const employee = await EmployeeRepository.findById(data.received_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.received_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // 4. Validate PO if present
    if (data.po_id) {
      const po = await PurchaseOrdersRepository.findById(data.po_id);
      if (!po) {
        throw createError(`Purchase order with ID ${data.po_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
      if (po.supplier_id !== data.supplier_id) {
        throw createError(`Purchase order #${data.po_id} does not belong to supplier #${data.supplier_id}`, 400, 'PO_SUPPLIER_MISMATCH');
      }
    }

    // 5. Validate unique receipt_no
    const existingNo = await GoodsReceiptsRepository.findByReceiptNo(data.receipt_no);
    if (existingNo) {
      throw createError(`Goods receipt number "${data.receipt_no}" already exists`, 409, 'DUPLICATE_RECEIPT_NO');
    }

    // 6. Validate items and lot codes
    for (const item of data.items) {
      const yarn = await YarnItemsRepository.findById(item.yarn_item_id);
      if (!yarn) {
        throw createError(`Yarn item with ID ${item.yarn_item_id} does not exist`, 400, 'INVALID_REFERENCE');
      }

      const existingLot = await GoodsReceiptsRepository.findLotByCode(item.lot_code);
      if (existingLot) {
        throw createError(`Lot code "${item.lot_code}" already exists`, 409, 'DUPLICATE_LOT_CODE');
      }
    }

    // 7. Atomic transaction across header, items, and stock movements
    return withTransaction(async (conn) => {
      const receiptId = await GoodsReceiptsRepository.createHeader({
        receipt_no: data.receipt_no,
        supplier_id: data.supplier_id,
        po_id: data.po_id,
        supplier_challan_no: data.supplier_challan_no,
        vehicle_number: data.vehicle_number,
        received_by_employee_id: data.received_by_employee_id,
        client_request_id: data.client_request_id,
        status: 'received',
      }, conn);

      for (const item of data.items) {
        const receiptItemId = await GoodsReceiptsRepository.createItem({
          receipt_id: receiptId,
          yarn_item_id: item.yarn_item_id,
          lot_code: item.lot_code,
          quantity_received: item.quantity_received,
          earmarked_order_id: item.earmarked_order_id,
          storage_location: item.storage_location,
        }, conn);

        // Append to yarn stock movement ledger
        await StockMovementsRepository.create({
          yarn_item_id: item.yarn_item_id,
          movement_type: 'receipt',
          quantity: item.quantity_received, // Positive signed delta
          unit_cost: item.unit_cost !== undefined ? item.unit_cost : null,
          receipt_item_id: receiptItemId,
          production_job_id: null,
          reverses_movement_id: null,
          reason: `Inward GRN: ${data.receipt_no}, Lot: ${item.lot_code}`,
          created_by_employee_id: data.received_by_employee_id,
        }, conn);
      }

      // Update PO status if applicable
      if (data.po_id) {
        await PurchaseOrdersRepository.updateStatus(data.po_id, 'partially_received', conn);
      }

      return GoodsReceiptsRepository.findById(receiptId);
    });
  },

  async cancelReceipt(receiptId, { reason, employee_id } = {}) {
    const receipt = await GoodsReceiptsRepository.findById(receiptId);
    if (!receipt) {
      throw createError(`Goods receipt with ID ${receiptId} not found`, 404, 'NOT_FOUND');
    }

    if (receipt.status === 'cancelled') {
      throw createError(`Goods receipt #${receiptId} is already cancelled`, 400, 'ALREADY_CANCELLED');
    }

    return withTransaction(async (conn) => {
      // 1. Post reversal movements for each received item
      for (const item of receipt.items || []) {
        // Calculate current stock to prevent negative balance
        const currentStock = await StockMovementsRepository.calculateBalance(item.yarn_item_id, conn);
        const qtyToReverse = Number(item.quantity_received);
        if (currentStock - qtyToReverse < 0) {
          throw createError(
            `Cannot cancel receipt #${receiptId}: Yarn SKU #${item.yarn_item_id} has only ${currentStock} kg available, but reversal requires ${qtyToReverse} kg (yarn already consumed in production)`,
            400,
            'INSUFFICIENT_STOCK_FOR_REVERSAL'
          );
        }

        await StockMovementsRepository.create({
          yarn_item_id: item.yarn_item_id,
          movement_type: 'adjustment',
          quantity: -qtyToReverse, // Negative signed delta
          unit_cost: null,
          receipt_item_id: item.receipt_item_id,
          production_job_id: null,
          reverses_movement_id: null,
          reason: `GRN Cancellation: ${receipt.receipt_no} - ${reason || 'Cancelled by manager'}`,
          created_by_employee_id: employee_id || receipt.received_by_employee_id || 1,
        }, conn);
      }

      // 2. Mark receipt as cancelled
      await GoodsReceiptsRepository.updateStatus(receiptId, 'cancelled', conn);

      return GoodsReceiptsRepository.findById(receiptId);
    });
  },
};

module.exports = GoodsReceiptsService;

