'use strict';

const { z } = require('zod');

/**
 * Common Zod schemas reused across modules.
 */

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

const positiveDecimal = z.string().regex(/^\d+(\.\d+)?$/).transform(Number);

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
  search: z.string().max(100).optional(),
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const uuidString = z.string().uuid();

module.exports = { idParam, positiveDecimal, paginationQuery, dateString, uuidString };
