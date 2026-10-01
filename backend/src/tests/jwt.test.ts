import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt';

describe('jwt utils', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken({ sub: 'user123', role: 'user' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user123');
    expect(payload.role).toBe('user');
  });

  it('signs and verifies a refresh token round-trip', () => {
    const token = signRefreshToken({ sub: 'user123', tokenVersion: 2 });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('user123');
    expect(payload.tokenVersion).toBe(2);
  });

  it('throws when verifying a tampered access token', () => {
    const token = signAccessToken({ sub: 'user123', role: 'admin' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects an access token verified as a refresh token', () => {
    const token = signAccessToken({ sub: 'user123', role: 'user' });
    expect(() => verifyRefreshToken(token)).toThrow();
  });
});
