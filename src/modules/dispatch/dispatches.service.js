'use strict';

const DispatchesRepository = require('./dispatches.repository');
const FabricRollsRepository = require('../quality/fabric-rolls.repository');
const CustomerOrdersRepository = require('../orders/customer-orders.repository');
const BuyerRepository = require('../buyers/buyers.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const DispatchesService = {
  async listDispatches(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await DispatchesRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      buyer_id: query.buyer_id,
      order_id: query.order_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getDispatchById(dispatchId) {
    const dispatch = await DispatchesRepository.findById(dispatchId);
    if (!dispatch) {
      throw createError(`Dispatch with ID ${dispatchId} not found`, 404, 'NOT_FOUND');
    }
    return dispatch;
  },

  async createDispatch(data) {
    // Validate buyer
    const buyer = await BuyerRepository.findById(data.buyer_id);
    if (!buyer) {
      throw createError(`Buyer with ID ${data.buyer_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate order
    const order = await CustomerOrdersRepository.findById(data.order_id);
    if (!order) {
      throw createError(`Customer order with ID ${data.order_id} does not exist`, 400, 'INVALID_REFERENCE');
    }
    if (order.buyer_id !== data.buyer_id) {
      throw createError(
        `Order #${data.order_id} belongs to buyer #${order.buyer_id}, not requested buyer #${data.buyer_id}`,
        400,
        'ORDER_BUYER_MISMATCH'
      );
    }

    // Check unique dispatch_no
    const existing = await DispatchesRepository.findByDispatchNo(data.dispatch_no);
    if (existing) {
      throw createError(`Dispatch number "${data.dispatch_no}" already exists`, 409, 'DUPLICATE_DISPATCH_NO');
    }

    const dispatchId = await DispatchesRepository.create(data);
    return this.getDispatchById(dispatchId);
  },

  async scanRollToDispatch(dispatchId, { roll_id, scanned_by_employee_id }) {
    const dispatch = await this.getDispatchById(dispatchId);
    if (dispatch.status !== 'draft' && dispatch.status !== 'loading') {
      throw createError(`Cannot scan rolls into a "${dispatch.status}" dispatch`, 400, 'INVALID_DISPATCH_STATE');
    }

    // Validate scanning employee
    const employee = await EmployeeRepository.findById(scanned_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${scanned_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate roll
    const roll = await FabricRollsRepository.findById(roll_id);
    if (!roll) {
      throw createError(`Fabric roll with ID ${roll_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    if (roll.status !== 'in_stock') {
      throw createError(
        `Fabric roll #${roll_id} (${roll.roll_code}) cannot be dispatched because its status is "${roll.status}" (must be "in_stock" after passing QC)`,
        400,
        'ROLL_NOT_ELIGIBLE_FOR_DISPATCH'
      );
    }

    // Validate roll belongs to this dispatch's order
    if (roll.order_id !== dispatch.order_id) {
      throw createError(
        `Roll #${roll_id} belongs to Order #${roll.order_id} (${roll.order_no}), but this dispatch is for Order #${dispatch.order_id} (${dispatch.order_no})`,
        400,
        'ORDER_MISMATCH'
      );
    }

    return withTransaction(async (conn) => {
      // Check collision: is roll already in an active dispatch?
      const existingActive = await DispatchesRepository.findActiveDispatchItemByRoll(roll_id, conn);
      if (existingActive) {
        throw createError(
          `Roll #${roll_id} (${roll.roll_code}) is already active in Dispatch #${existingActive.dispatch_id} (${existingActive.dispatch_no})`,
          409,
          'DOUBLE_DISPATCH_COLLISION'
        );
      }

      // Insert active dispatch item
      await DispatchesRepository.addDispatchItem({
        dispatch_id: dispatchId,
        roll_id,
        scanned_by_employee_id,
      }, conn);

      // Set roll status to loaded
      await FabricRollsRepository.setStatus(roll_id, 'loaded', conn);

      // Update dispatch status to loading if draft
      if (dispatch.status === 'draft') {
        await DispatchesRepository.updateStatusWithVersion(dispatchId, {
          status: 'loading',
          expectedVersion: dispatch.version,
        }, conn);
      }

      return DispatchesRepository.findById(dispatchId);
    });
  },

  async removeRollFromDispatch(dispatchId, itemId) {
    const dispatch = await this.getDispatchById(dispatchId);
    if (dispatch.status !== 'draft' && dispatch.status !== 'loading') {
      throw createError(`Cannot remove rolls from a "${dispatch.status}" dispatch`, 400, 'INVALID_DISPATCH_STATE');
    }

    return withTransaction(async (conn) => {
      const item = await DispatchesRepository.findDispatchItemById(itemId, conn);
      if (!item || item.dispatch_id !== Number(dispatchId)) {
        throw createError(`Dispatch item #${itemId} not found on dispatch #${dispatchId}`, 404, 'NOT_FOUND');
      }
      if (item.state === 'removed') {
        throw createError(`Dispatch item #${itemId} is already marked removed`, 400, 'ALREADY_REMOVED');
      }

      // Mark item as removed (preserves history and releases active roll uniqueness constraint!)
      await DispatchesRepository.removeDispatchItem(itemId, conn);

      // Revert fabric roll back to in_stock
      await FabricRollsRepository.setStatus(item.roll_id, 'in_stock', conn);

      return DispatchesRepository.findById(dispatchId);
    });
  },

  async completeDispatch(dispatchId, { version }) {
    const dispatch = await this.getDispatchById(dispatchId);
    if (dispatch.status !== 'loading' && dispatch.status !== 'draft') {
      throw createError(`Cannot dispatch a manifest in "${dispatch.status}" status`, 400, 'INVALID_STATUS_TRANSITION');
    }

    return withTransaction(async (conn) => {
      const activeRolls = await DispatchesRepository.getActiveRollsInDispatch(dispatchId, conn);
      if (activeRolls.length === 0) {
        throw createError(`Cannot dispatch manifest #${dispatchId} with 0 active rolls loaded`, 400, 'EMPTY_DISPATCH');
      }

      const updated = await DispatchesRepository.updateStatusWithVersion(dispatchId, {
        status: 'dispatched',
        dispatched_at: new Date(),
        expectedVersion: version,
      }, conn);

      if (!updated) {
        throw createError(`Optimistic lock failure on dispatch #${dispatchId}`, 409, 'CONCURRENCY_CONFLICT');
      }

      // Set all loaded rolls to dispatched
      for (const rollId of activeRolls) {
        await FabricRollsRepository.setStatus(rollId, 'dispatched', conn);
      }

      return DispatchesRepository.findById(dispatchId);
    });
  },

  async cancelDispatch(dispatchId, { version }) {
    const dispatch = await this.getDispatchById(dispatchId);
    if (dispatch.status === 'dispatched' || dispatch.status === 'cancelled') {
      throw createError(`Cannot cancel a ${dispatch.status} dispatch`, 400, 'INVALID_STATUS_TRANSITION');
    }

    return withTransaction(async (conn) => {
      const activeRolls = await DispatchesRepository.getActiveRollsInDispatch(dispatchId, conn);

      const updated = await DispatchesRepository.updateStatusWithVersion(dispatchId, {
        status: 'cancelled',
        expectedVersion: version,
      }, conn);

      if (!updated) {
        throw createError(`Optimistic lock failure on dispatch #${dispatchId}`, 409, 'CONCURRENCY_CONFLICT');
      }

      // Free all loaded rolls back to in_stock
      for (const rollId of activeRolls) {
        await FabricRollsRepository.setStatus(rollId, 'in_stock', conn);
      }

      return DispatchesRepository.findById(dispatchId);
    });
  },
};

module.exports = DispatchesService;
