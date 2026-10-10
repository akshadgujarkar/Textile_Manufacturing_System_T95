'use strict';

const express = require('express');
const router = express.Router();
const AttendanceController = require('./attendance.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createAttendanceSchema,
  updateAttendanceSchema,
  listAttendanceQuerySchema,
} = require('./attendance.validator');

router.get('/', validate({ query: listAttendanceQuerySchema }), AttendanceController.list);
router.get('/:id', validate({ params: idParam }), AttendanceController.getById);
router.post('/', validate({ body: createAttendanceSchema }), AttendanceController.create);
router.patch('/:id', validate({ params: idParam, body: updateAttendanceSchema }), AttendanceController.update);

module.exports = router;
