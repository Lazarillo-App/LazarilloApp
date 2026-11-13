/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps -- módulo de Diego: se integró sin tocar su lógica (14/11/2026) */
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
const C = {
  noche: "#12111F", tinta: "#15213E", celeste: "#5BC2EA", celesteDeep: "#2492C8",
  paper: "#F2F4F7", white: "#ffffff",
  line: "rgba(21,33,62,.10)", line2: "rgba(21,33,62,.16)",
  txt: "#15213E", txt2: "#5b6577", txt3: "#8a93a3",
  green: "#1a9c6e", greenBg: "#1a9c6e14", amber: "#c77d08", amberBg: "#f59e0b16",
  red: "#d94f63",
};

const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];


// ─── Helpers ────────────────────────────────────────────────────────
const fmt = (n) => "$" + Math.round(n).toLocaleString("es-AR");
// Fecha ISO (YYYY-MM-DD) → dd-mm-yy para mostrar en las tablas
const fmtFecha = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "-" + m[2] + "-" + m[1].slice(2) : String(iso || ""); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));
// Normaliza nombre de cliente para agrupar (minúsculas, sin acentos, sin "na", sin puntuación)
const normCli = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\bna\b/g, "").replace(/[^a-z0-9 ]/g, " ")
  .replace(/\s+/g, " ").trim();
