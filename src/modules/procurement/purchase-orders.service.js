'use strict';

const PurchaseOrdersRepository = require('./purchase-orders.repository');
const SupplierRepository = require('../suppliers/suppliers.repository');
const EmployeeRepository = require('../employees/employees.repository');
const YarnItemsRepository = require('../inventory/yarn-items.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const PurchaseOrdersService = {
  async listPurchaseOrders(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await PurchaseOrdersRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      supplier_id: query.supplier_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getPurchaseOrderById(poId) {
    const po = await PurchaseOrdersRepository.findById(poId);
    if (!po) {
      throw createError(`Purchase order with ID ${poId} not found`, 404, 'NOT_FOUND');
    }
    return po;
  },

  async createPurchaseOrder(data) {
    // Validate supplier
    const supplier = await SupplierRepository.findById(data.supplier_id);
    if (!supplier) {
      throw createError(`Supplier with ID ${data.supplier_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate employee
    const employee = await EmployeeRepository.findById(data.created_by);
    if (!employee) {
      throw createError(`Employee with ID ${data.created_by} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate po_no unique
    const existing = await PurchaseOrdersRepository.findByPoNo(data.po_no);
    if (existing) {
      throw createError(`Purchase order number "${data.po_no}" already exists`, 409, 'DUPLICATE_PO_NO');
    }

    // Validate all yarn items
    for (const item of data.items) {
      const yarn = await YarnItemsRepository.findById(item.yarn_item_id);
      if (!yarn) {
        throw createError(`Yarn item with ID ${item.yarn_item_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }

    // Execute in transaction
    return withTransaction(async (conn) => {
      let totalAmount = 0;
      const itemsToInsert = data.items.map((it) => {
        const lineTotal = Number((it.quantity * it.agreed_rate).toFixed(2));
        totalAmount += lineTotal;
        return {
          ...it,
          line_total: lineTotal,
        };
      });

      const poId = await PurchaseOrdersRepository.create({
        po_no: data.po_no,
        supplier_id: data.supplier_id,
        order_date: data.order_date,
        expected_delivery_date: data.expected_delivery_date,
        status: 'draft',
        total_amount: totalAmount,
        created_by: data.created_by,
      }, conn);

      for (const it of itemsToInsert) {
        await PurchaseOrdersRepository.addItem({
          po_id: poId,
          yarn_item_id: it.yarn_item_id,
          quantity: it.quantity,
          agreed_rate: it.agreed_rate,
          line_total: it.line_total,
        }, conn);
      }

      return PurchaseOrdersRepository.findById(poId);
    });
  },

  async addItemToPo(poId, itemData) {
    const po = await this.getPurchaseOrderById(poId);
    if (po.status === 'closed' || po.status === 'cancelled') {
      throw createError(`Cannot add items to a ${po.status} purchase order`, 400, 'INVALID_STATE');
    }

    const yarn = await YarnItemsRepository.findById(itemData.yarn_item_id);
    if (!yarn) {
      throw createError(`Yarn item with ID ${itemData.yarn_item_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    return withTransaction(async (conn) => {
      const lineTotal = Number((itemData.quantity * itemData.agreed_rate).toFixed(2));
      await PurchaseOrdersRepository.addItem({
        po_id: poId,
        yarn_item_id: itemData.yarn_item_id,
        quantity: itemData.quantity,
        agreed_rate: itemData.agreed_rate,
        line_total: lineTotal,
      }, conn);

      await PurchaseOrdersRepository.updateTotalAmount(poId, conn);
      return PurchaseOrdersRepository.findById(poId);
    });
  },

  async updatePoStatus(poId, status) {
    const po = await this.getPurchaseOrderById(poId);
    
    // Status state machine validation:
    // draft -> sent -> partially_received -> closed / cancelled
    const validTransitions = {
      draft: ['sent', 'cancelled'],
      sent: ['partially_received', 'closed', 'cancelled'],
      partially_received: ['closed', 'cancelled'],
      closed: [],
      cancelled: [],
    };

    if (!validTransitions[po.status].includes(status)) {
      throw createError(`Invalid PO status transition from "${po.status}" to "${status}"`, 400, 'INVALID_STATUS_TRANSITION');
    }

    await PurchaseOrdersRepository.updateStatus(poId, status);
    return this.getPurchaseOrderById(poId);
  },
};

module.exports = PurchaseOrdersService;
