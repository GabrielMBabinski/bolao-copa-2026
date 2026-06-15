import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false, // O GOLPE FINAL: Desliga o "tradutor" de código
    minify: true,     // Garante que o Vite vai esmagar e embaralhar tudo
  }
})