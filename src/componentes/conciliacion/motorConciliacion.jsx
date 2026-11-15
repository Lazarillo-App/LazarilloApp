/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- partes de ModuloConciliacion.jsx (separadas sin cambiar lógica, 15/11/2026) */
/* Motor de la conciliación: paleta, formatos, lectores de archivos (22, 71, banco), conciliar() y autoConciliarCC(). Sin pantallas. */
import React from "react";

import INSTR_VD from './instructivo/venta-detallada-22.jpg';
import INSTR_CC from './instructivo/cta-cte-por-comprobante-72.jpg';
import INSTR_BANCO from './instructivo/mercadopago-transacciones.jpg';

/**
 * ModuloConciliacion — Conciliación bancaria de Lazarillo (componente React).
 *
 * Cruza los INGRESOS (ventas no-efectivo del informe 22 + cobranzas de cuenta
 * corriente del informe 71) contra los MOVIMIENTOS DEL BANCO (settlement de
 * Mercado Pago), por FECHA + IMPORTE.
 *
 * Incluye:
 *   • 3 uploaders con modal de importación estilo Lazarillo + instructivo
 *     paso a paso (con capturas reales de MaxiRest) para el 22 y el 71.
 *   • Filtro de período (chips de mes + rango desde–hasta).
 *   • Match automático de 2 pasos:
 *       1) 1-a-1 exacto (importe igual, fecha ± tolerancia)
 *       2) 1-a-varios SOLO si los movimientos son todos iguales o consecutivos
 *          por hora. Iguales → verde · Consecutivos → verde con letra roja.
 *   • Dos jerarquías de filtro + banco sincronizado.
 *   • Conciliación manual con resaltado cruzado y tilde final.
 *   • Exportar a Excel (usa SheetJS si está disponible en window.XLSX).
 *
 * Autocontenido salvo por SheetJS (XLSX), que debe estar disponible como
 * window.XLSX (por CDN o import del proyecto) para leer/exportar archivos.
 *
 * NOTA: por ahora es el prototipo funcional. Para producción, la lectura de
 * archivos podría centralizarse para compartir con el módulo de Resultados.
 */

// ─── Assets embebidos ───────────────────────────────────────────────

// ─── Paleta de marca ────────────────────────────────────────────────
export const C = {
  noche: "#12111F", tinta: "#15213E", celeste: "#5BC2EA", celesteDeep: "#2492C8",
  paper: "#F2F4F7", white: "#ffffff",
  line: "rgba(21,33,62,.10)", line2: "rgba(21,33,62,.16)",
  txt: "#15213E", txt2: "#5b6577", txt3: "#8a93a3",
  green: "#1a9c6e", greenBg: "#1a9c6e14", amber: "#c77d08", amberBg: "#f59e0b16",
  red: "#d94f63",
};

export const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];


// ─── Helpers ────────────────────────────────────────────────────────
export const fmt = (n) => "$" + Math.round(n).toLocaleString("es-AR");
// Fecha ISO (YYYY-MM-DD) → dd-mm-yy para mostrar en las tablas
export const fmtFecha = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "-" + m[2] + "-" + m[1].slice(2) : String(iso || ""); };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));
// Normaliza nombre de cliente para agrupar (minúsculas, sin acentos, sin "na", sin puntuación)
export const normCli = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
  .replace(/\bna\b/g, "").replace(/[^a-z0-9 ]/g, " ")
  .replace(/\s+/g, " ").trim();
