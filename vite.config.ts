import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base` is set for GitHub Pages project-site hosting (served from /<repo>/).
// Override with BASE_PATH=/ when deploying to a root domain.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/3DSystemDesign/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
