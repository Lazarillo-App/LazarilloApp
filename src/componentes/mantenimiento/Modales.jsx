// src/componentes/mantenimiento/Modales.jsx — equipo (datos, planes, historial), orden y falla.
import { tipearImporte, numeroDeImporte, importeATexto } from '../CampoImporte';
import CampoFecha from '../CampoFecha';
import React, { useCallback, useEffect, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { MantenimientoAPI } from '@/servicios/apiMantenimiento';
import { Modal, Boton, Campo, Entrada, Selector, Pastilla, Texto } from '@/componentes/produccion/ui';
import { diaLargo, isoHoy, textoError } from '@/componentes/produccion/util';
import { RUBRO, ESTADO_EQUIPO } from './datos';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const sxFecha = {
  '& .MuiInputBase-root': { height: 40, fontFamily: FB, fontSize: 14, color: T.text, bgcolor: '#fff', borderRadius: '10px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border2 },
};
const pesos = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const fechaHora = (s) => new Date(s).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Tarjeta de una orden (agenda y equipo). */
export function TarjetaOrden({ o, onAbrir, hoy }) {
  const vencida = o.estado === 'pendiente' && o.fecha < hoy;
  const color = o.estado === 'hecha' ? T.ok : o.tipo === 'correctivo' ? T.bad : vencida ? T.warn : T.accent;
  return (
    <div onClick={() => onAbrir(o)} style={{ background: '#fff', border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`, borderRadius: 10,
      padding: '9px 11px', cursor: 'pointer', fontFamily: FB, boxShadow: T.sombraSuave, opacity: o.estado === 'cancelada' ? 0.5 : 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 16 }}>{RUBRO[o.rubro]?.emoji || '🔧'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: T.text }}>{o.titulo}</div>
          <div style={{ fontSize: 12, color: T.text3 }}>{o.equipo}{o.ubicacion ? ` · ${o.ubicacion}` : ''}</div>
        </div>
        {o.urgente && o.estado === 'pendiente' && <Pastilla color="#fff" fondo={T.bad}>Urgente</Pastilla>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5 }}>
        <Pastilla color={o.tipo === 'correctivo' ? T.bad : T.accentTxt} fondo={o.tipo === 'correctivo' ? '#FBE9E9' : '#E3F4FB'}>{o.tipo === 'correctivo' ? 'Falla' : o.frecuencia || 'Preventivo'}</Pastilla>
        <span style={{ color: vencida ? T.warn : T.text3, fontWeight: vencida ? 700 : 400 }}>
          {o.estado === 'hecha' ? `Hecha ${fechaHora(o.hecha_at)}${o.hizo ? ` · ${o.hizo}` : ''}` : `${vencida ? 'Vencida · ' : ''}${diaLargo(o.fecha)}`}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ color: T.text2 }}>{o.estado === 'pendiente' ? (o.responsable || 'Sin asignar') : ''}</span>
      </div>
    </div>
  );
}

export function OrdenModal({ businessId, orden, abierto, onCerrar, onCambio, ctx, cel }) {
  const [o, setO] = useState(orden);
  const [nota, setNota] = useState('');
  const [costo, setCosto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (abierto) { setO(orden); setNota(''); setCosto(''); setProveedor(''); setFecha(orden?.fecha || ''); setError(''); } }, [abierto, orden]);
  if (!abierto || !o) return null;
  const hacer = async (accion, body) => {
    setError('');
    try { const r = await MantenimientoAPI.accion(businessId, o.id, accion, body); setO(r.orden); onCambio?.(); return true; } catch (e) { setError(textoError(e)); return false; }
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={560}
      titulo={<div><div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>{o.titulo}</div>
        <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text3 }}>{RUBRO[o.rubro]?.emoji} {o.equipo}{o.ubicacion ? ` · ${o.ubicacion}` : ''}</div></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FB }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pastilla color={o.tipo === 'correctivo' ? T.bad : T.accentTxt} fondo={o.tipo === 'correctivo' ? '#FBE9E9' : '#E3F4FB'}>{o.tipo === 'correctivo' ? 'Falla' : `Preventivo${o.frecuencia ? ` · ${o.frecuencia}` : ''}`}</Pastilla>
          {o.urgente && <Pastilla color="#fff" fondo={T.bad}>Urgente</Pastilla>}
          <Pastilla>{o.estado === 'hecha' ? 'Hecha' : o.estado === 'cancelada' ? 'Cancelada' : diaLargo(o.fecha)}</Pastilla>
          <Pastilla>{o.responsable || 'Sin asignar'}</Pastilla>
        </div>
        {o.descripcion && <Texto style={{ whiteSpace: 'pre-wrap' }}>{o.descripcion}</Texto>}
        {o.reporto && o.tipo === 'correctivo' && <Texto sutil>Lo reportó {o.reporto}.</Texto>}
        {error && <div style={{ color: T.bad, fontSize: 13 }}>{error}</div>}

        {o.estado === 'pendiente' && o.puede_hacer && (
          <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Campo label={o.nota_obligatoria ? 'Qué se hizo (obligatorio)' : 'Qué se hizo (opcional)'}>
              <Entrada value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: se cambió el burlete de la puerta" />
            </Campo>
            {ctx?.gestor && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Campo label="Costo (opcional)" style={{ flex: 1 }}><Entrada inputMode="decimal" placeholder="$ 0" value={costo} onChange={(e) => setCosto(tipearImporte(e))} /></Campo>
                <Campo label="Lo hizo (técnico / proveedor)" style={{ flex: 2 }}><Entrada value={proveedor} maxLength={80} onChange={(e) => setProveedor(e.target.value)} /></Campo>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Boton primario deshabilitado={o.nota_obligatoria && !nota.trim()} onClick={async () => {
                if (await hacer('hacer', { nota, costo: costo === '' ? null : numeroDeImporte(costo), proveedor })) onCerrar();
              }} style={{ minHeight: 42 }}>✓ Hecho</Boton>
              <span style={{ flex: 1 }} />
              <Campo label="Pasarlo a" style={{ width: 160 }}><CampoFecha sx={sxFecha} value={fecha} onChange={setFecha} /></Campo>
              <Boton deshabilitado={!fecha || fecha === o.fecha} onClick={() => hacer('reprogramar', { fecha })}>Reprogramar</Boton>
            </div>
          </div>
        )}
        {o.estado === 'hecha' && (
          <div style={{ background: '#E4F6EC', borderRadius: 12, padding: 12, fontSize: 13.5, color: T.text }}>
            ✓ Hecha {fechaHora(o.hecha_at)}{o.hizo ? ` por ${o.hizo}` : ''}.{o.nota ? <div style={{ marginTop: 4, color: T.text2 }}>{o.nota}</div> : null}
            {o.costo != null && <div style={{ marginTop: 4, color: T.text2 }}>Costo {pesos(o.costo)}{o.proveedor ? ` · ${o.proveedor}` : ''}</div>}
          </div>
        )}
        {ctx?.planifica && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            {o.estado === 'pendiente' && (
              <Campo label="Responsable" style={{ minWidth: 200, flex: 1 }}>
                <Selector value={o.responsable_user_id ? String(o.responsable_user_id) : ''} vacio="Sin asignar"
                  opciones={(ctx.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))}
                  onChange={(v) => hacer('asignar', { responsable_user_id: Number(v) || null })} />
              </Campo>
            )}
            {o.estado === 'pendiente' && <Boton chico peligro onClick={() => {
              const m = window.prompt(o.plan_id ? '¿Saltear este mantenimiento? Pasa a la próxima fecha del plan. Motivo (opcional):' : '¿Cancelar la orden? Motivo (opcional):');
              if (m !== null) hacer('cancelar', { nota: m });
            }}>{o.plan_id ? 'Saltear' : 'Cancelar'}</Boton>}
            {o.estado !== 'pendiente' && <Boton chico onClick={() => hacer('reabrir')}>Reabrir</Boton>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function FallaModal({ businessId, abierto, onCerrar, onListo, equipos, equipoInicial, cel }) {
  const [equipo, setEquipo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [noFunciona, setNoFunciona] = useState(false);
  const [urgente, setUrgente] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (abierto) { setEquipo(equipoInicial ? String(equipoInicial) : ''); setTitulo(''); setDesc(''); setNoFunciona(false); setUrgente(false); setError(''); } }, [abierto, equipoInicial]);
  const enviar = async () => {
    try {
      await MantenimientoAPI.reportarFalla(businessId, { equipo_id: Number(equipo), titulo, descripcion: desc, no_funciona: noFunciona, urgente });
      onListo?.(); onCerrar();
    } catch (e) { setError(textoError(e)); }
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={480} titulo="⚠ Reportar una falla"
      pie={<>{error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton><Boton primario deshabilitado={!equipo || !titulo.trim()} onClick={enviar}>Avisar</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Equipo">
          <Selector value={equipo} onChange={setEquipo} vacio="Elegí el equipo" opciones={equipos.filter((e) => e.estado !== 'baja').map((e) => ({ value: String(e.id), label: `${RUBRO[e.rubro]?.emoji || ''} ${e.nombre}${e.ubicacion ? ` · ${e.ubicacion}` : ''}` }))} />
        </Campo>
        <Campo label="Qué le pasa"><Entrada autoFocus value={titulo} maxLength={140} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: no enfría, pierde agua, hace ruido" /></Campo>
        <Campo label="Detalle (opcional)"><Entrada value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} /></Campo>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Boton activo={noFunciona} onClick={() => setNoFunciona((v) => !v)}>{noFunciona ? '✓ ' : ''}No funciona</Boton>
          <Boton activo={urgente} onClick={() => setUrgente((v) => !v)}>{urgente ? '✓ ' : ''}Es urgente</Boton>
        </div>
        <Texto sutil style={{ fontSize: 12 }}>Le llega al jefe de cocina, al dueño y al admin.</Texto>
      </div>
    </Modal>
  );
}

function FormPlan({ plan, ctx, onGuardar, onCancelar }) {
  const [v, setV] = useState(() => ({
    nombre: plan?.nombre || '', descripcion: plan?.descripcion || '', cada_n: String(plan?.cada_n || 1), unidad: plan?.unidad || 'meses',
    dias_semana: plan?.dias_semana || [], responsable_user_id: plan?.responsable_user_id ? String(plan.responsable_user_id) : '',
    nota_obligatoria: !!plan?.nota_obligatoria, proxima: plan?.proxima || isoHoy(), activo: plan?.activo !== false,
  }));
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const toggleDia = (d) => setV((o) => ({ ...o, dias_semana: o.dias_semana.includes(d) ? o.dias_semana.filter((x) => x !== d) : [...o.dias_semana, d] }));
  return (
    <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Campo label="Qué hay que hacer"><Entrada autoFocus value={v.nombre} maxLength={100} onChange={(e) => set('nombre')(e.target.value)} placeholder="Ej.: Limpieza de radiador" /></Campo>
      <Campo label="Cómo (opcional)"><Entrada value={v.descripcion} maxLength={1000} onChange={(e) => set('descripcion')(e.target.value)} /></Campo>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Campo label="Cada" style={{ width: 80 }}><Entrada inputMode="numeric" value={v.cada_n} onChange={(e) => set('cada_n')(e.target.value.replace(/[^\d]/g, ''))} /></Campo>
        <Campo label=" " style={{ width: 130 }}><Selector value={v.unidad} onChange={set('unidad')} opciones={[{ value: 'dias', label: 'días' }, { value: 'semanas', label: 'semanas' }, { value: 'meses', label: 'meses' }]} /></Campo>
        <Campo label={plan ? 'Próxima vez' : 'Primera vez'} style={{ width: 160 }}><CampoFecha sx={sxFecha} value={v.proxima} onChange={set('proxima')} /></Campo>
      </div>
      <Campo label="Días en que se puede hacer" ayuda={v.dias_semana.length ? 'Si la fecha cae otro día, pasa al siguiente permitido.' : 'Cualquier día.'}>
        <div style={{ display: 'flex', gap: 4 }}>{DIAS.map(([d, l]) => <Boton key={d} chico activo={v.dias_semana.includes(d)} onClick={() => toggleDia(d)} style={{ minWidth: 34 }}>{l}</Boton>)}</div>
      </Campo>
      <Campo label="Responsable">
        <Selector value={v.responsable_user_id} onChange={set('responsable_user_id')} vacio="El del equipo" opciones={(ctx?.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))} />
      </Campo>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: FB, fontSize: 13, color: T.text2 }}>
        <input type="checkbox" checked={v.nota_obligatoria} onChange={(e) => set('nota_obligatoria')(e.target.checked)} /> Pedir nota al marcarlo hecho
      </label>
      {plan && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: FB, fontSize: 13, color: T.text2 }}>
          <input type="checkbox" checked={v.activo} onChange={(e) => set('activo')(e.target.checked)} /> Activo
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={onCancelar}>Cancelar</Boton>
        <Boton primario deshabilitado={!v.nombre.trim()} onClick={() => onGuardar({ ...v, id: plan?.id, cada_n: Number(v.cada_n) || 1, responsable_user_id: Number(v.responsable_user_id) || null })}>Guardar</Boton>
      </div>
    </div>
  );
}

export function EquipoModal({ businessId, equipoId, abierto, onCerrar, onCambio, ctx, cel, onFalla, onOrden }) {
  const [d, setD] = useState(null);
  const [solapa, setSolapa] = useState('mant');
  const [v, setV] = useState(null);
  const [planEdit, setPlanEdit] = useState(null);
  const [error, setError] = useState('');
  const nuevo = !equipoId;
  const cargar = useCallback(async () => {
    if (!equipoId) return;
    try { const r = await MantenimientoAPI.equipo(businessId, equipoId); setD(r); setV({ ...r.equipo }); } catch (e) { setError(textoError(e)); }
  }, [businessId, equipoId]);
  useEffect(() => {
    if (!abierto) return;
    setError(''); setPlanEdit(null);
    if (nuevo) { setD(null); setV({ nombre: '', rubro: 'heladera', estado: 'activo' }); setSolapa('datos'); } else { setSolapa('mant'); cargar(); }
  }, [abierto, nuevo, cargar]);
  if (!abierto || !v) return null;
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const puede = !!ctx?.planifica;
  const guardar = async () => {
    setError('');
    try {
      const r = await MantenimientoAPI.guardarEquipo(businessId, { ...v, precio: v.precio === '' || v.precio == null ? null : (typeof v.precio === 'number' ? v.precio : numeroDeImporte(v.precio)) });
      setD(r); setV({ ...r.equipo }); onCambio?.();
      if (nuevo) setSolapa('mant');
    } catch (e) { setError(textoError(e)); }
  };
  const guardarPlan = async (p) => {
    try { const r = await MantenimientoAPI.guardarPlan(businessId, d.equipo.id, p); setD(r); setPlanEdit(null); onCambio?.(); } catch (e) { setError(textoError(e)); }
  };
  const e = d?.equipo;
  const est = ESTADO_EQUIPO[v.estado] || ESTADO_EQUIPO.activo;
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={720}
      titulo={nuevo ? 'Nuevo equipo' : <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>{RUBRO[v.rubro]?.emoji} {e?.nombre}</span>
        <Pastilla color={est.color} fondo={est.fondo}>{est.label}</Pastilla></div>}>
      {error && <div style={{ color: T.bad, fontFamily: FB, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {!nuevo && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <Boton activo={solapa === 'mant'} onClick={() => setSolapa('mant')}>Mantenimientos</Boton>
          <Boton activo={solapa === 'hist'} onClick={() => setSolapa('hist')}>Historial</Boton>
          <Boton activo={solapa === 'datos'} onClick={() => setSolapa('datos')}>Datos</Boton>
          <span style={{ flex: 1 }} />
          <Boton chico peligro onClick={() => onFalla(e.id)}>⚠ Reportar falla</Boton>
        </div>
      )}

      {solapa === 'datos' && (
        <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : '1fr 1fr', gap: 10 }}>
          <Campo label="Nombre"><Entrada disabled={!puede} value={v.nombre || ''} maxLength={100} onChange={(x) => set('nombre')(x.target.value)} placeholder="Ej.: Heladera 3 puertas" /></Campo>
          <Campo label="Tipo"><Selector value={v.rubro} onChange={set('rubro')} opciones={Object.entries(RUBRO).map(([k, r]) => ({ value: k, label: `${r.emoji} ${r.label}` }))} /></Campo>
          <Campo label="Marca"><Entrada disabled={!puede} value={v.marca || ''} onChange={(x) => set('marca')(x.target.value)} /></Campo>
          <Campo label="Modelo"><Entrada disabled={!puede} value={v.modelo || ''} onChange={(x) => set('modelo')(x.target.value)} /></Campo>
          <Campo label="Dónde está"><Entrada disabled={!puede} value={v.ubicacion || ''} onChange={(x) => set('ubicacion')(x.target.value)} placeholder="Ej.: Cocina, al lado de la bacha" /></Campo>
          <Campo label="Área"><Selector value={v.sector_id ? String(v.sector_id) : ''} onChange={(x) => set('sector_id')(Number(x) || null)} vacio="—" opciones={(ctx?.sectores || []).map((s) => ({ value: String(s.id), label: s.nombre }))} /></Campo>
          <Campo label="Responsable"><Selector value={v.responsable_user_id ? String(v.responsable_user_id) : ''} onChange={(x) => set('responsable_user_id')(Number(x) || null)} vacio="—" opciones={(ctx?.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))} /></Campo>
          <Campo label="Proveedor / service"><Entrada disabled={!puede} value={v.proveedor || ''} onChange={(x) => set('proveedor')(x.target.value)} /></Campo>
          <Campo label="Código interno"><Entrada disabled={!puede} value={v.codigo || ''} onChange={(x) => set('codigo')(x.target.value)} /></Campo>
          <Campo label="Estado"><Selector value={v.estado} onChange={set('estado')} opciones={Object.entries(ESTADO_EQUIPO).map(([k, s]) => ({ value: k, label: s.label }))} /></Campo>
          <Campo label="Fecha de compra"><CampoFecha sx={sxFecha} disabled={!puede} value={v.fecha_compra || ''} onChange={set('fecha_compra')} /></Campo>
          <Campo label="Instalación"><CampoFecha sx={sxFecha} disabled={!puede} value={v.fecha_instalacion || ''} onChange={set('fecha_instalacion')} /></Campo>
          {ctx?.gestor && <Campo label="Precio de compra"><Entrada inputMode="decimal" placeholder="$ 0" value={typeof v.precio === 'number' ? importeATexto(v.precio) : (v.precio ?? '')} onChange={(x) => set('precio')(tipearImporte(x))} /></Campo>}
          <Campo label="Notas" style={{ gridColumn: '1 / -1' }}><Entrada disabled={!puede} value={v.notas || ''} onChange={(x) => set('notas')(x.target.value)} /></Campo>
          {puede && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {!nuevo && <Boton peligro onClick={async () => {
                if (!window.confirm('¿Borrar el equipo con sus planes? Si solo se dejó de usar, mejor ponelo «De baja».')) return;
                try { await MantenimientoAPI.borrarEquipo(businessId, e.id); onCambio?.(); onCerrar(); } catch (x) { setError(textoError(x)); }
              }}>Borrar</Boton>}
              <Boton primario deshabilitado={!v.nombre?.trim()} onClick={guardar}>{nuevo ? 'Crear equipo' : 'Guardar'}</Boton>
            </div>
          )}
        </div>
      )}

      {solapa === 'mant' && d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Texto sutil>Los mantenimientos que se repiten. La orden aparece sola en la agenda cuando falta una semana o menos.</Texto>
          {d.planes.map((p) => (planEdit === p.id ? <FormPlan key={p.id} plan={p} ctx={ctx} onGuardar={guardarPlan} onCancelar={() => setPlanEdit(null)} /> : (
            <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: FB, flexWrap: 'wrap', opacity: p.activo ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: T.text }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: T.text3 }}>{p.frecuencia} · próxima {diaLargo(p.proxima)}{p.ultima ? ` · última ${diaLargo(p.ultima)}` : ''}{p.responsable ? ` · ${p.responsable}` : ''}</div>
              </div>
              {!p.activo && <Pastilla>Pausado</Pastilla>}
              {puede && <Boton chico onClick={() => setPlanEdit(p.id)}>✎</Boton>}
              {puede && <Boton chico peligro onClick={async () => {
                if (!window.confirm(`¿Borrar «${p.nombre}»?`)) return;
                try { setD(await MantenimientoAPI.borrarPlan(businessId, e.id, p.id)); onCambio?.(); } catch (x) { setError(textoError(x)); }
              }}>✕</Boton>}
            </div>
          )))}
          {!d.planes.length && planEdit !== 'nuevo' && <Texto sutil>Todavía no tiene mantenimientos preventivos.</Texto>}
          {puede && (planEdit === 'nuevo'
            ? <FormPlan ctx={ctx} onGuardar={guardarPlan} onCancelar={() => setPlanEdit(null)} />
            : <div style={{ display: 'flex', gap: 8 }}><Boton chico onClick={() => setPlanEdit('nuevo')}>+ Mantenimiento que se repite</Boton><Boton chico onClick={() => onOrden(e.id)}>+ Orden suelta</Boton></div>)}
          {d.ordenes.filter((o) => o.estado === 'pendiente').length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 6 }}>Pendientes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.ordenes.filter((o) => o.estado === 'pendiente').map((o) => <TarjetaOrden key={o.id} o={o} hoy={isoHoy()} onAbrir={() => onOrden(e.id, o)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {solapa === 'hist' && d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...d.ordenes.filter((o) => o.estado !== 'pendiente').map((o) => ({ k: `o${o.id}`, t: o.hecha_at || o.fecha, o })),
            ...d.registros.map((r) => ({ k: `r${r.id}`, t: r.created_at, r }))]
            .sort((a, b) => String(b.t).localeCompare(String(a.t)))
            .map((x) => (x.o ? <TarjetaOrden key={x.k} o={x.o} hoy={isoHoy()} onAbrir={() => onOrden(e.id, x.o)} /> : (
              <div key={x.k} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${T.border}`, fontFamily: FB, fontSize: 13 }}>
                <span style={{ flex: 1, color: T.text }}><b>{x.r.tipo_label}</b>{x.r.valor != null ? ` · ${x.r.valor} ${x.r.unidad || ''}` : ''}{x.r.nota ? ` · ${x.r.nota}` : ''}</span>
                <span style={{ color: T.text3, fontSize: 12 }}>{x.r.usuario} · {fechaHora(x.r.created_at)}</span>
              </div>
            )))}
          {!d.ordenes.some((o) => o.estado !== 'pendiente') && !d.registros.length && <Texto sutil>Sin historial todavía.</Texto>}
        </div>
      )}
    </Modal>
  );
}

