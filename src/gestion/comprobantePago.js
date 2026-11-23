// src/gestion/comprobantePago.js
// Comprobante de pago adjunto (Diego 23/11/2026): subir el PDF o la foto de la transferencia, que el
// servidor lo guarde y lo lea (importe, fecha, ID, banco), abrirlo después y encontrar las facturas
// impagas que suman ese importe.
import { BASE, getSession } from '@/servicios/apiBase';
import { gestionFetch } from '@/servicios/apiGestion';

export const TIPOS_COMPROBANTE = 'application/pdf,image/png,image/jpeg,image/webp';

const aBase64 = (file) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => mal(new Error('No se pudo leer el archivo.'));
  r.readAsDataURL(file);
});

// Texto del comprobante, gratis y en el navegador: un PDF digital con pdf.js (ya está en la app) y una
// foto con OCR (Tesseract, se baja de jsDelivr solo la primera vez que alguien adjunta una foto).
let pdfjsP = null;
const pdfjs = () => (pdfjsP ||= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  .then(([mod, w]) => { mod.GlobalWorkerOptions.workerSrc = w.default; return mod; }));
let tessP = null;
const tesseract = () => (tessP ||= new Promise((ok, mal) => {
  if (window.Tesseract) return ok(window.Tesseract);
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  s.onload = () => ok(window.Tesseract);
  s.onerror = () => { tessP = null; mal(new Error('No se pudo cargar el lector de fotos.')); };
  document.head.appendChild(s);
}));
async function textoPdf(file) {
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let txt = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    // Un renglón por línea del PDF (hasEOL), para que las reglas encuentren «Importe» junto a su número.
    txt += c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  return txt.trim();
}
// Con tope de tiempo: si el OCR no responde (sin red, celular lento), se sigue sin texto y se completa a mano.
const conTope = (p, ms) => Promise.race([p, new Promise((_, mal) => setTimeout(() => mal(new Error('tiempo')), ms))]);
async function textoFoto(fileOCanvas) {
  const T = await conTope(tesseract(), 20000);
  const r = await conTope(T.recognize(fileOCanvas, 'spa'), 45000);
  return r?.data?.text || '';
}
// Un PDF escaneado no trae texto: se dibuja la primera página y se le pasa el OCR.
async function textoPdfEscaneado(file) {
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return textoFoto(canvas);
}
export async function textoDelComprobante(file) {
  try {
    if (file.type === 'application/pdf') {
      const t = await textoPdf(file);
      return t.replace(/\s/g, '').length > 30 ? t : await textoPdfEscaneado(file);
    }
    return await textoFoto(file);
  } catch (e) {
    console.warn('[comprobante] no se pudo sacar el texto:', e?.message || e);
    return '';
  }
}

// → { comprobanteId, nombre, datos: {importe, fecha, operacion, banco, tipo, destinatario}, medio, error }
export async function subirComprobante(file) {
  if (!file) return null;
  if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/i.test(file.type)) throw new Error('Subí un PDF o una foto (JPG o PNG).');
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo pasa los 5 MB.');
  const [archivo, texto] = await Promise.all([aBase64(file), textoDelComprobante(file)]);
  const r = await gestionFetch('/api/pagos-proveedor/comprobante', { method: 'POST', body: JSON.stringify({ archivo, mime: file.type, nombre: file.name, texto }) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'No se pudo subir el comprobante.');
  return d;
}

// Abre el comprobante en otra pestaña (la ventana se abre antes del pedido para que no la bloquee el navegador).
export async function abrirComprobante(id) {
  const w = window.open('', '_blank');
  const { token, activeBusinessId } = getSession();
  try {
    const r = await fetch(`${BASE}/businesses/${activeBusinessId}/gestion/pagos-proveedor/comprobante/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': activeBusinessId },
    });
    if (!r.ok) throw new Error('No se pudo abrir el comprobante.');
    const url = URL.createObjectURL(await r.blob());
    if (w) w.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}

// Las facturas impagas que suman el importe del comprobante (±$1). Primero las más viejas en orden
// (lo habitual: se paga lo atrasado); si no, la combinación con menos facturas entre las 16 más viejas.
// items: [{ clave, saldo, fecha }] → claves o null.
export function facturasQueSuman(items, importe, tol = 1) {
  if (!(importe > 0)) return null;
  const xs = items.filter((x) => x.saldo > 0.004).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i].saldo;
    if (Math.abs(s - importe) <= tol) return xs.slice(0, i + 1).map((x) => x.clave);
    if (s > importe + tol) break;
  }
  const n = Math.min(xs.length, 16);
  let mejor = null;
  for (let m = 1; m < 1 << n; m++) {
    let suma = 0, cant = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) { suma += xs[i].saldo; cant++; }
    if (Math.abs(suma - importe) <= tol && (!mejor || cant < mejor.cant)) mejor = { m, cant };
  }
  return mejor ? xs.slice(0, n).filter((_, i) => mejor.m & (1 << i)).map((x) => x.clave) : null;
}
