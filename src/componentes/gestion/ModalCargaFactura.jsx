/* eslint-disable */
// src/componentes/gestion/ModalCargaFactura.jsx
// Modal de carga de factura y gastos varios, igual a lazarillo_gestion/components/facturas/
// modal-carga-factura.jsx (estilos propios del modal incluidos). Cambios: datos de Lazarillo (un
// "PDV" es la principal o una sucursal del negocio) y "Crear y usar" guarda el proveedor de verdad.
import React, { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { refrescarCompras, useFetchQuery, useMediosPago } from "@/gestion/hooksPanel";
import { MEDIO_ADELANTOS, mediosParaElegir, factorEnvase, validarSueldo } from "@/gestion/cargaUtils";
import { fechaDelPeriodo, moverPeriodo, nombrePeriodo, periodoDe } from "@/gestion/periodoGastos";
import { gestionFetch } from "@/servicios/apiGestion";
import { avisoPrecio, textoVeces } from "@/gestion/avisoPrecio";
import { insumoCreate } from "@/servicios/apiInsumos";
import EnvasesEditor, { conCambios } from "@/componentes/gestion/EnvasesEditor";
import FichaProveedor from "@/componentes/gestion/FichaProveedor";

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const TIPOS_CPB = ["FcA", "FcB", "FcC", "Ticket", "NC-A"];
const TIPOS_PERCEPCION = ["Perc. IIBB PBA", "Perc. IIBB CABA", "Perc. IVA RG 3337", "Perc. Ganancias"];
const ALICUOTAS = [21, 10.5, 27, 0];
// reparto efectivo de una linea: [{pdv, frac}] (sin reparto = 100% a su PDV)
const repartoDe = (l, pdvDefault) => {
  const r = (l.reparto || []).filter((x) => x.pdv && parseFloat(x.pct) > 0);
  const tot = r.reduce((a, x) => a + parseFloat(x.pct), 0);
  if (r.length >= 2 && tot > 0) return r.map((x) => ({ pdv: x.pdv, frac: parseFloat(x.pct) / tot }));
  return [{ pdv: l.pdvDest || pdvDefault, frac: 1 }];
};
const txtReparto = (l) => (l.reparto || []).filter((x) => parseFloat(x.pct) > 0).map((x) => `${x.pdv.replace("Ramos Mejía", "RM").replace("San Justo", "SJ")} ${fmtNum(parseFloat(x.pct))}%`).join(" · ");

// ============ HELPERS ============
const $pct = (e, v) => (v ? (e / v * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "—");
const $fmt = (n) => (n ? "$ " + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
// Importe en celda de ANCHO FIJO: entra completo -> tal cual; si no entra -> sin centavos y más chico;
// si ni así entra (valores absurdos) -> en millones / mil millones / billones. Nunca "..." (no se distingue mil de millón).
// El valor exacto va SIEMPRE en el tooltip cuando lo que se ve no es el exacto.
const Imp = ({ v, sufijo = "", strong, max = 16 }) => {
  const n = Number(v) || 0;
  const exacto = $fmt(n);
  const lim = max - sufijo.length;
  let txt = exacto, size;
  if (exacto.length > lim) {
    txt = "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
    size = 11.5;
    if (txt.length > lim) {
      const abs = Math.abs(n);
      const [div, u] = abs >= 1e12 ? [1e12, " bill."] : abs >= 1e9 ? [1e9, " mil mill."] : [1e6, " mill."];
      txt = "$ " + (n / div).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + u;
      size = 10.5;
    }
  }
  const aprox = txt !== exacto;
  return (
    <span title={aprox ? exacto + sufijo : undefined}
      style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", fontSize: size, fontWeight: strong ? 700 : undefined, whiteSpace: "nowrap", cursor: aprox ? "help" : undefined, borderBottom: aprox ? "1px dotted #bbb" : undefined }}>
      {txt}{sufijo}
    </span>
  );
};
// Grilla de registros del modal de carga: nombre flexible (se lee completo), importes en px fijos
// Registros: nombre flexible (mín. 170) + cant · unit · neto · II/u · II total · IVA % · IVA $ · subtotal · acciones.
const GRID_LIN = "minmax(170px, 1fr) 96px 104px 116px 88px 100px 70px 92px 128px 44px";
const ANCHO_MIN_LIN = 1100;
const dmy = (iso) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a.slice(2)}`; };
const C = { ii: "#6d28d9", iiBorde: "#a78bfa", neg: "#111", gris: "#8a8a8a", verde: "#159457", nar: "#e08900", rojo: "#c62828", cel: "#0d6fa8", borde: "#e8e8e6", fondo: "#f6f6f4" };
const card = { background: "#fff", borderRadius: 14, border: `1px solid ${C.borde}` };
const btn = (dark) => ({ padding: "9px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: dark ? "none" : `1px solid ${C.borde}`, background: dark ? "#111" : "#fff", color: dark ? "#fff" : "#333" });
const inp = { padding: "8px 10px", borderRadius: 9, border: "1px solid #ccc", fontSize: 13.5, width: "100%", height: 38, boxSizing: "border-box", background: "#fff" };
// Desplegables con el mismo alto, borde y flecha que los campos (el select nativo de Mac
// ignora el padding y quedaba más bajo y desalineado — FALLA de Diego, 27/10/2026).
const FLECHA = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E\")";
const sel = { ...inp, appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: FLECHA, backgroundRepeat: "no-repeat", backgroundPosition: "right 9px center", paddingRight: 24, cursor: "pointer" };
// Fila de abajo de cada registro (concepto de caja, PDV, imp. internos): todo a 32px.
const chico = { height: 32, fontSize: 12.5, padding: "5px 8px" };
const lab = { fontSize: 11.5, fontWeight: 700, color: C.gris, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 4 };
const labS = { ...lab, fontSize: 10, marginBottom: 3, height: 14, lineHeight: "14px", whiteSpace: "nowrap", overflow: "hidden" };
const soloNum = (v) => v.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
const fechaValida = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};
const MESES12 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const pad2 = (n) => String(n).padStart(2, "0");
const dmy4 = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; };
function FechaInput({ iso, onISO, style: st, title, inputRef, tabIndex }) {
  const [txt, setTxt] = useState(iso ? dmy4(iso) : "");
  useEffect(() => { setTxt(iso ? dmy4(iso) : ""); }, [iso]);
  const commit = () => {
    let s = txt.trim();
    if (/^\d{6,8}$/.test(s)) s = s.slice(0, 2) + "/" + s.slice(2, 4) + "/" + s.slice(4);
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) { setTxt(iso ? dmy4(iso) : ""); return; }
    let d = Number(m[1]), mo = Math.min(Math.max(Number(m[2]), 1), 12), y = Number(m[3]);
    if (y < 100) y += 2000;
    const ult = new Date(y, mo, 0).getDate();
    d = Math.min(Math.max(d, 1), ult);
    setTxt(`${pad2(d)}/${pad2(mo)}/${y}`);
    onISO(`${y}-${pad2(mo)}-${pad2(d)}`);
  };
  return (
    <input ref={inputRef} style={st} value={txt} placeholder="dd/mm/aaaa" title={title} tabIndex={tabIndex}
      onChange={(e) => {
        let v = e.target.value.replace(/[^\d\/\-.]/g, "");
        if (/^\d+$/.test(v)) {
          const d = v.slice(0, 8);
          v = d.length > 4 ? d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4) : d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
        }
        setTxt(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
  );
}
function FechaTriple({ iso, onISO, error, inputRef }) {
  const des = (v) => (v ? [v.slice(8, 10), v.slice(5, 7), v.slice(0, 4)] : ["", "", ""]);
  const [dmyv, setDmyvState] = useState(des(iso));
  // ref con el valor más reciente: el onBlur del campo que se abandona corre antes del re-render
  // (al saltar el foco en el mismo evento) y con el estado viejo leía "1" en vez de "15" -> "01"
  const ultimo = useRef(dmyv);
  const setDmyv = (v) => { ultimo.current = v; setDmyvState(v); };
  useEffect(() => { setDmyv(des(iso)); }, [iso]);
  const mRef = useRef(null); const yRef = useRef(null);
  const st = (w) => ({ ...inp, width: w, textAlign: "center", padding: "8px 4px", border: error ? `1.6px solid ${C.rojo}` : inp.border });
  const emitir = (d, m, y) => {
    if (!d || !m || !y) { onISO(""); return; }
    let yy = Number(y); if (yy < 100) yy += 2000;
    const mm = Math.min(Math.max(Number(m), 1), 12);
    const dd = Math.min(Math.max(Number(d), 1), new Date(yy, mm, 0).getDate());
    setDmyv([pad2(dd), pad2(mm), String(yy)]);
    onISO(`${yy}-${pad2(mm)}-${pad2(dd)}`);
  };
  // FALLA de Diego (tickets guardados en noviembre): con el campo lleno y el cursor
  // adentro (clic en el mes "10" y tipear "10"), el dígito se insertaba y se cortaba a 2
  // → "110" → "11". Ahora: clic selecciona todo y, si el campo ya estaba lleno, lo
  // tipeado reemplaza en vez de insertarse.
  const cambiar = (ix, e, max, sig) => {
    const crudo = e.target.value.replace(/\D/g, "");
    const tipeado = String((e.nativeEvent && e.nativeEvent.data) || "").replace(/\D/g, "");
    const previo = ultimo.current[ix] || "";
    const v = crudo.length > max && previo.length >= max && tipeado ? tipeado.slice(0, max) : crudo.slice(0, max);
    const nv = ultimo.current.map((x, i) => (i === ix ? v : x));
    setDmyv(nv);
    if (v.length === max && sig && sig.current) setTimeout(() => sig.current && sig.current.focus(), 0);
  };
  const blur = (ix) => {
    const nv = [...ultimo.current];
    if (ix < 2 && nv[ix]) nv[ix] = pad2(Number(nv[ix]));
    if (ix === 2 && nv[2] && nv[2].length <= 2) nv[2] = String(Number(nv[2]) + 2000);
    setDmyv(nv);
    emitir(nv[0], nv[1], nv[2]);
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input ref={inputRef} style={st(44)} value={dmyv[0]} placeholder="dd" onChange={(e) => cambiar(0, e, 2, mRef)} onClick={(e) => e.target.select()} onBlur={() => blur(0)} onFocus={(e) => e.target.select()} />
      <span style={{ color: "#bbb" }}>/</span>
      <input ref={mRef} style={st(44)} value={dmyv[1]} placeholder="mm" onChange={(e) => cambiar(1, e, 2, yRef)} onClick={(e) => e.target.select()} onBlur={() => blur(1)} onFocus={(e) => e.target.select()} />
      <span style={{ color: "#bbb" }}>/</span>
      <input ref={yRef} style={st(60)} value={dmyv[2]} placeholder="aaaa" onChange={(e) => cambiar(2, e, 4, null)} onClick={(e) => e.target.select()} onBlur={() => blur(2)} onFocus={(e) => e.target.select()} />
    </span>
  );
}
function BtnEliminar({ onConfirmar, style: st }) {
  const [pedir, setPedir] = useState(false);
  if (!pedir) return <span onClick={() => setPedir(true)} style={{ fontSize: 11.5, color: C.gris, cursor: "pointer", ...st }}>eliminar</span>;
  return (
    <span style={{ fontSize: 11.5, ...st }}>
      <span style={{ color: C.rojo, fontWeight: 700 }}>¿Eliminar?</span>{" "}
      <span onClick={() => { setPedir(false); onConfirmar(); }} style={{ color: C.rojo, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí</span>
      {" · "}
      <span onClick={() => setPedir(false)} style={{ color: C.gris, cursor: "pointer" }}>No</span>
    </span>
  );
}
// Ficha del proveedor desde la carga (Diego 05/11/2026): ver y modificar sus datos. Si vino de
// MaxiRest, lo editado en Lazarillo queda y la importación ya no lo pisa.
// La ficha del proveedor vive en FichaProveedor.jsx (con «Ver cuenta corriente», Diego 06/11/2026).
const corregirFecha = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Math.min(Math.max(Number(m[2]), 1), 12);
  const ult = new Date(y, mo, 0).getDate();
  const d = Math.min(Math.max(Number(m[3]), 1), ult);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const parseImp = (v) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
// ev = e.nativeEvent: si se borró o se tipeó un dígito, los puntos que ya estaban son de miles (borrar un
// 0 de 15.000 dejaba 15,00 — Diego 06/11/2026). Solo un "." recién tipeado (o pegado) se toma como decimal.
const fmtImp = (v, ev) => {
  let s = String(v);
  const puntoNuevo = !ev || !ev.inputType || ev.inputType === "insertFromPaste" || ev.inputType === "insertFromDrop" || ev.data === ".";
  if (!s.includes(",") && puntoNuevo) {
    const ult = s.lastIndexOf(".");
    if (ult >= 0) {
      const dec = s.slice(ult + 1).replace(/[^\d]/g, "");
      if (dec.length < 3) s = s.slice(0, ult).replace(/\./g, "") + "," + dec;
    }
  }
  const limpio = s.replace(/[^\d,]/g, "");
  const partes = limpio.split(",");
  const ent = (partes[0] || "").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return partes.length > 1 ? ent + "," + partes.slice(1).join("").slice(0, 2) : ent;
};
const fmtNum = (n) => (n || n === 0 ? Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "");
// Desplegables: en Mac las flechas abren el menú nativo y ahí el Enter no llega al formulario (no
// tabulaba después de elegir el Tipo — Diego 05/11/2026). En todo el modal, las flechas cambian el
// valor del desplegable sin abrirlo (se dispara el change, así React lo toma) y el Enter tabula.
const flechaSelect = (e) => {
  const s = e.target;
  if (s.tagName !== "SELECT" || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.altKey) return false;
  e.preventDefault();
  const n = Math.min(Math.max(s.selectedIndex + (e.key === "ArrowDown" ? 1 : -1), 0), s.options.length - 1);
  if (n !== s.selectedIndex) {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, s.options[n].value);
    s.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
};
const enterAvanza = (e) => {
  if (flechaSelect(e)) return;
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
  e.preventDefault();
  // Los campos fuera del tabulador (la fecha del gasto vario) tampoco reciben el Enter.
  const campos = Array.from(e.currentTarget.querySelectorAll("input, select")).filter((el) => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
  const i = campos.indexOf(t);
  if (i >= 0 && i + 1 < campos.length) campos[i + 1].focus();
};
// Descuento de una línea de insumo: % (da lo mismo sobre el unitario o el total), $ por unidad o $ sobre el total.
const DESC_TIPOS = [["%", "%"], ["u", "$ /u"], ["t", "$ total"]];
let uidLinea = 0;

// Insumo que vino bonificado (importe 0): se carga igual, con su cantidad.
// Aviso de "un 0 de más" debajo de una línea (Diego 05/11/2026): rojo = casi seguro un error
// de tipeo (ofrece corregir), ámbar = "¿es correcto?". "Está bien así" lo acepta.
const AvisoLinea = ({ a, onCorregir, onAceptar }) => {
  const rojo = a.nivel === "rojo";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 2px", padding: "6px 10px", borderRadius: 8, fontSize: 12,
      background: rojo ? "#fdf3f3" : "#fdf8ef", border: `1px solid ${rojo ? "#f3c4c4" : "#f0d9a8"}`, color: rojo ? C.rojo : "#8a5a00" }}>
      <span>⚠ <b>{textoVeces(a.ratio)} {a.habitual ? "de lo habitual" : "de la última compra"}</b> ({a.habitual ? a.habitual + " " : ""}{$fmt(a.ref)}{a.medBase ? " /" + a.medBase : ""}). {rojo ? (a.ratio >= 1 ? "¿Un 0 de más?" : "¿Falta un 0?") : "¿Es correcto?"}</span>
      <span style={{ flex: 1 }} />
      {rojo && a.sugerido != null && <button type="button" onClick={onCorregir}
        style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "4px 10px", border: "none", background: C.neg, color: "#fff", whiteSpace: "nowrap" }}>Corregir a {$fmt(a.sugerido)}</button>}
      <button type="button" onClick={onAceptar}
        style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, borderRadius: 6, padding: "4px 10px", border: `1px solid ${C.borde}`, background: "#fff", color: "#333", whiteSpace: "nowrap" }}>Está bien así</button>
    </div>
  );
};
// Insumo sin concepto de caja en MaxiRest (Diego 06/11/2026). Rojo mientras no se elija uno para esta
// factura (no deja confirmar); ámbar después, para que se corrija de raíz en MaxiRest.
const AvisoSinConcepto = ({ rubro, lazarillo, elegido }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 2px", padding: "6px 10px", borderRadius: 8, fontSize: 12,
    background: elegido ? "#fdf8ef" : "#fdf3f3", border: `1px solid ${elegido ? "#f0d9a8" : "#f3c4c4"}`, color: elegido ? "#8a5a00" : C.rojo }}>
    <span>⚠ <b>Sin concepto de caja asociado</b>: {lazarillo ? "el insumo todavía no tiene concepto" : rubro ? <>el rubro «{rubro}» no tiene concepto en MaxiRest</> : "el insumo no tiene rubro en MaxiRest"}.{" "}
      {!elegido ? "Elegí el concepto de caja para esta factura." : lazarillo ? "Queda con el concepto elegido." : "Esta factura va con el concepto elegido; corregilo en MaxiRest para las próximas."}</span>
  </div>
);
const Bonif = () => <span title="Insumo bonificado: importe $ 0, se registra la cantidad" style={{ fontSize: 10, fontWeight: 700, color: C.verde, border: `1.2px solid ${C.verde}`, borderRadius: 6, padding: "1px 6px" }}>BONIFICADO</span>;
function Badge({ estado }) {
  const col = estado === "PAGA" ? C.verde : estado === "PARCIAL" ? C.nar : C.rojo;
  return <span style={{ background: col, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>{estado}</span>;
}
function Dot({ estado }) {
  if (estado === "PAGA") return null;
  return <span title={estado} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: estado === "PARCIAL" ? C.nar : C.rojo, marginRight: 7 }} />;
}
function Chev({ abierto }) {
  return <span style={{ display: "inline-block", width: 0, height: 0, marginRight: 8, verticalAlign: "middle",
    borderLeft: abierto ? "5px solid transparent" : "6px solid #888", borderRight: abierto ? "5px solid transparent" : "none",
    borderTop: abierto ? "6px solid #888" : "5px solid transparent", borderBottom: abierto ? "none" : "5px solid transparent" }} />;
}

// extra(o): texto adicional por el que también se busca y que se muestra debajo (razón social · CUIT).
function Combo({ opciones: opcionesCrudas, valor, onElegir, placeholder, onCrear, crearPrimero, ancho, autoFocus, estilo, extra }) {
  const opciones = [...new Set(opcionesCrudas)];
  const [texto, setTexto] = useState(valor || "");
  const [abierto, setAbierto] = useState(false);
  // Opción marcada con las flechas (Diego 27/10: tipear "carn" + ↓ tiene que navegar la lista).
  // null = la de por defecto (con "Crear" primero, la primera coincidencia).
  const [activo, setActivo] = useState(null);
  const listaRef = useRef(null);
  useEffect(() => { setTexto(valor || ""); }, [valor]);
  // El blur resuelve 180 ms después: tiene que leer el valor de ESE momento (si en el medio
  // se precargó otro registro en la misma fila, el viejo lo borraba).
  const valorRef = useRef(valor);
  useEffect(() => { valorRef.current = valor; }, [valor]);
  const inputRef = useRef(null);
  const avanzar = () => setTimeout(() => {
    const el = inputRef.current; if (!el) return;
    const root = el.closest('[data-card="1"]') || document;
    const campos = Array.from(root.querySelectorAll("input, select")).filter((x) => !x.disabled && x.offsetParent !== null);
    const i = campos.indexOf(el);
    if (i >= 0 && i + 1 < campos.length) campos[i + 1].focus();
  }, 0);
  const buscando = texto.trim() !== "" && texto !== (valor || "");
  const q = texto.trim().toLowerCase();
  const qDig = q.replace(/\D/g, "");
  const coincide = (o) => {
    if (o.toLowerCase().includes(q)) return true;
    const x = extra ? String(extra(o) || "") : "";
    if (!x) return false;
    // CUIT con o sin guiones: si se tipean 3 o más dígitos se compara solo por los números.
    return x.toLowerCase().includes(q) || (qDig.length >= 3 && qDig.length === q.replace(/[\s.\-\/]/g, "").length && x.replace(/\D/g, "").includes(qDig));
  };
  const filtradas = (buscando ? opciones.filter(coincide) : opciones).slice(0, 12);
  const hayExacta = opciones.some((o) => o.toLowerCase() === texto.toLowerCase());
  // "Crear …" primero y siempre visible en los maestros (Diego 05/11/2026); si no, al final y solo tipeando.
  const conCrear = !!(onCrear && (crearPrimero || texto.trim()) && !hayExacta);
  const items = [...(conCrear && crearPrimero ? [null] : []), ...filtradas, ...(conCrear && !crearPrimero ? [null] : [])];
  const total = items.length;
  const porDefecto = conCrear && crearPrimero && filtradas.length > 0 && buscando ? 1 : 0;
  const marcado = Math.min(activo == null ? porDefecto : activo, Math.max(0, total - 1));
  const elegir = (idx) => {
    const o = items[idx];
    if (o != null) { setTexto(o); setAbierto(false); onElegir(o); avanzar(); }
    else if (conCrear) { setAbierto(false); onCrear(buscando ? texto.trim() : ""); }
  };
  useEffect(() => {
    const el = listaRef.current && listaRef.current.children[marcado];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [marcado, abierto]);
  return (
    <div style={{ position: "relative", width: ancho || "100%" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.6" strokeLinecap="round"
        style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input ref={inputRef} style={{ ...inp, ...estilo, paddingLeft: 27 }} value={texto} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(null); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); if (!abierto) { setAbierto(true); setActivo(null); } else setActivo(Math.min(marcado + 1, total - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActivo(Math.max(marcado - 1, 0)); }
          else if (e.key === "Escape" && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false); }
          else if (e.key === "Enter" && abierto && total > 0) { e.preventDefault(); e.stopPropagation(); elegir(marcado); }
          // Tab con la lista abierta elige la opción marcada y deja que el Tab siga al próximo campo (Diego 27/10).
          else if (e.key === "Tab" && abierto && items[marcado] != null) { const o = items[marcado]; setTexto(o); setAbierto(false); if (o !== valor) onElegir(o); }
        }}
        // No se despliega solo al entrar (Diego 27/10): se abre al tipear, con ↓ o con un click.
        onMouseDown={() => setAbierto(true)}
        onBlur={() => setTimeout(() => {
          setAbierto(false);
          const actual = valorRef.current;
          if (actual !== valor) return; // cambió el valor mientras tanto: manda el nuevo
          const exacta = opciones.find((o) => o.toLowerCase() === texto.trim().toLowerCase());
          if (exacta && exacta !== actual) { setTexto(exacta); onElegir(exacta); }
          else if (!exacta) setTexto(actual || ""); // solo se aceptan ítems de la lista
        }, 180)} />
      {abierto && total > 0 && (
        <div ref={listaRef} style={{ position: "absolute", top: "105%", left: 0, right: 0, background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.10)", zIndex: 80, maxHeight: 230, overflow: "auto" }}>
          {items.map((o, ix) => o != null ? (
            <div key={o} onMouseDown={(e) => { e.preventDefault(); elegir(ix); }} onMouseEnter={() => setActivo(ix)}
              style={{ padding: "8px 12px", fontSize: 13.5, cursor: "pointer", borderBottom: "1px solid #f4f4f2", background: ix === marcado ? "#eef7fc" : "#fff" }}>{o}
              {extra && extra(o) ? <span style={{ display: "block", fontSize: 11.5, color: C.gris }}>{extra(o)}</span> : null}</div>
          ) : (
            <div key="__crear" onMouseDown={(e) => { e.preventDefault(); elegir(ix); }} onMouseEnter={() => setActivo(ix)}
              style={{ padding: "8px 12px", fontSize: 13.5, cursor: "pointer", color: C.cel, fontWeight: 600, borderBottom: "1px solid #f4f4f2", background: ix === marcado ? "#eef7fc" : "#fff" }}>
              + {crearPrimero ? `Crear ${crearPrimero}` : "Crear"}{buscando ? ` «${texto.trim()}»` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Arma el "editarDe" del prototipo (la factura en el formato del modal) desde lo
// que devuelve GET /api/facturas/[rowId] (FacturaInput con códigos e ids).
export function edeDesdeFactura(rowId, f, { maestros, pdvsRef }) {
  const nomPdv = (id) => (pdvsRef.find((p) => p.id === id) || {}).nombre || "";
  const nomCon = (cod) => (maestros.conceptos.find((c) => String(c.codigo).trim() === String(cod).trim()) || {}).nombre || "";
  const nomIns = (cod) => (maestros.insumos.find((i) => String(i.codigo) === String(cod)) || {}).nombre || "";
  const p = maestros.proveedores.find((x) => x.id === f.proveedorId) || {};
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    id: rowId,
    prov: p.nombre || p.razon || p.codigo || "",
    tipoCpb: f.tipo,
    comp: `${f.tipo} ${String(f.prefijo).padStart(4, "0")}-${String(f.numero).padStart(8, "0")}`,
    fecha: f.fecha,
    periodo: f.periodo || null,
    obs: f.observacion || "",
    pdv: nomPdv((f.registros[0] || {}).puntoDeVentaId),
    impInt: f.impIntGeneral || 0,
    percepciones: (f.percepciones || []).map((x) => ({ tipo: x.tipo, importe: fmtNum(x.importe) })),
    lineas: f.registros.map((r) => {
      const comun = {
        alic: r.alicuota, pdvDest: nomPdv(r.puntoDeVentaId), impint: r.impInt ? fmtNum(r.impInt) : "",
        reparto: r.reparto && r.reparto.length >= 2 ? r.reparto.map((x) => ({ pdv: nomPdv(x.puntoDeVentaId), pct: x.pct })) : undefined,
      };
      if (r.tipo === "insumo") {
        const cant = r.cantidad || 0;
        return { ...comun, tipo: "insumo", item: nomIns(r.insumoCodigo) || r.nombre, codIns: r.insumoCodigo, medida: r.medida,
          cant: cant ? String(cant) : "", unit: cant ? fmtNum(r2(r.neto / cant)) : "", ntot: fmtNum(r.neto), neto: "", conc: nomCon(r.conceptoCodigo) };
      }
      return { ...comun, tipo: "concepto", item: nomCon(r.conceptoCodigo) || r.nombre, neto: fmtNum(r.neto), cant: "", unit: "", conc: "" };
    }),
  };
}

// Período: el mismo control, en el mismo lugar (arriba a la derecha, en la barra del título) en Factura,
// Gastos Varios y Empleados (Diego 06/11/2026). ‹ › mueven de a un mes; el desplegable muestra 2 adelante y 12 atrás.
function SelectorPeriodo({ valor, onCambio, soloVer = false, nota = null, titulo }) {
  const hoyP = periodoDe(hoyISO());
  const base = Array.from({ length: 15 }, (_, i) => moverPeriodo(hoyP, 2 - i));
  const opciones = base.includes(valor) ? base : [valor, ...base];
  const alto = 34;
  const flecha = { height: alto, width: 32, border: `1px solid ${C.borde}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 15, color: "#555", padding: 0, boxSizing: "border-box" };
  return (
    <div title={titulo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.gris, letterSpacing: ".04em", textTransform: "uppercase" }}>Período</span>
      {!soloVer && <button type="button" tabIndex={-1} title="Mes anterior" onClick={() => onCambio(moverPeriodo(valor, -1))} style={flecha}>‹</button>}
      <select disabled={soloVer} tabIndex={-1} value={valor} onChange={(e) => onCambio(e.target.value)}
        style={{ height: alto, width: 158, boxSizing: "border-box", border: `1px solid ${nota ? "#f0c179" : "#ccc"}`, borderRadius: 8, padding: "0 8px", fontSize: 13.5, fontWeight: 700, background: nota ? "#fdf8ef" : "#fff", color: C.neg }}>
        {opciones.map((x) => <option key={x} value={x}>{nombrePeriodo(x)}</option>)}
      </select>
      {!soloVer && <button type="button" tabIndex={-1} title="Mes siguiente" onClick={() => onCambio(moverPeriodo(valor, 1))} style={flecha}>›</button>}
      {nota && <span style={{ fontSize: 11, color: "#8a5a00", fontWeight: 600, whiteSpace: "nowrap" }}>{nota}</span>}
    </div>
  );
}

