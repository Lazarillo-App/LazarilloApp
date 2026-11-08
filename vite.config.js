/* eslint-disable no-undef */
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

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

// Ícono del escritorio del celular (apple-touch-icon, 180x180). El PNG vive como texto base64
// en src/assets/brand/apple-touch-icon.png.b64 (así se puede subir por la API de GitHub, que
// solo acepta texto) y el build lo escribe en dist/apple-touch-icon.png. En `npm run dev` lo
// sirve el middleware de abajo.
const ICONO_B64 = path.resolve(__dirname, 'src/assets/brand/apple-touch-icon.png.b64')
const leerIcono = () => Buffer.from(readFileSync(ICONO_B64, 'utf8').trim(), 'base64')
function iconoCelularPlugin() {
  return {
    name: 'icono-celular',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'apple-touch-icon.png', source: leerIcono() })
    },
    configureServer(server) {
      server.middlewares.use('/apple-touch-icon.png', (req, res) => {
        res.setHeader('Content-Type', 'image/png')
        res.end(leerIcono())
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), versionFilePlugin(), iconoCelularPlugin()],
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
