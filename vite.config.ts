import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  root: 'src/client',
  plugins: [react()],
  // PROTOTYPE — the prototype is styled only by Chakra, so the current stylesheet is swapped for an empty one.
  resolve: mode === 'prototype'
    ? { alias: [{ find: /^\.\/style\.css$/, replacement: fileURLToPath(new URL('src/client/prototype/empty.css', import.meta.url)) }] }
    : {},
  build: { outDir: '../../dist/client', emptyOutDir: true },
}));
