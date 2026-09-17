/* eslint-disable no-undef */
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Versión de este build: hash corto de git + timestamp, para poder detectar
// desde el propio frontend cuando el navegador quedó con una versión vieja
// cacheada (ver src/componentes/UpdateBanner.jsx). Si no hay git disponible
// en el entorno de build, cae a solo timestamp.
function getBuildVersion() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    return `${hash}-${Date.now()}`
  } catch {
    return String(Date.now())
  }
}

const APP_VERSION = getBuildVersion()

// Emite dist/version.json con la versión de este build, para que el
// frontend ya corriendo en el navegador pueda compararla contra la propia.
function versionFilePlugin() {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), versionFilePlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://lazarilloapp-backend.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
