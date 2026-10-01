import { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/AppError';

export function validateObjectId(...params: string[]): RequestHandler {
  return (req, _res, next) => {
    for (const name of params) {
      const value = req.params[name];
      if (!Types.ObjectId.isValid(value) || String(new Types.ObjectId(value)) !== value.toLowerCase()) {
        next(new AppError(`Invalid ${name}`, 400, 'INVALID_ID'));
        return;
      }
    }
    next();
  };
}
