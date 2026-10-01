import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { createPost, registerAdmin, registerUser } from './helpers';

describe('Comment routes', () => {
  it('creates and lists comments for a post', async () => {
    const author = await registerUser('c1@example.com');
    const post = await createPost(author.token);
    const created = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'Nice post' });
    expect(created.status).toBe(201);
    expect(created.body.data.author.name).toBe('Test User');

    const list = await request(app).get(`/api/v1/posts/${post.id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.data.comments).toHaveLength(1);
    expect(list.body.data.pagination.total).toBe(1);
  });

  it('requires authentication to comment', async () => {
    const author = await registerUser('c2@example.com');
    const post = await createPost(author.token);
    const res = await request(app).post(`/api/v1/posts/${post.id}/comments`).send({ content: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects empty and oversized comments', async () => {
    const author = await registerUser('c3@example.com');
    const post = await createPost(author.token);
    const empty = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);
    const long = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'x'.repeat(2001) });
    expect(long.status).toBe(400);
  });

  it('returns 404 when commenting on a missing or soft-deleted post', async () => {
    const author = await registerUser('c4@example.com');
    const missing = await request(app)
      .post(`/api/v1/posts/${new mongoose.Types.ObjectId()}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'hello' });
    expect(missing.status).toBe(404);

    const post = await createPost(author.token);
    await request(app).delete(`/api/v1/posts/${post.id}`).set('Authorization', `Bearer ${author.token}`);
    const deleted = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'hello' });
    expect(deleted.status).toBe(404);
    expect((await request(app).get(`/api/v1/posts/${post.id}/comments`)).status).toBe(404);
  });

  it('returns 400 for a malformed id instead of a server error', async () => {
    const author = await registerUser('c5@example.com');
    const res = await request(app)
      .patch('/api/v1/comments/not-an-id')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });

  it('lets the owner edit and delete, but not another user', async () => {
    const owner = await registerUser('owner@example.com');
    const other = await registerUser('other@example.com', 'Other');
    const post = await createPost(owner.token);
    const created = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'first' });
    const id = created.body.data.id;

    const forbiddenEdit = await request(app).patch(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${other.token}`).send({ content: 'hack' });
    expect(forbiddenEdit.status).toBe(403);
    const forbiddenDelete = await request(app).delete(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${other.token}`);
    expect(forbiddenDelete.status).toBe(403);

    const edit = await request(app).patch(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ content: 'edited' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.content).toBe('edited');

    const del = await request(app).delete(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(del.status).toBe(200);
    const again = await request(app).delete(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(again.status).toBe(404);
  });

  it('lets an admin edit and delete any comment', async () => {
    const owner = await registerUser('o2@example.com');
    const admin = await registerAdmin('admin-c@example.com');
    const post = await createPost(owner.token);
    const created = await request(app)
      .post(`/api/v1/posts/${post.id}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'user comment' });
    const id = created.body.data.id;
    const edit = await request(app).patch(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${admin.token}`).send({ content: 'moderated' });
    expect(edit.status).toBe(200);
    const del = await request(app).delete(`/api/v1/comments/${id}`).set('Authorization', `Bearer ${admin.token}`);
    expect(del.status).toBe(200);
  });

  it('paginates comments', async () => {
    const author = await registerUser('c6@example.com');
    const post = await createPost(author.token);
    for (let i = 0; i < 3; i += 1) {
      await request(app).post(`/api/v1/posts/${post.id}/comments`).set('Authorization', `Bearer ${author.token}`).send({ content: `comment ${i}` });
    }
    const res = await request(app).get(`/api/v1/posts/${post.id}/comments?page=2&limit=2`);
    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});
