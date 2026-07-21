import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const getPrismaClient = (): PrismaClient => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
  }

  const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("sslmode=prefer") || connectionString.includes("ssl=true");
  
  const poolMax = process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 5;
  const poolIdleTimeout = process.env.DATABASE_POOL_IDLE_TIMEOUT ? parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT, 10) : 10000;
  const poolConnTimeout = process.env.DATABASE_POOL_CONN_TIMEOUT ? parseInt(process.env.DATABASE_POOL_CONN_TIMEOUT, 10) : 5000;

  const pool = new Pool({ 
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    max: poolMax,
    idleTimeoutMillis: poolIdleTimeout,
    connectionTimeoutMillis: poolConnTimeout
  });

  const isDebug = process.env.DEBUG === "true" || process.env.NODE_ENV !== "production";
  if (isDebug) {
    pool.on("connect", () => {
      console.log(`[DB Pool] Connection established. Total: ${pool.totalCount}`);
    });
    pool.on("error", (err) => {
      console.error("[DB Pool] Idle client error:", err.message);
    });
  }

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  // Store the client globally for both dev and production
  globalForPrisma.prisma = client;
  
  return client;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
