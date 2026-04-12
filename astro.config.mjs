// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import auth from 'auth-astro';

import node from '@astrojs/node';

export default defineConfig({
  output: 'server',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [auth()],

  adapter: node({
    mode: 'standalone'
  })
});