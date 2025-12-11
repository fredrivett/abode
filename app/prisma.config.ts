import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Only load .env file in local development (not in CI/production where env vars are injected)
if (!process.env.VERCEL && !process.env.CI) {
  loadDotenv();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
