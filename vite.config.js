/* eslint-disable no-undef */
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',                     // ok para dev y GitHub Pages con base '/'. Cambia si hosteás en subcarpeta
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),     // 👈 alias
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
