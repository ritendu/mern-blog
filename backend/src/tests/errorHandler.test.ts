import express from 'express';
import request from 'supertest';
import { AppError } from '../utils/AppError';
import { errorHandler } from '../middleware/errorHandler.middleware';

function buildTestApp(thrower: () => void) {
  const app = express();
  app.get('/boom', (_req, _res) => thrower());
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('formats an AppError with its own status code and code', async () => {
    const app = buildTestApp(() => {
      throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'DUPLICATE_EMAIL', message: 'Email already in use' },
    });
  });

  it('masks unexpected errors as a generic 500 without leaking internals', async () => {
    const app = buildTestApp(() => {
      throw new Error('some internal db driver detail');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toMatch(/db driver/);
  });

  it('returns a clean 400 for malformed JSON and never logs the raw body', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const app = buildTestApp(() => {
        const syntaxError = new SyntaxError('Unexpected token in JSON') as SyntaxError & {
          status?: number;
          body?: string;
        };
        syntaxError.status = 400;
        syntaxError.body = '{"email":"a@b.com","password":"plaintext-secret"';
        throw syntaxError;
      });
      const res = await request(app).get('/boom');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
