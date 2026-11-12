// src/paginas/RrhhCronogramasModales.jsx
// RRHH › Cronogramas — modales (asignar, fila completa, turno, fecha especial,
// + Semana, Vaciar, calendario) y la imagen para WhatsApp.
import React, { useState, useEffect, useMemo } from 'react';
import {
  T,
  FT,
  FB,
  JORNADA_HS,
  DIAS,
  DC,
  MESES_C,
  dd2,
  isoDe,
  sumarDias,
  idDeSemana,
  startDeId,
  domingoDeHoy,
  TIPOS_FECHA,
  tipoNorm,
  etiquetaTipo,
  mesDeSemana,
  enMes,
  semanasDelMes,
  colorCat,
  horarioDe,
  coloresHorarios,
  horasEntre,
  normSector,
  esHabitual,
  Chip,
  Boton,
  nombreDe,
  nombreFila,
} from './RrhhCronogramasComun';
import logoLazarillo from '@/assets/brand/logo-dark.png';

/* ───────── imagen para WhatsApp (Canvas, siempre en modo día) ─────────
 * Dos PNG por espacio y semana: 1) cronograma de los turnos tildados,
 * 2) francos de la semana (sin eventuales, cuyo chip ya está en la grilla).
 */
// Tabla clásica: una fila por empleado, una columna por día. Cada uno encuentra su renglón
// sin nombres cortados; el día vacío es franco. Logo real (wordmark) en el pie.
const IMG = { W: 760, S: 2, P: 20, bg: '#FFFFFF', celda: '#E4F4FB', libre: '#F4F6F9', ink: '#15213E', acc: '#1E87B5', gris: '#5a6a82', pie: '#8aa0b5', esp: '#B97700', linea: '#E3E8EF' };
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const recortar = (ctx, txt, ancho) => {
  if (ctx.measureText(txt).width <= ancho) return txt;
  let t = txt;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t + '…';
};
// «milagros» → «Milagros» (en la imagen todos los nombres igual)
const titular = (t) => String(t || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
let logoProm = null;
const cargarLogo = () => {
  if (!logoProm) {
    logoProm = new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im); im.onerror = () => ok(null);
      im.src = logoLazarillo;
    });
  }
  return logoProm;
};
function lienzo(H) {
  const cv = document.createElement('canvas');
  cv.width = IMG.W * IMG.S; cv.height = Math.round(H * IMG.S);
  const ctx = cv.getContext('2d'); ctx.scale(IMG.S, IMG.S);
  ctx.fillStyle = IMG.bg; ctx.fillRect(0, 0, IMG.W, H);
  return { cv, ctx };
}
const CAB_H = 46;
function cabeceraImg(ctx, titulo, sub) {
  const { P } = IMG;
  ctx.textAlign = 'left'; ctx.fillStyle = IMG.ink; ctx.font = "700 18px Sora, sans-serif"; ctx.fillText(titulo, P, P + 15);
  ctx.fillStyle = IMG.gris; ctx.font = "500 11.5px Archivo, sans-serif"; ctx.fillText(sub, P, P + 32);
}
const PIE_H = 26;
function pieImg(ctx, H, logo) {
  const { W, P } = IMG; const y = H - P - 4;
  ctx.strokeStyle = IMG.linea; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P, y - 14); ctx.lineTo(W - P, y - 14); ctx.stroke();
  ctx.fillStyle = IMG.pie; ctx.font = "400 9px Archivo, sans-serif"; ctx.textAlign = 'left';
  ctx.fillText('Hecho con Lazarillo Gestión · lazarillo.com.ar', P, y);
  if (logo) {
    const h = 10; const w = h * (logo.width / logo.height);
    ctx.globalAlpha = 0.55; ctx.drawImage(logo, W - P - w, y - h + 1, w, h); ctx.globalAlpha = 1;
  }
}
// grupos: [{ turno:{nombre,entrada}, filas:[{ nombre, celdas:{dia:{puesto,hora,colorHora}} }] }] · dias: [{nro, dc, ev}]
function dibujarCronograma({ titulo, sub, dias, grupos, logo }) {
  const gs = grupos.filter((g) => g.filas.length);
  if (!gs.length) return null;
  const { W, P } = IMG;
  const NOM = 178; const GAP = 3; const FILA = 30;
  const colW = (W - P * 2 - NOM - GAP * 7) / 7;
  const hayEv = dias.some((d) => d.ev);
  const DIAS_H = hayEv ? 32 : 22;
  const H = P + CAB_H + gs.reduce((a, g) => a + 22 + DIAS_H + g.filas.length * (FILA + GAP) + 12, 0) + PIE_H + P;
  const { cv, ctx } = lienzo(H);
  cabeceraImg(ctx, titulo, sub);
  let y = P + CAB_H;
  gs.forEach((g) => {
    ctx.textAlign = 'left'; ctx.fillStyle = IMG.acc; ctx.font = "700 12px Sora, sans-serif";
    const tt = g.turno.nombre.toUpperCase(); ctx.fillText(tt, P, y + 13);
    if (g.turno.entrada) {
      const w = ctx.measureText(tt).width;
      ctx.fillStyle = IMG.gris; ctx.font = "500 11px Archivo, sans-serif"; ctx.fillText(`  entra ${g.turno.entrada}`, P + w, y + 13);
    }
    y += 22;
    // encabezado de días
    for (let j = 0; j < 7; j++) {
      const x = P + NOM + GAP + j * (colW + GAP); const d = dias[j];
      ctx.textAlign = 'center'; ctx.fillStyle = d.ev ? IMG.esp : IMG.gris; ctx.font = "700 11px Sora, sans-serif";
      ctx.fillText(`${d.dc} ${d.nro}${d.ev ? ' ★' : ''}`, x + colW / 2, y + 13);
      if (d.ev) { ctx.font = "600 8.5px Archivo, sans-serif"; ctx.fillText(recortar(ctx, d.ev, colW - 4), x + colW / 2, y + 25); }
    }
    y += DIAS_H;
    g.filas.forEach((f, fi) => {
      if (fi % 2 === 1) { ctx.fillStyle = '#FAFBFD'; ctx.fillRect(P, y - 1, W - P * 2, FILA + 2); }
      ctx.textAlign = 'left'; ctx.fillStyle = IMG.ink; ctx.font = "600 12.5px Archivo, sans-serif";
      ctx.fillText(recortar(ctx, titular(f.nombre), NOM - 8), P + 2, y + FILA / 2 + 4.5);
      for (let j = 0; j < 7; j++) {
        const x = P + NOM + GAP + j * (colW + GAP); const c = f.celdas[j];
        ctx.fillStyle = c ? IMG.celda : IMG.libre; rrect(ctx, x, y, colW, FILA, 6); ctx.fill();
        ctx.textAlign = 'center';
        if (!c) { ctx.fillStyle = '#A9B6C6'; ctx.font = "500 10px Archivo, sans-serif"; ctx.fillText('franco', x + colW / 2, y + FILA / 2 + 3.5); continue; }
        const linea1 = c.puesto || '✓';
        if (c.hora) {
          ctx.fillStyle = IMG.ink; ctx.font = "700 11px Sora, sans-serif"; ctx.fillText(recortar(ctx, linea1, colW - 6), x + colW / 2, y + 12.5);
          ctx.fillStyle = c.colorHora || IMG.acc; ctx.font = "700 10px Archivo, sans-serif"; ctx.fillText(recortar(ctx, c.hora, colW - 6), x + colW / 2, y + 25);
        } else {
          ctx.fillStyle = IMG.ink; ctx.font = "700 12px Sora, sans-serif"; ctx.fillText(recortar(ctx, linea1, colW - 6), x + colW / 2, y + FILA / 2 + 4.5);
        }
      }
      y += FILA + GAP;
    });
    y += 12;
  });
  pieImg(ctx, H, logo);
  return cv;
}
// items: [{ n, txt }]
function dibujarFrancos({ titulo, sub, items, logo }) {
  if (!items.length) return null;
  const { W, P } = IMG;
  const filas = Math.ceil(items.length / 2); const RF = 22;
  const H = P + CAB_H + 22 + filas * RF + 10 + PIE_H + P;
  const { cv, ctx } = lienzo(H);
  cabeceraImg(ctx, titulo, sub);
  let y = P + CAB_H;
  ctx.fillStyle = IMG.acc; ctx.font = "700 12px Sora, sans-serif"; ctx.textAlign = 'left';
  ctx.fillText('FRANCOS DE LA SEMANA', P, y + 13);
  y += 22;
  const colF = (W - P * 2) / 2;
  items.forEach((f, i) => {
    const cx = P + (i % 2) * colF; const cy = y + Math.floor(i / 2) * RF + 14;
    ctx.textAlign = 'left'; ctx.font = "600 12.5px Archivo, sans-serif";
    const nom = recortar(ctx, titular(f.n), colF * 0.55); const wN = ctx.measureText(nom).width;
    ctx.fillStyle = IMG.ink; ctx.fillText(nom, cx, cy);
    ctx.font = "400 12.5px Archivo, sans-serif"; ctx.fillStyle = IMG.gris;
    ctx.fillText(recortar(ctx, '  ' + f.txt, colF - wN - 14), cx + wN, cy);
  });
  pieImg(ctx, H, logo);
  return cv;
}
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* ───────── modal: exportar imagen ───────── */
function ModalExportar({ espacio, negocio, semanaId, rango, diasISO, fechasMap, filas, empleadosMap, totales, onCerrar, avisar }) {
  const [tildados, setTildados] = useState(() => Object.fromEntries((espacio.turnos || []).map((t) => [t.id, true])));
  const [urlCrono, setUrlCrono] = useState(null);
  const [urlFrancos, setUrlFrancos] = useState(null);
    const incluidos = (espacio.turnos || []).filter((t) => tildados[t.id]);

  useEffect(() => {
    let vivo = true;
    const dias = diasISO.map((iso, j) => {
      const f = fechasMap.get(iso);
      return { nro: new Date(iso + 'T12:00:00').getDate(), dc: DC[j], ev: f ? (f.nombre || etiquetaTipo(f.tipo)) : '' };
    });
    // mismos colores que la grilla: se calculan sobre toda la semana, no solo los turnos tildados
    const colHoras = coloresHorarios(filas, espacio.turnos);
    const grupos = incluidos.map((t) => ({
      turno: t,
      // una fila por empleado (regla: una fila = un empleado); las filas vacías no salen
      filas: filas.filter((f) => f.turnoId === t.id).map((f) => {
        const celdas = {}; let emp = null;
        Object.entries(f.celdas).forEach(([dia, c]) => {
          if (c?.empleadoId) { emp = emp || c.empleadoId; const h = horarioDe(c, t); celdas[dia] = { puesto: c.puesto, hora: h, colorHora: h ? colHoras.get(h) : null }; }
        });
        const dueno = f.ownerEmpleadoId || emp;
        return dueno ? { nombre: nombreFila(empleadosMap.get(dueno)), celdas } : null;
      }).filter(Boolean),
    }));
    const items = [...totales.entries()]
      .filter(([, t]) => t.semCnt > 0 && t.francos.length <= 3)
      .map(([id, t]) => ({ n: nombreFila(empleadosMap.get(id)), txt: t.francos.length ? t.francos.join(', ') : '—' }))
      .sort((a, b) => a.n.localeCompare(b.n));
    const sub = (negocio ? negocio + ' · ' : '') + rango;
    cargarLogo().then((logo) => {
      if (!vivo) return;
      try {
        const cv = dibujarCronograma({ titulo: 'Cronograma ' + espacio.nombre, sub, dias, grupos, logo });
        setUrlCrono(cv ? cv.toDataURL('image/png') : null);
      } catch (e) { setUrlCrono(null); avisar('No se pudo generar la imagen.', 'error'); }
      try {
        const cf = dibujarFrancos({ titulo: 'Francos ' + espacio.nombre, sub, items, logo });
        setUrlFrancos(cf ? cf.toDataURL('image/png') : null);
      } catch (e) { setUrlFrancos(null); }
    });
    return () => { vivo = false; };
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
    <div data-rrhh-modal onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <div data-rrhh-modal onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <div data-rrhh-modal onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

/* ───────── modal: editar turno (clic en el nombre del turno) ───────── */
/* Campo de hora 24 h que se escribe de corrido (Diego 12/11/2026: el input nativo dejaba
   los minutos en "--" y había que completarlos). "11" → 11:00 · "930" → 09:30 · "1130" → 11:30
   · "11:3" → 11:30. Mientras se escribe ya informa la hora válida; al salir queda prolija. */
function normHora(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!m) return null;
  let h; let mi;
  if (!t.includes(':') && t.length >= 3) { h = Number(t.slice(0, t.length - 2)); mi = t.slice(-2); }
  else { h = Number(m[1]); mi = m[2] || ''; }
  mi = mi.length === 0 ? '00' : mi.length === 1 ? mi + '0' : mi;
  if (h > 23 || Number(mi) > 59) return null;
  return String(h).padStart(2, '0') + ':' + mi;
}
function CampoHora({ value, onChange, style, title, placeholder = '--:--' }) {
  const [raw, setRaw] = useState(value || '');
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setRaw(value || ''); }, [value, foco]);
  const invalida = raw && normHora(raw) === null;
  return (
    <input
      type="text" inputMode="numeric" maxLength={5} value={raw} placeholder={placeholder} title={title}
      onFocus={(e) => { setFoco(true); e.target.select(); }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d:]/g, '');
        setRaw(v);
        const n = normHora(v);
        if (n !== null) onChange(n);
      }}
      onBlur={() => { setFoco(false); const n = normHora(raw); setRaw(n === null ? (value || '') : n); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      style={{ ...style, ...(invalida ? { borderColor: T.bad } : {}) }}
    />
  );
}

