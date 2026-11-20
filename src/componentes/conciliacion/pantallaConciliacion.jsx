/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components -- partes de ModuloConciliacion.jsx (separadas sin cambiar lógica, 15/11/2026) */
/* Pantalla de la conciliación: barra superior y cuerpo (lo que devuelve ModuloConciliacion). Reciben todo por parámetro, no tienen estado propio. */
import { C, COLS_BANCO, COLS_INGRESOS, FUENTES, HIDE_BAN_COMPARTIDO, HIDE_ING_COMPARTIDO, MESES_ES, fmt, fmtFecha, pagadorCoincide } from './motorConciliacion';
import { BuscadorBox, DynThead, Empty, Field, GrupoCCHead, InfoTip, NotaChip, NotaEditor, Panel, PanelColapsable, PanelHead, Rows, SubFilter, UploaderCard, fldLbl, ghostBtn, inputStyle } from './piezasConciliacion';
import { DayCompareBar, DayGroupedRows, DayNav, DiaCompartido, DynRow, PendItem, SugerenciasPanel } from './vistasDiaConciliacion';
import { BarraDia } from './barraDiaConciliacion';
import ConfigSector from '@/componentes/base/ConfigSector';
import React from "react";

// Con pantalla ancha (≥ 1500 px) la vista por día muestra todas las columnas elegidas, no solo las compactas.
const anchoAmplio = () => typeof window !== 'undefined' && window.innerWidth >= 1500;

