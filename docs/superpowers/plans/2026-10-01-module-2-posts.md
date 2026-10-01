# Module 2 — Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, working, end-to-end Post module (backend + frontend) for the MERN blog system: full CRUD on blog posts with slugs, ownership enforcement, admin override, soft deletes, pagination, and the corresponding React UI (listing, details, create, edit, my-posts, delete confirmation).

**Architecture:** Same layered backend structure as Module 1 (model → validator → service → controller → routes), reusing Module 1's `authenticate`, `AppError`, `errorHandler`, and `validate` middleware. Ownership/admin-override logic lives in the service layer (it needs the post document to check `post.author` anyway, so a separate generic ownership middleware would just re-fetch the same document). Posts are soft-deleted (`isDeleted` + `deletedAt`), never physically removed, and every read path excludes soft-deleted posts by default. Frontend adds a Post API layer, list/detail/create/edit/my-posts pages, and a reusable delete-confirmation modal, all under the existing `AuthProvider`/router shell from Module 1.

**Tech Stack:** Same as Module 1 — Express, TypeScript, Mongoose, Zod, Jest, Supertest, mongodb-memory-server on the backend; React, TypeScript, React Router, React Bootstrap, Axios on the frontend. New library: `slugify` (already a backend dependency from Module 1's scaffold).

**Spec:** `D:\Projects\MERN Stack project\project-requirements.md` (Module 2 section) and `D:\Projects\MERN Stack project\MERN Stack Assignment.pdf` (section "3. Post Management" and section "9. Performance Optimization").

## Global Constraints

- Module-by-module: only Module 2 (Posts) is in scope. Do not touch Comments/Admin/Social Auth.
- Each post has Title, Content, Author, Timestamps (PDF §3).
- Validate request payloads using Zod (PDF §3) — reuse Module 1's `validate()` middleware and `AppError`/`errorHandler` shape.
- Generate a URL-friendly slug for each post (PDF §3) and it must be unique.
- Use MongoDB with Mongoose ODM (PDF §3).
- Implement soft deletes via an `isDeleted` flag / `deletedAt` field (PDF §3) — a soft-deleted post must never appear in list/detail reads, and attempting to fetch/edit/delete it again behaves as if it doesn't exist (404), not as a different kind of error.
- Regular users: create posts, edit/delete only their own posts. Admins: manage all posts (project-requirements.md Module 2 Rules). RBAC enforced at the API level (carried over from Module 1's constraint), not only the frontend.
- Optimize MongoDB queries using indexing and pagination; use population wisely to avoid unnecessary DB calls (PDF §9) — author population must project only safe fields (`name`), never the password hash or email.
- Frontend: functional components + hooks only, React Bootstrap UI, loading/error states on every data-fetching page (project-requirements.md Module 2 Frontend list).
- TDD: every unit of backend logic (model hook, slug util, service, controller) gets a failing test before implementation code.
- Centralized error shape `{ success: false, error: { code, message } }` (carried over from Module 1) applies to every new endpoint.

## Review Focus

- A regular user must not be able to edit or delete another user's post by guessing/forging a post ID in the URL — ownership must be enforced server-side on every mutating endpoint, not just hidden in the UI.
- A soft-deleted post must be completely invisible to normal reads (list, detail by slug, by id) for both the author and other users — a test must prove a deleted post 404s on every read path, not just disappears from the list.
- Slug collisions (two posts titled the same thing) must not crash with a raw Mongo duplicate-key error or silently overwrite another post's slug — each must get a distinct, deterministic slug.
- Pagination must not let a client request an unbounded page size (e.g. `limit=999999`) and pull the entire collection in one call — the limit must be clamped server-side.
- An admin must be able to edit/delete ANY user's post (not just their own), and this must be provably different code-path coverage from the "owner edits own post" case, not incidentally passing because the admin happens to also be the author in the test.

---

## File Structure

**Backend** (`backend/src/`):
- `models/Post.model.ts` — Post schema (title, content, author ref, slug, isDeleted, deletedAt) + indexes.
- `types/post.types.ts` — `IPost`, `CreatePostInput`, `UpdatePostInput`, `PaginationQuery`, `PaginatedPosts`.
- `validators/post.validator.ts` — Zod schemas for create/update/pagination query.
- `utils/slug.ts` — `generateUniqueSlug(title): Promise<string>`.
- `services/post.service.ts` — `createPost`, `listPosts`, `getPostBySlug`, `listMyPosts`, `updatePost`, `deletePost` (ownership + admin-override logic lives here).
- `controllers/post.controller.ts` — thin HTTP layer.
- `routes/post.routes.ts` — wires routes + middleware.
- `app.ts` — modified to mount `/api/v1/posts`.
- `tests/post.model.test.ts`, `tests/slug.test.ts`, `tests/post.service.test.ts`, `tests/post.routes.test.ts` — one file per unit above (validator gets covered via the service/route tests, same pattern as Module 1's `auth.validator` which had its own dedicated middleware test — here the Zod schemas are simple enough to be covered through the route integration tests, see Task 2).

**Frontend** (`frontend/src/`):
- `types/post.types.ts` — `Post`, `PaginatedPosts`, `CreatePostInput`, `UpdatePostInput`.
- `api/post.api.ts` — thin wrappers calling `/api/v1/posts/*`.
- `components/PostCard.tsx` — single post summary card.
- `components/DeleteConfirmModal.tsx` — reusable Bootstrap confirmation modal.
- `components/Pagination.tsx` — reusable pager control.
- `pages/PostList.tsx` — public post listing with pagination.
- `pages/PostDetails.tsx` — single post view by slug.
- `pages/CreatePost.tsx` — protected create form.
- `pages/EditPost.tsx` — protected edit form (ownership/admin checked server-side; frontend just hides the edit/delete affordances for non-owners/non-admins as a UX nicety).
- `pages/MyPosts.tsx` — protected "my posts" list with edit/delete actions.
- `App.tsx` — modified to wire the new routes.

---

### Task 1: Post model with slug, soft delete, and indexes

**Files:**
- Create: `backend/src/types/post.types.ts`
- Create: `backend/src/models/Post.model.ts`
- Test: `backend/src/tests/post.model.test.ts`

**Interfaces:**
- Consumes: nothing new (uses `mongoose` directly; references the `User` model by ObjectId, not by import).
- Produces: `IPost` interface (`_id`, `title`, `content`, `author` (ObjectId), `slug`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`); default export `PostModel` (Mongoose model named `'Post'`); `CreatePostInput { title: string; content: string }`; `UpdatePostInput { title?: string; content?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/post.model.test.ts
import mongoose from 'mongoose';
import { PostModel } from '../models/Post.model';

describe('Post model', () => {
  it('creates a post with required fields and sensible defaults', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const post = await PostModel.create({
      title: 'Hello World',
      content: 'This is my first post, long enough to pass validation.',
      author: authorId,
      slug: 'hello-world',
    });
    expect(post.title).toBe('Hello World');
    expect(post.author.toString()).toBe(authorId.toString());
    expect(post.isDeleted).toBe(false);
    expect(post.deletedAt).toBeNull();
    expect(post.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate slugs at the schema/index level', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({
      title: 'A',
      content: 'Content long enough to pass validation rules here.',
      author: authorId,
      slug: 'dup-slug',
    });
    await expect(
      PostModel.create({
        title: 'B',
        content: 'Different content but the same slug value as above.',
        author: authorId,
        slug: 'dup-slug',
      })
    ).rejects.toThrow();
  });

  it('requires title, content, author, and slug', async () => {
    await expect(PostModel.create({})).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- post.model.test.ts`
Expected: FAIL — `Cannot find module '../models/Post.model'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/types/post.types.ts
import { Types } from 'mongoose';

export interface CreatePostInput {
  title: string;
  content: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}

export interface PublicAuthor {
  id: string;
  name: string;
}

export interface PublicPost {
  id: string;
  title: string;
  content: string;
  slug: string;
  author: PublicAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedPosts {
  posts: PublicPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type { Types };
```

```ts
// backend/src/models/Post.model.ts
import { Schema, model, Document, Model, Types } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  author: Types.ObjectId;
  slug: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    content: { type: String, required: true, trim: true, minlength: 10 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ author: 1 });

export const PostModel: Model<IPost> = model<IPost>('Post', postSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- post.model.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/types/post.types.ts backend/src/models/Post.model.ts backend/src/tests/post.model.test.ts
git commit -m "feat(posts): add Post model with slug, soft delete, and indexes"
```

---

### Task 2: Post Zod validators

**Files:**
- Create: `backend/src/validators/post.validator.ts`
- Test: covered by Task 6's route integration tests (these schemas are simple field-presence/length checks in the same style as Module 1's `auth.validator.ts`; a dedicated unit test file would duplicate Module 1's already-proven `validate()` middleware behavior without exercising anything new — the route tests in Task 6 send both valid and invalid payloads through the real HTTP layer, which is the more valuable test surface here).

**Interfaces:**
- Produces: `createPostSchema`, `updatePostSchema` (Zod objects with `body` key); `listPostsQuerySchema` (Zod object with `query` key, for pagination params); `CreatePostInput`, `UpdatePostInput` types re-exported from `post.types.ts` (inferred types must match `post.types.ts`'s hand-written interfaces exactly).

- [ ] **Step 1: Write the implementation directly (no isolated unit test for this task — see Interfaces note above; covered by Task 6)**

```ts
// backend/src/validators/post.validator.ts
import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
    content: z.string().trim().min(10, 'Content must be at least 10 characters'),
  }),
});

export const updatePostSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters').optional(),
      content: z.string().trim().min(10, 'Content must be at least 10 characters').optional(),
    })
    .refine((data) => data.title !== undefined || data.content !== undefined, {
      message: 'At least one of title or content must be provided',
    }),
});

export const listPostsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => Number.isInteger(val) && val >= 1, 'page must be a positive integer'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => Number.isInteger(val) && val >= 1, 'limit must be a positive integer'),
  }),
});
```

Note: `validate()` from Module 1 parses `{ body: req.body }` only — it does not touch `req.query`. `listPostsQuerySchema` will be applied directly in the controller (Task 6), not via the shared `validate()` middleware, since pagination query parsing/clamping is response-shaping logic specific to the list endpoint. See Task 6 for how it's used.

- [ ] **Step 2: Commit**

```bash
git add backend/src/validators/post.validator.ts
git commit -m "feat(posts): add Zod validators for create/update/list-query"
```

---

### Task 3: Unique slug generation utility

**Files:**
- Create: `backend/src/utils/slug.ts`
- Test: `backend/src/tests/slug.test.ts`

**Interfaces:**
- Consumes: `PostModel` from `../models/Post.model`; `slugify` npm package.
- Produces: `generateUniqueSlug(title: string): Promise<string>` — returns a URL-safe slug derived from `title`; if the base slug already exists among non-deleted OR deleted posts (slugs must be globally unique even for soft-deleted posts, since the unique index doesn't distinguish), appends `-2`, `-3`, etc. until a free slug is found.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/slug.test.ts
import mongoose from 'mongoose';
import { PostModel } from '../models/Post.model';
import { generateUniqueSlug } from '../utils/slug';

describe('generateUniqueSlug', () => {
  it('slugifies a simple title', async () => {
    const slug = await generateUniqueSlug('Hello World');
    expect(slug).toBe('hello-world');
  });

  it('strips special characters and lowercases', async () => {
    const slug = await generateUniqueSlug('  My Awesome Post!! 2024  ');
    expect(slug).toBe('my-awesome-post-2024');
  });

  it('appends a numeric suffix when the base slug is taken', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({
      title: 'Hello World',
      content: 'Content long enough to pass validation rules here.',
      author: authorId,
      slug: 'hello-world',
    });
    const slug = await generateUniqueSlug('Hello World');
    expect(slug).toBe('hello-world-2');
  });

  it('increments past multiple existing collisions', async () => {
    const authorId = new mongoose.Types.ObjectId();
    await PostModel.create({ title: 'X', content: 'Content long enough to pass validation.', author: authorId, slug: 'dup' });
    await PostModel.create({ title: 'X', content: 'Content long enough to pass validation.', author: authorId, slug: 'dup-2' });
    const slug = await generateUniqueSlug('Dup');
    expect(slug).toBe('dup-3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- slug.test.ts`
