import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the built bundle works from any path on a static host
  // (kineticgain.com/atlas/, a subdomain root, or file://) without a rebuild.
  base: './',
  server: { port: 5199, strictPort: true },
  build: {
    target: 'es2022',
    // The extracts chunk is ~500 KB and trips the default 500 KB warning. It is
    // already split off and dynamically imported, which is exactly what the
    // warning asks for, so the warning has nothing left to tell us.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /**
         * Three cache lifetimes, three chunks.
         *
         * The dataset is 288 KB and changes only when the source article is
         * re-scraped. Bundled with the app it would be re-downloaded on every
         * code change, so it gets its own chunk with its own content hash.
         * KaTeX is large and effectively frozen. Everything else in
         * node_modules moves at dependency-update pace.
         *
         * A string-keyed manualChunks was tried first and put only 11 KB in
         * vendor: matching by package name misses the deep entry points React
         * actually resolves to. Matching on the resolved path does not.
         */
        manualChunks(id) {
          if (id.includes('problems.generated.json')) return 'data';
          if (id.includes('node_modules/katex')) return 'katex';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});

