/* eslint-disable no-unused-vars */
// src/paginas/RrhhCronogramas.jsx
// RRHH › Cronogramas — Etapa 1, tanda 2 (front básico contra la API).
// Diseño calcado del mockup v31 en modo día (marca Lazarillo); el header es el
// de la app (Navbar) — acá solo va la toolbar del módulo.
// Barra completa del mockup v31: Exportar imagen (2 PNG: cronograma + francos,
// Canvas en modo día), + Semana (crea la siguiente copiando esta), Vaciar,
// calendario de semanas. "Próximamente": ⚙ Configuración; después demanda.
// La nómina se sincroniza sola con MaxiRest (GET /config) y se edita en
// RRHH › Nómina (botonera del header).
// Sucursales (Diego, 07/11): cada sucursal tiene su cronograma (espacios y
// semanas propios; se elige con las pastillas del header, sin "Todas"). La
// nómina y los feriados son compartidos; los eventos y cierres, de la sucursal.
// Grilla: columna con el dueño de la fila, clic en la cabecera del día carga un
// feriado/evento, turnos minimizables, leyenda de puestos, "sin jornadas",
// drag & drop entre celdas y totales del MES (días dentro del mes de la semana).

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RrhhAPI } from '../servicios/apiRrhh';
import { getSession } from '../servicios/apiBase';
import { useBusiness } from '../context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';

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
const normSector = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

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

/* ───────── imagen para WhatsApp (Canvas, siempre en modo día) ─────────
 * Dos PNG por espacio y semana: 1) cronograma de los turnos tildados,
 * 2) francos de la semana (sin eventuales, cuyo chip ya está en la grilla).
 */
