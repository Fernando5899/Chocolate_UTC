# Usamos Node.js 20 o superior
FROM node:20-slim AS base
WORKDIR /app

# Instalamos dependencias
COPY package*.json ./
RUN npm install

# Copiamos el código y generamos Prisma Client
COPY . .
RUN npx prisma generate

# Construimos el proyecto Astro
RUN npm run build

# Configuramos el entorno de ejecución
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Comando para iniciar el servidor
CMD ["node", "./dist/server/entry.mjs"]