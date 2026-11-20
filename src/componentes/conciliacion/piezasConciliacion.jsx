/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- partes de ModuloConciliacion.jsx (separadas sin cambiar lógica, 15/11/2026) */
/* Piezas de pantalla chicas de la conciliación: celdas, encabezados, filtros, modales (cuenta, importar, instructivo). */
import React from "react";
import { C, fmt, fmtFecha } from './motorConciliacion';

// Cabecera de grupo "Cuenta corriente" en las listas de Todas / Conciliadas
export function GrupoCCHead({ label, n, total, open, onToggle }) {
  return (
    <div data-keep-sel onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#7c5fd30f", position: "sticky", top: 0, zIndex: 2 }}>
      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: "#7c5fd3" }}>{"🧾"} {label}</span>
      <span style={{ fontSize: 11, color: C.txt3 }}>{n}</span>
      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: "#7c5fd3" }}>{fmt(total)}</span>
    </div>
  );
}

// Caja de búsqueda con lista de resultados desplegable
export function BuscadorBox({ icon, placeholder, value, onChange, results, onPick, lado }) {
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
              <span style={{ fontSize: 11, color: C.txt3, width: 38, flexShrink: 0 }}>{r.hora || "—"}</span>
              <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lado === "ing" ? <React.Fragment><b style={{ color: C.tinta, fontWeight: 600 }}>{r.comp || "—"}</b>{r.nombre ? " · " + r.nombre : ""}</React.Fragment> : (r.nombre || "—")}
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
export function FormaEditor({ actual, onSet }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      <span style={{ fontSize: 11, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px" }}>Forma de pago:</span>
      {[["mp", "MercadoPago"], ["efec", "Efectivo"]].map(([k, l]) => (
        <button key={k} onClick={(e) => { e.stopPropagation(); onSet(k); }} style={{ border: "1px solid " + (actual === k ? C.celeste : C.line2), background: actual === k ? "#5BC2EA18" : C.white, color: actual === k ? C.celesteDeep : C.txt2, borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer" }}>{l}</button>
      ))}
    </div>
  );
}

// Pestaña «Cuenta corriente» del modal del cliente (facturas + cobranzas + saldo)
// Celular (19/11): el modal va a pantalla completa y las dos listas, una arriba de la otra.
const esCelu = () => typeof window !== "undefined" && window.innerWidth < 600;
function CuentaMovs({ cuenta, diaFoco }) {
  const c = cuenta;
  const celu = esCelu();
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
  // PERÍODO del modal: Todo · Este mes · Mes anterior · Este año · Personalizado.
  // Filtra las dos listas y Facturado/Cobrado; el Saldo es el acumulado al cierre
  // del período (lo que la cuenta debía ese día). El estado de cada compra se
  // calcula siempre con toda la historia.
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const hoy = new Date();
  const [per, setPer] = React.useState("todo");
  const [perD, setPerD] = React.useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [perH, setPerH] = React.useState(iso(hoy));
  const rango = per === "mes" ? [iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))]
    : per === "ant" ? [iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0))]
    : per === "anio" ? [hoy.getFullYear() + "-01-01", hoy.getFullYear() + "-12-31"]
    : per === "pers" ? [perD || "0000-00-00", perH || "9999-12-31"]
    : null;
  const enRango = (d) => !rango || (d && d >= rango[0] && d <= rango[1]);
  const hastaR = (d) => !rango || (d && d <= rango[1]);
  const fmtFA = (d) => { const p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0].slice(2); };
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
  const fVis = fEst.filter((f) => enRango(f.fecha));
  const cVis = c.cob.filter((k) => enRango(k.fecha));
  const kFact = rango ? fVis.reduce((a, f) => a + f.total, 0) : c.facturado;
  const kCob = rango ? fVis.filter((f) => f.c !== "cc").reduce((a, f) => a + f.total, 0) + cVis.reduce((a, k) => a + k.imp, 0) : c.cobrado;
  const kSaldo = rango ? (c.fact.filter((f) => hastaR(f.fecha)).reduce((a, f) => a + f.total, 0) - c.fact.filter((f) => f.c !== "cc" && hastaR(f.fecha)).reduce((a, f) => a + f.total, 0) - c.cob.filter((k) => hastaR(k.fecha)).reduce((a, k) => a + k.imp, 0)) : c.saldo;
  const listF = fVis.slice().sort((a, b) => sF.d * cmp(valF(a, sF.k), valF(b, sF.k)) || -cmp(valF(a, "fecha"), valF(b, "fecha")));
  const listC = cVis.slice().sort((a, b) => sC.d * cmp(valC(a, sC.k), valC(b, sC.k)) || -cmp(valC(a, "fecha"), valC(b, "fecha")));
  const totImp = fVis.filter((f) => f.estado !== "pagada").length;
  const nDiaF = diaFoco ? fVis.filter((f) => f.fecha === diaFoco).length : 0;
  const nDiaC = diaFoco ? cVis.filter((k) => k.fecha === diaFoco).length : 0;
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
        {label}{on ? (s.d > 0 ? " ▲" : " ▼") : ""}
      </span>
    );
  };
  const colHead = { display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#F7F9FB", borderBottom: "1px solid " + C.line2 };
  const titulo = { padding: "8px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", color: C.tinta, fontWeight: 800, background: "#00000006", borderBottom: "1px solid " + C.line, display: "flex", justifyContent: "space-between" };
  return (
      <>
        <div data-tour="cc-periodo" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "12px 18px 0", flexShrink: 0 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 800, marginRight: 4 }}>Período</span>
          {[["todo", "Todo"], ["mes", "Este mes"], ["ant", "Mes anterior"], ["anio", "Este año"], ["pers", "Personalizado"]].map(([k, l]) => (
            <button key={k} onClick={() => setPer(k)}
              style={{ height: 30, padding: "0 12px", borderRadius: 15, cursor: "pointer", fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: 700, border: "1px solid " + (per === k ? C.celeste : C.line2), background: per === k ? "#5BC2EA1f" : C.white, color: per === k ? C.celesteDeep : C.txt2, whiteSpace: "nowrap" }}>{l}</button>
          ))}
          {per === "pers" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <input type="date" value={perD} max={perH || undefined} onChange={(e) => setPerD(e.target.value)} style={{ height: 30, boxSizing: "border-box", padding: "0 8px", borderRadius: 8, border: "1px solid " + C.line2, fontFamily: "'Archivo',sans-serif", fontSize: 12, color: C.txt }} />
              <span style={{ fontSize: 12, color: C.txt3 }}>al</span>
              <input type="date" value={perH} min={perD || undefined} onChange={(e) => setPerH(e.target.value)} style={{ height: 30, boxSizing: "border-box", padding: "0 8px", borderRadius: 8, border: "1px solid " + C.line2, fontFamily: "'Archivo',sans-serif", fontSize: 12, color: C.txt }} />
            </span>
          )}
          {rango && <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.txt3, whiteSpace: "nowrap" }}>{fmtFA(rango[0])} – {fmtFA(rango[1])}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "14px 18px", flexShrink: 0 }}>
          {[["Facturado", kFact, C.tinta], ["Cobrado", kCob, C.green], [rango ? "Saldo al " + fmtFA(rango[1] < iso(hoy) ? rango[1] : iso(hoy)) : "Saldo", kSaldo, kSaldo > 0 ? C.amber : C.green]].map(([l, v, col]) => (
            <div key={l} style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 10, padding: "9px 14px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 700 }}>{l}{rango && !l.startsWith("Saldo") ? <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}> · en el período</span> : null}</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: col }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
        {/* listas: cada columna scrollea por su cuenta, con títulos fijos y ordenables */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: celu ? "minmax(0, 1fr)" : "minmax(0, 1.35fr) minmax(0, 1fr)", gridTemplateRows: celu ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", margin: celu ? "0 10px 10px" : "0 18px 18px", border: "1px solid " + C.line2, borderRadius: 10, overflow: "hidden", background: C.white }}>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, [celu ? "borderBottom" : "borderRight"]: "1px solid " + C.line }}>
            <div style={titulo}><span>Compras ({fVis.length}){nDiaF > 0 && <span style={{ color: C.celesteDeep }}> · {nDiaF} del {fmtF(diaFoco)}</span>}</span>{totImp > 0 && <span style={{ color: C.amber }}>{totImp} con saldo</span>}</div>
            <div style={colHead}>
              <Th label="Fecha" k="fecha" s={sF} set={setSF} w={78} />
              <Th label="Comprobante" k="comp" s={sF} set={setSF} flex />
              {!celu && <Th label="Medio" k="medio" s={sF} set={setSF} w={52} />}
              <Th label="Importe" k="imp" s={sF} set={setSF} w={84} right />
              <Th label="Estado" k="estado" s={sF} set={setSF} w={58} right />
            </div>
            <div ref={refF} style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative" }}>
              {listF.length ? listF.map((f, i) => (
                <div key={f.id || i} data-foco={f.fecha === diaFoco ? "1" : undefined} data-sel={selComp && nComp(f.comp) === selComp ? "1" : undefined} onClick={() => toggleComp(f.comp)} title="Ver los cobros de este comprobante"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: "pointer", background: f.estado === "impaga" ? "#d94f6306" : f.estado === "parcial" ? "#c77d0806" : undefined, ...(f.fecha === diaFoco ? marca : {}), ...(selComp && nComp(f.comp) === selComp ? marcaSel : {}) }}>
                  <span style={{ width: 78, flexShrink: 0, fontSize: 11, color: f.fecha === diaFoco ? C.celesteDeep : C.txt3, fontWeight: f.fecha === diaFoco ? 700 : 400, whiteSpace: "nowrap" }}>{fmtF(f.fecha)}{f.hora ? <span style={{ opacity: 0.7 }}> {f.hora}</span> : null}</span>
                  <span style={{ flex: 1, minWidth: 0, color: C.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.comp}</span>
                  {!celu && <span style={{ width: 52, flexShrink: 0, fontSize: 10.5, color: f.c === "cc" ? "#7c5fd3" : C.txt3, fontWeight: f.c === "cc" ? 700 : 400 }}>{medioLbl[f.c] || "—"}</span>}
                  <span style={{ width: 84, flexShrink: 0, textAlign: "right", fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.tinta }}>{fmt(f.total)}</span>
                  <span style={{ width: 58, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}><span style={{ fontSize: 8.5, fontWeight: 800, borderRadius: 5, padding: "1px 5px", textTransform: "uppercase", background: f.estado === "pagada" ? "#1a9c6e1c" : f.estado === "parcial" ? "#c77d081c" : "#d94f631c", color: f.estado === "pagada" ? C.green : f.estado === "parcial" ? C.amber : C.red }}>{f.estado}</span></span>
                </div>
              )) : <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.txt3 }}>{rango ? "Sin compras en este período" : "Sin ventas en el período cargado"}</div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={titulo}><span>Cobranzas ({cVis.length}){nDiaC > 0 && <span style={{ color: C.celesteDeep }}> · {nDiaC} del {fmtF(diaFoco)}</span>}</span></div>
            <div style={colHead}>
              <Th label="Fecha" k="fecha" s={sC} set={setSC} w={58} />
              <Th label="Medio / pagador" k="medio" s={sC} set={setSC} flex />
              <Th label="Importe" k="imp" s={sC} set={setSC} w={90} right />
            </div>
            {selComp && (
              <div style={{ padding: "7px 14px", borderBottom: "1px solid " + C.line, background: "#1a9c6e10", fontSize: 11.5, color: C.txt2, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: C.tinta }}>{(compSel && compSel.comp) || (cobSel[0] && cobSel[0].paga) || selComp}</b>{" → "}
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
              )) : <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.txt3 }}>{rango ? "Sin cobranzas en este período" : "Sin cobranzas"}</div>}
            </div>
          </div>
        </div>
      </>
  );
}

