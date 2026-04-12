import 'dotenv/config'; // <-- ¡Esta es la línea que faltaba!
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});