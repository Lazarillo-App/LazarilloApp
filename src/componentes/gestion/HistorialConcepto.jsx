// src/componentes/gestion/HistorialConcepto.jsx
// «Últimas cargas» de Gastos varios (panel derecho de la carga). Separado de ModalCargaFactura.jsx el
// 20/11/2026 porque el modal pasaba los 200 KB; se ve y funciona igual.
import React, { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { refrescarCompras } from "@/gestion/hooksPanel";
import { nombrePeriodo } from "@/gestion/periodoGastos";
import { gestionFetch, GestionAPI } from "@/servicios/apiGestion";
import CampoImporte from "@/componentes/CampoImporte";
import { C, $fmt } from "./cargaEstilos";

// Gastos varios: historial del concepto elegido a la derecha (Diego 05/11/2026), como la cuenta del
// empleado: por período, con lo habitual (mediana de las últimas 6) y un atajo para usar el último.
// Editar una carga desde «Últimas cargas» abre el mismo Ver / editar que Actividad y Detalle de compras
// (Diego 12/11/2026). Import diferido: CargarFactura importa este archivo.
const VerFacturaDiferida = React.lazy(() => import("./CargarFactura").then((m) => ({ default: m.VerFactura })));

export default function HistorialConcepto({ concepto, codigo, pdvId, pdvNombre, periodo, onUsar, onPeriodo, onFilas }) {
  const [filas, setFilas] = useState(null);
  const [editar, setEditar] = useState(null); // rowId de la carga que se está editando
  const [recarga, setRecarga] = useState(0);
  // Corregir fecha e importe de una carga de MaxiRest (Diego 20/11/2026, el IVA de septiembre): se
  // guarda como corrección manual (la próxima importación no la pisa) y, si el concepto tiene regla
  // de apertura, el servidor la vuelve a repartir. { rowId, fecha, importe, inicial, guardando }
  const [editarMx, setEditarMx] = useState(null);
  const guardarMx = async () => {
    const e = editarMx;
    const cuerpo = {};
    if (e.fecha && e.fecha !== e.inicial.fecha) cuerpo.fechaManual = new Date(`${e.fecha}T12:00:00Z`).toISOString();
    if (e.importe !== "" && Number(e.importe) !== Number(e.inicial.importe)) cuerpo.importeManual = Number(e.importe);
    if (!Object.keys(cuerpo).length) { setEditarMx(null); return; }
    setEditarMx({ ...e, guardando: true });
    try {
      await GestionAPI.editarCompra(e.rowId, cuerpo);
      setEditarMx(null);
      setRecarga((n) => n + 1);
      refrescarCompras(qc);
      toast.success("Carga corregida", { description: `${e.fecha.slice(8, 10)}/${e.fecha.slice(5, 7)} · ${$fmt(e.importe)}` });
    } catch (err) {
      setEditarMx({ ...e, guardando: false });
      toast.error((err && err.message) || "No se pudo guardar");
    }
  };
  // Eliminar desde acá cualquier carga de Lazarillo (Diego 12/11/2026). Las de MaxiRest se borran en
  // MaxiRest: si se borraran acá volverían con la próxima importación.
  const qc = useQueryClient();
  const [borrar, setBorrar] = useState(null); // { rowId, pagos?: total pagado, enCurso? }
  const eliminarFila = async (f, conPagos) => {
    setBorrar({ rowId: f.rowId, enCurso: true });
    const emp = /^emp-(\d+)-/.exec(f.rowId || "");
    const url = emp ? `/api/empleados/${emp[1]}` : `/api/facturas/${encodeURIComponent(f.rowId)}${conPagos ? "?conPagos=1" : ""}`;
    try {
      const r = await gestionFetch(url, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok && d && d.tienePagos) { setBorrar({ rowId: f.rowId, pagos: d.tienePagos.total || true }); return; }
      if (!r.ok) { setBorrar(null); toast.error((d && d.error) || "No se pudo eliminar"); return; }
      setBorrar(null);
      setFilas((xs) => (xs || []).filter((x) => x.rowId !== f.rowId));
      toast.success("Carga eliminada", { description: `${f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} · ` : ""}${$fmt(f.importe)}` });
      refrescarCompras(qc);
    } catch { setBorrar(null); toast.error("Error de red: no se eliminó."); }
  };
  useEffect(() => {
    setFilas(null);
    if (!codigo || pdvId == null) return undefined;
    let vivo = true;
    gestionFetch(`/api/gastos-varios/historial?conceptoCodigo=${encodeURIComponent(codigo)}&pdvId=${pdvId}`)
      .then((r) => r.json()).then((d) => { if (vivo) { setFilas((d && d.filas) || []); if (onFilas) onFilas((d && d.filas) || []); } }).catch(() => vivo && setFilas([]));
    return () => { vivo = false; };
  }, [codigo, pdvId, recarga]);
  // Al cambiar el período se lleva a la vista; y al revés, tocar un período lo elige arriba (Diego 06/11/2026).
  const lista = useRef(null);
  useEffect(() => {
    const el = lista.current && lista.current.querySelector(`[data-periodo="${periodo}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [periodo, filas]);
  // Fuente 2 puntos más grande que el resto del modal (Diego 12/11/2026: se lee mejor).
  const caja = { background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 12, padding: "12px 14px", fontSize: 14.5 };
  if (!codigo) return <div style={{ ...caja, color: C.gris }}><div style={{ fontWeight: 700, fontSize: 15.5, color: C.neg, marginBottom: 4 }}>Últimas cargas</div>Elegí un concepto para ver lo último que se cargó.</div>;
  const ult6 = (filas || []).slice(0, 6).map((f) => f.importe).sort((a, b) => a - b);
  const mediana = ult6.length ? (ult6.length % 2 ? ult6[(ult6.length - 1) / 2] : (ult6[ult6.length / 2 - 1] + ult6[ult6.length / 2]) / 2) : null;
  const porPeriodo = [];
  (filas || []).forEach((f) => { const g = porPeriodo.find((x) => x.p === f.periodo); if (g) g.filas.push(f); else porPeriodo.push({ p: f.periodo, filas: [f] }); });
  const tieneActual = porPeriodo.some((g) => g.p === periodo);
  // El período elegido sin cargas va en su lugar cronológico, entre los meses que tiene al lado
  // (Diego 23/11/2026: arriba de todo «descoloca»). Los meses vienen del más nuevo al más viejo.
  const grupos = porPeriodo.slice();
  if (!tieneActual && periodo) {
    const i = grupos.findIndex((g) => String(g.p) < String(periodo));
    grupos.splice(i < 0 ? grupos.length : i, 0, { p: periodo, filas: [], vacio: true });
  }
  // Total de cada mes (usuaria 18/11/2026: «que según el mes abajo aparezca el total, así no lo sumo a mano»).
  const totalDe = (g) => g.filas.reduce((s, f) => s + (Number(f.importe) || 0), 0);
  const delPeriodo = porPeriodo.find((g) => g.p === periodo);
  return (
    <div style={caja}>
      <div style={{ fontWeight: 700, fontSize: 15.5 }}>Últimas cargas · {concepto}</div>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.gris, margin: "2px 0 6px" }}><span>{pdvNombre} · últimos 12 meses</span>{filas && <span>{filas.length} carga{filas.length === 1 ? "" : "s"}</span>}</div>
      {!filas ? <div style={{ color: C.gris }}>Cargando…</div> : (<>
        {!filas.length && <div style={{ color: C.gris, marginTop: 6 }}>Sin cargas de este concepto en el último año.</div>}
        <div ref={lista} style={{ maxHeight: 330, overflow: "auto" }}>
          {grupos.map((g) => g.vacio ? (
            <div key={g.p} data-periodo={g.p} style={{ marginTop: 6, background: "#f3fafd", border: "1px solid #bfe0f0", borderRadius: 8, padding: "4px 8px", fontWeight: 700 }}>
              {nombrePeriodo(g.p)} <span style={{ fontWeight: 400, color: "#2a88ad" }}>· este período, sin cargar</span></div>
          ) : (
            <div key={g.p} data-periodo={g.p} role="button" title={`Cargar en ${nombrePeriodo(g.p)}`} onClick={() => onPeriodo && onPeriodo(g.p)}
              style={{ marginTop: 6, borderRadius: 8, padding: "4px 7px", cursor: "pointer", border: "1px solid transparent", ...(g.p === periodo ? { background: "#fdf8ef", border: "1px solid #f0d9a8" } : {}) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ flex: 1 }}>{nombrePeriodo(g.p)}{g.p === periodo ? <span style={{ fontWeight: 400, color: "#8a5a00" }}> · ya tiene carga</span> : null}</b>
                {g.filas.length > 1 && <span title={`Total de ${nombrePeriodo(g.p)}`} style={{ fontSize: 13, color: C.gris, whiteSpace: "nowrap" }}>{g.filas.length} cargas · <b style={{ color: "#555" }}>{$fmt(totalDe(g))}</b></span>}
              </div>
              {g.filas.map((f, k) => (
                // Columnas fijas: texto | origen (L = Lazarillo, MX = MaxiRest) | importe — siempre alineados.
                <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 26px 120px 22px 22px", gap: 6, alignItems: "center", borderBottom: "1px dashed #eee", padding: "3px 0" }}>
                  {editarMx && editarMx.rowId === f.rowId && f.rowId ? (
                    <span onClick={(e) => e.stopPropagation()} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                      <input type="date" value={editarMx.fecha} onChange={(e) => setEditarMx({ ...editarMx, fecha: e.target.value })} disabled={editarMx.guardando}
                        title="Fecha del gasto" style={{ height: 40, boxSizing: "border-box", border: `1px solid ${C.borde}`, borderRadius: 8, padding: "0 8px", font: "inherit", fontSize: 14 }} />
                      <CampoImporte size="small" value={editarMx.importe} onChange={(v) => setEditarMx({ ...editarMx, importe: v })} disabled={editarMx.guardando} autoFocus
                        sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-root": { height: 40, fontSize: 14 } }} />
                      <span role="button" title="Guardar" onClick={() => !editarMx.guardando && guardarMx()}
                        style={{ width: 32, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.verde, fontSize: 18, fontWeight: 700, cursor: "pointer" }}>{editarMx.guardando ? "…" : "✓"}</span>
                      <span role="button" title="Cancelar" onClick={() => setEditarMx(null)}
                        style={{ width: 28, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.gris, fontSize: 18, cursor: "pointer" }}>×</span>
                    </span>
                  ) : borrar && borrar.rowId === f.rowId && f.rowId ? (
                    <span onClick={(e) => e.stopPropagation()} style={{ gridColumn: "1 / -1", fontSize: 13.5, lineHeight: "20px", textAlign: "right" }}>
                      <span style={{ color: "#555", float: "left" }}>{f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} · ` : ""}{$fmt(f.importe)}</span>
                      {borrar.enCurso ? <span style={{ color: C.gris }}>Eliminando…</span> : (<>
                        <span style={{ color: C.rojo, fontWeight: 700 }}>{borrar.pagos ? `Tiene ${typeof borrar.pagos === "number" ? `${$fmt(borrar.pagos)} pagados` : "pagos"} · ¿eliminar con el pago?` : "¿Eliminar?"}</span>{" "}
                        <span role="button" onClick={() => eliminarFila(f, !!borrar.pagos)} style={{ color: C.rojo, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Sí</span>
                        {" · "}<span role="button" onClick={() => setBorrar(null)} style={{ color: C.gris, cursor: "pointer" }}>No</span></>)}
                    </span>
                  ) : <span title={[f.detalle, f.proveedor, f.medio].filter(Boolean).join(" · ")} style={{ color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.fecha ? `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}` : ""}{f.detalle ? ` · ${f.detalle}` : ""}{f.medio ? ` · ${f.medio}` : ""}</span>}
                  {!(borrar && borrar.rowId === f.rowId && f.rowId) && !(editarMx && editarMx.rowId === f.rowId && f.rowId) && (<>
                  <span title={f.lazarillo ? "Cargado en Lazarillo" : "Viene de MaxiRest"} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, borderRadius: 4, lineHeight: "17px", background: f.lazarillo ? "#e7f3fa" : "#f1f1ef", color: f.lazarillo ? "#2a88ad" : "#888" }}>{f.lazarillo ? "L" : "MX"}</span>
                  <b style={{ whiteSpace: "nowrap", textAlign: "right" }}>{$fmt(f.importe)}</b>
                  {f.lazarillo && f.rowId ? (
                    <span role="button" title="Editar esta carga" onClick={(e) => { e.stopPropagation(); setEditar(f.rowId); }}
                      style={{ textAlign: "center", color: "#b5b5b5", cursor: "pointer", fontSize: 14, lineHeight: "20px", borderRadius: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.cel; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#b5b5b5"; }}>✎</span>
                  ) : f.rowId && Number(f.n) === 1 ? (
                    <span role="button" title="Corregir fecha e importe (viene de MaxiRest: la corrección queda en Lazarillo)"
                      onClick={(e) => { e.stopPropagation(); setBorrar(null); setEditarMx({ rowId: f.rowId, fecha: f.fecha || "", importe: f.importe, inicial: { fecha: f.fecha || "", importe: f.importe } }); }}
                      style={{ textAlign: "center", color: "#b5b5b5", cursor: "pointer", fontSize: 14, lineHeight: "20px", borderRadius: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.cel; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#b5b5b5"; }}>✎</span>
                  ) : <span title="Junta varias cargas de MaxiRest: corregilas desde Detalle de compras" style={{ textAlign: "center", color: "#e2e2e2", fontSize: 14, lineHeight: "20px", cursor: "default" }}>✎</span>}
                  {f.lazarillo && f.rowId ? (
                    <span role="button" title="Eliminar esta carga" onClick={(e) => { e.stopPropagation(); setBorrar({ rowId: f.rowId }); }}
                      style={{ textAlign: "center", color: "#b5b5b5", cursor: "pointer", fontSize: 17, lineHeight: "20px", borderRadius: 4 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = C.rojo; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#b5b5b5"; }}>×</span>
                  ) : <span title="Viene de MaxiRest: se borra en MaxiRest (si se borra acá, vuelve con la próxima importación)" style={{ textAlign: "center", color: "#e2e2e2", fontSize: 17, lineHeight: "20px", cursor: "default" }}>×</span>}
                  </>)}
                </div>
              ))}
            </div>
          ))}
        </div>
        {delPeriodo && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 15.5 }}>
            <span>Total de {nombrePeriodo(periodo)} <span style={{ color: C.gris, fontSize: 13.5 }}>· {delPeriodo.filas.length} carga{delPeriodo.filas.length === 1 ? "" : "s"}</span></span>
            <b>{$fmt(totalDe(delPeriodo))}</b>
          </div>
        )}
        {mediana != null && (<>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: delPeriodo ? "none" : "1px solid #eee" }}><span>Habitual (mediana últimas {ult6.length})</span><b>{$fmt(mediana)}</b></div>
          <div style={{ textAlign: "right", marginTop: 3 }}><span role="button" onClick={() => onUsar(filas[0])} title="Trae importe, detalle y medio de pago de la última carga" style={{ color: C.cel, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>usar el último ({$fmt(filas[0].importe)}{filas[0].detalle ? ` · ${filas[0].detalle}` : ""}) ›</span></div>
        </>)}
      </>)}
      {editar && (
        <React.Suspense fallback={null}>
          <VerFacturaDiferida rowId={editar} vistaInicial="editar"
            onClose={() => { setEditar(null); setRecarga((n) => n + 1); refrescarCompras(qc); }} />
        </React.Suspense>
      )}
    </div>
  );
}
