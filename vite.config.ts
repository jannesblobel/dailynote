import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sriPlugin } from './viteSriPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sriPlugin()],
  build: {
    // Optimize chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    // Generate sourcemaps for production debugging (optional)
    sourcemap: false,
    // Use esbuild for fast minification (default)
    minify: 'esbuild',
  },
})
