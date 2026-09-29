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
  // Sin esto, el escaneo inicial de `npm run dev` solo sigue los imports
  // ESTÁTICOS alcanzables desde el punto de entrada — cualquier página que
  // solo se visita después de navegar (Insumos, Configuración, etc.) podía
  // revelar dependencias de node_modules que Vite no había pre-empaquetado
  // todavía. Al descubrirlas recién ahí, Vite dispara una RE-OPTIMIZACIÓN +
  // recarga completa de la pestaña en pleno medio de la navegación — eso es
  // lo que se veía como "la URL cambia pero la pantalla se queda trabada"
  // (con varias recargas encimándose, nunca llegaba a asentarse una sola).
  // No pasa en producción (`vite build` no tiene este mecanismo), pero rompía
  // la experiencia de desarrollo. Con `entries` acá, el escaneo inicial cubre
  // TODAS las páginas de una, así no hay sorpresas a mitad de sesión.
  optimizeDeps: {
    entries: [
      'index.html',
      'src/paginas/**/*.jsx',
      'src/componentes/**/*.jsx',
    ],
  },
})
