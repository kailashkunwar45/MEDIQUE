import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server } from 'http';

let io: SocketIOServer;

export const initSocket = async (server: Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.log('Redis Pub Client Error', err));
    subClient.on('error', (err) => console.log('Redis Sub Client Error', err));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.io Redis adapter enabled');
  } else {
    console.log('Redis URL not provided, Socket.io running in memory mode');
  }

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Join a room for a specific doctor's queue
    socket.on('joinQueue', (data: { hospitalId: string; doctorId: string }) => {
      const room = `queue_${data.hospitalId}_${data.doctorId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
