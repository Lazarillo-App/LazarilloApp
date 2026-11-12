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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RrhhAPI, negocioActual } from '../servicios/apiRrhh';
import { useBusiness } from '../context/BusinessContext';
import { useNavigate } from 'react-router-dom';
import { useBranch } from '../hooks/useBranch';
import ListaNegociosNomina from '../componentes/RrhhNominaCompartida';
import SpotlightTour from '../componentes/SpotlightTour';
import { useRecorrido } from '../hooks/useRecorrido';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
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
  nuevaKey,
  duenoEnTurno,
  duenoDe,
  esHabitual,
  GrillaEjemplo,
} from './RrhhCronogramasComun';
import {
  ModalExportar,
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
              (f.celdas || []).forEach((c) => { celdas[c.dia] = { empleadoId: c.empleadoId, puesto: c.puesto || null, horas: Number(c.horas) || JORNADA_HS, entrada: c.entrada || null }; });
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
          .map(([dia, c]) => ({ dia: Number(dia), empleadoId: c.empleadoId, puesto: c.puesto || null, horas: c.horas != null ? c.horas : JORNADA_HS, entrada: c.entrada || null })),
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

  /* ── acciones de grilla ── */
  const abrirCelda = (fila, dia, turno) => {
    const celda = fila.celdas[dia] || null;
    // autocompletar: fila con dueño que ya tiene turnos cargados → repetir patrón sin modal
    if (!celda && fila.ownerEmpleadoId) {
      const patron = Object.values(fila.celdas).find((c) => c && c.empleadoId === fila.ownerEmpleadoId);
      if (patron) {
        mutarFilas((fs) => fs.map((f) => f.key === fila.key
          ? { ...f, celdas: { ...f.celdas, [dia]: { empleadoId: patron.empleadoId, puesto: patron.puesto, horas: patron.horas, entrada: patron.entrada || null } } }
          : f));
        return;
      }
    }
    const patronFila = Object.values(fila.celdas).find((c) => c && c.puesto);
    setCeldaSel({
      filaKey: fila.key, dia, turnoId: turno.id, turnoNombre: turno.nombre, turnoEntrada: turno.entrada || '',
      entradaFila: patronFila?.entrada || Object.values(fila.celdas).find((c) => c?.entrada)?.entrada || '',
      nroDia: new Date(diasISO[dia] + 'T12:00:00').getDate(),
      celda, ownerEmpleadoId: fila.ownerEmpleadoId, puestoFila: patronFila?.puesto || '',
    });
  };

  // Clic en el nombre de la fila: lo elegido se aplica a todos sus días cargados.
  const abrirFila = (fila, turno) => {
    const cs = Object.values(fila.celdas).filter((c) => c?.empleadoId);
    const puestos = new Set(cs.map((c) => c.puesto || ''));
    const horas = new Set(cs.map((c) => Number(c.horas) || JORNADA_HS));
    const entradas = new Set(cs.map((c) => c.entrada || ''));
    setCeldaSel({
      modoFila: true, filaKey: fila.key, turnoId: turno.id, turnoNombre: turno.nombre, turnoEntrada: turno.entrada || '',
      entradaMixta: entradas.size > 1,
      diasCargados: cs.length, ownerEmpleadoId: duenoDe(fila),
      celda: { empleadoId: duenoDe(fila), puesto: puestos.size === 1 ? [...puestos][0] || null : null, horas: horas.size === 1 ? [...horas][0] : JORNADA_HS, entrada: entradas.size === 1 ? [...entradas][0] || null : null },
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
        };
      });
      return { ...f, celdas, ownerEmpleadoId: valor.empleadoId };
    }));
    setCeldaSel(null);
    avisar(valor ? 'Fila actualizada ✓' : 'Fila vaciada.');
  };

  const guardarCelda = (valor) => {
    if (celdaSel?.modoFila) { guardarFila(valor); return; }
    const { filaKey, dia, turnoId } = celdaSel;
    if (valor && duenoEnTurno(filasRef.current, turnoId, valor.empleadoId, filaKey)) {
      const emp = empleadosMap.get(valor.empleadoId);
      avisar(`${nombreCorto(emp)} ya tiene una fila en este turno: cargale los días ahí.`, 'error');
      return;
    }
    mutarFilas((fs) => fs.map((f) => {
      if (f.key !== filaKey) return f;
      const celdas = { ...f.celdas };
      if (valor) celdas[dia] = { ...valor, puesto: valor.puesto ?? null, horas: valor.horas ?? JORNADA_HS, entrada: valor.entrada ?? null }; else delete celdas[dia];
      const owner = !Object.keys(celdas).length ? null : f.ownerEmpleadoId || (valor ? valor.empleadoId : null);
      return { ...f, celdas, ownerEmpleadoId: owner };
    }));
    setCeldaSel(null);
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

  /* ── estilos compartidos de la tabla ── */
  // El tema de la app pinta todo «thead th» con el color del negocio (!important): los textos del
  // encabezado van en el color de contraste del tema, si no los días no se leían (Diego 07/11/2026).
  const thDia = { padding: '7px 4px', fontFamily: FT, fontWeight: 700, fontSize: 12, color: TH_TXT, borderBottom: `1px solid ${T.border2}`, borderLeft: `1px solid ${T.border}`, background: T.head, textAlign: 'center' };
  const colFila = { width: 132, minWidth: 132, maxWidth: 132, boxSizing: 'border-box' };
  // nombres largos: hasta 2 renglones y recién ahí "…"
  const dosRenglones = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '15px', maxHeight: 30, wordBreak: 'break-word' };
  const thSup = { position: 'sticky', top: 0, zIndex: 3, height: 26, boxSizing: 'border-box', padding: '4px 6px', fontSize: 11 };
  const thSub = { position: 'sticky', top: 26, zIndex: 3, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontFamily: FB, fontSize: 10.5, color: TH_TXT, opacity: 0.85, minWidth: 34 };
  const celTot = { padding: '4px 6px', textAlign: 'center', borderBottom: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}`, fontFamily: FB, fontSize: 12, color: T.text2, background: T.head };

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
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: '14px 18px 40px', boxSizing: 'border-box',
      // maximizado: ocupa toda la ventana; los modales y avisos son hijos, así que quedan encima
      ...(maximizado ? { position: 'fixed', inset: 0, zIndex: 1250, overflow: 'auto', minHeight: 0 } : {}) }}>
      {recCrono.visible && pasoTour && (
        <SpotlightTour key={pasoTour.k} targetRef={refsTour[pasoTour.k]} pose={recCrono.paso === 1 ? 'presenta' : 'senala'} placement="bottom"
          text={pasoTour.t} {...recCrono.props(recCrono.paso)} />
      )}
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

      {/* arranque sin nómina */}
      {sinNomina ? (
        <GrillaEjemplo>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginBottom: 8 }}>Arranquemos con los cronogramas</div>
          <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, marginBottom: 18 }}>
            {sinReplica
              ? 'Este negocio no tiene MaxiRest conectado, así que la nómina no entra sola: usá la de otro negocio de tu cartera o cargala a mano.'
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

          <div ref={refsTour.grilla} style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'auto', maxHeight: maximizado ? 'calc(100vh - 150px)' : 'calc(100vh - 225px)' }}>
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
                        <div style={{ color: TH_TXT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          {DC[i]} {d.getDate()}
                          {iso === hoyIso && <span style={{ fontFamily: FB, fontSize: 9.5, fontWeight: 800, lineHeight: '15px', padding: '0 6px', borderRadius: 8, background: '#fff', color: T.accentTxt }}>HOY</span>}
                        </div>
                        {/* la fecha especial va en una pastilla blanca: se lee sobre cualquier color de negocio */}
                        <div style={{ height: 16, fontFamily: FB, fontWeight: 700, fontSize: 10, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110, margin: '2px auto 0',
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
                        return (
                          <tr key={f.key}>
                            <td onClick={() => abrirFila(f, t)}
                              style={{ ...colFila, position: 'sticky', left: 0, zIndex: 1, background: T.head, borderBottom: `1px solid ${T.border}`, padding: '4px 10px', fontFamily: FB, fontSize: 12.5, fontWeight: dueno ? 700 : 400, color: dueno ? T.text : T.vacio, cursor: 'pointer' }}
                              title={`${dueno ? nombreDe(empleadosMap.get(dueno)) : 'Fila libre'} · clic: cambiar empleado, puesto, entrada u horas de toda la fila`}>
                              <div style={dosRenglones}>{dueno ? nombreDe(empleadosMap.get(dueno)) : 'Fila libre'}</div>
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
                                    cursor: c ? 'grab' : 'pointer', minWidth: 78,
                                    background: iso === hoyIso ? (c ? T.accent + (destelloHoy ? '55' : '2E') : T.accent + (destelloHoy ? '40' : '14')) : (c ? T.card : 'transparent'),
                                    transition: 'background .4s',
                                    outline: dropSobre === `${f.key}:${dia}` ? `2px dashed ${T.accent}` : 'none', outlineOffset: -3,
                                  }}
                                >
                                  <div style={{ minHeight: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    {c ? (
                                      <>
                                        <div style={{ ...dosRenglones, fontFamily: FB, fontWeight: 700, fontSize: 12.5, color: T.text, maxWidth: 90, textAlign: 'center' }}>{nombreCorto(emp)}</div>
                                        <div style={{ height: 16, display: 'flex', gap: 3, alignItems: 'center' }}>
                                          {c.puesto && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.accentTxt, border: `1px solid ${T.accentTxt}55`, borderRadius: 6, padding: '0 4px' }}>{c.puesto}</span>}
                                          {c.entrada && c.entrada !== t.entrada && <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 9.5, lineHeight: '13px', color: T.violet, border: `1px solid ${T.violet}55`, borderRadius: 6, padding: '0 4px' }} title={`Entra ${c.entrada} (el turno entra ${t.entrada || '—'})`}>{c.entrada}</span>}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginRight: 2 }}>Puestos:</span>
            {(config?.puestos || []).map((p) => <Chip key={p.codigo} color={T.accentTxt}>{p.codigo} · {p.nombre}</Chip>)}
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, marginTop: 8 }}>
            Click en una celda carga un empleado · arrastrala para moverla · click derecho la saca · click en el día carga un feriado o evento · click en el nombre de la fila cambia toda la fila · click en el turno lo edita (▾ lo minimiza) · los cambios se guardan solos.
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