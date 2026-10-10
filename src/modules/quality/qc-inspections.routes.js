'use strict';

const express = require('express');
const router = express.Router();
const QcInspectionsController = require('./qc-inspections.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createQcInspectionSchema,
  listQcInspectionsQuerySchema,
} = require('./qc-inspections.validator');

router.get('/', validate({ query: listQcInspectionsQuerySchema }), QcInspectionsController.list);
router.get('/:id', validate({ params: idParam }), QcInspectionsController.getById);
router.post('/', validate({ body: createQcInspectionSchema }), QcInspectionsController.create);

module.exports = router;
