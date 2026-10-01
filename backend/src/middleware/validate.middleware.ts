import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse({ body: req.body });
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      next(new AppError(firstIssue.message, 400, 'VALIDATION_ERROR'));
      return;
    }
    req.body = result.data.body;
    next();
  };
}