const IMG = { W: 540, S: 2, P: 16, bg: '#FFFFFF', celda: '#EAF1F8', ink: '#15213E', acc: '#1E87B5', gris: '#5a6a82', pie: '#8aa0b5', esp: '#B97700', logo: '#5BC2EA' };
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const recortar = (ctx, txt, ancho) => {
  if (ctx.measureText(txt).width <= ancho) return txt;
  let t = txt;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t + '…';
};
function lienzo(H) {
  const cv = document.createElement('canvas');
  cv.width = IMG.W * IMG.S; cv.height = Math.round(H * IMG.S);
  const ctx = cv.getContext('2d'); ctx.scale(IMG.S, IMG.S);
  ctx.fillStyle = IMG.bg; ctx.fillRect(0, 0, IMG.W, H);
  return { cv, ctx };
}
function cabeceraImg(ctx, titulo, rango) {
  const { P } = IMG;
  ctx.fillStyle = IMG.logo; rrect(ctx, P, P, 24, 24, 7); ctx.fill();
  ctx.fillStyle = IMG.ink; ctx.font = "800 15px Sora, sans-serif"; ctx.textAlign = 'center'; ctx.fillText('L', P + 12, P + 17);
  ctx.textAlign = 'left'; ctx.font = "700 13px Sora, sans-serif"; ctx.fillText(titulo, P + 32, P + 10);
  ctx.fillStyle = IMG.gris; ctx.font = "400 10px Archivo, sans-serif"; ctx.fillText(rango, P + 32, P + 22);
}
function pieImg(ctx, H) {
  ctx.fillStyle = IMG.pie; ctx.font = "400 8.5px Archivo, sans-serif"; ctx.textAlign = 'right';
  ctx.fillText('Lazarillo Gestión · lazarillo.com.ar', IMG.W - IMG.P, H - IMG.P + 4);
}
// grupos: [{ turno:{nombre,entrada}, filas:[{celdas:{dia:{nombre,puesto}}}] }] · dias: [{nro, dc, ev}]
function dibujarCronograma({ titulo, rango, dias, grupos }) {
  if (!grupos.length) return null;
  const { W, P } = IMG; const GAP = 2;
  const colW = (W - P * 2 - GAP * 6) / 7;
  const extraEv = dias.some((d) => d.ev) ? 11 : 0; // línea pareja para el nombre del feriado/evento
  const altos = grupos.map((g) => {
    let maxN = 0;
    for (let j = 0; j < 7; j++) maxN = Math.max(maxN, g.filas.filter((f) => f.celdas[j]).length);
    const celH = Math.max(40, 17 + extraEv + maxN * 12 + 5);
    return { celH, total: 20 + celH + 8 };
  });
  const H = P + 34 + altos.reduce((a, x) => a + x.total, 0) + 18 + P;
  const { cv, ctx } = lienzo(H);
  cabeceraImg(ctx, titulo, rango);
  let y = P + 34;
  grupos.forEach((g, gi) => {
    ctx.fillStyle = IMG.acc; ctx.font = "700 10px Sora, sans-serif"; ctx.textAlign = 'left';
    ctx.fillText((g.turno.nombre + (g.turno.entrada ? ' · ' + g.turno.entrada : '')).toUpperCase(), P, y + 12);
    y += 20;
    const { celH } = altos[gi];
    for (let j = 0; j < 7; j++) {
      const x = P + j * (colW + GAP);
      const d = dias[j];
      ctx.fillStyle = IMG.celda; rrect(ctx, x, y, colW, celH, 6); ctx.fill();
      ctx.fillStyle = d.ev ? IMG.esp : IMG.gris; ctx.font = "700 9px Sora, sans-serif"; ctx.textAlign = 'center';
      ctx.fillText(d.dc + ' ' + d.nro + (d.ev ? ' ★' : ''), x + colW / 2, y + 12);
      if (d.ev) { ctx.font = "600 7px Archivo, sans-serif"; ctx.fillText(recortar(ctx, d.ev, colW - 8), x + colW / 2, y + 21); }
      let yy = y + 23 + extraEv;
      g.filas.forEach((f) => {
        const c = f.celdas[j];
        if (!c) return;
        const tag = c.puesto ? ' ·' + c.puesto : '';
        ctx.font = "600 8.5px Archivo, sans-serif";
        const nom = recortar(ctx, c.nombre, colW - 6 - (tag ? ctx.measureText(tag).width : 0));
        const wN = ctx.measureText(nom).width; const wT = tag ? ctx.measureText(tag).width : 0;
        const x0 = x + colW / 2 - (wN + wT) / 2;
        ctx.textAlign = 'left'; ctx.fillStyle = IMG.ink; ctx.fillText(nom, x0, yy);
        if (tag) { ctx.fillStyle = IMG.acc; ctx.fillText(tag, x0 + wN, yy); }
        yy += 12;
      });
    }
    y += celH + 8;
  });
  pieImg(ctx, H);
  return cv;
}
// items: [{ n, txt }]
function dibujarFrancos({ titulo, rango, items }) {
  if (!items.length) return null;
  const { W, P } = IMG;
  const filas = Math.ceil(items.length / 2);
  const H = P + 34 + 24 + filas * 17 + 8 + 16 + P;
  const { cv, ctx } = lienzo(H);
  cabeceraImg(ctx, titulo, rango);
  let y = P + 34;
  ctx.fillStyle = IMG.acc; ctx.font = "700 11px Sora, sans-serif"; ctx.textAlign = 'left';
  ctx.fillText('🌴 FRANCOS DE LA SEMANA', P, y + 13);
  y += 24;
  const colF = (W - P * 2) / 2;
  items.forEach((f, i) => {
    const cx = P + (i % 2) * colF; const cy = y + Math.floor(i / 2) * 17 + 11;
    ctx.textAlign = 'left'; ctx.font = "600 10.5px Archivo, sans-serif";
    const nom = recortar(ctx, f.n, colF * 0.55); const wN = ctx.measureText(nom).width;
    ctx.fillStyle = IMG.ink; ctx.fillText(nom, cx, cy);
    ctx.font = "400 10.5px Archivo, sans-serif"; ctx.fillStyle = IMG.gris;
    ctx.fillText(recortar(ctx, '  ' + f.txt, colF - wN - 14), cx + wN, cy);
  });
  pieImg(ctx, H);
  return cv;
}
const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* ───────── modal: exportar imagen ───────── */
function ModalExportar({ espacio, negocio, semanaId, rango, diasISO, fechasMap, filas, empleadosMap, totales, onCerrar, avisar }) {
  const [tildados, setTildados] = useState(() => Object.fromEntries((espacio.turnos || []).map((t) => [t.id, true])));
  const [urlCrono, setUrlCrono] = useState(null);
  const [urlFrancos, setUrlFrancos] = useState(null);
  const sufijo = negocio ? ' · ' + negocio : '';
  const incluidos = (espacio.turnos || []).filter((t) => tildados[t.id]);

  useEffect(() => {
    const dias = diasISO.map((iso, j) => {
      const f = fechasMap.get(iso);
      return { nro: new Date(iso + 'T12:00:00').getDate(), dc: DC[j], ev: f ? (f.nombre || etiquetaTipo(f.tipo)) : '' };
    });
    const grupos = incluidos.map((t) => ({
      turno: t,
      filas: filas.filter((f) => f.turnoId === t.id).map((f) => {
        const celdas = {};
        Object.entries(f.celdas).forEach(([dia, c]) => {
          if (c?.empleadoId) celdas[dia] = { nombre: nombreCorto(empleadosMap.get(c.empleadoId)), puesto: c.puesto };
        });
        return { celdas };
      }),
    }));
    const items = [...totales.entries()]
      .filter(([, t]) => t.semCnt > 0 && t.francos.length <= 3)
      .map(([id, t]) => ({ n: nombreDe(empleadosMap.get(id)), txt: t.francos.length ? t.francos.join(', ') : '—' }))
      .sort((a, b) => a.n.localeCompare(b.n));
    try {
      const cv = dibujarCronograma({ titulo: 'Cronograma ' + espacio.nombre + sufijo, rango, dias, grupos });
      setUrlCrono(cv ? cv.toDataURL('image/png') : null);
    } catch (e) { setUrlCrono(null); avisar('No se pudo generar la imagen.', 'error'); }
    try {
      const cf = dibujarFrancos({ titulo: 'Francos ' + espacio.nombre + sufijo, rango, items });
      setUrlFrancos(cf ? cf.toDataURL('image/png') : null);
    } catch (e) { setUrlFrancos(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tildados]);

  const base = slug(espacio.nombre) + (negocio ? '_' + slug(negocio) : '') + '_sem' + String(semanaId).slice(-2);
  const nombreCrono = 'cronograma_' + base +
    (incluidos.length === (espacio.turnos || []).length ? '' : '_' + incluidos.map((t) => slug(t.nombre)).join('_')) + '.png';
  // Un botón por imagen: cada click es un gesto del usuario (los navegadores bloquean descargas encadenadas).
  const bajar = (url, nombre, label) => {
    if (!url) { avisar('La imagen todavía no se generó.', 'error'); return; }
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    avisar(`${label} descargado ✓ · si no bajó: click derecho sobre la imagen → Guardar imagen como…`);
  };
  const rotulo = { fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 };
  const imgSt = { width: '100%', display: 'block', borderRadius: 12, border: `1px solid ${T.border2}`, background: '#FFFFFF' };

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>Así sale la imagen</div>
          <span onClick={onCerrar} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ ...rotulo, marginBottom: 0 }}>Turnos</span>
          {(espacio.turnos || []).map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FB, fontSize: 12.5, color: T.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!tildados[t.id]} onChange={(e) => setTildados((v) => ({ ...v, [t.id]: e.target.checked }))} style={{ accentColor: T.accent }} />
              {t.nombre}
            </label>
          ))}
        </div>
        {urlCrono ? (
          <>
            <div style={rotulo}>Imagen 1 · Cronograma</div>
            <img src={urlCrono} alt="Imagen del cronograma para WhatsApp" style={imgSt} />
          </>
        ) : (
          <div style={{ padding: 30, textAlign: 'center', fontFamily: FB, fontSize: 12.5, color: T.text3, background: T.card, borderRadius: 12 }}>
            {incluidos.length ? 'Generando la imagen…' : 'Elegí al menos un turno para la imagen.'}
          </div>
        )}
        {urlFrancos && (
          <div style={{ marginTop: 10 }}>
            <div style={rotulo}>Imagen 2 · Francos</div>
            <img src={urlFrancos} alt="Imagen de los francos de la semana" style={imgSt} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton activo deshabilitado={!urlCrono} onClick={() => bajar(urlCrono, nombreCrono, 'Cronograma')}>⬇ Cronograma</Boton>
            {urlFrancos && <Boton activo onClick={() => bajar(urlFrancos, 'francos_' + base + '.png', 'Francos')}>⬇ Francos</Boton>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── modal: fecha especial (clic en la cabecera del día) ───────── */
function ModalFecha({ iso, actual, sucursalNombre, onGuardar, onQuitar, onCerrar }) {
  const [tipo, setTipo] = useState(tipoNorm(actual?.tipo) || 'feriado');
  const [nombre, setNombre] = useState(actual?.nombre || '');
  const [suma, setSuma] = useState(!!actual?.sumaPromedio);
  const [fijo, setFijo] = useState(!!actual?.fijo);
  const [guardando, setGuardando] = useState(false);
  const d = new Date(iso + 'T12:00:00');
  const rotulo = { fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 };
  const chk = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: FB, fontSize: 13, color: T.text, cursor: 'pointer', marginTop: 8 };
  const correr = async (fn) => { setGuardando(true); try { await fn(); } finally { setGuardando(false); } };
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>{DIAS[d.getDay()]} {dd2(d.getDate())}/{dd2(d.getMonth() + 1)}</div>
          <span onClick={onCerrar} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 2 }}>
          {tipo === 'feriado' || tipo === 'prefer'
            ? 'Los feriados valen para todas las sucursales.'
            : `Solo para ${sucursalNombre || 'esta sucursal'} (todos sus espacios).`}
        </div>
        <div style={rotulo}>Tipo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIPOS_FECHA.map((t) => <Boton key={t.v} activo={tipo === t.v} onClick={() => setTipo(t.v)}>{t.l}</Boton>)}
        </div>
        <div style={rotulo}>Nombre (opcional)</div>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Día de la Madre, Gin y Tarot"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
        <label style={chk}><input type="checkbox" checked={suma} onChange={(e) => setSuma(e.target.checked)} style={{ accentColor: T.accent }} />Suma al promedio de demanda</label>
        <label style={chk}><input type="checkbox" checked={fijo} onChange={(e) => setFijo(e.target.checked)} style={{ accentColor: T.accent }} />📌 Inamovible: se repite todos los años</label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          {actual ? <Boton peligro deshabilitado={guardando} onClick={() => correr(onQuitar)}>Quitar</Boton> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton onClick={onCerrar}>Cancelar</Boton>
            <Boton activo deshabilitado={guardando} onClick={() => correr(() => onGuardar({ fecha: iso, tipo, nombre: nombre.trim() || null, sumaPromedio: suma, fijo }))}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── marco común de los modales chicos ───────── */
function Marco({ ancho = 400, onCerrar, children }) {
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: ancho, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  );
}
const TituloModal = ({ children, onCerrar, sub }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>{children}</div>
      <span onClick={onCerrar} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
    </div>
    {sub && <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 2 }}>{sub}</div>}
  </div>
);
// opción grande de un modal (título + explicación), toda clickeable
const Opcion = ({ titulo, texto, onClick, peligro }) => (
  <div onClick={onClick} style={{ border: `1px solid ${peligro ? T.bad + '55' : T.border2}`, borderRadius: 12, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', background: T.head }}>
    <div style={{ fontFamily: FB, fontWeight: 700, fontSize: 13.5, color: peligro ? T.bad : T.text }}>{titulo}</div>
    <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, marginTop: 2 }}>{texto}</div>
  </div>
);