// Modal del cliente (Diego 19/11/2026): se abre desde un nombre de la conciliación o desde
// CLIENTES en el header, vacío y con el buscador. Dos pestañas: Cuenta corriente y Ficha.
const fDMA = (d) => { if (!d) return "—"; const p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0].slice(2); };

function BuscadorCliente({ valor, clientes, onElegir, autoFocus }) {
  const [txt, setTxt] = React.useState(null); // null = muestra el cliente elegido
  const [abierto, setAbierto] = React.useState(!!autoFocus);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!abierto) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAbierto(false); setTxt(null); } };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [abierto]);
  const q = String(txt || "").toLowerCase().trim();
  const opciones = (clientes || []).filter((c) => !q || c.nombre.toLowerCase().includes(q)).slice(0, 60);
  const elegir = (c) => { onElegir(c.nombre); setTxt(null); setAbierto(false); };
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 420 }}>
      <input value={txt == null ? (valor || "") : txt} autoFocus={autoFocus} placeholder="Buscá un cliente…"
        onFocus={(e) => { setAbierto(true); e.target.select(); }} onChange={(e) => { setTxt(e.target.value); setAbierto(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" && opciones[0]) elegir(opciones[0]); if (e.key === "Escape") { setAbierto(false); setTxt(null); } }}
        style={{ width: "100%", boxSizing: "border-box", height: 40, padding: "0 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.1)", color: C.white, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, outline: "none" }} />
      {abierto && (
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 5, background: C.white, borderRadius: 10, boxShadow: "0 12px 30px rgba(0,0,0,.25)", maxHeight: 340, overflowY: "auto" }}>
          {opciones.length ? opciones.map((c) => (
            <div key={c.key} onMouseDown={(e) => { e.preventDefault(); elegir(c); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", minHeight: 40, borderBottom: "1px solid " + C.line, cursor: "pointer", fontSize: 13, color: C.tinta }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#5BC2EA14"; }} onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{c.nombre}</span>
              {c.saldo > 0 && <span style={{ fontSize: 11.5, color: C.amber, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>debe {fmt(c.saldo)}</span>}
            </div>
          )) : <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.txt3 }}>Ningún cliente coincide.</div>}
        </div>
      )}
    </div>
  );
}

