'use strict';

const OrderMaterialReqService = require('./order-material-req.service');
const { success, created, paginated } = require('../../utils/response');

const OrderMaterialReqController = {
  async list(req, res, next) {
    try {
      const result = await OrderMaterialReqService.listMaterialRequirements(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const reqRecord = await OrderMaterialReqService.getMaterialRequirementById(req.params.id);
      success(res, reqRecord);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const reqRecord = await OrderMaterialReqService.createMaterialRequirement(req.body);
      created(res, reqRecord);
    } catch (err) {
      next(err);
    }
  },

  async reserve(req, res, next) {
    try {
      const reqRecord = await OrderMaterialReqService.reserveMaterial(req.params.id, req.body);
      success(res, reqRecord);
    } catch (err) {
      next(err);
    }
  },

  async release(req, res, next) {
    try {
      const reqRecord = await OrderMaterialReqService.releaseReservation(req.params.id);
      success(res, reqRecord);
    } catch (err) {
      next(err);
    }
  },

  async checkSufficiency(req, res, next) {
    try {
      const result = await OrderMaterialReqService.checkOrderSufficiency(req.params.orderId);
      success(res, result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = OrderMaterialReqController;

