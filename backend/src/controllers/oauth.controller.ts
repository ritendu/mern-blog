import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import { isProviderConfigured } from '../config/passport';
import { IUser } from '../models/User.model';
import { issueTokens } from '../services/auth.service';
import { OAuthProvider } from '../services/oauth.service';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from './auth.controller';
import { AppError } from '../utils/AppError';

const STATE_COOKIE = 'oauth_state';
const SCOPES: Record<OAuthProvider, string[]> = {
  google: ['profile', 'email'],
  facebook: ['email'],
};

export function listProviders(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: { google: isProviderConfigured('google'), facebook: isProviderConfigured('facebook') },
  });
}

function loginFailureRedirect(res: Response, reason: string): void {
  res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(reason)}`);
}

export function startOAuth(provider: OAuthProvider): RequestHandler {
  return (req, res, next) => {
    if (!isProviderConfigured(provider)) {
      next(new AppError(`${provider} login is not configured`, 503, 'OAUTH_NOT_CONFIGURED'));
      return;
    }
    // A random state bound to this browser (cookie) blocks login-CSRF.
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 10 * 60 * 1000,
    });
    passport.authenticate(provider, { scope: SCOPES[provider], session: false, state })(req, res, next);
  };
}

export function finishOAuth(provider: OAuthProvider): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isProviderConfigured(provider)) {
      next(new AppError(`${provider} login is not configured`, 503, 'OAUTH_NOT_CONFIGURED'));
      return;
    }
    const expected = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/api/v1/auth' });
    if (!expected || expected !== req.query.state) {
      loginFailureRedirect(res, 'oauth_state_mismatch');
      return;
    }
    passport.authenticate(provider, { session: false }, (err: unknown, user: IUser | false) => {
      if (err || !user) {
        const code = err instanceof AppError ? err.code.toLowerCase() : 'oauth_failed';
        loginFailureRedirect(res, code);
        return;
      }
      res.cookie(REFRESH_COOKIE_NAME, issueTokens(user).refreshToken, refreshCookieOptions);
      res.redirect(`${env.CLIENT_URL}/`);
    })(req, res, next);
  };
}
