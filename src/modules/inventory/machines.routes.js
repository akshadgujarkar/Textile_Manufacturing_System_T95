'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const MachinesController = require('./machines.controller');
const validate = require('../../middleware/validate-request');
const { idParam } = require('../../utils/validators');

const createMachineSchema = z.object({
  machine_code: z.string().min(1).max(30),
  stage_id: z.coerce.number().int().positive(),
  make_model: z.string().max(100).optional().nullable(),
  rated_rpm: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  current_status: z.enum(['running', 'idle', 'maintenance', 'stopped']).optional().default('idle'),
});

const updateMachineSchema = createMachineSchema.partial().omit({ machine_code: true });

const listMachinesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
  stage_id: z.coerce.number().int().positive().optional(),
  current_status: z.enum(['running', 'idle', 'maintenance', 'stopped']).optional(),
  is_active: z.enum(['true', 'false', '1', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

router.get('/', validate({ query: listMachinesQuerySchema }), MachinesController.list);
router.get('/:id', validate({ params: idParam }), MachinesController.getById);
router.post('/', validate({ body: createMachineSchema }), MachinesController.create);
router.patch('/:id', validate({ params: idParam, body: updateMachineSchema }), MachinesController.update);

module.exports = router;
