import request from 'supertest';
import { app } from '../app';
import { ActivityLogModel } from '../models/ActivityLog.model';
import { UserModel } from '../models/User.model';
import { PostModel } from '../models/Post.model';
import { CommentModel } from '../models/Comment.model';
import { createPost, registerAdmin, registerUser } from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function waitFor(check: () => Promise<boolean>, attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

describe('Admin routes', () => {
  it('rejects unauthenticated and non-admin access at the API level', async () => {
    const user = await registerUser('plain@example.com');
    expect((await request(app).get('/api/v1/admin/stats')).status).toBe(401);
    for (const path of ['/stats', '/users', '/posts', '/comments', '/activity']) {
      const res = await request(app).get(`/api/v1/admin${path}`).set(auth(user.token));
      expect(res.status).toBe(403);
    }
    const del = await request(app).delete(`/api/v1/admin/users/${user.id}`).set(auth(user.token));
    expect(del.status).toBe(403);
  });

  it('returns dashboard totals for users, posts and comments', async () => {
    const admin = await registerAdmin('admin1@example.com');
    const user = await registerUser('u1@example.com');
    const post = await createPost(user.token);
    await createPost(user.token, 'Second Post Title');
    await request(app).post(`/api/v1/posts/${post.id}/comments`).set(auth(user.token)).send({ content: 'hello' });

    const res = await request(app).get('/api/v1/admin/stats').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ users: 2, posts: 2, comments: 1 });
  });

  it('lists users with search and pagination, without leaking passwords', async () => {
    const admin = await registerAdmin('admin2@example.com');
    await registerUser('alice@example.com', 'Alice Wonder');
    await registerUser('bob@example.com', 'Bob Builder');

    const all = await request(app).get('/api/v1/admin/users?limit=2').set(auth(admin.token));
    expect(all.body.data.items).toHaveLength(2);
    expect(all.body.data.pagination.total).toBe(3);
    expect(JSON.stringify(all.body)).not.toContain('password');

    const search = await request(app).get('/api/v1/admin/users?q=alice').set(auth(admin.token));
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].email).toBe('alice@example.com');

    const regexChars = await request(app).get('/api/v1/admin/users?q=.*').set(auth(admin.token));
    expect(regexChars.body.data.items).toHaveLength(0);
  });

  it('changes a user role but not the admin\'s own role', async () => {
    const admin = await registerAdmin('admin3@example.com');
    const user = await registerUser('promote@example.com');

    const ok = await request(app).patch(`/api/v1/admin/users/${user.id}/role`).set(auth(admin.token)).send({ role: 'admin' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.role).toBe('admin');

    const bad = await request(app).patch(`/api/v1/admin/users/${user.id}/role`).set(auth(admin.token)).send({ role: 'superuser' });
    expect(bad.status).toBe(400);

    const self = await request(app).patch(`/api/v1/admin/users/${admin.id}/role`).set(auth(admin.token)).send({ role: 'user' });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('deletes a user, soft-deleting their posts and removing their comments', async () => {
    const admin = await registerAdmin('admin4@example.com');
    const victim = await registerUser('victim@example.com');
    const post = await createPost(victim.token);
    await request(app).post(`/api/v1/posts/${post.id}/comments`).set(auth(victim.token)).send({ content: 'bye' });

    const self = await request(app).delete(`/api/v1/admin/users/${admin.id}`).set(auth(admin.token));
    expect(self.status).toBe(400);

    const res = await request(app).delete(`/api/v1/admin/users/${victim.id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(await UserModel.findById(victim.id)).toBeNull();
    expect((await PostModel.findById(post.id))?.isDeleted).toBe(true);
    expect(await CommentModel.countDocuments({ author: victim.id })).toBe(0);

    const missing = await request(app).delete(`/api/v1/admin/users/${victim.id}`).set(auth(admin.token));
    expect(missing.status).toBe(404);
  });

  it('manages posts: list by status, delete any post, restore', async () => {
    const admin = await registerAdmin('admin5@example.com');
    const user = await registerUser('writer@example.com');
    const post = await createPost(user.token);

    const del = await request(app).delete(`/api/v1/admin/posts/${post.id}`).set(auth(admin.token));
    expect(del.status).toBe(200);

    const active = await request(app).get('/api/v1/admin/posts').set(auth(admin.token));
    expect(active.body.data.items).toHaveLength(0);
    const deleted = await request(app).get('/api/v1/admin/posts?status=deleted').set(auth(admin.token));
    expect(deleted.body.data.items).toHaveLength(1);
    expect(deleted.body.data.items[0].isDeleted).toBe(true);

    const restored = await request(app).patch(`/api/v1/admin/posts/${post.id}/restore`).set(auth(admin.token));
    expect(restored.status).toBe(200);
    const all = await request(app).get('/api/v1/admin/posts?status=all').set(auth(admin.token));
    expect(all.body.data.items[0].isDeleted).toBe(false);

    const again = await request(app).patch(`/api/v1/admin/posts/${post.id}/restore`).set(auth(admin.token));
    expect(again.status).toBe(404);
  });

  it('manages comments: list with post info and delete', async () => {
    const admin = await registerAdmin('admin6@example.com');
    const user = await registerUser('commenter@example.com');
    const post = await createPost(user.token, 'Commented Post');
    const created = await request(app).post(`/api/v1/posts/${post.id}/comments`).set(auth(user.token)).send({ content: 'spam' });

    const list = await request(app).get('/api/v1/admin/comments').set(auth(admin.token));
    expect(list.body.data.items[0].post.title).toBe('Commented Post');
    expect(list.body.data.items[0].author.name).toBe('Test User');

    const del = await request(app).delete(`/api/v1/admin/comments/${created.body.data.id}`).set(auth(admin.token));
    expect(del.status).toBe(200);
    expect(await CommentModel.countDocuments()).toBe(0);
  });

  it('records user activity and exposes it to admins', async () => {
    const admin = await registerAdmin('admin7@example.com');
    const user = await registerUser('active@example.com');
    const post = await createPost(user.token);
    await request(app).delete(`/api/v1/posts/${post.id}`).set(auth(user.token));

    const logged = await waitFor(async () => (await ActivityLogModel.countDocuments({ action: 'POST_DELETED' })) === 1);
    expect(logged).toBe(true);
    expect(await ActivityLogModel.countDocuments({ action: 'POST_CREATED' })).toBe(1);
    expect(await ActivityLogModel.countDocuments({ action: 'USER_REGISTERED' })).toBeGreaterThanOrEqual(2);
    expect(await ActivityLogModel.countDocuments({ action: 'USER_LOGIN' })).toBe(1);

    const res = await request(app).get('/api/v1/admin/activity').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0]).toHaveProperty('action');
  });

  it('does not record failed requests', async () => {
    await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'wrongpassword' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await ActivityLogModel.countDocuments({ action: 'USER_LOGIN' })).toBe(0);
  });
});
