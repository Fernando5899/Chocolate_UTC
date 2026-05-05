import 'dotenv/config'; // Para cargar las variables de entorno desde el archivo .env
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});