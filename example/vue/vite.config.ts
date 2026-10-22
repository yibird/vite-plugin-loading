import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { appLoading } from 'vite-plugin-loading'

export default defineConfig({
  plugins: [
    appLoading({
      type: 'beat',
      classPrefix: 'vue-loader',
      themeColor: 'var(--example-primary, #00c781)',
      maskBackground: true,
      title: 'Vue 工作区',
    }),
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
