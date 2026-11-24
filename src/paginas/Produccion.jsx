// src/paginas/Produccion.jsx — Operación › Producción (usuaria 21/11/2026).
// Tareas operativas de la cocina: la producción de los elaborados.
//  · Jefe de cocina / dueño / admin: la semana por turno, por persona o por plaza; programan
//    (en tandas: 1, ½…), arrastran para reorganizar, repiten la semana anterior, arman los turnos y
//    los estimados; ven el panel de tiempos y aprueban los cambios de ingredientes.
//  · Staff: «Mis tareas» del día, las ejecuta con cronómetro desde el celular.
// Reemplaza la planilla «06 - Tareas Operativas.xlsm».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { ProduccionAPI, setSucursalOperacion } from '@/servicios/apiProduccion';
import { showAlert } from '@/servicios/appAlert';
import GrillaSemana, { TarjetaTarea } from '@/componentes/produccion/GrillaSemana';
import ProgramarModal from '@/componentes/produccion/ProgramarModal';
import TareaDetalle from '@/componentes/produccion/TareaDetalle';
import { TurnosModal, Estimados, Cambios, PanelGeneral, EquipoAreas } from '@/componentes/produccion/Paneles';
import { MiseEnPlace, Registros, Consumos } from '@/componentes/produccion/Registros';
import Novedades from '@/componentes/produccion/Novedades';
import Sugerencias from '@/componentes/produccion/Sugerencias';
import { useNavigate } from 'react-router-dom';
import { Boton, Pastilla, Vacio, Texto } from '@/componentes/produccion/ui';
import { isoHoy, lunesDe, sumarDias, diasDeSemana, rangoSemana, diaLargo, textoError } from '@/componentes/produccion/util';
import SpotlightTour from '@/componentes/SpotlightTour';
import { usePasosPresentes } from '@/componentes/asistente/pasosHeader';
import { useAbrirGuia } from '@/componentes/asistente/guias';
import { useRecorrido } from '@/hooks/useRecorrido';

