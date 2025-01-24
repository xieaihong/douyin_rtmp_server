import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  
  return {
    plugins: [vue()],
    server: {
      port: env.VITE_APP_PORT || 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_APP_API_URL || 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  }
}) 