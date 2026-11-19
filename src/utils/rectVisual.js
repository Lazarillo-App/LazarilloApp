// src/utils/rectVisual.js
// Rectángulo de un elemento en píxeles REALES de pantalla, igual en todos los navegadores.
//
// La app tiene `#root { zoom: 0.9 }` (global.css). Chrome (desde la 128) y Firefox devuelven
// getBoundingClientRect() ya en píxeles de pantalla; Safari (WebKit) lo devuelve dividido por el
// zoom del elemento, o sea agrandado y corrido (Diego 19/11/2026: en Safari los recuadros de las
// guías quedaban mal encuadrados). Acá se detecta una vez cómo mide el navegador y, si es como
// Safari, se multiplica por el zoom efectivo del elemento.

let midePorZoom = null; // true = el navegador devuelve el rect sin aplicar el zoom (Safari)

function detectar() {
  if (midePorZoom !== null) return midePorZoom;
  try {
    const root = document.getElementById('root');
    const z = parseFloat(getComputedStyle(root).zoom);
    if (!root || !Number.isFinite(z) || Math.abs(z - 1) < 0.001) { midePorZoom = false; return midePorZoom; }
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:1px;visibility:hidden;pointer-events:none';
    root.appendChild(p);
    const w = p.getBoundingClientRect().width;
    root.removeChild(p);
    // Con zoom 0.9: Chrome/Firefox miden 90; Safari mide 100.
    midePorZoom = Math.abs(w - 100) < Math.abs(w - 100 * z);
  } catch {
    midePorZoom = false;
  }
  return midePorZoom;
}

/** Zoom efectivo del elemento: el producto del zoom de él y de sus contenedores. */
export function zoomEfectivo(el) {
  let z = 1;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const v = parseFloat(getComputedStyle(n).zoom);
    if (Number.isFinite(v) && v > 0) z *= v;
  }
  return z;
}

/** getBoundingClientRect() en píxeles de pantalla (corrige Safari con el zoom de #root). */
export function rectVisual(el) {
  const r = el.getBoundingClientRect();
  if (!detectar()) return r;
  const k = zoomEfectivo(el);
  if (Math.abs(k - 1) < 0.001) return r;
  const top = r.top * k; const left = r.left * k; const width = r.width * k; const height = r.height * k;
  return { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top };
}
