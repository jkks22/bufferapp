import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // Inyecta un timestamp de build en sw.js para que cada deploy invalide la caché anterior
    {
      name: 'sw-version-inject',
      apply: 'build',
      closeBundle() {
        const swPath = resolve(__dirname, 'dist/sw.js')
        const content = readFileSync(swPath, 'utf8')
        writeFileSync(
          swPath,
          content.replace(
            'self.__CACHE_VERSION__ || Date.now()',
            String(Date.now())
          )
        )
      },
    },
  ],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/hooks/**'],
      exclude: ['src/pages/**', 'src/components/**'],
    }
  }
})
