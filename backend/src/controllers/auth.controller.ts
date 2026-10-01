import { Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} from '../services/auth.service';
import { env } from '../config/env';
import { verifyAccessToken, verifyRefreshToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/auth.types';
import { UserModel } from '../models/User.model';
import { AppError } from '../utils/AppError';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function toPublicUser(user: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

// Logout must work even when the 15-minute access token has expired, so the user is
// identified from the access token if still valid, otherwise from the refresh cookie.
function identifyForLogout(req: AuthenticatedRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      return verifyAccessToken(header.slice('Bearer '.length)).sub;
    } catch {
      /* fall through to the refresh cookie */
    }
  }
  const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (cookie) {
    try {
      return verifyRefreshToken(cookie).sub;
    } catch {
      return null;
    }
  }
  return null;
}

export async function register(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await registerUser(req.body);
    res.locals.userId = String(user._id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(201).json({ success: true, data: { user: toPublicUser(user), accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await loginUser(req.body);
    res.locals.userId = String(user._id);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(200).json({ success: true, data: { user: toPublicUser(user), accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const incoming = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!incoming) {
      throw new AppError('Refresh token missing', 401, 'INVALID_REFRESH_TOKEN');
    }
    const { accessToken, refreshToken } = await refreshTokens(incoming);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(200).json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = identifyForLogout(req);
    if (userId) {
      await logoutUser(userId);
      res.locals.userId = userId;
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await UserModel.findById(req.user?.sub);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    res.status(200).json({ success: true, data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}
