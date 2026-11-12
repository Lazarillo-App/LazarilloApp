// src/paginas/RrhhCronogramasComun.jsx
// RRHH › Cronogramas — tema, fechas (semanas AAASS) y piezas chicas compartidas
// por la página y sus modales.
import React from 'react';

/* ───────── tema (modo día del mockup v31, paleta de marca) ───────── */
const T = {
  bg: '#F3F6FA', band: '#FFFFFF', card: '#EAF1F8', head: '#F7FAFD',
  accent: '#5BC2EA', accentTxt: '#1E87B5', ink: '#15213E',
  text: '#15213E', text2: '#46587A', text3: '#8696B2',
  border: '#E2E9F2', border2: '#C9D6E6',
  ok: '#1FA866', warn: '#C8912B', bad: '#D64545', violet: '#8B5CF6',
  sombra: '0 20px 60px #15213E33', vacio: '#B9C7DA',
};
const FT = "'Sora', sans-serif";
// Texto sobre el encabezado de tabla del tema (fondo = color del negocio).
const TH_TXT = 'var(--on-primary, #fff)';
const FB = "'Archivo', sans-serif";
const JORNADA_HS = 8;

/* ───────── fechas y semanas (AAASS, ancla del Excel: 202641 = 4/10/2026) ───────── */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DC = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MESES_C = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dd2 = (n) => String(n).padStart(2, '0');
const isoDe = (d) => `${d.getFullYear()}-${dd2(d.getMonth() + 1)}-${dd2(d.getDate())}`;
const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDe(d); };
const ANCLA = { id: 202641, start: '2026-10-04' }; // domingo
const idDeSemana = (startIso) =>
  ANCLA.id + Math.round((new Date(startIso + 'T12:00:00') - new Date(ANCLA.start + 'T12:00:00')) / 604800000);
const startDeId = (id) => sumarDias(ANCLA.start, (Number(id) - ANCLA.id) * 7);
const domingoDeHoy = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return isoDe(d); };
const rangoLargo = (start) => {
  const a = new Date(start + 'T12:00:00'); const b = new Date(sumarDias(start, 6) + 'T12:00:00');
  return a.getMonth() === b.getMonth()
    ? `${DIAS[a.getDay()]} ${a.getDate()} al ${b.getDate()} de ${MESES_L[a.getMonth()]}`
    : `${DIAS[a.getDay()]} ${a.getDate()} de ${MESES_L[a.getMonth()]} al ${b.getDate()} de ${MESES_L[b.getMonth()]}`;
};
const TIPOS_FECHA = [
  { v: 'feriado', l: 'Feriado' }, { v: 'prefer', l: 'Pre Feriado' },
  { v: 'cerrado', l: 'Cerrado' }, { v: 'evento', l: 'Evento' },
];
// "Pre Feriado" / "preferiado" / "prefer" → 'prefer'; el resto en minúscula
const tipoNorm = (tipo) => { const t = String(tipo || '').toLowerCase().replace(/\s+/g, ''); return t.startsWith('pre') ? 'prefer' : t; };
const etiquetaTipo = (tipo) => (TIPOS_FECHA.find((t) => t.v === tipoNorm(tipo)) || { l: tipo || '' }).l;
// el mes de una semana es el de su jueves (la que cruza de mes va al que tiene más días)
const mesDeSemana = (startIso) => { const d = new Date(sumarDias(startIso, 4) + 'T12:00:00'); return { y: d.getFullYear(), m: d.getMonth() }; };
const enMes = (iso, mes) => Number(iso.slice(0, 4)) === mes.y && Number(iso.slice(5, 7)) - 1 === mes.m;
// ids de semana (AAASS) que tocan un mes
const semanasDelMes = (mes) => {
  const ini = new Date(mes.y, mes.m, 1, 12); ini.setDate(ini.getDate() - ini.getDay());
  const fin = new Date(mes.y, mes.m + 1, 0, 12);
  const out = [];
  for (const d = new Date(ini); d <= fin; d.setDate(d.getDate() + 7)) out.push(idDeSemana(isoDe(d)));
  return out;
};
const colorCat = (tipo) => { const t = tipoNorm(tipo); return t === 'cerrado' ? T.bad : t === 'evento' ? T.violet : T.warn; };
// "Salón" (espacio) y "SALON" (MaxiRest) son el mismo sector
const normSector = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/* ───────── piezas chicas (estilo del mockup) ───────── */
const Chip = ({ color, children, onClick, title, activoBg }) => (
  <span onClick={onClick} title={title} style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: onClick ? 'pointer' : 'default',
    fontFamily: FB, fontSize: 12, fontWeight: 700, color: activoBg ? T.ink : color || T.text3,
    border: `1px solid ${activoBg ? T.accent : (color || T.text3) + '55'}`,
    background: activoBg ? T.accent : 'transparent',
    borderRadius: 8, padding: '3px 9px', lineHeight: '16px', userSelect: 'none', whiteSpace: 'nowrap',
  }}>{children}</span>
);