// Pestaña «Ficha»: lo que Lazarillo sabe del cliente, sacado del POS (ventas y cobranzas) y de la
// conciliación (pagadores). Solo lectura: nada se escribe en el POS.
function FichaCliente({ c, onQuitarPagador }) {
  const fact = c.fact || [];
  const fechas = fact.map((f) => f.fecha).filter(Boolean).sort();
  const n = fact.length;
  const porMedio = { cc: 0, mp: 0, efec: 0, otro: 0 };
  fact.forEach((f) => { porMedio[f.c] = (porMedio[f.c] || 0) + f.total; });
  const tot = c.facturado || 0;
  const pct = (x) => (tot ? Math.round((x / tot) * 100) : 0);
  // «cardholder_name» es el texto de relleno de Mercado Pago cuando no manda el nombre: no es un pagador.
  const pagadores = (c.pagadores || []).filter((pg) => !/^cardholder[_ ]?name$/i.test(String(pg.nombre || "").trim()));
  const ultCob = (c.cob || []).map((k) => k.fecha).filter(Boolean).sort().pop();
  const caja = { background: C.white, border: "1px solid " + C.line2, borderRadius: 10, padding: "12px 16px" };
  const tit = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 800, marginBottom: 8 };
  const Dato = ({ l, v, gris }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: "1px solid " + C.line }}>
      <span style={{ width: 150, flexShrink: 0, fontSize: 12, color: C.txt3 }}>{l}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: v ? C.tinta : C.txt3, fontWeight: v ? 600 : 400, overflowWrap: "anywhere" }}>{v || gris || "—"}</span>
    </div>
  );
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, alignContent: "start" }}>
      <div style={caja}>
        <div style={tit}>Datos del cliente en el POS</div>
        <Dato l="Nombre" v={c.cliente} />
        <Dato l="Nº de cliente" v={c.codCli} gris="—" />
        <Dato l="CUIT / DNI" v={c.cuit} gris="sin dato" />
        <Dato l="Teléfono" v={c.tel} gris="sin dato" />
        {(c.sucursales || []).length > 0 && <Dato l="Sucursales" v={c.sucursales.join(", ")} />}
        <div style={{ fontSize: 11.5, color: C.txt3, marginTop: 8, lineHeight: 1.45 }}>Salen de las ventas y cobranzas que trae el POS. Email, dirección y tope de crédito todavía no se traen.</div>
      </div>
      <div style={caja}>
        <div style={tit}>Cómo compra</div>
        <Dato l="Primera compra" v={fechas[0] ? fDMA(fechas[0]) : ""} />
        <Dato l="Última compra" v={fechas.length ? fDMA(fechas[fechas.length - 1]) : ""} />
        <Dato l="Compras" v={n ? n + " · ticket promedio " + fmt(tot / n) : ""} />
        <Dato l="Cómo paga" v={tot ? [["cc", "Cta cte"], ["mp", "Mercado Pago"], ["efec", "Efectivo"], ["otro", "Otros"]].filter(([k]) => porMedio[k]).map(([k, l]) => l + " " + pct(porMedio[k]) + "%").join(" · ") : ""} />
        <Dato l="Último cobro de cta cte" v={ultCob ? fDMA(ultCob) : ""} />
        <Dato l="Saldo" v={<span style={{ color: c.saldo > 0 ? C.amber : C.green }}>{fmt(c.saldo)}</span>} />
        <div style={{ fontSize: 11.5, color: C.txt3, marginTop: 8 }}>Con lo que está cargado en Lazarillo.</div>
      </div>
      <div style={{ ...caja, gridColumn: "1 / -1" }}>
        <div style={tit}>{"🔗"} Pagadores conocidos</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {pagadores.length ? pagadores.map((pg) => (
            <span key={pg.key} title={"Pagó " + pg.veces + (pg.veces === 1 ? " vez" : " veces") + ". La conciliación lo usa para reconocer sus pagos."}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#5BC2EA14", border: "1px solid #5BC2EA66", color: C.celesteDeep, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12.5, fontWeight: 600 }}>
              {pg.nombre}
              <span style={{ fontSize: 10.5, color: C.txt3, fontWeight: 700 }}>×{pg.veces}{pg.ultimo ? " · " + fDMA(pg.ultimo) : ""}</span>
              {onQuitarPagador && <button onClick={() => onQuitarPagador(pg.key)} title="Quitar: no es pagador de esta cuenta" style={{ border: "none", background: "transparent", color: C.txt3, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>×</button>}
            </span>
          )) : <span style={{ fontSize: 12.5, color: C.txt3 }}>Todavía ninguno. Se graban solos cuando una cobranza de este cliente se concilia con su pago.</span>}
        </div>
      </div>
    </div>
  );
}