// Clave de agrupación por cliente: primeros 2 tokens del nombre normalizado.
// Tolera diferencias de sufijo entre el 22 y el 71 (ej. "Guccione Cristina" vs
// "Guccione Cristina CRISTINA" agrupan igual).
// El 22 a veces repite el nombre ("chueco chueco", "Oscar Oscar", "SALINAS MATIAS
// MATIAS"): se colapsan las mitades iguales y las palabras repetidas seguidas, así
// "chueco chueco" (ventas) y "chueco" (cobranzas) son la misma cuenta.
const cliKey = (s) => {
  let w = normCli(s).split(" ").filter(Boolean);
  if (w.length >= 2 && w.length % 2 === 0 && w.slice(0, w.length / 2).join(" ") === w.slice(w.length / 2).join(" ")) w = w.slice(0, w.length / 2);
  w = w.filter((t, i) => i === 0 || t !== w[i - 1]);
  return w.slice(0, 2).join(" ");
};
// ¿coinciden el cliente del ingreso y el pagador del banco? (comparte algún token
// significativo de ≥3 letras). Mismo pagador = conciliación mucho más probable.
const pagadorCoincide = (a, b) => {
  const ta = normCli(a).split(" ").filter((t) => t.length >= 3);
  const tb = normCli(b).split(" ").filter((t) => t.length >= 3);
  return ta.length > 0 && tb.length > 0 && ta.some((t) => tb.includes(t));
};
// Conciliación AUTOMÁTICA de cobranzas de CUENTA CORRIENTE — solo el caso seguro:
// importe EXACTO + MISMO DÍA + el pagador del banco coincide con el cliente (por nombre
// o por el mapa aprendido). Corre DESPUÉS del motor de ventas (las ventas tienen
// prioridad sobre el banco) y puede juntar hasta 4 cobranzas del mismo cliente contra
// un pago. Lo que no cumple las tres condiciones queda como sugerencia.
function autoConciliarCC(res, pagos, conoce) {
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
function memDesdeProp(m) {
  if (!m || typeof m !== "object") return {};
  const vals = Object.values(m);
  if (vals.length && typeof vals[0] === "object" && vals[0] && vals[0].pags) return m;
  const out = {};
  Object.keys(m).forEach((pag) => { const cli = m[pag]; if (!cli) return; (out[cli] = out[cli] || { cli, pags: {} }).pags[pag] = { nombre: pag, veces: 1, ultimo: "" }; });
  return out;
}
const refCob = (x) => (x.fecha || "") + "|" + (x.imp || 0) + "|" + (x.comp || "");
const refBan = (b) => (b.fecha || "") + "|" + (b.imp || 0) + "|" + (b.hora || "");
// "veces" = pagos de banco distintos (un pago puede cubrir varias cobranzas)
const vecesDe = (refs) => new Set(refs.map((r) => r.split("@")[1] || r)).size;
// cuenta cada cobranza UNA sola vez (por su referencia), así recalcular no infla las veces
function memRegistrar(mem, pares) {
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
function memOlvidar(mem, refs) {
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
function estadosFIFO(fact, cobradoTotal) {
  let rest = cobradoTotal;
  return fact.map((f) => {
    const cub = Math.max(0, Math.min(f.total, rest)); rest -= cub;
    const saldo = f.total - cub;
    return { ...f, saldo, estado: saldo <= 0 ? "pagada" : (cub > 0 ? "parcial" : "impaga") };
  });
}

function excelSerialToISO(s) {
  if (typeof s === "number") { const d = new Date(Math.round((s - 25569) * 86400 * 1000)); return d.toISOString().slice(0, 10); }
  const str = String(s); const m = str.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  const dmy = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (dmy) return dmy[3] + "-" + dmy[2].padStart(2,"0") + "-" + dmy[1].padStart(2,"0");
  return str.slice(0, 10);
}
// HORA del informe 22: viene como fracción de día (0.475 = 11:24) o como texto "hh:mm"
function horaExcel(v) {
  if (v === "" || v == null) return "";
  const n = parseFloat(v);
  if (!isNaN(n) && n >= 0 && n < 1) {
    const mins = Math.round(n * 1440), hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2, "0") + ":" + m[2] : "";
}

function useBrandFonts() {
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
function useSheetJS() {
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
function parseFacturasCC(rows) {
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
function parseVentas(rows) {
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
const esMP = (p) => /MERCADO\s*PAGO/i.test((p && p.cobro) || "");
const esGalicia = (p) => /GALICIA/i.test((p && p.cobro) || "");
function parsePagos(rows) {
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

function parseBanco(rows) {
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
function conciliar(ingresos, banco, tolDias, autoVal = 0, autoTipo = "pct") {
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

  V.forEach((v) => {
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
const FUENTES = [
  {
    key: "ventas", titulo: "Ventas detalladas", subtitulo: "Informe 22 · ventas no efectivo",
    emoji: "\uD83E\uDDFE", parser: parseVentas,
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
    emoji: "\uD83D\uDCB3", parser: parsePagos,
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
    emoji: "\uD83C\uDFE6", parser: parseBanco,
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
const COLS_BANCO = [
  { key: "fecha", label: "Fecha de pago", w: 90, fixed: true, sortable: true },
  { key: "hora", label: "Hora", w: 50, fixed: true, sortable: true },
  { key: "cliente", label: "Pagador", flex: true, fixed: true, sortable: true },
  { key: "imp", label: "Importe", w: 100, align: "right", fixed: true, sortable: true },
  { key: "tipoMedio", label: "Tipo de medio", w: 130, sortable: true },
  { key: "medio", label: "Descripción", w: 130, sortable: true },
];
const COLS_INGRESOS = [
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
const HIDE_ING_COMPARTIDO = new Set(["fechaFact", "mesa"]);
const HIDE_BAN_COMPARTIDO = new Set(["medio", "tipoMedio"]);

// Cabecera de grupo "Cuenta corriente" en las listas de Todas / Conciliadas
function GrupoCCHead({ label, n, total, open, onToggle }) {
  return (
    <div data-keep-sel onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#7c5fd30f", position: "sticky", top: 0, zIndex: 2 }}>
      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "\u25BE" : "\u25B8"}</span>
      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: "#7c5fd3" }}>{"\uD83E\uDDFE"} {label}</span>
      <span style={{ fontSize: 11, color: C.txt3 }}>{n}</span>
      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: "#7c5fd3" }}>{fmt(total)}</span>
    </div>
  );
}

// Caja de búsqueda con lista de resultados desplegable
function BuscadorBox({ icon, placeholder, value, onChange, results, onPick, lado }) {
  const [foco, setFoco] = React.useState(false);
  const abierto = foco && value.trim().length > 0;
  const chip = (r) => {
    const m = { ok: ["Conciliado", "#1a9c6e1c", C.green], pend: ["Pendiente", "#c77d081c", C.amber], efec: ["Efectivo", "#00000010", C.txt2], cc: ["Cta. cte.", "#7c5fd31c", "#7c5fd3"] }[r.estado] || ["", "transparent", C.txt3];
    return <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: m[1], color: m[2], borderRadius: 5, padding: "2px 6px", flexShrink: 0, width: 66, textAlign: "center" }}>{m[0]}</span>;
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: "1px solid " + (foco ? C.celeste : C.line2), borderRadius: 10, padding: "7px 12px", boxShadow: foco ? "0 0 0 3px #5BC2EA22" : "none" }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)} onBlur={() => setTimeout(() => setFoco(false), 180)}
          onKeyDown={(e) => { if (e.key === "Enter" && results.length) { e.preventDefault(); onPick(results[0]); } if (e.key === "Escape") onChange(""); }}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontFamily: "'Archivo',sans-serif", fontSize: 13, color: C.txt, background: "transparent" }} />
        {value && <button onClick={() => onChange("")} title="Limpiar" style={{ border: "none", background: "transparent", color: C.txt3, cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>}
      </div>
      {abierto && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: C.white, border: "1px solid " + C.line2, borderRadius: 10, boxShadow: "0 14px 40px rgba(21,33,62,.2)", maxHeight: 340, overflowY: "auto", zIndex: 70 }}>
          <div style={{ padding: "6px 12px", fontSize: 10.5, color: C.txt3, borderBottom: "1px solid " + C.line, background: C.paper }}>
            {results.length ? results.length + (results.length === 40 ? "+ " : " ") + "resultado" + (results.length === 1 ? "" : "s") + " · Enter va al primero" : "Sin resultados"}
          </div>
          {results.map((r, i) => (
            <button key={r.tipo + (r.row.id || i)} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(r)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid " + C.line, background: C.white, padding: "7px 12px", cursor: "pointer", fontFamily: "'Archivo',sans-serif", fontSize: 12.5 }}>
              <span style={{ fontSize: 11, color: C.txt3, width: 44, flexShrink: 0 }}>{fmtFecha(r.fecha).slice(0, 5)}</span>
              <span style={{ fontSize: 11, color: C.txt3, width: 38, flexShrink: 0 }}>{r.hora || "\u2014"}</span>
              <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lado === "ing" ? <React.Fragment><b style={{ color: C.tinta, fontWeight: 600 }}>{r.comp || "\u2014"}</b>{r.nombre ? " \u00B7 " + r.nombre : ""}</React.Fragment> : (r.nombre || "\u2014")}
              </span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, flexShrink: 0 }}>{fmt(r.imp)}</span>
              {chip(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Selector de forma de pago (para corregir errores de carga)
function FormaEditor({ actual, onSet }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      <span style={{ fontSize: 11, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px" }}>Forma de pago:</span>
      {[["mp", "MercadoPago"], ["efec", "Efectivo"]].map(([k, l]) => (
        <button key={k} onClick={(e) => { e.stopPropagation(); onSet(k); }} style={{ border: "1px solid " + (actual === k ? C.celeste : C.line2), background: actual === k ? "#5BC2EA18" : C.white, color: actual === k ? C.celesteDeep : C.txt2, borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer" }}>{l}</button>
      ))}
    </div>
  );
}

// Modal de cuenta corriente de un cliente (facturas + cobranzas + saldo)
function CuentaModal({ cuenta, onClose, onQuitarPagador, diaFoco }) {
  const c = cuenta;
  // movimientos del día en que estás parado: se marcan en las dos listas y se
  // scrollea a ellos al abrir
  const refF = React.useRef(null), refC = React.useRef(null);
  // tocar un comprobante marca sus cobros (el 72 dice qué ticket paga cada cobro) y al revés
  const nComp = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
  const [selComp, setSelComp] = React.useState(null);
  const toggleComp = (comp) => setSelComp((s) => (s === nComp(comp) ? null : nComp(comp)));
  React.useEffect(() => {
    if (!selComp) return;
    [refF, refC].forEach((r) => { const cont = r.current; if (!cont) return; const el = cont.querySelector("[data-sel]"); if (el && (el.offsetTop < cont.scrollTop || el.offsetTop > cont.scrollTop + cont.clientHeight - 30)) cont.scrollTop = Math.max(0, el.offsetTop - 8); });
  }, [selComp]);
  React.useEffect(() => {
    [refF, refC].forEach((r) => {
      const cont = r.current; if (!cont) return;
      const el = cont.querySelector("[data-foco]");
      if (el) cont.scrollTop = Math.max(0, el.offsetTop - 8);
    });
  }, [diaFoco]);
  const fmtF = (d) => { if (!d) return "—"; const p = d.split("-"); return p[2] + " " + (["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(p[1]) - 1] || ""); };
  // contado (efec/MP) = pagada al momento; CTA CTE = FIFO con las cobranzas del 72.
  // El FIFO se calcula en orden cronológico; después se ordena solo para mostrar.
  let rest = c.cob72 || 0;
  const fEst = c.fact.slice().sort((a, b) => ((a.fecha || "") + (a.hora || "")).localeCompare((b.fecha || "") + (b.hora || ""))).map((f) => {
    if (f.c !== "cc") return { ...f, estado: "pagada" };
    const cub = Math.max(0, Math.min(f.total, rest)); rest -= cub;
    const saldo = f.total - cub;
    return { ...f, estado: saldo <= 0 ? "pagada" : (cub > 0 ? "parcial" : "impaga") };
  });
  const medioLbl = { cc: "CTA CTE", mp: "MP", efec: "Efvo", otro: "—" };
  // orden por títulos: por defecto lo más reciente primero
  const [sF, setSF] = React.useState({ k: "fecha", d: -1 });
  const [sC, setSC] = React.useState({ k: "fecha", d: -1 });
  const ordEst = { impaga: 0, parcial: 1, pagada: 2 };
  const valF = (f, k) => k === "fecha" ? (f.fecha || "") + (f.hora || "") : k === "comp" ? (f.comp || "") : k === "medio" ? (medioLbl[f.c] || "") : k === "imp" ? f.total : k === "estado" ? ordEst[f.estado] : "";
  const valC = (x, k) => k === "fecha" ? (x.fecha || "") : k === "medio" ? (x.medio || "") : k === "imp" ? x.imp : "";
  const cmp = (va, vb) => typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
  const listF = fEst.slice().sort((a, b) => sF.d * cmp(valF(a, sF.k), valF(b, sF.k)) || -cmp(valF(a, "fecha"), valF(b, "fecha")));
  const listC = c.cob.slice().sort((a, b) => sC.d * cmp(valC(a, sC.k), valC(b, sC.k)) || -cmp(valC(a, "fecha"), valC(b, "fecha")));
  const totImp = fEst.filter((f) => f.estado !== "pagada").length;
  const nDiaF = diaFoco ? fEst.filter((f) => f.fecha === diaFoco).length : 0;
  const nDiaC = diaFoco ? c.cob.filter((k) => k.fecha === diaFoco).length : 0;
  const marca = { background: "#5BC2EA1f", boxShadow: "inset 3px 0 0 " + C.celeste };
  const marcaSel = { background: "#1a9c6e1a", boxShadow: "inset 4px 0 0 " + C.green, outline: "1px solid #1a9c6e55", outlineOffset: -1 };
  const compSel = selComp ? fEst.find((f) => nComp(f.comp) === selComp) : null;
  const cobSel = selComp ? c.cob.filter((k) => nComp(k.paga) === selComp) : [];
  // encabezado de columna ordenable
  const Th = ({ label, k, s, set, w, right, flex }) => {
    const on = s.k === k;
    return (
      <span onClick={() => set(on ? { k, d: -s.d } : { k, d: k === "fecha" || k === "imp" ? -1 : 1 })} title={"Ordenar por " + label.toLowerCase()}
        style={{ width: w, flex: flex ? 1 : undefined, minWidth: flex ? 0 : undefined, flexShrink: 0, textAlign: right ? "right" : "left", cursor: "pointer", userSelect: "none", fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", fontWeight: 800, color: on ? C.celesteDeep : C.txt3, whiteSpace: "nowrap" }}>
        {label}{on ? (s.d > 0 ? " \u25B2" : " \u25BC") : ""}
      </span>
    );
  };
  const colHead = { display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#F7F9FB", borderBottom: "1px solid " + C.line2 };
  const titulo = { padding: "8px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", color: C.tinta, fontWeight: 800, background: "#00000006", borderBottom: "1px solid " + C.line, display: "flex", justifyContent: "space-between" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(18,17,31,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: 14, width: "min(920px, 96vw)", height: "min(760px, 90vh)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: C.tinta, flexShrink: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#5BC2EA33", color: C.celeste, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{(c.cliente || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "#8fa0c0", fontWeight: 700 }}>Cuenta corriente</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 16, color: C.white }}>{c.cliente}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.12)", color: C.white, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "14px 18px", flexShrink: 0 }}>
          {[["Facturado", c.facturado, C.tinta], ["Cobrado", c.cobrado, C.green], ["Saldo", c.saldo, c.saldo > 0 ? C.amber : C.green]].map(([l, v, col]) => (
            <div key={l} style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 10, padding: "9px 14px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 700 }}>{l}</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: col }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
        {/* memoria de pagadores de esta cuenta */}
        <div style={{ margin: "0 18px 12px", background: C.white, border: "1px solid " + C.line2, borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 800, marginRight: 4 }}>{"\uD83D\uDD17"} Pagadores conocidos</span>
          {(c.pagadores || []).length ? c.pagadores.map((pg) => (
            <span key={pg.key} title={"Pagó " + pg.veces + (pg.veces === 1 ? " vez" : " veces") + (pg.ultimo ? " · última " + fmtF(pg.ultimo) : "") + ". La conciliación lo usa para reconocer sus pagos."}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#5BC2EA14", border: "1px solid #5BC2EA66", color: C.celesteDeep, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12, fontWeight: 600 }}>
              {pg.nombre}
              <span style={{ fontSize: 10, color: C.txt3, fontWeight: 700 }}>×{pg.veces}{pg.ultimo ? " · " + fmtF(pg.ultimo) : ""}</span>
              {onQuitarPagador && <button onClick={() => onQuitarPagador(pg.key)} title="Quitar: no es pagador de esta cuenta" style={{ border: "none", background: "transparent", color: C.txt3, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>}
            </span>
          )) : <span style={{ fontSize: 12, color: C.txt3 }}>Todavía ninguno — se graban solos cuando una cobranza de esta cuenta se concilia con su pago.</span>}
        </div>
        {/* listas: cada columna scrollea por su cuenta, con títulos fijos y ordenables */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.35fr 1fr", gridTemplateRows: "minmax(0, 1fr)", margin: "0 18px 18px", border: "1px solid " + C.line2, borderRadius: 10, overflow: "hidden", background: C.white }}>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid " + C.line }}>
            <div style={titulo}><span>Compras ({fEst.length}){nDiaF > 0 && <span style={{ color: C.celesteDeep }}> · {nDiaF} del {fmtF(diaFoco)}</span>}</span>{totImp > 0 && <span style={{ color: C.amber }}>{totImp} con saldo</span>}</div>
            <div style={colHead}>
              <Th label="Fecha" k="fecha" s={sF} set={setSF} w={78} />
              <Th label="Comprobante" k="comp" s={sF} set={setSF} flex />
              <Th label="Medio" k="medio" s={sF} set={setSF} w={52} />
              <Th label="Importe" k="imp" s={sF} set={setSF} w={84} right />
              <Th label="Estado" k="estado" s={sF} set={setSF} w={58} right />
            </div>
            <div ref={refF} style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
              {listF.length ? listF.map((f, i) => (
                <div key={f.id || i} data-foco={f.fecha === diaFoco ? "1" : undefined} data-sel={selComp && nComp(f.comp) === selComp ? "1" : undefined} onClick={() => toggleComp(f.comp)} title="Ver los cobros de este comprobante"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: "pointer", background: f.estado === "impaga" ? "#d94f6306" : f.estado === "parcial" ? "#c77d0806" : undefined, ...(f.fecha === diaFoco ? marca : {}), ...(selComp && nComp(f.comp) === selComp ? marcaSel : {}) }}>
                  <span style={{ width: 78, flexShrink: 0, fontSize: 11, color: f.fecha === diaFoco ? C.celesteDeep : C.txt3, fontWeight: f.fecha === diaFoco ? 700 : 400, whiteSpace: "nowrap" }}>{fmtF(f.fecha)}{f.hora ? <span style={{ opacity: 0.7 }}> {f.hora}</span> : null}</span>
                  <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.comp}</span>
                  <span style={{ width: 52, flexShrink: 0, fontSize: 10.5, color: f.c === "cc" ? "#7c5fd3" : C.txt3, fontWeight: f.c === "cc" ? 700 : 400 }}>{medioLbl[f.c] || "—"}</span>
                  <span style={{ width: 84, flexShrink: 0, textAlign: "right", fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta }}>{fmt(f.total)}</span>
                  <span style={{ width: 58, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}><span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 5, padding: "1px 5px", textTransform: "uppercase", background: f.estado === "pagada" ? "#1a9c6e1c" : f.estado === "parcial" ? "#c77d081c" : "#d94f631c", color: f.estado === "pagada" ? C.green : f.estado === "parcial" ? C.amber : C.red }}>{f.estado}</span></span>
                </div>
              )) : <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.txt3 }}>Sin ventas en el período cargado</div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={titulo}><span>Cobranzas ({c.cob.length}){nDiaC > 0 && <span style={{ color: C.celesteDeep }}> · {nDiaC} del {fmtF(diaFoco)}</span>}</span></div>
            <div style={colHead}>
              <Th label="Fecha" k="fecha" s={sC} set={setSC} w={58} />
              <Th label="Medio / pagador" k="medio" s={sC} set={setSC} flex />
              <Th label="Importe" k="imp" s={sC} set={setSC} w={90} right />
            </div>
            {selComp && (
              <div style={{ padding: "7px 14px", borderBottom: "1px solid " + C.line, background: "#1a9c6e10", fontSize: 11.5, color: C.txt2, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: C.tinta }}>{(compSel && compSel.comp) || (cobSel[0] && cobSel[0].paga) || selComp}</b>{" \u2192 "}
                  {compSel && compSel.c !== "cc"
                    ? "pagado en el momento (" + ({ mp: "MercadoPago", efec: "efectivo" }[compSel.c] || "contado") + ")"
                    : cobSel.length
                      ? cobSel.length + " cobro" + (cobSel.length === 1 ? "" : "s") + " por " + fmt(cobSel.reduce((a, k) => a + k.imp, 0)) + (compSel ? " de " + fmt(compSel.total) : "")
                      : <span style={{ color: C.red, fontWeight: 700 }}>sin cobros en el 72</span>}
                </span>
                <button onClick={() => setSelComp(null)} title="Quitar selección" style={{ border: "none", background: "transparent", color: C.txt3, cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>
              </div>
            )}
            <div ref={refC} style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
              {listC.length ? listC.map((k, i) => (
                <div key={i} data-foco={k.fecha === diaFoco ? "1" : undefined} data-sel={selComp && nComp(k.paga) === selComp ? "1" : undefined} onClick={() => k.paga && toggleComp(k.paga)} title={k.paga ? "Ver el comprobante que paga este cobro" : ""}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: k.paga ? "pointer" : "default", ...(k.fecha === diaFoco ? marca : {}), ...(selComp && nComp(k.paga) === selComp ? marcaSel : {}) }}>
                  <span style={{ width: 58, flexShrink: 0, fontSize: 11, color: k.fecha === diaFoco ? C.celesteDeep : C.txt3, fontWeight: k.fecha === diaFoco ? 700 : 400 }}>{fmtF(k.fecha)}</span>
                  <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.conc && k.pagador ? <span title="Pagador del movimiento de banco con que se concilió">{k.pagador}</span> : k.medio}{k.conc && <span title="Conciliada con su pago" style={{ fontSize: 9, fontWeight: 800, color: C.green, marginLeft: 6 }}>✓ conciliada</span>}</span>
                  <span style={{ width: 90, flexShrink: 0, textAlign: "right", fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.green }}>{fmt(k.imp)}</span>
                </div>
              )) : <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.txt3 }}>Sin cobranzas</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────
export default function ModuloConciliacion({
  business = { group: "Contenedores", name: "Container Bar", initials: "CB", color: "#5BC2EA" },
  embedded = false, // cuando va dentro del Shell (que ya trae su header), se oculta el header propio
  pagadorMap = {}, // memoria de pagadores (formato nuevo por cuenta, o el viejo pagador → cliente)
  onPagadorMap, // callback(memoria) para que el Shell la persista
  // Lazarillo (14/11): guardado en el servidor. { fuentes, onFuente(tipo, filas, archivo),
  // cargarEstado(periodo) → Promise<estado|null>, guardarEstado(periodo, estado) }. Sin esto,
  // el módulo funciona igual que el prototipo (todo en memoria).
  persist = null,
}) {
  useBrandFonts();
  const [data, setData] = React.useState(() => {
    const f = (persist && persist.fuentes) || {};
    return { ventas: f.ventas || null, pagos: f.pagos || null, banco: f.banco || null };
  });
  const [result, setResult] = React.useState(null);
  const [tol, setTol] = React.useState(0); // arranca en "mismo día"
  const [desde, setDesde] = React.useState(null);
  const [hasta, setHasta] = React.useState(null);
  const [mesActivo, setMesActivo] = React.useState(null);
  const [filterV, setFilterV] = React.useState("all");
  const [subFilterV, setSubFilterV] = React.useState("all");
  const [difFiltro, setDifFiltro] = React.useState(null); // filtro de conciliaciones por signo de diferencia: null | 'mas' | 'menos'
  const editSnap = React.useRef(null); // snapshot para cancelar una edición (Editar → ×)
  const [tips, setTips] = React.useState({}); // propina marcada por movimiento de banco: { id: monto }
  const [facturasCC, setFacturasCC] = React.useState(() => (persist && persist.fuentes && persist.fuentes.facturas_cc) || []); // facturas a cuenta corriente (del 22), para el modal de cuenta
  const [cuentaModal, setCuentaModal] = React.useState(null); // cliente cuyo modal de cuenta corriente está abierto
  // override de forma de pago por comprobante (errores de carga del cajero): "mp" | "efec".
  // Mueve la fila entre la conciliación (MercadoPago) y el grupo de efectivo.
  const [formaOverride, setFormaOverride] = React.useState({});
  const [formaEdit, setFormaEdit] = React.useState(null); // comprobante cuyo selector de forma está abierto
  const formaReal = (comp, def) => (comp && formaOverride[comp]) || def;
  const [efectivoOpen, setEfectivoOpen] = React.useState(new Set()); // días con el grupo de efectivo desplegado
  const [selEfec, setSelEfec] = React.useState(new Set()); // tickets de efectivo tildados (para conciliar)
  const [efecReclas, setEfecReclas] = React.useState(new Set()); // efectivo ya reclasificado (conciliado) → sale del grupo
  // ventas en EFECTIVO por día (no se concilian; se muestran agrupadas a la izquierda)
  const efectivoPorDia = React.useMemo(() => {
    const m = {};
    facturasCC.filter((f) => formaReal(f.comp, f.c) === "efec" && !efecReclas.has(f.id)).forEach((f) => { (m[f.fecha] = m[f.fecha] || { items: [], total: 0 }); m[f.fecha].items.push(f); m[f.fecha].total += f.total; });
    return m;
  }, [facturasCC, efecReclas, formaOverride]);
  const efecById = React.useMemo(() => { const m = {}; facturasCC.filter((f) => formaReal(f.comp, f.c) === "efec").forEach((f) => { m[f.id] = f; }); return m; }, [facturasCC, formaOverride]);
  const selEfecTotal = React.useMemo(() => [...selEfec].reduce((a, id) => a + (efecById[id] ? efecById[id].total : 0), 0), [selEfec, efecById]);
  const [ccOpen, setCcOpen] = React.useState(new Set()); // días con el grupo de cuenta corriente desplegado
  // cobranzas de cuenta corriente del día: se pueden tildar para conciliarlas a mano con su pago
  const [selCC, setSelCC] = React.useState(new Set()); // cobranzas CC tildadas
  const [ccConc, setCcConc] = React.useState(new Set()); // cobranzas CC ya conciliadas a mano
  const ccById = React.useMemo(() => { const m = {}; (data.pagos || []).forEach((p) => { m[p.id] = p; }); return m; }, [data.pagos]);
  // Cuenta corriente por DÍA DE VENTA: cada ticket vendido a cta. cte. queda en su día
  // hasta que su pago aparece en el banco. La guía es el 72 (qué ticket paga cada cobro):
  //  · impaga  → el ERP no tiene cobro de ese ticket
  //  · erp     → el ERP dice que se cobró, pero ese pago todavía no está en el banco
  //  · saldada → su(s) cobro(s) se conciliaron con el banco → sale de pendientes
  // Los cobros de tickets de otro período (no están en el 22 cargado) van en el día del cobro.
  const ccPorDia = React.useMemo(() => {
    const m = {};
    const add = (f, r) => { if (!f) return; (m[f] = m[f] || { items: [], total: 0 }); m[f].items.push(r); };
    const nC = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
    const cobPorTicket = {};
    (data.pagos || []).forEach((p) => { (cobPorTicket[nC(p.comp)] = cobPorTicket[nC(p.comp)] || []).push(p); });
    const tickets = facturasCC.filter((f) => f.c === "cc");
    const enPeriodo = new Set(tickets.map((t) => nC(t.comp)));
    // estado según cómo dice el ERP que se cobró:
    //  MP sin conciliar → "erp" (falta en banco)
    //  MP conciliado / efectivo / retiros / Banco Galicia (no se controla por banco) → saldada
    const estadoDe = (cs) => {
      if (!cs.length) return { estado: "impaga", saldado: false, ids: [] };
      const mpPend = cs.filter((p) => esMP(p) && !ccConc.has(p.id));
      if (mpPend.length) return { estado: "erp", saldado: false, ids: mpPend.map((p) => p.id) };
      const formas = [...new Set(cs.map((p) => (esMP(p) ? "banco" : String(p.cobro || "").toLowerCase())))];
      return { estado: "saldada", saldado: true, ids: [], formas };
    };
    tickets.forEach((t) => {
      const cs = cobPorTicket[nC(t.comp)] || [];
      const e = estadoDe(cs);
      add(t.fecha, { key: "t-" + t.id, tipo: "ticket", cliente: t.cli, comp: t.comp, hora: t.hora, imp: t.total, saldado: e.saldado,
        estado: e.estado, formas: e.formas || [], cobroIds: e.ids,
        cobroFecha: cs.map((p) => p.fecha).sort().slice(-1)[0] || "", cobrado: cs.reduce((a, p) => a + p.imp, 0) });
    });
    (data.pagos || []).forEach((p) => {
      if (enPeriodo.has(nC(p.comp))) return;
      const e = estadoDe([p]);
      add(p.fecha, { key: "c-" + p.id, tipo: "cobro", cliente: p.cliente, comp: p.comp, hora: p.hora, imp: p.imp, saldado: e.saldado,
        estado: e.saldado ? "saldada" : (e.estado === "galicia" ? "galicia" : "otro"), formas: e.formas || [], cobroIds: e.ids, cobroFecha: p.fecha, cobrado: p.imp, ticketFecha: p.fechaFact });
    });
    Object.values(m).forEach((d) => { d.items.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")); d.total = d.items.reduce((a, r) => a + r.imp, 0); });
    return m;
  }, [data.pagos, facturasCC, ccConc]);
  const selCCTotal = React.useMemo(() => [...selCC].reduce((a, id) => a + (ccById[id] ? ccById[id].imp : 0), 0), [selCC, ccById]);
  // buscadores
  const [busqComp, setBusqComp] = React.useState(""); // comprobante / cliente
  const [busqPago, setBusqPago] = React.useState(""); // pago por importe (o pagador)
  // cobranzas de cuenta corriente (72) por día — control de avance diario, NO se concilian
  // ni se totalizan como pendientes; solo se muestran agrupadas para seguir el cobro.
  // DETECTOR de posible error de caja: efectivo cuyo importe coincide EXACTO con un
  // movimiento de banco pendiente del mismo día → probablemente esa operación entró por
  // banco pero se cargó como efectivo. (Probé sumar cercanía horaria pero las horas de MP
  // son de acreditación, no de la venta, así que sumaban ruido; el monto es la señal.)
  const efectivoSospechoso = React.useMemo(() => {
    const res = {};
    if (!result) return res;
    const banByDay = {};
    result.B.filter((b) => b.status === "pend").forEach((b) => { (banByDay[b.fecha] = banByDay[b.fecha] || []).push(b); });
    Object.keys(efectivoPorDia).forEach((dia) => {
      const banks = (banByDay[dia] || []).slice();
      efectivoPorDia[dia].items.forEach((f) => {
        const idx = banks.findIndex((b) => b.imp === f.total);
        if (idx >= 0) { res[f.id] = { banImp: banks[idx].imp, banHora: banks[idx].hora, banId: banks[idx].id, exacto: true }; banks.splice(idx, 1); }
      });
    });
    return res;
  }, [result, efectivoPorDia]);
  // arma la cuenta corriente de un cliente: sus facturas (débitos) + cobranzas (créditos)
  const cuentaDe = (cliente) => {
    const k = cliKey(cliente);
    const fact = facturasCC.filter((f) => cliKey(f.cli) === k).sort((a, b) => a.fecha.localeCompare(b.fecha));
    // quién pagó cada cobranza conciliada (el pagador del movimiento de banco)
    const pagadorDe = (id) => { if (!result) return ""; const v = result.V.find((x) => x.id === "cc-" + id); const bid = v && (v.matchedWith || [])[0]; const b = bid && result.B.find((x) => x.id === bid); return b ? (b.cliente || "") : ""; };
    const cob = (data.pagos || []).filter((v) => cliKey(v.cliente) === k)
      .map((v) => ({ fecha: v.fecha, imp: v.imp, medio: v.cobro || "MercadoPago", conc: ccConc.has(v.id), pagador: ccConc.has(v.id) ? pagadorDe(v.id) : "", paga: v.comp, pagaFecha: v.fechaFact })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const facturado = fact.reduce((a, f) => a + f.total, 0);
    const contado = fact.filter((f) => f.c !== "cc").reduce((a, f) => a + f.total, 0); // pagas al momento (efec/MP)
    const cob72 = cob.reduce((a, c) => a + c.imp, 0);
    const cobrado = contado + cob72;
    const mp = memPag[k];
    const pagadores = mp ? Object.keys(mp.pags).map((pk) => ({ key: pk, ...mp.pags[pk] })).sort((a, b) => b.veces - a.veces || (b.ultimo || "").localeCompare(a.ultimo || "")) : [];
    return { cliente: cliente, fact, cob, facturado, contado, cob72, cobrado, saldo: facturado - cobrado, pagadores };
  };
  // el nombre es clickeable si el cliente tiene ventas en el 22 (todas tienen cliente)
  const clientesConCuenta = React.useMemo(() => { const s = new Set(); facturasCC.forEach((f) => { if (f.cli) s.add(cliKey(f.cli)); }); return s; }, [facturasCC]);
  const tieneCuenta = (cli) => cli && clientesConCuenta.has(cliKey(cli));
  // Cambiar la forma de pago de un comprobante (error de carga). Recoloca la fila sin
  // recalcular todo: a "efec" sale de la conciliación (y libera su banco si estaba
  // conciliada); a "mp" entra como ingreso pendiente a conciliar.
  function cambiarForma(row, nueva) {
    const comp = row.comp; if (!comp) { setFormaEdit(null); return; }
    const def = (row.c === "efec" || row.origen === "efec") ? "efec" : "mp";
    if (nueva === formaReal(comp, def)) { setFormaEdit(null); return; }
    setFormaOverride((o) => ({ ...o, [comp]: nueva }));
    setResult((res) => {
      if (!res) return res;
      let V = res.V, B = res.B;
      if (nueva === "efec") {
        const v = V.find((x) => x.comp === comp);
        if (v) {
          if (v.status === "ok" && (v.matchedWith || []).length) { const ids = new Set(v.matchedWith); B = B.map((b) => ids.has(b.id) ? { ...b, status: "pend", matchedWith: [], manual: false } : b); }
          V = V.filter((x) => x.comp !== comp);
        }
      } else if (nueva === "mp") {
        if (!V.some((x) => x.comp === comp)) {
          V = [...V, { id: "fv-" + comp, origen: "pos", status: "pend", matchedWith: [], fecha: row.fecha, imp: row.imp != null ? row.imp : row.total, cliente: row.cli || row.cliente || "", comp, hora: row.hora, cobro: "MERCADOPAGO", reclasForma: true }];
        }
      }
      return { V, B };
    });
    setFormaEdit(null);
    limpiarSeleccion();
  }
  // mapa aprendido pagador(banco) → cliente(CC): al conciliar una cobranza de cuenta
  // corriente con un movimiento de banco, guardamos qué pagador corresponde a qué cliente.
  // MEMORIA DE PAGADORES por cuenta corriente: cada vez que una cobranza de CC se
  // concilia (a mano, por sugerencia o automática) se graba quién la pagó, con cuántas
  // veces y la última fecha. La usan la conciliación automática y las sugerencias.
  const [memPag, setMemPag] = React.useState(() => memDesdeProp(pagadorMap));
  const memPagRef = React.useRef(memPag); memPagRef.current = memPag;
  const [ccNoAuto, setCcNoAuto] = React.useState(new Set()); // cobranzas que desarmaste: no se re-concilian solas
  const ccNoAutoRef = React.useRef(ccNoAuto); ccNoAutoRef.current = ccNoAuto;
  const conocePagador = (cli, pag) => { const c = memPagRef.current[cliKey(cli)]; return !!(c && pag && c.pags[cliKey(pag)]); };
  const grabarPagadores = (pares) => { if (pares && pares.length) setMemPag((m) => { const nm = memRegistrar(m, pares); if (onPagadorMap) onPagadorMap(nm); return nm; }); };
  const aprenderPagadores = (ingObjs, banObjs) => {
    const clis = (ingObjs || []).filter((v) => v.origen === "cc" && v.cliente);
    const pags = (banObjs || []).filter((b) => b && b.cliente);
    const pares = [];
    clis.forEach((v) => pags.forEach((b) => pares.push({ cli: v.cliente, pag: b.cliente, fecha: b.fecha, ref: refCob(v) + "@" + refBan(b) })));
    grabarPagadores(pares);
  };
  const olvidarCobranzas = (ccIdsSinPrefijo) => {
    const refs = ccIdsSinPrefijo.map((id) => ccById[id]).filter(Boolean).map(refCob);
    if (refs.length) setMemPag((m) => { const nm = memOlvidar(m, refs); if (nm !== m && onPagadorMap) onPagadorMap(nm); return nm; });
  };
  const quitarPagador = (cli, pagK) => setMemPag((m) => {
    const ck = cliKey(cli); if (!m[ck]) return m;
    const pags = { ...m[ck].pags }; delete pags[pagK];
    const nm = { ...m, [ck]: { ...m[ck], pags } }; if (onPagadorMap) onPagadorMap(nm); return nm;
  });
  const [tipEdit, setTipEdit] = React.useState(null); // id del movimiento con el editor de propina abierto
  // propina efectiva de un movimiento: lo marcado por el usuario, o el total si la
  // descripción es "tips", o 0. Nunca mayor al importe.
  const tipDe = (b) => { const t = tips[b.id] != null ? tips[b.id] : (b && b.tipDesc ? b.imp : 0); return Math.max(0, Math.min(t, b.imp)); };
  const [filterB, setFilterB] = React.useState("all");
  const [sortV, setSortV] = React.useState({ campo: "fecha", dir: 1 });
  const [sortB, setSortB] = React.useState({ campo: "fecha", dir: 1 });
  // multi-selección para conciliación manual sobre las 2 tablas
  const [selIng, setSelIng] = React.useState(new Set()); // ids de ingresos seleccionados
  const [selBan, setSelBan] = React.useState(new Set()); // ids de banco seleccionados
  const [modal, setModal] = React.useState(null); // {fuente} abierto
  const [instructivo, setInstructivo] = React.useState(null); // instructivo abierto
  // columnas visibles (arrancan con las fijas + tipoMedio en banco)
  const [colsB, setColsB] = React.useState(() => new Set(COLS_BANCO.filter((c) => c.fixed || c.key === "tipoMedio").map((c) => c.key)));
  const [colsV, setColsV] = React.useState(() => new Set(COLS_INGRESOS.filter((c) => c.fixed).map((c) => c.key)));
  // columnas extra que se muestran SOLO en la vista de pendientes (para identificar)
  const PEND_EXTRA_V = ["cobro", "mesa"];
  const PEND_EXTRA_B = ["medio"];
  const colsVeff = new Set([...colsV, ...PEND_EXTRA_V]); // base + extras (solo pendientes)
  const colsBeff = new Set([...colsB, ...PEND_EXTRA_B]);
  const [colMenu, setColMenu] = React.useState(null); // 'banco' | 'ingresos' | null
  // filtros por columna: { banco: {campo: Set(valores excluidos)}, ingresos: {...} }
  const [colFilterB, setColFilterB] = React.useState({});
  const [colFilterV, setColFilterV] = React.useState({});
  const [colFilterOpen, setColFilterOpen] = React.useState(null); // "banco:campo" | "ingresos:campo" | null
  // vista "por día" para pendientes: modo on/off + día centro (YYYY-MM-DD)
  const [dayView, setDayView] = React.useState(false);
  const [dayCenter, setDayCenter] = React.useState(null);
  const [expandedGroups, setExpandedGroups] = React.useState(new Set()); // grupos de importe expandidos en banco
  // ── Sugerencias de conciliación manual ──
  const [sugerir, setSugerir] = React.useState(true); // panel de sugerencias (activo por defecto en pendientes)
  const [margenTipo, setMargenTipo] = React.useState("pct"); // 'monto' | 'pct'
  const [margenVal, setMargenVal] = React.useState(10); // default 10% (escala con el monto); 0 = solo exactas
  const [setupOpen, setSetupOpen] = React.useState(false); // sector de fuentes+período: se minimiza cuando está todo cargado
  const [aprobOpen, setAprobOpen] = React.useState(true);   // panel de conciliados manuales (minimizar/maximizar)
  const [aprobExp, setAprobExp] = React.useState(new Set()); // conciliaciones manuales desplegadas (para ver las relaciones)
  const estadoFileRef = React.useRef(null); // input oculto para cargar estado guardado
  const [pendOpen, setPendOpen] = React.useState(true);     // panel de pendientes por mes (minimizar/maximizar)
  const [ctrlOpen, setCtrlOpen] = React.useState(false);    // panel de control: cobros por MP según el ERP sin pago en el banco
  const [mesesPend, setMesesPend] = React.useState(new Set()); // meses abiertos (compartido entre ambos lados)
  const [diasPend, setDiasPend] = React.useState(new Set()); // días abiertos en el panel de pendientes por mes
  const [limiteFilas, setLimiteFilas] = React.useState(150); // paginación de Todas/Conciliadas (evita renderizar miles de filas)
  const [ccListaOpen, setCcListaOpen] = React.useState(false); // grupo "Cuenta corriente" en Todas/Conciliadas (abre los dos lados)
  const [autoMargenVal, setAutoMargenVal] = React.useState(1); // margen de conciliación automática (default 1%); 0 = solo exactas
  const [autoMargenTipo, setAutoMargenTipo] = React.useState("pct"); // 'monto' | 'pct'
  const [sugActiva, setSugActiva] = React.useState(null); // índice de la sugerencia resaltada
  const [sugDescartadas, setSugDescartadas] = React.useState(new Set()); // keys de sugerencias descartadas
  // faltantes de conciliación manual: {id, fecha, monto, origenDesc, ingId}
  const [faltantes, setFaltantes] = React.useState([]);
  const [aprobadas, setAprobadas] = React.useState([]); // sugerencias aplicadas (para listar y deshacer)
  const [notas, setNotas] = React.useState({}); // observaciones por id de registro / grupo / conciliación
  const [notaEdit, setNotaEdit] = React.useState(null); // id de la nota que se está editando
  const [fileError, setFileError] = React.useState(null); // {fuente, columnas:[...], encontradas:[...]}

  // cerrar menús flotantes al hacer clic fuera (aplica y cierra)
  React.useEffect(() => {
    if (!colMenu && !colFilterOpen) return;
    const onDocClick = (e) => {
      const inMenu = e.target.closest && (e.target.closest("[data-colmenu]") || e.target.closest("[data-colfilter]"));
      if (!inMenu) { setColMenu(null); setColFilterOpen(null); }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [colMenu, colFilterOpen]);


  const xlsxReady = useSheetJS();

  // meses disponibles según los datos cargados
  const allDates = React.useMemo(() => {
    const src = [].concat(data.ventas || [], data.pagos || [], data.banco || []);
    return src.map((x) => x.fecha).filter(Boolean).sort();
  }, [data]);
  const months = React.useMemo(() => {
    const set = new Set(allDates.map((f) => f.slice(0, 7)));
    return [...set].sort();
  }, [allDates]);

  // al cargar datos, si no hay mes elegido, tomar el último
  React.useEffect(() => {
    if (months.length && !mesActivo) selectMonth(months[months.length - 1]);
     
  }, [months.length]);

  function lastDayOfMonth(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); }
  function selectMonth(ym) {
    setMesActivo(ym);
    setDesde(ym + "-01");
    setHasta(ym + "-" + String(lastDayOfMonth(ym)).padStart(2, "0"));
  }
  function inRange(f) {
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  }

  // Lee la hoja como matriz de filas (header:1) para poder ubicar la fila real
  // de encabezados aunque el archivo traiga títulos/logo arriba.
  async function readSheetMatrix(file) {
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  }
  // Busca en las primeras filas cuál es la de encabezados: la que contiene más
  // columnas requeridas. Devuelve {headerIdx, headers} o null si no la encuentra.
  function ubicarEncabezados(matrix, reqCols) {
    const wanted = (reqCols || []).flat().map((c) => c.trim().toUpperCase());
    let mejor = { idx: -1, hits: 0, headers: [] };
    const limite = Math.min(matrix.length, 15); // buscar en las primeras 15 filas
    for (let i = 0; i < limite; i++) {
      const celdas = (matrix[i] || []).map((c) => String(c).trim());
      const upper = celdas.map((c) => c.toUpperCase());
      const hits = wanted.filter((w) => upper.includes(w)).length;
      if (hits > mejor.hits) mejor = { idx: i, hits, headers: celdas };
    }
    return mejor.idx >= 0 ? { headerIdx: mejor.idx, headers: mejor.headers, hits: mejor.hits } : null;
  }
  // Convierte la matriz en objetos usando la fila de encabezados detectada.
  function matrixAObjetos(matrix, headerIdx, headers) {
    const out = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
      const fila = matrix[i] || [];
      if (fila.every((c) => c === "" || c == null)) continue; // saltar filas vacías
      const obj = {};
      headers.forEach((h, j) => { if (h) obj[h] = fila[j] !== undefined ? fila[j] : ""; });
      out.push(obj);
    }
    return out;
  }
  async function onFile(fuente, file) {
    if (!file) return;
    // esperar a que SheetJS esté disponible (por si el archivo se cargó antes)
    if (!window.XLSX) {
      await new Promise((res) => {
        const t = setInterval(() => { if (window.XLSX) { clearInterval(t); res(); } }, 100);
        setTimeout(() => { clearInterval(t); res(); }, 8000);
      });
    }
    if (!window.XLSX) return; // no cargó (sin conexión al CDN)
    const matrix = await readSheetMatrix(file);
    // ubicar la fila de encabezados (tolerante a títulos arriba)
    const ub = ubicarEncabezados(matrix, fuente.reqCols);
    const headers = ub ? ub.headers : (matrix[0] || []).map((c) => String(c).trim());
    // validar que estén las columnas imprescindibles
    if (fuente.reqCols) {
      const presentes = headers.map((k) => k.trim().toUpperCase());
      const faltan = fuente.reqCols.filter((alts) => !alts.some((a) => presentes.includes(a.toUpperCase())));
      if (faltan.length) {
        // ¿es un informe equivocado conocido? (trae las señales de otro informe)
        let pista = null;
        const ie = fuente.informeEquivocado;
        if (ie && ie.señales.every((s) => presentes.includes(s.toUpperCase()))) {
          pista = { correcto: ie.correcto, bajado: ie.bajado };
        }
        setFileError({
          fuente: fuente.titulo,
          columnas: faltan.map((alts) => alts[0]),
          encontradas: headers.filter((h) => h),
          pista,
        });
        setModal(null);
        return; // no cargar datos rotos
      }
    }
    const rows = matrixAObjetos(matrix, ub ? ub.headerIdx : 0, headers);
    const parsed = fuente.parser(rows);
    setData((d) => ({ ...d, [fuente.key]: parsed }));
    const factCC = fuente.key === "ventas" ? parseFacturasCC(rows) : null;
    if (factCC) setFacturasCC(factCC); // facturas a CC para el modal de cuenta
    // Lazarillo: queda guardado en el servidor para la próxima vez
    if (persist && persist.onFuente) {
      persist.onFuente(fuente.key, parsed, file.name);
      if (factCC) persist.onFuente("facturas_cc", factCC, file.name);
    }
    setModal(null);
  }

  // correr conciliación cuando cambian datos/período/tolerancia
  React.useEffect(() => {
    if (!(data.ventas && data.banco)) return;
    // Las cobranzas de cuenta corriente (72) NO van a la conciliación: son ventas a
    // crédito que no se cobran esa jornada, y su pago casi nunca aparece en el banco MP
    // (el cliente no figura como pagador). Solo alimentan la CC del cliente. Se concilia
    // solo el POS (MercadoPago). El 72 se sigue usando para la cuenta corriente.
    const ingresos = (data.ventas || []).filter((x) => inRange(x.fecha));
    const banco = (data.banco || []).filter((x) => inRange(x.fecha));
    // Orden: lo EXACTO primero (ventas y cuenta corriente), después lo aproximado.
    // Así un pago que es exacto para una cobranza no se lo lleva una venta "parecida".
    const exacto = conciliar(ingresos, banco, tol, 0, "pct");
    const autoCC = autoConciliarCC(exacto, (data.pagos || []).filter((x) => esMP(x) && inRange(x.fecha) && !ccNoAutoRef.current.has(x.id)), conocePagador);
    let res = autoCC.res;
    if (autoMargenVal > 0) {
      const pV = res.V.filter((v) => v.status === "pend" && !String(v.id).startsWith("cc-")), pB = res.B.filter((b) => b.status === "pend");
      const ap = conciliar(pV, pB, tol, autoMargenVal, autoMargenTipo);
      const mV = {}, mB = {}; ap.V.forEach((v) => { mV[v.id] = v; }); ap.B.forEach((b) => { mB[b.id] = b; });
      res = { V: res.V.map((v) => mV[v.id] || v), B: res.B.map((b) => mB[b.id] || b) };
    }
    setResult(res);
    grabarPagadores(autoCC.pares);
    setSelIng(new Set()); setSelBan(new Set()); setSelEfec(new Set()); setEfecReclas(new Set()); setSelCC(new Set()); setCcConc(new Set(autoCC.ccIds));
    setParV(new Set()); setParB(new Set());
    setFaltantes([]);
    setAprobadas([]);
    editSnap.current = null;
    setTips({}); setTipEdit(null);
     
  }, [data, tol, desde, hasta, autoMargenVal, autoMargenTipo]);

  const puedeConciliar = data.ventas && data.banco;

  // al cargar datos por primera vez, arrancar en Pendientes (vista por día)
  const arranco = React.useRef(false);
  React.useEffect(() => {
    if (puedeConciliar && !arranco.current) {
      arranco.current = true;
      setFilterV("pend"); setFilterB("pend"); setSubFilterV("all"); setDayView(true); setSugerir(true);
    }
  }, [puedeConciliar]);


  // Navegación de tabs espejada: cambiar de tab en un lado cambia ambos.
  const goTab = (f) => { editSnap.current = null; setFilterV(f); setFilterB(f); setSubFilterV("all"); setDifFiltro(null); setDayView(f === "pend"); setParV(new Set()); setParB(new Set()); setLimiteFilas(150); if (f === "pend") setSugerir(true); };
  // Tab "activo" mostrado: si hay un tipo de subfiltro elegido → Conciliadas;
  // Todas solo cuando el subfiltro es "Todos". Pendientes manda siempre.
  const activeTab = filterV === "pend" ? "pend" : (subFilterV !== "all" ? "ok" : filterV);
  // al elegir el subfiltro "grupo cliente", ordenar por cliente por default
  const onSubFiltro = (v) => { setSubFilterV(v); setDifFiltro(null); setLimiteFilas(150); if (v === "cliente") setSortV({ campo: "cliente", dir: 1 }); };
  // filtrar conciliaciones por signo de diferencia (a favor / en contra) desde la barra
  const filtrarPorDif = (sign) => {
    setFilterV("ok"); setFilterB("ok"); setSubFilterV("all"); setDayView(false); setLimiteFilas(150);
    setParV(new Set()); setParB(new Set());
    setDifFiltro((cur) => (cur === sign ? null : sign));
  };
  // desarmar una conciliación resaltada: manda sus registros a pendientes
  // cobranzas CC / efectivo reclasificado dentro de un cluster: al desarmar vuelven a su grupo
  const sacarExtras = (ids) => {
    const ef = ids.filter((id) => id.startsWith("ef-")).map((id) => id.slice(3));
    const cc = ids.filter((id) => id.startsWith("cc-")).map((id) => id.slice(3));
    if (ef.length) setEfecReclas((s) => { const n = new Set(s); ef.forEach((id) => n.delete(id)); return n; });
    if (cc.length) { setCcConc((s) => { const n = new Set(s); cc.forEach((id) => n.delete(id)); return n; }); olvidarCobranzas(cc); setCcNoAuto((s) => { const n = new Set(s); cc.forEach((id) => n.add(id)); return n; }); }
    return { ef, cc };
  };
  const desarmarCluster = () => {
    if (!result || (parV.size === 0 && parB.size === 0)) return;
    const extra = [...parV].filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    sacarExtras(extra);
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => parV.has(v.id) ? { ...v, status: "pend", matchedWith: [], matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined } : v);
    const B = result.B.map((b) => parB.has(b.id) ? { ...b, status: "pend", matchedWith: null, matchTipo: null, porHora: false, serieNota: undefined, serieMult: undefined } : b);
    setResult({ V, B });
    setParV(new Set()); setParB(new Set());
  };
  // editar una conciliación: la desarma, deja sus registros SELECCIONADOS y te lleva
  // a Pendientes de ese día para destildar/agregar y volver a conciliar.
  const editarCluster = () => {
    if (!result || (parV.size === 0 && parB.size === 0)) return;
    editSnap.current = result; // snapshot para poder cancelar la edición
    const anchor = result.V.find((v) => parV.has(v.id)) || result.B.find((b) => parB.has(b.id));
    const fecha = anchor ? anchor.fecha : dayCenter;
    const extra = [...parV].filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    const ex = sacarExtras(extra);
    if (ex.ef.length) setSelEfec(new Set(ex.ef));
    if (ex.cc.length) { setSelCC(new Set(ex.cc)); if (fecha) setCcOpen((s) => new Set(s).add(fecha)); }
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => parV.has(v.id) ? { ...v, status: "pend", matchedWith: [], matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined } : v);
    const B = result.B.map((b) => parB.has(b.id) ? { ...b, status: "pend", matchedWith: null, matchTipo: null, porHora: false, serieNota: undefined, serieMult: undefined } : b);
    setResult({ V, B });
    setSelIng(new Set([...parV].filter((id) => !extra.includes(id)))); setSelBan(new Set([...parB]));
    setParV(new Set()); setParB(new Set());
    setFilterV("pend"); setFilterB("pend"); setSubFilterV("all"); setDifFiltro(null); setDayView(true);
    if (fecha) setDayCenter(fecha);
  };

  // ── cálculos de vista ──
  // signo de la diferencia por CLUSTER (de más = banco > ingreso), para poder
  // filtrar las conciliaciones a favor / en contra. Union-find sobre ids conciliados.
  const difSigno = React.useMemo(() => {
    if (!result) return { deMas: 0, deMenos: 0, signo: {} };
    const { V, B } = result;
    const par = {};
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const link = (a, b) => { if (par[a] === undefined) par[a] = a; if (par[b] === undefined) par[b] = b; par[find(a)] = find(b); };
    V.filter((v) => v.status === "ok").forEach((v) => { if (par[v.id] === undefined) par[v.id] = v.id; (v.matchedWith || []).forEach((bid) => link(v.id, bid)); });
    const clu = {};
    V.filter((v) => v.status === "ok").forEach((v) => { const r = find(v.id); (clu[r] = clu[r] || { i: 0, b: 0, ids: [] }); clu[r].i += v.imp; clu[r].ids.push(v.id); });
    B.filter((b) => b.status === "ok" && par[b.id] !== undefined).forEach((b) => { const r = find(b.id); (clu[r] = clu[r] || { i: 0, b: 0, ids: [] }); clu[r].b += (b.imp - tipDe(b)); clu[r].ids.push(b.id); });
    let deMas = 0, deMenos = 0; const signo = {};
    Object.values(clu).forEach((c) => { const d = c.b - c.i; const s = d > 0 ? "mas" : d < 0 ? "menos" : "cero"; if (d > 0) deMas += d; else if (d < 0) deMenos += -d; c.ids.forEach((id) => (signo[id] = s)); });
    return { deMas, deMenos, signo };
  }, [result, tips]);

  // propinas: total del período y por día (movimientos con propina marcada / detectada)
  const tipsInfo = React.useMemo(() => {
    if (!result) return { total: 0, porDia: {} };
    let total = 0; const porDia = {};
    result.B.forEach((b) => { const t = tipDe(b); if (t > 0) { total += t; porDia[b.fecha] = (porDia[b.fecha] || 0) + t; } });
    return { total, porDia };
  }, [result, tips]);

  const view = React.useMemo(() => {
    if (!result) return null;
    const { V, B } = result;
    let fV = V.filter((v) => (filterV === "ok" ? v.status === "ok" : filterV === "pend" ? v.status === "pend" : true));
    if (filterV !== "pend" && subFilterV !== "all") {
      fV = fV.filter((v) => {
        if (v.status !== "ok") return false;
        const n = (v.matchedWith || []).length;
        if (subFilterV === "uno") return n === 1 && v.matchTipo !== "manual" && v.matchTipo !== "cliente" && v.matchTipo !== "combinado";
        if (subFilterV === "iguales") return v.matchTipo === "iguales";
        if (subFilterV === "consecutivos") return v.matchTipo === "consecutivos" && !v.porHora;
        if (subFilterV === "porhora") return v.matchTipo === "consecutivos" && v.porHora;
        if (subFilterV === "cliente") return v.matchTipo === "cliente";
        if (subFilterV === "combinado") return v.matchTipo === "combinado";
        if (subFilterV === "manual") return v.matchTipo === "manual";
        if (subFilterV === "faltante") {
          // "con faltante": conciliado cuya diferencia supera el margen configurado
          const m = margenTipo === "pct" ? Math.round(v.imp * margenVal / 100) : margenVal;
          return v.manual && Math.abs(v.manualDif || 0) > m;
        }
        return true;
      });
    }
    // filtro por signo de diferencia (a favor / en contra), sobre conciliadas
    if (filterV !== "pend" && difFiltro) {
      fV = fV.filter((v) => v.status === "ok" && difSigno.signo[v.id] === difFiltro);
    }
    let fB;
    const viendoConc = filterV === "ok" || (filterV !== "pend" && subFilterV !== "all") || (filterV !== "pend" && !!difFiltro);
    if (viendoConc) {
      const ids = new Set(); fV.forEach((v) => (v.matchedWith || []).forEach((id) => ids.add(id)));
      fB = B.filter((b) => ids.has(b.id));
    } else if (filterV === "pend") {
      fB = B.filter((b) => b.status === "pend");
    } else {
      fB = B.filter((b) => (filterB === "all" ? true : b.status === filterB));
    }
    // valor mostrado de una celda (para filtrar por columna, coincide con lo visible)
    const cellVal = (row, campo) => {
      if (campo === "origenLbl") return row.origen === "cc" ? "CC" : "VD";
      if (campo === "fecha") return fmtFecha(row.fecha);
      if (campo === "fechaFact") return fmtFecha(row.fechaFact || row.fecha);
      if (campo === "cobro") return row.origen === "cc" ? "Cuenta corriente" : (row.cobro || "—");
      const v = row[campo];
      return v === undefined || v === null || v === "" ? "—" : String(v);
    };
    // aplicar filtros por columna (colFilter guarda los valores EXCLUIDOS)
    const applyColFilter = (arr, cf) => {
      const campos = Object.keys(cf).filter((k) => cf[k] && cf[k].size);
      if (!campos.length) return arr;
      return arr.filter((row) => campos.every((campo) => !cf[campo].has(cellVal(row, campo))));
    };
    fV = applyColFilter(fV, colFilterV);
    fB = applyColFilter(fB, colFilterB);

    // valor de orden: coincide con lo que se muestra (fecha de factura cae a fecha
    // de pago en las ventas), importe numérico, resto como texto con orden natural
    const sortVal = (row, campo) => {
      if (campo === "imp") return row.imp;
      if (campo === "fechaFact") return row.fechaFact || row.fecha || "";
      const v = row[campo];
      return v == null ? "" : v;
    };
    const sr = (arr, s) => arr.slice().sort((x, y) => {
      const vx = sortVal(x, s.campo), vy = sortVal(y, s.campo);
      if (typeof vx === "number" && typeof vy === "number") return (vx - vy) * s.dir;
      return String(vx).localeCompare(String(vy), "es", { numeric: true }) * s.dir;
    });
    return { fV: sr(fV, sortV), fB: sr(fB, sortB), V, B };
  }, [result, filterV, subFilterV, filterB, sortV, sortB, colFilterV, colFilterB, margenTipo, margenVal, difFiltro, difSigno]);

  // conteos del día en foco (dayCenter): los KPIs/headers muestran el día que estás
  // trabajando, no todo el período. Aplica en cualquier pestaña mientras haya día en foco.
  const diaCounts = React.useMemo(() => {
    if (!result || !dayCenter) return null;
    return {
      v: result.V.filter((v) => v.status === "pend" && v.fecha === dayCenter).length,
      b: result.B.filter((b) => b.status === "pend" && b.fecha === dayCenter).length,
    };
  }, [result, dayCenter]);

  const kpis = React.useMemo(() => {
    if (!result) return null;
    const { V, B } = result;
    const ok = V.filter((v) => v.status === "ok").length;
    const uno = V.filter((v) => v.status === "ok" && (v.matchedWith || []).length === 1).length;
    const varios = V.filter((v) => v.status === "ok" && (v.matchedWith || []).length > 1).length;
    return { ok, uno, varios, deMas: difSigno.deMas, deMenos: difSigno.deMenos, pendV: V.filter((v) => v.status === "pend").length, pendB: B.filter((b) => b.status === "pend").length };
  }, [result, difSigno]);

  // días que tienen algún pendiente (en cualquiera de las dos tablas), ordenados
  const pendingDays = React.useMemo(() => {
    if (!result) return [];
    const set = new Set();
    result.V.forEach((v) => { if (v.status === "pend") set.add(v.fecha); });
    result.B.forEach((b) => { if (b.status === "pend") set.add(b.fecha); });
    return [...set].sort();
  }, [result]);

  // cuando la memoria de pagadores aprende algo, revisar en el momento si hay otras
  // cobranzas de CC que ya se pueden cerrar solas (exacto + mismo día + pagador conocido)
  React.useEffect(() => {
    if (!result || editSnap.current) return;
    const pend = (data.pagos || []).filter((x) => esMP(x) && inRange(x.fecha) && !ccConc.has(x.id) && !ccNoAutoRef.current.has(x.id));
    if (!pend.length) return;
    const r = autoConciliarCC(result, pend, conocePagador);
    if (!r.ccIds.length) return;
    setResult(r.res);
    setCcConc((s) => { const n = new Set(s); r.ccIds.forEach((id) => n.add(id)); return n; });
    grabarPagadores(r.pares);
     
  }, [memPag]);

  // Todas / Conciliadas: las cobranzas de cuenta corriente y los pagos de banco que
  // las cubren van en un grupo aparte (igual que en Pendientes), no mezclados.
  const ccSplit = React.useMemo(() => {
    if (!view || !result) return null;
    const banCC = new Set(), banOtros = new Set();
    result.V.forEach((v) => { if (v.status !== "ok") return; (v.matchedWith || []).forEach((id) => (v.origen === "cc" ? banCC : banOtros).add(id)); });
    const esBanCC = (b) => b.status === "ok" && banCC.has(b.id) && !banOtros.has(b.id);
    const ingCC = view.fV.filter((v) => v.origen === "cc"), banCCr = view.fB.filter(esBanCC);
    return {
      ingCC, ingOtros: view.fV.filter((v) => v.origen !== "cc"),
      banCC: banCCr, banOtros: view.fB.filter((b) => !esBanCC(b)),
      totIng: ingCC.reduce((a, v) => a + v.imp, 0), totBan: banCCr.reduce((a, b) => a + b.imp, 0),
    };
  }, [view, result]);

  // pendientes por día (ingresos + banco), para marcar el calendario
  const pendPorDia = React.useMemo(() => {
    const m = {};
    if (!result) return m;
    result.V.forEach((v) => { if (v.status === "pend") m[v.fecha] = (m[v.fecha] || 0) + 1; });
    result.B.forEach((b) => { if (b.status === "pend") m[b.fecha] = (m[b.fecha] || 0) + 1; });
    return m;
  }, [result]);

  // fijar el día en foco en el primer día con pendientes apenas hay datos
  // (no solo al entrar a la vista por día), para que barra y KPIs muestren el día
  React.useEffect(() => {
    if (pendingDays.length && (!dayCenter || (desde && dayCenter < desde) || (hasta && dayCenter > hasta))) {
      setDayCenter(pendingDays[0]);
    }
     
  }, [pendingDays.length]);

  // navegar día centro (± dentro de los días con pendientes)
  function moveDay(dir) {
    if (!pendingDays.length) return;
    // salta al día con pendientes más cercano (funciona aunque el día elegido no tenga)
    const cand = dir > 0 ? pendingDays.filter((d) => d > dayCenter) : pendingDays.filter((d) => d < dayCenter);
    if (!cand.length) return;
    setDayCenter(dir > 0 ? cand[0] : cand[cand.length - 1]);
  }
  // elegir un día desde el calendario
  function elegirDia(iso) {
    if (!iso) return;
    if (!(dayView && filterV === "pend")) goTab("pend");
    setDayCenter(iso);
  }
  // ventana de fechas visible según tolerancia (centro ± tol)
  function dayWindow() {
    if (!dayCenter) return [];
    const days = [];
    for (let d = -tol; d <= tol; d++) {
      const dt = new Date(dayCenter + "T12:00:00");
      dt.setDate(dt.getDate() + d);
      days.push(dt.toISOString().slice(0, 10));
    }
    return days;
  }
  // ── Motor de sugerencias de conciliación manual ──
  // Para el día centro, busca pares probables: 1 ingreso ↔ 1+ movimientos de banco
  // (o al revés) cuya diferencia esté dentro del margen configurado.
  const autoAvanzar = React.useRef(false); // al aceptar la última sugerencia del día, pasar al siguiente
  const sugerencias = React.useMemo(() => {
    if (!sugerir || !result || !dayCenter) return [];
    const win = dayWindow();
    // las cobranzas de cuenta corriente del día (todavía no conciliadas) también son
    // candidatas: van con id "cc-<id>" y al aplicar se concilian igual que a mano.
    const ccP = (data.pagos || []).filter((p) => esMP(p) && !ccConc.has(p.id) && win.includes(p.fecha))
      .map((p) => ({ id: "cc-" + p.id, origen: "cc", imp: p.imp, cliente: p.cliente, comp: p.comp, fecha: p.fecha, ccCobranza: p.id }));
    const ingP = [...result.V.filter((v) => v.status === "pend" && win.includes(v.fecha)), ...ccP];
    const banP = result.B.filter((b) => b.status === "pend" && win.includes(b.fecha)).map((b) => ({ ...b, imp: b.imp - tipDe(b) })).filter((b) => b.imp > 0);
    const margenDe = (base) => margenTipo === "pct" ? Math.round(base * margenVal / 100) : margenVal;
    // busca un subconjunto de 2..maxN ingresos (ordenados asc) que sume ~target dentro
    // del margen; prefiere menos elementos. Con poda por suma parcial (cand ordenado).
    const comboIng = (cand, target, margen, maxN) => {
      const n = cand.length;
      for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s = cand[a].imp + cand[c].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c]]; }
      for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s2 = cand[a].imp + cand[c].imp; if (s2 - target > margen) break; for (let e = c + 1; e < n; e++) { const s = s2 + cand[e].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c], cand[e]]; } }
      if (maxN >= 4) for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const s2 = cand[a].imp + cand[c].imp; if (s2 - target > margen) break; for (let e = c + 1; e < n; e++) { const s3 = s2 + cand[e].imp; if (s3 - target > margen) break; for (let g = e + 1; g < n; g++) { const s = s3 + cand[g].imp; if (s - target > margen) break; if (Math.abs(s - target) <= margen) return [cand[a], cand[c], cand[e], cand[g]]; } } }
      return null;
    };
    const out = [];
    const usadosBan = new Set(), usadosIng = new Set();

    // helper: agrupa banco por importe (para detectar N iguales rápido)
    const banPorImp = {};
    banP.forEach((b) => { (banPorImp[b.imp] = banPorImp[b.imp] || []).push(b); });

    // 0) varios ingresos → 1 banco EXACTO (prioridad): que un match flojo del paso 1
    // no consuma ingresos que forman una combinación exacta (2, 3 o 4).
    banP.slice().sort((a, b) => b.imp - a.imp).forEach((b) => {
      if (usadosBan.has(b.id)) return;
      const cand = ingP.filter((v) => !usadosIng.has(v.id)).sort((x, y) => x.imp - y.imp);
      const grupo = comboIng(cand, b.imp, 0, 4);
      if (grupo && grupo.length >= 2) {
        const ids = grupo.map((g) => g.id);
        const key = "s:" + ids.join(",") + ":" + b.id;
        if (!sugDescartadas.has(key)) {
          const tot = grupo.reduce((a, g) => a + g.imp, 0);
          out.push({ key, ingIds: ids, banIds: [b.id], ingTotal: tot, banTotal: b.imp, dif: 0, tipo: grupo.length + " ingresos" });
          ids.forEach((id) => usadosIng.add(id)); usadosBan.add(b.id);
        }
      }
    });

    // 1) 1 ingreso ↔ combinación de banco
    ingP.slice().sort((a, b) => b.imp - a.imp).forEach((v) => {
      if (usadosIng.has(v.id)) return;
      const margen = margenDe(v.imp);
      let match = null;

      // 1-a-1 exacto/cercano — preferir un banco cuyo PAGADOR coincida con el cliente
      const cands1 = banP.filter((b) => !usadosBan.has(b.id) && Math.abs(b.imp - v.imp) <= margen);
      const uno = cands1.find((b) => pagadorCoincide(v.cliente, b.cliente)) || cands1[0];
      if (uno) match = { banIds: [uno.id], banTotal: uno.imp, tipo: uno.imp === v.imp ? "1 a 1 exacto" : "1 a 1" };

      // N iguales (o MÚLTIPLOS del base) cuyo total ≈ ingreso
      if (!match) {
        const disp = banP.filter((b) => !usadosBan.has(b.id));
        const cnt = {};
        disp.forEach((b) => { cnt[b.imp] = (cnt[b.imp] || 0) + 1; });
        const bases = [...new Set(disp.map((b) => b.imp))].filter((x) => cnt[x] >= 3).sort((a, b) => a - b);
        for (const base of bases) {
          const muls = disp.filter((b) => b.imp % base === 0);
          if (muls.length < 2) continue;
          const U = Math.round(v.imp / base);
          if (U < 2 || Math.abs(U * base - v.imp) > margen) continue;
          let reach = { 0: [] };
          for (const it of muls) {
            const u = it.imp / base;
            for (const su of Object.keys(reach)) {
              const ns = Number(su) + u;
              if (ns <= U && !reach[ns]) reach[ns] = reach[su].concat(it);
            }
            if (reach[U]) break;
          }
          if (reach[U] && reach[U].length >= 2) {
            const tomar = reach[U];
            match = { banIds: tomar.map((b) => b.id), banTotal: tomar.reduce((a, b) => a + b.imp, 0), tipo: "×" + tomar.length + " iguales" };
            break;
          }
        }
      }

      // combinación de 2-3 distintos
      if (!match) {
        const cand = banP.filter((b) => !usadosBan.has(b.id)).sort((a, b) => a.ord - b.ord);
        for (let a = 0; a < cand.length && !match; a++)
          for (let b = a + 1; b < cand.length && !match; b++) {
            if (Math.abs(cand[a].imp + cand[b].imp - v.imp) <= margen)
              match = { banIds: [cand[a].id, cand[b].id], banTotal: cand[a].imp + cand[b].imp, tipo: "2 movimientos" };
            else for (let c = b + 1; c < cand.length && !match; c++)
              if (Math.abs(cand[a].imp + cand[b].imp + cand[c].imp - v.imp) <= margen)
                match = { banIds: [cand[a].id, cand[b].id, cand[c].id], banTotal: cand[a].imp + cand[b].imp + cand[c].imp, tipo: "3 movimientos" };
          }
      }

      if (match) {
        const key = "s:" + v.id + ":" + match.banIds.join(",");
        if (!sugDescartadas.has(key)) {
          out.push({ key, ingIds: [v.id], banIds: match.banIds, ingTotal: v.imp, banTotal: match.banTotal, dif: v.imp - match.banTotal, tipo: match.tipo });
          usadosIng.add(v.id); match.banIds.forEach((id) => usadosBan.add(id));
        }
      }
    });

    // 2) varios ingresos ↔ 1 movimiento de banco (2, 3 o 4 ingresos)
    banP.slice().sort((a, b) => b.imp - a.imp).forEach((b) => {
      if (usadosBan.has(b.id)) return;
      const margen = margenDe(b.imp);
      const cand = ingP.filter((v) => !usadosIng.has(v.id)).sort((x, y) => x.imp - y.imp);
      const grupo = comboIng(cand, b.imp, margen, 4);
      if (grupo && grupo.length >= 2) {
        const ids = grupo.map((g) => g.id);
        const key = "s:" + ids.join(",") + ":" + b.id;
        if (!sugDescartadas.has(key)) {
          const tot = grupo.reduce((a, g) => a + g.imp, 0);
          out.push({ key, ingIds: ids, banIds: [b.id], ingTotal: tot, banTotal: b.imp, dif: tot - b.imp, tipo: grupo.length + " ingresos" });
          ids.forEach((id) => usadosIng.add(id)); usadosBan.add(b.id);
        }
      }
    });

    // distancia en días de cada par (entre la fecha del ingreso y la del banco),
    // para poder agruparlas por "mismo día", "con 1 día", etc.
    const fechaOf = {};
    result.V.forEach((v) => (fechaOf[v.id] = v.fecha));
    result.B.forEach((b) => (fechaOf[b.id] = b.fecha));
    ccP.forEach((v) => (fechaOf[v.id] = v.fecha));
    const cliOf = {};
    result.V.forEach((v) => (cliOf[v.id] = v.cliente));
    result.B.forEach((b) => (cliOf[b.id] = b.cliente));
    ccP.forEach((v) => (cliOf[v.id] = v.cliente));
    const dd = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
    out.forEach((s) => {
      let m = 0;
      s.ingIds.forEach((iv) => s.banIds.forEach((ib) => { m = Math.max(m, dd(fechaOf[iv], fechaOf[ib])); }));
      s.distDias = Math.round(m);
    });
    // PROBABILIDAD: reglas limpias (1 a 1, N iguales) valen más que las combinaciones;
    // importe exacto vale más que con diferencia; mismo día vale más que ±N; y si el
    // PAGADOR del banco coincide con el cliente del ingreso, sube fuerte (señal fuerte).
    out.forEach((s) => {
      s.mismoPagador = s.ingIds.some((iv) => s.banIds.some((ib) => pagadorCoincide(cliOf[iv], cliOf[ib])
        || conocePagador(cliOf[iv], cliOf[ib]))); // por nombre o por la memoria de la cuenta
      const relDif = s.ingTotal ? Math.abs(s.dif) / s.ingTotal : 0;
      const margenRel = margenTipo === "pct" ? margenVal / 100 : (s.ingTotal ? margenVal / s.ingTotal : 0.02);
      const cercania = margenRel > 0 ? Math.max(0, Math.min(1, 1 - relDif / margenRel)) : (relDif === 0 ? 1 : 0);
      const limpio = /1 a 1|iguales/.test(s.tipo); // patrones que ya conocemos
      const factorDia = s.distDias === 0 ? 1 : s.distDias === 1 ? 0.9 : 0.78;
      let p = (limpio ? 0.92 : 0.72) * (0.55 + 0.45 * cercania) * factorDia;
      if (s.mismoPagador) p = Math.min(0.99, p + 0.12); // mismo pagador: señal fuerte
      if (s.dif === 0 && limpio && s.distDias === 0) p = Math.max(p, 0.98); // regla limpia + exacto + mismo día ≈ seguro
      else if (s.dif === 0 && s.distDias === 0) p = Math.max(p, 0.9); // combinación exacta del mismo día: muy probable
      s.limpio = limpio;
      s.conCC = s.ingIds.some((id) => id.startsWith("cc-")); // incluye cobranza de cuenta corriente
      s.prob = Math.round(Math.max(0.3, Math.min(0.99, p)) * 100);
    });
    // una sugerencia debe involucrar el día en foco (dayCenter) en al menos un lado.
    // Así, con "mismo día" solo salen pares del día; con ±N, el día en foco cruzando
    // con vecinos. Los pares íntegramente de otro día se ven al navegar a ese día.
    const tocaFoco = (s) => s.ingIds.some((id) => fechaOf[id] === dayCenter) || s.banIds.some((id) => fechaOf[id] === dayCenter);
    const outFoco = out.filter(tocaFoco);
    outFoco.sort((a, b) => a.distDias - b.distDias || b.prob - a.prob || Math.abs(a.dif) - Math.abs(b.dif));

    return outFoco;
  }, [sugerir, result, dayCenter, tol, margenTipo, margenVal, sugDescartadas, tips, memPag, data.pagos, ccConc]);

  // auto-avance: si acabás de aceptar una sugerencia y el día se quedó sin más
  // sugerencias, pasar automáticamente al día pendiente siguiente.
  React.useEffect(() => {
    if (!autoAvanzar.current) return;
    autoAvanzar.current = false;
    if (sugerir && dayView && filterV === "pend" && sugerencias.length === 0) {
      const siguiente = pendingDays.filter((d) => d > dayCenter).sort()[0];
      if (siguiente) setDayCenter(siguiente);
    }
  }, [sugerencias]);

  // aplicar una sugerencia = conciliar ese par como manual
  function aplicarSugerencia(s) {
    if (!result) return;
    const ccIds = s.ingIds.filter((id) => id.startsWith("cc-"));
    const ccObjs = ccIds.map((id) => ccById[id.slice(3)]).filter(Boolean);
    const ccComoIng = ccObjs.map((p) => ({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, matchedWith: s.banIds, manual: true, matchTipo: "manual", manualDif: s.dif, ccCobranza: p.id }));
    const V = [...result.V.map((v) => s.ingIds.includes(v.id)
      ? { ...v, status: "ok", matchedWith: s.banIds, manual: true, matchTipo: "manual", manualDif: s.dif } : v), ...ccComoIng];
    if (ccObjs.length) setCcConc((st) => { const n = new Set(st); ccObjs.forEach((x) => n.add(x.id)); return n; });
    const B = result.B.map((b) => s.banIds.includes(b.id)
      ? { ...b, status: "ok", matchedWith: s.ingIds[0] || null, manual: true, manualDif: s.dif } : b);
    setResult({ V, B });
    aprenderPagadores([...result.V.filter((v) => s.ingIds.includes(v.id)), ...ccComoIng], result.B.filter((b) => s.banIds.includes(b.id)));
    // registrar la aprobada para listarla bajo su día y poder deshacerla
    const dia = (result.V.find((v) => v.id === s.ingIds[0]) || ccComoIng[0] || result.B.find((b) => b.id === s.banIds[0]) || {}).fecha || dayCenter;
    setAprobadas((prev) => [...prev, { key: s.key, ingIds: s.ingIds, banIds: s.banIds, dia, ingTotal: s.ingTotal, banTotal: s.banTotal, dif: s.dif }]);
    autoAvanzar.current = true; // si el día queda sin sugerencias, pasa al siguiente
    setSelIng(new Set()); setSelBan(new Set()); setSelCC(new Set()); // limpiar la marca de selección
    setSugActiva(null);
  }
  // deshacer una sugerencia aprobada: vuelve el par a pendiente
  function deshacerAprobada(ap) {
    if (!result) return;
    // efectivo reclasificado / cobranzas CC: no vuelven como pendientes, vuelven a su grupo
    const extra = ap.ingIds.filter((id) => id.startsWith("ef-") || id.startsWith("cc-"));
    const V = result.V.filter((v) => !extra.includes(v.id)).map((v) => ap.ingIds.includes(v.id)
      ? { ...v, status: "pend", matchedWith: [], manual: false, matchTipo: undefined, manualDif: undefined } : v);
    const efX = extra.filter((id) => id.startsWith("ef-")).map((id) => id.slice(3));
    const ccX = extra.filter((id) => id.startsWith("cc-")).map((id) => id.slice(3));
    if (efX.length) setEfecReclas((s) => { const n = new Set(s); efX.forEach((id) => n.delete(id)); return n; });
    if (ccX.length) { setCcConc((s) => { const n = new Set(s); ccX.forEach((id) => n.delete(id)); return n; }); olvidarCobranzas(ccX); setCcNoAuto((s) => { const n = new Set(s); ccX.forEach((id) => n.add(id)); return n; }); }
    const B = result.B.map((b) => ap.banIds.includes(b.id)
      ? { ...b, status: "pend", matchedWith: [], manual: false, matchTipo: undefined, manualDif: undefined } : b);
    setResult({ V, B });
    setAprobadas((prev) => prev.filter((a) => a.key !== ap.key));
  }
  function descartarSugerencia(s) { setSugDescartadas((set) => new Set(set).add(s.key)); setSugActiva(null); }
  // seleccionar una sugerencia: fija el resaltado y scrollea las DOS columnas al par
  function verSugerencia(i) {
    const s = sugerencias[i];
    if (sugActiva === i) { setSugActiva(null); setSelIng(new Set()); setSelBan(new Set()); setSelCC(new Set()); return; }
    setSugActiva(i);
    if (s) {
      // marcar los registros como seleccionados (celeste + tilde), igual que a mano
      const cc = s.ingIds.filter((id) => id.startsWith("cc-"));
      setSelIng(new Set(s.ingIds.filter((id) => !id.startsWith("cc-"))));
      setSelCC(new Set(cc.map((id) => id.slice(3))));
      if (cc.length) { const f = (ccById[cc[0].slice(3)] || {}).fecha; if (f) setCcOpen((st) => new Set(st).add(f)); }
      setSelBan(new Set(s.banIds));
      if (s.ingIds[0]) scrollTo(rowsVref, s.ingIds[0]);
      if (s.banIds[0]) scrollTo(rowsBref, s.banIds[0]);
    }
  }
  // ids resaltados por la sugerencia activa (para pintar en las tablas)
  const sugResaltados = React.useMemo(() => {
    if (sugActiva === null || !sugerencias[sugActiva]) return { ing: new Set(), ban: new Set() };
    const s = sugerencias[sugActiva];
    return { ing: new Set(s.ingIds), ban: new Set(s.banIds) };
  }, [sugActiva, sugerencias]);

  // totales de la barra: en Pendientes barriendo día a día → lo del DÍA en foco
  // (con referencia al total del período); en Todas/Conciliadas → lo PENDIENTE del período.
  const barTotals = React.useMemo(() => {
    if (!result) return { ing: 0, ban: 0, ctxIng: "", ctxBan: "" };
    const pendV = result.V.filter((v) => v.status === "pend");
    const pendB = result.B.filter((b) => b.status === "pend");
    const perIng = pendV.reduce((a, v) => a + v.imp, 0) + faltantes.reduce((a, f) => a + f.monto, 0);
    const perBan = pendB.reduce((a, b) => a + b.imp, 0);
    const enDia = dayView && filterV === "pend" && dayCenter;
    if (enDia) {
      const ing = pendV.filter((v) => v.fecha === dayCenter).reduce((a, v) => a + v.imp, 0)
        + faltantes.filter((f) => f.fecha === dayCenter).reduce((a, f) => a + f.monto, 0);
      const ban = pendB.filter((b) => b.fecha === dayCenter).reduce((a, b) => a + b.imp, 0);
      return { ing, ban, ctxIng: "pendientes del día", ctxBan: "pendientes del día", refIng: perIng, refBan: perBan,
        cntIng: pendV.filter((v) => v.fecha === dayCenter).length, cntBan: pendB.filter((b) => b.fecha === dayCenter).length,
        cntIngRef: pendV.length, cntBanRef: pendB.length };
    }
    return { ing: perIng, ban: perBan, ctxIng: "pendientes del período", ctxBan: "pendientes del período",
      cntIng: pendV.length, cntBan: pendB.length };
  }, [result, dayView, filterV, dayCenter, faltantes]);

  // pendientes agrupados por mes, para el panel de abajo (izq: comprobantes, der: pagos)
  const pendPorMes = React.useMemo(() => {
    const group = (rows) => {
      const m = {};
      (rows || []).filter((r) => r.status === "pend").forEach((r) => { const k = (r.fecha || "").slice(0, 7); (m[k] = m[k] || []).push(r); });
      return Object.keys(m).sort().map((k) => ({ mes: k, items: m[k], total: m[k].reduce((a, r) => a + r.imp, 0) }));
    };
    if (!result) return { ing: [], ban: [] };
    return { ing: group(result.V), ban: group(result.B) };
  }, [result]);

  // estructura unificada mes → día → {comprobantes, pagos}, para que la banda del día
  // sea una sola a lo ancho y al desplegar abra los dos lados a la vez
  const pendUnif = React.useMemo(() => {
    if (!result) return [];
    const M = {};
    const add = (r, side) => {
      if (r.status !== "pend" || !r.fecha) return;
      const mes = r.fecha.slice(0, 7);
      M[mes] = M[mes] || { mes, dias: {}, totIng: 0, totBan: 0 };
      const D = (M[mes].dias[r.fecha] = M[mes].dias[r.fecha] || { dia: r.fecha, ing: [], ban: [], totIng: 0, totBan: 0 });
      D[side].push(r); D[side === "ing" ? "totIng" : "totBan"] += r.imp;
      M[mes][side === "ing" ? "totIng" : "totBan"] += r.imp;
    };
    result.V.forEach((v) => add(v, "ing"));
    result.B.forEach((b) => add(b, "ban"));
    return Object.keys(M).sort().map((m) => ({ ...M[m], dias: Object.keys(M[m].dias).sort().map((d) => M[m].dias[d]) }));
  }, [result]);
  // los meses del panel de pendientes arrancan ABIERTOS
  React.useEffect(() => { if (pendUnif.length) setMesesPend(new Set(pendUnif.map((m) => m.mes))); }, [pendUnif.length]);
  // el panel "Pendientes por mes" sigue al día en foco: abre ese día y el siguiente (con
  // pendientes) y se actualiza a medida que navegás día a día.
  React.useEffect(() => {
    if (!dayCenter || !pendUnif.length) return;
    const allDays = pendUnif.flatMap((m) => m.dias.map((d) => d.dia)).sort();
    const next = allDays.filter((d) => d > dayCenter)[0];
    const set = new Set([dayCenter]);
    if (next) set.add(next);
    setDiasPend(set);
  }, [dayCenter, pendUnif]);

  // ── Selección múltiple para conciliación manual ──
  // totales y objetos de lo seleccionado en cada lado
  const selIngTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.V.filter((v) => selIng.has(v.id)).reduce((a, v) => a + v.imp, 0) + selEfecTotal + selCCTotal;
  }, [result, selIng, selEfecTotal, selCCTotal]);
  const selBanTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.B.filter((b) => selBan.has(b.id)).reduce((a, b) => a + (b.imp - tipDe(b)), 0);
  }, [result, selBan, tips]);
  const haySeleccion = selIng.size > 0 || selBan.size > 0 || selEfec.size > 0 || selCC.size > 0;

  // refs para auto-scroll
  const rowsVref = React.useRef(null);
  const rowsBref = React.useRef(null);
  function scrollTo(containerRef, rowId) {
    const cont = containerRef.current;
    if (!cont || !rowId) return;
    const el = cont.querySelector('[data-rowid="' + rowId + '"]');
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  // resaltado cruzado en vistas de conciliados: al tocar un registro, marcar su par
  const [parV, setParV] = React.useState(new Set()); // ids de ingreso resaltados
  const [parB, setParB] = React.useState(new Set()); // ids de banco resaltados (su par)
  // si resaltás algo que está dentro del grupo, se abre solo
  React.useEffect(() => {
    if (!ccSplit) return;
    if (ccSplit.ingCC.some((v) => parV.has(v.id)) || ccSplit.banCC.some((b) => parB.has(b.id))) setCcListaOpen(true);
  }, [parV, parB]);
  // dado un registro conciliado, devuelve el CLUSTER completo (todos los ingresos
  // y todos los movimientos de banco conectados), sin importar la dirección del match.
  function clusterOf(rec, side) {
    if (!result) return { ingIds: [], banIds: [] };
    const { V } = result;
    const banIds = new Set(side === "ban" ? [rec.id] : (rec.matchedWith || []));
    const ingIds = new Set();
    // expandir hasta cubrir todo el componente conectado
    for (let pasada = 0; pasada < 3; pasada++) {
      V.forEach((v) => {
        if (v.status !== "ok") return;
        if ((v.matchedWith || []).some((id) => banIds.has(id))) {
          ingIds.add(v.id);
          (v.matchedWith || []).forEach((id) => banIds.add(id));
        }
      });
    }
    return { ingIds: [...ingIds], banIds: [...banIds] };
  }
  // tocar un INGRESO conciliado → resaltar todo el cluster y scrollear al banco
  function verParDeIngreso(v) {
    if (v.status !== "ok") return;
    const { ingIds, banIds } = clusterOf(v, "ing");
    setParV(new Set(ingIds)); setParB(new Set(banIds));
    if (banIds[0]) scrollTo(rowsBref, banIds[0]);
  }
  // tocar un MOVIMIENTO de banco conciliado → resaltar todo el cluster y scrollear al ingreso
  function verParDeBanco(b) {
    if (b.status !== "ok" || !b.matchedWith) return;
    const { ingIds, banIds } = clusterOf(b, "ban");
    setParV(new Set(ingIds)); setParB(new Set(banIds));
    if (ingIds[0]) scrollTo(rowsVref, ingIds[0]);
  }
  // ── Buscadores ──
  // comprobante / cliente: busca en ventas (pendientes y conciliadas), efectivo y cobranzas de CC
  const resComp = React.useMemo(() => {
    const q = busqComp.trim().toLowerCase();
    if (q.length < 2 || !result) return [];
    const soloNum = /^[\d.,$\s]+$/.test(q); const qn = q.replace(/[^\d]/g, "");
    const hit = (comp, cli, imp) => (comp && String(comp).toLowerCase().includes(q)) || (cli && String(cli).toLowerCase().includes(q)) || (soloNum && qn.length >= 3 && String(imp).includes(qn));
    const out = [];
    result.V.forEach((v) => { if (hit(v.comp, v.cliente, v.imp)) out.push({ tipo: "ing", row: v, fecha: v.fecha, hora: v.hora, nombre: v.cliente, comp: v.comp, imp: v.imp, estado: v.status === "ok" ? "ok" : "pend", forma: v.origen === "cc" ? "Cta. cte." : v.origen === "efec" ? "Efectivo" : "MercadoPago" }); });
    Object.values(efecById).forEach((f) => { if (!efecReclas.has(f.id) && hit(f.comp, f.cli, f.total)) out.push({ tipo: "efec", row: f, fecha: f.fecha, hora: f.hora, nombre: f.cli, comp: f.comp, imp: f.total, estado: "efec", forma: "Efectivo" }); });
    (data.pagos || []).forEach((x) => { if (esMP(x) && !ccConc.has(x.id) && hit(x.comp, x.cliente, x.imp)) out.push({ tipo: "cc", row: x, fecha: x.fecha, hora: x.hora, nombre: x.cliente, comp: x.comp, imp: x.imp, estado: "cc", forma: "Cta. cte." }); });
    return out.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.hora || "").localeCompare(b.hora || "")).slice(0, 40);
  }, [busqComp, result, efecById, efecReclas, data.pagos, ccConc]);
  // pago por importe (exacto primero, después los más cercanos ±1%); con texto busca por pagador
  const resPago = React.useMemo(() => {
    const q = busqPago.trim();
    if (!q || !result) return [];
    const mk = (b) => ({ tipo: "ban", row: b, fecha: b.fecha, hora: b.hora, nombre: b.cliente || b.medio || "", comp: "", imp: b.imp, estado: b.status === "ok" ? "ok" : "pend", forma: b.medio || "" });
    const qn = parseInt(q.replace(/,\d{1,2}$/, "").replace(/[^\d]/g, ""), 10);
    if (!qn || /[a-zA-Z]/.test(q)) {
      const ql = q.toLowerCase(); if (ql.length < 2) return [];
      return result.B.filter((b) => (b.cliente || "").toLowerCase().includes(ql)).slice(0, 40).map(mk);
    }
    const tolI = Math.max(1, Math.round(qn * 0.01));
    return result.B.filter((b) => Math.abs(b.imp - qn) <= tolI || (String(qn).length >= 4 && String(b.imp).includes(String(qn))))
      .sort((a, b) => Math.abs(a.imp - qn) - Math.abs(b.imp - qn) || a.fecha.localeCompare(b.fecha)).slice(0, 40).map(mk);
  }, [busqPago, result]);
  // ir a un resultado: los pendientes quedan TILDADOS en su día (listos para conciliar);
  // los conciliados se muestran resaltados con su par en Conciliadas.
  function irAResultado(r) {
    if (!r) return;
    if (r.tipo === "ban") setBusqPago(""); else setBusqComp("");
    if (r.tipo === "efec") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha); setEfectivoOpen((s) => new Set(s).add(r.fecha)); setSelEfec((s) => new Set(s).add(r.row.id));
    } else if (r.tipo === "cc") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha); setCcOpen((s) => new Set(s).add(r.fecha)); setSelCC((s) => new Set(s).add(r.row.id));
    } else if (r.row.status === "pend") {
      if (!(dayView && filterV === "pend")) goTab("pend");
      setDayCenter(r.fecha);
      if (r.tipo === "ing") setSelIng((s) => new Set(s).add(r.row.id)); else setSelBan((s) => new Set(s).add(r.row.id));
      setTimeout(() => scrollTo(r.tipo === "ing" ? rowsVref : rowsBref, r.row.id), 150);
    } else {
      goTab("ok"); setLimiteFilas(100000);
      setTimeout(() => {
        if (r.tipo === "ing") { verParDeIngreso(r.row); scrollTo(rowsVref, r.row.id); }
        else { verParDeBanco(r.row); scrollTo(rowsBref, r.row.id); }
        setTimeout(() => scrollTo(r.tipo === "ing" ? rowsVref : rowsBref, r.row.id), 120); // por si se abrió el grupo de cta. cte.
      }, 150);
    }
  }

  // totales del cluster resaltado en Conciliadas (al tocar un registro conciliado)
  const hlIngTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.V.filter((v) => parV.has(v.id)).reduce((a, v) => a + v.imp, 0);
  }, [result, parV]);
  const hlBanTotal = React.useMemo(() => {
    if (!result) return 0;
    return result.B.filter((b) => parB.has(b.id)).reduce((a, b) => a + b.imp, 0);
  }, [result, parB]);
  const hayHighlight = filterV !== "pend" && (parV.size > 0 || parB.size > 0);

  // toggles de selección (multi, ambos lados)
  function toggleIng(id) { setSelIng((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleBan(id) { setSelBan((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  // seleccionar/deseleccionar un grupo entero de banco (todos sus ids)
  function toggleBanGroup(ids) {
    setSelBan((s) => {
      const n = new Set(s);
      const todosSel = ids.every((id) => n.has(id));
      ids.forEach((id) => todosSel ? n.delete(id) : n.add(id));
      return n;
    });
  }
  function limpiarSeleccion() {
    setSelIng(new Set()); setSelBan(new Set()); setSelEfec(new Set()); setSelCC(new Set());
    if (editSnap.current) { // estábamos editando y se canceló → restaurar y volver a Conciliadas
      setResult(editSnap.current);
      // re-sincronizar los grupos (CC / efectivo) con lo que vuelve a estar conciliado
      setCcConc(new Set(editSnap.current.V.filter((v) => v.status === "ok" && String(v.id).startsWith("cc-")).map((v) => v.id.slice(3))));
      setEfecReclas(new Set(editSnap.current.V.filter((v) => v.status === "ok" && String(v.id).startsWith("ef-")).map((v) => v.id.slice(3))));
      { const snap = editSnap.current; const pares = [];
        snap.V.filter((v) => v.status === "ok" && String(v.id).startsWith("cc-")).forEach((v) => (v.matchedWith || []).forEach((bid) => { const b = snap.B.find((x) => x.id === bid); if (b && b.cliente) pares.push({ cli: v.cliente, pag: b.cliente, fecha: b.fecha, ref: refCob(v) + "@" + refBan(b) }); }));
        grabarPagadores(pares); }
      editSnap.current = null;
      setFilterV("ok"); setFilterB("ok"); setSubFilterV("all"); setDayView(false);
    }
  }

  // conciliar lo seleccionado (se permite aunque no coincidan los totales)
  function conciliarManual() {
    if (!result || (selIng.size === 0 && selBan.size === 0 && selEfec.size === 0 && selCC.size === 0)) return;
    const ingIds = [...selIng], banIds = [...selBan];
    // el efectivo tildado se reclasifica: se convierte en ingreso conciliado y sale del grupo de efectivo
    const efecObjs = [...selEfec].map((id) => efecById[id]).filter(Boolean);
    const efecComoIng = efecObjs.map((f) => ({ id: "ef-" + f.id, origen: "efec", status: "ok", cliente: f.cli, comp: f.comp, imp: f.total, fecha: f.fecha, hora: f.hora, matchedWith: banIds, manual: true, matchTipo: "efectivo reclasificado", reclasEfec: true }));
    // las cobranzas de cuenta corriente tildadas se concilian contra su pago y quedan marcadas en su grupo
    const ccObjs = [...selCC].map((id) => ccById[id]).filter(Boolean);
    const ccComoIng = ccObjs.map((p) => ({ id: "cc-" + p.id, origen: "cc", status: "ok", cliente: p.cliente, comp: p.comp, imp: p.imp, fecha: p.fecha, hora: p.hora, cobro: p.cobro, matchedWith: banIds, manual: true, matchTipo: "manual", ccCobranza: p.id }));
    const ingObjs = [...result.V.filter((v) => selIng.has(v.id)), ...efecComoIng, ...ccComoIng];
    const totIng = ingObjs.reduce((a, v) => a + v.imp, 0);
    const totBan = result.B.filter((b) => selBan.has(b.id)).reduce((a, b) => a + (b.imp - tipDe(b)), 0);
    const diferencia = totIng - totBan; // + = falta que entre al banco (sin acreditar)
    const allIngIds = [...ingIds, ...efecComoIng.map((v) => v.id), ...ccComoIng.map((v) => v.id)];
    const V = [...result.V.map((v) => selIng.has(v.id)
      ? { ...v, status: "ok", matchedWith: banIds, manual: true, matchTipo: "manual", manualDif: diferencia } : v),
      ...efecComoIng.map((v) => ({ ...v, manualDif: diferencia })), ...ccComoIng.map((v) => ({ ...v, manualDif: diferencia }))];
    const B = result.B.map((b) => selBan.has(b.id)
      ? { ...b, status: "ok", matchedWith: allIngIds[0] || null, manual: true, manualDif: diferencia } : b);
    setResult({ V, B });
    if (efecObjs.length) setEfecReclas((s) => { const n = new Set(s); efecObjs.forEach((f) => n.add(f.id)); return n; });
    if (ccObjs.length) setCcConc((s) => { const n = new Set(s); ccObjs.forEach((x) => n.add(x.id)); return n; });
    aprenderPagadores(ingObjs, result.B.filter((b) => selBan.has(b.id)));
    const diaM = ingObjs[0] ? ingObjs[0].fecha : (result.B.find((b) => selBan.has(b.id)) || {}).fecha;
    setAprobadas((prev) => [...prev, { key: "m" + Date.now(), ingIds: allIngIds, banIds, dia: diaM, ingTotal: totIng, banTotal: totBan, dif: diferencia }]);
    // acreditar → se registra como faltante del lado ingresos, ligado a la conciliación
    if (diferencia > 0) {
      const fecha = ingObjs[0] ? ingObjs[0].fecha : null;
      const desc = "resto de conciliación de " + fmt(totIng);
      setFaltantes((fs) => [...fs, { id: "f" + Date.now(), fecha, monto: diferencia, origenDesc: desc, ingId: allIngIds[0] }]);
    }
    editSnap.current = null; // conciliación confirmada: ya no se puede "cancelar la edición"
    limpiarSeleccion();
  }

  function exportar() {
    if (!result || !xlsxReady) return;
    const { V, B } = result;
    const wb = window.XLSX.utils.book_new();
    const vData = V.map((v) => ({ Fecha: v.fecha, Origen: v.origen === "cc" ? "Cuenta corriente" : "Venta POS", Cliente: v.cliente || "",
      Comprobante: v.comp || "", Importe: v.imp, Estado: v.status === "ok" ? "Conciliado" : "Pendiente",
      Tipo: v.matchTipo || "", Movimientos: (v.matchedWith || []).length, Manual: v.manual ? "Sí" : "" }));
    const bData = B.map((b) => ({ Fecha: b.fecha, Pagador: b.cliente || "", Medio: b.medio, Importe: b.imp,
      Estado: b.status === "ok" ? "Conciliado" : "Pendiente", Manual: b.manual ? "Sí" : "" }));
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(vData), "Ingresos");
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(bData), "Banco");
    window.XLSX.writeFile(wb, "conciliacion.xlsx");
  }

  // LISTADO DE CONTROL: cobros de cuenta corriente que el ERP registra por MercadoPago y
  // que no aparecen en el banco (no se pudieron conciliar). Un renglón por cliente y fecha
  // de pago; adentro, los tickets que cancela. Para que caja los revise uno por uno.
  const controlCC = React.useMemo(() => {
    if (!result) return { filas: [], total: 0, cobros: 0 };
    const g = {};
    (data.pagos || []).filter((p) => esMP(p) && !ccConc.has(p.id) && inRange(p.fecha)).forEach((p) => {
      const k = p.fecha + "|" + cliKey(p.cliente); (g[k] = g[k] || []).push(p);
    });
    const filas = Object.values(g).map((ps) => ({ fecha: ps[0].fecha, cliente: ps[0].cliente, items: ps, total: ps.reduce((a, p) => a + p.imp, 0) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || b.total - a.total);
    return { filas, total: filas.reduce((a, f) => a + f.total, 0), cobros: filas.reduce((a, f) => a + f.items.length, 0) };
  }, [result, data.pagos, ccConc, desde, hasta]);
  function exportarControl() {
    if (!xlsxReady || !controlCC.filas.length) return;
    const rows = [];
    controlCC.filas.forEach((f) => f.items.forEach((p) => rows.push({ "Fecha de pago (ERP)": p.fecha, Cliente: p.cliente || "", Ticket: p.comp || "", "Fecha del ticket": p.fechaFact || "", Importe: p.imp, "Forma (ERP)": "MercadoPago", Estado: "Sin pago en el banco", "Revisado por caja": "", Observación: "" })));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), "Control CC");
    window.XLSX.writeFile(wb, "control-cuenta-corriente-" + (desde || "periodo") + ".xlsx");
  }

  // ── Lazarillo (14/11): guardado automático del trabajo de cada período en el servidor ──
  // Se guarda compacto: de cada fila que vino de un archivo, solo su estado de conciliación
  // (las filas en sí ya están guardadas como fuentes); las filas que crea el módulo (cobranzas
  // conciliadas "cc-", efectivo reclasificado "ef-", forma corregida "fv-") van enteras.
  // Al volver a abrir el período: se recalcula igual que siempre y encima se aplica lo guardado.
  const periodoKey = (desde || "") + "|" + (hasta || "");
  const restaurarRef = React.useRef(null);   // { periodo, estado } esperando a que haya resultado
  const listoRef = React.useRef(null);       // período ya revisado: desde ahí se guarda solo
  const [restaurarTick, setRestaurarTick] = React.useState(0);
  const CAMPOS_ESTADO = ["status", "matchedWith", "matchTipo", "manual", "manualDif", "autoDif", "porHora", "serieNota", "serieMult"];
  const compactar = (rows, baseIds) => {
    const est = {}, extra = [];
    (rows || []).forEach((r) => {
      if (!baseIds.has(r.id)) { extra.push(r); return; }
      const o = {}; CAMPOS_ESTADO.forEach((k) => { if (r[k] !== undefined && r[k] !== null) o[k] = r[k]; });
      est[r.id] = o;
    });
    return { est, extra };
  };
  const mismaConfig = (e) => e && e.tol === tol && e.autoMargenVal === autoMargenVal && e.autoMargenTipo === autoMargenTipo;

  // 1) al cambiar de período, se busca si había trabajo guardado
  React.useEffect(() => {
    listoRef.current = null; restaurarRef.current = null;
    if (!persist || !persist.cargarEstado || !(data.ventas && data.banco) || !desde || !hasta) return;
    const periodo = periodoKey; let vivo = true;
    persist.cargarEstado(periodo).then((est) => {
      if (!vivo) return;
      if (!est) { listoRef.current = periodo; return; }
      // la configuración primero (eso recalcula); el resto se aplica cuando haya resultado
      if (typeof est.tol === "number" && est.tol !== tol) setTol(est.tol);
      if (est.autoMargenVal != null && est.autoMargenVal !== autoMargenVal) setAutoMargenVal(est.autoMargenVal);
      if (est.autoMargenTipo && est.autoMargenTipo !== autoMargenTipo) setAutoMargenTipo(est.autoMargenTipo);
      if (est.margenVal != null) setMargenVal(est.margenVal);
      if (est.margenTipo) setMargenTipo(est.margenTipo);
      restaurarRef.current = { periodo, estado: est };
      setRestaurarTick((n) => n + 1);
    }).catch(() => { if (vivo) listoRef.current = periodo; });
    return () => { vivo = false; };
     
  }, [periodoKey, !!(data.ventas && data.banco)]);

  // 2) cuando ya hay resultado con la misma configuración, se aplica lo guardado
  React.useEffect(() => {
    const r = restaurarRef.current;
    if (!r || !result || r.periodo !== periodoKey || !mismaConfig(r.estado)) return;
    restaurarRef.current = null;
    const e = r.estado;
    // Solo las filas que vienen de los archivos; las que arma el módulo (cobranzas "cc-" de la
    // conciliación automática, etc.) se reemplazan por las guardadas, para no duplicarlas.
    const aplicar = (rows, base, est, extra) => [
      ...rows.filter((x) => base.has(x.id)).map((x) => (est && est[x.id]
        ? { ...x, matchedWith: Array.isArray(x.matchedWith) ? [] : null, matchTipo: null, manual: false, manualDif: undefined, autoDif: undefined, porHora: false, serieNota: undefined, serieMult: undefined, ...est[x.id] }
        : x)),
      ...(extra || []),
    ];
    const baseV = new Set((data.ventas || []).map((x) => x.id));
    const baseB = new Set((data.banco || []).map((x) => x.id));
    setResult({ V: aplicar(result.V, baseV, e.V, e.Vextra), B: aplicar(result.B, baseB, e.B, e.Bextra) });
    setTips(e.tips || {}); setAprobadas(e.aprobadas || []); setFaltantes(e.faltantes || []);
    setNotas(e.notas || {});
    setEfecReclas(new Set(e.efecReclas || [])); setSugDescartadas(new Set(e.sugDescartadas || []));
    setFormaOverride(e.formaOverride || {}); setCcConc(new Set(e.ccConc || [])); setCcNoAuto(new Set(e.ccNoAuto || []));
    listoRef.current = periodoKey;
     
  }, [result, restaurarTick]);

  // 3) cada cambio se guarda solo (con una pausa corta para no mandar uno por clic)
  React.useEffect(() => {
    if (!persist || !persist.guardarEstado || !result || listoRef.current !== periodoKey) return;
    const periodo = periodoKey;
    const t = setTimeout(() => {
      if (listoRef.current !== periodo) return;
      const baseV = new Set((data.ventas || []).map((x) => x.id));
      const baseB = new Set((data.banco || []).map((x) => x.id));
      const cv = compactar(result.V, baseV), cb = compactar(result.B, baseB);
      persist.guardarEstado(periodo, {
        v: 2, tol, autoMargenVal, autoMargenTipo, margenVal, margenTipo,
        V: cv.est, Vextra: cv.extra, B: cb.est, Bextra: cb.extra,
        tips, aprobadas, faltantes, notas, efecReclas: [...efecReclas], sugDescartadas: [...sugDescartadas],
        formaOverride, ccConc: [...ccConc], ccNoAuto: [...ccNoAuto],
      });
    }, 1500);
    return () => clearTimeout(t);
     
  }, [result, tips, aprobadas, faltantes, notas, efecReclas, sugDescartadas, formaOverride, ccConc, ccNoAuto, margenVal, margenTipo]);

  // Guardar / cargar el TRABAJO (conciliaciones, propinas, notas, reclasificaciones) en
  // un archivo. Persistencia manual y portable; la automática irá en el Shell/backend.
  function guardarEstado() {
    if (!result) return;
    const estado = { v: 1, guardado: new Date().toISOString(), desde, hasta, tol, autoMargenVal, autoMargenTipo, margenVal, margenTipo,
      result, tips, aprobadas, faltantes, notas, memPag, efecReclas: [...efecReclas], sugDescartadas: [...sugDescartadas], formaOverride, ccConc: [...ccConc], ccNoAuto: [...ccNoAuto], facturasCC };
    const blob = new Blob([JSON.stringify(estado)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "conciliacion-" + (desde || "estado") + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function cargarEstado(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const s = JSON.parse(e.target.result);
        if (!s.result) throw new Error("sin estado");
        if (s.desde) setDesde(s.desde); if (s.hasta) setHasta(s.hasta);
        if (typeof s.tol === "number") setTol(s.tol);
        if (s.autoMargenVal != null) setAutoMargenVal(s.autoMargenVal);
        if (s.autoMargenTipo) setAutoMargenTipo(s.autoMargenTipo);
        if (s.margenVal != null) setMargenVal(s.margenVal);
        if (s.margenTipo) setMargenTipo(s.margenTipo);
        setResult(s.result);
        setTips(s.tips || {}); setAprobadas(s.aprobadas || []); setFaltantes(s.faltantes || []);
        setNotas(s.notas || {}); if (s.memPag || s.pagMap) setMemPag((m) => ({ ...m, ...memDesdeProp(s.memPag || s.pagMap) }));
        setEfecReclas(new Set(s.efecReclas || [])); setSugDescartadas(new Set(s.sugDescartadas || [])); setFormaOverride(s.formaOverride || {}); setCcConc(new Set(s.ccConc || [])); setCcNoAuto(new Set(s.ccNoAuto || []));
        if (s.facturasCC) setFacturasCC(s.facturasCC);
        limpiarSeleccion();
      } catch (err) { window.alert("No se pudo leer el archivo de estado (¿es un archivo guardado desde acá?)."); }
    };
    reader.readAsText(file);
  }

  const color = (business && business.color) || C.celeste;
  const onColor = (() => {
    try { const h = color.replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? C.tinta : "#ffffff"; } catch (e) { return "#ffffff"; }
  })();
  const allLoaded = !!(data.ventas && data.pagos && data.banco);
  // props de propina para un movimiento de banco (por id)
  const tipProps = (b) => ({
    tip: tipDe(b), tipImp: b.imp, tipEditing: tipEdit === b.id,
    // si hay selección de los dos lados y este movimiento está seleccionado, el default
    // de la propina es la diferencia (lo que el banco tiene "de más" sobre el ingreso).
    defaultDif: (selBan.has(b.id) && (selIng.size + selEfec.size + selCC.size) > 0) ? Math.max(0, Math.round(selBanTotal - selIngTotal)) : 0,
    onToggleTip: () => setTipEdit(tipEdit === b.id ? null : b.id),
    onSaveTip: (amt) => { setTips((t) => ({ ...t, [b.id]: Math.max(0, Math.min(amt || 0, b.imp)) })); setTipEdit(null); },
    onTodoTip: () => { setTips((t) => ({ ...t, [b.id]: b.imp })); setTipEdit(null); },
    onQuitarTip: () => { setTips((t) => { const n = { ...t }; n[b.id] = 0; return n; }); setTipEdit(null); },
  });
  // props para editar la forma de pago de un comprobante (corregir errores de carga)
  const formaProps = (row) => ({
    formaEditing: formaEdit === row.comp,
    formaActual: formaReal(row.comp, (row.c === "efec" || row.origen === "efec") ? "efec" : "mp"),
    onToggleForma: () => setFormaEdit(formaEdit === row.comp ? null : row.comp),
    onSetForma: (nueva) => cambiarForma(row, nueva),
  });
  // diferencia comprobantes vs pagos con formato de más / de menos (para las bandas)
  const difPend = (totIng, totBan) => { const d = totIng - totBan; const verde = d <= 0;
    return <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: verde ? C.green : C.red, whiteSpace: "nowrap" }}>{d === 0 ? "$0" : (d > 0 ? "-" : "") + fmt(Math.abs(d)) + (d < 0 ? " de más" : " de menos")}</span>;
  };
  // props de observación para una fila/registro (por id)
  const notaProps = (id) => ({
    nota: notas[id], notaEditing: notaEdit === id,
    onToggleNota: () => setNotaEdit(notaEdit === id ? null : id),
    onSaveNota: (t) => {
      // si el registro es parte de una selección de varios, la nota va a todos
      const sel = new Set([...selIng, ...selBan]);
      const targets = (sel.has(id) && sel.size > 1) ? [...sel] : [id];
      setNotas((n) => { const c = { ...n }; targets.forEach((k) => { if (t) c[k] = t; else delete c[k]; }); return c; });
      setNotaEdit(null);
    },
  });
  const resumenPeriodo = mesActivo
    ? (MESES_ES[parseInt(mesActivo.split("-")[1]) - 1] + " " + mesActivo.split("-")[0])
    : (desde && hasta ? (fmtFecha(desde) + " → " + fmtFecha(hasta)) : "período completo");

  return (
    <div onClick={(e) => {
        const haySel = selIng.size || selBan.size || selEfec.size || selCC.size;
        const hayHl = parV.size || parB.size;
        if (!haySel && !hayHl) return;
        const t = e.target;
        if (t && t.closest && (t.closest("[data-rowid]") || t.closest("button") || t.closest("input") || t.closest("select") || t.closest("textarea") || t.closest("[data-keep-sel]"))) return;
        if (haySel) limpiarSeleccion();
        if (hayHl) { setParV(new Set()); setParB(new Set()); }
      }} style={{ fontFamily: "'Archivo',sans-serif", background: C.paper, minHeight: "100%", color: C.txt }}>
      <style>{".cx-row .cx-note{opacity:0;transition:opacity .12s}.cx-row:hover .cx-note{opacity:.6}.cx-row .cx-note.has{opacity:1}.cx-row .cx-note:hover{opacity:1}"}</style>
      {/* Header con la estética del Home/Shell. Si el módulo va dentro del Shell
          (embedded), no se muestra porque el Shell ya pone su propio header. */}
      {!embedded && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", background: color }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: onColor, letterSpacing: ".2px" }}>Conciliación bancaria</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,.22)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 11, padding: "5px 12px 5px 6px" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: C.white, display: "inline-flex", alignItems: "center", justifyContent: "center", color: color, fontWeight: 800, fontSize: 10, fontFamily: "'Sora',sans-serif" }}>{business.initials}</span>
              <span style={{ lineHeight: 1.12 }}>
                <span style={{ display: "block", fontSize: 8.5, color: onColor, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>{business.group}</span>
                <span style={{ display: "block", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: onColor }}>{business.name}</span>
              </span>
              <span style={{ color: onColor, opacity: 0.7, fontSize: 11 }}>{"\u25BE"}</span>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,.32)", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{"\u2699\uFE0F"}</div>
            <div style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,.32)", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{"\uD83D\uDD14"}</div>
          </div>
        </header>
      )}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 22 }}>
        <p style={{ fontSize: 15, color: C.txt2, marginTop: 0, marginBottom: 20 }}>
          Cruzá las ventas del POS (no efectivo) y las cobranzas de cuenta corriente con los movimientos del banco. Lo que no cierre automático, lo conciliás a mano.
        </p>

        {/* SETUP: fuentes + período + config (tolerancia y margen). Se minimiza cuando está todo cargado. */}
        {allLoaded && !setupOpen ? (
          <div onClick={() => setSetupOpen(true)} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: C.white, border: "1px solid " + C.line2, borderRadius: 12, padding: "10px 16px", marginBottom: 14, cursor: "pointer" }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: C.green }}>✓ Fuentes cargadas</span>
            <span style={{ fontSize: 13, color: C.txt2 }}>{resumenPeriodo}</span>
            <span style={{ fontSize: 12.5, color: C.txt3 }}>tol {tol === 0 ? "mismo día" : "± 1 día"} · auto {autoMargenVal}{autoMargenTipo === "pct" ? "%" : "$"} · sugerencias {margenVal}{margenTipo === "pct" ? "%" : "$"}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={(e) => { e.stopPropagation(); guardarEstado(); }} title="Descargar un archivo con tu trabajo (conciliaciones, propinas, notas)" style={{ border: "1px solid " + C.line2, background: C.white, color: C.txt2, borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>💾 Guardar</button>
              <button onClick={(e) => { e.stopPropagation(); estadoFileRef.current && estadoFileRef.current.click(); }} title="Cargar un estado guardado" style={{ border: "1px solid " + C.line2, background: C.white, color: C.txt2, borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📂 Cargar</button>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, color: C.celesteDeep }}>▾ Editar fuentes y período</span>
            </span>
            <input ref={estadoFileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onClick={(e) => e.stopPropagation()} onChange={(e) => { const f = e.target.files && e.target.files[0]; cargarEstado(f); e.target.value = ""; }} />
          </div>
        ) : (
          <>
            {/* UPLOADERS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
              {FUENTES.map((f) => (
                <UploaderCard key={f.key} fuente={f} loaded={data[f.key]} onOpen={() => setModal(f)} />
              ))}
            </div>

            {/* PERÍODO + CONFIG */}
            {months.length > 0 && (
              <div style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                  {months.map((ym) => {
                    const [y, m] = ym.split("-");
                    const on = ym === mesActivo;
                    return (
                      <button key={ym} onClick={() => selectMonth(ym)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, padding: "5px 13px", borderRadius: 16, border: "1px solid " + (on ? C.celeste : C.line2), background: on ? C.celeste : C.white, color: on ? C.noche : C.txt2, cursor: "pointer" }}>
                        {MESES_ES[parseInt(m) - 1] + " " + y}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <Field label="Desde"><input type="date" value={desde || ""} onChange={(e) => { setMesActivo(null); setDesde(e.target.value); }} style={inputStyle} /></Field>
                  <Field label="Hasta"><input type="date" value={hasta || ""} onChange={(e) => { setMesActivo(null); setHasta(e.target.value); }} style={inputStyle} /></Field>
                  <button onClick={() => { if (allDates.length) { setMesActivo(null); setDesde(allDates[0]); setHasta(allDates[allDates.length - 1]); } }} style={ghostBtn}>Todo el período</button>
                  <div style={{ width: 1, alignSelf: "stretch", background: C.line, margin: "2px 4px" }} />
                  <div><label style={fldLbl}>Tolerancia fecha</label><br />
                    <select value={tol} onChange={(e) => setTol(parseInt(e.target.value))} style={inputStyle}>
                      <option value={0}>Mismo día</option><option value={1}>± 1 día</option>
                    </select>
                  </div>
                  <div><label style={fldLbl}>Auto-conciliar <InfoTip text={"Todos los movimientos con diferencia de " + autoMargenVal + (autoMargenTipo === "pct" ? "%" : "$") + " o menos se concilian automáticamente, según las reglas definidas."} /></label><br />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <input type="number" value={autoMargenVal} onChange={(e) => setAutoMargenVal(Math.max(0, parseFloat(e.target.value) || 0))} title="Debajo de este margen, se concilia automáticamente" style={{ width: 62, fontFamily: "'Archivo',sans-serif", fontSize: 14, padding: "7px 8px", borderRadius: 8, border: "1px solid " + C.line2 }} />
                      <select value={autoMargenTipo} onChange={(e) => setAutoMargenTipo(e.target.value)} style={{ fontFamily: "'Archivo',sans-serif", fontSize: 14, padding: "7px 6px", borderRadius: 8, border: "1px solid " + C.line2, cursor: "pointer" }}>
                        <option value="monto">$</option><option value="pct">%</option>
                      </select>
                    </div>
                  </div>
                  <div><label style={fldLbl}>Margen sugerencias <InfoTip text={"Todos los movimientos con diferencia de entre " + autoMargenVal + (autoMargenTipo === "pct" ? "%" : "$") + " y " + margenVal + (margenTipo === "pct" ? "%" : "$") + " se recomiendan como sugerencias, según las reglas definidas."} /></label><br />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <input type="number" value={margenVal} onChange={(e) => setMargenVal(Math.max(0, parseInt(e.target.value) || 0))} title="Debajo de este margen, se sugiere para revisar" style={{ width: 62, fontFamily: "'Archivo',sans-serif", fontSize: 14, padding: "7px 8px", borderRadius: 8, border: "1px solid " + C.line2 }} />
                      <select value={margenTipo} onChange={(e) => setMargenTipo(e.target.value)} style={{ fontFamily: "'Archivo',sans-serif", fontSize: 14, padding: "7px 6px", borderRadius: 8, border: "1px solid " + C.line2, cursor: "pointer" }}>
                        <option value="monto">$</option><option value="pct">%</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!xlsxReady && <div style={{ marginBottom: 14 }}><span style={{ fontSize: 13.5, color: C.amber }}>⚠️ Falta cargar SheetJS (window.XLSX) para leer archivos.</span></div>}
            {allLoaded && (
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setSetupOpen(false)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, padding: "5px 12px", borderRadius: 8, border: "1px solid " + C.line2, background: "transparent", color: C.txt3, cursor: "pointer" }}>▴ Minimizar</button>
              </div>
            )}
          </>
        )}

        {/* RESULTADOS */}
        {result && kpis && view && (
          <>

            {/* Panel de sugerencias de conciliación (con navegación de día) — arriba del flotante */}
            {sugerir && dayView && (
              <div data-keep-sel>
              <SugerenciasPanel sugerencias={sugerencias} activa={sugActiva}
                dayCenter={dayCenter} onMoveDay={moveDay}
                canPrev={pendingDays.some((d) => d < dayCenter)} canNext={pendingDays.some((d) => d > dayCenter)}
                onSelect={verSugerencia} onAplicar={aplicarSugerencia} onDescartar={descartarSugerencia} />
              </div>
            )}

            {/* Buscadores: comprobante (izq, sobre ingresos) y pago por importe (der, sobre banco) */}
            <div data-keep-sel style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12, position: "relative", zIndex: 45 }}>
              <BuscadorBox icon={"\uD83D\uDD0E"} placeholder="Buscar comprobante o cliente (ej. 0001-00149895, Guccione)" value={busqComp} onChange={setBusqComp} results={resComp} onPick={irAResultado} lado="ing" />
              <BuscadorBox icon={"\uD83D\uDD0E"} placeholder="Buscar pago por importe (ej. 15600) o pagador" value={busqPago} onChange={setBusqPago} results={resPago} onPick={irAResultado} lado="ban" />
            </div>

            {/* Barra comparativa: sticky para no perderla (ni Conciliar) al scrollear.
                Se destaca con una sombra celeste más fuerte cuando hay selección. */}
            <div data-keep-sel style={{ position: "sticky", top: 8, zIndex: 40, filter: (haySeleccion || hayHighlight) ? "drop-shadow(0 8px 26px rgba(91,194,234,.5))" : "drop-shadow(0 5px 16px rgba(21,33,62,.18))", transition: "filter .18s" }}>
            <DayCompareBar ing={barTotals.ing} ban={barTotals.ban} ctxIng={barTotals.ctxIng} ctxBan={barTotals.ctxBan}
              refIng={barTotals.refIng} refBan={barTotals.refBan}
              cntIng={barTotals.cntIng} cntBan={barTotals.cntBan} cntIngRef={barTotals.cntIngRef} cntBanRef={barTotals.cntBanRef}
              conc={kpis} onDif={filtrarPorDif} difFiltro={difFiltro} tipsTotal={tipsInfo.total} tipsDia={(dayView && filterV === "pend" && dayCenter) ? (tipsInfo.porDia[dayCenter] || 0) : null}
              haySeleccion={haySeleccion || hayHighlight} readonly={hayHighlight && !haySeleccion}
              selIngTotal={hayHighlight ? hlIngTotal : selIngTotal} selBanTotal={hayHighlight ? hlBanTotal : selBanTotal}
              selIngCount={hayHighlight ? parV.size : (selIng.size + selEfec.size + selCC.size)} selBanCount={hayHighlight ? parB.size : selBan.size}
              onConciliar={conciliarManual} onLimpiar={hayHighlight ? (() => { setParV(new Set()); setParB(new Set()); }) : limpiarSeleccion} onDesarmar={desarmarCluster} onEditar={editarCluster} />
            </div>

            {dayView && filterV === "pend" ? (
              /* ===== VISTA POR DÍA COMPARTIDA: ingreso izq / banco der, misma banda ===== */
              <Panel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ minWidth: 0, borderRight: "1px solid " + C.line }}>
                    <PanelHead titulo="Facturas y Cobranzas" count={diaCounts ? diaCounts.v + " del día" : view.fV.length + " de " + view.V.length}
                      tabs={[["all","Todas"],["ok","Conciliadas"],["pend","Pendientes"]]} active={activeTab} onTab={goTab}
                      colMenu={colMenu === "ingresos"} onToggleColMenu={() => setColMenu(colMenu === "ingresos" ? null : "ingresos")}
                      allCols={COLS_INGRESOS} visibleCols={colsV} onToggleCol={(k) => setColsV((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} grouped />
                    <DynThead allCols={COLS_INGRESOS} visible={colsVeff} hidden={HIDE_ING_COMPARTIDO} sort={sortV} onSort={(campo) => setSortV((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                      side="ingresos" rows={result.V} colFilter={colFilterV} setColFilter={setColFilterV} openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <PanelHead titulo="Banco" count={diaCounts ? diaCounts.b + " del día" : view.fB.length + " de " + view.B.length}
                      tabs={[["all","Todos"],["ok","Conciliados"],["pend","Pendientes"]]} active={activeTab} onTab={goTab}
                      colMenu={colMenu === "banco"} onToggleColMenu={() => setColMenu(colMenu === "banco" ? null : "banco")}
                      allCols={COLS_BANCO} visibleCols={colsB} onToggleCol={(k) => setColsB((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
                    <DynThead allCols={COLS_BANCO} visible={colsBeff} hidden={HIDE_BAN_COMPARTIDO} sort={sortB} onSort={(campo) => setSortB((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                      side="banco" rows={result.B} colFilter={colFilterB} setColFilter={setColFilterB} openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                  </div>
                </div>
                <DayNav center={dayCenter} tol={tol} onMove={moveDay}
                  canPrev={pendingDays.some((d) => d < dayCenter)} canNext={pendingDays.some((d) => d > dayCenter)}
                  diasPend={pendPorDia} onPick={elegirDia} desde={desde} hasta={hasta} />
                <DiaCompartido ingRows={view.fV} banRows={view.fB} windowDays={dayWindow()} center={dayCenter}
                  tipDia={tipsInfo.porDia}
                  efectivoDia={efectivoPorDia} efectivoOpen={efectivoOpen} efectivoSosp={efectivoSospechoso}
                  selEfec={selEfec} onToggleEfec={(id) => setSelEfec((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  ccDia={ccPorDia} ccOpen={ccOpen} onToggleCC={(d) => setCcOpen((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; })} onCliente={setCuentaModal} tieneCuentaFn={tieneCuenta} formaFn={formaProps}
                  selCC={selCC} ccConc={ccConc} onToggleCCSel={(ids) => {
                    const arr = Array.isArray(ids) ? ids : [ids];
                    const agregando = !arr.every((id) => selCC.has(id));
                    setSelCC((s) => { const n = new Set(s); arr.forEach((id) => (agregando ? n.add(id) : n.delete(id))); return n; });
                    // al tildar, se marcan del lado del banco los pagos de ese cliente del día (por nombre o por la memoria de pagadores)
                    if (agregando && result) {
                      const asoc = [];
                      arr.map((id) => ccById[id]).filter(Boolean).forEach((p) => result.B.forEach((b) => {
                        if (b.status === "pend" && b.fecha === p.fecha && b.cliente && (pagadorCoincide(p.cliente, b.cliente) || conocePagador(p.cliente, b.cliente))) asoc.push(b.id);
                      }));
                      if (asoc.length) setSelBan((s) => { const n = new Set(s); asoc.forEach((id) => n.add(id)); return n; });
                    }
                  }}
                  onToggleEfectivo={(d) => setEfectivoOpen((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; })}
                  selIng={selIng} selBan={selBan}
                  onSelDia={(ids, side, todos) => { const setSel = side === "ing" ? setSelIng : setSelBan; setSel((s) => { const n = new Set(s); if (todos) ids.forEach((id) => n.delete(id)); else ids.forEach((id) => n.add(id)); return n; }); }}
                  innerRef={rowsVref} faltantes={faltantes}
                  renderIng={(v, dim) => (
                    <DynRow key={v.id} row={v} {...notaProps(v.id)} onCliente={setCuentaModal} tieneCuenta={tieneCuenta} {...formaProps(v)} allCols={COLS_INGRESOS} visible={colsVeff} hidden={HIDE_ING_COMPARTIDO} side="ing" dim={dim}
                      selectable checked={selIng.has(v.id)} suggested={sugResaltados.ing.has(v.id)} onClick={() => toggleIng(v.id)} />
                  )}
                  renderBan={(b, dim) => (
                    <DynRow key={b.id} row={b} {...notaProps(b.id)} {...tipProps(b)} allCols={COLS_BANCO} visible={colsBeff} hidden={HIDE_BAN_COMPARTIDO} side="ban" dim={dim}
                      selectable checked={selBan.has(b.id)} suggested={sugResaltados.ban.has(b.id)} onClick={() => toggleBan(b.id)} />
                  )} />
              </Panel>
            ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* INGRESOS */}
              <Panel>
                <PanelHead titulo="Facturas y Cobranzas" count={(dayView && filterV === "pend" && diaCounts) ? diaCounts.v + " del día" : view.fV.length + " de " + view.V.length}
                  tabs={[["all","Todas"],["ok","Conciliadas"],["pend","Pendientes"]]} active={activeTab}
                  onTab={goTab}
                  colMenu={colMenu === "ingresos"} onToggleColMenu={() => setColMenu(colMenu === "ingresos" ? null : "ingresos")}
                  allCols={COLS_INGRESOS} visibleCols={colsV} onToggleCol={(k) => setColsV((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} grouped />
                {filterV !== "pend" && (
                  <SubFilter active={subFilterV} onTab={onSubFiltro} />
                )}
                <DynThead allCols={COLS_INGRESOS} visible={filterV === "pend" ? colsVeff : colsV} sort={sortV} onSort={(campo) => setSortV((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                  side="ingresos" rows={result.V} colFilter={colFilterV} setColFilter={setColFilterV}
                  openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                {dayView && filterV === "pend" && (
                  <DayNav center={dayCenter} tol={tol} onMove={moveDay}
                    canPrev={pendingDays.some((d) => d < dayCenter)} canNext={pendingDays.some((d) => d > dayCenter)}
                  diasPend={pendPorDia} onPick={elegirDia} desde={desde} hasta={hasta} />
                )}
                {dayView && filterV === "pend" ? (
                  <DayGroupedRows innerRef={rowsVref} rows={view.fV} windowDays={dayWindow()} center={dayCenter}
                    faltantes={faltantes}
                    renderRow={(v, dim) => (
                      <DynRow key={v.id} row={v} {...notaProps(v.id)} onCliente={setCuentaModal} tieneCuenta={tieneCuenta} {...formaProps(v)} allCols={COLS_INGRESOS} visible={colsVeff} side="ing" dim={dim}
                        selectable={filterV === "pend"} checked={selIng.has(v.id)} suggested={sugResaltados.ing.has(v.id)} onClick={() => toggleIng(v.id)} />
                    )} />
                ) : (
                  <Rows innerRef={rowsVref}>
                    {(() => {
                      const filaV = (v) => (
                        <DynRow key={v.id} row={v} {...notaProps(v.id)} onCliente={setCuentaModal} tieneCuenta={tieneCuenta} {...formaProps(v)} allCols={COLS_INGRESOS} visible={colsV} side="ing"
                          selectable={filterV === "pend"} checked={selIng.has(v.id)} suggested={parV.has(v.id)}
                          onClick={() => filterV === "pend" ? toggleIng(v.id) : verParDeIngreso(v)} />
                      );
                      const sp = ccSplit; const otros = sp ? sp.ingOtros : view.fV;
                      return (
                        <React.Fragment>
                          {sp && sp.ingCC.length > 0 && <GrupoCCHead label="Cuenta corriente" n={sp.ingCC.length + " cobranza" + (sp.ingCC.length === 1 ? "" : "s")} total={sp.totIng} open={ccListaOpen} onToggle={() => setCcListaOpen(!ccListaOpen)} />}
                          {sp && ccListaOpen && sp.ingCC.map(filaV)}
                          {otros.length ? otros.slice(0, limiteFilas).map(filaV) : (!(sp && sp.ingCC.length) && <Empty />)}
                          {otros.length > limiteFilas && (
                            <div style={{ padding: "10px 16px", textAlign: "center" }}>
                              <button onClick={() => setLimiteFilas((n) => n + 300)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, padding: "7px 16px", borderRadius: 9, border: "1px solid " + C.line2, background: C.white, color: C.celesteDeep, cursor: "pointer" }}>Ver más ({otros.length - limiteFilas} restantes)</button>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })()}
                  </Rows>
                )}
              </Panel>

              {/* BANCO */}
              <Panel>
                <PanelHead titulo="Banco" count={(dayView && filterB === "pend" && diaCounts) ? diaCounts.b + " del día" : view.fB.length + " de " + view.B.length}
                  tabs={[["all","Todos"],["ok","Conciliados"],["pend","Pendientes"]]} active={activeTab}
                  onTab={goTab}
                  colMenu={colMenu === "banco"} onToggleColMenu={() => setColMenu(colMenu === "banco" ? null : "banco")}
                  allCols={COLS_BANCO} visibleCols={colsB} onToggleCol={(k) => setColsB((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
                {filterB !== "pend" && (
                  <SubFilter active={subFilterV} onTab={onSubFiltro} />
                )}
                <DynThead allCols={COLS_BANCO} visible={filterB === "pend" ? colsBeff : colsB} sort={sortB} onSort={(campo) => setSortB((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                  side="banco" rows={result.B} colFilter={colFilterB} setColFilter={setColFilterB}
                  openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                {dayView && filterB === "pend" && (
                  <DayNav center={dayCenter} tol={tol} onMove={moveDay}
                    canPrev={pendingDays.some((d) => d < dayCenter)} canNext={pendingDays.some((d) => d > dayCenter)}
                  diasPend={pendPorDia} onPick={elegirDia} desde={desde} hasta={hasta} />
                )}
                {dayView && filterB === "pend" ? (
                  <DayGroupedRows innerRef={rowsBref} rows={view.fB} windowDays={dayWindow()} center={dayCenter}
                    groupEqual expandedGroups={expandedGroups} sort={sortB}
                    tailCols={COLS_BANCO.filter((c) => (c.fixed || colsBeff.has(c.key)) && ["tipoMedio", "medio"].includes(c.key))}
                    onToggleGroup={(k) => setExpandedGroups((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                    selBan={selBan} onToggleGroupSel={toggleBanGroup}
                    renderRow={(b, dim) => (
                      <DynRow key={b.id} row={b} {...notaProps(b.id)} {...tipProps(b)} allCols={COLS_BANCO} visible={colsBeff} side="ban" dim={dim}
                        selectable={filterB === "pend"} checked={selBan.has(b.id)} suggested={sugResaltados.ban.has(b.id)} onClick={() => toggleBan(b.id)} />
                    )} />
                ) : (
                  <Rows innerRef={rowsBref}>
                    {(() => {
                      const filaB = (b) => (
                        <DynRow key={b.id} row={b} {...notaProps(b.id)} {...tipProps(b)} allCols={COLS_BANCO} visible={colsB} side="ban"
                          selectable={filterB === "pend"} checked={selBan.has(b.id)} suggested={parB.has(b.id)}
                          onClick={() => filterB === "pend" ? toggleBan(b.id) : verParDeBanco(b)} />
                      );
                      const sp = ccSplit; const otros = sp ? sp.banOtros : view.fB;
                      return (
                        <React.Fragment>
                          {sp && sp.banCC.length > 0 && <GrupoCCHead label="Pagos de cuenta corriente" n={sp.banCC.length + " pago" + (sp.banCC.length === 1 ? "" : "s")} total={sp.totBan} open={ccListaOpen} onToggle={() => setCcListaOpen(!ccListaOpen)} />}
                          {sp && ccListaOpen && sp.banCC.map(filaB)}
                          {otros.length ? otros.slice(0, limiteFilas).map(filaB) : (!(sp && sp.banCC.length) && <Empty />)}
                          {otros.length > limiteFilas && (
                            <div style={{ padding: "10px 16px", textAlign: "center" }}>
                              <button onClick={() => setLimiteFilas((n) => n + 300)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, padding: "7px 16px", borderRadius: 9, border: "1px solid " + C.line2, background: C.white, color: C.celesteDeep, cursor: "pointer" }}>Ver más ({otros.length - limiteFilas} restantes)</button>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })()}
                  </Rows>
                )}
              </Panel>
            </div>
            )}

            {/* CONCILIADOS MANUALES DEL PERÍODO — minimizar/maximizar, deshacer/editar */}
            {aprobadas.length > 0 && (
              <PanelColapsable titulo="Conciliados manuales" resumen={aprobadas.length + " · " + fmt(aprobadas.reduce((a, x) => a + x.ingTotal, 0))} open={aprobOpen} onToggle={() => setAprobOpen(!aprobOpen)}>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {aprobadas.slice().reverse().map((ap) => { const np = notaProps("ap:" + ap.key); const exp = aprobExp.has(ap.key);
                    const ingObjs = result ? result.V.filter((v) => ap.ingIds.includes(v.id)) : [];
                    const banObjs = result ? result.B.filter((b) => ap.banIds.includes(b.id)) : [];
                    const fH = (h) => h || "—";
                    return (
                    <React.Fragment key={ap.key}>
                    <div className="cx-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid " + C.line, fontSize: 13, cursor: "pointer" }}
                      onClick={() => setAprobExp((s) => { const n = new Set(s); n.has(ap.key) ? n.delete(ap.key) : n.add(ap.key); return n; })}>
                      <span style={{ color: C.txt3, fontSize: 11, width: 10, flexShrink: 0 }}>{exp ? "\u25BE" : "\u25B8"}</span>
                      <span style={{ fontSize: 11.5, color: C.txt3, width: 74, flexShrink: 0 }}>{fmtFecha(ap.dia)}</span>
                      <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ap.ingIds.length} ingreso{ap.ingIds.length === 1 ? "" : "s"} ↔ {ap.banIds.length} banco{ap.banIds.length === 1 ? "" : "s"}
                        {ap.dif ? <span style={{ color: C.amber }}> · dif {fmt(Math.abs(ap.dif))}</span> : <span style={{ color: C.green }}> · exacto</span>}
                      </span>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, width: 100, textAlign: "right", flexShrink: 0 }}>{fmt(ap.ingTotal)}</span>
                      <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}><NotaChip nota={np.nota} onToggle={np.onToggleNota} /></span>
                      <button onClick={(e) => { e.stopPropagation(); setDayCenter(ap.dia); setFilterV("pend"); setFilterB("pend"); setSubFilterV("all"); setDayView(true); deshacerAprobada(ap); }}
                        title="Deshacer: vuelve el par a pendiente en su día para que lo edites"
                        style={{ border: "1px solid " + C.line2, background: C.white, color: C.txt2, borderRadius: 7, padding: "4px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>↩ Deshacer / editar</button>
                    </div>
                    {exp && (
                      <div style={{ borderBottom: "1px solid " + C.line, background: "#00000004" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: C.tinta }}>
                          <div style={{ padding: "5px 16px", borderRight: "1px solid " + C.line, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: C.paper, display: "flex", justifyContent: "space-between" }}><span>Ingresos</span><span style={{ color: C.celeste }}>{fmt(ap.ingTotal)}</span></div>
                          <div style={{ padding: "5px 16px", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: C.paper, display: "flex", justifyContent: "space-between" }}><span>Banco</span><span style={{ color: C.celeste }}>{fmt(ap.banTotal)}</span></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                          <div style={{ borderRight: "1px solid " + C.line }}>
                            {ingObjs.map((v) => (
                              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 16px", borderBottom: "1px solid " + C.line, fontSize: 12 }}>
                                <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{fH(v.hora)}</span>
                                <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.cliente || v.comp || (v.origen === "efec" ? "Efectivo reclasificado" : "—")}</span>
                                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, flexShrink: 0 }}>{fmt(v.imp)}</span>
                              </div>
                            ))}
                            {!ingObjs.length && <div style={{ padding: "6px 16px", fontSize: 11.5, color: C.txt3 }}>—</div>}
                          </div>
                          <div>
                            {banObjs.map((b) => (
                              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 16px", borderBottom: "1px solid " + C.line, fontSize: 12 }}>
                                <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{fH(b.hora)}</span>
                                <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.cliente || b.medio || "—"}</span>
                                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, flexShrink: 0 }}>{fmt(b.imp)}</span>
                              </div>
                            ))}
                            {!banObjs.length && <div style={{ padding: "6px 16px", fontSize: 11.5, color: C.txt3 }}>—</div>}
                          </div>
                        </div>
                      </div>
                    )}
                    {np.notaEditing && (
                      <div style={{ padding: "5px 16px 8px 30px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}><NotaEditor value={np.nota} onSave={np.onSaveNota} /></div>
                    )}
                    </React.Fragment>
                  ); })}
                </div>
              </PanelColapsable>
            )}

            {/* CONTROL DE CUENTA CORRIENTE — cobros por MP según el ERP sin pago en el banco */}
            {result && controlCC.filas.length > 0 && (
              <PanelColapsable titulo={"\u26A0 Control de cuenta corriente"}
                resumen={controlCC.filas.length + " pago" + (controlCC.filas.length === 1 ? "" : "s") + " (" + controlCC.cobros + " tickets) · " + fmt(controlCC.total) + " · el ERP dice MercadoPago y no está en el banco"}
                open={ctrlOpen} onToggle={() => setCtrlOpen(!ctrlOpen)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid " + C.line, background: "#c77d080d", fontSize: 12, color: C.txt2 }}>
                  <span style={{ flex: 1 }}>Cobros de cuenta corriente registrados en el ERP como <b>MercadoPago</b> que no aparecen en la cuenta. Tocá uno para ir a su día.</span>
                  <button onClick={(e) => { e.stopPropagation(); exportarControl(); }} disabled={!xlsxReady}
                    style={{ border: "1px solid " + C.line2, background: C.white, color: C.celesteDeep, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: xlsxReady ? "pointer" : "not-allowed", flexShrink: 0 }}>{"\u2B07"} Exportar a Excel</button>
                </div>
                <div style={{ display: "flex", gap: 10, padding: "6px 16px", borderBottom: "1px solid " + C.line2, background: "#F7F9FB", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3 }}>
                  <span style={{ width: 92 }}>Fecha de pago</span><span style={{ flex: 1 }}>Cliente · tickets que cancela</span><span style={{ width: 110, textAlign: "right" }}>Importe</span>
                </div>
                {controlCC.filas.map((f) => (
                  <div key={f.fecha + f.cliente} data-keep-sel onClick={() => { elegirDia(f.fecha); }} title="Ir a ese día"
                    className="cx-row" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 16px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: "pointer" }}>
                    <span style={{ width: 92, flexShrink: 0, color: C.txt3, fontSize: 11.5, paddingTop: 1 }}>{fmtFecha(f.fecha)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={(e) => { e.stopPropagation(); setCuentaModal(f.cliente); }} title={"Ver cuenta corriente de " + f.cliente} style={{ fontWeight: 700, color: C.celesteDeep, textDecoration: "underline", textDecorationColor: "rgba(36,146,200,.35)", cursor: "pointer" }}>{f.cliente || "\u2014"}</span>
                      <span style={{ display: "block", fontSize: 11, color: C.txt3, marginTop: 2 }}>
                        {f.items.map((p) => (p.comp || "ticket").replace(/^(\S+)\s+\d+-0*/, "$1 \u2026") + (p.fechaFact ? " (" + fmtFecha(p.fechaFact).slice(0, 5) + ")" : "") + " " + fmt(p.imp)).join("  \u00B7  ")}
                      </span>
                    </span>
                    <span style={{ width: 110, flexShrink: 0, textAlign: "right", fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.amber }}>{fmt(f.total)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, color: C.tinta }}>
                  <span style={{ flex: 1 }}>Total sin pago en el banco</span>
                  <span style={{ fontFamily: "'Sora',sans-serif", color: C.amber }}>{fmt(controlCC.total)}</span>
                </div>
              </PanelColapsable>
            )}

            {/* PENDIENTES POR MES — izq comprobantes, der pagos (minimizar/maximizar) */}
            {result && (pendPorMes.ing.length > 0 || pendPorMes.ban.length > 0) && (
              <PanelColapsable titulo="Pendientes por mes"
                resumen={"comprobantes " + fmt(pendPorMes.ing.reduce((a, g) => a + g.total, 0)) + " · pagos " + fmt(pendPorMes.ban.reduce((a, g) => a + g.total, 0))}
                open={pendOpen} onToggle={() => { const abriendo = !pendOpen; setPendOpen(abriendo); if (abriendo) setMesesPend(new Set(pendUnif.map((m) => m.mes))); }}>
                {/* encabezados de columnas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ padding: "8px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, background: "#00000008", borderBottom: "1px solid " + C.line, borderRight: "1px solid " + C.line }}>Comprobantes históricos</div>
                  <div style={{ padding: "8px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, background: "#00000008", borderBottom: "1px solid " + C.line }}>Pagos</div>
                </div>
                {pendUnif.length ? pendUnif.map((mes) => {
                  const [my, mm] = mes.mes.split("-"); const mesLbl = (MESES_ES[parseInt(mm) - 1] || mes.mes) + " " + my;
                  const mOpen = mesesPend.has(mes.mes);
                  return (
                    <div key={mes.mes}>
                      <div onClick={() => setMesesPend((s) => { const n = new Set(s); n.has(mes.mes) ? n.delete(mes.mes) : n.add(mes.mes); return n; })}
                        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid " + C.line, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRight: "1px solid " + C.line }}>
                          <span style={{ color: C.celesteDeep, fontSize: 11, width: 12, flexShrink: 0 }}>{mOpen ? "\u25BE" : "\u25B8"}</span>
                          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: C.tinta }}>{mesLbl}</span>
                          <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: C.amber }}>{fmt(mes.totIng)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" }}>
                          {difPend(mes.totIng, mes.totBan)}
                          <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: C.amber }}>{fmt(mes.totBan)}</span>
                        </div>
                      </div>
                      {mOpen && mes.dias.map((d) => {
                        const dt = new Date(d.dia + "T12:00:00"); const dLbl = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dt.getDay()] + " " + dt.getDate();
                        const dOpen = diasPend.has(d.dia);
                        return (
                          <div key={d.dia}>
                            <div onClick={() => setDiasPend((s) => { const n = new Set(s); n.has(d.dia) ? n.delete(d.dia) : n.add(d.dia); return n; })}
                              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#0000000a" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 26px", borderRight: "1px solid " + C.line }}>
                                <span style={{ color: C.celesteDeep, fontSize: 10, width: 12, flexShrink: 0 }}>{dOpen ? "\u25BE" : "\u25B8"}</span>
                                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: C.txt2 }}>{dLbl}</span>
                                <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: C.amber }}>{fmt(d.totIng)}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px" }}>
                                {difPend(d.totIng, d.totBan)}
                                <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: C.amber }}>{fmt(d.totBan)}</span>
                              </div>
                            </div>
                            {dOpen && (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                                <div style={{ borderRight: "1px solid " + C.line, minWidth: 0 }}>{d.ing.length ? d.ing.map((r) => <PendItem key={r.id} r={r} notaFn={notaProps} />) : <div style={{ padding: "8px 14px", fontSize: 12, color: C.txt3, opacity: 0.6 }}>—</div>}</div>
                                <div style={{ minWidth: 0 }}>{d.ban.length ? d.ban.map((r) => <PendItem key={r.id} r={r} notaFn={notaProps} tipVal={tipDe(r)} />) : <div style={{ padding: "8px 14px", fontSize: 12, color: C.txt3, opacity: 0.6 }}>—</div>}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }) : <div style={{ padding: "12px 14px", fontSize: 13, color: C.txt3 }}>Sin pendientes</div>}
              </PanelColapsable>
            )}

          </>
        )}
      </div>

      {/* MODAL DE CUENTA CORRIENTE (al tocar el nombre del cliente) */}
      {cuentaModal && <CuentaModal cuenta={cuentaDe(cuentaModal)} diaFoco={dayCenter} onClose={() => setCuentaModal(null)} onQuitarPagador={(pk) => quitarPagador(cuentaModal, pk)} />}
      {/* MODAL DE IMPORTACIÓN */}
      {modal && (
        <ImportModal fuente={modal} business={business} onClose={() => setModal(null)}
          onFile={(file) => onFile(modal, file)} onHelp={() => setInstructivo(modal.instructivo)} />
      )}
      {/* INSTRUCTIVO */}
      {instructivo && <InstructivoModal instructivo={instructivo} onClose={() => setInstructivo(null)} />}
      {/* AVISO DE COLUMNAS FALTANTES */}
      {fileError && <ColErrorModal error={fileError} onClose={() => setFileError(null)} />}
    </div>
  );
}

// ─── Estilos reutilizables ──────────────────────────────────────────
const inputStyle = { fontFamily: "'Archivo',sans-serif", fontSize: 15, padding: "9px 12px", borderRadius: 10, border: "1px solid " + C.line2, background: C.white, color: C.txt, cursor: "pointer" };
const ghostBtn = { fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, padding: "10px 18px", borderRadius: 10, border: "1px solid " + C.line2, background: C.white, color: C.txt2, cursor: "pointer" };
const fldLbl = { fontSize: 13, color: C.txt3, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 700 };

function Field({ label, children }) {
  return <div><label style={{ ...fldLbl, display: "block", marginBottom: 3 }}>{label}</label>{children}</div>;
}

// Panel que se minimiza/maximiza (mismo patrón que el sector de fuentes+período)
function PanelColapsable({ titulo, resumen, open, onToggle, children }) {
  if (!open) return (
    <div data-keep-sel onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, background: C.white, border: "1px solid " + C.line2, borderRadius: 12, padding: "10px 16px", marginTop: 16, cursor: "pointer" }}>
      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.tinta }}>{titulo}</span>
      {resumen && <span style={{ fontSize: 12.5, color: C.txt3 }}>{resumen}</span>}
      <span style={{ marginLeft: "auto", color: C.celesteDeep, fontSize: 13, fontWeight: 700 }}>{"\u25BE"} Desplegar</span>
    </div>
  );
  return (
    <div data-keep-sel style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 12, overflow: "hidden", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid " + C.line, background: C.paper }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.tinta }}>{titulo}</span>
        {resumen && <span style={{ fontSize: 12.5, color: C.txt3 }}>{resumen}</span>}
        <button onClick={onToggle} style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, color: C.txt3, background: "transparent", border: "1px solid " + C.line2, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{"\u25B4"} Minimizar</button>
      </div>
      {children}
    </div>
  );
}

// Grupo de un mes de pendientes (open/onToggle controlado desde afuera, así se
// abre/cierra de los dos lados a la vez)
function MesPend({ grupo, open, onToggle, notaFn }) {
  const [y, m] = grupo.mes.split("-");
  const mesLbl = (MESES_ES[parseInt(m) - 1] || grupo.mes) + " " + y;
  const [diasOpen, setDiasOpen] = React.useState(new Set());
  // agrupar los items del mes por DÍA
  const porDia = {};
  grupo.items.forEach((r) => { (porDia[r.fecha] = porDia[r.fecha] || []).push(r); });
  const dias = Object.keys(porDia).sort();
  const fmtDiaLbl = (d) => { const dt = new Date(d + "T12:00:00"); const ds = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]; return ds[dt.getDay()] + " " + dt.getDate(); };
  return (
    <div>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderBottom: "1px solid " + C.line, cursor: "pointer" }}>
        <span style={{ color: C.celesteDeep, fontSize: 11, width: 12, flexShrink: 0 }}>{open ? "\u25BE" : "\u25B8"}</span>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: C.tinta }}>{mesLbl}</span>
        <span style={{ fontSize: 11.5, color: C.txt3 }}>{grupo.items.length} pend.</span>
        <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: C.amber }}>{fmt(grupo.total)}</span>
      </div>
      {open && dias.map((dia) => {
        const items = porDia[dia]; const totDia = items.reduce((a, r) => a + r.imp, 0); const dOpen = diasOpen.has(dia);
        return (
          <div key={dia}>
            <div onClick={() => setDiasOpen((s) => { const n = new Set(s); n.has(dia) ? n.delete(dia) : n.add(dia); return n; })}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 28px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#00000006" }}>
              <span style={{ color: C.celesteDeep, fontSize: 10, width: 12, flexShrink: 0 }}>{dOpen ? "\u25BE" : "\u25B8"}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: C.txt2 }}>{fmtDiaLbl(dia)}</span>
              <span style={{ fontSize: 11, color: C.txt3 }}>{items.length}</span>
              <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: C.amber }}>{fmt(totDia)}</span>
            </div>
            {dOpen && items.map((r) => { const np = notaFn ? notaFn(r.id) : {}; return (
              <React.Fragment key={r.id}>
              <div className="cx-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 42px", borderBottom: "1px solid " + C.line, fontSize: 12.5, background: "#fdf6ec55", boxShadow: np.nota ? "inset 3px 0 0 " + C.celeste : undefined }}>
                <span style={{ fontSize: 11, color: C.txt3, width: 44, flexShrink: 0 }}>{r.hora || fmtFecha(r.fecha)}</span>
                <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cliente || "—"}</span>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, flexShrink: 0 }}>{fmt(r.imp)}</span>
                {notaFn && <NotaChip nota={np.nota} onToggle={np.onToggleNota} />}
              </div>
              {np.notaEditing && <div style={{ padding: "5px 14px 8px 42px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}><NotaEditor value={np.nota} onSave={np.onSaveNota} /></div>}
              </React.Fragment>
            ); })}
          </div>
        );
      })}
    </div>
  );
}

// Fila de un pendiente (hora/cliente/importe + nota) en el panel Pendientes por mes.
// Seleccionable (checkbox → misma selección que las tablas) y con propina (banco).
function PendItem({ r, notaFn, selected, onToggleSel, tipFn, tipVal }) {
  const np = notaFn ? notaFn(r.id) : {};
  const tp = tipFn ? tipFn(r) : null;
  const tip = tp ? tp.tip : (tipVal || 0);
  return (
    <React.Fragment>
      <div className="cx-row" onClick={onToggleSel} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: onToggleSel ? "pointer" : "default", background: selected ? "#5BC2EA1c" : (tip > 0 ? "#fff7ec" : "#fdf6ec55"), outline: selected ? "2px solid " + C.celeste : "none", outlineOffset: -2, boxShadow: tip > 0 ? "inset 3px 0 0 " + C.amber : (np.nota ? "inset 3px 0 0 " + C.celeste : undefined) }}>
        {onToggleSel && <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (selected ? C.celeste : C.line2), background: selected ? C.celeste : "transparent", color: C.noche, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{selected ? "✓" : ""}</span>}
        <span style={{ fontSize: 11, color: C.txt3, width: 44, flexShrink: 0 }}>{r.hora || fmtFecha(r.fecha)}</span>
        <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cliente || "—"}</span>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta, flexShrink: 0 }}>{fmt(r.imp)}</span>
        {tip > 0 && <span style={{ fontSize: 10, color: C.txt3, flexShrink: 0, whiteSpace: "nowrap" }}>pago <b style={{ color: C.tinta }}>{fmt(r.imp - tip)}</b></span>}
        {notaFn && <NotaChip nota={np.nota} onToggle={np.onToggleNota} />}
        {tipFn && (tip > 0
          ? <span onClick={(e) => { e.stopPropagation(); tp.onToggleTip(); }} title="Editar propina" style={{ flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontSize: 10, background: "#c77d0822", color: C.amber, border: "1px solid " + C.amber, borderRadius: 7, padding: "2px 7px", fontWeight: 800, fontFamily: "'Sora',sans-serif", marginLeft: 4 }}>🪙 {fmt(tip)} ✎</span>
          : <TipChip tip={0} onToggle={tp.onToggleTip} />)}
      </div>
      {np.notaEditing && <div style={{ padding: "5px 14px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}><NotaEditor value={np.nota} onSave={np.onSaveNota} /></div>}
      {tp && tp.tipEditing && <div style={{ padding: "6px 14px", background: "#fff7ec", borderBottom: "1px solid " + C.line }}><TipEditor value={tp.tip} max={tp.tipImp} onSave={tp.onSaveTip} onTodo={tp.onTodoTip} onQuitar={tp.onQuitarTip} defaultDif={tp.defaultDif} /></div>}
    </React.Fragment>
  );
}

// Tooltip propio (el title nativo no siempre se ve dentro del iframe)
function InfoTip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ cursor: "help", color: C.celesteDeep, fontWeight: 700 }}>{"\u24D8"}</span>
      {show && (
        <span style={{ position: "absolute", bottom: "150%", left: "50%", transform: "translateX(-50%)", background: C.tinta, color: C.paper, fontSize: 12, fontWeight: 400, lineHeight: 1.45, padding: "9px 11px", borderRadius: 9, width: 250, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.28)", textTransform: "none", letterSpacing: 0, whiteSpace: "normal" }}>{text}</span>
      )}
    </span>
  );
}

// ─── Uploader card ──────────────────────────────────────────────────
function UploaderCard({ fuente, loaded, onOpen }) {
  const isLoaded = !!loaded;
  return (
    <div onClick={onOpen} style={{ border: "1.5px " + (isLoaded ? "solid " + C.green : "dashed " + C.line2), borderRadius: 14, padding: 18, textAlign: "center", cursor: "pointer", position: "relative", background: isLoaded ? C.greenBg : C.white }}>
      {isLoaded && <span style={{ position: "absolute", top: 12, right: 14, color: C.green, fontWeight: 800, fontSize: 17 }}>✓</span>}
      <div style={{ fontSize: 28, marginBottom: 8 }}>{fuente.emoji}</div>
      <h4 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 16, color: C.tinta, margin: "0 0 3px" }}>{fuente.titulo}</h4>
      <p style={{ fontSize: 13.5, color: C.txt3, margin: 0 }}>
        {isLoaded ? loaded.length + " registros cargados" : fuente.subtitulo}
      </p>
      {!isLoaded && fuente.nota && (
        <p style={{ fontSize: 12, color: C.txt3, margin: "7px 0 0", lineHeight: 1.4, opacity: 0.85 }}>
          {fuente.nota}
        </p>
      )}
    </div>
  );
}

// ─── KPI ────────────────────────────────────────────────────────────
function Kpi({ label, value, tone, sub }) {
  const col = tone === "g" ? C.green : tone === "a" ? C.amber : C.celesteDeep;
  return (
    <div style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 13, padding: 14 }}>
      <div style={{ fontSize: 11.5, color: C.txt3, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 24, marginTop: 5, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.txt3, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ─── Panel + cabeceras ──────────────────────────────────────────────
function Panel({ children }) {
  return <div style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 560 }}>{children}</div>;
}
function PanelHead({ titulo, count, tabs, active, onTab, colMenu, onToggleColMenu, allCols, visibleCols, onToggleCol, grouped }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.line, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", minHeight: 52, gap: 10 }}>
      <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: C.tinta }}>{titulo}</span> <span style={{ fontSize: 13, color: C.txt3 }}>{count}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 3, background: C.paper, borderRadius: 8, padding: 2 }}>
          {tabs.map(([f, lbl]) => (
            <button key={f} onClick={() => onTab(f)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: active === f ? C.white : "transparent", color: active === f ? C.celesteDeep : C.txt3, boxShadow: active === f ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>{lbl}</button>
          ))}
        </div>
        {allCols && (
          <button data-colmenu onClick={onToggleColMenu} title="Columnas" style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 600, fontSize: 13, padding: "5px 10px", borderRadius: 8, border: "1px solid " + C.line2, background: C.white, color: C.txt2, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>▦</span> Columnas <span style={{ fontSize: 11 }}>▾</span>
          </button>
        )}
      </div>
      {colMenu && allCols && (
        <ColMenu allCols={allCols} visible={visibleCols} onToggle={onToggleCol} grouped={grouped} />
      )}
    </div>
  );
}

