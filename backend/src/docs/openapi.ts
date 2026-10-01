/* OpenAPI 3.0 description of the REST API, served by Swagger UI at /api/docs.
 * A test (docs.test.ts) compares this file with the real Express routes so it cannot drift. */

type Json = Record<string, unknown>;

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Json): Json => ({ 'application/json': { schema } });
const envelope = (data: Json): Json => ({
  type: 'object',
  properties: { success: { type: 'boolean', example: true }, data },
});

const idParam = (name = 'id', description = 'MongoDB ObjectId'): Json => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
});
const pageParams: Json[] = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
];

const errorResponse = (description: string): Json => ({ description, content: json(ref('Error')) });
const std = {
  400: errorResponse('Validation failed or malformed id'),
  401: errorResponse('Missing, invalid or expired access token'),
  403: errorResponse('Not allowed to perform this action'),
  404: errorResponse('Resource not found'),
};
const pick = (...codes: Array<keyof typeof std>): Json =>
  Object.fromEntries(codes.map((code) => [String(code), std[code]]));

const ok = (description: string, data: Json): Json => ({ description, content: json(envelope(data)) });
const okEmpty = (description = 'Success'): Json => ({
  description,
  content: json(envelope({ type: 'object', nullable: true, example: null })),
});

const secured = [{ bearerAuth: [] }];
const body = (schema: Json): Json => ({ required: true, content: json(schema) });

const paginated = (key: string, itemSchema: string): Json => ({
  type: 'object',
  properties: { [key]: { type: 'array', items: ref(itemSchema) }, pagination: ref('Pagination') },
});
const paginatedItems = (itemSchema: string): Json => ({
  type: 'object',
  properties: { items: { type: 'array', items: ref(itemSchema) }, pagination: ref('Pagination') },
});

