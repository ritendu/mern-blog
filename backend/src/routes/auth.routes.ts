import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { logActivity } from '../middleware/activityLogger.middleware';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), logActivity('USER_REGISTERED'), authController.register);
authRouter.post('/login', authRateLimiter, validate(loginSchema), logActivity('USER_LOGIN'), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', logActivity('USER_LOGOUT'), authController.logout);
authRouter.get('/me', authenticate, authController.me);
