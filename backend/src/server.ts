import http from 'http';
import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSocket } from './config/socket';

async function startServer(): Promise<void> {
  await connectDB(env.MONGO_URI);
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.PORT} (REST + Socket.io)`);
  });
}

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