export function NuevaOrdenModal({ businessId, abierto, onCerrar, onListo, equipos, equipoInicial, ctx, cel }) {
  const [v, setV] = useState({});
  const [error, setError] = useState('');
  useEffect(() => { if (abierto) { setV({ equipo_id: equipoInicial ? String(equipoInicial) : '', titulo: '', descripcion: '', fecha: isoHoy(), responsable_user_id: '', tipo: 'preventivo' }); setError(''); } }, [abierto, equipoInicial]);
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const guardar = async () => {
    try { await MantenimientoAPI.crearOrden(businessId, { ...v, equipo_id: Number(v.equipo_id), responsable_user_id: Number(v.responsable_user_id) || null }); onListo?.(); onCerrar(); }
    catch (e) { setError(textoError(e)); }
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={500} titulo="Nueva orden de mantenimiento"
      pie={<>{error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton><Boton primario deshabilitado={!v.equipo_id || !v.titulo?.trim()} onClick={guardar}>Crear</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Equipo"><Selector value={v.equipo_id} onChange={set('equipo_id')} vacio="Elegí el equipo" opciones={equipos.filter((e) => e.estado !== 'baja').map((e) => ({ value: String(e.id), label: `${RUBRO[e.rubro]?.emoji || ''} ${e.nombre}` }))} /></Campo>
        <Campo label="Qué hay que hacer"><Entrada value={v.titulo || ''} maxLength={140} onChange={(e) => set('titulo')(e.target.value)} /></Campo>
        <Campo label="Detalle (opcional)"><Entrada value={v.descripcion || ''} maxLength={1000} onChange={(e) => set('descripcion')(e.target.value)} /></Campo>
        <div style={{ display: 'flex', gap: 8 }}>
          <Campo label="Para el" style={{ flex: 1 }}><CampoFecha sx={sxFecha} value={v.fecha || ''} onChange={set('fecha')} /></Campo>
          <Campo label="Responsable" style={{ flex: 1 }}><Selector value={v.responsable_user_id} onChange={set('responsable_user_id')} vacio="Sin asignar" opciones={(ctx?.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))} /></Campo>
        </div>
      </div>
    </Modal>
  );
}
