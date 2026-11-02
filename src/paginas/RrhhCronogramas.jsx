/* eslint-disable no-unused-vars */
// src/paginas/RrhhCronogramas.jsx
// RRHH › Cronogramas — Etapa 1, tanda 2 (front básico contra la API).
// Diseño calcado del mockup v31 en modo día (marca Lazarillo); el header es el
// de la app (Navbar) — acá solo va la toolbar del módulo.
// Quedan para las tandas 3/4: drag & drop, copiar/vaciar semana, ⚙ Configuración
// (espacios/turnos/referencias/fechas), banda de demanda y export a imagen.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RrhhAPI } from '../servicios/apiRrhh';

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
const FB = "'Archivo', sans-serif";
const JORNADA_HS = 8;

/* ───────── fechas y semanas (AAASS, ancla del Excel: 202641 = 4/10/2026) ───────── */
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DC = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
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
const colorCat = (tipo) => (tipo === 'Cerrado' ? T.bad : tipo === 'Evento' ? T.violet : T.warn);

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

const Boton = ({ children, onClick, activo, grande, peligro, deshabilitado, title }) => (
  <button onClick={deshabilitado ? undefined : onClick} title={title} style={{
    fontFamily: FB, fontWeight: 700, fontSize: grande ? 14 : 12.5,
    padding: grande ? '9px 18px' : '6px 12px', borderRadius: 10, cursor: deshabilitado ? 'default' : 'pointer',
    border: `1px solid ${peligro ? T.bad + '88' : activo ? T.accent : T.border2}`,
    background: activo ? T.accent : 'transparent',
    color: deshabilitado ? T.text3 : peligro ? T.bad : activo ? T.ink : T.text2,
    opacity: deshabilitado ? 0.55 : 1,
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
    const sectorEsp = (espacio?.sectorNomina || '').toUpperCase();
    const esDelSector = (e) => sectorEsp && e.sector && String(e.sector).toUpperCase() === sectorEsp;
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
      <span>{nombreDe(e)}</span>
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

/* ───────── modal: importar nómina de MaxiRest (con selección) ───────── */
function ModalImportar({ onCerrar, onImportado }) {
  const [estado, setEstado] = useState('cargando'); // cargando | lista | importando | error
  const [msg, setMsg] = useState('');
  const [nomina, setNomina] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    RrhhAPI.nominaMaxirest()
      .then((r) => { if (!alive) return; setNomina(r.nomina || []); setEstado('lista'); })
      .catch((e) => {
        if (!alive) return;
        setMsg(e?.data?.message || e.message || 'No se pudo leer la nómina.');
        setEstado('error');
      });
    return () => { alive = false; };
  }, []);

  const visibles = useMemo(() => {
    const txt = q.trim().toLowerCase();
    if (!txt) return nomina;
    return nomina.filter((r) =>
      `${r.nombre || ''} ${r.apellido || ''}`.toLowerCase().includes(txt) || String(r.codigo).includes(txt));
  }, [nomina, q]);

  const pendientes = nomina.filter((r) => !r.yaImportado);
  const toggle = (codigo) => setSel((s) => { const n = new Set(s); n.has(codigo) ? n.delete(codigo) : n.add(codigo); return n; });
  const todos = () => setSel(new Set(pendientes.map((r) => r.codigo)));
  const ninguno = () => setSel(new Set());

  const importar = async () => {
    if (!sel.size) return;
    setEstado('importando');
    try {
      const r = await RrhhAPI.importarNomina([...sel]);
      onImportado?.(r);
    } catch (e) {
      setMsg(e?.data?.message || e.message || 'No se pudo importar.');
      setEstado('error');
    }
  };

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>Importar nómina de MaxiRest</div>
        <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text2, margin: '4px 0 10px' }}>
          La nómina del POS mezcla empleados reales con usuarios técnicos (apps de delivery, cajas, soporte).
          Tildá solo a las personas: los importados quedan como empleados del módulo.
        </div>

        {estado === 'cargando' && <div style={{ fontFamily: FB, fontSize: 13, color: T.text3, padding: 20 }}>Leyendo la nómina…</div>}
        {estado === 'error' && (
          <div style={{ fontFamily: FB, fontSize: 13, color: T.bad, padding: '10px 0' }}>{msg}</div>
        )}

        {(estado === 'lista' || estado === 'importando') && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código…"
                style={{ flex: 1, fontFamily: FB, fontSize: 13, padding: '7px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
              <Chip color={T.accentTxt} onClick={todos}>Tildar todos</Chip>
              <Chip color={T.text3} onClick={ninguno}>Ninguno</Chip>
            </div>
            <div style={{ flex: 1, minHeight: 120, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10 }}>
              {visibles.map((r) => {
                const tildado = sel.has(r.codigo);
                return (
                  <label key={r.codigo} style={{
                    display: 'grid', gridTemplateColumns: '26px 52px 1fr 90px', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderBottom: `1px solid ${T.border}`, fontFamily: FB, fontSize: 13,
                    color: r.yaImportado ? T.text3 : T.text, cursor: r.yaImportado ? 'default' : 'pointer',
                    background: tildado ? T.accent + '22' : 'transparent',
                  }}>
                    {r.yaImportado
                      ? <span style={{ color: T.ok, fontWeight: 700 }}>✓</span>
                      : <input type="checkbox" checked={tildado} onChange={() => toggle(r.codigo)} style={{ accentColor: T.accent }} />}
                    <span style={{ color: T.text3, fontSize: 12 }}>{r.codigo}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {`${r.nombre || ''}${r.apellido ? ` ${r.apellido}` : ''}`.trim() || `#${r.codigo}`}
                    </span>
                    <span style={{ fontSize: 11.5, color: T.text3, textAlign: 'right' }}>
                      {r.yaImportado ? 'Importado' : (r.sector || '')}
                    </span>
                  </label>
                );
              })}
              {!visibles.length && <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: T.text3 }}>Sin resultados.</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>
                {nomina.length} en la réplica · {nomina.length - pendientes.length} ya importados
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Boton onClick={onCerrar}>Cerrar</Boton>
                <Boton grande activo deshabilitado={!sel.size || estado === 'importando'} onClick={importar}>
                  {estado === 'importando' ? 'Importando…' : `Importar ${sel.size || ''}`.trim()}
                </Boton>
              </div>
            </div>
          </>
        )}
        {estado === 'error' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <Boton onClick={onCerrar}>Cerrar</Boton>
          </div>
        )}
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
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);
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
      const [cfg, sems] = await Promise.all([RrhhAPI.getConfig(), RrhhAPI.listarSemanas()]);
      setConfig(cfg.config);
      setSemanasIdx(sems.semanas || []);
      setEspacioId((prev) => prev || cfg.config.espacios[0]?.id || null);
    } catch (e) {
      setErrorCarga(e?.data?.message || e.message || 'No se pudo cargar el módulo.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargarTodo(); }, [cargarTodo]);

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
    (config?.fechas || []).forEach((f) => m.set(f.fecha, f));
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
    RrhhAPI.getSemana(semanaId, espacio.id)
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
  const armarBody = useCallback((fs) => {
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
      fechaInicio,
      turnos: [...porTurno.entries()].map(([turnoId, fls]) => ({ turnoId, filas: fls })),
    };
  }, [espacio, fechaInicio]);

  const guardarAhora = useCallback(async () => {
    if (!espacio) return;
    setGuardado('guardando');
    try {
      const r = await RrhhAPI.putSemana(semanaId, armarBody(filasRef.current));
      setGuardado('ok');
      setSemanaExiste(true);
      setSemanasIdx((prev) => {
        if (prev.some((s) => s.semana === semanaId && s.espacioId === espacio.id)) return prev;
        return [...prev, { id: r?.semana?.id, espacioId: espacio.id, semana: semanaId, fechaInicio }];
      });
    } catch (e) {
      setGuardado('error');
      if (e?.data?.error === 'empleado_repetido_en_turno') {
        avisar('Ese empleado ya tiene una fila en ese turno: el guardado se rechazó y se recargó la semana.', 'error');
      } else {
        avisar(e?.data?.message || e.message || 'No se pudo guardar la semana.', 'error');
      }
    }
  }, [espacio, semanaId, armarBody, avisar, fechaInicio]);

  const programarGuardado = useCallback(() => {
    setGuardado('pendiente');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(guardarAhora, 1200);
  }, [guardarAhora]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const mutarFilas = useCallback((fn) => {
    setFilas((prev) => { const next = fn(prev); filasRef.current = next; return next; });
    programarGuardado();
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
      const owner = f.ownerEmpleadoId || (valor ? valor.empleadoId : null);
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
      return { ...f, celdas };
    }));
  };

  const agregarFila = (turnoId) =>
    mutarFilas((fs) => [...fs, { key: nuevaKey(), turnoId, ownerEmpleadoId: null, celdas: {} }]);

  const quitarFila = (fila) => {
    if (Object.keys(fila.celdas).length) { avisar('La fila tiene turnos cargados: vaciala antes de quitarla.', 'error'); return; }
    mutarFilas((fs) => fs.filter((f) => f.key !== fila.key));
  };

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

  /* ── estilos compartidos de la tabla ── */
  const thDia = { padding: '7px 4px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: T.text2, borderBottom: `1px solid ${T.border2}`, borderLeft: `1px solid ${T.border}`, background: T.head, textAlign: 'center' };
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
      {/* toolbar del módulo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text }}>Cronogramas</div>

        {/* tabs de espacios */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(config?.espacios || []).map((e) => (
            <Chip key={e.id} color={T.text3} activoBg={e.id === espacioId} onClick={() => setEspacioId(e.id)}>{e.nombre}</Chip>
          ))}
        </div>

        {/* navegador semanal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <Boton onClick={() => setSemanaId((s) => s - 1)} title="Semana anterior">‹</Boton>
          <div style={{ textAlign: 'center', minWidth: 230 }}>
            <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text }}>Semana {String(semanaId).slice(4)}</div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3 }}>{rangoLargo(fechaInicio)}</div>
          </div>
          <Boton onClick={() => setSemanaId((s) => s + 1)} title="Semana siguiente">›</Boton>
          <Boton onClick={() => setSemanaId(idDeSemana(domingoDeHoy()))} title="Ir a la semana de hoy">HOY</Boton>
        </div>

        <div style={{ flex: 1 }} />

        {/* estado de guardado */}
        <span style={{ fontFamily: FB, fontSize: 12, fontWeight: 600, color: guardado === 'error' ? T.bad : guardado === 'ok' ? T.ok : T.text3 }}>
          {guardado === 'guardando' || guardado === 'pendiente' ? 'Guardando…' : guardado === 'error' ? 'Sin guardar ⚠' : semanaExiste ? 'Guardado ✓' : ''}
        </span>
        <Boton onClick={() => setImportOpen(true)} title="Importar empleados desde la nómina de MaxiRest">👥 Nómina</Boton>
      </div>

      {/* arranque sin nómina */}
      {sinNomina ? (
        <div style={{ maxWidth: 520, margin: '60px auto', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 28, textAlign: 'center' }}>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginBottom: 8 }}>Arranquemos con los cronogramas</div>
          <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, marginBottom: 18 }}>
            Primero importá tu nómina desde MaxiRest: elegís a quiénes traer y quedan como empleados del módulo.
          </div>
          <Boton grande activo onClick={() => setImportOpen(true)}>👥 Importar nómina de MaxiRest</Boton>
        </div>
      ) : (
        <>
          {!semanaExiste && !cargandoSemana && (
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '18', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 10 }}>
              Esta semana todavía no tiene cronograma en {espacio?.nombre}: se guarda sola al cargar el primer empleado.
            </div>
          )}

          <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'auto', maxHeight: 'calc(100vh - 185px)' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 980 }}>
              <thead>
                <tr>
                  {diasISO.map((iso, i) => {
                    const esp = fechasMap.get(iso);
                    const d = new Date(iso + 'T12:00:00');
                    return (
                      <th key={iso} style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, borderLeft: i === 0 ? 'none' : thDia.borderLeft, background: esp ? colorCat(esp.tipo) + '22' : T.head }}>
                        <div>{DC[i]} {d.getDate()}</div>
                        <div style={{ height: 14, fontFamily: FB, fontWeight: 700, fontSize: 10, color: esp ? colorCat(esp.tipo) : 'transparent', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110, margin: '0 auto' }} title={esp ? `${esp.tipo}${esp.nombre ? ` · ${esp.nombre}` : ''}` : ''}>
                          {esp ? (esp.nombre || esp.tipo) : '·'}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, borderLeft: `2px solid ${T.border2}`, minWidth: 46 }} title="Jornadas del empleado en la semana (este espacio)">Sem</th>
                  <th style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 46 }} title="Horas de la semana">Hs</th>
                  <th style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 120 }} title="Días sin turno esta semana">Francos</th>
                  <th style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 30 }} />
                </tr>
              </thead>
              <tbody>
                {(espacio?.turnos || []).map((t) => {
                  const slots = filas.filter((f) => f.turnoId === t.id);
                  return (
                    <React.Fragment key={t.id}>
                      <tr>
                        <td colSpan={11} style={{ padding: '6px 12px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: T.accentTxt, background: T.head, borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: 1, position: 'sticky', top: 42, zIndex: 2 }}>
                          {t.nombre}
                          {t.entrada && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3 }}> · entra {t.entrada}</span>}
                        </td>
                      </tr>
                      {slots.map((f) => {
                        const dueno = duenoDe(f);
                        const tot = dueno ? totales.get(dueno) : null;
                        const francos = tot?.francos || [];
                        return (
                          <tr key={f.key}>
                            {diasISO.map((iso, dia) => {
                              const c = f.celdas[dia];
                              const emp = c ? empleadosMap.get(c.empleadoId) : null;
                              return (
                                <td
                                  key={iso}
                                  onClick={() => abrirCelda(f, dia, t)}
                                  onContextMenu={(e) => { e.preventDefault(); sacarCelda(f, dia); }}
                                  title={c ? `${nombreDe(emp)} · click derecho: sacar` : 'Cargar empleado'}
                                  style={{
                                    padding: '4px 4px', borderBottom: `1px solid ${T.border}`, borderLeft: dia === 0 ? 'none' : `1px solid ${T.border}`,
                                    cursor: 'pointer', background: c ? T.card : 'transparent', minWidth: 96,
                                  }}
                                >
                                  <div style={{ height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    {c ? (
                                      <>
                                        <div style={{ fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: T.text, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreCorto(emp)}</div>
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
                      <tr>
                        <td colSpan={11} style={{ padding: '6px 12px', borderBottom: `1px solid ${T.border}` }}>
                          <span onClick={() => agregarFila(t.id)} style={{ fontFamily: FB, fontSize: 12, fontWeight: 600, color: T.accentTxt, cursor: 'pointer' }}>
                            + Agregar empleado en {t.nombre}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {cargandoSemana && <div style={{ padding: 14, fontFamily: FB, fontSize: 12.5, color: T.text3 }}>Cargando la semana…</div>}
          </div>

          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 8 }}>
            Click en una celda carga un empleado · click derecho lo saca · los cambios se guardan solos.
          </div>
        </>
      )}

      {/* modales y toast */}
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
      {importOpen && (
        <ModalImportar
          onCerrar={() => setImportOpen(false)}
          onImportado={async (r) => {
            setImportOpen(false);
            avisar(`Nómina importada: ${r.importados} nuevos${r.existentes ? ` · ${r.existentes} ya estaban` : ''}.`);
            await cargarTodo();
          }}
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
