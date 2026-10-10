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
        const parsedParams = schemas.params.parse(req.params);
        for (const key of Object.keys(req.params)) {
          delete req.params[key];
        }
        Object.assign(req.params, parsedParams);
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, parsedQuery);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
