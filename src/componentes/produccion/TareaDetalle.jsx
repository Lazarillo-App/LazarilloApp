// src/componentes/produccion/TareaDetalle.jsx
// Una tarea de producción por dentro (lo que usa el cocinero en el celular y el jefe en la PC):
//  · cronómetro: Empezar / Pausar / Retomar / Terminar (con lo que rindió)
//  · ingredientes: la receta escalada a las tandas; se tildan; «Cambió» registra que no había,
//    que se usó otro o en otra cantidad (sigue trabajando, queda pendiente de aprobación)
//  · dueño/admin aprueba o rechaza cada cambio ahí mismo
//  · pasos de la receta y el hilo de observaciones de jefe y cocinero
//  · el jefe edita tandas, día, turno, responsable, plaza y estimado; cancela, reabre o borra
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Modal, Boton, Campo, Entrada, Selector, Pastilla, Texto } from './ui';
import BuscarInsumo from './BuscarInsumo';
import EtiquetasModal from './EtiquetasModal';
import { ESTADOS, fmtTandas, textoTandas, fmtCant, fmtMin, fmtReloj, diaLargo, unidadCorta, textoError, sumarDias, lunesDe } from './util';

function Reloj({ tarea }) {
  const [, setTick] = useState(0);
  const [base] = useState(() => ({ seg: tarea.segundos, at: Date.now() }));
  useEffect(() => {
    if (!tarea.corriendo) return undefined;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [tarea.corriendo]);
  const seg = tarea.corriendo ? base.seg + (Date.now() - base.at) / 1000 : tarea.segundos;
  const est = tarea.minutos_estimados;
  const pasado = est != null && seg / 60 > est;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 34, color: pasado ? T.warn : T.ink, letterSpacing: 0.5 }}>{fmtReloj(seg)}</div>
      <div style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>
        {est != null ? `Estimado ${fmtMin(est)}${pasado ? ' · pasado del estimado' : ''}` : 'Sin estimado'}
      </div>
    </div>
  );
}

