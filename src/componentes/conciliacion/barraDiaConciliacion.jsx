/* eslint-disable react-refresh/only-export-components */
// Barra del día que se concilia (19/11/2026, Diego: «el día que se está conciliando está en un
// rincón chiquitito, se pierde; debería ser pieza central» — eligió la opción A).
// Día en grande con sus números y, abajo, la tira del mes: ámbar = días con pendientes (con la
// cantidad), verde = día cerrado, gris = sin movimientos o futuro. Tocar un día lleva a ese día.
import React from "react";
import { C, fmt } from './motorConciliacion';

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const INI = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aFecha = (s) => new Date(s + "T12:00:00");

export function BarraDia({ dayCenter, result, pendPorDia, pendingDays, onMove, onPick, desde, hasta, nSugerencias }) {
  const tira = React.useRef(null);
  const info = React.useMemo(() => {
    if (!result || !dayCenter) return null;
    let ing = 0, ban = 0, nI = 0, nB = 0;
    const conDatos = new Set();
    result.V.forEach((v) => { conDatos.add(v.fecha); if (v.fecha === dayCenter && v.status === "pend") { ing += v.imp; nI++; } });
    result.B.forEach((b) => { conDatos.add(b.fecha); if (b.fecha === dayCenter && b.status === "pend") { ban += b.imp; nB++; } });
    return { ing, ban, nI, nB, conDatos };
  }, [result, dayCenter]);

  // Días de la tira: el mes del día en foco, dentro del período elegido.
  const dias = React.useMemo(() => {
    if (!dayCenter) return [];
    const c = aFecha(dayCenter);
    const out = [];
    const hoy = iso(new Date());
    for (let d = new Date(c.getFullYear(), c.getMonth(), 1, 12); d.getMonth() === c.getMonth(); d.setDate(d.getDate() + 1)) {
      const f = iso(d);
      if ((desde && f < desde) || (hasta && f > hasta)) continue;
      out.push({ f, n: d.getDate(), ini: INI[d.getDay()], pend: (pendPorDia || {})[f] || 0, datos: info ? info.conDatos.has(f) : false, futuro: f > hoy });
    }
    return out;
  }, [dayCenter, desde, hasta, pendPorDia, info]);

  // que el día en foco quede a la vista en la tira (celular / pantallas chicas)
  React.useEffect(() => {
    const el = tira.current && tira.current.querySelector("[data-foco]");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [dayCenter]);

  if (!dayCenter || !info) return null;
  const dt = aFecha(dayCenter);
  const titulo = `${DIAS[dt.getDay()]} ${dt.getDate()} de ${MESES[dt.getMonth()]}`;
  const pend = info.nI + info.nB;
  const canPrev = pendingDays.some((d) => d < dayCenter), canNext = pendingDays.some((d) => d > dayCenter);
  const flecha = (on, prim) => ({
    width: 44, height: 44, flexShrink: 0, borderRadius: 12, fontSize: 22, lineHeight: 1, cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.35,
    border: prim ? "none" : "1px solid " + C.line2, background: prim ? C.celeste : C.white, color: C.tinta,
  });
  return (
    <div data-keep-sel data-tour="conc-dia" style={{ background: C.white, border: "1px solid " + C.line, borderRadius: 16, padding: "14px 18px 12px", marginBottom: 14, boxShadow: "0 2px 10px rgba(21,33,62,.06)", fontFamily: "'Sora',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={() => canPrev && onMove(-1)} disabled={!canPrev} title="Día anterior con pendientes" style={flecha(canPrev, false)}>‹</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".12em", color: C.txt3, fontWeight: 700 }}>CONCILIANDO EL DÍA</div>
          <div style={{ fontSize: "clamp(22px, 2.4vw, 32px)", fontWeight: 800, color: C.tinta, lineHeight: 1.2 }}>{titulo}</div>
          <div style={{ fontSize: 13, color: C.txt2, marginTop: 3 }}>
            {pend
              ? <><b style={{ color: C.amber }}>{pend} pendiente{pend === 1 ? "" : "s"}</b> · ventas {fmt(info.ing)} · banco {fmt(info.ban)}{nSugerencias ? <> · <b style={{ color: C.green }}>{nSugerencias} sugerencia{nSugerencias === 1 ? "" : "s"}</b></> : null}</>
              : <b style={{ color: C.green }}>✓ Día conciliado</b>}
          </div>
        </div>
        <button type="button" onClick={() => canNext && onMove(1)} disabled={!canNext} title="Día siguiente con pendientes" style={flecha(canNext, true)}>›</button>
      </div>
      <div ref={tira} style={{ display: "flex", gap: 4, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
        {dias.map((x) => {
          const foco = x.f === dayCenter;
          const st = foco ? { background: C.celeste, color: C.tinta, fontWeight: 800, boxShadow: "0 0 0 2px #5BC2EA55" }
            : x.futuro ? { background: "transparent", color: "#c4c9d2" }
            : x.pend ? { background: "#fff4e0", color: "#8a5a00" }
            : x.datos ? { background: "#eaf7f0", color: "#1a7c56" }
            : { background: "transparent", color: C.txt3 };
          return (
            <button type="button" key={x.f} data-foco={foco ? "" : undefined} disabled={x.futuro} onClick={() => onPick(x.f)}
              title={x.futuro ? "" : x.pend ? `${x.pend} pendiente${x.pend === 1 ? "" : "s"}` : x.datos ? "Conciliado" : "Sin movimientos"}
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
