// Control automático de pantallas (Diego 15/11/2026): recorre las secciones de la app
// en testing a varios anchos y marca lo que se rompe:
//   lateral   → la página es más ancha que la pantalla (scroll de costado / zoom-out en el celular)
//   fuera     → elementos cortados por el borde derecho
//   desbordan → textos que se salen de su caja
//   apretados → textos metidos en una columna angosta (una palabra por renglón)
//   pisados   → textos o campos encimados
// Uso (credenciales del usuario de pruebas, ver claude/acceso-pruebas.md en el proyecto):
//   LZ_EMAIL=.. LZ_PASS=.. LZ_NEGOCIO=147 node scripts/control-pantallas.cjs salida
// Opcionales: LZ_RUTAS=/clientes,/equipo  LZ_ANCHOS=360,390,1366  LZ_FRONT  LZ_BACK
// LZ_DIST=ruta/al/dist → prueba un build local antes de mergear
//   (VITE_BASE=/ VITE_BACKEND_URL=https://lazarillo-backend-testing.onrender.com/api npx vite build --outDir ...)
// Al terminar deja el usuario de pruebas otra vez en el negocio DEMO (225).
// En los anchos de celular guarda una captura de página completa por ruta en la carpeta de salida.
const { chromium } = require('playwright'); const fs = require('fs');
const FRONT = process.env.LZ_FRONT || 'https://lazarillo-testing.onrender.com';
const OUT = process.argv[2] || 'salida'; fs.mkdirSync(OUT, { recursive: true });
const RUTAS = (process.env.LZ_RUTAS || '/inicio,/menu,/insumos,/tableros,/rrhh/cronogramas,/rrhh/nomina,/m,/gestion,/gestion/conceptos,/gestion/medios-pago,/conciliacion,/movimientos-bancarios,/clientes,/equipo,/configuracion,/perfil,/super').split(',');
const ANCHOS = (process.env.LZ_ANCHOS || '360,390,1100,1366,1600,1920').split(',').map(Number);
const medir = (W) => {
  const anchoReal = innerWidth;
  const res = { scrollLateral: Math.max(0, document.documentElement.scrollWidth - W, anchoReal - W), fuera: [], desbordan: [], apretados: [], pisados: [], chicos: 0 };
  const visible = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && (r.width > 1 || r.height > 1); };
  const nombre = e => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('alt') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const textoPropio = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
  const enScroll = e => { let p = e.parentElement; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 2) return true; p = p.parentElement; } return false; };
  const fijo = e => { for (let p = e; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; };
  const textos = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!visible(e) || e.closest('[aria-hidden=true]')) continue;
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    const hoja = e.children.length === 0 || ['IMG', 'SVG', 'BUTTON', 'INPUT'].includes(e.tagName.toUpperCase());
    if (hoja && r.right > W + 2 && r.left < W && s.position !== 'fixed' && !enScroll(e)) res.fuera.push(nombre(e));
    if (hoja && r.right > W + 2 && r.left < W && s.position === 'fixed') res.fuera.push(nombre(e));
    if (textoPropio(e)) {
      if (s.overflow === 'visible' && e.scrollWidth > e.clientWidth + 2 && s.display !== 'inline') res.desbordan.push(nombre(e));
      const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
      if (W < 500 && r.width < W * 0.3 && r.height > lh * 5 && e.innerText.trim().split(/\s+/).length > 6) res.apretados.push(nombre(e));
      if (textos.length < 600 && r.top < 3000 && !fijo(e)) textos.push([e, r]);
    }
    if (W < 500 && (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && r.height < 32) res.chicos++;
  }
  for (let i = 0; i < textos.length; i++) for (let j = i + 1; j < textos.length; j++) {
    const [a, ra] = textos[i], [b, rb] = textos[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 6 && iy > 6) res.pisados.push(nombre(a) + ' ⟂ ' + nombre(b));
  }
  // un input encima de un texto también cuenta
  for (const inp of document.querySelectorAll('input,button')) { if (!visible(inp) || fijo(inp)) continue; const ri = inp.getBoundingClientRect();
    for (const [t, rt] of textos) { if (inp.contains(t) || t.contains(inp)) continue; const fc = inp.closest('.MuiFormControl-root,.MuiTextField-root,label'); if (fc && fc.contains(t)) continue; const ix = Math.min(ri.right, rt.right) - Math.max(ri.left, rt.left), iy = Math.min(ri.bottom, rt.bottom) - Math.max(ri.top, rt.top); if (ix > 6 && iy > 6) res.pisados.push(nombre(inp) + ' ⟂ ' + nombre(t)); } }
  for (const k of ['fuera', 'desbordan', 'apretados', 'pisados']) res[k] = [...new Set(res[k])].slice(0, 8);
  return res;
};
(async () => {
  const b = await chromium.launch(); const filas = [];
  for (const w of ANCHOS) {
    const movil = w < 500;
    const ctx = await b.newContext({ viewport: { width: w, height: movil ? 844 : 900 }, isMobile: movil, hasTouch: movil, deviceScaleFactor: movil ? 2 : 1,
      userAgent: movil ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    if (process.env.LZ_DIST) {
      // Probar un build local ANTES de mergear: el origen de testing sirve el dist (vite build con VITE_BASE=/)
      const path = require('path');
      await ctx.route(FRONT + '/**', async route => {
        const u = new URL(route.request().url()); let f = path.join(process.env.LZ_DIST, decodeURIComponent(u.pathname));
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(process.env.LZ_DIST, 'index.html');
        await route.fulfill({ path: f });
      });
    }
    const p = await ctx.newPage(); p.setDefaultTimeout(90000);
    await p.goto(FRONT + '/login'); await p.waitForSelector('input[type=password]');
    await p.locator('input:not([type=password]):visible').first().fill(process.env.LZ_EMAIL);
    await p.fill('input[type=password]', process.env.LZ_PASS); await p.keyboard.press('Enter');
    await p.waitForURL(u => !/login/.test(u.toString()), { timeout: 120000 });
    if (process.env.LZ_NEGOCIO) {
      const B = process.env.LZ_BACK || 'https://lazarillo-backend-testing.onrender.com/api';
      const tok = (await (await ctx.request.post(B + '/auth/login', { data: { email: process.env.LZ_EMAIL, password: process.env.LZ_PASS } })).json()).token;
      const r = await ctx.request.fetch(B + '/businesses/active', { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok }, data: { businessId: Number(process.env.LZ_NEGOCIO) } });
      if (!r.ok()) console.log('no pude cambiar de negocio', r.status());
      await p.evaluate(id => localStorage.setItem('activeBusinessId', id), process.env.LZ_NEGOCIO); await p.reload();
    }
    for (const ruta of RUTAS) {
      try {
        await p.goto(FRONT + ruta); await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
        await p.waitForTimeout(1500);
        const m = await p.evaluate(medir, w); const url = new URL(p.url()).pathname;
        const shot = `${OUT}/${process.env.LZ_NEGOCIO || ''}${ruta.replace(/\W+/g, '_')}_${w}.png`;
        if (movil) await p.screenshot({ path: shot, fullPage: true });
        const mal = m.scrollLateral > 0 || m.fuera.length || m.desbordan.length || m.apretados.length || m.pisados.length;
        filas.push({ ruta, w, url, ok: !mal, ...m, shot: movil ? shot : '' });
        console.log((mal ? '✗' : '✓'), w, ruta, url !== ruta ? '→' + url : '', m.scrollLateral ? 'lateral +' + m.scrollLateral + 'px' : '', m.fuera.length ? 'fuera:' + m.fuera.length : '', m.desbordan.length ? 'desbordan:' + m.desbordan.length : '', m.apretados.length ? 'apretados:' + m.apretados.length : '', m.pisados.length ? 'pisados:' + m.pisados.length : '', movil && m.chicos ? 'chicos:' + m.chicos : '');
      } catch (e) { filas.push({ ruta, w, error: String(e).slice(0, 120) }); console.log('! ', w, ruta, String(e).slice(0, 80)); }
    }
    if (process.env.LZ_NEGOCIO) {
      // el negocio activo vive en el servidor y lo comparten varios chats: siempre volver al de prueba (DEMO 225)
      const B = process.env.LZ_BACK || 'https://lazarillo-backend-testing.onrender.com/api';
      const tok = (await (await ctx.request.post(B + '/auth/login', { data: { email: process.env.LZ_EMAIL, password: process.env.LZ_PASS } })).json()).token;
      await ctx.request.fetch(B + '/businesses/active', { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok }, data: { businessId: 225 } });
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/resultado.json`, JSON.stringify(filas, null, 1)); await b.close();
})();
