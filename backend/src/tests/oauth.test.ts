import request from 'supertest';
import { app } from '../app';
import { UserModel } from '../models/User.model';
import { findOrCreateOAuthUser } from '../services/oauth.service';

describe('findOrCreateOAuthUser', () => {
  it('creates a password-less user for a new social identity', async () => {
    const user = await findOrCreateOAuthUser({ provider: 'google', providerId: 'g-1', email: 'New@Example.com', name: 'New Person' });
    expect(user.email).toBe('new@example.com');
    expect(user.googleId).toBe('g-1');
    expect(user.password).toBeUndefined();
    expect(user.role).toBe('user');
  });

  it('returns the same user on repeat login', async () => {
    const first = await findOrCreateOAuthUser({ provider: 'facebook', providerId: 'f-1', email: 'fb@example.com', name: 'FB' });
    const second = await findOrCreateOAuthUser({ provider: 'facebook', providerId: 'f-1' });
    expect(String(second._id)).toBe(String(first._id));
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('links a social identity to an existing account with the same email', async () => {
    const existing = await UserModel.create({ name: 'Local', email: 'both@example.com', password: 'longenough1' });
    const linked = await findOrCreateOAuthUser({ provider: 'google', providerId: 'g-2', email: 'both@example.com', name: 'Local' });
    expect(String(linked._id)).toBe(String(existing._id));
    expect(linked.googleId).toBe('g-2');
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('rejects a profile without an email', async () => {
    await expect(findOrCreateOAuthUser({ provider: 'facebook', providerId: 'f-2', name: 'No Email' })).rejects.toMatchObject({
      code: 'OAUTH_NO_EMAIL',
    });
  });

  it('does not let a social-only account log in with a password', async () => {
    await findOrCreateOAuthUser({ provider: 'google', providerId: 'g-3', email: 'social@example.com', name: 'Social' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'social@example.com', password: 'anything123' });
    expect(res.status).toBe(401);
  });
});

describe('OAuth routes without credentials', () => {
  it('reports no configured providers', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ google: false, facebook: false });
  });

  it('answers 503 for unconfigured provider endpoints', async () => {
    for (const path of ['/google', '/google/callback', '/facebook', '/facebook/callback']) {
      const res = await request(app).get(`/api/v1/auth${path}`);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('OAUTH_NOT_CONFIGURED');
    }
  });

  it('keeps email/password auth working', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Plain', email: 'plain-oauth@example.com', password: 'longenough1' });
    expect(res.status).toBe(201);
  });
});
