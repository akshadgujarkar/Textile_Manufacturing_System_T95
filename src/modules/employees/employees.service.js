'use strict';

const EmployeeRepository = require('./employees.repository');
const { createError } = require('../../utils/response');

const EmployeeService = {
  async listEmployees(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await EmployeeRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      is_active: query.is_active,
    });

    return { data: rows, total, page, pageSize };
  },

  async getEmployeeById(employeeId) {
    const emp = await EmployeeRepository.findById(employeeId);
    if (!emp) {
      throw createError(`Employee with ID ${employeeId} not found`, 404, 'NOT_FOUND');
    }
    return emp;
  },

  async createEmployee(data) {
    const existing = await EmployeeRepository.findByCode(data.employee_code);
    if (existing) {
      throw createError(`Employee code "${data.employee_code}" already exists`, 409, 'DUPLICATE_CODE');
    }
    return EmployeeRepository.create(data);
  },

  async updateEmployee(employeeId, data) {
    await this.getEmployeeById(employeeId);
    return EmployeeRepository.update(employeeId, data);
  },
};

module.exports = EmployeeService;
