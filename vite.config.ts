import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/supermart-grocery-dashboard/',
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/tests/setup.ts'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})

