import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// כל המשאבים נארזים מקומית – אין טעינה מ-CDN (דרישת עבודה אופליין).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
