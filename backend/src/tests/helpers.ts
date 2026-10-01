import request from 'supertest';
import { app } from '../app';
import { UserModel } from '../models/User.model';

export const validContent = 'This is a sufficiently long piece of content for validation purposes.';

export async function registerUser(email: string, name = 'Test User') {
  const res = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'longenough1' });
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}

export async function registerAdmin(email: string) {
  const user = await registerUser(email, 'Admin User');
  await UserModel.findByIdAndUpdate(user.id, { role: 'admin' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'longenough1' });
  return { token: login.body.data.accessToken as string, id: user.id };
}

export async function createPost(token: string, title = 'A Post For Comments') {
  const res = await request(app)
    .post('/api/v1/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, content: validContent });
  return res.body.data as { id: string; slug: string };
}
