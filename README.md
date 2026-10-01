# MERN Blog

A blog platform built with MongoDB, Express, React and Node.js (TypeScript on both sides). It has JWT authentication with refresh tokens, Google/Facebook login, role-based access (admin / user), posts with slugs and soft delete, comments, an admin panel, activity logging, and a Hashnode-inspired UI with dark mode.

## Features

| Area | What it does |
|---|---|
| **Authentication** | Register, login, logout. Short-lived access JWT (15 min, kept in memory) plus a refresh JWT in an `httpOnly` cookie. bcrypt password hashing. Refresh tokens are revoked on logout and on role change. Login/register are rate limited. |
| **Social login** | Google and Facebook via OAuth 2.0 (Passport). Optional: if credentials are not set the buttons are hidden and email/password login is unaffected. |
| **Roles (RBAC)** | `admin` and `user`, enforced by Express middleware on the API (not just the UI). Admin routes also re-check the role in the database, so a demoted admin loses access immediately. |
| **Posts** | CRUD, URL-friendly unique slugs, soft delete (`isDeleted`/`deletedAt`), pagination, Zod validation. Users manage their own posts; admins manage all. |
| **Comments** | CRUD linked to posts and users (Mongoose references), pagination. Users manage their own comments; admins manage all. |
| **Admin panel** | Dashboard (total users / posts / comments), user management (search, change role, delete), post management (filter, delete, restore), comment moderation, activity log. |
| **Real-time notifications** | Socket.io pushes events live: you are notified when someone comments on your post, and when an admin removes your post or comment. Notifications are also stored, so offline users see them later in the bell menu (unread badge, mark as read, mark all read) and a toast appears for live ones. |
| **Activity logging** | A reusable middleware records successful actions (login, post/comment create/update/delete, admin actions) to the database; admins can browse them. |
| **Performance** | Indexes on every query path, clamped pagination everywhere, `populate` limited to the author's name. |
| **Frontend** | React 18 functional components and hooks, Context API for auth, protected and admin-only routes, React Bootstrap, light/dark theme. |

## Tech stack

- **Backend:** Node.js, Express 4, TypeScript, Mongoose 8, Zod, jsonwebtoken, bcryptjs, Passport (Google, Facebook), Socket.io, helmet, cors, express-rate-limit, morgan
- **Frontend:** React 18, Vite, TypeScript, React Router 6, React Bootstrap, Axios, socket.io-client
- **Testing:** Jest, Supertest, mongodb-memory-server (no external database needed for tests)

## Project structure

```
backend/src
  config/        env parsing, DB connection, Passport strategies, Socket.io server
  controllers/   HTTP layer: parse request, call a service, shape the response
  services/      business logic (auth, posts, comments, admin, oauth, notifications)
  models/        Mongoose schemas (User, Post, Comment, ActivityLog, Notification)
  routes/        Express routers, one per resource, mounted under /api/v1
  middleware/    authenticate, RBAC, validation, rate limiting, activity logger, error handler
  validators/    Zod schemas
  utils/         JWT, slug, pagination, AppError
  docs/          OpenAPI spec served by Swagger UI
  scripts/       createAdmin
  tests/         Jest + Supertest suites
frontend/src
  api/           Axios client (auto-refresh on 401) and API wrappers
  context/       AuthContext
  components/    Layout, AdminLayout, route guards, PostCard, CommentSection, ...
  pages/         Home feed, post pages, dashboard, login/register, admin/*
```

Request flow: `route -> middleware (auth, validation, logging) -> controller -> service -> model`. Errors thrown anywhere reach one central error handler that returns a consistent shape.

## Prerequisites

- Node.js 18 or newer
- A MongoDB instance (local `mongod` or MongoDB Atlas)

## Installation

```bash
git clone <repo-url>
cd <repo>

cd backend  && npm install
cd ../frontend && npm install
```

## Environment setup