// Menú desplegable de columnas (checkboxes; fijas bloqueadas)
function ColMenu({ allCols, visible, onToggle, grouped }) {
  const groups = grouped
    ? allCols.reduce((acc, c) => { const g = c.group || "Otras"; (acc[g] = acc[g] || []).push(c); return acc; }, {})
    : { "": allCols };
  return (
    <div data-colmenu style={{ position: "absolute", top: 46, right: 16, background: C.white, border: "1px solid " + C.line2, borderRadius: 11, boxShadow: "0 12px 30px rgba(21,33,62,.18)", padding: 8, zIndex: 20, width: 210, maxHeight: 360, overflowY: "auto" }}>
      {Object.entries(groups).map(([gname, cols]) => (
        <div key={gname}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, padding: "6px 8px 4px" }}>{gname || "Columnas"}</div>
          {cols.map((c) => {
            const on = c.fixed || visible.has(c.key);
            return (
              <div key={c.key} onClick={() => { if (!c.fixed) onToggle(c.key); }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 7, fontSize: 14.5, cursor: c.fixed ? "default" : "pointer", opacity: c.fixed ? 0.5 : 1 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: "1.5px solid " + (on ? C.celeste : C.line2), background: on ? C.celeste : "transparent", color: C.noche, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on ? "✓" : ""}</span>
                <span style={{ color: C.txt }}>{c.label}</span>
                {c.only && <span style={{ marginLeft: "auto", fontSize: 10, color: C.txt3, textTransform: "uppercase", fontWeight: 700 }}>{c.only === "pos" ? "VD" : "CC"}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
function SubFilter({ active, onTab }) {
  const opts = [["all","Todos"],["uno","1 a 1"],["iguales","iguales"],["consecutivos","consecutivos"],["cliente","grupo cliente"],["combinado","combinado"],["porhora","por hora"],["manual","manual"],["faltante","con faltante"]];
  // gradiente verde → naranja: cuanto más a la derecha, más chance de que la
  // automatización falle en ese tipo de match.
  const tono = { uno: "#1a9c6e", iguales: "#489c40", consecutivos: "#6f9426", cliente: "#94881a", combinado: "#b5820e", porhora: "#c77d08", manual: C.celesteDeep, faltante: "#d94f63" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid " + C.line, background: C.paper }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, flexShrink: 0 }}>Tipo:</span>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", minWidth: 0 }}>
        {opts.map(([f, lbl]) => { const col = tono[f] || C.txt3; const on = active === f; return (
          <button key={f} onClick={() => onTab(f)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: on ? 800 : 600, fontSize: 11.5, lineHeight: 1.1, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: on ? col + "1f" : "transparent", color: col, boxShadow: on ? "inset 0 0 0 1.5px " + col : "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            {tono[f] && f !== "manual" && f !== "faltante" && f !== "all" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: col, flexShrink: 0 }} />}{lbl}
          </button>
        ); })}
      </div>
    </div>
  );
}
// Encabezado dinámico: título ordena (1 clic) + iconito ▾ abre filtro por valores
function DynThead({ allCols, visible, sort, onSort, side, rows, colFilter, setColFilter, openKey, setOpenKey, hidden }) {
  const cols = allCols.filter((c) => (c.fixed || visible.has(c.key)) && !(hidden && hidden.has(c.key)));
  const cellVal = (row, campo) => {
    if (campo === "origenLbl") return row.origen === "cc" ? "CC" : "VD";
    if (campo === "fecha") return fmtFecha(row.fecha);
    if (campo === "fechaFact") return fmtFecha(row.fechaFact || row.fecha);
    if (campo === "cobro") return row.origen === "cc" ? "Cuenta corriente" : (row.cobro || "—");
    const v = row[campo]; return v === undefined || v === null || v === "" ? "—" : String(v);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", height: 48, boxSizing: "border-box", borderBottom: "1px solid " + C.line, background: C.paper, position: "relative" }}>
      {cols.map((c) => {
        const active = sort.campo === c.key;
        const st = { fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".4px", lineHeight: 1.12, color: active ? C.celesteDeep : C.txt3, whiteSpace: "normal", display: "flex", alignItems: "center", gap: 3 };
        if (typeof c.w === "number") { st.width = c.w; st.flexShrink = 0; }
        if (c.align === "right") { st.justifyContent = "flex-end"; if (!c.w) st.marginLeft = "auto"; }
        if (c.flex) st.flex = 1;
        if (c.key === "cliente") st.minWidth = 84;
        const fullKey = side + ":" + c.key;
        const hasFilter = colFilter[c.key] && colFilter[c.key].size > 0;
        return (
          <span key={c.key} style={st}>
            <span onClick={() => c.sortable && onSort(c.key)} style={{ cursor: c.sortable ? "pointer" : "default" }}>
              {c.label}{active ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
            </span>
            <span data-colfilter onClick={(e) => { e.stopPropagation(); setOpenKey(openKey === fullKey ? null : fullKey); }}
              title="Filtrar" style={{ cursor: "pointer", fontSize: 11, color: hasFilter ? C.celesteDeep : C.txt3, opacity: hasFilter ? 1 : 0.5 }}>
              {hasFilter ? "▼●" : "▾"}
            </span>
            {openKey === fullKey && (
              <ColFilterMenu campo={c.key} label={c.label} rows={rows} cellVal={cellVal}
                excluded={colFilter[c.key] || new Set()}
                onApply={(exSet) => { setColFilter((cf) => ({ ...cf, [c.key]: exSet })); }}
                onClose={() => setOpenKey(null)} align={c.align} />
            )}
          </span>
        );
      })}
    </div>
  );
}

// Desplegable de filtro por valores de una columna (checkboxes)
function ColFilterMenu({ campo, label, rows, cellVal, excluded, onApply, onClose, align }) {
  // valores únicos de la columna, ordenados
  const valores = React.useMemo(() => {
    const set = new Set(rows.map((r) => cellVal(r, campo)));
    return [...set].sort((a, b) => (campo === "imp" ? parseFloat(a.replace(/[^\d.-]/g, "")) - parseFloat(b.replace(/[^\d.-]/g, "")) : String(a).localeCompare(String(b))));
  }, [rows, campo]);
  const [ex, setEx] = React.useState(() => new Set(excluded));
  const [q, setQ] = React.useState("");
  const visibles = valores.filter((v) => !q || v.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v) => setEx((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const allOn = visibles.every((v) => !ex.has(v));
  const toggleAll = () => setEx((s) => { const n = new Set(s); if (allOn) visibles.forEach((v) => n.add(v)); else visibles.forEach((v) => n.delete(v)); return n; });
  // aplicar al desmontar (click fuera): usar refs para tomar el valor ACTUAL, no el del montaje
  const exRef = React.useRef(ex); exRef.current = ex;
  const applyRef = React.useRef(onApply); applyRef.current = onApply;
  React.useEffect(() => () => applyRef.current(exRef.current), []);

  return (
    <div data-colfilter onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 24, [align === "right" ? "right" : "left"]: 0, background: C.white, border: "1px solid " + C.line2, borderRadius: 11, boxShadow: "0 12px 30px rgba(21,33,62,.18)", padding: 8, zIndex: 30, width: 210, textTransform: "none", letterSpacing: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, padding: "2px 6px 6px" }}>Filtrar: {label}</div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ width: "100%", fontFamily: "'Archivo',sans-serif", fontSize: 14, padding: "6px 9px", borderRadius: 8, border: "1px solid " + C.line2, marginBottom: 6 }} />
      <div onClick={toggleAll} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 14, fontWeight: 700, color: C.tinta, borderBottom: "1px solid " + C.line }}>
        <span style={ckBox(allOn)}>{allOn ? "✓" : ""}</span> (Todos)
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 2 }}>
        {visibles.map((v) => {
          const on = !ex.has(v);
          return (
            <div key={v} onClick={() => toggle(v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, cursor: "pointer", fontSize: 14, color: C.txt }}>
              <span style={ckBox(on)}>{on ? "✓" : ""}</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid " + C.line }}>
        <button onClick={() => { onApply(ex); onClose(); }} style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, padding: "7px", borderRadius: 8, border: "none", background: C.celeste, color: C.noche, cursor: "pointer" }}>Aplicar</button>
        <button onClick={() => { setEx(new Set()); onApply(new Set()); onClose(); }} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.line2, background: C.white, color: C.txt2, cursor: "pointer" }}>Limpiar</button>
      </div>
    </div>
  );
}
function ckBox(on) {
  return { width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (on ? C.celeste : C.line2), background: on ? C.celeste : "transparent", color: C.noche, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
}
function Rows({ children, innerRef }) { return <div ref={innerRef} style={{ overflowY: "auto", flex: 1 }}>{children}</div>; }

// Barra comparativa. Sin selección: totales del filtro activo.
// Con selección: totales de lo seleccionado + botón Conciliar.
// Panel de sugerencias de conciliación. Lista los pares probables del día;
// al pasar el mouse por uno, se resalta ese par en las tablas.
function SugerenciasPanel({ sugerencias, activa, dayCenter, onMoveDay, canPrev, canNext, onSelect, onAplicar, onDescartar }) {
  const fmtDay = (d) => {
    if (!d) return "—";
    const dt = new Date(d + "T12:00:00");
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    return dias[dt.getDay()] + " " + dt.getDate() + " " + ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][dt.getMonth()];
  };
  return (
    <div style={{ background: C.white, border: "1.5px solid " + C.celeste, borderRadius: 12, overflow: "hidden", marginBottom: 14, boxShadow: "0 4px 16px rgba(91,194,234,.15)" }}>
      <div style={{ padding: "9px 14px", borderBottom: "1px solid " + C.line, display: "flex", alignItems: "center", gap: 9, background: "#5BC2EA0e" }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14.5, color: C.tinta }}>Sugerencias</span>
        {sugerencias.length > 0 && <span style={{ fontSize: 12, color: C.txt3, fontWeight: 600 }}>{sugerencias.length} par{sugerencias.length === 1 ? "" : "es"}</span>}
        {/* navegación de día: también acá para barrer día a día desde las sugerencias */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => canPrev && onMoveDay(-1)} disabled={!canPrev} title="Día anterior" style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid " + C.line2, background: C.white, cursor: canPrev ? "pointer" : "not-allowed", opacity: canPrev ? 1 : 0.4, fontSize: 15, color: C.celesteDeep }}>‹</button>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: C.tinta, minWidth: 96, textAlign: "center" }}>{fmtDay(dayCenter)}</span>
          <button onClick={() => canNext && onMoveDay(1)} disabled={!canNext} title="Día siguiente" style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid " + C.line2, background: C.white, cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.4, fontSize: 15, color: C.celesteDeep }}>›</button>
        </div>
      </div>
      {!sugerencias.length ? (
        <div style={{ padding: "12px 16px", fontSize: 14, color: C.txt2 }}>💡 No hay sugerencias en este día con el margen actual. Ampliá el margen o pasá al día siguiente con las flechas.</div>
      ) : (
      <div style={{ maxHeight: 200, overflowY: "auto" }}>
        {(() => { const bloqueoVecinos = sugerencias.some((s) => s.distDias === 0); return sugerencias.map((s, i) => {
          const cierra = s.dif === 0;
          const prob = s.prob || 0;
          const probColor = prob >= 90 ? C.green : prob >= 75 ? C.celesteDeep : C.amber;
          const probBg = prob >= 90 ? C.greenBg : prob >= 75 ? "#5BC2EA1c" : "#c77d0818";
          const probLbl = prob >= 90 ? "Muy probable" : prob >= 75 ? "Probable" : "Posible";
          const bloqueado = s.distDias > 0 && bloqueoVecinos;
          const showHeader = i === 0 || sugerencias[i - 1].distDias !== s.distDias;
          const distLbl = s.distDias === 0 ? "Mismo día" : s.distDias === 1 ? "Con 1 día" : "Con " + s.distDias + " días";
          return (
            <React.Fragment key={s.key}>
              {showHeader && (
                <div style={{ padding: "5px 14px", background: C.paper, borderBottom: "1px solid " + C.line, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.distDias === 0 ? C.green : C.amber, flexShrink: 0 }} />{distLbl}
                  {s.distDias > 0 && bloqueoVecinos && <span style={{ marginLeft: 6, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: C.amber }}>· resolvé primero las del mismo día</span>}
                </div>
              )}
            <div onClick={() => !bloqueado && onSelect(i)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderBottom: "1px solid " + C.line, borderLeft: "3px solid " + (bloqueado ? C.line2 : probColor), fontSize: 13, background: activa === i ? "#1a9c6e0e" : (!bloqueado && prob >= 90 ? probBg : "transparent"), cursor: bloqueado ? "not-allowed" : "pointer", opacity: bloqueado ? 0.5 : 1 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 700 }}>Ingreso{s.ingIds.length > 1 ? " ×" + s.ingIds.length : ""}{s.conCC && <span style={{ color: "#7c5fd3", fontWeight: 800 }}> · {"\uD83E\uDDFE"} cta. cte.</span>}</span>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, color: C.tinta }}>{fmt(s.ingTotal)}</span>
              </div>
              <span style={{ color: C.txt3 }}>↔</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 700 }}>Banco{s.banIds.length > 1 ? " ×" + s.banIds.length : ""}{s.mismoPagador && <span style={{ color: C.green, fontWeight: 800 }}> · 👤 mismo pagador</span>}</span>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, color: C.tinta }}>{fmt(s.banTotal)}</span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: probColor, background: probBg, borderRadius: 8, padding: "2px 9px" }}>{prob}%</span>
                <span style={{ fontSize: 9, color: probColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px" }}>{probLbl}</span>
              </div>
              <div style={{ textAlign: "right", minWidth: 80 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 13.5, color: (cierra || s.dif < 0) ? C.green : C.red }}>{cierra ? "$0" : (s.dif > 0 ? "-" : "") + fmt(Math.abs(s.dif))}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: (cierra || s.dif < 0) ? C.green : C.red }}>{cierra ? "exacto" : (s.dif < 0 ? "de más" : "de menos") + " · " + (() => { const p = Math.abs(s.dif) / (s.ingTotal || 1) * 100; return p < 0.1 ? "<0,1%" : p.toFixed(1).replace(".", ",") + "%"; })()}</div>
              </div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); if (!bloqueado) onAplicar(s); }} disabled={bloqueado} title={bloqueado ? "Primero conciliá las del mismo día" : "Conciliar este par"} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, padding: "6px 11px", border: "none", borderRadius: 7, background: bloqueado ? C.line2 : C.green, color: bloqueado ? C.txt3 : C.white, cursor: bloqueado ? "not-allowed" : "pointer" }}>✓</button>
                <button onClick={(e) => { e.stopPropagation(); onDescartar(s); }} title="Descartar" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, padding: "6px 10px", border: "1px solid " + C.line2, borderRadius: 7, background: C.white, color: C.txt2, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            </React.Fragment>
          );
        }); })()}
      </div>
      )}
    </div>
  );
}

