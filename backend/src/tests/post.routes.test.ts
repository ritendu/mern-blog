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
