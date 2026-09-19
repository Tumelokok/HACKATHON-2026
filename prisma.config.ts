import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "postgresql://campuscrisis:campuscrisis_dev@localhost:5432/campuscrisisagent?schema=public",
  },
});