function ModalTurno({ turno, espacioNombre, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(turno.nombre || '');
  const [entrada, setEntrada] = useState(turno.entrada || '');
  const [guardando, setGuardando] = useState(false);
  const input = { width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head };
  const rotulo = { fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 };
  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try { await onGuardar({ nombre: nombre.trim(), entrada: entrada || null }); } finally { setGuardando(false); }
  };
  return (
    <Marco onCerrar={onCerrar} ancho={360}>
      <TituloModal onCerrar={onCerrar} sub={`${espacioNombre} · vale para todas las semanas.`}>Editar turno</TituloModal>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...rotulo, marginTop: 0 }}>Nombre</div>
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Día, Noche, Mediodía" style={input} />
        </div>
        <div style={{ width: 120 }}>
          <div style={{ ...rotulo, marginTop: 0 }}>Entra</div>
          <CampoHora value={entrada} onChange={setEntrada} style={{ ...input, textAlign: 'center' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton activo deshabilitado={guardando || !nombre.trim()} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
    </Marco>
  );
}

/* ───────── modal: asignar empleado a una celda ───────── */
function ModalAsignar({ ctx, empleados, puestos, espacio, onCrear, onNoAplica, onBaja, onPuestos, onGuardar, onCerrar }) {
  // Una fila = un empleado: si la fila ya tiene días de alguien, la celda es suya (no se elige otro).
  const bloqueado = !ctx.modoFila && !!ctx.duenoConDias;
  const empBloqueado = bloqueado ? empleados.find((e) => e.id === ctx.duenoConDias) : null;
  // Puestos gestionables desde acá (alta y baja)
  const [editPuestos, setEditPuestos] = useState(false);
  const [nuevoCod, setNuevoCod] = useState('');
  const [nuevoNom, setNuevoNom] = useState('');
  const [errPuesto, setErrPuesto] = useState('');
  const agregarPuesto = async () => {
    const codigo = nuevoCod.trim(); const nombre = nuevoNom.trim();
    if (!codigo || !nombre) { setErrPuesto('Poné código y nombre'); return; }
    if (puestos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())) { setErrPuesto(`Ya existe el código ${codigo}`); return; }
    const ok = await onPuestos([...puestos.map(({ codigo: c, nombre: n }) => ({ codigo: c, nombre: n })), { codigo, nombre }]);
    if (ok) { setNuevoCod(''); setNuevoNom(''); setErrPuesto(''); setTag(codigo); }
  };
  const quitarPuesto = async (codigo) => {
    await onPuestos(puestos.filter((p) => p.codigo !== codigo).map(({ codigo: c, nombre: n }) => ({ codigo: c, nombre: n })));
    if (tag === codigo) setTag('');
  };
  const [bajaDe, setBajaDe] = useState(null);     // empleado al que se le da de baja desde la lista
  const [fechaBaja, setFechaBaja] = useState('');
  const [q, setQ] = useState('');
  const [hoverId, setHoverId] = useState(null);
  const [creando, setCreando] = useState(false);
  const buscadorRef = React.useRef(null);
  const crear = async () => {
    if (!q.trim()) { buscadorRef.current?.focus(); return; }
    if (creando || !onCrear) return;
    setCreando(true);
    const emp = await onCrear(q.trim());
    setCreando(false);
    // queda elegido y filtrado por su nombre, así se ve seleccionado
    if (emp) { setEmpId(emp.id); setQ(nombreDe(emp)); }
  };
  // si ya hay alguien con ese nombre exacto no se ofrece crear (evita duplicados)
  const yaExiste = !!q.trim() && empleados.some((e) => nombreDe(e).toLowerCase() === q.trim().toLowerCase());
  const [empId, setEmpId] = useState(ctx.celda?.empleadoId || ctx.ownerEmpleadoId || null);
  // modo fila: si los días tienen puestos/horas distintos arranca en "como están" (no se pisan)
  const [tag, setTag] = useState(ctx.puestoMixto ? '__mixto' : (ctx.celda?.puesto || ctx.puestoFila || ''));
  const [horas, setHoras] = useState(ctx.horasMixtas ? '' : (ctx.celda?.horas != null ? ctx.celda.horas : JORNADA_HS));
  // hora de entrada propia: vacía = la del turno. En modo fila con horas distintas,
  // si no se toca cada día conserva la suya.
  const [entrada, setEntrada] = useState(ctx.entradaMixta ? '' : (ctx.celda ? (ctx.celda.entrada || '') : (ctx.entradaFila || '')));
  const [entradaTocada, setEntradaTocada] = useState(false);
  // salida opcional: si se carga, las horas se calculan solas (se pueden corregir)
  const [salida, setSalida] = useState(ctx.salidaMixta ? '' : (ctx.celda ? (ctx.celda.salida || '') : (ctx.salidaFila || '')));
  const [salidaTocada, setSalidaTocada] = useState(false);
  const recalcularHoras = (ent, sal) => {
    const h = horasEntre(ent || ctx.turnoEntrada, sal);
    if (h) setHoras(h);
  };

  const lista = useMemo(() => {
    const txt = q.trim().toLowerCase();
    // "No aplica a cronogramas" no se ofrece (salvo que ya esté en esta celda/fila)
    const actual = ctx.celda?.empleadoId || ctx.ownerEmpleadoId || null;
    const activos = empleados.filter((e) => e.activo !== false && (!e.noAplica || e.id === actual));
    const filtra = (e) => !txt || nombreDe(e).toLowerCase().includes(txt) || String(e.codigoMaxi || '').includes(txt);
    // primero los habituales del espacio (aprendidos de los cronogramas)
    const propios = activos.filter((e) => esHabitual(e, espacio) && filtra(e));
    const resto = activos.filter((e) => !esHabitual(e, espacio) && filtra(e));
    return { propios, resto };
  }, [q, empleados, espacio]);

  const Fila = ({ e }) => (
    <div key={e.id} onClick={() => setEmpId(e.id)}
      onMouseEnter={() => setHoverId(e.id)} onMouseLeave={() => setHoverId((h) => (h === e.id ? null : h))} style={{
      padding: '7px 10px', cursor: 'pointer', fontFamily: FB, fontSize: 13, display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
      background: empId === e.id ? T.accent : 'transparent',
      color: empId === e.id ? T.ink : T.text, borderBottom: `1px solid ${T.border}`,
    }}>
      <span><span style={{ display: 'inline-block', minWidth: 34, fontSize: 11.5, color: empId === e.id ? T.ink : T.text3, fontVariantNumeric: 'tabular-nums' }}>{e.codigoMaxi || '—'}</span>{nombreDe(e)}</span>
      {hoverId === e.id && empId !== e.id && onNoAplica ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <span onClick={(ev) => { ev.stopPropagation(); onNoAplica(e); }} title="No aparece más para asignar (se deshace desde Nómina o en el aviso)"
            style={{ fontSize: 11, fontWeight: 700, color: T.text3, border: `1px dashed ${T.text3}88`, borderRadius: 6, padding: '0 6px', lineHeight: '16px', whiteSpace: 'nowrap' }}>⊘ No aplica</span>
          {onBaja && (
            <span onClick={(ev) => { ev.stopPropagation(); setBajaDe(e); setFechaBaja(''); }} title="Dar de baja (fecha opcional)"
              style={{ fontSize: 11, fontWeight: 700, color: T.bad, border: `1px solid ${T.bad}55`, borderRadius: 6, padding: '0 6px', lineHeight: '16px', whiteSpace: 'nowrap' }}>Baja</span>
          )}
        </span>
      ) : (
        <span style={{ fontSize: 11, color: empId === e.id ? T.ink : T.text3 }}>{(e.espacios || []).map((x) => x.nombre).join(' · ') || e.sector || ''}</span>
      )}
    </div>
  );

  return (
    <div data-rrhh-modal onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>
          {ctx.modoFila ? `Toda la fila · ${ctx.turnoNombre}` : `${DIAS[ctx.dia]} ${ctx.nroDia} · ${ctx.turnoNombre}`}
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '2px 0 12px' }}>
          {ctx.modoFila
            ? (ctx.diasCargados
              ? `Lo que elijas se aplica a los ${ctx.diasCargados} ${ctx.diasCargados === 1 ? 'día cargado' : 'días cargados'} de la fila: empleado, puesto, hora de entrada u horas.`
              : 'La fila no tiene días cargados: queda reservada para el empleado que elijas.')
            : 'Una fila por empleado por turno — el mismo empleado puede estar en otro turno.'}
        </div>

        {bloqueado ? (
          <div style={{ border: `1px solid ${T.border}`, background: T.head, borderRadius: 10, padding: '8px 12px' }}>
            <div style={{ fontFamily: FB, fontSize: 13.5, fontWeight: 700, color: T.text }}>{nombreDe(empBloqueado)}</div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 1 }}>La fila es suya: para cambiar de empleado, tocá el nombre de la fila.</div>
          </div>
        ) : (<>
        <input
          ref={buscadorRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la nómina…"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }}
        />
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 8, overflow: 'hidden' }}>
        {/* acción primero, fija entre el buscador y la lista (patrón de SelectorBuscable) */}
        {onCrear && !yaExiste && (
          <div onClick={crear} title={q.trim() ? 'Alta en la nómina con este nombre' : 'Escribí el nombre en el buscador'}
            style={{ padding: '7px 10px', fontFamily: FB, fontSize: 13, fontWeight: 700, color: T.accentTxt, background: 'rgba(0,0,0,0.04)', borderBottom: `1px solid ${T.border2}`, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {creando ? 'Creando…' : q.trim() ? `+ Crear "${q.trim()}" en la nómina` : '+ Crear empleado'}
          </div>
        )}
        <div style={{ maxHeight: 190, overflowY: 'auto' }}>
          {lista.propios.length > 0 && lista.resto.length > 0 && (
            <div style={{ padding: '4px 10px', fontFamily: FB, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.text3, background: T.head }}>Habituales de {espacio?.nombre}</div>
          )}
          {lista.propios.map((e) => <Fila key={e.id} e={e} />)}
          {lista.propios.length > 0 && lista.resto.length > 0 && (
            <div style={{ padding: '4px 10px', fontFamily: FB, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.text3, background: T.head }}>Otros</div>
          )}
          {lista.resto.map((e) => <Fila key={e.id} e={e} />)}
          {lista.propios.length === 0 && lista.resto.length === 0 && (
            <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: T.text3 }}>Sin resultados en la nómina.</div>
          )}
        </div>
        </div>
        {lista.propios.length === 0 && lista.resto.length > 0 && !q.trim() && (
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 6 }}>
            Cuando armes cronogramas, los habituales de {espacio?.nombre} van a aparecer primero.
          </div>
        )}
        {bajaDe && (
          <div style={{ marginTop: 8, border: `1px solid ${T.bad}55`, background: T.bad + '0D', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text, fontWeight: 700, marginBottom: 6 }}>Dar de baja a {nombreDe(bajaDe)}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} autoFocus
                style={{ height: 40, boxSizing: 'border-box', flex: 1, fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.band }} />
              <Boton onClick={() => setBajaDe(null)}>Cancelar</Boton>
              <Boton peligro onClick={async () => { const ok = await onBaja(bajaDe, fechaBaja); if (ok) { if (empId === bajaDe.id) setEmpId(null); setBajaDe(null); } }}>Dar de baja</Boton>
            </div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 5 }}>Si dejás la fecha vacía, queda hoy.</div>
          </div>
        )}

        </>)}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '12px 0 6px' }}>
          <span style={{ fontFamily: FB, fontSize: 12, color: T.text2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Puesto (opcional)</span>
          {onPuestos && (
            <span onClick={() => { setEditPuestos((v) => !v); setErrPuesto(''); }} style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: T.accentTxt, cursor: 'pointer' }}>
              {editPuestos ? 'Listo' : '✎ Puestos'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ctx.puestoMixto && !editPuestos && <Chip color={T.text3} activoBg={tag === '__mixto'} onClick={() => setTag('__mixto')} title="Cada día conserva su puesto">Como están</Chip>}
          {!editPuestos && <Chip color={!tag ? T.accentTxt : T.text3} activoBg={!tag} onClick={() => setTag('')}>Sin puesto</Chip>}
          {puestos.map((p) => (editPuestos ? (
            <Chip key={p.codigo} color={T.text3} title="Quitar (si está en uso en algún cronograma no se borra)">
              {p.codigo} · {p.nombre}
              <span onClick={() => quitarPuesto(p.codigo)} style={{ cursor: 'pointer', color: T.bad, fontWeight: 800, marginLeft: 2 }}>×</span>
            </Chip>
          ) : (
            <Chip key={p.codigo} color={T.text3} activoBg={tag === p.codigo} onClick={() => setTag(p.codigo)} title={p.nombre}>{p.codigo} · {p.nombre}</Chip>
          )))}
        </div>
        {editPuestos && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={nuevoCod} onChange={(e) => setNuevoCod(e.target.value.slice(0, 4))} placeholder="Cód." maxLength={4}
                style={{ width: 64, height: 40, boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '0 8px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head, textAlign: 'center' }} />
              <input value={nuevoNom} onChange={(e) => setNuevoNom(e.target.value)} placeholder="Nombre del puesto (ej. Vereda)"
                onKeyDown={(e) => { if (e.key === 'Enter') agregarPuesto(); }}
                style={{ flex: 1, height: 40, boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
              <button type="button" onClick={agregarPuesto} style={{ height: 40, boxSizing: 'border-box', padding: '0 14px', borderRadius: 10, border: `1px solid ${T.accent}`, background: T.accent, color: T.ink, fontFamily: FB, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Agregar</button>
            </div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: errPuesto ? T.bad : T.text3, marginTop: 5 }}>
              {errPuesto || 'El código es lo que se ve en la celda (1 a 4 letras). Los que están en uso no se pueden quitar.'}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 10, margin: '12px 0 0' }}>
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Entra</div>
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Sale <span style={{ textTransform: 'none', color: T.text3 }}>(opc.)</span></div>
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Horas</div>
          <CampoHora
            value={entrada} placeholder={ctx.turnoEntrada || '--:--'} title={ctx.turnoEntrada ? `Vacía = la del turno (${ctx.turnoEntrada})` : 'Vacía = la del turno'}
            onChange={(v) => { setEntrada(v); setEntradaTocada(true); if (salida && v) recalcularHoras(v, salida); }}
            style={{ height: 40, boxSizing: 'border-box', width: '100%', fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${entrada ? T.violet + '88' : T.border2}`, outline: 'none', color: entrada ? T.text : T.text3, background: T.head, textAlign: 'center' }}
          />
          <CampoHora
            value={salida} title="Opcional: si la cargás, la celda muestra entrada–salida"
            onChange={(v) => { setSalida(v); setSalidaTocada(true); if (v) recalcularHoras(entrada, v); }}
            style={{ height: 40, boxSizing: 'border-box', width: '100%', fontFamily: FB, fontSize: 13, padding: '0 8px', borderRadius: 10, border: `1px solid ${salida ? T.violet + '88' : T.border2}`, outline: 'none', color: salida ? T.text : T.text3, background: T.head, textAlign: 'center' }}
          />
          <input
            type="number" min="1" max="16" step="0.5" value={horas} placeholder={ctx.horasMixtas ? 'como están' : ''}
            onChange={(e) => setHoras(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ height: 40, boxSizing: 'border-box', width: '100%', fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head, textAlign: 'center' }}
          />
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 5, textAlign: 'center' }}>
            {entrada
              ? <span onClick={() => { setEntrada(''); setEntradaTocada(true); }} style={{ color: T.accentTxt, fontWeight: 700, cursor: 'pointer' }}>{ctx.turnoEntrada ? `Volver a ${ctx.turnoEntrada}` : 'Usar la del turno'}</span>
              : ctx.entradaMixta && !entradaTocada ? 'Como están' : `Con el turno${ctx.turnoEntrada ? ` · ${ctx.turnoEntrada}` : ''}`}
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 5, textAlign: 'center' }}>
            {salida
              ? <span onClick={() => { setSalida(''); setSalidaTocada(true); }} style={{ color: T.accentTxt, fontWeight: 700, cursor: 'pointer' }}>Quitar salida</span>
              : ctx.salidaMixta && !salidaTocada ? 'Como están' : 'Sin informar'}
          </div>
          <div />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          {ctx.modoFila ? (
            ctx.diasCargados ? <Boton peligro onClick={() => onGuardar(null)}>Vaciar la fila</Boton> : <span />
          ) : ctx.celda?.empleadoId ? (
            <Boton peligro onClick={() => onGuardar(null)}>Sacar de la celda</Boton>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton onClick={onCerrar}>Cancelar</Boton>
            {(() => {
              const id = bloqueado ? ctx.duenoConDias : empId;
              const valor = (alcance) => ({
                empleadoId: id, alcance,
                puesto: tag === '__mixto' ? undefined : (tag || null),          // undefined = cada día conserva el suyo
                horas: horas === '' ? undefined : (horas > 0 ? horas : JORNADA_HS),
                // undefined = cada día conserva la suya (fila con horas distintas, sin tocar)
                entrada: ctx.entradaMixta && !entradaTocada ? undefined : (entrada && entrada !== ctx.turnoEntrada ? entrada : null),
                salida: ctx.salidaMixta && !salidaTocada ? undefined : (salida || null),
              });
              if (ctx.modoFila) return <Boton activo deshabilitado={!id} onClick={() => id && onGuardar(valor('dia'))}>Aplicar a la fila</Boton>;
              // fila vacía: ¿solo este día o toda la semana? (después se sacan los francos)
              if (!ctx.celda && !ctx.duenoConDias) {
                return (<>
                  <Boton deshabilitado={!id} onClick={() => id && onGuardar(valor('dia'))}>Solo este día</Boton>
                  <Boton activo deshabilitado={!id} onClick={() => id && onGuardar(valor('semana'))} title="Carga los 7 días: después sacá los francos con click derecho">Toda la semana</Boton>
                </>);
              }
              // editando un día de una fila con más días: ¿solo este o todos?
              if (ctx.otrosDias > 0) {
                return (<>
                  <Boton deshabilitado={!id} onClick={() => id && onGuardar(valor('dia'))}>Solo este día</Boton>
                  <Boton activo deshabilitado={!id} onClick={() => id && onGuardar(valor('fila'))}>Aplicar a los {ctx.otrosDias + 1} días</Boton>
                </>);
              }
              return <Boton activo deshabilitado={!id} onClick={() => id && onGuardar(valor('dia'))}>Guardar</Boton>;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  ModalExportar,
  ModalFecha,
  ModalNuevaSemana,
  ModalVaciar,
  ModalCalendario,
  ModalTurno,
  ModalAsignar,
};