// Gastos varios: historial del concepto elegido a la derecha (Diego 05/11/2026), como la cuenta del
// empleado: por período, con lo habitual (mediana de las últimas 6) y un atajo para usar el último.
function HistorialConcepto({ concepto, codigo, pdvId, pdvNombre, periodo, onUsar, onPeriodo }) {
  const [filas, setFilas] = useState(null);
  useEffect(() => {
    setFilas(null);
    if (!codigo || pdvId == null) return undefined;
    let vivo = true;
    gestionFetch(`/api/gastos-varios/historial?conceptoCodigo=${encodeURIComponent(codigo)}&pdvId=${pdvId}`)
      .then((r) => r.json()).then((d) => { if (vivo) setFilas((d && d.filas) || []); }).catch(() => vivo && setFilas([]));
    return () => { vivo = false; };
  }, [codigo, pdvId]);
  // Al cambiar el período se lleva a la vista; y al revés, tocar un período lo elige arriba (Diego 06/11/2026).
  const lista = useRef(null);
  useEffect(() => {
    const el = lista.current && lista.current.querySelector(`[data-periodo="${periodo}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [periodo, filas]);
  const caja = { background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 12, padding: "12px 14px", fontSize: 12.5 };
  if (!codigo) return <div style={{ ...caja, color: C.gris }}><div style={{ fontWeight: 700, fontSize: 13.5, color: C.neg, marginBottom: 4 }}>Últimas cargas</div>Elegí un concepto para ver lo último que se cargó.</div>;
  const ult6 = (filas || []).slice(0, 6).map((f) => f.importe).sort((a, b) => a - b);
  const mediana = ult6.length ? (ult6.length % 2 ? ult6[(ult6.length - 1) / 2] : (ult6[ult6.length / 2 - 1] + ult6[ult6.length / 2]) / 2) : null;
  const porPeriodo = [];
  (filas || []).forEach((f) => { const g = porPeriodo.find((x) => x.p === f.periodo); if (g) g.filas.push(f); else porPeriodo.push({ p: f.periodo, filas: [f] }); });
  const tieneActual = porPeriodo.some((g) => g.p === periodo);
  return (
    <div style={caja}>
      <div style={{ fontWeight: 700, fontSize: 13.5 }}>Últimas cargas · {concepto}</div>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.gris, margin: "2px 0 6px" }}><span>{pdvNombre} · últimos 12 meses</span>{filas && <span>{filas.length} carga{filas.length === 1 ? "" : "s"}</span>}</div>
      {!filas ? <div style={{ color: C.gris }}>Cargando…</div> : (<>
        {!tieneActual && <div style={{ background: "#f3fafd", border: "1px solid #bfe0f0", borderRadius: 8, padding: "4px 8px", fontWeight: 700 }}>{nombrePeriodo(periodo)} <span style={{ fontWeight: 400, color: "#2a88ad" }}>· este período, sin cargar</span></div>}
        {!filas.length && <div style={{ color: C.gris, marginTop: 6 }}>Sin cargas de este concepto en el último año.</div>}
        <div ref={lista} style={{ maxHeight: 330, overflow: "auto" }}>
          {porPeriodo.map((g) => (
            <div key={g.p} data-periodo={g.p} role="button" title={`Cargar en ${nombrePeriodo(g.p)}`} onClick={() => onPeriodo && onPeriodo(g.p)}
              style={{ marginTop: 6, borderRadius: 8, padding: "4px 7px", cursor: "pointer", border: "1px solid transparent", ...(g.p === periodo ? { background: "#fdf8ef", border: "1px solid #f0d9a8" } : {}) }}>
              <b style={{ display: "block" }}>{nombrePeriodo(g.p)}{g.p === periodo ? <span style={{ fontWeight: 400, color: "#8a5a00" }}> · ya tiene carga</span> : null}</b>
              {g.filas.map((f, k) => (
                // Columnas fijas: texto | origen (L = Lazarillo, MX = MaxiRest) | importe — siempre alineados.
                <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 24px 104px", gap: 6, alignItems: "center", borderBottom: "1px dashed #eee", padding: "2px 0" }}>
                  <span title={[f.detalle, f.proveedor, f.medio].filter(Boolean).join(" · ")} style={{ color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}` : ""}{f.detalle ? ` · ${f.detalle}` : ""}{f.medio ? ` · ${f.medio}` : ""}</span>
                  <span title={f.lazarillo ? "Cargado en Lazarillo" : "Viene de MaxiRest"} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 700, borderRadius: 4, lineHeight: "15px", background: f.lazarillo ? "#e7f3fa" : "#f1f1ef", color: f.lazarillo ? "#2a88ad" : "#888" }}>{f.lazarillo ? "L" : "MX"}</span>
                  <b style={{ whiteSpace: "nowrap", textAlign: "right" }}>{$fmt(f.importe)}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
        {mediana != null && (<>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee" }}><span>Habitual (mediana últimas {ult6.length})</span><b>{$fmt(mediana)}</b></div>
          <div style={{ textAlign: "right", marginTop: 3 }}><span role="button" onClick={() => onUsar(filas[0])} title="Trae importe, detalle y medio de pago de la última carga" style={{ color: C.cel, fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>usar el último ({$fmt(filas[0].importe)}{filas[0].detalle ? ` · ${filas[0].detalle}` : ""}) ›</span></div>
        </>)}
      </>)}
    </div>
  );
}

