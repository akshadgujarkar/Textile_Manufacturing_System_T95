'use strict';

const CustomerOrdersRepository = require('./customer-orders.repository');
const BuyerRepository = require('../buyers/buyers.repository');
const EmployeeRepository = require('../employees/employees.repository');
const FabricProductsRepository = require('../inventory/fabric-products.repository');
const UnitsRepository = require('../inventory/units.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const CustomerOrdersService = {
  async listCustomerOrders(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await CustomerOrdersRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      buyer_id: query.buyer_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getCustomerOrderById(orderId) {
    const order = await CustomerOrdersRepository.findById(orderId);
    if (!order) {
      throw createError(`Customer order with ID ${orderId} not found`, 404, 'NOT_FOUND');
    }
    return order;
  },

  async createCustomerOrder(data) {
    // Validate buyer
    const buyer = await BuyerRepository.findById(data.buyer_id);
    if (!buyer) {
      throw createError(`Buyer with ID ${data.buyer_id} does not exist`, 400, 'INVALID_REFERENCE');
    }
    if (!buyer.is_active) {
      throw createError(`Buyer #${data.buyer_id} is inactive`, 400, 'INACTIVE_BUYER');
    }

    // Validate employee
    const employee = await EmployeeRepository.findById(data.created_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.created_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate unique order_no
    const existing = await CustomerOrdersRepository.findByOrderNo(data.order_no);
    if (existing) {
      throw createError(`Order number "${data.order_no}" already exists`, 409, 'DUPLICATE_ORDER_NO');
    }

    // Validate items
    for (const item of data.items) {
      const prod = await FabricProductsRepository.findById(item.product_id);
      if (!prod) {
        throw createError(`Fabric product with ID ${item.product_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
      const unit = await UnitsRepository.findById(item.unit_id);
      if (!unit) {
        throw createError(`Unit of measure with ID ${item.unit_id} does not exist`, 400, 'INVALID_REFERENCE');
      }
    }

    return withTransaction(async (conn) => {
      const orderId = await CustomerOrdersRepository.createHeader({
        order_no: data.order_no,
        buyer_id: data.buyer_id,
        order_date: data.order_date,
        promised_delivery_date: data.promised_delivery_date,
        status: 'draft',
        created_by_employee_id: data.created_by_employee_id,
      }, conn);

      for (const item of data.items) {
        const lineTotal = Number((item.ordered_qty * item.agreed_rate).toFixed(2));
        await CustomerOrdersRepository.createItem({
          order_id: orderId,
          line_no: item.line_no,
          product_id: item.product_id,
          colour_code: item.colour_code,
          ordered_qty: item.ordered_qty,
          unit_id: item.unit_id,
          agreed_rate: item.agreed_rate,
          line_total: lineTotal,
        }, conn);
      }

      return CustomerOrdersRepository.findById(orderId);
    });
  },

  async updateOrderStatus(orderId, { status, version }) {
    const order = await this.getCustomerOrderById(orderId);

    // State transition rules:
    // draft -> confirmed -> in_production -> ready_for_dispatch -> dispatched -> closed -> cancelled
    const validTransitions = {
      draft: ['confirmed', 'cancelled'],
      confirmed: ['in_production', 'cancelled'],
      in_production: ['ready_for_dispatch', 'cancelled'],
      ready_for_dispatch: ['dispatched', 'cancelled'],
      dispatched: ['closed'],
      closed: [],
      cancelled: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw createError(
        `Invalid status transition from "${order.status}" to "${status}"`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await CustomerOrdersRepository.updateStatusWithVersion(orderId, status, version);
    if (!updated) {
      throw createError(
        `Optimistic lock failure: order #${orderId} was updated concurrently (version mismatch)`,
        409,
        'CONCURRENCY_CONFLICT'
      );
    }

    return this.getCustomerOrderById(orderId);
  },

  async confirmOrder(orderId, { version }) {
    return this.updateOrderStatus(orderId, { status: 'confirmed', version });
  },

  async cancelOrder(orderId, { version }) {
    return this.updateOrderStatus(orderId, { status: 'cancelled', version });
  },
};

module.exports = CustomerOrdersService;
