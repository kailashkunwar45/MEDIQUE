import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

const getRedisClient = async () => {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD });
    redisClient.on('error', (err) => console.log('Cache Redis Error', err));
    await redisClient.connect();
  }
  return redisClient;
};

export const cacheMiddleware = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const client = await getRedisClient();
    if (!client) return next();

    const key = `cache:${req.originalUrl}`;
    const cached = await client.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      client.setEx(key, ttlSeconds, JSON.stringify(body));
      return originalJson(body);
    };

    next();
  };
};
