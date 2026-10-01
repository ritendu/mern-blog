# Module 1 — Authentication & Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, working, end-to-end authentication & authorization foundation (backend + frontend) for the MERN blog system: registration, login, logout, JWT access/refresh tokens, bcrypt hashing, rate limiting, RBAC middleware (admin/user), and the corresponding React UI (AuthContext, Login/Register pages, ProtectedRoute/AdminRoute).

**Architecture:** Express + TypeScript backend with a layered structure (models → validators → services → controllers → routes → middleware), short-lived JWT access tokens returned in the response body (kept in memory on the frontend, never localStorage) and longer-lived refresh tokens stored in an httpOnly cookie. A `tokenVersion` counter on the User document invalidates all outstanding refresh tokens on logout/password change without a token blacklist collection. Frontend is Vite + React + TypeScript + React Bootstrap, with a global `AuthContext` and an Axios instance that auto-refreshes on 401.

**Tech Stack:** Node.js, Express, TypeScript, MongoDB + Mongoose, Zod, jsonwebtoken, bcryptjs, express-rate-limit, Jest, Supertest, mongodb-memory-server, Vite, React 18, TypeScript, React Router, React Bootstrap, Axios.

**Spec:** `D:\Projects\MERN Stack project\project-requirements.md` (module-by-module process) and `D:\Projects\MERN Stack project\MERN Stack Assignment.pdf` (functional requirements, sections "1. User Authentication" and "2. User Roles and Permissions").

## Global Constraints

- Module-by-module: only Module 1 (Authentication & Authorization) is in scope for this plan. Do not touch Posts/Comments/Admin.
- RBAC must be enforced at the API level, not only the frontend (PDF §2).
- Passwords hashed with bcrypt before storage; plaintext never logged or returned (PDF §1).
- JWT access + refresh tokens; refresh-token handling must support logout invalidation (PDF §1).
- Auth endpoints (`/register`, `/login`) protected by rate limiting (PDF §1).
- Credentials/secrets only via `.env`, never hard-coded (PDF §1).
- Two roles only: `admin`, `user` (PDF §2).
- Frontend: functional components + hooks only, auth state via Context API, protected routes for authenticated and admin users (PDF "Frontend Requirements").
- Centralized, consistent API error response shape (assignment §6) — applies even though full centralized error handling is formally Module 6; Module 1 must use the same `AppError` + `errorHandler` shape so later modules don't have to retrofit it.
- TDD: every unit of backend logic (model hook, jwt util, service, middleware) gets a failing test before implementation code.

## Review Focus

- Duplicate email registration must return a clean 409/validation error, not a raw Mongo duplicate-key stack trace — users will double-submit forms.
- Expired or tampered access token on a protected route must return 401 with a machine-checkable error code (not a 500), since the frontend's refresh interceptor branches on it.
- Refresh token reuse after logout (old cookie replayed) must be rejected — this is the actual security property `tokenVersion` exists for; a test must prove a post-logout refresh fails.
- Regular user hitting an admin-only route must get 403, and this must be enforced server-side even if the frontend never renders a link to it (PDF §2 explicitly calls this out).
- Registration/login payload validation must reject missing/malformed fields (empty email, short password) before touching the database, with field-level error messages the frontend can display.

---

## File Structure