**Backend** - copy `backend/.env.example` to `backend/.env` and fill it in:

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/mern_blog` |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (must differ from the access secret) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Lifetimes, default `15m` / `7d` |
| `CLIENT_URL` | Frontend origin, used for CORS and OAuth redirects (e.g. `http://localhost:5173`) |
| `API_URL` | Public URL of this API, used to build OAuth callback URLs (default `http://localhost:<PORT>`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, enables Google login |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Optional, enables Facebook login |

Generate strong secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. In production the server refuses to start if the secrets are shorter than 32 characters, identical, or still placeholders. `.env` files are git-ignored.

**Frontend** - copy `frontend/.env.example` to `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## Running the app

```bash
# terminal 1
cd backend && npm run dev          # http://localhost:5000

# terminal 2
cd frontend && npm run dev         # http://localhost:5173
```

Make sure `CLIENT_URL` in `backend/.env` matches the port Vite prints (5173 by default).

Production build: `npm run build` in each folder; `npm start` in `backend` serves the compiled API.

## Admin setup

Registration always creates a regular user. Create (or promote) an admin from the command line:

```bash
cd backend
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123 ADMIN_NAME="Site Admin" npm run seed:admin
```

On PowerShell: `$env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="ChangeMe123"; npm run seed:admin`. If the email already exists the account is promoted to admin. Log in normally; an **Admin** link appears in the sidebar.

## OAuth setup (optional)

The app works without this. To enable social login:

**Google**
1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an *OAuth client ID* of type *Web application*.
2. Add the authorized redirect URI `http://localhost:5000/api/v1/auth/google/callback` (use your `API_URL` in production).
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**Facebook**
1. In [Meta for Developers](https://developers.facebook.com/apps) create an app and add *Facebook Login*.
2. Add the valid OAuth redirect URI `http://localhost:5000/api/v1/auth/facebook/callback`.
3. Put the app ID and secret in `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.

**Facebook needs HTTPS (ngrok).** Facebook rejects `localhost`, so test it through a tunnel. Serve the *whole* app from one public URL so login cookies stay on one host:

1. Start the backend and `npm run dev` in `frontend`, then run `ngrok http 5173` (use your Vite port). Copy the `https://<id>.ngrok-free.app` URL.
2. `frontend/.env.local`: `VITE_API_BASE_URL=/api/v1` (the Vite dev server proxies `/api` and `/socket.io` to the backend).
3. `backend/.env`: `API_URL=https://<id>.ngrok-free.app` and `CLIENT_URL=https://<id>.ngrok-free.app`. Restart both servers.
4. Meta app: App settings > Basic > **App domains** `<id>.ngrok-free.app`, add a **Website** platform with that Site URL, and set Facebook Login > **Valid OAuth Redirect URIs** to `https://<id>.ngrok-free.app/api/v1/auth/facebook/callback`. Add the `email` permission under Use cases > Customize.
5. Open the ngrok URL (not localhost) in the browser. Free ngrok URLs change on every restart, so repeat steps 3-4 when it does.

Restart the backend. The "Continue with Google/Facebook" buttons on the login and register pages are always shown, greyed out until that provider is configured, and become active once its credentials are set. How it works: the API redirects to the provider with a random `state` stored in a short-lived cookie (blocks login CSRF); after the callback the user is found or created (linked by email if an account already exists), a refresh cookie is set, and the browser returns to the app, which exchanges it for an access token. Accounts created through a provider have no password.

## API documentation (Swagger)

Interactive docs are served by the backend:

- **Swagger UI:** `http://localhost:5000/api/docs` (every endpoint, request/response schemas, and a **Try it out** button)
- **Raw OpenAPI 3 JSON:** `http://localhost:5000/api/docs.json` (import into Postman, Insomnia, or a client generator)

To call protected endpoints from Swagger: run `POST /auth/login` (or register) with **Try it out**, copy the `accessToken` from the response, click **Authorize**, and paste it (without the `Bearer ` prefix). Access tokens last 15 minutes. The spec lives in `backend/src/docs/openapi.ts`, and a test (`docs.test.ts`) fails if it ever disagrees with the real Express routes, so the docs cannot silently go stale.

## API overview

Base URL `/api/v1`. Every response is `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }`. Paginated endpoints accept `?page=` and `?limit=` (max 50).

**Auth**

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public, rate limited | `{ name, email, password }` returns user + access token, sets refresh cookie |
| POST | `/auth/login` | public, rate limited | `{ email, password }` |
| POST | `/auth/refresh` | refresh cookie | returns a new access token |
| POST | `/auth/logout` | cookie or bearer | revokes refresh tokens, clears cookie |
| GET | `/auth/me` | user | current user |
| GET | `/auth/providers` | public | which social logins are configured |
| GET | `/auth/google`, `/auth/facebook` | public | start OAuth (`503` if not configured) |
| GET | `/auth/google/callback`, `/auth/facebook/callback` | provider | finishes OAuth and redirects to the app |

**Posts**

| Method | Path | Access |
|---|---|---|
| GET | `/posts` | public, newest first, excludes deleted |
| GET | `/posts/:slug` | public |
| GET | `/posts/mine` | user |
| POST | `/posts` | user, `{ title, content }` |
| PATCH | `/posts/:id` | owner or admin |
| DELETE | `/posts/:id` | owner or admin (soft delete) |

**Comments**

| Method | Path | Access |
|---|---|---|
| GET | `/posts/:postId/comments` | public |
| POST | `/posts/:postId/comments` | user, `{ content }` |
| PATCH | `/comments/:id` | owner or admin |
| DELETE | `/comments/:id` | owner or admin |

**Notifications** (user; also pushed live over Socket.io)

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | `{ notifications, unreadCount, pagination }`, newest first |
| PATCH | `/notifications/:id/read` | mark one as read (only your own) |
| POST | `/notifications/read-all` | mark all as read |

**Real-time (Socket.io)** - the API serves Socket.io on the same port. Connect with `io(API_ORIGIN, { auth: { token: <access token> } })`; connections without a valid access token are rejected (`UNAUTHORIZED`). Each user joins a private room and receives a `notification` event (`{ id, type, message, link, read, createdAt }`) with `type` of `comment` or `moderation`. The React app handles reconnection and token renewal automatically.

**Admin** (all require an admin account)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | `{ users, posts, comments }` |
| GET | `/admin/users` | `?q=` searches name/email |
| PATCH | `/admin/users/:id/role` | `{ role: "admin" \| "user" }`; cannot change your own |
| DELETE | `/admin/users/:id` | hides their posts, removes their comments; cannot delete yourself |
| GET | `/admin/posts` | `?status=active\|deleted\|all` |
| DELETE | `/admin/posts/:id` | soft delete |
| PATCH | `/admin/posts/:id/restore` | undo a soft delete |
| GET | `/admin/comments` | includes the parent post's title |
| DELETE | `/admin/comments/:id` | |
| GET | `/admin/activity` | recent activity log |

Common error codes: `VALIDATION_ERROR` (400), `INVALID_ID` (400), `UNAUTHORIZED` (401), `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `POST_NOT_FOUND` / `COMMENT_NOT_FOUND` / `USER_NOT_FOUND` (404), `DUPLICATE_EMAIL` (409), `PAYLOAD_TOO_LARGE` (413), `TOO_MANY_REQUESTS` (429).

## Security notes

- Passwords hashed with bcrypt; login does a dummy comparison for unknown emails so response time does not reveal which emails exist.
- JWTs pin `HS256`; access and refresh tokens use different secrets; refresh tokens carry a version that is bumped on logout and role changes.
- Refresh token is `httpOnly`, `SameSite=Lax`, `Secure` in production, scoped to `/api/v1/auth`.
- Zod validates every body (so operator objects like `{ "$ne": null }` are rejected); `q`/`status` query values are type-checked and regex input is escaped; ids are validated before reaching Mongoose; JSON bodies are capped at 100 KB.
- helmet, CORS limited to `CLIENT_URL`, per-IP rate limits (10 per 15 min on login/register, 300 per minute on the API).
- Responses never include password hashes; unexpected errors return a generic 500 and are not leaked.

## Testing

```bash
cd backend
npm test                # all suites (uses an in-memory MongoDB, nothing to install)
npm run test:coverage   # with coverage report
npm run lint            # type check
cd ../frontend
npm run lint            # type check
npm run build
```

Suites cover: auth (register, duplicate, login, invalid credentials, refresh, logout), JWT handling, RBAC, posts (CRUD, ownership, admin override, soft delete, slugs, pagination), comments (CRUD, ownership, admin override, deleted-post behaviour), admin endpoints, activity logging, OAuth (find/create/link, state check, success and failure callbacks), notifications (REST plus a real Socket.io client: auth rejection, live push, no cross-user leakage), error mapping, the Swagger spec versus the real routes, and security regressions (algorithm confusion, NoSQL injection, oversized bodies, demoted admins).

## Demo script (5-10 minutes)

1. **Register** a new user on `/register`; note you land on the feed. Toggle dark mode.
2. **Write a post** (top bar > Write). Open it: the slug appears in the URL.
3. **Comment** on it, edit the comment, delete it (confirmation modal).
4. Open **Dashboard** and **My posts**; edit and delete a post.
5. Show that a regular user visiting `/admin` is redirected.
6. **Log out**, then log in as the admin created with `seed:admin`.
7. **Admin panel:** dashboard totals, users (search, promote/demote, delete), posts (filter *Deleted*, restore), comments (moderate), activity log.
8. **Real-time:** log in as two users in two browsers (or one normal and one private window); comment on the first user's post and watch the toast and bell badge appear instantly. Delete a comment as admin and the commenter gets a moderation notice.
9. Mention the architecture (routes > controllers > services > models), the test suite, and, if configured, social login.

## Known limitations

- Real-time notifications cover comments on your posts and admin moderation only; the comment list of the post you are viewing refreshes live, but other lists (feed, admin tables) update on reload.
- Refresh tokens are not rotated on each use; they are revoked as a group on logout or role change.
- Post content is plain text (no Markdown/rich text editor), and there are no tags or search for posts.
- Frontend has type checking and a production build in CI-style checks but no automated component tests; the UI was verified with a scripted browser run.
