// src/paginas/Mantenimiento.jsx — Operación › Mantenimiento (usuaria 21/11/2026, etapa 3 de Producción).
// Reemplaza Activos / mantenimiento preventivo / órdenes / freidoras / heladeras de la planilla vieja.
//  · Agenda: fallas abiertas, vencidas, hoy, próximos días y lo hecho (las preventivas salen solas de los planes)
//  · Equipos: cada equipo con sus mantenimientos que se repiten y su historial
//  · Registros: lo del día a día (aceite de la freidora, limpieza y temperatura de las heladeras)
// Cualquiera del equipo reporta una falla; jefe / dueño / admin arman equipos y planes.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { setSucursalOperacion } from '@/servicios/apiProduccion';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { MantenimientoAPI } from '@/servicios/apiMantenimiento';
import { Boton, Pastilla, Vacio, Texto, Campo, Entrada, Selector } from '@/componentes/produccion/ui';
import { diaLargo, isoHoy, textoError } from '@/componentes/produccion/util';
import { RUBRO, ESTADO_EQUIPO, TIPOS_POR_RUBRO } from '@/componentes/mantenimiento/datos';
import { TarjetaOrden, OrdenModal, FallaModal, EquipoModal, NuevaOrdenModal } from '@/componentes/mantenimiento/Modales';

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

  useEffect(() => { cargarFuentes(); }, []);
  const cargarTodo = useCallback(async () => {
    if (!bid) return;
    try {
      const [o, e, r] = await Promise.all([MantenimientoAPI.ordenes(bid), MantenimientoAPI.equipos(bid), MantenimientoAPI.registros(bid)]);
      setOrdenes(o.ordenes || []); setHoy(o.hoy || isoHoy()); setEquipos(e.equipos || []); setRegistros(r.registros || []);
    } catch (x) { setErrorCtx(textoError(x)); }
  }, [bid, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bid) return;
    setCtx(null);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontFamily: FT, fontWeight: 800, fontSize: cel ? 19 : 22, color: T.ink, marginRight: 6 }}>Mantenimiento</div>
        <div style={{ flex: 1 }} />
        <Boton peligro onClick={() => setFalla({})}>⚠ Reportar falla</Boton>
        {ctx.planifica && <Boton onClick={() => setNuevaOrden({})}>+ Orden</Boton>}
        {ctx.planifica && <Boton primario onClick={() => setEquipo({ nuevo: true })}>+ Equipo</Boton>}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
        {[['agenda', ctx.planifica ? 'Agenda' : 'Mis órdenes'], ['equipos', 'Equipos'], ['registros', 'Registros']].map(([k, l]) => (
          <Boton key={k} activo={vista === k} onClick={() => setVista(k)} style={{ flexShrink: 0 }}>
            {l}{k === 'agenda' && abiertas > 0 && vista !== 'agenda' && <Pastilla style={{ marginLeft: 4 }}>{abiertas}</Pastilla>}
          </Boton>
        ))}
      </div>

      <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 16, padding: cel ? 10 : 14, boxShadow: T.sombraSuave }}>
        {vista === 'agenda' && (
          !equipos.length ? (
            <Vacio emoji="🧰" titulo="Todavía no hay equipos">
              {ctx.planifica ? <>Cargá tus equipos (heladeras, freidoras, hornos…) con <b>+ Equipo</b> y armales los mantenimientos que se repiten.</> : 'Cuando el jefe cargue los equipos, acá ves lo que te toca.'}
            </Vacio>
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
          !equipos.length ? <Vacio emoji="🧰" titulo="Todavía no hay equipos">{ctx.planifica ? 'Tocá + Equipo para cargar el primero.' : 'Todavía no se cargaron equipos.'}</Vacio> : (
            <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {equipos.map((e) => {
                const est = ESTADO_EQUIPO[e.estado] || ESTADO_EQUIPO.activo;
                return (
                  <div key={e.id} onClick={() => setEquipo({ id: e.id })} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, cursor: 'pointer',
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
                    {(e.rubro === 'freidora' || e.rubro === 'heladera') && e.estado !== 'baja' && (
                      <div style={{ marginTop: 8 }} onClick={(x) => x.stopPropagation()}>
                        <RegistroRapido businessId={bid} equipo={e} onListo={cargarTodo} />
                      </div>
                    )}
                  </div>
                );
              })}
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

/** Un toque desde la tarjeta del equipo: «Filtré», «Limpié», «4 °C». */
function RegistroRapido({ businessId, equipo, onListo }) {
  const [tipo, setTipo] = useState(null);
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');
  const tipos = TIPOS_POR_RUBRO[equipo.rubro] || TIPOS_POR_RUBRO.otro;
  const conValor = tipo === 'temperatura' || String(tipo || '').startsWith('aceite_');
  const guardar = async (t, v) => {
    setMsg('');
    try { await MantenimientoAPI.crearRegistro(businessId, { equipo_id: equipo.id, tipo: t, valor: v }); setTipo(null); setValor(''); setMsg('✓'); onListo?.(); setTimeout(() => setMsg(''), 2000); }
    catch (e) { setMsg(textoError(e)); }
  };
  if (tipo && conValor) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Entrada autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === 'temperatura' ? '°C' : 'Litros'} style={{ width: 90, minHeight: 30, padding: '5px 8px' }} />
        <Boton chico primario deshabilitado={valor === ''} onClick={() => guardar(tipo, Number(valor.replace(',', '.')))}>OK</Boton>
        <Boton chico onClick={() => setTipo(null)}>✕</Boton>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {tipos.map(([k, l]) => <Boton key={k} chico onClick={() => (k === 'temperatura' || k.startsWith('aceite_') ? setTipo(k) : guardar(k, null))}>{l}</Boton>)}
      {msg && <span style={{ fontSize: 12, color: msg === '✓' ? T.ok : T.bad }}>{msg}</span>}
    </div>
  );
}

function Registros({ businessId, equipos, registros, setRegistros, ctx, cel }) {
  const [equipoId, setEquipoId] = useState('');
  const [tipo, setTipo] = useState('');
  const [valor, setValor] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const eq = equipos.find((e) => String(e.id) === equipoId);
  const tipos = TIPOS_POR_RUBRO[eq?.rubro] || TIPOS_POR_RUBRO.otro;
  const conValor = tipo === 'temperatura' || tipo.startsWith('aceite_');
  const guardar = async () => {
    setError('');
    try {
      const r = await MantenimientoAPI.crearRegistro(businessId, { equipo_id: Number(equipoId), tipo, valor: valor === '' ? null : Number(valor.replace(',', '.')), nota });
      setRegistros(r.registros || []); setValor(''); setNota('');
    } catch (e) { setError(textoError(e)); }
  };
  const borrar = async (id) => {
    if (!window.confirm('¿Borrar este registro?')) return;
    try { const r = await MantenimientoAPI.borrarRegistro(businessId, id); setRegistros(r.registros || []); } catch (e) { setError(textoError(e)); }
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
        {tipo && <Campo label="Nota (opcional)"><Entrada value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></Campo>}
        {error && <div style={{ color: T.bad, fontSize: 13 }}>{error}</div>}
        <Boton primario deshabilitado={!equipoId || !tipo || (conValor && valor === '')} onClick={guardar}>Registrar</Boton>
      </div>
      <div>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Últimos 30 días</div>
        {!registros.length ? <Texto sutil>No hay registros todavía.</Texto> : registros.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, fontSize: 13.5 }}>
              <b style={{ color: T.text }}>{r.equipo}</b> · {r.tipo_label}{r.valor != null ? <b style={{ color: T.ink }}> {r.valor} {r.unidad}</b> : ''}
              {r.nota && <div style={{ fontSize: 12, color: T.text3 }}>{r.nota}</div>}
            </div>
            <span style={{ fontSize: 12, color: T.text3 }}>{r.usuario} · {fechaHora(r.created_at)}</span>
            {(ctx.planifica || r.user_id === ctx.uid) && <Boton chico peligro onClick={() => borrar(r.id)}>✕</Boton>}
          </div>
        ))}
      </div>
    </div>
  );
}
