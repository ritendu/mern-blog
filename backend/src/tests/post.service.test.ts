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

  it("listMyPosts returns only the given author's non-deleted posts", async () => {
    const authorA = new mongoose.Types.ObjectId().toString();
    const authorB = new mongoose.Types.ObjectId().toString();
    // NOTE: brief used 'A1'/'B1' titles, but Post.model.ts enforces title minlength: 3.
    // Adjusted to valid 3+ char titles while preserving the test's intent
    // (distinguishing author A's post from author B's post).
    await createPost(authorA, { title: 'Post by A', content: validContent });
    await createPost(authorB, { title: 'Post by B', content: validContent });

    const result = await listMyPosts(authorA, 1, 10);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].title).toBe('Post by A');
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
    await expect(updatePost(fakeId, userId, 'user', { title: 'Nonexistent' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });
    await expect(deletePost(fakeId, userId, 'user')).rejects.toMatchObject({
      statusCode: 404,
      code: 'POST_NOT_FOUND',
    });
  });
});
