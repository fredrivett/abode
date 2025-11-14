import { defineConfig, env } from "prisma/config";
import { config as loadDotenv } from "dotenv";

loadDotenv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
