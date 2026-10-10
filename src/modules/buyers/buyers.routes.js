'use strict';

const express = require('express');
const router = express.Router();
const BuyerController = require('./buyers.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createBuyerSchema,
  updateBuyerSchema,
  listBuyersQuerySchema,
} = require('./buyers.validator');

router.get(
  '/',
  validate({ query: listBuyersQuerySchema }),
  BuyerController.list
);

router.get(
  '/:id',
  validate({ params: idParam }),
  BuyerController.getById
);

router.post(
  '/',
  validate({ body: createBuyerSchema }),
  BuyerController.create
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateBuyerSchema }),
  BuyerController.update
);

module.exports = router;
