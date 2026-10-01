import request from 'supertest';
import passport from 'passport';
import { app } from '../app';
import { env } from '../config/env';
import { configurePassport } from '../config/passport';
import { UserModel } from '../models/User.model';
import { findOrCreateOAuthUser } from '../services/oauth.service';

// A stand-in for the real provider strategy: it succeeds or fails without network access.
function fakeStrategy(outcome: () => Promise<unknown>) {
  return {
    name: 'google',
    authenticate(this: { success: (u: unknown) => void; error: (e: unknown) => void }) {
      outcome().then((user) => this.success(user)).catch((err) => this.error(err));
    },
  };
}

describe('OAuth flow with a configured provider', () => {
  const saved = { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };

  beforeAll(() => {
    env.GOOGLE_CLIENT_ID = 'test-client-id';
    env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  beforeEach(() => {
    passport.unuse('google');
    configurePassport();
  });

  afterAll(() => {
    env.GOOGLE_CLIENT_ID = saved.id;
    env.GOOGLE_CLIENT_SECRET = saved.secret;
    passport.unuse('google');
  });

  async function startAndGetState() {
    const start = await request(app).get('/api/v1/auth/google');
    const location = new URL(start.headers.location);
    const cookies = start.headers['set-cookie'] as unknown as string[];
    return { start, location, state: location.searchParams.get('state')!, cookie: cookies[0].split(';')[0] };
  }

  it('lists the provider as available', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    expect(res.body.data).toEqual({ google: true, facebook: false });
  });

  it('redirects to the provider with a state bound to a cookie', async () => {
    const { start, location, state, cookie } = await startAndGetState();
    expect(start.status).toBe(302);
    expect(location.host).toBe('accounts.google.com');
    expect(location.searchParams.get('scope')).toContain('email');
    expect(cookie).toContain(state);
  });

  it('rejects a callback whose state does not match the cookie (login CSRF)', async () => {
    const { cookie } = await startAndGetState();
    const res = await request(app).get('/api/v1/auth/google/callback?code=x&state=forged').set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${env.CLIENT_URL}/login?error=oauth_state_mismatch`);
    const setCookies = ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).join(';');
    expect(setCookies).not.toMatch(/refreshToken=[^;]/);
  });

  it('signs the user in (refresh cookie + redirect home) on a successful callback', async () => {
    const user = await findOrCreateOAuthUser({ provider: 'google', providerId: 'flow-1', email: 'flow@example.com', name: 'Flow' });
    const { state, cookie } = await startAndGetState();
    passport.use('google', fakeStrategy(async () => user) as unknown as passport.Strategy);

    const res = await request(app).get(`/api/v1/auth/google/callback?code=x&state=${state}`).set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${env.CLIENT_URL}/`);

    const setCookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(setCookies).toMatch(/refreshToken=[^;]+; .*HttpOnly/);

    const refreshCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!;
    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie.split(';')[0]);
    expect(refreshed.status).toBe(200);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
    expect(me.body.data.email).toBe('flow@example.com');
  });

  it('redirects to the login page with an error when the provider flow fails', async () => {
    const { state, cookie } = await startAndGetState();
    passport.use('google', fakeStrategy(async () => { throw new Error('boom'); }) as unknown as passport.Strategy);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const res = await request(app).get(`/api/v1/auth/google/callback?code=x&state=${state}`).set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${env.CLIENT_URL}/login?error=oauth_failed`);
    consoleSpy.mockRestore();
    expect(await UserModel.countDocuments({ googleId: 'flow-1' })).toBe(0);
  });
});
