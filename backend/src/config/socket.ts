import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from './env';
import { verifyAccessToken } from '../utils/jwt';

let io: Server | null = null;

export const userRoom = (userId: string): string => `user:${userId}`;

/** Attaches Socket.io to the HTTP server. Clients authenticate with their access token. */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: env.CLIENT_URL, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    try {
      socket.data.userId = verifyAccessToken(token).sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.userId as string));
  });

  return io;
}

export function closeSocket(): Promise<void> {
  const current = io;
  io = null;
  return new Promise((resolve) => (current ? current.close(() => resolve()) : resolve()));
}

/** No-op when Socket.io is not running (e.g. in unit tests), so callers never need to check. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
