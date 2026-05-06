import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';
import { createServer } from 'http';
import { initSocket } from './socket';

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  const server = createServer(app);
  await initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});