const Boton = ({ children, onClick, activo, grande, peligro, deshabilitado, prox, title }) => (
  <button onClick={deshabilitado ? undefined : onClick} title={prox ? 'Próximamente' : title} style={{
    fontFamily: FB, fontWeight: 700, fontSize: grande ? 14 : 12.5,
    padding: grande ? '9px 18px' : '6px 12px', borderRadius: 10, cursor: deshabilitado ? 'default' : 'pointer',
    border: `1px solid ${peligro ? T.bad + '88' : activo ? T.accent : T.border2}`,
    background: activo ? T.accent : 'transparent',
    color: deshabilitado ? T.text3 : peligro ? T.bad : activo ? T.ink : T.text2,
    opacity: deshabilitado || prox ? 0.5 : 1, whiteSpace: 'nowrap',
  }}>{children}</button>
);

/* ───────── helpers de dominio ───────── */
const nombreDe = (emp) => (emp ? `${emp.nombre || ''}${emp.apellido ? ` ${emp.apellido}` : ''}`.trim() : '—');
const nombreCorto = (emp) => (emp ? `${emp.nombre || ''}${emp.apellido ? ` ${String(emp.apellido)[0]}.` : ''}`.trim() : '—');
let keySeq = 1;
const nuevaKey = () => `f${keySeq++}_${Date.now() % 100000}`;

// ¿este empleado ya tiene OTRA fila en este turno? (regla: una fila por empleado por turno)
function duenoEnTurno(filas, turnoId, empleadoId, filaKey) {
  return filas.some((f) => {
    if (f.turnoId !== turnoId || f.key === filaKey) return false;
    if (f.ownerEmpleadoId === empleadoId) return true;
    return Object.values(f.celdas).some((c) => c && c.empleadoId === empleadoId);
  });
}
// dueño efectivo de una fila: el owner, o el empleado más frecuente en sus celdas
function duenoDe(fila) {
  if (fila.ownerEmpleadoId) return fila.ownerEmpleadoId;
  const cnt = new Map();
  Object.values(fila.celdas).forEach((c) => { if (c?.empleadoId) cnt.set(c.empleadoId, (cnt.get(c.empleadoId) || 0) + 1); });
  let mejor = null; let n = 0;
  cnt.forEach((v, k) => { if (v > n) { n = v; mejor = k; } });
  return mejor;
}

/* ── horario propio de una celda (entrada y salida opcional) ──
   Cada horario distinto de la semana lleva su color de chip: si a alguien le
   cambia la hora, se nota (pedido de Diego 12/11/2026). */
const PALETA_HORAS = ['#8B5CF6', '#E07B39', '#0F9AA8', '#D6457A', '#4F5BD5', '#1FA866', '#C8912B', '#8A6A4F'];
// texto del chip o null si la celda entra con el turno y no tiene salida
function horarioDe(c, turno) {
  if (!c) return null;
  const ent = c.entrada || turno?.entrada || '';
  if (c.salida) return `${ent || '?'}–${c.salida}`;
  if (c.entrada && c.entrada !== turno?.entrada) return c.entrada;
  return null;
}
// mapa horario → color, ordenado por hora, para todas las celdas de la semana
function coloresHorarios(filas, turnos) {
  const tPorId = new Map((turnos || []).map((t) => [t.id, t]));
  const set = new Set();
  (filas || []).forEach((f) => Object.values(f.celdas || {}).forEach((c) => {
    const h = horarioDe(c, tPorId.get(f.turnoId));
    if (h) set.add(h);
  }));
  const m = new Map();
  [...set].sort().forEach((h, i) => m.set(h, PALETA_HORAS[i % PALETA_HORAS.length]));
  return m;
}
// horas entre dos 'HH:MM' (cruza medianoche)
function horasEntre(a, b) {
  if (!/^\d\d:\d\d$/.test(a || '') || !/^\d\d:\d\d$/.test(b || '')) return null;
  const mi = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  let d = mi(b) - mi(a);
  if (d <= 0) d += 1440;
  return Math.round((d / 60) * 2) / 2;
}

