'use strict';

const AttendanceRepository = require('./attendance.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { createError } = require('../../utils/response');

const AttendanceService = {
  async listAttendance(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await AttendanceRepository.findAll({
      limit: pageSize,
      offset,
      employee_id: query.employee_id,
      work_date: query.work_date,
      shift_code: query.shift_code,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getAttendanceById(attendanceId) {
    const record = await AttendanceRepository.findById(attendanceId);
    if (!record) {
      throw createError(`Attendance record with ID ${attendanceId} not found`, 404, 'NOT_FOUND');
    }
    return record;
  },

  async createAttendance(data) {
    // Validate employee exists
    const employee = await EmployeeRepository.findById(data.employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Check composite uniqueness (employee_id, work_date, shift_code)
    const existing = await AttendanceRepository.findByEmployeeDateShift(
      data.employee_id,
      data.work_date,
      data.shift_code
    );
    if (existing) {
      throw createError(
        `Attendance record for employee #${data.employee_id} on ${data.work_date} (shift ${data.shift_code}) already exists`,
        409,
        'DUPLICATE_ATTENDANCE'
      );
    }

    return AttendanceRepository.create(data);
  },

  async updateAttendance(attendanceId, data) {
    await this.getAttendanceById(attendanceId);
    return AttendanceRepository.update(attendanceId, data);
  },
};

module.exports = AttendanceService;