export function CuentaModal({ cuenta, clientes, onElegir, onClose, onQuitarPagador, diaFoco }) {
  const c = cuenta;
  const celu = esCelu();
  const [tab, setTab] = React.useState("cc");
  React.useEffect(() => {
    const f = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  const pest = (k, l) => (
    <button key={k} type="button" onClick={() => setTab(k)} disabled={!c}
      style={{ height: 44, padding: "0 16px", border: "none", background: "transparent", cursor: c ? "pointer" : "default", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: !c ? C.txt3 : tab === k ? C.celesteDeep : C.txt2, boxShadow: c && tab === k ? "inset 0 -3px 0 " + C.celeste : "none" }}>{l}</button>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(18,17,31,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: celu ? 0 : 20 }}>
      <div data-tour="cc-modal" onClick={(e) => e.stopPropagation()} style={{ background: C.paper, borderRadius: celu ? 0 : 14, width: celu ? "100%" : "min(920px, 96vw)", height: celu ? "100%" : "min(760px, 90vh)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 12px 18px", background: C.tinta, flexShrink: 0 }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "#5BC2EA33", color: C.celeste, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{c ? (c.cliente || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "?"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "#8fa0c0", fontWeight: 700, marginBottom: 3 }}>Cliente</div>
            <BuscadorCliente key={c ? c.cliente : ""} valor={c ? c.cliente : ""} clientes={clientes} onElegir={onElegir} autoFocus={!c} />
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.12)", color: C.white, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 10px", background: C.white, borderBottom: "1px solid " + C.line, flexShrink: 0 }}>
          {pest("cc", "Cuenta corriente")}
          {pest("ficha", "Ficha")}
        </div>
        {!c
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, color: C.txt3, padding: 20, textAlign: "center" }}>Buscá un cliente arriba para ver su cuenta corriente y su ficha.</div>
          : tab === "ficha" ? <FichaCliente c={c} onQuitarPagador={onQuitarPagador} />
          : <CuentaMovs key={c.cliente} cuenta={c} diaFoco={diaFoco} />}
      </div>
    </div>
  );
}

