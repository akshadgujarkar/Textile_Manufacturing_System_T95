'use strict';

const MachinesService = require('./machines.service');
const { success, created, paginated } = require('../../utils/response');

const MachinesController = {
  async list(req, res, next) {
    try {
      const result = await MachinesService.listMachines(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const machine = await MachinesService.getMachineById(req.params.id);
      success(res, machine);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const machine = await MachinesService.createMachine(req.body);
      created(res, machine);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const machine = await MachinesService.updateMachine(req.params.id, req.body);
      success(res, machine);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = MachinesController;