// Clave de agrupación por cliente: primeros 2 tokens del nombre normalizado.
// Tolera diferencias de sufijo entre el 22 y el 71 (ej. "Guccione Cristina" vs
// "Guccione Cristina CRISTINA" agrupan igual).
// El 22 a veces repite el nombre ("chueco chueco", "Oscar Oscar", "SALINAS MATIAS
// MATIAS"): se colapsan las mitades iguales y las palabras repetidas seguidas, así
// "chueco chueco" (ventas) y "chueco" (cobranzas) son la misma cuenta.
export const cliKey = (s) => {
  let w = normCli(s).split(" ").filter(Boolean);
  if (w.length >= 2 && w.length % 2 === 0 && w.slice(0, w.length / 2).join(" ") === w.slice(w.length / 2).join(" ")) w = w.slice(0, w.length / 2);
  w = w.filter((t, i) => i === 0 || t !== w[i - 1]);
  return w.slice(0, 2).join(" ");
};
// ¿coinciden el cliente del ingreso y el pagador del banco? (comparte algún token
// significativo de ≥3 letras). Mismo pagador = conciliación mucho más probable.
export const pagadorCoincide = (a, b) => {
  const ta = normCli(a).split(" ").filter((t) => t.length >= 3);
  const tb = normCli(b).split(" ").filter((t) => t.length >= 3);
  return ta.length > 0 && tb.length > 0 && ta.some((t) => tb.includes(t));
};
// Conciliación AUTOMÁTICA de cobranzas de CUENTA CORRIENTE — solo el caso seguro:
// importe EXACTO + MISMO DÍA + el pagador del banco coincide con el cliente (por nombre
// o por el mapa aprendido). Corre DESPUÉS del motor de ventas (las ventas tienen
// prioridad sobre el banco) y puede juntar hasta 4 cobranzas del mismo cliente contra
// un pago. Lo que no cumple las tres condiciones queda como sugerencia.
export function autoConciliarCC(res, pagos, conoce) {
  // Confía en el ERP: si el 72 dice que el cliente pagó por banco y el pago está en
  // MercadoPago, se concilia. Por cliente y por día (una transferencia suele pagar
  // varios tickets): primero el TOTAL de sus cobros del día, después combinaciones.
  // Sin que coincida el pagador, solo si el importe es ÚNICO ese día (un solo pago
  // libre por ese monto y ninguna venta pendiente por el mismo monto).
  const ccIds = [], pares = [];
  if (!res || !pagos || !pagos.length) return { res, ccIds, pares };
  const mismo = (cli, pag) => !!pag && (pagadorCoincide(cli, pag) || (!!conoce && conoce(cli, pag)));
  const B = res.B.slice(); const nuevosV = []; const usadosBan = new Set();
  const ventasPend = {}; res.V.forEach((v) => { if (v.status === "pend") { const k = v.fecha + "|" + v.imp; ventasPend[k] = (ventasPend[k] || 0) + 1; } });
  const libres = (fecha, imp) => B.map((b, i) => ({ b, i })).filter((x) => x.b.status === "pend" && !usadosBan.has(x.b.id) && x.b.fecha === fecha && x.b.imp === imp);
  // elige el pago: el del pagador conocido/coincidente; si no, el único posible
  const diaSig = (f) => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
  const elegir = (cli, fecha, imp) => {
    const c = libres(fecha, imp); if (!c.length) return null;
    const conNombre = c.find((x) => mismo(cli, x.b.cliente)); if (conNombre) return conNombre;
    if (c.length === 1 && !ventasPend[fecha + "|" + imp]) return c[0];
    return null;
  };
  const cerrar = (grupo, x) => {
    const b = x.b; usadosBan.add(b.id);
    grupo.forEach((p) => {
      ccIds.push(p.id); pares.push({ cli: p.cliente, pag: b.cliente, fecha: b.fecha, ref: refCob(p) + "@" + refBan(b) });
      nuevosV.push({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, fechaFact: p.fechaFact, matchedWith: [b.id], matchTipo: "ctacte", ccCobranza: p.id });
    });
    B[x.i] = { ...b, status: "ok", matchedWith: "cc-" + grupo[0].id, matchTipo: "ctacte" };
  };
  // varios pagos (2 o 3) del pagador del cliente que suman exacto lo cobrado
  const cerrarMulti = (grupo, xs) => {
    xs.forEach((x) => usadosBan.add(x.b.id));
    const banIds = xs.map((x) => x.b.id);
    grupo.forEach((p) => {
      ccIds.push(p.id);
      xs.forEach((x) => pares.push({ cli: p.cliente, pag: x.b.cliente, fecha: x.b.fecha, ref: refCob(p) + "@" + refBan(x.b) }));
      nuevosV.push({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, fechaFact: p.fechaFact, matchedWith: banIds, matchTipo: "ctacte", ccCobranza: p.id });
    });
    xs.forEach((x) => { B[x.i] = { ...x.b, status: "ok", matchedWith: "cc-" + grupo[0].id, matchTipo: "ctacte" }; });
  };
  const variosDelPagador = (cli, fecha, total) => {
    const c = B.map((b, i) => ({ b, i })).filter((x) => x.b.status === "pend" && !usadosBan.has(x.b.id) && x.b.fecha === fecha && x.b.imp < total && mismo(cli, x.b.cliente));
    for (let a = 0; a < c.length; a++) for (let d = a + 1; d < c.length; d++) {
      const s2 = c[a].b.imp + c[d].b.imp; if (s2 === total) return [c[a], c[d]];
      for (let e = d + 1; e < c.length; e++) if (s2 + c[e].b.imp === total) return [c[a], c[d], c[e]];
    }
    return null;
  };
  const porClienteDia = {};
  pagos.forEach((p) => { if (!p.cliente) return; const k = p.fecha + "|" + cliKey(p.cliente); (porClienteDia[k] = porClienteDia[k] || []).push(p); });
  Object.values(porClienteDia).forEach((cobs) => {
    let rest = cobs.slice().sort((a, b) => b.imp - a.imp);
    const cli = rest[0].cliente, fecha = rest[0].fecha;
    // 1) el total de lo que pagó ese día
    { const tot = rest.reduce((a, p) => a + p.imp, 0);
      // un pago por el TOTAL del día (como paga en la realidad: una transferencia por varios tickets),
      // ese día o, si MercadoPago lo acreditó después, el día siguiente
      const x = (rest.length > 1 ? elegir(cli, fecha, tot) : null) || elegir(cli, diaSig(fecha), tot);
      if (x) { cerrar(rest, x); return; }
      const xs = variosDelPagador(cli, fecha, tot) || variosDelPagador(cli, diaSig(fecha), tot);
      if (xs) { cerrarMulti(rest, xs); return; } }
    // 2) combinaciones (de más grandes a más chicas), hasta que no cierre nada más
    let cambio = true;
    while (cambio && rest.length) {
      cambio = false;
      const n = Math.min(rest.length, 6);
      const subs = [];
      for (let mask = 1; mask < (1 << n); mask++) { const g = []; for (let j = 0; j < n; j++) if (mask & (1 << j)) g.push(rest[j]); subs.push(g); }
      subs.sort((a, b) => b.length - a.length);
      for (const g of subs) {
        const x = elegir(cli, fecha, g.reduce((a, p) => a + p.imp, 0));
        if (x) { cerrar(g, x); const ids = new Set(g.map((p) => p.id)); rest = rest.filter((p) => !ids.has(p.id)); cambio = true; break; }
      }
    }
  });
  return { res: { V: [...res.V, ...nuevosV], B }, ccIds, pares };
}

