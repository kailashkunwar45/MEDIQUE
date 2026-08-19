var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
const redis = require("redis");
let redisClient = null;
let redisFailed = false;

const getRedisClient = async () => {
  if (!process.env.REDIS_URL || redisFailed) return null;
  if (!redisClient) {
    try {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 1) {
              return new Error("Cache Redis connection failed");
            }
            return 500;
          }
        }
      });
      redisClient.on("error", (err) => {
        if (!redisFailed) {
          console.warn("Cache Redis Error:", err.message);
          redisFailed = true;
          redisClient?.disconnect().catch(() => {});
        }
      });
      await redisClient.connect();
    } catch {
      redisFailed = true;
      return null;
    }
  }
  return redisClient;
};
const cacheMiddleware = (ttlSeconds) => {
  return async (req, res, next) => {
    const client = await getRedisClient();
    if (!client) return next();
    const key = `cache:${req.originalUrl}`;
    const cached = await client.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      client.setEx(key, ttlSeconds, JSON.stringify(body));
      return originalJson(body);
    };
    next();
  };
};

module.exports = {
  cacheMiddleware: cacheMiddleware,
};