**Backend** (`backend/src/`):
- `config/env.ts` — loads and validates required environment variables.
- `config/db.ts` — Mongoose connection helper.
- `models/User.model.ts` — User schema (name, email, password hash, role, tokenVersion) + pre-save hashing hook + `comparePassword` method.
- `types/auth.types.ts` — shared TS types (`JwtAccessPayload`, `JwtRefreshPayload`, `AuthenticatedRequest`, `UserRole`).
- `validators/auth.validator.ts` — Zod schemas for register/login.
- `utils/AppError.ts` — operational error class used by the centralized handler.
- `utils/jwt.ts` — sign/verify access & refresh tokens.
- `services/auth.service.ts` — register, login, refresh, logout business logic (no req/res).
- `controllers/auth.controller.ts` — thin HTTP layer calling the service, setting the refresh cookie.
- `middleware/auth.middleware.ts` — `authenticate` (verifies access token, attaches `req.user`).
- `middleware/rbac.middleware.ts` — `requireRole(...roles)`.
- `middleware/rateLimit.middleware.ts` — limiter for `/register` and `/login`.
- `middleware/validate.middleware.ts` — generic Zod-validation middleware factory.
- `middleware/errorHandler.middleware.ts` — centralized error → consistent JSON response.
- `routes/auth.routes.ts` — wires routes to controller + middleware.
- `app.ts` — Express app assembly (helmet, cors, cookie-parser, routes, error handler).
- `server.ts` — starts HTTP server + DB connection.
- `tests/setup.ts` — mongodb-memory-server bootstrap for Jest.
- `tests/jwt.test.ts`, `tests/user.model.test.ts`, `tests/auth.service.test.ts`, `tests/auth.middleware.test.ts`, `tests/auth.routes.test.ts` — one file per unit above.

**Frontend** (`frontend/src/`):
- `types/auth.types.ts` — `User`, `AuthState`, request/response DTOs.
- `api/axios.ts` — configured Axios instance with refresh-on-401 interceptor.
- `api/auth.api.ts` — thin wrappers calling `/api/v1/auth/*`.
- `context/AuthContext.tsx` — provider exposing `user`, `login`, `register`, `logout`, `loading`.
- `components/ProtectedRoute.tsx`, `components/AdminRoute.tsx`.
- `pages/Login.tsx`, `pages/Register.tsx`.
- `App.tsx` — router wiring.

Each file has one responsibility; files that change together (e.g. a middleware and its test) are listed together in the same task.

---

### Task 1: Backend project scaffolding

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/config/db.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/tests/setup.ts`
- Test: `backend/src/tests/health.test.ts`

**Interfaces:**
- Produces: `loadEnv(): Env` (object with `PORT`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `NODE_ENV`), `connectDB(uri: string): Promise<void>`, `app` (Express app, exported for Supertest), default export `startServer()` in `server.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/health.test.ts
import request from 'supertest';
import { app } from '../app';

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm install && npm test -- health.test.ts`
Expected: FAIL — `Cannot find module '../app'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```json
// backend/.env.example
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/mern_blog
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

```
# backend/.gitignore
node_modules
dist
.env
coverage
```

```js
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
```

```ts
// backend/src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGO_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  CLIENT_URL: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'test') return `test_${name}`;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: required('MONGO_URI'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
```

```ts
// backend/src/config/db.ts
import mongoose from 'mongoose';

export async function connectDB(uri: string): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
```

```ts
// backend/src/app.ts
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';

export const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});
```

```ts
// backend/src/server.ts
import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function startServer(): Promise<void> {
  await connectDB(env.MONGO_URI);
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.PORT}`);
  });
}

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

```ts
// backend/src/tests/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- health.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/jest.config.js backend/.env.example backend/.gitignore backend/src/config backend/src/app.ts backend/src/server.ts backend/src/tests/setup.ts backend/src/tests/health.test.ts
git commit -m "chore(backend): scaffold Express+TS backend with health check"
```

---

### Task 2: User model with password hashing

**Files:**
- Create: `backend/src/types/auth.types.ts`
- Create: `backend/src/models/User.model.ts`
- Test: `backend/src/tests/user.model.test.ts`

**Interfaces:**
- Consumes: nothing new (uses `mongoose` directly).
- Produces: `UserRole = 'admin' | 'user'`; `IUser` interface (`_id`, `name`, `email`, `password`, `role`, `tokenVersion`, `createdAt`, `updatedAt`, method `comparePassword(candidate: string): Promise<boolean>`); default export `UserModel` (Mongoose model named `'User'`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/user.model.test.ts
import { UserModel } from '../models/User.model';

describe('User model', () => {
  it('hashes the password before saving and allows comparePassword to verify it', async () => {
    const user = await UserModel.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'plaintext123',
    });

    expect(user.password).not.toBe('plaintext123');
    const matches = await user.comparePassword('plaintext123');
    expect(matches).toBe(true);
    const wrong = await user.comparePassword('wrongpass');
    expect(wrong).toBe(false);
  });

  it('defaults role to user and tokenVersion to 0', async () => {
    const user = await UserModel.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'plaintext123',
    });
    expect(user.role).toBe('user');
    expect(user.tokenVersion).toBe(0);
  });

  it('rejects duplicate emails at the schema/index level', async () => {
    await UserModel.create({ name: 'A', email: 'dup@example.com', password: 'x1234567' });
    await expect(
      UserModel.create({ name: 'B', email: 'dup@example.com', password: 'y1234567' })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- user.model.test.ts`
