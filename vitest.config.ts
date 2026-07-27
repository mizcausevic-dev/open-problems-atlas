import { defineConfig } from 'vitest/config';

/**
 * Test config is separate from vite.config.ts on purpose.
 *
 * Vitest 2 ships its own copy of Vite 5, so a single config that imports both
 * `vitest/config` and the Vite 6 plugins produces two structurally different
 * `Plugin` types and a page of unassignability errors. Splitting them also
 * means the suite does not spin up the React and Tailwind plugins it has no use
 * for: every test here exercises library code, not rendered components.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
