import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    environmentOptions: {
      // jsdom v27+ refuses to expose localStorage on an opaque origin
      // (the default about:blank-ish URL), so we hand it a real origin.
      jsdom: { url: 'http://localhost:3000/' },
    },
  },
});
