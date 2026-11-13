// src/componentes/soporte/capturaPantalla.js
// Foto de lo que el cliente está viendo en Lazarillo, para mandarla con su pedido (13/11/2026).
// Los elementos con data-no-captura (el chat de Anthony, el botón flotante) no salen.
//
// 14/11: la primera versión fallaba en la app real: html2canvas 1.4.1 no entiende los colores
// modernos que usan varias pantallas (color-mix → el navegador los resuelve como color(srgb …)) y
// tira error. Ahora, en la copia que fotografía, esos colores se pasan a rgba antes de dibujar. Si
// igual falla, prueba con html-to-image (dibuja con el propio navegador). Si fallan los dos, el
// chat le ofrece al cliente sacar la captura él mismo (Win+Shift+S) y pegarla.
const HTML2CANVAS = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const ANCHO_MAX = 1600;
const CALIDAD = 0.82;

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

const fuera = (el) => el?.dataset?.noCaptura !== undefined;

// ── colores que html2canvas no entiende ──
const COLOR_RARO = /\b(?:color|oklab|oklch|lab|lch|color-mix)\(/i;
const COLOR_RARO_G = /\b(?:color|oklab|oklch|lab|lch)\([^()]*\)/gi;
const PROPS_COLOR = [
  'color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
  'border-left-color', 'outline-color', 'text-decoration-color', 'column-rule-color', 'caret-color',
  'background-image', 'box-shadow', 'text-shadow', 'fill', 'stroke',
];

/** Un color cualquiera → rgba(), pintando un píxel (sirve para cualquier formato que entienda el navegador). */
function conversor() {
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const memo = new Map();
  return (valor) => {
    if (memo.has(valor)) return memo.get(valor);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = valor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
    memo.set(valor, out);
    return out;
  };
}

/** En la copia del documento: pasa a rgba los colores modernos (en línea, gana sobre la hoja de estilos). */
export function normalizarColores(doc) {
  const aRgba = conversor();
  const vista = doc.defaultView || window;
  const fijar = (el, cs) => {
    for (const p of PROPS_COLOR) {
      const v = cs.getPropertyValue(p);
      if (v && COLOR_RARO.test(v)) el.style.setProperty(p, v.replace(COLOR_RARO_G, (m) => aRgba(m)), 'important');
    }
  };
  // Los ::before/::after no se pueden tocar en línea: se les pone una regla con el color ya resuelto.
  const reglas = [];
  let n = 0;
  for (const el of doc.querySelectorAll('*')) {
    fijar(el, vista.getComputedStyle(el));
    for (const pseudo of ['::before', '::after']) {
      const cs = vista.getComputedStyle(el, pseudo);
      if (!cs || cs.content === 'none' || cs.content === '') continue;
      const cambios = PROPS_COLOR
        .map((p) => [p, cs.getPropertyValue(p)])
        .filter(([, v]) => v && COLOR_RARO.test(v))
        .map(([p, v]) => `${p}: ${v.replace(COLOR_RARO_G, (m) => aRgba(m))} !important;`);
      if (!cambios.length) continue;
      if (!el.dataset.capPseudo) el.dataset.capPseudo = String(++n);
      reglas.push(`[data-cap-pseudo="${el.dataset.capPseudo}"]${pseudo}{${cambios.join('')}}`);
    }
  }
  if (reglas.length) {
    const st = doc.createElement('style');
    st.textContent = reglas.join('\n');
    doc.head.appendChild(st);
  }
}

// html2canvas dibuja los elementos fijos (barra de arriba, etc.) corridos cuando la página está
// scrolleada: en la copia se les suma el scroll para que salgan donde el cliente los ve.
function acomodarFijos(doc, sy) {
  if (!sy) return;
  const vista = doc.defaultView || window;
  for (const el of doc.querySelectorAll('body *')) {
    const cs = vista.getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    const top = parseFloat(cs.top);
    if (Number.isNaN(top)) continue;
    el.style.setProperty('top', `${top + sy}px`, 'important');
    el.style.setProperty('bottom', 'auto', 'important');
  }
}

async function conHtml2canvas() {
  const html2canvas = await cargarHtml2canvas();
  const sy = window.scrollY;
  return html2canvas(document.body, {
    x: window.scrollX, y: window.scrollY,
    width: window.innerWidth, height: window.innerHeight,
    windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
    scale: Math.min(window.devicePixelRatio || 1, 1.5), useCORS: true, logging: false, backgroundColor: '#ffffff',
    ignoreElements: fuera,
    onclone: (doc) => { normalizarColores(doc); acomodarFijos(doc, sy); },
  });
}

async function conHtmlToImage() {
  const { toCanvas } = await import('html-to-image');
  const raiz = document.body;
  const sx = window.scrollX; const sy = window.scrollY;
  const lienzo = await toCanvas(raiz, {
    backgroundColor: '#ffffff', pixelRatio: 1, cacheBust: false,
    width: Math.max(raiz.scrollWidth, window.innerWidth), height: Math.max(raiz.scrollHeight, window.innerHeight),
    filter: (n) => !(n instanceof HTMLElement && fuera(n)),
    imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  });
  // Recorta la parte que se ve.
  const c = document.createElement('canvas');
  c.width = window.innerWidth; c.height = window.innerHeight;
  c.getContext('2d').drawImage(lienzo, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Devuelve un data URL JPEG de la parte visible de la pantalla (o tira error). */
export async function capturarPantalla() {
  let lienzo;
  try {
    lienzo = await conHtml2canvas();
  } catch (e1) {
    console.warn('[captura] html2canvas falló, pruebo html-to-image:', e1?.message || e1);
    lienzo = await conHtmlToImage();
  }
  return achicar(lienzo);
}

function achicar(lienzo) {
  if (lienzo.width <= ANCHO_MAX) return lienzo.toDataURL('image/jpeg', CALIDAD);
  const f = ANCHO_MAX / lienzo.width;
  const c = document.createElement('canvas');
  c.width = ANCHO_MAX;
  c.height = Math.round(lienzo.height * f);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(lienzo, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', CALIDAD);
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
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      res(achicar(c));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
