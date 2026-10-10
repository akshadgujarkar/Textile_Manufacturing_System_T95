'use strict';

const FabricProductsService = require('./fabric-products.service');
const { success, created, paginated } = require('../../utils/response');

const FabricProductsController = {
  async list(req, res, next) {
    try {
      const result = await FabricProductsService.listFabricProducts(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const product = await FabricProductsService.getFabricProductById(req.params.id);
      success(res, product);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const product = await FabricProductsService.createFabricProduct(req.body);
      created(res, product);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const product = await FabricProductsService.updateFabricProduct(req.params.id, req.body);
      success(res, product);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = FabricProductsController;
