'use strict';

const QcDefectsRepository = require('./qc-defects.repository');
const { success, paginated, createError } = require('../../utils/response');

const QcDefectsController = {
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
      const offset = (page - 1) * pageSize;

      const { rows, total } = await QcDefectsRepository.findAll({
        limit: pageSize,
        offset,
        inspection_id: req.query.inspection_id,
        defect_code: req.query.defect_code,
        severity: req.query.severity,
      });

      paginated(res, { data: rows, total, page, pageSize });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const defect = await QcDefectsRepository.findById(req.params.id);
      if (!defect) {
        throw createError(`QC defect with ID ${req.params.id} not found`, 404, 'NOT_FOUND');
      }
      success(res, defect);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = QcDefectsController;
