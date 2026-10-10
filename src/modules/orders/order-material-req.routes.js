'use strict';

const express = require('express');
const router = express.Router();
const OrderMaterialReqController = require('./order-material-req.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');
const {
  createMaterialReqSchema,
  reserveMaterialSchema,
  listMaterialReqQuerySchema,
} = require('./order-material-req.validator');

const { z } = require('zod');

const orderIdParam = z.object({
  orderId: z.coerce.number().int().positive(),
});

router.get('/', validate({ query: listMaterialReqQuerySchema }), OrderMaterialReqController.list);
router.get('/check/:orderId', validate({ params: orderIdParam }), OrderMaterialReqController.checkSufficiency);
router.get('/:id', validate({ params: idParam }), OrderMaterialReqController.getById);
router.post('/', validate({ body: createMaterialReqSchema }), OrderMaterialReqController.create);
router.post('/:id/reserve', validate({ params: idParam, body: reserveMaterialSchema }), OrderMaterialReqController.reserve);
router.post('/:id/release', validate({ params: idParam }), OrderMaterialReqController.release);

module.exports = router;

