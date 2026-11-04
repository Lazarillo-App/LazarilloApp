// scripts/gestion-tw.cjs — npm run css:gestion
// Las pantallas traídas de lazarillo_gestion (src/componentes/gestion/pagos) están escritas con clases
// de Tailwind. El resto de la app no usa Tailwind, así que acá se genera un CSS con solo esas clases y
// TODO encerrado bajo `.gestion-tw`: fuera de ese contenedor no cambia nada. El resultado se commitea
// (src/gestion/gestion-tw.css); hay que volver a correr esto si se usa una clase nueva en esas pantallas.
'use strict';
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

const ENTRADA = path.join(__dirname, 'gestion-tw.css');
const SALIDA = path.join(__dirname, '..', 'src', 'gestion', 'gestion-tw.css');
const RAIZ = '.gestion-tw';
const RAICES = new Set([':root', ':host', 'html', 'body']);

// Variables de color de lazarillo_gestion (app/globals.css, tema claro).
const VARIABLES = `
${RAIZ} {
  --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0); --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0); --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0); --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0); --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.696 0.17 162.48); --warning: oklch(0.769 0.188 70.08);
  --border: oklch(0.922 0 0); --input: oklch(0.922 0 0); --ring: oklch(0.708 0 0);
  font-family: inherit;
  color: var(--foreground);
}
${RAIZ} *, ${RAIZ} ::before, ${RAIZ} ::after { border-color: var(--border); }
${RAIZ} thead th {
  background: transparent !important; position: static !important; color: inherit;
  box-shadow: none; padding: 0; border-radius: 0; z-index: auto; text-align: inherit;
}
${RAIZ} tbody tr { background: transparent; box-shadow: none; border-radius: 0; }
`;

function encerrar(selector) {
  return selector.split(/,(?![^(]*\))/).map((s) => {
    const t = s.trim();
    if (RAICES.has(t)) return RAIZ;
    return `${RAIZ} ${t}`;
  }).join(', ');
}

(async () => {
  const css = fs.readFileSync(ENTRADA, 'utf8');
  const res = await postcss([tailwind({ base: path.join(__dirname, '..'), optimize: false })]).process(css, { from: ENTRADA });
  const raiz = postcss.parse(res.css);
  // Sin @layer: una regla en capa pierde contra cualquier CSS global sin capa, como el de `thead th`.
  raiz.walkAtRules('layer', (at) => { if (at.nodes) at.replaceWith(at.nodes); else at.remove(); });
  const extras = [];
  raiz.walkRules((r) => {
    if (r.parent?.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
    if (r.selector === RAIZ) return;
    const clase = r.selector.trim();
    // El CSS global fuerza fondo y posición de `thead th` con !important: la utilidad tiene que poder ganarle.
    const pisa = [];
    r.walkDecls((d) => { if (/^(background|background-color|position|top)$/.test(d.prop)) pisa.push(d); });
    if (pisa.length && /^\.[^\s,]+$/.test(clase) && r.parent?.type === 'root') {
      const copia = postcss.rule({ selector: `${RAIZ} thead th${clase}` });
      for (const d of pisa) copia.append({ prop: d.prop, value: d.value, important: true });
      extras.push(copia);
    }
    r.selector = encerrar(r.selector);
  });
  for (const e of extras) raiz.append(e);
  const salida = `/* GENERADO por scripts/gestion-tw.cjs (npm run css:gestion). No editar a mano. */\n${raiz.toString()}\n${VARIABLES}`;
  fs.writeFileSync(SALIDA, salida);
  console.log(`${path.relative(process.cwd(), SALIDA)}: ${Math.round(salida.length / 1024)} KB`);
})().catch((e) => { console.error(e); process.exit(1); });