function useCel() {
  const [cel, setCel] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760);
  useEffect(() => {
    const f = () => setCel(window.innerWidth < 760);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return cel;
}

const SIN = '_sin';

export default function Produccion() {
  const { activeId } = useBusiness() || {};
  const { activeBranchId } = useBranch() || {};
  setSucursalOperacion(activeBranchId);
  // Cambiar de sucursal recarga todo (bid + sucursal como clave de los pedidos).
  const bid = activeId ? `${activeId}` : activeId;
  const clave = `${activeId}|${activeBranchId ?? 'main'}`;
  const cel = useCel();
  const [params, setParams] = useSearchParams();
  const [ctx, setCtx] = useState(null);
  const [errorCtx, setErrorCtx] = useState('');
  const [lunes, setLunes] = useState(() => lunesDe(isoHoy()));
  const [tareas, setTareas] = useState([]);
  const [elaborados, setElaborados] = useState([]);
  const [cambios, setCambios] = useState([]);
  const [panel, setPanel] = useState(null);
  const [sugerencias, setSugerencias] = useState(null);
  const [vista, setVista] = useState(null);
  const [programar, setProgramar] = useState(null);
  const [turnosOpen, setTurnosOpen] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { cargarFuentes(); }, []);
  const dias = useMemo(() => diasDeSemana(lunes), [lunes]);

  const cargarCtx = useCallback(async () => {
    if (!bid || !clave) return;
    try { const c = await ProduccionAPI.contexto(bid); setCtx(c); setErrorCtx(''); } catch (e) { setErrorCtx(textoError(e)); }
  }, [bid, clave]);
  const cargarTareas = useCallback(async () => {
    if (!bid) return;
    setCargando(true);
    try { const r = await ProduccionAPI.tareas(bid, lunes, sumarDias(lunes, 6)); setTareas(r.tareas || []); setCargado(true); } catch (e) { showAlert(textoError(e), 'error'); }
    finally { setCargando(false); }
  }, [bid, lunes, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const cargarElaborados = useCallback(async () => {
    if (!bid || !ctx?.planifica) return;
    try { const r = await ProduccionAPI.elaborados(bid); setElaborados(r.items || []); } catch { /* se ve vacío */ }
  }, [bid, ctx?.planifica, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const cargarCambios = useCallback(async () => {
    if (!bid || !ctx?.decide) return;
    try { const r = await ProduccionAPI.cambios(bid); setCambios(r.items || []); } catch { /* nada */ }
  }, [bid, ctx?.decide, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const cargarPanel = useCallback(async () => {
    if (!bid || !ctx?.planifica) return;
    setPanel(null);
    try { setPanel(await ProduccionAPI.panel(bid, lunes, sumarDias(lunes, 6))); } catch { /* nada */ }
  }, [bid, lunes, ctx?.planifica, clave]); // eslint-disable-line react-hooks/exhaustive-deps

  // En el celular la tira de pestañas se desliza: la elegida se trae a la vista (21/11, recorrida a 390 px).
  const tiraRef = useRef(null);
  useEffect(() => {
    const t = tiraRef.current; const b = t?.querySelector('[aria-pressed="true"]');
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
  }, [vista, ctx]);

  useEffect(() => { setCtx(null); setCargado(false); cargarCtx(); }, [cargarCtx]);
  useEffect(() => { cargarTareas(); }, [cargarTareas]);
  useEffect(() => { cargarElaborados(); cargarCambios(); }, [cargarElaborados, cargarCambios]);
  useEffect(() => { if (vista === 'panel') cargarPanel(); }, [vista, cargarPanel]);
  // Según ventas: se calcula al entrar a la pestaña o al abrir Programar (lo usa como ayuda).
  const cargarSugerencias = useCallback(async () => {
    if (!bid || !ctx?.planifica) return;
    try { setSugerencias(await ProduccionAPI.sugerencias(bid, lunes)); } catch { setSugerencias({ items: [], desde: lunes, hasta: lunes }); }
  }, [bid, lunes, ctx?.planifica, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSugerencias(null); }, [clave, lunes]);
  useEffect(() => { if ((vista === 'sugerencia' || programar) && !sugerencias) cargarSugerencias(); }, [vista, programar, sugerencias, cargarSugerencias]);
  // vista por defecto según quién entra
  useEffect(() => { if (ctx && !vista) setVista(ctx.planifica ? 'turno' : 'mias'); }, [ctx, vista]);
  // ?tarea=ID (desde un aviso de la campana) abre la tarea
  useEffect(() => {
    const id = Number(params.get('tarea'));
    if (id) { setAbierta(id); params.delete('tarea'); setParams(params, { replace: true }); }
    // ?vista=registros (aviso de desperdicio) abre esa pestaña
    const v = params.get('vista');
    if (v) { setVista(v); params.delete('vista'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const refrescar = useCallback(() => { cargarTareas(); cargarCambios(); setSugerencias(null); if (vista === 'panel') cargarPanel(); }, [cargarTareas, cargarCambios, cargarPanel, vista]);

  // ── filas según la vista ──
  const filas = useMemo(() => {
    if (!ctx) return [];
    if (vista === 'persona') {
      const ids = new Set(tareas.map((t) => t.responsable_user_id).filter(Boolean));
      const gente = (ctx.equipo || []).filter((u) => u.rol === 'staff' || ids.has(u.id));
      return [...gente.map((u) => ({ key: String(u.id), label: u.nombre, sub: u.jefe ? 'jefe' : null })), { key: SIN, label: 'Sin asignar' }];
    }
    if (vista === 'plaza') return [...(ctx.plazas || []).map((p) => ({ key: String(p.id), label: p.nombre, sub: p.sector })), { key: SIN, label: 'Sin plaza' }];
    const ts = (ctx.turnos || []).map((t) => ({ key: String(t.id), label: t.nombre, sub: t.desde ? `${t.desde}${t.hasta ? `–${t.hasta}` : ''}` : null }));
    return tareas.some((t) => !t.turno_id) || !ts.length ? [...ts, { key: SIN, label: 'Sin turno' }] : ts;
  }, [ctx, vista, tareas]);
  const claveDe = useCallback((t) => {
    const v = vista === 'persona' ? t.responsable_user_id : vista === 'plaza' ? t.plaza_id : t.turno_id;
    return v ? String(v) : SIN;
  }, [vista]);
  const campo = vista === 'persona' ? 'responsable_user_id' : vista === 'plaza' ? 'plaza_id' : 'turno_id';

  const mover = async (t, key, fecha) => {
    const body = { fecha, [campo]: key === SIN ? null : Number(key) };
    setTareas((l) => l.map((x) => (x.id === t.id ? { ...x, fecha, [campo]: body[campo] } : x)));
    try { await ProduccionAPI.editar(bid, t.id, body); } catch (e) { showAlert(textoError(e), 'error'); }
    cargarTareas();
  };
  const nueva = (key, fecha) => setProgramar({ fecha, ...(key !== SIN ? { [campo]: Number(key) } : {}) });

  const crear = async (lista) => {
    try { await ProduccionAPI.crear(bid, lista); refrescar(); return null; } catch (e) { return textoError(e); }
  };
  const repetir = async () => {
    const desde = sumarDias(lunes, -7);
    const tiene = tareas.filter((t) => t.estado !== 'cancelada').length;
    if (!window.confirm(tiene
      ? `Esta semana ya tiene ${tiene} tareas. ¿Sumar además las de la semana del ${rangoSemana(desde)}?`
      : `¿Repetir acá la producción de la semana del ${rangoSemana(desde)}? Después ajustás lo que cambie.`)) return;
    try {
      const r = await ProduccionAPI.copiarSemana(bid, desde, lunes, tiene > 0);
      showAlert(`Listo: ${r.copiadas} tareas copiadas. Ajustá lo que cambie esta semana.`, 'success');
      refrescar();
    } catch (e) { showAlert(textoError(e), 'error'); }
  };
  const decidir = async (c, dec) => {
    const n = dec === 'rechazado' ? window.prompt('¿Por qué lo rechazás? (lo ve el cocinero)') : '';
    if (n === null) return;
    try { await ProduccionAPI.decidir(bid, c.tarea_id, c.id, dec, n || ''); refrescar(); } catch (e) { showAlert(textoError(e), 'error'); }
  };

  useAbrirGuia('produccion', () => {
    if (ctx?.planifica && !['turno', 'persona', 'plaza'].includes(vista)) setVista('turno');
  }, !!ctx);

  const listaPasosProd = ctx?.planifica ? [
    { k: 'prod-programar', t: <>Con <b>+ Programar</b> armás la producción de la semana en tandas (1, ½, 2…), por turno, persona o plaza. Con <b>⟳ Repetir semana anterior</b> copiás la semana pasada y ajustás lo que cambie.</> },
    { k: 'prod-turno', t: <>En <b>Semana</b> ves la grilla día por día. Tocando cualquier tarea la abrís para usar el <b>cronómetro</b>, cargar un <b>cambio de ingrediente</b> o imprimir sus <b>etiquetas</b>.</> },
    { k: 'prod-mias', t: <>En <b>Mis tareas</b> cada cocinero ve lo que le toca hoy, sigue la receta escalada a las tandas con el <b>cronómetro</b> y avisa si cambió o faltó algún ingrediente.</> },
    { k: 'prod-panel', t: <>En <b>Panel</b> seguís el avance y los tiempos reales contra los estimados, y en <b>Estimados</b> configurás cuánto lleva cada tanda y su vida útil.</> },
    { k: 'prod-registros', t: <>En <b>Mermas y desperdicios</b> registrás lo que se pierde al limpiar un insumo o un descarte de cocina.</> },
    { k: 'prod-novedades', t: <>En <b>Novedades</b> el equipo de cocina deja avisos con foto opcional (algo dañado, algo sucio, se hizo limpieza o cómo quedó un puesto) que notifican a todos.</> },
  ] : [
    { k: 'prod-mias', t: <>En <b>Mis tareas</b> ves las producciones que tenés asignadas para hoy. Tocá una tarea para ver los ingredientes escalados a las tandas y usar el <b>cronómetro</b> (Iniciar, Pausar y Terminar).</> },
    { k: 'prod-cuerpo', t: <>Adentro de cada tarea también podés cargar un <b>cambio de ingrediente</b> (si usaste otro insumo, otra cantidad o faltó algo, solo por hoy o como cambio de receta) y anotar cuánto rindió al terminar.</> },
    { k: 'prod-semana_staff', t: <>En <b>Semana</b> consultás todo lo que tenés programado en los distintos turnos y días de la semana.</> },
    { k: 'prod-registros', t: <>En <b>Mermas y desperdicios</b> anotás lo que se pierde al limpiar un insumo o cualquier descarte de cocina.</> },
    { k: 'prod-novedades', t: <>En <b>Novedades</b> dejás avisos para el equipo con foto opcional: si encontraste algo dañado o sucio, si hiciste una limpieza o cómo dejaste tu puesto.</> },
  ];
  const pasosProd = usePasosPresentes(listaPasosProd, `${clave}:${!!ctx}:${ctx?.planifica}:${cargado}:${tareas.length}:${vista}`);
  const recProd = useRecorrido('produccion', pasosProd.length,
    !!bid && !!ctx && !!vista && cargado && !cargando && !errorCtx && !programar && !turnosOpen && !abierta && pasosProd.length > 0,
    { sinDatos: cargado && !tareas.length });
  const pasoProd = pasosProd[recProd.paso - 1];
  const guiaProd = recProd.visible && pasoProd ? (
    <SpotlightTour key={pasoProd.k} targetRef={pasoProd.ref} pose={recProd.paso === 1 ? 'presenta' : 'senala'}
      placement="bottom" text={pasoProd.t} {...recProd.props(recProd.paso)} />
  ) : null;

  if (errorCtx) return <div style={{ padding: 24 }}><Vacio emoji="🔒" titulo="Producción">{errorCtx}</Vacio></div>;
  if (!ctx) return <div style={{ padding: 24, fontFamily: FB, color: T.text3 }}>Cargando…</div>;

  const pestañas = ctx.planifica
    ? [['turno', 'Semana'], ['persona', 'Por persona'], ['plaza', 'Por plaza'], ['sugerencia', 'Según ventas'], ['mias', 'Mis tareas'], ['panel', 'Panel'], ...(ctx.decide ? [['cambios', 'Cambios']] : []), ['registros', 'Mermas y desperdicios'], ['novedades', 'Novedades'], ['consumos', 'Consumos'],
      ['mise', 'Mise en place'], ['estimados', 'Estimados'], ['equipo', 'Equipo']]
    : [['mias', 'Mis tareas'], ['semana_staff', 'Semana'], ['registros', 'Mermas y desperdicios'], ['novedades', 'Novedades']];
  const enSemana = ['turno', 'persona', 'plaza', 'semana_staff', 'panel', 'registros', 'consumos', 'sugerencia'].includes(vista);
  const mias = tareas.filter((t) => t.responsable_user_id === ctx.uid || (!t.responsable_user_id && !ctx.planifica));

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: cel ? '10px 10px 40px' : '16px 20px 48px', boxSizing: 'border-box', fontFamily: FB }}>
      {guiaProd}
      {/* encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: FT, fontWeight: 800, fontSize: cel ? 19 : 22, color: T.ink, marginRight: 6 }}>Producción</div>
        {enSemana && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Boton chico onClick={() => setLunes((l) => sumarDias(l, -7))} title="Semana anterior">‹</Boton>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 13, color: T.text }}>{rangoSemana(lunes)}</div>
            </div>
            <Boton chico onClick={() => setLunes((l) => sumarDias(l, 7))} title="Semana siguiente">›</Boton>
            {lunes !== lunesDe(isoHoy()) && <Boton chico onClick={() => setLunes(lunesDe(isoHoy()))}>HOY</Boton>}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {ctx.planifica && ['turno', 'persona', 'plaza'].includes(vista) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Boton onClick={repetir} title="Copia la semana anterior y después ajustás">⟳ Repetir semana anterior</Boton>
            <Boton onClick={() => setTurnosOpen(true)}>⚙ Turnos</Boton>
            <span data-tour="prod-programar" style={{ display: 'inline-flex' }}>
              <Boton primario onClick={() => setProgramar({ fecha: dias.includes(isoHoy()) ? isoHoy() : lunes })}>+ Programar</Boton>
            </span>
          </div>
        )}
      </div>

      {/* pestañas */}
      <div ref={tiraRef} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12, position: 'relative' }}>
        {pestañas.map(([k, l]) => (
          <span key={k} data-tour={`prod-${k}`} style={{ display: 'inline-flex', flexShrink: 0 }}>
            <Boton activo={vista === k} onClick={() => setVista(k)} style={{ flexShrink: 0 }}>
              {l}{k === 'cambios' && cambios.length > 0 && <Pastilla color="#fff" fondo={T.warn} style={{ marginLeft: 4 }}>{cambios.length}</Pastilla>}
              {k === 'mias' && mias.filter((t) => t.estado !== 'hecha' && t.estado !== 'cancelada').length > 0 && vista !== 'mias' &&
                <Pastilla style={{ marginLeft: 4 }}>{mias.filter((t) => t.estado !== 'hecha' && t.estado !== 'cancelada').length}</Pastilla>}
            </Boton>
          </span>
        ))}
      </div>

      {ctx.decide && cambios.length > 0 && vista !== 'cambios' && (
        <div onClick={() => setVista('cambios')} style={{ cursor: 'pointer', background: '#FBF3E2', border: '1px solid #EED9A8', color: '#8A6418', borderRadius: 12, padding: '9px 12px', marginBottom: 12, fontSize: 13 }}>
          🔁 {cambios.length === 1 ? 'Hay 1 cambio de ingrediente' : `Hay ${cambios.length} cambios de ingredientes`} esperando tu aprobación ›
        </div>
      )}

      <div data-tour="prod-cuerpo" style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 16, padding: cel ? 10 : 14, boxShadow: T.sombraSuave }}>
        {(vista === 'turno' || vista === 'persona' || vista === 'plaza' || vista === 'semana_staff') && (
          cargando && !tareas.length ? <Texto sutil>Cargando…</Texto> : !tareas.length ? (
            <SemanaEjemplo dias={dias} filas={filas} cel={cel} planifica={ctx.planifica}
              mostrar={vista === 'persona' ? 'turno' : 'responsable'}
              onProgramar={() => setProgramar({ fecha: dias.includes(isoHoy()) ? isoHoy() : lunes })}
              onRepetir={repetir} />
          ) : (
            <GrillaSemana dias={dias} filas={filas} tareas={tareas} claveDe={claveDe} cel={cel}
              onAbrir={(t) => setAbierta(t.id)} onMover={mover} onNueva={nueva} puedeEditar={ctx.planifica && vista !== 'semana_staff'}
              mostrar={vista === 'persona' ? 'turno' : 'responsable'} />
          )
        )}

        {vista === 'mias' && <MisTareas tareas={mias} dias={dias} lunes={lunes} setLunes={setLunes} onAbrir={(t) => setAbierta(t.id)} cel={cel} planifica={ctx.planifica} />}
        {vista === 'panel' && <PanelGeneral datos={panel} cel={cel} />}
        {vista === 'sugerencia' && <Sugerencias datos={sugerencias} cel={cel}
          onProgramar={(x) => setProgramar({ insumo_id: x.insumo_id, tandas: x.faltan, fecha: dias.includes(isoHoy()) ? isoHoy() : lunes })} />}
        {vista === 'estimados' && <Estimados businessId={bid} elaborados={elaborados} ctx={ctx} onCambio={cargarElaborados} cel={cel} />}
        {vista === 'cambios' && <Cambios cambios={cambios} onAbrir={(id) => setAbierta(id)} onDecidir={decidir} onAprobaciones={() => navigate('/configuracion?tab=6')} />}
        {vista === 'equipo' && <EquipoAreas businessId={bid} ctx={ctx} onCambio={cargarCtx} />}
        {vista === 'mise' && <MiseEnPlace businessId={bid} ctx={ctx} cel={cel} />}
        {vista === 'registros' && <Registros businessId={bid} ctx={ctx} desde={lunes} hasta={sumarDias(lunes, 6)} cel={cel} />}
        {vista === 'novedades' && <Novedades businessId={bid} ctx={ctx} cel={cel} />}
        {vista === 'consumos' && <Consumos businessId={bid} desde={lunes} hasta={sumarDias(lunes, 6)} cel={cel} />}
      </div>

      <ProgramarModal abierto={!!programar} inicial={programar} onCerrar={() => setProgramar(null)} onGuardar={crear}
        ctx={ctx} elaborados={elaborados} dias={dias} cel={cel} sugerencias={sugerencias} />
      <TurnosModal abierto={turnosOpen} onCerrar={() => setTurnosOpen(false)} businessId={bid} turnos={ctx.turnos} onCambio={() => { cargarCtx(); cargarTareas(); }} cel={cel} />
      <TareaDetalle businessId={bid} tareaId={abierta} abierto={!!abierta} onCerrar={() => setAbierta(null)} onCambio={refrescar} ctx={ctx} cel={cel} />
    </div>
  );
}

/** Vista previa de EJEMPLO cuando la semana no tiene tareas programadas (solo se dibuja, no se guarda). */
function SemanaEjemplo({ dias, filas, cel, planifica, mostrar, onProgramar, onRepetir }) {
  const f0 = filas[0]?.key || SIN;
  const f1 = (filas[1] || filas[0])?.key || SIN;
  const hoy = isoHoy();
  const dPrincipal = dias.includes(hoy) ? hoy : dias[0];
  const dOtro1 = dias.find((d) => d !== dPrincipal) || dPrincipal;
  const dOtro2 = dias.find((d) => d !== dPrincipal && d !== dOtro1) || dOtro1;
  const ejemplo = [
    { id: 'ej-1', tipo: 'produccion', titulo: 'Salsa fileto', tandas: 2, rinde_esperado: 10, unidad: 'lt', minutos_estimados: 45, estado: 'hecha', responsable: 'Ana López', turno: 'Mañana', plaza: 'Cocina caliente', fecha: dOtro1, filaKey: f0 },
    { id: 'ej-2', tipo: 'produccion', titulo: 'Masa de pizza', tandas: 1, rinde_esperado: 20, unidad: 'u', minutos_estimados: 60, estado: 'en_curso', corriendo: true, responsable: 'Juan Pérez', turno: 'Mañana', plaza: 'Panadería', fecha: dPrincipal, filaKey: f0 },
    { id: 'ej-3', tipo: 'mise_en_place', titulo: 'Mise en place · Línea caliente', tandas: 1, minutos_estimados: 30, estado: 'pendiente', responsable: 'Ana López', turno: 'Tarde', plaza: 'Línea caliente', fecha: dPrincipal, filaKey: f1 },
    { id: 'ej-4', tipo: 'produccion', titulo: 'Caldo de verduras', tandas: 1.5, rinde_esperado: 15, unidad: 'lt', minutos_estimados: 50, estado: 'pendiente', responsable: 'Mara Díaz', turno: 'Tarde', plaza: 'Cocina caliente', fecha: dOtro2, filaKey: f1 },
  ];
  return (
    <div>
      <div aria-hidden style={{ opacity: 0.38, pointerEvents: 'none', userSelect: 'none' }}>
        <GrillaSemana dias={dias} filas={filas} tareas={ejemplo} claveDe={(t) => t.filaKey} cel={cel}
          onAbrir={() => {}} onMover={() => {}} onNueva={() => {}} puedeEditar={false} mostrar={mostrar} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 12px 8px' }}>
        <div style={{ width: 460, maxWidth: '100%', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 22, textAlign: 'center', boxSizing: 'border-box' }}>
          <span style={{ display: 'inline-block', fontFamily: FB, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '2px 8px', marginBottom: 10 }}>ARRIBA, UN EJEMPLO</span>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 6 }}>
            {planifica ? 'Programá tu primera producción' : 'Semana sin producción programada'}
          </div>
          <div style={{ fontFamily: FB, fontSize: 13, color: T.text2, marginBottom: planifica ? 16 : 0 }}>
            {planifica
              ? <>Armá la semana por turno, persona o plaza con <b>+ Programar</b>. Si se parece a la anterior, usá <b>⟳ Repetir semana anterior</b> y ajustá lo que cambie.</>
              : 'Cuando el jefe de cocina programe las tareas de la semana, acá vas a ver qué se prepara cada día y en qué turno.'}
          </div>
          {planifica && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Boton primario onClick={onProgramar}>+ Programar</Boton>
              <Boton onClick={onRepetir}>⟳ Repetir semana anterior</Boton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** El día del cocinero: sus tareas de hoy primero, las que están en curso arriba. */
function MisTareas({ tareas, dias, lunes, setLunes, onAbrir, cel, planifica }) {
  const hoy = isoHoy();
  const [dia, setDia] = useState(() => (dias.includes(hoy) ? hoy : dias[0]));
  useEffect(() => { if (!dias.includes(dia)) setDia(dias.includes(hoy) ? hoy : dias[0]); }, [dias, dia, hoy]);
  const orden = { en_curso: 0, pausada: 1, pendiente: 2, hecha: 3, cancelada: 4 };
  const delDia = tareas.filter((t) => t.fecha === dia).sort((a, b) => orden[a.estado] - orden[b.estado] || (a.orden - b.orden));
  return (
    <div>
      <div style={{ display: 'flex', gap: cel ? 3 : 4, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, alignItems: 'center' }}>
        <Boton chico onClick={() => { setLunes(sumarDias(lunes, -7)); setDia(sumarDias(dia, -7)); }} title="Semana anterior">‹</Boton>
        {dias.map((d) => {
          const n = tareas.filter((t) => t.fecha === d && t.estado !== 'hecha' && t.estado !== 'cancelada').length;
          return (
            <button key={d} type="button" onClick={() => setDia(d)}
              style={{ flex: cel ? '1 1 0' : '0 0 auto', minWidth: cel ? 0 : 50, padding: cel ? '6px 2px' : '6px', borderRadius: 10, cursor: 'pointer', fontFamily: FB, fontSize: 11.5, fontWeight: 600,
                background: d === dia ? T.ink : T.band, color: d === dia ? '#fff' : d === hoy ? T.accentTxt : T.text2, border: `1px solid ${d === dia ? T.ink : T.border}` }}>
              <div>{d === hoy ? 'Hoy' : diaLargo(d).split(' ')[0]}</div>
              <div style={{ fontFamily: FT, fontSize: 14 }}>{Number(d.slice(8))}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{n || '·'}</div>
            </button>
          );
        })}
        <Boton chico onClick={() => { setLunes(sumarDias(lunes, 7)); setDia(sumarDias(dia, 7)); }} title="Semana siguiente">›</Boton>
      </div>
      {!delDia.length ? (
        <Vacio emoji="☕" titulo={dia === hoy ? 'Hoy no tenés tareas' : 'No tenés tareas ese día'}>
          {planifica ? 'Las tareas asignadas a vos aparecen acá.' : 'Cuando el jefe de cocina te asigne algo, aparece acá y te llega un aviso.'}
        </Vacio>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {delDia.map((t) => <TarjetaTarea key={t.id} t={t} onAbrir={onAbrir} mostrar="turno" />)}
        </div>
      )}
    </div>
  );
}