// ¿es habitual de este espacio? Se aprende de los cronogramas de las últimas
// 8 semanas (back: empleado.espacios); el sector de la nómina queda de respaldo.
// Los marcados "No aplica a cronogramas" nunca lo son.
function esHabitual(emp, espacio) {
  if (!emp || !espacio || emp.noAplica) return false;
  if ((emp.espacios || []).some((x) => Number(x.id) === Number(espacio.id))) return true;
  const sec = normSector(espacio.sectorNomina);
  return !!(sec && emp.sector && normSector(emp.sector) === sec);
}

/* ───────── vista previa de EJEMPLO (estado sin datos) ─────────
   Solo se dibuja: no se guarda nunca ni se puede tocar. Muestra cómo se va a
   ver una semana armada mientras el negocio todavía no tiene cronogramas. */
const EJ = {
  turnos: [
    { nombre: 'Día · entra 10:00', filas: [['Ana', 'K', [1, 1, 0, 1, 1, 1, 0]], ['Lucas', 'B', [0, 1, 1, 1, 0, 1, 1]]] },
    { nombre: 'Noche · entra 19:00', filas: [['Sofía', '1', [1, 0, 1, 1, 1, 1, 1]], ['Juan', 'Ru', [1, 1, 1, 0, 0, 1, 1]], ['Mara', '2', [0, 0, 1, 1, 1, 1, 1]]] },
  ],
};
function GrillaEjemplo({ children }) {
  const celda = { height: 40, borderLeft: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, textAlign: 'center', fontFamily: FB, fontSize: 12 };
  return (
    <div style={{ position: 'relative', background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div aria-hidden style={{ opacity: 0.38, pointerEvents: 'none', userSelect: 'none', filter: 'grayscale(0.2)' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...celda, width: 132, textAlign: 'left', padding: '0 10px', fontSize: 10.5, color: T.text3, background: T.head }}>FILA / EMPLEADO</th>
              {DC.map((d, i) => <th key={d} style={{ ...celda, background: T.head, fontFamily: FT, color: T.text2 }}>{d} {i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {EJ.turnos.map((t) => (
              <React.Fragment key={t.nombre}>
                <tr><td colSpan={8} style={{ padding: '6px 12px', fontFamily: FT, fontWeight: 700, fontSize: 11.5, color: T.accentTxt, background: T.head, letterSpacing: 1, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}` }}>{t.nombre}</td></tr>
                {t.filas.map(([nom, tag, dias]) => (
                  <tr key={nom}>
                    <td style={{ ...celda, textAlign: 'left', padding: '0 10px', fontWeight: 700, color: T.text }}>{nom}</td>
                    {dias.map((on, i) => (
                      <td key={i} style={celda}>
                        {on ? (
                          <div style={{ margin: 3, borderRadius: 8, background: T.card, lineHeight: '15px', padding: '2px 0' }}>
                            <div style={{ fontWeight: 700, color: T.text }}>{nom}</div>
                            <div style={{ fontSize: 10, color: T.accentTxt }}>{tag}</div>
                          </div>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: 460, maxWidth: '100%', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 24, textAlign: 'center', boxSizing: 'border-box' }}>
          <span style={{ display: 'inline-block', fontFamily: FB, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '2px 8px', marginBottom: 10 }}>ATRÁS, UN EJEMPLO</span>
          {children}
        </div>
      </div>
    </div>
  );
}

export {
  T,
  FT,
  TH_TXT,
  FB,
  JORNADA_HS,
  DIAS,
  DC,
  MESES_C,
  MESES_L,
  dd2,
  isoDe,
  sumarDias,
  ANCLA,
  idDeSemana,
  startDeId,
  domingoDeHoy,
  rangoLargo,
  TIPOS_FECHA,
  tipoNorm,
  etiquetaTipo,
  mesDeSemana,
  enMes,
  semanasDelMes,
  colorCat,
  normSector,
  Chip,
  Boton,
  nombreDe,
  nombreCorto,
  nuevaKey,
  duenoEnTurno,
  duenoDe,
  esHabitual,
  GrillaEjemplo,
  horarioDe,
  coloresHorarios,
  horasEntre,
};