function DayCompareBar({ ing, ban, ctxIng, ctxBan, refIng, refBan, cntIng, cntBan, cntIngRef, cntBanRef, conc, onDif, difFiltro, tipsTotal, tipsDia, haySeleccion, readonly, selIngTotal, selBanTotal, selIngCount, selBanCount, onConciliar, onLimpiar, onDesarmar, onEditar }) {
  if (haySeleccion) {
    const dif = selIngTotal - selBanTotal;
    const cierra = dif === 0;
    const puede = selIngCount > 0 && selBanCount > 0;
    return (
      <div style={{ display: "flex", alignItems: "stretch", background: C.white, border: "1.5px solid " + C.celeste, borderRadius: 12, overflow: "hidden", marginBottom: 14, boxShadow: "0 4px 16px rgba(91,194,234,.18)" }}>
        <div style={{ flex: 1, padding: "10px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, fontWeight: 700, marginBottom: 2 }}>Ingreso seleccionado</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: C.tinta }}>{fmt(selIngTotal)}</div>
          <div style={{ fontSize: 11, color: C.txt3, fontWeight: 600, marginTop: 1 }}>{selIngCount} {readonly ? "registro" + (selIngCount === 1 ? "" : "s") : "seleccionado" + (selIngCount === 1 ? "" : "s")}</div>
        </div>
        <div style={{ alignSelf: "center", color: C.txt3, fontSize: 16 }}>›</div>
        <div style={{ flex: 1, padding: "10px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, fontWeight: 700, marginBottom: 2 }}>Banco seleccionado</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: C.tinta }}>{fmt(selBanTotal)}</div>
          <div style={{ fontSize: 11, color: C.txt3, fontWeight: 600, marginTop: 1 }}>{selBanCount} movimiento{selBanCount === 1 ? "" : "s"}</div>
        </div>
        <div style={{ flexShrink: 0, padding: "10px 20px", textAlign: "center", background: (cierra || dif < 0) ? C.greenBg : "#d94f6314", borderLeft: "1px solid " + C.line }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, fontWeight: 700, marginBottom: 2 }}>Diferencia</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: (cierra || dif < 0) ? C.green : C.red }}>{cierra ? "$0" : (<span>{dif > 0 ? "-" : ""}{fmt(Math.abs(dif))} <span style={{ fontSize: 12, fontWeight: 700 }}>{dif < 0 ? "de más" : "de menos"} · {(() => { const p = Math.abs(dif) / (selIngTotal || 1) * 100; return p < 0.1 ? "<0,1%" : p.toFixed(1).replace(".", ",") + "%"; })()}</span></span>)}</div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "stretch" }}>
          <button onClick={onLimpiar} title={readonly ? "Cerrar resaltado" : "Limpiar selección"} style={{ border: "none", borderLeft: "1px solid " + C.line, background: C.white, color: C.txt3, cursor: "pointer", padding: "0 14px", fontSize: 18 }}>×</button>
          {!readonly && <button onClick={onConciliar} disabled={!puede} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, padding: "0 22px", border: "none", background: puede ? C.celeste : C.line2, color: puede ? C.noche : C.txt3, cursor: puede ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6 }}>✓ Conciliar{!cierra && puede ? " con diferencia" : ""}</button>}
          {readonly && onEditar && <button onClick={onEditar} title="Editar: desarma y te lleva a pendientes de ese día para corregir (destildar/agregar)" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, padding: "0 18px", border: "none", borderLeft: "1px solid " + C.line, background: "#5BC2EA1c", color: C.celesteDeep, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>✎ Editar</button>}
          {readonly && onDesarmar && <button onClick={onDesarmar} title="Desarmar: manda estos registros a pendientes" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, padding: "0 18px", border: "none", borderLeft: "1px solid " + C.line, background: "#d94f6314", color: C.red, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>↩ Desarmar</button>}
        </div>
      </div>
    );
  }
  const dif = ing - ban;
  const cierra = dif === 0;
  const lbl = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".5px", color: C.txt3, fontWeight: 700, marginBottom: 3 };
  const big = { fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: C.tinta, lineHeight: 1 };
  const sub = { fontSize: 10.5, color: C.txt3, fontWeight: 600, marginTop: 4 };
  const chip = { fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12, background: "#c77d0818", color: C.amber, borderRadius: 7, padding: "1px 7px", marginLeft: 7, verticalAlign: "middle" };
  const subPend = (ref, cntRef, cnt) => ref != null ? (cntRef + " mov · " + fmt(ref) + " en el período") : (cnt + " movimiento" + (cnt === 1 ? "" : "s"));
  const escala = refIng != null ? "del día" : "del período";
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: C.white, border: "1px solid " + C.line2, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
      {conc && (
        <div style={{ flex: 1, padding: "11px 18px" }}>
          <div style={lbl}>Conciliados</div>
          <div style={{ ...big, color: C.green }}>{conc.ok}</div>
          {conc.ok > 0 && <div style={sub}><b style={{ color: C.green }}>{conc.uno}</b> uno a uno · <span style={{ color: C.celesteDeep }}>{conc.varios}</span> compuestas</div>}
          {(conc.deMas > 0 || conc.deMenos > 0) && <div style={{ ...sub, marginTop: 2 }}>dif: <button onClick={() => onDif && onDif("mas")} title="Ver conciliaciones a favor (de más)" style={{ border: "none", background: difFiltro === "mas" ? C.greenBg : "transparent", color: C.green, fontWeight: 800, fontSize: 10.5, fontFamily: "'Archivo',sans-serif", cursor: "pointer", padding: "1px 5px", borderRadius: 6, boxShadow: difFiltro === "mas" ? "inset 0 0 0 1px " + C.green : "none" }}>{fmt(conc.deMas)} de más</button> · <button onClick={() => onDif && onDif("menos")} title="Ver conciliaciones en contra (de menos)" style={{ border: "none", background: difFiltro === "menos" ? "#d94f6314" : "transparent", color: C.red, fontWeight: 800, fontSize: 10.5, fontFamily: "'Archivo',sans-serif", cursor: "pointer", padding: "1px 5px", borderRadius: 6, boxShadow: difFiltro === "menos" ? "inset 0 0 0 1px " + C.red : "none" }}>{fmt(conc.deMenos)} de menos</button></div>}
        </div>
      )}
      <div style={{ flex: 1, padding: "11px 18px", borderLeft: "1px solid " + C.line }}>
        <div style={lbl}>Pendientes ingresos <span style={{ color: C.celesteDeep }}>· {escala}</span></div>
        <div style={big}>{fmt(ing)}{cntIng != null && <span style={chip}>{cntIng}</span>}</div>
        <div style={sub}>{subPend(refIng, cntIngRef, cntIng)}</div>
      </div>
      <div style={{ flex: 1, padding: "11px 18px", borderLeft: "1px solid " + C.line }}>
        <div style={lbl}>Pendientes banco <span style={{ color: C.celesteDeep }}>· {escala}</span></div>
        <div style={big}>{fmt(ban)}{cntBan != null && <span style={chip}>{cntBan}</span>}</div>
        <div style={sub}>{subPend(refBan, cntBanRef, cntBan)}</div>
      </div>
      <div style={{ flexShrink: 0, padding: "11px 22px", textAlign: "center", background: (cierra || dif < 0) ? C.greenBg : "#d94f6314", borderLeft: "1px solid " + C.line }}>
        <div style={lbl}>Diferencia <span style={{ color: C.celesteDeep }}>· {escala}</span></div>
        <div style={{ ...big, color: (cierra || dif < 0) ? C.green : C.red }}>{cierra ? "$0" : (<span>{dif > 0 ? "-" : ""}{fmt(Math.abs(dif))} <span style={{ fontSize: 12.5, fontWeight: 700 }}>{dif < 0 ? "de más" : "de menos"}</span></span>)}</div>
        {refIng != null && (() => { const dr = refIng - refBan; return (
          <div style={{ ...sub, fontWeight: 700, color: (dr <= 0) ? C.green : C.red }}>{dr > 0 ? "-" : ""}{fmt(Math.abs(dr))}{dr === 0 ? "" : (dr < 0 ? " de más" : " de menos")} en el período</div>
        ); })()}
        {(() => { const tv = tipsDia != null ? tipsDia : tipsTotal; return tv > 0 ? <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid " + C.line, fontSize: 9.5, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: ".3px" }}>{"\uD83E\uDE99"} propinas {fmt(tv)}</div> : null; })()}
      </div>
    </div>
  );
}

// Navegador de día ‹ Día › (para vista por día en pendientes)
function DayNav({ center, tol, onMove, canPrev, canNext, diasPend, onPick, desde, hasta }) {
  const [cal, setCal] = React.useState(false);
  const dt = center ? new Date(center + "T12:00:00") : null;
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const lbl = dt ? dias[dt.getDay()] + " " + dt.getDate() + " " + meses[dt.getMonth()] : "";
  return (
    <div data-keep-sel style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}>
      <button onClick={() => canPrev && onMove(-1)} disabled={!canPrev} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid " + C.line2, background: C.white, cursor: canPrev ? "pointer" : "not-allowed", opacity: canPrev ? 1 : 0.4, fontSize: 15, color: C.celesteDeep }}>‹</button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {onPick
          ? <button onClick={(e) => { e.stopPropagation(); setCal(!cal); }} title="Elegir el día en el calendario"
              style={{ border: "1px solid " + (cal ? C.celeste : C.line2), background: cal ? "#5BC2EA18" : C.white, borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: C.tinta, display: "flex", alignItems: "center", gap: 6 }}>
              {"\uD83D\uDCC5"} {lbl || "Elegir día"} <span style={{ fontSize: 10, color: C.celesteDeep }}>{cal ? "\u25B4" : "\u25BE"}</span></button>
          : <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: C.tinta }}>{lbl || "Día en foco"}</span>}
        {tol > 0 && <span style={{ fontSize: 11, color: C.txt3, fontWeight: 600 }}>· ventana ± {tol} día</span>}
      </div>
      <button onClick={() => canNext && onMove(1)} disabled={!canNext} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid " + C.line2, background: C.white, cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.4, fontSize: 15, color: C.celesteDeep }}>›</button>
      {cal && onPick && (
        <React.Fragment>
          <div onClick={(e) => { e.stopPropagation(); setCal(false); }} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 6, zIndex: 61 }}>
            <CalendarioPend center={center} diasPend={diasPend || {}} desde={desde} hasta={hasta} onPick={(d) => { setCal(false); onPick(d); }} />
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// Calendario mensual para elegir el día. Marca en ámbar los días con pendientes
// (con la cantidad) y en celeste el día en foco. Solo deja elegir días del período.
function CalendarioPend({ center, diasPend, desde, hasta, onPick }) {
  const base = (center || desde || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [mes, setMes] = React.useState(base);
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const [y, m] = mes.split("-").map((n) => parseInt(n, 10));
  const nDias = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes primero
  const iso = (d) => mes + "-" + String(d).padStart(2, "0");
  const enPer = (s) => (!desde || s >= desde) && (!hasta || s <= hasta);
  const mover = (k) => { const dt = new Date(y, m - 1 + k, 1); const nm = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"); setMes(nm); };
  const hayPrev = !desde || mes > desde.slice(0, 7);
  const hayNext = !hasta || mes < hasta.slice(0, 7);
  const totMes = Object.keys(diasPend).filter((d) => d.slice(0, 7) === mes).reduce((a, d) => a + diasPend[d], 0);
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= nDias; d++) celdas.push(d);
  const navBtn = (on) => ({ width: 26, height: 26, borderRadius: 7, border: "1px solid " + C.line2, background: C.white, cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.35, color: C.celesteDeep, fontSize: 14 });
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: 300, background: C.white, border: "1px solid " + C.line2, borderRadius: 12, boxShadow: "0 14px 40px rgba(21,33,62,.22)", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button disabled={!hayPrev} onClick={() => hayPrev && mover(-1)} style={navBtn(hayPrev)}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: C.tinta }}>{meses[m - 1]} {y}</div>
          <div style={{ fontSize: 10.5, color: C.txt3 }}>{totMes ? totMes + " pendientes en el mes" : "sin pendientes"}</div>
        </div>
        <button disabled={!hayNext} onClick={() => hayNext && mover(1)} style={navBtn(hayNext)}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={"h" + i} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: C.txt3, padding: "2px 0" }}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={"e" + i} />;
          const s = iso(d); const ok = enPer(s); const n = diasPend[s] || 0; const foco = s === center;
          return (
            <button key={s} disabled={!ok} onClick={() => ok && onPick(s)} title={ok ? (n ? n + " pendientes" : "sin pendientes") : "fuera del período"}
              style={{ height: 36, borderRadius: 8, border: "1px solid " + (foco ? C.celeste : (n ? "#c77d0855" : C.line)), background: foco ? C.celeste : (n ? "#c77d0812" : C.white), color: foco ? C.noche : (ok ? C.tinta : C.txt3), opacity: ok ? 1 : 0.35, cursor: ok ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "'Sora',sans-serif" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1 }}>{d}</span>
              {n > 0 && <span style={{ fontSize: 8.5, fontWeight: 800, color: foco ? C.noche : C.amber, lineHeight: 1.2 }}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10.5, color: C.txt3, justifyContent: "center" }}>
        <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: "#c77d0830", border: "1px solid #c77d0866", marginRight: 4, verticalAlign: "-1px" }} />con pendientes</span>
        <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: C.celeste, marginRight: 4, verticalAlign: "-1px" }} />día en foco</span>
      </div>
    </div>
  );
}