Expected: FAIL — `Cannot find module '../models/User.model'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/types/auth.types.ts
import { Request } from 'express';

export type UserRole = 'admin' | 'user';

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtAccessPayload;
}
```

```ts
// backend/src/models/User.model.ts
import { Schema, model, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types/auth.types';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const UserModel: Model<IUser> = model<IUser>('User', userSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- user.model.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/types/auth.types.ts backend/src/models/User.model.ts backend/src/tests/user.model.test.ts
git commit -m "feat(auth): add User model with bcrypt password hashing"
```

---

### Task 3: JWT utilities

**Files:**
- Create: `backend/src/utils/jwt.ts`
- Test: `backend/src/tests/jwt.test.ts`

**Interfaces:**
- Consumes: `JwtAccessPayload`, `JwtRefreshPayload` from `../types/auth.types`; `env` from `../config/env`.
- Produces: `signAccessToken(payload: JwtAccessPayload): string`, `signRefreshToken(payload: JwtRefreshPayload): string`, `verifyAccessToken(token: string): JwtAccessPayload`, `verifyRefreshToken(token: string): JwtRefreshPayload` (both verify functions throw on invalid/expired token).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/jwt.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- jwt.test.ts`
Expected: FAIL — `Cannot find module '../utils/jwt'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtAccessPayload, JwtRefreshPayload } from '../types/auth.types';

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
}
```

Note: because `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` differ (both required, must be set to different values in `.env`), an access token signed with one secret fails verification with the other — this is what makes the fourth test pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- jwt.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/jwt.ts backend/src/tests/jwt.test.ts
git commit -m "feat(auth): add JWT sign/verify utilities for access and refresh tokens"
```

---

### Task 4: AppError + centralized error handler

**Files:**
- Create: `backend/src/utils/AppError.ts`
- Create: `backend/src/middleware/errorHandler.middleware.ts`
- Test: `backend/src/tests/errorHandler.test.ts`

**Interfaces:**
- Produces: `class AppError extends Error { statusCode: number; code: string; constructor(message: string, statusCode: number, code: string) }`; `errorHandler: ErrorRequestHandler` — express error middleware producing `{ success: false, error: { code, message } }`, with `code: 'INTERNAL_ERROR'` and no stack-trace leakage for non-`AppError` errors.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/errorHandler.test.ts
import express from 'express';
import request from 'supertest';
import { AppError } from '../utils/AppError';
import { errorHandler } from '../middleware/errorHandler.middleware';