Expected: FAIL — `Cannot find module '../utils/slug'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/utils/slug.ts
import slugify from 'slugify';
import { PostModel } from '../models/Post.model';

export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true });
  let candidate = base;
  let suffix = 2;

  while (await PostModel.exists({ slug: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- slug.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/slug.ts backend/src/tests/slug.test.ts
git commit -m "feat(posts): add unique slug generation utility"
```

---

### Task 4: Post service (create, list, getBySlug, listMine, update, delete)

**Files:**
- Create: `backend/src/services/post.service.ts`
- Test: `backend/src/tests/post.service.test.ts`

**Interfaces:**
- Consumes: `PostModel`, `IPost` from `../models/Post.model`; `generateUniqueSlug` from `../utils/slug`; `AppError` from `../utils/AppError`; `CreatePostInput`, `UpdatePostInput`, `PublicPost`, `PaginatedPosts` from `../types/post.types`; `UserRole` from `../types/auth.types`.
- Produces:
  - `createPost(authorId: string, input: CreatePostInput): Promise<IPost>`
  - `listPosts(page: number, limit: number): Promise<PaginatedPosts>` — excludes soft-deleted, newest first, clamps `limit` to a max of 50.
  - `getPostBySlug(slug: string): Promise<IPost>` — throws `AppError(404, 'POST_NOT_FOUND')` if missing or soft-deleted.
  - `listMyPosts(authorId: string, page: number, limit: number): Promise<PaginatedPosts>` — includes only that author's non-deleted posts.
  - `updatePost(postId: string, requestingUserId: string, requestingUserRole: UserRole, input: UpdatePostInput): Promise<IPost>` — 404 if missing/deleted, 403 if not owner and not admin.
  - `deletePost(postId: string, requestingUserId: string, requestingUserRole: UserRole): Promise<void>` — soft delete; same 404/403 rules as update.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/post.service.test.ts