/* ───────── modal: + Semana (crear la siguiente copiando esta) ───────── */
function ModalNuevaSemana({ info, espacioNombre, onElegir, onCerrar }) {
  const nro = (id) => String(id).slice(4);
  return (
    <Marco onCerrar={onCerrar} ancho={420}>
      <TituloModal onCerrar={onCerrar} sub={info ? `${espacioNombre} · se crea a partir de la semana ${nro(info.origen)}. Los feriados no se copian (van por fecha).` : ''}>
        {info ? `Crear la semana ${nro(info.destino)}` : 'Preparando…'}
      </TituloModal>
      {!info ? (
        <div style={{ fontFamily: FB, fontSize: 13, color: T.text3, padding: '10px 0' }}>Revisando la semana siguiente…</div>
      ) : (
        <>
          {info.celdasDestino > 0 && (
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.bad, background: T.bad + '12', border: `1px solid ${T.bad}44`, borderRadius: 10, padding: '7px 10px', marginBottom: 10 }}>
              La semana {nro(info.destino)} ya tiene {info.celdasDestino} turnos cargados: lo que elijas los reemplaza.
            </div>
          )}
          <Opcion titulo="Copiar completa" texto="Filas, empleados y todos los turnos asignados." onClick={() => onElegir('completa')} />
          <Opcion titulo="Solo la estructura" texto="Cada fila queda reservada a su empleado, sin turnos." onClick={() => onElegir('estructura')} />
          <Opcion titulo="Vacía" texto="3 filas libres por turno, como una semana nueva." onClick={() => onElegir('vacia')} />
        </>
      )}
    </Marco>
  );
}

/* ───────── modal: vaciar la semana ───────── */
function ModalVaciar({ semanaId, espacioNombre, onElegir, onCerrar }) {
  return (
    <Marco onCerrar={onCerrar} ancho={400}>
      <TituloModal onCerrar={onCerrar} sub="Los feriados y eventos del día no se tocan.">
        Vaciar semana {String(semanaId).slice(4)} · {espacioNombre}
      </TituloModal>
      <Opcion titulo="Vaciar turnos" texto="Las filas quedan reservadas a cada empleado, sin turnos." onClick={() => onElegir('turnos')} peligro />
      <Opcion titulo="Vaciar todo" texto="Las filas quedan libres, sin empleados." onClick={() => onElegir('todo')} peligro />
    </Marco>
  );
}