function buildTestApp(thrower: () => void) {
  const app = express();
  app.get('/boom', (_req, _res) => thrower());
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('formats an AppError with its own status code and code', async () => {
    const app = buildTestApp(() => {
      throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'DUPLICATE_EMAIL', message: 'Email already in use' },
    });
  });

  it('masks unexpected errors as a generic 500 without leaking internals', async () => {
    const app = buildTestApp(() => {
      throw new Error('some internal db driver detail');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toMatch(/db driver/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- errorHandler.test.ts`
Expected: FAIL — `Cannot find module '../utils/AppError'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/utils/AppError.ts
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```

```ts
// backend/src/middleware/errorHandler.middleware.ts
import { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- errorHandler.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/AppError.ts backend/src/middleware/errorHandler.middleware.ts backend/src/tests/errorHandler.test.ts
git commit -m "feat(core): add AppError and centralized error-handling middleware"
```

---

### Task 5: Zod validators + validation middleware

**Files:**
- Create: `backend/src/validators/auth.validator.ts`
- Create: `backend/src/middleware/validate.middleware.ts`
- Test: `backend/src/tests/validate.middleware.test.ts`

**Interfaces:**
- Produces: `registerSchema`, `loginSchema` (Zod objects with `body` key matching Express `req.body` shape); `validate(schema: ZodSchema) => RequestHandler` that parses `{ body: req.body }` and calls `next(new AppError(firstMessage, 400, 'VALIDATION_ERROR'))` on failure, otherwise `next()`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/validate.middleware.test.ts
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { errorHandler } from '../middleware/errorHandler.middleware';

const schema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/test', validate(schema), (req, res) => res.json({ ok: true, body: req.body }));
  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  it('calls next() and preserves body when payload is valid', async () => {
    const res = await request(buildTestApp())
      .post('/test')
      .send({ email: 'a@b.com', password: 'longenough' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns a 400 VALIDATION_ERROR when payload is invalid', async () => {
    const res = await request(buildTestApp())
      .post('/test')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- validate.middleware.test.ts`
Expected: FAIL — `Cannot find module '../middleware/validate.middleware'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/middleware/validate.middleware.ts
import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

export function validate(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse({ body: req.body });
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      next(new AppError(firstIssue.message, 400, 'VALIDATION_ERROR'));
      return;
    }
    next();
  };
}
```

```ts
// backend/src/validators/auth.validator.ts
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('A valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('A valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- validate.middleware.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/validators/auth.validator.ts backend/src/middleware/validate.middleware.ts backend/src/tests/validate.middleware.test.ts
git commit -m "feat(auth): add Zod validation schemas and generic validate middleware"
```

---

### Task 6: Auth service (register, login, refresh, logout)

**Files:**
- Create: `backend/src/services/auth.service.ts`
- Test: `backend/src/tests/auth.service.test.ts`

**Interfaces:**
- Consumes: `UserModel` from `../models/User.model`; `signAccessToken`, `signRefreshToken`, `verifyRefreshToken` from `../utils/jwt`; `AppError` from `../utils/AppError`; `RegisterInput`, `LoginInput` from `../validators/auth.validator`.
- Produces:
  - `registerUser(input: RegisterInput): Promise<{ user: IUser; accessToken: string; refreshToken: string }>`
  - `loginUser(input: LoginInput): Promise<{ user: IUser; accessToken: string; refreshToken: string }>`
  - `refreshTokens(incomingRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }>`
  - `logoutUser(userId: string): Promise<void>` (increments `tokenVersion`, invalidating all outstanding refresh tokens)

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/auth.service.test.ts
import { UserModel } from '../models/User.model';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- auth.service.test.ts`
Expected: FAIL — `Cannot find module '../services/auth.service'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/services/auth.service.ts
import { UserModel, IUser } from '../models/User.model';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: IUser): TokenPair {
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user._id), tokenVersion: user.tokenVersion });
  return { accessToken, refreshToken };
}

export async function registerUser(
  input: RegisterInput
): Promise<{ user: IUser } & TokenPair> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
  }
  const user = await UserModel.create(input);
  return { user, ...issueTokens(user) };
}

export async function loginUser(input: LoginInput): Promise<{ user: IUser } & TokenPair> {
  const user = await UserModel.findOne({ email: input.email });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const matches = await user.comparePassword(input.password);
  if (!matches) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  return { user, ...issueTokens(user) };
}

export async function refreshTokens(incomingRefreshToken: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  return issueTokens(user);
}

