/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import { ANT } from "./anthonyAssets";
import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BASE } from "../../servicios/apiBase";
import { BusinessesAPI, http } from "../../servicios/apiBusinesses";
import { showAlert } from "../../servicios/appAlert";
import { showConfirm } from "../../servicios/appConfirm";
import { showPrompt } from "../../servicios/appPrompt";

// pdfjs-dist es pesado (~1MB+ con su worker) y solo lo usa este archivo cuando
// alguien sube un PDF acá — se carga con import() dinámico para no engordar
// el bundle principal de TODA la app con algo que la mayoría ni toca.
let pdfjsLibPromise = null;
function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([mod, workerUrlMod]) => {
      mod.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      return mod;
    });
  }
  return pdfjsLibPromise;
}

// Intenta extraer el texto de un PDF por código (gratis, instantáneo) antes de
// mandarlo a la IA. Funciona bien con PDFs exportados digitalmente (listas de
// precios, menús armados en Word/Excel-a-PDF); un PDF que es en realidad una
// foto/escaneo devuelve texto vacío o casi vacío, y ahí se sigue usando el
// camino de siempre (mandar el documento a la IA).
async function extractPdfText(file) {
  try {
    const pdfjsLib = await getPdfjsLib();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text.trim();
  } catch {
    return "";
  }
}

// Base del backend (mismo origen que el resto de la app).
const API_BASE = BASE;

// ───────────────────────── Identidad Lazarillo ─────────────────────────
const C = {
  // Tema por defecto = landing lazarillo.com.ar (se sobrescribe con la marca del negocio al subir logo)
  maroon: "#15213E", maroonDark: "#12111F", paper: "#F2F4F7", card: "#ffffff",
  ink: "#15213E", muted: "#66707E", gold: "#2492C8", border: "rgba(21,33,62,.12)",
  shade: "#E8EEF5", danger: "#b00020", ok: "#2e7d32",
};
// Paleta Lazarillo/Anthony (celeste + navy) para el header por defecto
const LAZ = { navy:"#12111F", navy2:"#1B1A2E", ink:"#15213E", sky:"#5BC2EA", skydeep:"#2492C8", paper:"#F2F4F7", body:"#3C4150", line:"rgba(21,33,62,.12)", green:"#25D366", primary:"#5BC2EA", secondary:"#15213E" };

// Logotipo Lazarillo (procesado a fondo transparente)
const LOGO_LIGHT = "data:image/png;base64,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"; // texto blanco, para fondos oscuros
const LOGO_DARK = "data:image/png;base64,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"; // texto marrón, para fondos claros


const RUBROS = [
  ["01", "Carnes y Embutidos"], ["02", "Pescados y Mariscos"], ["03", "Verduleria y Fruteria"],
  ["04", "Lacteos y Huevos"], ["05", "Almacen y Secos"], ["06", "Panaderia y Reposteria"],
  ["07", "Elaborados y Produccion"], ["08", "Bebidas sin Alcohol"], ["09", "Bebidas con Alcohol"],
  ["10", "Limpieza e Higiene"], ["11", "Descartables y Packaging"], ["12", "Indumentaria"],
  ["13", "Utensilios y Menaje"], ["14", "Equipamiento y Maquinaria"], ["15", "Tecnologia y Electronica"],
  ["16", "Mantenimiento y Ferreteria"], ["17", "Marketing y Papeleria"], ["18", "Juegos y Entretenimiento"],
  ["19", "Mobiliario y Salon"], ["99", "A Clasificar"],
];
const RUBRO_TXT = RUBROS.map((r) => `${r[0]} ${r[1]}`).join(", ");
const UNIDADES = ["Unidad", "Gramo", "Kilogramo", "Mililitro", "Litro"];
const normUnidad = (u) => {
  const t = String(u || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!t) return "";
  if (UNIDADES.some((x) => x.toLowerCase() === t)) return UNIDADES.find((x) => x.toLowerCase() === t);
  if (/^(kg|kgs|kilo|kilos|kilogramos?)$/.test(t) || /\bkg\b/.test(t)) return "Kilogramo";
  if (/^(gr|grs|grm|grms|gramos?|g)$/.test(t) || /\bgr?s?\b/.test(t)) return "Gramo";
  if (/^(l|lt|lts|litros?)$/.test(t) || /\blts?\b/.test(t)) return "Litro";
  if (/^(ml|mls|cc|mililitros?|cm3)$/.test(t) || /\bml\b|\bcc\b/.test(t)) return "Mililitro";
  if (/^(u|un|uni|unid|unidades?|c\/u|cu|each)$/.test(t)) return "Unidad";
  return "";
};

// ───────────────────────── API helper ─────────────────────────
// ─── Ingesta de archivos: Excel / CSV / PDF / foto ───
function toB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}
const HEADERSET = new Set(["nombre", "producto", "productos", "insumo", "insumos", "articulo", "articulos", "descripcion", "detalle", "item", "items", "cantidad", "cant", "qty", "unidades", "unidad", "precio", "precio unitario", "p unit", "precio de venta", "precio de compra", "importe", "total", "monto", "subtotal", "rubro", "nomrub", "subrubro", "nomsub", "categoria", "servicio", "seccion", "codigo", "cod", "code", "fecha", "proveedor", "nombre de insumo", "nombre del producto", "plato", "valor", "denominacion"]);
const norm0 = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Detecta en qué fila están los NOMBRES DE CAMPO (no siempre es la primera: los ERP ponen logo/título/filtros arriba).
function detectHeaderIdx(rows) {
  const N = Math.min(rows.length, 25);
  const esNum = (c) => /^[-$]?[\d.,%\s]+$/.test(c);
  let best = -1, bestScore = 0;
  for (let i = 0; i < N; i++) {
    const cells = (rows[i] || []).map((c) => String(c == null ? "" : c).trim());
    const nonEmpty = cells.filter((c) => c !== "");
    if (nonEmpty.length < 2) continue; // un encabezado tiene al menos 2 columnas
    // un encabezado real tiene nombres DISTINTOS; una fila de título combinada queda toda con el mismo valor → la descartamos
    const uniqCells = new Set(nonEmpty.map((c) => norm0(c))).size;
    if (uniqCells < Math.max(2, Math.ceil(nonEmpty.length * 0.5))) continue;
    const textCells = nonEmpty.filter((c) => !esNum(c));
    const known = new Set(cells.filter((c) => HEADERSET.has(norm0(c))).map((c) => norm0(c))).size;
    const below = [];
    for (let j = i + 1; j < rows.length && below.length < 6; j++) { const rr = (rows[j] || []).map((c) => String(c == null ? "" : c).trim()); if (rr.some((c) => c !== "")) below.push(rr); }
    if (!below.length) continue; // sin datos debajo no es encabezado (puede ser un título)
    const belowAvg = below.reduce((s, rr) => s + rr.filter((c) => c !== "").length, 0) / below.length;
    const belowNum = below.some((rr) => rr.some((c) => /\d/.test(c)));
    let score = nonEmpty.length * 0.5 + textCells.length * 0.5 + known * 6;
    if (belowNum) score += 3;
    if (belowAvg >= nonEmpty.length * 0.6) score += 3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
// De un Excel con varias hojas, elige la que tiene la tabla real (más datos bajo un encabezado).
function bestSheetRows(sheets) {
  let best = null;
  for (const raw of (sheets || [])) {
    const rows = (raw || []).map((r) => Array.isArray(r) ? r.map((c) => String(c == null ? "" : c).trim()) : [String(r || "").trim()]).filter((r) => r.some((c) => c !== ""));
    if (!rows.length) continue;
    const hi = detectHeaderIdx(rows);
    const dataCount = hi >= 0 ? rows.length - hi - 1 : rows.length;
    const score = dataCount + (hi >= 0 ? 5 : 0);
    if (!best || score > best.score) best = { rows, hi, score };
  }
  return best;
}

// sinónimos de columnas → campo canónico
const SYN = {
  nombre: ["nombre", "nombre de insumo", "nombre insumo", "nombre del producto", "nombre producto", "nombre articulo", "producto", "articulo", "descripcion", "detalle", "item", "plato", "denominacion", "nomart"],
  descripcion: ["descripcion del producto", "descripcion del plato", "descripcion larga", "detalle del producto", "descripcion detallada", "observaciones", "descripcion", "detalle", "reseña", "resena", "comentario"],
  foto: ["link de la foto", "link foto", "link de la imagen", "link imagen", "url de la foto", "url foto", "url de la imagen", "url imagen", "foto del producto", "imagen del producto", "foto", "imagen", "image", "photo", "picture", "img", "url"],
  codigo: ["codigo", "cod", "code", "sku", "codigo insumo", "codigo de insumo", "cod insumo"],
  precio: ["precio unitario", "precio unit", "p unit", "punit", "precio venta", "precio de venta", "precio de compra", "valor unitario", "pvp", "precio"],
  importe: ["importe", "total", "monto", "subtotal", "importe total", "facturado", "venta", "ventas"],
  cantidad: ["cantidad vendida", "cantidad", "cant", "qty", "unidades", "unid", "uds", "ud"],
  servicio: ["servicio", "seccion", "categoria", "familia", "grupo", "carta"],
  rubro: ["nomrub", "nombre rubro", "rubro", "rubro de insumo", "rubro insumo"],
  subrubro: ["nomsub", "nombre subrubro", "subrubro", "sub rubro", "subcategoria"],
  codrubro: ["codrub", "codigo rubro", "cod rubro", "codigo de rubro", "cod de rubro", "codigo de rubro de insumo", "codigo rubro insumo"],
  codsubrubro: ["codsub", "codigo subrubro", "cod subrubro", "codigo de subrubro", "codigo sub rubro", "cod sub rubro"],
  unidad: ["unidad de medida", "unidad medida", "u medida", "umedida", "um", "medida", "presentacion", "unidad"],
};
// memoria de mapeos aprendidos (encabezado normalizado → campo), persistida entre sesiones
let LEARNED = {};
async function loadLearned() { try { const r = localStorage.getItem("lazarillo:colmap"); if (r) LEARNED = JSON.parse(r); } catch { /* sin storage */ } }
function learnCol(headerName, field) { LEARNED[norm0(headerName)] = field; try { localStorage.setItem("lazarillo:colmap", JSON.stringify(LEARNED)); } catch { /* sin storage */ } }

function mapColumns(header) {
  const h = header.map(norm0);
  const used = new Set();
  const map = { nombre: -1, descripcion: -1, foto: -1, codigo: -1, precio: -1, importe: -1, cantidad: -1, servicio: -1, rubro: -1, subrubro: -1, codrubro: -1, codsubrubro: -1, unidad: -1 };
  // 0) lo aprendido tiene prioridad
  h.forEach((c, i) => {
    const lf = LEARNED[c];
    if (lf === "ignorar") { used.add(i); return; }
    if (lf && lf in map && map[lf] === -1) { map[lf] = i; used.add(i); }
  });
  const order = ["codrubro", "codsubrubro", "codigo", "rubro", "subrubro", "unidad", "cantidad", "importe", "precio", "servicio", "foto", "nombre", "descripcion"];
  // 1) match exacto
  order.forEach((f) => { if (map[f] >= 0) return; for (let i = 0; i < h.length; i++) { if (!used.has(i) && SYN[f].includes(h[i])) { map[f] = i; used.add(i); break; } } });
  // 2) match por contención (sinónimos de 4+ chars)
  order.forEach((f) => { if (map[f] >= 0) return; for (let i = 0; i < h.length; i++) { if (used.has(i)) continue; if (SYN[f].some((s) => s.length >= 4 && h[i].includes(s))) { map[f] = i; used.add(i); break; } } });
  return map;
}
const cellNum = (c) => {
  let s = String(c == null ? "" : c).replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return 0;
  const neg = s.includes("-"); s = s.replace(/-/g, "");
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  let dp = -1; // posición del separador decimal
  if (lc >= 0 && ld >= 0) dp = Math.max(lc, ld); // el último separador es el decimal
  else if (lc >= 0 && (s.match(/,/g) || []).length === 1) { const t = s.length - lc - 1; if (t >= 1 && t <= 2) dp = lc; }
  else if (ld >= 0 && (s.match(/\./g) || []).length === 1) { const t = s.length - ld - 1; if (t >= 1 && t <= 2) dp = ld; }
  const intP = (dp >= 0 ? s.slice(0, dp) : s).replace(/[.,]/g, "");
  const frac = (dp >= 0 ? s.slice(dp + 1) : "").replace(/[.,]/g, "");
  const n = parseFloat((intP || "0") + (frac ? "." + frac : ""));
  return isNaN(n) ? 0 : Math.round(neg ? -n : n);
};
// Un campo puede ser una columna (índice) o un cálculo {div:[a,b]} = columna a ÷ columna b.
const fset = (m, f) => (typeof m[f] === "number" && m[f] >= 0) || (m[f] && typeof m[f] === "object" && Array.isArray(m[f].div));
const fnum = (row, m, f) => {
  const v = m[f];
  if (v && typeof v === "object" && Array.isArray(v.div)) { const a = cellNum(row[v.div[0]]), b = cellNum(row[v.div[1]]); return b ? Math.round(a / b) : 0; }
  return (typeof v === "number" && v >= 0) ? cellNum(row[v]) : 0;
};
function pickNameCol(data) {
  const cols = Math.max(...data.map((r) => r.length), 1);
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i < cols; i++) {
    const vals = data.map((r) => String(r[i] == null ? "" : r[i]).trim());
    const nonEmpty = vals.filter((v) => v !== "");
    if (!nonEmpty.length) continue;
    const textCount = nonEmpty.filter((v) => /[a-zá-ú]/i.test(v) && !/^\$?[\d.,\s]+$/.test(v)).length;
    const uniq = new Set(nonEmpty.map((v) => v.toLowerCase())).size;
    const uniqRatio = uniq / nonEmpty.length; // 1 = todos distintos (típico de nombres)
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    let score = textCount * uniqRatio + uniq * 0.5 + Math.min(avgLen, 30) * 0.1;
    if (uniqRatio < 0.3) score *= 0.2; // penaliza columnas casi todas iguales (Estado, Rubro, etc.)
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
function buildLine(row, kind, map, nameIdx) {
  const get = (i) => i >= 0 && i < row.length ? String(row[i] == null ? "" : row[i]).trim() : "";
  const name = get(map.nombre >= 0 ? map.nombre : nameIdx);
  if (!name) return "";
  if (kind === "insumos" || kind === "compras") {
    const pu = fset(map, "precio") ? fnum(row, map, "precio") : 0;
    const imp = fset(map, "importe") ? fnum(row, map, "importe") : 0;
    const q = fset(map, "cantidad") ? fnum(row, map, "cantidad") : 0;
    const price = pu || (imp && q ? Math.round(imp / q) : imp) || 0;
    const un = map.unidad >= 0 ? get(map.unidad) : "";
    const ru = map.rubro >= 0 ? get(map.rubro) : "";
    const cru = map.codrubro >= 0 ? get(map.codrubro) : "";
    const cod = map.codigo >= 0 ? get(map.codigo) : "";
    if (un || ru || cru || cod) return `${name}\\t${price || ""}\\t${un}\\t${ru}\\t${cru}\\t${cod}`;
    return price ? `${name} - ${price}` : name;
  }
  if (kind === "menu") {
    const p = fset(map, "precio") ? fnum(row, map, "precio") : (fset(map, "importe") ? fnum(row, map, "importe") : 0);
    const ru = map.rubro >= 0 ? get(map.rubro) : "", su = map.subrubro >= 0 ? get(map.subrubro) : "";
    const cru = map.codrubro >= 0 ? get(map.codrubro) : "", csu = map.codsubrubro >= 0 ? get(map.codsubrubro) : "";
    const cod = map.codigo >= 0 ? get(map.codigo) : "";
    const de = map.descripcion >= 0 ? get(map.descripcion).replace(/\\t/g, " ") : "";
    const fo = map.foto >= 0 ? get(map.foto).replace(/\\t/g, " ") : "";
    if (ru || su || cru || csu || cod || de || fo) return `${name}\\t${p || ""}\\t${ru}\\t${su}\\t${cru}\\t${csu}\\t${cod}\\t${de}\\t${fo}`;
    return p ? `${name} - ${p}` : name;
  }
  let q = fset(map, "cantidad") ? fnum(row, map, "cantidad") : 0;
  let imp = fset(map, "importe") ? fnum(row, map, "importe") : 0;
  const pu = fset(map, "precio") ? fnum(row, map, "precio") : 0;
  // ventas
  if (!imp && pu && q) imp = pu * q;
  if (!q && imp && pu) q = Math.round(imp / pu);
  const ru = map.rubro >= 0 ? get(map.rubro) : "", su = map.subrubro >= 0 ? get(map.subrubro) : "";
  const cru = map.codrubro >= 0 ? get(map.codrubro) : "", csu = map.codsubrubro >= 0 ? get(map.codsubrubro) : "";
  const cod = map.codigo >= 0 ? get(map.codigo) : "";
  const de = map.descripcion >= 0 ? get(map.descripcion).replace(/\\t/g, " ") : "";
  const extras = (ru || su || cru || csu || cod || de) ? `\\t${ru}\\t${su}\\t${cru}\\t${csu}\\t${cod}\\t${de}` : "";
  if (imp && q) return `${name} - ${q} - ${imp}${extras}`;
  if (pu) return `${name} - 1 - ${pu}${extras}`;
  if (imp) return `${name} - ${imp}${extras}`;
  return extras ? `${name} - 0${extras}` : name;
}
function rowsToLines(rows, kind) {
  const clean = rows.map((r) => Array.isArray(r) ? r.map((c) => String(c == null ? "" : c).trim()) : [String(r || "").trim()]).filter((r) => r.some((c) => c !== ""));
  if (!clean.length) return "";
  const hi = detectHeaderIdx(clean);
  if (hi >= 0) {
    const f = clean[hi];
    const map = mapColumns(f);
    const data = clean.slice(hi + 1);
    const nameIdx = map.nombre >= 0 ? map.nombre : pickNameCol(data);
    return data.map((r) => buildLine(r, kind, map, nameIdx)).map((s) => s.trim()).filter(Boolean).join("\n");
  }
  // sin encabezado detectado: comportamiento posicional
  return clean.map((r) => kind === "insumos" ? r[0] : r.filter((c) => c !== "").join(" - "))
    .map((s) => String(s || "").trim()).filter(Boolean).join("\n");
}

const isImgPdf = (f) => { const e = (f.name.split(".").pop() || "").toLowerCase(); return e === "pdf" || (f.type || "").startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(e); };
async function readRows(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  let sheets = [];
  if (ext === "csv") { const data = await new Promise((res, rej) => Papa.parse(file, { complete: (r) => res(r.data), error: rej })); sheets = [data]; }
  else { const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); sheets = wb.SheetNames.map((sn) => XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 })); }
  const best = bestSheetRows(sheets);
  if (!best) return { header: null, data: [] };
  const { rows, hi } = best;
  if (hi >= 0) return { header: rows[hi], data: rows.slice(hi + 1) };
  const f = rows[0];
  const esHeader = f.some((c) => HEADERSET.has(norm0(c))) || (f.every((c) => !/\d/.test(c)) && rows.slice(1).some((r) => r.some((c) => /\d/.test(c))));
  return esHeader ? { header: f, data: rows.slice(1) } : { header: null, data: rows };
}

const FIELDS_BY_KIND = {
  ventas: [["nombre", "Nombre"], ["cantidad", "Cantidad"], ["importe", "Importe"], ["precio", "Precio unit."], ["ignorar", "Ignorar"]],
  compras: [["nombre", "Nombre"], ["cantidad", "Cantidad"], ["importe", "Importe"], ["precio", "Precio unit."], ["codigo", "Código"], ["ignorar", "Ignorar"]],
};

// Campos de Lazarillo que vamos confirmando de a uno (campo Lazarillo -> columna del archivo)
// POS gastronómicos más usados en Argentina (para el desplegable de integración)
const POS_BASE = ["Nucleo", "Fudo", "Maxirest", "Bistrosoft", "Popapp", "HivePOS", "iRestora PLUS", "Toteat", "Lightspeed Restaurant", "Square", "Loyverse", "Waitry"];
const POS_OTRO = "Otro (no está en la lista)";
const POS_NINGUNO = "Ninguno / lo llevo en papel o planilla";
// alta automática: cuando varias personas cargan un POS que no está, se suma a la lista (almacenamiento compartido)
const POS_UMBRAL = 2;
async function loadPosExtra() {
  try { const r = localStorage.getItem("lazarillo:pos-custom"); if (r) { const m = JSON.parse(r); return Object.values(m).filter((o) => o && o.count >= POS_UMBRAL && o.nombre).map((o) => o.nombre); } } catch { /* sin storage */ }
  return [];
}
async function registrarPos(name) {
  const n = String(name || "").trim(); if (!n) return;
  if (POS_BASE.some((p) => p.toLowerCase() === n.toLowerCase())) return;
  try {
    let m = {}; try { const r = localStorage.getItem("lazarillo:pos-custom"); if (r) m = JSON.parse(r); } catch { /* noop */ }
    const k = n.toLowerCase(); m[k] = { nombre: n, count: ((m[k] && m[k].count) || 0) + 1 };
    localStorage.setItem("lazarillo:pos-custom", JSON.stringify(m));
  } catch { /* sin storage */ }
}
// índice de paso → conjunto de datos que puede traer el POS por API
const STEPKEY = { 0: "ventas", 1: "menu", 2: "compras", 3: "insumos" };

const GUIA_CAMPOS = {
  ventas: [["nombre", "el nombre del producto"], ["descripcion", "la descripción del producto (texto largo, opcional)"], ["codigo", "el código de artículo (importante para vincular ventas y menú)"], ["cantidad", "las unidades vendidas"], ["importe", "el importe total ($)"], ["rubro", "el rubro (opcional)"], ["subrubro", "el sub-rubro (opcional)"], ["codrubro", "el código de rubro (opcional)"], ["codsubrubro", "el código de sub-rubro (opcional)"]],
  compras: [["nombre", "el nombre del insumo"], ["precio", "el precio de compra ($)"], ["unidad", "la unidad de medida (opcional)"], ["rubro", "el rubro del insumo (opcional)"], ["codrubro", "el código de rubro de insumo (opcional)"], ["codigo", "el código de insumo (importante para vincular)"]],
  menu: [["nombre", "el nombre del plato"], ["descripcion", "la descripción del plato (texto largo, opcional)"], ["codigo", "el código de artículo (importante para vincular ventas y menú)"], ["precio", "el precio de venta ($)"], ["foto", "el link de la foto del producto (opcional)"], ["rubro", "el rubro (opcional)"], ["subrubro", "el sub-rubro (opcional)"], ["codrubro", "el código de rubro (opcional)"], ["codsubrubro", "el código de sub-rubro (opcional)"]],
  insumos: [["nombre", "el nombre del insumo"], ["precio", "el precio de compra ($) (opcional)"], ["unidad", "la unidad de medida (opcional)"], ["rubro", "el rubro del insumo (opcional)"], ["codrubro", "el código de rubro de insumo (opcional)"], ["codigo", "el código de insumo (importante para vincular)"]],
};