// Filas agrupadas por día, con el día centro distinguido de los vecinos.
// Si groupEqual está activo, dentro de cada día junta los importes repetidos
// en una fila "$X ×N" expandible.
function DayGroupedRows({ rows, windowDays, center, renderRow, innerRef, groupEqual, expandedGroups, onToggleGroup, tailCols, selBan, onToggleGroupSel, sort, faltantes }) {
  const fmtSep = (d) => {
    const dt = new Date(d + "T12:00:00");
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    return dias[dt.getDay()] + " " + dt.getDate() + " " + ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][dt.getMonth()];
  };
  const byDay = windowDays.map((d) => ({ d, isCenter: d === center, items: rows.filter((r) => r.fecha === d) }));
  const anyItems = byDay.some((g) => g.items.length);

  // agrupa los items de un día por importe (mantiene orden de aparición)
  const groupByAmount = (items) => {
    const map = new Map();
    items.forEach((it) => { const k = it.imp; if (!map.has(k)) map.set(k, []); map.get(k).push(it); });
    let arr = [...map.entries()].map(([imp, its]) => ({ imp: Number(imp), items: its, subtotal: Number(imp) * its.length }));
    // si el orden activo es por importe, ordenar los grupos por su SUBTOTAL
    // (el número grande que se muestra), no por el importe individual
    if (sort && sort.campo === "imp") {
      arr.sort((a, b) => (a.subtotal - b.subtotal) * sort.dir);
    }
    return arr;
  };

  return (
    <div ref={innerRef} style={{ overflowY: "auto", flex: 1 }}>
      {!anyItems && <div style={{ padding: 40, textAlign: "center", color: C.txt3, fontSize: 15 }}>Sin pendientes en esta ventana</div>}
      {byDay.map((g) => {
        const faltDia = (faltantes || []).filter((f) => f.fecha === g.d);
        const totFalt = faltDia.reduce((a, f) => a + f.monto, 0);
        const totDia = g.items.reduce((a, r) => a + r.imp, 0) + totFalt;
        return (
        <div key={g.d}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: g.isCenter ? "#1a2d4a" : C.tinta, borderBottom: "1px solid " + C.line }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".5px", color: C.paper }}>{fmtSep(g.d)}</span>
            {g.isCenter && <span style={{ fontSize: 10, fontWeight: 700, background: C.celeste, color: C.noche, borderRadius: 7, padding: "1px 6px", textTransform: "uppercase", letterSpacing: ".3px" }}>Día</span>}
            <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 13, color: C.celeste }}>{fmt(totDia)}</span>
            <span style={{ fontSize: 11, color: C.txt3, marginLeft: 6 }}>{g.items.length + faltDia.length}</span>
          </div>
          {groupEqual
            ? groupByAmount(g.items).map((grp) => {
                if (grp.items.length < 2) return renderRow(grp.items[0], !g.isCenter);
                const gkey = g.d + ":" + grp.imp;
                const open = expandedGroups.has(gkey);
                const grpIds = grp.items.map((it) => it.id);
                const grpChecked = selBan ? grpIds.every((id) => selBan.has(id)) : false;
                const grpPartial = selBan && !grpChecked && grpIds.some((id) => selBan.has(id));
                return (
                  <div key={gkey}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid " + C.line, background: grpChecked ? "#5BC2EA1c" : "#5BC2EA0e", outline: grpChecked ? "2px solid " + C.celeste : "none", outlineOffset: -2, fontSize: 14.5, opacity: g.isCenter ? 1 : 0.62 }}>
                      {/* checkbox: selecciona TODOS los del grupo */}
                      <span onClick={(e) => { e.stopPropagation(); onToggleGroupSel && onToggleGroupSel(grpIds); }}
                        style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (grpChecked || grpPartial ? C.celeste : C.line2), background: grpChecked ? C.celeste : grpPartial ? "#5BC2EA55" : "transparent", color: C.noche, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>{grpChecked ? "✓" : grpPartial ? "–" : ""}</span>
                      {/* flecha: expande/colapsa */}
                      <span onClick={(e) => { e.stopPropagation(); onToggleGroup(gkey); }} style={{ fontSize: 12, color: C.celesteDeep, width: 8, flexShrink: 0, cursor: "pointer" }}>{open ? "▾" : "▸"}</span>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, background: C.celeste, color: C.noche, borderRadius: 8, padding: "1px 8px", flexShrink: 0 }}>×{grp.items.length}</span>
                      <span style={{ color: C.txt2, fontSize: 13.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        movimientos iguales <span style={{ color: C.txt3, fontSize: 12 }}>· {fmt(grp.imp)} c/u</span>
                      </span>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, width: 100, textAlign: "right", flexShrink: 0, color: C.tinta }}>{fmt(grp.imp * grp.items.length)}</span>
                      {/* spacers que replican EXACTAMENTE las columnas después del importe,
                          para que el subtotal caiga en la misma columna que los importes normales */}
                      {(tailCols || []).map((c) => (
                        <span key={c.key} style={{ width: c.w, flexShrink: 0 }} />
                      ))}
                    </div>
                    {open && grp.items.map((r) => (
                      <div key={r.id} style={{ paddingLeft: 18, background: "#5BC2EA06" }}>{renderRow(r, !g.isCenter)}</div>
                    ))}
                  </div>
                );
              })
            : g.items.map((r) => renderRow(r, !g.isCenter))}
          {/* faltantes de conciliación manual del día: filas hijas "resto sin acreditar" */}
          {faltDia.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 30px", borderBottom: "1px solid " + C.line, background: "#7c5fd30c", opacity: g.isCenter ? 1 : 0.62 }}>
              <span style={{ color: "#7c5fd3", fontSize: 14, flexShrink: 0 }}>↳</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: "#7c5fd322", color: "#7c5fd3", borderRadius: 7, padding: "1px 7px", flexShrink: 0 }}>Sin acreditar</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, color: C.txt3 }}>{f.origenDesc}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, color: "#7c5fd3", flexShrink: 0 }}>{fmt(f.monto)}</span>
            </div>
          ))}
        </div>
        );
      })}
    </div>
  );
}
function Empty() { return <div style={{ padding: 40, textAlign: "center", color: C.txt3, fontSize: 15 }}>Sin registros</div>; }

