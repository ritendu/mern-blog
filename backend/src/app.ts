import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { postRouter } from './routes/post.routes';
import { commentRouter } from './routes/comment.routes';
import { adminRouter } from './routes/admin.routes';
import { oauthRouter } from './routes/oauth.routes';
import { notificationRouter } from './routes/notification.routes';
import { configurePassport } from './config/passport';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

export const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
configurePassport();
app.use(passport.initialize());
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'MERN Blog API',
  })
);

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', apiRateLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth', oauthRouter);
app.use('/api/v1/posts', postRouter);
app.use('/api/v1', commentRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/notifications', notificationRouter);

app.use(errorHandler);
