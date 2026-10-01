import express from 'express';
import request from 'supertest';
import { createAuthRateLimiter } from '../middleware/rateLimit.middleware';

function buildTestApp() {
  const app = express();
  // Create a fresh rate limiter instance per test to ensure isolation
  const limiter = createAuthRateLimiter();
  app.post('/limited', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/limited');
    expect(res.status).toBe(200);
  });

  it('blocks requests once the limit is exceeded', async () => {
    const app = buildTestApp();
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/limited');
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
