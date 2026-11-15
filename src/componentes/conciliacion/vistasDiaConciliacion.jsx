/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- partes de ModuloConciliacion.jsx (separadas sin cambiar lógica, 15/11/2026) */
/* Vistas por día y pendientes de la conciliación: barra del día, calendario, filas agrupadas, filas dinámicas, sugerencias. */
import React from "react";
import { C, MESES_ES, fmt, fmtFecha } from './motorConciliacion';
import { FormaEditor, NotaChip, NotaEditor, TipChip, TipEditor, cellValue, dot, rowBase, tag } from './piezasConciliacion';

// Grupo de un mes de pendientes (open/onToggle controlado desde afuera, así se
// abre/cierra de los dos lados a la vez)
export function MesPend({ grupo, open, onToggle, notaFn }) {
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
        <span style={{ color: C.celesteDeep, fontSize: 11, width: 12, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
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
              <span style={{ color: C.celesteDeep, fontSize: 10, width: 12, flexShrink: 0 }}>{dOpen ? "▾" : "▸"}</span>
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
export function PendItem({ r, notaFn, selected, onToggleSel, tipFn, tipVal }) {
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

// Barra comparativa. Sin selección: totales del filtro activo.
// Con selección: totales de lo seleccionado + botón Conciliar.
// Panel de sugerencias de conciliación. Lista los pares probables del día;
// al pasar el mouse por uno, se resalta ese par en las tablas.
export function SugerenciasPanel({ sugerencias, activa, dayCenter, onMoveDay, canPrev, canNext, onSelect, onAplicar, onDescartar }) {
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
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3, fontWeight: 700 }}>Ingreso{s.ingIds.length > 1 ? " ×" + s.ingIds.length : ""}{s.conCC && <span style={{ color: "#7c5fd3", fontWeight: 800 }}> · {"🧾"} cta. cte.</span>}</span>
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

export function DayCompareBar({ ing, ban, ctxIng, ctxBan, refIng, refBan, cntIng, cntBan, cntIngRef, cntBanRef, conc, onDif, difFiltro, tipsTotal, tipsDia, haySeleccion, readonly, selIngTotal, selBanTotal, selIngCount, selBanCount, onConciliar, onLimpiar, onDesarmar, onEditar }) {
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
        {(() => { const tv = tipsDia != null ? tipsDia : tipsTotal; return tv > 0 ? <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid " + C.line, fontSize: 9.5, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: ".3px" }}>{"🪙"} propinas {fmt(tv)}</div> : null; })()}
      </div>
    </div>
  );
}

// Navegador de día ‹ Día › (para vista por día en pendientes)
export function DayNav({ center, tol, onMove, canPrev, canNext, diasPend, onPick, desde, hasta }) {
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
              {"📅"} {lbl || "Elegir día"} <span style={{ fontSize: 10, color: C.celesteDeep }}>{cal ? "▴" : "▾"}</span></button>
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
export function CalendarioPend({ center, diasPend, desde, hasta, onPick }) {
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
export function DayGroupedRows({ rows, windowDays, center, renderRow, innerRef, groupEqual, expandedGroups, onToggleGroup, tailCols, selBan, onToggleGroupSel, sort, faltantes }) {
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

// Vista por día COMPARTIDA (opción B): una banda de día a lo ancho, y debajo
// ingresos a la izquierda y banco a la derecha. Las dos columnas se estiran a la
// misma altura (flex stretch), así la banda del día siempre queda alineada.
export function DiaCompartido({ ingRows, banRows, windowDays, center, innerRef, renderIng, renderBan, faltantes, tipDia, selIng, selBan, onSelDia, efectivoDia, efectivoOpen, onToggleEfectivo, efectivoSosp, selEfec, onToggleEfec, ccDia, ccOpen, onToggleCC, onCliente, tieneCuentaFn, formaFn, selCC, onToggleCCSel, ccConc }) {
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
                <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12.5, color: C.celeste }}>banco {fmt(totBan)}{tipDia && tipDia[g.d] > 0 ? <span style={{ color: C.amber }}> · {"🪙"} {fmt(tipDia[g.d])}</span> : null}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid " + C.line }}>
                {efectivoDia && efectivoDia[g.d] && efectivoDia[g.d].items.length > 0 && (() => { const ef = efectivoDia[g.d]; const open = efectivoOpen && efectivoOpen.has(g.d); const sospItems = ef.items.filter((f) => efectivoSosp && efectivoSosp[f.id]); const nSosp = sospItems.length; const nEx = sospItems.filter((f) => efectivoSosp[f.id].exacto).length; return (
                  <div>
                    <div onClick={(e) => { e.stopPropagation(); onToggleEfectivo && onToggleEfectivo(g.d); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: nEx ? "#d94f630c" : (nSosp ? "#c77d080c" : "#00000006"), opacity: g.isCenter ? 1 : 0.62 }}>
                      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: C.txt3 }}>{"💵"} Efectivo</span>
                      <span style={{ fontSize: 11, color: C.txt3 }}>{ef.items.length} comprob.</span>
                      {nSosp > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: "#d94f631c", color: C.red, borderRadius: 6, padding: "1px 6px" }}>{"⚠"} {nSosp} posible{nSosp === 1 ? "" : "s"} error{nSosp === 1 ? "" : "es"} de caja</span>}
                      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: C.txt2 }}>{fmt(ef.total)}</span>
                    </div>
                    {open && ef.items.map((f, i) => { const sosp = efectivoSosp && efectivoSosp[f.id]; const col = sosp ? (sosp.exacto ? C.red : C.amber) : C.txt3; const sel = selEfec && selEfec.has(f.id); const fp = formaFn ? formaFn(f) : null; return (
                      <React.Fragment key={i}>
                      <div onClick={(e) => { e.stopPropagation(); onToggleEfec && onToggleEfec(f.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px 5px 14px", borderBottom: "1px solid " + C.line, fontSize: 12, cursor: "pointer", background: sel ? "#5BC2EA14" : (sosp ? (sosp.exacto ? "#d94f630e" : "#c77d080e") : "#00000003"), boxShadow: sosp && !sel ? "inset 3px 0 0 " + col : (sel ? "inset 3px 0 0 " + C.celeste : undefined), opacity: g.isCenter ? 1 : 0.62 }}>
                        <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (sel ? C.celeste : C.line2), background: sel ? C.celeste : C.white, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel ? "✓" : ""}</span>
                        <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{f.hora || "—"}</span>
                        <span style={{ flex: 1, minWidth: 0, color: col, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.comp}{sosp && <span style={{ fontWeight: 700 }} title={"Este efectivo de " + fmt(f.total) + " coincide EXACTO con un movimiento de banco pendiente del mismo día" + (sosp.banHora ? " (" + sosp.banHora + ")" : "") + " — quizás entró por banco y el cajero lo cargó como efectivo"}> · {"⚠"} = banco pend. {fmt(sosp.banImp)}{sosp.banHora ? " " + sosp.banHora : ""}</span>}</span>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: sosp ? col : C.txt2, textAlign: "right", flexShrink: 0 }}>{fmt(f.total)}</span>
                        <span onClick={fp ? (e) => { e.stopPropagation(); fp.onToggleForma(); } : undefined} title={fp ? "Corregir forma de pago (error de carga)" : ""} style={{ width: 100, flexShrink: 0, fontSize: 11, color: fp ? C.celesteDeep : C.txt3, textTransform: "uppercase", letterSpacing: ".3px", cursor: fp ? "pointer" : "default", textDecoration: fp ? "underline" : "none", textDecorationColor: "rgba(36,146,200,.35)" }}>Efectivo{fp ? " ✎" : ""}</span>
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
                    : r.estado === "erp" ? "ERP: cobrada " + fC(r.cobroFecha) + " · falta en banco"
                    : r.estado === "galicia" ? "ERP: cobrada por Galicia " + fC(r.cobroFecha) + " · banco no cargado"
                    : r.estado === "otro" ? "cobro de ticket anterior" + (r.ticketFecha ? " (" + fC(r.ticketFecha) + ")" : "") + " · falta en banco"
                    : "saldada" + (r.cobroFecha ? " " + fC(r.cobroFecha) : "") + ((r.formas || []).some((f) => f !== "banco") ? " · " + r.formas.filter((f) => f !== "banco").join("/") : "");
                  return (
                  <div>
                    <div onClick={(e) => { e.stopPropagation(); onToggleCC && onToggleCC(g.d); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderBottom: "1px solid " + C.line, cursor: "pointer", background: "#7c5fd30c", opacity: g.isCenter ? 1 : 0.62 }}>
                      <span style={{ color: C.txt3, fontSize: 10, width: 10, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", color: "#7c5fd3" }}>{"🧾"} Cuenta corriente</span>
                      <span style={{ fontSize: 11, color: C.txt3 }}>{pendCC.length ? pendCC.length + " impaga" + (pendCC.length === 1 ? "" : "s") : "todas saldadas"}</span>
                      {concCC.length > 0 && <span onClick={(e) => { e.stopPropagation(); setVerConcCC((s) => { const n = new Set(s); n.has(g.d) ? n.delete(g.d) : n.add(g.d); return n; }); if (!open && onToggleCC) onToggleCC(g.d); }}
                        title={verConc ? "Ocultar las ya saldadas" : "Ver las ya saldadas (" + fmt(totConc) + ")"}
                        style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".3px", background: verConc ? "#1a9c6e" : "#1a9c6e1c", color: verConc ? C.white : C.green, borderRadius: 6, padding: "1px 6px", cursor: "pointer" }}>{"✓"} {concCC.length} saldada{concCC.length === 1 ? "" : "s"} {verConc ? "▴" : "▾"}</span>}
                      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: pendCC.length ? "#7c5fd3" : C.txt3 }}>{fmt(totPend)}</span>
                    </div>
                    {open && lista.map((r) => { const clic = onCliente && r.cliente && (!tieneCuentaFn || tieneCuentaFn(r.cliente)); const conc = r.saldado; const selec = r.cobroIds.length > 0; const sel = selec && selCC && r.cobroIds.every((id) => selCC.has(id)); return (
                      <div key={r.key} onClick={(e) => { e.stopPropagation(); if (!conc && selec && onToggleCCSel) onToggleCCSel(r.cobroIds); }}
                        title={r.estado === "impaga" ? "El ERP no tiene cobro de este ticket: queda impaga hasta que se cobre" : r.estado === "erp" ? "Tildalo para conciliar su cobro con el pago del banco" : r.estado === "galicia" ? "Se cobró por Banco Galicia: se va a conciliar cuando carguemos ese banco" : ""}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px", borderBottom: "1px solid " + C.line, fontSize: 12, cursor: !conc && selec ? "pointer" : "default", background: sel ? "#5BC2EA14" : (conc ? "#1a9c6e0a" : "#7c5fd306"), boxShadow: sel ? "inset 3px 0 0 " + C.celeste : (conc ? "inset 3px 0 0 " + C.green : undefined), opacity: g.isCenter ? 1 : 0.62 }}>
                        {conc
                          ? <span title="Saldada: su pago está conciliado" style={{ width: 15, height: 15, borderRadius: 4, background: C.green, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{"✓"}</span>
                          : selec
                            ? <span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid " + (sel ? C.celeste : C.line2), background: sel ? C.celeste : C.white, color: C.white, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel ? "✓" : ""}</span>
                            : <span style={{ width: 15, flexShrink: 0 }} />}
                        <span style={{ fontSize: 11, color: C.txt3, width: 40, flexShrink: 0 }}>{r.hora || "—"}</span>
                        <span onClick={clic ? (e) => { e.stopPropagation(); onCliente(r.cliente); } : undefined} style={{ flex: 1, minWidth: 0, color: clic ? C.celesteDeep : C.txt2, cursor: clic ? "pointer" : "default", textDecoration: clic ? "underline" : "none", textDecorationColor: "rgba(36,146,200,.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={clic ? "Ver cuenta corriente de " + r.cliente : ""}>{r.cliente || "—"}</span>
                        <span style={{ flexShrink: 0, fontSize: 10.5, whiteSpace: "nowrap", fontWeight: 700, color: conc ? C.green : r.estado === "impaga" ? C.txt3 : C.amber }}>{motivo(r)}</span>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: C.txt2, textAlign: "right", flexShrink: 0 }}>{fmt(r.imp)}</span>
                        <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: C.txt3, textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.comp}>{(r.comp || "Cta. cte.").replace(/^(\S+)\s+\d+-0*/, "$1 …")}</span>
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

export function DynRow({ row, allCols, visible, side, selectable, checked, suggested, dim, onClick, hidden, nota, notaEditing, onToggleNota, onSaveNota, tip, tipImp, tipEditing, onToggleTip, onSaveTip, onTodoTip, onQuitarTip, onCliente, tieneCuenta, defaultDif, formaEditing, formaActual, onToggleForma, onSetForma }) {
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
    else if (ok && row.matchTipo === "cupon") tg = <span style={tag(C.greenBg, C.green)} title="Mismo Nº de operación de Mercado Pago que el cupón cargado en el POS, y mismo importe">por cupón</span>;
    else if (ok && row.matchTipo === "ctacte") tg = <span style={tag("#7c5fd318", "#7c5fd3")}>{"🧾"} cta. cte.</span>;
    else if (ok && row.matchTipo === "combinado") tg = <span style={tag("#c77d0818", C.amber)}>combinado</span>;
    else if (ok && n === 1) tg = <span style={tag(C.greenBg, C.green)}>1↔1</span>;
    else if (ok && row.matchTipo === "iguales") tg = <span style={tag("#5BC2EA22", C.celesteDeep)}>{n} iguales</span>;
    else if (ok && consec) tg = row.porHora
      ? <span style={tag("#7c5fd318", "#7c5fd3")}>{"⏱ "}{n} por hora</span>
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
