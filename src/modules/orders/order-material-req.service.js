'use strict';

const OrderMaterialReqRepository = require('./order-material-req.repository');
const YarnItemsRepository = require('../inventory/yarn-items.repository');
const StockMovementsRepository = require('../procurement/stock-movements.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const OrderMaterialReqService = {
  async listMaterialRequirements(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await OrderMaterialReqRepository.findAll({
      limit: pageSize,
      offset,
      order_item_id: query.order_item_id,
      yarn_item_id: query.yarn_item_id,
      allocation_status: query.allocation_status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getMaterialRequirementById(requirementId) {
    const req = await OrderMaterialReqRepository.findById(requirementId);
    if (!req) {
      throw createError(`Material requirement with ID ${requirementId} not found`, 404, 'NOT_FOUND');
    }
    return req;
  },

  async createMaterialRequirement(data) {
    const yarn = await YarnItemsRepository.findById(data.yarn_item_id);
    if (!yarn) {
      throw createError(`Yarn item with ID ${data.yarn_item_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    const requirementId = await OrderMaterialReqRepository.create(data);
    return this.getMaterialRequirementById(requirementId);
  },

  async reserveMaterial(requirementId, { quantity_to_reserve }) {
    const req = await this.getMaterialRequirementById(requirementId);

    return withTransaction(async (conn) => {
      // Check total available stock for the yarn SKU
      const availableStock = await StockMovementsRepository.getCurrentStock(req.yarn_item_id, conn);
      
      const newReservedQty = Number(req.reserved_qty) + Number(quantity_to_reserve);
      if (newReservedQty > Number(req.required_qty)) {
        throw createError(
          `Cannot reserve ${newReservedQty} kg. Exceeds required quantity of ${req.required_qty} kg`,
          400,
          'RESERVATION_EXCEEDS_REQUIREMENT'
        );
      }

      if (quantity_to_reserve > availableStock) {
        throw createError(
          `Insufficient stock to reserve. Available: ${availableStock} kg, requested: ${quantity_to_reserve} kg`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      const allocationStatus = newReservedQty >= Number(req.required_qty) ? 'reserved' : 'partial';
      await OrderMaterialReqRepository.updateReservation(requirementId, newReservedQty, allocationStatus, conn);

      return OrderMaterialReqRepository.findById(requirementId);
    });
  },

  async releaseReservation(requirementId) {
    const req = await this.getMaterialRequirementById(requirementId);
    if (Number(req.reserved_qty) === 0) {
      return req;
    }

    await OrderMaterialReqRepository.updateReservation(requirementId, 0.000, 'unallocated');
    return this.getMaterialRequirementById(requirementId);
  },
};

module.exports = OrderMaterialReqService;
