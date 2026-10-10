'use strict';

const QcInspectionsRepository = require('./qc-inspections.repository');
const FabricRollsRepository = require('./fabric-rolls.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const QcInspectionsService = {
  async listInspections(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await QcInspectionsRepository.findAll({
      limit: pageSize,
      offset,
      roll_id: query.roll_id,
      inspector_id: query.inspector_id,
      result: query.result,
    });

    return { data: rows, total, page, pageSize };
  },

  async getInspectionById(inspectionId) {
    const inspection = await QcInspectionsRepository.findById(inspectionId);
    if (!inspection) {
      throw createError(`QC inspection with ID ${inspectionId} not found`, 404, 'NOT_FOUND');
    }
    return inspection;
  },

  async createInspection(data) {
    // Validate roll
    const roll = await FabricRollsRepository.findById(data.roll_id);
    if (!roll) {
      throw createError(`Fabric roll with ID ${data.roll_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Validate inspector
    const inspector = await EmployeeRepository.findById(data.inspector_id);
    if (!inspector) {
      throw createError(`Inspector employee with ID ${data.inspector_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    return withTransaction(async (conn) => {
      // 1. Calculate attempt number (previous attempt + 1)
      const previousAttempt = await QcInspectionsRepository.getLatestAttemptNo(data.roll_id, conn);
      const attemptNo = previousAttempt + 1;

      // 2. Calculate ASTM 4-point penalty score
      let totalPenaltyPoints = 0;
      const defects = data.defects || [];
      for (const d of defects) {
        totalPenaltyPoints += Number(d.penalty_points);
      }

      // ASTM D5430 formula: (Total Penalty Points * 3600) / (Length in Metres * Width in Inches * 1.09361)
      // or normalized points per 100 sq yd
      let pointsPer100SqYd = null;
      if (roll.length_m > 0 && roll.width_inches > 0) {
        const areaSqYd = (Number(roll.length_m) * 1.09361) * (Number(roll.width_inches) / 36);
        if (areaSqYd > 0) {
          pointsPer100SqYd = Number(((totalPenaltyPoints * 100) / areaSqYd).toFixed(2));
        }
      }

      // 3. Create inspection header
      const inspectionId = await QcInspectionsRepository.createHeader({
        roll_id: data.roll_id,
        inspector_id: data.inspector_id,
        attempt_no: attemptNo,
        result: data.result,
        assigned_grade: data.assigned_grade,
        total_penalty_points: totalPenaltyPoints,
        points_per_100_sq_yd: pointsPer100SqYd,
        remarks: data.remarks,
      }, conn);

      // 4. Create defect items
      for (const d of defects) {
        await QcInspectionsRepository.createDefect({
          inspection_id: inspectionId,
          defect_code: d.defect_code,
          defect_name: d.defect_name,
          penalty_points: d.penalty_points,
          position_meters: d.position_meters,
          severity: d.severity,
        }, conn);
      }

      // 5. Update roll status according to inspection result
      let newRollStatus = 'pending_qc';
      if (data.result === 'passed') {
        newRollStatus = 'in_stock';
      } else if (data.result === 'rework') {
        newRollStatus = 'rework';
      } else if (data.result === 'rejected') {
        newRollStatus = 'rejected';
      }

      await FabricRollsRepository.setStatus(data.roll_id, newRollStatus, conn);

      return QcInspectionsRepository.findById(inspectionId);
    });
  },
};

module.exports = QcInspectionsService;
