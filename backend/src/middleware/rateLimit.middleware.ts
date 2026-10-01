import rateLimit, { Options } from 'express-rate-limit';
import { env } from '../config/env';

const skipInTests = () => env.NODE_ENV === 'test';

/**
 * Factory function to create a rate limiter instance with standard auth config.
 * Used to create fresh instances for testing isolation and the singleton for production.
 */
export function createAuthRateLimiter(options: Partial<Options> = {}) {
  return rateLimit({
    ...options,
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' },
      });
    },
  });
}

/** Login/register: 10 requests per 15-minute window per IP. */
export const authRateLimiter = createAuthRateLimiter({ skip: skipInTests });

/** Whole API: 300 requests per minute per IP, a broad guard against scraping and floods. */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' },
    });
  },
});
