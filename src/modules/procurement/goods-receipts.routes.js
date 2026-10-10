'use strict';

const express = require('express');
const router = express.Router();
const GoodsReceiptsController = require('./goods-receipts.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createGoodsReceiptSchema,
  listGoodsReceiptsQuerySchema,
} = require('./goods-receipts.validator');

router.get('/', validate({ query: listGoodsReceiptsQuerySchema }), GoodsReceiptsController.list);
router.get('/:id', validate({ params: idParam }), GoodsReceiptsController.getById);
router.post('/', validate({ body: createGoodsReceiptSchema }), GoodsReceiptsController.create);

module.exports = router;
