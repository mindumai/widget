import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Library build:
 *   - dist/widget.js       — ES module for npm consumers
 *   - dist/widget.iife.js  — self-invoking IIFE for <script src=...> embedding
 *
 * Bundle target: <50KB gzipped (NFR-005). CI gate runs `npm run size` after build.
 *
 * Dev server (`npm run dev`) serves `index.html` which loads the widget directly
 * for fast iteration — no Laravel app needed during pure-UI development.
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'MindumWidget',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'iife' ? 'widget.iife.js' : 'widget.js'),
    },
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      // The widget is self-contained — no externals.
      external: [],
      output: {
        // Inline all dynamic imports so the <script src> bundle is a single file.
        inlineDynamicImports: true,
      },
    },
    target: 'es2020',
  },
  server: {
    port: 5173,
  },
});
