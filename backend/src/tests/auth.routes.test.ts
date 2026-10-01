import request from 'supertest';
import { app } from '../app';
import { authRateLimiter } from '../middleware/rateLimit.middleware';

const validUser = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'longenough1' };

describe('Auth routes', () => {
  // The /register and /login routes share a single process-wide rate limiter
  // (max 10 requests per 15-minute window per IP). Without resetting it between
  // tests, the limiter's budget is shared across every test in this file, so
  // adding or removing a register/login call anywhere in the suite can make an
  // unrelated, later test fail with a 429 once the shared budget is exhausted.
  // Reset after every test so each test gets a fresh budget regardless of how
  // supertest's loopback address is represented.
  afterEach(() => {
    ['::1', '::ffff:127.0.0.1', '127.0.0.1'].forEach((ip) => {
      try {
        authRateLimiter.resetKey(ip);
      } catch {
        // ignore - key may not exist
      }
    });
  });

  it('registers a new user and sets a refresh-token cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('ignores a client-supplied role field on registration (prevents privilege escalation)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Mallory Admin',
      email: 'mallory-admin@example.com',
      password: 'longenough1',
      role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('rejects a whitespace-only name with 400 VALIDATION_ERROR instead of a 500', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: '   ',
      email: 'whitespace-name@example.com',
      password: 'longenough1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate registration with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects login with invalid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('refreshes the access token using the refresh cookie', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const cookie = register.headers['set-cookie'][0];
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns the current user from /me when authenticated', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const token = register.body.data.accessToken;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(validUser.email);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs out, invalidating the refresh cookie for future refreshes', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const cookie = register.headers['set-cookie'][0];
    const token = register.body.data.accessToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});