export const openApiSpec: Json = {
  openapi: '3.0.3',
  info: {
    title: 'MERN Blog API',
    version: '1.0.0',
    description: [
      'REST API for the MERN blog: authentication, posts, comments, notifications and an admin panel.',
      '',
      '**Authenticating in this page:** call `POST /auth/login`, copy the `accessToken` from the response, click **Authorize** and paste it (no `Bearer ` prefix). Access tokens last 15 minutes; `POST /auth/refresh` issues a new one from the `httpOnly` refresh cookie.',
      '',
      'Every response is `{ success: true, data }` or `{ success: false, error: { code, message } }`.',
      '',
      '**Real-time:** Socket.io runs on the same server. Connect with `io(origin, { auth: { token: <accessToken> } })` and listen for the `notification` event (same shape as the `Notification` schema).',
    ].join('\n'),
  },
  servers: [{ url: '/api/v1', description: 'This server' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Registration, login, tokens and social login' },
    { name: 'Posts' },
    { name: 'Comments' },
    { name: 'Notifications' },
    { name: 'Admin', description: 'Requires an account with the admin role' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Title must be at least 3 characters' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
      },
      Author: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          slug: { type: 'string', example: 'my-first-post' },
          author: ref('Author'),
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          postId: { type: 'string' },
          content: { type: 'string' },
          author: ref('Author'),
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['comment', 'moderation'] },
          message: { type: 'string' },
          link: { type: 'string', example: '/posts/my-first-post' },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DashboardStats: {
        type: 'object',
        properties: { users: { type: 'integer' }, posts: { type: 'integer' }, comments: { type: 'integer' } },
      },
      AdminUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminPost: {
        allOf: [ref('Post'), { type: 'object', properties: { isDeleted: { type: 'boolean' } } }],
      },
      AdminComment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          author: ref('Author'),
          post: {
            type: 'object',
            properties: { id: { type: 'string' }, title: { type: 'string' }, slug: { type: 'string' } },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ActivityEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { type: 'string', example: 'POST_CREATED' },
          method: { type: 'string', example: 'POST' },
          path: { type: 'string', example: '/api/v1/posts' },
          user: { allOf: [ref('Author')], nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: { user: ref('User'), accessToken: { type: 'string' } },
      },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['Health'], summary: 'Liveness check', responses: { 200: { description: 'API is up' } } },
    },

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description: 'Always creates a regular user. Rate limited to 10 requests per 15 minutes per IP. Sets the refresh cookie.',
        requestBody: body({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100, example: 'Ada Lovelace' },
            email: { type: 'string', format: 'email', example: 'ada@example.com' },
            password: { type: 'string', minLength: 8, maxLength: 72, example: 'a-long-password' },
          },
        }),
        responses: {
          201: ok('Account created', ref('AuthResult')),
          400: std[400],
          409: errorResponse('Email already in use (DUPLICATE_EMAIL)'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description: 'Rate limited like registration. Sets the `refreshToken` httpOnly cookie.',
        requestBody: body({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        }),
        responses: {
          200: ok('Logged in', ref('AuthResult')),
          400: std[400],
          401: errorResponse('Invalid email or password (INVALID_CREDENTIALS)'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Get a new access token',
        description: 'Uses the `refreshToken` httpOnly cookie, which is also renewed.',
        responses: {
          200: ok('New access token', { type: 'object', properties: { accessToken: { type: 'string' } } }),
          401: errorResponse('Cookie missing, expired or revoked (INVALID_REFRESH_TOKEN)'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out',
        description:
          'Revokes the refresh tokens and clears the cookie. Works with a valid access token, or with only the refresh cookie when the access token has expired.',
        responses: { 200: okEmpty('Logged out') },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: secured,
        responses: { 200: ok('The signed-in user', ref('User')), ...pick(401, 404) },
      },
    },
    '/auth/providers': {
      get: {
        tags: ['Auth'],
        summary: 'Which social logins are configured',
        responses: {
          200: ok('Provider availability', {
            type: 'object',
            properties: { google: { type: 'boolean' }, facebook: { type: 'boolean' } },
          }),
        },
      },
    },
    '/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Start Google login',
        description: 'Redirects to Google. Open it in a browser, not from Swagger.',
        responses: { 302: { description: 'Redirect to Google' }, 503: errorResponse('Google login is not configured') },
      },
    },
    '/auth/google/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Google OAuth callback',
        description: 'Verifies the state cookie, signs the user in and redirects to the web app.',
        responses: { 302: { description: 'Redirect to the web app (or /login?error=...)' }, 503: errorResponse('Not configured') },
      },
    },
    '/auth/facebook': {
      get: {
        tags: ['Auth'],
        summary: 'Start Facebook login',
        description: 'Redirects to Facebook. Open it in a browser, not from Swagger.',
        responses: { 302: { description: 'Redirect to Facebook' }, 503: errorResponse('Facebook login is not configured') },
      },
    },
    '/auth/facebook/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Facebook OAuth callback',
        responses: { 302: { description: 'Redirect to the web app (or /login?error=...)' }, 503: errorResponse('Not configured') },
      },
    },

    '/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List posts',
        description: 'Newest first. Soft-deleted posts are never returned.',
        parameters: pageParams,
        responses: { 200: ok('A page of posts', paginated('posts', 'Post')) },
      },
      post: {
        tags: ['Posts'],
        summary: 'Create a post',
        description: 'A unique URL slug is generated from the title.',
        security: secured,
        requestBody: body({
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 200, example: 'My first post' },
            content: { type: 'string', minLength: 10, example: 'Some interesting content for the post.' },
          },
        }),
        responses: { 201: ok('Created', ref('Post')), ...pick(400, 401) },
      },
    },
    '/posts/mine': {
      get: {
        tags: ['Posts'],
        summary: 'List my posts',
        security: secured,
        parameters: pageParams,
        responses: { 200: ok('A page of the caller\'s posts', paginated('posts', 'Post')), ...pick(401) },
      },
    },
    '/posts/{slug}': {
      get: {
        tags: ['Posts'],
        summary: 'Get a post by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string', example: 'my-first-post' } }],
        responses: { 200: ok('The post', ref('Post')), ...pick(404) },
      },
    },
    '/posts/{id}': {
      patch: {
        tags: ['Posts'],
        summary: 'Update a post',
        description: 'Owner or admin. Provide at least one of title or content.',
        security: secured,
        parameters: [idParam()],
        requestBody: body({
          type: 'object',
          properties: { title: { type: 'string', minLength: 3, maxLength: 200 }, content: { type: 'string', minLength: 10 } },
        }),
        responses: { 200: ok('Updated', ref('Post')), ...pick(400, 401, 403, 404) },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Delete a post (soft delete)',
        description: 'Owner or admin. The post is flagged `isDeleted` and hidden, not removed. An admin deleting someone else\'s post notifies the author.',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Deleted'), ...pick(400, 401, 403, 404) },
      },
    },

    '/posts/{postId}/comments': {
      get: {
        tags: ['Comments'],
        summary: 'List comments on a post',
        parameters: [idParam('postId', 'Post id'), ...pageParams],
        responses: { 200: ok('A page of comments, newest first', paginated('comments', 'Comment')), ...pick(400, 404) },
      },
      post: {
        tags: ['Comments'],
        summary: 'Comment on a post',
        description: 'Notifies the post author in real time (unless it is their own post).',
        security: secured,
        parameters: [idParam('postId', 'Post id')],
        requestBody: body({
          type: 'object',
          required: ['content'],
          properties: { content: { type: 'string', minLength: 1, maxLength: 2000, example: 'Great post!' } },
        }),
        responses: { 201: ok('Created', ref('Comment')), ...pick(400, 401, 404) },
      },
    },
    '/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Edit a comment',
        description: 'Owner or admin.',
        security: secured,
        parameters: [idParam()],
        requestBody: body({
          type: 'object',
          required: ['content'],
          properties: { content: { type: 'string', minLength: 1, maxLength: 2000 } },
        }),
        responses: { 200: ok('Updated', ref('Comment')), ...pick(400, 401, 403, 404) },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment',
        description: 'Owner or admin. An admin deleting someone else\'s comment notifies its author.',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Deleted'), ...pick(400, 401, 403, 404) },
      },
    },

    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List my notifications',
        security: secured,
        parameters: pageParams,
        responses: {
          200: ok('Notifications and the unread count', {
            type: 'object',
            properties: {
              notifications: { type: 'array', items: ref('Notification') },
              unreadCount: { type: 'integer' },
              pagination: ref('Pagination'),
            },
          }),
          ...pick(401),
        },
      },
    },
    '/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark all my notifications as read',
        security: secured,
        responses: { 200: okEmpty(), ...pick(401) },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark one of my notifications as read',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty(), ...pick(400, 401, 404) },
      },
    },

    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Dashboard totals',
        security: secured,
        responses: { 200: ok('Totals (posts exclude soft-deleted)', ref('DashboardStats')), ...pick(401, 403) },
      },
    },
    '/admin/activity': {
      get: {
        tags: ['Admin'],
        summary: 'Recent user activity log',
        security: secured,
        parameters: pageParams,
        responses: { 200: ok('A page of activity', paginatedItems('ActivityEntry')), ...pick(401, 403) },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        security: secured,
        parameters: [...pageParams, { name: 'q', in: 'query', description: 'Search name or email', schema: { type: 'string' } }],
        responses: { 200: ok('A page of users', paginatedItems('AdminUser')), ...pick(401, 403) },
      },
    },
    '/admin/users/{id}/role': {
      patch: {
        tags: ['Admin'],
        summary: 'Change a user\'s role',
        description: 'You cannot change your own role. The user\'s refresh tokens are revoked so the role applies at next sign-in.',
        security: secured,
        parameters: [idParam()],
        requestBody: body({
          type: 'object',
          required: ['role'],
          properties: { role: { type: 'string', enum: ['user', 'admin'] } },
        }),
        responses: { 200: ok('Updated user', ref('AdminUser')), ...pick(400, 401, 403, 404) },
      },
    },
    '/admin/users/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete a user',
        description: 'Hides the user\'s posts (soft delete) and removes their comments. You cannot delete yourself.',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Deleted'), ...pick(400, 401, 403, 404) },
      },
    },
    '/admin/posts': {
      get: {
        tags: ['Admin'],
        summary: 'List all posts',
        security: secured,
        parameters: [
          ...pageParams,
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'deleted', 'all'], default: 'active' } },
        ],
        responses: { 200: ok('A page of posts', paginatedItems('AdminPost')), ...pick(401, 403) },
      },
    },
    '/admin/posts/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete any post (soft delete)',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Deleted'), ...pick(400, 401, 403, 404) },
      },
    },
    '/admin/posts/{id}/restore': {
      patch: {
        tags: ['Admin'],
        summary: 'Restore a soft-deleted post',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Restored'), ...pick(400, 401, 403, 404) },
      },
    },
    '/admin/comments': {
      get: {
        tags: ['Admin'],
        summary: 'List all comments',
        security: secured,
        parameters: pageParams,
        responses: { 200: ok('A page of comments', paginatedItems('AdminComment')), ...pick(401, 403) },
      },
    },
    '/admin/comments/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Delete any comment',
        security: secured,
        parameters: [idParam()],
        responses: { 200: okEmpty('Deleted'), ...pick(400, 401, 403, 404) },
      },
    },
  },
};
