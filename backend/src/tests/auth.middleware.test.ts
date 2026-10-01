import express from 'express';
import request from 'supertest';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { errorHandler } from '../middleware/errorHandler.middleware';
import { signAccessToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/auth.types';

function buildTestApp() {
  const app = express();
  app.get('/private', authenticate, (req: AuthenticatedRequest, res) => {
    res.json({ sub: req.user?.sub });
  });
  app.get('/admin-only', authenticate, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  it('rejects requests without an Authorization header', async () => {
    const res = await request(buildTestApp()).get('/private');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows requests with a valid access token', async () => {
    const token = signAccessToken({ sub: 'user1', role: 'user' });
    const res = await request(buildTestApp())
      .get('/private')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('user1');
  });

  it('rejects an expired/invalid access token', async () => {
    const res = await request(buildTestApp())
      .get('/private')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('requireRole middleware', () => {
  it('allows an admin to access an admin-only route', async () => {
    const token = signAccessToken({ sub: 'admin1', role: 'admin' });
    const res = await request(buildTestApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('forbids a regular user from an admin-only route', async () => {
    const token = signAccessToken({ sub: 'user1', role: 'user' });
    const res = await request(buildTestApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
