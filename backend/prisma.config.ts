// ============================================================================
// Prisma Config — Backend
//
// Apunta al schema ubicado en ../database/prisma/schema.prisma
// y genera el client en node_modules del backend.
// ============================================================================
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "../database/prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
