import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@taxima/shared': resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  server: { port: 3201, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
});
