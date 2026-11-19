/* eslint-disable react-refresh/only-export-components */
// Barra del día que se concilia (19/11/2026, Diego: «el día que se está conciliando está en un
// rincón chiquitito, se pierde; debería ser pieza central» — eligió la opción A).
// Día en grande con sus números y, abajo, la tira del mes: ámbar = días con pendientes (con la
// cantidad), verde = día cerrado, gris = sin movimientos o futuro. Tocar un día lleva a ese día.
// 19/11 (Diego: «la vista de conciliadas saca la fecha, no debería, tampoco el todas»): la barra
// está también en Todas y Conciliadas; ahí tocar un día FILTRA la tabla a ese día y «Todo el mes»
// lo saca. Arriba de la tira, ‹ mes › y «Elegir fechas» cambian el período sin abrir la configuración.
import React from "react";
import { C, fmt } from './motorConciliacion';

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const INI = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aFecha = (s) => new Date(s + "T12:00:00");
const dm = (s) => (s ? s.slice(8, 10) + "/" + s.slice(5, 7) : "");
const ultimoDia = (ym) => { const [y, m] = ym.split("-").map(Number); return ym + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0"); };

export function BarraDia({ modo = "pend", dayCenter, diaFiltro, onFiltrarDia, result, pendPorDia, pendingDays, onMove, onPick, desde, hasta, nSugerencias, meses, onMes, onPeriodo }) {
  const tira = React.useRef(null);
  const enPend = modo === "pend";
  const f0 = enPend ? dayCenter : diaFiltro;
  const foco = f0 && (!desde || f0 >= desde) && (!hasta || f0 <= hasta) ? f0 : null; // fuera del período no hay foco
  const [fechasAb, setFechasAb] = React.useState(false);
  const [fD, setFD] = React.useState(desde || "");
  const [fH, setFH] = React.useState(hasta || "");
  React.useEffect(() => { setFD(desde || ""); setFH(hasta || ""); }, [desde, hasta]);

  const info = React.useMemo(() => {
    if (!result) return null;
    let ing = 0, ban = 0, nI = 0, nB = 0;
    const conDatos = new Set();
    const cuenta = (x) => (enPend ? x.status === "pend" : modo === "ok" ? x.status === "ok" : true);
    const enFoco = (f) => (foco ? f === foco : (!desde || f >= desde) && (!hasta || f <= hasta));
    result.V.forEach((v) => { conDatos.add(v.fecha); if (enFoco(v.fecha) && cuenta(v)) { ing += v.imp; nI++; } });
    result.B.forEach((b) => { conDatos.add(b.fecha); if (enFoco(b.fecha) && cuenta(b)) { ban += b.imp; nB++; } });
    return { ing, ban, nI, nB, conDatos };
  }, [result, foco, enPend, modo, desde, hasta]);

  // Mes que muestra la tira: el del día en foco o, sin foco, el del inicio del período.
  const ref = foco || desde || dayCenter;
  const dias = React.useMemo(() => {
    if (!ref) return [];
    const c = aFecha(ref);
    const out = [];
    const hoy = iso(new Date());
    for (let d = new Date(c.getFullYear(), c.getMonth(), 1, 12); d.getMonth() === c.getMonth(); d.setDate(d.getDate() + 1)) {
      const f = iso(d);
      if ((desde && f < desde) || (hasta && f > hasta)) continue;
      out.push({ f, n: d.getDate(), ini: INI[d.getDay()], pend: (pendPorDia || {})[f] || 0, datos: info ? info.conDatos.has(f) : false, futuro: f > hoy });
    }
    return out;
  }, [ref, desde, hasta, pendPorDia, info]);

  // que el día en foco quede a la vista en la tira (celular / pantallas chicas)
  React.useEffect(() => {
    const el = tira.current && tira.current.querySelector("[data-foco]");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [foco]);

  if (!ref || !info) return null;
  // Período: «Noviembre 2026» si es un mes entero, si no «01/11 – 18/11».
  const mesEntero = desde && hasta && desde.slice(0, 7) === hasta.slice(0, 7) && desde.endsWith("-01") && hasta === ultimoDia(desde.slice(0, 7));
  const ymRef = (desde || ref).slice(0, 7);
  const lblPer = mesEntero ? MESES[Number(ymRef.slice(5)) - 1].replace(/^./, (x) => x.toUpperCase()) + " " + ymRef.slice(0, 4) : dm(desde) + " – " + dm(hasta);
  const lista = meses || [];
  const iM = lista.indexOf(ymRef);
  const mesPrev = iM > 0 ? lista[iM - 1] : (iM < 0 ? lista.filter((m) => m < ymRef).pop() : null);
  const mesNext = iM >= 0 && iM < lista.length - 1 ? lista[iM + 1] : (iM < 0 ? lista.find((m) => m > ymRef) : null);

  const dt = foco ? aFecha(foco) : null;
  const titulo = dt ? `${DIAS[dt.getDay()]} ${dt.getDate()} de ${MESES[dt.getMonth()]}` : (mesEntero ? lblPer : "Del " + dm(desde) + " al " + dm(hasta));
  const etiqueta = enPend ? "CONCILIANDO EL DÍA" : (modo === "ok" ? "CONCILIADAS" : "TODOS LOS MOVIMIENTOS") + (foco ? " · DEL DÍA" : " · TODO EL PERÍODO");
  const pend = info.nI + info.nB;
  // flechas: en Pendientes saltan entre días con pendientes; en Todas/Conciliadas, entre días con movimientos
  const diasMov = dias.filter((x) => x.datos).map((x) => x.f);
  const canPrev = enPend ? pendingDays.some((d) => !foco || d < foco) : diasMov.some((d) => !foco || d < foco);
  const canNext = enPend ? pendingDays.some((d) => !foco || d > foco) : diasMov.some((d) => !foco || d > foco);
  const mover = (dir) => {
    if (enPend) return onMove(dir);
    const c = dir > 0 ? diasMov.filter((d) => !foco || d > foco) : diasMov.filter((d) => !foco || d < foco);
    if (c.length) onFiltrarDia(dir > 0 ? c[0] : c[c.length - 1]);
  };
  const flecha = (on, prim) => ({
    width: 44, height: 44, flexShrink: 0, borderRadius: 12, fontSize: 22, lineHeight: 1, cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.35,
    border: prim ? "none" : "1px solid " + C.line2, background: prim ? C.celeste : C.white, color: C.tinta,
  });
  const mini = (on) => ({ width: 30, height: 30, borderRadius: 8, border: "1px solid " + C.line2, background: C.white, color: C.tinta, fontSize: 16, lineHeight: 1, cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.35 });
  const chip = { height: 30, padding: "0 12px", borderRadius: 15, border: "1px solid " + C.line2, background: C.white, color: C.txt2, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
  const inp = { height: 30, boxSizing: "border-box", padding: "0 8px", borderRadius: 8, border: "1px solid " + C.line2, fontFamily: "'Archivo',sans-serif", fontSize: 12, color: C.txt };
  return (
    <div data-keep-sel data-tour="conc-dia" style={{ background: C.white, border: "1px solid " + C.line, borderRadius: 16, padding: "14px 18px 12px", marginBottom: 14, boxShadow: "0 2px 10px rgba(21,33,62,.06)", fontFamily: "'Sora',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => canPrev && mover(-1)} disabled={!canPrev} title={enPend ? "Día anterior con pendientes" : "Día anterior con movimientos"} style={flecha(canPrev, false)}>‹</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".12em", color: C.txt3, fontWeight: 700 }}>{etiqueta}</div>
          <div style={{ fontSize: "clamp(22px, 2.4vw, 32px)", fontWeight: 800, color: C.tinta, lineHeight: 1.2 }}>{titulo}</div>
          <div style={{ fontSize: 13, color: C.txt2, marginTop: 3, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              {enPend
                ? (pend
                  ? <><b style={{ color: C.amber }}>{pend} pendiente{pend === 1 ? "" : "s"}</b> · ventas {fmt(info.ing)} · banco {fmt(info.ban)}{nSugerencias ? <> · <b style={{ color: C.green }}>{nSugerencias} sugerencia{nSugerencias === 1 ? "" : "s"}</b></> : null}</>
                  : <b style={{ color: C.green }}>✓ Día conciliado</b>)
                : <>{info.nI} venta{info.nI === 1 ? "" : "s"} {fmt(info.ing)} · {info.nB} del banco {fmt(info.ban)}</>}
            </span>
            {!enPend && foco && <button type="button" onClick={() => onFiltrarDia(null)} style={{ ...chip, borderColor: C.celeste, color: C.celesteDeep, background: "#5BC2EA14" }}>Todo el período ✕</button>}
          </div>
        </div>
        <button type="button" onClick={() => canNext && mover(1)} disabled={!canNext} title={enPend ? "Día siguiente con pendientes" : "Día siguiente con movimientos"} style={flecha(canNext, true)}>›</button>
      </div>
      {/* período: ‹ mes › y elegir fechas */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap", position: "relative" }}>
        <button type="button" disabled={!mesPrev} onClick={() => mesPrev && onMes(mesPrev)} title="Mes anterior" style={mini(!!mesPrev)}>‹</button>
        <span style={{ minWidth: 150, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: C.tinta }}>{lblPer}</span>
        <button type="button" disabled={!mesNext} onClick={() => mesNext && onMes(mesNext)} title="Mes siguiente" style={mini(!!mesNext)}>›</button>
        <button type="button" onClick={() => setFechasAb((v) => !v)} style={{ ...chip, marginLeft: 6, ...(fechasAb ? { borderColor: C.celeste, color: C.celesteDeep } : {}) }}>Elegir fechas</button>
        {fechasAb && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={fD} max={fH || undefined} onChange={(e) => setFD(e.target.value)} style={inp} />
            <span style={{ fontSize: 12, color: C.txt3 }}>al</span>
            <input type="date" value={fH} min={fD || undefined} onChange={(e) => setFH(e.target.value)} style={inp} />
            <button type="button" disabled={!fD || !fH} onClick={() => { onPeriodo(fD, fH); setFechasAb(false); }} style={{ ...chip, border: "none", background: C.celeste, color: C.tinta }}>Aplicar</button>
          </span>
        )}
      </div>
      <div ref={tira} style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
        {dias.map((x) => {
          const esFoco = x.f === foco;
          const st = esFoco ? { background: C.celeste, color: C.tinta, fontWeight: 800, boxShadow: "0 0 0 2px #5BC2EA55" }
            : x.futuro ? { background: "transparent", color: "#c4c9d2" }
            : x.pend ? { background: "#fff4e0", color: "#8a5a00" }
            : x.datos ? { background: "#eaf7f0", color: "#1a7c56" }
            : { background: "transparent", color: C.txt3 };
          const pick = () => (enPend ? onPick(x.f) : onFiltrarDia(esFoco ? null : x.f));
          return (
            <button type="button" key={x.f} data-foco={esFoco ? "" : undefined} disabled={x.futuro} onClick={pick}
              title={x.futuro ? "" : (x.pend ? `${x.pend} pendiente${x.pend === 1 ? "" : "s"}` : x.datos ? "Conciliado" : "Sin movimientos") + (enPend ? "" : esFoco ? " · tocá para ver todo el período" : " · tocá para ver solo este día")}
              style={{ flex: "1 0 34px", minWidth: 34, maxWidth: 52, height: 54, border: "none", borderRadius: 9, padding: "3px 0", cursor: x.futuro ? "default" : "pointer", fontFamily: "inherit", textAlign: "center", ...st }}>
              <div style={{ fontSize: 10.5, opacity: 0.75 }}>{x.ini}</div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{x.n}</div>
              <div style={{ fontSize: 10, height: 13 }}>{x.futuro ? "" : x.pend ? x.pend : x.datos ? "✓" : ""}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
