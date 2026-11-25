// src/paginas/Mantenimiento.jsx — Operación › Mantenimiento (usuaria 21/11/2026, etapa 3 de Producción).
// Reemplaza Activos / mantenimiento preventivo / órdenes / freidoras / heladeras de la planilla vieja.
//  · Agenda: fallas abiertas, vencidas, hoy, próximos días y lo hecho (las preventivas salen solas de los planes)
//  · Equipos: cada equipo con sus mantenimientos que se repiten y su historial
//  · Registros: lo del día a día (aceite de la freidora, limpieza y temperatura de las heladeras)
// Cualquiera del equipo reporta una falla; jefe / dueño / admin arman equipos y planes.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { setSucursalOperacion } from '@/servicios/apiProduccion';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { MantenimientoAPI } from '@/servicios/apiMantenimiento';
import { Boton, Pastilla, Vacio, Texto, Campo, Entrada, Selector } from '@/componentes/produccion/ui';
import { diaLargo, isoHoy, textoError } from '@/componentes/produccion/util';
import { RUBRO, ESTADO_EQUIPO, TIPOS_POR_RUBRO } from '@/componentes/mantenimiento/datos';
import { TarjetaOrden, OrdenModal, FallaModal, EquipoModal, NuevaOrdenModal } from '@/componentes/mantenimiento/Modales';
import SpotlightTour from '@/componentes/SpotlightTour';
import { usePasosPresentes } from '@/componentes/asistente/pasosHeader';
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
const fechaHora = (s) => new Date(s).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const normTxt = (s) => String(s || '').normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
const ESTADOS_FILTRO = [['activo', 'Activo'], ['en_reparacion', 'En reparación'], ['baja', 'De baja']];

function Seccion({ titulo, color, children, cuenta }) {
  if (!cuenta) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: color || T.text, marginBottom: 6 }}>{titulo} <span style={{ fontFamily: FB, fontWeight: 400, color: T.text3 }}>{cuenta}</span></div>
      {children}
    </div>
  );
}