// Memoria de pagadores por cuenta: { claveCliente: { cli, pags: { clavePagador: { nombre, veces, ultimo } } } }.
// Acepta el formato viejo (pagador → cliente) y lo convierte.
export function memDesdeProp(m) {
  if (!m || typeof m !== "object") return {};
  const vals = Object.values(m);
  if (vals.length && typeof vals[0] === "object" && vals[0] && vals[0].pags) return m;
  const out = {};
  Object.keys(m).forEach((pag) => { const cli = m[pag]; if (!cli) return; (out[cli] = out[cli] || { cli, pags: {} }).pags[pag] = { nombre: pag, veces: 1, ultimo: "" }; });
  return out;
}
export const refCob = (x) => (x.fecha || "") + "|" + (x.imp || 0) + "|" + (x.comp || "");
export const refBan = (b) => (b.fecha || "") + "|" + (b.imp || 0) + "|" + (b.hora || "");
// "veces" = pagos de banco distintos (un pago puede cubrir varias cobranzas)
export const vecesDe = (refs) => new Set(refs.map((r) => r.split("@")[1] || r)).size;
// cuenta cada cobranza UNA sola vez (por su referencia), así recalcular no infla las veces
export function memRegistrar(mem, pares) {
  if (!pares || !pares.length) return mem;
  const n = { ...mem }; let cambio = false;
  pares.forEach(({ cli, pag, fecha, ref }) => {
    const ck = cliKey(cli), pk = cliKey(pag);
    if (!ck || !pk) return;
    const c = n[ck] ? { ...n[ck], pags: { ...n[ck].pags } } : { cli, pags: {} };
    const prev = c.pags[pk] || { nombre: pag, veces: 0, ultimo: "", refs: [] };
    const refs = prev.refs || [];
    if (ref && refs.includes(ref)) return;
    const nr = ref ? [...refs, ref].slice(-80) : refs;
    c.pags[pk] = { nombre: prev.nombre || pag, veces: ref ? Math.max(vecesDe(nr), refs.length ? 0 : prev.veces) : prev.veces + 1, ultimo: (fecha && fecha > (prev.ultimo || "")) ? fecha : prev.ultimo, refs: nr };
    n[ck] = c; cambio = true;
  });
  return cambio ? n : mem;
}
// olvida cobranzas (al desarmar/deshacer una conciliación); si un pagador queda sin
// ninguna, se borra de la cuenta
export function memOlvidar(mem, refs) {
  if (!refs || !refs.length) return mem;
  const n = { ...mem }; let cambio = false;
  Object.keys(n).forEach((ck) => {
    const pags = { ...n[ck].pags };
    Object.keys(pags).forEach((pk) => {
      const r = pags[pk].refs || [];
      const cob = (x) => x.split("@")[0];
      if (!r.some((x) => refs.includes(cob(x)))) return;
      const nr = r.filter((x) => !refs.includes(cob(x))); cambio = true;
      if (!nr.length) delete pags[pk]; else pags[pk] = { ...pags[pk], refs: nr, veces: vecesDe(nr) };
    });
    n[ck] = { ...n[ck], pags };
  });
  return cambio ? n : mem;
}

// FIFO: reparte lo cobrado sobre las facturas (más viejas primero) → estado por factura
export function estadosFIFO(fact, cobradoTotal) {
  let rest = cobradoTotal;
  return fact.map((f) => {
    const cub = Math.max(0, Math.min(f.total, rest)); rest -= cub;
    const saldo = f.total - cub;
    return { ...f, saldo, estado: saldo <= 0 ? "pagada" : (cub > 0 ? "parcial" : "impaga") };
  });
}

export function excelSerialToISO(s) {
  if (typeof s === "number") { const d = new Date(Math.round((s - 25569) * 86400 * 1000)); return d.toISOString().slice(0, 10); }
  const str = String(s); const m = str.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  const dmy = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (dmy) return dmy[3] + "-" + dmy[2].padStart(2,"0") + "-" + dmy[1].padStart(2,"0");
  return str.slice(0, 10);
}
// HORA del informe 22: viene como fracción de día (0.475 = 11:24) o como texto "hh:mm"
export function horaExcel(v) {
  if (v === "" || v == null) return "";
  const n = parseFloat(v);
  if (!isNaN(n) && n >= 0 && n < 1) {
    const mins = Math.round(n * 1440), hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, "0") + ":" + m[2] : "";
}

