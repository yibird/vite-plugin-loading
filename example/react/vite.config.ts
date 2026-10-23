import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { appLoading } from '@starweave-lab/vite-plugin-loading'

export default defineConfig({
  plugins: [
    appLoading({
      type: 'beat',
      classPrefix: 'react-loader',
      themeColor: 'var(--example-primary, #ffb300)',
      maskBackground: true,
      title: 'React 控制台',
    }),
    react(),
  ],
  server: {
    port: 5174,
  },
})
