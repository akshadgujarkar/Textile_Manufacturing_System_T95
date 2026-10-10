'use strict';

const WagesRepository = require('./wages.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { createError } = require('../../utils/response');

const WagesService = {
  async listWages(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await WagesRepository.findAll({
      limit: pageSize,
      offset,
      employee_id: query.employee_id,
      payroll_month: query.payroll_month,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getWageById(wageId) {
    const wage = await WagesRepository.findById(wageId);
    if (!wage) {
      throw createError(`Wage record with ID ${wageId} not found`, 404, 'NOT_FOUND');
    }
    return wage;
  },

  async createWageRecord(data) {
    const employee = await EmployeeRepository.findById(data.employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Check composite uniqueness (employee_id, payroll_month)
    const existing = await WagesRepository.findByEmployeeAndMonth(data.employee_id, data.payroll_month);
    if (existing) {
      throw createError(
        `Wage record for employee #${data.employee_id} for month ${data.payroll_month} already exists`,
        409,
        'DUPLICATE_WAGE_RECORD'
      );
    }

    const baseAmount = Number(data.base_amount || 0);
    const pieceRateAmount = Number(data.piece_rate_amount || 0);
    const bonusOvertime = Number(data.bonus_overtime || 0);
    const grossAmount = Number((baseAmount + pieceRateAmount + bonusOvertime).toFixed(2));

    return WagesRepository.create({
      employee_id: data.employee_id,
      payroll_month: data.payroll_month,
      base_amount: baseAmount,
      piece_rate_amount: pieceRateAmount,
      bonus_overtime: bonusOvertime,
      gross_amount: grossAmount,
    });
  },

  async approveWage(wageId) {
    const wage = await this.getWageById(wageId);
    if (wage.status !== 'draft') {
      throw createError(`Cannot approve a wage record in "${wage.status}" status`, 400, 'INVALID_STATUS_TRANSITION');
    }
    return WagesRepository.updateStatus(wageId, 'approved');
  },

  async disburseWage(wageId) {
    const wage = await this.getWageById(wageId);
    if (wage.status !== 'approved') {
      throw createError(`Cannot disburse a wage record in "${wage.status}" status (must be approved)`, 400, 'INVALID_STATUS_TRANSITION');
    }
    return WagesRepository.updateStatus(wageId, 'disbursed');
  },

  async reverseWage(wageId) {
    const wage = await this.getWageById(wageId);
    if (wage.status === 'reversed') {
      throw createError(`Wage record #${wageId} is already reversed`, 400, 'ALREADY_REVERSED');
    }
    return WagesRepository.updateStatus(wageId, 'reversed');
  },
};

module.exports = WagesService;
