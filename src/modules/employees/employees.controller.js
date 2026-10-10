'use strict';

const EmployeeService = require('./employees.service');
const { success, created, paginated } = require('../../utils/response');

const EmployeeController = {
  async list(req, res, next) {
    try {
      const result = await EmployeeService.listEmployees(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const emp = await EmployeeService.getEmployeeById(req.params.id);
      success(res, emp);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const emp = await EmployeeService.createEmployee(req.body);
      created(res, emp);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const emp = await EmployeeService.updateEmployee(req.params.id, req.body);
      success(res, emp);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = EmployeeController;