export function useBrandFonts() {
  React.useEffect(() => {
    const id = "lazarillo-brand-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Archivo:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

// Carga SheetJS (XLSX) solo si el proyecto no lo tiene ya. Devuelve true cuando
// window.XLSX está disponible, para no bloquear la lectura de archivos.
export function useSheetJS() {
  const [ready, setReady] = React.useState(typeof window !== "undefined" && !!window.XLSX);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // El settlement de Mercado Pago tira warnings "Bad uncompressed size" que no
    // rompen la lectura. Los silenciamos para no confundir.
    const _err = console.error, _warn = console.warn;
    const noisy = (m) => typeof m === "string" && m.indexOf("Bad uncompressed size") >= 0;
    console.error = function (...a) { if (noisy(a[0])) return; _err.apply(console, a); };
    console.warn = function (...a) { if (noisy(a[0])) return; _warn.apply(console, a); };

    if (window.XLSX) { setReady(true); return; }
    // Lazarillo (14/11): la app ya trae SheetJS (paquete "xlsx"); se carga de ahí, no del CDN.
    import("xlsx").then((m) => { window.XLSX = m.default && m.default.utils ? m.default : m; setReady(true); })
      .catch(() => setReady(false));
  }, []);
  return ready;
}

// ─── Parsers (misma lógica validada del prototipo) ──────────────────
// Ventas del informe 22 con cliente asignado = movimientos de la cuenta del cliente.
// Guardamos el medio de cobro: las de CTA CTE son débito a cobrar; las de contado
// (efectivo/MP) ya están pagas.
export function parseFacturasCC(rows) {
  const out = [];
  (rows || []).forEach((r, i) => {
    const cli = String(r["CLINOMBRE"] || "").trim();
    if (!cli) return;
    if (/^NC/i.test(String(r["COMPROBANT"] || "").trim())) return; // notas de crédito = anulaciones
    const total = Math.round(Number(String(r["TOTAL"] || r["IMPORTE"] || 0).replace(/[^\d.-]/g, "")) || 0);
    if (!total) return;
    const cu = String(r["COBRO"] || "").toUpperCase();
    const c = (cu.includes("CTA") || cu.includes("CORRIENTE")) ? "cc" : (cu.includes("EFECTIVO") ? "efec" : (cu.includes("MERCADOPAGO") ? "mp" : "otro"));
    out.push({ id: "f" + i, cli, comp: String(r["COMPROBANT"] || "").trim(), total, fecha: excelSerialToISO(r["FECHA"]), hora: horaExcel(r["HORA"]), c });
  });
  return out;
}
// Guardan TODOS los campos útiles de cada fuente (aunque no siempre se
// muestren), para poder ofrecerlos como columnas opcionales.
export function parseVentas(rows) {
  const EXCL = ["EFECTIVO", "CTA CTE", "CUENTA CORRIENTE"];
  const out = [];
  rows.forEach((r, i) => {
    const cobro = String(r["COBRO"] || "").trim().toUpperCase();
    const imp = Math.abs(parseFloat(r["IMPORTE"]) || 0);
    if (!cobro || !imp) return;
    if (EXCL.some((e) => cobro.includes(e))) return;
    if (/^NC/i.test(String(r["COMPROBANT"] || "").trim())) return; // notas de crédito = anulaciones, no van a conciliar
    out.push({
      id: "v" + i, origen: "pos", status: "pend", matchedWith: [],
      // comunes
      fecha: excelSerialToISO(r["FECHA"]), imp: Math.round(imp),
      cliente: String(r["CLINOMBRE"] || "").trim(), comp: String(r["COMPROBANT"] || "").trim(),
      hora: horaExcel(r["HORA"]),
      // específicos de Venta Detallada (22)
      cobro, // forma de cobro (MERCADOPAGO, etc.)
      turno: String(r["TURNO"] || "").trim(),
      mesa: String(r["MESA"] || "").trim(),
      mozo: String(r["MOZO"] || "").trim(),
      cub: r["CUB"] || "",
      cupon: String(r["CUPON"] || "").trim(),
      descuento: parseFloat(r["DESCUENTO"]) || 0,
      cuit: String(r["CLICUIT"] || "").trim(),
      sucursal: String(r["NOMBRESUC"] || "").trim(),
    });
  });
  return out;
}

// Cobranzas de cuenta corriente — informe 72 (CTA CTE POR COMPROBANTE).
// Trae la FORMA DE COBRO (columna COBRANZA), a diferencia del 71. Viene en filas
// pareadas: una fila factura (sin cobranza) + una fila cobranza (con forma e importe).
// Se toman SOLO las filas de cobranza cobradas por MERCADOPAGO, que son las que
// entran al settlement de MP. Las de EFECTIVO / BANCO GALICIA / RETIROS nunca tocan
// el banco MP y se excluyen (Galicia irá contra su propio extracto en el futuro).
// forma de cobro del 72: solo MercadoPago se busca en el banco MP; Galicia en su banco
// (todavía no cargado); efectivo y retiros no pasan por banco.
export const esMP = (p) => /MERCADO\s*PAGO/i.test((p && p.cobro) || "");
export const esGalicia = (p) => /GALICIA/i.test((p && p.cobro) || "");
export function parsePagos(rows) {
  const out = [];
  rows.forEach((r, i) => {
    const forma = String(r["COBRANZA"] || "").trim();
    const imp = Math.abs(parseFloat(r["IMPORTE"]) || 0);
    if (!forma || !imp) return;                       // filas de factura (sin cobranza)
    const fechaCob = r["FECHACOB"];
    if (!fechaCob) return;
    out.push({
      id: "p" + i, origen: "cc", status: "pend", matchedWith: [],
      // comunes
      fecha: excelSerialToISO(fechaCob), imp: Math.round(imp),
      cliente: String(r["NOMCLI"] || "").trim(), comp: String(r["COMPROBANT"] || "").trim(),
      cobro: forma.toUpperCase(), // MERCADOPAGO / BANCO GALICIA / EFECTIVO / RETIROS
      // específicos de Cta cte por comprobante (72)
      fechaFact: excelSerialToISO(r["FECHA"]),
      codCli: String(r["COD_CLI"] || "").trim(),
    });
  });
  return out;
}

export function parseBanco(rows) {
  const out = [];
  rows.forEach((r, i) => {
    const op = String(r["TIPO DE OPERACIÓN"] || r["TIPO DE OPERACION"] || "").trim();
    const val = parseFloat(r["VALOR DE LA COMPRA"]) || 0;
    // Solo INGRESOS: "Pago aprobado" con valor POSITIVO. Los valores negativos
    // son egresos (retiros/transferencias que hace el propio negocio) que a
    // veces vienen marcados como pago aprobado — no van a la conciliación.
    if (op !== "Pago aprobado" || val <= 0) return;
    const pagador = String(r["PAGADOR"] || "").trim();
    const medioPago = String(r["MEDIO DE PAGO"] || "").trim();
    // rendimientos de MP: "Pago aprobado" positivo pero SIN pagador y SIN medio → no es
    // una venta (es interés sobre el saldo). Los PAYOUTS e impuestos ya caen por val<=0.
    if (!pagador && !medioPago) return;
    const ts = String(r["FECHA DE ORIGEN"] || "");
    const horaM = ts.match(/T(\d{2}:\d{2})/);
    out.push({ id: "b" + i, fecha: excelSerialToISO(ts), ts, hora: horaM ? horaM[1] : "", imp: Math.round(val),
      medio: String(r["MEDIO DE PAGO"] || "").trim(), tipoMedio: String(r["TIPO DE MEDIO DE PAGO"] || "").trim(),
      tipDesc: /tips|propina/i.test(String(r["MEDIO DE PAGO"] || "") + " " + String(r["TIPO DE MEDIO DE PAGO"] || "") + " " + String(r["DESCRIPCIÓN"] || r["DESCRIPCION"] || "")),
      cliente: String(r["PAGADOR"] || "").trim(), status: "pend", matchedWith: null });
  });
  out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  out.forEach((b, i) => (b.ord = i));
  return out;
}

// ─── Match: 2 pasos (1-a-1 exacto, luego N-a-1 iguales/consecutivos) ──
export function conciliar(ingresos, banco, tolDias, autoVal = 0, autoTipo = "pct") {
  const V = ingresos.map((v) => ({ ...v, status: "pend", matchedWith: [], matchTipo: null }));
  const B = banco.map((b) => ({ ...b, status: "pend", matchedWith: null }));
  const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
  // margen de conciliación automática: tolerancia de importe (0 = solo exactas)
  const tolDe = (base) => autoTipo === "pct" ? Math.round(Math.abs(base) * autoVal / 100) : autoVal;

  function tipoGrupo(grupo) {
    const primero = grupo[0].imp;
    if (grupo.every((g) => g.imp === primero)) return "iguales";
    // Consecutivos: contiguos en el orden (ord seguidos) + ventana temporal razonable
    // (misma tanda). La variante "por tiempo" (no contiguo) se probó y bajaba el total
    // de conciliados: las combos chicas consumían movimientos y bloqueaban matches mejores.
    const orden = grupo.slice().sort((a, b) => a.ord - b.ord);
    let contig = true;
    for (let k = 1; k < orden.length; k++) if (orden[k].ord !== orden[k - 1].ord + 1) { contig = false; break; }
    if (!contig) return null;
    const t0 = new Date(orden[0].ts).getTime(), tN = new Date(orden[orden.length - 1].ts).getTime();
    if (isFinite(t0) && isFinite(tN) && Math.abs(tN - t0) / 60000 > 15) return null;
    return "consecutivos";
  }

  // Paso 0: POR CUPÓN (Diego 14/11/2026: «es una key clave, en todos los PDV y negocios»).
  // El cupón que se carga en MaxiRest (informe 22) es el Nº de operación de Mercado Pago recortado
  // a 10 dígitos: los primeros 9 y el último (Container Bar oct–nov: 1.256 de 1.272 coinciden).
  // Se concilia solo si además coincide el importe: la venta (o las ventas con el mismo cupón,
  // un pago que cubre varios tickets) suman lo que entró, dentro del margen. Fecha hasta 31 días
  // (el 22 lleva la fecha del turno). Si el cupón coincide pero el importe no, queda pendiente.
  const claveCupon = (id) => {
    const t = String(id ?? "").replace(/\D/g, "");
    return t.length > 10 ? t.slice(0, 9) + t.slice(-1) : t;
  };
  const bPorCupon = {};
  B.forEach((b, i) => {
    if (b.mpId == null) return;
    const full = String(b.mpId).replace(/\D/g, "");
    if (full.length < 7) return;
    bPorCupon[claveCupon(full)] = i;
    bPorCupon[full] = i;
  });
  const vPorCupon = {};
  V.forEach((v) => {
    const c = String(v.cupon || "").replace(/\D/g, "");
    if (c.length >= 7 && bPorCupon[c] != null) (vPorCupon[c] = vPorCupon[c] || []).push(v);
  });
  Object.entries(vPorCupon).forEach(([c, items]) => {
    const b = B[bPorCupon[c]];
    if (!b || b.status !== "pend") return;
    const libres = items.filter((v) => v.status === "pend" && dayDiff(b.fecha, v.fecha) <= 31);
    if (!libres.length) return;
    const total = libres.reduce((a, v) => a + v.imp, 0);
    const d = Math.abs(b.imp - total);
    if (d > tolDe(total)) return;
    libres.forEach((v) => { v.status = "ok"; v.matchedWith = [b.id]; v.matchTipo = "cupon"; if (d && libres.length === 1) v.autoDif = d; });
    b.status = "ok"; b.matchedWith = libres[0].id; b.matchTipo = "cupon";
  });

  V.forEach((v) => {
    if (v.status !== "pend") return;
    const tol = tolDe(v.imp);
    let best = -1, bestD = Infinity;
    B.forEach((b, i) => {
      if (b.status !== "pend" || dayDiff(b.fecha, v.fecha) > tolDias) return;
      const d = Math.abs(b.imp - v.imp);
      if (d <= tol && d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) { B[best].status = "ok"; B[best].matchedWith = v.id; v.status = "ok"; v.matchedWith = [B[best].id]; v.matchTipo = "uno"; if (bestD) v.autoDif = bestD; }
  });
  V.forEach((v) => {
    if (v.status === "ok") return;
    const tol = tolDe(v.imp);
    const cand = B.filter((b) => b.status === "pend" && dayDiff(b.fecha, v.fecha) <= tolDias).sort((a, b) => a.ord - b.ord);
    let grupo = null, grupoTipo = null, grupoBase = 0;
    // N movimientos IGUALES (o MÚLTIPLOS del mismo base) cuyo total dé el ingreso.
    // Ej: 5×21.420 + 1×42.840 (=2×21.420) = 7×21.420 ≈ ingreso. Cada múltiplo cuenta
    // como N unidades del importe base; se busca el subconjunto que sume las unidades.
    const conteo = {};
    cand.forEach((c) => { conteo[c.imp] = (conteo[c.imp] || 0) + 1; });
    const amounts = [...new Set(cand.map((c) => c.imp))].filter((b) => conteo[b] >= 3).sort((a, b) => a - b);
    for (const base of amounts) {
      const muls = cand.filter((c) => c.imp % base === 0);
      if (muls.length < 2) continue;
      const U = Math.round(v.imp / base);
      if (U < 2 || Math.abs(U * base - v.imp) > tol) continue;
      // subset-sum sobre unidades (imp/base) que sumen U (0/1 por movimiento)
      let reach = { 0: [] };
      for (const it of muls) {
        const u = it.imp / base;
        for (const su of Object.keys(reach)) {
          const ns = Number(su) + u;
          if (ns <= U && !reach[ns]) reach[ns] = reach[su].concat(it);
        }
        if (reach[U]) break;
      }
      if (reach[U] && reach[U].length >= 2) { grupo = reach[U]; grupoTipo = "iguales"; grupoBase = base; break; }
    }
    // Búsqueda de combinaciones de 2 o 3 (importes distintos, consecutivos)
    if (!grupo)
      for (let a = 0; a < cand.length && !grupo; a++)
        for (let b = a + 1; b < cand.length && !grupo; b++)
          if (Math.abs(cand[a].imp + cand[b].imp - v.imp) <= tol) { const g = [cand[a], cand[b]]; if (tipoGrupo(g)) grupo = g; }
    if (!grupo)
      for (let a = 0; a < cand.length && !grupo; a++)
        for (let b = a + 1; b < cand.length && !grupo; b++)
          for (let c = b + 1; c < cand.length && !grupo; c++)
            if (Math.abs(cand[a].imp + cand[b].imp + cand[c].imp - v.imp) <= tol) { const g = [cand[a], cand[b], cand[c]]; if (tipoGrupo(g)) grupo = g; }
    if (grupo) {
      const tipo = grupoTipo || tipoGrupo(grupo);
      grupo.forEach((x) => {
        x.status = "ok"; x.matchedWith = v.id;
        if (grupoBase) { const u = Math.round(x.imp / grupoBase); x.serieMult = u;
          x.serieNota = u > 1
            ? "Entró a la serie como " + u + "× " + fmt(grupoBase) + " (grupo de ≥3 iguales que suman el ingreso)"
            : "Serie de " + grupo.length + " movimientos de " + fmt(grupoBase) + " (≥3 iguales) que suman el ingreso"; }
      });
      v.status = "ok"; v.matchedWith = grupo.map((g) => g.id); v.matchTipo = tipo;
    }
  });

  // Paso 3: grupos por CLIENTE + FECHA cuya suma dé un movimiento ÚNICO del banco.
  // Sobre lo que quedó pendiente: agrupa ingresos del mismo cliente y día; si el
  // total del grupo (>=2 items) coincide con un solo movimiento de banco pendiente
  // (fecha ±tol), se concilia el grupo entero contra ese único movimiento.
  // El match es siempre por IMPORTE; el cliente+fecha solo decide qué agrupar.
  const pendCli = V.filter((v) => v.status === "pend" && cliKey(v.cliente));
  const grupos = {};
  pendCli.forEach((v) => { const k = cliKey(v.cliente) + "|" + v.fecha; (grupos[k] = grupos[k] || []).push(v); });
  Object.values(grupos).forEach((items) => {
    if (items.length < 2) return;
    const total = items.reduce((a, v) => a + v.imp, 0);
    const bi = B.findIndex((b) => b.status === "pend" && Math.abs(b.imp - total) <= tolDe(total) && dayDiff(b.fecha, items[0].fecha) <= tolDias);
    if (bi < 0) return;
    const b = B[bi];
    const ingIds = items.map((v) => v.id);
    items.forEach((v) => { v.status = "ok"; v.matchedWith = [b.id]; v.matchTipo = "cliente"; });
    b.status = "ok"; b.matchedWith = ingIds[0]; b.matchTipo = "cliente";
  });

  // Paso 4 (ÚLTIMO): 2 ingresos cualesquiera de la MISMA fecha cuya suma dé exacto
  // un movimiento único del banco. Corre después de todas las demás reglas, así que
  // todo lo resoluble por cliente / N-iguales / 1-a-1 ya se cruzó antes; esto barre
  // los pares que quedaron sueltos (anónimos, mixtos, restos). Solo suma EXACTA (dif 0).
  const restoPend = V.filter((v) => v.status === "pend");
  const restoPorFecha = {};
  restoPend.forEach((v) => { (restoPorFecha[v.fecha] = restoPorFecha[v.fecha] || []).push(v); });
  Object.values(restoPorFecha).forEach((items) => {
    const arr = items.slice().sort((a, b) => a.ord - b.ord);
    for (let a = 0; a < arr.length; a++) {
      if (arr[a].status !== "pend") continue;
      for (let c = a + 1; c < arr.length; c++) {
        if (arr[c].status !== "pend") continue;
        const total = arr[a].imp + arr[c].imp;
        const bi = B.findIndex((bk) => bk.status === "pend" && Math.abs(bk.imp - total) <= tolDe(total) && dayDiff(bk.fecha, arr[a].fecha) <= tolDias);
        if (bi < 0) continue;
        const bk = B[bi];
        arr[a].status = "ok"; arr[a].matchedWith = [bk.id]; arr[a].matchTipo = "combinado";
        arr[c].status = "ok"; arr[c].matchedWith = [bk.id]; arr[c].matchTipo = "combinado";
        bk.status = "ok"; bk.matchedWith = arr[a].id; bk.matchTipo = "combinado";
        break;
      }
    }
  });

  // Paso 5 (ÚLTIMO): CONSECUTIVOS POR HORA. Sobre lo que quedó pendiente, buscar un
  // subconjunto de movimientos de banco dentro de una MISMA TANDA (ventana de tiempo
  // corta) que sume el ingreso dentro del margen. Corre al final para no bloquear los
  // matches mejores; respeta el margen configurado (tolDe).
  const VENTANA_MIN = 5;
  // subset-sum meet-in-the-middle: subconjunto (≥3) que sume ~target dentro de tol,
  // prefiriendo el de menor diferencia y, a igualdad, más movimientos.
  const subsetTanda = (items, target, tol) => {
    const half = Math.floor(items.length / 2);
    const enumSub = (arr) => {
      const res = [];
      for (let mask = 0; mask < (1 << arr.length); mask++) {
        let s = 0; const it = [];
        for (let k = 0; k < arr.length; k++) if (mask & (1 << k)) { s += arr[k].imp; it.push(arr[k]); }
        res.push({ sum: s, it });
      }
      return res;
    };
    const A = enumSub(items.slice(0, half));
    const Bx = enumSub(items.slice(half)).sort((x, y) => x.sum - y.sum);
    const sums = Bx.map((x) => x.sum);
    let best = null;
    for (const a of A) {
      const lo = target - a.sum - tol, hi = target - a.sum + tol;
      let l = 0, r = sums.length; while (l < r) { const m = (l + r) >> 1; if (sums[m] < lo) l = m + 1; else r = m; }
      for (let k = l; k < Bx.length && sums[k] <= hi; k++) {
        const comb = a.it.concat(Bx[k].it);
        if (comb.length < 3) continue;
        const diff = Math.abs(a.sum + Bx[k].sum - target);
        if (!best || diff < best.diff || (diff === best.diff && comb.length > best.comb.length)) best = { comb, diff };
      }
    }
    return best && best.comb;
  };
  // agrupar los pendientes de banco en TANDAS disjuntas (gap de tiempo entre
  // adyacentes <= VENTANA_MIN). Se arma una vez; después cada ingreso prueba las tandas.
  const pendBan5 = B.filter((b) => b.status === "pend" && b.ts).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const tandas = []; let cur = [];
  for (let i = 0; i < pendBan5.length; i++) {
    if (cur.length && (new Date(pendBan5[i].ts) - new Date(cur[cur.length - 1].ts)) / 60000 > VENTANA_MIN) { tandas.push(cur); cur = []; }
    cur.push(pendBan5[i]);
  }
  if (cur.length) tandas.push(cur);
  V.filter((v) => v.status === "pend").forEach((v) => {
    if (v.status !== "pend") return;
    const tol = tolDe(v.imp);
    for (const tanda of tandas) {
      if (v.status !== "pend") break;
      const disp = tanda.filter((b) => b.status === "pend" && dayDiff(b.fecha, v.fecha) <= tolDias);
      if (disp.length < 3 || disp.length > 22) continue;
      if (disp.reduce((a, b) => a + b.imp, 0) < v.imp - tol) continue; // la tanda no alcanza
      const sub = subsetTanda(disp, v.imp, tol);
      if (sub && sub.length >= 3) {
        sub.forEach((x) => { x.status = "ok"; x.matchedWith = v.id; x.matchTipo = "consecutivos"; x.porHora = true; });
        v.status = "ok"; v.matchedWith = sub.map((g) => g.id); v.matchTipo = "consecutivos"; v.porHora = true;
        break;
      }
    }
  });

  return { V, B };
}

// ─── Configuración de las 3 fuentes (con instructivo) ───────────────
export const FUENTES = [
  {
    key: "ventas", titulo: "Ventas detalladas", subtitulo: "Informe 22 · ventas no efectivo",
    emoji: "\\uD83E\\uDDFE", parser: parseVentas,
    // columnas imprescindibles para conciliar (cada entrada acepta alternativas de nombre)
    reqCols: [["IMPORTE"], ["FECHA"], ["COBRO"]],
    instructivo: {
      titulo: "Ventas detalladas (informe 22)",
      pasos: [
        { n: 1, h: "Abrí el informe", path: "Ventas › Informes › Ventas detallada",
          p: "Desde el menú lateral de MaxiRest, entrá a Ventas, después Informes y elegí “Ventas detallada”.", img: INSTR_VD },
        { n: 2, h: "Configurá el informe", items: [
            { t: "ok", s: "Tildá Fecha y elegí el período que querés conciliar" },
            { t: "ok", s: "Modalidad: Extendido" },
            { t: "warn", s: "Dejá For.cobro en Todas (no filtres formas de cobro)" },
            { t: "warn", s: "Asegurate de que no haya otros filtros aplicados" },
          ] },
        { n: 3, h: "Exportá a Excel", p: "En Salida por, hacé clic en el botón de Excel. Se descarga el archivo listo para subir acá." },
      ],
    },
  },
  {
    key: "pagos", titulo: "Cobranzas de cuenta corriente", subtitulo: "Informe 72 · cta cte por comprobante",
    emoji: "\\uD83D\\uDCB3", parser: parsePagos,
    nota: "Este informe trae la forma de cobro. Solo se usan las cobranzas MercadoPago (las que entran al banco MP).",
    reqCols: [["COBRANZA"], ["FECHACOB"], ["IMPORTE"]],
    // si el archivo trae estas columnas, es el informe VIEJO ("Cobranzas por
    // comprobante", informe 71) que NO trae la forma de cobro → aviso específico
    informeEquivocado: {
      señales: ["FECHACOBRO", "NOMBRE"],
      correcto: "Cta cte por comprobante",
      bajado: "Cobranzas por comprobante",
    },
    instructivo: {
      titulo: "Cobranzas de cuenta corriente (informe 72)",
      pasos: [
        { n: 1, h: "Abrí el informe", path: "Ventas › Informe de cuentas corrientes",
          p: "En MaxiRest entrá a Ventas y elegí “Informe de cuentas corrientes”. Se abre la ventana “Informes de clientes”.", img: INSTR_CC },
        { n: 2, h: "Elegí el informe correcto", items: [
            { t: "ok", s: "En Informe (arriba a la derecha), seleccioná “Cta. Cte. por comprobante”" },
            { t: "ok", s: "El Detalle debe decir “…ordenados por comprobante con su correspondiente cobranza” (ese trae la forma de cobro)" },
            { t: "warn", s: "OJO: “Cobranzas por comprobante” es otro informe y NO trae la forma de cobro — no sirve" },
          ] },
        { n: 3, h: "Configurá el período", items: [
            { t: "ok", s: "Tildá Fecha y elegí el rango que querés conciliar" },
            { t: "ok", s: "En Modalidad, dejá Clientes en “Todos”" },
            { t: "warn", s: "No apliques otros filtros (Forma cob., Comprob., etc.)" },
          ] },
        { n: 4, h: "Exportá a Excel", p: "En “Salida por”, hacé clic en el ícono verde de Excel. Se descarga el archivo listo para subir acá." },
      ],
    },
  },
  {
    key: "banco", titulo: "Movimientos del banco", subtitulo: "Settlement / extracto (Mercado Pago)",
    nota: "Necesita las columnas: Tipo de operación · Valor de la compra · Fecha de origen. No importa el orden en que vengan.",
    emoji: "\\uD83C\\uDFE6", parser: parseBanco,
    reqCols: [["TIPO DE OPERACIÓN", "TIPO DE OPERACION"], ["VALOR DE LA COMPRA"], ["FECHA DE ORIGEN"]],
    instructivo: {
      titulo: "Movimientos del banco (Mercado Pago)",
      pasos: [
        { n: 1, h: "Abrí las transacciones", path: "Reportes › Todas las transacciones",
          p: "En Mercado Pago, entrá a Reportes y andá a “Todas las transacciones”.", img: INSTR_BANCO },
        { n: 2, h: "Configurá las columnas", items: [
            { t: "ok", s: "Hacé clic en Configurar y elegí las columnas que necesitamos" },
            { t: "ok", s: "Si tenés dudas, ponelas todas: mejor que sobren y no que falten" },
          ] },
        { n: 3, h: "Creá el reporte", items: [
            { t: "ok", s: "Hacé clic en Crear reporte y elegí la opción Manual" },
            { t: "ok", s: "Seleccioná el período que querés conciliar" },
          ] },
        { n: 4, h: "Bajá el archivo", p: "Descargá el reporte en formato .xlsx y subilo acá." },
      ],
    },
  },
];

// ─── Definición de columnas (para el selector) ──────────────────────
// key: campo del objeto · label: encabezado · w: ancho fijo (0/undef = flex)
// fixed: siempre visible · sortable: se puede ordenar · align: 'right'
// group: para agrupar en el menú (solo ingresos)
// only: 'pos' | 'cc' → la columna solo aplica a esa fuente (muestra — en la otra)
export const COLS_BANCO = [
  { key: "fecha", label: "Fecha de pago", w: 90, fixed: true, sortable: true },
  { key: "hora", label: "Hora", w: 50, fixed: true, sortable: true },
  { key: "cliente", label: "Pagador", flex: true, fixed: true, sortable: true },
  { key: "imp", label: "Importe", w: 100, align: "right", fixed: true, sortable: true },
  { key: "tipoMedio", label: "Tipo de medio", w: 130, sortable: true },
  { key: "medio", label: "Descripción", w: 130, sortable: true },
];
export const COLS_INGRESOS = [
  { key: "fecha", label: "Fecha de pago", w: 72, fixed: true, sortable: true, group: "Comunes" },
  { key: "hora", label: "Hora", w: 50, fixed: true, sortable: true, group: "Comunes" },
  { key: "fechaFact", label: "Fecha de factura", w: 76, fixed: true, sortable: true, group: "Comunes" },
  { key: "cliente", label: "Cliente", flex: true, fixed: true, sortable: true, group: "Comunes" },
  { key: "imp", label: "Importe", w: 88, align: "right", fixed: true, sortable: true, group: "Comunes" },
  { key: "comp", label: "Comprobante", w: 130, sortable: true, group: "Comunes" },
  { key: "origenLbl", label: "Origen", w: 54, group: "Comunes" },
  // Venta Detallada (22)
  { key: "cobro", label: "Forma de cobro", w: 100, only: "pos", group: "Venta Detallada" },
  { key: "turno", label: "Turno", w: 56, only: "pos", group: "Venta Detallada" },
  { key: "mesa", label: "Mesa", w: 44, only: "pos", group: "Venta Detallada" },
  { key: "mozo", label: "Mozo", w: 88, only: "pos", group: "Venta Detallada" },
  { key: "cub", label: "Cub.", w: 44, only: "pos", align: "right", group: "Venta Detallada" },
  { key: "cupon", label: "Cupón", w: 88, only: "pos", group: "Venta Detallada" },
  // Cobranzas CC (71)
  { key: "codCli", label: "Cód. cliente", w: 76, only: "cc", group: "Cobranzas CC" },
];
// En la vista por día COMPARTIDA (dos tablas al medio) hay menos ancho por lado,
// así que se ocultan las columnas menos críticas. Se pueden ver igual en las vistas
// Todas/Conciliadas (tablas completas) o con la lista en pendientes.
export const HIDE_ING_COMPARTIDO = new Set(["fechaFact", "mesa"]);
export const HIDE_BAN_COMPARTIDO = new Set(["medio", "tipoMedio"]);
