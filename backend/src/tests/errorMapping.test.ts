import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.middleware';

function appThatThrows(error: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler mongoose and HTTP error mapping', () => {
  it('maps mongoose validation errors to 400 VALIDATION_ERROR', async () => {
    const error = new mongoose.Error.ValidationError();
    error.addError('title', new mongoose.Error.ValidatorError({ message: 'Title is too short', path: 'title' }));
    const res = await request(appThatThrows(error)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Title is too short' });
  });

  it('maps cast errors to 400 INVALID_ID', async () => {
    const error = new mongoose.Error.CastError('ObjectId', 'abc', '_id');
    const res = await request(appThatThrows(error)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('maps duplicate key errors to 409 without leaking index details', async () => {
    const error = Object.assign(new Error('E11000 duplicate key index: secret_idx'), { code: 11000 });
    const res = await request(appThatThrows(error)).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_KEY');
    expect(JSON.stringify(res.body)).not.toMatch(/secret_idx/);
  });

  it('maps oversized payloads to 413', async () => {
    const res = await request(appThatThrows(Object.assign(new Error('too large'), { status: 413 }))).get('/boom');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