export function renderBarraSuperior({ corte, setCorte, allDates, allLoaded, autoMargenTipo, autoMargenVal, data, desde, hasta, margenTipo, margenVal, mesActivo, months, selectMonth, setAutoMargenTipo, setAutoMargenVal, setDesde, setHasta, setMargenTipo, setMargenVal, setMesActivo, setModal, setSetupOpen, setTol, setupOpen, tol, xlsxReady }) {
  // Configuración del sector en la ⚙ del header (Diego 19/11/2026): corte, tolerancia y márgenes ya
  // no ocupan una franja en la pantalla. Guardar/Cargar archivo se sacaron: todo se guarda solo.
  const sel = { height: 40, boxSizing: "border-box", fontFamily: "'Archivo',sans-serif", fontSize: 13.5, padding: "0 8px", borderRadius: 8, border: "1px solid " + C.line2, background: C.white, color: C.txt, cursor: "pointer" };
  const fila = (label, ayuda, control) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.line }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.tinta }}>{label}</div>
        <div style={{ fontSize: 11.5, color: C.txt3, lineHeight: 1.35 }}>{ayuda}</div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{control}</div>
    </div>
  );
  const margen = (val, setVal, tipo, setTipo, entero) => (
    <>
      <input type="number" value={val} onChange={(e) => setVal(Math.max(0, (entero ? parseInt(e.target.value) : parseFloat(e.target.value)) || 0))} style={{ ...sel, width: 64, textAlign: "right", cursor: "text" }} />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={sel}><option value="monto">$</option><option value="pct">%</option></select>
    </>
  );
  const config = (
    <ConfigSector titulo="Conciliación">
      {({ cerrar }) => (
        <>
          {fila("Corte del día", "Lo que entra de madrugada, antes de esta hora, cuenta como del día anterior. Se marca con ↶.",
            <select value={corte} onChange={(e) => setCorte(parseInt(e.target.value, 10) || 0)} style={sel}>
              <option value={0}>Sin corte</option>
              {[3, 4, 5, 6, 7, 8].map((h) => <option key={h} value={h}>{String(h).padStart(2, "0") + ":00"}</option>)}
            </select>)}
          {fila("Tolerancia de fecha", "Si el cobro puede caer un día después de la venta.",
            <select value={tol} onChange={(e) => setTol(parseInt(e.target.value))} style={sel}>
              <option value={0}>Mismo día</option><option value={1}>± 1 día</option>
            </select>)}
          {fila("Auto-conciliar", "Con esta diferencia o menos, se concilia solo.", margen(autoMargenVal, setAutoMargenVal, autoMargenTipo, setAutoMargenTipo, false))}
          {fila("Sugerencias", "Hasta esta diferencia, te lo propone para que lo revises.", margen(margenVal, setMargenVal, margenTipo, setMargenTipo, true))}
          {allLoaded && (
            <button type="button" onClick={() => { setSetupOpen(true); cerrar(); }}
              style={{ marginTop: 10, minHeight: 40, padding: "0 12px", borderRadius: 8, border: "1px solid " + C.line2, background: C.white, color: C.txt2, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              Subir archivos a mano (sin integración)
            </button>
          )}
        </>
      )}
    </ConfigSector>
  );
  return (
    allLoaded && !setupOpen ? config : (

          <>
            {config}
            {/* UPLOADERS */}
            <div data-tour="conc-fuentes" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
              {FUENTES.map((f) => (
                <UploaderCard key={f.key} fuente={f} loaded={data[f.key]} onOpen={() => setModal(f)} />
              ))}
            </div>

            {/* PERÍODO + CONFIG */}
            {months.length > 0 && (
              <div data-tour="conc-periodo" style={{ background: C.white, border: "1px solid " + C.line2, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
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
                  <div><label style={fldLbl}>Corte del día <InfoTip text={"Lo que entra a Mercado Pago de madrugada, antes de esta hora, cuenta como venta del día anterior (el POS lo registra con la fecha del turno). Se marca con ↶ en la hora."} /></label><br />
                    <select value={corte} onChange={(e) => setCorte(parseInt(e.target.value, 10) || 0)} style={inputStyle}>
                      <option value={0}>Sin corte</option>
                      {[3, 4, 5, 6, 7, 8].map((h) => <option key={h} value={h}>{"Hasta las " + String(h).padStart(2, "0") + ":00"}</option>)}
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
        )
  );
}

export function renderCuerpo({ destinos, mandarA, cobrosCcPorDia, diaFiltro, setDiaFiltro, months, cambiarMes, cambiarPeriodo, activeTab, aplicarSugerencia, aprobExp, aprobOpen, aprobadas, barTotals, busqComp, busqPago, ccById, ccConc, ccListaOpen, ccOpen, ccPorDia, ccSplit, colFilterB, colFilterOpen, colFilterV, colMenu, colsB, colsBeff, colsV, colsVeff, conciliarManual, conocePagador, controlCC, ctrlOpen, dayCenter, dayView, dayWindow, desarmarCluster, descartarSugerencia, desde, deshacerAprobada, diaCounts, diasPend, difFiltro, difPend, editarCluster, efectivoOpen, efectivoPorDia, efectivoSospechoso, elegirDia, expandedGroups, exportarControl, faltantes, filterB, filterV, filtrarPorDif, formaProps, goTab, hasta, hayHighlight, haySeleccion, hlBanTotal, hlIngTotal, irAResultado, kpis, limiteFilas, limpiarSeleccion, mesesPend, moveDay, notaProps, onSubFiltro, parB, parV, pendOpen, pendPorDia, pendPorMes, pendUnif, pendingDays, resComp, resPago, result, rowsBref, rowsVref, selBan, selBanTotal, selCC, selEfec, selIng, selIngTotal, setAprobExp, setAprobOpen, setBusqComp, setBusqPago, setCcListaOpen, setCcOpen, setColFilterB, setColFilterOpen, setColFilterV, setColMenu, setColsB, setColsV, setCtrlOpen, setCuentaModal, setDayCenter, setDayView, setDiasPend, setEfectivoOpen, setExpandedGroups, setFilterB, setFilterV, setLimiteFilas, setMesesPend, setParB, setParV, setPendOpen, setSelBan, setSelCC, setSelEfec, setSelIng, setSortB, setSortV, setSubFilterV, sortB, sortV, subFilterV, sugActiva, sugResaltados, sugerencias, sugerir, tieneCuenta, tipDe, tipProps, tipsInfo, toggleBan, toggleBanGroup, toggleIng, tol, verParDeBanco, verParDeIngreso, verSugerencia, view, xlsxReady }) {
  return (
    result && kpis && view && (
          <>

            {/* El día que se concilia, en grande, con la tira del mes (19/11, opción A de Diego) */}
            {/* y en Todas / Conciliadas: tocar un día filtra la tabla (19/11) */}
            <BarraDia modo={dayView ? "pend" : filterV} dayCenter={dayCenter} diaFiltro={diaFiltro} onFiltrarDia={setDiaFiltro} result={result} pendPorDia={pendPorDia} pendingDays={pendingDays}
              onMove={moveDay} onPick={elegirDia} desde={desde} hasta={hasta} nSugerencias={sugerir ? sugerencias.length : 0}
              meses={months} onMes={cambiarMes} onPeriodo={cambiarPeriodo} />
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
            <div data-keep-sel data-tour="conc-buscar" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12, position: "relative", zIndex: 45 }}>
              <BuscadorBox icon={"🔎"} placeholder="Buscar comprobante o cliente (ej. 0001-00149895, Guccione)" value={busqComp} onChange={setBusqComp} results={resComp} onPick={irAResultado} lado="ing" />
              <BuscadorBox icon={"🔎"} placeholder="Buscar pago por importe (ej. 15600) o pagador" value={busqPago} onChange={setBusqPago} results={resPago} onPick={irAResultado} lado="ban" />
            </div>

            {/* Barra comparativa: sticky para no perderla (ni Conciliar) al scrollear.
                Se destaca con una sombra celeste más fuerte cuando hay selección. */}
            <div data-keep-sel data-tour="conc-barra" style={{ position: "sticky", top: 8, zIndex: 40, filter: (haySeleccion || hayHighlight) ? "drop-shadow(0 8px 26px rgba(91,194,234,.5))" : "drop-shadow(0 5px 16px rgba(21,33,62,.18))", transition: "filter .18s" }}>
            <DayCompareBar dia={dayView ? dayCenter : diaFiltro} periodo={!dayView && !diaFiltro} ing={barTotals.ing} ban={barTotals.ban} ctxIng={barTotals.ctxIng} ctxBan={barTotals.ctxBan}
              refIng={barTotals.refIng} refBan={barTotals.refBan}
              cntIng={barTotals.cntIng} cntBan={barTotals.cntBan} cntIngRef={barTotals.cntIngRef} cntBanRef={barTotals.cntBanRef}
              conc={kpis} onDif={filtrarPorDif} difFiltro={difFiltro} tipsTotal={tipsInfo.total} tipsDia={(dayView && filterV === "pend" && dayCenter) ? (tipsInfo.porDia[dayCenter] || 0) : null}
              haySeleccion={haySeleccion || hayHighlight} readonly={hayHighlight && !haySeleccion}
              selIngTotal={hayHighlight ? hlIngTotal : selIngTotal} selBanTotal={hayHighlight ? hlBanTotal : selBanTotal}
              selIngCount={hayHighlight ? parV.size : (selIng.size + selEfec.size + selCC.size)} selBanCount={hayHighlight ? parB.size : selBan.size}
              onConciliar={conciliarManual} onLimpiar={hayHighlight ? (() => { setParV(new Set()); setParB(new Set()); }) : limpiarSeleccion} onDesarmar={desarmarCluster} onEditar={editarCluster} />
            {/* Mandar lo tildado a otro PDV (Diego 20/11/2026: transferencias que entraron a la otra sucursal,
                facturas hechas desde Ramos para San Justo). Solo con selección y si el negocio tiene otro PDV. */}
            {mandarA && haySeleccion && !hayHighlight && (selIng.size + selBan.size + selCC.size) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "-6px 0 14px", padding: "8px 14px", background: C.white, border: "1px solid " + C.line2, borderRadius: 10 }}>
                <span style={{ fontSize: 12.5, color: C.txt2, fontWeight: 600 }}>Mandar lo tildado a otro PDV:</span>
                {destinos.map((d) => (
                  <button key={d.suc} type="button" onClick={() => mandarA(d.suc)} title={"Pasa estos registros a la conciliación de " + d.nombre}
                    style={{ minHeight: 36, padding: "0 14px", borderRadius: 18, border: "1px solid " + C.celeste, background: "#5BC2EA14", color: C.celesteDeep, fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>{"→ "}{d.nombre}</button>
                ))}
              </div>
            )}
            </div>

            {dayView && filterV === "pend" ? (
              /* ===== VISTA POR DÍA COMPARTIDA: ingreso izq / banco der, misma banda ===== */
              <Panel>
                <div data-tour="conc-paneles" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ minWidth: 0, borderRight: "1px solid " + C.line }}>
                    <PanelHead titulo="Facturas y Cobranzas" count={diaCounts ? diaCounts.v + " del día" : view.fV.length + " de " + view.V.length}
                      active={activeTab} onTab={goTab}
                      colMenu={colMenu === "ingresos"} onToggleColMenu={() => setColMenu(colMenu === "ingresos" ? null : "ingresos")}
                      allCols={COLS_INGRESOS} visibleCols={colsV} onToggleCol={(k) => setColsV((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} grouped />
                    <DynThead allCols={COLS_INGRESOS} visible={colsVeff} hidden={anchoAmplio() ? null : HIDE_ING_COMPARTIDO} sort={sortV} onSort={(campo) => setSortV((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                      side="ingresos" rows={result.V} colFilter={colFilterV} setColFilter={setColFilterV} openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <PanelHead titulo="Banco" tabs={[["pend","Pendientes"],["ok","Conciliadas"],["all","Todas"]]} count={diaCounts ? diaCounts.b + " del día" : view.fB.length + " de " + view.B.length}
                      active={activeTab} onTab={goTab}
                      colMenu={colMenu === "banco"} onToggleColMenu={() => setColMenu(colMenu === "banco" ? null : "banco")}
                      allCols={COLS_BANCO} visibleCols={colsB} onToggleCol={(k) => setColsB((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
                    <DynThead allCols={COLS_BANCO} visible={colsBeff} hidden={anchoAmplio() ? null : HIDE_BAN_COMPARTIDO} sort={sortB} onSort={(campo) => setSortB((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                      side="banco" rows={result.B} colFilter={colFilterB} setColFilter={setColFilterB} openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
                  </div>
                </div>
                <DiaCompartido ingRows={view.fV} banRows={view.fB} windowDays={dayWindow()} center={dayCenter}
                  tipDia={tipsInfo.porDia}
                  efectivoDia={efectivoPorDia} efectivoOpen={efectivoOpen} efectivoSosp={efectivoSospechoso}
                  selEfec={selEfec} onToggleEfec={(id) => setSelEfec((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  ccDia={ccPorDia} cobrosDia={cobrosCcPorDia} ccOpen={ccOpen} onToggleCC={(d) => setCcOpen((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; })} onCliente={setCuentaModal} tieneCuentaFn={tieneCuenta} formaFn={formaProps}
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
                    <DynRow key={v.id} row={v} {...notaProps(v.id)} onCliente={setCuentaModal} tieneCuenta={tieneCuenta} {...formaProps(v)} allCols={COLS_INGRESOS} visible={colsVeff} hidden={anchoAmplio() ? null : HIDE_ING_COMPARTIDO} side="ing" dim={dim}
                      selectable checked={selIng.has(v.id)} suggested={sugResaltados.ing.has(v.id)} onClick={() => toggleIng(v.id)} />
                  )}
                  renderBan={(b, dim) => (
                    <DynRow key={b.id} row={b} {...notaProps(b.id)} {...tipProps(b)} allCols={COLS_BANCO} visible={colsBeff} hidden={anchoAmplio() ? null : HIDE_BAN_COMPARTIDO} side="ban" dim={dim}
                      selectable checked={selBan.has(b.id)} suggested={sugResaltados.ban.has(b.id)} onClick={() => toggleBan(b.id)} />
                  )} />
              </Panel>
            ) : (
            <div data-tour="conc-paneles" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* INGRESOS */}
              <Panel>
                <PanelHead titulo="Facturas y Cobranzas" count={(dayView && filterV === "pend" && diaCounts) ? diaCounts.v + " del día" : view.fV.length + " de " + view.V.length}
                  active={activeTab}
                  onTab={goTab}
                  colMenu={colMenu === "ingresos"} onToggleColMenu={() => setColMenu(colMenu === "ingresos" ? null : "ingresos")}
                  allCols={COLS_INGRESOS} visibleCols={colsV} onToggleCol={(k) => setColsV((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} grouped />
                {filterV !== "pend" && (
                  <SubFilter active={subFilterV} onTab={onSubFiltro} />
                )}
                <DynThead allCols={COLS_INGRESOS} visible={filterV === "pend" ? colsVeff : colsV} sort={sortV} onSort={(campo) => setSortV((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                  side="ingresos" rows={result.V} colFilter={colFilterV} setColFilter={setColFilterV}
                  openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
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
                <PanelHead titulo="Banco" tabs={[["pend","Pendientes"],["ok","Conciliadas"],["all","Todas"]]} count={(dayView && filterB === "pend" && diaCounts) ? diaCounts.b + " del día" : view.fB.length + " de " + view.B.length}
                  active={activeTab}
                  onTab={goTab}
                  colMenu={colMenu === "banco"} onToggleColMenu={() => setColMenu(colMenu === "banco" ? null : "banco")}
                  allCols={COLS_BANCO} visibleCols={colsB} onToggleCol={(k) => setColsB((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })} />
                {filterB !== "pend" && (
                  <SubFilter active={subFilterV} onTab={onSubFiltro} />
                )}
                <DynThead allCols={COLS_BANCO} visible={filterB === "pend" ? colsBeff : colsB} sort={sortB} onSort={(campo) => setSortB((s) => s.campo === campo ? { campo, dir: -s.dir } : { campo, dir: 1 })}
                  side="banco" rows={result.B} colFilter={colFilterB} setColFilter={setColFilterB}
                  openKey={colFilterOpen} setOpenKey={setColFilterOpen} />
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
                      <span style={{ color: C.txt3, fontSize: 11, width: 10, flexShrink: 0 }}>{exp ? "▾" : "▸"}</span>
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
              <PanelColapsable titulo={"⚠ Control de cuenta corriente"}
                resumen={controlCC.filas.length + " pago" + (controlCC.filas.length === 1 ? "" : "s") + " (" + controlCC.cobros + " tickets) · " + fmt(controlCC.total) + " · el ERP dice MercadoPago y no está en el banco"}
                open={ctrlOpen} onToggle={() => setCtrlOpen(!ctrlOpen)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid " + C.line, background: "#c77d080d", fontSize: 12, color: C.txt2 }}>
                  <span style={{ flex: 1 }}>Cobros de cuenta corriente registrados en el ERP como <b>MercadoPago</b> que no aparecen en la cuenta. Tocá uno para ir a su día.</span>
                  <button onClick={(e) => { e.stopPropagation(); exportarControl(); }} disabled={!xlsxReady}
                    style={{ border: "1px solid " + C.line2, background: C.white, color: C.celesteDeep, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: xlsxReady ? "pointer" : "not-allowed", flexShrink: 0 }}>{"⬇"} Exportar a Excel</button>
                </div>
                <div style={{ display: "flex", gap: 10, padding: "6px 16px", borderBottom: "1px solid " + C.line2, background: "#F7F9FB", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".4px", color: C.txt3 }}>
                  <span style={{ width: 92 }}>Fecha de pago</span><span style={{ flex: 1 }}>Cliente · tickets que cancela</span><span style={{ width: 110, textAlign: "right" }}>Importe</span>
                </div>
                {controlCC.filas.map((f) => (
                  <div key={f.fecha + f.cliente} data-keep-sel onClick={() => { elegirDia(f.fecha); }} title="Ir a ese día"
                    className="cx-row" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 16px", borderBottom: "1px solid " + C.line, fontSize: 12.5, cursor: "pointer" }}>
                    <span style={{ width: 92, flexShrink: 0, color: C.txt3, fontSize: 11.5, paddingTop: 1 }}>{fmtFecha(f.fecha)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={(e) => { e.stopPropagation(); setCuentaModal(f.cliente); }} title={"Ver cuenta corriente de " + f.cliente} style={{ fontWeight: 700, color: C.celesteDeep, textDecoration: "underline", textDecorationColor: "rgba(36,146,200,.35)", cursor: "pointer" }}>{f.cliente || "—"}</span>
                      <span style={{ display: "block", fontSize: 11, color: C.txt3, marginTop: 2 }}>
                        {f.items.map((p) => (p.comp || "ticket").replace(/^(\S+)\s+\d+-0*/, "$1 …") + (p.fechaFact ? " (" + fmtFecha(p.fechaFact).slice(0, 5) + ")" : "") + " " + fmt(p.imp)).join("  ·  ")}
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
                          <span style={{ color: C.celesteDeep, fontSize: 11, width: 12, flexShrink: 0 }}>{mOpen ? "▾" : "▸"}</span>
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
                                <span style={{ color: C.celesteDeep, fontSize: 10, width: 12, flexShrink: 0 }}>{dOpen ? "▾" : "▸"}</span>
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
        )
  );
}