// ─── Estilos reutilizables ──────────────────────────────────────────
export const inputStyle = { fontFamily: "'Archivo',sans-serif", fontSize: 15, padding: "9px 12px", borderRadius: 10, border: "1px solid " + C.line2, background: C.white, color: C.txt, cursor: "pointer" };
export const ghostBtn = { fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, padding: "10px 18px", borderRadius: 10, border: "1px solid " + C.line2, background: C.white, color: C.txt2, cursor: "pointer" };
export const fldLbl = { fontSize: 13, color: C.txt3, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 700 };

export function Field({ label, children }) {
  return <div><label style={{ ...fldLbl, display: "block", marginBottom: 3 }}>{label}</label>{children}</div>;
}

// Panel que se minimiza/maximiza (mismo patrón que el sector de fuentes+período)
export function PanelColapsable({ titulo, resumen, open, onToggle, children }) {
  if (!open) return (
    <div data-keep-sel onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, background: C.white, border: "1px solid " + C.line2, borderRadius: 12, padding: "10px 16px", marginTop: 16, cursor: "pointer" }}>
      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.tinta }}>{titulo}</span>
      {resumen && <span style={{ fontSize: 12.5, color: C.txt3 }}>{resumen}</span>}
      <span style={{ marginLeft: "auto", color: C.celesteDeep, fontSize: 13, fontWeight: 700 }}>{"▾"} Desplegar</span>
    </div>
  );
  return (
    <div data-keep-sel style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 12, overflow: "hidden", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid " + C.line, background: C.paper }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.tinta }}>{titulo}</span>
        {resumen && <span style={{ fontSize: 12.5, color: C.txt3 }}>{resumen}</span>}
        <button onClick={onToggle} style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, color: C.txt3, background: "transparent", border: "1px solid " + C.line2, borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{"▴"} Minimizar</button>
      </div>
      {children}
    </div>
  );
}

