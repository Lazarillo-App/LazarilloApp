// src/componentes/soporte/capturaDelSistema.js
// Capturas que el cliente saca con su compu (Win+Shift+S, Impr Pant, la herramienta de recortes) → se
// las ofrece Anthony para mandar como pedido (14/11/2026, pedido de la usuaria). Nunca se manda nada
// solo: se abre el chat grande con la imagen y el cliente elige enviar o cancelar.
//
// Dos caminos:
//  1. Pegar (Ctrl+V) una imagen en cualquier parte de Lazarillo que no sea un campo que la use:
//     funciona en todos los navegadores y no pide permiso.
//  2. Arrastrar y soltar una imagen sobre Lazarillo (en Mac: la miniatura de la esquina). Si
//     la suelta sobre una zona que ya recibe archivos (subir planillas, etc.) manda esa zona.
//  3. Automático: al volver a Lazarillo después de sacar la captura (o al apretar Impr Pant), se mira
//     si en el portapapeles hay una imagen NUEVA. Solo en Chrome/Edge y solo si el cliente lo activó
//     (el navegador le pide permiso una vez para "ver el portapapeles"). Se puede apagar.
const CLAVE_AUTO = 'lazarillo:anthony:capturas-auto';
const VENTANA_MS = 3 * 60 * 1000; // solo si volvió a la pestaña dentro de este rato

let ultimaFirma = null;

const leerPref = () => { try { return localStorage.getItem(CLAVE_AUTO); } catch { return null; } };
const guardarPref = (v) => { try { localStorage.setItem(CLAVE_AUTO, v); } catch { /* sin storage */ } };

/** ¿El navegador permite leer imágenes del portapapeles? (Chrome/Edge) */
/** ¿Es una Mac? (ahí la captura va al escritorio salvo que se cambie a "Portapapeles") */
export function esMac() {
  if (typeof navigator === 'undefined') return false;
  const p = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac/i.test(p) && !(navigator.maxTouchPoints > 1); // un iPad se presenta como Mac
}

export function autoDisponible() {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.read && !!navigator.permissions?.query;
}

async function permiso() {
  try { return (await navigator.permissions.query({ name: 'clipboard-read' })).state; } catch { return 'no'; }
}

/** 'activo' | 'apagado' | 'no' (navegador sin soporte) */
export async function estadoAuto() {
  if (!autoDisponible()) return 'no';
  if (leerPref() !== '1') return 'apagado';
  return (await permiso()) === 'granted' ? 'activo' : 'apagado';
}

async function firma(blob) {
  const buf = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
  let h = 0;
  for (let i = 0; i < buf.length; i += 1) h = ((h << 5) - h + buf[i]) | 0;
  return `${blob.size}:${h}`;
}

async function imagenDelPortapapeles() {
  const items = await navigator.clipboard.read();
  for (const it of items) {
    const t = it.types.find((x) => x.startsWith('image/'));
    if (t) return it.getType(t);
  }
  return null;
}

/** Lo llama un botón (hace falta un clic para que el navegador pida el permiso). */
export async function activarAuto() {
  if (!autoDisponible()) return 'no';
  try {
    const img = await imagenDelPortapapeles();
    // Lo que ya estaba copiado no se ofrece: solo las capturas que vengan después.
    ultimaFirma = img ? await firma(img) : null;
  } catch { /* sin permiso o portapapeles vacío */ }
  const st = await permiso();
  guardarPref(st === 'granted' ? '1' : '0');
  return st === 'granted' ? 'activo' : 'apagado';
}

export function apagarAuto() { guardarPref('0'); }

const esCampoQueUsaImagenes = (el) => !!el?.closest?.('[data-no-captura], [data-acepta-imagen]');

/**
 * Empieza a escuchar. onImagen(blob) se llama con cada captura nueva.
 * Devuelve la función para dejar de escuchar.
 */
export function escucharCapturasDelSistema(onImagen, { onArrastre } = {}) {
  let salioEn = 0;
  let viva = true;

  const revisar = async () => {
    if (!viva || leerPref() !== '1' || (await permiso()) !== 'granted') return;
    try {
      const img = await imagenDelPortapapeles();
      if (!img) return;
      const f = await firma(img);
      if (f === ultimaFirma) return;
      ultimaFirma = f;
      onImagen(img);
    } catch { /* sin foco o sin permiso: nada */ }
  };

  // Al arrancar: lo que ya hay copiado no se ofrece.
  (async () => {
    if (leerPref() !== '1' || (await permiso()) !== 'granted' || !document.hasFocus()) return;
    try { const img = await imagenDelPortapapeles(); ultimaFirma = img ? await firma(img) : null; } catch { /* nada */ }
  })();

  const alPegar = async (e) => {
    if (e.defaultPrevented || esCampoQueUsaImagenes(e.target)) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    const archivo = item.getAsFile();
    if (!archivo) return;
    e.preventDefault();
    ultimaFirma = await firma(archivo);
    onImagen(archivo);
  };
  const alSalir = () => { salioEn = Date.now(); };
  const alVolver = () => {
    if (!salioEn || Date.now() - salioEn > VENTANA_MS) return;
    salioEn = 0;
    setTimeout(revisar, 250);
  };
  const alTecla = (e) => { if (e.key === 'PrintScreen') setTimeout(revisar, 600); };

  // Arrastrar y soltar. Solo archivos de imagen; las zonas de la app que reciben archivos frenan el
  // evento (preventDefault) y ahí no nos metemos.
  let apagarAviso = null;
  const avisar = (v) => {
    clearTimeout(apagarAviso);
    onArrastre?.(v);
    if (v) apagarAviso = setTimeout(() => onArrastre?.(false), 300);
  };
  const traeImagen = (dt) => [...(dt?.items || [])].some((i) => i.kind === 'file' && i.type.startsWith('image/'));
  const alArrastrar = (e) => {
    if (!traeImagen(e.dataTransfer)) return;
    if (e.defaultPrevented || e.target?.closest?.('[data-acepta-imagen]')) { avisar(false); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    avisar(true);
  };
  const alSoltar = async (e) => {
    if (!traeImagen(e.dataTransfer)) return;
    avisar(false);
    // Sobre el chat grande también vale (cambia la imagen); solo se respetan las zonas que la usan.
    if (e.defaultPrevented || e.target?.closest?.('[data-acepta-imagen]')) return;
    e.preventDefault();
    const archivo = [...(e.dataTransfer.files || [])].find((x) => x.type.startsWith('image/'));
    if (!archivo) return;
    ultimaFirma = await firma(archivo);
    onImagen(archivo);
  };

  window.addEventListener('paste', alPegar);
  window.addEventListener('dragover', alArrastrar);
  window.addEventListener('drop', alSoltar);
  window.addEventListener('blur', alSalir);
  window.addEventListener('focus', alVolver);
  window.addEventListener('keyup', alTecla);
  return () => {
    viva = false;
    clearTimeout(apagarAviso);
    window.removeEventListener('paste', alPegar);
    window.removeEventListener('dragover', alArrastrar);
    window.removeEventListener('drop', alSoltar);
    window.removeEventListener('blur', alSalir);
    window.removeEventListener('focus', alVolver);
    window.removeEventListener('keyup', alTecla);
  };
}