import mongoose from 'mongoose';
import {
  createPost,
  listPosts,
  getPostBySlug,
  listMyPosts,
  updatePost,
  deletePost,
} from '../services/post.service';

const validContent = 'This is a sufficiently long piece of content for validation purposes.';

describe('post service', () => {
  it('creates a post with a generated slug', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'My First Post', content: validContent });
    expect(post.slug).toBe('my-first-post');
    expect(post.author.toString()).toBe(authorId);
  });

  it('generates distinct slugs for posts with the same title', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const p1 = await createPost(authorId, { title: 'Same Title', content: validContent });
    const p2 = await createPost(authorId, { title: 'Same Title', content: validContent });
    expect(p1.slug).not.toBe(p2.slug);
  });

  it('lists posts newest-first with pagination metadata, excluding soft-deleted', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const p1 = await createPost(authorId, { title: 'Post One', content: validContent });
    const p2 = await createPost(authorId, { title: 'Post Two', content: validContent });
    await deletePost(String(p2._id), authorId, 'user');

    const result = await listPosts(1, 10);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].slug).toBe(p1.slug);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('clamps an excessive limit to a maximum of 50', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    await createPost(authorId, { title: 'Clamp Test', content: validContent });
    const result = await listPosts(1, 999999);
    expect(result.pagination.limit).toBe(50);
  });

  it('getPostBySlug throws 404 for a missing or soft-deleted post', async () => {
    await expect(getPostBySlug('does-not-exist')).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });

    const authorId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'To Delete', content: validContent });
    await deletePost(String(post._id), authorId, 'user');
    await expect(getPostBySlug(post.slug)).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });
  });

  it('listMyPosts returns only the given author\'s non-deleted posts', async () => {
    const authorA = new mongoose.Types.ObjectId().toString();
    const authorB = new mongoose.Types.ObjectId().toString();
    await createPost(authorA, { title: 'A1', content: validContent });
    await createPost(authorB, { title: 'B1', content: validContent });

    const result = await listMyPosts(authorA, 1, 10);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].title).toBe('A1');
  });

  it('updatePost allows the owner to edit their own post', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'Original', content: validContent });
    const updated = await updatePost(String(post._id), authorId, 'user', { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');
  });

  it('updatePost rejects a non-owner, non-admin user with 403', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'Original', content: validContent });
    await expect(
      updatePost(String(post._id), otherUserId, 'user', { title: 'Hijacked' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('updatePost allows an admin to edit any post (admin-override path)', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const adminId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'Original', content: validContent });
    const updated = await updatePost(String(post._id), adminId, 'admin', { title: 'Admin Edited' });
    expect(updated.title).toBe('Admin Edited');
  });

  it('deletePost soft-deletes and rejects a non-owner, non-admin user with 403', async () => {
    const authorId = new mongoose.Types.ObjectId().toString();
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const post = await createPost(authorId, { title: 'Original', content: validContent });

    await expect(deletePost(String(post._id), otherUserId, 'user')).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    await deletePost(String(post._id), authorId, 'user');
    await expect(getPostBySlug(post.slug)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updatePost/deletePost throw 404 for a non-existent post id', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    await expect(updatePost(fakeId, userId, 'user', { title: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });
    await expect(deletePost(fakeId, userId, 'user')).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- post.service.test.ts`
Expected: FAIL — `Cannot find module '../services/post.service'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/services/post.service.ts
import { PostModel, IPost } from '../models/Post.model';
import { generateUniqueSlug } from '../utils/slug';
import { AppError } from '../utils/AppError';
import { CreatePostInput, UpdatePostInput, PaginatedPosts, PublicPost } from '../types/post.types';
import { UserRole } from '../types/auth.types';

const MAX_PAGE_SIZE = 50;

function toPublicPost(post: IPost): PublicPost {
  const populatedAuthor = post.author as unknown as { _id: unknown; name: string };
  return {
    id: String(post._id),
    title: post.title,
    content: post.content,
    slug: post.slug,
    author: { id: String(populatedAuthor._id ?? post.author), name: populatedAuthor.name ?? '' },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function paginate(filter: Record<string, unknown>, page: number, limit: number): Promise<PaginatedPosts> {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const clampedPage = Math.max(page, 1);

  const [docs, total] = await Promise.all([
    PostModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((clampedPage - 1) * clampedLimit)
      .limit(clampedLimit)
      .populate('author', 'name')
      .exec(),
    PostModel.countDocuments(filter),
  ]);

  return {
    posts: docs.map(toPublicPost),
    pagination: {
      page: clampedPage,
      limit: clampedLimit,
      total,
      totalPages: total === 0 ? 1 : Math.ceil(total / clampedLimit),
    },
  };
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<IPost> {
  const slug = await generateUniqueSlug(input.title);
  return PostModel.create({ title: input.title, content: input.content, author: authorId, slug });
}

export async function listPosts(page: number, limit: number): Promise<PaginatedPosts> {
  return paginate({ isDeleted: false }, page, limit);
}

export async function listMyPosts(authorId: string, page: number, limit: number): Promise<PaginatedPosts> {
  return paginate({ isDeleted: false, author: authorId }, page, limit);
}

export async function getPostBySlug(slug: string): Promise<IPost> {
  const post = await PostModel.findOne({ slug, isDeleted: false }).populate('author', 'name');
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }
  return post;
}

async function findOwnedPostOrFail(postId: string): Promise<IPost> {
  const post = await PostModel.findOne({ _id: postId, isDeleted: false });
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }
  return post;
}

function assertCanModify(post: IPost, requestingUserId: string, requestingUserRole: UserRole): void {
  const isOwner = post.author.toString() === requestingUserId;
  const isAdmin = requestingUserRole === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('You do not have permission to modify this post', 403, 'FORBIDDEN');
  }
}

export async function updatePost(
  postId: string,
  requestingUserId: string,
  requestingUserRole: UserRole,
  input: UpdatePostInput
): Promise<IPost> {
  const post = await findOwnedPostOrFail(postId);
  assertCanModify(post, requestingUserId, requestingUserRole);

  if (input.title !== undefined) post.title = input.title;
  if (input.content !== undefined) post.content = input.content;
  await post.save();
  return post;
}

export async function deletePost(
  postId: string,
  requestingUserId: string,
  requestingUserRole: UserRole
): Promise<void> {
  const post = await findOwnedPostOrFail(postId);
  assertCanModify(post, requestingUserId, requestingUserRole);

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- post.service.test.ts`
Expected: PASS (all 11 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/post.service.ts backend/src/tests/post.service.test.ts
git commit -m "feat(posts): add post service with ownership, admin override, soft delete, and pagination"
```

---

### Task 5: Post controller + routes, wired into app (integration tests)

**Files:**
- Create: `backend/src/controllers/post.controller.ts`
- Create: `backend/src/routes/post.routes.ts`
- Modify: `backend/src/app.ts` (mount `/api/v1/posts`)
- Test: `backend/src/tests/post.routes.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4, plus `authenticate` from `../middleware/auth.middleware` (Module 1).
- Produces: `postRouter` exposing `GET /` (public, paginated), `GET /mine` (auth), `GET /:slug` (public), `POST /` (auth), `PATCH /:id` (auth), `DELETE /:id` (auth). Route order matters: `/mine` must be registered before `/:slug` so it isn't swallowed as a slug value.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/tests/post.routes.test.ts
import request from 'supertest';
import { app } from '../app';

const validContent = 'This is a sufficiently long piece of content for validation purposes.';

async function registerAndLogin(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email, password: 'longenough1' });
  return res.body.data.accessToken as string;
}

describe('Post routes', () => {
  it('creates a post when authenticated', async () => {
    const token = await registerAndLogin('author1@example.com');
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My Post', content: validContent });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('my-post');
    expect(res.body.data.author.name).toBe('Test User');
  });

  it('rejects post creation without authentication', async () => {
    const res = await request(app).post('/api/v1/posts').send({ title: 'X', content: validContent });
    expect(res.status).toBe(401);
  });

  it('rejects post creation with an invalid payload', async () => {
    const token = await registerAndLogin('author2@example.com');
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'ab', content: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists posts with pagination, newest first', async () => {
    const token = await registerAndLogin('author3@example.com');
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token}`).send({ title: 'First', content: validContent });
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token}`).send({ title: 'Second', content: validContent });

    const res = await request(app).get('/api/v1/posts?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.posts[0].title).toBe('Second');
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('gets a single post by slug', async () => {
    const token = await registerAndLogin('author4@example.com');
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token}`).send({ title: 'Unique Slug Post', content: validContent });

    const res = await request(app).get('/api/v1/posts/unique-slug-post');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Unique Slug Post');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await request(app).get('/api/v1/posts/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('lists only the authenticated user\'s own posts on /mine', async () => {
    const tokenA = await registerAndLogin('mineA@example.com');
    const tokenB = await registerAndLogin('mineB@example.com');
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${tokenA}`).send({ title: 'Mine A', content: validContent });
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${tokenB}`).send({ title: 'Mine B', content: validContent });

    const res = await request(app).get('/api/v1/posts/mine').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.posts.every((p: { title: string }) => p.title === 'Mine A')).toBe(true);
  });

  it('allows the owner to update their own post', async () => {
    const token = await registerAndLogin('owner1@example.com');
    const createRes = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token}`).send({ title: 'Owner Post', content: validContent });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Owner Post Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Owner Post Updated');
  });

  it('forbids a non-owner from updating another user\'s post', async () => {
    const ownerToken = await registerAndLogin('owner2@example.com');
    const intruderToken = await registerAndLogin('intruder@example.com');
    const createRes = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${ownerToken}`).send({ title: 'Protected Post', content: validContent });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('allows the owner to soft-delete their own post, and it then 404s', async () => {
    const token = await registerAndLogin('deleter@example.com');
    const createRes = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token}`).send({ title: 'Delete Me', content: validContent });
    const postId = createRes.body.data.id;
    const slug = createRes.body.data.slug;

    const delRes = await request(app).delete(`/api/v1/posts/${postId}`).set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app).get(`/api/v1/posts/${slug}`);
    expect(getRes.status).toBe(404);
  });

  it('clamps an excessive limit query param server-side', async () => {
    const res = await request(app).get('/api/v1/posts?page=1&limit=999999');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.limit).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- post.routes.test.ts`
Expected: FAIL — routes not mounted (404s where 2xx/4xx expected), since `post.routes.ts`/`post.controller.ts` don't exist yet and aren't wired into `app.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/controllers/post.controller.ts
import { Response, NextFunction } from 'express';
import {
  createPost,
  listPosts,
  listMyPosts,
  getPostBySlug,
  updatePost,
  deletePost,
} from '../services/post.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { IPost } from '../models/Post.model';
import { PublicPost } from '../types/post.types';

function toPublicPost(post: IPost): PublicPost {
  const populatedAuthor = post.author as unknown as { _id: unknown; name: string };
  return {
    id: String(post._id),
    title: post.title,
    content: post.content,
    slug: post.slug,
    author: { id: String(populatedAuthor._id ?? post.author), name: populatedAuthor.name ?? '' },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function parsePagination(req: AuthenticatedRequest): { page: number; limit: number } {
  const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
  const limit = parseInt(String(req.query.limit ?? '10'), 10) || 10;
  return { page, limit };
}

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await createPost(req.user!.sub, req.body);
    const populated = await post.populate('author', 'name');
    res.status(201).json({ success: true, data: toPublicPost(populated) });
  } catch (err) {
    next(err);
  }
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    const result = await listPosts(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req);
    const result = await listMyPosts(req.user!.sub, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getBySlug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await getPostBySlug(req.params.slug);
    res.status(200).json({ success: true, data: toPublicPost(post) });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await updatePost(req.params.id, req.user!.sub, req.user!.role, req.body);
    const populated = await post.populate('author', 'name');
    res.status(200).json({ success: true, data: toPublicPost(populated) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deletePost(req.params.id, req.user!.sub, req.user!.role);
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
```

```ts
// backend/src/routes/post.routes.ts
import { Router } from 'express';
import * as postController from '../controllers/post.controller';
import { validate } from '../middleware/validate.middleware';
import { createPostSchema, updatePostSchema } from '../validators/post.validator';
import { authenticate } from '../middleware/auth.middleware';

export const postRouter = Router();

postRouter.get('/mine', authenticate, postController.listMine);
postRouter.get('/', postController.list);
postRouter.get('/:slug', postController.getBySlug);
postRouter.post('/', authenticate, validate(createPostSchema), postController.create);
postRouter.patch('/:id', authenticate, validate(updatePostSchema), postController.update);
postRouter.delete('/:id', authenticate, postController.remove);
```

```ts
// backend/src/app.ts  (modify: add import + mount, BEFORE the errorHandler which must stay last)
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { postRouter } from './routes/post.routes';
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
app.use('/api/v1/posts', postRouter);

app.use(errorHandler);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- post.routes.test.ts`
Expected: PASS (all 11 tests). Then run the full suite: `npm test` — expect every prior Module 1 test file plus all new Module 2 test files green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/post.controller.ts backend/src/routes/post.routes.ts backend/src/app.ts backend/src/tests/post.routes.test.ts
git commit -m "feat(posts): wire post controller and routes into the app with full integration tests"
```

---

### Task 6: Frontend post types + API wrappers

**Files:**
- Create: `frontend/src/types/post.types.ts`
- Create: `frontend/src/api/post.api.ts`

**Interfaces:**
- Produces: `Post` (`id`, `title`, `content`, `slug`, `author: { id, name }`, `createdAt`, `updatedAt`), `PaginatedPosts` (`posts: Post[]`, `pagination: { page, limit, total, totalPages }`), `CreatePostInput { title, content }`, `UpdatePostInput { title?, content? }`; `postApi.list(page, limit)`, `postApi.listMine(page, limit)`, `postApi.getBySlug(slug)`, `postApi.create(input)`, `postApi.update(id, input)`, `postApi.remove(id)`.

This task is wiring/glue code with no isolated unit-testable boundary, same category as Module 1's Task 11 — verified end-to-end manually alongside the pages in later tasks.

- [ ] **Step 1: Write the types and API client**

```ts
// frontend/src/types/post.types.ts
export interface PostAuthor {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  slug: string;
  author: PostAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPosts {
  posts: Post[];
  pagination: PaginationMeta;
}

export interface CreatePostInput {
  title: string;
  content: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}
```

```ts
// frontend/src/api/post.api.ts
import { apiClient } from './axios';
import { Post, PaginatedPosts, CreatePostInput, UpdatePostInput } from '../types/post.types';

export const postApi = {
  async list(page = 1, limit = 10): Promise<PaginatedPosts> {
    const res = await apiClient.get<{ data: PaginatedPosts }>('/posts', { params: { page, limit } });
    return res.data.data;
  },
  async listMine(page = 1, limit = 10): Promise<PaginatedPosts> {
    const res = await apiClient.get<{ data: PaginatedPosts }>('/posts/mine', { params: { page, limit } });
    return res.data.data;
  },
  async getBySlug(slug: string): Promise<Post> {
    const res = await apiClient.get<{ data: Post }>(`/posts/${slug}`);
    return res.data.data;
  },
  async create(input: CreatePostInput): Promise<Post> {
    const res = await apiClient.post<{ data: Post }>('/posts', input);
    return res.data.data;
  },
  async update(id: string, input: UpdatePostInput): Promise<Post> {
    const res = await apiClient.patch<{ data: Post }>(`/posts/${id}`, input);
    return res.data.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/posts/${id}`);
  },
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd frontend && npm run lint` (tsc --noEmit) — confirm clean even though nothing consumes these files yet.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/post.types.ts frontend/src/api/post.api.ts
git commit -m "feat(frontend): add Post types and API wrappers"
```

---

### Task 7: Pagination control + PostCard + PostList page

**Files:**
- Create: `frontend/src/components/Pagination.tsx`
- Create: `frontend/src/components/PostCard.tsx`
- Create: `frontend/src/pages/PostList.tsx`
- Modify: `frontend/src/App.tsx` (add `/posts` route, public)

**Interfaces:**
- Consumes: `postApi.list` from `../api/post.api`; `Post`, `PaginationMeta` from `../types/post.types`.
- Produces: `<Pagination currentPage limit totalPages onPageChange />`; `<PostCard post={Post} />` rendering title/author/date/excerpt with a link to `/posts/:slug`; `PostList` page fetching page 1 on mount, re-fetching on page change, showing a loading spinner and an error alert on failure.

- [ ] **Step 1: Write the components and page**

```tsx
// frontend/src/components/Pagination.tsx
import { Pagination as BsPagination } from 'react-bootstrap';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <BsPagination className="justify-content-center">
      <BsPagination.Prev disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} />
      {pages.map((p) => (
        <BsPagination.Item key={p} active={p === currentPage} onClick={() => onPageChange(p)}>
          {p}
        </BsPagination.Item>
      ))}
      <BsPagination.Next disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} />
    </BsPagination>
  );
}
```

```tsx
// frontend/src/components/PostCard.tsx
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Post } from '../types/post.types';