function DialogoCambio({ item, abierto, onCerrar, onGuardar, cel, businessId, tandas, permiteReceta = true }) {
  const [alcance, setAlcance] = useState('produccion');
  const [modo, setModo] = useState('falta');
  const [insumo, setInsumo] = useState(null);
  const [cant, setCant] = useState('');
  const [unidad, setUnidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const nuevo = !item?.id;
  useEffect(() => {
    if (!abierto) return;
    setAlcance('produccion'); setModo(nuevo ? 'agregar' : 'falta'); setInsumo(null);
    setCant(item?.cantidad != null ? String(item.cantidad).replace('.', ',') : ''); setUnidad(item?.unidad || ''); setMotivo(''); setError('');
  }, [abierto, item, nuevo]);
  const receta = alcance === 'receta';
  const guardar = async () => {
    const c = cant === '' ? null : Number(String(cant).replace(',', '.'));
    if (!motivo.trim()) return setError('Contá por qué cambió.');
    if (modo === 'otro' || modo === 'agregar') {
      if (!insumo?.nombre?.trim()) return setError('¿Qué usaste?');
      if (receta && !insumo.id) return setError('Para cambiar la receta elegí el insumo de la lista.');
    }
    if (modo !== 'falta' && (c == null || !Number.isFinite(c))) return setError('Poné la cantidad.');
    const err = await onGuardar(modo === 'agregar'
      ? { insumo_id: insumo.id || null, nombre: insumo.nombre.trim(), cantidad: c, unidad, motivo: motivo.trim(), alcance }
      : { falta: modo === 'falta', insumo_real_id: modo === 'otro' ? insumo.id || null : null, nombre_real: modo === 'otro' ? insumo.nombre.trim() : null,
        cantidad_real: modo === 'falta' ? null : c, unidad_real: unidad || null, motivo: motivo.trim(), alcance });
    if (err) setError(err); else onCerrar();
  };
  const tarjeta = (k, titulo, sub) => (
    <div onClick={() => setAlcance(k)} role="button"
      style={{ flex: 1, minWidth: 180, cursor: 'pointer', borderRadius: 12, padding: '10px 12px', fontFamily: FB,
        border: `2px solid ${alcance === k ? T.ink : T.border}`, background: alcance === k ? T.head : '#fff' }}>
      <div style={{ fontWeight: 700, color: T.text, fontSize: 13.5 }}>{titulo}</div>
      <div style={{ color: T.text3, fontSize: 12, marginTop: 2 }}>{sub}</div>
    </div>
  );
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={500}
      titulo={nuevo ? 'Agregar un ingrediente' : `Cambio en ${item?.nombre || ''}`}
      pie={<>{error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton><Boton primario onClick={guardar}>{receta ? 'Proponer cambio de receta' : 'Guardar cambio'}</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {permiteReceta && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tarjeta('produccion', 'Solo esta producción', 'No había, o vino uno distinto y lo reemplacé hoy.')}
            {tarjeta('receta', 'Cambio de receta', 'La receta cambió: queda así de ahora en más si se aprueba.')}
          </div>
        )}
        {!nuevo && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Boton activo={modo === 'falta'} onClick={() => setModo('falta')}>{receta ? 'Ya no va' : 'No había'}</Boton>
            <Boton activo={modo === 'otro'} onClick={() => setModo('otro')}>{receta ? 'Va otro' : 'Usé otro'}</Boton>
            <Boton activo={modo === 'cantidad'} onClick={() => setModo('cantidad')}>Otra cantidad</Boton>
          </div>
        )}
        {!nuevo && <Texto sutil>La receta pide {fmtCant(item?.cantidad, item?.unidad)}{tandas && Number(tandas) !== 1 ? ` para ${textoTandas(tandas)}` : ''}.</Texto>}
        {(modo === 'otro' || modo === 'agregar') && (
          <Campo label={modo === 'otro' ? (receta ? 'Qué va en su lugar' : 'Qué usaste en su lugar') : 'Ingrediente'}
            ayuda={receta ? 'Tiene que ser un insumo de la lista, así se calcula el costo de la receta.' : null}>
            <BuscarInsumo businessId={businessId} valor={insumo?.id ? insumo : null} obligatorio={receta}
              onElegir={(i) => { setInsumo(i); if (i?.unidad && !unidad) setUnidad(i.unidad); }} />
          </Campo>
        )}
        {modo !== 'falta' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Campo label={`Cantidad${tandas && Number(tandas) !== 1 ? ` (para ${textoTandas(tandas)})` : ''}`} style={{ flex: 1 }}>
              <Entrada inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} />
            </Campo>
            <Campo label="Unidad" style={{ width: 110 }}>
              <Selector value={unidad} onChange={setUnidad} opciones={['gr', 'kg', 'ml', 'lt', 'u', 'porcion'].map((u) => ({ value: u, label: unidadCorta(u) }))} vacio="—" />
            </Campo>
          </div>
        )}
        <Campo label="Por qué" ayuda={receta
          ? 'Va al dueño o al admin en Aprobaciones con el antes y el después. Vos seguí trabajando: hoy cuenta así.'
          : 'Lo ve el dueño o el admin para aprobarlo o no. Vos seguí trabajando.'}>
          <Entrada value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder={receta ? 'Ej.: Ahora la hacemos con crema' : 'Ej.: No llegó el pedido'} />
        </Campo>
      </div>
    </Modal>
  );
}

