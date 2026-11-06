// src/componentes/gestion/EnvasesEditor.jsx
// Envases de compra de un insumo (X6, Pack 12…), editables en Lazarillo (Diego 06/11/2026). Los de MaxiRest
// se pueden corregir (lo corregido queda en Lazarillo y la importación no lo pisa); los nuevos se crean acá.
// Se usa en la carga de facturas (desplegable de la cantidad) y en la ficha del insumo (Recetas).
import React, { useState } from "react";
import { toast } from "sonner";
import { gestionFetch } from "@/servicios/apiGestion";

const C = { cel: "#0d6fa8", gris: "#8a8a8a", borde: "#e8e8e6", rojo: "#c62828", neg: "#111" };
const inp = { padding: "4px 8px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, height: 32, boxSizing: "border-box", background: "#fff", width: "100%" };
const num = (v) => { const n = parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => (Number(n) || 0).toLocaleString("es-AR", { maximumFractionDigits: 4 });

async function llamar(ruta, opciones) {
  const r = await gestionFetch(ruta, opciones);
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error((d && d.error) || "No se pudo guardar el envase.");
  return d;
}

export async function guardarEnvase(codigo, envase, factor) {
  return llamar("/api/facturas/envases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo, envase, factor }) });
}
export async function borrarEnvase(codigo, envase) {
  return llamar(`/api/facturas/envases?codigo=${encodeURIComponent(codigo)}&envase=${encodeURIComponent(envase)}`, { method: "DELETE" });
}

// soloAlta: solo el formulario de envase nuevo (desde «+ Nuevo envase…» de la carga).
export default function EnvasesEditor({ codigo, nombre, medida, envases = [], onCambio, soloAlta = false, onCerrar, titulo }) {
  const [nuevo, setNuevo] = useState({ envase: "", factor: "" });
  const [editando, setEditando] = useState({}); // envase → factor en edición
  const [ocupado, setOcupado] = useState(false);
  const u = medida || "u";
  const agregar = async () => {
    const env = nuevo.envase.trim(); const f = num(nuevo.factor);
    if (!env) { toast.error("Poné el nombre del envase."); return; }
    if (!(f > 0)) { toast.error("Poné cuántas unidades trae."); return; }
    setOcupado(true);
    try {
      await guardarEnvase(codigo, env, f);
      toast.success(`Envase ${env} guardado`);
      setNuevo({ envase: "", factor: "" });
      onCambio && onCambio({ tipo: "alta", envase: env, factor: f });
    } catch (e) { toast.error(e.message); }
    setOcupado(false);
  };
  const corregir = async (e) => {
    const f = num(editando[e.envase]);
    setEditando((x) => { const y = { ...x }; delete y[e.envase]; return y; });
    if (!(f > 0) || Math.abs(f - Number(e.factor)) < 1e-9) return;
    try { await guardarEnvase(codigo, e.envase, f); toast.success(`${e.envase}: ahora trae ${fmt(f)} ${u}`); onCambio && onCambio({ tipo: "alta", envase: e.envase, factor: f }); }
    catch (err) { toast.error(err.message); }
  };
  const sacar = async (e) => {
    try { await borrarEnvase(codigo, e.envase); toast.success(`Envase ${e.envase} sacado`); onCambio && onCambio({ tipo: "baja", envase: e.envase }); }
    catch (err) { toast.error(err.message); }
  };
  // Misma grilla para encabezado, envases y alta, y todos los controles de 30px (Diego 06/11/2026:
  // los componentes de un modal van del mismo alto y alineados).
  const GRID = "minmax(0, 1fr) 130px 110px 40px";
  const ALTO = 30;
  const ctrl = { ...inp, height: ALTO, margin: 0, lineHeight: `${ALTO - 2}px`, padding: "0 8px" };
  const boton = (oscuro) => ({ height: ALTO, margin: 0, padding: "0 12px", borderRadius: 8, boxSizing: "border-box", lineHeight: 1, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    border: oscuro ? "none" : `1px solid ${C.borde}`, background: oscuro ? C.neg : "#fff", color: oscuro ? "#fff" : C.neg });
  const fila = { display: "grid", gridTemplateColumns: GRID, gap: 8, padding: "6px 10px", alignItems: "center", borderTop: "1px solid #f2f2f0" };
  const conUnidad = (input) => <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{input}<span style={{ color: C.gris, width: 14 }}>{u}</span></span>;
  const alta = (
    <div style={{ ...fila, background: "#fbfdfe" }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!ocupado) agregar(); } }}>
      <input style={ctrl} autoFocus={soloAlta} placeholder="Nombre del envase nuevo (ej. Pack 24)" maxLength={20} value={nuevo.envase} onChange={(e) => setNuevo({ ...nuevo, envase: e.target.value })} />
      {conUnidad(<input style={{ ...ctrl, textAlign: "center" }} placeholder="trae" value={nuevo.factor} onChange={(e) => setNuevo({ ...nuevo, factor: e.target.value.replace(/[^0-9.,]/g, "") })} />)}
      <button type="button" disabled={ocupado} onClick={agregar} style={{ ...boton(true), width: "100%" }}>{soloAlta ? "Crear y usar" : "+ Agregar"}</button>
      <span />
    </div>
  );
  return (
    <div style={{ border: `1.5px solid #5BC2EA`, borderRadius: 10, padding: "10px 12px", background: "#fff", fontSize: 12.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minHeight: ALTO }}>
        <span style={{ fontWeight: 700 }}>{titulo || (soloAlta ? `Nuevo envase de ${nombre}` : `Envases de compra · ${nombre}`)}</span>
        <span style={{ color: C.gris }}>cuántas {u} trae cada envase</span>
        <span style={{ flex: 1 }} />
        {onCerrar && <button type="button" onClick={onCerrar} style={boton(false)}>{soloAlta ? "Cancelar" : "Cerrar"}</button>}
      </div>
      <div style={{ border: `1px solid ${C.borde}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ ...fila, borderTop: "none", background: "#fafaf8", fontSize: 10.5, fontWeight: 700, color: C.gris, padding: "7px 10px" }}>
          <span>ENVASE</span><span style={{ textAlign: "center", paddingRight: 20 }}>TRAE</span><span style={{ textAlign: "center" }}>{soloAlta ? "" : "ORIGEN"}</span><span />
        </div>
        {!soloAlta && !envases.length && <div style={{ ...fila, color: C.gris }}><span style={{ gridColumn: "1 / -1" }}>Sin envases: se compra por {u}.</span></div>}
        {!soloAlta && envases.map((e) => (
          <div key={e.envase} style={fila}>
            <span style={{ fontWeight: 600, paddingLeft: 9 }}>{e.envase}</span>
            {conUnidad(<input style={{ ...ctrl, textAlign: "center" }} value={editando[e.envase] !== undefined ? editando[e.envase] : fmt(e.factor)}
              onFocus={() => setEditando((x) => ({ ...x, [e.envase]: fmt(e.factor) }))}
              onChange={(ev) => setEditando((x) => ({ ...x, [e.envase]: ev.target.value.replace(/[^0-9.,]/g, "") }))}
              onBlur={() => corregir(e)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.blur(); } }} />)}
            <span style={{ textAlign: "center", color: e.origen === "lazarillo" ? "#2a88ad" : C.gris }}>{e.origen === "lazarillo" ? (e.corrige ? "corregido" : "Lazarillo") : "MaxiRest"}</span>
            <span role="button" title="Sacar este envase" onClick={() => sacar(e)} style={{ textAlign: "center", color: C.gris, cursor: "pointer", fontSize: 15, lineHeight: `${ALTO}px` }}>×</span>
          </div>
        ))}
        {alta}
      </div>
    </div>
  );
}

// Envases aplicados sobre los del maestro con los cambios hechos en esta sesión (mismo criterio que el back).
export function conCambios(envases = [], cambios = []) {
  let lista = [...envases];
  for (const c of cambios) {
    lista = lista.filter((e) => String(e.envase).trim().toUpperCase() !== c.envase.trim().toUpperCase());
    if (c.tipo === "alta") lista.push({ envase: c.envase, factor: c.factor, origen: "lazarillo" });
  }
  return lista;
}