function excerpt(content: string, maxLength = 150): string {
  return content.length > maxLength ? `${content.slice(0, maxLength)}...` : content;
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title>
          <Link to={`/posts/${post.slug}`}>{post.title}</Link>
        </Card.Title>
        <Card.Subtitle className="mb-2 text-muted">
          By {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}
        </Card.Subtitle>
        <Card.Text>{excerpt(post.content)}</Card.Text>
      </Card.Body>
    </Card>
  );
}
```

```tsx
// frontend/src/pages/PostList.tsx
import { useEffect, useState } from 'react';
import { Container, Spinner, Alert } from 'react-bootstrap';
import { postApi } from '../api/post.api';
import { Post, PaginationMeta } from '../types/post.types';
import PostCard from '../components/PostCard';
import Pagination from '../components/Pagination';

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    postApi
      .list(page, 10)
      .then((result) => {
        setPosts(result.posts);
        setPagination(result.pagination);
      })
      .catch(() => setError('Failed to load posts. Please try again later.'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Container className="mt-4">
      <h2 className="mb-4">Blog Posts</h2>
      {loading && (
        <div className="d-flex justify-content-center">
          <Spinner animation="border" role="status" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && posts.length === 0 && <p>No posts yet.</p>}
      {!loading && !error && posts.map((post) => <PostCard key={post.id} post={post} />)}
      {pagination && (
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}
    </Container>
  );
}
```

```tsx
// frontend/src/App.tsx  (modify: add PostList route — public, alongside /login and /register)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import PostList from './pages/PostList';

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
          <Route path="/posts" element={<PostList />} />
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

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run lint` — confirm clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Pagination.tsx frontend/src/components/PostCard.tsx frontend/src/pages/PostList.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add Pagination, PostCard, and public PostList page"
```

---

### Task 8: PostDetails page

**Files:**
- Create: `frontend/src/pages/PostDetails.tsx`
- Modify: `frontend/src/App.tsx` (add `/posts/:slug` route, public)

**Interfaces:**
- Consumes: `postApi.getBySlug`, `useAuth()` (to conditionally show Edit/Delete links to the owner/admin — server still enforces this; this is UX only).

- [ ] **Step 1: Write the page**

```tsx
// frontend/src/pages/PostDetails.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Spinner, Alert, Button } from 'react-bootstrap';
import { postApi } from '../api/post.api';
import { Post } from '../types/post.types';
import { useAuth } from '../context/AuthContext';

export default function PostDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    postApi
      .getBySlug(slug)
      .then(setPost)
      .catch(() => setError('Post not found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <Container className="mt-4 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error ?? 'Post not found.'}</Alert>
      </Container>
    );
  }

  const canModify = user && (user.id === post.author.id || user.role === 'admin');

  return (
    <Container className="mt-4">
      <h1>{post.title}</h1>
      <p className="text-muted">
        By {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>
      {canModify && (
        <Link to={`/posts/${post.slug}/edit`}>
          <Button variant="outline-primary">Edit</Button>
        </Link>
      )}
    </Container>
  );
}
```

```tsx
// frontend/src/App.tsx (modify: add the /posts/:slug route next to /posts)
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/:slug" element={<PostDetails />} />
```
(Add the import `import PostDetails from './pages/PostDetails';` alongside the other page imports.)

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run lint` — confirm clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PostDetails.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add PostDetails page with owner/admin-only edit affordance"
```

---

### Task 9: CreatePost and EditPost pages

**Files:**
- Create: `frontend/src/pages/CreatePost.tsx`
- Create: `frontend/src/pages/EditPost.tsx`
- Modify: `frontend/src/App.tsx` (add `/posts/new` and `/posts/:slug/edit`, both protected)

**Interfaces:**
- Consumes: `postApi.create`, `postApi.update`, `postApi.getBySlug`.

- [ ] **Step 1: Write the pages**

```tsx
// frontend/src/pages/CreatePost.tsx
import { useState, FormEvent } from 'react';
import { Form, Button, Alert, Card, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { postApi } from '../api/post.api';

export default function CreatePost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const post = await postApi.create({ title, content });
      navigate(`/posts/${post.slug}`);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to create post. Please try again.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="mt-4" style={{ maxWidth: 640 }}>
      <Card>
        <Card.Body>
          <Card.Title>Create Post</Card.Title>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={3}
                maxLength={200}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minLength={10}
                required
              />
            </Form.Group>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
```

```tsx
// frontend/src/pages/EditPost.tsx
import { useState, useEffect, FormEvent } from 'react';
import { Form, Button, Alert, Card, Container, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { postApi } from '../api/post.api';

export default function EditPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [postId, setPostId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    postApi
      .getBySlug(slug)
      .then((post) => {
        setPostId(post.id);
        setTitle(post.title);
        setContent(post.content);
      })
      .catch(() => setFormError('Failed to load post.'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!postId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await postApi.update(postId, { title, content });
      navigate(`/posts/${updated.slug}`);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to update post. You may not have permission to edit it.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Container className="mt-4 d-flex justify-content-center">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  return (
    <Container className="mt-4" style={{ maxWidth: 640 }}>
      <Card>
        <Card.Body>
          <Card.Title>Edit Post</Card.Title>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={3}
                maxLength={200}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minLength={10}
                required
              />
            </Form.Group>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
```

```tsx
// frontend/src/App.tsx (modify: add these two protected routes, imports for CreatePost/EditPost alongside the others)
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/posts/new" element={<CreatePost />} />
            <Route path="/posts/:slug/edit" element={<EditPost />} />
          </Route>
```

Note: if the server rejects an edit due to ownership (403), `EditPost`'s catch block surfaces the backend's actual error message via the same `axios.isAxiosError` pattern established in Module 1's final fix wave — this is intentional reuse of that pattern, not a new one.

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run lint` — confirm clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CreatePost.tsx frontend/src/pages/EditPost.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add CreatePost and EditPost pages"
```

---

### Task 10: MyPosts page + DeleteConfirmModal + final App wiring

**Files:**
- Create: `frontend/src/components/DeleteConfirmModal.tsx`
- Create: `frontend/src/pages/MyPosts.tsx`
- Modify: `frontend/src/App.tsx` (add `/my-posts`, protected; add a nav link from `Home.tsx` to `/posts` and `/my-posts` and `/posts/new`)
- Modify: `frontend/src/pages/Home.tsx` (add navigation links)

**Interfaces:**
- Consumes: `postApi.listMine`, `postApi.remove`.
- Produces: `<DeleteConfirmModal show onConfirm onCancel itemLabel />` reusable Bootstrap modal.

- [ ] **Step 1: Write the modal and page**

```tsx
// frontend/src/components/DeleteConfirmModal.tsx
import { Modal, Button } from 'react-bootstrap';

interface DeleteConfirmModalProps {
  show: boolean;
  itemLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
}

export default function DeleteConfirmModal({ show, itemLabel, onConfirm, onCancel, deleting }: DeleteConfirmModalProps) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Confirm Delete</Modal.Title>
      </Modal.Header>
      <Modal.Body>Are you sure you want to delete "{itemLabel}"? This cannot be undone.</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

```tsx
// frontend/src/pages/MyPosts.tsx
import { useEffect, useState } from 'react';
import { Container, Spinner, Alert, Table, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { postApi } from '../api/post.api';
import { Post, PaginationMeta } from '../types/post.types';
import Pagination from '../components/Pagination';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

export default function MyPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadPosts() {
    setLoading(true);
    setError(null);
    postApi
      .listMine(page, 10)
      .then((result) => {
        setPosts(result.posts);
        setPagination(result.pagination);
      })
      .catch(() => setError('Failed to load your posts.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadPosts, [page]);

  async function handleDeleteConfirm() {
    if (!postToDelete) return;
    setDeleting(true);
    try {
      await postApi.remove(postToDelete.id);
      setPostToDelete(null);
      loadPosts();
    } catch {
      setError('Failed to delete post.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Container className="mt-4">
      <h2 className="mb-4">My Posts</h2>
      {loading && (
        <div className="d-flex justify-content-center">
          <Spinner animation="border" role="status" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && posts.length === 0 && <p>You haven&apos;t written any posts yet.</p>}
      {!loading && !error && posts.length > 0 && (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Title</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                </td>
                <td>{new Date(post.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link to={`/posts/${post.slug}/edit`} className="btn btn-outline-primary btn-sm me-2">
                    Edit
                  </Link>
                  <Button variant="outline-danger" size="sm" onClick={() => setPostToDelete(post)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pagination && (
        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}
      <DeleteConfirmModal
        show={postToDelete !== null}
        itemLabel={postToDelete?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPostToDelete(null)}
        deleting={deleting}
      />
    </Container>
  );
}
```

```tsx
// frontend/src/App.tsx (final version for Module 2: add MyPosts import + route)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import PostList from './pages/PostList';
import PostDetails from './pages/PostDetails';
import CreatePost from './pages/CreatePost';
import EditPost from './pages/EditPost';
import MyPosts from './pages/MyPosts';

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
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/:slug" element={<PostDetails />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/posts/new" element={<CreatePost />} />
            <Route path="/posts/:slug/edit" element={<EditPost />} />
            <Route path="/my-posts" element={<MyPosts />} />
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

```tsx
// frontend/src/pages/Home.tsx (modify: add navigation links)
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <Container className="mt-4">
      <h2>Welcome{user ? `, ${user.name}` : ''}</h2>
      {user && (
        <>
          <p>Role: {user.role}</p>
          <div className="mb-3">
            <Link to="/posts" className="btn btn-outline-primary btn-sm me-2">
              Browse Posts
            </Link>
            <Link to="/posts/new" className="btn btn-outline-success btn-sm me-2">
              New Post
            </Link>
            <Link to="/my-posts" className="btn btn-outline-secondary btn-sm me-2">
              My Posts
            </Link>
          </div>
          <button className="btn btn-outline-secondary" onClick={() => logout().catch(() => {})}>
            Logout
          </button>
        </>
      )}
    </Container>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run lint` and `npm run build` — confirm both clean (don't regress the Module 1 build fix).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DeleteConfirmModal.tsx frontend/src/pages/MyPosts.tsx frontend/src/App.tsx frontend/src/pages/Home.tsx
git commit -m "feat(frontend): add MyPosts page, delete confirmation modal, and navigation links"
```

---

### Task 11: End-to-end manual verification

**Files:** none created; runs both servers and exercises the flows by hand/curl, per the project-requirements.md interaction rule.

- [ ] **Step 1: Start backend and frontend**

Run backend (`cd backend && npm run build && node dist/server.js` or dev mode) and frontend (`cd frontend && npm run dev`) against a running MongoDB (real or `mongodb-memory-server`-backed, same approach as Module 1's verification).

- [ ] **Step 2: Verify the full flow**

1. Register/login as User A. Create a post via `/posts/new` → redirected to `/posts/:slug` showing the new post.
2. Visit `/posts` (logged out in a different browser/incognito) → the post is publicly visible without authentication.
3. As User A, visit `/my-posts` → the post appears with Edit/Delete actions.
4. Edit the post → title/content updates, slug may or may not change (slug is not regenerated on update per this plan — confirm that's acceptable, or note as a follow-up if the team wants slug regeneration on title change).
5. Register/login as User B. Attempt to visit `/posts/:slug-of-A's-post/edit` directly by URL → frontend shows no Edit button (since `canModify` is false), but also confirm the server independently rejects a forged PATCH request from User B's token with 403 (spot-check via curl, mirroring the backend's own `auth.routes.test.ts`-style coverage for this exact case).
6. As User A, delete the post via the confirmation modal → it disappears from `/my-posts` and `/posts`, and visiting its old slug URL directly returns a 404/not-found page.
7. Create two posts with the same title → confirm they get distinct slugs (e.g. `my-post` and `my-post-2`).
8. Request `/api/v1/posts?limit=99999` directly → confirm the response's `pagination.limit` is clamped to 50.
9. As an admin (manually flip a user's role to `admin` in MongoDB, as in Module 1's verification), confirm that user CAN edit/delete User A's remaining posts — the admin-override path.

- [ ] **Step 3: Record results**

Note which of the above passed and any deviations.

---

## Post-Plan Note

This plan covers Module 2 (Posts) only, continuing directly in the same worktree/branch as Module 1 per the user's explicit instruction — no new worktree was created. Module 3 (Comments) gets its own plan, written after Module 2 is confirmed complete and working end-to-end, per project-requirements.md's module-by-module interaction rule (stop and wait for instruction before starting the next module).
