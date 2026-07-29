import { defineConfig, env } from "prisma/config";

// Load .env file manually for local development
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch (e) {
  // dotenv is only present in development environments
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
});
