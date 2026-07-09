import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
})