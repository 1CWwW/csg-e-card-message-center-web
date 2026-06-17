import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/message-center': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