// vista: "nueva" (alta) | "ver" (solo lectura, con Editar / Eliminar) | "editar".
// embebido: sin overlay propio (va adentro de un Dialog, p.ej. desde Detalle de compras).
/** @param {any} props */
function ModalNuevaCarga(props) {
  const { ctx = {}, maestros, pdvsRef, pdvActual, reglaDe, onCerrar, onGuardado,
    vista = "nueva", editRowId = null, editable = false, aviso = null, onEditar, onEliminado, onRepetir, embebido = false,
    reglaEmpleadoDe = () => null } = props;
  const soloVer = vista === "ver";
  // ── Adaptación a datos reales (lo único que cambia respecto del prototipo v136) ──
  const HOY = hoyISO();
  const PDVS = [...new Set(pdvsRef.map((p) => p.nombre))];
  const variosPdv = PDVS.length > 1; // con un solo PDV no hay nada que elegir ni repartir
  const idPdv = (nombre) => (pdvsRef.find((p) => p.nombre === nombre) || {}).id;
  // Altas desde la carga («Crear …» primero en todos los buscadores de maestros, Diego 05/11/2026).
  const [insNuevos, setInsNuevos] = useState([]);
  const [concNuevos, setConcNuevos] = useState([]);
  const [altaItem, setAltaItem] = useState(null); // { i, tipo: "insumo"|"concepto", destino: "item"|"conc", nombre, medida, conc, codRubro }
  const [rubrosCon, setRubrosCon] = useState(null);
  const [creandoItem, setCreandoItem] = useState(false);
  // Envases editados en esta carga (se guardan al momento; acá para verlos sin esperar los maestros).
  const [envCambios, setEnvCambios] = useState({}); // codigo → [{tipo, envase, factor}]
  const [envPanel, setEnvPanel] = useState(null); // { i, modo: "nuevo" | "editar" }
  const qcMaestros = useQueryClient();
  const MAESTRO_CONCEPTOS = [...maestros.conceptos, ...concNuevos].map((c) => ({ rubro: c.rubro, concepto: c.nombre, codigo: c.codigo }));
  const codConcepto = (nombre) => (MAESTRO_CONCEPTOS.find((c) => c.concepto === nombre) || {}).codigo;
  const nomConcepto = (cod) => (MAESTRO_CONCEPTOS.find((c) => c.codigo === cod) || {}).concepto || "";
  // IVA e II guardados en la última carga de Lazarillo mandan sobre los de MaxiRest (Diego 06/11/2026).
  const recDe = (t, k) => (maestros.recordados || []).find((r) => r.t === t && String(r.k) === String(k));
  const MAESTRO_INSUMOS = [...maestros.insumos, ...insNuevos].map((i) => { const r = recDe("insumo", i.codigo); return { codigo: i.codigo, nombre: i.nombre, medida: i.medida, concepto: nomConcepto(i.codCga), rubro: i.rubro || null, unit: i.unit,
    alic: r && r.alic != null ? r.alic : i.alic, ii: r && r.ii != null ? r.ii || null : i.ii || null, envases: conCambios(i.envases || [], envCambios[String(i.codigo)] || []) }; });
  const medidasUsadas = Object.entries(MAESTRO_INSUMOS.reduce((a, x) => { const m = String(x.medida || "").trim(); if (m) a[m] = (a[m] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([m]) => m);
  const abrirAltaItem = (i, tipo, destino, nombre) => {
    setAltaItem({ i, tipo, destino, nombre: nombre || "", medida: "", conc: "", codRubro: "" });
    if (tipo === "concepto" && !rubrosCon)
      gestionFetch("/api/conceptos").then((r) => r.json()).then((d) => setRubrosCon((d && d.rubros) || [])).catch(() => setRubrosCon([]));
  };
  const crearItem = async () => {
    const a = altaItem;
    if (!a || !a.nombre.trim()) { toast.error("Poné el nombre."); return; }
    setCreandoItem(true);
    try {
      if (a.tipo === "insumo") {
        if (!a.medida) throw new Error("Elegí la unidad de medida.");
        if (!codConcepto(a.conc)) throw new Error("Elegí el concepto de caja: un insumo no puede quedar sin concepto.");
        // Mismo maestro que Recetas (código L1, L2…): no se duplica el insumo.
        const r = await insumoCreate({ nombre: a.nombre.trim(), unidadMed: a.medida });
        const cod = r.sku || (r.data && r.data.codigo_maxi);
        const nuevo = { codigo: cod, nombre: (r.data && r.data.nombre) || a.nombre.trim(), medida: a.medida, codCga: codConcepto(a.conc) || null, unit: null, alic: null, envases: [] };
        setInsNuevos((x) => [...x, nuevo]);
        setLineas((ls) => ls.map((x, ix) => ix !== a.i ? x : { ...x, item: nuevo.nombre, codIns: cod, medida: undefined, conc: a.conc || x.conc, unit: "", ntot: "", desc: "" }));
      } else {
        if (!a.codRubro) throw new Error("Elegí el rubro.");
        const r = await gestionFetch("/api/conceptos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: a.nombre.trim(), tipo: "-", codRubro: String(a.codRubro) }) });
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error((d && d.error) || "No se pudo crear el concepto.");
        const rub = (rubrosCon || []).find((x) => String(x.codigo) === String(a.codRubro));
        const nuevo = { codigo: String(d.codigo), nombre: a.nombre.trim(), rubro: rub ? String(rub.nombre).trim() : "" };
        setConcNuevos((x) => [...x, nuevo]);
        setLineas((ls) => ls.map((x, ix) => ix !== a.i ? x : a.destino === "conc" ? { ...x, conc: nuevo.nombre } : { ...x, item: nuevo.nombre }));
      }
      toast.success(a.tipo === "insumo" ? "Insumo creado" : "Concepto creado");
      setAltaItem(null);
    } catch (e) { toast.error((e && e.message) || "No se pudo crear."); }
    setCreandoItem(false);
  };
  const conceptoDeInsumo = (nombre) => (MAESTRO_INSUMOS.find((i) => i.nombre === nombre) || {}).concepto || "";
  // Insumo del maestro sin concepto de caja (Diego 06/11/2026: "no nos tiene que dejar cargar un insumo sin
  // concepto asociado, salta alerta"): en MaxiRest el concepto sale del rubro del insumo.
  const sinConceptoDe = (l) => {
    if (l.tipo !== "insumo" || !l.item) return null;
    const m = MAESTRO_INSUMOS.find((x) => x.nombre === l.item);
    return m && !m.concepto ? { rubro: m.rubro, lazarillo: /^L\d+$/.test(String(m.codigo)), elegido: !!codConcepto(l.conc) } : null;
  };
  const medidaDe = (nombre) => (MAESTRO_INSUMOS.find((i) => i.nombre === nombre) || {}).medida || "";
  // Medida de la línea: la de la factura (X8, Pack… si en MaxiRest se cargó en envases; ahí el
  // precio es por envase) y, si es un envase, cuántas unidades del insumo trae (Diego 28/10/2026).
  const medidaLinea = (l) => {
    const ins = MAESTRO_INSUMOS.find((i) => i.nombre === l.item);
    const med = l.medida || (ins && ins.medida) || "";
    const f = ins ? factorEnvase({ medida: ins.medida || "", envases: ins.envases }, med) : null;
    return { med, base: (ins && ins.medida) || "", factor: f && f > 1 ? f : null };
  };
  const [provsNuevos, setProvsNuevos] = useState([]);
  const [provsEditados, setProvsEditados] = useState({}); // id → {nombre, razon} tras editar la ficha
  const proveedores = [...maestros.proveedores, ...provsNuevos.filter((n) => !maestros.proveedores.some((m) => m.id === n.id))].map((p) => ({ ...p, ...(provsEditados[p.id] || {}) })).map((p) => ({ ...p, nombre: p.nombre || p.razon || p.codigo }));
  const [fichaProvId, setFichaProvId] = useState(null);
  const provPorNombre = Object.fromEntries(proveedores.map((p) => [p.nombre, p]));
  const [creandoProv, setCreandoProv] = useState(false);
  const crearProveedor = () => {
    if (!String(altaProv.nombre || "").trim()) { setErrores(["Poné el nombre del proveedor."]); return; }
    setCreandoProv(true);
    gestionFetch("/api/facturas/proveedores", { method: "POST", body: JSON.stringify({ nombre: altaProv.nombre, razon: altaProv.razon, cuit: altaProv.cuit, telefono: altaProv.tel, direccion: altaProv.dir }) })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        setCreandoProv(false);
        if (!ok) { setErrores([(d && d.error) || "No se pudo crear el proveedor."]); return; }
        setProvsNuevos((x) => [...x, d]);
        setProv(d.nombre);
        setAltaProv(null);
        setErrores([]);
        setTimeout(() => tipoRef.current && tipoRef.current.focus(), 40);
        if (props.onProveedorCreado) props.onProveedorCreado(d);
      })
      .catch(() => { setCreandoProv(false); setErrores(["Error de red: no se creó el proveedor."]); });
  };
  // Regla de apertura por concepto (la que el Panel ya usa) como reparto precargado con la marca REGLA.
  // La regla tiene que estar vigente en la FECHA DE LA FACTURA (no hoy): si no, el modal
  // marcaba REGLA y el motor después no la aplicaba (revisión 27/10/2026).
  const reglaV = (con) => (con ? reglaDe(codConcepto(con), PDVS, fechaV) : null);
  const reglaDeItem = (l, item) => reglaDe(codConcepto(l.tipo === "insumo" ? conceptoDeInsumo(item) || l.conc : item), PDVS, fecha);
  const [guardando, setGuardando] = useState(false);
  const [futuraOk, setFuturaOk] = useState(""); // fecha futura ya confirmada con un segundo Guardar
  const [borrando, setBorrando] = useState(false);
  const [pagosAlBorrar, setPagosAlBorrar] = useState(null); // la factura está paga: confirmar
  const eliminar = (conPagos) => {
    setBorrando(true);
    gestionFetch(`/api/facturas/${editRowId}${conPagos ? "?conPagos=1" : ""}`, { method: "DELETE" })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        setBorrando(false);
        if (!ok && d && d.tienePagos) { setPagosAlBorrar(d.tienePagos); return; }
        if (!ok) { setErrores([(d && d.error) || "No se pudo eliminar."]); return; }
        if (onEliminado) onEliminado(d);
      })
      .catch(() => { setBorrando(false); setErrores(["Error de red: no se eliminó."]); });
  };
  const agregarRef = useRef(null);
  const [errFecha, setErrFecha] = useState(false);
  const [errores, setErrores] = useState([]);
  const [editPago, setEditPago] = useState(false);
  const [ep, setEp] = useState(null);
  // Factura o Gastos Varios (solo al cargar uno nuevo; ver / editar es siempre factura).
  const [modo, setModo] = useState(vista === "nueva" && (ctx.modo === "vario" || ctx.modo === "empleado") ? ctx.modo : "factura");
  const fechaDefault = HOY;

  // factura
  const rde = ctx.repetirDe || null;
  const ede = ctx.editarDe || null; // editar una factura existente desde la cta cte
  const partesComp = (comp) => { const m = String(comp || "").match(/^(\S+)\s+(\d+)-(\d+)$/); return m ? [m[1], m[2], m[3]] : [String(comp || "").split(" ")[0], "", ""]; };
  const lineasDe = (f) => (f.lineas && f.lineas.length
    ? f.lineas.map((l) => ({ ...l, editando: false, foco: false, precargada: false }))
    : [{ tipo: "concepto", item: f.concepto, neto: fmtNum(Math.round(f.importe / 1.21 * 100) / 100), cant: "", unit: "", alic: 21, conc: "", pdvDest: f.pdv, editando: false, foco: false }]);
  const tipoRef = useRef(null);
  const fechaRef = useRef(null);
  useEffect(() => { if (rde && tipoRef.current) tipoRef.current.focus(); }, []);
  const [origenPre, setOrigenPre] = useState(rde ? rde.comp : null);
  const [prov, setProv] = useState(ctx.prov || (ctx.proveedorId && (proveedores.find((p) => p.id === ctx.proveedorId) || {}).nombre) || (rde && rde.prov) || (ede && ede.prov) || "");
  const [altaProv, setAltaProv] = useState(null); // {nombre, razon, cuit, tel, dir}
  // ctx.tipoCpb / prefijo / numero / fecha: precarga desde "Sin carga ARCA" (Diego 28/10/2026).
  const [tipoCpb, setTipoCpb] = useState((rde && (rde.tipoCpb || (rde.comp || "").split(" ")[0])) || (ede && (ede.tipoCpb || partesComp(ede.comp)[0])) || ctx.tipoCpb || "");
  const [compPref, setCompPref] = useState(ede ? partesComp(ede.comp)[1] : ctx.prefijo || "");
  const [compNum, setCompNum] = useState(ede ? partesComp(ede.comp)[2] : ctx.numero || "");
  const pad = (v, n) => (v.trim() === "" ? "" : v.replace(/\D/g, "").slice(-n).padStart(n, "0"));
  const [fecha, setFecha] = useState(ede ? ede.fecha : ctx.fecha || fechaDefault);
  // Período de la factura (Diego 06/11/2026): sigue el mes de la fecha hasta que se lo cambia a mano.
  const [periodoF, setPeriodoF] = useState(ede && ede.periodo ? ede.periodo : null);
  const perF = periodoF || (fechaValida(fecha) ? periodoDe(fecha) : periodoDe(HOY));
  // Empleados: el período vive acá para mostrarse en el mismo lugar que en Factura y Gastos Varios.
  const [periodoE, setPeriodoE] = useState(periodoHoy(-1));
  const [pdv, setPdv] = useState(ede ? ede.pdv : pdvActual || PDVS[0]);
  const [obs, setObs] = useState(ede ? ede.obs || "" : "");
  // Total del comprobante, antes del desglose: al terminar, el desglose tiene que coincidir (Diego 05/11/2026).
  const [totalCtrl, setTotalCtrl] = useState("");
  // Descuento general de la factura: se reparte proporcional al neto de cada línea.
  const [descG, setDescG] = useState("");
  const [descGTipo, setDescGTipo] = useState("%");
  const [reinicio, setReinicio] = useState(0); // "Vaciar todo": vuelve a montar la cabecera (foco en el proveedor)
  const [confVaciar, setConfVaciar] = useState(false);
  const [iiPieTxt, setIiPieTxt] = useState(null); // edición del II de la factura en la fila de totales
  // Precarga (Repetir / última factura): el primer registro queda abierto para corregir el
  // neto; al confirmarlo se abre el siguiente (Diego 27/10). Los demás quedan con ⚠.
  const abrirPrecarga = (ls) => ls.map((l, ix) => ({ ...l, editando: ix === 0, foco: ix === 0 ? "neto" : false, precargada: ix !== 0, desdePre: true }));
  const [lineas, setLineas] = useState(ede ? lineasDe(ede) : rde ? abrirPrecarga(rde.lineas) : ctx.concepto ? [{ tipo: "concepto", item: ctx.concepto, neto: "", cant: "", unit: "", alic: 21, conc: "", pdvDest: pdvActual || PDVS[0], editando: true, foco: false }] : []);
  // Aviso de "un 0 de más" (Diego 05/11/2026). Se calla si la línea se aceptó con ese mismo
  // valor ("Está bien así").
  //  - Insumo: el unitario contra el último precio del maestro (por unidad base).
  //  - Concepto: el neto contra lo habitual de ese proveedor × concepto (mediana de las últimas 6
  //    cargas del año, que vienen con IVA: se compara sin IVA).
  const habitualDe = (provId, codCon) => {
    const h = (maestros.historialConceptos || []).filter((x) => x.k === codCon);
    const exacto = h.find((x) => (x.p ?? null) === (provId ?? null));
    return exacto || null;
  };
  const avisoDe = (l) => {
    if (l.tipo === "concepto") {
      if (!l.item) return null;
      const pr = proveedores.find((x) => x.nombre === prov);
      const h = habitualDe(pr ? pr.id : null, codConcepto(l.item));
      if (!h) return null;
      const refNeto = h.mediana / (1 + (l.alic || 0) / 100);
      const a = avisoPrecio(parseImp(l.neto), refNeto, null);
      if (!a || (l.precioOk && l.precioOk === l.neto)) return null;
      return { ...a, ref: refNeto, medBase: "", habitual: `últimas ${h.n}, sin IVA:` };
    }
    if (l.tipo !== "insumo" || !l.item) return null;
    const mi = MAESTRO_INSUMOS.find((x) => x.nombre === l.item);
    if (!mi || !(mi.unit > 0)) return null;
    const { factor, base } = medidaLinea(l);
    // Con descuento se compara el unitario que queda después del descuento.
    const u = parseImp(l.unit);
    const cant = parseFloat(l.cant) || 0;
    const uEf = (parseImp(l.desc) > 0 || fracG > 0) && cant > 0 ? netoDe(l) / cant : u;
    const a = avisoPrecio(uEf, mi.unit, factor);
    if (!a || (l.precioOk && l.precioOk === claveOk(l))) return null;
    // La sugerencia es para el unitario de la factura (antes del descuento): mismo corrimiento de ceros.
    const sugerido = a.sugerido != null && uEf > 0 ? Math.round(u * (a.sugerido / uEf) * 100) / 100 : a.sugerido;
    return { ...a, sugerido, ref: mi.unit, medBase: base };
  };
  const claveOk = (l) => (l.tipo === "concepto" ? l.neto : `${l.unit}|${l.desc || ""}|${l.descTipo || ""}`);
  const corregirPrecio = (i, sug) => setLineas((ls) => ls.map((x, ix) => {
    if (ix !== i) return x;
    if (x.tipo === "concepto") return { ...x, neto: fmtNum(sug), tocado: true };
    const c = parseFloat(x.cant) || 0;
    return { ...x, unit: fmtNum(sug), ntot: c > 0 ? fmtNum(Math.round(c * sug * 100) / 100) : "", tocado: true };
  }));
  const aceptarPrecio = (i) => setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, precioOk: claveOk(x) } : x));
  // Un solo registro abierto a la vez (Diego 05/11/2026): abrir otro (✎ o ⚠) confirma el que estaba
  // abierto si está completo; uno vacío se descarta; uno a medio cargar no deja abrir otro.
  const abrirLinea = (i) => {
    const k = lineas.findIndex((x, ix) => ix !== i && x.editando && (x.item || netoDe(x) > 0) && faltaDe(x));
    if (k >= 0) { toast.warning(`${lineas[k].item || "Registro abierto"}: ${faltaDe(lineas[k]).toLowerCase()} antes de abrir otro.`); return; }
    setLineas((ls) => ls.flatMap((x, ix) => {
      if (ix === i) return [{ ...x, editando: true, precargada: false, foco: "neto" }];
      if (!x.editando) return [x];
      if (!x.item && !(netoDe(x) > 0)) return [];
      return [{ ...x, editando: false }];
    }));
  };
  // Ordenar los registros arrastrándolos (Diego 05/11/2026).
  const [arrastre, setArrastre] = useState(null); // {de, a}
  const moverLinea = (de, a) => {
    if (de == null || a == null || de === a) return;
    setLineas((ls) => { const n = [...ls]; const [x] = n.splice(de, 1); n.splice(a, 0, x); return n; });
  };
  // Línea nueva según lo que carga habitualmente el proveedor (Diego 05/11/2026): nuevo o con
  // insumos alguna vez → Insumo; solo conceptos → Concepto.
  const tipoDefault = (nombreProv) => {
    const pr = proveedores.find((x) => x.nombre === nombreProv);
    return pr && pr.tipoHabitual === "concepto" ? "concepto" : "insumo";
  };
  const [avisosAlGuardar, setAvisosAlGuardar] = useState(null);
  // Cada registro con su id estable (para poder reordenarlos sin que se mezclen los campos).
  useEffect(() => {
    if (lineas.some((l) => !l.uid)) setLineas((ls) => ls.map((l) => (l.uid ? l : { ...l, uid: ++uidLinea })));
  }, [lineas]);
  const brutoDe = (l) => (l.ntot !== undefined && l.ntot !== "" ? parseImp(l.ntot) : (parseFloat(l.cant) || 0) * parseImp(l.unit));
  const descDe = (l) => {
    const d = parseImp(l.desc);
    if (l.tipo !== "insumo" || !(d > 0)) return 0;
    const b = brutoDe(l);
    const v = l.descTipo === "u" ? d * (parseFloat(l.cant) || 0) : l.descTipo === "t" ? d : b * Math.min(d, 100) / 100;
    return Math.min(Math.round(v * 100) / 100, b);
  };
  // Descuento mayor que el importe: casi seguro un error de tipeo; igual al importe = bonificado ($ 0).
  const descExcede = (l) => {
    const d = parseImp(l.desc);
    if (l.tipo !== "insumo" || !(d > 0)) return false;
    const v = l.descTipo === "u" ? d * (parseFloat(l.cant) || 0) : l.descTipo === "t" ? d : d > 100 ? Infinity : 0;
    return v > brutoDe(l) + 0.005;
  };
  const netoBase = (l) => l.tipo === "insumo" ? brutoDe(l) - descDe(l) : parseImp(l.neto);
  const netoSinG = lineas.reduce((a, l) => a + netoBase(l), 0);
  const dG = parseImp(descG);
  const fracG = !(dG > 0) || !(netoSinG > 0) ? 0 : descGTipo === "%" ? Math.min(dG, 100) / 100 : Math.min(dG / netoSinG, 1);
  const netoDe = (l) => netoBase(l) * (1 - fracG);
  const [percepciones, setPercepciones] = useState(((rde || ede) ? ((rde || ede).percepciones || []) : []).map((p) => ({ ...p })));
  const [impIntG, setImpIntG] = useState(() => { const b = ede || rde; return b && b.impInt > 0 && !(b.lineas || []).some((l) => parseImp(l.impint) > 0) ? fmtNum(b.impInt) : ""; });
  const [leida, setLeida] = useState(false);
  const [existente, setExistente] = useState(!!ede);
  const [editId, setEditId] = useState(ede ? ede.id : null);

  // gasto vario: primero el PERÍODO (mes); la fecha va al 15 y el tabulador la saltea (Diego, 27/10/2026).
  const [detalle, setDetalle] = useState("");
  // Desde "Sin carga" llega el período, el concepto y el importe del último mes.
  const [periodoV, setPeriodoV] = useState(ctx.periodo || periodoDe(HOY));
  const [fechaV, setFechaV] = useState(fechaDelPeriodo(ctx.periodo || periodoDe(HOY)));
  const elegirPeriodo = (p) => { setPeriodoV(p); setFechaV(fechaDelPeriodo(p)); setErrFecha(false); };
  const [pdvV, setPdvV] = useState(pdvActual || PDVS[0]);
  // Apertura del gasto por PDV (Diego 06/11/2026): si el concepto tiene regla se muestra ya abierto.
  const [repartoV, setRepartoV] = useState(undefined);
  // Un gasto vario casi siempre se carga ya pagado: arranca tildado (sin pago queda IMPAGO).
  const [pagarV, setPagarV] = useState(true);
  const [parecidoV, setParecidoV] = useState(null); // ya hay uno parecido: confirmar
  const [importeOkV, setImporteOkV] = useState("");   // "Está bien así" del aviso de importe
  const [tocadoV, setTocadoV] = useState(false);
  const concCtx = MAESTRO_CONCEPTOS.find((c) => c.concepto === ctx.concepto || (ctx.conceptoCodigo && c.codigo === ctx.conceptoCodigo));
  const [rubroV, setRubroV] = useState(ctx.rubro || (concCtx && concCtx.rubro) || "");
  const [conceptoV, setConceptoV] = useState(ctx.concepto || (concCtx && concCtx.concepto) || "");
  const [importeV, setImporteV] = useState(ctx.importe > 0 ? fmtNum(ctx.importe) : "");
  useEffect(() => {
    const r = variosPdv ? reglaV(conceptoV) : null;
    setRepartoV(r ? r.map((x) => ({ ...x })) : undefined);
  }, [conceptoV]); // eslint-disable-line react-hooks/exhaustive-deps
  // Desde una celda vacía del Panel: el importe es el del mes anterior y queda marcado hasta que lo toques (Diego 29/10).
  const [importeRevisar, setImporteRevisar] = useState(!!ctx.importeAnterior && ctx.importe > 0);
  // Desde el Panel (celda vacía) o Sin carga ya vienen período, concepto e importe: el cursor arranca
  // en el importe, que es lo único que suele cambiar (Diego 30/10/2026).
  const vieneConImporte = !!((ctx.concepto || ctx.conceptoCodigo) && ctx.importe > 0);

  // pago
  // "Registrar el pago ahora" (Etapa 4, paso 4): arranca destildado; sin pago la factura queda IMPAGA.
  const [pagarAhora, setPagarAhora] = useState(false);
  const formas = [];
  const [formaId, setFormaId] = useState(0);
  const [fechaPago, setFechaPago] = useState(ctx.fechaPago || hoyISO());
  const [pagadoPor, setPagadoPor] = useState(pdvActual || PDVS[0]);
  const { data: mediosData } = useMediosPago();
  const mediosPago = mediosParaElegir(mediosData);
  const [medioPagoSel, setMedioPago] = useState("");
  const medioPago = medioPagoSel || (mediosPago[0] && mediosPago[0].nombre) || "";
  const pidePagoId = !!(mediosPago.find((m) => m.nombre === medioPago) || {}).pideId;
  const [refPago, setRefPago] = useState("");
  const [importePago, setImportePago] = useState(""); // vacío = el total de la factura
  const [enCuotas, setEnCuotas] = useState(false);
  const [nCuotas, setNCuotas] = useState(12);

  const rubroDe = (con) => (MAESTRO_CONCEPTOS.find((m) => m.concepto === con) || {}).rubro || "";
  const conceptosDe = (rub) => MAESTRO_CONCEPTOS.filter((m) => !rub || m.rubro === rub).map((m) => m.concepto);
  const rubros = [...new Set(MAESTRO_CONCEPTOS.map((m) => m.rubro))];

  const netoTotal = lineas.reduce((a, l) => a + netoDe(l), 0);
  // IVA redondeado por línea, igual que lo guarda el servidor y lo trae MaxiRest.
  const ivaDe = (l) => Math.round(netoDe(l) * l.alic) / 100;
  const ivaTotal = lineas.reduce((a, l) => a + ivaDe(l), 0);
  const percTotal = percepciones.reduce((a, p) => a + parseImp(p.importe), 0);
  const impIntLineas = lineas.reduce((a, l) => a + parseImp(l.impint), 0);
  const impIntTotal = impIntLineas > 0 ? impIntLineas : parseImp(impIntG);
  const totalFactura = netoTotal + ivaTotal + percTotal + impIntTotal;
  const total = modo === "factura" ? totalFactura : parseImp(importeV);
  // Ver / editar una factura existente: el total de control arranca con el de la factura.
  useEffect(() => { if (ede && !totalCtrl && totalFactura > 0) setTotalCtrl(fmtNum(Math.round(totalFactura * 100) / 100)); }, []);
  const descGImporte = netoSinG - netoTotal;
  const totCtrl = parseImp(totalCtrl);
  const difCtrl = totCtrl > 0 ? Math.round((totalFactura - totCtrl) * 100) / 100 : 0;
  // II de toda la factura (proveedores que lo pasan solo por factura): se reparte entre los registros con II
  // (o entre todos si ninguno lo lleva) en proporción a su neto; el último absorbe el redondeo.
  const repartirII = (v) => {
    if (!(v >= 0) || Math.abs(v - impIntTotal) < 0.005) return;
    const conII = lineas.map((l, ix) => ({ l, ix })).filter(({ l }) => parseImp(l.impint) > 0 && netoDe(l) > 0);
    const base = conII.length ? conII : lineas.map((l, ix) => ({ l, ix })).filter(({ l }) => netoDe(l) > 0);
    if (!base.length) { setImpIntG(v > 0 ? fmtNum(v) : ""); return; }
    const suma = base.reduce((a, { l }) => a + netoDe(l), 0);
    let resto = Math.round(v * 100) / 100;
    const nuevos = {};
    base.forEach(({ l, ix }, k) => {
      const parte = k === base.length - 1 ? resto : Math.round(v * netoDe(l) / suma * 100) / 100;
      resto = Math.round((resto - parte) * 100) / 100;
      nuevos[ix] = parte;
    });
    setImpIntG("");
    setLineas((ls) => ls.map((x, ix) => {
      if (nuevos[ix] === undefined) return conII.length ? x : { ...x, impint: "", iiu: x.tipo === "insumo" ? "" : undefined };
      const c = parseFloat(x.cant) || 0;
      return { ...x, impint: nuevos[ix] > 0 ? fmtNum(nuevos[ix]) : "", iiu: x.tipo === "insumo" ? (c > 0 && nuevos[ix] > 0 ? fmtNum(Math.round(nuevos[ix] / c * 100) / 100) : "") : undefined };
    }));
  };
  const cuerpoVacio = lineas.every((l) => !l.item && !(netoBase(l) > 0)) && percepciones.length === 0 && !impIntG && !descG;
  // Vaciar en dos pasos (Diego 05/11/2026): primero el cuerpo; con el cuerpo vacío, todo (como recién abierto).
  // Borrador (Diego 05/11/2026): una factura a medio cargar queda guardada en este navegador para
  // seguirla después (interrupciones, facturas con muchos ítems). Se borra al guardar o al vaciar todo.
  const claveBorr = `lazarillo:borradorFactura:${(pdvsRef[0] || {}).localId || "x"}`;
  const puedeBorr = vista === "nueva" && !rde && !ede && !ctx.prov && !ctx.proveedorId && !ctx.concepto && !ctx.conceptoCodigo && !ctx.numero;
  const [borrPend, setBorrPend] = useState(() => {
    if (!puedeBorr) return null;
    try { const b = JSON.parse(localStorage.getItem(claveBorr) || "null"); return b && (b.prov || (b.lineas || []).some((l) => l.item)) ? b : null; } catch (_) { return null; }
  });
  const borrarBorrador = () => { try { localStorage.removeItem(claveBorr); } catch (_) {} };
  useEffect(() => {
    if (!puedeBorr || borrPend || modo !== "factura") return;
    const hay = prov || lineas.some((l) => l.item);
    try {
      if (!hay) { localStorage.removeItem(claveBorr); return; }
      localStorage.setItem(claveBorr, JSON.stringify({ prov, tipoCpb, compPref, compNum, fecha, periodoF, obs, totalCtrl, descG, descGTipo, impIntG, percepciones, origenPre,
        lineas: lineas.map(({ uid, foco, ...l }) => l), guardado: Date.now() }));
    } catch (_) {}
  }, [prov, tipoCpb, compPref, compNum, fecha, periodoF, obs, totalCtrl, descG, descGTipo, impIntG, percepciones, origenPre, lineas, borrPend, modo]);
  const retomarBorrador = () => {
    const b = borrPend; if (!b) return;
    provAnterior.current = b.prov || "";
    setProv(b.prov || ""); setTipoCpb(b.tipoCpb || ""); setCompPref(b.compPref || ""); setCompNum(b.compNum || ""); setFecha(b.fecha || fechaDefault);
    setObs(b.obs || ""); setPeriodoF(b.periodoF || null); setTotalCtrl(b.totalCtrl || ""); setDescG(b.descG || ""); setDescGTipo(b.descGTipo || "%"); setImpIntG(b.impIntG || "");
    setPercepciones(b.percepciones || []); setOrigenPre(b.origenPre || null);
    setLineas((b.lineas || []).map((l) => ({ ...l, foco: false })));
    setBorrPend(null); setReinicio((n) => n + 1);
  };
  const vaciar = () => {
    setConfVaciar(false); setErrores([]); setAvisosAlGuardar(null);
    setLineas([]); setPercepciones([]); setImpIntG(""); setDescG(""); setOrigenPre(null);
    if (!cuerpoVacio) {
      setLineas([{ tipo: tipoDefault(prov), item: "", neto: "", cant: "", unit: "", alic: 21, conc: "", pdvDest: pdvActual || PDVS[0], editando: true, foco: false }]);
      return;
    }
    provAnterior.current = "";
    setProv(""); setTipoCpb(""); setCompPref(""); setCompNum(""); setFecha(fechaDefault); setPeriodoF(null); setObs(""); setTotalCtrl("");
    setAltaProv(null); setPagarAhora(false); setImportePago(""); setErrFecha(false); setFuturaOk("");
    setReinicio((n) => n + 1);
    borrarBorrador();
  };

  // Un registro se puede confirmar con producto, importe, reparto que sume 100% y —si es
  // insumo— concepto de caja (antes dejaba seguir sin concepto: FALLA de Diego, 27/10/2026).
  const faltaDe = (l) => {
    if (!l.item) return "Elegí el concepto o insumo";
    // Insumo bonificado: importe 0 con cantidad (Diego, 27/10/2026); un concepto sí necesita importe.
    if (l.tipo === "insumo" ? !(parseFloat(l.cant) > 0) : !(netoDe(l) > 0)) return l.tipo === "insumo" ? "Poné la cantidad" : "Poné el importe";
    if (descExcede(l)) return "El descuento es mayor que el importe";
    if (l.tipo === "insumo" && !codConcepto(l.conc)) return "Elegí el concepto de caja del insumo";
    if (l.reparto && Math.abs(l.reparto.reduce((a, x) => a + (parseFloat(x.pct) || 0), 0) - 100) >= 0.01) return "El reparto por PDV tiene que sumar 100%";
    return null;
  };
  const setLinea = (i, campo, v) => setLineas((ls) => ls.map((l, ix) => ix === i ? { ...l, [campo]: v } : l));
  // "Precargar esa estructura" (Repetir): la última factura de este proveedor en el local,
  // de MaxiRest o de Lazarillo, con el mismo formato del modal (Diego, 27/10/2026).
  const [ultFact, setUltFact] = useState(null);
  useEffect(() => {
    setUltFact(null);
    if (vista !== "nueva" || rde) return;
    const p = proveedores.find((x) => x.nombre === prov);
    const pdvSel = pdvsRef.find((x) => x.nombre === (pdvActual || PDVS[0]));
    if (!p || !pdvSel) return;
    let vivo = true;
    gestionFetch(`/api/facturas/ultima?proveedorId=${p.id}&localId=${pdvSel.localId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo || !d || !d.ultima) return;
        const e = edeDesdeFactura(d.ultima.rowId, d.ultima.factura, { maestros, pdvsRef });
        setUltFact({ ...e, importe: d.ultima.totalFilas });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [prov]);
  const ultConLineas = () => ultFact;
  // Precargada la estructura y después se cambia el proveedor: se saca la precarga (era de otro
  // proveedor) y vuelve a aparecer la opción de precargar la del nuevo (Diego, 28/10/2026).
  const provAnterior = useRef(prov);
  useEffect(() => {
    if (provAnterior.current === prov) return;
    provAnterior.current = prov;
    setLineas((ls) => (ls.length === 1 && !ls[0].item && !ctx.concepto ? [{ ...ls[0], tipo: tipoDefault(prov) }] : ls));
    if (origenPre && !existente) {
      setOrigenPre(null);
      setLineas([]);
      setPercepciones([]);
      setImpIntG("");
    }
  }, [prov]);
  const cuerpoVisible = existente || !!origenPre || !!(prov && tipoCpb && compNum && fecha && parseImp(totalCtrl) > 0);
  useEffect(() => {
    // foco:false — la línea aparece apenas hay proveedor, tipo, Nº y fecha: si se llevaba el foco,
    // cortaba el Nº de comprobante al primer dígito (FALLA de Diego 05/11/2026).
    if (modo === "factura" && cuerpoVisible && lineas.length === 0 && !existente)
      setLineas([{ tipo: ctx.concepto ? "concepto" : tipoDefault(prov), item: ctx.concepto || "", neto: "", cant: "", unit: "", alic: 21, conc: "", pdvDest: pdvActual || PDVS[0], editando: true, foco: false }]);
  }, [cuerpoVisible]);
  const precargarDe = (f) => {
    // La cabecera ya está completa (tipo, Nº, fecha y total): no se pisa; el foco va al primer registro.
    setOrigenPre(f.comp);
    setLineas(abrirPrecarga(f.lineas));
    setPercepciones((f.percepciones || []).map((p) => ({ ...p })));
    const tieneImpLinea = f.lineas.some((l) => parseImp(l.impint) > 0);
    setImpIntG(!tieneImpLinea && f.impInt > 0 ? fmtNum(f.impInt) : "");
  };
  // Deteccion de factura ya cargada: mismo proveedor + tipo + prefijo-numero en el local (de MaxiRest o de Lazarillo).
  // Por ahora avisa y no deja guardar (no se duplica); editarla llega con "Ver / Editar".
  const compBuscado = tipoCpb && compPref && compNum ? `${tipoCpb} ${pad(compPref, 4)}-${pad(compNum, 8)}` : "";
  const [yaCargada, setYaCargada] = useState(null);
  useEffect(() => {
    setYaCargada(null);
    // Editando: el mismo proveedor y Nº de la factura que se edita no cuenta como "ya cargada".
    if (ede && `${prov}|${compBuscado}` === `${ede.prov}|${ede.comp}`) return;
    const p = proveedores.find((x) => x.nombre === prov);
    const pdvSel = pdvsRef.find((x) => x.nombre === (pdvActual || PDVS[0]));
    if (!p || !compBuscado || !pdvSel) return;
    let vivo = true;
    gestionFetch(`/api/facturas/existe?proveedorId=${p.id}&localId=${pdvSel.localId}&tipo=${encodeURIComponent(tipoCpb)}&prefijo=${pad(compPref, 4)}&numero=${pad(compNum, 8)}&fecha=${fecha || ""}`)
      .then((r) => r.json()).then((d) => { if (vivo && d && d.existe) setYaCargada(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [prov, compBuscado, fecha]);
  const factExistente = null;
  const pagadoExistente = 0;
  const estadoExistente = "";

  // Gasto vario: POST /api/gastos-varios (Ticket interno de "Gastos Varios", con su pago).
  const avisoVario = () => {
    const h = habitualDe(null, codConcepto(conceptoV));
    if (!h) return null;
    const a = avisoPrecio(parseImp(importeV), h.mediana, null);
    if (!a || importeOkV === importeV) return null;
    return { ...a, ref: h.mediana, medBase: "", habitual: `últimas ${h.n}:` };
  };
  const guardarVario = (forzar, forzarAvisos) => {
    const av = forzarAvisos ? null : avisoVario();
    if (av && av.nivel === "rojo") { setTocadoV(true); setAvisosAlGuardar([{ l: { item: conceptoV, tipo: "concepto", neto: importeV }, a: av }]); return; }
    setAvisosAlGuardar(null);
    let fAct = fechaV;
    if (!fechaValida(fAct)) { const c = corregirFecha(fAct); if (c) { fAct = c; setFechaV(c); } }
    const faltan = [];
    if (!codConcepto(conceptoV)) faltan.push("Elegí el concepto del gasto.");
    if (!(parseImp(importeV) > 0)) faltan.push("Poné el importe del gasto.");
    if (!fechaValida(fAct)) faltan.push("Falta una fecha del gasto válida.");
    if (pagarV) {
      if (!medioPago) faltan.push("Elegí el medio de pago (se dan de alta en Medios de pago, en el menú).");
      if (!fechaValida(fechaPago)) faltan.push("Falta una fecha de pago válida.");
    }
    // El 15 del período puede ser posterior a hoy y está bien; otra fecha futura se confirma.
    if (fechaValida(fAct) && fAct > HOY && fAct !== fechaDelPeriodo(periodoV) && futuraOk !== fAct) {
      faltan.push(`La fecha del gasto (${dmy4(fAct)}) es posterior a hoy. Revisala; si está bien, tocá Guardar de nuevo.`);
      setFuturaOk(fAct);
    }
    if (repartoV && Math.abs(repartoV.reduce((a, x) => a + (parseFloat(x.pct) || 0), 0) - 100) >= 0.01) faltan.push("El reparto por PDV tiene que sumar 100%.");
    if (faltan.length) { setErrores(faltan); setErrFecha(!fechaValida(fAct)); return; }
    setErrores([]); setErrFecha(false); setParecidoV(null);
    // Igual a la regla del concepto: no se manda, la regla lo reparte como a cualquier gasto.
    const regV = reglaV(conceptoV);
    const igualReglaV = regV && repartoV && regV.length === repartoV.length && regV.every((r, k) => r.pdv === repartoV[k].pdv && Math.abs(parseFloat(r.pct) - parseFloat(repartoV[k].pct)) < 0.01);
    const payload = {
      reparto: repartoV && !igualReglaV ? repartoV.filter((x) => parseFloat(x.pct) > 0).map((x) => ({ puntoDeVentaId: idPdv(x.pdv), pct: parseFloat(x.pct) })) : null,
      lugarId: idPdv(pdvV), conceptoCodigo: codConcepto(conceptoV), detalle: detalle.trim() || null,
      importe: Math.round(parseImp(importeV) * 100) / 100, fecha: fAct, forzar: !!forzar,
      pago: pagarV ? { fecha: fechaPago, medio: medioPago, referencia: pidePagoId && refPago.trim() ? refPago.trim() : null, pdvPagaId: idPdv(pagadoPor) } : null,
    };
    setGuardando(true);
    gestionFetch("/api/gastos-varios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        setGuardando(false);
        if (!ok && d && d.parecido) { setParecidoV(d.parecido); return; }
        if (!ok) { setErrores([(d && d.error) || "No se pudo guardar el gasto.", ...((d && d.detalle) || [])]); return; }
        onGuardado({ ...d, gastoVario: true, concepto: conceptoV });
      })
      .catch(() => { setGuardando(false); setErrores(["Error de red: no se guardó."]); });
  };

  const guardar = (opc) => {
    const forzarAvisos = opc === true; // "Guardar igual" del aviso de precios
    if (modo === "vario") { guardarVario(false, forzarAvisos); return; }
    let fAct = modo === "factura" ? fecha : fechaV;
    if (!fechaValida(fAct)) {
      const c = corregirFecha(fAct);
      if (c) { fAct = c; if (modo === "factura") setFecha(c); else setFechaV(c); }
    }
    const faltan = [];
    if (modo === "factura") {
      if (!prov) faltan.push("Elegí el proveedor.");
      if (!tipoCpb) faltan.push("Elegí el tipo de comprobante (o usá Generar, que arma un Ticket interno).");
      else if (!compPref || !compNum || parseInt(compPref + compNum, 10) === 0) faltan.push("Falta el Nº de comprobante.");
      if (!fechaValida(fAct)) faltan.push("Falta una fecha de factura válida.");
      if (lineas.filter((l) => netoDe(l) > 0).length === 0) faltan.push("Agregá al menos un registro con importe.");
      if (lineas.some((l) => l.precargada)) faltan.push("Hay registros precargados sin revisar: tocá el ⚠ de cada uno para abrirlo y verificar el importe.");
      // Un registro abierto a medio completar (p. ej. reparto que no suma 100%) no se guarda igual.
      lineas.filter((l) => l.editando && (l.item || netoDe(l) > 0)).forEach((l) => { const f = faltaDe(l); if (f) faltan.push(`${l.item || "Registro"}: ${f}.`); });
    } else {
      if (!fechaValida(fAct)) faltan.push("Falta una fecha del gasto válida.");
      if (total <= 0) faltan.push("Poné el importe del gasto.");
    }
    if (yaCargada) faltan.push("Esta factura ya está cargada: no se vuelve a cargar.");
    if (modo === "factura" && vista === "nueva" && pagarAhora) {
      if (!medioPago) faltan.push("Elegí el medio de pago (se dan de alta en Medios de pago, en el menú).");
      if (!fechaValida(fechaPago)) faltan.push("Falta una fecha de pago válida.");
    }
    // Fecha posterior a hoy: casi siempre es un error de tipeo (pasó con un ticket guardado en noviembre).
    if (fechaValida(fAct) && fAct > HOY && futuraOk !== fAct && !(ede && ede.fecha === fAct)) {
      faltan.push(`La fecha de factura (${dmy4(fAct)}) es posterior a hoy. Revisala; si está bien, tocá Guardar de nuevo.`);
      setFuturaOk(fAct);
    }
    const sinConc = lineas.filter((l) => l.tipo === "insumo" && l.item && !codConcepto(l.conc || conceptoDeInsumo(l.item)));
    if (sinConc.length) faltan.push(`Elegí el concepto de caja de: ${sinConc.map((l) => l.item).join(", ")}.`);
    if (lineas.some((l) => l.editando && !faltaDe(l))) setLineas((ls) => ls.map((x) => ({ ...x, editando: false })));
    if (faltan.length) { setErrores(faltan); setErrFecha(!fechaValida(fAct)); return; }
    // Precios muy lejos de la última compra (rojo) sin resolver: se pregunta una sola vez.
    if (modo === "factura" && !forzarAvisos) {
      const rojas = lineas.map((l) => ({ l, a: avisoDe(l) })).filter((x) => x.a && x.a.nivel === "rojo");
      // El desglose contra el total del comprobante (más de $ 1 de diferencia: no es redondeo).
      const conTotal = totCtrl > 0 && Math.abs(difCtrl) > 1 ? [{ total: true }, ...rojas] : rojas;
      if (conTotal.length) { setErrores([]); setAvisosAlGuardar(conTotal); return; }
    }
    setAvisosAlGuardar(null);
    setErrores([]);
    setErrFecha(false);
    const p = proveedores.find((x) => x.nombre === prov);
    const pdvBase = idPdv(pdvActual || PDVS[0]);
    const registros = lineas.filter((l) => l.item && (netoDe(l) > 0 || (l.tipo === "insumo" && parseFloat(l.cant) > 0))).map((l) => {
      const esIns = l.tipo === "insumo";
      const ins = esIns ? MAESTRO_INSUMOS.find((x) => x.nombre === l.item) || {} : {};
      const regla = reglaDeItem(l, l.item);
      const igualRegla = regla && l.reparto && regla.length === l.reparto.length && regla.every((r, k) => r.pdv === l.reparto[k].pdv && Math.abs(parseFloat(r.pct) - parseFloat(l.reparto[k].pct)) < 0.01);
      const reparto = l.reparto && !igualRegla ? l.reparto.filter((x) => parseFloat(x.pct) > 0).map((x) => ({ puntoDeVentaId: idPdv(x.pdv), pct: parseFloat(x.pct) })) : null;
      return {
        tipo: l.tipo,
        conceptoCodigo: esIns ? codConcepto(l.conc || conceptoDeInsumo(l.item)) : codConcepto(l.item),
        insumoCodigo: esIns ? ins.codigo || l.codIns || null : null,
        nombre: l.item,
        // La de la línea primero: si se cargó en envases (X8) el precio es por envase y no hay que perderla.
        medida: esIns ? l.medida || ins.medida || null : null,
        cantidad: esIns ? parseFloat(l.cant) || null : null,
        neto: Math.round(netoDe(l) * 100) / 100,
        alicuota: l.alic,
        impInt: parseImp(l.impint),
        // Igual a la regla de apertura: va al PDV de gestión y la regla la reparte como a cualquier compra.
        puntoDeVentaId: igualRegla ? pdvBase : idPdv(l.pdvDest || pdvActual || PDVS[0]),
        reparto,
      };
    });
    const payload = {
      proveedorId: p ? p.id : null, tipo: tipoCpb, prefijo: pad(compPref, 4), numero: pad(compNum, 8), fecha: fAct, periodo: periodoF || periodoDe(fAct),
      observacion: obs || null, registros,
      percepciones: percepciones.filter((x) => parseImp(x.importe) > 0).map((x) => ({ tipo: x.tipo, importe: parseImp(x.importe) })),
      impIntGeneral: impIntLineas > 0 ? 0 : parseImp(impIntG),
      // Pago en la misma transacción que la factura (sin importe: la salda entera).
      ...(vista === "nueva" && pagarAhora ? { pago: {
        fecha: fechaPago, medio: medioPago, referencia: pidePagoId && refPago.trim() ? refPago.trim() : null,
        pdvPagaId: idPdv(pagadoPor), ...(parseImp(importePago) > 0 ? { importe: parseImp(importePago) } : {}),
      } } : {}),
    };
    setGuardando(true);
    gestionFetch(vista === "editar" ? `/api/facturas/${editRowId}` : "/api/facturas", { method: vista === "editar" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => null) }))
      .then(({ ok, d }) => {
        setGuardando(false);
        if (!ok) { setErrores([(d && d.error) || "No se pudo guardar la factura.", ...((d && d.detalle) || [])]); return; }
        if (puedeBorr) borrarBorrador();
        // Recordar IVA e II de cada insumo / concepto para la próxima carga (Diego 06/11/2026).
        const recordar = lineas.filter((l) => l.item).map((l) => {
          if (l.tipo !== "insumo") { const k = codConcepto(l.item); return k ? { tipo: "concepto", codigo: String(k), alic: Number(l.alic) } : null; }
          const ins = MAESTRO_INSUMOS.find((x) => x.nombre === l.item) || {};
          const cod = ins.codigo || l.codIns;
          if (!cod) return null;
          const c = parseFloat(l.cant) || 0;
          const f = medidaLinea(l).factor || 1;
          // Sin II cargado no se pisa lo recordado, salvo que se haya puesto 0 a propósito.
          const iiT = parseImp(l.impint);
          const ii = iiT > 0 && c > 0 ? Math.round(iiT / c / f * 10000) / 10000 : l.iiu === "0" || l.impint === "0" ? 0 : null;
          return { tipo: "insumo", codigo: String(cod), alic: Number(l.alic), ii };
        }).filter(Boolean);
        if (recordar.length) gestionFetch("/api/facturas/recordados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: recordar }) })
          .then(() => qcMaestros.invalidateQueries({ queryKey: ["gestionMaestrosFactura"] })).catch(() => {});
        // Recordar el descuento de cada insumo de este proveedor para la próxima carga (0 = ya no trae).
        if (p && p.id) {
          const items = lineas.filter((l) => l.tipo === "insumo" && l.item).map((l) => {
            const ins = MAESTRO_INSUMOS.find((x) => x.nombre === l.item) || {};
            const cod = ins.codigo || l.codIns;
            return cod ? { codigo: String(cod), tipo: l.descTipo === "u" || l.descTipo === "t" ? l.descTipo : "%", valor: parseImp(l.desc) || 0 } : null;
          }).filter(Boolean);
          if (items.length) gestionFetch("/api/facturas/descuentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proveedorId: p.id, items }) })
            .then(() => qcMaestros.invalidateQueries({ queryKey: ["gestionMaestrosFactura"] })).catch(() => {});
        }
        onGuardado(d);
      })
      .catch(() => { setGuardando(false); setErrores(["Error de red: no se guardó."]); });
  };

  const titulo = vista === "ver" ? `Factura ${ede ? ede.comp : ""}` : vista === "editar" ? `Editar factura ${ede ? ede.comp : ""}` : "Carga de factura";
  // Rediseño (Diego 05/11/2026): cabecera y pie fijos, lo único que scrollea es el cuerpo; bloques
  // con fondo gris claro y bordes redondeados como la vista tabla del Panel.
  const bloque = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12 };
  const revisados = lineas.filter((l) => l.desdePre && !l.precargada && !l.editando).length;
  const deEstructura = lineas.filter((l) => l.desdePre).length;
  return (
    <div style={embebido ? { display: "contents" } : { position: "fixed", inset: 0, background: "rgba(40,40,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300 }} onClick={embebido ? undefined : onCerrar}>
      <div style={{ ...(embebido ? { maxHeight: "86vh" } : { ...card, width: "min(1320px, 98vw)", maxHeight: "94vh" }), display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()} onKeyDown={enterAvanza} data-card="1">
        <div style={{ padding: "14px 20px 10px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {vista === "nueva" && !rde ? (<>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.gris }}>Carga de</span>
              <div style={{ display: "inline-flex", gap: 3, background: "#f2f2f0", borderRadius: 10, padding: 3 }}>
                {[["factura", "Factura"], ["vario", "Gastos Varios"], ["empleado", "Empleados"]].map(([k, t]) => (
                  <button key={k} type="button" tabIndex={-1} onClick={() => { setModo(k); setErrores([]); setErrFecha(false); setParecidoV(null); setAvisosAlGuardar(null); }}
                    style={{ border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      background: modo === k ? "#fff" : "transparent", color: modo === k ? C.neg : C.gris, boxShadow: modo === k ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>{t}</button>
                ))}
              </div>
            </>) : <h2 style={{ fontSize: 17, margin: 0 }}>{titulo}</h2>}
            <span style={{ flex: 1 }} />
            {modo === "factura"
              ? <SelectorPeriodo valor={perF} soloVer={soloVer} onCambio={(x) => setPeriodoF(fechaValida(fecha) && x === periodoDe(fecha) ? null : x)}
                  nota={periodoF ? "distinto al de la fecha" : null} titulo="Mes en el que cuenta toda la factura en la vista Económica. Sigue la fecha salvo que lo cambies." />
              : modo === "vario" ? <SelectorPeriodo valor={periodoV} onCambio={elegirPeriodo} titulo="Mes del gasto" />
              : <SelectorPeriodo valor={periodoE} onCambio={setPeriodoE} titulo="Período del sueldo o del adelanto" />}
            <button type="button" tabIndex={-1} onClick={onCerrar} style={{ border: "none", background: "none", fontSize: 20, color: "#999", cursor: "pointer", marginLeft: 6 }}>×</button>
          </div>
        {fichaProvId && <FichaProveedor id={fichaProvId} onCerrar={() => setFichaProvId(null)}
          onGuardado={(d) => {
            const antes = (proveedores.find((x) => x.id === d.id) || {}).nombre;
            setProvsEditados((m) => ({ ...m, [d.id]: { nombre: d.nombre, razon: d.razon } }));
            if (antes && prov === antes) { provAnterior.current = d.nombre; setProv(d.nombre); }
            setFichaProvId(null);
            if (props.onProveedorEditado) props.onProveedorEditado(d);
          }} />}
        {aviso && <div style={{ border: "1.5px solid #bfe0f0", background: "#f3fafd", borderRadius: 11, padding: "8px 12px", fontSize: 12.5, color: "#2a6b86" }}>{aviso}</div>}
        {modo === "factura" && borrPend && (
          <div style={{ border: "1.5px solid #bfe0f0", background: "#f3fafd", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: "#2a6b86", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>↺ Tenés una factura <b>a medio cargar</b>: <b>{borrPend.prov || "sin proveedor"}</b>{borrPend.compNum ? ` · ${borrPend.tipoCpb || ""} ${borrPend.compPref || ""}-${borrPend.compNum}` : ""} · {(borrPend.lineas || []).filter((l) => l.item).length} registros
              {borrPend.guardado ? ` · ${new Date(borrPend.guardado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
            <button type="button" onClick={retomarBorrador} style={{ ...btn(true), padding: "5px 12px", fontSize: 12.5, marginLeft: "auto" }}>Retomarla</button>
            <button type="button" onClick={() => { borrarBorrador(); setBorrPend(null); }} style={{ ...btn(false), padding: "5px 12px", fontSize: 12.5, color: C.rojo }}>Descartarla</button>
          </div>
        )}
        {modo === "factura" && (
          <fieldset key={"cab" + reinicio} disabled={soloVer} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...bloque, padding: "8px 12px 10px", display: "grid", gridTemplateColumns: "1.3fr 0.6fr 1fr 0.95fr 0.8fr 1fr", gap: 10, alignItems: "start" }}>
              <div>{(() => {
                  const pr = proveedores.find((x) => x.nombre === prov);
                  return (
                    <span style={{ ...lab, display: "flex", alignItems: "baseline", gap: 8 }}>Proveedor
                      {pr && pr.id && !soloVer && <span role="button" tabIndex={-1} onClick={() => setFichaProvId(pr.id)} title="Abrir la ficha del proveedor para ver o modificar sus datos"
                        style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0, fontSize: 11.5, fontWeight: 600, color: C.cel, cursor: "pointer" }}>ver ficha ›</span>}
                    </span>
                  );
                })()}
                <Combo opciones={proveedores.map((p) => p.nombre)} valor={prov} placeholder="Buscar proveedor..." autoFocus={vista === "nueva"}
                  onElegir={setProv} crearPrimero="proveedor"
                  extra={(n) => { const pr = provPorNombre[n]; if (!pr) return ""; return [pr.razon && pr.razon.trim().toLowerCase() !== n.trim().toLowerCase() ? pr.razon : "", pr.cuit ? "CUIT " + pr.cuit : ""].filter(Boolean).join(" · "); }}
                  onCrear={(n) => setAltaProv({ nombre: n || "", razon: "", cuit: "", tel: "", dir: "" })} /></div>
              <div><span style={lab}>Tipo</span>
                <select ref={tipoRef} style={sel} value={tipoCpb} onChange={(e) => setTipoCpb(e.target.value)}>
                  <option value="">Elegir…</option>
                  {TIPOS_CPB.map((t) => <option key={t}>{t}</option>)}
                </select></div>
              <div><span style={lab}>Nº comprobante</span>
                {tipoCpb === "" ? (
                  <button type="button" title="Genera un comprobante interno tipo Ticket: hora y minutos + fecha de hoy"
                    onClick={() => { const ahora = new Date();
                      setTipoCpb("Ticket");
                      setCompPref(String(ahora.getHours()).padStart(2, "0") + String(ahora.getMinutes()).padStart(2, "0"));
                      setCompNum(String(ahora.getDate()).padStart(2, "0") + String(ahora.getMonth() + 1).padStart(2, "0") + ahora.getFullYear());
                      setTimeout(() => fechaRef.current && fechaRef.current.focus(), 40); }}
                    style={{ ...btn(false), height: 38, padding: "0 16px", fontSize: 13, whiteSpace: "nowrap" }}>Generar</button>
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input style={{ ...inp, width: 64 }} value={compPref} placeholder="0001" maxLength={4}
                      onChange={(e) => setCompPref(e.target.value.replace(/\D/g, ""))} onBlur={() => setCompPref(pad(compPref, 4))} />
                    <span style={{ color: "#999" }}>-</span>
                    <input style={inp} value={compNum} placeholder="00000000" maxLength={8}
                      onChange={(e) => setCompNum(e.target.value.replace(/\D/g, ""))} onBlur={() => setCompNum(pad(compNum, 8))} />
                  </div>
                )}</div>
              <div><span style={lab}>Fecha</span><FechaTriple inputRef={fechaRef} error={errFecha} iso={fecha}
                  onISO={(v) => { setFecha(v); setErrFecha(false); }} />
                {errFecha && <div style={{ fontSize: 11, color: C.rojo, fontWeight: 700, marginTop: 3 }}>Falta una fecha válida.</div>}</div>
              <div><span style={lab}>Total factura</span>
                <input style={{ ...inp, textAlign: "right", fontWeight: 700 }} value={totalCtrl} placeholder="$ 0,00"
                  title="El total del comprobante (con IVA y percepciones). Al terminar el desglose tiene que coincidir."
                  onFocus={(e) => e.target.select()} onChange={(e) => setTotalCtrl(fmtImp(e.target.value, e.nativeEvent))} /></div>
              <div><span style={lab}>Observaciones</span>
                <input style={inp} tabIndex={-1} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></div>
            </div>

            {yaCargada && (
              <div style={{ border: "1.5px solid #f0c179", background: "#fdf8ef", borderRadius: 11, padding: "8px 12px", fontSize: 12.5, color: "#8a5a00" }}>
                ⚠ Esta factura <b>ya está cargada</b> ({yaCargada.origen === "lazarillo" ? "en Lazarillo" : "desde MaxiRest"}{yaCargada.fecha ? ` · ${dmy(yaCargada.fecha)}` : ""} · {$fmt(yaCargada.total)}). No se vuelve a cargar: <b>nunca se duplica</b>. Para corregirla abrila desde Detalle de compras.
              </div>
            )}

            {altaProv && (
              <div style={{ border: `1.5px solid ${C.cel}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nuevo proveedor</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div><span style={lab}>Nombre *</span><input style={inp} autoFocus value={altaProv.nombre} onChange={(e) => setAltaProv({ ...altaProv, nombre: e.target.value })} /></div>
                  <div><span style={lab}>Razón social</span><input style={inp} placeholder="igual al nombre" value={altaProv.razon} onChange={(e) => setAltaProv({ ...altaProv, razon: e.target.value })} /></div>
                  <div><span style={lab}>CUIT</span><input style={inp} value={altaProv.cuit} onChange={(e) => setAltaProv({ ...altaProv, cuit: e.target.value })} /></div>
                  <div><span style={lab}>Teléfono</span><input style={inp} value={altaProv.tel} onChange={(e) => setAltaProv({ ...altaProv, tel: e.target.value })} /></div>
                  <div style={{ gridColumn: "2 / span 2" }}><span style={lab}>Dirección</span><input style={inp} value={altaProv.dir} onChange={(e) => setAltaProv({ ...altaProv, dir: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!creandoProv) crearProveedor(); } }} title="Enter: crear y usar" /></div>
                </div>
                <div style={{ fontSize: 11.5, color: C.gris, marginTop: 6 }}>Lo demás (mail, CBU, contacto…) lo completás después desde «ver ficha».</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" style={btn(true)} disabled={creandoProv} onClick={crearProveedor}>{creandoProv ? "Creando…" : "Crear y usar"}</button>
                  <button type="button" style={btn(false)} onClick={() => setAltaProv(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </fieldset>
        )}
        </div>

        {/* ── Cuerpo: lo único que scrollea ── */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", margin: "0 20px", ...(modo === "empleado" ? {} : { border: `1px solid ${C.borde}`, borderRadius: 12 }) }}>
        {modo === "empleado" ? (
          <CargaEmpleado pdvId={idPdv(pdvActual || PDVS[0])} pdvsRef={pdvsRef} conceptos={maestros.conceptos} mediosPago={mediosPago}
            reglaEmpleadoDe={reglaEmpleadoDe} onGuardado={onGuardado} onCerrar={onCerrar} periodo={periodoE} setPeriodo={setPeriodoE} />
        ) : (
        <fieldset disabled={soloVer} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

        {modo === "factura" ? (
          <>
            {!cuerpoVisible && (
              <div style={{ margin: 14, border: "1px dashed #d8d8d4", borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: "#999" }}>
                Completá {[!prov && "proveedor", !tipoCpb && "tipo", !compNum && "Nº", !fecha && "fecha", !(totCtrl > 0) && "total de la factura"].filter(Boolean).join(" · ")} y se despliega la carga de registros.
              </div>
            )}
            {cuerpoVisible && (<>
            {(() => {
              const uf = !existente && !origenPre && prov && !lineas.some((l) => netoDe(l) > 0) ? ultConLineas(prov) : null;
              if (!uf) return null;
              return (
                <div style={{ margin: "12px 14px 0", border: "1.5px solid #bfe0f0", background: "#f3fafd", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: "#2a6b86" }}>ℹ <b>{prov}</b> suele repetir la estructura — última del {dmy(uf.fecha)}: {uf.lineas.map((l) => l.item).join(" · ")} · {$fmt(uf.importe)}</span>
                  <button type="button" style={{ ...btn(false), padding: "5px 12px", fontSize: 12.5, borderColor: "#5bc2ea", color: "#2a88ad", marginLeft: "auto" }}
                    onClick={() => precargarDe(uf)}>Precargar esa estructura</button>
                </div>
              );
            })()}
            {origenPre && !existente && (
              <div style={{ margin: "12px 14px 0", border: "1.5px solid #f0d5a8", background: "#fdf8ee", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: "#8a6d2f", display: "flex", gap: 12, alignItems: "center" }}>
                <span>⚠ Comprobante <b>nuevo</b> con la estructura de <b>{origenPre}</b>: los importes son los de esa factura. Revisá cada registro (⚠) contra el comprobante real.</span>
                {deEstructura > 0 && <b style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{revisados} de {deEstructura} revisados</b>}
              </div>
            )}
            {/* Tabla de registros (Diego 06/11/2026, mockup A7b): fila de edición igual a la de la tabla, descuento
                vinculado debajo de unitario y total, chips de concepto de caja y PDV a la derecha, columnas de
                impuestos internos fijas y fila de totales alineada a las columnas (fija abajo). */}
            <div style={{ padding: "0 14px", minWidth: ANCHO_MIN_LIN }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID_LIN, gap: 8, fontSize: 10.5, fontWeight: 700, color: C.gris, position: "sticky", top: 0, zIndex: 5, background: "#fafaf8", borderBottom: "1px solid #ececea", margin: "0 -14px 4px", padding: "9px 14px", textAlign: "center" }}>
                <span style={{ textAlign: "left", paddingLeft: lineas.length > 1 && !soloVer ? 22 : 0 }}>CONCEPTO / INSUMO</span><span>CANT.</span><span>UNIT. $</span><span>TOTAL NETO $</span>
                <span style={{ color: C.ii }}>II /u $</span><span style={{ color: C.ii }}>II TOTAL $</span><span>IVA %</span><span>IVA $</span><span>SUBTOTAL c/IMP.</span><span />
              </div>
              {lineas.map((l, i) => {
                const esIns = l.tipo === "insumo";
                const neto = netoDe(l);
                const desc = descDe(l);
                const cantN = parseFloat(l.cant) || 0;
                const unitEf = esIns && (desc > 0 || fracG > 0) && cantN > 0 ? neto / cantN : parseImp(l.unit);
                const ivaUnit = esIns ? unitEf * l.alic / 100 : 0;
                const ii = parseImp(l.impint);
                const iiU = esIns && cantN > 0 && ii > 0 ? ii / cantN : 0;
                const llave = l.uid || "i" + i;
                const dnd = soloVer ? {} : {
                  onDragOver: (e) => { if (arrastre) { e.preventDefault(); if (arrastre.a !== i) setArrastre({ ...arrastre, a: i }); } },
                  onDrop: (e) => { e.preventDefault(); if (arrastre) moverLinea(arrastre.de, i); setArrastre(null); },
                };
                const marcaDrop = arrastre && arrastre.a === i && arrastre.de !== i ? { boxShadow: `inset 0 ${arrastre.de < i ? -3 : 3}px 0 ${C.cel}` } : {};
                const ivaLinea = ivaDe(l);
                const subtotal = neto + ivaLinea + ii;
                const { med, base: medBase, factor: fEnv } = esIns ? medidaLinea(l) : { med: "", base: "", factor: null };
                const final = esIns && cantN > 0 && subtotal > 0 ? subtotal / cantN : 0;
                const aviso = !soloVer && (!l.editando || l.tocado) ? avisoDe(l) : null;
                const avisoUI = aviso && <AvisoLinea a={aviso} onCorregir={() => corregirPrecio(i, aviso.sugerido)} onAceptar={() => aceptarPrecio(i)} />;
                const sinConc = !soloVer ? sinConceptoDe(l) : null;
                const sinConcUI = sinConc && <AvisoSinConcepto {...sinConc} />;
                const celda = { color: "#555", textAlign: "center", minWidth: 0, overflow: "hidden" };
                const chica = { display: "block", fontSize: 10.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
                const txtDesc = desc > 0 && esIns ? (l.descTipo === "u" ? `−${fmtNum(parseImp(l.desc))} /u` : l.descTipo === "t" ? `−${fmtNum(parseImp(l.desc))}` : `−${fmtNum(parseImp(l.desc))}%`) + (cantN > 0 ? ` → ${fmtNum(Math.round((brutoDe(l) - desc) / cantN * 100) / 100)}` : "") : "";
                if (!l.editando) return (
                  <React.Fragment key={llave}>
                  <div {...dnd} draggable={!soloVer && lineas.length > 1}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(i)); } catch (_) {} setArrastre({ de: i, a: i }); }}
                    onDragEnd={() => setArrastre(null)}
                    style={{ display: "grid", gridTemplateColumns: GRID_LIN, gap: 8, alignItems: "center", padding: "8px 0", borderBottom: avisoUI || sinConcUI ? "none" : "1px solid #f2f2f0", fontSize: 13,
                      opacity: arrastre && arrastre.de === i ? 0.45 : 1, ...(l.precargada ? { background: "#fffdf5" } : {}), ...marcaDrop }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      {!soloVer && lineas.length > 1 && <span title="Arrastrá para ordenar los registros" style={{ cursor: "grab", color: "#bbb", fontSize: 14, lineHeight: 1, flexShrink: 0, marginLeft: -2, userSelect: "none" }}>⠿</span>}
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: esIns ? C.cel : "#999", border: `1.2px solid ${esIns ? C.cel : "#ccc"}`, borderRadius: 6, padding: "2px 0", width: 70, textAlign: "center", flexShrink: 0 }}>{esIns ? "INSUMO" : "CONCEPTO"}</span>
                      <span style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                        <span title={l.item} style={{ color: C.neg, fontWeight: 600, lineHeight: 1.2, overflowWrap: "anywhere" }}>{l.item}</span>
                        <span title={l.reparto ? txtReparto(l) : undefined} style={{ color: l.reparto ? "#2a88ad" : "#aaa", fontWeight: 400, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[esIns && l.conc, l.reparto ? "⇄ " + txtReparto(l) : (l.pdvDest || pdvActual || PDVS[0])].filter(Boolean).join(" · ")}</span>
                      </span>
                    </span>
                    <span style={celda}>{!esIns ? <span style={{ color: "#ddd" }}>—</span>
                      : fEnv ? <span title={`${l.cant} envases ${med} de ${fEnv} ${medBase}`}>{l.cant} × {med}<span style={{ ...chica, color: "#999" }}>= {fmtNum(Math.round(cantN * fEnv * 100) / 100)} {medBase}</span></span>
                      : `${l.cant} ${med}`}</span>
                    <span style={celda}>{!esIns ? <span style={{ color: "#ddd" }}>—</span> : <Imp v={parseImp(l.unit)} max={15} />}
                      {txtDesc && <span title={`Bruto ${$fmt(brutoDe(l))} − ${$fmt(desc)}`} style={{ ...chica, color: C.verde, fontWeight: 600 }}>{txtDesc}</span>}</span>
                    <span style={celda}><Imp v={neto} max={16} /></span>
                    <span style={{ ...celda, color: iiU > 0 ? C.ii : "#ddd" }}>{iiU > 0 ? <Imp v={iiU} max={14} /> : "—"}</span>
                    <span style={{ ...celda, color: ii > 0 ? C.ii : "#ddd" }}>{ii > 0 ? <Imp v={ii} max={14} /> : "—"}</span>
                    <span style={celda}>{fmtNum(l.alic)}%</span>
                    <span style={celda}>{esIns ? <Imp v={ivaUnit} sufijo={fEnv ? " /" + med : " /u"} max={15} /> : <Imp v={ivaLinea} max={15} />}</span>
                    <span style={{ ...celda, color: C.neg }}>{esIns && neto === 0 ? (descExcede(l) ? <span style={{ color: C.rojo, fontWeight: 700 }}>—</span> : <Bonif />) : <Imp v={subtotal} strong max={16} />}
                      {final > 0 && <span style={{ ...chica, color: "#64748b" }}>{$fmt(final)} /{med || "u"} final</span>}</span>
                    <span style={{ display: soloVer ? "none" : "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                      {/* registro precargado (repetir factura): el ⚠ reemplaza al lápiz, hacen lo mismo (abrir para revisar) */}
                      {l.precargada
                        ? <span title="Importe copiado de la última factura — tocá para abrir el registro y revisarlo"
                            onClick={() => abrirLinea(i)}
                            style={{ cursor: "pointer", fontSize: 13, color: "#d99a1f", fontWeight: 700 }}>⚠</span>
                        : <span onClick={() => abrirLinea(i)} title="Editar" style={{ cursor: "pointer", color: C.gris }}>✎</span>}
                      <span onClick={() => setLineas((ls) => ls.filter((_, ix) => ix !== i))} title="Eliminar" style={{ cursor: "pointer", color: C.gris }}>×</span>
                    </span>
                  </div>
                  {(avisoUI || sinConcUI) && <div style={{ borderBottom: "1px solid #f2f2f0", paddingBottom: 6 }}>{avisoUI}{sinConcUI}</div>}
                  </React.Fragment>
                );
                // ── Registro en edición ──
                const marcoAviso = aviso ? { border: `2px solid ${aviso.nivel === "rojo" ? C.rojo : C.nar}` } : {};
                const campo = { ...inp, padding: "8px 6px", textAlign: "center" };
                const campoII = { ...campo, border: `1px solid ${C.iiBorde}`, color: C.ii, fontWeight: 600 };
                const modoDesc = l.descModo || (l.descTipo === "%" && l.desc ? "%" : "$"); // por importe de entrada (Diego 06/11/2026)
                const dTxt = l.desc || "";
                const dNum = parseImp(dTxt);
                // Los dos campos del descuento muestran el mismo descuento: en % el mismo número; en $, por unidad y total.
                const descUnitTxt = modoDesc === "%" ? dTxt : l.descTipo === "u" ? dTxt : dNum > 0 && cantN > 0 ? fmtNum(Math.round(dNum / cantN * 100) / 100) : "";
                const descTotTxt = modoDesc === "%" ? dTxt : l.descTipo === "t" ? dTxt : dNum > 0 && cantN > 0 ? fmtNum(Math.round(dNum * cantN * 100) / 100) : "";
                const excede = descExcede(l);
                const estDesc = excede ? { border: `1.6px solid ${C.rojo}`, color: C.rojo, fontWeight: 600 } : desc > 0 ? { border: `1.6px solid ${C.verde}`, color: C.verde, fontWeight: 600 } : {};
                const quedaTxt = (v) => (v > 0.004 ? $fmt(v) : "$ 0,00");
                const setDesc = (v, tipo, ev) => setLineas((ls) => ls.map((x, ix) => ix !== i ? x : { ...x, desc: fmtImp(v, ev), descTipo: tipo, descModo: modoDesc, descSug: false, tocado: true }));
                const iiUTxt = l.iiu !== undefined ? l.iiu : iiU > 0 ? fmtNum(Math.round(iiU * 100) / 100) : "";
                const miIns = esIns ? MAESTRO_INSUMOS.find((x) => x.nombre === l.item) : null;
                const iiSug = miIns && miIns.ii > 0 ? miIns.ii * (fEnv || 1) : 0;
                const chip = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, border: `1px solid ${C.borde}`, borderRadius: 15, padding: "0 4px 0 11px", background: "#fff", fontSize: 12, color: "#666", whiteSpace: "nowrap" };
                return (
                  <div key={llave} {...dnd} style={{ background: "#fbfbfa", border: `1px solid ${C.borde}`, borderRadius: 10, padding: "10px 0 8px", margin: "0 0 8px", ...marcaDrop }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID_LIN, gap: 8, alignItems: "center", padding: "0 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, gridColumn: esIns ? "auto" : "1 / span 3", paddingLeft: 8, minWidth: 0 }}>
                        <span style={{ display: "inline-flex", flexDirection: "column", border: `1px solid ${C.borde}`, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
                          {[["concepto", "CONC."], ["insumo", "INSUMO"]].map(([k, t]) => (
                            <span key={k} title={"Pasar la línea a " + k}
                              onClick={() => { if (l.tipo === k) return; setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, tipo: k, item: "", neto: "", cant: "", unit: "", ntot: "", desc: "", iiu: undefined, impint: "", conc: "", pdvDest: pdvActual || PDVS[0] } : x)); }}
                              style={{ padding: "2px 7px", fontSize: 8.5, fontWeight: 700, cursor: "pointer", background: l.tipo === k ? (k === "insumo" ? C.cel : "#111") : "#fff", color: l.tipo === k ? "#fff" : "#999", textAlign: "center" }}>{t}</span>
                          ))}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Combo opciones={esIns ? MAESTRO_INSUMOS.map((x) => x.nombre) : conceptosDe(null)} valor={l.item} autoFocus={l.foco !== false && l.foco !== "neto"}
                            placeholder={esIns ? "Buscar insumo..." : "Buscar concepto..."}
                            crearPrimero={esIns ? "insumo" : "concepto"} onCrear={(n) => abrirAltaItem(i, esIns ? "insumo" : "concepto", "item", n)}
                            onElegir={(v) => {
                              const mi = esIns ? MAESTRO_INSUMOS.find((x) => x.nombre === v) : null;
                              const ult = mi && mi.unit ? { unit: fmtNum(Math.round(mi.unit * 100) / 100) } : null;
                              const regla = reglaDeItem(l, v);
                              const rep = regla ? regla.map((r) => ({ ...r })) : undefined;
                              // El II de la última compra se sugiere igual que el precio (Diego 06/11/2026).
                              const iiu = mi && mi.ii > 0 ? fmtNum(Math.round(mi.ii * 100) / 100) : undefined;
                              // El último descuento de este proveedor en este insumo se sugiere (Diego 06/11/2026).
                              const prv = provPorNombre[prov];
                              const dRec = mi && prv ? (maestros.descuentos || []).find((d) => d.p === prv.id && String(d.k) === String(mi.codigo)) : null;
                              const dSug = dRec ? { desc: fmtNum(dRec.valor), descTipo: dRec.tipo, descModo: dRec.tipo === "%" ? "%" : "$", descSug: true } : { desc: "", descSug: false };
                              setLineas((ls) => ls.map((x, ix) => ix !== i ? x : (esIns
                                ? { ...x, item: v, medida: undefined, ...dSug, reparto: rep, conc: conceptoDeInsumo(v) || "", unit: ult ? ult.unit : "", ntot: "", alic: mi && mi.alic != null ? mi.alic : x.alic, iiu, impint: "" }
                                : { ...x, item: v, reparto: rep, alic: (recDe("concepto", codConcepto(v)) || {}).alic ?? x.alic })));
                            }} />
                        </div>
                      </div>
                      {esIns ? (
                        <div style={{ display: "flex", height: 38, border: "1px solid #ccc", borderRadius: 9, background: "#fff", overflow: "hidden" }}>
                          <input style={{ flex: 1, minWidth: 0, border: "none", outline: "none", textAlign: "center", fontSize: 13.5, background: "transparent" }} placeholder="0" value={l.cant} autoFocus={l.foco === "neto"}
                            onBlur={() => { if (!l.tocado) setLinea(i, "tocado", true); }}
                            onChange={(e) => {
                              const cant = soloNum(e.target.value); const c = parseFloat(cant) || 0;
                              setLineas((ls) => ls.map((x, ix) => {
                                if (ix !== i) return x;
                                let y = { ...x, cant };
                                if (parseImp(x.unit) > 0) y.ntot = c > 0 ? fmtNum(c * parseImp(x.unit)) : x.ntot;
                                else if (parseImp(x.ntot) > 0 && c > 0) y.unit = fmtNum(parseImp(x.ntot) / c);
                                // II por unidad cargado: el total del registro acompaña la cantidad.
                                const iu = parseImp(x.iiu !== undefined ? x.iiu : "");
                                if (iu > 0) y.impint = c > 0 ? fmtNum(Math.round(iu * c * 100) / 100) : "";
                                return y;
                              }));
                            }} />
                          {(() => {
                            // Unidad o envase de la línea: los del maestro de MaxiRest (X6, Pack…). Al cambiarlo, el
                            // unitario y el II por unidad pasan a ser por esa medida.
                            const ins = miIns;
                            const envs = (ins && ins.envases) || [];
                            const caja = { display: "flex", alignItems: "center", padding: "0 7px", borderLeft: `1px solid ${C.borde}`, background: "#f6fbfe", color: C.cel, fontWeight: 700, fontSize: 11, flexShrink: 0 };
                            if (!ins) return <span style={{ ...caja, color: C.gris, background: "#fafaf8" }}>{med || "—"}</span>;
                            const opciones = [{ envase: ins.medida || "", factor: 1 }, ...envs.filter((e) => e.envase.trim().toUpperCase() !== String(ins.medida || "").trim().toUpperCase())];
                            const cambiarA = (nueva, fNuevo) => setLineas((ls) => ls.map((x, ix) => {
                              if (ix !== i) return x;
                              const fViejo = medidaLinea(x).factor || 1;
                              const u = parseImp(x.unit); const c = parseFloat(x.cant) || 0;
                              const unit = u > 0 ? fmtNum(Math.round(u * fNuevo / fViejo * 100) / 100) : x.unit;
                              const iu = parseImp(x.iiu !== undefined ? x.iiu : "");
                              const iiu = iu > 0 ? fmtNum(Math.round(iu * fNuevo / fViejo * 100) / 100) : x.iiu;
                              return { ...x, medida: nueva, unit, ntot: u > 0 && c > 0 ? fmtNum(Math.round(c * parseImp(unit) * 100) / 100) : x.ntot,
                                iiu, impint: iu > 0 && c > 0 ? fmtNum(Math.round(c * parseImp(iiu) * 100) / 100) : x.impint };
                            }));
                            return (
                              <select value={med} title={opciones.map((o) => o.factor === 1 ? `${o.envase}: unidad del insumo` : `${o.envase} = ${fmtNum(o.factor)} ${ins.medida}`).join("\n")}
                                onChange={(e) => {
                                  const nueva = e.target.value;
                                  // «Crear …» primero (regla del sistema) y al final editar los envases del insumo.
                                  if (nueva === "__nuevo" || nueva === "__editar") { setEnvPanel({ i, modo: nueva === "__nuevo" ? "nuevo" : "editar" }); return; }
                                  cambiarA(nueva, (opciones.find((o) => o.envase === nueva) || {}).factor || 1);
                                }}
                                style={{ ...caja, appearance: "none", WebkitAppearance: "none", MozAppearance: "none", border: "none", borderLeft: `1px solid ${C.borde}`, cursor: "pointer", outline: "none", maxWidth: 52, textAlign: "center", textAlignLast: "center" }}>
                                <option value="__nuevo">+ Nuevo envase…</option>
                                {opciones.map((o) => <option key={o.envase} value={o.envase}>{o.envase}</option>)}
                                <option value="__editar">✎ Editar envases</option>
                              </select>
                            );
                          })()}
                        </div>
                      ) : null}
                      {esIns
                        ? <input style={{ ...campo, ...marcoAviso }} placeholder="Unit. $" value={l.unit} title={l.unit ? "$ " + l.unit : undefined}
                            onBlur={() => { if (!l.tocado) setLinea(i, "tocado", true); }}
                            onChange={(e) => {
                              const unit = fmtImp(e.target.value, e.nativeEvent); const u = parseImp(unit); const c = parseFloat(l.cant) || 0;
                              setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, unit, ntot: c > 0 && u > 0 ? fmtNum(c * u) : "" } : x));
                            }} />
                        : null}
                      {esIns
                        ? <input style={{ ...campo, ...marcoAviso }} placeholder="Total $" value={l.ntot || ""}
                            onBlur={() => { if (!l.tocado) setLinea(i, "tocado", true); }}
                            title="Total neto de la línea: con la cantidad puesta, el unitario se calcula solo"
                            onChange={(e) => {
                              const ntot = fmtImp(e.target.value, e.nativeEvent); const t = parseImp(ntot); const c = parseFloat(l.cant) || 0;
                              setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, ntot, unit: c > 0 && t > 0 ? fmtNum(t / c) : x.unit } : x));
                            }} />
                        : <input style={{ ...campo, ...marcoAviso }} placeholder="Neto $" value={l.neto} autoFocus={l.foco === "neto"} title={l.neto ? "$ " + l.neto : undefined} onChange={(e) => setLinea(i, "neto", fmtImp(e.target.value, e.nativeEvent))}
                            onBlur={() => { if (!l.tocado) setLinea(i, "tocado", true); }} />}
                      {/* Impuestos internos: por unidad ⇄ total del registro (los proveedores lo pasan de las dos formas). */}
                      {esIns
                        ? <input style={campoII} placeholder="0" value={iiUTxt} title="Impuesto interno por unidad (por envase si la cantidad va en envases)"
                            onChange={(e) => {
                              const iiu = fmtImp(e.target.value, e.nativeEvent); const v = parseImp(iiu); const c = parseFloat(l.cant) || 0;
                              setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, iiu, impint: v > 0 && c > 0 ? fmtNum(Math.round(v * c * 100) / 100) : "" } : x));
                            }} />
                        : <span />}
                      <input style={campoII} placeholder="0" value={l.impint || ""} title="Impuesto interno total del registro"
                        onChange={(e) => {
                          const impint = fmtImp(e.target.value, e.nativeEvent); const t = parseImp(impint); const c = parseFloat(l.cant) || 0;
                          setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, impint, iiu: esIns && t > 0 && c > 0 ? fmtNum(Math.round(t / c * 100) / 100) : esIns ? "" : undefined } : x));
                        }} />
                      <select style={{ ...sel, padding: "8px 18px 8px 4px", backgroundPosition: "right 5px center", textAlign: "center", textAlignLast: "center" }} value={l.alic} onChange={(e) => setLinea(i, "alic", parseFloat(e.target.value))}>
                        {ALICUOTAS.map((a) => <option key={a} value={a}>{fmtNum(a)}%</option>)}
                      </select>
                      <span style={{ fontSize: 12.5, ...celda }}>{neto > 0 ? (esIns ? <Imp v={ivaUnit} sufijo={fEnv ? " /" + med : " /u"} max={15} /> : <Imp v={ivaLinea} max={15} />) : ""}</span>
                      <span style={{ fontSize: 12.5, ...celda, color: C.neg }}>{neto > 0 ? <Imp v={subtotal} strong max={16} /> : excede ? <span style={{ color: C.rojo, fontWeight: 700 }}>—</span> : esIns && cantN > 0 && l.item ? <Bonif /> : ""}
                        {final > 0 && <span style={{ ...chica, color: "#64748b" }}>{$fmt(final)} /{med || "u"} final</span>}</span>
                      <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button type="button" onClick={() => {
                          if (faltaDe(l)) return;
                          // Si quedan registros precargados sin revisar, se abre el siguiente con el foco en el importe.
                          const j = lineas.findIndex((x, ix) => ix > i && x.precargada);
                          setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, editando: false } : ix === j ? { ...x, editando: true, precargada: false, foco: "neto" } : x));
                          if (j < 0) setTimeout(() => agregarRef.current && agregarRef.current.focus(), 40);
                        }} title={faltaDe(l) || "Confirmar (Enter)"}
                          style={{ cursor: "pointer", fontWeight: 700, color: !faltaDe(l) ? C.verde : "#ccc", fontSize: 16, background: "none", border: "none", padding: 0 }}>✓</button>
                        <button type="button" onClick={() => setLineas((ls) => ls.filter((_, ix) => ix !== i))} title="Eliminar" style={{ cursor: "pointer", color: C.gris, background: "none", border: "none", padding: 0, fontSize: 14 }}>×</button>
                      </span>
                    </div>
                    {(avisoUI || sinConcUI) && <div style={{ padding: "0 8px" }}>{avisoUI}{sinConcUI}</div>}
                    {/* Segunda fila: descuento (insumo) debajo de unitario y total, II sugerido, y chips a la derecha. */}
                    <div style={{ display: "grid", gridTemplateColumns: GRID_LIN, gap: 8, alignItems: "start", marginTop: 6 }}>
                      {esIns ? (<>
                        <div />
                        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end", height: 30 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.verde }}>DESC.</span>
                          <span style={{ display: "inline-flex", border: `1px solid ${C.borde}`, borderRadius: 7, overflow: "hidden", height: 28, boxSizing: "border-box" }}>
                            {[["%", "%"], ["$", "$"]].map(([k, t]) => (
                              <span key={k} role="button" title={k === "%" ? "Descuento en porcentaje" : "Descuento en pesos: por unidad o sobre el total"}
                                onClick={() => { if (modoDesc !== k) setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, descModo: k, desc: "", descTipo: k === "%" ? "%" : "u" } : x)); }}
                                style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: modoDesc === k ? "#111" : "#fff", color: modoDesc === k ? "#fff" : "#888" }}>{t}</span>
                            ))}
                          </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <input style={{ ...inp, ...chico, textAlign: "center", ...estDesc }} placeholder="0"
                            value={descUnitTxt} title={modoDesc === "%" ? "Descuento %" : "Descuento en $ por unidad"}
                            onChange={(e) => setDesc(e.target.value, modoDesc === "%" ? "%" : "u", e.nativeEvent)} />
                          {excede ? <span style={{ ...chica, textAlign: "center", color: C.rojo, fontWeight: 700, marginTop: 2 }}>excede el unitario</span>
                            : desc > 0 && cantN > 0 && <span style={{ ...chica, textAlign: "center", color: C.verde, marginTop: 2 }}>queda {quedaTxt((brutoDe(l) - desc) / cantN)}{brutoDe(l) - desc > 0.004 ? ` /${med || "u"}` : ""}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <input style={{ ...inp, ...chico, textAlign: "center", ...estDesc }} placeholder="0"
                            value={descTotTxt} title={modoDesc === "%" ? "Descuento %" : "Descuento en $ sobre el total del registro"}
                            onChange={(e) => setDesc(e.target.value, modoDesc === "%" ? "%" : "t", e.nativeEvent)} />
                          {excede ? <span style={{ ...chica, textAlign: "center", color: C.rojo, fontWeight: 700, marginTop: 2 }}>excede el neto</span>
                            : desc > 0 && <span style={{ ...chica, textAlign: "center", color: C.verde, marginTop: 2 }}>queda {quedaTxt(brutoDe(l) - desc)}{brutoDe(l) - desc > 0.004 ? " neto" : ""}</span>}
                          {l.descSug && desc > 0 && <span style={{ ...chica, textAlign: "center", color: "#64748b" }}>el de la última compra</span>}
                        </div>
                        <div style={{ gridColumn: "5 / span 2", fontSize: 10.5, color: C.ii, textAlign: "center", lineHeight: 1.35, paddingTop: 2, minWidth: 0 }}>
                          {iiSug > 0 && !(ii > 0) ? <span role="button" title="Usar el II de la última compra" style={{ cursor: "pointer" }}
                            onClick={() => setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, iiu: fmtNum(Math.round(iiSug * 100) / 100), impint: cantN > 0 ? fmtNum(Math.round(iiSug * cantN * 100) / 100) : "" } : x))}>
                            la última vez {$fmt(iiSug)} /{med || "u"} · usar</span> : iiSug > 0 ? <span style={{ color: "#94a3b8" }}>la última vez {$fmt(iiSug)} /{med || "u"}</span> : null}
                        </div>
                      </>) : <div style={{ gridColumn: "1 / span 6" }} />}
                      <div style={{ gridColumn: "7 / span 4", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "flex-start", paddingRight: 8, minWidth: 0 }}>
                        {esIns && (
                          <span style={{ ...chip, ...(l.conc ? {} : { borderColor: C.nar, background: "#fdf8ef" }) }}>Caja
                            <span style={{ width: 150 }}><Combo opciones={conceptosDe(null)} valor={l.conc} placeholder="Concepto…" crearPrimero="concepto" onCrear={(n) => abrirAltaItem(i, "concepto", "conc", n)}
                              estilo={{ height: 24, fontSize: 12, fontWeight: 600, border: "none", background: "transparent", padding: "2px 6px 2px 24px" }}
                              onElegir={(v) => {
                                // cambia el concepto: el reparto precargado pasa a ser el de la regla del concepto nuevo
                                const regla = reglaDe(codConcepto(v), PDVS, fecha);
                                setLineas((ls) => ls.map((x, ix) => ix !== i ? x : { ...x, conc: v, reparto: regla ? regla.map((r) => ({ ...r })) : (x.reparto && !reglaDeItem(x, x.item) ? x.reparto : undefined) }));
                              }} /></span>
                          </span>
                        )}
                        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          {!l.reparto && !variosPdv
                            ? <span style={{ ...chip, fontWeight: 700, color: C.neg }}><span style={{ fontWeight: 600, color: C.gris }}>PDV</span>{PDVS[0]}</span>
                            : !l.reparto
                            ? <span style={chip}>PDV
                                <select style={{ height: 26, border: "none", background: "transparent", fontSize: 12, fontWeight: 700, color: C.neg, cursor: "pointer", outline: "none", maxWidth: 170 }}
                                  value={l.pdvDest || pdvActual || PDVS[0]} onChange={(e) => setLinea(i, "pdvDest", e.target.value)}>
                                  {PDVS.map((p) => <option key={p}>{p}</option>)}
                                </select></span>
                            : <span style={{ ...chip, borderColor: "#bfe0f0", background: "#f3fafd", color: "#2a88ad", fontWeight: 600, paddingRight: 11, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>⇄ {txtReparto(l) || "repartido"}</span>}
                          {!variosPdv ? null : !l.reparto
                            ? <span role="button" onClick={() => setLinea(i, "reparto", [{ pdv: l.pdvDest || pdvActual || PDVS[0], pct: 100 }, { pdv: PDVS.find((p) => p !== (l.pdvDest || pdvActual || PDVS[0])) || PDVS[1], pct: 0 }])}
                                title="Repartir este registro entre varios PDV por porcentaje" style={{ fontSize: 11, color: C.cel, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginRight: 6 }}>⇄ repartir entre PDV</span>
                            : <span role="button" onClick={() => setLineas((ls) => ls.map((x, ix) => ix === i ? { ...x, reparto: undefined, pdvDest: l.reparto[0].pdv } : x))}
                                title="Volver a un solo PDV" style={{ fontSize: 11, color: C.gris, cursor: "pointer", whiteSpace: "nowrap", marginRight: 6 }}>un solo PDV</span>}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: "0 8px" }}>
                    {envPanel && envPanel.i === i && miIns && (
                      <div style={{ marginTop: 8 }}>
                        <EnvasesEditor codigo={String(miIns.codigo)} nombre={miIns.nombre} medida={miIns.medida} envases={miIns.envases || []}
                          soloAlta={envPanel.modo === "nuevo"} onCerrar={() => setEnvPanel(null)}
                          onCambio={(c) => {
                            const cod = String(miIns.codigo);
                            setEnvCambios((m) => ({ ...m, [cod]: [...(m[cod] || []), c] }));
                            qcMaestros.invalidateQueries({ queryKey: ["gestionMaestrosFactura"] });
                            if (envPanel.modo === "nuevo" && c.tipo === "alta") {
                              // El envase nuevo queda elegido en la línea, con el unitario pasado a esa medida.
                              setLineas((ls) => ls.map((x, ix) => {
                                if (ix !== i) return x;
                                const fViejo = medidaLinea(x).factor || 1;
                                const u = parseImp(x.unit); const cc = parseFloat(x.cant) || 0;
                                const unit = u > 0 ? fmtNum(Math.round(u * c.factor / fViejo * 100) / 100) : x.unit;
                                return { ...x, medida: c.envase, unit, ntot: u > 0 && cc > 0 ? fmtNum(Math.round(cc * parseImp(unit) * 100) / 100) : x.ntot };
                              }));
                              setEnvPanel(null);
                            }
                          }} />
                      </div>
                    )}
                    {altaItem && altaItem.i === i && (() => {
                      const a = altaItem;
                      const set = (k, v) => setAltaItem((x) => ({ ...x, [k]: v }));
                      const enter = (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!creandoItem) crearItem(); } };
                      return (
                        <div style={{ marginTop: 8, border: `1.5px solid ${C.cel}`, borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{a.tipo === "insumo" ? "Nuevo insumo" : a.destino === "conc" ? "Nuevo concepto de caja" : "Nuevo concepto"}
                            <span style={{ fontWeight: 400, color: C.gris, marginLeft: 8 }}>{a.tipo === "insumo" ? "queda en el maestro de insumos (el mismo de Recetas), con código L" : "egreso · código propio desde 1000"}</span></div>
                          <div style={{ display: "grid", gridTemplateColumns: a.tipo === "insumo" ? "1.4fr 130px 1fr auto" : "1.4fr 1fr auto", gap: 8, alignItems: "end" }}>
                            <div><span style={labS}>Nombre</span><input style={{ ...inp, ...chico }} autoFocus value={a.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
                            {a.tipo === "insumo" ? (<>
                              <div><span style={labS}>Unidad</span>
                                <select style={{ ...sel, ...chico, paddingRight: 24 }} value={a.medida} onChange={(e) => set("medida", e.target.value)}>
                                  <option value="">Elegir…</option>
                                  {medidasUsadas.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select></div>
                              <div><span style={labS}>Concepto de caja</span>
                                <Combo opciones={conceptosDe(null)} valor={a.conc} placeholder="Buscar concepto..." estilo={chico} onElegir={(v) => set("conc", v)} /></div>
                            </>) : (
                              <div><span style={labS}>Rubro</span>
                                <select style={{ ...sel, ...chico, paddingRight: 24 }} value={a.codRubro} onChange={(e) => set("codRubro", e.target.value)} onKeyDown={enter}>
                                  <option value="">{rubrosCon ? "Elegir…" : "Cargando…"}</option>
                                  {(rubrosCon || []).map((r) => <option key={r.codigo} value={r.codigo}>{String(r.nombre).trim()}</option>)}
                                </select></div>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" style={{ ...btn(true), padding: "6px 12px", fontSize: 12.5 }} disabled={creandoItem} onClick={crearItem}>{creandoItem ? "Creando…" : "Crear y usar"}</button>
                              <button type="button" style={{ ...btn(false), padding: "6px 12px", fontSize: 12.5 }} onClick={() => setAltaItem(null)}>Cancelar</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {l.reparto && (() => {
                      const tot = l.reparto.reduce((a, x) => a + (parseFloat(x.pct) || 0), 0);
                      const ok = Math.abs(tot - 100) < 0.01;
                      const regla = reglaDeItem(l, l.item);
                      const igualRegla = regla && regla.length === l.reparto.length && regla.every((r, k) => r.pdv === l.reparto[k].pdv && Math.abs(parseFloat(r.pct) - parseFloat(l.reparto[k].pct)) < 0.01);
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, border: `1px solid ${ok ? "#bfe0f0" : "#f0c179"}`, background: ok ? "#f3fafd" : "#fdf8ef", borderRadius: 9, padding: "5px 8px" }}>
                          <span style={{ ...labS, marginBottom: 0 }}>Reparto por PDV</span>
                          {l.reparto.map((r, k) => (
                            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <select style={{ ...sel, width: 160, height: 28, padding: "3px 22px 3px 6px", fontSize: 12 }} value={r.pdv}
                                onChange={(e) => setLinea(i, "reparto", l.reparto.map((x, kx) => kx === k ? { ...x, pdv: e.target.value } : x))}>
                                {PDVS.filter((p) => p === r.pdv || !l.reparto.some((x) => x.pdv === p)).map((p) => <option key={p}>{p}</option>)}
                              </select>
                              <input style={{ ...inp, width: 54, height: 28, padding: "3px 4px", fontSize: 12, textAlign: "center" }} value={r.pct}
                                onChange={(e) => setLinea(i, "reparto", l.reparto.map((x, kx) => kx === k ? { ...x, pct: soloNum(e.target.value) } : x))} />
                              <span style={{ fontSize: 11, color: "#777" }}>%</span>
                              {l.reparto.length > 2 && <span onClick={() => setLinea(i, "reparto", l.reparto.filter((_, kx) => kx !== k))} style={{ cursor: "pointer", color: C.gris, fontSize: 13 }}>×</span>}
                            </span>
                          ))}
                          {l.reparto.length < PDVS.length && <span onClick={() => setLinea(i, "reparto", [...l.reparto, { pdv: PDVS.find((p) => !l.reparto.some((x) => x.pdv === p)) || PDVS[0], pct: 0 }])} style={{ fontSize: 12, color: C.cel, fontWeight: 700, cursor: "pointer" }}>+ PDV</span>}
                          <span style={{ fontSize: 11, fontWeight: 700, color: ok ? C.verde : C.nar }}>{ok ? "= 100%" : `suma ${fmtNum(tot)}%`}</span>
                          {regla && igualRegla && <span title="Este reparto es la regla guardada para este concepto/insumo" style={{ fontSize: 10, fontWeight: 700, color: "#2a88ad", background: "#e7f3fa", borderRadius: 5, padding: "1px 6px" }}>REGLA</span>}
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                );
              })}
              {(() => {
                const enEd = lineas.find((l) => l.editando);
                const falta = enEd ? faltaDe(enEd) : null;
                const confirmable = !falta;
                return (
              <div style={{ display: soloVer ? "none" : "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                <button ref={agregarRef} title={!confirmable ? `${falta} para agregar otro registro` : enEd ? "Confirmar este registro y agregar otro" : "Agregar registro"}
                  disabled={!confirmable}
                  onClick={() => { if (confirmable) setLineas((ls) => {
                    // el registro nuevo nace con el mismo tipo que el ultimo cargado (venis cargando insumos -> insumo).
                    // Va PRIMERO, pegado a los títulos de las columnas (Diego 05/11/2026).
                    const ult = ls[0];
                    return [{ tipo: ult ? ult.tipo : tipoDefault(prov), item: "", neto: "", cant: "", unit: "", alic: ult ? ult.alic : 21, conc: "", pdvDest: (ult && ult.pdvDest) || pdvActual || PDVS[0], editando: true }, ...ls.map((x) => ({ ...x, editando: false }))];
                  }); }}
                  style={{ width: 30, height: 30, borderRadius: 15, border: `1.5px solid ${C.borde}`, background: "#fff", fontSize: 18, fontWeight: 700, color: "#444", cursor: !confirmable ? "not-allowed" : "pointer", opacity: !confirmable ? 0.35 : 1, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>+</button>
                {!confirmable && <span style={{ fontSize: 11.5, color: "#999" }}>{falta} para agregar otro registro</span>}
              </div>
                );
              })()}
            <div style={{ marginTop: 14, marginBottom: 10 }}>
              <span style={lab}>Percepciones</span>
              {percepciones.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 24px", gap: 8, alignItems: "center", marginBottom: 8, maxWidth: 620 }}>
                  <select style={sel} value={p.tipo} onChange={(e) => setPercepciones((ps) => ps.map((x, ix) => ix === i ? { ...x, tipo: e.target.value } : x))}>
                    {TIPOS_PERCEPCION.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input style={inp} placeholder="Importe $" value={p.importe} onChange={(e) => setPercepciones((ps) => ps.map((x, ix) => ix === i ? { ...x, importe: fmtImp(e.target.value, e.nativeEvent) } : x))} />
                  <span onClick={() => setPercepciones((ps) => ps.filter((_, ix) => ix !== i))} style={{ color: C.gris, cursor: "pointer", textAlign: "center", visibility: soloVer ? "hidden" : "visible" }}>×</span>
                </div>
              ))}
              {!soloVer && <button style={btn(false)} onClick={() => setPercepciones((ps) => [...ps, { tipo: TIPOS_PERCEPCION[0], importe: "" }])}>+ Agregar percepción</button>}
              {soloVer && percepciones.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>—</div>}
            </div>

            {/* Totales de la factura alineados a las columnas, fijos abajo del cuerpo (Diego 06/11/2026). */}
            <div style={{ display: "grid", gridTemplateColumns: GRID_LIN, gap: 8, alignItems: "center", position: "sticky", bottom: 0, zIndex: 5, background: C.fondo, borderTop: `1px solid ${C.borde}`, margin: "0 -14px", padding: "9px 14px", fontSize: 13 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.gris, letterSpacing: 0.4 }}>TOTALES DE LA FACTURA</span>
              <span /><span />
              <span style={{ textAlign: "center" }}><Imp v={netoTotal} strong max={16} /><span style={{ display: "block", fontSize: 10.5, color: C.gris }}>neto{fracG > 0 ? " c/desc." : ""}</span></span>
              <span />
              <span style={{ minWidth: 0 }}>
                <input style={{ ...inp, ...chico, textAlign: "center", border: `1px solid ${C.iiBorde}`, color: C.ii, fontWeight: 700 }} disabled={soloVer}
                  title="Suma del II de los registros. Si el proveedor lo pasa solo por factura, cargalo acá y se reparte entre los registros."
                  value={iiPieTxt !== null ? iiPieTxt : impIntTotal > 0 ? fmtNum(Math.round(impIntTotal * 100) / 100) : ""} placeholder="0"
                  onFocus={(e) => { setIiPieTxt(impIntTotal > 0 ? fmtNum(Math.round(impIntTotal * 100) / 100) : ""); setTimeout(() => e.target.select && e.target.select(), 0); }}
                  onChange={(e) => setIiPieTxt(fmtImp(e.target.value, e.nativeEvent))}
                  onBlur={() => { repartirII(parseImp(iiPieTxt || "")); setIiPieTxt(null); }} />
                <span style={{ display: "block", fontSize: 10, color: C.gris, textAlign: "center" }}>imp. internos</span>
              </span>
              <span />
              <span style={{ textAlign: "center" }}><Imp v={ivaTotal} strong max={15} /><span style={{ display: "block", fontSize: 10.5, color: C.gris }}>IVA</span></span>
              <span style={{ textAlign: "center" }}><Imp v={totalFactura} strong max={16} /><span style={{ display: "block", fontSize: 10.5, color: C.gris }}>TOTAL{percTotal > 0 ? ` · incl. percep. ${$fmt(percTotal)}` : ""}</span></span>
              <span />
            </div>
            </div>

            </>)}

          </>
        ) : (
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 14, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* El período está arriba, en la barra del título (mismo lugar en las 3 pestañas, Diego 06/11/2026). */}
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ width: 150 }}><span style={lab}>Fecha del gasto</span>
                <FechaInput tabIndex={-1} style={{ ...inp, color: fechaV === fechaDelPeriodo(periodoV) ? C.gris : C.neg, border: errFecha ? `1.6px solid ${C.rojo}` : inp.border }} iso={fechaV}
                  onISO={(v) => { setFechaV(v); setErrFecha(false); }} /></div>
              <span style={{ fontSize: 11.5, color: C.gris, paddingBottom: 10 }}>va al 15, cambiala si querés</span>
              {errFecha && <div style={{ fontSize: 11, color: C.rojo, fontWeight: 700, paddingBottom: 10 }}>Falta una fecha válida.</div>}
            </div>
            {/* Primero el concepto (el rubro se completa solo), después el rubro (Diego, 28/10/2026). */}
            <div><span style={lab}>Concepto</span>
              <Combo opciones={conceptosDe(rubroV)} valor={conceptoV} autoFocus={!vieneConImporte && !conceptoV} placeholder="Buscar concepto..." onElegir={(c) => { setConceptoV(c); setRubroV(rubroDe(c) || rubroV); }} /></div>
            <div><span style={lab}>Rubro</span>
              <Combo opciones={rubros} valor={rubroV} placeholder="Buscar rubro..." onElegir={(r) => { setRubroV(r); if (rubroDe(conceptoV) !== r) setConceptoV(""); }} /></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Detalle</span>
              <input style={inp} value={detalle} maxLength={200} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej: ferretería, flete, devolución seña cancha" /></div>
            <div><span style={lab}>Importe{importeRevisar && <span style={{ textTransform: "none", fontWeight: 700, letterSpacing: 0, color: "#b45309" }}> · el de {nombrePeriodo(ctx.importeAnterior)}, corregilo</span>}</span>
              <input style={{ ...inp, textAlign: "right", fontWeight: 700, ...(importeRevisar ? { border: "1.6px solid #f59e0b", background: "#fffbeb" } : {}) }} value={importeV} placeholder="0,00"
                autoFocus={vieneConImporte} onFocus={(e) => e.target.select()}
                onChange={(e) => { setImporteV(fmtImp(e.target.value, e.nativeEvent)); setImporteRevisar(false); }} onBlur={() => setTocadoV(true)} />
              {tocadoV && (() => { const av = avisoVario(); return av ? <AvisoLinea a={av} onCorregir={() => setImporteV(fmtNum(av.sugerido))} onAceptar={() => setImporteOkV(importeV)} /> : null; })()}</div>
            <div><span style={{ ...lab, display: "flex", justifyContent: "space-between" }}>PDV del gasto
                {variosPdv && (repartoV
                  ? <span role="button" onClick={() => setRepartoV(undefined)} style={{ textTransform: "none", letterSpacing: 0, color: C.gris, fontWeight: 600, cursor: "pointer" }}>un solo PDV</span>
                  : <span role="button" onClick={() => setRepartoV([{ pdv: pdvV, pct: 100 }, { pdv: PDVS.find((x) => x !== pdvV), pct: 0 }])} style={{ textTransform: "none", letterSpacing: 0, color: C.cel, fontWeight: 700, cursor: "pointer" }}>⇄ repartir entre PDV</span>)}</span>
              {repartoV
                ? <div style={{ ...inp, display: "flex", alignItems: "center", color: "#2a88ad", fontWeight: 600, background: "#f3fafd", borderColor: "#bfe0f0" }}>⇄ {txtReparto({ reparto: repartoV }) || "repartido"}</div>
                : variosPdv ? <select style={sel} value={pdvV} onChange={(e) => setPdvV(e.target.value)}>{PDVS.map((p) => <option key={p}>{p}</option>)}</select>
                : <div style={{ ...inp, display: "flex", alignItems: "center", fontWeight: 600 }}>{PDVS[0]}</div>}</div>
            {repartoV && (() => {
              const tot = repartoV.reduce((a, x) => a + (parseFloat(x.pct) || 0), 0);
              const ok = Math.abs(tot - 100) < 0.01;
              const regV = reglaV(conceptoV);
              const igual = regV && regV.length === repartoV.length && regV.every((r, k) => r.pdv === repartoV[k].pdv && Math.abs(parseFloat(r.pct) - parseFloat(repartoV[k].pct)) < 0.01);
              const imp = parseImp(importeV);
              return (
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: `1px solid ${ok ? "#bfe0f0" : "#f0c179"}`, background: ok ? "#f3fafd" : "#fdf8ef", borderRadius: 9, padding: "6px 10px" }}>
                  <span style={{ ...lab, marginBottom: 0 }}>Reparto por PDV</span>
                  {repartoV.map((r, k) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <select style={{ ...sel, width: 160, height: 30, padding: "3px 22px 3px 6px", fontSize: 12 }} value={r.pdv}
                        onChange={(e) => setRepartoV(repartoV.map((x, kx) => kx === k ? { ...x, pdv: e.target.value } : x))}>
                        {PDVS.filter((x) => x === r.pdv || !repartoV.some((y) => y.pdv === x)).map((x) => <option key={x}>{x}</option>)}
                      </select>
                      <input style={{ ...inp, width: 56, height: 30, padding: "3px 4px", fontSize: 12, textAlign: "center" }} value={r.pct}
                        onChange={(e) => setRepartoV(repartoV.map((x, kx) => kx === k ? { ...x, pct: soloNum(e.target.value) } : x))} />
                      <span style={{ fontSize: 11, color: "#777" }}>%{imp > 0 && parseFloat(r.pct) > 0 ? ` · ${$fmt(imp * parseFloat(r.pct) / 100)}` : ""}</span>
                      {repartoV.length > 2 && <span onClick={() => setRepartoV(repartoV.filter((_, kx) => kx !== k))} style={{ cursor: "pointer", color: C.gris, fontSize: 13 }}>×</span>}
                    </span>
                  ))}
                  {repartoV.length < PDVS.length && <span onClick={() => setRepartoV([...repartoV, { pdv: PDVS.find((x) => !repartoV.some((y) => y.pdv === x)), pct: 0 }])} style={{ fontSize: 12, color: C.cel, fontWeight: 700, cursor: "pointer" }}>+ PDV</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: ok ? C.verde : C.nar }}>{ok ? "= 100%" : `suma ${fmtNum(tot)}%`}</span>
                  {igual && <span title="Este reparto es la regla de apertura del concepto" style={{ fontSize: 10, fontWeight: 700, color: "#2a88ad", background: "#e7f3fa", borderRadius: 5, padding: "1px 6px" }}>REGLA</span>}
                </div>
              );
            })()}
          </div>

          {/* ── Pago del gasto: tildado de entrada; sin pago queda IMPAGO (Impagas y cta cte de Gastos Varios) ── */}
          <div style={{ marginTop: 12, border: `1.5px solid ${pagarV ? "#bae6fd" : C.borde}`, background: pagarV ? "#f0f9ff" : "#fff", borderRadius: 11, padding: "10px 14px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" checked={pagarV} onChange={(e) => setPagarV(e.target.checked)} style={{ width: 15, height: 15 }} />
              Pagado
              {!pagarV && <span style={{ fontSize: 12, fontWeight: 400, color: "#999" }}>— queda IMPAGO: aparece en Impagas y lo pagás después desde la cta cte de Gastos Varios</span>}
            </label>
            {pagarV && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr" + (pidePagoId ? " 160px" : ""), gap: 10, marginTop: 10, alignItems: "end" }}>
                <div><span style={lab}>Medio</span>
                  <select style={sel} value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                    {mediosPago.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                  </select></div>
                <div><span style={lab}>Fecha de pago</span>
                  <FechaInput style={inp} iso={fechaPago} onISO={(v) => setFechaPago(v)} /></div>
                <div><span style={lab}>Paga</span>
                  <select style={sel} value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>{PDVS.map((x) => <option key={x}>{x}</option>)}</select></div>
                {pidePagoId && <div><span style={lab}>ID</span>
                  <input style={{ ...inp, fontFamily: "monospace" }} value={refPago} placeholder="opcional"
                    onChange={(e) => setRefPago(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></div>}
              </div>
            )}
          </div>
          </div>
          <HistorialConcepto concepto={conceptoV} codigo={codConcepto(conceptoV)} pdvId={idPdv(pdvV)} pdvNombre={pdvV} periodo={periodoV} onPeriodo={elegirPeriodo}
            onUsar={(f) => {
              // Trae todo lo de la última carga, no solo el importe (Diego 06/11/2026).
              setImporteV(fmtNum(f.importe)); setImporteRevisar(false); setTocadoV(true);
              if (f.detalle) setDetalle(f.detalle);
              if (f.medio && mediosPago.some((m) => m.nombre === f.medio)) { setPagarV(true); setMedioPago(f.medio); }
            }} />
          </div>
        )}

        </fieldset>
        )}
        </div>

        {/* ── Pie fijo: totales, control contra el total, avisos y acciones ── */}
        {modo !== "empleado" && (
          <div style={{ ...bloque, margin: "10px 20px 16px", padding: "10px 14px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 9 }}>
            {/* Los totales van en la tabla (fila de totales alineada a las columnas); acá, el descuento general y el
                control contra el total de la factura. */}
            {modo === "factura" && !soloVer && cuerpoVisible && (
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555" }} title="Descuento general de la factura: se reparte proporcional al neto de cada registro">
                  Desc. general
                  <input style={{ ...inp, height: 28, width: 76, padding: "3px 6px", fontSize: 12.5, textAlign: "center", ...(fracG > 0 ? { border: `1.6px solid ${C.verde}` } : {}) }} placeholder="0"
                    value={descG} onChange={(e) => setDescG(fmtImp(e.target.value, e.nativeEvent))} />
                  <span style={{ display: "inline-flex", border: `1px solid ${C.borde}`, borderRadius: 7, overflow: "hidden", height: 28, boxSizing: "border-box" }}>
                    {[["%", "%"], ["$", "$"]].map(([k, t]) => (
                      <span key={k} role="button" onClick={() => setDescGTipo(k)} style={{ display: "inline-flex", alignItems: "center", padding: "0 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: descGTipo === k ? "#111" : "#fff", color: descGTipo === k ? "#fff" : "#888" }}>{t}</span>))}
                  </span>
                  {fracG > 0 && <b style={{ color: C.verde }}>−{$fmt(descGImporte)}</b>}
                </span>
                {totCtrl > 0 && netoTotal > 0 && (() => {
                  const ok = Math.abs(difCtrl) <= 1;
                  return (
                    <span style={{ fontWeight: 600, color: ok ? C.verde : C.nar }}>
                      {ok ? <>✓ El desglose coincide con el total de la factura ({$fmt(totCtrl)}){Math.abs(difCtrl) >= 0.01 ? ` · dif. ${$fmt(Math.abs(difCtrl))} por redondeo` : ""}</>
                        : <>⚠ El desglose suma {$fmt(totalFactura)} y la factura dice {$fmt(totCtrl)}: {difCtrl < 0 ? `faltan cargar ${$fmt(-difCtrl)}` : `sobran ${$fmt(difCtrl)}`}.</>}
                    </span>
                  );
                })()}
              </div>
            )}
            {modo === "vario" && parecidoV && (
              <div style={{ border: "1.5px solid #f0c179", background: "#fdf8ef", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: "#8a5a00" }}>
                ⚠ Ya hay un gasto <b>parecido</b> en {nombrePeriodo(periodoDe(parecidoV.fecha))}: {dmy(parecidoV.fecha)} · {$fmt(parecidoV.importe)}
                {parecidoV.observac ? ` · ${parecidoV.observac}` : ""} ({parecidoV.origen === "lazarillo" ? "cargado en Lazarillo" : "de MaxiRest"}).
                {" "}¿Es otro gasto? <span onClick={() => guardarVario(true)} style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí, cargarlo igual</span>
                {" · "}<span onClick={() => setParecidoV(null)} style={{ cursor: "pointer", color: C.gris }}>No</span>
              </div>
            )}
            {errores.length > 0 && (
              <div style={{ borderTop: "1px solid #e6e6e2", paddingTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                {errores.map((e, i) => <span key={i} style={{ fontSize: 12.5, fontWeight: 600, color: C.rojo }}>• {e}</span>)}
              </div>
            )}
            {avisosAlGuardar && (
              <div style={{ border: "1.5px solid #f3c4c4", background: "#fdf3f3", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: C.rojo, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 300 }}><b>Revisá antes de guardar:</b>{" "}
                  {avisosAlGuardar.map((x) => x.total
                    ? `el desglose (${$fmt(totalFactura)}) no coincide con el total de la factura (${$fmt(totCtrl)}): dif. ${$fmt(Math.abs(difCtrl))}`
                    : `${x.l.item} ${textoVeces(x.a.ratio)} (${x.a.habitual ? "habitual" : "última"} ${$fmt(x.a.ref)}${x.a.medBase ? " /" + x.a.medBase : ""})`).join(" · ")}</span>
                <button type="button" onClick={() => setAvisosAlGuardar(null)} style={{ ...btn(false), padding: "5px 10px", fontSize: 12 }}>Volver y corregir</button>
                <button type="button" onClick={() => guardar(true)} style={{ ...btn(false), padding: "5px 10px", fontSize: 12, color: C.rojo }}>Guardar igual</button>
              </div>
            )}
            {modo === "factura" && vista === "nueva" && pagarAhora && (
              <div style={{ borderTop: "1px solid #e6e6e2", paddingTop: 9 }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 140px 1fr" + (pidePagoId ? " 160px" : ""), gap: 10, alignItems: "end" }}>
                  <div><span style={lab}>Importe</span>
                    <input style={{ ...inp, textAlign: "right" }} value={importePago} placeholder={fmtNum(Math.round(totalFactura * 100) / 100)}
                      title="Vacío = el total de la factura" onChange={(e) => setImportePago(fmtImp(e.target.value, e.nativeEvent))} /></div>
                  <div><span style={lab}>Medio</span>
                    <select style={sel} value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                      {mediosPago.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select></div>
                  <div><span style={lab}>Fecha de pago</span>
                    <FechaInput style={inp} iso={fechaPago} onISO={(v) => setFechaPago(v)} /></div>
                  <div><span style={lab}>Paga</span>
                    <select style={sel} value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>{PDVS.map((x) => <option key={x}>{x}</option>)}</select></div>
                  {pidePagoId && <div><span style={lab}>ID</span>
                    <input style={{ ...inp, fontFamily: "monospace" }} value={refPago} placeholder="opcional"
                      onChange={(e) => setRefPago(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></div>}
                </div>
                <div style={{ fontSize: 11.5, color: "#888", marginTop: 5 }}>
                  {parseImp(importePago) > 0 && parseImp(importePago) < totalFactura - 0.005 ? "Paga una parte: la factura queda PARCIAL."
                    : parseImp(importePago) > totalFactura + 0.005 ? `Salda la factura y ${$fmt(parseImp(importePago) - totalFactura)} quedan a cuenta del proveedor.`
                    : "Salda la factura entera. Se guarda junto con la factura (si el pago no se puede registrar, no se guarda nada)."}
                </div>
              </div>
            )}
            {soloVer ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid #e6e6e2", paddingTop: 9 }}>
                {editable && <button type="button" style={btn(true)} onClick={onEditar}>Editar</button>}
                {onRepetir && <button type="button" style={btn(false)} onClick={onRepetir} title="Cargar una factura nueva con esta misma estructura">⟳ Repetir</button>}
                <button type="button" style={btn(false)} onClick={onCerrar}>Cerrar</button>
                {editable && <span style={{ marginLeft: "auto" }}>{borrando ? <span style={{ fontSize: 12, color: C.gris }}>Eliminando…</span>
                  : pagosAlBorrar ? (
                    <span style={{ fontSize: 12.5, color: C.rojo, display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 560 }}>
                      <span>⚠ Está paga: <b>{$fmt(pagosAlBorrar.importe)}</b> en {pagosAlBorrar.total} pago{pagosAlBorrar.total === 1 ? "" : "s"}.
                        {pagosAlBorrar.internos > 0 && <> Se eliminan también {pagosAlBorrar.internos === 1 ? "el pago cargado" : `los ${pagosAlBorrar.internos} pagos cargados`} en el Panel.</>}
                        {pagosAlBorrar.lazarillo > 0 && <> {pagosAlBorrar.lazarillo === 1 ? "El pago al proveedor cargado en el Panel vuelve" : `Los ${pagosAlBorrar.lazarillo} pagos al proveedor cargados en el Panel vuelven`} a quedar a cuenta.</>}
                        {pagosAlBorrar.maxirest > 0 && <> {pagosAlBorrar.maxirest === 1 ? "El pago" : "Los pagos"} de MaxiRest {pagosAlBorrar.maxirest === 1 ? "queda" : "quedan"} como “solo 80”.</>}
                        {" "}¿Eliminar igual?</span>
                      <span onClick={() => { setPagosAlBorrar(null); eliminar(true); }} style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí, eliminar</span>
                      <span onClick={() => setPagosAlBorrar(null)} style={{ color: C.gris, cursor: "pointer" }}>No</span>
                    </span>
                  ) : <BtnEliminar onConfirmar={() => eliminar(false)} style={{ fontSize: 13, color: C.rojo }} />}</span>}
              </div>
            ) : (() => {
              const todoVacio = modo === "vario" ? !conceptoV && !importeV && !detalle : cuerpoVacio && !prov && !tipoCpb && !compNum && !totalCtrl && !obs;
              const txtVaciar = modo === "factura" && !cuerpoVacio ? "Vaciar cuerpo" : "Vaciar todo";
              const hacerVaciar = () => {
                if (modo === "vario") { setConfVaciar(false); setConceptoV(""); setRubroV(""); setImporteV(""); setDetalle(""); setParecidoV(null); setErrores([]); setAvisosAlGuardar(null); setImporteOkV(""); setTocadoV(false); setImporteRevisar(false); return; }
                vaciar();
              };
              return (
                <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: modo === "factura" ? "1px solid #e6e6e2" : "none", paddingTop: modo === "factura" ? 9 : 0, flexWrap: "wrap" }}>
                  {modo === "factura" && vista === "nueva" && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      <input type="checkbox" tabIndex={-1} checked={pagarAhora} onChange={(e) => setPagarAhora(e.target.checked)} style={{ width: 15, height: 15 }} />
                      Registrar el pago ahora
                      {!pagarAhora && <span style={{ fontSize: 12, fontWeight: 400, color: "#999" }}>— si no, queda IMPAGA</span>}
                    </label>
                  )}
                  {modo === "vario" && <span style={{ fontSize: 13.5 }}>TOTAL <b style={{ fontSize: 16 }}>{$fmt(parseImp(importeV))}</b> <span style={{ color: "#999", fontSize: 12 }}>· Ticket interno de Gastos Varios</span></span>}
                  <span style={{ flex: 1 }} />
                  {vista === "nueva" && (confVaciar ? (
                    <span style={{ fontSize: 12.5, display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: C.rojo, fontWeight: 700 }}>¿{txtVaciar}?</span>
                      <span role="button" onClick={hacerVaciar} style={{ color: C.rojo, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí</span>
                      <span role="button" onClick={() => setConfVaciar(false)} style={{ color: C.gris, cursor: "pointer" }}>No</span>
                    </span>
                  ) : (
                    <button type="button" tabIndex={-1} disabled={todoVacio} onClick={() => setConfVaciar(true)}
                      title={txtVaciar === "Vaciar cuerpo" ? "Saca los registros, percepciones, impuestos internos y el descuento general" : "Deja todo en blanco, como recién abierto"}
                      style={{ ...btn(false), color: C.rojo, borderColor: "#f3c4c4", opacity: todoVacio ? 0.4 : 1, cursor: todoVacio ? "default" : "pointer" }}>{txtVaciar}</button>
                  ))}
                  <button type="button" tabIndex={-1} style={btn(false)} onClick={onCerrar}>Cancelar</button>
                  <button type="button" style={{ ...btn(true), opacity: guardando || yaCargada || (modo === "factura" && !cuerpoVisible) ? 0.5 : 1 }}
                    disabled={guardando || !!yaCargada || (modo === "factura" && !cuerpoVisible)} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar"}</button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ EMPLEADOS (Diego 28/10/2026) ============
// Sueldo: empleado → período + fecha de pago (hoy) → TOTAL → apertura por concepto de personal,
// cada concepto con sus formas de pago (los adelantos del período se descuentan como forma
// "Adelantos"). Adelanto: concepto fijo. PDV: la regla del empleado; si se cambia, aplica al total.
const ADEL = MEDIO_ADELANTOS;
const periodoHoy = (n = 0) => moverPeriodo(hoyISO().slice(0, 7), n);
function CargaEmpleado({ pdvId, pdvsRef, conceptos, mediosPago, reglaEmpleadoDe, onGuardado, onCerrar, periodo, setPeriodo }) {
  const queryClient = useQueryClient();
  const [sub, setSub] = useState("sueldo");
  const [codigo, setCodigo] = useState("");
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [total, setTotal] = useState(null); // null = el último total del empleado (Diego 29/10)
  const [lineas, setLineas] = useState(null); // null = se arma sola con el total
  // El período se elige arriba (barra del título): al cambiarlo, el desglose se vuelve a armar.
  const perAnt = useRef(periodo);
  useEffect(() => { if (perAnt.current !== periodo) { perAnt.current = periodo; setLineas(null); } }, [periodo]);
  const [importeA, setImporteA] = useState("");
  const [medioA, setMedioA] = useState("");
  const [reparto, setReparto] = useState(null); // null = la regla del empleado
  const [editRep, setEditRep] = useState(false);
  const [errores, setErrores] = useState([]);
  const [parecido, setParecido] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const { data: nomina } = useFetchQuery(["empleados", pdvId], pdvId ? `/api/empleados?pdvId=${pdvId}` : null, { staleTime: 10 * 60_000 });
  const empleados = (nomina && nomina.empleados) || [];
  const etiqueta = (e) => [e.nombre, e.apellido].filter(Boolean).join(" ") + ` (${e.codigo})`;
  const emp = empleados.find((e) => e.codigo === codigo);
  const { data: cuenta } = useFetchQuery(["empleado-cuenta", pdvId, codigo], pdvId && codigo ? `/api/empleados/cuenta?pdvId=${pdvId}&codigo=${encodeURIComponent(codigo)}` : null, { staleTime: 30_000 });
  const delPeriodo = cuenta && cuenta.periodos.find((p) => p.periodo === periodo);
  const adelantos = delPeriodo ? Math.round(delPeriodo.adelantos * 100) / 100 : 0;
  const yaSueldo = delPeriodo && delPeriodo.sueldo > 0.005 ? delPeriodo.sueldo : 0;
  // Al elegir el empleado, el total arranca con su último sueldo (el período más nuevo con sueldo).
  const ultimo = cuenta ? cuenta.periodos.find((p) => p.sueldo > 0.005) : null;
  const totalSug = ultimo ? fmtNum(Math.round((ultimo.sueldo + ultimo.adelantos) * 100) / 100) : "";
  const totalTxt = total ?? totalSug;
  const [verCuenta, setVerCuenta] = useState("concepto"); // concepto | medio
  const medios = mediosPago.map((m) => m.nombre);
  const medioDef = medios[0] || "Efectivo";
  // Conceptos de personal (rubros de personal), sin el de adelantos que es fijo.
  const codAdel = nomina && nomina.conceptoAdelanto ? nomina.conceptoAdelanto.codigo : null;
  const opcCon = conceptos.filter((c) => /personal/i.test(c.rubro) && c.codigo !== codAdel);
  const codDe = (nombre) => (opcCon.find((c) => c.nombre === nombre) || {}).codigo;
  const conceptoDef = (opcCon.find((c) => /^liquidaci[oó]n sueldo$/i.test(c.nombre)) || opcCon[0] || {}).nombre || "";
  const totalN = parseImp(totalTxt);
  // Mientras no se toque la apertura, sale sola del total: un concepto, adelantos + el resto en el medio por defecto.
  const auto = () => [{ concepto: conceptoDef, importe: totalTxt, pagos: [
    ...(adelantos > 0 ? [{ medio: ADEL, importe: fmtNum(adelantos) }] : []),
    ...(totalN - adelantos > 0.004 ? [{ medio: medioDef, importe: fmtNum(Math.round((totalN - adelantos) * 100) / 100) }] : []),
  ] }];
  const ls = lineas || auto();
  const tocar = (f) => setLineas(f(ls.map((l) => ({ ...l, pagos: l.pagos.map((p) => ({ ...p })) }))));
  const regla = emp ? reglaEmpleadoDe(emp.nombre, emp.codigo, fechaPago) : null;
  const pdvNombre = (id) => (pdvsRef.find((p) => p.id === id) || {}).nombre || "?";
  const repVista = reparto || regla;
  const corto = (n) => n.replace("Ramos Mejía", "RM").replace("San Justo", "SJ");

  const payload = (forzar) => {
    const rep = reparto && reparto.filter((x) => parseFloat(x.pct) > 0).length >= 2
      ? reparto.filter((x) => parseFloat(x.pct) > 0).map((x) => ({ puntoDeVentaId: (pdvsRef.find((p) => p.nombre === x.pdv) || {}).id, pct: parseFloat(x.pct) }))
      : null;
    return sub === "sueldo"
      ? { tipo: "sueldo", pdvId, codigo, periodo, fechaPago, total: totalN, reparto: rep, forzar: !!forzar,
          conceptos: ls.map((l) => ({ conceptoCodigo: codDe(l.concepto), importe: parseImp(l.importe), pagos: l.pagos.filter((p) => parseImp(p.importe) > 0).map((p) => ({ medio: p.medio, importe: parseImp(p.importe) })) })) }
      : { tipo: "adelanto", pdvId, codigo, periodo, fechaPago, importe: parseImp(importeA), medio: medioA || medioDef, reparto: rep, forzar: !!forzar };
  };
  const faltan = () => {
    const out = [];
    if (!emp) out.push("Elegí el empleado.");
    if (!fechaValida(fechaPago)) out.push("Falta una fecha de pago válida.");
    if (sub === "adelanto") { if (!(parseImp(importeA) > 0)) out.push("Falta el importe del adelanto."); return out; }
    if (!(totalN > 0)) { out.push("Falta el total del sueldo."); return out; }
    if (ls.some((l) => !codDe(l.concepto))) out.push("Elegí el concepto de cada renglón.");
    const p = payload(false);
    if (!out.length) out.push(...validarSueldo(p, adelantos));
    return out;
  };
  const limpiar = () => { setCodigo(""); setTotal(null); setLineas(null); setImporteA(""); setReparto(null); setEditRep(false); setParecido(null); setErrores([]); };
  const guardar = async (otro, forzar) => {
    const f = faltan();
    if (f.length) { setErrores(f); return; }
    setErrores([]); setGuardando(true);
    try {
      const r = await gestionFetch("/api/empleados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(forzar)) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.parecido) { setParecido({ ...d.parecido, error: d.error, otro }); return; }
      if (!r.ok) { setErrores([d.error || "No se pudo guardar.", ...(d.detalle || [])]); return; }
      setParecido(null);
      refrescarCompras(queryClient); void queryClient.invalidateQueries({ queryKey: ["empleado-cuenta"] });
      const nombre = emp ? etiqueta(emp) : "";
      if (otro) { limpiar(); toast.success(sub === "sueldo" ? "Sueldo cargado" : "Adelanto cargado", { description: `${nombre} · $ ${d.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` }); }
      else onGuardado({ empleado: true, tipo: sub, nombre, total: d.total });
    } catch { setErrores(["Error de red: no se guardó."]); }
    finally { setGuardando(false); }
  };
  const anular = async (id) => {
    const r = await gestionFetch(`/api/empleados/${id}`, { method: "DELETE" });
    if (!r.ok) { toast.error("No se pudo anular"); return; }
    toast.success("Carga anulada");
    refrescarCompras(queryClient); void queryClient.invalidateQueries({ queryKey: ["empleado-cuenta"] });
  };

  const sumaCon = Math.round(ls.reduce((s, l) => s + parseImp(l.importe), 0) * 100) / 100;
  const sumaPag = Math.round(ls.reduce((s, l) => s + l.pagos.reduce((a, p) => a + parseImp(p.importe), 0), 0) * 100) / 100;
  const ok = (a, b) => Math.abs(a - b) < 0.005;
  const tabsSub = (
    <div style={{ display: "inline-flex", gap: 4, background: C.fondo, borderRadius: 10, padding: 3, marginBottom: 12 }}>
      {[["sueldo", "Sueldo"], ["adelanto", "Adelanto"]].map(([k, t]) => (
        <button key={k} type="button" tabIndex={-1} onClick={() => { setSub(k); setErrores([]); setParecido(null); setPeriodo(periodoHoy(k === "sueldo" ? -1 : 0)); }}
          style={{ border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: sub === k ? "#fff" : "transparent", color: sub === k ? C.neg : C.gris, boxShadow: sub === k ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>{t}</button>
      ))}
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 16, alignItems: "start" }}>
      <div>
        {tabsSub}
        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: 10 }}>
          <div><span style={lab}>Empleado</span>
            <Combo opciones={empleados.map(etiqueta)} valor={emp ? etiqueta(emp) : ""} placeholder={nomina ? "Buscar empleado..." : "Cargando nómina…"} autoFocus
              onElegir={(t) => { const e = empleados.find((x) => etiqueta(x) === t); setCodigo(e ? e.codigo : ""); setTotal(null); setLineas(null); setReparto(null); setEditRep(false); setParecido(null); }} /></div>
          <div><span style={lab}>Fecha de pago</span><FechaInput style={inp} iso={fechaPago} onISO={setFechaPago} /></div>
        </div>

        {/* PDV: la regla del empleado (aplica sobre el total); se puede cambiar para esta carga. */}
        {emp && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#2a6b86", background: "#f3fafd", border: "1px solid #bfe0f0", borderRadius: 9, padding: "7px 12px" }}>
            {!editRep ? (
              <span>PDV: {repVista ? <b>⇄ {repVista.map((x) => `${corto(x.pdv)} ${fmtNum(parseFloat(x.pct))}%`).join(" · ")}</b> : <b>{pdvNombre(pdvId)}</b>}
                {" "}<span style={{ color: "#888" }}>{reparto ? "· cambiado para esta carga" : regla ? "· regla del empleado" : "· sin regla"}</span>
                {" "}<span onClick={() => { setReparto((reparto || regla || [{ pdv: pdvNombre(pdvId), pct: 100 }]).map((x) => ({ ...x }))); setEditRep(true); }} style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline", marginLeft: 6 }}>Cambiar</span>
                {reparto && <span onClick={() => setReparto(null)} style={{ cursor: "pointer", color: "#888", marginLeft: 8 }}>volver a la regla</span>}</span>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {pdvsRef.map((p) => { const x = (reparto || []).find((r) => r.pdv === p.nombre); return (
                  <label key={p.id} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>{corto(p.nombre)}
                    <input style={{ ...inp, width: 64, height: 30, textAlign: "right" }} value={x ? x.pct : ""} placeholder="0"
                      onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setReparto((rs) => [...(rs || []).filter((r) => r.pdv !== p.nombre), ...(v ? [{ pdv: p.nombre, pct: v }] : [])]); }} />%</label>); })}
                <span style={{ fontWeight: 700, color: Math.abs((reparto || []).reduce((s, x) => s + (parseFloat(x.pct) || 0), 0) - 100) < 0.01 ? C.verde : C.rojo }}>
                  {fmtNum((reparto || []).reduce((s, x) => s + (parseFloat(x.pct) || 0), 0))}%</span>
                <button type="button" style={{ ...btn(false), padding: "4px 10px" }} onClick={() => { setEditRep(false); const r = (reparto || []).filter((x) => parseFloat(x.pct) > 0);
                  if (r.length < 2 && (!r.length || r[0].pdv === pdvNombre(pdvId)) && !regla) setReparto(null); else setReparto(r); }}>Listo</button>
                <span style={{ color: "#888" }}>Aplica sobre el total (todos los conceptos), solo en esta carga.</span>
              </div>
            )}
          </div>
        )}

        {sub === "adelanto" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div><span style={lab}>Importe</span><input style={{ ...inp, textAlign: "right", fontWeight: 700 }} value={importeA} placeholder="0,00" onChange={(e) => setImporteA(fmtImp(e.target.value, e.nativeEvent))} /></div>
            <div><span style={lab}>Forma de pago</span>
              <select style={sel} value={medioA || medioDef} onChange={(e) => setMedioA(e.target.value)}>{medios.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#888" }}>Concepto fijo: <b>{nomina && nomina.conceptoAdelanto ? nomina.conceptoAdelanto.nombre : "Adelanto Sueldo"}</b> · va a la cuenta del empleado en {nombrePeriodo(periodo)} y se descuenta del sueldo.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
              <div><span style={lab}>Total del sueldo{total == null && ultimo ? <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}> · el de {nombrePeriodo(ultimo.periodo)}</span> : null}</span>
                <input style={{ ...inp, textAlign: "right", fontWeight: 700, fontSize: 15 }} value={totalTxt} placeholder="0,00"
                onChange={(e) => { setTotal(fmtImp(e.target.value, e.nativeEvent)); }} /></div>
              <div><span style={lab}>Adelantos del período</span><div style={{ ...inp, display: "flex", alignItems: "center", color: adelantos ? C.rojo : C.gris, fontWeight: 700 }}>{adelantos ? `− ${$fmt(adelantos)}` : "—"}</div></div>
              <div><span style={lab}>A pagar</span><div style={{ ...inp, display: "flex", alignItems: "center", fontWeight: 700, fontSize: 15 }}>{totalN ? $fmt(Math.max(0, totalN - adelantos)) : "—"}</div></div>
            </div>
            {yaSueldo > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: "#8a5a00" }}>⚠ {nombrePeriodo(periodo)} ya tiene sueldo cargado ({$fmt(yaSueldo)}). Mirá la cuenta a la derecha antes de cargar.</div>}
            <span style={{ ...lab, marginTop: 14 }}>Apertura por concepto y forma de pago</span>
            <div style={{ border: `1px solid ${C.borde}`, borderRadius: 11, padding: "6px 10px" }}>
              {ls.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 130px minmax(0, 2fr) 24px", gap: 8, alignItems: "start", padding: "6px 0", borderBottom: i < ls.length - 1 ? "1px solid #f2f2f0" : "none" }}>
                  <Combo opciones={opcCon.map((c) => c.nombre)} valor={l.concepto} placeholder="Concepto..." onElegir={(v) => tocar((x) => { x[i].concepto = v; return x; })} />
                  <input style={{ ...inp, textAlign: "right" }} value={l.importe} placeholder="0,00" onChange={(e) => { const v = fmtImp(e.target.value, e.nativeEvent); tocar((x) => { x[i].importe = v; if (x[i].pagos.length === 1 && x[i].pagos[0].medio !== ADEL) x[i].pagos[0].importe = v; return x; }); }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {l.pagos.map((p, k) => (
                      <div key={k} style={{ display: "flex", gap: 6 }}>
                        <select style={{ ...sel, flex: 1, height: 38 }} value={p.medio} onChange={(e) => tocar((x) => { x[i].pagos[k].medio = e.target.value; return x; })}>
                          {[...(adelantos > 0 ? [ADEL] : []), ...medios].map((m) => <option key={m}>{m}</option>)}</select>
                        <input style={{ ...inp, width: 130, textAlign: "right" }} value={p.importe} placeholder="0,00" onChange={(e) => { const v = fmtImp(e.target.value, e.nativeEvent); tocar((x) => {
                          x[i].pagos[k].importe = v;
                          // Con dos formas de pago, la otra es lo que falta para el importe del concepto (Diego 29/10).
                          // (Los adelantos son fijos: se cuentan pero no se recalculan.)
                          const otras = x[i].pagos.map((q, j) => j).filter((j) => j !== k && x[i].pagos[j].medio !== ADEL);
                          if (x[i].pagos[k].medio !== ADEL && otras.length === 1) {
                            const adel = x[i].pagos.reduce((a, q) => a + (q.medio === ADEL ? parseImp(q.importe) : 0), 0);
                            const resto = Math.round((parseImp(x[i].importe) - adel - parseImp(v)) * 100) / 100;
                            x[i].pagos[otras[0]].importe = resto > 0 ? fmtNum(resto) : "";
                          }
                          return x; }); }} />
                        <span onClick={() => tocar((x) => { x[i].pagos.splice(k, 1); return x; })} style={{ cursor: "pointer", color: C.gris, alignSelf: "center", width: 14, textAlign: "center" }}>×</span>
                      </div>))}
                    <span onClick={() => tocar((x) => { const rest = parseImp(x[i].importe) - x[i].pagos.reduce((a, p) => a + parseImp(p.importe), 0); x[i].pagos.push({ medio: medioDef, importe: rest > 0 ? fmtNum(Math.round(rest * 100) / 100) : "" }); return x; })}
                      style={{ fontSize: 12, fontWeight: 600, color: "#2a88ad", cursor: "pointer" }}>+ forma de pago</span>
                  </div>
                  <span onClick={() => tocar((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))} title="Quitar concepto" style={{ cursor: "pointer", color: C.gris, paddingTop: 9 }}>×</span>
                </div>))}
              <span onClick={() => tocar((x) => [...x, { concepto: "", importe: "", pagos: [{ medio: medioDef, importe: "" }] }])} style={{ fontSize: 12.5, fontWeight: 600, color: "#2a88ad", cursor: "pointer", display: "inline-block", padding: "6px 0" }}>+ Agregar concepto</span>
            </div>
            {totalN > 0 && (
              <div style={{ display: "flex", gap: 16, fontSize: 12.5, marginTop: 8 }}>
                <span>Conceptos: <b style={{ color: ok(sumaCon, totalN) ? C.verde : C.rojo }}>{$fmt(sumaCon)} de {$fmt(totalN)} {ok(sumaCon, totalN) ? "✓" : "✗"}</b></span>
                <span>Formas de pago: <b style={{ color: ok(sumaPag, totalN) ? C.verde : C.rojo }}>{$fmt(sumaPag)} {ok(sumaPag, totalN) ? "✓" : "✗"}</b></span>
              </div>
            )}
          </>
        )}

        {parecido && (
          <div style={{ border: "1.5px solid #f0c179", background: "#fdf8ef", borderRadius: 11, padding: "10px 14px", fontSize: 13, color: "#8a5a00", marginTop: 12 }}>
            ⚠ {parecido.error}: {$fmt(parecido.importe)}{parecido.fecha ? ` · ${dmy(parecido.fecha)}` : ""} ({parecido.origen === "lazarillo" ? "cargado en Lazarillo" : "de MaxiRest"}). Nunca se duplica: ¿es otro?{" "}
            <span onClick={() => guardar(parecido.otro, true)} style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí, cargarlo igual</span>
            {" · "}<span onClick={() => setParecido(null)} style={{ cursor: "pointer", color: C.gris }}>No</span>
          </div>
        )}
        {errores.length > 0 && (
          <div style={{ border: `1.5px solid ${C.rojo}`, background: "#fdf3f3", borderRadius: 11, padding: "10px 14px", marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.rojo, marginBottom: 4 }}>No se puede guardar todavía:</div>
            {errores.map((e, i) => <div key={i} style={{ fontSize: 12.5, color: C.rojo }}>• {e}</div>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={{ ...btn(true), opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={() => guardar(false)}>{guardando ? "Guardando…" : "Guardar"}</button>
          <button style={btn(false)} disabled={guardando} onClick={() => guardar(true)}>Guardar y cargar otro empleado</button>
          <button style={btn(false)} onClick={onCerrar}>Cancelar</button>
        </div>
      </div>

      {/* Cuenta del empleado por período */}
      <div style={{ ...card, padding: "12px 14px", fontSize: 12.5 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Cuenta {emp ? `· ${[emp.nombre, emp.apellido].filter(Boolean).join(" ")}` : "del empleado"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6, color: C.gris, marginBottom: 6 }}>
          <span>por período · últimos 12 meses</span>
          <span style={{ display: "inline-flex", background: C.fondo, borderRadius: 7, padding: 2 }}>
            {[["concepto", "Concepto"], ["medio", "Forma de pago"]].map(([k, t]) => (
              <button key={k} type="button" tabIndex={-1} onClick={() => setVerCuenta(k)}
                style={{ border: "none", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", background: verCuenta === k ? "#fff" : "transparent", color: verCuenta === k ? C.neg : C.gris }}>{t}</button>))}
          </span>
        </div>
        {!emp ? <div style={{ color: C.gris }}>Elegí un empleado.</div> : !cuenta ? <div style={{ color: C.gris }}>Cargando…</div>
          : !cuenta.periodos.length ? <div style={{ color: C.gris }}>Sin sueldos ni adelantos cargados.</div>
          : cuenta.periodos.slice(0, 6).map((p) => (
            <div key={p.periodo} role="button" title={`Cargar en ${nombrePeriodo(p.periodo)}`} onClick={() => setPeriodo(p.periodo)} style={{ marginTop: 8, background: p.periodo === periodo ? "#f3fafd" : "transparent", borderRadius: 8, padding: "4px 6px", cursor: "pointer" }}>
              <div style={{ fontWeight: 700 }}>{nombrePeriodo(p.periodo)}</div>
              {verCuenta === "concepto" ? p.movimientos.map((m, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px dashed #eee", padding: "2px 0" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dmy(m.fecha)} · {m.concepto}{m.origen === "lazarillo" ? " ·L" : ""}</span>
                  <b style={{ color: m.cod === cuenta.codigoAdelanto ? C.rojo : C.neg, whiteSpace: "nowrap" }}>{$fmt(m.importe)}</b></div>))
                : Object.entries(p.movimientos.reduce((acc, m) => { const k = (m.medio || "Sin dato").trim() || "Sin dato"; acc[k] = (acc[k] || 0) + m.importe; return acc; }, {}))
                  .sort((a, b) => b[1] - a[1]).map(([medio, imp]) => (
                  <div key={medio} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px dashed #eee", padding: "2px 0" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{medio}</span>
                    <b style={{ whiteSpace: "nowrap" }}>{$fmt(imp)}</b></div>))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span>{p.sueldo > 0.005 ? "Total del período" : "A descontar del sueldo"}</span>
                <b>{$fmt(p.sueldo > 0.005 ? p.sueldo + p.adelantos : p.adelantos)}</b></div>
              {cuenta.cargas.filter((c) => c.periodo === p.periodo).map((c) => (
                <div key={c.id} style={{ fontSize: 11.5, color: C.gris, display: "flex", justifyContent: "space-between" }}>
                  <span>Cargado en Lazarillo: {c.tipo} {$fmt(c.total)}</span>
                  <BtnEliminar onConfirmar={() => anular(c.id)} style={{ fontSize: 11.5, color: C.rojo }} /></div>))}
            </div>))}
      </div>
    </div>
  );
}

export default ModalNuevaCarga;
