// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import auth from 'auth-astro';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  // Si SITE_URL no existe en el .env, usa localhost por defecto
  site: process.env.SITE_URL || 'http://localhost:4321',

  server: {
    // Azure usa el puerto que él quiera, por eso usamos process.env.PORT
    port: process.env.PORT ? parseInt(process.env.PORT) : 4321,
    host: true
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true
    }
  },

  integrations: [auth()],

  adapter: node({
    mode: 'standalone'
  })
});