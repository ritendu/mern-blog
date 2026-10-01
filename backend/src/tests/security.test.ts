import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { UserModel } from '../models/User.model';
import { createPost, registerAdmin, registerUser, validContent } from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('JWT handling', () => {
  it('rejects unsigned ("alg: none") and wrongly signed tokens', async () => {
    const user = await registerUser('jwt1@example.com');
    const unsigned = jwt.sign({ sub: user.id, role: 'admin' }, '', { algorithm: 'none' });
    const wrongSecret = jwt.sign({ sub: user.id, role: 'admin' }, 'not-the-secret');
    for (const token of [unsigned, wrongSecret, 'garbage']) {
      const res = await request(app).get('/api/v1/auth/me').set(auth(token));
      expect(res.status).toBe(401);
    }
  });

  it('does not accept a refresh token as an access token', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({ name: 'Tok', email: 'jwt2@example.com', password: 'longenough1' });
    const cookie = (register.headers['set-cookie'] as unknown as string[])[0];
    const refreshToken = cookie.split(';')[0].split('=')[1];
    const res = await request(app).get('/api/v1/auth/me').set(auth(refreshToken));
    expect(res.status).toBe(401);
  });
});

describe('Admin freshness', () => {
  it('revokes admin access immediately after demotion, even with a still-valid token', async () => {
    const admin = await registerAdmin('fresh@example.com');
    expect((await request(app).get('/api/v1/admin/stats').set(auth(admin.token))).status).toBe(200);
    await UserModel.findByIdAndUpdate(admin.id, { role: 'user' });
    expect((await request(app).get('/api/v1/admin/stats').set(auth(admin.token))).status).toBe(403);
  });

  it('forces re-login (refresh tokens revoked) after an admin changes a role', async () => {
    const admin = await registerAdmin('revoker@example.com');
    const target = await request(app).post('/api/v1/auth/register').send({ name: 'Target', email: 'target@example.com', password: 'longenough1' });
    const cookie = (target.headers['set-cookie'] as unknown as string[])[0];
    await request(app).patch(`/api/v1/admin/users/${target.body.data.user.id}/role`).set(auth(admin.token)).send({ role: 'admin' });
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });
});

describe('Logout', () => {
  it('works with only the refresh cookie when the access token has expired', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({ name: 'Out', email: 'logout@example.com', password: 'longenough1' });
    const cookie = (register.headers['set-cookie'] as unknown as string[])[0];
    const out = await request(app).post('/api/v1/auth/logout').set(auth('expired.or.invalid')).set('Cookie', cookie);
    expect(out.status).toBe(200);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });

  it('is harmless without any credentials', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(200);
  });
});

describe('Input hardening', () => {
  it('rejects NoSQL operator objects in login and register bodies', async () => {
    await registerUser('victim-inj@example.com');
    const login = await request(app).post('/api/v1/auth/login').send({ email: { $ne: null }, password: 'x' });
    expect(login.status).toBe(400);
    const reg = await request(app).post('/api/v1/auth/register').send({ name: 'x', email: { $gt: '' }, password: 'longenough1' });
    expect(reg.status).toBe(400);
  });

  it('ignores operator objects in query strings', async () => {
    const admin = await registerAdmin('qs@example.com');
    const res = await request(app).get('/api/v1/admin/users?q[$ne]=zzz').set(auth(admin.token));
    expect(res.status).toBe(200);
    const posts = await request(app).get('/api/v1/posts?page[$gt]=0&limit=abc');
    expect(posts.status).toBe(200);
  });

  it('rejects over-long passwords and oversized bodies', async () => {
    const long = await request(app).post('/api/v1/auth/register').send({ name: 'Long', email: 'long@example.com', password: 'a'.repeat(73) });
    expect(long.status).toBe(400);
    const huge = await request(app).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(200 * 1024) });
    expect(huge.status).toBe(413);
  });

  it('never returns password hashes in auth responses', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({ name: 'Safe', email: 'safe@example.com', password: 'longenough1' });
    expect(JSON.stringify(register.body)).not.toMatch(/password|\$2[aby]\$/);
    const me = await request(app).get('/api/v1/auth/me').set(auth(register.body.data.accessToken));
    expect(JSON.stringify(me.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  it('keeps the refresh cookie httpOnly', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({ name: 'Ck', email: 'cookie@example.com', password: 'longenough1' });
    const cookie = (register.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('Robustness', () => {
  it('handles concurrent posts with the same title without server errors', async () => {
    const user = await registerUser('race@example.com');
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/posts').set(auth(user.token)).send({ title: 'Same Title', content: validContent })
      )
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.slug)).size).toBe(5);
  });

  it('does not expose soft-deleted posts through any public read', async () => {
    const user = await registerUser('soft@example.com');
    const post = await createPost(user.token, 'Soft Deleted Post');
    await request(app).delete(`/api/v1/posts/${post.id}`).set(auth(user.token));
    expect((await request(app).get(`/api/v1/posts/${post.slug}`)).status).toBe(404);
    const list = await request(app).get('/api/v1/posts');
    expect(list.body.data.posts).toHaveLength(0);
    const mine = await request(app).get('/api/v1/posts/mine').set(auth(user.token));
    expect(mine.body.data.posts).toHaveLength(0);
  });

  it('prevents editing or deleting other users\' posts', async () => {
    const owner = await registerUser('own-sec@example.com');
    const intruder = await registerUser('intruder@example.com');
    const post = await createPost(owner.token);
    const edit = await request(app).patch(`/api/v1/posts/${post.id}`).set(auth(intruder.token)).send({ title: 'Hijacked' });
    expect(edit.status).toBe(403);
    const del = await request(app).delete(`/api/v1/posts/${post.id}`).set(auth(intruder.token));
    expect(del.status).toBe(403);
  });
});

describe('Production configuration guard', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  function loadEnvWith(overrides: Record<string, string>) {
    process.env = {
      ...original,
      NODE_ENV: 'production',
      MONGO_URI: 'mongodb://localhost/x',
      ...overrides,
    };
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../config/env');
    });
  }

  it('refuses placeholder or short JWT secrets in production', () => {
    expect(() => loadEnvWith({ JWT_ACCESS_SECRET: 'change_me_access', JWT_REFRESH_SECRET: 'change_me_refresh' })).toThrow(/JWT secrets/);
  });

  it('refuses identical access and refresh secrets in production', () => {
    const secret = 'a'.repeat(40);
    expect(() => loadEnvWith({ JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret })).toThrow(/JWT secrets/);
  });

  it('accepts strong, distinct secrets', () => {
    expect(() => loadEnvWith({ JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) })).not.toThrow();
  });
});
