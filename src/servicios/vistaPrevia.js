// src/servicios/vistaPrevia.js
// "Ver como" (dueño): mientras está activa, la app no guarda nada. Se cortan los pedidos
// que modifican (POST/PUT/PATCH/DELETE) a la API y se avisa con el evento
// 'vista-previa:bloqueado'. Los GET pasan normal (es la sesión del dueño).
let activa = false;
let instalado = false;

// Pedidos que no guardan datos del negocio y tienen que seguir andando (cambiar de negocio, sesión).
const PERMITIDOS = [/\/businesses\/\d+\/select\b/, /\/businesses\/active\b/, /\/me\/active-business\b/, /\/auth\//];

const esApi = (url) => /\/api\//.test(String(url || ''));
const bloquea = (method, url) => {
  const m = String(method || 'GET').toUpperCase();
  if (!activa || m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  if (!esApi(url)) return false;
  return !PERMITIDOS.some((re) => re.test(String(url)));
};
const avisar = () => { try { window.dispatchEvent(new Event('vista-previa:bloqueado')); } catch { /* sin window */ } };

function instalar() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  const fetchOriginal = window.fetch?.bind(window);
  if (fetchOriginal) {
    window.fetch = (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url;
      const method = init?.method || (typeof input === 'object' && input?.method) || 'GET';
      if (bloquea(method, url)) {
        avisar();
        return Promise.resolve(new Response(JSON.stringify({ error: 'vista_previa', message: 'En "Ver como" no se guardan cambios.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
      return fetchOriginal(input, init);
    };
  }
  const XHR = window.XMLHttpRequest?.prototype;
  if (XHR) {
    const abrir = XHR.open;
    const enviar = XHR.send;
    XHR.open = function (method, url, ...resto) { this.__lzMetodo = method; this.__lzUrl = url; return abrir.call(this, method, url, ...resto); };
    XHR.send = function (...args) {
      if (bloquea(this.__lzMetodo, this.__lzUrl)) { avisar(); this.abort(); return undefined; }
      return enviar.apply(this, args);
    };
  }
}

export function setVistaPrevia(v) {
  activa = !!v;
  if (activa) instalar();
}
export const vistaPreviaActiva = () => activa;