export async function logoutUser(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- auth.service.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/auth.service.ts backend/src/tests/auth.service.test.ts
git commit -m "feat(auth): add auth service with register/login/refresh/logout and tokenVersion invalidation"
```

---

### Task 7: Auth middleware (authenticate) + RBAC middleware

**Files:**
- Create: `backend/src/middleware/auth.middleware.ts`
- Create: `backend/src/middleware/rbac.middleware.ts`
- Test: `backend/src/tests/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` from `../utils/jwt`; `AppError`; `AuthenticatedRequest`, `JwtAccessPayload` from `../types/auth.types`.
- Produces: `authenticate: RequestHandler` (reads `Authorization: Bearer <token>`, sets `req.user`, else `next(AppError(401, 'UNAUTHORIZED'))`); `requireRole(...roles: UserRole[]): RequestHandler` (checks `req.user.role`, else `next(AppError(403, 'FORBIDDEN'))`).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/auth.middleware.test.ts
import express from 'express';
import request from 'supertest';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { errorHandler } from '../middleware/errorHandler.middleware';
import { signAccessToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/auth.types';

function buildTestApp() {
  const app = express();
  app.get('/private', authenticate, (req: AuthenticatedRequest, res) => {
    res.json({ sub: req.user?.sub });
  });
  app.get('/admin-only', authenticate, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  it('rejects requests without an Authorization header', async () => {
    const res = await request(buildTestApp()).get('/private');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows requests with a valid access token', async () => {
    const token = signAccessToken({ sub: 'user1', role: 'user' });
    const res = await request(buildTestApp())
      .get('/private')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('user1');
  });

  it('rejects an expired/invalid access token', async () => {
    const res = await request(buildTestApp())
      .get('/private')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('requireRole middleware', () => {
  it('allows an admin to access an admin-only route', async () => {
    const token = signAccessToken({ sub: 'admin1', role: 'admin' });
    const res = await request(buildTestApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('forbids a regular user from an admin-only route', async () => {
    const token = signAccessToken({ sub: 'user1', role: 'user' });
    const res = await request(buildTestApp())
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- auth.middleware.test.ts`
Expected: FAIL — `Cannot find module '../middleware/auth.middleware'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/middleware/auth.middleware.ts
import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/auth.types';

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError('Invalid or expired access token', 401, 'UNAUTHORIZED'));
  }
}
```

```ts
// backend/src/middleware/rbac.middleware.ts
import { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest, UserRole } from '../types/auth.types';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- auth.middleware.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.middleware.ts backend/src/middleware/rbac.middleware.ts backend/src/tests/auth.middleware.test.ts
git commit -m "feat(auth): add authenticate and requireRole (RBAC) middleware"
```

---

### Task 8: Rate limiting middleware

**Files:**
- Create: `backend/src/middleware/rateLimit.middleware.ts`
- Test: `backend/src/tests/rateLimit.middleware.test.ts`

**Interfaces:**
- Produces: `authRateLimiter: RequestHandler` — limits to 10 requests per 15 minutes per IP, returning `429` with `{ success: false, error: { code: 'TOO_MANY_REQUESTS', message } }` when exceeded.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/rateLimit.middleware.test.ts
import express from 'express';
import request from 'supertest';
import { authRateLimiter } from '../middleware/rateLimit.middleware';

function buildTestApp() {
  const app = express();
  app.post('/limited', authRateLimiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/limited');
    expect(res.status).toBe(200);
  });

  it('blocks requests once the limit is exceeded', async () => {
    const app = buildTestApp();
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/limited');
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- rateLimit.middleware.test.ts`
Expected: FAIL — `Cannot find module '../middleware/rateLimit.middleware'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- rateLimit.middleware.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/rateLimit.middleware.ts backend/src/tests/rateLimit.middleware.test.ts
git commit -m "feat(auth): add rate limiting middleware for auth endpoints"
```

---

### Task 9: Auth controller + routes, wired into app (integration tests)

**Files:**
- Create: `backend/src/controllers/auth.controller.ts`
- Create: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/app.ts` (mount `/api/v1/auth` router and `errorHandler`)
- Test: `backend/src/tests/auth.routes.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8.
- Produces: `authRouter` (Express Router) exposing `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`; refresh token travels as an httpOnly cookie named `refreshToken`; access token is returned in the JSON body as `accessToken`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/auth.routes.test.ts
import request from 'supertest';
import { app } from '../app';

const validUser = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'longenough1' };

describe('Auth routes', () => {
  it('registers a new user and sets a refresh-token cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('rejects duplicate registration with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app).post('/api/v1/auth/register').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects login with invalid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('refreshes the access token using the refresh cookie', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const cookie = register.headers['set-cookie'][0];
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns the current user from /me when authenticated', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const token = register.body.data.accessToken;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(validUser.email);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs out, invalidating the refresh cookie for future refreshes', async () => {
    const register = await request(app).post('/api/v1/auth/register').send(validUser);
    const cookie = register.headers['set-cookie'][0];
    const token = register.body.data.accessToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- auth.routes.test.ts`
Expected: FAIL — route `/api/v1/auth/register` not mounted (404), since `auth.routes.ts`/`auth.controller.ts` don't exist yet and the router isn't wired into `app.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/controllers/auth.controller.ts
import { Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} from '../services/auth.service';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types/auth.types';
import { UserModel } from '../models/User.model';
import { AppError } from '../utils/AppError';

const REFRESH_COOKIE_NAME = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function toPublicUser(user: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export async function register(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await registerUser(req.body);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
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
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
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
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
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
    if (req.user) {
      await logoutUser(req.user.sub);
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
```

```ts
// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { authenticate } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authRateLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.get('/me', authenticate, authController.me);
```

```ts
// backend/src/app.ts  (modify: add imports + mount router + error handler at the end)
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler.middleware';

export const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);

app.use(errorHandler);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- auth.routes.test.ts`
Expected: PASS (all 8 tests). Then run the full suite: `npm test` — expect all prior test files (health, user.model, jwt, errorHandler, validate.middleware, auth.service, auth.middleware, rateLimit.middleware, auth.routes) green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/auth.controller.ts backend/src/routes/auth.routes.ts backend/src/app.ts backend/src/tests/auth.routes.test.ts
git commit -m "feat(auth): wire auth controller and routes into the app with full integration tests"
```

---

### Task 10: Frontend scaffolding (Vite + React + TS + React Bootstrap + Router)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`

**Interfaces:**
- Produces: a running Vite dev server (`npm run dev`) rendering a placeholder `App` component, with `react-router-dom`, `bootstrap`, `react-bootstrap`, and `axios` installed as dependencies, ready for Task 11–13 to build on.

This task is scaffolding/config (no new business logic), so it is the TDD exception noted in the test-driven-development skill; verification is "dev server starts and renders" rather than a unit test.

- [ ] **Step 1: Create package.json**

```json
// frontend/package.json
{
  "name": "mern-blog-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "bootstrap": "^5.3.3",
    "react": "^18.3.1",
    "react-bootstrap": "^2.10.4",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.25.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Create tsconfig and vite config**

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// frontend/tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

```html
<!-- frontend/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MERN Blog</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```
# frontend/.gitignore
node_modules
dist
.env
```

```
# frontend/.env.example
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

```tsx
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```tsx
// frontend/src/App.tsx
function App() {
  return <div className="container mt-4">MERN Blog — setting up Module 1</div>;
}

export default App;
```

- [ ] **Step 3: Verify the dev server runs**

Run: `cd frontend && npm install && npm run dev` (then stop it — confirm no startup errors, page renders the placeholder text). Also run `npm run lint` to confirm the TypeScript config compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/.env.example frontend/.gitignore
git commit -m "chore(frontend): scaffold Vite+React+TS frontend with Bootstrap and router deps"
```

---

### Task 11: Axios instance with refresh-on-401 + Auth API wrappers + AuthContext

**Files:**
- Create: `frontend/src/types/auth.types.ts`
- Create: `frontend/src/api/axios.ts`
- Create: `frontend/src/api/auth.api.ts`
- Create: `frontend/src/context/AuthContext.tsx`

**Interfaces:**
- Produces: `User` type (`id`, `name`, `email`, `role`); `apiClient` (Axios instance, `withCredentials: true`, base URL from `VITE_API_BASE_URL`) with: a request interceptor attaching `Authorization: Bearer <accessToken>` from an in-memory module variable, and a response interceptor that on a 401 (once per request) calls `POST /auth/refresh`, stores the new access token, and retries the original request — on refresh failure it clears the in-memory token and rejects.
- `authApi.register(input)`, `authApi.login(input)`, `authApi.logout()`, `authApi.me()` — thin wrappers returning typed data.
- `AuthProvider` + `useAuth()` hook exposing `{ user, loading, login, register, logout }`; on mount, `AuthProvider` calls `authApi.me()` (which itself triggers a silent refresh via the interceptor if no in-memory access token exists yet, since the browser still has the httpOnly refresh cookie from a previous session) to restore the session, swallowing failure as "logged out".

This task is primarily wiring and has no isolated unit-testable logic without a browser/mock-server harness; it is verified end-to-end manually in Task 13 together with the Login/Register pages and routes. Per the TDD skill's "ask your human partner" exception for config/glue code with no meaningful unit boundary, this task is implemented directly and exercised through the Task 13 manual verification plus the Task 9 backend integration tests it calls against.

- [ ] **Step 1: Write the types and API client**

```ts
// frontend/src/types/auth.types.ts
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
```

```ts
// frontend/src/api/axios.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient = axios.create({ baseURL, withCredentials: true });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshRes = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = refreshRes.data.data.accessToken as string;
        setAccessToken(newToken);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```

```ts
// frontend/src/api/auth.api.ts
import { apiClient, setAccessToken } from './axios';
import { User, RegisterInput, LoginInput } from '../types/auth.types';

interface AuthResponseData {
  user: User;
  accessToken: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<User> {
    const res = await apiClient.post<{ data: AuthResponseData }>('/auth/register', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data.user;
  },
  async login(input: LoginInput): Promise<User> {
    const res = await apiClient.post<{ data: AuthResponseData }>('/auth/login', input);
    setAccessToken(res.data.data.accessToken);
    return res.data.data.user;
  },
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
  },
  async me(): Promise<User> {
    const res = await apiClient.get<{ data: User }>('/auth/me');
    return res.data.data;
  },
};
```

```tsx
// frontend/src/context/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User, RegisterInput, LoginInput } from '../types/auth.types';
import { authApi } from '../api/auth.api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setError(null);
    try {
      const loggedInUser = await authApi.login(input);
      setUser(loggedInUser);
    } catch (err) {
      setError('Invalid email or password');
      throw err;
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setError(null);
    try {
      const registeredUser = await authApi.register(input);
      setUser(registeredUser);
    } catch (err) {
      setError('Registration failed. The email may already be in use.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/auth.types.ts frontend/src/api/axios.ts frontend/src/api/auth.api.ts frontend/src/context/AuthContext.tsx
git commit -m "feat(frontend): add Axios client with refresh-on-401 and AuthContext"
```

---

### Task 12: Login/Register pages + ProtectedRoute/AdminRoute + App wiring

**Files:**
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/components/AdminRoute.tsx`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Register.tsx`
- Create: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../context/AuthContext`.
- Produces: `<ProtectedRoute>` / `<AdminRoute>` wrapper components rendering `<Outlet />` when authorized, redirecting to `/login` (or `/` for non-admins) otherwise, showing a Bootstrap spinner while `loading`.

- [ ] **Step 1: Write the route guards**

```tsx
// frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
```

```tsx
// frontend/src/components/AdminRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return <Outlet />;
}
```

- [ ] **Step 2: Write Login and Register pages**

```tsx
// frontend/src/pages/Login.tsx
import { useState, FormEvent } from 'react';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch {
      setFormError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="mt-5" style={{ maxWidth: 420 }}>
      <Card>
        <Card.Body>
          <Card.Title>Login</Card.Title>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Login'}
            </Button>
          </Form>
          <div className="mt-3">
            Don&apos;t have an account? <Link to="/register">Register</Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
```

```tsx
// frontend/src/pages/Register.tsx
import { useState, FormEvent } from 'react';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/');
    } catch {
      setFormError('Registration failed. The email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="mt-5" style={{ maxWidth: 420 }}>
      <Card>
        <Card.Body>
          <Card.Title>Register</Card.Title>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </Form.Group>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register'}
            </Button>
          </Form>
          <div className="mt-3">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
```

```tsx
// frontend/src/pages/Home.tsx
import { Container } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <Container className="mt-4">
      <h2>Welcome{user ? `, ${user.name}` : ''}</h2>
      {user && (
        <>
          <p>Role: {user.role}</p>
          <button className="btn btn-outline-secondary" onClick={() => logout()}>
            Logout
          </button>
        </>
      )}
    </Container>
  );
}
```

- [ ] **Step 3: Wire routes in App.tsx**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

function AdminPlaceholder() {
  return <div className="container mt-4">Admin area (built in Module 4)</div>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPlaceholder />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProtectedRoute.tsx frontend/src/components/AdminRoute.tsx frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx frontend/src/pages/Home.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add Login/Register pages, route guards, and router wiring"
```

---

### Task 13: End-to-end manual verification

**Files:** none created; this task runs both servers together and exercises the flows by hand (or via `curl`/browser), per the project-requirements.md interaction rule requiring manual verification before a module is considered complete.

- [ ] **Step 1: Start MongoDB locally (or point `MONGO_URI` at an existing instance), then start the backend**

Run: `cd backend && npm run build && npm run dev` (or `npx ts-node src/server.ts` in dev) — confirm `Server listening on port 5000` and no connection errors.

- [ ] **Step 2: Start the frontend**

Run: `cd frontend && npm run dev` — open `http://localhost:5173`.

- [ ] **Step 3: Verify the full register → login → protected → admin → refresh → logout flow**

1. Visit `/` while logged out → redirected to `/login`.
2. Register a new user via the UI → redirected to `/` showing "Welcome, <name>" and `Role: user`.
3. Visit `/admin` as this regular user → redirected to `/` (frontend-level block).
4. Confirm server-side RBAC independently: `curl -H "Authorization: Bearer <accessToken from devtools/network tab>" http://localhost:5000/api/v1/auth/me` returns the user; then hit a hypothetical admin-only backend route (or temporarily `curl` `POST /api/v1/auth/logout` from a second regular-user token against an admin-gated test route) to confirm 403 — the `requireRole` integration test from Task 7 already proves this at the HTTP layer, so this step is a spot-check, not new coverage.
5. In MongoDB, manually flip that user's `role` to `admin` (`db.users.updateOne({email:...}, {$set:{role:'admin'}})`), log out and back in, then visit `/admin` → now renders the placeholder page.
6. Log out → cookie cleared, redirected/blocked from `/` again.
7. Confirm refresh works: log in, wait past a short-lived access token (or temporarily set `JWT_ACCESS_EXPIRES_IN=10s` in `.env` for this check), then perform any authenticated action — the Axios interceptor should transparently refresh and retry without the user noticing a failure.

- [ ] **Step 4: Record results**

Note down which of the above passed, any deviations, and revert any temporary `.env` changes (e.g. the 10s access-token expiry) made for testing.

---

## Post-Plan Note

This plan covers Module 1 only, per `project-requirements.md`'s module-by-module process and its interaction rule ("At the beginning of each module... summarize what was implemented... then STOP and wait for instruction to begin the next module"). Modules 2–8 (Posts, Comments, Admin, Social Auth, Security Review, Testing, Documentation) each get their own plan, written after Module 1 is confirmed complete and working end-to-end.
