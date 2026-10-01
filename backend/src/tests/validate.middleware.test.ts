import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { errorHandler } from '../middleware/errorHandler.middleware';

const schema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/test', validate(schema), (req, res) => res.json({ ok: true, body: req.body }));
  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  it('calls next() and preserves body when payload is valid', async () => {
    const res = await request(buildTestApp())
      .post('/test')
      .send({ email: 'a@b.com', password: 'longenough' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns a 400 VALIDATION_ERROR when payload is invalid', async () => {
    const res = await request(buildTestApp())
      .post('/test')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('strips unknown fields not defined in the schema', async () => {
    const res = await request(buildTestApp())
      .post('/test')
      .send({ email: 'a@b.com', password: 'longenough', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.body.role).toBeUndefined();
    expect(res.body.body).toEqual({ email: 'a@b.com', password: 'longenough' });
  });
});