// Carga de archivo con mapeo guiado (conversacional) + aprendizaje
function MappedUpload({ kind, value, onChange, label, accent = C.maroon, logo, nombre, files, saved, onSave }) {
  const [header, setHeader] = React.useState(saved?.header ?? null);
  const [rows, setRows] = React.useState(saved?.rows ?? []);
  const [map, setMap] = React.useState(saved?.map ?? {});
  const [initMap, setInitMap] = React.useState(saved?.initMap ?? null); // auto-mapeo inicial, para ordenar la guía
  const [ai, setAi] = React.useState(saved?.ai ?? "");
  const [reading, setReading] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [confirmado, setConfirmado] = React.useState(saved?.confirmado ?? false);
  const [editMapeo, setEditMapeo] = React.useState(false);
  // Archivo(s) elegidos pero todavía no procesados — antes se mandaban a
  // parsear/IA apenas se elegían, sin dar chance de darse cuenta que era el
  // archivo equivocado. Ahora hay un paso intermedio de "¿es este?".
  const [pendingFiles, setPendingFiles] = React.useState([]);
  const previewUrls = React.useMemo(
    () => pendingFiles.map((f) => ((f.type || "").startsWith("image/") ? URL.createObjectURL(f) : null)),
    [pendingFiles]
  );
  React.useEffect(() => () => { previewUrls.forEach((u) => u && URL.revokeObjectURL(u)); }, [previewUrls]);
  React.useEffect(() => { if (onSave) onSave({ header, rows, map, initMap, ai, confirmado }); }, [header, rows, map, initMap, ai, confirmado]);

  const derived = React.useMemo(() => {
    const parts = [];
    if (rows.length && header) {
      const nameIdx = map.nombre >= 0 ? map.nombre : pickNameCol(rows);
      parts.push(rows.map((r) => buildLine(r, kind, map, nameIdx)).filter(Boolean).join("\n"));
    }
    if (ai) parts.push(ai);
    return parts.filter(Boolean).join("\n");
  }, [rows, header, map, ai, kind]);

  React.useEffect(() => { if (rows.length || ai) onChange(derived); }, [derived]);

  // refina el mapeo usando los datos: descripción = texto largo (>15), nombre = el más corto; rubro más corto que sub-rubro
  const refinarMap = (m, hdr, data) => {
    const sample = (data || []).slice(0, 120);
    if (!sample.length) return m;
    const col = (i) => sample.map((r) => String((r && r[i]) != null ? r[i] : "").trim()).filter(Boolean);
    const avgLen = (i) => { const vs = col(i); return vs.length ? vs.reduce((s, v) => s + v.length, 0) / vs.length : 0; };
    const isText = (i) => { const vs = col(i); return vs.length ? vs.filter((v) => /[a-zá-úñ]/i.test(v)).length > vs.length * 0.6 : false; };
    const usados = new Set(Object.values(m).filter((v) => typeof v === "number" && v >= 0));
    // foto/link: columna cuyos valores parecen rutas o URLs (barras / o \\, http/www, o extensión de imagen)
    if (typeof m.foto === "number" && m.foto < 0) {
      let best = -1, bestScore = 0.6;
      for (let i = 0; i < hdr.length; i++) {
        if (usados.has(i)) continue;
        const vs = col(i); if (!vs.length) continue;
        const linkish = vs.filter((v) => /^(https?:\/\/|www\.)/i.test(v) || /\.(jpe?g|png|webp|gif|bmp|svg|avif)(\?|#|$)/i.test(v) || ((v.includes("/") || v.includes("\\")) && v.length > 8)).length;
        const ratio = linkish / vs.length;
        if (ratio > bestScore) { bestScore = ratio; best = i; }
      }
      if (best >= 0) { m.foto = best; usados.add(best); }
    }
    if (m.nombre >= 0 && m.descripcion < 0) {
      const nLen = avgLen(m.nombre); let best = -1, bestLen = 15;
      for (let i = 0; i < hdr.length; i++) { if (usados.has(i) || !isText(i)) continue; const l = avgLen(i); if (l > bestLen && l > nLen * 1.3) { bestLen = l; best = i; } }
      if (best >= 0) { m.descripcion = best; usados.add(best); }
    }
    if (m.nombre >= 0 && m.descripcion >= 0 && avgLen(m.descripcion) < avgLen(m.nombre)) { const t = m.nombre; m.nombre = m.descripcion; m.descripcion = t; }
    if (m.rubro >= 0 && m.subrubro >= 0 && avgLen(m.rubro) > avgLen(m.subrubro) * 1.5) { const t = m.rubro; m.rubro = m.subrubro; m.subrubro = t; }
    return m;
  };
  const procesarArchivos = async (fileList) => {
    const files = Array.from(fileList || []); if (!files.length) return;
    setReading(true);
    let hdr = header, newRows = [], aiText = ai;
    for (const f of files) {
      try {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (ext === "pdf") {
          // PDF: primero intentamos extraer el texto por código (gratis,
          // instantáneo). Si el PDF es digital (no una foto/escaneo) esto
          // alcanza y evitamos mandar el documento entero a la IA.
          const textoPlano = await extractPdfText(f);
          const extraido = textoPlano.length > 40
            ? await extractTextWithAI(kind, textoPlano)
            : await extractWithAI(kind, f.type || "application/pdf", await toB64(f), true);
          aiText = [aiText, extraido].filter(Boolean).join("\n");
        } else if (isImgPdf(f)) {
          const b64 = await toB64(f);
          aiText = [aiText, await extractWithAI(kind, f.type || "image/jpeg", b64, false)].filter(Boolean).join("\n");
        } else {
          const { header: h, data } = await readRows(f); if (!hdr && h) hdr = h; newRows = newRows.concat(data);
        }
      } catch { /* skip */ }
    }
    if (hdr && !header) { const m0 = refinarMap(mapColumns(hdr), hdr, newRows); setHeader(hdr); setMap(m0); setInitMap(m0); setStep(0); setConfirmado(false); }
    if (newRows.length) setRows((p) => [...p, ...newRows]);
    setAi(aiText);
    setReading(false);
  };

  // Elegir archivo(s) → paso intermedio de preview, todavía no se procesa nada.
  const onFileSelected = (e) => {
    const list = Array.from(e.target.files || []); e.target.value = "";
    if (list.length) setPendingFiles(list);
  };
  const confirmarPendientes = () => { const list = pendingFiles; setPendingFiles([]); procesarArchivos(list); };
  const descartarPendientes = () => setPendingFiles([]);

  const reset = () => { setHeader(null); setRows([]); setMap({}); setInitMap(null); setAi(""); setStep(0); setConfirmado(false); setPendingFiles([]); onChange(""); };

  // archivos pasados desde afuera (botón "Subir …" que abre el selector directo)
  // — también pasan por el preview, misma lógica que elegir del input.
  const filesRef = React.useRef(null);
  React.useEffect(() => { if (files && files.length && files !== filesRef.current) { filesRef.current = files; setPendingFiles(Array.from(files)); } }, [files]);

  // asignar una columna del archivo (i) a un campo de Lazarillo
  const asignar = (field, i) => {
    setMap((prev) => { const m = { ...prev }; Object.keys(m).forEach((k) => { if (m[k] === i) m[k] = -1; }); m[field] = i; return m; });
    if (i >= 0 && header && header[i]) learnCol(header[i], field);
  };
  const asignarDiv = (field, a, b) => setMap((prev) => ({ ...prev, [field]: { div: [a, b] } }));

  const rowsParaPreview = value || derived;
  const prev = kind === "ventas" ? parseVentas(rowsParaPreview) : kind === "menu" ? parseMenu(rowsParaPreview).map((m) => ({ nombre: m.nombre, precio: m.precioVenta, rubro: m.rubro, subRubro: m.subRubro })) : parseCompras(rowsParaPreview);
  const fmt = (n) => (n || n === 0) && !isNaN(n) ? Number(n).toLocaleString("es-AR") : "";
  const cols = (kind === "ventas" ? ["Producto", "Unidades", "Importe", "Precio unit."] : kind === "menu" ? ["Plato", "Precio"] : ["Insumo", "Precio"]).concat(["Rubro", "Sub-rubro"]);
  const tieneDatos = rows.length || ai || value;
  const guiaBase = GUIA_CAMPOS[kind] || GUIA_CAMPOS.ventas;
  const hallado = (campo) => initMap && ((typeof initMap[campo] === "number" && initMap[campo] >= 0) || (initMap[campo] && typeof initMap[campo] === "object" && Array.isArray(initMap[campo].div)));
  const prio = (campo) => campo === "nombre" ? 0 : campo === "codigo" ? 1 : 2; // nombre 1º, código 2º siempre
  const guia = [...guiaBase].sort((a, b) => (prio(a[0]) - prio(b[0])) || (initMap ? ((hallado(b[0]) ? 1 : 0) - (hallado(a[0]) ? 1 : 0)) : 0));
  // Ejemplo representativo: descartamos el 1° y 2° (por cantidad/importe/precio, o por orden) y usamos el 3°.
  const filaTop = React.useMemo(() => {
    if (!rows.length) return -1;
    const metric = (map.cantidad != null && map.cantidad >= 0) ? map.cantidad : ((map.importe != null && map.importe >= 0) ? map.importe : ((map.precio != null && map.precio >= 0) ? map.precio : -1));
    const numCols = ["cantidad", "importe", "precio"].map((f) => map[f]).filter((i) => typeof i === "number" && i >= 0);
    const nameCol = (typeof map.nombre === "number" && map.nombre >= 0) ? map.nombre : -1;
    const nameOk = (r) => nameCol < 0 || String((r && r[nameCol]) ?? "").trim() !== "";
    const ok = (r) => numCols.every((i) => cellNum(r && r[i]) > 0) && nameOk(r);
    let valid = rows.map((r, idx) => ({ idx, r })).filter((x) => ok(x.r));
    if (metric >= 0) valid.sort((a, b) => cellNum(b.r[metric]) - cellNum(a.r[metric]));
    if (!valid.length) valid = rows.map((r, idx) => ({ idx, r })).filter((x) => nameOk(x.r));
    if (!valid.length) return -1;
    return (valid[2] || valid[valid.length - 1]).idx; // descarta 1° y 2°, usa el 3°
  }, [rows, map.cantidad, map.importe, map.precio, map.nombre]);
  const muestra = (i) => {
    const bad = (s) => { const t = String(s == null ? "" : s).trim(); if (!t) return true; if (/^[\d.,$\s-]+$/.test(t) && cellNum(t) === 0) return true; return false; };
    if (filaTop >= 0) { const v = rows[filaTop] && rows[filaTop][i]; if (!bad(v)) return String(v).trim(); }
    const good = []; for (const r of rows.slice(0, 60)) { const v = r && r[i]; if (!bad(v)) good.push(String(v).trim()); }
    return good[2] || good[good.length - 1] || ""; // fallback por columna: también el 3°
  };
  // ejemplo único con más caracteres de la columna (para descripción)
  const muestraLarga = (i) => {
    const bad = (s) => { const t = String(s == null ? "" : s).trim(); if (!t) return true; if (/^[\d.,$\s-]+$/.test(t) && cellNum(t) === 0) return true; return false; };
    let best = "";
    for (const r of rows.slice(0, 500)) { const v = r && r[i]; if (bad(v)) continue; const t = String(v).trim(); if (t.length > best.length) best = t; }
    return best;
  };
  // 3 ejemplos DISTINTOS y ESPACIADOS de una columna (para el campo nombre), evitando el primero y el último
  const muestra3 = (i) => {
    const bad = (s) => { const t = String(s == null ? "" : s).trim(); if (!t) return true; if (/^[\d.,$\s-]+$/.test(t) && cellNum(t) === 0) return true; return false; };
    const vals = [], seen = new Set();
    for (const r of rows.slice(0, 2000)) { const v = r && r[i]; if (bad(v)) continue; const t = String(v).trim(); const k = t.toLowerCase(); if (seen.has(k)) continue; seen.add(k); vals.push(t); }
    const n = vals.length;
    if (n <= 3) return vals.join(" - ");
    const lo = n >= 5 ? 1 : 0, hi = n >= 5 ? n - 2 : n - 1; // con 5+ evitamos el primero y el último
    const span = hi - lo;
    const idxs = [lo, lo + Math.round(span / 2), hi];
    return idxs.map((x) => vals[x]).join(" - ");
  };

  return (
    <div>
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) setPendingFiles(Array.from(e.dataTransfer.files)); }}
        style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: (tieneDatos || pendingFiles.length) ? 14 : 34, textAlign: "center", background: C.paper }}>
        {pendingFiles.length > 0 ? (
          <div>
            <div style={{ fontWeight: 600, color: C.maroonDark, marginBottom: 10 }}>¿Es este el archivo correcto?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 14 }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: 110 }}>
                  {previewUrls[i] ? (
                    <img src={previewUrls[i]} alt={f.name} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                  ) : (
                    <div style={{ width: 84, height: 84, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "#fff" }}>
                      {(f.name.split(".").pop() || "").toLowerCase() === "pdf" ? "📄" : "📊"}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: C.muted, wordBreak: "break-all", textAlign: "center" }}>{f.name}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Btn ghost small onClick={descartarPendientes}>✕ Elegir otro</Btn>
              <Btn small accent={accent} onClick={confirmarPendientes}>✓ Usar este archivo</Btn>
            </div>
          </div>
        ) : !tieneDatos ? (
          <label style={{ cursor: "pointer", display: "block" }}>
            <div style={{ fontSize: 30 }}>📎</div>
            <div style={{ fontWeight: 600, color: C.maroonDark, marginTop: 6 }}>Subí tu archivo de {label}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>Excel, PDF, foto del papel o CSV · uno o varios · o arrastralo acá</div>
            <input type="file" accept=".csv,.xlsx,.xls,.xlsm,.pdf,image/*" multiple onChange={onFileSelected} style={{ display: "none" }} />
          </label>
        ) : (header && !confirmado) ? (() => {
          // ── Mapeo guiado, de a un campo ──
          const [campo, lbl] = guia[step];
          const mv = map[campo];
          const esDiv = mv && typeof mv === "object" && Array.isArray(mv.div);
          const sel = (typeof mv === "number" && mv >= 0) ? mv : -1;
          const da = esDiv ? mv.div[0] : -1, db = esDiv ? mv.div[1] : -1;
          const divisible = ["cantidad", "importe", "precio"].includes(campo);
          const ultimo = step === guia.length - 1;
          const selStyle = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: C.ink, background: C.paper, marginTop: 6 };
          const usados = new Set();
          Object.entries(map).forEach(([f, v]) => { if (f === campo) return; if (typeof v === "number" && v >= 0) usados.add(v); else if (v && typeof v === "object" && Array.isArray(v.div)) { usados.add(v.div[0]); usados.add(v.div[1]); } });
          const ej = (i) => campo === "descripcion" ? muestraLarga(i) : (["nombre", "rubro", "subrubro"].includes(campo) ? muestra3(i) : muestra(i));
          const optData = header.map((c, i) => usados.has(i) ? null : ({ value: i, label: c || `Columna ${i + 1}`, ej: ej(i) })).filter(Boolean);
          const optCol = [{ value: -1, label: "— No está en mi archivo —", ej: "" }, ...optData];
          const pill = (on) => ({ flex: 1, border: `1.5px solid ${on ? accent : C.border}`, background: on ? accent : C.card, color: on ? "#fff" : C.muted, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
          return (
            <div style={{ textAlign: "left" }}>
              <AnthonyDice pose="presenta" size={70} accent={accent}>
                {step === 0
                  ? <>¡Listo, leí tu archivo de {label}!<br />Vamos de a uno:<br />¿cuál de tus columnas es <b>{lbl}</b>?</>
                  : <>¿cuál de tus columnas es <b>{lbl}</b>?</>}
              </AnthonyDice>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 10, marginTop: 4 }}>
                <div style={{ position: "relative", background: "#eaf4fb", border: "1px solid #cfe6f5", borderRadius: 14, borderBottomRightRadius: 4, padding: "12px 15px", maxWidth: "82%", flex: "1 1 auto", boxShadow: "0 2px 10px rgba(20,60,90,.06)" }}>
                  <span style={{ position: "absolute", right: -7, bottom: 10, width: 12, height: 12, background: "#eaf4fb", borderRight: "1px solid #cfe6f5", borderBottom: "1px solid #cfe6f5", transform: "rotate(-45deg)" }} />
                  {esDiv ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#173a52", marginBottom: 6 }}>{oracion(lbl)}: dividir dos columnas</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><FieldSelect value={da} onChange={(v) => asignarDiv(campo, v, db)} options={optData} /></div>
                        <span style={{ fontWeight: 700, color: "#173a52", fontSize: 18 }}>÷</span>
                        <div style={{ flex: 1 }}><FieldSelect value={db} onChange={(v) => asignarDiv(campo, da, v)} options={optData} /></div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "#3a5a70", marginTop: 9 }}>Ej: <b style={{ color: "#173a52" }}>{muestra(da) || "—"}</b> ÷ <b style={{ color: "#173a52" }}>{muestra(db) || "—"}</b></div>
                    </>
                  ) : (
                    <FieldSelect value={sel} onChange={(v) => asignar(campo, v)} options={optCol} />
                  )}
                  {divisible && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => { if (esDiv) asignar(campo, -1); }} style={pill(!esDiv)}>Es una columna</button>
                      <button onClick={() => { if (!esDiv) asignarDiv(campo, (typeof map.importe === "number" && map.importe >= 0) ? map.importe : 0, (typeof map.cantidad === "number" && map.cantidad >= 0) ? map.cantidad : Math.min(1, header.length - 1)); }} style={pill(esDiv)}>Calcular (A ÷ B)</button>
                    </div>
                  )}
                </div>
                <MeAvatar />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <button onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0}
                  style={{ background: "none", border: `1px solid ${C.border}`, color: step === 0 ? C.muted : accent, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: step === 0 ? "default" : "pointer", fontFamily: "inherit", opacity: step === 0 ? .5 : 1 }}>← Atrás</button>
                <span style={{ fontSize: 12.5, color: C.muted }}>Paso {step + 1} de {guia.length}</span>
                <Btn small accent={accent} onClick={() => { if (ultimo) setConfirmado(true); else setStep((x) => x + 1); }}>{ultimo ? "✓ Confirmar" : "Siguiente →"}</Btn>
              </div>
            </div>
          );
        })() : (
          // ── Resumen + vista previa compacta ──
          <div style={{ textAlign: "left" }}>
            <div style={{ color: C.ok, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>✓ {prev.length} {kind === "ventas" ? "productos" : kind === "menu" ? "platos" : "insumos"} detectados {reading ? "· leyendo…" : ""}</div>
            {header && (() => {
              const isMap = (i) => (typeof i === "number" && i >= 0) || (i && typeof i === "object" && Array.isArray(i.div));
              const val = (i) => (i && typeof i === "object" && Array.isArray(i.div)) ? `${header[i.div[0]] || "?"} ÷ ${header[i.div[1]] || "?"}` : (typeof i === "number" && i >= 0) ? (header[i] || `Columna ${i + 1}`) : "—";
              const mapeados = guia.filter(([f]) => isMap(map[f]));
              const sinMapear = guia.filter(([f]) => !isMap(map[f]));
              const chip = ([f, l], on) => {
                const cur = (map[f] && typeof map[f] === "object" && Array.isArray(map[f].div)) ? "div" : (typeof map[f] === "number" && map[f] >= 0 ? map[f] : -1);
                return (
                  <div key={f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: C.muted, background: C.shade, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", marginBottom: 6, minHeight: 34 }}>
                    <span style={{ whiteSpace: "nowrap" }}>{l}:</span>
                    {editMapeo ? (
                      <select value={cur} onChange={(e) => { const v = e.target.value; if (v === "div") return; asignar(f, Number(v)); }}
                        style={{ flex: "0 1 auto", maxWidth: 190, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5, color: C.ink, background: C.card, fontFamily: "inherit" }}>
                        <option value={-1}>— No está —</option>
                        {cur === "div" && <option value="div">{val(map[f])} (calculado)</option>}
                        {header.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                      </select>
                    ) : (
                      <b style={{ color: on ? C.ink : C.muted, textAlign: "right" }}>{val(map[f])}</b>
                    )}
                  </div>
                );
              };
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ok, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Campos mapeados</div>
                      {mapeados.length ? mapeados.map((g) => chip(g, true)) : <div style={{ fontSize: 12.5, color: C.muted }}>—</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Campos sin mapear</div>
                      {sinMapear.length ? sinMapear.map((g) => chip(g, false)) : <div style={{ fontSize: 12.5, color: C.muted }}>Ninguno 🎉</div>}
                    </div>
                  </div>
                  <button onClick={() => setEditMapeo((v) => !v)} style={{ background: editMapeo ? accent : C.card, border: `1px solid ${editMapeo ? accent : accent}`, color: editMapeo ? "#fff" : accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10, padding: "7px 14px", borderRadius: 8 }}>{editMapeo ? "✓ Listo, guardar mapeo" : "✏️ Modificar mapeo"}</button>
                </div>
              );
            })()}
            <div style={{ maxHeight: 180, overflow: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col />
                  {kind === "ventas" ? (<><col style={{ width: 62 }} /><col style={{ width: 78 }} /><col style={{ width: 78 }} /></>) : (<col style={{ width: 80 }} />)}
                  <col style={{ width: 96 }} /><col style={{ width: 96 }} />
                </colgroup>
                <thead><tr>{cols.map((h, i) => (<th key={i} style={{ background: accent, color: "#fff", padding: "7px 10px", textAlign: i === 0 ? "left" : i >= cols.length - 2 ? "left" : "right", fontSize: 11.5, position: "sticky", top: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</th>))}</tr></thead>
                <tbody>
                  {prev.slice(0, 8).map((r, idx) => (
                    <tr key={idx} style={{ background: idx % 2 ? C.shade : C.card }}>
                      <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, whiteSpace: "normal", wordBreak: "break-word" }}>{r.nombre}</td>
                      {kind === "ventas" ? (<>
                        <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, textAlign: "right", color: C.muted, fontVariantNumeric: "tabular-nums" }}>{fmt(r.unidades)}</td>
                        <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, textAlign: "right", color: C.muted, fontVariantNumeric: "tabular-nums" }}>${fmt(r.ingresos)}</td>
                        <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, textAlign: "right", color: C.gold, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${fmt(r.precio)}</td>
                      </>) : (
                        <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, textAlign: "right", color: C.gold, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${fmt(r.precio)}</td>
                      )}
                      <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: r.rubro ? C.ink : C.muted, whiteSpace: "normal", wordBreak: "break-word" }}>{r.rubro || "—"}</td>
                      <td style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: r.subRubro ? C.ink : C.muted, whiteSpace: "normal", wordBreak: "break-word" }}>{r.subRubro || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prev.length > 8 && <div style={{ fontSize: 12, color: C.muted, padding: "6px 12px", background: C.card }}>y {prev.length - 8} más…</div>}
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 12 }}>
              <label style={{ cursor: "pointer", fontSize: 13, color: accent, fontWeight: 600 }}>➕ Agregar más archivos<input type="file" accept=".csv,.xlsx,.xls,.xlsm,.pdf,image/*" multiple onChange={onFileSelected} style={{ display: "none" }} /></label>
              <button onClick={reset} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🗑 Limpiar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// lee UN archivo de cualquier formato y devuelve líneas de texto
async function readOne(f, kind) {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  const mime = f.type || "";
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(f, { complete: (r) => resolve(rowsToLines(r.data, kind)), error: reject });
    });
  }
  if (["xlsx", "xls", "xlsm"].includes(ext)) {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const best = bestSheetRows(wb.SheetNames.map((sn) => XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 })));
    return best ? rowsToLines(best.rows, kind) : "";
  }
  if (ext === "pdf") return extractWithAI(kind, "application/pdf", await toB64(f), true);
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return extractWithAI(kind, mime || "image/jpeg", await toB64(f), false);
  }
  return f.text();
}
const EXTRACT_PROMPTS = {
  menu: 'Esto es la carta/menú de un restaurante. Extraé cada plato con su precio. Devolvé SOLO una línea por plato con el formato "Nombre del plato - precio" (precio solo el número, sin moneda; si no hay precio, dejá solo el nombre). Sin encabezados, categorías ni texto extra.',
  ventas: 'Extraé las ventas. Devolvé SOLO una línea por ítem con el formato "Nombre - unidades - importe" (solo números). Sin texto extra.',
  insumos: 'Extraé la lista de insumos/productos. Devolvé SOLO una línea por insumo con el formato "Nombre - precio" (precio solo número; si no hay precio, dejá solo el nombre). Sin encabezados ni texto extra.',
  compras: 'Extraé las compras. Devolvé SOLO una línea por insumo con el formato "Nombre - precio" (precio solo número). Sin texto extra.',
};
async function extractWithAI(kind, mediaType, b64, isPdf) {
  const content = [];
  if (isPdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
  else content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: b64 } });
  content.push({ type: "text", text: EXTRACT_PROMPTS[kind] });
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/ai/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ system: "Sos un extractor de datos para un ERP gastronómico. Respondés SOLO con las líneas pedidas, sin comentarios ni markdown.", content }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.text || "").replace(/```/g, "").trim();
}

// Mismo prompt que extractWithAI, pero para un PDF cuyo texto YA se extrajo
// por código (extractPdfText) — se manda como texto plano en vez del binario
// completo del documento: más rápido, más barato, y no depende de que la IA
// "lea" el layout del PDF.
async function extractTextWithAI(kind, text) {
  const token = localStorage.getItem("token");
  const content = [{ type: "text", text: `${EXTRACT_PROMPTS[kind]}\n\nTexto extraído del documento:\n${text.slice(0, 12000)}` }];
  const res = await fetch(`${API_BASE}/ai/assist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ system: "Sos un extractor de datos para un ERP gastronómico. Respondés SOLO con las líneas pedidas, sin comentarios ni markdown.", content }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.text || "").replace(/```/g, "").trim();
}

// Extrae la carta de un archivo (cualquier formato) con nombre, precio y servicio/sección
async function extractMenuFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = file.type || "";
  const isImgPdf = ext === "pdf" || mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  if (isImgPdf) {
    const b64 = await toB64(file);
    const content = [];
    if (ext === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
    else content.push({ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } });
    content.push({ type: "text", text: 'Esto es la carta/menú de un restaurante. Extraé cada plato con su precio y la sección/servicio bajo la que aparece (ej: Cafetería, Comidas, Bebidas, Postres, Promociones). Devolvé SOLO un array JSON [{"nombre":"...","precio":número o "","servicio":"..."}], sin texto extra ni markdown.' });
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/ai/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ system: "Extraés datos de cartas. Respondés SOLO JSON.", content }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const txt = (data?.text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    try { const s = txt.indexOf("["); return JSON.parse(txt.slice(s >= 0 ? s : 0)); } catch { return []; }
  }
  // Excel / CSV: nombre y precio (sin servicio)
  const lines = await readOne(file, "menu");
  return parseMenu(lines).map((p) => ({ nombre: p.nombre, precio: p.precioVenta, servicio: "" }));
}

// Proxy IA de Lazarillo. La key vive en el backend (env ANTHROPIC_API_KEY),
// nunca en el browser. El endpoint recibe {system, user, json} y devuelve
// { text } o { json } según corresponda.
// NOTA: mientras el proxy no exista (Paso A), callClaude devuelve null en vez
// de crashear, así Anthony es navegable sin la IA. Los pasos que dependen de
// la IA deben tolerar un resultado null (ya lo hacen: muestran error suave).
async function callClaude(system, userText, expectJSON = false, tries = 4) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/ai/assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ system, user: userText, json: expectJSON }),
      });
      if (!res.ok) {
        // 404 = proxy aún no montado (Paso A): no reintentar, devolver null
        if (res.status === 404) return null;
        // 429 (límite de tasa) o 5xx (sobrecarga): reintentar con espera; otros: cortar
        if ((res.status === 429 || res.status >= 500) && attempt < tries - 1) { await espera(800 * (attempt + 1)); continue; }
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();
      if (expectJSON) {
        // el proxy ya puede devolver el JSON parseado en data.json
        if (data && data.json != null) return data.json;
        const j = extractJSON(data?.text || "");
        if (j == null) { if (attempt < tries - 1) { await espera(600); continue; } throw new Error("Sin JSON válido en la respuesta"); }
        return j;
      }
      const text = (data?.text || "").trim();
      if (!text) { if (attempt < tries - 1) { await espera(800 * (attempt + 1)); continue; } throw new Error("Respuesta vacía"); }
      return text;
    } catch (e) {
      lastErr = e;
      if (attempt < tries - 1) { await espera(800 * (attempt + 1)); continue; }
    }
  }
  throw lastErr || new Error("Falló la llamada");
}

// código correlativo por rubro a partir de los existentes
function nextCodigo(cod, insumos) {
  const n = insumos.filter((i) => i.codRubro === cod).length + 1;
  return `${cod}-${String(n).padStart(4, "0")}`;
}

// genera el escandallo de un plato y lo integra al listado de insumos (sin duplicar)
async function buildReceta(art, baseInsumos) {
  const sys = `Sos el asistente de Lazarillo. Te doy el nombre de un plato/producto gastronómico. Devolvé SOLO un array JSON de sus insumos (escandallo), sin texto extra. Cada elemento: {"nombre":"insumo","cantidad": número,"unidad":"Gramo|Mililitro|Unidad|Kilogramo|Litro","codRubro":"NN"}. codRubro de esta lista: ${RUBRO_TXT}. Cantidades realistas por porción. Máximo 9 insumos.`;
  const arr = await callClaude(sys, `Plato: ${art.nombre}`, true);
  let nuevos = [...baseInsumos];
  const recetaIns = arr.map((o) => {
    const cod = RUBROS.find((r) => r[0] === String(o.codRubro))?.[0] || "99";
    let ex = nuevos.find((x) => x.nombre.toLowerCase() === String(o.nombre).toLowerCase());
    if (!ex) {
      ex = { id: crypto.randomUUID(), nombre: o.nombre, codRubro: cod, rubro: RUBROS.find((r) => r[0] === cod)[1], unidad: UNIDADES.includes(o.unidad) ? o.unidad : "Unidad", precio: "A REVISAR", codInsumo: nextCodigo(cod, nuevos) };
      nuevos = [...nuevos, ex];
    }
    return { insumoId: ex.id, nombre: ex.nombre, cantidad: o.cantidad, unidad: ex.unidad };
  });
  return { recetaIns, insumos: nuevos };
}

// ───────────────────────── UI atoms ─────────────────────────
const Btn = ({ children, onClick, disabled, ghost, small, style, accent }) => {
  const a = accent || C.maroon;
  return (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? "#C7CCD4" : ghost ? "transparent" : a,
      color: ghost ? a : "#fff",
      border: ghost ? `1px solid ${a}` : "none",
      borderRadius: 10, padding: small ? "7px 13px" : "11px 18px",
      fontSize: small ? 13 : 15, fontWeight: 600,
      cursor: disabled ? "default" : "pointer", transition: "background .15s",
      fontFamily: "inherit", ...style,
    }}
  >
    {children}
  </button>
  );
};

const Tag = ({ cod }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, color: cod === "99" ? C.danger : C.gold,
    letterSpacing: ".5px",
  }}>{cod}</span>
);

// componentes de formulario a nivel de módulo (no recrear en cada render para no perder el foco)
const Lbl = ({ children }) => <div style={{ fontWeight: 600, color: C.maroonDark, fontSize: 13.5, margin: "0 0 6px" }}>{children}</div>;
const WInp = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", fontSize: 14, color: C.ink, background: C.paper, fontFamily: "inherit" };
const WField = ({ label, value, onChange, ph, half }) => (
  <div style={{ flex: half ? "1 1 200px" : "1 1 100%" }}>
    <Lbl>{label}</Lbl>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} style={WInp} />
  </div>
);
const WArea = ({ label, value, onChange, ph, rows }) => (
  <div style={{ flex: "1 1 100%" }}>
    <Lbl>{label}</Lbl>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} rows={rows || 4} style={{ ...WInp, resize: "vertical", minHeight: 96, lineHeight: 1.5 }} />
  </div>
);
const Panel = ({ titulo, sub, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
    {titulo != null && <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "0 0 6px", color: C.maroonDark }}>{titulo}</h2>}
    {sub != null && <p style={{ color: C.muted, marginTop: 0 }}>{sub}</p>}
    {children}
  </div>
);
const Footer = ({ children }) => (
  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>{children}</div>
);

// Anthony, el guía de Lazarillo
const Anthony = ({ pose = "senala", size = 84 }) => (
  <img src={ANT[pose] || ANT.senala} alt="Anthony" style={{ height: size, width: "auto", objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 3px 6px rgba(20,30,50,.12))" }} />
);
function FieldSelect({ value, onChange, options, background = "#eaf4fb" }) {
  const [open, setOpen] = React.useState(false);
  const sel = options.find((o) => o.value === value);
  const render = (o, faded) => <><b>{o.label}</b>{o.ej ? <span style={{ fontWeight: 400, color: faded ? "#3a5a70" : "#2c4a5e" }}> — ej: {o.ej}</span> : ""}</>;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", border: "1px solid #bcdcef", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, color: "#173a52", background, fontFamily: "inherit", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel ? render(sel, false) : "Elegí…"}</span>
        <span style={{ flexShrink: 0, color: "#5a7a8e", fontSize: 11 }}>▼</span>
      </button>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #bcdcef", borderRadius: 8, boxShadow: "0 10px 28px rgba(20,60,90,.18)", zIndex: 60, maxHeight: 280, overflowY: "auto" }}>
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid #eef5fa", background: o.value === value ? "#eaf4fb" : "#fff", padding: "9px 11px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#173a52", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.35 }}>{render(o, true)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
const MeAvatar = ({ size = 46 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#5BC2EA", border: "2px solid #2492C8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(20,60,90,.18)" }}>
    <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4" /><path d="M12 14c-4.4 0-8 2.2-8 5.2V21h16v-1.8c0-3-3.6-5.2-8-5.2z" /></svg>
  </div>
);
const AnthonyDice = ({ pose = "senala", size = 84, children, accent }) => {
  const a = accent || C.gold;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, margin: "0 0 18px" }}>
      <Anthony pose={pose} size={size} />
      <div style={{ position: "relative", background: "#eaf4fb", border: `1px solid #cfe6f5`, borderRadius: 14, borderBottomLeftRadius: 4, padding: "12px 15px", color: "#173a52", fontSize: 14, lineHeight: 1.5, maxWidth: 560, boxShadow: "0 2px 10px rgba(20,60,90,.06)" }}>
        <span style={{ position: "absolute", left: -7, bottom: 10, width: 12, height: 12, background: "#eaf4fb", borderLeft: `1px solid #cfe6f5`, borderBottom: `1px solid #cfe6f5`, transform: "rotate(45deg)" }} />
        {children}
      </div>
    </div>
  );
};