/** «La receta pide 55 kg de nalga pero hay 51»: recalcula TODA la fórmula en proporción. */
function AjustarModal({ abierto, item, tarea, insumos, onCerrar, onAplicar, cel }) {
  const [hay, setHay] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (abierto && item) { setHay(String(item.cantidad ?? '').replace('.', ',')); setError(''); } }, [abierto, item]);
  if (!abierto || !item || !tarea) return null;
  const v = Number(String(hay).replace(',', '.'));
  const factor = v > 0 && item.cantidad > 0 ? v / item.cantidad : null;
  const tandasNuevas = factor ? Math.round(Number(tarea.tandas) * factor * 1000) / 1000 : null;
  const aplicar = async () => { const err = await onAplicar(v); if (err) setError(err); else onCerrar(); };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} cel={cel} ancho={520} titulo={`Ajustar por ${item.nombre}`}
      pie={<>{error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton primario deshabilitado={!factor || Math.abs(factor - 1) < 0.0005} onClick={aplicar}>Recalcular todo</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Texto>Para {textoTandas(tarea.tandas)} la receta pide <b>{fmtCant(item.cantidad, item.unidad)}</b> de {item.nombre}. ¿Cuánto hay?</Texto>
        <Campo label={`Hay (${unidadCorta(item.unidad)})`} style={{ maxWidth: 200 }}>
          <Entrada autoFocus inputMode="decimal" value={hay} onChange={(e) => setHay(e.target.value)} />
        </Campo>
        {factor && Math.abs(factor - 1) >= 0.0005 && (
          <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, fontFamily: FB }}>
            <div style={{ fontSize: 13.5, color: T.text, marginBottom: 8 }}>
              Queda en <b>{fmtTandas(tandasNuevas)} tandas</b>
              {tarea.rinde_esperado != null && <> · rinde <b>{fmtCant(tarea.rinde_esperado * factor, tarea.unidad)}</b></>}
              {tarea.minutos_estimados != null && <> · {fmtMin(tarea.minutos_estimados * factor)}</>}
            </div>
            {insumos.filter((x) => !x.agregado && x.cantidad != null).map((x, i) => (
              <div key={x.id ?? `r${i}`} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0', color: T.text2 }}>
                <span style={{ flex: 1 }}>{x.nombre}</span>
                <span style={{ color: T.text3, textDecoration: 'line-through' }}>{fmtCant(x.cantidad, x.unidad)}</span>
                <b style={{ color: T.ink, minWidth: 80, textAlign: 'right' }}>{fmtCant(x.cantidad * factor, x.unidad)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function FilaInsumo({ it, enCurso, puedeEjecutar, puedeDecidir, onTildar, onCambiar, onDeshacer, onDecidir, onAprobaciones, onAjustar }) {
  const cambiado = it.cambio || it.falta || it.agregado;
  const colorCambio = it.cambio === 'aprobado' ? T.ok : it.cambio === 'rechazado' ? T.bad : T.warn;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 4px', borderBottom: `1px solid ${T.border}`, fontFamily: FB }}>
      <input type="checkbox" checked={!!it.usado} disabled={!enCurso || !puedeEjecutar || it.falta} onChange={(e) => onTildar(it, e.target.checked)}
        style={{ width: 22, height: 22, marginTop: 1, accentColor: T.ok, cursor: enCurso && puedeEjecutar ? 'pointer' : 'default', flexShrink: 0 }} aria-label={`Usé ${it.nombre}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 500, textDecoration: it.falta || (it.nombre_real && !it.agregado) ? 'line-through' : 'none' }}>{it.nombre}</span>
          <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 14, color: T.ink, whiteSpace: 'nowrap',
            textDecoration: !it.agregado && (it.falta || it.cantidad_real != null) ? 'line-through' : 'none' }}>
            {it.agregado ? '' : fmtCant(it.cantidad, it.unidad)}
          </span>
        </div>
        {cambiado && (
          <div style={{ marginTop: 4, fontSize: 12.5, color: T.text2 }}>
            <span style={{ fontWeight: 700, color: colorCambio }}>
              {it.agregado ? `+ ${it.nombre_real || it.nombre} ${fmtCant(it.cantidad_real, it.unidad_real)}`
                : it.falta ? 'No había'
                  : `→ ${it.nombre_real || it.nombre} ${fmtCant(it.cantidad_real ?? it.cantidad, it.unidad_real || it.unidad)}`}
            </span>
            {it.motivo && <span> · {it.motivo}</span>}
            <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {it.alcance === 'receta' && <Pastilla color={T.violet} fondo="#F1EBFE">Cambio de receta</Pastilla>}
              <Pastilla color={colorCambio} fondo={it.cambio === 'aprobado' ? '#E4F6EC' : it.cambio === 'rechazado' ? '#FBE9E9' : '#FBF3E2'}>
                {it.cambio === 'aprobado' ? (it.alcance === 'receta' ? 'Aprobado: la receta cambió' : 'Aprobado')
                  : it.cambio === 'rechazado' ? (it.alcance === 'receta' ? 'Rechazado: la receta sigue igual' : 'Rechazado')
                    : it.alcance === 'receta' ? 'En Aprobaciones' : 'Esperando aprobación'}
              </Pastilla>
              {it.nota_decision && <span style={{ fontSize: 12, color: T.text3 }}>«{it.nota_decision}»</span>}
              {it.cambio === 'pendiente' && puedeDecidir && it.alcance !== 'receta' && <>
                <Boton chico onClick={() => onDecidir(it, 'aprobado')}>✓ Aprobar</Boton>
                <Boton chico peligro onClick={() => onDecidir(it, 'rechazado')}>Rechazar</Boton>
              </>}
              {it.cambio === 'pendiente' && puedeDecidir && it.alcance === 'receta' && <Boton chico onClick={onAprobaciones}>Ver en Aprobaciones ›</Boton>}
              {it.cambio === 'pendiente' && puedeEjecutar && enCurso && <Boton chico onClick={() => onDeshacer(it)}>Deshacer</Boton>}
            </div>
          </div>
        )}
      </div>
      {onAjustar && !it.agregado && it.cantidad != null && !it.falta && (
        <Boton chico onClick={() => onAjustar(it)} title="Tengo otra cantidad: recalcular toda la receta en proporción">⚖ Ajustar</Boton>
      )}
      {enCurso && puedeEjecutar && !cambiado && <Boton chico onClick={() => onCambiar(it)} title="No había, usé otro u otra cantidad">Cambió</Boton>}
    </div>
  );
}

export default function TareaDetalle({ businessId, tareaId, abierto, onCerrar, onCambio, ctx, cel }) {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cambio, setCambio] = useState(null);
  const [terminar, setTerminar] = useState(false);
  const [rinde, setRinde] = useState('');
  const [nota, setNota] = useState('');
  const [editando, setEditando] = useState(false);
  const [etiquetas, setEtiquetas] = useState(false);
  const [ajustar, setAjustar] = useState(null);

  const cargar = useCallback(async () => {
    if (!tareaId) return;
    try { const r = await ProduccionAPI.detalle(businessId, tareaId); setD(r); setError(''); } catch (e) { setError(textoError(e)); }
  }, [businessId, tareaId]);
  useEffect(() => { if (abierto) { setD(null); setEditando(false); setTerminar(false); cargar(); } }, [abierto, cargar]);

  const hacer = async (fn) => {
    setOcupado(true);
    try { const r = await fn(); if (r?.tarea) setD(r); else await cargar(); onCambio?.(); setError(''); return null; }
    catch (e) { const m = textoError(e); setError(m); return m; }
    finally { setOcupado(false); }
  };

  if (!abierto) return null;
  const t = d?.tarea;
  const puede = d?.puede || {};
  const enCurso = t && (t.estado === 'en_curso' || t.estado === 'pausada');
  const est = t ? ESTADOS[t.estado] : null;
  const pasos = Array.isArray(d?.receta?.pasos) ? d.receta.pasos : [];
  const pendientes = (d?.insumos || []).filter((x) => x.cambio === 'pendiente').length;

  const titulo = t ? (
    <div>
      <div style={{ fontFamily: FT, fontWeight: 700, fontSize: cel ? 16 : 18, color: T.text }}>{t.titulo}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
        <Pastilla color={est.color} fondo={est.fondo}>{t.corriendo ? '● ' : ''}{est.label}</Pastilla>
        {t.tipo === 'produccion' && <Pastilla>{textoTandas(t.tandas)}</Pastilla>}
        <span style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>{diaLargo(t.fecha)}{t.turno ? ` · ${t.turno}` : ''}{t.plaza ? ` · ${t.plaza}` : ''} · {t.responsable || 'sin asignar'}</span>
      </div>
    </div>
  ) : 'Tarea';

  return (
    <>
      <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} cel={cel} ancho={680}>
        {!d && !error && <Texto sutil>Cargando…</Texto>}
        {error && <div style={{ background: '#FBE9E9', color: T.bad, borderRadius: 10, padding: '8px 12px', fontFamily: FB, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {t && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Cronómetro y acciones */}
            <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {t.estado !== 'pendiente' && <Reloj key={`${t.estado}-${t.segundos}`} tarea={t} />}
              {t.tipo === 'produccion' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontFamily: FB, fontSize: 13, color: T.text2, flexWrap: 'wrap' }}>
                  <span>Tiene que rendir <b style={{ color: T.text }}>{t.rinde_esperado != null ? `${Number(t.rinde_esperado).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unidadCorta(t.unidad)}` : '—'}</b></span>
                  {t.rinde_real != null && <span>Rindió <b style={{ color: T.ok }}>{Number(t.rinde_real).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {unidadCorta(t.unidad)}</b></span>}
                  {t.estado === 'pendiente' && t.minutos_estimados != null && <span>Estimado <b style={{ color: T.text }}>{fmtMin(t.minutos_estimados)}</b></span>}
                </div>
              )}
              {puede.ejecutar && t.estado !== 'hecha' && t.estado !== 'cancelada' && (
                terminar ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Campo label={`¿Cuánto rindió?${t.unidad ? ` (${unidadCorta(t.unidad)})` : ''}`} style={{ width: 170 }}>
                      <Entrada autoFocus inputMode="decimal" value={rinde} onChange={(e) => setRinde(e.target.value)} />
                    </Campo>
                    <Boton primario deshabilitado={ocupado || rinde === ''} onClick={async () => {
                      const err = await hacer(() => ProduccionAPI.accion(businessId, t.id, 'terminar', { rinde_real: Number(String(rinde).replace(',', '.')) }));
                      if (!err) setTerminar(false);
                    }}>Terminar</Boton>
                    <Boton onClick={() => setTerminar(false)}>Volver</Boton>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {t.estado === 'pendiente' && <Boton primario deshabilitado={ocupado} onClick={() => hacer(() => ProduccionAPI.accion(businessId, t.id, 'iniciar'))} style={{ minWidth: 160, minHeight: 44, fontSize: 15 }}>▶ Empezar</Boton>}
                    {t.estado === 'en_curso' && <Boton deshabilitado={ocupado} onClick={() => hacer(() => ProduccionAPI.accion(businessId, t.id, 'pausar'))} style={{ minHeight: 44 }}>❚❚ Pausar</Boton>}
                    {t.estado === 'pausada' && <Boton primario deshabilitado={ocupado} onClick={() => hacer(() => ProduccionAPI.accion(businessId, t.id, 'reanudar'))} style={{ minHeight: 44 }}>▶ Retomar</Boton>}
                    {enCurso && <Boton primario deshabilitado={ocupado} onClick={() => {
                      if (t.tipo !== 'produccion') { hacer(() => ProduccionAPI.accion(businessId, t.id, 'terminar')); return; }
                      setRinde(t.rinde_esperado != null ? String(t.rinde_esperado).replace('.', ',') : ''); setTerminar(true);
                    }} style={{ minHeight: 44 }}>✓ Terminé</Boton>}
                  </div>
                )
              )}
              {d.etiqueta && (t.estado === 'hecha' || enCurso) && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Boton onClick={() => setEtiquetas(true)}>🏷 Etiquetas · {d.etiqueta.lote}</Boton>
                </div>
              )}
              {t.estado === 'pendiente' && t.tipo === 'produccion' && puede.ejecutar && (
                <Texto sutil style={{ textAlign: 'center', fontSize: 12 }}>Al empezar se fija la receta y arranca el reloj.</Texto>
              )}
            </div>

            {/* Ingredientes (o lo que se arma en la plaza) */}
            {(t.tipo === 'produccion' || t.tipo === 'mise_en_place') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, flex: 1 }}>
                    {t.tipo === 'mise_en_place' ? 'Lo que se arma en la plaza' : <>Ingredientes <span style={{ fontFamily: FB, fontWeight: 400, fontSize: 12, color: T.text3 }}>para {textoTandas(t.tandas)}</span></>}
                  </div>
                  {pendientes > 0 && <Pastilla color={T.warn} fondo="#FBF3E2">{pendientes} por aprobar</Pastilla>}
                </div>
                {!d.insumos.length && <Texto sutil>{t.tipo === 'mise_en_place' ? 'La plaza no tiene mise en place cargado (pestaña Mise en place).' : 'La receta no tiene ingredientes cargados.'}</Texto>}
                {d.insumos.map((it, i) => (
                  <FilaInsumo key={it.id ?? `r${i}`} it={it} enCurso={enCurso} puedeEjecutar={puede.ejecutar} puedeDecidir={puede.decidir}
                    onTildar={(x, v) => hacer(() => ProduccionAPI.insumo(businessId, t.id, x.id, { usado: v }))}
                    onCambiar={(x) => setCambio(x)}
                    onAprobaciones={() => navigate('/configuracion?tab=6')}
                    onAjustar={puede.ejecutar && t.estado !== 'hecha' && t.estado !== 'cancelada' ? (x) => setAjustar(x) : null}
                    onDeshacer={(x) => hacer(() => ProduccionAPI.insumo(businessId, t.id, x.id, { deshacer: true }))}
                    onDecidir={(x, dec) => {
                      const n = dec === 'rechazado' ? window.prompt('¿Por qué lo rechazás? (lo ve el cocinero)') : '';
                      if (n === null) return;
                      hacer(() => ProduccionAPI.decidir(businessId, t.id, x.id, dec, n || ''));
                    }} />
                ))}
                {enCurso && puede.ejecutar && <div style={{ marginTop: 8 }}><Boton chico onClick={() => setCambio({ nombre: '' })}>+ Agregar ingrediente</Boton></div>}
                {pendientes > 0 && puede.decidir && (
                  <Texto sutil style={{ fontSize: 12, marginTop: 8 }}>Los de «solo esta producción» se aprueban acá. Los cambios de receta se aprueban en Aprobaciones, con el antes, el después y el costo.</Texto>
                )}
              </div>
            )}

            {/* Pasos */}
            {pasos.length > 0 && (
              <details>
                <summary style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, cursor: 'pointer' }}>Paso a paso</summary>
                <ol style={{ fontFamily: FB, fontSize: 14, color: T.text2, paddingLeft: 20, lineHeight: 1.5 }}>
                  {pasos.map((p, i) => (p.startsWith('## ')
                    ? <div key={i} style={{ fontFamily: FT, fontWeight: 700, color: T.text, margin: '10px 0 4px -20px' }}>{p.slice(3)}</div>
                    : <li key={i} style={{ marginBottom: 4 }}>{p}</li>))}
                </ol>
              </details>
            )}

            {/* Planificación (jefe / dueño / admin) */}
            {puede.planificar && (
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                {!editando ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {t.estado !== 'hecha' && t.estado !== 'cancelada' && <Boton chico onClick={() => setEditando(true)}>✎ Editar</Boton>}
                    {(t.estado === 'hecha' || t.estado === 'cancelada') && <Boton chico onClick={() => hacer(() => ProduccionAPI.accion(businessId, t.id, 'reabrir'))}>Reabrir</Boton>}
                    {t.estado !== 'hecha' && t.estado !== 'cancelada' && <Boton chico peligro onClick={() => {
                      const m = window.prompt('¿Por qué se cancela? (opcional)'); if (m === null) return;
                      hacer(() => ProduccionAPI.accion(businessId, t.id, 'cancelar', { motivo: m }));
                    }}>Cancelar tarea</Boton>}
                    <Boton chico peligro onClick={async () => {
                      // Se borra en cualquier estado (se cargó, se hizo o se cambió mal).
                      const aviso = t.estado === 'pendiente' ? '¿Borrar esta tarea?'
                        : t.estado === 'hecha' ? 'Esta tarea ya se hizo. Si la borrás, lo que consumió deja de contar en Consumos y en el Panel. ¿Por qué la borrás?'
                          : 'Esta tarea ya empezó. ¿Por qué la borrás?';
                      const motivo = t.estado === 'pendiente' ? (window.confirm(aviso) ? '' : null) : window.prompt(aviso, 'Se cargó mal');
                      if (motivo === null) return;
                      try { await ProduccionAPI.borrar(businessId, t.id, motivo); onCambio?.(); onCerrar(); } catch (e) { setError(textoError(e)); }
                    }}>Borrar</Boton>
                  </div>
                ) : (
                  <EditarTarea t={t} ctx={ctx} cel={cel} onCancelar={() => setEditando(false)}
                    onGuardar={async (body) => { const err = await hacer(() => ProduccionAPI.editar(businessId, t.id, body)); if (!err) setEditando(false); }} />
                )}
              </div>
            )}

            {/* Hilo */}
            <div>
              <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Observaciones</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.eventos.map((e) => (
                  e.tipo === 'nota' ? (
                    <div key={e.id} style={{ alignSelf: Number(e.user_id) === ctx?.uid ? 'flex-end' : 'flex-start', maxWidth: '85%',
                      background: Number(e.user_id) === ctx?.uid ? '#E3F4FB' : T.card, borderRadius: 12, padding: '7px 10px', fontFamily: FB }}>
                      <div style={{ fontSize: 11, color: T.text3, marginBottom: 2 }}>{e.autor} · {new Date(e.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: 13.5, color: T.text, whiteSpace: 'pre-wrap' }}>{e.texto}</div>
                    </div>
                  ) : (
                    <div key={e.id} style={{ fontFamily: FB, fontSize: 11.5, color: T.text3, textAlign: 'center' }}>
                      {e.autor}: {e.texto} · {new Date(e.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Entrada value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} placeholder="Escribí una observación…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && nota.trim()) { const x = nota; setNota(''); hacer(() => ProduccionAPI.nota(businessId, t.id, x)); } }} />
                <Boton primario deshabilitado={!nota.trim() || ocupado} onClick={() => { const x = nota; setNota(''); hacer(() => ProduccionAPI.nota(businessId, t.id, x)); }}>Enviar</Boton>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <AjustarModal abierto={!!ajustar} item={ajustar} tarea={t} insumos={d?.insumos || []} cel={cel} onCerrar={() => setAjustar(null)}
        onAplicar={(cant) => hacer(() => ProduccionAPI.escalar(businessId, t.id, ajustar.id ? { item_id: ajustar.id, cantidad: cant } : { receta_item_id: ajustar.receta_item_id, cantidad: cant }))} />
      <EtiquetasModal abierto={etiquetas} onCerrar={() => setEtiquetas(false)} tarea={t} etiqueta={d?.etiqueta} cel={cel} />
      <DialogoCambio abierto={!!cambio} item={cambio} cel={cel} onCerrar={() => setCambio(null)} businessId={businessId} tandas={t?.tandas}
        permiteReceta={t?.tipo === 'produccion'}
        onGuardar={(body) => hacer(() => (cambio?.id
          ? ProduccionAPI.insumo(businessId, t.id, cambio.id, { cambio: body })
          : ProduccionAPI.agregarInsumo(businessId, t.id, body)))} />
    </>
  );
}

function EditarTarea({ t, ctx, cel, onGuardar, onCancelar }) {
  const lunes = lunesDe(t.fecha);
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(lunes, i));
  const [v, setV] = useState({
    fecha: t.fecha, turno_id: t.turno_id ? String(t.turno_id) : '', responsable_user_id: t.responsable_user_id ? String(t.responsable_user_id) : '',
    plaza_id: t.plaza_id ? String(t.plaza_id) : '', tandas: String(t.tandas ?? 1).replace('.', ','), minutos_estimados: t.minutos_estimados != null ? String(t.minutos_estimados) : '',
  });
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const guardar = () => {
    const body = {
      fecha: v.fecha, turno_id: Number(v.turno_id) || null, responsable_user_id: Number(v.responsable_user_id) || null,
      plaza_id: Number(v.plaza_id) || null, minutos_estimados: v.minutos_estimados === '' ? null : Number(v.minutos_estimados),
    };
    const k = Number(String(v.tandas).replace(',', '.'));
    if (t.tipo === 'produccion' && t.estado === 'pendiente' && k !== Number(t.tandas)) body.tandas = k;
    onGuardar(body);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : '1fr 1fr', gap: 10 }}>
      <Campo label="Día"><Selector value={v.fecha} onChange={set('fecha')} opciones={dias.map((d) => ({ value: d, label: diaLargo(d) }))} /></Campo>
      <Campo label="Turno"><Selector value={v.turno_id} onChange={set('turno_id')} vacio="Sin turno" opciones={(ctx?.turnos || []).map((x) => ({ value: String(x.id), label: x.nombre }))} /></Campo>
      <Campo label="Responsable"><Selector value={v.responsable_user_id} onChange={set('responsable_user_id')} vacio="Sin asignar" opciones={(ctx?.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))} /></Campo>
      <Campo label="Plaza"><Selector value={v.plaza_id} onChange={set('plaza_id')} vacio="Sin plaza" opciones={(ctx?.plazas || []).map((p) => ({ value: String(p.id), label: p.nombre }))} /></Campo>
      {t.tipo === 'produccion' && (
        <Campo label="Tandas" ayuda={t.estado !== 'pendiente' ? 'Ya empezó: no se cambian' : null}>
          <Entrada inputMode="decimal" disabled={t.estado !== 'pendiente'} value={v.tandas} onChange={(e) => set('tandas')(e.target.value)} />
        </Campo>
      )}
      <Campo label="Estimado (min)"><Entrada inputMode="numeric" value={v.minutos_estimados} onChange={(e) => set('minutos_estimados')(e.target.value.replace(/[^\d]/g, ''))} /></Campo>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={onCancelar}>Cancelar</Boton><Boton primario onClick={guardar}>Guardar</Boton>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><Texto sutil style={{ fontSize: 11.5 }}>Tandas {fmtTandas(v.tandas.replace(',', '.'))}: si cambian, el rinde y el estimado se ajustan solos.</Texto></div>
    </div>
  );
}
