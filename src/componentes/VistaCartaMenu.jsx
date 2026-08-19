/* eslint-disable no-unused-vars */
// src/componentes/VistaCartaMenu.jsx
/* eslint-disable no-empty */
//
// Vista "carta / menú" de los artículos reales del negocio.
// Etapa 1: toma el árbol de artículos ya organizado en la tabla y lo maqueta
// como carta de restaurante (modo por rubro o por agrupación), con estilos
// editables (tipografías, colores, tamaño de hoja) y exportación a PDF.
//
// NO toca la organización real (agrupaciones, rubros, precios): es la misma
// información vista de otra manera. Todo el estado de diseño es local y solo
// sirve para exportar (no se persiste en esta etapa).
//
import React, { useMemo, useState, useCallback, useRef } from "react";

/* ───────────────────────── Tipografías (Google Fonts) ───────────────────────── */
const MENU_FONTS = [
  { label: "Sora + Archivo", d: "'Sora',sans-serif", b: "'Archivo',sans-serif", imp: "Sora:wght@600;700&family=Archivo:wght@400;600" },
  { label: "Playfair + Lato", d: "'Playfair Display',serif", b: "'Lato',sans-serif", imp: "Playfair+Display:wght@600;700;900&family=Lato:wght@400;700" },
  { label: "Cormorant + Montserrat", d: "'Cormorant Garamond',serif", b: "'Montserrat',sans-serif", imp: "Cormorant+Garamond:wght@600;700&family=Montserrat:wght@400;600" },
  { label: "Bebas + Archivo", d: "'Bebas Neue',sans-serif", b: "'Archivo',sans-serif", imp: "Bebas+Neue&family=Archivo:wght@400;600" },
  { label: "Libre Baskerville", d: "'Libre Baskerville',serif", b: "'Source Sans 3',sans-serif", imp: "Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600" },
  { label: "Oswald + Nunito", d: "'Oswald',sans-serif", b: "'Nunito Sans',sans-serif", imp: "Oswald:wght@500;600&family=Nunito+Sans:wght@400;600" },
  { label: "Abril + Poppins", d: "'Abril Fatface',serif", b: "'Poppins',sans-serif", imp: "Abril+Fatface&family=Poppins:wght@400;500" },
  { label: "DM Serif + DM Sans", d: "'DM Serif Display',serif", b: "'DM Sans',sans-serif", imp: "DM+Serif+Display&family=DM+Sans:wght@400;500" },
  { label: "Marcellus + Karla", d: "'Marcellus',serif", b: "'Karla',sans-serif", imp: "Marcellus&family=Karla:wght@400;600" },
  { label: "Fraunces + Work Sans", d: "'Fraunces',serif", b: "'Work Sans',sans-serif", imp: "Fraunces:wght@500;600;700&family=Work+Sans:wght@400;500" },
];
const MENU_INKS = ["#2a2320", "#1f2a37", "#3a1212", "#23402e", "#2d2150", "#402a12", "#0f2a3a", "#3a2330", "#143230", "#37231a"];
const MENU_LINES = ["dotted", "solid", "dashed", "double"];
const MENU_ORN = ["", "✦", "❖", "◆", "❉", "✻", "·", "—", "☙", "✿", "❀", "➳", "✺", "❧", "✠"];
const MENU_FRAMES = ["box", "line", "double", "none"];
const pickRnd = (a) => a[Math.floor(Math.random() * a.length)];

const loadScript = (src) => new Promise((res, rej) => {
  if ([...document.scripts].some((s) => s.src === src)) return res();
  const sc = document.createElement("script");
  sc.src = src; sc.onload = () => res(); sc.onerror = () => rej(new Error("no load " + src));
  document.head.appendChild(sc);
});
let _libsP = null;
const ensureLibs = () => {
  if (!_libsP) _libsP = (async () => {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  })();
  return _libsP;
};

const DISENO_BASE = {
  dFont: "'Sora',sans-serif", bFont: "'Archivo',sans-serif", fontImp: MENU_FONTS[0].imp,
  bg: "#ffffff", ink: "#2a2320", title: "#2a2320", price: null, leader: "#cfc7ba",
  line: "dotted", align: "left", upper: false, orn: "", frame: "box",
  // Etapa 2A+: controles finos de estilo
  itemGap: 3,        // interlineado entre ítems (px)
  logoAlign: "center", // posición del logo: left | center | right
  sectionSize: 16,   // tamaño de los títulos de sección (rubro)
  iconSize: 16,      // tamaño del icono de sección
  itemSize: 14.5,    // tamaño del nombre del artículo
  descSize: 11.5,    // tamaño de la descripción
};
function nuevoDisenoCfg(accent) {
  const f = pickRnd(MENU_FONTS), ink = pickRnd(MENU_INKS);
  return {
    dFont: f.d, bFont: f.b, fontImp: f.imp, bg: "#ffffff", ink,
    title: pickRnd([accent, ink, ink, pickRnd(MENU_INKS)]),
    leader: "#cfc7ba", line: pickRnd(MENU_LINES),
    align: pickRnd(["left", "left", "center"]), upper: Math.random() < 0.5,
    orn: pickRnd(MENU_ORN), frame: pickRnd(MENU_FRAMES),
  };
}

/* ───────────────────────── Íconos por nombre ───────────────────────── */
const ICON_MAP = [
  [/(hamburg|burger)/i, "🍔"], [/(cerveza|beer|pinta|\bipa\b|lager|porter|stout|chopp|birra)/i, "🍺"],
  [/(caf[eé]|espresso|capuc|latte|cortado|flat white)/i, "☕"], [/(pizza|muzza|fugazz|napolitana)/i, "🍕"],
  [/(gaseosa|coca|sprite|fanta|refresco|\bsoda\b)/i, "🥤"], [/(vino|malbec|cabernet|tinto|rosado)/i, "🍷"],
  [/(trago|c[oó]ctel|cocktail|\bgin\b|fernet|aperol|negroni|mojito|daiquiri|margarita|caipi|spritz)/i, "🍸"],
  [/(whisky|whiskey|vodka|\bron\b|tequila|licor|aperitivo)/i, "🥃"], [/(postre|torta|tarta|helado|brownie|\bflan\b|cheesecake|dulce|cookie|alfajor|waffle)/i, "🍰"],
  [/(papas|fritas|fries|nachos|picada)/i, "🍟"], [/(ensalada|salad|veggie)/i, "🥗"], [/(pollo|chicken|alita|nugget)/i, "🍗"],
  [/(carne|bife|asado|lomo|milanesa|milanga|steak|parrilla|bondiola)/i, "🥩"], [/(pasta|fideo|[ñn]oqui|raviol|sorrentino|tallar)/i, "🍝"],
  [/(taco|burrito|quesadilla|mexican)/i, "🌮"], [/(sushi|roll|nigiri|sashimi)/i, "🍣"],
  [/(sandwich|s[áa]ndwich|sangu|tostado|lomito|choripan|pancho|hot.?dog)/i, "🥪"], [/(jugo|exprimido|limonada|smoothie|batido)/i, "🧃"],
  [/(agua|mineral)/i, "💧"], [/(desayuno|merienda|medialun|factura|croissant|tostada)/i, "🥐"], [/(huevo|revuelto|omelette|brunch)/i, "🍳"],
  [/(queso|cheese)/i, "🧀"], [/(fruta|frutilla|banana)/i, "🍓"], [/(promo|combo|oferta|2x1)/i, "🎉"],
  [/(festejo|cumple|evento|fiesta)/i, "🎈"], [/(infusi[oó]n|\bt[eé]\b|mate)/i, "🍵"], [/(cervezas|bebidas)/i, "🍺"], [/(comidas|platos)/i, "🍽️"],
];
const iconFor = (name) => { const s = String(name || ""); for (const [re, ic] of ICON_MAP) if (re.test(s)) return ic; return ""; };