// ───────────────────────── App ─────────────────────────
export default function AsistenteOnboarding({ businessId: businessIdProp = null, onDone } = {}) {
  const [view, setView] = useState("home"); // home | marcha | nuevo
  const [insumos, setInsumos] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [brand, setBrand] = useState(null);
  // businessId del negocio recién creado (o el pasado por prop). Lo comparten
  // los pasos que persisten datos (menú, insumos, etc).
  const [businessId, setBusinessId] = useState(businessIdProp);

  useEffect(() => { loadLearned(); }, []);

  const reset = () => { setView("home"); setBrand(null); };

  return (
    <div style={{ fontFamily: "'Archivo',sans-serif", background: brand?.background || C.paper, minHeight: "100vh", color: C.ink, display: "flex", flexDirection: "column", transition: "background .25s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Archivo:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} textarea::placeholder,input::placeholder{color:${C.muted}}
        .rise{animation:rise .22s ease both}@keyframes rise{from{opacity:0}to{opacity:1}}
        .dot{width:6px;height:6px;border-radius:50%;background:${C.maroon};display:inline-block;animation:blink 1.2s infinite both}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        @keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
        table{border-collapse:collapse;width:100%} td,th{font-size:13px}
        input,select,textarea{font-family:inherit}
      `}</style>

      {/* Barra propia del asistente — misma altura que antes (56px, la usan
          otros elementos sticky de más abajo como referencia), pero SIN
          sticky/fixed: el Navbar real de la app ya envuelve esta pantalla
          (ver App.jsx), así que quedaba una segunda barra fija encima de la
          otra. */}
      <div style={{ height: 56, boxSizing: "border-box", background: brand?.secondary || LAZ.secondary, color: "#fff", padding: "0 22px", borderBottom: `2px solid ${brand?.primary || LAZ.primary}`, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background .25s,border-color .25s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_LIGHT} alt="Lazarillo" style={{ height: 20, objectFit: "contain", display: "block" }} />
          <span style={{ fontSize: 12, opacity: .85, letterSpacing: ".5px" }}>
            {brand?.nombre ? <>ASISTENTE DE ALTA DE <b style={{ fontWeight: 700 }}>{brand.nombre}</b></> : "ASISTENTE DE ALTA"}
          </span>
        </div>
        {view !== "home" && <Btn ghost small onClick={reset} style={{ color: "#fff", border: "1px solid rgba(255,255,255,.45)" }}>← Inicio</Btn>}
      </div>

      <div style={{ flex: 1, width: "100%", maxWidth: 1000, margin: "0 auto", padding: "22px" }}>
        {view === "home" && <Home onPick={setView} />}
        {view === "marcha" && <EnMarcha insumos={insumos} setInsumos={setInsumos} articulos={articulos} setArticulos={setArticulos} onBrand={setBrand} businessId={businessId} setBusinessId={setBusinessId} onDone={onDone} />}
        {view === "nuevo" && <Nuevo insumos={insumos} setInsumos={setInsumos} articulos={articulos} setArticulos={setArticulos} onBrand={setBrand} businessId={businessId} setBusinessId={setBusinessId} onDone={onDone} />}
      </div>
    </div>
  );
}

// ───────────────────────── Home ─────────────────────────
function Home({ onPick }) {
  const cards = [
    { k: "marcha", eyebrow: "YA OPERÁS", t: "Negocio en marcha", d: "Ya tenés ventas y compras. Las subís, el asistente arma el menú y los insumos solo, y vos revisás y completás." },
    { k: "nuevo", eyebrow: "DESDE CERO", t: "Proyecto de negocio", d: "Todavía no tenés nada cargado. Arrancamos por el concepto del negocio y de ahí construimos el menú y sus insumos." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <AnthonyDice pose="saluda" size={96}>¡Hola! Soy <b>Anthony</b>, tu guía en Lazarillo. Te acompaño a dar de alta tu negocio, paso a paso. Contame...</AnthonyDice>
      <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 30, fontWeight: 600, color: LAZ.secondary, margin: "0 0 8px", textAlign: "center" }}>¿Cómo está tu negocio hoy?</h1>
      <p style={{ color: C.muted, margin: "0 0 28px", textAlign: "center" }}>Elegí el punto de partida y te acompaño hasta dejar tu negocio gastronómico listo para empezar a gestionarlo.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, width: "100%", maxWidth: 720 }}>
        {cards.map((c) => (
          <button key={c.k} onClick={() => onPick(c.k)} style={{ textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "22px 20px", cursor: "pointer", transition: "transform .15s,box-shadow .15s,border-color .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(21,39,63,.14)"; e.currentTarget.style.borderColor = LAZ.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = C.border; }}>
            <div style={{ fontSize: 12, color: LAZ.skydeep, fontWeight: 700, marginBottom: 8, textTransform:"uppercase", letterSpacing:".12em" }}>{c.eyebrow}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 21, fontWeight: 600, color: LAZ.secondary, marginBottom: 8 }}>{c.t}</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{c.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Stepper compartido ─────────────────────────
function Steps({ items, active, accent, onStep }) {
  const a = accent || C.maroon;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div onClick={() => onStep && onStep(i)} role={onStep ? "button" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 20, background: i === active ? a : i < active ? C.shade : "transparent", color: i === active ? "#fff" : i < active ? a : C.muted, border: `1px solid ${i <= active ? a : C.border}`, fontSize: 13, fontWeight: 600, cursor: onStep ? "pointer" : "default", userSelect: "none" }}>
            <span style={{ opacity: .8 }}>{i + 1}</span>{s}
          </div>
          {i < items.length - 1 && <span style={{ color: C.border }}>→</span>}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── NEGOCIO EN MARCHA ─────────────────────────
// normalización al importar: nombres tipo Oración, rubros/sub-rubros en MAYÚSCULA
const oracion = (s) => { const t = String(s || "").trim(); if (!t) return ""; const low = t.toLowerCase(); return low.replace(/\p{L}/u, (c) => c.toUpperCase()); };
const mayus = (s) => String(s || "").trim().toUpperCase();
const keyName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

function parseMenu(raw) {
  return raw.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() && l.trim().toLowerCase() !== "nombre").map((line) => {
    if (line.indexOf("\\t") >= 0) {
      const [nombre = "", precio = "", rubro = "", subRubro = "", codRubro = "", codSubRubro = "", codigo = "", descripcion = "", foto = ""] = line.split("\\t");
      return { nombre: oracion(nombre), precioVenta: precio ? String(cellNum(precio)) : "", rubro: mayus(rubro), subRubro: mayus(subRubro), codRubro: codRubro.trim(), codSubRubro: codSubRubro.trim(), codigo: codigo.trim(), descripcion: (descripcion || "").trim(), foto: (foto || "").trim() };
    }
    const m = line.match(/^(.*?)[\s\-|:]*\$?\s*([\d][\d.,]*)\s*$/);
    if (m && m[2] && m[1].trim()) return { nombre: oracion(m[1]), precioVenta: String(cellNum(m[2])), rubro: "", subRubro: "", codRubro: "", codSubRubro: "", codigo: "" };
    return { nombre: oracion(line), precioVenta: "", rubro: "", subRubro: "", codRubro: "", codSubRubro: "", codigo: "" };
  });
}
// separa el nombre (texto) de los campos numéricos del final de la línea
function splitNums(line) {
  const m = line.match(/^(.*?)((?:[\s\-|:$,]*\d[\d.,]*)+)\s*$/);
  if (!m) return { nombre: line.trim(), nums: [] };
  const nombre = m[1].replace(/[\s\-|:$,]+$/, "").trim() || line.trim();
  const nums = (m[2].match(/\d[\d.,]*/g) || []).map((n) => cellNum(n));
  return { nombre, nums };
}
// precio unitario = importe (número grande) / cantidad (número chico)
function unitPrice(nums) {
  const n = nums.map(Number).filter((x) => !isNaN(x));
  if (n.length >= 2) { const imp = Math.max(...n), qty = Math.min(...n); return { qty, importe: imp, unit: qty > 0 ? Math.round(imp / qty) : imp }; }
  if (n.length === 1) return { qty: 0, importe: n[0], unit: n[0] };
  return { qty: 0, importe: 0, unit: 0 };
}
function parseVentas(raw) {
  const acc = {}, order = [];
  raw.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim()).forEach((line) => {
    let core = line, extras = ["", "", "", "", "", ""];
    const ti = line.indexOf("\\t");
    if (ti >= 0) { core = line.slice(0, ti); extras = line.slice(ti + 1).split("\\t"); }
    const { nombre, nums } = splitNums(core); if (!nombre) return;
    const { qty, importe, unit } = unitPrice(nums);
    const nom = oracion(nombre); const k = nom.toLowerCase();
    if (!acc[k]) { acc[k] = { nombre: nom, unidades: 0, ingresos: 0, precio: "", rubro: mayus(extras[0]), subRubro: mayus(extras[1]), codRubro: (extras[2] || "").trim(), codSubRubro: (extras[3] || "").trim(), codigo: (extras[4] || "").trim(), descripcion: (extras[5] || "").trim() }; order.push(k); }
    else { if (!acc[k].rubro && extras[0]) acc[k].rubro = mayus(extras[0]); if (!acc[k].subRubro && extras[1]) acc[k].subRubro = mayus(extras[1]); if (!acc[k].codRubro && extras[2]) acc[k].codRubro = extras[2].trim(); if (!acc[k].codSubRubro && extras[3]) acc[k].codSubRubro = extras[3].trim(); if (!acc[k].codigo && extras[4]) acc[k].codigo = extras[4].trim(); if (!acc[k].descripcion && extras[5]) acc[k].descripcion = extras[5].trim(); }
    acc[k].unidades += qty; acc[k].ingresos += importe;
    if (unit) acc[k].precio = String(unit); // el último (más reciente) pisa al anterior
  });
  return order.map((k) => acc[k]);
}
function parseCompras(raw) {
  const acc = {}, order = [];
  raw.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim()).forEach((line) => {
    let nombre, precioStr = "", unidad = "", rubro = "", codRubro = "", codInsumo = "";
    if (line.indexOf("\\t") >= 0) { const p = line.split("\\t"); nombre = p[0] || ""; precioStr = (p[1] || "").trim(); unidad = (p[2] || "").trim(); rubro = (p[3] || "").trim(); codRubro = (p[4] || "").trim(); codInsumo = (p[5] || "").trim(); }
    else { const sp = splitNums(line); nombre = sp.nombre; if (!nombre || !sp.nums.length) return; const up = unitPrice(sp.nums); precioStr = up.unit ? String(up.unit) : ""; }
    if (!nombre) return;
    const nom = oracion(nombre); const k = nom.toLowerCase();
    if (!acc[k]) { acc[k] = { nombre: nom, precio: precioStr, unidad, rubro: mayus(rubro), codRubro, codInsumo }; order.push(k); }
    else { if (precioStr) acc[k].precio = precioStr; if (!acc[k].unidad && unidad) acc[k].unidad = unidad; if (!acc[k].rubro && rubro) acc[k].rubro = mayus(rubro); if (!acc[k].codRubro && codRubro) acc[k].codRubro = codRubro; if (!acc[k].codInsumo && codInsumo) acc[k].codInsumo = codInsumo; }
  });
  return order.map((k) => acc[k]);
}
const comprasMap = (raw) => Object.fromEntries(parseCompras(raw).map((c) => [c.nombre.toLowerCase(), c.precio]));

// insumos: nombre + precio opcional (acepta "name - precio" o solo "name")
function parseInsumos(raw) {
  const out = [], seen = {};
  raw.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim()).forEach((line) => {
    let nombre, precioStr = "", unidad = "", rubro = "", codRubro = "", codInsumo = "";
    if (line.indexOf("\\t") >= 0) { const p = line.split("\\t"); nombre = p[0] || ""; precioStr = (p[1] || "").trim(); unidad = (p[2] || "").trim(); rubro = (p[3] || "").trim(); codRubro = (p[4] || "").trim(); codInsumo = (p[5] || "").trim(); }
    else { const sp = splitNums(line); nombre = sp.nombre; precioStr = sp.nums.length ? String(Math.max(...sp.nums)) : ""; }
    if (!nombre) return;
    const nom = oracion(nombre); const k = nom.toLowerCase(); if (seen[k]) return; seen[k] = 1;
    out.push({ nombre: nom, precio: precioStr, unidad, rubro: mayus(rubro), codRubro, codInsumo });
  });
  return out;
}

// ── Paleta desde el logo ──
const toHex = ({ r, g, b }) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
function rgbInfo(r, g, b) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const lum = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (lum > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
  return { sat, lum };
}
function getPalette(src) {
  return new Promise((res) => {
    const run = (url) => {
      const img = new Image();
      if (typeof url === "string" && url.startsWith("http")) img.crossOrigin = "anonymous"; // data: no necesita y blob proxeado se rompe
      img.onload = () => {
        try {
          const s = 48, cv = document.createElement("canvas"); cv.width = s; cv.height = s;
          const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, s, s);
          const data = ctx.getImageData(0, 0, s, s).data;
          const hist = {};
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const qr = Math.round(data[i] / 24) * 24, qg = Math.round(data[i + 1] / 24) * 24, qb = Math.round(data[i + 2] / 24) * 24;
            hist[`${qr},${qg},${qb}`] = (hist[`${qr},${qg},${qb}`] || 0) + 1;
          }
          const ent = Object.entries(hist).map(([k, c]) => { const [r, g, b] = k.split(",").map(Number); return { r, g, b, c, ...rgbInfo(r, g, b) }; });
          if (!ent.length) return res(null);
          const colored = ent.filter((e) => e.sat > 0.12 && e.lum > 0.1 && e.lum < 0.92).sort((a, b) => (b.c * (0.4 + b.sat)) - (a.c * (0.4 + a.sat)));
          const byCount = ent.slice().sort((a, b) => b.c - a.c);
          const mono = colored.length === 0;
          const primary = colored[0] || byCount.find((e) => e.lum < 0.8) || byCount[0];
          const darks = ent.filter((e) => e.lum < 0.4).sort((a, b) => b.c - a.c);
          const secondary = (darks[0] && darks[0] !== primary) ? darks[0] : { r: Math.round(primary.r * 0.45), g: Math.round(primary.g * 0.45), b: Math.round(primary.b * 0.45) };
          const lights = ent.filter((e) => e.lum > 0.85).sort((a, b) => b.c - a.c);
          // El fondo de página debe ser claro y NEUTRO. Si el logo solo tiene claros saturados
          // (ej: el celeste de Lazarillo), no lo usamos crudo: lo llevamos casi a blanco.
          const neutralLight = ent.filter((e) => e.lum > 0.9 && e.sat < 0.12).sort((a, b) => b.c - a.c)[0];
          let background;
          if (neutralLight) {
            background = neutralLight;
          } else {
            const lt = lights[0] || primary;
            const mix = (v) => Math.round(v + (255 - v) * 0.9); // 90% hacia el blanco => tinte muy suave
            background = { r: mix(lt.r), g: mix(lt.g), b: mix(lt.b) };
          }
          res({ primary: toHex(primary), secondary: toHex(secondary), background: toHex(background), mono });
        } catch { res(null); }
      };
      img.onerror = () => res(null);
      img.src = url;
    };
    if (typeof src === "string") run(src);
    else { const fr = new FileReader(); fr.onload = () => run(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(src); }
  });
}

// Proxy de imágenes con CORS: saltea bloqueos de hotlinking y habilita leer colores del logo.
function proxify(u) {
  try { return "https://wsrv.nl/?url=" + encodeURIComponent(String(u).replace(/^https?:\/\//, "")) + "&w=256&output=png"; }
  catch { return u; }
}
// <img> que prueba directo y, si falla, reintenta por el proxy antes de darse por vencido.
const LogoImg = ({ url, onFail, style }) => {
  const [src, setSrc] = useState(url);
  const tried = useRef(false);
  useEffect(() => { setSrc(url); tried.current = false; }, [url]);
  return (
    <img src={src} alt="logo" style={style}
      onError={() => {
        if (!tried.current && /^https?:/.test(url)) { tried.current = true; setSrc(proxify(url)); }
        else onFail && onFail();
      }} />
  );
};
// El sandbox no muestra imágenes externas: traemos los bytes (vía proxy CORS) y los volvemos data: URL.
async function fetchAsDataUrl(url) {
  const toData = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  const grab = async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw 0;
    const b = await r.blob();
    if (!/^image\//.test(b.type) || b.size < 80) throw 0; // descartar no-imagen / vacíos
    return await toData(b);
  };
  try { return await grab(url); } catch { /* sin CORS directo */ }
  try { return await grab(proxify(url)); } catch { /* proxy falló/bloqueado */ }
  return null;
}

// ── Wizard: datos del negocio (3 pasos) ──
function extractJSON(txt) {
  const t = String(txt || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const tryP = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
  let r = tryP(t); if (r !== undefined) return r;
  const close = { "{": "}", "[": "]" };
  for (let i = 0; i < t.length; i++) {
    const o = t[i]; if (o !== "{" && o !== "[") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < t.length; j++) {
      const ch = t[j];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === o) depth++;
      else if (ch === close[o]) { depth--; if (depth === 0) { const p = tryP(t.slice(i, j + 1)); if (p !== undefined) return p; break; } }
    }
  }
  return null;
}
// Búsqueda real vía Google Places (backend proxy en /api/places/search — la
// key de Google vive solo ahí). Reemplaza la búsqueda por IA: más precisa,
// más rápida, y sin gastar tokens de Anthropic en algo que Places resuelve mejor.
async function buscarNegocio(query, loc, zona) {
  try {
    const token = localStorage.getItem("token");
    const q = zona ? `${query} ${zona}` : query;
    const params = new URLSearchParams({ q });
    if (loc?.lat != null && loc?.lng != null) { params.set("lat", String(loc.lat)); params.set("lng", String(loc.lng)); }
    const res = await fetch(`${API_BASE}/places/search?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = data?.opciones;
    return Array.isArray(arr) ? arr.filter((o) => o && (o.nombre || o.ciudad || o.calle)) : [];
  } catch { return []; }
}
// Geocodifica una zona/ciudad a coordenadas vía Google Geocoding (backend
// proxy en /api/places/geocode), para sesgar la búsqueda de arriba cuando no
// hay GPS disponible.
async function geocodeZona(texto) {
  if (!texto || !texto.trim()) return null;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/places/geocode?text=${encodeURIComponent(texto.trim())}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat === "number" && typeof data?.lng === "number") return { lat: data.lat, lng: data.lng, zona: data.zona || texto };
  } catch { /* nada */ }
  return null;
}
function DatosNegocio({ onDone, onBrand, creando, errCrear }) {
  const [ws, setWs] = useState(0);
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [opciones, setOpciones] = useState([]);
  const [logoOpts, setLogoOpts] = useState([]);
  const [logoFail, setLogoFail] = useState([]);
  const [buscandoLogos, setBuscandoLogos] = useState(false);
  const [paletaMsg, setPaletaMsg] = useState("");
  const searchRef = useRef(0);
  const [loc, setLoc] = useState(null);          // {lat,lng} | null
  const [ubic, setUbic] = useState("idle");      // idle | ok | denied | unsupported
  const [zonaB, setZonaB] = useState("");        // zona/ciudad opcional para sesgar la búsqueda
  const [busqError, setBusqError] = useState(""); // mensaje de error de búsqueda (inline)
  const [logoUrl, setLogoUrl] = useState("");    // texto del campo de URL manual
  const [logoTried, setLogoTried] = useState(false); // ya intentamos traer logos para este negocio
  const [logoColores, setLogoColores] = useState(null); // paleta original generada por el logo (para resetear)
  const [d, setD] = useState({ nombre: "", telefono: "", ciudad: "", calle: "", numero: "", descripcion: "", logo: "", instagram: "", facebook: "", tiktok: "", web: "", wifiNombre: "", wifiClave: "", fuente: "'Archivo', sans-serif", colores: { primary: "#2492C8", secondary: "#15213E", background: "#F2F4F7" } });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const setColor = (k, v) => setD((p) => ({ ...p, colores: { ...p.colores, [k]: v } }));

  useEffect(() => { onBrand && onBrand({ primary: d.colores.primary, secondary: d.colores.secondary, background: d.colores.background, logo: d.logo, nombre: d.nombre }); }, [d.colores.primary, d.colores.secondary, d.colores.background, d.logo, d.nombre]);

  const onLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPaletaMsg("Generando colores desde el logo…");
    const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(""); fr.readAsDataURL(f); });
    set("logo", url);
    const pal = await getPalette(url || f);
    if (pal) {
      const np = { primary: pal.primary, secondary: pal.secondary, background: pal.background };
      setLogoColores(np); setD((p) => ({ ...p, colores: np }));
      setPaletaMsg(pal.mono ? "Tu logo casi no tiene color, así que la paleta quedó sobria. Ajustala en Estilos si querés." : "✓ Generé los colores desde tu logo. Mirá el paso Estilos (los podés cambiar).");
    } else {
      setPaletaMsg("No pude leer los colores del logo. Ajustalos a mano en Estilos.");
    }
  };

  const pedirUbicacion = () => new Promise((resolve) => {
    if (!navigator.geolocation) { setUbic("unsupported"); resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = { lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4) }; setLoc(c); setUbic("ok"); resolve(c); },
      () => { setUbic("denied"); resolve(null); },
      { timeout: 5000, maximumAge: 600000 }
    );
  });

  const buscar = async () => {
    if (!query.trim() || buscando) return;
    const myId = ++searchRef.current;
    setBuscando(true); setOpciones([]); setLogoOpts([]); setLogoFail([]); setBusqError("");
    // Ubicación para sesgar: 1) si hay zona escrita, la geocodifico (anda en el sandbox); 2) si no, intento GPS (popup del navegador).
    let useLoc = loc;
    if (!useLoc && zonaB.trim()) { useLoc = await geocodeZona(zonaB.trim()); if (myId !== searchRef.current) return; if (useLoc) setLoc(useLoc); }
    if (!useLoc && ubic !== "ok") { useLoc = await pedirUbicacion(); if (myId !== searchRef.current) return; }
    try {
      let arr = [];
      for (let intento = 0; intento < 4 && !arr.length; intento++) {
        arr = await buscarNegocio(query.trim(), useLoc || loc, zonaB.trim());
        if (myId !== searchRef.current) return; // cancelada (cambió el texto)
      }
      if (!arr.length) { setBusqError("No encontré nada en este intento (a veces la primera búsqueda falla). Probá de nuevo, o agregá la zona/ciudad."); return; }
      if (arr.length === 1) aplicar(arr[0]); else setOpciones(arr);
    } catch { if (myId === searchRef.current) setBusqError("No pude completar la búsqueda. Probá de nuevo o cargá los datos a mano."); }
    finally { if (myId === searchRef.current) setBuscando(false); }
  };

  const aplicar = async (o) => {
    const tok = searchRef.current;
    setD((p) => ({ ...p, nombre: o.nombre || p.nombre, telefono: o.telefono || p.telefono, ciudad: o.ciudad || p.ciudad, calle: o.calle || p.calle, numero: o.numero || p.numero, descripcion: o.descripcion || p.descripcion, web: o.web || p.web, instagram: o.instagram || p.instagram, facebook: o.facebook || p.facebook, tiktok: o.tiktok || p.tiktok }));
    const cands = Array.isArray(o.logos) ? o.logos.filter((u) => typeof u === "string" && u.startsWith("http")) : [];
    let dominio = ""; try { dominio = new URL(o.web).hostname.replace(/^www\./, ""); } catch { /* sin web */ }
    if (dominio) { cands.push(`https://logo.clearbit.com/${dominio}`); cands.push(`https://www.google.com/s2/favicons?domain=${dominio}&sz=256`); cands.push(`https://icons.duckduckgo.com/ip3/${dominio}.ico`); }
    setLogoFail([]); setLogoOpts([]); setOpciones([]); setLogoTried(true);
    if (!cands.length) return;
    setBuscandoLogos(true);
    try {
      // Ya no buscamos el logo con IA: el dominio confirmado por Places alcanza
      // (Clearbit/favicon/duckduckgo). Precargamos directo el primero que
      // resuelva — si no es el correcto, se puede elegir otro de la lista o
      // subir uno propio.
      const fuentes = [...new Set(cands)].slice(0, 10);
      const resueltos = await Promise.all(fuentes.map((u) => fetchAsDataUrl(u)));
      const dataUrls = [...new Set(resueltos.filter(Boolean))].slice(0, 6);
      if (tok === searchRef.current) {
        setLogoOpts(dataUrls);
        if (dataUrls.length) await elegirLogo(dataUrls[0]);
      }
    } catch { /* nada */ }
    finally { if (tok === searchRef.current) setBuscandoLogos(false); }
  };

  const elegirLogo = async (url) => {
    set("logo", url);
    setPaletaMsg("Generando colores desde el logo…");
    let pal = await getPalette(url);
    if (!pal && /^https?:/.test(url)) pal = await getPalette(proxify(url)); // reintento con CORS
    if (pal) {
      const np = { primary: pal.primary, secondary: pal.secondary, background: pal.background };
      setLogoColores(np); setD((p) => ({ ...p, colores: np }));
      setPaletaMsg(pal.mono ? "Logo sin mucho color: paleta sobria. Ajustala en Estilos." : "✓ Generé los colores desde ese logo (editables en Estilos).");
    } else {
      setPaletaMsg("No pude leer los colores de ese logo (puede ser por restricción del sitio). Ajustalos en Estilos.");
    }
  };

  const usarUrlLogo = async (raw) => {
    const u = (raw || "").trim();
    if (!/^https?:\/\//.test(u)) return;
    setPaletaMsg("Trayendo el logo…");
    const data = await fetchAsDataUrl(u);
    if (!data) { setPaletaMsg("No pude traer ese logo (el sitio lo bloquea). Probá descargarlo y subirlo con el botón."); return; }
    setLogoUrl("");
    await elegirLogo(data);
  };

  const inp = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", fontSize: 14, color: C.ink, background: C.paper, fontFamily: "inherit" };

  const brand = d.colores || { primary: C.maroon, secondary: C.maroonDark, background: C.paper };

  return (
    <div className="rise">
      <Steps items={["Datos Principales", "Estilos", "Redes Sociales"]} active={ws} accent={brand.primary} onStep={setWs} />
      <AnthonyDice pose={buscando ? "investiga" : ws === 0 ? "saluda" : ws === 1 ? "presenta" : "senala"} size={84} accent={brand.primary}>
        {buscando ? "Dame un segundo que busco tu negocio en Google…"
          : ws === 0 ? "Buscá tu local arriba y completo los datos por vos. Después subí el logo y te armo los colores."
          : ws === 1 ? "Estos son los colores que saqué de tu logo. Si no te cierran, cambialos acá."
          : "Por último, sumá tus redes sociales para tenerlas a mano."}
      </AnthonyDice>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `4px solid ${brand.primary}`, borderRadius: 14, padding: 22, transition: "border-color .2s" }}>
        {ws === 0 && (
          <>
            <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "0 0 14px", color: brand.secondary }}>Datos del local</h2>
            <div style={{ background: C.shade, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 13.5, color: C.ink, marginBottom: 8 }}><b>📍 Buscá tu negocio</b> y autocompleto los datos desde Google.</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input value={query} onChange={(e) => { searchRef.current++; setQuery(e.target.value); setBuscando(false); setBuscandoLogos(false); setOpciones([]); setLogoOpts([]); setLogoFail([]); setLogoTried(false); setBusqError(""); }} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="Nombre del local + ciudad (ej: FC San Justo, Ramos Mejía)" style={{ ...WInp, flex: 1, minWidth: 240, background: C.card }} />
                <Btn accent={brand.primary} onClick={buscar} disabled={buscando || !query.trim()}>{buscando ? "Buscando…" : "🔎 Buscar"}</Btn>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}>Zona/ciudad (opcional):</span>
                <input value={zonaB} onChange={(e) => setZonaB(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="ej: Ramos Mejía, oeste GBA" style={{ ...WInp, flex: 1, minWidth: 160, padding: "7px 10px", fontSize: 13, background: C.card }} />
              </div>
              {ubic === "ok" && <div style={{ fontSize: 12, color: C.muted, marginTop: 7 }}>📍 Priorizando resultados cerca de tu ubicación.</div>}
              {(ubic === "denied" || ubic === "unsupported") && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 7 }}>
                  {ubic === "denied" ? "No pude acceder a tu ubicación (acá en el preview suele estar bloqueada; en tu app va a pedir permiso normal)." : "Tu navegador no comparte ubicación."} Usá el campo <b>Zona/ciudad</b> de arriba para afinar.
                  {ubic === "denied" && <> · <button onClick={() => pedirUbicacion()} style={{ background: "none", border: "none", color: brand.primary, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0 }}>Reintentar ubicación</button></>}
                </div>
              )}
              {busqError && (
                <div style={{ fontSize: 12.5, color: C.danger, marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{busqError}</span>
                  <button onClick={buscar} style={{ background: "none", border: `1px solid ${C.border}`, color: brand.primary, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12, borderRadius: 6, padding: "3px 9px" }}>🔄 Reintentar</button>
                </div>
              )}
              {opciones.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>Encontré estas (ordenadas por relevancia), ¿cuál es la tuya?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {opciones.map((o, i) => (
                      <button key={i} onClick={() => aplicar(o)} style={{ textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, color: C.maroonDark, fontSize: 14 }}>{o.nombre}</div>
                        <div style={{ fontSize: 12.5, color: C.muted }}>{[o.calle, o.numero].filter(Boolean).join(" ")}{(o.calle || o.numero) && o.ciudad ? " · " : ""}{o.ciudad}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <WField label="Nombre" value={d.nombre} onChange={(v) => set("nombre", v)} ph="Ej: FC San Justo" />
              <WField label="Teléfono" value={d.telefono} onChange={(v) => set("telefono", v)} ph="+54 9 …" half />
              <WField label="Ciudad" value={d.ciudad} onChange={(v) => set("ciudad", v)} ph="Ramos Mejía" half />
              <WField label="Calle" value={d.calle} onChange={(v) => set("calle", v)} ph="Calle 123" half />
              <WField label="Número" value={d.numero} onChange={(v) => set("numero", v)} ph="(opcional)" half />
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <WArea label="Descripción" value={d.descripcion} onChange={(v) => set("descripcion", v)} ph="Contá brevemente de qué es el local, su estilo, especialidades…" rows={4} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Lbl>Logo</Lbl>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && usarUrlLogo(logoUrl)} onBlur={() => usarUrlLogo(logoUrl)} placeholder="Pegá una URL (https://…) y Enter" style={{ ...inp, flex: 1, minWidth: 220 }} />
                <span style={{ color: C.muted, fontSize: 13 }}>o</span>
                <label style={{ cursor: "pointer", background: brand.primary, color: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600 }}>Subir logo
                  <input type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} /></label>
                {d.logo && <LogoImg url={d.logo} style={{ height: 44, borderRadius: 8, border: `1px solid ${C.border}`, objectFit: "contain", background: "#fff" }} />}
              </div>
              {(d.logo || paletaMsg) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  {paletaMsg && <span style={{ fontSize: 12.5, color: paletaMsg.startsWith("✓") ? C.ok : C.muted }}>{paletaMsg}</span>}
                  <span style={{ display: "inline-flex", gap: 5 }}>
                    {["primary", "secondary", "background"].map((k) => <span key={k} title={d.colores[k]} style={{ width: 16, height: 16, borderRadius: 4, background: d.colores[k], border: `1px solid ${C.border}` }} />)}
                  </span>
                </div>
              )}
              {(logoOpts.length > 0 || buscandoLogos || logoTried) && (() => {
                const visibles = logoOpts.filter((u) => !logoFail.includes(u));
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>{buscandoLogos ? "Buscando el logo en la web…" : (visibles.length ? "Logos que encontré (elegí uno):" : "Encontré el logo pero este entorno de prueba no deja traerlo. Subilo con el botón de acá arriba (en tu app sale solo).")}</div>
                    {visibles.length > 0 && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {visibles.map((u, i) => (
                          <button key={i} onClick={() => elegirLogo(u)} title="Usar este logo"
                            style={{ width: 56, height: 56, borderRadius: 10, border: `2px solid ${d.logo === u ? C.maroon : C.border}`, background: "#fff", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <LogoImg url={u} onFail={() => setLogoFail((f) => [...f, u])} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {ws === 1 && (
          <>
            <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "0 0 4px", color: brand.secondary }}>Estilos</h2>
            <p style={{ color: C.muted, marginTop: 0, fontSize: 13.5 }}>{d.logo ? "Estos colores los saqué de tu logo. Cambialos si querés." : "Elegí los colores de tu marca (o subí un logo en el paso anterior y los genero solos)."}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {[["primary", "Primary"], ["secondary", "Secondary"], ["background", "Background"]].map(([k, l]) => (
                <div key={k} style={{ flex: "1 1 180px" }}>
                  <Lbl>{l}</Lbl>
                  <div style={{ height: 46, borderRadius: 10, border: `1px solid ${C.border}`, background: d.colores[k], position: "relative", overflow: "hidden" }}>
                    <input type="color" value={d.colores[k]} onChange={(e) => setColor(k, e.target.value.toUpperCase())} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                  </div>
                  <input value={d.colores[k]} onChange={(e) => setColor(k, e.target.value)} style={{ ...inp, marginTop: 8, fontVariantNumeric: "tabular-nums" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              <button onClick={() => setD((p) => ({ ...p, colores: { ...p.colores, primary: p.colores.secondary, secondary: p.colores.primary } }))}
                style={{ background: "none", border: `1px solid ${C.border}`, color: brand.primary, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ⇄ Alternar primario / secundario
              </button>
              {logoColores && JSON.stringify(logoColores) !== JSON.stringify(d.colores) && (
                <button onClick={() => setD((p) => ({ ...p, colores: { ...logoColores } }))}
                  style={{ background: "none", border: `1px solid ${C.border}`, color: brand.primary, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  ↺ Restablecer colores del logo
                </button>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <Lbl>Fuente (CSS)</Lbl>
              <input value={d.fuente} onChange={(e) => set("fuente", e.target.value)} style={inp} />
            </div>
          </>
        )}

        {ws === 2 && (
          <>
            <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "0 0 14px", color: brand.secondary }}>Redes sociales</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <WField label="Instagram" value={d.instagram} onChange={(v) => set("instagram", v)} ph="https://instagram.com/…" half />
              <WField label="Facebook" value={d.facebook} onChange={(v) => set("facebook", v)} ph="https://facebook.com/…" half />
              <WField label="TikTok" value={d.tiktok} onChange={(v) => set("tiktok", v)} ph="https://tiktok.com/@…" half />
              <WField label="Sitio web" value={d.web} onChange={(v) => set("web", v)} ph="https://…" />
            </div>
            <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "18px 0 6px", color: brand.secondary, fontSize: 18 }}>WiFi del local</h2>
            <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 13 }}>Para mostrarlo al pie de las hojas del menú (opcional).</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <WField label="Red WiFi" value={d.wifiNombre} onChange={(v) => set("wifiNombre", v)} ph="Nombre de la red" half />
              <WField label="Contraseña WiFi" value={d.wifiClave} onChange={(v) => set("wifiClave", v)} ph="Clave" half />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
          {ws > 0 && <Btn ghost small accent={brand.primary} onClick={() => setWs(ws - 1)}>← Atrás</Btn>}
          <div style={{ flex: 1 }} />
          {ws < 2
            ? <Btn accent={brand.primary} onClick={() => setWs(ws + 1)} disabled={ws === 0 && !d.nombre.trim()}>Siguiente →</Btn>
            : <Btn accent={brand.primary} onClick={async () => { try { await onDone(d); } catch { /* el error se muestra abajo */ } }} disabled={creando || !d.nombre.trim()}>{creando ? "Creando tu negocio…" : "Empezar con ventas →"}</Btn>}
        </div>
        {errCrear && <p style={{ color: C.danger, fontSize: 13, marginTop: 12, textAlign: "right" }}>{errCrear}</p>}
      </div>
    </div>
  );
}

// Revisión de carta: tabla (código/nombre/precio) + modo diseño tipo carta impresa
const SERVICIOS = ["Cafetería", "Comidas", "Bebidas", "Postres", "Promociones"];
// Asigna códigos correlativos a rubro / sub-rubro (no se muestran; quedan en los datos)
function codificarRubros(arts) {
  const rubroCod = {}, subCod = {}, subN = {}; let rN = 0;
  // si falta el NOMBRE de rubro/sub-rubro pero hay código, uso el código como nombre
  const norm = arts.map((a) => ({ ...a, rubro: a.rubro || "", subRubro: a.subRubro || "" }));
  norm.forEach((a) => { if (a.rubro && a.codRubro) rubroCod[a.rubro] = a.codRubro; }); // respetar los que vienen del archivo
  return norm.map((a) => {
    const ru = a.rubro || ""; if (!ru) return a;
    if (!(ru in rubroCod)) { rN++; rubroCod[ru] = String(rN).padStart(2, "0"); }
    if (!(ru in subN)) subN[ru] = 0;
    let cs = a.codSubRubro || ""; const su = a.subRubro || "";
    if (su && !cs) { const key = ru + "||" + su; if (!(key in subCod)) { subN[ru]++; subCod[key] = String(subN[ru]).padStart(2, "0"); } cs = subCod[key]; }
    return { ...a, codRubro: a.codRubro || rubroCod[ru], codSubRubro: cs };
  });
}
// ── Generador de diseño de carta (creativo) ──
const MENU_FONTS = [
  { d: "'Sora',sans-serif", b: "'Archivo',sans-serif", imp: "Sora:wght@600;700&family=Archivo:wght@400;600" },
  { d: "'Playfair Display',serif", b: "'Lato',sans-serif", imp: "Playfair+Display:wght@600;700;900&family=Lato:wght@400;700" },
  { d: "'Cormorant Garamond',serif", b: "'Montserrat',sans-serif", imp: "Cormorant+Garamond:wght@600;700&family=Montserrat:wght@400;600" },
  { d: "'Bebas Neue',sans-serif", b: "'Archivo',sans-serif", imp: "Bebas+Neue&family=Archivo:wght@400;600" },
  { d: "'Libre Baskerville',serif", b: "'Source Sans 3',sans-serif", imp: "Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600" },
  { d: "'Oswald',sans-serif", b: "'Nunito Sans',sans-serif", imp: "Oswald:wght@500;600&family=Nunito+Sans:wght@400;600" },
  { d: "'Abril Fatface',serif", b: "'Poppins',sans-serif", imp: "Abril+Fatface&family=Poppins:wght@400;500" },
  { d: "'DM Serif Display',serif", b: "'DM Sans',sans-serif", imp: "DM+Serif+Display&family=DM+Sans:wght@400;500" },
  { d: "'Marcellus',serif", b: "'Karla',sans-serif", imp: "Marcellus&family=Karla:wght@400;600" },
  { d: "'Fraunces',serif", b: "'Work Sans',sans-serif", imp: "Fraunces:wght@500;600;700&family=Work+Sans:wght@400;500" },
];
const MENU_INKS = ["#2a2320", "#1f2a37", "#3a1212", "#23402e", "#2d2150", "#402a12", "#0f2a3a", "#3a2330", "#143230", "#37231a"];
const MENU_LINES = ["dotted", "solid", "dashed", "double"];
const MENU_ORN = ["", "✦", "❖", "◆", "❉", "✻", "·", "—", "☙", "✿", "❀", "➳", "✺", "❧", "✠"];
const pickRnd = (a) => a[Math.floor(Math.random() * a.length)];
const loadScript = (src) => new Promise((res, rej) => { if ([...document.scripts].some((s) => s.src === src)) return res(); const sc = document.createElement("script"); sc.src = src; sc.onload = () => res(); sc.onerror = () => rej(new Error("no load " + src)); document.head.appendChild(sc); });
let _libsP = null;
const ensureLibs = () => { if (!_libsP) _libsP = (async () => { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"); await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"); })(); return _libsP; };
const DISENO_BASE = { dFont: "'Sora',sans-serif", bFont: "'Archivo',sans-serif", fontImp: "", bg: "#ffffff", ink: "#2a2320", title: "#2a2320", leader: "#cfc7ba", line: "dotted", align: "left", upper: false, orn: "", frame: "box" };
function nuevoDisenoCfg(accent) { const f = pickRnd(MENU_FONTS), ink = pickRnd(MENU_INKS); return { dFont: f.d, bFont: f.b, fontImp: f.imp, bg: "#ffffff", ink, title: pickRnd([accent, ink, ink, pickRnd(MENU_INKS)]), leader: "#cfc7ba", line: pickRnd(MENU_LINES), align: pickRnd(["left", "left", "center"]), upper: Math.random() < 0.5, orn: pickRnd(MENU_ORN), frame: pickRnd(["box", "line", "double", "none"]) }; }
const MENU_NICE = ["#b5651d", "#1f6f6f", "#7a1f3d", "#2d5016", "#3a2d6b", "#8a3324", "#0f5e8f", "#5f4b1f", "#704214", "#1d3461", "#9b2226", "#005f73", "#6a040f", "#386641"];
const darkenHex = (hex, f) => { const h = String(hex || "#333").replace("#", ""); const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const r = parseInt(n.slice(0, 2), 16) || 0, g = parseInt(n.slice(2, 4), 16) || 0, b = parseInt(n.slice(4, 6), 16) || 0; const d = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return "#" + [d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
const randomPal = () => { const a = pickRnd(MENU_NICE); return { accent: a, ink: darkenHex(a, 0.42), title: a, leader: a + "66" }; };
const ICON_MAP = [
  [/(hamburg|burger)/i, "🍔"], [/(cerveza|beer|pinta|\bipa\b|lager|porter|stout|chopp|birra)/i, "🍺"],
  [/(caf[eé]|espresso|capuc|latte|cortado|flat white|☕)/i, "☕"], [/(pizza|muzza|fugazz|napolitana)/i, "🍕"],
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

function MenuReview({ articulos, setArticulos, onBack, onNext, accent = C.maroon, logo, nombre, negocio, hojasIniciales }) {
  const [mode, setMode] = useState("diseño");
  const [showLogo, setShowLogo] = useState(true);
  const [papel, setPapel] = useState("A4");
  const baseCfg = React.useMemo(() => ({ ...DISENO_BASE, ink: (negocio && negocio.colores && negocio.colores.secondary) || DISENO_BASE.ink, title: (negocio && negocio.colores && negocio.colores.secondary) || DISENO_BASE.title }), [negocio]);
  const [diseno, setDiseno] = useState(baseCfg);
  const [hojaPal, setHojaPal] = useState({});
  const [dlOpen, setDlOpen] = useState(null);
  const [dlPos, setDlPos] = useState({ x: 0, top: 0, bottom: 0 });
  const [dlBusy, setDlBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(null);
  const [printCfg, setPrintCfg] = useState({ size: "A4", orient: "v", cols: 0, fmt: "pdf" });
  const [printAt, setPrintAt] = useState(80);
  const [printPages, setPrintPages] = useState(1);
  const [hojaCols, setHojaCols] = useState({});
  const [comboDescs, setComboDescs] = useState({});
  const [tablaSort, setTablaSort] = useState({ key: null, dir: "asc" });
  const [totSort, setTotSort] = useState({ key: "ing", dir: "desc" });
  const [reading, setReading] = useState(false);
  const [clasificando, setClasificando] = useState(false);
  const [page, setPage] = useState(0);
  // Diseño tipo tablero: columnas (agrupaciones) = hojas del menú
  const [agrupaciones, setAgrupaciones] = useState(hojasIniciales && hojasIniciales.length ? hojasIniciales : [
    { id: "g1", nombre: "BEBIDAS" }, { id: "g2", nombre: "COMIDAS" }, { id: "g3", nombre: "CAFETERIA" }, { id: "g4", nombre: "PROMOCIONES" }, { id: "g5", nombre: "COCTELERÍA" }, { id: "g6", nombre: "FESTEJOS" },
  ]);
  const [dragItem, setDragItem] = useState(null);   // { artIds: [...] }
  const [dropAt, setDropAt] = useState(null);       // feedback visual de destino del drag
  const [offRubro, setOffRubro] = useState({});      // rubros discontinuados
  const [offSub, setOffSub] = useState({});          // sub-rubros discontinuados ("rubro||sub")
  const [editKey, setEditKey] = useState(null);      // edición inline de nombre de rubro/sub
  const [pendingDel, setPendingDel] = useState(null); // hoja pendiente de confirmación de borrado
  const [mergeOpen, setMergeOpen] = useState(false);   // panel para elegir qué hojas juntar
  const [mergeSel, setMergeSel] = useState([]);        // ids de hojas seleccionadas para juntar
  const [agruparPor, setAgruparPor] = useState("rubro"); // "rubro" | "sub" (vista diseño)
  const [selMode, setSelMode] = useState(false);     // modo selección para vista única
  const [sel, setSel] = useState([]);                // ids seleccionados
  const [comboName, setComboName] = useState("");    // nombre de la vista única a crear
  const [comboTarget, setComboTarget] = useState(null); // si agrego a una vista única existente
  const [vistaHoja, setVistaHoja] = useState("todas"); // "todas" | id de hoja
  const [lateralOpen, setLateralOpen] = useState(true); // menú lateral (sin agrupación / discontinuados)
  const [sidebarWide, setSidebarWide] = useState(false); // sidebar ancho + vista de una sola hoja
  const [collapsedRub, setCollapsedRub] = useState({}); // rubros/sub-rubros con contenido oculto en el sidebar
  const [cartaSumada, setCartaSumada] = useState(false); // ya se sumó al menos una carta (además de ventas)
  const [lateralTab, setLateralTab] = useState("pool");  // "pool" | "disc"
  const [menuOpen, setMenuOpen] = useState(null);    // key del item con menú contextual abierto
  const [menuPos, setMenuPos] = useState({ x: 0, top: 0, bottom: 0 });
  const [menuIds, setMenuIds] = useState([]);
  const [menuSheet, setMenuSheet] = useState(false); // el ítem está en una hoja
  const [menuCombo, setMenuCombo] = useState(null);  // si el ítem es una vinculación (combo)
  const [crearMode, setCrearMode] = useState(false); // el menú abierto está en modo "crear agrupación"
  const [crearName, setCrearName] = useState("");
  const asignRan = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [menuFiles, setMenuFiles] = useState(null);
  const [menuRaw, setMenuRaw] = useState("");
  const [importKey, setImportKey] = useState(0);
  const [rubroState, setRubroState] = useState("idle"); // idle | doing | done
  const rubroRan = useRef(false);
  const code = (i) => `A-${String(i + 1).padStart(4, "0")}`;

  const upd = (id, k, v) => setArticulos((prev) => prev.map((a) => a.id === id ? { ...a, [k]: v } : a));
  const del = (id) => setArticulos((prev) => prev.filter((a) => a.id !== id));
  const add = () => setArticulos((prev) => [...prev, { id: crypto.randomUUID(), codArt: code(prev.length), nombre: "", precioVenta: "", insumos: [], unidades: "", ingresos: "" }]);

  // Importa la carta desde archivo: suma servicio (agrupación) y precio
  const importFiles = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return; e.target.value = "";
    setReading(true);
    const rows = [];
    for (const f of files) { try { (await extractMenuFile(f)).forEach((r) => rows.push(r)); } catch { /* skip */ } }
    setArticulos((prev) => {
      const byName = {}; prev.forEach((a) => (byName[a.nombre.toLowerCase()] = a));
      const merged = [...prev];
      rows.forEach((r) => {
        if (!r.nombre) return;
        const serv = SERVICIOS.includes(r.servicio) ? r.servicio : (r.servicio || "");
        const ex = byName[r.nombre.toLowerCase()];
        if (ex) { if (r.precio) ex.precioVenta = String(r.precio); if (serv) ex.servicio = serv; }
        else { const a = { id: crypto.randomUUID(), codArt: code(merged.length), nombre: r.nombre, precioVenta: r.precio ? String(r.precio) : "", servicio: serv || undefined, insumos: [], unidades: "", ingresos: "" }; merged.push(a); byName[r.nombre.toLowerCase()] = a; }
      });
      return merged;
    });
    setReading(false);
  };

  const sumarMenu = () => {
    const rows = parseMenu(menuRaw);
    if (!rows.length) return;
    setArticulos((prev) => {
      const nc = (s) => { let t = String(s == null ? "" : s).trim().toLowerCase(); if (!t) return ""; if (/^\d+(\.0+)?$/.test(t)) t = String(parseInt(t, 10)); return t; };
      const byCode = {}; prev.forEach((a) => { const c = nc(a.codArt); if (c) byCode[c] = a; });
      const byName = {}; prev.forEach((a) => (byName[keyName(a.nombre)] = a));
      const merged = [...prev];
      rows.forEach((r) => {
        if (!r.nombre && !r.codigo) return;
        // 1º por código (si el archivo lo trae), 2º por nombre normalizado
        const ex = (r.codigo && nc(r.codigo) && byCode[nc(r.codigo)]) || byName[keyName(r.nombre)];
        if (ex) { if (r.precioVenta) ex.precioVenta = String(r.precioVenta); if (r.rubro) ex.rubro = r.rubro; if (r.subRubro) ex.subRubro = r.subRubro; if (r.codigo) ex.codArt = r.codigo; if (r.codRubro) ex.codRubro = r.codRubro; if (r.codSubRubro) ex.codSubRubro = r.codSubRubro; if (r.descripcion && !ex.descripcion) ex.descripcion = r.descripcion; if (r.foto && !ex.foto) ex.foto = r.foto; }
        else { const a = { id: crypto.randomUUID(), codArt: (r.codigo && String(r.codigo).trim()) ? String(r.codigo).trim() : code(merged.length), nombre: r.nombre, precioVenta: r.precioVenta ? String(r.precioVenta) : "", descripcion: r.descripcion || "", foto: r.foto || "", rubro: r.rubro || "", subRubro: r.subRubro || "", codRubro: r.codRubro || "", codSubRubro: r.codSubRubro || "", agrupacion: null, insumos: [], unidades: "", ingresos: "" }; merged.push(a); byName[keyName(r.nombre)] = a; if (nc(a.codArt)) byCode[nc(a.codArt)] = a; }
      });
      return codificarRubros(merged);
    });
    rubroRan.current = false; // permitir reclasificar lo nuevo que no traiga rubro
    setCartaSumada(true);
    setMenuRaw(""); setMenuFiles(null); setImportKey((k) => k + 1); setImportOpen(false);
  };

  const clasificarRubros = async () => {
    setRubroState("doing");
    try {
      const faltan = articulos.filter((a) => a.nombre && !a.rubro);
      if (faltan.length) {
        const arr = await callClaude(
          'Clasificá cada plato/producto de una carta gastronómica en un RUBRO y un SUB-RUBRO coherentes para un ERP. Ejemplos de rubros: Cafetería, Comidas, Bebidas sin alcohol, Bebidas con alcohol, Postres, Panadería, Promociones. El sub-rubro es una subcategoría más fina (ej: rubro "Comidas" → sub-rubros "Hamburguesas", "Pastas", "Ensaladas"; rubro "Cafetería" → "Café", "Tés e infusiones"). Devolvé SOLO un array JSON [{"nombre":"...","rubro":"...","subRubro":"..."}], sin texto extra.',
          faltan.map((a, i) => `${i + 1}. ${a.nombre}`).join("\n"), true);
        const m = {}; (Array.isArray(arr) ? arr : []).forEach((o) => { if (o && o.nombre) m[String(o.nombre).toLowerCase()] = o; });
        setArticulos((prev) => codificarRubros(prev.map((a) => { const o = m[a.nombre.toLowerCase()]; return (o && !a.rubro) ? { ...a, rubro: mayus(o.rubro || ""), subRubro: mayus(o.subRubro || "") } : a; })));
      } else {
        setArticulos((prev) => codificarRubros(prev));
      }
    } catch { /* noop */ } finally { setRubroState("done"); }
  };

  // No se clasifican rubros solos al entrar a Diseño (antes fallaba). Si hay solo códigos, se agrupa por código; el resto se agrupa a mano.

  const clasificarServicios = async () => {
    setClasificando(true);
    try {
      const names = articulos.map((a) => a.nombre).filter(Boolean);
      const arr = await callClaude(`Clasificá cada plato/producto en un servicio de carta. Servicios posibles exactos: ${SERVICIOS.join(", ")}. Devolvé SOLO un array JSON [{"nombre":"...","servicio":"..."}], sin texto extra.`, names.map((n, i) => `${i + 1}. ${n}`).join("\n"), true);
      const map = {}; arr.forEach((o) => (map[String(o.nombre).toLowerCase()] = o.servicio));
      setArticulos((prev) => prev.map((a) => ({ ...a, servicio: SERVICIOS.includes(map[a.nombre.toLowerCase()]) ? map[a.nombre.toLowerCase()] : (a.servicio || "Comidas") })));
    } catch { /* noop */ } finally { setClasificando(false); }
  };

  const toDesign = () => { setPage(0); setMode("diseño"); };

  // Diseño: las columnas (agrupaciones) son las hojas; los artículos se asignan por drag&drop
  const guessCol = (a) => {
    const cand = [a.servicio, a.rubro, a.subRubro].filter(Boolean).map((s) => String(s).toLowerCase());
    const g = agrupaciones.find((c) => { const n = c.nombre.toLowerCase(); return cand.some((x) => n === x || n.includes(x) || x.includes(n)); });
    return g ? g.id : null;
  };
  // Al entrar a Diseño NO se agrupa sola la carta: los productos arrancan en "Sin agrupar" y se agrupan a mano.
  const colArts = (colId) => articulos.filter((a) => !a.discontinuado && (colId === null ? (!a.agrupacion || !agrupaciones.some((g) => g.id === a.agrupacion)) : a.agrupacion === colId));
  const groupArts = (arts) => { const g = {}; arts.forEach((a) => { const r = (a.rubro || "Sin rubro"); const s = (a.subRubro || "Sin sub-rubro"); (g[r] = g[r] || {}); (g[r][s] = g[r][s] || []).push(a); }); return g; };
  const moverArts = (ids, colId) => setArticulos((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, agrupacion: colId, discontinuado: false } : a));
  // mueve productos a una hoja Y a un rubro/sub-rubro a la vez (para mover a un rubro que vive en otra hoja)
  const moverAHojaRubro = (ids, colId, rubro) => setArticulos((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, agrupacion: colId, discontinuado: false, ...(agruparPor === "rubro" ? { rubro: rubro === "Sin rubro" ? "" : rubro } : { subRubro: rubro === "Sin sub-rubro" ? "" : rubro }) } : a));
  // junta las hojas indicadas en la primera de ellas
  const juntarHojasSel = (ids) => {
    if (!ids || ids.length < 2) return;
    const destino = ids[0]; const rest = new Set(ids.slice(1));
    setArticulos((prev) => prev.map((a) => rest.has(a.agrupacion) ? { ...a, agrupacion: destino } : a));
    setAgrupaciones((g) => g.filter((c) => !rest.has(c.id)));
    setVistaHoja((v) => rest.has(v) ? destino : v);
    setMergeOpen(false); setMergeSel([]);
  };
  // junta TODAS las hojas en una sola (atajo)
  const juntarHojas = () => juntarHojasSel(agrupaciones.map((c) => c.id));
  const discontinuarArts = (ids, val) => setArticulos((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, discontinuado: val } : a));
  const setGrupoArts = (ids, val) => setArticulos((prev) => prev.map((a) => ids.includes(a.id) ? (agruparPor === "rubro" ? { ...a, rubro: val === "Sin rubro" ? "" : val } : { ...a, subRubro: val === "Sin sub-rubro" ? "" : val }) : a));
  const sepDebajo = (artId) => setArticulos((prev) => {
    const a = prev.find((x) => x.id === artId); if (!a) return prev;
    const gk = (x) => agruparPor === "rubro" ? (x.rubro || "Sin rubro") : (x.subRubro || "Sin sub-rubro");
    const inSame = (x) => x.agrupacion === a.agrupacion && gk(x) === gk(a);
    const prods = prev.filter((x) => !x.esSep && !x.discontinuado && inSame(x));
    const seps = prev.filter((x) => x.esSep && inSame(x));
    const U = (x) => Number(x.unidades) || 0;
    // construir entradas como en la vista (combos agrupados, separadoras incluidas)
    const seen = new Set(); const entries = [];
    prods.forEach((x) => {
      if (x.combo) { if (!seen.has(x.combo)) { seen.add(x.combo); const mem = prods.filter((y) => y.combo === x.combo); entries.push({ ids: mem.map((y) => y.id), o: Math.min(...mem.map((y) => y.orden != null ? y.orden : Infinity)), u: mem.reduce((s, y) => s + U(y), 0) }); } }
      else entries.push({ ids: [x.id], o: x.orden != null ? x.orden : Infinity, u: U(x) });
    });
    seps.forEach((s) => entries.push({ ids: [s.id], o: s.orden != null ? s.orden : Infinity, u: -1 }));
    entries.sort((A, B) => (A.o - B.o) || (B.u - A.u));
    const sep = { id: "sep" + Date.now(), esSep: true, agrupacion: a.agrupacion, rubro: a.rubro, subRubro: a.subRubro, discontinuado: false };
    const ti = entries.findIndex((e) => e.ids.includes(artId));
    const newEntries = [...entries.slice(0, ti + 1), { ids: [sep.id] }, ...entries.slice(ti + 1)];
    const om = {}; let n = 0; newEntries.forEach((e) => e.ids.forEach((id) => { om[id] = n++; }));
    return [...prev.map((x) => om[x.id] != null ? { ...x, orden: om[x.id] } : x), { ...sep, orden: om[sep.id] }];
  });
  const renameRubro = (oldR, newR) => { const n = String(newR || "").trim(); if (!n || n === oldR) return; setArticulos((prev) => prev.map((a) => (a.rubro || "Sin rubro") === oldR ? { ...a, rubro: n } : a)); };
  const renameSub = (r, oldS, newS) => { const n = String(newS || "").trim(); if (!n || n === oldS) return; setArticulos((prev) => prev.map((a) => ((a.rubro || "Sin rubro") === r && (a.subRubro || "Sin sub-rubro") === oldS) ? { ...a, subRubro: n } : a)); };
  const renameSubAll = (oldS, newS) => { const n = String(newS || "").trim(); if (!n || n === oldS) return; setArticulos((prev) => prev.map((a) => (a.subRubro || "Sin sub-rubro") === oldS ? { ...a, subRubro: n } : a)); };
  const setComboArts = (ids, name) => setArticulos((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, combo: name || null } : a));
  const addCol = () => setAgrupaciones((g) => [...g, { id: "g" + Date.now(), nombre: "NUEVA" }]);
  const addColGo = () => { const id = "g" + Date.now(); setAgrupaciones((g) => [...g, { id, nombre: "NUEVA" }]); setVistaHoja(id); setLateralTab("pool"); };
  const renameCol = (id, nombre) => setAgrupaciones((g) => g.map((c) => c.id === id ? { ...c, nombre } : c));
  const delCol = (id) => { setAgrupaciones((g) => g.filter((c) => c.id !== id)); setArticulos((prev) => prev.map((a) => a.agrupacion === id ? { ...a, agrupacion: null } : a)); setVistaHoja((v) => v === id ? "todas" : v); };
  const moveCol = (id, dir) => setAgrupaciones((g) => { const i = g.findIndex((c) => c.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= g.length) return g; const n = g.slice(); const t = n[i]; n[i] = n[j]; n[j] = t; return n; });
  const addColNamed = (nombre, ids) => { const id = "g" + Date.now(); const nom = String(nombre || "").trim() || "NUEVA"; setAgrupaciones((g) => [...g, { id, nombre: nom }]); moverArts(ids, id); };
  const resetOrden = () => setArticulos((prev) => prev.map((a) => { const { orden, rubroOrd, ...rest } = a; return rest; }));
  const crearCombo = () => { const n = comboTarget || comboName.trim(); if (!n || sel.length < (comboTarget ? 1 : 2)) return; setComboArts(sel, n); setSel([]); setComboName(""); setComboTarget(null); setSelMode(false); };
  const pill = (on, onClick, txt) => <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${on ? accent : C.border}`, background: on ? accent : C.card, color: on ? "#f7ece4" : C.ink, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{txt}</button>;
  const hojas = agrupaciones;
  const activa = hojas[Math.min(page, Math.max(0, hojas.length - 1))] || hojas[0];

  return (
    <>
      {diseno.fontImp ? <style>{`@import url('https://fonts.googleapis.com/css2?family=${diseno.fontImp}&display=swap');`}</style> : null}
      {(mode !== "diseño" || !articulos.length) && !importOpen && (
        <AnthonyDice pose="presenta" size={66} accent={accent}>
          {!articulos.length ? <><b>¿Tenés la carta en un archivo o foto?</b><br />Subila y te ayudo a mapearla (Excel, CSV, PDF o foto).</>
            : cartaSumada ? <>Sumé lo de tu carta al menú y lo vinculé con tus ventas (por código o nombre). Revisá nombres y precios, o dale una vuelta de diseño.<br /><br /><b>¿Querés sumar otra carta?</b></>
            : <>Acá está tu menú: lo armé desde tus ventas con el precio más reciente de cada producto. Revisá nombres y precios, o dale una vuelta de diseño.<br /><br /><b>¿Tenés la carta en un archivo o foto?</b><br />Subila y te ayudo a mapearla (Excel, CSV, PDF o foto).</>}
          <div style={{ marginTop: 12 }}>
            <label style={{ cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 700, background: accent, border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "inherit", display: "inline-block" }}>📎 {cartaSumada ? "Sumar otra carta" : "Subir carta"}<input type="file" accept=".csv,.xlsx,.xls,.xlsm,.pdf,image/*" multiple style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (!fs.length) return; setMenuFiles(fs); setImportOpen(true); }} /></label>
          </div>
        </AnthonyDice>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, ...(mode === "diseño" && articulos.length ? { width: "min(94vw, 1560px)", marginLeft: "calc((100% - min(94vw, 1560px)) / 2)", marginRight: "calc((100% - min(94vw, 1560px)) / 2)" } : {}) }}>
      {articulos.length > 0 && (<div style={{ position: "sticky", top: 56, zIndex: 40, background: C.card, margin: "-22px -22px 14px", padding: "12px 22px", borderBottom: `1px solid ${C.border}`, borderRadius: "14px 14px 0 0", boxShadow: "0 4px 10px -6px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", justifyContent: mode === "diseño" ? "space-between" : "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {mode === "diseño" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {negocio?.logo && pill(showLogo, () => setShowLogo((v) => !v), showLogo ? "🖼️ Logo" : "🖼️ Logo")}
                <button onClick={() => setDiseno(nuevoDisenoCfg(accent))} title="Generar un diseño nuevo (tipografías, colores, líneas, detalles)" style={{ padding: "5px 14px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>✨ Nuevo diseño</button>
                <button onClick={() => { setDiseno(baseCfg); setHojaPal({}); }} title="Volver al diseño base (paleta de la marca)" style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>↺</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {pill(selMode, () => { setSelMode((v) => !v); setSel([]); setComboName(""); setComboTarget(null); }, selMode ? "✕ Cancelar" : "🔗 Vincular productos")}
                {selMode && (
                  <>
                    <span style={{ fontSize: 12, color: C.muted }}>{sel.length} sel.{comboTarget ? ` → ${comboTarget}` : ""}</span>
                    {!comboTarget && <input value={comboName} onChange={(e) => setComboName(e.target.value)} placeholder="Nombre del vínculo (ej: Gaseosas 600cc)" style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", fontSize: 12.5, fontFamily: "inherit", color: C.ink, minWidth: 200 }} />}
                    <Btn small accent={accent} onClick={crearCombo} disabled={comboTarget ? sel.length < 1 : (sel.length < 2 || !comboName.trim())}>{comboTarget ? "Agregar" : "Vincular"}</Btn>
                  </>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "inline-flex", background: C.shade, borderRadius: 10, padding: 3 }}>
              {[["tabla", "Tabla"], ["diseño", "Diseño"]].map(([k, l]) => (
                <button key={k} onClick={() => k === "diseño" ? toDesign() : setMode("tabla")} disabled={clasificando || rubroState === "doing"}
                  style={{ border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: mode === k ? accent : "transparent", color: mode === k ? "#f7ece4" : accent, fontFamily: "inherit" }}>
                  {k === "diseño" && (clasificando || rubroState === "doing") ? "Agrupando…" : l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {mode === "diseño" && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 3, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 700, flex: "0 0 auto", marginRight: 2 }}>Menú:</span>
            <button onClick={() => setVistaHoja("todas")} style={{ flex: "0 0 auto", border: `1px solid ${vistaHoja === "todas" ? accent : C.border}`, background: vistaHoja === "todas" ? accent : C.card, color: vistaHoja === "todas" ? "#fff" : C.ink, borderRadius: 20, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Todas</button>
            {agrupaciones.map((g) => (
              <button key={g.id} onClick={() => setVistaHoja(g.id)} style={{ flex: "0 0 auto", border: `1px solid ${vistaHoja === g.id ? accent : C.border}`, background: vistaHoja === g.id ? accent : C.card, color: vistaHoja === g.id ? "#fff" : C.ink, borderRadius: 20, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{(iconFor(g.nombre) ? iconFor(g.nombre) + " " : "") + g.nombre}</button>
            ))}
            <button onClick={addColGo} title="Agregar una hoja nueva" style={{ flex: "0 0 auto", border: `1px dashed ${accent}`, background: C.card, color: accent, borderRadius: 20, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>＋ Nueva hoja</button>
            {agrupaciones.length > 1 && <button onClick={() => { setMergeSel([]); setMergeOpen((o) => !o); }} title="Elegir qué hojas juntar" style={{ flex: "0 0 auto", border: `1px solid ${mergeOpen ? accent : C.border}`, background: mergeOpen ? accent : C.card, color: mergeOpen ? "#fff" : C.muted, borderRadius: 20, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>⇊ Juntar hojas</button>}
          </div>
        )}
        {mode === "diseño" && mergeOpen && agrupaciones.length > 1 && (
          <div style={{ marginTop: 10, background: C.card, border: `1px solid ${accent}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Elegí las hojas que querés juntar (se combinan en la primera seleccionada):</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {agrupaciones.map((h) => {
                const on = mergeSel.includes(h.id);
                return (
                  <button key={h.id} onClick={() => setMergeSel((s) => s.includes(h.id) ? s.filter((x) => x !== h.id) : [...s, h.id])}
                    style={{ border: `1.5px solid ${on ? accent : C.border}`, background: on ? accent : C.card, color: on ? "#fff" : C.ink, borderRadius: 18, padding: "5px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {on ? "✓ " : ""}{h.nombre}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => juntarHojasSel(mergeSel)} disabled={mergeSel.length < 2} style={{ border: "none", background: mergeSel.length < 2 ? C.border : accent, color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: mergeSel.length < 2 ? "default" : "pointer", fontFamily: "inherit" }}>Juntar seleccionadas ({mergeSel.length})</button>
              <button onClick={juntarHojas} style={{ border: `1px solid ${C.border}`, background: C.card, color: C.muted, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Juntar todas</button>
              <button onClick={() => { setMergeOpen(false); setMergeSel([]); }} style={{ border: "none", background: "none", color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>)}
      {rubroState === "doing" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.shade, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: C.muted }}>
          <span className="dot" /><span className="dot" style={{ marginLeft: 3 }} /><span className="dot" style={{ marginLeft: 3 }} />
          <span>Agrupando por rubro y sub-rubro para Lazarillo…</span>
        </div>
      )}

      {importOpen && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14, background: C.card }}>
          <MappedUpload key={importKey} kind="menu" value={menuRaw} onChange={setMenuRaw} label="menú" accent={accent} logo={logo} nombre={nombre} files={menuFiles} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <button onClick={() => { setImportOpen(false); setMenuFiles(null); setMenuRaw(""); }} style={{ cursor: "pointer", fontSize: 13, color: C.muted, fontWeight: 600, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontFamily: "inherit" }}>Cerrar</button>
            <Btn accent={accent} onClick={sumarMenu} disabled={!menuRaw.trim()}>Sumar al menú →</Btn>
          </div>
        </div>
      )}

      {articulos.length > 0 && mode === "tabla" && (
        <>
          {(() => {
            const tot = {}; articulos.filter((a) => !a.esSep).forEach((a) => { const r = a.rubro || "Sin rubro"; (tot[r] = tot[r] || { u: 0, ing: 0, n: 0 }); tot[r].u += Number(a.unidades) || 0; tot[r].ing += Number(a.ingresos) || 0; tot[r].n += 1; });
            const rowsAll = Object.entries(tot);
            const sumU = rowsAll.reduce((s, [, v]) => s + v.u, 0), sumI = rowsAll.reduce((s, [, v]) => s + v.ing, 0);
            const base = sumI > 0 ? "ing" : "u"; const baseTot = base === "ing" ? sumI : sumU;
            const tk = totSort.key, td = totSort.dir === "asc" ? 1 : -1;
            const tval = (r, v) => tk === "rubro" ? r : tk === "u" ? v.u : tk === "pct" ? (base === "ing" ? v.ing : v.u) : v.ing;
            const rows = rowsAll.sort((A, B) => { const a = tval(A[0], A[1]), b = tval(B[0], B[1]); return (tk === "rubro" ? String(a).localeCompare(String(b), "es", { numeric: true }) : (a - b)) * td; });
            if (!rows.length) return null;
            const totHead = (label, key, right) => <th onClick={() => setTotSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))} style={{ background: C.card, color: tk === key ? C.ink : C.muted, padding: "6px 12px", textAlign: right ? "right" : "left", fontSize: 11.5, position: "sticky", top: 0, borderBottom: `1px solid ${C.border}`, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>{label}{tk === key ? (totSort.dir === "asc" ? " ▲" : " ▼") : ""}</th>;
            return (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ background: C.shade, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: C.ink }}>Totales por rubro</div>
                <div style={{ maxHeight: 220, overflow: "auto" }}>
                  <table>
                    <thead><tr>{totHead("Rubro", "rubro", false)}{totHead("Unidades", "u", true)}{totHead("Importe", "ing", true)}{totHead("%", "pct", true)}</tr></thead>
                    <tbody>
                      {rows.map(([r, v], idx) => (
                        <tr key={r} style={{ background: idx % 2 ? C.shade : C.card }}>
                          <td style={{ padding: "5px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.ink }}>{r}</td>
                          <td style={{ padding: "5px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.muted }}>{v.u ? v.u.toLocaleString("es-AR") : "—"}</td>
                          <td style={{ padding: "5px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.maroonDark, fontWeight: 700 }}>{v.ing ? "$" + Math.round(v.ing).toLocaleString("es-AR") : "—"}</td>
                          <td style={{ padding: "5px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.muted }}>{baseTot > 0 ? ((base === "ing" ? v.ing : v.u) / baseTot * 100).toFixed(1) + "%" : "—"}</td>
                        </tr>
                      ))}
                      <tr style={{ background: C.card }}>
                        <td style={{ padding: "6px 12px", fontWeight: 700, color: C.ink, borderTop: `2px solid ${C.border}` }}>Total</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: C.ink, borderTop: `2px solid ${C.border}` }}>{sumU ? sumU.toLocaleString("es-AR") : "—"}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: C.maroonDark, borderTop: `2px solid ${C.border}` }}>{sumI ? "$" + Math.round(sumI).toLocaleString("es-AR") : "—"}</td>
                        <td style={{ borderTop: `2px solid ${C.border}` }} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "auto", maxHeight: 440 }}>
            <table>
              <thead><tr>{[["Código", "codArt"], ["Nombre", "nombre"], ["Precio", "precioVenta"], ["Rubro", "rubro"], ["Agrupación", "agrupacion"], ["Discont.", "discontinuado"], ["", null]].map(([h, key], i) => (
                <th key={i} onClick={() => key && setTablaSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))} style={{ background: accent, color: "#f7ece4", padding: "10px 12px", textAlign: "left", fontSize: 12, position: "sticky", top: 0, cursor: key ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}>{h}{tablaSort.key === key && key ? (tablaSort.dir === "asc" ? " ▲" : " ▼") : ""}</th>))}</tr></thead>
              <tbody>
                {(() => {
                  const arr = [...articulos].filter((a) => !a.esSep);
                  const k = tablaSort.key, d = tablaSort.dir === "asc" ? 1 : -1;
                  if (k) { const val = (a) => k === "precioVenta" ? (Number(a.precioVenta) || 0) : k === "discontinuado" ? (a.discontinuado ? 1 : 0) : k === "agrupacion" ? ((agrupaciones.find((g) => g.id === a.agrupacion) || {}).nombre || "") : String(a[k] || (k === "codArt" ? (a.codArt || "") : "")); arr.sort((x, y) => { const xv = val(x), yv = val(y); return (typeof xv === "number" ? xv - yv : String(xv).localeCompare(String(yv), "es", { numeric: true })) * d; }); }
                  else arr.sort((x, y) => (Number(y.unidades) || 0) - (Number(x.unidades) || 0));
                  return arr;
                })().map((a, idx) => (
                  <tr key={a.id} style={{ background: idx % 2 ? C.shade : C.card }}>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{a.codArt || code(idx)}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>
                      <input value={a.nombre} onChange={(e) => upd(a.id, "nombre", e.target.value)} placeholder="Nombre del plato" style={{ width: "100%", minWidth: 180, border: "none", background: "transparent", fontSize: 13.5, color: C.ink, outline: "none" }} /></td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      <span style={{ color: C.muted }}>$</span> <input value={a.precioVenta} onChange={(e) => upd(a.id, "precioVenta", e.target.value)} placeholder="0" style={{ width: 90, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 13, color: C.gold, fontWeight: 700 }} /></td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      <input value={a.rubro || ""} onChange={(e) => upd(a.id, "rubro", e.target.value)} placeholder="—" style={{ width: 130, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12.5, color: C.ink, background: C.card }} /></td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      <select value={agrupaciones.some((g) => g.id === a.agrupacion) ? a.agrupacion : ""} onChange={(e) => upd(a.id, "agrupacion", e.target.value || null)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12.5, color: C.ink, background: C.card, fontFamily: "inherit", maxWidth: 150 }}>
                        <option value="">Sin agrupación</option>
                        {agrupaciones.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                      </select></td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
                      <button onClick={() => upd(a.id, "discontinuado", !a.discontinuado)} title={a.discontinuado ? "Discontinuado (clic para activar)" : "Activo (clic para discontinuar)"} style={{ border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 24, cursor: "pointer", fontWeight: 700, fontSize: 13, background: a.discontinuado ? "#f3f1ee" : C.card, color: a.discontinuado ? C.danger : C.ok, fontFamily: "inherit" }}>{a.discontinuado ? 1 : 0}</button></td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>
                      <button onClick={() => del(a.id)} title="Eliminar" style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
                {!articulos.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: C.muted }}>Sin platos todavía. Agregá uno o subí la carta.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12 }}><Btn small ghost onClick={add}>+ Agregar plato</Btn></div>
        </>
      )}

      {articulos.length > 0 && mode === "diseño" && (() => {
        const U = (a) => Number(a.unidades) || 0;
        const ING = (a) => Number(a.ingresos) || 0;
        const buildEntries = (list) => {
          const seen = new Set(); const es = [];
          list.forEach((a) => {
            if (a.esSep) { es.push({ sep: a, ids: [a.id], o: a.orden != null ? a.orden : Infinity, u: -1 }); }
            else if (a.combo) { if (!seen.has(a.combo)) { seen.add(a.combo); const mem = list.filter((x) => x.combo === a.combo); es.push({ combo: a.combo, mem, ids: mem.map((x) => x.id), o: Math.min(...mem.map((x) => x.orden != null ? x.orden : Infinity)), u: mem.reduce((s, x) => s + U(x), 0) }); } }
            else es.push({ art: a, ids: [a.id], o: a.orden != null ? a.orden : Infinity, u: U(a) });
          });
          es.sort((A, B) => (A.o - B.o) || (B.u - A.u));
          return es;
        };
        const groupKeysOrdered = (list) => {
          const m = {}; list.forEach((a) => { const k = dimKey(a); (m[k] = m[k] || { ro: Infinity, ing: 0 }); if (a.rubroOrd != null) m[k].ro = Math.min(m[k].ro, a.rubroOrd); m[k].ing += ING(a); });
          return Object.keys(m).sort((A, B) => (m[A].ro - m[B].ro) || (m[B].ing - m[A].ing));
        };
        const reorderEntries = (gk, dragId, targetId) => setArticulos((prev) => {
          const list = prev.filter((a) => dimKey(a) === gk && !a.discontinuado);
          const es = buildEntries(list); const moved = es.find((e) => e.ids.includes(dragId)); if (!moved) return prev;
          const rest = es.filter((e) => e !== moved); const ti = rest.findIndex((e) => e.ids.includes(targetId));
          rest.splice(ti < 0 ? rest.length : ti, 0, moved);
          const map = {}; rest.forEach((e, i) => e.ids.forEach((id) => map[id] = i));
          return prev.map((a) => map[a.id] != null ? { ...a, orden: map[a.id] } : a);
        });
        const reorderGroups = (dragKey, targetKey) => setArticulos((prev) => {
          const keys = groupKeysOrdered(prev.filter((a) => !a.discontinuado)); const rest = keys.filter((k) => k !== dragKey);
          const ti = rest.indexOf(targetKey); rest.splice(ti < 0 ? rest.length : ti, 0, dragKey);
          const idx = {}; rest.forEach((k, i) => idx[k] = i);
          return prev.map((a) => idx[dimKey(a)] != null ? { ...a, rubroOrd: idx[dimKey(a)] } : a);
        });
        const sw = (on, onClick, title) => (
          <button onClick={onClick} title={title} style={{ width: 30, height: 16, borderRadius: 9, border: "none", background: on ? accent : "#cfcfcf", position: "relative", cursor: "pointer", flexShrink: 0, padding: 0 }}>
            <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff" }} />
          </button>
        );
        const startDrag = (e, ids, kind, gk) => { e.stopPropagation(); setDragItem({ artIds: ids, kind, gk }); e.dataTransfer.effectAllowed = "move"; };
        const onDropSheet = (e, colId) => { e.preventDefault(); if (dragItem) moverArts(dragItem.artIds, colId); setDragItem(null); };
        const onDropDisc = (e) => { e.preventDefault(); if (dragItem) discontinuarArts(dragItem.artIds, true); setDragItem(null); };
        const grip = (ids, kind, gk) => <span draggable onDragStart={(e) => startDrag(e, ids, kind, gk)} onDragEnd={() => { setDragItem(null); setDropAt(null); }} title="Arrastrar (mover / reordenar)" style={{ cursor: "grab", color: C.muted, fontSize: 14, padding: "0 1px", flexShrink: 0 }}>⠿</span>;
        const sepBtn = (id) => <button onClick={() => sepDebajo(id)} title="Agregar línea separadora debajo" style={{ border: "none", background: "none", color: accent, cursor: "pointer", fontSize: 16, fontWeight: 800, lineHeight: 1, flexShrink: 0, padding: "0 1px" }}>＋</button>;
        const editInput = (def, onCommit) => (
          <input autoFocus defaultValue={def} onBlur={(e) => { onCommit(e.target.value); setEditKey(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditKey(null); }}
            style={{ flex: 1, minWidth: 0, border: `1px solid ${accent}`, borderRadius: 6, padding: "2px 6px", fontSize: 14, fontFamily: "inherit", color: C.ink, background: "#fff" }} />
        );
        const lbl = (name, cod) => (cod && name && cod !== name ? `${cod} · ${name}` : (name || cod || ""));
        const dimKey = (a) => agruparPor === "rubro" ? (a.rubro || (a.codRubro ? "Rubro " + a.codRubro : "Sin rubro")) : (a.subRubro || (a.codSubRubro ? "Sub-rubro " + a.codSubRubro : "Sin sub-rubro"));
        const dimCod = (a) => agruparPor === "rubro" ? a.codRubro : a.codSubRubro;
        const renameDim = (oldK, v) => agruparPor === "rubro" ? renameRubro(oldK, v) : renameSubAll(oldK, v);
        const toggleSel = (id) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
        const prom = (arr) => { const v = arr.map((a) => Number(a.precioVenta)).filter((x) => x > 0); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0; };
        const addAToCombo = (cn) => { setSelMode(true); setComboTarget(cn); setSel([]); setComboName(""); };
        const redIcon = (net, color) => {
          const c = color; const p = { width: 18, height: 18, viewBox: "0 0 24 24", style: { display: "block" } };
          if (net === "instagram") return <svg {...p} fill="none" stroke={c} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill={c} stroke="none" /></svg>;
          if (net === "facebook") return <svg {...p} fill={c}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>;
          if (net === "tiktok") return <svg {...p} fill={c}><path d="M16 3c.3 2.1 1.5 3.5 3.5 3.7V9c-1.3 0-2.5-.4-3.5-1.1v6.2A4.9 4.9 0 1 1 11 9.3v2.4a2.5 2.5 0 1 0 1.8 2.4V3H16z" /></svg>;
          if (net === "whatsapp") return <svg {...p} fill={c}><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2.6-1.1 1-1.6 1.1a3.5 3.5 0 0 1-1.6-.1c-.4-.1-.9-.2-1.5-.5a11.2 11.2 0 0 1-4.3-3.8 4.9 4.9 0 0 1-1-2.6 2.8 2.8 0 0 1 .9-2.1 1 1 0 0 1 .7-.3h.5c.1 0 .3-.1.5.4l.8 1.8v.4l-.2.4-.4.4c-.1.1-.2.3-.1.5a7.3 7.3 0 0 0 1.4 1.7 6.6 6.6 0 0 0 1.9 1.2c.2.1.3.1.5-.1s.6-.8.8-1 .3-.2.5-.1 1.4.7 1.6.8.4.2.4.3a2 2 0 0 1 0 .7z" /></svg>;
          return null;
        };
        const handleUser = (v, at) => { let s = String(v || "").trim(); if (!s) return ""; if (/\//.test(s) || /^https?:/i.test(s)) { s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, ""); const seg = s.split("/").filter(Boolean); s = seg[seg.length - 1] || seg[0] || s; } s = s.replace(/^@+/, ""); return (at ? "@" : "") + s; };
        const sheetFooter = (pal) => {
          if (!negocio) return null;
          const accH = (pal && pal.accent) || accent;
          const ig = negocio.instagram, fb = negocio.facebook, tk = negocio.tiktok;
          if (!ig && !fb && !tk && !negocio.web && !negocio.telefono && !negocio.wifiNombre) return null;
          const row = (icon, text) => <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: C.muted, marginBottom: 3 }}>{icon}<span>{text}</span></div>;
          return (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${accH}55`, textAlign: "center" }}>
              {ig && row(redIcon("instagram", accH), handleUser(ig, true))}
              {fb && row(redIcon("facebook", accH), handleUser(fb, false))}
              {tk && row(redIcon("tiktok", accH), handleUser(tk, true))}
              {negocio.telefono && row(redIcon("whatsapp", accH), negocio.telefono)}
              {negocio.web && row(<span style={{ fontSize: 13 }}>🌐</span>, String(negocio.web).replace(/^https?:\/\//, "").replace(/\/$/, ""))}
              {negocio.wifiNombre && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>📶 WiFi: <b style={{ color: C.ink }}>{negocio.wifiNombre}</b>{negocio.wifiClave ? <> · clave: <b style={{ color: C.ink }}>{negocio.wifiClave}</b></> : null}</div>}
            </div>
          );
        };
        const PAPELES = { Oficio: { css: "216mm 330mm", w: 216 }, A4: { css: "A4", w: 210 }, A3: { css: "A3", w: 297 }, A2: { css: "A2", w: 420 }, A1: { css: "A1", w: 594 } };
        const svgStr = (net, c) => {
          if (net === "instagram") return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${c}" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="${c}" stroke="none"/></svg>`;
          if (net === "facebook") return `<svg viewBox="0 0 24 24" width="20" height="20" fill="${c}"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>`;
          if (net === "tiktok") return `<svg viewBox="0 0 24 24" width="20" height="20" fill="${c}"><path d="M16 3c.3 2.1 1.5 3.5 3.5 3.7V9c-1.3 0-2.5-.4-3.5-1.1v6.2A4.9 4.9 0 1 1 11 9.3v2.4a2.5 2.5 0 1 0 1.8 2.4V3H16z"/></svg>`;
          if (net === "whatsapp") return `<svg viewBox="0 0 24 24" width="20" height="20" fill="${c}"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2.6-1.1 1-1.6 1.1a3.5 3.5 0 0 1-1.6-.1c-.4-.1-.9-.2-1.5-.5a11.2 11.2 0 0 1-4.3-3.8 4.9 4.9 0 0 1-1-2.6 2.8 2.8 0 0 1 .9-2.1 1 1 0 0 1 .7-.3h.5c.1 0 .3-.1.5.4l.8 1.8v.4l-.2.4-.4.4c-.1.1-.2.3-.1.5a7.3 7.3 0 0 0 1.4 1.7 6.6 6.6 0 0 0 1.9 1.2c.2.1.3.1.5-.1s.6-.8.8-1 .3-.2.5-.1 1.4.7 1.6.8.4.2.4.3a2 2 0 0 1 0 .7z"/></svg>`;
          return "";
        };
        const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const cartaParts = (col, scale) => {
          const Dx = diseno; const hp = hojaPal[col.id] || {}; const accH = hp.accent || accent; const inkH = hp.ink || Dx.ink; const titleH = hp.title || Dx.title; const ldH = hp.leader || Dx.leader;
          const upCss = Dx.upper ? "text-transform:uppercase;letter-spacing:.5px" : "";
          const labelTxt = Dx.orn ? `${Dx.orn}  LA CARTA  ${Dx.orn}` : "LA CARTA";
          const arts = colArts(col.id);
          const groups = {}; arts.forEach((a) => { const k = dimKey(a); (groups[k] = groups[k] || []).push(a); });
          const keys = groupKeysOrdered(arts).filter((k) => groups[k]);
          const blocks = keys.map((k) => {
            const entries = buildEntries(groups[k]);
            const items = entries.map((e) => {
              if (e.sep) return '<div class="sepline"></div>';
              if (e.combo) { const avg = prom(e.mem); return `<div class="it"><span class="nm">${esc(e.combo)}</span><span class="dots"></span><span class="pr">${avg ? "$" + avg.toLocaleString("es-AR") : ""}</span></div><div class="ds">${esc(comboDescs[e.combo] != null ? comboDescs[e.combo] : e.mem.map((m) => m.nombre).join(" · "))}</div>`; }
              const a = e.art; return `<div class="it"><span class="nm">${esc(a.nombre)}</span><span class="dots"></span><span class="pr">${a.precioVenta ? "$" + Number(a.precioVenta).toLocaleString("es-AR") : ""}</span></div>${a.descripcion ? `<div class="ds">${esc(a.descripcion)}</div>` : ""}`;
            }).join("");
            return `<div class="rub"><div class="rt">${iconFor(k) ? esc(iconFor(k)) + " " : ""}${Dx.orn ? esc(Dx.orn) + "  " : ""}${esc(k)}</div>${items}</div>`;
          });
          const soc = [];
          if (negocio && negocio.instagram) soc.push(`<div class="fl">${svgStr("instagram", accH)}<span>${esc(handleUser(negocio.instagram, true))}</span></div>`);
          if (negocio && negocio.facebook) soc.push(`<div class="fl">${svgStr("facebook", accH)}<span>${esc(handleUser(negocio.facebook, false))}</span></div>`);
          if (negocio && negocio.tiktok) soc.push(`<div class="fl">${svgStr("tiktok", accH)}<span>${esc(handleUser(negocio.tiktok, true))}</span></div>`);
          if (negocio && negocio.telefono) soc.push(`<div class="fl">${svgStr("whatsapp", accH)}<span>${esc(negocio.telefono)}</span></div>`);
          const footerHtml = negocio && (soc.length || negocio.web || negocio.wifiNombre) ? `<div class="ft">${soc.join("")}${negocio.web ? `<div class="fl"><span style="font-size:14px">🌐</span><span>${esc(String(negocio.web).replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span></div>` : ""}${negocio.wifiNombre ? `<div style="margin-top:6px">📶 WiFi: <b>${esc(negocio.wifiNombre)}</b>${negocio.wifiClave ? ` · clave: <b>${esc(negocio.wifiClave)}</b>` : ""}</div>` : ""}</div>` : "";
          const logoHtml = (showLogo && negocio && negocio.logo) ? `<div class="logo"><img src="${esc(negocio.logo)}" crossorigin="anonymous" /></div>` : "";
          const headerHtml = `${logoHtml}<div class="lab">${esc(labelTxt)}</div><div class="title">${esc(col.nombre)}</div><div class="sep"></div>`;
          const s = scale || 1; const r = (n) => Math.round(n * s * 100) / 100;
          const css = `*{box-sizing:border-box}
.cart{font-family:${Dx.bFont};color:${inkH}}
.logo{text-align:center;margin-bottom:8px}.logo img{display:block;margin:0 auto;max-height:${r(72)}px;max-width:55%;object-fit:contain}
.lab{text-align:center;font-size:${r(11)}px;letter-spacing:2px;color:${accH};font-weight:700}
.title{text-align:center;font-family:${Dx.dFont};font-size:${r(30)}px;font-weight:700;color:${titleH};margin:2px 0 4px}
.sep{width:46px;height:0;border-top:2px ${Dx.line === "double" ? "double" : Dx.line} ${accH};margin:0 auto 6px}
.rub{margin-bottom:${r(14)}px;break-inside:avoid}
.sepline{border-top:2px ${Dx.line} ${inkH};margin:${r(8)}px 0}
.rt{font-family:${Dx.dFont};font-weight:700;font-size:${r(16)}px;color:${titleH};border-bottom:2px ${Dx.line} ${accH};padding-bottom:3px;margin-bottom:7px;${upCss}}
.it{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}
.nm{font-family:${Dx.dFont};font-weight:600;font-size:${r(14.5)}px;color:${inkH}}
.dots{flex:1;border-bottom:1px ${Dx.line} ${ldH};transform:translateY(-4px)}
.pr{font-weight:700;font-size:${r(14.5)}px;color:${accH};font-variant-numeric:tabular-nums;white-space:nowrap}
.ds{font-size:${r(11.5)}px;color:${inkH}99;font-style:italic;margin:0 0 6px}
.ft{margin-top:16px;padding-top:12px;border-top:1px solid ${accH}66;text-align:center;font-size:${r(12.5)}px;color:#7a7a72}
.ft .fl{display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:4px}.ft b{color:#1f1f1d}`;
          return { css, blocks, headerHtml, footerHtml, Dx, accH };
        };
        // Distribute rubro blocks into pages × columns (blocks kept whole), measuring real heights
        const layoutPages = (parts, geom) => {
          const meas = document.createElement("div");
          meas.style.cssText = `position:fixed;left:-10000px;top:0;width:${geom.colWpx}px`;
          meas.innerHTML = `<style>${parts.css}</style><div class="cart"><div class="hdrm">${parts.headerHtml}</div><div class="ftm">${parts.footerHtml}</div>${parts.blocks.map((b, i) => `<div class="blk" data-i="${i}">${b}</div>`).join("")}</div>`;
          document.body.appendChild(meas);
          const headH = (meas.querySelector(".hdrm") || {}).offsetHeight || 0;
          const footH = (meas.querySelector(".ftm") || {}).offsetHeight || 0;
          const bEls = [...meas.querySelectorAll(".blk")];
          const heights = bEls.map((el) => el.offsetHeight);
          document.body.removeChild(meas);
          const usable = geom.contentHpx - headH - footH - 6;
          const pages = []; let page = Array.from({ length: geom.cols }, () => []); let ci = 0; let ch = 0;
          parts.blocks.forEach((b, i) => {
            const bh = heights[i] + 6;
            if (ch > 0 && ch + bh > usable) { ci++; if (ci >= geom.cols) { pages.push(page); page = Array.from({ length: geom.cols }, () => []); ci = 0; } ch = 0; }
            page[ci].push(b); ch += bh;
          });
          if (page.some((c) => c.length)) pages.push(page);
          return pages.length ? pages : [page];
        };
        const pageNode = (parts, geom, cols, isLast) => {
          const colHtml = cols.map((c) => `<div class="pcol" style="width:${geom.colWpx}px">${c.join("")}</div>`).join("");
          const frameCss = parts.Dx.frame === "box" ? `box-shadow:inset 0 0 0 6px #fff, inset 0 0 0 7px ${parts.accH}` : parts.Dx.frame === "double" ? `box-shadow:inset 0 0 0 4px #fff, inset 0 0 0 5px ${parts.accH}, inset 0 0 0 9px #fff, inset 0 0 0 10px ${parts.accH}` : parts.Dx.frame === "line" ? `box-shadow:inset 0 0 0 2px ${parts.accH}` : "";
          const wrap = document.createElement("div");
          wrap.style.cssText = `position:fixed;left:-10000px;top:0;width:${geom.pageWpx}px;height:${geom.pageHpx}px;background:#fff`;
          wrap.innerHTML = `<style>${parts.css}.pg{width:${geom.pageWpx}px;height:${geom.pageHpx}px;background:#fff;padding:${geom.margin * PX_PER_MM}px;${frameCss}}.pcols{display:flex;gap:${geom.gapPx}px;align-items:flex-start}</style>`
            + `<div class="cart pg"><div>${parts.headerHtml}</div><div class="pcols">${colHtml}</div>${isLast ? parts.footerHtml : ""}</div>`;
          return wrap;
        };
        const descargarCarta = async (col, cfg) => {
          const geom = printGeom(cfg.size, cfg.orient, cfg.cols);
          const parts = cartaParts(col, geom.scale);
          const fname = `${(col.nombre || "hoja").replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/gi, "").trim() || "hoja"} (${cfg.size}${cfg.orient === "h" ? "·H" : ""})`;
          try {
            setDlBusy(true);
            await ensureLibs();
            if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) { } }
            await new Promise((r) => setTimeout(r, 250));
            const pages = layoutPages(parts, geom);
            const canvases = [];
            for (let i = 0; i < pages.length; i++) {
              const wrap = pageNode(parts, geom, pages[i], i === pages.length - 1);
              document.body.appendChild(wrap);
              try { const cv = await window.html2canvas(wrap.querySelector(".pg"), { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: geom.pageWpx, height: geom.pageHpx }); canvases.push(cv); }
              finally { try { document.body.removeChild(wrap); } catch (_) { } }
            }
            const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };
            if (cfg.fmt === "png") {
              for (let i = 0; i < canvases.length; i++) {
                await new Promise((res) => canvases[i].toBlob((b) => { dl(b, `${fname}${canvases.length > 1 ? " - pág " + (i + 1) + " de " + canvases.length : ""}.png`); res(); }, "image/png"));
                if (i < canvases.length - 1) await new Promise((r) => setTimeout(r, 600));
              }
            } else {
              const JSPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
              if (!JSPDF) throw new Error("jsPDF no disponible");
              const pdf = new JSPDF({ orientation: geom.w > geom.h ? "landscape" : "portrait", unit: "mm", format: [geom.w, geom.h] });
              canvases.forEach((cv, i) => { if (i > 0) pdf.addPage([geom.w, geom.h], geom.w > geom.h ? "landscape" : "portrait"); pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, geom.w, geom.h); });
              dl(pdf.output("blob"), fname + ".pdf");
            }
          } catch (e) { showAlert("No pude generar la descarga acá (puede ser el sandbox de la vista previa). En la app publicada funciona.", "error"); }
          finally { setDlBusy(false); setPrintOpen(null); }
        };
        const estimarPaginas = (col, cfg) => { try { const geom = printGeom(cfg.size, cfg.orient, cfg.cols); const parts = cartaParts(col, geom.scale); return { pags: layoutPages(parts, geom).length, cols: geom.cols, w: geom.w, h: geom.h }; } catch (_) { return { pags: 1, cols: 1, w: 210, h: 297 }; } };
        const nameStyle = { fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150, flexShrink: 1 };
        const miStyle = { display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: "6px 9px", fontSize: 12.5, color: C.ink, cursor: "pointer", borderRadius: 6, fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
        const miBtn = { border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: C.card };
        const openMenu = (e, key, ids, ctx, def, combo) => { const r = e.currentTarget.getBoundingClientRect(); setMenuPos({ x: r.right, top: r.top, bottom: r.bottom }); setMenuIds(ids); setMenuSheet(ctx === "sheet"); setMenuCombo(combo || null); setCrearMode(false); setCrearName(def || ""); setMenuOpen(menuOpen === key ? null : key); };
        const kebab = (key, ids, ctx, def, combo) => (
          <button onClick={(e) => openMenu(e, key, ids, ctx, def, combo)} title="Opciones" style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 17, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>⋮</button>
        );

        const renderItems = (arts, ctx, pal) => {
          const groups = {}; arts.forEach((a) => { const k = dimKey(a); (groups[k] = groups[k] || []).push(a); });
          const orderedKeys = groupKeysOrdered(arts).filter((k) => groups[k]);
          return orderedKeys.map((k) => {
            const list = groups[k];
            const ids = list.map((a) => a.id);
            const cod = dimCod(list[0]);
            const anyOn = list.some((a) => !a.discontinuado);
            const collapsed = ctx !== "sheet" && !!collapsedRub[(ctx || "") + "|" + k];
            const entries = buildEntries(list);
            const isSheet = ctx === "sheet"; const D = diseno;
            const accH = (pal && pal.accent) || accent; const inkH = (pal && pal.ink) || D.ink; const ldH = (pal && pal.leader) || D.leader; const titleH = (pal && pal.title) || D.title;
            const fD = isSheet ? D.dFont : "'Sora',sans-serif"; const fB = isSheet ? D.bFont : "'Archivo',sans-serif";
            const cInk = isSheet ? inkH : C.ink; const cPrice = isSheet ? accH : C.maroonDark; const cDesc = isSheet ? inkH + "99" : C.muted;
            const ld = isSheet ? ldH : "#c9bba9"; const lst = isSheet ? D.line : "dotted";
            const ornP = isSheet && D.orn ? D.orn + "  " : "";
            const icoR = isSheet ? (iconFor(k) ? iconFor(k) + " " : "") : "";
            const lineaProducto = (a) => (
              <div key={a.id} style={{ marginBottom: 7, boxShadow: dropAt && dropAt.type === "item" && dropAt.id === a.id ? `inset 0 3px 0 -1px ${accH}` : "none" }}
                onDragOver={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); if (!dropAt || dropAt.id !== a.id) setDropAt({ type: "item", id: a.id }); } }}
                onDrop={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); if (dragItem.gk === k) reorderEntries(k, dragItem.artIds[0], a.id); else setGrupoArts(dragItem.artIds, k); setDragItem(null); setDropAt(null); } }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: a.discontinuado ? .5 : 1 }}>
                  {selMode && ctx !== "disc" && <input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggleSel(a.id)} style={{ width: 15, height: 15, accentColor: accent, cursor: "pointer", flexShrink: 0 }} />}
                  {sw(!a.discontinuado, () => discontinuarArts([a.id], !a.discontinuado), a.discontinuado ? "Reactivar" : "Discontinuar")}
                  {editKey === `art:${a.id}` ? editInput(a.nombre, (v) => upd(a.id, "nombre", v)) : <><span onDoubleClick={() => setEditKey(`art:${a.id}`)} title="Doble clic para editar el nombre" style={isSheet ? { fontFamily: fD, fontWeight: 600, fontSize: 14, color: cInk, whiteSpace: "normal", flexShrink: 1, minWidth: 0, cursor: "text", textDecoration: a.discontinuado ? "line-through" : "none" } : { ...nameStyle, fontFamily: fD, color: cInk, cursor: "text", textDecoration: a.discontinuado ? "line-through" : "none" }}>{a.nombre || "—"}</span>
                  <span style={{ flex: 1, minWidth: 8, borderBottom: `1px ${lst} ${ld}`, transform: "translateY(-4px)" }} />
                  {editKey === `precio:${a.id}`
                    ? <input autoFocus defaultValue={a.precioVenta || ""} onFocus={(e) => e.target.select()} onBlur={(e) => { upd(a.id, "precioVenta", e.target.value.replace(/[^\d.,]/g, "")); setEditKey(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditKey(null); }} style={{ width: 82, border: `1px solid ${accent}`, borderRadius: 6, padding: "1px 6px", fontSize: 14, fontFamily: "inherit", color: cPrice, fontWeight: 700, textAlign: "right", background: "#fff", flexShrink: 0 }} />
                    : <span onDoubleClick={() => setEditKey(`precio:${a.id}`)} title="Doble clic para editar el precio" style={{ color: a.precioVenta ? cPrice : cDesc, fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", flexShrink: 0, cursor: "text" }}>{a.precioVenta ? "$" + Number(a.precioVenta).toLocaleString("es-AR") : "$ —"}</span>}
                  {isSheet && sepBtn(a.id)}{kebab(`art:${a.id}`, [a.id], ctx, a.nombre)}{grip([a.id], "art", k)}</>}
                </div>
                <div style={{ paddingLeft: 40, marginTop: 1 }}>
                  {editKey === `desc:${a.id}` ? (
                    <input autoFocus defaultValue={a.descripcion || ""} placeholder="Descripción del producto…" onBlur={(e) => { upd(a.id, "descripcion", e.target.value); setEditKey(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditKey(null); }} style={{ width: "100%", border: `1px solid ${accent}`, borderRadius: 6, padding: "2px 6px", fontSize: 11.5, fontFamily: "inherit", color: C.ink, background: "#fff" }} />
                  ) : a.descripcion ? (
                    <span onClick={() => setEditKey(`desc:${a.id}`)} title="Clic para editar la descripción" style={{ fontSize: 11.5, fontFamily: fB, color: cDesc, fontStyle: "italic", cursor: "text" }}>{a.descripcion}</span>
                  ) : (
                    <button onClick={() => setEditKey(`desc:${a.id}`)} style={{ border: "none", background: "none", color: C.border, cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit" }}>＋ descripción</button>
                  )}
                </div>
              </div>
            );
            const lineaCombo = (cn, mem) => {
              const mids = mem.map((a) => a.id); const avg = prom(mem); const off = mem.every((a) => a.discontinuado);
              return (
                <div key={"c:" + cn} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8, opacity: off ? .5 : 1, background: "#fbf6ee", borderRadius: 8, padding: "5px 7px", boxShadow: dropAt && dropAt.type === "item" && dropAt.id === mids[0] ? `inset 0 3px 0 -1px ${accH}` : "none" }}
                  onDragOver={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); if (!dropAt || dropAt.id !== mids[0]) setDropAt({ type: "item", id: mids[0] }); } }}
                  onDrop={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); if (dragItem.gk === k) reorderEntries(k, dragItem.artIds[0], mids[0]); else setGrupoArts(dragItem.artIds, k); setDragItem(null); setDropAt(null); } }}>
                  {sw(!off, () => discontinuarArts(mids, !off), off ? "Reactivar" : "Discontinuar")}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      {editKey === `combo:${cn}` ? editInput(cn, (v) => setComboArts(mids, v)) : <><span onDoubleClick={() => setEditKey(`combo:${cn}`)} title="Doble clic para renombrar" style={isSheet ? { fontFamily: fD, fontWeight: 700, fontSize: 14, color: cInk, cursor: "text", whiteSpace: "normal", flexShrink: 1, minWidth: 0 } : { fontFamily: fD, fontWeight: 700, fontSize: 14, color: cInk, cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{cn}</span>
                      <span style={{ flex: 1, minWidth: 8, borderBottom: `1px ${lst} ${ld}`, transform: "translateY(-4px)" }} />
                      {avg ? <span style={{ color: cPrice, fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>${avg.toLocaleString("es-AR")}</span> : null}</>}
                    </div>
                    {editKey === `combodesc:${cn}` ? editInput(comboDescs[cn] != null ? comboDescs[cn] : mem.map((m) => m.nombre).join(" · "), (v) => setComboDescs((d) => ({ ...d, [cn]: v }))) : <div onDoubleClick={() => setEditKey(`combodesc:${cn}`)} title="Doble clic para editar la descripción del vínculo" style={{ fontSize: 11, fontFamily: fB, color: cDesc, marginTop: 2, cursor: "text", whiteSpace: "normal" }}>{comboDescs[cn] != null ? comboDescs[cn] : mem.map((m) => m.nombre).join(" · ")}</div>}
                  </div>
                  {isSheet && sepBtn(mids[0])}{kebab(`combo:${cn}`, mids, ctx, cn, cn)}{grip(mids, "art", k)}
                </div>
              );
            };
            const lineaSep = (a) => (
              <div key={a.id} onDragOver={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); } }} onDrop={(e) => { if (dragItem && dragItem.kind === "art") { e.preventDefault(); e.stopPropagation(); if (dragItem.gk === k) reorderEntries(k, dragItem.artIds[0], a.id); else setGrupoArts(dragItem.artIds, k); setDragItem(null); setDropAt(null); } }} style={{ display: "flex", alignItems: "center", gap: 6, margin: "9px 0" }}>
                <span style={{ flex: 1, borderTop: `2px ${lst} ${isSheet ? cInk : C.border}` }} />
                <button onClick={() => del(a.id)} title="Quitar línea" style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
                {grip([a.id], "art", k)}
              </div>
            );
            return (
              <div key={k} style={{ marginBottom: 14, breakInside: "avoid", WebkitColumnBreakInside: "avoid" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: `2px ${lst} ${accH}`, paddingBottom: 3, marginBottom: 8, background: dropAt && dropAt.type === "rubro" && dropAt.id === "r:" + k ? accH + "22" : "transparent", borderRadius: 4 }}
                  onDragOver={(e) => { if (dragItem && (dragItem.kind === "rubro" || (dragItem.kind === "art" && dragItem.gk !== k))) { e.preventDefault(); e.stopPropagation(); if (!dropAt || dropAt.id !== "r:" + k) setDropAt({ type: "rubro", id: "r:" + k }); } }}
                  onDrop={(e) => { if (dragItem && dragItem.kind === "rubro") { e.preventDefault(); e.stopPropagation(); reorderGroups(dragItem.gk, k); setDragItem(null); setDropAt(null); } else if (dragItem && dragItem.kind === "art" && dragItem.gk !== k) { e.preventDefault(); e.stopPropagation(); setGrupoArts(dragItem.artIds, k); setDragItem(null); setDropAt(null); } }}>
                  {sw(anyOn, () => discontinuarArts(ids.filter((id) => !list.find((x) => x.id === id && x.esSep)), anyOn), anyOn ? "Discontinuar grupo" : "Reactivar grupo")}
                  {ctx !== "sheet" && <button onClick={() => setCollapsedRub((m) => { const key = (ctx || "") + "|" + k; return { ...m, [key]: !m[key] }; })} title={collapsed ? "Mostrar productos" : "Ocultar productos"} style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 12, flex: "0 0 auto", padding: 0, transform: collapsed ? "none" : "rotate(90deg)", transition: "transform .12s" }}>▶</button>}
                  {editKey === `dim:${k}` ? editInput(k, (v) => renameDim(k, v)) : <span onDoubleClick={() => setEditKey(`dim:${k}`)} title="Doble clic para renombrar" style={isSheet ? { fontFamily: fD, fontWeight: 700, fontSize: 15, color: titleH, textTransform: D.upper ? "uppercase" : "none", letterSpacing: D.upper ? ".5px" : 0, cursor: "text", whiteSpace: "normal", flexShrink: 1, minWidth: 0 } : { fontFamily: fD, fontWeight: 700, fontSize: 15, color: cInk, cursor: "text", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal", lineHeight: 1.2, overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: sidebarWide ? 340 : 170, flexShrink: 1 }}>{icoR + ornP + (ctx === "sheet" ? k : lbl(k, cod))}</span>}
                  <span style={{ flex: 1, minWidth: 4 }} />
                  {kebab(`dim:${k}`, ids, ctx, k)}{grip(ids, "rubro", k)}
                </div>
                {!collapsed && entries.map((it) => it.sep ? lineaSep(it.sep) : it.combo ? lineaCombo(it.combo, it.mem) : lineaProducto(it.art))}
              </div>
            );
          });
        };

        const discontinuados = articulos.filter((a) => a.discontinuado);
        const hojasView = vistaHoja === "todas" ? agrupaciones : agrupaciones.filter((c) => c.id === vistaHoja);
        const Dz = diseno;
        const frameSh = Dz.frame === "box" ? `inset 0 0 0 6px ${Dz.bg}, inset 0 0 0 7px ${accent}`
          : Dz.frame === "double" ? `inset 0 0 0 4px ${Dz.bg}, inset 0 0 0 5px ${accent}, inset 0 0 0 9px ${Dz.bg}, inset 0 0 0 10px ${accent}`
            : Dz.frame === "line" ? `inset 0 0 0 1.5px ${accent}` : "none";
        const cartaLabel = Dz.orn ? `${Dz.orn}  LA CARTA  ${Dz.orn}` : "LA CARTA";
        return (
          <>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>Productos ordenados por unidades vendidas (descendente). Arrastrá (⠿) o usá <b style={{ color: C.ink }}>⋮</b> para mover / crear hojas; cliqueá un {agruparPor === "rubro" ? "rubro" : "sub-rubro"} para renombrarlo. El interruptor <b style={{ color: C.ink }}>discontinúa</b>; con <b style={{ color: C.ink }}>Vincular productos</b> juntás varios en uno (precio promedio); desde el ⋮ de un vínculo podés agregar o separar.</div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {lateralOpen ? (
                <div style={{ width: sidebarWide ? 440 : 256, flex: sidebarWide ? "0 0 440px" : "0 0 256px", background: lateralTab === "pool" ? C.paper : "#f3f1ee", border: dropAt && dropAt.type === "lat" ? `2px solid ${accent}` : `1px dashed ${C.border}`, borderRadius: 12, padding: 12, alignSelf: "stretch" }}
                  onDragOver={(e) => { e.preventDefault(); if (dragItem && (!dropAt || dropAt.type !== "lat")) setDropAt({ type: "lat" }); }} onDrop={(e) => { lateralTab === "pool" ? onDropSheet(e, null) : onDropDisc(e); setDropAt(null); }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select value={lateralTab === "disc" ? "disc" : (vistaHoja !== "todas" ? "m:" + vistaHoja : "pool")}
                        onChange={(e) => { const v = e.target.value; if (v === "pool") { setLateralTab("pool"); setVistaHoja("todas"); } else if (v === "disc") { setLateralTab("disc"); } else if (v === "new") { addColGo(); } else { setLateralTab("pool"); setVistaHoja(v.slice(2)); } }}
                        style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontWeight: 700, color: C.ink, background: C.card, fontFamily: "inherit", cursor: "pointer" }}>
                        <option value="pool" style={{ fontStyle: "italic" }}>Sin agrupar</option>
                        {agrupaciones.map((g) => <option key={g.id} value={"m:" + g.id}>{g.nombre}</option>)}
                        <option value="new">＋ Nueva hoja</option>
                        <option value="disc" style={{ fontStyle: "italic" }}>Discontinuados</option>
                      </select>
                      <button onClick={() => { if (sidebarWide) { setSidebarWide(false); setVistaHoja("todas"); } else setLateralOpen(false); }} title={sidebarWide ? "Achicar el panel" : "Ocultar panel"} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 7, width: 26, height: 26, cursor: "pointer", color: C.muted, fontSize: 13, flex: "0 0 auto" }}>◀</button>
                      <button onClick={() => { setSidebarWide(true); const first = agrupaciones[0]; if (first) setVistaHoja(first.id); }} title="Agrandar el panel (ver una sola hoja)" style={{ border: `1px solid ${sidebarWide ? accent : C.border}`, background: sidebarWide ? accent : C.card, borderRadius: 7, width: 26, height: 26, cursor: "pointer", color: sidebarWide ? "#fff" : C.muted, fontSize: 13, flex: "0 0 auto" }}>▶</button>
                    </div>
                    <div style={{ display: "inline-flex", background: C.shade, borderRadius: 8, padding: 2, marginTop: 8, width: "100%" }}>
                      {[["rubro", "Rubro"], ["sub", "Sub-rubro"]].map(([k, l]) => (
                        <button key={k} onClick={() => setAgruparPor(k)} style={{ flex: 1, border: "none", borderRadius: 6, padding: "5px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: agruparPor === k ? accent : "transparent", color: agruparPor === k ? "#fff" : C.muted, fontFamily: "inherit" }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {lateralTab === "pool" ? (
                    <>
                      {renderItems(colArts(null), "pool")}
                      {!colArts(null).length && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 14 }}>Todo en las hojas 🎉</div>}
                    </>
                  ) : (
                    <>
                      {renderItems(discontinuados, "disc")}
                      {!discontinuados.length && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 14 }}>Nada discontinuado</div>}
                    </>
                  )}
                </div>
              ) : (
                <button onClick={() => setLateralOpen(true)} title="Mostrar Sin agrupar / Discontinuados" style={{ flex: "0 0 24px", alignSelf: "stretch", minHeight: 90, border: `1px solid ${C.border}`, background: C.card, borderRadius: 8, cursor: "pointer", color: accent, fontSize: 14, fontWeight: 700, padding: 0 }}>▶</button>
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10 }}>
                {hojasView.map((col) => {
                  const idx = agrupaciones.findIndex((c) => c.id === col.id);
                  const sola = vistaHoja !== "todas";
                  const colsView = (hojaCols[col.id] || 0) > 0 ? hojaCols[col.id] : (sola ? 2 : 1);
                  const sheetW = 260 * colsView + 22 * (colsView - 1) + 48;
                  const hp = hojaPal[col.id] || {};
                  const pal = { accent: hp.accent || accent, ink: hp.ink || Dz.ink, title: hp.title || Dz.title, leader: hp.leader || Dz.leader };
                  const accH = pal.accent;
                  const frameH = Dz.frame === "box" ? `inset 0 0 0 6px ${Dz.bg}, inset 0 0 0 7px ${accH}` : Dz.frame === "double" ? `inset 0 0 0 4px ${Dz.bg}, inset 0 0 0 5px ${accH}, inset 0 0 0 9px ${Dz.bg}, inset 0 0 0 10px ${accH}` : Dz.frame === "line" ? `inset 0 0 0 1.5px ${accH}` : "none";
                  return (
                    <div key={col.id} style={sola ? { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" } : { minWidth: sheetW, flex: `0 0 ${sheetW}px`, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setVistaHoja(col.id); setPrintAt(Math.max(16, r.top)); const nc = { ...printCfg, cols: hojaCols[col.id] || 0 }; setPrintCfg(nc); try { setPrintPages(estimarPaginas(col, nc).pags); } catch (_) { } setPrintOpen(col.id); }} disabled={dlBusy} style={{ border: `1px solid ${accent}`, background: C.card, color: accent, borderRadius: 20, padding: "6px 16px", fontSize: 12.5, fontWeight: 700, cursor: dlBusy ? "default" : "pointer", fontFamily: "inherit", opacity: dlBusy ? .6 : 1 }}>{dlBusy ? "Generando…" : "⬇ Descargar carta"}</button>
                        <button onClick={() => setHojaPal((m) => ({ ...m, [col.id]: randomPal() }))} title="Cambiar la paleta de colores de esta hoja" style={{ border: `1px solid ${accH}`, background: C.card, color: accH, borderRadius: 20, padding: "6px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🎨</button>
                        <button onClick={() => setHojaPal((m) => { const n = { ...m }; delete n[col.id]; return n; })} title="Reiniciar la paleta de esta hoja al diseño base" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.muted, borderRadius: 20, padding: "6px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>↺</button>
                        <select value={hojaCols[col.id] || 0} onChange={(e) => setHojaCols((m) => ({ ...m, [col.id]: +e.target.value }))} title="Cantidad de columnas de esta hoja (así ves cómo se ordenan los rubros)" style={{ border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, color: C.ink, background: C.card, fontFamily: "inherit", cursor: "pointer" }}>
                          <option value={0}>▦ Auto ({sola ? 2 : 1} col)</option>
                          <option value={1}>▦ 1 col</option>
                          <option value={2}>▦ 2 col</option>
                          <option value={3}>▦ 3 col</option>
                          <option value={4}>▦ 4 col</option>
                        </select>
                      </div>
                      <div onDragOver={(e) => { e.preventDefault(); if (dragItem && (!dropAt || dropAt.id !== "s:" + col.id)) setDropAt({ type: "sheet", id: "s:" + col.id }); }} onDrop={(e) => { onDropSheet(e, col.id); setDropAt(null); }} style={sola ? { flex: 1, minWidth: 0, background: Dz.bg, borderRadius: 14, padding: "20px 34px 28px", boxShadow: frameH, outline: dropAt && dropAt.type === "sheet" && dropAt.id === "s:" + col.id ? `3px solid ${accH}` : "none", outlineOffset: 2 } : { background: Dz.bg, borderRadius: 14, padding: "20px 22px 24px", boxShadow: frameH, outline: dropAt && dropAt.type === "sheet" && dropAt.id === "s:" + col.id ? `3px solid ${accH}` : "none", outlineOffset: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <button onClick={() => { if (sola) { const i = agrupaciones.findIndex((c) => c.id === col.id); if (i > 0) setVistaHoja(agrupaciones[i - 1].id); } else moveCol(col.id, -1); }} disabled={idx <= 0} title={sola ? "Hoja anterior" : "Mover hoja a la izquierda"} style={{ border: "none", background: "none", color: idx <= 0 ? C.border : accH, cursor: idx <= 0 ? "default" : "pointer", fontSize: 16 }}>◀</button>
                        <div style={{ fontSize: 10, letterSpacing: "2px", color: accH, fontWeight: 700, fontFamily: Dz.bFont }}>{cartaLabel}</div>
                        <button onClick={() => { if (sola) { const i = agrupaciones.findIndex((c) => c.id === col.id); if (i < agrupaciones.length - 1) setVistaHoja(agrupaciones[i + 1].id); } else moveCol(col.id, 1); }} disabled={idx >= agrupaciones.length - 1} title={sola ? "Hoja siguiente" : "Mover hoja a la derecha"} style={{ border: "none", background: "none", color: idx >= agrupaciones.length - 1 ? C.border : accH, cursor: idx >= agrupaciones.length - 1 ? "default" : "pointer", fontSize: 16 }}>▶</button>
                      </div>
                      {showLogo && negocio?.logo && <div style={{ textAlign: "center", marginBottom: 6 }}><LogoImg url={negocio.logo} style={{ display: "block", margin: "0 auto", maxHeight: 56, maxWidth: "55%", objectFit: "contain" }} /></div>}
                      <div style={{ textAlign: "center", marginBottom: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                          <input value={col.nombre} onChange={(e) => renameCol(col.id, e.target.value)} style={{ width: `${Math.max(6, col.nombre.length + 1)}ch`, maxWidth: 320, border: "none", background: "transparent", textAlign: "center", fontFamily: Dz.dFont, fontSize: 24, fontWeight: 700, color: pal.title, outline: "none" }} />
                          <button onClick={async () => { if (await showConfirm("¿Seguro que querés reiniciar el orden?", { danger: true })) resetOrden(); }} title="Reiniciar el orden de rubros y productos" style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>↺</button>
                          <button onClick={() => setPendingDel(col.id)} title="Quitar esta hoja" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: "pointer", fontSize: 13, borderRadius: 6, padding: "1px 8px", fontFamily: "inherit" }}>✕</button>
                        </div>
                        {pendingDel === col.id && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", background: "#fff", border: `1px solid ${accH}`, borderRadius: 8, padding: "7px 10px", margin: "8px auto 0", maxWidth: 360 }}>
                            <span style={{ fontSize: 12, color: "#1f1f1d" }}>¿Quitar la hoja «{col.nombre}»? Sus productos vuelven a Sin agrupar.</span>
                            <button onClick={() => { delCol(col.id); setPendingDel(null); }} style={{ border: "none", background: accH, color: "#fff", borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Sí, quitar</button>
                            <button onClick={() => setPendingDel(null)} style={{ border: `1px solid ${C.border}`, background: "#fff", color: C.muted, borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                          </div>
                        )}
                        <div style={{ width: 46, height: 0, borderTop: `2px ${Dz.line === "double" ? "double" : Dz.line} ${accH}`, margin: "8px auto 0" }} />
                      </div>
                      {colsView > 1 ? (
                        <div style={{ columnCount: colsView, columnGap: 22 }}>{renderItems(colArts(col.id), "sheet", pal)}</div>
                      ) : renderItems(colArts(col.id), "sheet", pal)}
                      {!colArts(col.id).length && (
                        <div style={{ textAlign: "center", padding: 18 }}>
                          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>Esta hoja quedó vacía. Arrastrá rubros o platos, o quitala.</div>
                          <button onClick={() => setPendingDel(col.id)} style={{ border: `1px solid ${accH}`, background: "#fff", color: accH, borderRadius: 8, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ Quitar hoja vacía</button>
                        </div>
                      )}
                      {sheetFooter(pal)}
                      </div>
                    </div>
                  );
                })}
                {vistaHoja === "todas" && <button onClick={addCol} style={{ minWidth: 140, flex: "0 0 140px", alignSelf: "stretch", background: "none", border: `1px dashed ${C.border}`, borderRadius: 14, color: accent, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Agregar hoja</button>}
              </div>
            </div>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
                <div ref={(el) => { if (!el) return; const vh = window.innerHeight, vw = window.innerWidth, w = el.offsetWidth; el.style.left = Math.min(Math.max(8, menuPos.x - w), vw - w - 8) + "px"; const below = vh - menuPos.bottom - 12, above = menuPos.top - 12; if (below >= 180 || below >= above) { el.style.top = (menuPos.bottom + 4) + "px"; el.style.bottom = "auto"; el.style.maxHeight = Math.max(140, below) + "px"; } else { el.style.top = "auto"; el.style.bottom = (vh - menuPos.top + 4) + "px"; el.style.maxHeight = Math.max(140, above) + "px"; } }} style={{ position: "fixed", top: menuPos.bottom + 4, left: Math.max(8, menuPos.x - 230), zIndex: 60, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 14px 34px rgba(0,0,0,.18)", width: 230, padding: 6, overflowY: "auto" }}>
                  {!crearMode ? (
                    <>
                      {(String(menuOpen).startsWith("art:") || String(menuOpen).startsWith("combo:")) && (
                        <>
                          <button onClick={() => { sepDebajo(menuIds[0]); setMenuOpen(null); }} style={miStyle}>― Agregar línea separadora</button>
                          <div style={{ padding: "6px 9px 2px" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Mover a hoja › {agruparPor === "rubro" ? "rubro" : "sub-rubro"}</div>
                            <select value="" onChange={async (e) => { const v = e.target.value; if (!v) return; if (v === "__new__") { const nn = await showPrompt(agruparPor === "rubro" ? "Nombre del nuevo rubro:" : "Nombre del nuevo sub-rubro:", ""); if (nn && nn.trim()) { setGrupoArts(menuIds, mayus(nn.trim())); setMenuOpen(null); } return; } const sep = v.indexOf("::"); const hid = v.slice(0, sep); const rb = v.slice(sep + 2); moverAHojaRubro(menuIds, hid === "null" ? null : hid, rb); setMenuOpen(null); }} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 7px", fontSize: 12.5, color: C.ink, background: C.card, fontFamily: "inherit", cursor: "pointer" }}>
                              <option value="">Elegí destino…</option>
                              {[{ id: "null", nombre: "Sin agrupar" }, ...agrupaciones].map((h) => {
                                const rubros = [...new Set(articulos.filter((a) => !a.esSep && (a.agrupacion || null) === (h.id === "null" ? null : h.id)).map((a) => agruparPor === "rubro" ? (a.rubro || "Sin rubro") : (a.subRubro || "Sin sub-rubro")))].sort();
                                if (!rubros.length) return null;
                                return <optgroup key={h.id} label={h.nombre}>{rubros.map((rb) => <option key={h.id + "::" + rb} value={h.id + "::" + rb}>{rb}</option>)}</optgroup>;
                              })}
                              <option value="__new__">＋ Nuevo {agruparPor === "rubro" ? "rubro" : "sub-rubro"}…</option>
                            </select>
                          </div>
                          <div style={{ height: 1, background: C.border, margin: "5px 4px" }} />
                        </>
                      )}
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", padding: "4px 9px 2px" }}>Mover a una hoja</div>
                      {agrupaciones.length ? agrupaciones.map((g) => (
                        <button key={g.id} onClick={() => { moverArts(menuIds, g.id); setMenuOpen(null); }} style={miStyle}>📄 {g.nombre}</button>
                      )) : <div style={{ fontSize: 12, color: C.muted, padding: "4px 9px" }}>Todavía no hay hojas</div>}
                      <div style={{ height: 1, background: C.border, margin: "5px 4px" }} />
                      {menuSheet && <button onClick={() => { moverArts(menuIds, null); setMenuOpen(null); }} style={miStyle}>↩︎ Quitar de esta agrupación</button>}
                      <button onClick={() => setCrearMode(true)} style={miStyle}>＋ Crear agrupación a partir de “{crearName}”</button>
                      {menuCombo && (
                        <>
                          <div style={{ height: 1, background: C.border, margin: "5px 4px" }} />
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", padding: "4px 9px 2px" }}>Vincular</div>
                          <button onClick={() => { addAToCombo(menuCombo); setMenuOpen(null); }} style={miStyle}>＋ Agregar producto</button>
                          <button onClick={() => { setComboArts(menuIds, null); setMenuOpen(null); }} style={miStyle}>⤬ Separar vinculación</button>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: 4 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Nombre de la nueva hoja:</div>
                      <input autoFocus value={crearName} onChange={(e) => setCrearName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addColNamed(crearName, menuIds); setMenuOpen(null); } }} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: "inherit", color: C.ink, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setMenuOpen(null)} style={{ ...miBtn, color: C.muted }}>Cancelar</button>
                        <button onClick={() => { addColNamed(crearName, menuIds); setMenuOpen(null); }} style={{ ...miBtn, background: accent, color: "#fff", border: "none" }}>Crear</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            {printOpen && (() => {
              const pCol = agrupaciones.find((c) => c.id === printOpen); if (!pCol) return null;
              const geom = printGeom(printCfg.size, printCfg.orient, printCfg.cols);
              const setCfg = (patch) => { const nc = { ...printCfg, ...patch }; setPrintCfg(nc); if ("cols" in patch) setHojaCols((m) => ({ ...m, [printOpen]: patch.cols })); try { setPrintPages(estimarPaginas(pCol, nc).pags); } catch (_) { } };
              const ratio = geom.h / geom.w;
              const prevW = printCfg.orient === "h" ? 190 : 150, prevH = Math.round(prevW * ratio);
              const segBtn = (active) => ({ flex: "1 0 auto", border: `1px solid ${active ? accent : C.border}`, background: active ? accent : C.card, color: active ? "#fff" : C.ink, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
              return (
                <>
                  <div onClick={() => !dlBusy && setPrintOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,20,25,.12)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 16 }}>
                    <div onClick={(e) => e.stopPropagation()} ref={(el) => { if (!el) return; const vh = window.innerHeight; const h = el.offsetHeight; el.style.marginTop = Math.max(8, Math.min(printAt, vh - h - 16)) + "px"; }} style={{ background: "#fff", color: "#1f1f1d", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.3)", width: "min(94vw, 560px)", maxHeight: "92vh", overflowY: "auto", padding: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18 }}>Preparar archivo para imprimir</div>
                      <button onClick={() => !dlBusy && setPrintOpen(null)} style={{ border: "none", background: "none", fontSize: 20, color: C.muted, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Generá el PDF o la imagen de <b style={{ color: C.ink }}>{pCol.nombre}</b> con la medida exacta para descargar y mandar a imprimir. Si no entra en una hoja, se divide en varias páginas.</div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 230px", minWidth: 200 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Tamaño</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                          {["A4", "A3", "A2", "A1", "Oficio", "Carta"].map((p) => (
                            <button key={p} onClick={() => setCfg({ size: p })} style={segBtn(printCfg.size === p)}>{p}</button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Orientación</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                          <button onClick={() => setCfg({ orient: "v" })} style={segBtn(printCfg.orient === "v")}>▯ Vertical</button>
                          <button onClick={() => setCfg({ orient: "h" })} style={segBtn(printCfg.orient === "h")}>▭ Horizontal</button>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Columnas</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                          {[["0", "Auto"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]].map(([v, l]) => (
                            <button key={v} onClick={() => setCfg({ cols: +v })} style={segBtn(printCfg.cols === +v)}>{l}</button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Formato del archivo</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setCfg({ fmt: "pdf" })} style={segBtn(printCfg.fmt === "pdf")}>📄 PDF</button>
                          <button onClick={() => setCfg({ fmt: "png" })} style={segBtn(printCfg.fmt === "png")}>🖼 Imagen</button>
                        </div>
                      </div>
                      <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Previa</div>
                        <div style={{ position: "relative", width: prevW, height: prevH, margin: "0 auto", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: "0 6px 16px rgba(0,0,0,.12)", display: "flex", gap: 4, padding: 8, boxSizing: "border-box" }}>
                          {Array.from({ length: geom.cols }).map((_, i) => (
                            <div key={i} style={{ flex: 1, borderRight: i < geom.cols - 1 ? `1px dashed ${C.border}` : "none", display: "flex", flexDirection: "column", gap: 3, paddingRight: 3 }}>
                              <div style={{ height: 5, background: accent, borderRadius: 2, opacity: .8 }} />
                              {Array.from({ length: Math.max(3, Math.round((prevH - 24) / 10)) }).map((__, j) => (<div key={j} style={{ height: 2.5, background: "#e4e0da", borderRadius: 2 }} />))}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, color: C.ink, marginTop: 8, fontWeight: 800 }}>{printPages} página{printPages > 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{geom.w}×{geom.h} mm · {geom.cols} col.</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                      <button onClick={() => !dlBusy && setPrintOpen(null)} style={{ flex: "0 0 auto", border: `1px solid ${C.border}`, background: C.card, color: C.ink, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                      <button onClick={() => descargarCarta(pCol, printCfg)} disabled={dlBusy} style={{ flex: 1, border: "none", background: accent, color: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 800, cursor: dlBusy ? "default" : "pointer", fontFamily: "inherit", opacity: dlBusy ? .6 : 1 }}>{dlBusy ? "Generando…" : `⬇ Descargar ${printCfg.fmt === "pdf" ? "PDF" : "imagen"}`}</button>
                    </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        );
      })()}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <Btn ghost small onClick={onBack}>← Volver</Btn>
        <div style={{ flex: 1 }} />
        {articulos.length > 0 && <Btn onClick={() => { setArticulos((prev) => prev.map((a, i) => ({ ...a, codArt: a.codArt || code(i) }))); onNext(); }}>{articulos.length} platos · continuar →</Btn>}
      </div>
    </div>
    </>
  );
}
function EnMarcha({ insumos, setInsumos, articulos, setArticulos, onBrand, businessId, setBusinessId, onDone }) {
  const [negocio, setNegocio] = useState(null);
  const [step, setStep] = useState(0);
  const [ventasRaw, setVentasRaw] = useState("");
  const [savedVentas, setSavedVentas] = useState(null); // estado del mapeo de ventas para poder volver a ajustarlo
  const [raw, setRaw] = useState("");
  const [comprasRaw, setComprasRaw] = useState("");
  const [zona, setZona] = useState("Ramos Mejía (oeste GBA)");
  const [progress, setProgress] = useState(null);
  const [reading, setReading] = useState(false);
  // Paso B: creación real del negocio en la DB
  const [creando, setCreando] = useState(false);
  const [errCrear, setErrCrear] = useState("");

  // Crea el negocio de verdad al terminar DatosNegocio: POST /businesses con
  // todo el branding/contacto/redes, sube el logo (si es archivo) y guarda el
  // businessId para los pasos siguientes. El backend ya deja el negocio como
  // activo (UPDATE active_business_id), así que no hace falta select aparte.
  const crearNegocio = async (d) => {
    setErrCrear("");
    // Si ya había un businessId (p. ej. venías con negocio creado), no recreo;
    // solo guardo datos en local y avanzo.
    if (businessId) { setNegocio(d); return; }
    setCreando(true);
    try {
      // El logo del asistente puede ser una data URL (archivo) que no sirve como
      // logo_url. Lo subimos aparte después de crear; en el branding inicial va
      // solo si ya es una URL http (vino de la búsqueda web).
      const logoEsUrl = typeof d.logo === "string" && /^https?:\/\//i.test(d.logo);
      const payload = {
        name: (d.nombre || "").trim(),
        branding: {
          primary: d.colores?.primary,
          secondary: d.colores?.secondary,
          background: d.colores?.background,
          font: d.fuente || undefined,
          ...(logoEsUrl ? { logo_url: d.logo } : {}),
        },
        contact: { phone: d.telefono || "", web: d.web || "" },
        address: { city: d.ciudad || "", street: d.calle || "", number: d.numero || "" },
        social: { instagram: d.instagram || "", facebook: d.facebook || "", tiktok: d.tiktok || "" },
      };
      const resp = await BusinessesAPI.create(payload);
      const bizId = resp?.business?.id ?? resp?.activeBusinessId;
      if (!bizId) throw new Error("El backend no devolvió el id del negocio.");
      setBusinessId(bizId);

      // Si el logo era un archivo (data URL), lo subo ahora que tengo el id.
      if (d.logo && !logoEsUrl && d.logo.startsWith("data:")) {
        try {
          const blob = await (await fetch(d.logo)).blob();
          const file = new File([blob], "logo.png", { type: blob.type || "image/png" });
          await BusinessesAPI.uploadLogo(bizId, file);
        } catch (e) {
          // El logo es secundario: si falla, seguimos igual (se puede recargar luego).
          console.warn("[onboarding] no se pudo subir el logo:", e?.message);
        }
      }
      // Todo OK: recién ahora guardo en local, lo que hace que EnMarcha avance al POS.
      setNegocio(d);
    } catch (e) {
      setErrCrear("No pude crear el negocio. Revisá los datos y probá de nuevo. (" + (e?.message || "error") + ")");
      throw e; // que DatosNegocio no avance si falló
    } finally {
      setCreando(false);
    }
  };

  // POS actual + integración por API
  const [pos, setPos] = useState("");
  const [posDone, setPosDone] = useState(false);
  const [posView, setPosView] = useState(true); // mostrando el paso POS (navegable desde el stepper)
  const [apiMode, setApiMode] = useState(false);
  const [integrar, setIntegrar] = useState({ ventas: false, menu: false, compras: false, insumos: false });
  const [posExtra, setPosExtra] = useState([]);   // POS sumados por la comunidad
  const [customName, setCustomName] = useState(""); // nombre cuando elige "Otro"
  useEffect(() => { loadPosExtra().then(setPosExtra); }, []);
  const nextOpen = (from) => { let n = from; while (n <= 3 && integrar[STEPKEY[n]]) n++; return n <= 3 ? n : 5; };
  useEffect(() => { if (posDone && step <= 3 && integrar[STEPKEY[step]]) setStep(nextOpen(step)); }, [step, posDone]);

  // Insumos (vista tabla + subir, igual que menú)
  const [insumoRows, setInsumoRows] = useState([]);
  const [insSort, setInsSort] = useState({ key: null, dir: "asc" });
  const [insImportOpen, setInsImportOpen] = useState(false);
  const [insFiles, setInsFiles] = useState(null);
  const [insUpRaw, setInsUpRaw] = useState("");
  const [insImportKey, setInsImportKey] = useState(0);
  useEffect(() => { if (step === 3 && !insumoRows.length && raw.trim()) setInsumoRows(parseInsumos(raw).map((o) => ({ id: crypto.randomUUID(), ...o }))); }, [step]);
  const insSet = (id, patch) => setInsumoRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const insDel = (id) => setInsumoRows((rs) => rs.filter((r) => r.id !== id));
  const insAdd = () => setInsumoRows((rs) => [...rs, { id: crypto.randomUUID(), nombre: "", precio: "" }]);
  const [sugiriendo, setSugiriendo] = useState(false);
  const sugerirInsumos = async () => {
    const platos = articulos.filter((a) => !a.esSep).map((a) => a.nombre).filter(Boolean);
    if (!platos.length || sugiriendo) return;
    setSugiriendo(true);
    try {
      const sys = `Sos el asistente de Lazarillo (gastronómico, Argentina). A partir de esta lista de platos/productos de una carta, deducí los INSUMOS base típicos que se usan para prepararlos (ingredientes de cocina y también bebidas/botellas que se venden tal cual). Devolvé SOLO un array JSON [{"nombre":"...","rubro":"...","unidad":"Gramo|Kilogramo|Mililitro|Litro|Unidad"}] con insumos ÚNICOS (sin repetir), nombres en singular, rubro coherente (ej.: Carnes, Panificados, Lácteos, Verduras y frutas, Almacén, Bebidas, Bebidas con alcohol) y la unidad de medida más habitual. No incluyas platos terminados, solo insumos. Español rioplatense. Sin texto extra ni markdown.`;
      const user = "Platos:\n" + platos.slice(0, 120).join("\n");
      const r = await callClaude(sys, user, true);
      if (Array.isArray(r)) {
        const existentes = new Set(insumoRows.map((x) => keyName(x.nombre)));
        const seen = new Set();
        const nuevos = r.filter((x) => x && x.nombre).filter((x) => { const k = keyName(x.nombre); if (seen.has(k) || existentes.has(k)) return false; seen.add(k); return true; })
          .map((x) => ({ id: crypto.randomUUID(), nombre: oracion(String(x.nombre).trim()), precio: "", unidad: normUnidad(x.unidad) || "Unidad", rubro: mayus(String(x.rubro || "").trim()), codRubro: "", codInsumo: "" }));
        setInsumoRows((rs) => [...nuevos, ...rs]);
      }
    } catch { /* si falla la sugerencia, no rompe nada */ }
    setSugiriendo(false);
  };
  const sumarInsumos = () => {
    const adds = parseInsumos(insUpRaw);
    setInsumoRows((rs) => { const have = new Set(rs.map((r) => r.nombre.trim().toLowerCase())); return [...rs, ...adds.filter((a) => a.nombre && !have.has(a.nombre.toLowerCase())).map((a) => ({ id: crypto.randomUUID(), ...a }))]; });
    setInsUpRaw(""); setInsFiles(null); setInsImportKey((k) => k + 1); setInsImportOpen(false);
  };

  const ingest = async (e, kind, setter) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    e.target.value = "";
    setReading({ done: 0, total: files.length });
    const chunks = [];
    for (let i = 0; i < files.length; i++) {
      try { chunks.push(await readOne(files[i], kind)); } catch { /* salteo el que falle */ }
      setReading({ done: i + 1, total: files.length });
    }
    const text = chunks.filter((c) => c && c.trim()).join("\n");
    if (text) setter((prev) => [String(prev || "").trim(), text].filter(Boolean).join("\n"));
    setReading(false);
  };

  // VENTAS (primero): de acá sale gran parte del menú
  const guardarVentas = () => {
    const list = parseVentas(ventasRaw);
    const arts = list.map((v, i) => ({
      id: crypto.randomUUID(), codArt: (v.codigo && String(v.codigo).trim()) ? String(v.codigo).trim() : `A-${String(i + 1).padStart(4, "0")}`, nombre: v.nombre, desc: "", descripcion: v.descripcion || "",
      precioVenta: v.precio || "", rubro: v.rubro || "", subRubro: v.subRubro || "", codRubro: v.codRubro || "", codSubRubro: v.codSubRubro || "",
      insumos: [], unidades: v.unidades || "", ingresos: v.ingresos || "",
    }));
    setArticulos(codificarRubros(arts));
    setStep(1);
  };

  // COMPRAS (primero): de acá salen gran parte de los insumos con su precio real
  const guardarCompras = () => {
    const list = parseCompras(comprasRaw);
    setRaw((prev) => {
      const nameOf = (s) => String(s || "").split("\\t")[0].split(" - ")[0].trim().toLowerCase();
      const existing = new Set(String(prev || "").split("\n").map(nameOf).filter(Boolean));
      const adds = list.filter((c) => c.nombre && !existing.has(c.nombre.toLowerCase())).map((c) => (c.unidad || c.rubro || c.codRubro) ? `${c.nombre}\\t${c.precio || ""}\\t${c.unidad || ""}\\t${c.rubro || ""}\\t${c.codRubro || ""}` : c.nombre);
      return [String(prev || "").trim(), adds.join("\n")].filter(Boolean).join("\n");
    });
    setStep(3);
  };

  const finalizar = (out) => {
    const cmap = comprasMap(comprasRaw);
    out.forEach((o) => { const c = cmap[o.nombre.toLowerCase()]; if (c) o.precio = c; });
    const cont = {};
    out.sort((a, b) => a.codRubro.localeCompare(b.codRubro) || a.nombre.localeCompare(b.nombre));
    out.forEach((o) => { cont[o.codRubro] = (cont[o.codRubro] || 0) + 1; if (!o.codInsumo) o.codInsumo = `${o.codRubro}-${String(cont[o.codRubro]).padStart(4, "0")}`; });
    setInsumos(out); setProgress(null); setStep(5);
  };

  const clasificar = async () => {
    const rows = insumoRows.map((r) => ({ nombre: (r.nombre || "").trim(), precio: r.precio || "", unidad: (r.unidad || "").trim(), rubro: (r.rubro || "").trim(), codRubro: (r.codRubro || "").trim(), codInsumo: (r.codInsumo || "").trim() })).filter((r) => r.nombre);
    if (!rows.length) { setInsumos([]); setStep(5); return; }
    const normU = (u) => normUnidad(u);
    const out = [];
    const yaClas = rows.filter((r) => r.codRubro || r.rubro);
    const faltan = rows.filter((r) => !r.codRubro && !r.rubro);
    // los que el archivo ya trae con rubro/código → se respetan tal cual
    yaClas.forEach((r) => {
      let cod = r.codRubro, nom = r.rubro;
      if (cod && RUBROS.find((x) => x[0] === cod)) nom = nom || RUBROS.find((x) => x[0] === cod)[1];
      else if (!cod && nom) { const m = RUBROS.find((x) => x[1].toLowerCase() === nom.toLowerCase()); cod = m ? m[0] : "99"; }
      if (!cod) cod = "99";
      if (!nom) nom = (RUBROS.find((x) => x[0] === cod) || ["A Clasificar"])[1];
      out.push({ id: crypto.randomUUID(), nombre: r.nombre, codRubro: cod, rubro: nom, unidad: normU(r.unidad) || "Unidad", precio: r.precio || "A REVISAR", codInsumo: r.codInsumo || "" });
    });
    setStep(4); setProgress({ done: out.length, total: rows.length });
    if (faltan.length) {
      const sys = `Sos un clasificador de insumos para un ERP gastronómico argentino. Te paso nombres de insumos y devolvés SOLO un array JSON, sin texto extra. Cada elemento: {"nombre":"...","codRubro":"NN","unidad":"...","precio":"A REVISAR"}. El codRubro DEBE ser uno de esta lista exacta: ${RUBRO_TXT}. Elegí el rubro más lógico; si no podés, usá 99. La unidad debe ser una de: ${UNIDADES.join(", ")} (inferila del nombre, ej "500cc"->Mililitro, "3k"->Kilogramo; si no hay pista, Unidad). El precio SIEMPRE "A REVISAR". Respetá el nombre tal cual.`;
      const B = 35;
      for (let i = 0; i < faltan.length; i += B) {
        const batch = faltan.slice(i, i + B);
        try {
          const arr = await callClaude(sys, "Clasificá estos insumos:\n" + batch.map((it, k) => `${k + 1}. ${it.nombre}`).join("\n"), true);
          arr.forEach((o, k) => {
            const f = batch[k] || {};
            const cod = (RUBROS.find((r) => r[0] === String(o.codRubro))?.[0]) || "99";
            out.push({ id: crypto.randomUUID(), nombre: o.nombre || f.nombre, codRubro: cod, rubro: RUBROS.find((r) => r[0] === cod)[1], unidad: normU(f.unidad) || (UNIDADES.includes(o.unidad) ? o.unidad : "Unidad"), precio: f.precio ? f.precio : "A REVISAR", codInsumo: f.codInsumo || "" });
          });
        } catch (e) {
          batch.forEach((f) => out.push({ id: crypto.randomUUID(), nombre: f.nombre, codRubro: "99", rubro: "A Clasificar", unidad: normU(f.unidad) || "Unidad", precio: f.precio || "A REVISAR", codInsumo: f.codInsumo || "" }));
        }
        setProgress({ done: out.length, total: rows.length });
      }
    }
    finalizar(out);
  };

  const ta = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 14, resize: "vertical", color: C.ink, background: C.paper };

  if (!negocio) return (
    <div className="rise">
      <DatosNegocio onDone={crearNegocio} onBrand={onBrand} creando={creando} errCrear={errCrear} />
    </div>
  );

  const marca = negocio?.colores || { primary: C.maroon, secondary: C.maroonDark, background: C.paper };

  const posScreen = (() => {
    const posName = pos === POS_OTRO ? customName.trim() : pos;
    const valido = posName && pos !== POS_NINGUNO;
    const finalizarPos = () => { if (pos === POS_OTRO && customName.trim()) registrarPos(customName.trim()); };
    const cargarManual = () => { finalizarPos(); setIntegrar({ ventas: false, menu: false, compras: false, insumos: false }); setPosDone(true); setPosView(false); setStep(0); };
    const conectarApi = () => { finalizarPos(); setPosDone(true); setPosView(false); setStep(nextOpen(0)); };
    const algunaSel = integrar.ventas || integrar.menu || integrar.compras || integrar.insumos;
    const extras = posExtra.filter((p) => !POS_BASE.some((b) => b.toLowerCase() === p.toLowerCase()));
    const ck = (k, l) => (
      <label key={k} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: `1px solid ${integrar[k] ? marca.primary : C.border}`, background: integrar[k] ? `${marca.primary}10` : C.card, borderRadius: 10, cursor: "pointer", fontSize: 14, color: C.ink, fontWeight: 600 }}>
        <input type="checkbox" checked={integrar[k]} onChange={(e) => setIntegrar((p) => ({ ...p, [k]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: marca.primary }} />
        {l}
      </label>
    );
    return (
      <>
        <AnthonyDice pose="saluda" size={80} accent={marca.primary}>
          Antes de arrancar con tus datos, contame: <b>¿qué sistema POS usás hoy?</b><br />Si tiene integración por API, traigo la info directo y te salteo esos pasos.
        </AnthonyDice>
        <Panel titulo={null}>
          <Lbl>Tu sistema POS actual</Lbl>
          <select value={pos} onChange={(e) => setPos(e.target.value)} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14.5, color: C.ink, background: C.paper, fontFamily: "inherit", marginBottom: 4 }}>
            <option value="">Elegí tu POS…</option>
            {[...POS_BASE, ...extras].map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={POS_OTRO}>{POS_OTRO}</option>
            <option value={POS_NINGUNO}>{POS_NINGUNO}</option>
          </select>
          {pos === POS_OTRO && (
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Escribí el nombre de tu POS" autoFocus
              style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", fontSize: 14.5, color: C.ink, background: C.paper, fontFamily: "inherit", marginBottom: 4 }} />
          )}
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>{pos === POS_OTRO ? "Si varios cargan el mismo, lo sumo solo a la lista para todos." : "Estos son los más usados en Argentina. Si el tuyo no está, elegí “Otro”."}</div>

          {!apiMode ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn accent={marca.primary} onClick={() => setApiMode(true)} disabled={!valido}>🔌 Conectar por API</Btn>
              <Btn ghost small accent={marca.primary} onClick={cargarManual}>Lo subo manualmente →</Btn>
            </div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.shade }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Integrar {posName} por API</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>Elegí qué datos traer directo desde {posName}. Los pasos que integres se saltean; el resto los cargás vos.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ck("ventas", "Ventas")}
                {ck("menu", "Artículos / Menú")}
                {ck("compras", "Compras")}
                {ck("insumos", "Insumos")}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <Btn accent={marca.primary} onClick={conectarApi} disabled={!algunaSel}>Conectar y continuar →</Btn>
                <Btn ghost small accent={marca.primary} onClick={() => setApiMode(false)}>← Volver</Btn>
              </div>
            </div>
          )}
        </Panel>
      </>
    );
  })();

  return (
    <div className="rise">
      <Steps items={["POS", "Ventas", "Menú", "Compras", "Insumos"].map((l, i) => (i > 0 && integrar[STEPKEY[i - 1]]) ? `${l} ✓` : l)} active={posView ? 0 : Math.min(step, 3) + 1} accent={marca.primary} onStep={(i) => { if (i === 0) { setPosView(true); } else { setPosView(false); setStep(i - 1); } }} />
      {posView ? posScreen : (<>
      {step <= 3 && step !== 1 && step !== 3 && !(step === 0 && ventasRaw.trim()) && !(step === 2 && comprasRaw.trim()) && (
        <AnthonyDice pose={step === 1 ? "presenta" : step === 0 ? "senala" : "investiga"} size={80} accent={marca.primary}>
          {step === 0 ? <><b>Arrancá subiendo tus ventas</b>. Con eso ya armo gran parte de tu menú y sus precios.</>
            : step === 1 ? "Acá está tu menú. Revisá nombres y precios, o dale una vuelta de diseño."
            : step === 2 ? <><b>Ahora subí tus compras</b>: de ahí saco los insumos con su precio real.</>
            : "Por último repasamos los insumos: los clasifico por rubro y completo lo que falte."}
        </AnthonyDice>
      )}

      {reading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.shade, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, color: C.ink }}>
          <span className="dot" /><span className="dot" style={{ marginLeft: 3 }} /><span className="dot" style={{ marginLeft: 3 }} />
          <span>{reading.total > 1 ? `Leyendo archivos (${reading.done}/${reading.total})… ` : "Leyendo el archivo… "}si hay PDF o fotos, los proceso con IA.</span>
        </div>
      )}

      {step === 0 && (
        <Panel titulo={null} sub={ventasRaw.trim() ? null : <i>En un negocio en marcha, las ventas son el mejor punto de partida: ya contienen qué platos vendés y a qué precio, así armo gran parte del menú solo. Subí el archivo de ventas que exportás de tu sistema (cada fila: plato, unidades, importe).</i>}>
          {!ventasRaw.trim() && <div style={{ borderTop: `1px solid ${C.border}`, margin: "2px 0 18px" }} />}
          <MappedUpload kind="ventas" value={ventasRaw} onChange={setVentasRaw} label="ventas" accent={marca.primary} logo={negocio?.logo} nombre={negocio?.nombre} saved={savedVentas} onSave={setSavedVentas} />
          <Footer>
            <div style={{ flex: 1 }} />
            <Btn ghost small accent={marca.primary} onClick={() => setStep(1)}>No tengo ventas, voy al menú</Btn>
            <Btn accent={marca.primary} onClick={guardarVentas} disabled={!ventasRaw.trim()}>Cargar ventas →</Btn>
          </Footer>
        </Panel>
      )}

      {step === 1 && (
        <MenuReview articulos={articulos} setArticulos={setArticulos} onBack={() => setStep(0)} onNext={() => setStep(2)} accent={marca.primary} logo={negocio?.logo} nombre={negocio?.nombre} negocio={negocio} />
      )}

      {step === 2 && (
        <Panel titulo={null} sub={comprasRaw.trim() ? null : <i>Misma lógica que las ventas: las compras ya traen qué insumos comprás y a qué <b>precio real</b>, así armo gran parte de la lista de insumos sola.</i>}>
          {!comprasRaw.trim() && <div style={{ borderTop: `1px solid ${C.border}`, margin: "2px 0 18px" }} />}
          <MappedUpload kind="compras" value={comprasRaw} onChange={setComprasRaw} label="compras" accent={marca.primary} logo={negocio?.logo} nombre={negocio?.nombre} />
          <Footer>
            <Btn ghost small accent={marca.primary} onClick={() => setStep(1)}>← Volver</Btn>
            <div style={{ flex: 1 }} />
            <Btn ghost small accent={marca.primary} onClick={() => setStep(3)}>No tengo compras, voy a insumos</Btn>
            <Btn accent={marca.primary} onClick={guardarCompras} disabled={!comprasRaw.trim()}>Cargar compras →</Btn>
          </Footer>
        </Panel>
      )}

      {step === 3 && (
        <>
          <AnthonyDice pose="presenta" size={66} accent={marca.primary}>
            <b>Última parada: tus insumos</b><br />Si tenés la lista en un archivo o foto, subila e intento mapearlo con Lazarillo.
          </AnthonyDice>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {articulos.filter((a) => !a.esSep && a.nombre).length > 0 && (
                <button onClick={sugerirInsumos} disabled={sugiriendo} title="Deducir insumos a partir de los platos del menú" style={{ cursor: sugiriendo ? "default" : "pointer", fontSize: 13, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", background: marca.primary, border: "none", borderRadius: 8, padding: "6px 14px", fontFamily: "inherit", opacity: sugiriendo ? .7 : 1 }}>{sugiriendo ? "Sugiriendo…" : "✨ Sugerir insumos desde el menú"}</button>
              )}
              {insImportOpen
                ? <button onClick={() => { setInsImportOpen(false); setInsFiles(null); }} style={{ cursor: "pointer", fontSize: 13, color: marca.primary, fontWeight: 600, whiteSpace: "nowrap", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontFamily: "inherit" }}>Cerrar</button>
                : <label style={{ cursor: "pointer", fontSize: 13, color: marca.primary, fontWeight: 600, whiteSpace: "nowrap", background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontFamily: "inherit", display: "inline-block" }}>📎 Subir insumos<input type="file" accept=".csv,.xlsx,.xls,.xlsm,.pdf,image/*" multiple style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (!fs.length) return; setInsFiles(fs); setInsImportOpen(true); }} /></label>}
            </div>
            {insImportOpen && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <MappedUpload key={insImportKey} kind="insumos" value={insUpRaw} onChange={setInsUpRaw} label="insumos" accent={marca.primary} logo={negocio?.logo} nombre={negocio?.nombre} files={insFiles} />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <Btn accent={marca.primary} onClick={sumarInsumos} disabled={!insUpRaw.trim()}>Sumar a insumos →</Btn>
                </div>
              </div>
            )}
            <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {[["Código", "codInsumo", 110], ["Insumo", "nombre", null], ["Rubro", "rubro", 150], ["Unidad", "unidad", 120], ["Precio", "precio", 130]].map(([h, key, w]) => (
                    <th key={key} onClick={() => setInsSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))} style={{ background: marca.primary, color: "#fff", padding: "8px 12px", textAlign: key === "precio" ? "right" : "left", fontSize: 12, position: "sticky", top: 0, width: w || undefined, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>{h}{insSort.key === key ? (insSort.dir === "asc" ? " ▲" : " ▼") : ""}</th>
                  ))}
                  <th style={{ background: marca.primary, color: "#fff", padding: "8px 12px", width: 40, position: "sticky", top: 0 }}></th>
                </tr></thead>
                <tbody>
                  {insumoRows.length ? (() => {
                    const arr = [...insumoRows]; const k = insSort.key, d = insSort.dir === "asc" ? 1 : -1;
                    if (k) arr.sort((x, y) => { const xv = k === "precio" ? (Number(String(x.precio).replace(/[^\d.-]/g, "")) || 0) : String(x[k] || ""); const yv = k === "precio" ? (Number(String(y.precio).replace(/[^\d.-]/g, "")) || 0) : String(y[k] || ""); return (typeof xv === "number" ? xv - yv : xv.localeCompare(yv, "es", { numeric: true })) * d; });
                    return arr;
                  })().map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "4px 8px" }}><input value={r.codInsumo || ""} onChange={(e) => insSet(r.id, { codInsumo: e.target.value })} placeholder="—" style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, color: C.muted, fontFamily: "inherit", padding: "5px 4px", fontVariantNumeric: "tabular-nums" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input value={r.nombre} onChange={(e) => insSet(r.id, { nombre: e.target.value })} placeholder="Nombre del insumo" style={{ width: "100%", border: "none", background: "transparent", fontSize: 14, color: C.ink, fontFamily: "inherit", padding: "5px 4px" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input value={r.rubro || ""} onChange={(e) => insSet(r.id, { rubro: e.target.value })} placeholder="—" style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, color: C.ink, fontFamily: "inherit", padding: "5px 4px" }} /></td>
                      <td style={{ padding: "4px 8px" }}><select value={normUnidad(r.unidad)} onChange={(e) => insSet(r.id, { unidad: e.target.value })} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5, color: C.ink, background: C.card, fontFamily: "inherit" }}><option value="">—</option>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                      <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}><span style={{ color: C.muted, fontSize: 13 }}>$</span> <input value={r.precio} onChange={(e) => insSet(r.id, { precio: e.target.value })} placeholder="A revisar" style={{ width: 90, border: `1px solid ${C.border}`, borderRadius: 6, background: C.card, fontSize: 13.5, color: C.gold, fontWeight: 700, fontFamily: "inherit", padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }} /></td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}><button onClick={() => insDel(r.id)} style={{ border: "none", background: "none", color: C.muted, cursor: "pointer", fontSize: 15 }}>✕</button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: C.muted, fontSize: 13.5 }}>Todavía no hay insumos. Subí un archivo o agregalos a mano.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={insAdd} style={{ marginTop: 10, background: "none", border: `1px dashed ${C.border}`, color: marca.primary, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Agregar insumo</button>
            <Footer>
              <Btn ghost small accent={marca.primary} onClick={() => setStep(2)}>← Volver</Btn>
              <div style={{ flex: 1 }} />
              <Btn ghost small accent={marca.primary} onClick={() => { setInsumoRows([]); setRaw(""); setStep(5); }}>Saltear</Btn>
              <Btn accent={marca.primary} onClick={clasificar} disabled={!insumoRows.some((r) => (r.nombre || "").trim())}>Finalizar y ver tablero →</Btn>
            </Footer>
          </div>
        </>
      )}

      {step === 4 && progress && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, color: C.maroonDark }}>Clasificando insumos…</p>
          <div style={{ height: 8, background: C.shade, borderRadius: 8, overflow: "hidden", maxWidth: 420, margin: "16px auto" }}>
            <div style={{ height: "100%", width: `${(progress.done / progress.total) * 100}%`, background: C.maroon, transition: "width .3s" }} />
          </div>
          <p style={{ color: C.muted }}>{progress.done} / {progress.total}</p>
        </div>
      )}

      {step === 5 && <Workspace insumos={insumos} setInsumos={setInsumos} articulos={articulos} setArticulos={setArticulos} defaultTab="articulos" accent={marca.primary} onDone={onDone} businessId={businessId} />}
      </>)}
    </div>
  );
}

// ───────────────────────── NEGOCIO NUEVO ─────────────────────────
const TIERS = [
  { k: "breve", t: "Breve", d: "Lo esencial: ~5 platos por turno, cocina simple y stock acotado." },
  { k: "media", t: "Media", d: "Equilibrada: ~10 platos por turno, variedad sin complicar la operación." },
  { k: "completa", t: "Completa", d: "Amplia: ~15 platos por turno, más opciones e insumos a gestionar." },
];

const TURNOS = ["Desayuno", "Merienda", "Almuerzo", "Cena"];
const FRANJA_TURNOS = { dia: ["Desayuno", "Almuerzo", "Merienda"], noche: ["Cena"], ambos: ["Desayuno", "Merienda", "Almuerzo", "Cena"] };
function Nuevo({ insumos, setInsumos, articulos, setArticulos, onBrand, businessId, setBusinessId, onDone }) {
  const [step, setStep] = useState(0);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "¡Hola! Soy Anthony 🐶 Vamos a armar tu negocio de a poco, sin apuro. Para arrancar, contame algo simple: ¿qué tipo de local tenés en mente? (cafetería, parrilla, pizzería, bar, hamburguesería, otro…)" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartas, setCartas] = useState(null);
  const [turnos, setTurnos] = useState(["Almuerzo", "Cena"]);
  const [franja, setFranja] = useState("ambos"); // dia | noche | ambos
  const [foco, setFoco] = useState("comidas"); // comidas | bebidas | ambos
  const [hojasNuevo, setHojasNuevo] = useState(null); // hojas del diseño según lo generado
  const [genT, setGenT] = useState(null); // {done,total,turno} al armar las cartas
  const [identidad, setIdentidad] = useState(null); // {nombres, slogan, colores}
  const [marcaNombre, setMarcaNombre] = useState(""); // nombre elegido
  const [genId, setGenId] = useState(false);
  const [gen, setGen] = useState(null); // {done,total,nombre}
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);

  const conceptSys = `Sos Anthony, el asistente de Lazarillo (ERP gastronómico). Hablás en español rioplatense usando SIEMPRE "vos", cálido y breve. Entendés el CONCEPTO de un negocio gastronómico nuevo charlando DE A POCO: UNA SOLA pregunta corta por mensaje, nunca varias juntas, reaccionando a lo que dice antes de seguir.
Orden natural sugerido: 1) tipo de local; 2) público objetivo; 3) ticket promedio; 4) DIFERENCIALES y propuesta de valor: indagá bien qué lo hace ÚNICO (cómo prepara los platos, técnica, ingredientes/origen, experiencia, servicio) — hacé un par de repreguntas acá porque esto alimenta el nombre; 5) NOMBRE: si no tiene, proponé 3-4 nombres cortos y memorables BASADOS en esos diferenciales, con una justificación breve; si ya tiene, validalo; 6) preferencias de PALETA DE COLORES (qué colores o sensación quiere transmitir: cálido, sobrio, moderno, vibrante…); 7) preferencias de LOGO (estilo: minimalista, tipográfico, ilustrado; algún símbolo que le guste); 8) FRANJA HORARIA: preguntá si atiende de día, de noche o ambos, y en qué TURNOS concretos (desayuno, merienda, almuerzo, cena) — si dice solo de noche, el único turno relevante es la cena; si es de día, desayuno/almuerzo/merienda; 9) FOCO de la carta: preguntá qué tiene más peso, la COMIDA o la BEBIDA. Es clave para bares/cervecerías/vinotecas, donde la bebida suele ser lo principal y la comida es acompañamiento (picadas, tapas). Ajustá la propuesta de carta a eso.
Cuando el cliente describe su modelo, agregá EN CONTEXTO un comentario BREVE (1-2 frases) sobre la rentabilidad típica de ese tipo de negocio y dónde suele estar el margen, como dato al pasar (ej: en cafeterías rinden el café y la pastelería; en parrillas pesa el costo de la carne; los bares ganan con la bebida) — nunca una lista ni una clase.
Cuando ya tenés tipo, público, diferenciales, nombre y preferencias de paleta y logo, cerrá EXACTAMENTE con: "Listo, con esto ya puedo proponerte la carta." y NADA más.
FORMATO DE RESPUESTA: separá tu respuesta en DOS partes con el separador "|||": primero un comentario/reacción breve a lo que dijo el cliente (incluido el dato de rentabilidad si corresponde), SIN pregunta; y después de "|||" UNA sola pregunta corta. Ejemplo: "¡Buena elección! La pizza tiene un margen interesante porque el gran costo está en el queso. ||| ¿A quién le querés vender, tenés un público en mente?". Si en ese turno no hay nada que comentar, devolvé solo la pregunta sin "|||". El mensaje de cierre ("Listo, con esto ya puedo proponerte la carta.") va solo, sin "|||".`;

  const send = async () => {
    const t = input.trim(); if (!t || loading) return;
    const hist = [...msgs, { role: "user", content: t }];
    setMsgs(hist); setInput(""); setLoading(true);
    try {
      const convo = hist.map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`).join("\n");
      const reply = await callClaude(conceptSys, convo + "\nAsistente:");
      const partes = String(reply).split("|||").map((p) => p.trim()).filter(Boolean);
      if (partes.length <= 1) {
        setMsgs([...hist, { role: "assistant", content: partes[0] || reply }]);
        setLoading(false);
      } else {
        // primera parte (reacción) ya; segunda (pregunta) con un respiro
        setMsgs([...hist, { role: "assistant", content: partes[0] }]);
        await new Promise((r) => setTimeout(r, 750));
        setMsgs([...hist, { role: "assistant", content: partes[0] }, { role: "assistant", content: partes.slice(1).join(" ") }]);
        setLoading(false);
      }
    } catch { setMsgs([...hist, { role: "assistant", content: "Se cortó la conexión, probá de nuevo." }]); setLoading(false); }
  };

  const generarCartas = async () => {
    if (!turnos.length) return;
    setLoading(true);
    const concepto = msgs.map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`).join("\n");
    // Una carta se dimensiona POR TURNO: genero ~15 platos por cada turno (un llamado por turno) y los voy mostrando uno a uno.
    setCartas({ breve: [], media: [], completa: [] });
    setStep(1);
    let alguno = false;
    try {
      for (let i = 0; i < turnos.length; i++) {
        const turno = turnos[i];
        setGenT({ done: i, total: turnos.length, turno });
        const focoTxt = foco === "bebidas"
          ? `Este negocio es principalmente de BEBIDAS (bar/cervecería/vinoteca): la carta debe estar DOMINADA por bebidas (tragos y cócteles, cervezas, vinos, aperitivos y bebidas sin alcohol), con varias categorías de bebidas y amplia variedad; sumá solo algunas opciones de comida para picar (picadas, tapas, snacks) como acompañamiento secundario.`
          : foco === "ambos"
          ? `La carta debe EQUILIBRAR comida y bebida, con categorías de ambos y una selección pareja de platos y de bebidas (tragos/cervezas/vinos/sin alcohol).`
          : `La carta es principalmente de COMIDA, pero SIEMPRE debe incluir una sección acotada de BEBIDAS coherentes con el turno (por ejemplo gaseosas, agua, jugos, café/infusiones, y alguna cerveza/vino o trago si aplica). Nunca omitas las bebidas: toda carta gastronómica las tiene, solo que en menor cantidad.`;
        const sys = `Sos el asistente de Lazarillo. En base al concepto, armá la carta del turno "${turno}" para un negocio gastronómico. ${focoTxt} TODA carta debe incluir bebidas (la cantidad y variedad depende del foco). Devolvé SOLO un array JSON [{"n":"nombre del ítem","c":"categoria","p":precio,"g":"grupo"}] con ~15 ítems coherentes con ese turno, el concepto y el foco, ORDENADOS de los más esenciales/infaltables primero a los más opcionales al final. "c" = categoria clara (incluí al menos una de bebidas). "g" = grupo/hoja de la carta al que pertenece el ítem, uno de: "comida" (platos, cocina), "bebida" (gaseosas, agua, jugos, cervezas, vinos, bebidas en general), "cafeteria" (café, infusiones, medialunas, pastelería de cafetería), "cocteleria" (tragos y cócteles con alcohol). Clasificá bien cada ítem en su grupo. p = precio de venta sugerido en pesos argentinos (número). Español rioplatense, nombres atractivos. Sin texto extra ni markdown.`;
        let arr = null;
        for (let intento = 0; intento < 3 && !(Array.isArray(arr) && arr.length); intento++) {
          try {
            const r = await callClaude(sys, "Concepto:\n" + concepto + `\n\nTurno a generar: ${turno}`, true);
            arr = Array.isArray(r) ? r : ((r && (r.platos || r.carta || r[turno])) || []);
          } catch { arr = null; }
        }
        const platos = (Array.isArray(arr) ? arr : []).filter((x) => x && x.n);
        if (platos.length) {
          alguno = true;
          // Voy sumando este turno a cada tamaño de carta (se ve aparecer turno por turno).
          setCartas((prev) => ({
            breve: [...prev.breve, ...platos.slice(0, 5).map((pl) => ({ ...pl, t: turno }))],
            media: [...prev.media, ...platos.slice(0, 10).map((pl) => ({ ...pl, t: turno }))],
            completa: [...prev.completa, ...platos.slice(0, 15).map((pl) => ({ ...pl, t: turno }))],
          }));
        }
      }
      if (!alguno) { setStep(0); setMsgs((m) => [...m, { role: "assistant", content: "No pude armar las cartas, probá de nuevo." }]); }
    } catch { setStep(0); setMsgs((m) => [...m, { role: "assistant", content: "No pude armar las cartas, probá de nuevo." }]); }
    finally { setLoading(false); setGenT(null); }
  };

  const generarIdentidad = async () => {
    setGenId(true);
    const concepto = msgs.map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`).join("\n");
    const sys = `Sos un brand designer para gastronomía. En base al concepto, proponé una identidad de marca. Devolvé SOLO JSON: {"nombres":["3 a 5 nombres cortos, memorables y disponibles"],"slogan":"frase corta","colores":{"primary":"#RRGGBB","secondary":"#RRGGBB","background":"#RRGGBB"}}. Si el cliente ya mencionó un nombre, ponelo PRIMERO. Respetá las preferencias de COLORES y de LOGO que el cliente haya mencionado en la charla. primary = color de acento de la marca; secondary = color oscuro para texto/encabezados; background = claro casi blanco coherente. Sin texto extra ni markdown.`;
    try {
      const obj = await callClaude(sys, "Concepto:\n" + concepto, true);
      const col = obj.colores || {};
      const ids = { nombres: Array.isArray(obj.nombres) ? obj.nombres.slice(0, 5) : [], slogan: obj.slogan || "", colores: { primary: col.primary || "#5BC2EA", secondary: col.secondary || "#15213E", background: col.background || "#F2F4F7" } };
      setIdentidad(ids);
      const elegido = ids.nombres[0] || marcaNombre || "Tu marca";
      setMarcaNombre(elegido);
      onBrand && onBrand({ primary: ids.colores.primary, secondary: ids.colores.secondary, background: ids.colores.background, nombre: elegido, logo: "" });
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "No pude generar la identidad, probá de nuevo." }]); }
    finally { setGenId(false); }
  };

  const idAuto = useRef(false);
  useEffect(() => { if (conceptoClosed && !identidad && !idAuto.current && !genId) { idAuto.current = true; generarIdentidad(); } });
  const cfgAuto = useRef(false);
  useEffect(() => {
    if (!conceptoClosed || cfgAuto.current) return;
    cfgAuto.current = true;
    (async () => {
      try {
        const concepto = msgs.map((m) => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`).join("\n");
        const sys = `Del concepto de un negocio gastronómico, extraé su configuración. Devolvé SOLO JSON: {"franja":"dia|noche|ambos","turnos":["Desayuno"|"Almuerzo"|"Merienda"|"Cena"],"foco":"comidas|bebidas|ambos"}. franja: "dia" si atiende solo de día, "noche" si solo de noche, "ambos" si ambas. turnos: los turnos concretos mencionados o coherentes con la franja. foco: "bebidas" si la bebida es lo principal (bar/cervecería/vinoteca), "comidas" si es principalmente comida, "ambos" si son parejos. Sin texto extra ni markdown.`;
        const r = await callClaude(sys, concepto, true);
        if (r && typeof r === "object") {
          const fr = ["dia", "noche", "ambos"].includes(r.franja) ? r.franja : null;
          if (fr) setFranja(fr);
          const validT = Array.isArray(r.turnos) ? r.turnos.filter((t) => TURNOS.includes(t)) : [];
          const allowed = fr ? FRANJA_TURNOS[fr] : null;
          const sel = allowed ? validT.filter((t) => allowed.includes(t)) : validT;
          if (allowed) setTurnos(sel.length ? sel : allowed.slice());
          else if (sel.length) setTurnos(sel);
          if (["comidas", "bebidas", "ambos"].includes(r.foco)) setFoco(r.foco);
        }
      } catch { /* si falla la extracción, quedan los valores por defecto */ }
    })();
  });

  const elegirNombre = (n) => {
    setMarcaNombre(n);
    if (identidad) onBrand && onBrand({ primary: identidad.colores.primary, secondary: identidad.colores.secondary, background: identidad.colores.background, nombre: n, logo: "" });
  };

  const elegirCarta = async (tierKey) => {
    const platos = cartas[tierKey] || [];
    const G = { comida: "COMIDAS", bebida: "BEBIDAS", cafeteria: "CAFETERÍA", cocteleria: "COCTELERÍA" };
    const gOf = (p) => G[p.g] ? p.g : "comida";
    const orden = foco === "bebidas" ? ["bebida", "cocteleria", "cafeteria", "comida"] : ["comida", "bebida", "cafeteria", "cocteleria"];
    const usados = orden.filter((g) => platos.some((p) => gOf(p) === g));
    const hojaId = {}; const hojas = usados.map((g, i) => { const id = "h" + (i + 1); hojaId[g] = id; return { id, nombre: G[g] }; });
    setHojasNuevo(hojas.length ? hojas : null);
    const arts = platos.map((p) => ({ id: crypto.randomUUID(), nombre: p.n, desc: p.c, categoria: p.c, rubro: p.c || "", subRubro: "", turno: p.t || "", precioVenta: p.p, agrupacion: hojaId[gOf(p)] || null, insumos: [] }));
    setStep(2); setGen({ done: 0, total: arts.length, nombre: "" });
    let accIns = [...insumos];
    const finalArts = [];
    for (let i = 0; i < arts.length; i++) {
      setGen({ done: i, total: arts.length, nombre: arts[i].nombre });
      try {
        const { recetaIns, insumos: nuevos } = await buildReceta(arts[i], accIns);
        accIns = nuevos; finalArts.push({ ...arts[i], insumos: recetaIns });
      } catch { finalArts.push(arts[i]); }
    }
    setInsumos(accIns); setArticulos(finalArts); setGen(null); setStep(3);
  };

  const acc = identidad?.colores?.primary || C.maroon;
  const conceptoClosed = msgs.some((m) => m.role === "assistant" && /proponerte la carta/i.test(m.content));

  const pasos = ["Concepto", "Elegir carta", "Menú", "Recetas e insumos"];
  // Volver a "Elegir carta" desde el stepper (además del botón onBack de MenuReview,
  // que hace lo mismo) — el chat de "Concepto" no se puede re-abrir así, por eso
  // ese click no hace nada.
  const irAElegirCarta = (i) => { if (i === 1) setStep(1); };
  if (step === 3) return <div className="rise"><Steps items={pasos} active={2} accent={acc} onStep={irAElegirCarta} /><MenuReview articulos={articulos} setArticulos={setArticulos} onBack={() => setStep(1)} onNext={() => setStep(4)} accent={acc} logo="" nombre={marcaNombre} negocio={{ nombre: marcaNombre, logo: "", colores: identidad?.colores || { primary: acc, secondary: acc } }} hojasIniciales={hojasNuevo} /></div>;
  if (step === 4) return <div className="rise"><Steps items={pasos} active={3} accent={acc} onStep={irAElegirCarta} /><Workspace insumos={insumos} setInsumos={setInsumos} articulos={articulos} setArticulos={setArticulos} shoppingHint accent={acc} /></div>;

  return (
    <div className="rise">
      <Steps items={pasos} active={step >= 2 ? 2 : step} accent={acc} />

      {step === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div ref={scrollRef} style={{ maxHeight: 420, overflowY: "auto", padding: 20 }}>
            {msgs.map((m, i) => (
              m.role === "assistant"
                ? <div key={i} className="rise" style={{ marginBottom: 6 }}><AnthonyDice pose={i === 0 ? "saluda" : "presenta"} size={56} accent={acc}>{m.content}</AnthonyDice></div>
                : <div key={i} className="rise" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 13, fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "#f7ece4", background: acc }}>{m.content}</div>
                  </div>
            ))}
            {loading && <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12 }}><Anthony pose="investiga" size={56} /><div style={{ background: "#eaf4fb", border: "1px solid #cfe6f5", borderRadius: 14, borderBottomLeftRadius: 4, padding: "12px 15px" }}><span className="dot" /><span className="dot" style={{ marginLeft: 4 }} /><span className="dot" style={{ marginLeft: 4 }} /></div></div>}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, display: "flex", gap: 10 }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Escribí tu respuesta…" style={{ flex: 1, resize: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14.5, color: C.ink, background: C.paper, maxHeight: 120 }} />
            <Btn accent={acc} onClick={send} disabled={loading || !input.trim()}>Enviar</Btn>
          </div>
          {conceptoClosed && (
            <div style={{ padding: "0 14px 16px" }}>
              <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 700 }}>🎨 Identidad de marca</div>
                  {identidad
                    ? <button onClick={generarIdentidad} disabled={genId} style={{ border: `1px solid ${C.border}`, background: C.card, color: acc, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: genId ? "default" : "pointer", fontFamily: "inherit" }}>{genId ? "Generando…" : "↻ Regenerar"}</button>
                    : !genId && <button onClick={generarIdentidad} style={{ border: `1px solid ${C.border}`, background: C.card, color: acc, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✨ Generar</button>}
                </div>
                {genId && !identidad && <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>Creando tu identidad a partir de la charla (nombre, colores y logo)… <span className="dot" /><span className="dot" style={{ marginLeft: 3 }} /><span className="dot" style={{ marginLeft: 3 }} /></div>}
                {identidad && (
                  <div style={{ marginTop: 12 }}>
                    {/* logo wordmark SVG */}
                    {(() => { const col = identidad.colores; const ini = (marcaNombre || "M").trim().charAt(0).toUpperCase(); return (
                      <svg viewBox="0 0 380 130" style={{ width: 260, maxWidth: "100%", height: "auto", borderRadius: 12, border: `1px solid ${C.border}`, display: "block" }}>
                        <rect width="380" height="130" fill={col.background} />
                        <circle cx="50" cy="65" r="24" fill={col.primary} />
                        <text x="50" y="74" textAnchor="middle" fontFamily="'Sora',sans-serif" fontSize="26" fontWeight="700" fill={col.background}>{ini}</text>
                        <text x="90" y="68" fontFamily="'Sora',sans-serif" fontSize="30" fontWeight="700" fill={col.secondary}>{marcaNombre}</text>
                        {identidad.slogan && <text x="91" y="92" fontFamily="'Archivo',sans-serif" fontSize="13" fill={col.primary}>{identidad.slogan}</text>}
                      </svg>
                    ); })()}
                    {identidad.nombres.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>Elegí el nombre:</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {identidad.nombres.map((n) => (
                            <button key={n} onClick={() => elegirNombre(n)} style={{ border: `1.5px solid ${marcaNombre === n ? acc : C.border}`, background: marcaNombre === n ? acc : C.card, color: marcaNombre === n ? "#fff" : C.ink, borderRadius: 20, padding: "6px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, color: C.muted }}>Paleta:</span>
                      {["primary", "secondary", "background"].map((k) => (
                        <span key={k} title={identidad.colores[k]} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
                          <span style={{ width: 20, height: 20, borderRadius: 5, background: identidad.colores[k], border: `1px solid ${C.border}`, display: "inline-block" }} />{identidad.colores[k]}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: C.ok, marginTop: 8 }}>✓ Identidad aplicada al asistente. Es un punto de partida: el logo es un wordmark editable.</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>¿En qué franja horaria vas a atender?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
                {[["dia", "☀️ De día"], ["noche", "🌙 De noche"], ["ambos", "Día y noche"]].map(([k, l]) => (
                  <button key={k} onClick={() => { setFranja(k); setTurnos(FRANJA_TURNOS[k].slice()); }}
                    style={{ border: `1.5px solid ${franja === k ? acc : C.border}`, background: franja === k ? acc : C.card, color: franja === k ? "#fff" : C.muted, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>¿Qué tiene más peso en tu carta?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
                {[["comidas", "🍽️ La comida"], ["bebidas", "🍹 La bebida"], ["ambos", "Ambas por igual"]].map(([k, l]) => (
                  <button key={k} onClick={() => setFoco(k)}
                    style={{ border: `1.5px solid ${foco === k ? acc : C.border}`, background: foco === k ? acc : C.card, color: foco === k ? "#fff" : C.muted, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>¿En qué turnos vas a atender? (la carta se dimensiona por turno)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
                {FRANJA_TURNOS[franja].map((tn) => {
                  const on = turnos.includes(tn);
                  return (
                    <button key={tn} onClick={() => setTurnos((p) => p.includes(tn) ? p.filter((x) => x !== tn) : [...p, tn])}
                      style={{ border: `1.5px solid ${on ? acc : C.border}`, background: on ? acc : C.card, color: on ? "#fff" : C.muted, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {tn}
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: "center" }}>
                <Btn accent={acc} onClick={generarCartas} disabled={loading || !turnos.length}>{genT ? `Armando ${genT.turno}… (${genT.done + 1}/${genT.total})` : loading ? "Armando las cartas…" : `Proponerme las cartas (${turnos.length} turno${turnos.length !== 1 ? "s" : ""}) →`}</Btn>
                {!turnos.length && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>Elegí al menos un turno.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && cartas && (
        <div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", margin: "0 0 4px", color: C.maroonDark }}>Tres cartas para tu concepto</h2>
          <p style={{ color: C.muted, marginTop: 0 }}>Elegí una. Al elegirla genero todas las recetas y la lista de insumos a comprar.</p>
          {genT && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.shade, border: `1px solid ${C.border}`, borderLeft: `3px solid ${acc}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13.5, color: C.ink }}>
              <span className="dot" /><span className="dot" style={{ marginLeft: 3 }} /><span className="dot" style={{ marginLeft: 3 }} />
              <span>Armando el turno <b>{genT.turno}</b> ({genT.done + 1} de {genT.total})… las cartas se completan turno por turno.</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
            {TIERS.map((tier) => {
              const platos = cartas[tier.k] || [];
              const turnosEn = [...new Set(platos.map((p) => p.t).filter(Boolean))];
              const cats = [...new Set(platos.map((p) => p.c))];
              const precios = platos.map((p) => p.p).filter((n) => typeof n === "number");
              const min = precios.length ? Math.min(...precios) : 0, max = precios.length ? Math.max(...precios) : 0;
              return (
                <div key={tier.k} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 12, letterSpacing: ".8px", color: C.gold, fontWeight: 700 }}>{platos.length} PLATOS{turnosEn.length ? ` · ${turnosEn.length} turno${turnosEn.length !== 1 ? "s" : ""}` : ""}{precios.length ? ` · $${min}–${max}` : ""}</div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 600, color: C.maroonDark, margin: "4px 0 2px" }}>Carta {tier.t}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>{tier.d}</div>
                  <div style={{ flex: 1, maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
                    {(turnosEn.length ? turnosEn : ["__"]).map((tn) => (
                      <div key={tn} style={{ marginBottom: 12 }}>
                        {tn !== "__" && <div style={{ fontSize: 12.5, fontWeight: 800, color: C.maroonDark, borderBottom: `1px solid ${C.border}`, paddingBottom: 3, marginBottom: 6 }}>{tn}</div>}
                        {[...new Set(platos.filter((p) => tn === "__" || p.t === tn).map((p) => p.c))].map((cat) => (
                          <div key={cat} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: acc, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{cat}</div>
                            {platos.filter((p) => (tn === "__" || p.t === tn) && p.c === cat).map((p, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0", color: C.ink }}>
                                <span>{p.n}</span><span style={{ color: C.muted }}>${p.p}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Btn accent={acc} onClick={() => elegirCarta(tier.k)} disabled={!!genT || !platos.length}>{genT ? "Generando…" : `Elegir carta ${tier.t} →`}</Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && gen && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: "center" }}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, color: C.maroonDark, margin: "0 0 4px" }}>Generando recetas e insumos…</p>
          <p style={{ color: C.muted, fontSize: 13, minHeight: 18 }}>{gen.nombre ? `Procesando: ${gen.nombre}` : ""}</p>
          <div style={{ height: 8, background: C.shade, borderRadius: 8, overflow: "hidden", maxWidth: 420, margin: "16px auto" }}>
            <div style={{ height: "100%", width: `${(gen.done / gen.total) * 100}%`, background: C.maroon, transition: "width .3s" }} />
          </div>
          <p style={{ color: C.muted }}>{gen.done} / {gen.total} platos</p>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Workspace (tablas Insumos + Artículos) ─────────────────────────
function Workspace({ insumos, setInsumos, articulos, setArticulos, shoppingHint, defaultTab, accent = C.maroon, onDone, businessId }) {
  const [tab, setTab] = useState(defaultTab || "insumos");
  const [busy, setBusy] = useState(null);
  const [nuevoArt, setNuevoArt] = useState("");

  const updIns = (id, k, v) => setInsumos(insumos.map((i) => i.id === id ? { ...i, ...(k === "codRubro" ? { codRubro: v, rubro: RUBROS.find((r) => r[0] === v)[1] } : { [k]: v }) } : i));

  // genera receta de un artículo con la IA y agrega insumos nuevos
  const generarReceta = async (art) => {
    setBusy(art.id);
    try {
      const { recetaIns, insumos: nuevos } = await buildReceta(art, insumos);
      setInsumos(nuevos);
      setArticulos((prev) => prev.map((a) => a.id === art.id ? { ...a, insumos: recetaIns } : a));
    } catch { /* noop */ } finally { setBusy(null); }
  };

  const addArticulo = () => {
    if (!nuevoArt.trim()) return;
    setArticulos([...articulos, { id: crypto.randomUUID(), nombre: nuevoArt.trim(), desc: "", precioVenta: "", insumos: [] }]);
    setNuevoArt("");
  };

  // Paso C/D: persiste todo lo cargado en el asistente y sale al onDone.
  const [guardando, setGuardando] = useState(false);
  const [errGuardar, setErrGuardar] = useState("");
  const finalizar = async () => {
    setErrGuardar("");
    // Sin negocio real (no debería pasar en el flujo normal): salgo sin guardar.
    if (!businessId) { onDone && onDone(); return; }
    setGuardando(true);
    try {
      // 1) Insumos: el endpoint espera un ARRAY DIRECTO (no envuelto).
      const insumosPayload = insumos
        .filter((i) => (i.nombre || "").trim())
        .map((i) => ({
          nombre: (i.nombre || "").trim(),
          codigoMaxi: i.codInsumo || undefined,
          unidadMed: i.unidad || undefined,
          precioRef: i.precio !== "" && i.precio != null ? Number(String(i.precio).replace(",", ".")) : undefined,
          rubro: i.rubro || undefined,
          esElaborado: !!i.esElaborado,
          origen: "onboarding",
        }));
      if (insumosPayload.length) {
        await http("/insumos/bulk", { method: "POST", body: insumosPayload });
      }

      // 2) Artículos: el endpoint espera { articulos: [...] } con nombre/precioVenta/rubro/subRubro.
      const articulosPayload = articulos
        .filter((a) => (a.nombre || "").trim() && !a.discontinuado)
        .map((a) => ({
          nombre: (a.nombre || "").trim(),
          precioVenta: a.precioVenta !== "" && a.precioVenta != null ? Number(String(a.precioVenta).replace(",", ".")) : null,
          rubro: a.rubro || "",
          subRubro: a.subRubro || "",
          descripcion: a.desc || a.descripcion || "",
        }));
      if (articulosPayload.length) {
        await http(`/businesses/${businessId}/onboarding/articulos-bulk`, { method: "POST", body: { articulos: articulosPayload } });
      }

      onDone && onDone();
    } catch (e) {
      setErrGuardar("No pude guardar todo. Podés reintentar. (" + (e?.message || "error") + ")");
    } finally {
      setGuardando(false);
    }
  };

  const exportCSV = (rows, headers, filename) => {
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };
  const exportIns = () => exportCSV(insumos.map((i) => [i.codRubro, i.rubro, i.codInsumo, i.nombre, i.unidad, i.precio]), ["Codigo de Rubro", "Rubro de Insumo", "Codigo de Insumo", "Nombre de Insumo", "Unidad de Medida", "Precio de Compra"], "insumos_lazarillo.csv");
  const exportArt = () => {
    const rows = [];
    articulos.forEach((a) => { if (!a.insumos.length) rows.push([a.nombre, a.precioVenta, a.unidades || "", a.ingresos || "", "", "", ""]); a.insumos.forEach((ins) => rows.push([a.nombre, a.precioVenta, a.unidades || "", a.ingresos || "", ins.nombre, ins.cantidad, ins.unidad])); });
    exportCSV(rows, ["Articulo", "Precio de Venta", "Unidades Vendidas", "Ingresos", "Insumo", "Cantidad", "Unidad"], "articulos_lazarillo.csv");
  };

  const porRubro = insumos.reduce((m, i) => ((m[i.rubro] = (m[i.rubro] || 0) + 1), m), {});

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["insumos", `Insumos (${insumos.length})`], ["articulos", `Artículos (${articulos.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${tab === k ? accent : C.border}`, background: tab === k ? accent : C.card, color: tab === k ? "#f7ece4" : C.ink, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn ghost small onClick={tab === "insumos" ? exportIns : exportArt}>⬇ Exportar CSV</Btn>
      </div>

      {tab === "insumos" && (
        <div>
          {shoppingHint && (
            <div style={{ background: C.shade, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, color: C.ink }}>
              <b>Insumos a comprar para arrancar.</b> Esta es la lista consolidada que sale de todas las recetas de tu carta (sin duplicados). Completá los precios y ya tenés el costeo listo.
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {Object.entries(porRubro).sort().map(([r, n]) => (
              <span key={r} style={{ fontSize: 12, background: C.shade, color: accent, padding: "3px 9px", borderRadius: 20 }}>{r}: <b>{n}</b></span>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "auto", maxHeight: 520 }}>
            <table>
              <thead><tr style={{ position: "sticky", top: 0 }}>{["Rubro", "Código", "Nombre", "Unidad", "Precio"].map((h) => (
                <th key={h} style={{ background: accent, color: "#f7ece4", padding: "10px 12px", textAlign: "left", fontSize: 12, position: "sticky", top: 0 }}>{h}</th>))}</tr></thead>
              <tbody>
                {insumos.map((i, idx) => (
                  <tr key={i.id} style={{ background: idx % 2 ? C.shade : C.card }}>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}` }}>
                      <Tag cod={i.codRubro} /> <select value={i.codRubro} onChange={(e) => updIns(i.id, "codRubro", e.target.value)} style={{ border: "none", background: "transparent", fontSize: 12.5, color: C.ink, cursor: "pointer", maxWidth: 150 }}>
                        {RUBROS.map((r) => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select>
                    </td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{i.codInsumo}</td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}` }}>{i.nombre}</td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}` }}>
                      <select value={i.unidad} onChange={(e) => updIns(i.id, "unidad", e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12.5 }}>
                        {UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
                    </td>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}` }}>
                      <input value={i.precio} onChange={(e) => updIns(i.id, "precio", e.target.value)} style={{ width: 95, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12.5, color: i.precio === "A REVISAR" ? C.danger : (i.precio ? C.ok : C.ink), fontWeight: i.precio === "A REVISAR" || (i.precio && i.precio !== "A REVISAR") ? 700 : 400 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "articulos" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input value={nuevoArt} onChange={(e) => setNuevoArt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addArticulo()} placeholder="Nombre de un plato/producto nuevo…" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", fontSize: 14 }} />
            <Btn onClick={addArticulo} disabled={!nuevoArt.trim()}>+ Agregar artículo</Btn>
          </div>
          {!articulos.length && <p style={{ color: C.muted }}>Todavía no hay artículos. Agregá uno arriba y generá su receta.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {articulos.map((a) => (
              <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 600, color: C.maroonDark }}>{a.nombre}</div>
                    {(a.unidades || a.ingresos) ? (
                      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                        {a.unidades ? <>🧾 {a.unidades} vendidos</> : null}
                        {a.unidades && a.ingresos ? " · " : null}
                        {a.ingresos ? <>💰 ${Number(a.ingresos).toLocaleString("es-AR")} ingresos</> : null}
                      </div>
                    ) : a.desc ? <div style={{ fontSize: 12.5, color: C.muted }}>{a.desc}</div> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {a.precioVenta && <span style={{ color: C.gold, fontWeight: 700 }}>${a.precioVenta}</span>}
                    <Btn small ghost onClick={() => generarReceta(a)} disabled={busy === a.id}>{busy === a.id ? "Generando…" : a.insumos.length ? "Regenerar receta" : "Generar receta"}</Btn>
                  </div>
                </div>
                {a.insumos.length > 0 && (
                  <table style={{ marginTop: 12 }}>
                    <tbody>
                      {a.insumos.map((ins, k) => (
                        <tr key={k}><td style={{ padding: "4px 0", color: C.ink }}>{ins.nombre}</td>
                          <td style={{ padding: "4px 0", textAlign: "right", color: C.muted, width: 120 }}>{ins.cantidad} {ins.unidad}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {onDone && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 18, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.muted }}>
            {articulos.length} artículo{articulos.length !== 1 ? "s" : ""} · {insumos.length} insumo{insumos.length !== 1 ? "s" : ""}
          </span>
          <Btn accent={accent} onClick={finalizar} disabled={guardando}>{guardando ? "Guardando tu negocio…" : "Terminar e ir a mi negocio →"}</Btn>
          {errGuardar && <p style={{ color: C.danger, fontSize: 13, width: "100%", textAlign: "right", margin: "4px 0 0" }}>{errGuardar}</p>}
        </div>
      )}
    </div>
  );
}