// Tooltip propio (el title nativo no siempre se ve dentro del iframe)
export function InfoTip({ text }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ cursor: "help", color: C.celesteDeep, fontWeight: 700 }}>{"ⓘ"}</span>
      {show && (
        <span style={{ position: "absolute", bottom: "150%", left: "50%", transform: "translateX(-50%)", background: C.tinta, color: C.paper, fontSize: 12, fontWeight: 400, lineHeight: 1.45, padding: "9px 11px", borderRadius: 9, width: 250, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.28)", textTransform: "none", letterSpacing: 0, whiteSpace: "normal" }}>{text}</span>
      )}
    </span>
  );
}

// ─── Uploader card ──────────────────────────────────────────────────
export function UploaderCard({ fuente, loaded, onOpen }) {
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
export function Kpi({ label, value, tone, sub }) {
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
export function Panel({ children }) {
  return <div style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 560 }}>{children}</div>;
}
export function PanelHead({ titulo, count, tabs, active, onTab, colMenu, onToggleColMenu, allCols, visibleCols, onToggleCol, grouped }) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.line, display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", minHeight: 52, gap: 10 }}>
      <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: C.tinta }}>{titulo}</span> <span style={{ fontSize: 13, color: C.txt3 }}>{count}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {tabs && <div style={{ display: "flex", gap: 3, background: C.paper, borderRadius: 8, padding: 2 }}>
          {tabs.map(([f, lbl]) => (
            <button key={f} onClick={() => onTab(f)} style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: active === f ? C.white : "transparent", color: active === f ? C.celesteDeep : C.txt3, boxShadow: active === f ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>{lbl}</button>
          ))}
        </div>}
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
export function ColMenu({ allCols, visible, onToggle, grouped }) {
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
export function SubFilter({ active, onTab }) {
  const opts = [["all","Todos"],["cupon","por cupón"],["uno","1 a 1"],["iguales","iguales"],["consecutivos","consecutivos"],["cliente","grupo cliente"],["combinado","combinado"],["porhora","por hora"],["manual","manual"],["faltante","con faltante"]];
  // gradiente verde → naranja: cuanto más a la derecha, más chance de que la
  // automatización falle en ese tipo de match.
  const tono = { cupon: "#13865c", uno: "#1a9c6e", iguales: "#489c40", consecutivos: "#6f9426", cliente: "#94881a", combinado: "#b5820e", porhora: "#c77d08", manual: C.celesteDeep, faltante: "#d94f63" };
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
export function DynThead({ allCols, visible, sort, onSort, side, rows, colFilter, setColFilter, openKey, setOpenKey, hidden }) {
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
export function ColFilterMenu({ campo, label, rows, cellVal, excluded, onApply, onClose, align }) {
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
export function ckBox(on) {
  return { width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (on ? C.celeste : C.line2), background: on ? C.celeste : "transparent", color: C.noche, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
}
export function Rows({ children, innerRef }) { return <div ref={innerRef} style={{ overflowY: "auto", flex: 1 }}>{children}</div>; }
export function Empty() { return <div style={{ padding: 40, textAlign: "center", color: C.txt3, fontSize: 15 }}>Sin registros</div>; }

export const rowBase = { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid " + C.line, fontSize: 14.5 };
export const dot = (c) => ({ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: c });
export const fCell = { color: C.txt3, fontSize: 13, width: 74, flexShrink: 0 };
export const cliCell = { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14, color: C.txt2 };
export const descCell = { flexShrink: 0, fontSize: 13.5, color: C.txt3 };
export const impCell = { fontFamily: "'Sora',sans-serif", fontWeight: 700, marginLeft: "auto", flexShrink: 0 };
export const tag = (bg, fg) => ({ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", padding: "1px 6px", borderRadius: 8, flexShrink: 0, background: bg, color: fg });

// Formatea el valor de una celda según la columna
export function cellValue(row, col, side) {
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
export function NotaEditor({ value, onSave }) {
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
export function TipChip({ tip, onToggle }) {
  const has = tip > 0;
  return (
    <span onClick={(e) => { e.stopPropagation(); onToggle(); }} title={has ? "Editar propina" : "Marcar propina de este movimiento"}
      style={{ flexShrink: 0, cursor: "pointer", marginLeft: 8, fontSize: 10, fontWeight: 800, fontFamily: "'Sora',sans-serif", background: has ? "#c77d0822" : "transparent", color: has ? C.amber : C.txt3, border: "1px solid " + (has ? C.amber : C.line2), borderRadius: 7, padding: "2px 7px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
      {has ? "propina " + fmt(tip) : "+ propina"}
    </span>
  );
}
export function TipEditor({ value, max, onSave, onTodo, onQuitar, defaultDif }) {
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
export function NotaChip({ nota, onToggle }) {
  const [hover, setHover] = React.useState(false);
  const has = !!(nota && nota.length);
  return (
    <span className={"cx-note" + (has ? " has" : "")} style={{ position: "relative", flexShrink: 0, cursor: "pointer", fontSize: 13, lineHeight: 1, color: has ? C.celesteDeep : C.txt3, marginLeft: 8 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onToggle(); }} title={has ? "" : "Agregar observación"}>
      {"🗒"}
      {has && hover && (
        <span style={{ position: "absolute", bottom: "150%", right: 0, zIndex: 70, background: C.tinta, color: C.paper, fontSize: 12, fontWeight: 400, lineHeight: 1.4, padding: "8px 10px", borderRadius: 8, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,.28)", whiteSpace: "normal", textAlign: "left", textTransform: "none", letterSpacing: 0 }}>{nota}</span>
      )}
    </span>
  );
}

// ─── Modal de importación ───────────────────────────────────────────
export function ImportModal({ fuente, business, onClose, onFile, onHelp }) {
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
export function InstructivoModal({ instructivo, onClose }) {
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
export function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(18,17,31,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// Aviso cuando un archivo subido no tiene las columnas imprescindibles.
export function ColErrorModal({ error, onClose }) {
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
