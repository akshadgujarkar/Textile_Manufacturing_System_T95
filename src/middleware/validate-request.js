'use strict';

/**
 * Factory for creating Zod-based request validation middleware.
 *
 * Usage:
 *   router.post('/', validate({ body: MySchema }), controller.create);
 *
 * Validates: body, params, query independently.
 * On failure, calls next(err) with a ZodError so the error handler formats it.
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