export default function Mantenimiento() {
  const { activeId: bid } = useBusiness() || {};
  const { activeBranchId } = useBranch() || {};
  setSucursalOperacion(activeBranchId);
  const clave = `${bid}|${activeBranchId ?? 'main'}`;
  const cel = useCel();
  const [params, setParams] = useSearchParams();
  const [ctx, setCtx] = useState(null);
  const [cargado, setCargado] = useState(false);
  const [errorCtx, setErrorCtx] = useState('');
  const [vista, setVista] = useState('agenda');
  const [ordenes, setOrdenes] = useState([]);
  const [hoy, setHoy] = useState(isoHoy());
  const [equipos, setEquipos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [orden, setOrden] = useState(null);
  const [equipo, setEquipo] = useState(null);      // { id } o { nuevo: true }
  const [falla, setFalla] = useState(null);        // { equipoId }
  const [nuevaOrden, setNuevaOrden] = useState(null);
  const [qEquipo, setQEquipo] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  useEffect(() => { cargarFuentes(); }, []);
  const cargarTodo = useCallback(async () => {
    if (!bid) return;
    try {
      const [o, e, r] = await Promise.all([MantenimientoAPI.ordenes(bid), MantenimientoAPI.equipos(bid), MantenimientoAPI.registros(bid)]);
      setOrdenes(o.ordenes || []); setHoy(o.hoy || isoHoy()); setEquipos(e.equipos || []); setRegistros(r.registros || []);
      setCargado(true);
    } catch (x) { setErrorCtx(textoError(x)); }
  }, [bid, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bid) return;
    setCtx(null); setCargado(false);
    MantenimientoAPI.contexto(bid).then(setCtx).catch((e) => setErrorCtx(textoError(e)));
    cargarTodo();
  }, [bid, cargarTodo]);
  // ?orden=ID desde un aviso de la campana
  useEffect(() => {
    const id = Number(params.get('orden'));
    if (!id || !ordenes.length) return;
    const o = ordenes.find((x) => x.id === id);
    if (o) setOrden(o);
    params.delete('orden'); setParams(params, { replace: true });
  }, [params, setParams, ordenes]);

  const grupos = useMemo(() => {
    const pend = ordenes.filter((o) => o.estado === 'pendiente');
    return {
      fallas: pend.filter((o) => o.tipo === 'correctivo'),
      vencidas: pend.filter((o) => o.tipo !== 'correctivo' && o.fecha < hoy),
      hoy: pend.filter((o) => o.tipo !== 'correctivo' && o.fecha === hoy),
      proximas: pend.filter((o) => o.tipo !== 'correctivo' && o.fecha > hoy),
      hechas: ordenes.filter((o) => o.estado === 'hecha'),
    };
  }, [ordenes, hoy]);

  const conFiltroEquipos = equipos.length > 10;
  const equiposVisibles = useMemo(() => {
    if (!conFiltroEquipos) return equipos;
    const palabras = normTxt(qEquipo).split(/\s+/).filter(Boolean);
    return equipos.filter((e) => {
      if (rubroFiltro && e.rubro !== rubroFiltro) return false;
      if (estadoFiltro && (e.estado || 'activo') !== estadoFiltro) return false;
      if (palabras.length) {
        const base = normTxt([e.nombre, e.marca, e.modelo, e.ubicacion, e.sector].join(' '));
        if (!palabras.every((w) => base.includes(w))) return false;
      }
      return true;
    });
  }, [equipos, conFiltroEquipos, qEquipo, rubroFiltro, estadoFiltro]);

  const pasosMant = usePasosPresentes([
    { k: 'mant-equipo', t: <>Con <b>+ Equipo</b> cargás cada heladera, freidora, horno o máquina del local y le armás los mantenimientos preventivos que se repiten.</> },
    { k: 'mant-agenda', t: ctx?.planifica
      ? <>En <b>Agenda</b> ves las fallas abiertas, los mantenimientos vencidos, los de hoy y los próximos días. Las órdenes preventivas aparecen solas cuando se acerca la fecha.</>
      : <>En <b>Mis órdenes</b> ves los mantenimientos y fallas que tenés asignados o pendientes para resolver hoy y en los próximos días.</> },
    { k: 'mant-equipos', t: <>En <b>Equipos</b> tenés la ficha de cada equipo con su estado, sus planes preventivos y todo el historial de arreglos y controles.</> },
    { k: 'mant-falla', t: <>Si algo se rompe o no anda bien, cualquiera del equipo puede tocar <b>⚠ Reportar falla</b>: abre una orden correctiva y le avisa al jefe de cocina y al dueño.</> },
    { k: 'mant-registros', t: <>En <b>Registros</b> anotás los controles rápidos del día a día: temperatura de heladeras, limpieza y filtrado o cambio de aceite de las freidoras (también los podés cargar con un toque desde la tarjeta del equipo).</> },
  ], `${clave}:${!!ctx}:${cargado}:${equipos.length}:${vista}`);
  const recMant = useRecorrido('mantenimiento', pasosMant.length,
    !!bid && !!ctx && cargado && !errorCtx && !orden && !equipo && !falla && !nuevaOrden && pasosMant.length > 0,
    { sinDatos: cargado && !equipos.length });
  const pasoMant = pasosMant[recMant.paso - 1];
  const guiaMant = recMant.visible && pasoMant ? (
    <SpotlightTour key={pasoMant.k} targetRef={pasoMant.ref} pose={recMant.paso === 1 ? 'presenta' : 'senala'}
      placement="bottom" text={pasoMant.t} {...recMant.props(recMant.paso)} />
  ) : null;

  if (errorCtx) return <div style={{ padding: 24 }}><Vacio emoji="🔒" titulo="Mantenimiento">{errorCtx}</Vacio></div>;
  if (!ctx) return <div style={{ padding: 24, fontFamily: FB, color: T.text3 }}>Cargando…</div>;

  const lista = (l) => (
    <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
      {l.map((o) => <TarjetaOrden key={o.id} o={o} hoy={hoy} onAbrir={setOrden} />)}
    </div>
  );
  const abiertas = grupos.fallas.length + grupos.vencidas.length + grupos.hoy.length;

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: cel ? '10px 10px 40px' : '16px 20px 48px', boxSizing: 'border-box', fontFamily: FB }}>
      {guiaMant}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: FT, fontWeight: 800, fontSize: cel ? 19 : 22, color: T.ink, marginRight: 6 }}>Mantenimiento</div>
        <div style={{ flex: 1 }} />
        <span data-tour="mant-falla" style={{ display: 'inline-flex' }}><Boton peligro onClick={() => setFalla({})}>⚠ Reportar falla</Boton></span>
        {ctx.planifica && <Boton onClick={() => setNuevaOrden({})}>+ Orden</Boton>}
        {ctx.planifica && <span data-tour="mant-equipo" style={{ display: 'inline-flex' }}><Boton primario onClick={() => setEquipo({ nuevo: true })}>+ Equipo</Boton></span>}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        {[['agenda', ctx.planifica ? 'Agenda' : 'Mis órdenes'], ['equipos', 'Equipos'], ['registros', 'Registros']].map(([k, l]) => (
          <span key={k} data-tour={`mant-${k}`} style={{ display: 'inline-flex', flexShrink: 0 }}>
            <Boton activo={vista === k} onClick={() => setVista(k)} style={{ flexShrink: 0 }}>
              {l}{k === 'agenda' && abiertas > 0 && vista !== 'agenda' && <Pastilla style={{ marginLeft: 4 }}>{abiertas}</Pastilla>}
            </Boton>
          </span>
        ))}
      </div>

      <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 16, padding: cel ? 10 : 14, boxShadow: T.sombraSuave }}>
        {vista === 'agenda' && (
          !equipos.length ? (
            <MantenimientoEjemplo vista="agenda" cel={cel} planifica={ctx.planifica} hoy={hoy} onNuevoEquipo={() => setEquipo({ nuevo: true })} />
          ) : !ordenes.length ? <Vacio emoji="✅" titulo="Nada pendiente">No hay mantenimientos para las próximas dos semanas.</Vacio> : (
            <>
              <Seccion titulo="🔴 Fallas abiertas" color={T.bad} cuenta={grupos.fallas.length}>{lista(grupos.fallas)}</Seccion>
              <Seccion titulo="Vencidas" color={T.warn} cuenta={grupos.vencidas.length}>{lista(grupos.vencidas)}</Seccion>
              <Seccion titulo="Hoy" cuenta={grupos.hoy.length}>{lista(grupos.hoy)}</Seccion>
              <Seccion titulo="Próximos días" cuenta={grupos.proximas.length}>{lista(grupos.proximas)}</Seccion>
              <Seccion titulo="Hechas (últimos 14 días)" color={T.ok} cuenta={grupos.hechas.length}>{lista(grupos.hechas)}</Seccion>
            </>
          )
        )}

        {vista === 'equipos' && (
          !equipos.length ? (
            <MantenimientoEjemplo vista="equipos" cel={cel} planifica={ctx.planifica} hoy={hoy} onNuevoEquipo={() => setEquipo({ nuevo: true })} />
          ) : (
            <div style={{ minWidth: 0 }}>
              {conFiltroEquipos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Entrada
                      value={qEquipo}
                      onChange={(e) => setQEquipo(e.target.value)}
                      placeholder="Buscar por nombre, marca o ubicación…"
                      style={{ maxWidth: cel ? '100%' : 320, flex: cel ? '1 1 100%' : '0 1 320px' }}
                    />
                    {(qEquipo || rubroFiltro || estadoFiltro) && (
                      <Texto sutil style={{ fontSize: 12 }}>
                        {equiposVisibles.length} de {equipos.length}
                      </Texto>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%', paddingBottom: 4 }}>
                    <Boton chico activo={!rubroFiltro} onClick={() => setRubroFiltro('')} style={{ flexShrink: 0 }}>Todos los rubros</Boton>
                    {Object.entries(RUBRO).map(([k, r]) => (
                      <Boton key={k} chico activo={rubroFiltro === k} onClick={() => setRubroFiltro((prev) => (prev === k ? '' : k))} style={{ flexShrink: 0 }}>
                        {r.emoji} {r.label}
                      </Boton>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%', paddingBottom: 4 }}>
                    <Boton chico activo={!estadoFiltro} onClick={() => setEstadoFiltro('')} style={{ flexShrink: 0 }}>Todos los estados</Boton>
                    {ESTADOS_FILTRO.map(([k, label]) => (
                      <Boton key={k} chico activo={estadoFiltro === k} onClick={() => setEstadoFiltro((prev) => (prev === k ? '' : k))} style={{ flexShrink: 0 }}>
                        {label}
                      </Boton>
                    ))}
                  </div>
                </div>
              )}
              {!equiposVisibles.length ? (
                <Texto sutil style={{ padding: '18px 4px', textAlign: 'center' }}>Ningún equipo coincide con el filtro.</Texto>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {equiposVisibles.map((e) => {
                    const est = ESTADO_EQUIPO[e.estado] || ESTADO_EQUIPO.activo;
                    const abreFicha = !!ctx.planifica;
                    return (
                      <div key={e.id} onClick={abreFicha ? () => setEquipo({ id: e.id }) : undefined} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, cursor: abreFicha ? 'pointer' : 'default',
                        boxShadow: T.sombraSuave, opacity: e.estado === 'baja' ? 0.55 : 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 24 }}>{RUBRO[e.rubro]?.emoji || '🔧'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text }}>{e.nombre}</div>
                            <div style={{ fontSize: 12, color: T.text3 }}>{[e.marca, e.modelo].filter(Boolean).join(' ') || RUBRO[e.rubro]?.label}{e.ubicacion ? ` · ${e.ubicacion}` : ''}</div>
                          </div>
                          <Pastilla color={est.color} fondo={est.fondo}>{est.label}</Pastilla>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: T.text2 }}>
                          {e.fallas > 0 && <Pastilla color={T.bad} fondo="#FBE9E9">{e.fallas} falla{e.fallas > 1 ? 's' : ''}</Pastilla>}
                          <span>{e.planes ? `${e.planes} mantenimiento${e.planes > 1 ? 's' : ''}` : 'Sin mantenimientos'}</span>
                          {e.proxima && <span>· próximo {diaLargo(e.proxima)}</span>}
                        </div>
                        {e.estado !== 'baja' && (
                          <div style={{ marginTop: 8 }} onClick={(x) => x.stopPropagation()}>
                            <RegistroRapido businessId={bid} equipo={e} onListo={cargarTodo} onFalla={() => setFalla({ equipoId: e.id })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {vista === 'registros' && <Registros businessId={bid} equipos={equipos} registros={registros} setRegistros={setRegistros} ctx={ctx} cel={cel} />}
      </div>

      <OrdenModal businessId={bid} orden={orden} abierto={!!orden} onCerrar={() => setOrden(null)} onCambio={cargarTodo} ctx={ctx} cel={cel} />
      <FallaModal businessId={bid} abierto={!!falla} equipoInicial={falla?.equipoId} equipos={equipos} onCerrar={() => setFalla(null)} onListo={cargarTodo} cel={cel} />
      <NuevaOrdenModal businessId={bid} abierto={!!nuevaOrden} equipoInicial={nuevaOrden?.equipoId} equipos={equipos} ctx={ctx} onCerrar={() => setNuevaOrden(null)} onListo={cargarTodo} cel={cel} />
      <EquipoModal businessId={bid} equipoId={equipo?.id} abierto={!!equipo} onCerrar={() => setEquipo(null)} onCambio={cargarTodo} ctx={ctx} cel={cel}
        onFalla={(id) => setFalla({ equipoId: id })}
        onOrden={(id, o) => (o ? setOrden(o) : setNuevaOrden({ equipoId: id }))} />
    </div>
  );
}

const EJEMPLO_EQUIPOS = [
  { id: 'ej-e1', nombre: 'Heladera mostrador 3 puertas', rubro: 'heladera', marca: 'Briket', ubicacion: 'Cocina', estado: 'activo', planes: 2, fallas: 0, textoProxima: 'próximo lun 1/12' },
  { id: 'ej-e2', nombre: 'Freidora doble 30 L', rubro: 'freidora', marca: 'Sol Real', ubicacion: 'Línea caliente', estado: 'activo', planes: 1, fallas: 0, textoProxima: 'próximo jue 27/11' },
  { id: 'ej-e3', nombre: 'Horno convector', rubro: 'horno', marca: 'Pauna', ubicacion: 'Pastelería', estado: 'en_reparacion', planes: 1, fallas: 1, textoProxima: null },
];

/** Vista previa de EJEMPLO cuando el negocio todavía no tiene equipos cargados (no se guarda). */
function MantenimientoEjemplo({ vista, cel, planifica, hoy, onNuevoEquipo }) {
  const ordenesEj = [
    { id: 'ej-o1', titulo: 'No corta el termostato', equipo: 'Horno convector', ubicacion: 'Pastelería', rubro: 'horno', tipo: 'correctivo', estado: 'pendiente', urgente: true, fecha: hoy, responsable: 'Service técnico' },
    { id: 'ej-o2', titulo: 'Limpieza de radiador y burletes', equipo: 'Heladera mostrador 3 puertas', ubicacion: 'Cocina', rubro: 'heladera', tipo: 'preventivo', frecuencia: 'Cada mes', estado: 'pendiente', fecha: hoy, responsable: 'Juan Pérez' },
    { id: 'ej-o3', titulo: 'Cambio de aceite y limpieza profunda', equipo: 'Freidora doble 30 L', ubicacion: 'Línea caliente', rubro: 'freidora', tipo: 'preventivo', frecuencia: 'Cada semana', estado: 'pendiente', fecha: hoy, responsable: 'Ana López' },
  ];
  return (
    <div>
      <div aria-hidden style={{ opacity: 0.38, pointerEvents: 'none', userSelect: 'none' }}>
        {vista === 'agenda' ? (
          <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
            {ordenesEj.map((o) => <TarjetaOrden key={o.id} o={o} hoy={hoy} onAbrir={() => {}} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {EJEMPLO_EQUIPOS.map((e) => {
              const est = ESTADO_EQUIPO[e.estado] || ESTADO_EQUIPO.activo;
              return (
                <div key={e.id} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, boxShadow: T.sombraSuave }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24 }}>{RUBRO[e.rubro]?.emoji || '🔧'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text }}>{e.nombre}</div>
                      <div style={{ fontSize: 12, color: T.text3 }}>{e.marca} · {e.ubicacion}</div>
                    </div>
                    <Pastilla color={est.color} fondo={est.fondo}>{est.label}</Pastilla>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: T.text2 }}>
                    {e.fallas > 0 && <Pastilla color={T.bad} fondo="#FBE9E9">{e.fallas} falla</Pastilla>}
                    <span>{e.planes} mantenimiento{e.planes > 1 ? 's' : ''}</span>
                    {e.textoProxima && <span>· {e.textoProxima}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 12px 8px' }}>
        <div style={{ width: 460, maxWidth: '100%', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 22, textAlign: 'center', boxSizing: 'border-box' }}>
          <span style={{ display: 'inline-block', fontFamily: FB, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '2px 8px', marginBottom: 10 }}>ARRIBA, UN EJEMPLO</span>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 6 }}>
            {planifica ? 'Cargá tu primer equipo' : 'Todavía no hay equipos'}
          </div>
          <div style={{ fontFamily: FB, fontSize: 13, color: T.text2, marginBottom: planifica ? 16 : 0 }}>
            {planifica
              ? <>Cargá tus equipos (heladeras, freidoras, hornos…) con <b>+ Equipo</b> y armales los mantenimientos que se repiten.</>
              : 'Cuando el jefe cargue los equipos del local, acá vas a ver lo que te toca y los controles del día.'}
          </div>
          {planifica && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Boton primario onClick={onNuevoEquipo}>+ Equipo</Boton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Un toque desde la tarjeta del equipo: «Filtré», «Limpié», «4 °C», «Estado / observación» (con foto opcional). */
function RegistroRapido({ businessId, equipo, onListo, onFalla }) {
  const [tipo, setTipo] = useState(null);
  const [valor, setValor] = useState('');
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState('');
  const tipos = (TIPOS_POR_RUBRO[equipo.rubro] || TIPOS_POR_RUBRO.otro).filter(([k]) => k !== 'otro');
  const conValor = tipo === 'temperatura' || String(tipo || '').startsWith('aceite_');
  const esEstado = tipo === 'estado';
  const subirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(''); setSubiendo(true);
    try { const r = await MantenimientoAPI.subirFoto(businessId, file); setFoto({ url: r.url, public_id: r.public_id }); }
    catch (err) { setMsg(textoError(err)); }
    finally { setSubiendo(false); }
  };
  const guardar = async (t, v, n = null, f = null) => {
    setMsg('');
    try {
      await MantenimientoAPI.crearRegistro(businessId, {
        equipo_id: equipo.id, tipo: t, valor: v, nota: n,
        foto_url: f?.url || null, foto_public_id: f?.public_id || null,
      });
      setTipo(null); setValor(''); setNota(''); setFoto(null); setMsg('✓'); onListo?.(); setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(textoError(e)); }
  };
  if (tipo && conValor) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Entrada autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === 'temperatura' ? '°C' : 'Litros'} style={{ width: 90, minHeight: 34, padding: '5px 8px' }} />
        <Boton chico primario deshabilitado={valor === ''} onClick={() => guardar(tipo, Number(valor.replace(',', '.')))}>OK</Boton>
        <Boton chico onClick={() => setTipo(null)}>✕</Boton>
      </div>
    );
  }
  if (esEstado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: T.head, border: `1px solid ${T.border}`, borderRadius: 10, padding: 8 }}>
        <Entrada autoFocus value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: no enfría bien, hace ruido, quedó limpia y apagada…" style={{ minHeight: 36 }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={subirFoto} style={{ display: 'none' }} />
            <span style={{ fontFamily: FB, fontSize: 12, fontWeight: 600, color: T.ink, background: '#fff', border: `1px solid ${T.border2}`, borderRadius: 8, padding: '5px 9px' }}>
              {subiendo ? 'Subiendo…' : foto ? '📷 Foto ✓' : '📷 Foto'}
            </span>
          </label>
          {foto && <Boton chico peligro onClick={() => setFoto(null)}>✕</Boton>}
          <span style={{ flex: 1 }} />
          <Boton chico onClick={() => { setTipo(null); setNota(''); setFoto(null); }}>Cancelar</Boton>
          <Boton chico primario deshabilitado={subiendo || (!nota.trim() && !foto)} onClick={() => guardar('estado', null, nota.trim(), foto)}>Guardar</Boton>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {tipos.map(([k, l]) => (
        <Boton key={k} chico onClick={() => (k === 'temperatura' || k.startsWith('aceite_') || k === 'estado' ? setTipo(k) : guardar(k, null))}>
          {k === 'estado' ? '📌 Estado' : l}
        </Boton>
      ))}
      {onFalla && <Boton chico peligro onClick={onFalla}>⚠ Falla</Boton>}
      {msg && <span style={{ fontSize: 12, color: msg === '✓' ? T.ok : T.bad }}>{msg}</span>}
    </div>
  );
}

function Registros({ businessId, equipos, registros, setRegistros, ctx, cel }) {
  const [equipoId, setEquipoId] = useState('');
  const [tipo, setTipo] = useState('');
  const [valor, setValor] = useState('');
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState('');
  const eq = equipos.find((e) => String(e.id) === equipoId);
  const tipos = TIPOS_POR_RUBRO[eq?.rubro] || TIPOS_POR_RUBRO.otro;
  const conValor = tipo === 'temperatura' || tipo.startsWith('aceite_');
  const esEstado = tipo === 'estado';
  const subirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setSubiendoFoto(true);
    try { const r = await MantenimientoAPI.subirFoto(businessId, file); setFoto({ url: r.url, public_id: r.public_id }); }
    catch (err) { setError(textoError(err)); }
    finally { setSubiendoFoto(false); }
  };
  const guardar = async () => {
    setError('');
    try {
      const r = await MantenimientoAPI.crearRegistro(businessId, {
        equipo_id: Number(equipoId), tipo,
        valor: valor === '' ? null : Number(valor.replace(',', '.')),
        nota, foto_url: foto?.url || null, foto_public_id: foto?.public_id || null,
      });
      setRegistros(r.registros || []); setValor(''); setNota(''); setFoto(null);
    } catch (e) { setError(textoError(e)); }
  };
  const borrar = async (id) => {
    if (!window.confirm('¿Borrar este registro?')) return;
    try { const r = await MantenimientoAPI.borrarRegistro(businessId, id); setRegistros(r.registros || []); } catch (e) { setError(textoError(e)); }
  };
  const exportarExcel = () => {
    if (!registros.length) return;
    try {
      const filas = registros.map((r) => ({
        'Fecha y hora': fechaHora(r.created_at),
        Equipo: r.equipo || '',
        Tipo: r.tipo_label || r.tipo || '',
        Valor: r.valor != null ? `${r.valor}${r.unidad ? ` ${r.unidad}` : ''}` : '',
        Persona: r.usuario || '',
        Nota: r.nota || '',
      }));
      const hoja = XLSX.utils.json_to_sheet(filas);
      hoja['!cols'] = Object.keys(filas[0]).map((k) => ({
        wch: Math.max(12, k.length + 2, ...filas.slice(0, 200).map((x) => String(x[k] ?? '').length + 1)),
      }));
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
      XLSX.writeFile(libro, `mantenimiento-registros-${isoHoy()}.xlsx`);
    } catch {
      setError('No pude armar el Excel. Probá de nuevo.');
    }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'minmax(280px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Campo label="Equipo"><Selector value={equipoId} onChange={(v) => { setEquipoId(v); setTipo(''); }} vacio="Elegí el equipo"
          opciones={equipos.filter((e) => e.estado !== 'baja').map((e) => ({ value: String(e.id), label: `${RUBRO[e.rubro]?.emoji || ''} ${e.nombre}` }))} /></Campo>
        {eq && (
          <Campo label="Qué hiciste">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{tipos.map(([k, l]) => <Boton key={k} chico activo={tipo === k} onClick={() => setTipo(k)}>{l}</Boton>)}</div>
          </Campo>
        )}
        {conValor && <Campo label={tipo === 'temperatura' ? 'Temperatura (°C)' : 'Litros'}><Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>}
        {tipo && (
          <Campo label={esEstado ? 'Estado / observación' : 'Nota (opcional)'}>
            <Entrada value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder={esEstado ? 'Ej.: no enfría bien, hace ruido, quedó limpia y apagada…' : ''} />
          </Campo>
        )}
        {tipo && (
          <Campo label="Foto (opcional)" ayuda="JPG, PNG o WEBP · hasta 8 MB">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={subirFoto} style={{ display: 'none' }} />
                <span style={{ fontFamily: FB, fontSize: 12.5, fontWeight: 600, color: T.ink, background: '#fff', border: `1px solid ${T.border2}`, borderRadius: 9, padding: '6px 10px' }}>
                  📷 Sacar foto
                </span>
              </label>
              <label style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={subirFoto} style={{ display: 'none' }} />
                <span style={{ fontFamily: FB, fontSize: 12.5, fontWeight: 600, color: T.ink, background: '#fff', border: `1px solid ${T.border2}`, borderRadius: 9, padding: '6px 10px' }}>
                  🖼 Elegir imagen
                </span>
              </label>
              {subiendoFoto && <Texto sutil>Subiendo…</Texto>}
            </div>
            {foto?.url && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: 6 }}>
                <img src={foto.url} alt="Vista previa" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
                <span style={{ flex: 1, fontSize: 12, color: T.ok, fontWeight: 600 }}>Foto cargada ✓</span>
                <Boton chico peligro onClick={() => setFoto(null)}>✕</Boton>
              </div>
            )}
          </Campo>
        )}
        {error && <div style={{ color: T.bad, fontSize: 13 }}>{error}</div>}
        <Boton primario deshabilitado={!equipoId || !tipo || subiendoFoto || (conValor && valor === '') || (esEstado && !nota.trim() && !foto)} onClick={guardar}>Registrar</Boton>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text }}>{ctx.planifica ? 'Últimos 30 días' : 'Cargados por vos hoy'}</div>
          {ctx.planifica && (
            <Boton chico deshabilitado={!registros.length} title="Bajar a Excel los registros que se ven en pantalla" onClick={exportarExcel}>
              Exportar a Excel ({registros.length.toLocaleString('es-AR')})
            </Boton>
          )}
        </div>
        {!registros.length ? <Texto sutil>{ctx.planifica ? 'No hay registros todavía.' : 'Hoy todavía no cargaste registros.'}</Texto> : registros.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, fontSize: 13.5 }}>
              <b style={{ color: T.text }}>{r.equipo}</b> · {r.tipo_label}{r.valor != null ? <b style={{ color: T.ink }}> {r.valor} {r.unidad}</b> : ''}
              {r.nota && <div style={{ fontSize: 12, color: T.text3 }}>{r.nota}</div>}
              {r.foto_url && (
                <a href={r.foto_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 4 }}>
                  <img src={r.foto_url} alt={r.tipo_label} style={{ maxHeight: 72, borderRadius: 8, border: `1px solid ${T.border}`, display: 'block' }} />
                </a>
              )}
            </div>
            <span style={{ fontSize: 12, color: T.text3 }}>{r.usuario} · {fechaHora(r.created_at)}</span>
            {(ctx.planifica || r.user_id === ctx.uid) && <Boton chico peligro onClick={() => borrar(r.id)}>✕</Boton>}
          </div>
        ))}
      </div>
    </div>
  );
}
