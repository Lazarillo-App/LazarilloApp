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
// Tema y helpers en RrhhCronogramasComun.jsx; modales e imagen en RrhhCronogramasModales.jsx.

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { RrhhAPI, negocioActual } from '../servicios/apiRrhh';
import { useBusiness } from '../context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';
import ListaNegociosNomina from '../componentes/RrhhNominaCompartida';
import SpotlightTour from '../componentes/SpotlightTour';
import { useRecorrido } from '../hooks/useRecorrido';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  T,
  FT,
  TH_TXT,
  FB,
  JORNADA_HS,
  DIAS,
  DC,
  MESES_C,
  MESES_L,
  isoDe,
  sumarDias,
  idDeSemana,
  startDeId,
  domingoDeHoy,
  rangoLargo,
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
  nombreFila,
  duenoTras,
  nuevaKey,
  duenoEnTurno,
  duenoDe,
  esHabitual,
  GrillaEjemplo,
  horarioDe,
  coloresHorarios,
} from './RrhhCronogramasComun';
import {
  ModalExportar,
  EditorPuestos,
  ModalFecha,
  ModalNuevaSemana,
  ModalVaciar,
  ModalCalendario,
  ModalTurno,
  ModalAsignar,
} from './RrhhCronogramasModales';

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
  const { active: negocioActivo, activeBusinessId } = useBusiness() || {};
  const [sinReplica, setSinReplica] = useState(false);   // el negocio no tiene MaxiRest conectado
  const [ejemploVisto, setEjemploVisto] = useState(false); // ya tocó "Armar la semana" sobre el ejemplo
  // Pantalla completa (como el Panel de Gestión): el módulo tapa el header de la app; Esc sale.
  const [maximizado, setMaximizado] = useState(false);
  // Celular (Diego 12/11/2026): siempre en pantalla completa y con el celu acostado; parado,
  // se pide girarlo. La vista compacta saca lo que no entra (totales, leyenda, nombre repetido).
  const medirCel = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return { cel: false, vertical: false };
    const tactil = window.matchMedia('(pointer: coarse)').matches;
    const cel = tactil && Math.min(window.innerWidth, window.innerHeight) < 600;
    return { cel, vertical: cel && window.innerHeight > window.innerWidth };
  };
  const [{ cel, vertical }, setModoCel] = useState(medirCel);
  useEffect(() => {
    const f = () => setModoCel(medirCel());
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); };
  }, []);
  const [menuCel, setMenuCel] = useState(false);
  const [puestosCel, setPuestosCel] = useState(false);
  useEffect(() => {
    if (!maximizado) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('[data-rrhh-modal]')) setMaximizado(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximizado]);
  const [eligiendoNomina, setEligiendoNomina] = useState(false);
  const [turnoSel, setTurnoSel] = useState(null);         // turno en edición
  const [destelloHoy, setDestelloHoy] = useState(false);  // al apretar HOY la columna se ilumina un momento
  const hoyIso = isoDe(new Date());
  const cargaSeq = useRef(0);                            // descarta respuestas de una carga vieja
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

  // accion opcional: { label, fn } → botón en el aviso (ej. Deshacer); dura un poco más
  const avisar = useCallback((msj, tipo = 'ok', accion = null) => {
    setToast({ msj, tipo, accion });
    setTimeout(() => setToast((t) => (t && t.msj === msj ? null : t)), accion ? 6000 : 3200);
  }, []);

  /* ── carga inicial: config (siembra defaults) + índice de semanas ── */
  const cargarTodo = useCallback(async () => {
    const mi = ++cargaSeq.current;
    setCargando(true); setErrorCarga('');
    try {
      await flushRef.current?.(); // lo pendiente (de otra sucursal u otro negocio) se guarda antes, en SU negocio
      const [cfg, sems] = await Promise.all([RrhhAPI.getConfig(sucursalId), RrhhAPI.listarSemanas()]);
      if (mi !== cargaSeq.current) return; // mientras tanto se cambió de negocio/sucursal
      setSinReplica(cfg.sync === null);
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
      if (mi === cargaSeq.current) setCargando(false);
    }
    // activeBusinessId: al cambiar de negocio en el header se recarga todo
  }, [avisar, sucursalId, activeBusinessId]);
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
              (f.celdas || []).forEach((c) => { celdas[c.dia] = { empleadoId: c.empleadoId, puesto: c.puesto || null, horas: Number(c.horas) || JORNADA_HS, entrada: c.entrada || null, salida: c.salida || null }; });
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
          .map(([dia, c]) => ({ dia: Number(dia), empleadoId: c.empleadoId, puesto: c.puesto || null, horas: c.horas != null ? c.horas : JORNADA_HS, entrada: c.entrada || null, salida: c.salida || null })),
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
    pendienteRef.current = { semanaId, body: armarBody(filasSnapshot), bizId: negocioActual() };
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

  /* ── mover un empleado (fila) de lugar: arrastrando la manija ⋮⋮ (Diego 12/11/2026) ──
     Pointer events (mouse y touch). Mientras se arrastra, la grilla se reordena EN VIVO: la fila
     levantada ocupa el lugar exacto donde va a quedar (borde celeste + sombra) y las demás se
     corren con animación. Puede pasar a otro turno del mismo espacio (si esa persona no tiene
     ya una fila ahí). Lo que se ve al soltar es lo que se guarda. Esc cancela. */
  const [arrastreFila, setArrastreFila] = useState(null); // { key, turnoOrig, turno, pos, mids, heads }
  const arrastreFilaRef = useRef(null);
  arrastreFilaRef.current = arrastreFila;
  const nodosFila = useRef(new Map());   // key de fila → <tr>
  const nodosTurno = useRef(new Map());  // turnoId → <tr> del encabezado
  const topsAntes = useRef(new Map());   // para la animación (FLIP)
  // filas reordenadas: saca la fila y la pone en el turno destino, en la posición pos
  const moverFila = (fs, key, turnoId, pos) => {
    const f = fs.find((x) => x.key === key);
    if (!f) return fs;
    const resto = fs.filter((x) => x.key !== key);
    const delTurno = resto.filter((x) => x.turnoId === turnoId);
    const movida = { ...f, turnoId };
    if (pos < delTurno.length) {
      const i = resto.indexOf(delTurno[pos]);
      return [...resto.slice(0, i), movida, ...resto.slice(i)];
    }
    const ult = delTurno.length ? resto.indexOf(delTurno[delTurno.length - 1]) + 1 : resto.length;
    return [...resto.slice(0, ult), movida, ...resto.slice(ult)];
  };
  const filasVista = arrastreFila ? moverFila(filas, arrastreFila.key, arrastreFila.turno, arrastreFila.pos) : filas;
  const medirFilas = () => {
    const m = new Map();
    nodosFila.current.forEach((el, k) => { if (el) m.set(k, el.getBoundingClientRect().top); });
    return m;
  };
  useLayoutEffect(() => {
    const antes = topsAntes.current;
    if (!antes.size) return;
    nodosFila.current.forEach((el, k) => {
      if (!el || !antes.has(k) || k === arrastreFila?.key) return;
      const dy = antes.get(k) - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.translate = `0 ${dy}px`;
      requestAnimationFrame(() => { el.style.transition = 'translate .15s ease'; el.style.translate = '0 0'; });
    });
    topsAntes.current = new Map();
  }, [arrastreFila?.pos, arrastreFila?.turno]); // eslint-disable-line react-hooks/exhaustive-deps
  const agarrarFila = (e, fila) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    // posiciones al agarrar: centro de cada fila visible y arriba de cada encabezado de turno
    const mids = [];
    filas.forEach((f) => {
      const b = nodosFila.current.get(f.key)?.getBoundingClientRect();
      if (b) mids.push({ key: f.key, turnoId: f.turnoId, mid: b.top + b.height / 2 });
    });
    const heads = (espacio?.turnos || [])
      .filter((t) => !minimizados[`${espacioId}:${t.id}`])
      .map((t) => ({ turnoId: t.id, top: nodosTurno.current.get(t.id)?.getBoundingClientRect().top ?? Infinity }))
      .sort((a, b) => a.top - b.top);
    const pos = filas.filter((f) => f.turnoId === fila.turnoId).findIndex((f) => f.key === fila.key);
    setArrastreFila({ key: fila.key, turnoOrig: fila.turnoId, turno: fila.turnoId, pos, mids, heads });
  };
  useEffect(() => {
    if (!arrastreFila) return undefined;
    const alMover = (e) => {
      const a = arrastreFilaRef.current;
      if (!a) return;
      const y = e.clientY;
      // turno destino: el último encabezado que quedó arriba del puntero
      let turno = a.heads.length ? a.heads[0].turnoId : a.turnoOrig;
      a.heads.forEach((h) => { if (h.top <= y) turno = h.turnoId; });
      // una fila = un empleado por turno: si ya tiene fila en ese turno, se queda en el suyo
      const fila = filasRef.current.find((f) => f.key === a.key);
      const dueno = fila ? duenoDe(fila) : null;
      if (turno !== a.turnoOrig && dueno && duenoEnTurno(filasRef.current, turno, dueno, a.key)) turno = a.turnoOrig;
      const pos = a.mids.reduce((n, m) => (m.key !== a.key && m.turnoId === turno && m.mid < y ? n + 1 : n), 0);
      if (pos !== a.pos || turno !== a.turno) { topsAntes.current = medirFilas(); setArrastreFila({ ...a, turno, pos }); }
    };
    const alSoltar = () => {
      const a = arrastreFilaRef.current;
      setArrastreFila(null);
      if (!a) return;
      const posOrig = filasRef.current.filter((f) => f.turnoId === a.turnoOrig).findIndex((f) => f.key === a.key);
      if (a.turno === a.turnoOrig && a.pos === posOrig) return;
      mutarFilas((fs) => moverFila(fs, a.key, a.turno, a.pos));
      if (a.turno !== a.turnoOrig) {
        const tn = (espacio?.turnos || []).find((t) => t.id === a.turno);
        avisar(`Pasó al turno ${tn?.nombre || ''} ✓`);
      }
    };
    const alTecla = (e) => { if (e.key === 'Escape') setArrastreFila(null); };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', alSoltar);
    window.addEventListener('keydown', alTecla);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alSoltar);
      window.removeEventListener('keydown', alTecla);
    };
  }, [!!arrastreFila]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── acciones de grilla ── */
  const abrirCelda = (fila, dia, turno) => {
    const celda = fila.celdas[dia] || null;
    // autocompletar: fila con dueño que ya tiene turnos cargados → repetir patrón sin modal
    if (!celda && fila.ownerEmpleadoId) {
      const patron = Object.values(fila.celdas).find((c) => c && c.empleadoId === fila.ownerEmpleadoId);
      if (patron) {
        mutarFilas((fs) => fs.map((f) => f.key === fila.key
          ? { ...f, celdas: { ...f.celdas, [dia]: { empleadoId: patron.empleadoId, puesto: patron.puesto, horas: patron.horas, entrada: patron.entrada || null, salida: patron.salida || null } } }
          : f));
        return;
      }
    }
    const patronFila = Object.values(fila.celdas).find((c) => c && c.puesto);
    setCeldaSel({
      filaKey: fila.key, dia, turnoId: turno.id, turnoNombre: turno.nombre, turnoEntrada: turno.entrada || '',
      entradaFila: patronFila?.entrada || Object.values(fila.celdas).find((c) => c?.entrada)?.entrada || '',
      salidaFila: Object.values(fila.celdas).find((c) => c?.salida)?.salida || '',
      nroDia: new Date(diasISO[dia] + 'T12:00:00').getDate(),
      celda, ownerEmpleadoId: fila.ownerEmpleadoId, puestoFila: patronFila?.puesto || '',
      // regla: una fila = un empleado. Si la fila ya tiene días de alguien, la celda es de esa persona.
      duenoConDias: Object.values(fila.celdas).some((c) => c?.empleadoId) ? duenoDe(fila) : null,
      otrosDias: Object.entries(fila.celdas).filter(([d, c]) => Number(d) !== dia && c?.empleadoId).length,
    });
  };

  // Clic en el nombre de la fila: lo elegido se aplica a todos sus días cargados.
  const abrirFila = (fila, turno) => {
    const cs = Object.values(fila.celdas).filter((c) => c?.empleadoId);
    const puestos = new Set(cs.map((c) => c.puesto || ''));
    const horas = new Set(cs.map((c) => Number(c.horas) || JORNADA_HS));
    const entradas = new Set(cs.map((c) => c.entrada || ''));
    const salidas = new Set(cs.map((c) => c.salida || ''));
    setCeldaSel({
      modoFila: true, filaKey: fila.key, turnoId: turno.id, turnoNombre: turno.nombre, turnoEntrada: turno.entrada || '',
      entradaMixta: entradas.size > 1, salidaMixta: salidas.size > 1,
      diasCargados: cs.length, ownerEmpleadoId: duenoDe(fila),
      celda: { empleadoId: duenoDe(fila), puesto: puestos.size === 1 ? [...puestos][0] || null : null, horas: horas.size === 1 ? [...horas][0] : JORNADA_HS, entrada: entradas.size === 1 ? [...entradas][0] || null : null, salida: salidas.size === 1 ? [...salidas][0] || null : null },
      puestoMixto: puestos.size > 1, horasMixtas: horas.size > 1,
    });
  };
  const guardarFila = (valor) => {
    const { filaKey, turnoId } = celdaSel;
    if (valor && duenoEnTurno(filasRef.current, turnoId, valor.empleadoId, filaKey)) {
      avisar(`${nombreCorto(empleadosMap.get(valor.empleadoId))} ya tiene una fila en este turno.`, 'error');
      return;
    }
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== filaKey) return f;
      if (!valor) return { ...f, celdas: {}, ownerEmpleadoId: null };
      const celdas = {};
      Object.entries(f.celdas).forEach(([dia, c]) => {
        if (!c?.empleadoId) return;
        celdas[dia] = {
          empleadoId: valor.empleadoId,
          puesto: valor.puesto === undefined ? (c.puesto || null) : valor.puesto,
          horas: valor.horas === undefined ? c.horas : valor.horas,
          entrada: valor.entrada === undefined ? (c.entrada || null) : valor.entrada,
          salida: valor.salida === undefined ? (c.salida || null) : valor.salida,
        };
      });
      return { ...f, celdas, ownerEmpleadoId: valor.empleadoId };
    }));
    setCeldaSel(null);
    avisar(valor ? 'Fila actualizada ✓' : 'Fila vaciada.');
  };

  const guardarCelda = (valor) => {
    if (celdaSel?.modoFila) { guardarFila(valor); return; }
    const { filaKey, dia, turnoId, duenoConDias } = celdaSel;
    if (valor && duenoConDias && valor.empleadoId !== duenoConDias) {
      avisar(`La fila es de ${nombreCorto(empleadosMap.get(duenoConDias))}: para cambiar de empleado tocá el nombre de la fila.`, 'error');
      return;
    }
    if (valor && duenoEnTurno(filasRef.current, turnoId, valor.empleadoId, filaKey)) {
      const emp = empleadosMap.get(valor.empleadoId);
      avisar(`${nombreCorto(emp)} ya tiene una fila en este turno: cargale los días ahí.`, 'error');
      return;
    }
    // alcance: 'dia' (solo esta celda) · 'semana' (los 7 días; después se sacan los francos)
    //          · 'fila' (lo editado se aplica a todos los días cargados de la fila)
    const alcance = valor?.alcance || 'dia';
    const nueva = valor ? { empleadoId: valor.empleadoId, puesto: valor.puesto ?? null, horas: valor.horas ?? JORNADA_HS, entrada: valor.entrada ?? null, salida: valor.salida ?? null } : null;
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== filaKey) return f;
      let celdas = { ...f.celdas };
      if (!nueva) delete celdas[dia];
      else if (alcance === 'semana') { for (let d = 0; d < 7; d++) if (!celdas[d]) celdas[d] = { ...nueva }; celdas[dia] = { ...nueva }; }
      else if (alcance === 'fila') {
        celdas[dia] = { ...nueva };
        Object.keys(celdas).forEach((d) => {
          const c = celdas[d];
          if (!c?.empleadoId) return;
          celdas[d] = { ...c,
            puesto: valor.puesto === undefined ? c.puesto : nueva.puesto,
            horas: valor.horas === undefined ? c.horas : nueva.horas,
            entrada: valor.entrada === undefined ? c.entrada : nueva.entrada,
            salida: valor.salida === undefined ? c.salida : nueva.salida };
        });
      } else celdas[dia] = { ...nueva };
      const owner = nueva ? (f.ownerEmpleadoId && duenoConDias ? f.ownerEmpleadoId : nueva.empleadoId) : duenoTras(celdas, f.ownerEmpleadoId);
      return { ...f, celdas, ownerEmpleadoId: owner };
    }));
    setCeldaSel(null);
    if (alcance === 'semana') avisar('Cargado los 7 días: sacá los francos con click derecho.');
    if (alcance === 'fila' && celdaSel.otrosDias) avisar(`Aplicado a los ${celdaSel.otrosDias + 1} días de la fila ✓`);
  };

  /* ── acciones de Nómina desde la lista de asignar ── */
  // Alta rápida con lo que se escribió en el buscador: 1ª palabra nombre, el resto apellido.
  const crearEmpleadoRapido = async (texto) => {
    const [nombre, ...ap] = String(texto || '').trim().split(/\s+/);
    if (!nombre) return null;
    try {
      const r = await RrhhAPI.crearEmpleado({ nombre, apellido: ap.join(' ') || undefined });
      const emp = { ...r.empleado, espacios: [], noAplica: false, sugerirBaja: false };
      setConfig((c) => ({ ...c, empleados: [...c.empleados, emp] }));
      avisar(`${nombreDe(emp)} dado de alta en la nómina ✓`);
      return emp;
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo dar de alta.', 'error');
      return null;
    }
  };
  // "No aplica a cronogramas" (usuarios del POS, contador…): sale de la lista al instante.
  const marcarNoAplica = async (emp, valor = true) => {
    const poner = (v) => setConfig((c) => ({ ...c, empleados: c.empleados.map((e) => (e.id === emp.id ? { ...e, noAplica: v } : e)) }));
    poner(valor);
    try {
      await RrhhAPI.editarEmpleado(emp.id, { noAplica: valor });
      if (valor) avisar(`${nombreDe(emp)} no va en cronogramas`, 'ok', { label: 'Deshacer', fn: () => marcarNoAplica(emp, false) });
      else avisar(`${nombreDe(emp)} vuelve a cronogramas ✓`);
    } catch (e) {
      poner(!valor);
      avisar(e?.data?.message || e.message || 'No se pudo guardar.', 'error');
    }
  };

  // Dar de baja desde la lista de asignar: fecha opcional (vacía = hoy en el servidor).
  const bajaRapida = async (emp, fecha) => {
    try {
      const r = await RrhhAPI.editarEmpleado(emp.id, { activo: false, ...(fecha ? { fechaBaja: fecha } : {}) });
      setConfig((c) => ({ ...c, empleados: c.empleados.map((e) => (e.id === emp.id ? { ...e, ...r.empleado, sugerirBaja: false } : e)) }));
      avisar(`${nombreDe(emp)} dado de baja`, 'ok', {
        label: 'Deshacer',
        fn: async () => {
          try {
            const r2 = await RrhhAPI.editarEmpleado(emp.id, { activo: true });
            setConfig((c) => ({ ...c, empleados: c.empleados.map((e) => (e.id === emp.id ? { ...e, ...r2.empleado } : e)) }));
            avisar(`${nombreDe(emp)} reactivado ✓`);
          } catch (e) { avisar(e?.data?.message || e.message || 'No se pudo reactivar.', 'error'); }
        },
      });
      return true;
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo dar de baja.', 'error');
      return false;
    }
  };

  const sacarCelda = (fila, dia) => {
    if (!fila.celdas[dia]) return;
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== fila.key) return f;
      const celdas = { ...f.celdas };
      delete celdas[dia];
      // sin días cargados la fila queda libre; si el dueño ya no tiene días, pasa a quien quede
      // (antes el empleado sacado seguía «pegado» y no se lo podía poner en otra fila)
      return { ...f, celdas, ownerEmpleadoId: duenoTras(celdas, f.ownerEmpleadoId) };
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

  /* ── editar turno (nombre / hora de entrada) ── */
  const guardarTurno = async ({ nombre, entrada }) => {
    const { turnoId } = turnoSel;
    const espacios = (config?.espacios || []).map((e) => ({
      id: e.id, nombre: e.nombre, sectorNomina: e.sectorNomina,
      turnos: (e.turnos || []).map((t) => (t.id === turnoId ? { id: t.id, nombre, entrada } : { id: t.id, nombre: t.nombre, entrada: t.entrada })),
    }));
    try {
      const r = await RrhhAPI.putConfig({ espacios }, sucursalId);
      if (r?.config) setConfig(r.config);
      setTurnoSel(null);
      avisar(r?.avisos?.length ? r.avisos.join(' ') : `Turno ${nombre} guardado ✓`, r?.avisos?.length ? 'error' : 'ok');
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo guardar el turno.', 'error');
    }
  };

  /* ── fechas especiales (PUT /config manda la colección completa) ── */
  // Referencias de puestos desde el modal de asignar (alta y baja; lo que está en uso no se borra)
  const guardarPuestos = async (puestos, renombres = []) => {
    try {
      // si cambia un código, primero se guarda lo pendiente de la semana: después se recarga con el código nuevo
      if (renombres.length) await Promise.resolve(flushRef.current());
      const r = await RrhhAPI.putConfig({ puestos, ...(renombres.length ? { renombres } : {}) }, sucursalId);
      if (r?.config) setConfig(r.config);
      if (r?.avisos?.length) avisar(r.avisos.join(' '), 'error');
      return true;
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudieron guardar los puestos.', 'error');
      return false;
    }
  };
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

  // Habituales del espacio (aprendidos de los cronogramas) sin turno esta semana.
  // Sin historia no hay habituales: no se deduce nada (estado sin datos).
  const sinJornadas = useMemo(() => {
    if (!espacio) return [];
    return (config?.empleados || [])
      .filter((e) => e.activo !== false && esHabitual(e, espacio) && !totales.has(e.id))
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  }, [config, espacio, totales]);
  const sinHistoria = !(config?.historia?.semanas > 0);
  // un color por horario distinto de la semana (mismo mapa que la imagen de WhatsApp)
  const colHoras = useMemo(() => coloresHorarios(filas, espacio?.turnos), [filas, espacio]);
  // puestos con su nombre (sin abreviaturas, Diego 13/11/2026); si no está en la lista, el código guardado
  const nomPuesto = useMemo(() => new Map((config?.puestos || []).map((p) => [p.codigo, p.nombre || p.codigo])), [config]);

  /* ── estilos compartidos de la tabla ── */
  // El tema de la app pinta todo «thead th» con el color del negocio (!important): los textos del
  // encabezado van en el color de contraste del tema, si no los días no se leían (Diego 07/11/2026).
  const thDia = { padding: '7px 4px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: TH_TXT, borderBottom: `1px solid ${T.border2}`, borderLeft: `1px solid ${T.border}`, background: T.head, textAlign: 'center' };
  const colFila = cel
    ? { width: 118, minWidth: 118, maxWidth: 118, boxSizing: 'border-box' }
    : { width: 152, minWidth: 152, maxWidth: 152, boxSizing: 'border-box' }; // +20 por la manija ⋮⋮
  // nombres largos: hasta 2 renglones y recién ahí "…"
  const dosRenglones = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '15px', maxHeight: 30, wordBreak: 'break-word' };
  const thSup = { position: 'sticky', top: 0, zIndex: 3, height: 26, boxSizing: 'border-box', padding: '4px 6px', fontSize: 11 };
  const thSub = { position: 'sticky', top: 26, zIndex: 3, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontFamily: FB, fontSize: 10.5, color: TH_TXT, opacity: 0.85, minWidth: 34 };
  const celTot = { padding: '4px 6px', textAlign: 'center', borderBottom: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}`, fontFamily: FB, fontSize: 12, color: T.text2, background: T.head };

  // «8 al 14 nov» (barra del celular)
  const rangoCorto = (start) => {
    const a = new Date(start + 'T12:00:00'); const b = new Date(sumarDias(start, 6) + 'T12:00:00');
    const m = (d) => MESES_C[d.getMonth()].toLowerCase();
    return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} al ${b.getDate()} ${m(b)}`;
  };

  /* ── Recorrido de Anthony la primera vez (10/11): solo con nómina (si no, la grilla no está). ── */
  const refsTour = { semana: useRef(null), grilla: useRef(null), copiar: useRef(null), exportar: useRef(null) };
  const pasosTour = [
    { k: 'semana', t: <>Elegí la <b>semana</b> que querés armar o mirar.</> },
    { k: 'grilla', t: <>Cada fila es una persona de tu nómina y cada columna un día: ahí cargás sus <b>turnos</b> y <b>francos</b>. Tocando el encabezado de un día marcás un <b>feriado</b> o un evento.</> },
    { k: 'copiar', t: <><b>+ Semana</b> crea la semana siguiente copiando esta, así no la armás de cero.</> },
    { k: 'exportar', t: <>Genera una <b>imagen</b> del cronograma y de los francos para mandar por WhatsApp al equipo.</> },
  ];
  const recCrono = useRecorrido('rrhh_cronogramas', pasosTour.length,
    !cargando && !errorCarga && !!(config?.empleados || []).length && !exportOpen && !vaciarOpen && !calOpen && !nuevaSem && !celdaSel && !fechaSel && !turnoSel);
  const pasoTour = pasosTour[recCrono.paso - 1];

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
  // Vista previa de EJEMPLO: el negocio nunca cargó un turno y esta semana no existe.
  const verEjemplo = !sinNomina && sinHistoria && !semanaExiste && !cargandoSemana && !ejemploVisto;
  const listos = (config?.empleados || []).filter((e) => e.activo !== false && !e.noAplica).length;

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: cel ? '6px 8px 6px' : '14px 18px 40px', boxSizing: 'border-box',
      // maximizado: ocupa toda la ventana; los modales y avisos son hijos, así que quedan encima
      ...(maximizado || cel ? { position: 'fixed', inset: 0, zIndex: 1250, overflow: 'auto', minHeight: 0 } : {}) }}>
      {/* celular parado: la grilla de 7 días no entra → pedir que lo giren */}
      {vertical && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 54, lineHeight: 1, transform: 'rotate(-90deg)' }}>📱</div>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text }}>Girá el celu</div>
          <div style={{ fontFamily: FB, fontSize: 14, color: T.text2, maxWidth: 280 }}>El cronograma muestra los 7 días: acostado se ve entero.</div>
          <Boton onClick={() => navigate(-1)}>Volver</Boton>
        </div>
      )}
      {recCrono.visible && pasoTour && (
        <SpotlightTour key={pasoTour.k} targetRef={refsTour[pasoTour.k]} pose={recCrono.paso === 1 ? 'presenta' : 'senala'} placement="bottom"
          text={pasoTour.t} {...recCrono.props(recCrono.paso)} />
      )}
      {/* barra del celular: una sola fila; lo que se usa poco va en ⋯ */}
      {cel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, position: 'relative' }}>
          <Boton onClick={() => navigate(-1)} title="Salir">✕</Boton>
          {(config?.espacios || []).map((e) => (
            <Boton key={e.id} activo={e.id === espacioId} onClick={() => setEspacioId(e.id)}>{e.nombre}</Boton>
          ))}
          <div style={{ flex: 1 }} />
          <Boton onClick={() => setSemanaId((s) => s - 1)} title="Semana anterior">‹</Boton>
          <div onClick={() => setCalOpen(true)} style={{ textAlign: 'center', cursor: 'pointer', minWidth: 112 }}>
            <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 13, color: T.text, whiteSpace: 'nowrap' }}>Semana {String(semanaId).slice(4)}</div>
            <div style={{ fontFamily: FB, fontSize: 10.5, color: T.text3, whiteSpace: 'nowrap' }}>{rangoCorto(fechaInicio)}</div>
          </div>
          <Boton onClick={() => setSemanaId((s) => s + 1)} title="Semana siguiente">›</Boton>
          <Boton onClick={() => { setSemanaId(idDeSemana(domingoDeHoy())); setDestelloHoy(true); setTimeout(() => setDestelloHoy(false), 1600); }}>HOY</Boton>
          <div style={{ flex: 1 }} />
          <span title={guardado === 'error' ? 'Sin guardar' : 'Guardado'} style={{ width: 8, height: 8, borderRadius: 4, background: guardado === 'error' ? T.bad : guardado === 'ok' ? T.ok : T.text3 }} />
          <Boton activo deshabilitado={sinNomina || !espacio} onClick={() => setExportOpen(true)} title="Imagen para WhatsApp">🖼</Boton>
          <Boton onClick={() => setMenuCel((v) => !v)} title="Más">⋯</Boton>
          {menuCel && (
            <div onClick={() => setMenuCel(false)} style={{ position: 'absolute', right: 0, top: 40, zIndex: 20, background: T.band, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.sombra, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 170 }}>
              <Boton deshabilitado={sinNomina} onClick={() => setPuestosCel(true)}>✎ Puestos</Boton>
              <Boton deshabilitado={sinNomina || !espacio} onClick={abrirNuevaSemana}>+ Semana</Boton>
              <Boton peligro deshabilitado={sinNomina || !espacio || !semanaExiste} onClick={() => setVaciarOpen(true)}>Vaciar</Boton>
            </div>
          )}
        </div>
      )}
      {cel && puestosCel && (
        <div data-rrhh-modal onClick={() => setPuestosCel(false)} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 16, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>Puestos</div>
              <span onClick={() => setPuestosCel(false)} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
            </div>
            <EditorPuestos puestos={config?.puestos || []} onGuardar={guardarPuestos} />
          </div>
        </div>
      )}
      {/* barra del módulo — fila 1: espacios + acciones · fila 2: semana */}
      {!cel && (<>
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
        <Boton onClick={() => setMaximizado((v) => !v)} title={maximizado ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}>
          <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'top', height: 14.5 }}>
            {maximizado ? <CloseFullscreenIcon sx={{ fontSize: 14 }} /> : <OpenInFullIcon sx={{ fontSize: 14 }} />}
          </span>
        </Boton>
        <span ref={refsTour.exportar} style={{ display: 'inline-flex' }}><Boton activo deshabilitado={sinNomina || !espacio} onClick={() => setExportOpen(true)} title="Imagen del cronograma y de los francos para WhatsApp">🖼 Exportar imagen</Boton></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span ref={refsTour.semana} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Boton onClick={() => setSemanaId((s) => s - 1)} title="Semana anterior">‹</Boton>
        <div onClick={() => setCalOpen(true)} title="Abrir calendario" style={{ textAlign: 'center', minWidth: 250, cursor: 'pointer' }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: 'nowrap' }}>
            Semana {String(semanaId).slice(4)} <span style={{ fontSize: 12 }}>📅</span>
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, whiteSpace: 'nowrap' }}>{rangoLargo(fechaInicio)}</div>
        </div>
        <Boton onClick={() => setSemanaId((s) => s + 1)} title="Semana siguiente">›</Boton>
        <Boton onClick={() => { setSemanaId(idDeSemana(domingoDeHoy())); setDestelloHoy(true); setTimeout(() => setDestelloHoy(false), 1600); }} title="Ir a la semana de hoy">HOY</Boton>
        </span>
        <div style={{ width: 1, alignSelf: 'stretch', background: T.border2, margin: '0 4px' }} />
        <span ref={refsTour.copiar} style={{ display: 'inline-flex' }}><Boton deshabilitado={sinNomina || !espacio} onClick={abrirNuevaSemana} title="Crear la semana siguiente copiando esta">+ Semana</Boton></span>
        <Boton peligro deshabilitado={sinNomina || !espacio || !semanaExiste} onClick={() => setVaciarOpen(true)} title="Vaciar esta semana">Vaciar</Boton>
      </div>
      </>)}

      {/* arranque sin nómina */}
      {sinNomina ? (
        <GrillaEjemplo>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginBottom: 8 }}>Arranquemos con los cronogramas</div>
          <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, marginBottom: 18 }}>
            {sinReplica
              ? 'Este negocio no está integrado con tu PDV, así que la nómina no entra sola: usá la de otro negocio de tu cartera o cargala a mano.'
              : 'Todavía no hay empleados. La nómina de MaxiRest entra sola; si falta alguien, dalo de alta en Nómina.'}
          </div>
          {!eligiendoNomina ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Boton grande activo onClick={() => setEligiendoNomina(true)}>Usar la nómina de otro negocio</Boton>
              <Boton grande onClick={() => navigate('/rrhh/nomina')}>Cargarla a mano</Boton>
            </div>
          ) : (
            <ListaNegociosNomina
              onCancelar={() => setEligiendoNomina(false)}
              onVinculado={(o) => { setEligiendoNomina(false); avisar(`Ahora usás la nómina de ${o?.nombre || 'ese negocio'} ✓`); cargarTodo(); }}
            />
          )}
        </GrillaEjemplo>
      ) : verEjemplo ? (
        <div ref={refsTour.grilla}>
          <GrillaEjemplo>
            <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 19, color: T.text, marginBottom: 6 }}>Así se va a ver tu semana</div>
            <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, marginBottom: 6 }}>
              Tenés <b>{listos} {listos === 1 ? 'empleado listo' : 'empleados listos'}</b> en la nómina para armar {espacio?.nombre || 'el espacio'}.
            </div>
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text3, marginBottom: 16 }}>
              Cada fila es una persona por turno: tocás una celda, elegís quién y su puesto, y se guarda solo.
            </div>
            <Boton grande activo onClick={() => setEjemploVisto(true)}>Armar la semana {String(semanaId).slice(4)}</Boton>
          </GrillaEjemplo>
        </div>
      ) : (
        <>
          {!semanaExiste && !cargandoSemana && (
            <div style={{ fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '18', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 10 }}>
              Esta semana todavía no tiene cronograma en {espacio?.nombre}: se guarda sola al cargar el primer empleado.
            </div>
          )}

          <div ref={refsTour.grilla} style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'auto', maxHeight: cel ? 'calc(100vh - 50px)' : maximizado ? 'calc(100vh - 150px)' : 'calc(100vh - 225px)' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: cel ? 0 : 980, tableLayout: cel ? 'fixed' : 'auto' }}>
              <thead>
                <tr>
                  <th rowSpan={cel ? 1 : 2} style={{ ...thDia, ...colFila, ...(cel ? { padding: '4px 6px', fontSize: 9.5 } : {}), position: 'sticky', top: 0, left: 0, zIndex: 4, textAlign: 'left', fontFamily: FB, fontSize: 10.5, color: TH_TXT, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5, verticalAlign: 'bottom' }}>Fila / empleado</th>
                  {diasISO.map((iso, i) => {
                    const esp = fechasMap.get(iso);
                    const d = new Date(iso + 'T12:00:00');
                    return (
                      <th key={iso} rowSpan={cel ? 1 : 2} onClick={() => setFechaSel(iso)}
                        title={esp ? `${etiquetaTipo(esp.tipo)}${esp.nombre ? ` · ${esp.nombre}` : ''} — clic para editar` : 'Clic para cargar un feriado o evento'}
                        style={{ ...thDia, ...(cel ? { padding: '4px 2px', fontSize: 11.5 } : {}), position: 'sticky', top: 0, zIndex: 3, cursor: 'pointer', background: esp ? colorCat(esp.tipo) + '22' : T.head }}>
                        <div style={{ color: TH_TXT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          {DC[i]} {d.getDate()}
                          {iso === hoyIso && <span style={{ fontFamily: FB, fontSize: 9.5, fontWeight: 800, lineHeight: '15px', padding: '0 6px', borderRadius: 8, background: '#fff', color: T.accentTxt }}>HOY</span>}
                        </div>
                        {/* la fecha especial va en una pastilla blanca: se lee sobre cualquier color de negocio */}
                        {(!cel || esp) && <div style={{ height: 16, fontFamily: FB, fontWeight: 700, fontSize: 10, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110, margin: '2px auto 0',
                          ...(esp ? { display: 'inline-block', padding: '0 7px', borderRadius: 8, background: '#fff', color: colorCat(esp.tipo) } : { color: TH_TXT, opacity: 0.7 }) }}>
                          {esp ? (esp.nombre || etiquetaTipo(esp.tipo)) : '+ especial'}
                        </div>}
                      </th>
                    );
                  })}
                  {!cel && (<>
                  <th colSpan={2} style={{ ...thDia, ...thSup, borderLeft: `2px solid ${T.border2}` }}>Semana</th>
                  <th colSpan={2} style={{ ...thDia, ...thSup }} title={`Días dentro de ${MESES_L[mesRef.m]} (todas las semanas del mes en este espacio)`}>{MESES_C[mesRef.m]}</th>
                  <th rowSpan={2} style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 100 }} title="Días sin turno esta semana">Francos</th>
                  <th rowSpan={2} style={{ ...thDia, position: 'sticky', top: 0, zIndex: 3, minWidth: 26 }} />
                  </>)}
                </tr>
                {!cel && <tr>
                  {['Días', 'Hs', 'Días', 'Hs'].map((h, i) => (
                    <th key={i} style={{ ...thDia, ...thSub, borderLeft: i === 0 ? `2px solid ${T.border2}` : thDia.borderLeft }}>{h}</th>
                  ))}
                </tr>}
              </thead>
              <tbody>
                {(espacio?.turnos || []).map((t) => {
                  const slots = filasVista.filter((f) => f.turnoId === t.id);
                  const kMin = `${espacioId}:${t.id}`;
                  const minim = !!minimizados[kMin];
                  return (
                    <React.Fragment key={t.id}>
                      <tr ref={(el) => { if (el) nodosTurno.current.set(t.id, el); else nodosTurno.current.delete(t.id); }}>
                        <td colSpan={cel ? 8 : 14} onClick={() => setMinimizados((m) => ({ ...m, [kMin]: !m[kMin] }))} title={minim ? 'Mostrar el turno' : 'Minimizar el turno'}
                          style={{ padding: '6px 12px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: T.accentTxt, background: T.head, borderBottom: `1px solid ${T.border}`, borderTop: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: 1, position: 'sticky', top: cel ? 26 : 50, zIndex: 2, cursor: 'pointer', userSelect: 'none', ...(cel ? { padding: '3px 8px', fontSize: 11 } : {}) }}>
                          <span style={{ display: 'inline-block', width: 18 }}>{minim ? '▸' : '▾'}</span>
                          <span onClick={(e) => { e.stopPropagation(); setTurnoSel({ turnoId: t.id }); }} title="Editar el turno (nombre y hora de entrada)" style={{ cursor: 'pointer' }}>
                            {t.nombre}
                            {t.entrada && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3 }}> · entra {t.entrada}</span>}
                            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3, marginLeft: 6, fontSize: 11 }}>✎</span>
                          </span>
                          {minim && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.text3 }}> · {slots.length} {slots.length === 1 ? 'fila oculta' : 'filas ocultas'}</span>}
                        </td>
                      </tr>
                      {!minim && slots.map((f) => {
                        const dueno = duenoDe(f);
                        const tot = dueno ? totales.get(dueno) : null;
                        const francos = tot?.francos || [];
                        const totMes = dueno ? totalesMes.get(dueno) : null;
                        const levantada = arrastreFila?.key === f.key;
                        return (
                          <tr key={f.key}
                            ref={(el) => { if (el) nodosFila.current.set(f.key, el); else nodosFila.current.delete(f.key); }}
                            style={levantada ? { position: 'relative', zIndex: 4, outline: `2px solid ${T.accent}`, outlineOffset: -2, boxShadow: '0 8px 18px rgba(0,0,0,.18)', background: T.band } : undefined}>
                            <td onClick={() => abrirFila(f, t)}
                              style={{ ...colFila, position: 'sticky', left: 0, zIndex: 1, background: levantada ? T.band : T.head, borderBottom: `1px solid ${T.border}`, padding: '4px 10px 4px 2px', fontFamily: FB, fontSize: 12.5, fontWeight: dueno ? 700 : 400, color: dueno ? T.text : T.vacio, cursor: 'pointer' }}
                              title={`${dueno ? nombreDe(empleadosMap.get(dueno)) : 'Fila libre'} · clic: cambiar empleado, puesto, entrada u horas de toda la fila`}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span onPointerDown={(e) => agarrarFila(e, f)} onClick={(e) => e.stopPropagation()}
                                  title="Arrastrar para mover de lugar (también a otro turno)"
                                  style={{ width: 25, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: levantada ? 'grabbing' : 'grab', touchAction: 'none', color: levantada ? T.accentTxt : T.text3, userSelect: 'none' }}>
                                  <DragIndicatorIcon style={{ fontSize: 19 }} />
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={cel ? { ...dosRenglones, fontSize: 12, lineHeight: '14px', maxHeight: 28 } : dosRenglones}>{dueno ? (cel ? nombreCorto(empleadosMap.get(dueno)) : nombreFila(empleadosMap.get(dueno))) : 'Fila libre'}</div>
                                  {/* celular: los totales van debajo del nombre (no entran las columnas) */}
                                  {cel && tot && <div style={{ fontFamily: FB, fontWeight: 600, fontSize: 10, color: tot.semCnt >= 6 ? T.warn : T.text3, whiteSpace: 'nowrap' }}>{tot.semCnt}d · {tot.hs}h</div>}
                                </div>
                              </div>
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
                                    cursor: c ? 'grab' : 'pointer', minWidth: cel ? 0 : 78,
                                    background: iso === hoyIso ? (c ? T.accent + (destelloHoy ? '55' : '2E') : T.accent + (destelloHoy ? '40' : '14')) : (c ? T.card : 'transparent'),
                                    transition: 'background .4s',
                                    outline: dropSobre === `${f.key}:${dia}` ? `2px dashed ${T.accent}` : 'none', outlineOffset: -3,
                                  }}
                                >
                                  <div style={{ minHeight: cel ? 34 : 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    {c ? (
                                      <>
                                        {/* en el celu no se repite el nombre: la fila ya es de esa persona */}
                                        {!cel && <div style={{ ...dosRenglones, fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: T.text, maxWidth: 90, textAlign: 'center' }}>{nombreCorto(emp)}</div>}
                                        {cel && !c.puesto && !horarioDe(c, t) && <span style={{ color: T.accentTxt, fontWeight: 800, fontSize: 14 }}>✓</span>}
                                        <div style={{ minHeight: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3, alignItems: 'center' }}>
                                          {c.puesto && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.accentTxt, border: `1px solid ${T.accentTxt}55`, borderRadius: 6, padding: '0 4px', whiteSpace: 'nowrap' }}>{nomPuesto.get(c.puesto) || c.puesto}</span>}
                                          {(() => {
                                            const h = horarioDe(c, t);
                                            if (!h) return null;
                                            const col = colHoras.get(h) || T.violet;
                                            return <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: col, background: col + '14', border: `1px solid ${col}66`, borderRadius: 6, padding: '0 4px', whiteSpace: 'nowrap' }}
                                              title={c.salida ? `Entra ${c.entrada || t.entrada || '—'} · sale ${c.salida}` : `Entra ${c.entrada} (el turno entra ${t.entrada || '—'})`}>{h}</span>;
                                          })()}
                                          {c.horas !== JORNADA_HS && !c.salida && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '0 4px' }} title="Horas de la jornada">{c.horas}h</span>}
                                        </div>
                                      </>
                                    ) : (
                                      <span style={{ fontFamily: FB, fontSize: 14, color: T.vacio }}>+</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            {!cel && (<>
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
                            </>)}
                          </tr>
                        );
                      })}
                      {!minim && (
                        <tr>
                          <td colSpan={cel ? 8 : 14} style={{ padding: '6px 12px', borderBottom: `1px solid ${T.border}` }}>
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

          {sinJornadas.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginRight: 2 }}>Habituales de {espacio?.nombre} sin jornadas en la semana {String(semanaId).slice(4)}:</span>
              {sinJornadas.map((e) => <Chip key={e.id} color={T.text3}>{nombreDe(e)}</Chip>)}
            </div>
          ) : sinHistoria ? (
            <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 10 }}>
              Acá vas a ver a los habituales de {espacio?.nombre} que no tengan turno en la semana: se arma solo a medida que cargás cronogramas.
            </div>
          ) : null}
          {!cel && (<>
          <div style={{ marginTop: 8 }}>
            <EditorPuestos puestos={config?.puestos || []} onGuardar={guardarPuestos} />
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 8 }}>
            Click en una celda carga un empleado · arrastrala para moverla · click derecho la saca · click en el día carga un feriado o evento · click en el nombre de la fila cambia toda la fila · click en el turno lo edita (▾ lo minimiza) · los cambios se guardan solos.
          </div>
          </>)}
        </>
      )}

      {/* modales y toast */}
      {exportOpen && espacio && (
        <ModalExportar
          cel={cel}
          espacio={espacio}
          puestos={config?.puestos || []}
          negocio={nombreNegocio}
          sucursal={variasSucursales && sucursalNombre && sucursalNombre !== nombreNegocio ? sucursalNombre : ''}
          logoNegocio={negocioActivo?.props?.branding?.logo_url || negocioActivo?.branding?.logo_url || null}
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
      {turnoSel && espacio && (
        <ModalTurno
          turno={(espacio.turnos || []).find((x) => x.id === turnoSel.turnoId) || {}}
          espacioNombre={espacio.nombre}
          onGuardar={guardarTurno}
          onCerrar={() => setTurnoSel(null)}
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
          onCrear={crearEmpleadoRapido}
          onNoAplica={marcarNoAplica}
          onBaja={bajaRapida}
          onPuestos={guardarPuestos}
          onGuardar={guardarCelda}
          onCerrar={() => setCeldaSel(null)}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.band, border: `1px solid ${toast.tipo === 'error' ? T.bad : T.accent}88`, color: toast.tipo === 'error' ? T.bad : T.text, fontFamily: FB, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 12, boxShadow: T.sombra, zIndex: 60 }}>
          {toast.msj}
          {toast.accion && (
            <span onClick={() => { const a = toast.accion; setToast(null); a.fn(); }}
              style={{ marginLeft: 12, color: T.accentTxt, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>{toast.accion.label}</span>
          )}
        </div>
      )}
    </div>
  );
}