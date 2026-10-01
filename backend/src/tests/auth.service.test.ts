import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} from '../services/auth.service';
import { verifyAccessToken, verifyRefreshToken } from '../utils/jwt';

describe('auth service', () => {
  it('registers a new user and returns a token pair', async () => {
    const { user, accessToken, refreshToken } = await registerUser({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'longenough1',
    });
    expect(user.email).toBe('ada@example.com');
    expect(verifyAccessToken(accessToken).sub).toBe(String(user._id));
    expect(verifyRefreshToken(refreshToken).sub).toBe(String(user._id));
  });

  it('rejects registration with a duplicate email', async () => {
    await registerUser({ name: 'A', email: 'dup@example.com', password: 'longenough1' });
    await expect(
      registerUser({ name: 'B', email: 'dup@example.com', password: 'longenough2' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_EMAIL' });
  });

  it('converts a concurrent duplicate-email race into a clean DUPLICATE_EMAIL error', async () => {
    const input = { name: 'Race', email: 'race@example.com', password: 'longenough1' };
    const results = await Promise.allSettled([registerUser(input), registerUser(input)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 409, code: 'DUPLICATE_EMAIL' });
  });

  it('ignores a client-supplied role field and always creates a plain user (mass-assignment)', async () => {
    const maliciousInput = {
      name: 'Mallory',
      email: 'mallory@example.com',
      password: 'longenough1',
      role: 'admin',
    } as unknown as Parameters<typeof registerUser>[0];

    const { user } = await registerUser(maliciousInput);
    expect(user.role).toBe('user');
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    await registerUser({ name: 'Ada', email: 'ada2@example.com', password: 'longenough1' });

    const { accessToken } = await loginUser({ email: 'ada2@example.com', password: 'longenough1' });
    expect(verifyAccessToken(accessToken).sub).toBeTruthy();

    await expect(
      loginUser({ email: 'ada2@example.com', password: 'wrongpassword' })
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('issues a new token pair from a valid refresh token', async () => {
    const { user, refreshToken } = await registerUser({
      name: 'Ada',
      email: 'ada3@example.com',
      password: 'longenough1',
    });
    const rotated = await refreshTokens(refreshToken);
    expect(verifyAccessToken(rotated.accessToken).sub).toBe(String(user._id));
    expect(verifyRefreshToken(rotated.refreshToken).sub).toBe(String(user._id));
  });

  it('rejects a refresh token replayed after logout', async () => {
    const { user, refreshToken } = await registerUser({
      name: 'Ada',
      email: 'ada4@example.com',
      password: 'longenough1',
    });
    await logoutUser(String(user._id));
    await expect(refreshTokens(refreshToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  });
});