/* ───────── modal: calendario de semanas ───────── */
function ModalCalendario({ semanaId, creadas, fechasMap, onElegir, onCerrar }) {
  const [mes, setMes] = useState(() => mesDeSemana(startDeId(semanaId)));
  const hoyIso = isoDe(new Date());
  const filas = semanasDelMes(mes);
  const mover = (n) => setMes((m) => { const d = new Date(m.y, m.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  return (
    <Marco onCerrar={onCerrar} ancho={340}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Boton onClick={() => mover(-1)} title="Mes anterior">‹</Boton>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text }}>{MESES_C[mes.m]} {mes.y}</div>
        <Boton onClick={() => mover(1)} title="Mes siguiente">›</Boton>
      </div>
      <div style={{ display: 'flex', textAlign: 'center', fontFamily: FB, fontSize: 11, fontWeight: 700, color: T.text3, marginBottom: 4 }}>
        {DC.map((d) => <span key={d} style={{ flex: '1 1 0' }}>{d}</span>)}
      </div>
      {filas.map((id) => {
        const ini = startDeId(id);
        const activa = id === semanaId;
        const creada = creadas.has(id);
        return (
          <div key={id} onClick={() => onElegir(id)} title={`Semana ${String(id).slice(4)}${creada ? ' · con cronograma' : ' · sin cronograma'}`}
            style={{ display: 'flex', textAlign: 'center', padding: '4px 0', marginBottom: 3, borderRadius: 8, cursor: 'pointer',
              background: activa ? T.accent + '33' : creada ? T.card : 'transparent', border: `1px solid ${activa ? T.accent : 'transparent'}` }}>
            {Array.from({ length: 7 }, (_, j) => {
              const iso = sumarDias(ini, j);
              const fuera = !enMes(iso, mes);
              const esp = fechasMap.get(iso);
              const hoy = iso === hoyIso;
              return (
                <div key={iso} style={{ flex: '1 1 0', fontFamily: FB, fontSize: 12.5, lineHeight: '22px', position: 'relative', color: fuera ? T.vacio : creada || activa ? T.text : T.text3 }}>
                  <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 11, background: hoy ? T.accent : 'transparent', color: hoy ? T.ink : undefined, fontWeight: hoy ? 700 : 400 }}>
                    {Number(iso.slice(8, 10))}
                  </span>
                  {esp && <span style={{ position: 'absolute', left: '50%', bottom: -2, marginLeft: -2.5, width: 5, height: 5, borderRadius: 3, background: colorCat(esp.tipo) }} />}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontFamily: FB, fontSize: 11, color: T.text3 }}>Sombreadas: con cronograma</span>
        <Boton onClick={() => onElegir(idDeSemana(domingoDeHoy()))}>HOY</Boton>
      </div>
    </Marco>
  );
}

/* ───────── modal: asignar empleado a una celda ───────── */
function ModalAsignar({ ctx, empleados, puestos, espacio, onGuardar, onCerrar }) {
  const [q, setQ] = useState('');
  const [empId, setEmpId] = useState(ctx.celda?.empleadoId || ctx.ownerEmpleadoId || null);
  const [tag, setTag] = useState(ctx.celda?.puesto || ctx.puestoFila || '');
  const [horas, setHoras] = useState(ctx.celda?.horas != null ? ctx.celda.horas : JORNADA_HS);

  const lista = useMemo(() => {
    const txt = q.trim().toLowerCase();
    const activos = empleados.filter((e) => e.activo !== false);
    const filtra = (e) => !txt || nombreDe(e).toLowerCase().includes(txt) || String(e.codigoMaxi || '').includes(txt);
    const sectorEsp = normSector(espacio?.sectorNomina);
    const esDelSector = (e) => sectorEsp && e.sector && normSector(e.sector) === sectorEsp;
    const propios = activos.filter((e) => esDelSector(e) && filtra(e));
    const resto = activos.filter((e) => !esDelSector(e) && filtra(e));
    return { propios, resto };
  }, [q, empleados, espacio]);

  const Fila = ({ e }) => (
    <div key={e.id} onClick={() => setEmpId(e.id)} style={{
      padding: '7px 10px', cursor: 'pointer', fontFamily: FB, fontSize: 13, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
      background: empId === e.id ? T.accent : 'transparent',
      color: empId === e.id ? T.ink : T.text, borderBottom: `1px solid ${T.border}`,
    }}>
      <span><span style={{ display: 'inline-block', minWidth: 34, fontSize: 11.5, color: empId === e.id ? T.ink : T.text3, fontVariantNumeric: 'tabular-nums' }}>{e.codigoMaxi || '—'}</span>{nombreDe(e)}</span>
      <span style={{ fontSize: 11, color: empId === e.id ? T.ink : T.text3 }}>{e.sector || ''}</span>
    </div>
  );

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>
          {DIAS[ctx.dia]} {ctx.nroDia} · {ctx.turnoNombre}
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '2px 0 12px' }}>
          Una fila por empleado por turno — el mismo empleado puede estar en otro turno.
        </div>

        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la nómina…"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }}
        />
        <div style={{ maxHeight: 190, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 8 }}>
          {lista.propios.map((e) => <Fila key={e.id} e={e} />)}
          {lista.propios.length > 0 && lista.resto.length > 0 && (
            <div style={{ padding: '4px 10px', fontFamily: FB, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.text3, background: T.head }}>Otros sectores</div>
          )}
          {lista.resto.map((e) => <Fila key={e.id} e={e} />)}
          {lista.propios.length === 0 && lista.resto.length === 0 && (
            <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: T.text3 }}>Sin resultados en la nómina.</div>
          )}
        </div>

        <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Puesto (opcional)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip color={!tag ? T.accentTxt : T.text3} activoBg={!tag} onClick={() => setTag('')}>Sin puesto</Chip>
          {puestos.map((p) => (
            <Chip key={p.codigo} color={T.text3} activoBg={tag === p.codigo} onClick={() => setTag(p.codigo)} title={p.nombre}>{p.codigo} · {p.nombre}</Chip>
          ))}
        </div>

        <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Horas de la jornada</div>
        <input
          type="number" min="1" max="16" step="0.5" value={horas}
          onChange={(e) => setHoras(Number(e.target.value))}
          style={{ width: 90, fontFamily: FB, fontSize: 13, padding: '7px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          {ctx.celda?.empleadoId ? (
            <Boton peligro onClick={() => onGuardar(null)}>Sacar de la celda</Boton>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton onClick={onCerrar}>Cancelar</Boton>
            <Boton grande activo deshabilitado={!empId} onClick={() => empId && onGuardar({ empleadoId: empId, puesto: tag || null, horas: horas > 0 ? horas : JORNADA_HS })}>Guardar</Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ página ═══════════════ */
export default function RrhhCronogramas() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [config, setConfig] = useState(null);           // {empleados, puestos, fechas, espacios}
  const [espacioId, setEspacioId] = useState(null);
  const [semanaId, setSemanaId] = useState(() => idDeSemana(domingoDeHoy()));
  const [semanasIdx, setSemanasIdx] = useState([]);     // listado liviano del back
  const [filas, setFilas] = useState([]);               // [{key, idBack?, turnoId, ownerEmpleadoId, celdas:{dia:{empleadoId,puesto,horas}}}]
  const [semanaExiste, setSemanaExiste] = useState(false);
  const [cargandoSemana, setCargandoSemana] = useState(false);
  const [guardado, setGuardado] = useState('ok');       // ok | pendiente | guardando | error
  const [celdaSel, setCeldaSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [fechaSel, setFechaSel] = useState(null);     // iso del día cuya cabecera se tocó
  const [minimizados, setMinimizados] = useState({}); // `${espacioId}:${turnoId}` → true
  const [nuevaSem, setNuevaSem] = useState(null);       // null | { cargando } | { origen, destino, celdasDestino }
  const [vaciarOpen, setVaciarOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [dropSobre, setDropSobre] = useState(null);     // `${filaKey}:${dia}` resaltada al arrastrar
  const [otrasDelMes, setOtrasDelMes] = useState([]);   // celdas de las OTRAS semanas del mes: [{iso, empleadoId, horas}]
  const dragRef = useRef(null);                          // { filaKey, dia } de la celda que se arrastra
  const { active: negocioActivo, activeBusinessId: negocioId } = useBusiness() || {};
  const bizId = negocioId ?? negocioActivo?.id ?? null;
  const navigate = useNavigate();
  const { branches = [], activeBranchId } = useBranch() || {};
  // Sucursal del cronograma: "Todas" o la principal → null (principal); si no, su id.
  const sucursalId = activeBranchId == null || activeBranchId === 'main' ? null : Number(activeBranchId);
  const sucursal = sucursalId == null ? (branches.find((b) => b.id === 'main' || b.isMain) || branches[0]) : branches.find((b) => Number(b.id) === sucursalId);
  const sucursalNombre = sucursal?.name || '';
  const variasSucursales = branches.length > 1;
  const nombreNegocio = negocioActivo?.name || negocioActivo?.nombre || '';
  const saveTimer = useRef(null);
  const pendienteRef = useRef(null); // { semanaId, body } del guardado programado
  const putEnVuelo = useRef(null);   // promesa del PUT en tránsito
  const filasRef = useRef(filas);
  filasRef.current = filas;

  const avisar = useCallback((msj, tipo = 'ok') => {
    setToast({ msj, tipo });
    setTimeout(() => setToast((t) => (t && t.msj === msj ? null : t)), 3200);
  }, []);

  /* ── carga inicial: config (siembra defaults) + índice de semanas ── */
  const cargarTodo = useCallback(async () => {
    setCargando(true); setErrorCarga('');
    try {
      await flushRef.current?.(); // lo pendiente de la sucursal (o negocio) anterior se guarda antes, en SU negocio
      const [cfg, sems] = await Promise.all([RrhhAPI.getConfig(sucursalId), RrhhAPI.listarSemanas()]);
      setConfig(cfg.config);
      setSemanasIdx(sems.semanas || []);
      const sy = cfg.sync;
      if (sy && (sy.altas?.length || sy.bajas?.length)) {
        const partes = [];
        if (sy.altas.length) partes.push(`${sy.altas.length} ${sy.altas.length === 1 ? 'alta' : 'altas'}`);
        if (sy.bajas.length) partes.push(`${sy.bajas.length} ${sy.bajas.length === 1 ? 'baja' : 'bajas'}`);
        avisar(`Nómina sincronizada con MaxiRest: ${partes.join(' · ')}.`);
      }
      // al cambiar de sucursal los espacios son otros: si el elegido no está, va el primero
      setEspacioId((prev) => (cfg.config.espacios.some((e) => e.id === prev) ? prev : cfg.config.espacios[0]?.id || null));
    } catch (e) {
      setErrorCarga(e?.data?.message || e.message || 'No se pudo cargar el módulo.');
    } finally {
      setCargando(false);
    }
  }, [avisar, sucursalId, bizId]);
  // Al cambiar de negocio no puede quedar NADA del anterior (mostraba la nómina y la semana de Container
  // en Comercio, y al guardar mandaba un espacio de Container: espacio_not_found — Diego 07/11/2026).
  const bizPrevio = useRef(bizId);
  useEffect(() => {
    if (bizPrevio.current !== bizId) { bizPrevio.current = bizId; setConfig(null); setFilas([]); setEspacioId(null); setSemanasIdx([]); setCeldaSel(null); }
    cargarTodo();
  }, [cargarTodo, bizId]);

  const espacio = useMemo(
    () => config?.espacios.find((e) => e.id === espacioId) || null,
    [config, espacioId]
  );
  const empleadosMap = useMemo(() => {
    const m = new Map();
    (config?.empleados || []).forEach((e) => m.set(e.id, e));
    return m;
  }, [config]);
  const fechasMap = useMemo(() => {
    const m = new Map();
    // primero las compartidas (feriados) y después las de la sucursal: si un día
    // tiene las dos, se ve el evento de la sucursal
    (config?.fechas || []).filter((f) => f.compartida !== false).forEach((f) => m.set(f.fecha, f));
    (config?.fechas || []).filter((f) => f.compartida === false).forEach((f) => m.set(f.fecha, f));
    return m;
  }, [config]);

  const fechaInicio = startDeId(semanaId);
  const diasISO = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(fechaInicio, i)), [fechaInicio]);

  /* ── cargar la semana del espacio activo ── */
  const filasVacias = useCallback((esp) => {
    const out = [];
    (esp?.turnos || []).forEach((t) => {
      for (let i = 0; i < 3; i++) out.push({ key: nuevaKey(), turnoId: t.id, ownerEmpleadoId: null, celdas: {} });
    });
    return out;
  }, []);

  useEffect(() => {
    if (!espacio) return;
    let alive = true;
    setCargandoSemana(true);
    // Primero persistir lo que quedó pendiente del espacio/semana anterior:
    // así este GET (y el del regreso) ya encuentran todo guardado.
    Promise.resolve(flushRef.current())
      .then(() => RrhhAPI.getSemana(semanaId, espacio.id))
      .then((r) => {
        if (!alive) return;
        if (r.found) {
          const fs = [];
          (r.semana.turnos || []).forEach((t) => {
            (t.filas || []).forEach((f) => {
              const celdas = {};
              (f.celdas || []).forEach((c) => { celdas[c.dia] = { empleadoId: c.empleadoId, puesto: c.puesto || null, horas: Number(c.horas) || JORNADA_HS }; });
              fs.push({ key: nuevaKey(), idBack: f.id, turnoId: t.turnoId, ownerEmpleadoId: f.ownerEmpleadoId || null, celdas });
            });
          });
          setFilas(fs);
          setSemanaExiste(true);
        } else {
          setFilas(filasVacias(espacio));
          setSemanaExiste(false);
        }
        setGuardado('ok');
      })
      .catch(() => { if (alive) { setFilas(filasVacias(espacio)); setSemanaExiste(false); } })
      .finally(() => { if (alive) setCargandoSemana(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacioId, semanaId, config]);

  /* ── guardado (PUT reemplaza la semana del espacio) ── */
  const armarBody = useCallback((fs, fi = fechaInicio) => {
    const porTurno = new Map();
    (espacio?.turnos || []).forEach((t) => porTurno.set(t.id, []));
    fs.forEach((f) => {
      if (!porTurno.has(f.turnoId)) porTurno.set(f.turnoId, []);
      porTurno.get(f.turnoId).push({
        ownerEmpleadoId: f.ownerEmpleadoId || duenoDe(f) || null,
        celdas: Object.entries(f.celdas)
          .filter(([, c]) => c && c.empleadoId)
          .map(([dia, c]) => ({ dia: Number(dia), empleadoId: c.empleadoId, puesto: c.puesto || null, horas: c.horas != null ? c.horas : JORNADA_HS })),
      });
    });
    return {
      espacioId: espacio.id,
      fechaInicio: fi,
      turnos: [...porTurno.entries()].map(([turnoId, fls]) => ({ turnoId, filas: fls })),
    };
  }, [espacio, fechaInicio]);

  // El guardado pendiente viaja con SU snapshot (semana + body del espacio en
  // el que se editó): aunque dispare tarde o el usuario ya esté en otra solapa,
  // guarda exactamente lo que se tocó y nunca el estado de otro espacio.
  const guardarAhora = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const p = pendienteRef.current;
    if (!p) return;
    pendienteRef.current = null;
    setGuardado('guardando');
    try {
      putEnVuelo.current = RrhhAPI.putSemana(p.semanaId, p.body, p.bizId);
      const r = await putEnVuelo.current;
      // Si mientras viajaba el PUT se tocó algo más, hay otro pendiente: no pisar su cartel.
      setGuardado((g) => (pendienteRef.current ? g : 'ok'));
      setSemanaExiste((v) => v || (p.semanaId === semanaId && p.body.espacioId === espacio?.id));
      setSemanasIdx((prev) => {
        if (prev.some((s) => s.semana === p.semanaId && s.espacioId === p.body.espacioId)) return prev;
        return [...prev, { id: r?.semana?.id, espacioId: p.body.espacioId, semana: p.semanaId, fechaInicio: p.body.fechaInicio }];
      });
    } catch (e) {
      setGuardado('error');
      if (e?.data?.error === 'empleado_repetido_en_turno') {
        avisar('Ese empleado ya tiene una fila en ese turno: el guardado se rechazó y se recargó la semana.', 'error');
      } else {
        avisar(e?.data?.message || e.message || 'No se pudo guardar la semana.', 'error');
      }
    }
  }, [espacio, semanaId, avisar]);

  // Despacha YA el guardado pendiente (si lo hay). Se usa al cambiar de
  // espacio/semana y al desmontar, para que nada quede sin persistir.
  const flushPendiente = useCallback(async () => {
    if (pendienteRef.current) await guardarAhora();
    else if (putEnVuelo.current) await putEnVuelo.current.catch(() => {});
  }, [guardarAhora]);
  const flushRef = useRef(flushPendiente);
  flushRef.current = flushPendiente;

  const programarGuardado = useCallback((filasSnapshot) => {
    setGuardado('pendiente');
    pendienteRef.current = { semanaId, body: armarBody(filasSnapshot), bizId: getSession().activeBusinessId };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(guardarAhora, 1200);
  }, [semanaId, armarBody, guardarAhora]);
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushRef.current();            // mejor esfuerzo al salir de la página
  }, []);

  const mutarFilas = useCallback((fn) => {
    setFilas((prev) => { const next = fn(prev); filasRef.current = next; programarGuardado(next); return next; });
  }, [programarGuardado]);

  /* ── acciones de grilla ── */
  const abrirCelda = (fila, dia, turno) => {
    const celda = fila.celdas[dia] || null;
    // autocompletar: fila con dueño que ya tiene turnos cargados → repetir patrón sin modal
    if (!celda && fila.ownerEmpleadoId) {
      const patron = Object.values(fila.celdas).find((c) => c && c.empleadoId === fila.ownerEmpleadoId);
      if (patron) {
        mutarFilas((fs) => fs.map((f) => f.key === fila.key
          ? { ...f, celdas: { ...f.celdas, [dia]: { empleadoId: patron.empleadoId, puesto: patron.puesto, horas: patron.horas } } }
          : f));
        return;
      }
    }
    const patronFila = Object.values(fila.celdas).find((c) => c && c.puesto);
    setCeldaSel({
      filaKey: fila.key, dia, turnoId: turno.id, turnoNombre: turno.nombre,
      nroDia: new Date(diasISO[dia] + 'T12:00:00').getDate(),
      celda, ownerEmpleadoId: fila.ownerEmpleadoId, puestoFila: patronFila?.puesto || '',
    });
  };

  const guardarCelda = (valor) => {
    const { filaKey, dia, turnoId } = celdaSel;
    if (valor && duenoEnTurno(filasRef.current, turnoId, valor.empleadoId, filaKey)) {
      const emp = empleadosMap.get(valor.empleadoId);
      avisar(`${nombreCorto(emp)} ya tiene una fila en este turno: cargale los días ahí.`, 'error');
      return;
    }
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== filaKey) return f;
      const celdas = { ...f.celdas };
      if (valor) celdas[dia] = valor; else delete celdas[dia];
      const owner = !Object.keys(celdas).length ? null : f.ownerEmpleadoId || (valor ? valor.empleadoId : null);
      return { ...f, celdas, ownerEmpleadoId: owner };
    }));
    setCeldaSel(null);
  };

  const sacarCelda = (fila, dia) => {
    if (!fila.celdas[dia]) return;
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== fila.key) return f;
      const celdas = { ...f.celdas };
      delete celdas[dia];
      // sin días cargados la fila vuelve a quedar libre (si no, el empleado seguía «pegado» a la fila)
      return { ...f, celdas, ownerEmpleadoId: Object.keys(celdas).length ? f.ownerEmpleadoId : null };
    }));
  };

  const agregarFila = (turnoId) =>
    mutarFilas((fs) => [...fs, { key: nuevaKey(), turnoId, ownerEmpleadoId: null, celdas: {} }]);

  const quitarFila = (fila) => {
    if (Object.keys(fila.celdas).length) { avisar('La fila tiene turnos cargados: vaciala antes de quitarla.', 'error'); return; }
    mutarFilas((fs) => fs.filter((f) => f.key !== fila.key));
  };

  /* ── + Semana: crea la SIGUIENTE copiando la que se está viendo ── */
  const abrirNuevaSemana = async () => {
    if (!espacio) return;
    setNuevaSem({ cargando: true });
    try {
      await flushRef.current();
      const destino = semanaId + 1;
      const r = await RrhhAPI.getSemana(destino, espacio.id);
      const celdasDestino = r?.found ? (r.semana.turnos || []).reduce((a, t) => a + (t.filas || []).reduce((b, f) => b + (f.celdas || []).length, 0), 0) : 0;
      setNuevaSem({ origen: semanaId, destino, celdasDestino });
    } catch (e) {
      setNuevaSem(null);
      avisar(e?.data?.message || e.message || 'No se pudo revisar la semana siguiente.', 'error');
    }
  };
  const crearSemana = async (modo) => {
    const { destino } = nuevaSem;
    const base = filasRef.current;
    const turnosOk = new Set((espacio.turnos || []).map((t) => t.id));
    let fs;
    if (modo === 'completa') {
      fs = base.filter((f) => turnosOk.has(f.turnoId)).map((f) => ({ key: nuevaKey(), turnoId: f.turnoId, ownerEmpleadoId: duenoDe(f), celdas: JSON.parse(JSON.stringify(f.celdas)) }));
    } else if (modo === 'estructura') {
      fs = base.filter((f) => turnosOk.has(f.turnoId)).map((f) => ({ key: nuevaKey(), turnoId: f.turnoId, ownerEmpleadoId: duenoDe(f), celdas: {} }));
    } else {
      fs = filasVacias(espacio);
    }
    try {
      await RrhhAPI.putSemana(destino, armarBody(fs, startDeId(destino)));
      setSemanasIdx((prev) => (prev.some((s) => Number(s.semana) === destino && s.espacioId === espacio.id) ? prev
        : [...prev, { espacioId: espacio.id, semana: destino, fechaInicio: startDeId(destino) }]));
      setNuevaSem(null);
      setSemanaId(destino);
      avisar(`Semana ${String(destino).slice(4)} creada ✓`);
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo crear la semana.', 'error');
    }
  };

  /* ── Vaciar ── */
  const vaciar = (modo) => {
    if (modo === 'turnos') mutarFilas((fs) => fs.map((f) => ({ ...f, ownerEmpleadoId: duenoDe(f), celdas: {} })));
    else mutarFilas((fs) => fs.map((f) => ({ ...f, ownerEmpleadoId: null, celdas: {} })));
    setVaciarOpen(false);
    avisar(modo === 'turnos' ? 'Turnos vaciados: las filas quedan reservadas.' : 'Semana vaciada.');
  };

  /* ── drag & drop (reglas del v31) ── */
  const soltar = (destFila, diaDest) => {
    const src = dragRef.current;
    dragRef.current = null; setDropSobre(null);
    if (!src || (src.filaKey === destFila.key && src.dia === diaDest)) return;
    const fs = filasRef.current;
    const srcFila = fs.find((f) => f.key === src.filaKey);
    const dest = fs.find((f) => f.key === destFila.key);
    const celda = srcFila?.celdas[src.dia];
    if (!celda || !dest) return;
    const emp = empleadosMap.get(celda.empleadoId);
    if (dest.celdas[diaDest]) { avisar('Esa celda ya tiene un turno: soltá en una celda vacía.', 'error'); return; }
    const owner = duenoDe(dest);
    if (owner && owner !== celda.empleadoId) {
      avisar(`La fila es de ${nombreCorto(empleadosMap.get(owner))}: no se mezclan empleados en una fila.`, 'error'); return;
    }
    if (!owner && duenoEnTurno(fs, dest.turnoId, celda.empleadoId, dest.key)) {
      avisar(`${nombreCorto(emp)} ya tiene una fila en este turno: soltá dentro de su fila.`, 'error'); return;
    }
    mutarFilas((prev) => prev.map((f) => {
      let celdas = f.celdas; let ownerEmpleadoId = f.ownerEmpleadoId;
      if (f.key === src.filaKey) { celdas = { ...celdas }; delete celdas[src.dia]; if (f.key !== dest.key && !Object.keys(celdas).length) ownerEmpleadoId = null; }
      if (f.key === dest.key) { celdas = { ...celdas, [diaDest]: celda }; ownerEmpleadoId = ownerEmpleadoId || celda.empleadoId; }
      return celdas === f.celdas ? f : { ...f, celdas, ownerEmpleadoId };
    }));
  };

  /* ── fechas especiales (PUT /config manda la colección completa) ── */
  const guardarFechas = async (fechas, msj) => {
    try {
      const r = await RrhhAPI.putConfig({ fechas }, sucursalId);
      if (r?.config) setConfig(r.config);
      avisar(msj);
      setFechaSel(null);
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo guardar la fecha.', 'error');
    }
  };
  // Se reemplaza solo la fecha que se ve ese día (si hay un feriado compartido
  // debajo de un evento de la sucursal, el feriado no se toca).
  const esLaVista = (x) => {
    const v = fechasMap.get(fechaSel);
    return v && x.fecha === v.fecha && (x.compartida !== false) === (v.compartida !== false);
  };
  const guardarFecha = (f) => guardarFechas(
    [...(config?.fechas || []).filter((x) => !esLaVista(x)), f],
    `Fecha ${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} guardada ✓`
  );
  const quitarFecha = () => guardarFechas(
    (config?.fechas || []).filter((x) => !esLaVista(x)),
    'Fecha quitada ✓'
  );

  /* ── totales por empleado (semana del espacio) ── */
  const totales = useMemo(() => {
    const m = new Map(); // empleadoId → {semCnt, hs, dias:Set}
    filas.forEach((f) => Object.entries(f.celdas).forEach(([dia, c]) => {
      if (!c?.empleadoId) return;
      if (!m.has(c.empleadoId)) m.set(c.empleadoId, { semCnt: 0, hs: 0, dias: new Set() });
      const t = m.get(c.empleadoId);
      t.semCnt += 1; t.hs += Number(c.horas) || JORNADA_HS; t.dias.add(Number(dia));
    }));
    const out = new Map();
    m.forEach((t, id) => {
      const francos = t.semCnt === 0 ? [] : DIAS.filter((_, j) => !t.dias.has(j));
      out.set(id, { ...t, francos });
    });
    return out;
  }, [filas]);

  const mesRef = useMemo(() => mesDeSemana(fechaInicio), [fechaInicio]);
  useEffect(() => {
    if (!espacio) return;
    let alive = true;
    const ids = semanasDelMes(mesRef).filter((id) => id !== semanaId);
    Promise.resolve(flushRef.current())
      .then(() => Promise.all(ids.map((id) => RrhhAPI.getSemana(id, espacio.id).then((r) => ({ id, r })).catch(() => ({ id, r: null })))))
      .then((res) => {
        if (!alive) return;
        const out = [];
        res.forEach(({ id, r }) => {
          if (!r?.found) return;
          const ini = startDeId(id);
          (r.semana.turnos || []).forEach((t) => (t.filas || []).forEach((f) => (f.celdas || []).forEach((c) => {
            out.push({ iso: sumarDias(ini, Number(c.dia)), empleadoId: c.empleadoId, horas: Number(c.horas) || JORNADA_HS });
          })));
        });
        setOtrasDelMes(out);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacioId, semanaId, config]);
  const totalesMes = useMemo(() => {
    const m = new Map();
    const sumar = (id, hs) => { const t = m.get(id) || { dias: 0, hs: 0 }; t.dias += 1; t.hs += hs; m.set(id, t); };
    otrasDelMes.forEach((c) => { if (enMes(c.iso, mesRef)) sumar(c.empleadoId, c.horas); });
    filas.forEach((f) => Object.entries(f.celdas).forEach(([dia, c]) => {
      if (c?.empleadoId && enMes(diasISO[Number(dia)], mesRef)) sumar(c.empleadoId, Number(c.horas) || JORNADA_HS);
    }));
    return m;
  }, [otrasDelMes, filas, diasISO, mesRef]);
  const semanasCreadas = useMemo(
    () => new Set(semanasIdx.filter((s) => s.espacioId === espacioId).map((s) => Number(s.semana))),
    [semanasIdx, espacioId]
  );

  const sinJornadas = useMemo(() => {
    const sec = normSector(espacio?.sectorNomina);
    if (!sec) return [];
    return (config?.empleados || [])
      .filter((e) => e.activo !== false && normSector(e.sector) === sec && !totales.has(e.id))
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  }, [config, espacio, totales]);

  /* ── estilos compartidos de la tabla ── */
  // El tema de la app pinta todo «thead th» con el color del negocio (!important): los textos del
  // encabezado van en el color de contraste del tema, si no los días no se leían (Diego 07/11/2026).
  const thDia = { padding: '7px 4px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: TH_TXT, borderBottom: `1px solid ${T.border2}`, borderLeft: `1px solid ${T.border}`, background: T.head, textAlign: 'center' };
  const colFila = { width: 132, minWidth: 132, maxWidth: 132, boxSizing: 'border-box' };
  const thSup = { position: 'sticky', top: 0, zIndex: 3, height: 26, boxSizing: 'border-box', padding: '4px 6px', fontSize: 11 };
  const thSub = { position: 'sticky', top: 26, zIndex: 3, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontFamily: FB, fontSize: 10.5, color: TH_TXT, opacity: 0.85, minWidth: 34 };
  const celTot = { padding: '4px 6px', textAlign: 'center', borderBottom: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}`, fontFamily: FB, fontSize: 12, color: T.text2, background: T.head };

  /* ═════ render ═════ */
  if (cargando) {
    return <div style={{ padding: 32, fontFamily: FB, color: T.text2, background: T.bg, minHeight: '60vh' }}>Cargando Cronogramas…</div>;
  }
  if (errorCarga) {
    return (
      <div style={{ padding: 32, fontFamily: FB, background: T.bg, minHeight: '60vh' }}>
        <div style={{ color: T.bad, fontWeight: 700, marginBottom: 10 }}>{errorCarga}</div>
        <Boton activo onClick={cargarTodo}>Reintentar</Boton>
      </div>
    );
  }

  const sinNomina = !(config?.empleados || []).length;

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: '14px 18px 40px', boxSizing: 'border-box' }}>
      {/* barra del módulo — fila 1: espacios + acciones · fila 2: semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginRight: 6 }}>Cronogramas</div>
        {(config?.espacios || []).map((e) => (
          <Boton key={e.id} activo={e.id === espacioId} onClick={() => setEspacioId(e.id)}>{e.nombre}</Boton>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FB, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', marginRight: 4, color: guardado === 'error' ? T.bad : guardado === 'ok' ? T.ok : T.text3 }}>
          {guardado === 'guardando' || guardado === 'pendiente' ? 'Guardando…' : guardado === 'error' ? 'Sin guardar ⚠' : semanaExiste ? 'Guardado ✓' : ''}
        </span>
        <Boton prox onClick={() => avisar('Llega en la próxima tanda.')}>⚙ Configuración</Boton>
        <Boton activo deshabilitado={sinNomina || !espacio} onClick={() => setExportOpen(true)} title="Imagen del cronograma y de los francos para WhatsApp">🖼 Exportar imagen</Boton>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Boton onClick={() => setSemanaId((s) => s - 1)} title="Semana anterior">‹</Boton>
        <div onClick={() => setCalOpen(true)} title="Abrir calendario" style={{ textAlign: 'center', minWidth: 250, cursor: 'pointer' }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: 'nowrap' }}>
            Semana {String(semanaId).slice(4)} <span style={{ fontSize: 12 }}>📅</span>
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, whiteSpace: 'nowrap' }}>{rangoLargo(fechaInicio)}</div>
        </div>
        <Boton onClick={() => setSemanaId((s) => s + 1)} title="Semana siguiente">›</Boton>
        <Boton onClick={() => setSemanaId(idDeSemana(domingoDeHoy()))} title="Ir a la semana de hoy">HOY</Boton>
        <div style={{ width: 1, alignSelf: 'stretch', background: T.border2, margin: '0 4px' }} />
        <Boton deshabilitado={sinNomina || !espacio} onClick={abrirNuevaSemana} title="Crear la semana siguiente copiando esta">+ Semana</Boton>
        <Boton peligro deshabilitado={sinNomina || !espacio || !semanaExiste} onClick={() => setVaciarOpen(true)} title="Vaciar esta semana">Vaciar</Boton>
      </div>

      {/* arranque sin nómina */}
      {sinNomina ? (
        <div style={{ maxWidth: 520, margin: '60px auto', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 28, textAlign: 'center' }}>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginBottom: 8 }}>Arranquemos con los cronogramas</div>
          <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, marginBottom: 18 }}>
            Todavía no hay empleados. Si el negocio tiene MaxiRest, la nómina entra sola; si no, dalos de alta en Nómina.
          </div>
          <Boton grande activo onClick={() => navigate('/rrhh/nomina')}>Ir a Nómina</Boton>
        </div>
      ) : (
        <>
          {!semanaExiste && !cargandoSemana && (
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '18', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 10 }}>
              Esta semana todavía no tiene cronograma en {espacio?.nombre}: se guarda sola al cargar el primer empleado.
            </div>
          )}

          <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'auto', maxHeight: 'calc(100vh - 225px)' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 980 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...thDia, ...colFila, position: 'sticky', top: 0, left: 0, zIndex: 4, textAlign: 'left', fontFamily: FB, fontSize: 10.5, color: TH_TXT, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5, verticalAlign: 'bottom' }}>Fila / empleado</th>
                  {diasISO.map((iso, i) => {
                    const esp = fechasMap.get(iso);
                    const d = new Date(iso + 'T12:00:00');
                    return (
                      <th key={iso} rowSpan={2} onClick={() => setFechaSel(iso)}
                        title={esp ? `${etiquetaTipo(esp.tipo)}${esp.nombre ? ` · ${esp.nombre}` : ''} — clic para editar` : 'Clic para cargar un feriado o evento'}
                        style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, cursor: 'pointer', background: esp ? colorCat(esp.tipo) + '22' : T.head }}>
                        <div style={{ color: TH_TXT }}>{DC[i]} {d.getDate()}</div>
                        {/* la fecha especial va en una pastilla blanca: se lee sobre cualquier color de negocio */}
                        <div style={{ height: 16, marginTop: 2, fontFamily: FB, fontWeight: 700, fontSize: 10, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110, margin: '2px auto 0',
                          ...(esp ? { display: 'inline-block', padding: '0 7px', borderRadius: 8, background: '#fff', color: colorCat(esp.tipo) } : { color: TH_TXT, opacity: 0.7 }) }}>
                          {esp ? (esp.nombre || etiquetaTipo(esp.tipo)) : '+ especial'}
                        </div>
                      </th>
                    );
                  })}
                  <th colSpan={2} style={{ ...thDia, ...thSup, borderLeft: `2px solid ${T.border2}` }}>Semana</th>
                  <th colSpan={2} style={{ ...thDia, ...thSup }} title={`Días dentro de ${MESES_L[mesRef.m]} (todas las semanas del mes en este espacio)`}>{MESES_C[mesRef.m]}</th>
                  <th rowSpan={2} style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 100 }} title="Días sin turno esta semana">Francos</th>
                  <th rowSpan={2} style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 26 }} />
                </tr>
                <tr>
                  {['Días', 'Hs', 'Días', 'Hs'].map((h, i) => (
                    <th key={i} style={{ ...thDia, ...thSub, borderLeft: i === 0 ? `2px solid ${T.border2}` : thDia.borderLeft }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(espacio?.turnos || []).map((t) => {
                  const slots = filas.filter((f) => f.turnoId === t.id);
                  const kMin = `${espacioId}:${t.id}`;
                  const minim = !!minimizados[kMin];
                  return (
                    <React.Fragment key={t.id}>
                      <tr>
                        <td colSpan={14} onClick={() => setMinimizados((m) => ({ ...m, [kMin]: !m[kMin] }))} title={minim ? 'Mostrar el turno' : 'Minimizar el turno'}
                          style={{ padding: '6px 12px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: T.accentTxt, background: T.head, borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: 1, position: 'sticky', top: 50, zIndex: 2, cursor: 'pointer', userSelect: 'none' }}>
                          <span style={{ display: 'inline-block', width: 14 }}>{minim ? '▸' : '▾'}</span>
                          {t.nombre}
                          {t.entrada && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3 }}> · entra {t.entrada}</span>}
                          {minim && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3 }}> · {slots.length} {slots.length === 1 ? 'fila oculta' : 'filas ocultas'}</span>}
                        </td>
                      </tr>
                      {!minim && slots.map((f) => {
                        const dueno = duenoDe(f);
                        const tot = dueno ? totales.get(dueno) : null;
                        const francos = tot?.francos || [];
                        const totMes = dueno ? totalesMes.get(dueno) : null;
                        return (
                          <tr key={f.key}>
                            <td style={{ ...colFila, position: 'sticky', left: 0, zIndex: 1, background: T.head, borderBottom: `1px solid ${T.border}`, padding: '4px 10px', fontFamily: FB, fontSize: 12.5, fontWeight: dueno ? 700 : 400, color: dueno ? T.text : T.vacio, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={dueno ? nombreDe(empleadosMap.get(dueno)) : 'Fila libre'}>
                              {dueno ? nombreDe(empleadosMap.get(dueno)) : 'Fila libre'}
                            </td>
                            {diasISO.map((iso, dia) => {
                              const c = f.celdas[dia];
                              const emp = c ? empleadosMap.get(c.empleadoId) : null;
                              return (
                                <td
                                  key={iso}
                                  onClick={() => abrirCelda(f, dia, t)}
                                  onContextMenu={(e) => { e.preventDefault(); sacarCelda(f, dia); }}
                                  draggable={!!c}
                                  onDragStart={(e) => { dragRef.current = { filaKey: f.key, dia }; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'turno'); } catch (_) {} }}
                                  onDragOver={(e) => { if (dragRef.current) e.preventDefault(); }}
                                  onDragEnter={() => { if (dragRef.current) setDropSobre(`${f.key}:${dia}`); }}
                                  onDrop={(e) => { e.preventDefault(); soltar(f, dia); }}
                                  onDragEnd={() => { dragRef.current = null; setDropSobre(null); }}
                                  title={c ? `${nombreDe(emp)} · arrastrá para mover · click derecho: sacar` : 'Cargar empleado'}
                                  style={{
                                    padding: '4px 2px', borderBottom: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}`,
                                    cursor: c ? 'grab' : 'pointer', background: c ? T.card : 'transparent', minWidth: 78,
                                    outline: dropSobre === `${f.key}:${dia}` ? `2px dashed ${T.accent}` : 'none', outlineOffset: -3,
                                  }}
                                >
                                  <div style={{ height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    {c ? (
                                      <>
                                        <div style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: T.text, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreCorto(emp)}</div>
                                        <div style={{ height: 16, display: 'flex', gap: 3, alignItems: 'center' }}>
                                          {c.puesto && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.accentTxt, border: `1px solid ${T.accentTxt}55`, borderRadius: 6, padding: '0 4px' }}>{c.puesto}</span>}
                                          {c.horas !== JORNADA_HS && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '0 4px' }} title="Horas de la jornada">{c.horas}h</span>}
                                        </div>
                                      </>
                                    ) : (
                                      <span style={{ fontFamily: FB, fontSize: 14, color: T.vacio }}>+</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{ ...celTot, borderLeft: `2px solid ${T.border2}`, fontFamily: FT, fontWeight: 700, fontSize: 13, color: tot && tot.semCnt >= 6 ? T.warn : T.accentTxt }}>{tot ? tot.semCnt : '—'}</td>
                            <td style={celTot}>{tot ? tot.hs : '—'}</td>
                            <td style={{ ...celTot, fontFamily: FT, fontWeight: 700, fontSize: 13, color: T.accentTxt }}>{totMes ? totMes.dias : '—'}</td>
                            <td style={celTot}>{totMes ? Math.round(totMes.hs * 10) / 10 : '—'}</td>
                            <td style={{ ...celTot, textAlign: 'left', fontSize: 11 }}>
                              {!tot ? '—' : francos.length === 0 ? '—'
                                : francos.length > 3
                                  ? <span style={{ color: T.violet, fontWeight: 700 }}>Eventual · {tot.semCnt} jorn.</span>
                                  : francos.join(', ')}
                            </td>
                            <td style={{ ...celTot, cursor: 'pointer' }} onClick={() => quitarFila(f)} title="Quitar fila (solo si está vacía)">
                              <span style={{ color: T.text3 }}>✕</span>
                            </td>
                          </tr>
                        );
                      })}
                      {!minim && (
                        <tr>
                          <td colSpan={14} style={{ padding: '6px 12px', borderBottom: `1px solid ${T.border}` }}>
                            <span onClick={() => agregarFila(t.id)} style={{ fontFamily: FB, fontSize: 12, fontWeight: 600, color: T.accentTxt, cursor: 'pointer' }}>
                              + Agregar empleado en {t.nombre}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {cargandoSemana && <div style={{ padding: 14, fontFamily: FB, fontSize: 12.5, color: T.text3 }}>Cargando la semana…</div>}
          </div>

          {sinJornadas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginRight: 2 }}>Sin jornadas en la semana {String(semanaId).slice(4)}:</span>
              {sinJornadas.map((e) => <Chip key={e.id} color={T.text3}>{nombreDe(e)}</Chip>)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginRight: 2 }}>Puestos:</span>
            {(config?.puestos || []).map((p) => <Chip key={p.codigo} color={T.accentTxt}>{p.codigo} · {p.nombre}</Chip>)}
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 8 }}>
            Click en una celda carga un empleado · arrastrala para moverla · click derecho la saca · click en el día carga un feriado o evento · click en el turno lo minimiza · los cambios se guardan solos.
          </div>
        </>
      )}

      {/* modales y toast */}
      {exportOpen && espacio && (
        <ModalExportar
          espacio={espacio}
          negocio={variasSucursales && sucursalNombre ? sucursalNombre : nombreNegocio}
          semanaId={semanaId}
          rango={rangoLargo(fechaInicio)}
          diasISO={diasISO}
          fechasMap={fechasMap}
          filas={filas}
          empleadosMap={empleadosMap}
          totales={totales}
          avisar={avisar}
          onCerrar={() => setExportOpen(false)}
        />
      )}
      {nuevaSem && espacio && (
        <ModalNuevaSemana
          info={nuevaSem.cargando ? null : nuevaSem}
          espacioNombre={espacio.nombre}
          onElegir={crearSemana}
          onCerrar={() => setNuevaSem(null)}
        />
      )}
      {vaciarOpen && espacio && (
        <ModalVaciar semanaId={semanaId} espacioNombre={espacio.nombre} onElegir={vaciar} onCerrar={() => setVaciarOpen(false)} />
      )}
      {calOpen && (
        <ModalCalendario
          semanaId={semanaId}
          creadas={semanasCreadas}
          fechasMap={fechasMap}
          onElegir={(id) => { setCalOpen(false); setSemanaId(id); }}
          onCerrar={() => setCalOpen(false)}
        />
      )}
      {fechaSel && (
        <ModalFecha
          iso={fechaSel}
          actual={fechasMap.get(fechaSel) || null}
          sucursalNombre={sucursalNombre}
          onGuardar={guardarFecha}
          onQuitar={quitarFecha}
          onCerrar={() => setFechaSel(null)}
        />
      )}
      {celdaSel && espacio && (
        <ModalAsignar
          ctx={celdaSel}
          empleados={config.empleados}
          puestos={config.puestos}
          espacio={espacio}
          onGuardar={guardarCelda}
          onCerrar={() => setCeldaSel(null)}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.band, border: `1px solid ${toast.tipo === 'error' ? T.bad : T.accent}88`, color: toast.tipo === 'error' ? T.bad : T.text, fontFamily: FB, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 12, boxShadow: T.sombra, zIndex: 60 }}>
          {toast.msj}
        </div>
      )}
    </div>
  );
}