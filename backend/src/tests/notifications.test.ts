import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { io as connect, Socket } from 'socket.io-client';
import { app } from '../app';
import { closeSocket, initSocket } from '../config/socket';
import { NotificationModel } from '../models/Notification.model';
import { createPost, registerAdmin, registerUser } from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function comment(token: string, postId: string, content = 'hello there') {
  return request(app).post(`/api/v1/posts/${postId}/comments`).set(auth(token)).send({ content });
}

describe('Notification REST API', () => {
  it('notifies the post author when someone else comments', async () => {
    const author = await registerUser('na1@example.com', 'Author');
    const fan = await registerUser('nf1@example.com', 'Fan');
    const post = await createPost(author.token, 'Notify Me');
    await comment(fan.token, post.id);

    const res = await request(app).get('/api/v1/notifications').set(auth(author.token));
    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(1);
    expect(res.body.data.notifications[0]).toMatchObject({
      type: 'comment',
      message: 'Fan commented on "Notify Me"',
      link: `/posts/${post.slug}`,
      read: false,
    });
  });

  it('does not notify users about their own comments', async () => {
    const author = await registerUser('na2@example.com');
    const post = await createPost(author.token);
    await comment(author.token, post.id);
    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it('notifies the owner when an admin removes their post or comment', async () => {
    const admin = await registerAdmin('nadmin@example.com');
    const owner = await registerUser('nowner@example.com');
    const post = await createPost(owner.token, 'Soon Removed');
    const created = await comment(owner.token, post.id, 'my comment');

    await request(app).delete(`/api/v1/comments/${created.body.data.id}`).set(auth(admin.token));
    await request(app).delete(`/api/v1/admin/posts/${post.id}`).set(auth(admin.token));

    const res = await request(app).get('/api/v1/notifications').set(auth(owner.token));
    const messages = res.body.data.notifications.map((n: { message: string }) => n.message);
    expect(messages).toContain('An administrator removed your post "Soon Removed"');
    expect(messages).toContain('An administrator removed one of your comments');
    expect(res.body.data.notifications.every((n: { type: string }) => n.type === 'moderation')).toBe(true);
  });

  it('does not notify the owner when they delete their own content', async () => {
    const owner = await registerUser('nself@example.com');
    const post = await createPost(owner.token);
    await request(app).delete(`/api/v1/posts/${post.id}`).set(auth(owner.token));
    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it('marks one or all notifications read, only for the owner', async () => {
    const author = await registerUser('na3@example.com');
    const fan = await registerUser('nf3@example.com');
    const post = await createPost(author.token);
    await comment(fan.token, post.id, 'one');
    await comment(fan.token, post.id, 'two');

    const list = await request(app).get('/api/v1/notifications').set(auth(author.token));
    const id = list.body.data.notifications[0].id;

    const stranger = await request(app).patch(`/api/v1/notifications/${id}/read`).set(auth(fan.token));
    expect(stranger.status).toBe(404);

    expect((await request(app).patch(`/api/v1/notifications/${id}/read`).set(auth(author.token))).status).toBe(200);
    expect((await request(app).get('/api/v1/notifications').set(auth(author.token))).body.data.unreadCount).toBe(1);

    expect((await request(app).post('/api/v1/notifications/read-all').set(auth(author.token))).status).toBe(200);
    expect((await request(app).get('/api/v1/notifications').set(auth(author.token))).body.data.unreadCount).toBe(0);
  });

  it('requires authentication and a valid id', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    const user = await registerUser('na4@example.com');
    expect((await request(app).patch('/api/v1/notifications/nope/read').set(auth(user.token))).status).toBe(400);
  });
});

describe('Socket.io real-time delivery', () => {
  let server: http.Server;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = http.createServer(app);
    initSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.close());
  });

  afterAll(async () => {
    await closeSocket();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function open(token?: string): Socket {
    const socket = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    return socket;
  }

  const once = <T>(socket: Socket, event: string, timeout = 3000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeout);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  it('rejects connections without a valid access token', async () => {
    for (const token of [undefined, 'garbage']) {
      const socket = open(token);
      const error = await once<Error>(socket, 'connect_error');
      expect(error.message).toBe('UNAUTHORIZED');
    }
  });

  it('pushes a notification to the post author immediately', async () => {
    const author = await registerUser('sa1@example.com', 'Author');
    const fan = await registerUser('sf1@example.com', 'Fan');
    const post = await createPost(author.token, 'Live Post');

    const socket = open(author.token);
    await once(socket, 'connect');
    const pending = once<{ message: string; read: boolean }>(socket, 'notification');
    await comment(fan.token, post.id);

    const pushed = await pending;
    expect(pushed.message).toBe('Fan commented on "Live Post"');
    expect(pushed.read).toBe(false);
  });

  it('does not deliver one user\'s notifications to another user', async () => {
    const author = await registerUser('sa2@example.com');
    const fan = await registerUser('sf2@example.com');
    const bystander = await registerUser('sb2@example.com');
    const post = await createPost(author.token);

    const bystanderSocket = open(bystander.token);
    await once(bystanderSocket, 'connect');
    const leaked = jest.fn();
    bystanderSocket.on('notification', leaked);

    await comment(fan.token, post.id);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(leaked).not.toHaveBeenCalled();
  });
});
