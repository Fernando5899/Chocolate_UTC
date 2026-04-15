import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import auth from 'auth-astro';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  site: process.env.SITE_URL || 'https://tu-futuro-dominio.vercel.app',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [auth()],

  adapter: vercel()
});