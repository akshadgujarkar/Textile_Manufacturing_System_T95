'use strict';

const StockMovementsRepository = require('./stock-movements.repository');
const YarnItemsRepository = require('../inventory/yarn-items.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const StockMovementsService = {
  async listMovements(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await StockMovementsRepository.findAll({
      limit: pageSize,
      offset,
      yarn_item_id: query.yarn_item_id,
      movement_type: query.movement_type,
      production_job_id: query.production_job_id,
    });

    return { data: rows, total, page, pageSize };
  },

  async getMovementById(movementId) {
    const mov = await StockMovementsRepository.findById(movementId);
    if (!mov) {
      throw createError(`Stock movement with ID ${movementId} not found`, 404, 'NOT_FOUND');
    }
    return mov;
  },

  async createMovement(data) {
    const yarn = await YarnItemsRepository.findById(data.yarn_item_id);
    if (!yarn) {
      throw createError(`Yarn item with ID ${data.yarn_item_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const employee = await EmployeeRepository.findById(data.created_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.created_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    let qty = Number(data.quantity);
    if (isNaN(qty) || qty === 0) {
      throw createError('Movement quantity cannot be zero', 400, 'INVALID_QUANTITY');
    }

    // Standardize signed quantities per type
    if (data.movement_type === 'issue') {
      if (qty > 0) qty = -qty; // Enforce negative delta for issues
    } else if (data.movement_type === 'receipt' || data.movement_type === 'return') {
      if (qty < 0) {
        throw createError(`Movement type "${data.movement_type}" requires positive quantity`, 400, 'INVALID_QUANTITY');
      }
    } else if (data.movement_type === 'adjustment') {
      if (!data.reason) {
        throw createError('Reason is mandatory for inventory adjustments', 400, 'REASON_REQUIRED');
      }
    }

    return withTransaction(async (conn) => {
      // If reducing stock, verify available balance
      if (qty < 0) {
        const currentStock = await StockMovementsRepository.getCurrentStock(data.yarn_item_id, conn);
        if (currentStock + qty < 0) {
          throw createError(
            `Insufficient stock for yarn item #${data.yarn_item_id}. Available: ${currentStock} kg, requested: ${Math.abs(qty)} kg`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }
      }

      const movementId = await StockMovementsRepository.create({
        yarn_item_id: data.yarn_item_id,
        movement_type: data.movement_type,
        quantity: qty,
        unit_cost: data.unit_cost,
        receipt_item_id: data.receipt_item_id,
        production_job_id: data.production_job_id,
        reverses_movement_id: data.reverses_movement_id,
        reason: data.reason,
        created_by_employee_id: data.created_by_employee_id,
      }, conn);

      return StockMovementsRepository.findById(movementId);
    });
  },

  async reverseMovement(movementId, { reason, created_by_employee_id }) {
    const original = await this.getMovementById(movementId);
    if (original.movement_type === 'reversal') {
      throw createError('Cannot reverse a reversal entry', 400, 'CANNOT_REVERSE_REVERSAL');
    }

    const employee = await EmployeeRepository.findById(created_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${created_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const reversedQty = -Number(original.quantity);

    return withTransaction(async (conn) => {
      if (reversedQty < 0) {
        const currentStock = await StockMovementsRepository.getCurrentStock(original.yarn_item_id, conn);
        if (currentStock + reversedQty < 0) {
          throw createError(
            `Insufficient stock to reverse movement #${movementId}. Current: ${currentStock}, required after reversal: ${currentStock + reversedQty}`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }
      }

      const newMovementId = await StockMovementsRepository.create({
        yarn_item_id: original.yarn_item_id,
        movement_type: 'reversal',
        quantity: reversedQty,
        unit_cost: original.unit_cost,
        receipt_item_id: original.receipt_item_id,
        production_job_id: original.production_job_id,
        reverses_movement_id: movementId,
        reason: reason || `Reversal of movement #${movementId}`,
        created_by_employee_id,
      }, conn);

      return StockMovementsRepository.findById(newMovementId);
    });
  },

  async getReorderAlerts() {
    return StockMovementsRepository.getReorderAlerts();
  },
};

module.exports = StockMovementsService;
