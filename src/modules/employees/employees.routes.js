'use strict';

const express = require('express');
const router = express.Router();
const EmployeeController = require('./employees.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
} = require('./employees.validator');

router.get(
  '/',
  validate({ query: listEmployeesQuerySchema }),
  EmployeeController.list
);

router.get(
  '/:id',
  validate({ params: idParam }),
  EmployeeController.getById
);

router.post(
  '/',
  validate({ body: createEmployeeSchema }),
  EmployeeController.create
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateEmployeeSchema }),
  EmployeeController.update
);

module.exports = router;
