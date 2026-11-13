// src/componentes/soporte/capturaPantalla.js
// Foto de lo que el cliente está viendo en Lazarillo, para mandarla con su pedido (13/11/2026).
// Usa html2canvas (el mismo que ya usa la app para exportar el menú), cargado solo cuando hace
// falta. Los elementos con data-no-captura (el chat de Anthony, el botón flotante) no salen.
const HTML2CANVAS = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const ANCHO_MAX = 1600;

let cargando = null;
function cargarHtml2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!cargando) {
    cargando = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = HTML2CANVAS;
      s.async = true;
      s.onload = () => res(window.html2canvas);
      s.onerror = () => { cargando = null; rej(new Error('No se pudo cargar html2canvas')); };
      document.head.appendChild(s);
    });
  }
  return cargando;
}

/** Devuelve un data URL JPEG de la parte visible de la pantalla (o tira error). */
export async function capturarPantalla() {
  const html2canvas = await cargarHtml2canvas();
  const escala = Math.min(window.devicePixelRatio || 1, 1.5);
  const lienzo = await html2canvas(document.body, {
    x: window.scrollX, y: window.scrollY,
    width: window.innerWidth, height: window.innerHeight,
    windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
    scale: escala, useCORS: true, logging: false, backgroundColor: '#ffffff',
    ignoreElements: (el) => el?.dataset?.noCaptura !== undefined,
  });
  return achicar(lienzo);
}

function achicar(lienzo) {
  if (lienzo.width <= ANCHO_MAX) return lienzo.toDataURL('image/jpeg', 0.82);
  const f = ANCHO_MAX / lienzo.width;
  const c = document.createElement('canvas');
  c.width = ANCHO_MAX;
  c.height = Math.round(lienzo.height * f);
  c.getContext('2d').drawImage(lienzo, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Una imagen elegida o pegada por el cliente (File/Blob) → data URL JPEG achicado. */
export function imagenADataUrl(archivo) {
  return new Promise((res, rej) => {
    if (!archivo || !/^image\//.test(archivo.type)) { rej(new Error('No es una imagen')); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      res(achicar(c));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