// Vista por día COMPARTIDA (opción B): una banda de día a lo ancho, y debajo
// ingresos a la izquierda y banco a la derecha. Las dos columnas se estiran a la
// misma altura (flex stretch), así la banda del día siempre queda alineada.
function DiaCompartido({ ingRows, banRows, windowDays, center, innerRef, renderIng, renderBan, faltantes, tipDia, selIng, selBan, onSelDia, efectivoDia, efectivoOpen, onToggleEfectivo, efectivoSosp, selEfec, onToggleEfec, ccDia, ccOpen, onToggleCC, onCliente, tieneCuentaFn, formaFn, selCC, onToggleCCSel, ccConc }) {
  const [verConcCC, setVerConcCC] = React.useState(new Set()); // días donde mostrás también las CC ya conciliadas
  const fmtSep = (d) => {
    const dt = new Date(d + "T12:00:00");
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    return dias[dt.getDay()] + " " + dt.getDate() + " " + ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][dt.getMonth()];
  };
  const byDay = windowDays.map((d) => ({
    d, isCenter: d === center,
    ing: ingRows.filter((r) => r.fecha === d),
    ban: banRows.filter((r) => r.fecha === d),
    falt: (faltantes || []).filter((f) => f.fecha === d),
  }));
  const any = byDay.some((g) => g.ing.length || g.ban.length || g.falt.length);
  return (
    <div ref={innerRef} style={{ overflowY: "auto", flex: 1 }}>
      {!any && <div style={{ padding: 40, textAlign: "center", color: C.txt3, fontSize: 15 }}>Sin pendientes en esta ventana</div>}
      {byDay.map((g) => {
        const totIng = g.ing.reduce((a, r) => a + r.imp, 0) + g.falt.reduce((a, f) => a + f.monto, 0);
        const totBan = g.ban.reduce((a, r) => a + r.imp, 0);
        return (
          <div key={g.d}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", background: g.isCenter ? "#1a2d4a" : C.tinta, borderBottom: "1px solid " + C.line }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRight: "1px solid " + C.line }}>
                {onSelDia && g.ing.length > 0 && (() => { const all = selIng && g.ing.every((r) => selIng.has(r.id)); return (
                  <span onClick={(e) => { e.stopPropagation(); onSelDia(g.ing.map((r) => r.id), "ing", all); }} title="Seleccionar todos los ingresos del día"
                    style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (all ? C.celeste : "rgba(255,255,255,.5)"), background: all ? C.celeste : "transparent", color: C.noche, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{all ? "✓" : ""}</span>
                ); })()}
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".5px", color: C.paper }}>{fmtSep(g.d)}</span>
                {g.isCenter && <span style={{ fontSize: 10, fontWeight: 700, background: C.celeste, color: C.noche, borderRadius: 7, padding: "1px 6px", textTransform: "uppercase", letterSpacing: ".3px" }}>Día</span>}
                <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12.5, color: C.celeste }}>ing {fmt(totIng)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }}>
                {onSelDia && g.ban.length > 0 && (() => { const all = selBan && g.ban.every((r) => selBan.has(r.id)); return (
                  <span onClick={(e) => { e.stopPropagation(); onSelDia(g.ban.map((r) => r.id), "ban", all); }} title="Seleccionar todos los movimientos de banco del día"
                    style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (all ? C.celeste : "rgba(255,255,255,.5)"), background: all ? C.celeste : "transparent", color: C.noche, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{all ? "✓" : ""}</span>
                ); })()}
                <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12.5, color: C.celeste }}>banco {fmt(totBan)}{tipDia && tipDia[g.d] > 0 ? <span style={{ color: C.amber }}> · {"\uD83E\uDE99"} {fmt(tipDia[g.d])}</span> : null}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid " + C.line }}>
                {efectivoDia && efectivoDia[g.d] && efectivoDia[g.d].items.length > 0 && (() => { const ef = efectivoDia[g.d]; const open = efectivoOpen && efectivoOpen.has(g.d); const sospItems = ef.items.filter((f) => efectivoSosp && efectivoSosp[f.id]); const nSosp = sospItems.length; const nEx = sospItems.filter((f) => efectivoSosp[f.id].exacto).length; return (
                  <div>
                    <div onClick={(e) => { e.stopPropagation(); onToggleEfectivo && onToggleEfectivo(g.d); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: nEx ? "#d94f630c" : (nSosp ? "#c77d080c" : "#00000006"), opacity: g.isCenter ? 1 : 0.62 }}>
                      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "\u25BE" : "\u25B8"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: C.txt3 }}>{"\uD83D\uDCB5"} Efectivo</span>
                      <span style={{ fontSize: 11, color: C.txt3 }}>{ef.items.length} comprob.</span>
                      {nSosp > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: "#d94f631c", color: C.red, borderRadius: 6, padding: "1px 6px" }}>{"\u26A0"} {nSosp} posible{nSosp === 1 ? "" : "s"} error{nSosp === 1 ? "" : "es"} de caja</span>}
                      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: C.txt2 }}>{fmt(ef.total)}</span>
                    </div>
                    {open && ef.items.map((f, i) => { const sosp = efectivoSosp && efectivoSosp[f.id]; const col = sosp ? (sosp.exacto ? C.red : C.amber) : C.txt3; const sel = selEfec && selEfec.has(f.id); const fp = formaFn ? formaFn(f) : null; return (
                      <React.Fragment key={i}>
                      <div onClick={(e) => { e.stopPropagation(); onToggleEfec && onToggleEfec(f.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px 5px 14px", borderBottom: "1px solid " + C.line, fontSize: 12, cursor: "pointer", background: sel ? "#5BC2EA14" : (sosp ? (sosp.exacto ? "#d94f630e" : "#c77d080e") : "#00000003"), boxShadow: sosp && !sel ? "inset 3px 0 0 " + col : (sel ? "inset 3px 0 0 " + C.celeste : undefined), opacity: g.isCenter ? 1 : 0.62 }}>
                        <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (sel ? C.celeste : C.line2), background: sel ? C.celeste : C.white, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel ? "✓" : ""}</span>
                        <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{f.hora || "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.comp}{sosp && <span style={{ fontWeight: 700 }} title={"Este efectivo de " + fmt(f.total) + " coincide EXACTO con un movimiento de banco pendiente del mismo día" + (sosp.banHora ? " (" + sosp.banHora + ")" : "") + " — quizás entró por banco y el cajero lo cargó como efectivo"}> · {"\u26A0"} = banco pend. {fmt(sosp.banImp)}{sosp.banHora ? " " + sosp.banHora : ""}</span>}</span>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: sosp ? col : C.txt2, textAlign: "right", flexShrink: 0 }}>{fmt(f.total)}</span>
                        <span onClick={fp ? (e) => { e.stopPropagation(); fp.onToggleForma(); } : undefined} title={fp ? "Corregir forma de pago (error de carga)" : ""} style={{ width: 100, flexShrink: 0, fontSize: 11, color: fp ? C.celesteDeep : C.txt3, textTransform: "uppercase", letterSpacing: ".3px", cursor: fp ? "pointer" : "default", textDecoration: fp ? "underline" : "none", textDecorationColor: "rgba(36,146,200,.35)" }}>Efectivo{fp ? " \u270E" : ""}</span>
                      </div>
                      {fp && fp.formaEditing && <div style={{ padding: "7px 14px 8px 30px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}><FormaEditor actual={fp.formaActual} onSet={fp.onSetForma} /></div>}
                      </React.Fragment>
                    ); })}
                  </div>
                ); })()}
                {ccDia && ccDia[g.d] && ccDia[g.d].items.length > 0 && (() => { const cc = ccDia[g.d]; const open = ccOpen && ccOpen.has(g.d);
                  const pendCC = cc.items.filter((r) => !r.saldado), concCC = cc.items.filter((r) => r.saldado);
                  const totPend = pendCC.reduce((a, r) => a + r.imp, 0), totConc = concCC.reduce((a, r) => a + r.imp, 0);
                  const verConc = verConcCC.has(g.d);
                  const lista = verConc ? [...pendCC, ...concCC] : pendCC;
                  const fC = (d) => d ? fmtFecha(d).slice(0, 5).replace("-", "/") : "";
                  const motivo = (r) => r.estado === "impaga" ? "sin cobro en el ERP"
                    : r.estado === "erp" ? "ERP: cobrada " + fC(r.cobroFecha) + " \u00B7 falta en banco"
                    : r.estado === "galicia" ? "ERP: cobrada por Galicia " + fC(r.cobroFecha) + " \u00B7 banco no cargado"
                    : r.estado === "otro" ? "cobro de ticket anterior" + (r.ticketFecha ? " (" + fC(r.ticketFecha) + ")" : "") + " \u00B7 falta en banco"
                    : "saldada" + (r.cobroFecha ? " " + fC(r.cobroFecha) : "") + ((r.formas || []).some((f) => f !== "banco") ? " \u00B7 " + r.formas.filter((f) => f !== "banco").join("/") : "");
                  return (
                  <div>
                    <div onClick={(e) => { e.stopPropagation(); onToggleCC && onToggleCC(g.d); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#7c5fd30c", opacity: g.isCenter ? 1 : 0.62 }}>
                      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "\u25BE" : "\u25B8"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: "#7c5fd3" }}>{"\uD83E\uDDFE"} Cuenta corriente</span>
                      <span style={{ fontSize: 11, color: C.txt3 }}>{pendCC.length ? pendCC.length + " impaga" + (pendCC.length === 1 ? "" : "s") : "todas saldadas"}</span>
                      {concCC.length > 0 && <span onClick={(e) => { e.stopPropagation(); setVerConcCC((s) => { const n = new Set(s); n.has(g.d) ? n.delete(g.d) : n.add(g.d); return n; }); if (!open && onToggleCC) onToggleCC(g.d); }}
                        title={verConc ? "Ocultar las ya saldadas" : "Ver las ya saldadas (" + fmt(totConc) + ")"}
                        style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: verConc ? "#1a9c6e" : "#1a9c6e1c", color: verConc ? C.white : C.green, borderRadius: 6, padding: "1px 6px", cursor: "pointer" }}>{"\u2713"} {concCC.length} saldada{concCC.length === 1 ? "" : "s"} {verConc ? "\u25B4" : "\u25BE"}</span>}
                      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: pendCC.length ? "#7c5fd3" : C.txt3 }}>{fmt(totPend)}</span>
                    </div>
                    {open && lista.map((r) => { const clic = onCliente && r.cliente && (!tieneCuentaFn || tieneCuentaFn(r.cliente)); const conc = r.saldado; const selec = r.cobroIds.length > 0; const sel = selec && selCC && r.cobroIds.every((id) => selCC.has(id)); return (
                      <div key={r.key} onClick={(e) => { e.stopPropagation(); if (!conc && selec && onToggleCCSel) onToggleCCSel(r.cobroIds); }}
                        title={r.estado === "impaga" ? "El ERP no tiene cobro de este ticket: queda impaga hasta que se cobre" : r.estado === "erp" ? "Tildalo para conciliar su cobro con el pago del banco" : r.estado === "galicia" ? "Se cobró por Banco Galicia: se va a conciliar cuando carguemos ese banco" : ""}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px", borderBottom: "1px solid " + C.line, fontSize: 12, cursor: !conc && selec ? "pointer" : "default", background: sel ? "#5BC2EA14" : (conc ? "#1a9c6e0a" : "#7c5fd306"), boxShadow: sel ? "inset 3px 0 0 " + C.celeste : (conc ? "inset 3px 0 0 " + C.green : undefined), opacity: g.isCenter ? 1 : 0.62 }}>
                        {conc
                          ? <span title="Saldada: su pago está conciliado" style={{ width: 15, height: 15, borderRadius: 4, background: C.green, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{"\u2713"}</span>
                          : selec
                            ? <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (sel ? C.celeste : C.line2), background: sel ? C.celeste : C.white, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel ? "\u2713" : ""}</span>
                            : <span style={{ width: 15, flexShrink: 0 }} />}
                        <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{r.hora || "\u2014"}</span>
                        <span onClick={clic ? (e) => { e.stopPropagation(); onCliente(r.cliente); } : undefined} style={{ flex: 1, minWidth: 0, color: clic ? C.celesteDeep : C.txt2, cursor: clic ? "pointer" : "default", textDecoration: clic ? "underline" : "none", textDecorationColor: "rgba(36,146,200,.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={clic ? "Ver cuenta corriente de " + r.cliente : ""}>{r.cliente || "\u2014"}</span>
                        <span style={{ flexShrink: 0, fontSize: 10.5, whiteSpace: "nowrap", fontWeight: 700, color: conc ? C.green : r.estado === "impaga" ? C.txt3 : C.amber }}>{motivo(r)}</span>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.txt2, textAlign: "right", flexShrink: 0 }}>{fmt(r.imp)}</span>
                        <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: C.txt3, textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.comp}>{(r.comp || "Cta. cte.").replace(/^(\S+)\s+\d+-0*/, "$1 \u2026")}</span>
                      </div>
                    ); })}
                  </div>
                ); })()}
                {g.ing.map((r) => renderIng(r, !g.isCenter))}
                {g.falt.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 30px", borderBottom: "1px solid " + C.line, background: "#7c5fd30c", opacity: g.isCenter ? 1 : 0.62 }}>
                    <span style={{ color: "#7c5fd3", fontSize: 14, flexShrink: 0 }}>↳</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: "#7c5fd322", color: "#7c5fd3", borderRadius: 7, padding: "1px 7px", flexShrink: 0 }}>Sin acreditar</span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, color: C.txt3 }}>{f.origenDesc}</span>
                    <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14.5, color: "#7c5fd3", flexShrink: 0 }}>{fmt(f.monto)}</span>
                  </div>
                ))}
                {!g.ing.length && !g.falt.length && !(efectivoDia && efectivoDia[g.d] && efectivoDia[g.d].items.length) && !(ccDia && ccDia[g.d] && ccDia[g.d].items.length) && <div style={{ padding: "10px 16px", fontSize: 12, color: C.txt3, opacity: 0.6 }}>—</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {g.ban.map((r) => renderBan(r, !g.isCenter))}
                {!g.ban.length && <div style={{ padding: "10px 16px", fontSize: 12, color: C.txt3, opacity: 0.6 }}>—</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const rowBase = { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid " + C.line, fontSize: 14.5 };
const dot = (c) => ({ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: c });
const fCell = { color: C.txt3, fontSize: 13, width: 74, flexShrink: 0 };
const cliCell = { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14, color: C.txt2 };
const descCell = { flexShrink: 0, fontSize: 13.5, color: C.txt3 };
const impCell = { fontFamily: "'Sora',sans-serif", fontWeight: 700, marginLeft: "auto", flexShrink: 0 };
const tag = (bg, fg) => ({ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", padding: "1px 6px", borderRadius: 8, flexShrink: 0, background: bg, color: fg });

// Formatea el valor de una celda según la columna
function cellValue(row, col, side) {
  const k = col.key;
  if (k === "imp") return fmt(row.imp);
  if (k === "fecha") return fmtFecha(row.fecha);
  if (k === "fechaFact") return fmtFecha(row.fechaFact || row.fecha);
  if (k === "origenLbl") return row.origen === "cc" ? "CC" : "VD";
  // forma de cobro: en las CC no existe (informe 71 no la trae) → mostrar "Cuenta corriente"
  if (k === "cobro") return row.origen === "cc" ? "Cuenta corriente" : (row.cobro || "—");
  // columna que solo aplica a una fuente: si no corresponde, mostrar —
  if (col.only && row.origen !== col.only) return "—";
  const val = row[k];
  if (val === undefined || val === null || val === "") return "—";
  return String(val);
}

// Fila dinámica: renderiza solo las columnas visibles. side: 'ing' | 'ban'
// Editor de observación (draft local para no re-renderizar todas las filas al tipear)
function NotaEditor({ value, onSave }) {
  const [draft, setDraft] = React.useState(value || "");
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="Observación…" onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, border: "1px solid " + C.line2, borderRadius: 7, fontFamily: "'Archivo',sans-serif", fontSize: 12.5, padding: "6px 8px", resize: "vertical", minHeight: 38 }} />
      <button onClick={(e) => { e.stopPropagation(); onSave(draft.trim()); }} style={{ background: C.celeste, color: C.noche, border: "none", borderRadius: 7, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, padding: "7px 13px", cursor: "pointer", flexShrink: 0 }}>Listo</button>
    </div>
  );
}

// Ícono/editor de propina para un movimiento de banco (siempre visible)
function TipChip({ tip, onToggle }) {
  const has = tip > 0;
  return (
    <span onClick={(e) => { e.stopPropagation(); onToggle(); }} title={has ? "Editar propina" : "Marcar propina de este movimiento"}
      style={{ flexShrink: 0, cursor: "pointer", marginLeft: 8, fontSize: 10, fontWeight: 800, fontFamily: "'Sora',sans-serif", background: has ? "#c77d0822" : "transparent", color: has ? C.amber : C.txt3, border: "1px solid " + (has ? C.amber : C.line2), borderRadius: 7, padding: "2px 7px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
      {has ? "propina " + fmt(tip) : "+ propina"}
    </span>
  );
}
function TipEditor({ value, max, onSave, onTodo, onQuitar, defaultDif }) {
  const [draft, setDraft] = React.useState(value ? String(value) : (defaultDif ? String(defaultDif) : ""));
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.txt3, textTransform: "uppercase", letterSpacing: ".3px" }}>Propina</span>
      <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="0" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onSave(parseInt(draft) || 0); } }}
        style={{ width: 100, border: "1px solid " + C.line2, borderRadius: 7, fontFamily: "'Archivo',sans-serif", fontSize: 13, padding: "5px 8px" }} />
      <button onClick={(e) => { e.stopPropagation(); onSave(parseInt(draft) || 0); }} style={{ background: C.amber, color: C.white, border: "none", borderRadius: 7, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>Guardar</button>
      <button onClick={(e) => { e.stopPropagation(); onTodo(); }} style={{ background: C.white, color: C.txt2, border: "1px solid " + C.line2, borderRadius: 7, fontSize: 11.5, padding: "6px 9px", cursor: "pointer" }}>Todo es propina ({fmt(max)})</button>
      {value > 0 && <button onClick={(e) => { e.stopPropagation(); onQuitar(); }} style={{ background: "transparent", color: C.red, border: "none", fontSize: 11.5, cursor: "pointer" }}>Quitar</button>}
    </div>
  );
}