/* ───────────────────────── Geometría de papel ───────────────────────── */
const PAPER_SIZES = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], Oficio: [216, 330], Carta: [216, 279] };
const PX_PER_MM = 96 / 25.4;
function printGeom(size, orient, colsReq) {
  let [w, h] = PAPER_SIZES[size] || PAPER_SIZES.A4;
  if (orient === "h") { const t = w; w = h; h = t; }
  const margin = 11, gap = 7;
  const contentWmm = w - 2 * margin, contentHmm = h - 2 * margin;
  const contentWpx = contentWmm * PX_PER_MM, contentHpx = contentHmm * PX_PER_MM;
  const gapPx = gap * PX_PER_MM;
  const cols = colsReq && colsReq > 0 ? colsReq : Math.max(1, Math.min(4, Math.round(contentWpx / 340)));
  const colWpx = (contentWpx - (cols - 1) * gapPx) / cols;
  const scale = Math.max(0.9, Math.min(1.45, colWpx / 250));
  return { w, h, margin, gap, cols, contentWpx, contentHpx, gapPx, colWpx, scale, pageWpx: w * PX_PER_MM, pageHpx: h * PX_PER_MM };
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (s) => String(s ?? "").trim();
const isSin = (s) => { const v = clean(s).toLowerCase(); return v === "" || v === "sin categoría" || v === "sin categoria" || v === "sin subrubro" || v === "sin rubro" || v === "sin agrupación" || v === "sin agrupacion"; };

/* ───────────────────────────────────────────────────────────────────────────
   MODELO DE MAQUETA (Etapa 2A)

   La carta es una lista de HOJAS. Cada hoja tiene:
     { id, nombre, cols: 1..4, columnas: [ [seccionId, ...], ... ] }
   Las secciones viven aparte, indexadas por id:
     seccion = { id, titulo, itemIds: [artId, ...] }
   Y los artículos por id (para render).

   Estado inicial (según lo definido): cada rubro/agrupación arranca como su
   propia hoja de 1 columna, con su sección adentro.
─────────────────────────────────────────────────────────────────────────── */

// Aplana artículos a un diccionario por id.
function indexarArticulos(articulosPlano) {
  const byId = new Map();
  for (const a of articulosPlano) {
    if (!clean(a.nombre)) continue;
    byId.set(String(a.id), a);
  }
  return byId;
}

// Construye la maqueta inicial: una hoja por rubro/agrupación (según modo).
function maquetaInicial(articulosPlano, modo) {
  const activos = articulosPlano.filter((a) => clean(a.nombre));

  // Agrupar en secciones según el modo.
  const secciones = new Map(); // titulo -> [artIds]
  const push = (titulo, id) => {
    const t = titulo || "Otros";
    if (!secciones.has(t)) secciones.set(t, []);
    secciones.get(t).push(String(id));
  };

  if (modo === "rubro") {
    for (const a of activos) push(isSin(a.rubro) ? "Otros" : clean(a.rubro), a.id);
  } else {
    for (const a of activos) push((!clean(a.agrupacion) || isSin(a.agrupacion)) ? "Otros" : clean(a.agrupacion), a.id);
  }

  const seccionesObj = {};
  const hojas = [];
  let n = 0;
  for (const [titulo, itemIds] of secciones) {
    const sid = "sec-" + (n++);
    // ordenar ítems alfabéticamente al inicio
    const ordenados = itemIds.slice().sort((x, y) => {
      const ax = clean((articulosPlano.find(a => String(a.id) === x) || {}).nombre);
      const ay = clean((articulosPlano.find(a => String(a.id) === y) || {}).nombre);
      return ax.localeCompare(ay, "es");
    });
    seccionesObj[sid] = { id: sid, titulo, itemIds: ordenados };
    hojas.push({ id: "hoja-" + sid, nombre: titulo, cols: 1, columnas: [[sid]] });
  }
  return { hojas, secciones: seccionesObj, pool: { secciones: [], items: [] } };
}

// Maqueta vacía: una hoja en blanco + TODAS las secciones (rubro/agrupación) en el
// pool, listas para arrastrar. Es el arranque por defecto cuando no hay carta guardada:
// el usuario elige vista y arma su carta trayendo secciones.
function maquetaVacia(articulosPlano, modo) {
  const activos = articulosPlano.filter((a) => clean(a.nombre));
  const secciones = new Map();
  const push = (titulo, id) => {
    const t = titulo || "Otros";
    if (!secciones.has(t)) secciones.set(t, []);
    secciones.get(t).push(String(id));
  };
  if (modo === "rubro") {
    for (const a of activos) push(isSin(a.rubro) ? "Otros" : clean(a.rubro), a.id);
  } else {
    for (const a of activos) push((!clean(a.agrupacion) || isSin(a.agrupacion)) ? "Otros" : clean(a.agrupacion), a.id);
  }
  const seccionesObj = {};
  const poolSecciones = [];
  let n = 0;
  for (const [titulo, itemIds] of secciones) {
    const sid = "sec-" + (n++);
    const ordenados = itemIds.slice().sort((x, y) => {
      const ax = clean((articulosPlano.find(a => String(a.id) === x) || {}).nombre);
      const ay = clean((articulosPlano.find(a => String(a.id) === y) || {}).nombre);
      return ax.localeCompare(ay, "es");
    });
    seccionesObj[sid] = { id: sid, titulo, itemIds: ordenados };
    poolSecciones.push(sid);   // ← al pool, no a una hoja
  }
  // Una única hoja vacía para empezar a armar.
  const hojas = [{ id: "hoja-inicial", nombre: "NUEVA HOJA", cols: 1, columnas: [[]] }];
  return { hojas, secciones: seccionesObj, pool: { secciones: poolSecciones, items: [] } };
}

/* ───────────────────────────────────────────────────────────────────────────
   RECONCILIACIÓN (Etapa 2B)

   Toma la maqueta guardada + los artículos reales actuales y devuelve una
   maqueta válida:
   - Respeta orden/columnas/fusiones/quitados de lo guardado.
   - Ignora artículos que ya no existen (borrados/discontinuados).
   - Agrega artículos NUEVOS (que no estaban al guardar) al final de su sección
     natural (por rubro/agrupación según el modo). Si su sección no existe en la
     maqueta guardada, crea una hoja nueva para ellos.
─────────────────────────────────────────────────────────────────────────── */
function reconciliar(guardada, articulosPlano, modo) {
  const activos = articulosPlano.filter((a) => clean(a.nombre));
  const idsReales = new Set(activos.map((a) => String(a.id)));

  // Clonar la maqueta guardada (profundo simple)
  const hojas = (guardada.hojas || []).map((h) => ({
    ...h,
    columnas: (h.columnas || []).map((c) => c.slice()),
  }));
  const secciones = {};
  for (const [sid, sec] of Object.entries(guardada.secciones || {})) {
    // filtrar ítems que ya no existen
    secciones[sid] = { ...sec, itemIds: (sec.itemIds || []).filter((id) => idsReales.has(String(id))) };
  }

  // IDs de artículos que YA están ubicados en alguna sección de la maqueta
  const yaUbicados = new Set();
  for (const sec of Object.values(secciones)) {
    for (const id of sec.itemIds) yaUbicados.add(String(id));
  }

  // Título de sección natural de un artículo (según modo), igual que maquetaInicial
  const tituloNatural = (a) => {
    if (modo === "rubro") return isSin(a.rubro) ? "Otros" : clean(a.rubro);
    return (!clean(a.agrupacion) || isSin(a.agrupacion)) ? "Otros" : clean(a.agrupacion);
  };

  // Mapa título -> secId existente (para colgar nuevos en su sección natural)
  const secPorTitulo = new Map();
  for (const [sid, sec] of Object.entries(secciones)) {
    if (!secPorTitulo.has(sec.titulo)) secPorTitulo.set(sec.titulo, sid);
  }

  // Artículos nuevos (no ubicados): agruparlos por su título natural
  const nuevosPorTitulo = new Map();
  for (const a of activos) {
    if (yaUbicados.has(String(a.id))) continue;
    const t = tituloNatural(a);
    if (!nuevosPorTitulo.has(t)) nuevosPorTitulo.set(t, []);
    nuevosPorTitulo.get(t).push(String(a.id));
  }

  let nSec = Object.keys(secciones).length;
  let nHoja = hojas.length;
  for (const [titulo, ids] of nuevosPorTitulo) {
    const ordenados = ids.slice().sort((x, y) => {
      const ax = clean((activos.find((a) => String(a.id) === x) || {}).nombre);
      const ay = clean((activos.find((a) => String(a.id) === y) || {}).nombre);
      return ax.localeCompare(ay, "es");
    });
    const sidExistente = secPorTitulo.get(titulo);
    if (sidExistente) {
      // agregar al final de la sección existente
      secciones[sidExistente].itemIds.push(...ordenados);
    } else {
      // crear sección + hoja nueva para estos artículos nuevos
      const sid = "sec-new-" + (nSec++);
      secciones[sid] = { id: sid, titulo, itemIds: ordenados };
      hojas.push({ id: "hoja-" + sid, nombre: titulo, cols: 1, columnas: [[sid]] });
      secPorTitulo.set(titulo, sid);
      nHoja++;
    }
  }

  // Limpiar referencias a secciones vacías que quedaron en columnas (opcional: dejarlas)
  return { hojas, secciones, pool: guardada.pool || { secciones: [], items: [] } };
}

/* ───────────────────────── CSS de la carta (compartido preview/PDF) ───────────────────────── */
function cartaCss(diseno, negocio, scale) {
  const Dx = diseno;
  const accH = negocio?.accent || "#7a1f3d";
  const inkH = Dx.ink, titleH = Dx.title, ldH = Dx.leader;
  const priceH = Dx.price || accH;          // color de precios (default = acento)
  const bgH = Dx.bg || "#ffffff";           // color de fondo
  const gap = Dx.itemGap != null ? Dx.itemGap : 3;
  const upCss = Dx.upper ? "text-transform:uppercase;letter-spacing:.5px" : "";
  const s = scale || 1; const r = (n) => Math.round(n * s * 100) / 100;
  return `*{box-sizing:border-box}
.cart{font-family:${Dx.bFont};color:${inkH};background:${bgH}}
.logo{text-align:${Dx.logoAlign || "center"};margin-bottom:8px}.logo img{display:inline-block;max-height:${r(72)}px;max-width:55%;object-fit:contain}
.lab{text-align:center;font-size:${r(11)}px;letter-spacing:2px;color:${accH};font-weight:700}
.title{text-align:center;font-family:${Dx.dFont};font-size:${r(Dx.titleSize || 30)}px;font-weight:700;color:${titleH};margin:2px 0 4px}
.sep{width:46px;height:0;border-top:2px ${Dx.line === "double" ? "double" : Dx.line} ${accH};margin:0 auto 6px}
.rub{margin-bottom:${r(14)}px;break-inside:avoid}
.rt{font-family:${Dx.dFont};font-weight:700;font-size:${r(Dx.sectionSize || 16)}px;color:${titleH};border-bottom:2px ${Dx.line} ${accH};padding-bottom:3px;margin-bottom:7px;${upCss}}
.it{display:flex;align-items:baseline;gap:8px;margin-bottom:${r(gap)}px}
.nm{font-family:${Dx.dFont};font-weight:600;font-size:${r(Dx.itemSize || 14.5)}px;color:${inkH}}
.dots{flex:1;border-bottom:1px ${Dx.line} ${ldH};transform:translateY(-4px)}
.pr{font-weight:700;font-size:${r(Dx.itemSize || 14.5)}px;color:${priceH};font-variant-numeric:tabular-nums;white-space:nowrap}
.ds{font-size:${r(Dx.descSize || 11.5)}px;color:${inkH}99;font-style:italic;margin:0 0 ${r(Math.max(gap, 4))}px}
.ft{margin-top:16px;padding-top:12px;border-top:1px solid ${accH}66;text-align:center;font-size:${r(12.5)}px;color:${inkH}aa}
.ft .fl{display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:4px}.ft b{color:${inkH}}
.sepline{border-top:2px ${Dx.line} ${inkH};margin:${r(gap + 4)}px 0}`;
}

// Dado el viewMode de una agrupación (mismo valor que la tabla: 'by-subrubro' | 'by-categoria'),
// devuelve el campo del artículo por el que se subdivide en bloques dentro de la carta.
// Recordar la inversión: en la carta, a.rubro = subrubro DB (UI "Rubro"), a.sub = categoria DB (UI "Subrubro").
function campoBloqueDeViewMode(viewMode) {
  if (viewMode === "by-subrubro") return "rubro";   // UI "Rubro"
  if (viewMode === "by-categoria") return "sub";    // UI "Subrubro"
  return null;                                       // sin subdivisión
}

// HTML de una sección (título + ítems)
function seccionHtml(sec, artById, diseno, iconos) {
  if (!sec) return "";
  const Dx = diseno;
  const items = (sec.itemIds || []).map((id) => {
    // Separador visual
    if (String(id).startsWith("__sep__")) return `<div class="sepline"></div>`;
    const a = artById.get(String(id));
    if (!a) return "";
    const precio = a.precio != null && a.precio !== "" ? "$" + Number(a.precio).toLocaleString("es-AR") : "";
    return `<div class="it"><span class="nm">${esc(a.nombre)}</span><span class="dots"></span><span class="pr">${precio}</span></div>${a.descripcion ? `<div class="ds">${esc(a.descripcion)}</div>` : ""}`;
  }).join("");
  const icoRaw = iconos && iconos[sec.titulo] !== undefined ? iconos[sec.titulo] : iconFor(sec.titulo);
  const icoHtml = icoRaw ? `<span style="font-size:${Dx.iconSize || 16}px">${esc(icoRaw)}</span> ` : "";
  const titulo = sec.titulo
    ? `<div class="rt">${icoHtml}${Dx.orn ? esc(Dx.orn) + "  " : ""}${esc(sec.titulo)}</div>`
    : "";
  return `<div class="rub">${titulo}${items}</div>`;
}

// SVG de íconos para el footer (color configurable)
function svgIcon(net, c) {
  if (net === "instagram") return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${c}" stroke-width="2" style="flex-shrink:0"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="${c}" stroke="none"/></svg>`;
  if (net === "web") return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${c}" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg>`;
  if (net === "wifi") return `<svg viewBox="0 0 24 24" width="15" height="15" fill="${c}" style="flex-shrink:0"><path d="M12 18a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm0-4c-1.4 0-2.7.5-3.7 1.4l1.4 1.4c.6-.5 1.4-.8 2.3-.8s1.7.3 2.3.8l1.4-1.4A5.4 5.4 0 0 0 12 14zm0-4c-2.5 0-4.8 1-6.5 2.6l1.4 1.4A7.6 7.6 0 0 1 12 12c2 0 3.8.8 5.1 2l1.4-1.4A9.6 9.6 0 0 0 12 10zm0-4C8.1 6 4.6 7.6 2 10.1l1.4 1.4A11.6 11.6 0 0 1 12 8c3.3 0 6.3 1.3 8.6 3.5l1.4-1.4A13.6 13.6 0 0 0 12 6z"/></svg>`;
  if (net === "phone") return `<svg viewBox="0 0 24 24" width="15" height="15" fill="${c}" style="flex-shrink:0"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/></svg>`;
  return "";
}

// Header/footer de la hoja
function headerHtml(hoja, diseno, negocio, showLogo) {
  const Dx = diseno;
  const labelTxt = Dx.orn ? `${Dx.orn}  LA CARTA  ${Dx.orn}` : "LA CARTA";
  const logoHtml = (showLogo && negocio && negocio.logo) ? `<div class="logo"><img src="${esc(negocio.logo)}" crossorigin="anonymous" /></div>` : "";
  return `${logoHtml}`;
}
function footerHtml(negocio) {
  const c = negocio?.accent || "#7a1f3d";
  const filas = [];
  if (negocio?.instagram) filas.push(`<div class="fl">${svgIcon("instagram", c)}<span>${esc(negocio.instagram)}</span></div>`);
  if (negocio?.telefono) filas.push(`<div class="fl">${svgIcon("phone", c)}<span>${esc(negocio.telefono)}</span></div>`);
  if (negocio?.web) filas.push(`<div class="fl">${svgIcon("web", c)}<span>${esc(String(negocio.web).replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span></div>`);
  // WiFi: nombre de red + clave (si existen)
  if (negocio?.wifiNombre || negocio?.wifiClave) {
    const partes = [];
    if (negocio.wifiNombre) partes.push(`red: <b>${esc(negocio.wifiNombre)}</b>`);
    if (negocio.wifiClave) partes.push(`clave: <b>${esc(negocio.wifiClave)}</b>`);
    filas.push(`<div class="fl">${svgIcon("wifi", c)}<span>WiFi ${partes.join(" · ")}</span></div>`);
  }
  return filas.length ? `<div class="ft">${filas.join("")}</div>` : "";

}

/* ───────────────────────── PDF de una hoja (con columnas reales, paginado) ───────────────────────── */
async function exportarHoja(hoja, secciones, artById, diseno, negocio, showLogo, cfg, iconos) {
  const bgH = diseno.bg || "#ffffff";
  // Hoja física (mm) y márgenes
  const sizes = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], Oficio: [216, 330], Carta: [216, 279] };
  let [wmm, hmm] = sizes[cfg.size] || sizes.A4;
  if (cfg.orient === "h") { const t = wmm; wmm = hmm; hmm = t; }
  const margLat = 10, margVert = 10;
  const contentWmm = wmm - 2 * margLat;
  const contentHmm = hmm - 2 * margVert;

  // Render al ancho de CONTENIDO (para que el canvas mapee 1:1 al área del PDF).
  const renderWpx = Math.round(contentWmm * PX_PER_MM);
  const nCols = Math.max(1, (hoja.columnas || [[]]).length);
  const gapPx = Math.round(7 * PX_PER_MM);
  const colWpx = Math.floor((renderWpx - (nCols - 1) * gapPx) / nCols);
  const css = cartaCss(diseno, negocio, 1);

  const colsHtml = (hoja.columnas || []).map((colSecIds) => {
    const inner = (colSecIds || []).map((sid) => seccionHtml(secciones[sid], artById, diseno, iconos)).join("");
    return `<div class="pcol" style="width:${colWpx}px">${inner}</div>`;
  }).join("");

  const wrap = document.createElement("div");
  wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${renderWpx}px;background:${bgH}`;
  wrap.innerHTML = `<style>${css}.pgc{width:${renderWpx}px;background:${bgH}}.pcols{display:flex;gap:${gapPx}px;align-items:flex-start}</style>`
    + `<div class="cart pgc"><div>${headerHtml(hoja, diseno, negocio, showLogo)}</div><div class="pcols">${colsHtml}</div>${footerHtml(negocio)}</div>`;
  document.body.appendChild(wrap);

  try {
    await ensureLibs();
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { } }
    // Esperar que las imágenes (logo) carguen antes de capturar
    const imgs = [...wrap.querySelectorAll("img")];
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 3000); })));
    await new Promise((r) => setTimeout(r, 400));

    const cv = await window.html2canvas(wrap.querySelector(".pgc"), { scale: 2, backgroundColor: bgH, useCORS: true, logging: false });
    const fname = `${clean(hoja.nombre) || "carta"} (${cfg.size}${cfg.orient === "h" ? "\u00b7H" : ""})`;
    const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };

    if (cfg.fmt === "png") {
      await new Promise((res) => cv.toBlob((b) => { dl(b, fname + ".png"); res(); }, "image/png"));
      return;
    }

    const JSPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JSPDF) throw new Error("jsPDF no disponible");
    const pdf = new JSPDF({ orientation: wmm > hmm ? "landscape" : "portrait", unit: "mm", format: [wmm, hmm] });

    // El canvas mide contentWmm de ancho. Paginamos por alto de contenido.
    const pxPerMm = cv.width / contentWmm;
    const pageHpx = Math.floor(contentHmm * pxPerMm);
    const totalPages = Math.max(1, Math.ceil(cv.height / pageHpx));

    for (let p = 0; p < totalPages; p++) {
      const sliceTop = p * pageHpx;
      const sliceH = Math.min(pageHpx, cv.height - sliceTop);
      const tmp = document.createElement("canvas");
      tmp.width = cv.width; tmp.height = sliceH;
      const ctx = tmp.getContext("2d");
      ctx.fillStyle = bgH; ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(cv, 0, sliceTop, cv.width, sliceH, 0, 0, cv.width, sliceH);
      const imgHmm = sliceH / pxPerMm;
      if (p > 0) pdf.addPage([wmm, hmm], wmm > hmm ? "landscape" : "portrait");
      if (bgH.toLowerCase() !== "#ffffff") { pdf.setFillColor(bgH); pdf.rect(0, 0, wmm, hmm, "F"); }
      pdf.addImage(tmp.toDataURL("image/jpeg", 0.92), "JPEG", margLat, margVert, contentWmm, imgHmm);
    }
    dl(pdf.output("blob"), fname + ".pdf");
  } finally { try { document.body.removeChild(wrap); } catch { } }
}

/* ───────────────────────── Componente principal ───────────────────────── */
export default function VistaCartaMenu({
  articulos = [],
  negocio = {},
  accent = "#7a1f3d",
  cartaGuardada = null,
  onGuardarCarta = null,
  viewModeByGroup = {},
  agrupIdByNombre = {},
  onChangeViewMode = null,
  onRenombrarArticulo = null,
}) {
  // Si hay carta guardada, arrancamos desde ahí.
  const g = cartaGuardada && typeof cartaGuardada === "object" ? cartaGuardada : null;
  const [modo, setModo] = useState(g?.modo === "rubro" ? "rubro" : "agrupacion");
  const [diseno, setDiseno] = useState(() => (
    g?.estilos ? { ...DISENO_BASE, ...g.estilos } : { ...DISENO_BASE, ink: negocio?.ink || DISENO_BASE.ink, title: negocio?.ink || DISENO_BASE.title }
  ));
  const [showLogo, setShowLogo] = useState(g?.showLogo != null ? g.showLogo : true);
  const [printCfg, setPrintCfg] = useState({ size: "A4", orient: "v", fmt: "pdf" });
  const [printOpen, setPrintOpen] = useState(false);
  const [estilosOpen, setEstilosOpen] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [hojaActiva, setHojaActiva] = useState(0);
  const [fusionMode, setFusionMode] = useState(false);
  const [fusionSel, setFusionSel] = useState([]);
  const [sidebarTab, setSidebarTab] = useState("hojas"); // "hojas" | "pool"
  const [editSec, setEditSec] = useState(null); // secId cuyo título se edita
  // Estado de guardado: "idle" | "saving" | "saved"
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);
  const primeraRef = useRef(true); // evita autosave en el primer render
  // Descripciones escritas en la carta (por artId). No vienen de datos.
  const [editDesc, setEditDesc] = useState(null); // artId cuya descripción se está editando
  const [descripciones, setDescripciones] = useState(g?.descripciones && typeof g.descripciones === "object" ? g.descripciones : {});
  // Iconos elegidos manualmente por sección (override del automático). Se guardan en la carta.
  const [iconosPorTitulo, setIconosPorTitulo] = useState(g?.iconos && typeof g.iconos === "object" ? g.iconos : {});
  const [iconPickerFor, setIconPickerFor] = useState(null); // título de sección cuyo picker está abierto
  const [iconPickerPos, setIconPickerPos] = useState({ x: 0, y: 0 });
  // Contacto editable en la carta: arranca con lo guardado, o con lo del negocio.
  const [contacto, setContacto] = useState(() => (
    g?.contacto ? { ...g.contacto } : {
      instagram: negocio?.instagram || "",
      web: negocio?.web || "",
      telefono: negocio?.telefono || "",
      wifiNombre: negocio?.wifiNombre || "",
      wifiClave: negocio?.wifiClave || "",
    }
  ));

  const neg = useMemo(() => ({ ...negocio, ...contacto, accent }), [negocio, contacto, accent]);
  // Icono efectivo de una sección: override manual ('' = sin icono) o automático por nombre.
  const iconoDe = (titulo) => {
    const ov = iconosPorTitulo[titulo];
    return ov !== undefined ? ov : iconFor(titulo);
  };
  // Set curado de emojis para el picker (los que ya usa ICON_MAP + genéricos).
  const ICON_PICKER = [
    "🍔", "🍺", "☕", "🍕", "🥤", "🍷", "🍸", "🥃", "🍰", "🍟", "🥗", "🍗", "🥩", "🍝", "🌮",
    "🍣", "🥪", "🧃", "💧", "🥐", "🍳", "🧀", "🍓", "🍵", "🍴", "🍦", "🍩", "🥟", "🎉", "🎈",
    "🔥", "⭐", "✨", "❤️", "•", "◆", "★", "☆", "▪", "➤", "✓", "🌿", "🌸", "🥂", "🍽️", "📋",
  ];
  const artByIdBase = useMemo(() => indexarArticulos(articulos), [articulos]);
  // artById con las descripciones escritas en la carta aplicadas
  const artById = useMemo(() => {
    const m = new Map();
    for (const [id, a] of artByIdBase) {
      const desc = descripciones[id];
      m.set(id, desc != null && desc !== "" ? { ...a, descripcion: desc } : a);
    }
    return m;
  }, [artByIdBase, descripciones]);

  // ── Maquetas por modo: cada vista (rubro / agrupacion) guarda su propia
  //    composición. Cambiar de modo NO destruye la otra.
  //    Retrocompat: carta v1 tenía una sola `maqueta` guardada bajo `g.modo`.
  const [maquetasPorModo, setMaquetasPorModo] = useState(() => {
    const out = {};
    if (g?.maquetas && typeof g.maquetas === "object") {
      // Formato nuevo (v2): ya viene por modo
      if (g.maquetas.rubro) out.rubro = reconciliar(g.maquetas.rubro, articulos, "rubro");
      if (g.maquetas.agrupacion) out.agrupacion = reconciliar(g.maquetas.agrupacion, articulos, "agrupacion");
    } else if (g?.maqueta) {
      // Formato viejo (v1): una sola maqueta bajo el modo con que se guardó
      const modoGuardado = g?.modo === "rubro" ? "rubro" : "agrupacion";
      out[modoGuardado] = reconciliar(g.maqueta, articulos, modoGuardado);
    }
    // El modo activo debe tener maqueta sí o sí (si no, vacía)
    if (!out[modo]) out[modo] = maquetaVacia(articulos, modo);
    return out;
  });

  // La maqueta activa es la del modo actual.
  const maqueta = maquetasPorModo[modo] || maquetaVacia(articulos, modo);
  // Setter que escribe en el modo activo (mantiene la firma setMaqueta(fn|obj)).
  const setMaqueta = useCallback((updater) => {
    setMaquetasPorModo((prev) => {
      const actual = prev[modo] || maquetaVacia(articulos, modo);
      const siguiente = typeof updater === "function" ? updater(actual) : updater;
      return { ...prev, [modo]: siguiente };
    });
  }, [modo, articulos]);

  // Al cambiar de modo: si el nuevo modo aún no tiene maqueta, generar una vacía
  // (una sola vez). NO se pisa lo ya armado en ese modo.
  const maqRef = useRef({ modo });
  React.useEffect(() => {
    if (maqRef.current.modo !== modo) {
      maqRef.current = { modo };
      setMaquetasPorModo((prev) => prev[modo] ? prev : { ...prev, [modo]: maquetaVacia(articulos, modo) });
      setHojaActiva(0);
      setFusionMode(false); setFusionSel([]);
    }
  }, [modo, articulos]);

  const regenerar = useCallback(() => {
    setMaqueta(maquetaVacia(articulos, modo));
    setHojaActiva(0);
    setFusionMode(false); setFusionSel([]);
  }, [articulos, modo]);

  // Arma el objeto que se persiste en props.carta del negocio.
  // v2: guarda una maqueta por modo (rubro / agrupacion) para no perder lo armado
  // al cambiar de vista. `modo` es solo el modo activo al momento de guardar.
  const construirCarta = useCallback(() => ({
    version: 2,
    modo,
    showLogo,
    maquetas: maquetasPorModo,
    descripciones,
    iconos: iconosPorTitulo,
    estilos: diseno,
    contacto,
  }), [modo, showLogo, maquetasPorModo, descripciones, diseno, contacto]);

  // Guardado (usado por autosave y botón manual)
  const guardar = useCallback(async () => {
    if (!onGuardarCarta) return;
    try {
      setSaveState("saving");
      await onGuardarCarta(construirCarta());
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 2500);
    } catch {
      setSaveState("idle");
    }
  }, [onGuardarCarta, construirCarta]);

  // Autosave con debounce: cada cambio en la composición/estilos/etc dispara un
  // guardado ~1.5s después de que el usuario deja de tocar.
  React.useEffect(() => {
    if (!onGuardarCarta) return;
    if (primeraRef.current) { primeraRef.current = false; return; } // no guardar al montar
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { guardar(); }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquetasPorModo, descripciones, iconosPorTitulo, diseno, contacto, modo, showLogo]);

  const hojas = maqueta.hojas;
  const hoja = hojas[Math.min(hojaActiva, Math.max(0, hojas.length - 1))] || hojas[0];

  // Catálogo de secciones disponibles: todos los rubros/agrupaciones que existen
  // (según el modo), menos los que ya están en la carta. Reemplaza al viejo "Fuera".
  const catalogoDisponible = useMemo(() => {
    const activos = articulos.filter((a) => clean(a.nombre));
    const tituloDe = (a) => modo === "rubro"
      ? (isSin(a.rubro) ? "Otros" : clean(a.rubro))
      : ((!clean(a.agrupacion) || isSin(a.agrupacion)) ? "Otros" : clean(a.agrupacion));
    const conteo = {};
    for (const a of activos) { const t = tituloDe(a); conteo[t] = (conteo[t] || 0) + 1; }
    const usados = new Set();
    for (const h of maqueta.hojas || []) {
      for (const col of h.columnas || []) {
        for (const sid of col) {
          const s = maqueta.secciones[sid];
          if (s?.titulo) usados.add(s.titulo);
        }
      }
    }
    return Object.keys(conteo)
      .filter((t) => !usados.has(t))
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((t) => ({ titulo: t, count: conteo[t] }));
  }, [articulos, modo, maqueta]);

  /* ── Operaciones sobre la maqueta ── */

  const setCols = useCallback((n) => {
    setMaqueta((m) => {
      const hojas = m.hojas.map((h) => {
        if (h.id !== hoja.id) return h;
        const cols = Math.max(1, Math.min(4, n));
        // Redistribuir: juntar todas las secciones y repartirlas en las nuevas columnas
        const todas = h.columnas.flat();
        const columnas = Array.from({ length: cols }, () => []);
        todas.forEach((sid, i) => columnas[i % cols].push(sid));
        return { ...h, cols, columnas };
      });
      return { ...m, hojas };
    });
  }, [hoja]);

  // Mover una sección a otra columna/posición
  const moverSeccion = useCallback((secId, destColIdx, destPos) => {
    setMaqueta((m) => {
      const hojas = m.hojas.map((h) => {
        if (h.id !== hoja.id) return h;
        const columnas = h.columnas.map((c) => c.filter((s) => s !== secId));
        const dest = columnas[destColIdx] || columnas[0];
        const pos = destPos == null ? dest.length : Math.max(0, Math.min(dest.length, destPos));
        dest.splice(pos, 0, secId);
        return { ...h, columnas };
      });
      return { ...m, hojas };
    });
  }, [hoja]);

  // Mover un ítem dentro de su sección (reordenar)
  const moverItem = useCallback((secId, artId, destArtId) => {
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      const itemIds = sec.itemIds.filter((x) => x !== artId);
      // Posición destino = índice del item sobre el que se soltó, en la lista REAL (ya sin el arrastrado).
      // Resolver por identidad (artId) hace que el drop sea inmune al reordenamiento visual por bloques.
      let pos = itemIds.indexOf(destArtId);
      if (pos === -1) pos = itemIds.length; // soltó fuera de un item → al final
      itemIds.splice(pos, 0, artId);
      return { ...m, secciones: { ...m.secciones, [secId]: { ...sec, itemIds } } };
    });
  }, []);

  // Mover un bloque de rubro/sub completo dentro de su sección (reordenar bloques).
  // Saca todos los items cuyo campoBloque === rubroDesde y los reinserta en la
  // posición donde arranca rubroHasta. artById/campoBloque vienen del render.
  const moverBloque = useCallback((secId, campoBloque, rubroDesde, rubroHasta, resolver) => {
    if (!campoBloque || rubroDesde === rubroHasta) return;
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      const bloqueDe = (id) => {
        if (String(id).startsWith("__sep__")) return "";
        return resolver(id);
      };
      // ¿El bloque origen estaba antes o después del destino en la lista original?
      const idxDesde = sec.itemIds.findIndex((id) => bloqueDe(id) === rubroDesde);
      const idxHasta = sec.itemIds.findIndex((id) => bloqueDe(id) === rubroHasta);
      const bajando = idxDesde !== -1 && idxHasta !== -1 && idxDesde < idxHasta;

      // Items del bloque que se mueve (en su orden actual)
      const movidos = sec.itemIds.filter((id) => bloqueDe(id) === rubroDesde);
      if (!movidos.length) return m;
      const resto = sec.itemIds.filter((id) => bloqueDe(id) !== rubroDesde);

      let pos;
      if (bajando) {
        // Insertar DESPUÉS del último item del bloque destino
        let last = -1;
        resto.forEach((id, i) => { if (bloqueDe(id) === rubroHasta) last = i; });
        pos = last === -1 ? resto.length : last + 1;
      } else {
        // Insertar ANTES del primer item del bloque destino
        pos = resto.findIndex((id) => bloqueDe(id) === rubroHasta);
        if (pos === -1) pos = resto.length;
      }
      const itemIds = [...resto.slice(0, pos), ...movidos, ...resto.slice(pos)];
      return { ...m, secciones: { ...m.secciones, [secId]: { ...sec, itemIds } } };
    });
  }, []);

  // Saca de la sección todos los items cuyo bloque === rubro (los separadores se quedan).
  const quitarBloque = useCallback((secId, campoBloque, rubro, resolver) => {
    if (!campoBloque) return;
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      const itemIds = sec.itemIds.filter((id) => {
        if (String(id).startsWith("__sep__")) return true;
        return resolver(id) !== rubro;
      });
      return { ...m, secciones: { ...m.secciones, [secId]: { ...sec, itemIds } } };
    });
  }, []);


  // Quitar un ítem de la carta (de su sección)
  // Quitar un ítem: solo lo saca de la carta. Vuelve a estar disponible en el catálogo.
  const quitarItem = useCallback((secId, artId) => {
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      return {
        ...m,
        secciones: { ...m.secciones, [secId]: { ...sec, itemIds: sec.itemIds.filter((x) => x !== artId) } },
      };
    });
  }, []);

  // Quitar una sección: solo la saca de la carta. Vuelve a estar disponible en el catálogo.
  const quitarSeccion = useCallback((secId) => {
    setMaqueta((m) => {
      const hojas = m.hojas.map((h) => {
        if (h.id !== hoja.id) return h;
        return { ...h, columnas: h.columnas.map((c) => c.filter((s) => s !== secId)) };
      });
      return { ...m, hojas };
    });
  }, [hoja]);

  // Traer una sección del catálogo (rubro/agrupación) a la hoja activa.
  // La sección puede no existir aún en m.secciones: se crea con sus artículos.
  const traerSeccionDelCatalogo = useCallback((titulo, destColIdx) => {
    setMaqueta((m) => {
      // ¿Ya existe una sección con ese título? (por si estaba fuera de columnas)
      let secId = Object.keys(m.secciones).find((k) => m.secciones[k]?.titulo === titulo);
      let secciones = m.secciones;
      if (!secId) {
        // Crear la sección desde articulos según el modo actual
        const activos = articulos.filter((a) => clean(a.nombre));
        const itemIds = activos
          .filter((a) => {
            const t = modo === "rubro"
              ? (isSin(a.rubro) ? "Otros" : clean(a.rubro))
              : ((!clean(a.agrupacion) || isSin(a.agrupacion)) ? "Otros" : clean(a.agrupacion));
            return t === titulo;
          })
          .slice()
          .sort((x, y) => clean(x.nombre).localeCompare(clean(y.nombre), "es"))
          .map((a) => String(a.id));
        secId = "sec-" + Date.now();
        secciones = { ...m.secciones, [secId]: { id: secId, titulo, itemIds } };
      }
      const hojas = m.hojas.map((h) => {
        if (h.id !== hoja.id) return h;
        const columnas = h.columnas.map((c) => c.slice());
        const idx = Math.max(0, Math.min(columnas.length - 1, destColIdx ?? 0));
        if (!columnas.flat().includes(secId)) columnas[idx].push(secId);
        return { ...h, columnas };
      });
      return { ...m, secciones, hojas };
    });
  }, [hoja, articulos, modo]);

  // Fusionar hojas seleccionadas en la primera
  const fusionar = useCallback((ids) => {
    if (!ids || ids.length < 2) return;
    setMaqueta((m) => {
      const destino = m.hojas.find((h) => h.id === ids[0]);
      if (!destino) return m;
      const resto = new Set(ids.slice(1));
      // juntar todas las secciones de las hojas fusionadas en el destino, repartidas por sus columnas
      const seccionesDestino = destino.columnas.flat();
      for (const h of m.hojas) {
        if (resto.has(h.id)) seccionesDestino.push(...h.columnas.flat());
      }
      const cols = destino.cols;
      const columnas = Array.from({ length: cols }, () => []);
      seccionesDestino.forEach((sid, i) => columnas[i % cols].push(sid));
      const hojas = m.hojas
        .filter((h) => !resto.has(h.id))
        .map((h) => h.id === destino.id ? { ...h, columnas } : h);
      return { ...m, hojas };
    });
    setFusionMode(false); setFusionSel([]);
    setHojaActiva(0);
  }, []);

  const renombrarHoja = useCallback((hojaId, nombre) => {
    setMaqueta((m) => ({ ...m, hojas: m.hojas.map((h) => h.id === hojaId ? { ...h, nombre } : h) }));
  }, []);

  // Crear una hoja vacía (para armar desde cero arrastrando)
  const agregarHojaVacia = useCallback(() => {
    setMaqueta((m) => {
      const id = "hoja-vacia-" + Date.now();
      return { ...m, hojas: [...m.hojas, { id, nombre: "NUEVA HOJA", cols: 1, columnas: [[]] }] };
    });
    setHojaActiva((n) => n); // se ajusta abajo
    setTimeout(() => setHojaActiva(hojas.length), 0);
  }, [hojas.length]);

  // Renombrar el título de una sección (SOLO en la carta por ahora; en la semana
  // se conecta a renameRubro real para que afecte la tabla).
  const renombrarSeccion = useCallback((secId, titulo) => {
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      return { ...m, secciones: { ...m.secciones, [secId]: { ...sec, titulo } } };
    });
  }, []);

  // Insertar un separador (línea divisoria) en una sección, tras cierto ítem.
  const insertarSeparador = useCallback((secId, trasArtId) => {
    setMaqueta((m) => {
      const sec = m.secciones[secId];
      if (!sec) return m;
      const sepId = "__sep__" + Date.now();
      const idx = trasArtId ? sec.itemIds.indexOf(trasArtId) + 1 : sec.itemIds.length;
      const itemIds = sec.itemIds.slice();
      itemIds.splice(idx, 0, sepId);
      return { ...m, secciones: { ...m.secciones, [secId]: { ...sec, itemIds } } };
    });
  }, []);

  // Traer las secciones de una hoja (del sidebar) a una columna de la hoja activa.
  // La hoja origen se elimina (sus secciones migran). No hace nada si es la misma.
  const traerHojaAActiva = useCallback((origenId, destColIdx) => {
    setMaqueta((m) => {
      if (origenId === hoja.id) return m;
      const origen = m.hojas.find((h) => h.id === origenId);
      const destino = m.hojas.find((h) => h.id === hoja.id);
      if (!origen || !destino) return m;
      const secciones = origen.columnas.flat();
      const columnas = destino.columnas.map((c) => c.slice());
      const idx = Math.max(0, Math.min(columnas.length - 1, destColIdx ?? 0));
      columnas[idx].push(...secciones);
      const hojas = m.hojas
        .filter((h) => h.id !== origenId)
        .map((h) => h.id === destino.id ? { ...h, columnas } : h);
      return { ...m, hojas };
    });
  }, [hoja]);

  const descargar = useCallback(async () => {
    if (!hoja) return;
    try {
      setDlBusy(true);
      await exportarHoja(hoja, maqueta.secciones, artById, diseno, neg, showLogo, printCfg, iconosPorTitulo);
    } catch (e) {
      alert("No pude generar la descarga. Detalle: " + (e?.message || e));
    } finally { setDlBusy(false); setPrintOpen(false); }
  }, [hoja, maqueta, artById, diseno, neg, showLogo, printCfg, iconosPorTitulo]);

  /* ── Drag & drop ── */
  const dragRef = useRef(null); // { tipo:'seccion'|'item', secId, artId }

  const onDropCol = (destColIdx, destPos) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.tipo === "seccion") moverSeccion(d.secId, destColIdx, destPos);
    else if (d.tipo === "hoja") traerHojaAActiva(d.hojaId, destColIdx);
    else if (d.tipo === "catalogo-seccion") traerSeccionDelCatalogo(d.titulo, destColIdx);
    dragRef.current = null;
  };
  const onDropItem = (secId, destArtId) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.tipo === "item" && d.secId === secId) { moverItem(secId, d.artId, destArtId); dragRef.current = null; }
  };

  const css = useMemo(() => cartaCss(diseno, neg, 1), [diseno, neg]);

  const pill = (on, onClick, txt, title) => (
    <button onClick={onClick} title={title || ""} style={{
      padding: "5px 12px", borderRadius: 20, border: `1px solid ${on ? accent : "#d8d3ca"}`,
      background: on ? accent : "#fff", color: on ? "#fff" : "#2a2320",
      fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    }}>{txt}</button>
  );

  if (!articulos.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Todavía no hay artículos para armar la carta. Cargá o sincronizá productos primero.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {diseno.fontImp ? <style>{`@import url('https://fonts.googleapis.com/css2?family=${diseno.fontImp}&display=swap');`}</style> : null}
      <style>{css}</style>

      {/* Barra de controles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "6px 4px" }}>
        <div style={{ display: "inline-flex", background: "#f1f0ec", borderRadius: 10, padding: 3 }}>
          {[["agrupacion", "Por agrupación"], ["rubro", "Por rubro"]].map(([k, l]) => (
            <button key={k} onClick={() => setModo(k)}
              style={{ border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: modo === k ? accent : "transparent", color: modo === k ? "#fff" : accent }}>{l}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: "#e0dcd3" }} />

        {negocio?.logo && pill(showLogo, () => setShowLogo((v) => !v), "🖼️ Logo")}
        <button onClick={() => setDiseno(nuevoDisenoCfg(accent))} title="Diseño nuevo (tipografías, colores)"
          style={{ padding: "5px 14px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✨ Nuevo diseño</button>
        <button onClick={() => setDiseno({ ...DISENO_BASE, ink: negocio?.ink || DISENO_BASE.ink, title: negocio?.ink || DISENO_BASE.title })}
          style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid #d8d3ca", background: "#fff", color: "#777", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>↺</button>

        <select value={diseno.dFont}
          onChange={(e) => { const f = MENU_FONTS.find((x) => x.d === e.target.value) || MENU_FONTS[0]; setDiseno((d) => ({ ...d, dFont: f.d, bFont: f.b, fontImp: f.imp })); }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d8d3ca", fontSize: 12.5, cursor: "pointer", background: "#fff", color: "#2a2320" }}>
          {MENU_FONTS.map((f) => <option key={f.label} value={f.d}>{f.label}</option>)}
        </select>

        <button onClick={() => setEstilosOpen(true)} title="Colores, tamaños e interlineado"
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d8d3ca", background: "#fff", color: "#2a2320", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          🎨 Estilos
        </button>

        <div style={{ flex: 1 }} />

        {onGuardarCarta && (
          <>
            <span style={{ fontSize: 12, color: saveState === "saved" ? "#16a34a" : "#999", minWidth: 76, textAlign: "right" }}>
              {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : ""}
            </span>
            <button onClick={guardar} disabled={saveState === "saving"}
              title="Guardar la carta en el negocio"
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}`, background: "#fff", color: accent, fontSize: 13, fontWeight: 700, cursor: saveState === "saving" ? "default" : "pointer" }}>
              Guardar
            </button>
          </>
        )}

        <button onClick={() => setPrintOpen(true)} disabled={dlBusy}
          style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: dlBusy ? "#bbb" : "#2a2320", color: "#fff", fontSize: 13, fontWeight: 700, cursor: dlBusy ? "default" : "pointer" }}>
          {dlBusy ? "Generando…" : "⬇ Exportar"}
        </button>
      </div>

      {/* Cuerpo: sidebar de hojas + lienzo */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>

        {/* Sidebar con pestañas: Hojas / Fuera de la carta (pool) */}
        <div
          onDragOver={(e) => { if (dragRef.current?.tipo === "seccion" || dragRef.current?.tipo === "item") { e.preventDefault(); } }}
          onDrop={(e) => {
            const d = dragRef.current;
            if (d?.tipo === "seccion") { e.preventDefault(); quitarSeccion(d.secId); dragRef.current = null; }
            else if (d?.tipo === "item") { e.preventDefault(); quitarItem(d.secId, d.artId); dragRef.current = null; }
          }}
          style={{ background: "#faf9f7", border: "1px solid #eae7e0", borderRadius: 12, padding: 12, position: "sticky", top: 8, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 160px)" }}>

          <>

            {/* Footer de fusión */}
            {fusionMode && (
              <div style={{ borderTop: "1px solid #eae7e0", marginTop: 10, paddingTop: 10, flexShrink: 0, fontSize: 11, color: "#999", lineHeight: 1.4 }}>
                Elegí 2+ hojas y confirmá arriba. Se combinan en la primera.
              </div>
            )}

            {/* Disponibles: secciones que existen pero no están en la carta */}
            <div style={{ borderTop: "1px solid #eae7e0", marginTop: 10, paddingTop: 10, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Disponibles ({catalogoDisponible.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: 240, paddingRight: 4 }}>
                {catalogoDisponible.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "#bbb", padding: "8px 4px" }}>Todo está en la carta.</div>
                )}
                {catalogoDisponible.map(({ titulo, count }) => (
                  <div key={titulo} draggable
                    onDragStart={(e) => { dragRef.current = { tipo: "catalogo-seccion", titulo }; e.dataTransfer.effectAllowed = "move"; }}
                    title="Arrastrá a una columna de la carta"
                    style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab", padding: "7px 10px", borderRadius: 8, fontSize: 12.5, background: "#fff", border: "1px solid #eae7e0" }}>
                    <span style={{ fontSize: 11 }}>▦</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
                    <span style={{ fontSize: 10.5, color: "#aaa" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        </div>

        {/* Lienzo de la hoja activa */}
        <div>
          {hoja && (
            <>
              {/* Controles de la hoja */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <input value={hoja.nombre} onChange={(e) => renombrarHoja(hoja.id, e.target.value)}
                  style={{ fontSize: 15, fontWeight: 700, border: "1px solid transparent", borderRadius: 6, padding: "4px 8px", color: "#2a2320", background: "transparent", minWidth: 160 }}
                  onFocus={(e) => e.target.style.border = "1px solid #d8d3ca"}
                  onBlur={(e) => e.target.style.border = "1px solid transparent"} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: "#666" }}>Columnas:</span>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setCols(n)}
                      style={{ width: 30, height: 28, borderRadius: 7, border: `1px solid ${hoja.cols === n ? accent : "#d8d3ca"}`, background: hoja.cols === n ? accent : "#fff", color: hoja.cols === n ? "#fff" : "#2a2320", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{n}</button>
                  ))}
                </div>

                {/* Fusionar hojas — arriba a la vista */}
                {!fusionMode ? (
                  <button onClick={() => { setFusionMode(true); setFusionSel([]); }} disabled={hojas.length < 2}
                    style={{ border: `1px solid ${hojas.length < 2 ? "#e5e5e5" : "#d8d3ca"}`, background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: hojas.length < 2 ? "default" : "pointer", color: hojas.length < 2 ? "#bbb" : "#2a2320" }}>
                    ⇊ Fusionar hojas
                  </button>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => fusionar(fusionSel)} disabled={fusionSel.length < 2}
                      style={{ border: "none", background: fusionSel.length < 2 ? "#d8d3ca" : accent, color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: fusionSel.length < 2 ? "default" : "pointer" }}>
                      Fusionar ({fusionSel.length})
                    </button>
                    <button onClick={() => { setFusionMode(false); setFusionSel([]); }}
                      style={{ border: "1px solid #d8d3ca", background: "#fff", color: "#999", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                    <span style={{ fontSize: 11.5, color: "#999" }}>Elegí hojas en el panel ←</span>
                  </div>
                )}

                <button onClick={regenerar} title="Rehacer la carta desde cero (pierde la composición actual)"
                  style={{ border: "1px solid #d8d3ca", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#2a2320" }}>
                  ↻ Regenerar
                </button>

                <span style={{ fontSize: 11.5, color: "#aaa" }}>Arrastrá secciones entre columnas · ítems dentro de su sección</span>
              </div>

              {/* Tira horizontal de hojas */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", padding: "2px 0 8px", marginBottom: 4 }}>
                <button onClick={agregarHojaVacia}
                  title="Agregar una hoja vacía"
                  style={{ flexShrink: 0, border: `1px dashed ${accent}`, background: "#fff", color: accent, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 2 }}>
                  ＋ Hoja vacía
                </button>
                {hojas.map((h, i) => (
                  <div key={h.id}
                    draggable
                    onDragStart={(e) => { dragRef.current = { tipo: "hoja", hojaId: h.id }; e.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => setHojaActiva(i)}
                    onDoubleClick={() => { const n = prompt("Nombre de la hoja:", h.nombre); if (n != null) renombrarHoja(h.id, n.trim() || h.nombre); }}
                    title="Clic para ver · doble clic para renombrar · arrastrá a la carta para sumar sus secciones"
                    style={{
                      display: "flex", alignItems: "center", gap: 6, cursor: "grab", flexShrink: 0,
                      padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                      background: i === hojaActiva ? accent : "#fff",
                      color: i === hojaActiva ? "#fff" : "#2a2320",
                      border: `1px solid ${i === hojaActiva ? accent : "#d8d3ca"}`,
                    }}>
                    {(iconFor(h.nombre) ? iconFor(h.nombre) + " " : "") + h.nombre}
                  </div>
                ))}
              </div>

              {/* Contenedor "hoja": marco que envuelve las columnas para que se vea como una página */}
              <div style={{ background: "#f4f2ee", borderRadius: 12, padding: 18, overflowX: "auto" }}>
                <div style={{
                  background: diseno.bg || "#fff", border: "1px solid #e0dcd3", borderRadius: 8,
                  padding: 20, boxShadow: "0 4px 24px rgba(0,0,0,.1)", minHeight: 300,
                  ...(diseno.frame === "box" ? { outline: `2px solid ${neg.accent}`, outlineOffset: -6 } : {}),
                }}>
                  {/* Header arriba de todas las columnas (igual que el PDF) */}
                  <div className="cart" dangerouslySetInnerHTML={{ __html: headerHtml(hoja, diseno, neg, showLogo) }} />
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    {(hoja.columnas || []).map((colSecIds, colIdx) => (
                      <div key={colIdx}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); onDropCol(colIdx, null); }}
                        style={{ flex: "1 1 0", minWidth: 200, padding: "0 8px", minHeight: 200, borderLeft: colIdx > 0 ? "1px dashed #e0dcd3" : "none" }}>
                        <div className="cart">
                          {(colSecIds || []).map((sid) => {
                            const sec = maqueta.secciones[sid];
                            if (!sec) return null;
                            return (
                              <div key={sid}
                                onDragOver={(e) => { if (dragRef.current?.tipo === "seccion") { e.preventDefault(); e.stopPropagation(); } }}
                                onDrop={(e) => { if (dragRef.current?.tipo === "seccion") { e.preventDefault(); e.stopPropagation(); const pos = (colSecIds || []).indexOf(sid); onDropCol(colIdx, pos); } }}
                                style={{ position: "relative", borderRadius: 6, padding: 4, marginBottom: 6, border: "1px dashed transparent" }}
                                onMouseEnter={(e) => e.currentTarget.style.border = "1px dashed #d8d3ca"}
                                onMouseLeave={(e) => e.currentTarget.style.border = "1px dashed transparent"}>
                                {/* título de sección */}
                                <div className="rt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                  {editSec === sid ? (
                                    <input autoFocus defaultValue={sec.titulo}
                                      onBlur={(e) => { renombrarSeccion(sid, e.target.value.trim() || sec.titulo); setEditSec(null); }}
                                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ flex: 1, font: "inherit", color: "inherit", border: "1px solid #d8d3ca", borderRadius: 4, padding: "2px 6px", background: "#fff" }} />
                                  ) : (
                                    <span onDoubleClick={(e) => { e.stopPropagation(); setEditSec(sid); }}
                                      title="Doble clic para renombrar (por ahora solo en la carta)"
                                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>
                                      <span
                                        onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setIconPickerPos({ x: r.left, y: r.top }); setIconPickerFor(iconPickerFor === sec.titulo ? null : sec.titulo); }}
                                        title="Cambiar icono"
                                        style={{ cursor: "pointer", userSelect: "none", fontSize: diseno.iconSize || 16 }}>
                                        {iconoDe(sec.titulo) ? iconoDe(sec.titulo) + " " : "＋ "}
                                      </span>
                                      {diseno.orn ? diseno.orn + "  " : ""}{sec.titulo}
                                    </span>
                                  )}
                                  {iconPickerFor === sec.titulo && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position: "fixed", bottom: `calc(100vh - ${iconPickerPos.y}px + 6px)`, left: iconPickerPos.x, zIndex: 9999999,
                                        background: "#fff", border: "1px solid #d8d3ca", borderRadius: 8,
                                        padding: 8, boxShadow: "0 6px 20px rgba(0,0,0,.15)",
                                        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, width: 220,
                                      }}>
                                      <button
                                        onClick={() => { setIconosPorTitulo((p) => ({ ...p, [sec.titulo]: "" })); setIconPickerFor(null); }}
                                        title="Sin icono"
                                        style={{ gridColumn: "span 6", border: "1px solid #eee", background: "#faf9f7", borderRadius: 5, padding: "3px 6px", fontSize: 11, cursor: "pointer", color: "#999" }}>
                                        Sin icono
                                      </button>
                                      {ICON_PICKER.map((emo) => (
                                        <button key={emo}
                                          onClick={() => { setIconosPorTitulo((p) => ({ ...p, [sec.titulo]: emo })); setIconPickerFor(null); }}
                                          style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", padding: 2, borderRadius: 5 }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f0ec"}
                                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                          {emo}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                    {modo === "agrupacion" && onChangeViewMode && agrupIdByNombre[sec.titulo] != null && (() => {
                                      const agrupId = agrupIdByNombre[sec.titulo];
                                      const vmActual = viewModeByGroup[Number(agrupId)] || viewModeByGroup[String(agrupId)] || "by-subrubro";
                                      const opt = (mode, label) => (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onChangeViewMode(agrupId, mode); }}
                                          title={`Subdividir esta agrupación por ${label.toLowerCase()}`}
                                          style={{
                                            border: "none", background: vmActual === mode ? `${accent}22` : "transparent",
                                            color: vmActual === mode ? accent : "#bbb", cursor: "pointer",
                                            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, lineHeight: 1,
                                          }}>{label}</button>
                                      );
                                      return (
                                        <span style={{ display: "inline-flex", gap: 2, border: "1px solid #eae7e0", borderRadius: 6, padding: 1 }}
                                          onClick={(e) => e.stopPropagation()}>
                                          {opt("by-subrubro", "Rubro")}
                                          {opt("by-categoria", "Sub")}
                                        </span>
                                      );
                                    })()}
                                    <button onClick={(e) => { e.stopPropagation(); insertarSeparador(sid, null); }}
                                      title="Agregar una línea separadora en esta sección"
                                      style={{ border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, fontWeight: 400 }}
                                      onMouseEnter={(e) => e.currentTarget.style.color = accent}
                                      onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>―</button>
                                    <button onClick={(e) => { e.stopPropagation(); quitarSeccion(sid); }}
                                      title="Quitar esta sección de la carta (va al panel 'Fuera')"
                                      style={{ border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0, fontWeight: 400 }}
                                      onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                      onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>✕</button>
                                    <span
                                      draggable
                                      onDragStart={(e) => { e.stopPropagation(); dragRef.current = { tipo: "seccion", secId: sid }; e.dataTransfer.effectAllowed = "move"; }}
                                      title="Arrastrá para mover la sección entre columnas"
                                      style={{ fontSize: 12, color: "#bbb", fontWeight: 400, cursor: "grab" }}>⠿</span>
                                  </span>
                                </div>
                                {/* ítems (con posible subdivisión en bloques por rubro/sub,
                                  leyendo el mismo viewMode que la tabla para esta agrupación) */}
                                {(() => {
                                  // Resolver viewMode de esta agrupación (solo en modo agrupación).
                                  const agrupId = agrupIdByNombre[sec.titulo];
                                  const vm = (modo === "agrupacion" && agrupId != null)
                                    ? (viewModeByGroup[Number(agrupId)] || viewModeByGroup[String(agrupId)])
                                    : null;
                                  const campoBloque = campoBloqueDeViewMode(vm);
                                  // Orden de render: si hay subdivisión, agrupar por bloque (y dentro, alfabético).
                                  // No se toca sec.itemIds guardado: es solo orden visual.
                                  let orden = (sec.itemIds || []);
                                  if (campoBloque) {
                                    // Agrupar por bloque (rubro/sub) manteniendo el orden manual (sec.itemIds)
                                    // dentro de cada bloque: el drag reordena visiblemente, y los bloques
                                    // salen contiguos en el orden en que aparecen sus primeros ítems.
                                    const bloqueDe = (id) => {
                                      if (String(id).startsWith("__sep__")) return "";
                                      const a = artById.get(String(id));
                                      return ((a?.[campoBloque]) || "Otros").toString();
                                    };
                                    const ordenBloques = [];
                                    const buckets = new Map();
                                    let ultimoBloque = null; // los __sep__ heredan el bloque del item anterior
                                    for (const id of orden) {
                                      let b = bloqueDe(id);
                                      if (String(id).startsWith("__sep__")) {
                                        b = ultimoBloque != null ? ultimoBloque : b;
                                      } else {
                                        ultimoBloque = b;
                                      }
                                      if (!buckets.has(b)) { buckets.set(b, []); ordenBloques.push(b); }
                                      buckets.get(b).push(id);
                                    }
                                    orden = ordenBloques.flatMap((b) => buckets.get(b));
                                  }
                                  let bloqueAnterior = null; // para emitir encabezado al cambiar
                                  return orden.map((artId, itemPos) => {
                                    // Separador
                                    if (String(artId).startsWith("__sep__")) {
                                      return (
                                        <div key={artId}
                                          draggable
                                          onDragStart={(e) => { e.stopPropagation(); dragRef.current = { tipo: "item", secId: sid, artId }; e.dataTransfer.effectAllowed = "move"; }}
                                          onDragOver={(e) => { if (dragRef.current?.tipo === "item" || dragRef.current?.tipo === "pool-item") { e.preventDefault(); e.stopPropagation(); } }}
                                          onDrop={(e) => { const t = dragRef.current?.tipo; if (t === "item" || t === "pool-item") { e.preventDefault(); e.stopPropagation(); onDropItem(sid, artId); } }}
                                          title="Arrastrá para mover la línea"
                                          style={{ position: "relative", padding: "4px 0", cursor: "grab" }}>
                                          <div style={{ borderTop: `2px ${diseno.line} ${diseno.ink}`, margin: "3px 0" }} />
                                          <button onClick={(e) => { e.stopPropagation(); quitarItem(sid, artId); }}
                                            title="Quitar separador"
                                            style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", border: "none", background: "#fff", color: "#ccc", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "0 2px" }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                            onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>✕</button>
                                        </div>
                                      );
                                    }
                                    const a = artById.get(String(artId));
                                    if (!a) return null;
                                    const descActual = descripciones[String(artId)] || "";
                                    const editando = editDesc === String(artId);
                                    // Encabezado de bloque: emitir cuando cambia el rubro/sub.
                                    let encabezadoBloque = null;
                                    if (campoBloque && !String(artId).startsWith("__sep__")) {
                                      const bloqueActual = ((a?.[campoBloque]) || "Otros").toString();
                                      if (bloqueActual !== bloqueAnterior) {
                                        bloqueAnterior = bloqueActual;
                                        const rubroDeEste = bloqueActual;
                                        encabezadoBloque = (
                                          <div
                                            draggable
                                            onDragStart={(e) => { e.stopPropagation(); dragRef.current = { tipo: "bloque", secId: sid, rubro: rubroDeEste }; e.dataTransfer.effectAllowed = "move"; }}
                                            onDragOver={(e) => { if (dragRef.current?.tipo === "bloque" && dragRef.current?.secId === sid) { e.preventDefault(); e.stopPropagation(); } }}
                                            onDrop={(e) => {
                                              if (dragRef.current?.tipo === "bloque" && dragRef.current?.secId === sid) {
                                                e.preventDefault(); e.stopPropagation();
                                                const desde = dragRef.current.rubro;
                                                moverBloque(sid, campoBloque, desde, rubroDeEste,
                                                  (id) => ((artById.get(String(id))?.[campoBloque]) || "Otros").toString());
                                                dragRef.current = null;
                                              }
                                            }}
                                            title="Arrastrá para mover este bloque dentro de la agrupación"
                                            style={{
                                              display: "flex", alignItems: "center", justifyContent: "space-between",
                                              fontFamily: "inherit", fontWeight: 700, fontSize: "0.82em",
                                              color: neg.accent || accent, textTransform: "uppercase",
                                              letterSpacing: "0.04em", opacity: 0.85,
                                              margin: "8px 0 2px", paddingBottom: 2, cursor: "grab",
                                              borderBottom: `1px dotted ${(neg.accent || accent)}55`,
                                            }}>
                                            <span>{bloqueActual}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                quitarBloque(sid, campoBloque, rubroDeEste,
                                                  (id) => ((artById.get(String(id))?.[campoBloque]) || "Otros").toString());
                                              }}
                                              title={`Quitar todo el rubro "${bloqueActual}" de la carta`}
                                              onMouseDown={(e) => e.stopPropagation()}
                                              style={{ marginLeft: 8, border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, verticalAlign: "middle" }}
                                              onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                              onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>✕</button>
                                          </div>
                                        );
                                      }
                                    }
                                    return (
                                      <React.Fragment key={artId}>
                                        {encabezadoBloque}
                                        <div>
                                          <div
                                            draggable
                                            onDragStart={(e) => { e.stopPropagation(); dragRef.current = { tipo: "item", secId: sid, artId }; e.dataTransfer.effectAllowed = "move"; }}
                                            onDragOver={(e) => { if (dragRef.current?.tipo === "item" || dragRef.current?.tipo === "pool-item") { e.preventDefault(); e.stopPropagation(); } }}
                                            onDrop={(e) => { const t = dragRef.current?.tipo; if (t === "item" || t === "pool-item") { e.preventDefault(); e.stopPropagation(); onDropItem(sid, artId); } }}
                                            className="it"
                                            style={{ cursor: "grab", position: "relative", paddingRight: 62 }}
                                            title="Arrastrá para reordenar">
                                            <span className="nm">{a.nombre}</span>
                                            <span className="dots" />
                                            <span className="pr">{a.precio != null && a.precio !== "" ? "$" + Number(a.precio).toLocaleString("es-AR") : ""}</span>
                                            <span style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 8, alignItems: "center", background: diseno.bg || "#fff", paddingLeft: 4 }} onMouseDown={(e) => e.stopPropagation()}>
                                              <button onClick={(e) => { e.stopPropagation(); insertarSeparador(sid, artId); }}
                                                title="Agregar línea divisoria debajo de este artículo"
                                                style={{ border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = accent}
                                                onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>―</button>
                                              <button onClick={(e) => { e.stopPropagation(); setEditDesc(editando ? null : String(artId)); }}
                                                title={descActual ? "Editar descripción" : "Agregar descripción"}
                                                style={{ border: "none", background: "none", color: descActual ? accent : "#ccc", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = accent}
                                                onMouseLeave={(e) => e.currentTarget.style.color = descActual ? accent : "#ccc"}>✎</button>
                                              <button onClick={(e) => { e.stopPropagation(); quitarItem(sid, artId); }}
                                                title="Quitar de la carta"
                                                style={{ border: "none", background: "none", color: "#ccc", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                                onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}>✕</button>
                                            </span>
                                          </div>
                                          {/* descripción: editable si está en modo edición, sino se muestra si existe */}
                                          {editando ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "2px 0 6px" }}>
                                              <input
                                                autoFocus
                                                defaultValue={a.nombre}
                                                onBlur={(e) => {
                                                  const nuevo = e.target.value.trim();
                                                  if (nuevo && nuevo !== a.nombre) onRenombrarArticulo?.(a.id, nuevo);
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") e.target.blur();
                                                  if (e.key === "Escape") { e.target.value = a.nombre; }
                                                }}
                                                placeholder="Nombre del artículo…"
                                                title="Renombra el artículo (afecta la tabla; protege el nombre de MaxiRest)"
                                                style={{ width: "100%", fontSize: 13, fontWeight: 600, color: "#2a2320", border: "1px solid #d8d3ca", borderRadius: 5, padding: "3px 6px", boxSizing: "border-box" }}
                                              />
                                              <input
                                                value={descActual}
                                                onChange={(e) => setDescripciones((d) => ({ ...d, [String(artId)]: e.target.value }))}
                                                onBlur={() => setEditDesc(null)}
                                                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                                                placeholder="Descripción / ingredientes…"
                                                style={{ width: "100%", fontSize: 12, fontStyle: "italic", color: "#555", border: "1px solid #d8d3ca", borderRadius: 5, padding: "3px 6px", boxSizing: "border-box" }}
                                              />
                                            </div>
                                          ) : (descActual ? (
                                            <div className="ds" style={{ cursor: "pointer" }} onClick={() => setEditDesc(String(artId))}>{descActual}</div>
                                          ) : null)}
                                        </div>
                                      </React.Fragment>
                                    );
                                  });
                                })()}
                              </div>
                            );
                          })}
                          {(!colSecIds || colSecIds.length === 0) && (
                            <div style={{ color: "#ccc", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                              Soltá secciones acá
                            </div>
                          )}
                        </div>
                        {colIdx === (hoja.columnas.length - 1) && (
                          <div className="cart" dangerouslySetInnerHTML={{ __html: footerHtml(neg) }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Estilos */}
      {estilosOpen && (
        <div onClick={() => setEstilosOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(460px, 94vw)", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Estilos de la carta</h3>
              <button onClick={() => setEstilosOpen(false)} style={{ border: "none", background: "none", fontSize: 20, color: "#999", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {/* Colores */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Colores</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Títulos", "title", "#2a2320"],
                  ["Artículos", "ink", "#2a2320"],
                  ["Precios", "price", accent],
                  ["Líneas / puntos", "leader", "#cfc7ba"],
                  ["Fondo", "bg", "#ffffff"],
                ].map(([label, key, def]) => {
                  const val = diseno[key] && String(diseno[key]).startsWith("#") ? diseno[key] : def;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 13.5, color: "#2a2320" }}>{label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={val}
                          onChange={(e) => setDiseno((d) => ({ ...d, [key]: e.target.value }))}
                          style={{ width: 34, height: 28, border: "1px solid #d8d3ca", borderRadius: 6, cursor: "pointer", padding: 0, background: "#fff" }} />
                        <span style={{ fontSize: 11.5, color: "#999", fontFamily: "monospace", width: 60 }}>{val}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interlineado */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Espaciado</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13.5, color: "#2a2320" }}>Interlineado entre artículos</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={0} max={16} step={1} value={diseno.itemGap ?? 3}
                    onChange={(e) => setDiseno((d) => ({ ...d, itemGap: Number(e.target.value) }))}
                    style={{ width: 130, accentColor: accent }} />
                  <span style={{ fontSize: 12, color: "#999", width: 34 }}>{diseno.itemGap ?? 3}px</span>
                </div>
              </div>
            </div>

            {/* Tamaños de letra */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Tamaños de letra</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Títulos de sección", "sectionSize", 11, 28, 16],
                  ["Icono de sección", "iconSize", 12, 32, 16],
                  ["Nombre del artículo", "itemSize", 10, 22, 14.5],
                  ["Descripción", "descSize", 8, 16, 11.5],
                ].map(([label, key, min, max, def]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13.5, color: "#2a2320" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="range" min={min} max={max} step={0.5} value={diseno[key] ?? def}
                        onChange={(e) => setDiseno((d) => ({ ...d, [key]: Number(e.target.value) }))}
                        style={{ width: 130, accentColor: accent }} />
                      <span style={{ fontSize: 12, color: "#999", width: 34 }}>{diseno[key] ?? def}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extras: mayúsculas, línea, marco */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Detalles</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {negocio?.logo && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12.5, color: "#666" }}>Logo:</span>
                    {[["left", "Izq"], ["center", "Centro"], ["right", "Der"]].map(([k, l]) => (
                      <button key={k} onClick={() => setDiseno((d) => ({ ...d, logoAlign: k }))}
                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${diseno.logoAlign === k ? accent : "#d8d3ca"}`, background: diseno.logoAlign === k ? accent : "#fff", color: diseno.logoAlign === k ? "#fff" : "#2a2320", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                )}
                {pill(diseno.upper, () => setDiseno((d) => ({ ...d, upper: !d.upper })), "MAYÚSCULAS", "Títulos de sección en mayúsculas")}
                <select value={diseno.line} onChange={(e) => setDiseno((d) => ({ ...d, line: e.target.value }))}
                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d8d3ca", fontSize: 12.5, cursor: "pointer", background: "#fff" }}>
                  {MENU_LINES.map((l) => <option key={l} value={l}>Línea: {l}</option>)}
                </select>
                <select value={diseno.frame} onChange={(e) => setDiseno((d) => ({ ...d, frame: e.target.value }))}
                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d8d3ca", fontSize: 12.5, cursor: "pointer", background: "#fff" }}>
                  {MENU_FRAMES.map((f) => <option key={f} value={f}>Marco: {f === "none" ? "sin marco" : f}</option>)}
                </select>
              </div>
            </div>

            {/* Pie de página / contacto */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Pie de página</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Instagram", "instagram", "@tunegocio"],
                  ["Página web", "web", "www.tunegocio.com"],
                  ["Teléfono", "telefono", "11 5555 5555"],
                  ["WiFi (red)", "wifiNombre", "Nombre de la red"],
                  ["WiFi (clave)", "wifiClave", "Contraseña"],
                ].map(([label, key, ph]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: "#666", width: 96, flexShrink: 0 }}>{label}</span>
                    <input value={contacto[key] || ""} placeholder={ph}
                      onChange={(e) => setContacto((c) => ({ ...c, [key]: e.target.value }))}
                      style={{ flex: 1, fontSize: 12.5, border: "1px solid #d8d3ca", borderRadius: 6, padding: "5px 8px", color: "#2a2320" }} />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>Lo que cargues acá aparece en el pie de la carta. Se precarga con los datos del negocio si están.</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderTop: "1px solid #eee", paddingTop: 14 }}>
              <button onClick={() => setDiseno((d) => ({ ...DISENO_BASE, dFont: d.dFont, bFont: d.bFont, fontImp: d.fontImp, ink: negocio?.ink || DISENO_BASE.ink, title: negocio?.ink || DISENO_BASE.title }))}
                style={{ border: "1px solid #d8d3ca", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#777" }}>
                ↺ Restablecer
              </button>
              <button onClick={() => setEstilosOpen(false)}
                style={{ border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", background: accent, color: "#fff" }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal exportar */}
      {printOpen && (
        <div onClick={() => setPrintOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Exportar carta</h3>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#666", marginBottom: 6 }}>Tamaño de hoja</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(PAPER_SIZES).map((sz) => (
                  <button key={sz} onClick={() => setPrintCfg((c) => ({ ...c, size: sz }))}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${printCfg.size === sz ? accent : "#d8d3ca"}`, background: printCfg.size === sz ? accent : "#fff", color: printCfg.size === sz ? "#fff" : "#2a2320", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{sz}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#666", marginBottom: 6 }}>Orientación</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["v", "Vertical"], ["h", "Horizontal"]].map(([k, l]) => (
                  <button key={k} onClick={() => setPrintCfg((c) => ({ ...c, orient: k }))}
                    style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${printCfg.orient === k ? accent : "#d8d3ca"}`, background: printCfg.orient === k ? accent : "#fff", color: printCfg.orient === k ? "#fff" : "#2a2320", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#666", marginBottom: 6 }}>Formato</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["pdf", "PDF"], ["png", "PNG"]].map(([k, l]) => (
                  <button key={k} onClick={() => setPrintCfg((c) => ({ ...c, fmt: k }))}
                    style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${printCfg.fmt === k ? accent : "#d8d3ca"}`, background: printCfg.fmt === k ? accent : "#fff", color: printCfg.fmt === k ? "#fff" : "#2a2320", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#888" }}>
              Se exporta la hoja <b>{hoja?.nombre}</b> con sus {hoja?.cols} columna{hoja?.cols !== 1 ? "s" : ""}, tal como la ves.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setPrintOpen(false)} style={{ border: "none", background: "none", color: "#999", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 12px" }}>Cancelar</button>
              <button onClick={descargar} disabled={dlBusy}
                style={{ border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 800, cursor: dlBusy ? "default" : "pointer", background: dlBusy ? "#bbb" : accent, color: "#fff" }}>
                {dlBusy ? "Generando…" : "Descargar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}