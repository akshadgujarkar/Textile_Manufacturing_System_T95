'use strict';

const AttendanceService = require('./attendance.service');
const { success, created, paginated } = require('../../utils/response');

const AttendanceController = {
  async list(req, res, next) {
    try {
      const result = await AttendanceService.listAttendance(req.query);
      paginated(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const record = await AttendanceService.getAttendanceById(req.params.id);
      success(res, record);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const record = await AttendanceService.createAttendance(req.body);
      created(res, record);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const record = await AttendanceService.updateAttendance(req.params.id, req.body);
      success(res, record);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AttendanceController;