// Ícono de observación: aparece al hover (celeste fijo si hay nota); muestra la
// nota como tooltip al pasar por encima; al hacer clic abre el editor.
function NotaChip({ nota, onToggle }) {
  const [hover, setHover] = React.useState(false);
  const has = !!(nota && nota.length);
  return (
    <span className={"cx-note" + (has ? " has" : "")} style={{ position: "relative", flexShrink: 0, cursor: "pointer", fontSize: 13, lineHeight: 1, color: has ? C.celesteDeep : C.txt3, marginLeft: 8 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onToggle(); }} title={has ? "" : "Agregar observación"}>
      {"\uD83D\uDDD2"}
      {has && hover && (
        <span style={{ position: "absolute", bottom: "150%", right: 0, zIndex: 70, background: C.tinta, color: C.paper, fontSize: 12, fontWeight: 400, lineHeight: 1.4, padding: "8px 10px", borderRadius: 8, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,.28)", whiteSpace: "normal", textAlign: "left", textTransform: "none", letterSpacing: 0 }}>{nota}</span>
      )}
    </span>
  );
}

function DynRow({ row, allCols, visible, side, selectable, checked, suggested, dim, onClick, hidden, nota, notaEditing, onToggleNota, onSaveNota, tip, tipImp, tipEditing, onToggleTip, onSaveTip, onTodoTip, onQuitarTip, onCliente, tieneCuenta, defaultDif, formaEditing, formaActual, onToggleForma, onSetForma }) {
  const ok = row.status === "ok";
  const [tipPos, setTipPos] = React.useState(null); // posición del tooltip de comprobante
  const cols = allCols.filter((c) => (c.fixed || visible.has(c.key)) && !(hidden && hidden.has(c.key)));
  const isIng = side === "ing";
  const hayComp = isIng && row.comp;
  const consec = isIng && row.matchTipo === "consecutivos";
  // tags (solo ingresos)
  let tg = null, ccTag = null;
  if (isIng) {
    const n = (row.matchedWith || []).length;
    if (ok && row.matchTipo === "manual") tg = <span style={tag("#5BC2EA22", C.celesteDeep)}>manual{row.manualDif ? " · dif " + fmt(Math.abs(row.manualDif)) : ""}</span>;
    else if (ok && row.matchTipo === "cliente") tg = <span style={tag("#5BC2EA22", C.celesteDeep)}>grupo cliente</span>;
    else if (ok && row.matchTipo === "ctacte") tg = <span style={tag("#7c5fd318", "#7c5fd3")}>{"\uD83E\uDDFE"} cta. cte.</span>;
    else if (ok && row.matchTipo === "combinado") tg = <span style={tag("#c77d0818", C.amber)}>combinado</span>;
    else if (ok && n === 1) tg = <span style={tag(C.greenBg, C.green)}>1↔1</span>;
    else if (ok && row.matchTipo === "iguales") tg = <span style={tag("#5BC2EA22", C.celesteDeep)}>{n} iguales</span>;
    else if (ok && consec) tg = row.porHora
      ? <span style={tag("#7c5fd318", "#7c5fd3")}>{"\u23F1 "}{n} por hora</span>
      : <span style={tag("#ef444418", C.red)}>{n} consec.</span>;
    else if (ok && n > 1) tg = <span style={tag("#5BC2EA22", C.celesteDeep)}>{n} mov</span>;
    if (row.origen === "cc" && !cols.some((c) => c.key === "cobro")) ccTag = <span style={tag("#a78bfa22", "#7c5fd3")}>CC</span>;
  }
  // resaltado: seleccionado (celeste) tiene prioridad sobre sugerido (verde)
  const bg = checked ? "#5BC2EA1c" : suggested ? "#1a9c6e18" : ok ? C.greenBg : C.amberBg;
  const outline = checked ? "2px solid " + C.celeste : suggested ? "2px solid " + C.green : "none";
  const cursor = selectable ? "pointer" : "default";

  const tieneNota = !!(nota && nota.length);
  const hayTip = tip > 0;
  const haySerie = !!row.serieNota;
  const hayTooltip = hayComp || haySerie;
  const rowEl = (
    <div data-rowid={row.id} className="cx-row" onClick={onClick}
      onMouseEnter={(e) => hayTooltip && setTipPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTipPos(null)}
      style={{ ...rowBase, background: hayTip ? "#fff7ec" : bg, cursor, outline, outlineOffset: -2, boxShadow: hayTip ? "inset 3px 0 0 " + C.amber : (tieneNota ? "inset 3px 0 0 " + C.celeste : undefined), color: consec ? C.red : "inherit", opacity: dim ? 0.62 : 1 }}>
      {tipPos && (
        <span style={{ position: "fixed", left: tipPos.x + 14, top: tipPos.y + 14, zIndex: 9999, maxWidth: 260, background: C.tinta, color: C.paper, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12, padding: "6px 10px", borderRadius: 7, whiteSpace: haySerie ? "normal" : "nowrap", lineHeight: 1.35, boxShadow: "0 6px 20px rgba(21,33,62,.35)", pointerEvents: "none" }}>
          {haySerie ? row.serieNota : "Comprobante: " + row.comp}
        </span>
      )}
      {selectable
        ? <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (checked ? C.celeste : C.line2), background: checked ? C.celeste : "transparent", color: C.noche, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{checked ? "✓" : ""}</span>
        : <span style={dot(ok ? C.green : C.amber)} />}
      {cols.map((c) => {
        const st = {};
        if (typeof c.w === "number") { st.width = c.w; st.flexShrink = 0; if (c.align !== "right") { st.overflow = "hidden"; st.textOverflow = "ellipsis"; st.whiteSpace = "nowrap"; } }
        if (c.flex) { st.flex = 1; st.minWidth = 0; st.whiteSpace = "nowrap"; st.overflow = "hidden"; st.textOverflow = "ellipsis"; }
        if (c.align === "right") { st.textAlign = "right"; if (!c.w) st.marginLeft = "auto"; }
        if (c.key === "fecha" || c.key === "fechaFact") { st.color = consec ? "#d94f6399" : C.txt3; st.fontSize = 11; }
        else if (c.key === "cliente") { st.color = C.txt2; st.fontSize = 12; st.minWidth = 84; }
        else if (c.key === "imp") { st.fontFamily = "'Sora',sans-serif"; st.fontWeight = 700; if (consec) st.color = C.red; }
        else { st.fontSize = 11.5; st.color = C.txt3; }
        if (c.key === "cliente" && onCliente && row.cliente && (!tieneCuenta || tieneCuenta(row.cliente)))
          return <span key={c.key} style={{ ...st, color: C.celesteDeep, cursor: "pointer", fontWeight: 600, textDecoration: "underline", textDecorationColor: "rgba(36,146,200,.35)", textUnderlineOffset: 2 }} onClick={(e) => { e.stopPropagation(); onCliente(row.cliente); }} title={"Ver cuenta corriente de " + row.cliente}>{cellValue(row, c, side)}</span>;
        if (c.key === "cobro" && onToggleForma)
          return <span key={c.key} style={{ ...st, color: C.celesteDeep, cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(36,146,200,.35)", textUnderlineOffset: 2 }} onClick={(e) => { e.stopPropagation(); onToggleForma(); }} title="Corregir forma de pago (error de carga)">{cellValue(row, c, side)} ✎</span>;
        return <span key={c.key} style={st}>{cellValue(row, c, side)}</span>;
      })}
      {isIng && (ccTag || tg) && <span style={{ display: "flex", gap: 6, marginLeft: 8, flexShrink: 0 }}>{ccTag}{tg}</span>}
      {row.serieMult > 1 && <span title="" style={{ fontSize: 10, fontWeight: 800, background: "#5BC2EA22", color: C.celesteDeep, borderRadius: 7, padding: "1px 6px", marginLeft: 8, flexShrink: 0 }}>×{row.serieMult}</span>}
      {onToggleNota && <NotaChip nota={nota} onToggle={onToggleNota} />}
      {onToggleTip && (hayTip
        ? <span onClick={(e) => { e.stopPropagation(); onToggleTip(); }} title="Editar propina" style={{ marginLeft: 8, flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontSize: 10, background: "#c77d0822", color: C.amber, border: "1px solid " + C.amber, borderRadius: 7, padding: "2px 7px", fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>pago {fmt(tipImp - tip)} · 🪙 {fmt(tip)} ✎</span>
        : <TipChip tip={0} onToggle={onToggleTip} />)}
    </div>
  );
  if (!onToggleNota && !onToggleTip) return rowEl;
  return (
    <React.Fragment>
      {rowEl}
      {notaEditing && (
        <div style={{ padding: "5px 14px 8px 30px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}>
          <NotaEditor value={nota} onSave={onSaveNota} />
        </div>
      )}
      {tipEditing && (
        <div style={{ padding: "6px 14px 8px 30px", background: "#fff7ec", borderBottom: "1px solid " + C.line }}>
          <TipEditor value={tip} max={tipImp} onSave={onSaveTip} onTodo={onTodoTip} onQuitar={onQuitarTip} defaultDif={defaultDif} />
        </div>
      )}
      {formaEditing && (
        <div style={{ padding: "7px 14px 8px 30px", background: "#5BC2EA10", borderBottom: "1px solid " + C.line }}>
          <FormaEditor actual={formaActual} onSet={onSetForma} />
        </div>
      )}
    </React.Fragment>
  );
}

// ─── Modal de importación ───────────────────────────────────────────
function ImportModal({ fuente, business, onClose, onFile, onHelp }) {
  const inputRef = React.useRef(null);
  return (
    <Overlay onClose={onClose}>
      <div style={{ background: C.white, borderRadius: 18, width: 520, maxWidth: "94vw", boxShadow: "0 30px 80px rgba(0,0,0,.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "20px 22px 16px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.celeste, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 21 }}>⬆️</div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: C.tinta, flex: 1, margin: 0 }}>Importar {fuente.titulo}</h2>
          {fuente.instructivo && <button onClick={onHelp} title="¿Cómo exporto este archivo?" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "#5BC2EA1f", color: C.celesteDeep, fontWeight: 800, fontSize: 18 }}>?</button>}
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", color: C.txt3, fontSize: 22 }}>×</button>
        </div>
        <div style={{ padding: "0 22px 22px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: C.txt2, fontWeight: 600, display: "block", marginBottom: 5 }}>🏢 Sucursal</label>
            <div style={{ width: "100%", border: "1px solid " + C.line2, borderRadius: 11, padding: "12px 14px", fontSize: 17, fontWeight: 600, color: C.tinta, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{business.name}</span><span style={{ color: C.txt3 }}>▾</span>
            </div>
          </div>
          {fuente.instructivo && (
            <div style={{ background: "#5BC2EA14", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 11, marginBottom: 18 }}>
              <span style={{ color: C.celeste, fontSize: 19, flexShrink: 0 }}>ⓘ</span>
              <div style={{ fontSize: 14.5, color: C.txt2, lineHeight: 1.5 }}>
                <b style={{ color: C.tinta, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, display: "block", marginBottom: 2 }}>¿Primera vez importando datos?</b>
                Tocá el <span onClick={onHelp} style={{ color: C.celesteDeep, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>?</span> de arriba para ver el paso a paso de cómo exportar este informe desde MaxiRest.
              </div>
            </div>
          )}
          <div onClick={() => inputRef.current && inputRef.current.click()} style={{ border: "2px dashed " + C.celeste, borderRadius: 14, padding: "34px 20px", textAlign: "center", background: "#5BC2EA08", cursor: "pointer" }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", background: C.celeste, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 30 }}>⬆️</div>
            <h3 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 19, color: C.celesteDeep, margin: "0 0 7px" }}>Seleccioná tu archivo</h3>
            <p style={{ fontSize: 14.5, color: C.txt2, margin: "2px 0" }}>Arrastrá y soltá, o hacé clic para elegir</p>
            <p style={{ fontSize: 13, color: C.txt3, marginTop: 8 }}>Formatos: CSV, XLS, XLSX · exportado desde MaxiRest</p>
            <input ref={inputRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 22px", borderTop: "1px solid " + C.line, background: "#fafbfc" }}>
          <button onClick={onClose} style={ghostBtn}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Modal instructivo ──────────────────────────────────────────────
function InstructivoModal({ instructivo, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ background: C.white, borderRadius: 18, width: 600, maxWidth: "94vw", boxShadow: "0 30px 80px rgba(0,0,0,.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "20px 22px 16px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "#5BC2EA1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: C.celesteDeep, fontWeight: 800, fontSize: 20 }}>?</div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: C.tinta, flex: 1, margin: 0 }}>Cómo exportar: {instructivo.titulo}</h2>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", color: C.txt3, fontSize: 22 }}>×</button>
        </div>
        <div style={{ padding: "0 22px 8px", maxHeight: 520, overflowY: "auto" }}>
          {instructivo.pasos.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 13, marginBottom: 20 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.celeste, color: C.noche, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 16.5, color: C.tinta, margin: "0 0 4px" }}>{s.h}</h4>
                {s.path && <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 600, fontSize: 14.5, color: C.celesteDeep, background: "#5BC2EA12", borderRadius: 7, padding: "5px 9px", display: "inline-block", marginBottom: 7 }}>{s.path}</span>}
                {s.p && <p style={{ fontSize: 14.5, color: C.txt2, lineHeight: 1.5, margin: "0 0 6px" }}>{s.p}</p>}
                {s.items && (
                  <ul style={{ margin: "6px 0 0", listStyle: "none", padding: 0 }}>
                    {s.items.map((it, i) => (
                      <li key={i} style={{ fontSize: 14.5, color: C.txt2, lineHeight: 1.7, display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, color: it.t === "ok" ? C.green : "inherit", fontWeight: 800 }}>{it.t === "ok" ? "✓" : "⚠️"}</span>
                        <span>{it.s}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.img && <img src={s.img} alt="Captura MaxiRest" style={{ width: "100%", borderRadius: 10, border: "1px solid " + C.line2, marginTop: 10, display: "block", boxShadow: "0 4px 14px rgba(21,33,62,.10)" }} />}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 22px", borderTop: "1px solid " + C.line, background: "#fafbfc" }}>
          <button onClick={onClose} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15.5, padding: "11px 22px", borderRadius: 11, border: "none", cursor: "pointer", background: C.celeste, color: C.noche }}>Entendido</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Overlay ────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(18,17,31,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// Aviso cuando un archivo subido no tiene las columnas imprescindibles.
function ColErrorModal({ error, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 460, maxWidth: "90vw", background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(18,17,31,.35)" }}>
        <div style={{ padding: "18px 22px", background: "#d94f6312", borderBottom: "1px solid #d94f6330", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: C.tinta }}>Faltan columnas en el archivo</div>
            <div style={{ fontSize: 14, color: C.txt2, marginTop: 1 }}>{error.fuente}</div>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          {error.pista ? (
            <div style={{ background: "#f59e0b12", border: "1px solid #f59e0b40", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 14.5, color: C.tinta, lineHeight: 1.5 }}>
                Parece que bajaste el informe <b style={{ color: C.amber }}>“{error.pista.bajado}”</b>. El que necesitás es <b style={{ color: C.green }}>“{error.pista.correcto}”</b> — son parecidos pero distintos. Volvé a MaxiRest y elegí ese en el desplegable de Informe.
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 15, color: C.txt2, margin: "0 0 14px", lineHeight: 1.5 }}>
              El archivo que subiste no tiene {error.columnas.length === 1 ? "una columna necesaria" : "algunas columnas necesarias"} para conciliar. Sin {error.columnas.length === 1 ? "ella" : "ellas"}, los datos quedarían incompletos, así que no se cargó.
            </p>
          )}
          <div style={{ background: "#d94f6308", border: "1px solid #d94f6322", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: C.red, marginBottom: 7 }}>Columna{error.columnas.length === 1 ? "" : "s"} que falta{error.columnas.length === 1 ? "" : "n"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {error.columnas.map((c) => (
                <span key={c} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, background: "#d94f6318", color: C.red, borderRadius: 7, padding: "3px 10px" }}>{c}</span>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: C.txt3, margin: "0 0 6px" }}>
            Revisá que hayas exportado el informe correcto y con todas las columnas. Si el informe salió filtrado o en otra modalidad, puede que falten campos.
          </p>
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 13, color: C.celesteDeep, cursor: "pointer", fontWeight: 600 }}>Ver columnas que sí trae el archivo</summary>
            <div style={{ fontSize: 12.5, color: C.txt3, marginTop: 8, lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}>
              {error.encontradas.length ? error.encontradas.join(" · ") : "(el archivo no tiene encabezados)"}
            </div>
          </details>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={onClose} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, padding: "10px 22px", border: "none", borderRadius: 10, background: C.celeste, color: C.noche, cursor: "pointer" }}>Entendido</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}


