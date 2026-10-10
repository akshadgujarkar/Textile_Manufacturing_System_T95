'use strict';

const express = require('express');
const router = express.Router();
const SupplierController = require('./suppliers.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
} = require('./suppliers.validator');

router.get(
  '/',
  validate({ query: listSuppliersQuerySchema }),
  SupplierController.list
);

router.get(
  '/:id',
  validate({ params: idParam }),
  SupplierController.getById
);

router.post(
  '/',
  validate({ body: createSupplierSchema }),
  SupplierController.create
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateSupplierSchema }),
  SupplierController.update
);

module.exports = router;
