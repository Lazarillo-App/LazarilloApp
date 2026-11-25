// src/componentes/produccion/Registros.jsx — Producción · etapa 2 (usuaria 21/11/2026)
//  · MiseEnPlace: la plantilla de cada plaza (jefe / dueño / admin)
//  · Registros: mermas medidas y desperdicios (lo carga cualquiera del equipo, también desde el celular)
//  · Consumos: todo lo que salió de lo comprado sin venderse, por insumo (para el stock)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Boton, Campo, Entrada, Selector, Texto, Vacio, Pastilla, FichaMovil } from './ui';
import BuscarInsumo from './BuscarInsumo';
import { fmtCant, textoError, unidadCorta, fmtTandas } from './util';

const UNIDADES = ['gr', 'kg', 'ml', 'lt', 'u', 'porcion'].map((u) => ({ value: u, label: unidadCorta(u) }));
const fechaHora = (s) => new Date(s).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const pesos = (n) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

// ── Mise en place ────────────────────────────────────────────────────────────────────────────
export function MiseEnPlace({ businessId, ctx, cel }) {
  const [datos, setDatos] = useState(null);
  const [plaza, setPlaza] = useState(null);
  const [lista, setLista] = useState([]);
  const [sucio, setSucio] = useState(false);
  const [msg, setMsg] = useState('');
  const plazas = useMemo(() => ctx?.plazas || [], [ctx]);
  const cargar = useCallback(async () => {
    try { const r = await ProduccionAPI.mise(businessId); setDatos(r.porPlaza || {}); } catch (e) { setMsg(textoError(e)); }
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!plaza && plazas.length) setPlaza(plazas[0].id); }, [plazas, plaza]);
  useEffect(() => { if (datos && plaza) { setLista((datos[plaza] || []).map((x) => ({ ...x }))); setSucio(false); } }, [datos, plaza]);

  if (!plazas.length) return <Vacio emoji="🧂" titulo="No hay plazas">Creá las plazas en Operación › Tableros para cargar su mise en place.</Vacio>;
  const set = (i, k, v) => { setLista((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setSucio(true); };
  const guardar = async () => {
    setMsg('');
    try {
      await ProduccionAPI.guardarMise(businessId, plaza, lista.filter((x) => x.nombre?.trim()).map((x) => ({
        insumo_id: x.insumo_id, nombre: x.nombre, cantidad: Number(String(x.cantidad).replace(',', '.')), unidad: x.unidad,
      })));
      await cargar(); setMsg('Guardado ✓');
    } catch (e) { setMsg(textoError(e)); }
  };
  const altoCel = cel ? { minHeight: 44 } : undefined;
  return (
    <div style={{ minWidth: 0 }}>
      <Texto sutil style={{ marginBottom: 10 }}>
        Lo que se deja armado en cada plaza al empezar el turno (sal, aceite, salsas…). Casi nunca cambia: cargalo una vez.
        Programá una tarea «Mise en place» por plaza y turno; al terminarla cuenta como consumo para el stock.
      </Texto>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {plazas.map((p) => (
          <Boton key={p.id} activo={p.id === plaza} style={altoCel} onClick={() => { if (sucio && !window.confirm('Hay cambios sin guardar. ¿Salir igual?')) return; setPlaza(p.id); }}>
            {p.nombre} <span style={{ opacity: 0.6, fontWeight: 400 }}>{(datos?.[p.id] || []).length || ''}</span>
          </Boton>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cel ? 10 : 8, maxWidth: 720, minWidth: 0 }}>
        {lista.map((x, i) => (
          cel ? (
            <div key={x.id ?? `n${i}`} style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {x.insumo_id || x.id ? <div style={{ fontFamily: FB, fontSize: 14, fontWeight: 600, color: T.text, padding: '0 4px', overflowWrap: 'anywhere' }}>{x.nombre}</div>
                    : <BuscarInsumo businessId={businessId} valor={null} onElegir={(v) => { if (!v) return; set(i, 'nombre', v.nombre); set(i, 'insumo_id', v.id); if (v.unidad) set(i, 'unidad', v.unidad); }} />}
                </div>
                <Boton peligro title="Quitar" style={{ minHeight: 44, minWidth: 44, padding: 0, flexShrink: 0 }} onClick={() => { setLista((l) => l.filter((_, j) => j !== i)); setSucio(true); }}>✕</Boton>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 116px', gap: 8 }}>
                <Entrada inputMode="decimal" placeholder="Cantidad" value={String(x.cantidad ?? '').replace('.', ',')} onChange={(e) => set(i, 'cantidad', e.target.value)} aria-label="Cantidad" style={{ minHeight: 44 }} />
                <Selector value={x.unidad || ''} onChange={(v) => set(i, 'unidad', v)} opciones={UNIDADES} vacio="Unidad" style={{ minHeight: 44 }} />
              </div>
            </div>
          ) : (
            <div key={x.id ?? `n${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 36px', gap: 6, alignItems: 'center' }}>
              {x.insumo_id || x.id ? <div style={{ fontFamily: FB, fontSize: 14, color: T.text, padding: '0 4px' }}>{x.nombre}</div>
                : <BuscarInsumo businessId={businessId} valor={null} onElegir={(v) => { if (!v) return; set(i, 'nombre', v.nombre); set(i, 'insumo_id', v.id); if (v.unidad) set(i, 'unidad', v.unidad); }} />}
              <Entrada inputMode="decimal" value={String(x.cantidad ?? '').replace('.', ',')} onChange={(e) => set(i, 'cantidad', e.target.value)} aria-label="Cantidad" />
              <Selector value={x.unidad || ''} onChange={(v) => set(i, 'unidad', v)} opciones={UNIDADES} vacio="—" />
              <Boton chico peligro title="Quitar" onClick={() => { setLista((l) => l.filter((_, j) => j !== i)); setSucio(true); }}>✕</Boton>
            </div>
          )
        ))}
        {!lista.length && <Texto sutil>Esta plaza todavía no tiene mise en place.</Texto>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <Boton chico={!cel} style={altoCel} onClick={() => { setLista((l) => [...l, { nombre: '', cantidad: '', unidad: '' }]); setSucio(true); }}>+ Insumo</Boton>
          <span style={{ flex: 1 }} />
          {msg && <span style={{ fontFamily: FB, fontSize: 12.5, color: msg.endsWith('✓') ? T.ok : T.bad }}>{msg}</span>}
          <Boton primario deshabilitado={!sucio} style={altoCel} onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </div>
  );
}

// ── Mermas y desperdicios ────────────────────────────────────────────────────────────────────
export function Registros({ businessId, ctx, desde, hasta, cel }) {
  const [solapa, setSolapa] = useState('desperdicio');
  const [mermas, setMermas] = useState([]);
  const [desp, setDesp] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([ProduccionAPI.mermas(businessId, desde, hasta), ProduccionAPI.desperdicios(businessId, desde, hasta)]);
      setMermas(m.items || []); setDesp(d.items || []); setMotivos(d.motivos || []);
    } catch (e) { setError(textoError(e)); }
  }, [businessId, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);
  const borrar = async (tipo, id) => {
    if (!window.confirm('¿Borrar este registro?')) return;
    try { await ProduccionAPI.borrarRegistro(businessId, tipo, id); cargar(); } catch (e) { setError(textoError(e)); }
  };
  const altoBtnBorrar = cel ? { minHeight: 44, minWidth: 44, padding: 0, flexShrink: 0 } : undefined;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'minmax(300px, 380px) 1fr', gap: 16, alignItems: 'start', minWidth: 0 }}>
      <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 14, padding: cel ? 12 : 14, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <Boton activo={solapa === 'desperdicio'} onClick={() => setSolapa('desperdicio')} style={cel ? { flex: 1, minHeight: 44 } : undefined}>🗑 Desperdicio</Boton>
          <Boton activo={solapa === 'merma'} onClick={() => setSolapa('merma')} style={cel ? { flex: 1, minHeight: 44 } : undefined}>⚖ Merma</Boton>
        </div>
        {solapa === 'desperdicio'
          ? <FormDesperdicio businessId={businessId} ctx={ctx} motivos={motivos} onListo={(r) => { setDesp(r.items || []); }} desde={desde} hasta={hasta} cel={cel} />
          : <FormMerma businessId={businessId} onListo={(r) => { setMermas(r.items || []); }} desde={desde} hasta={hasta} cel={cel} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {error && <div style={{ color: T.bad, fontFamily: FB, fontSize: 13 }}>{error}</div>}
        <div>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Desperdicios de la semana</div>
          {!desp.length ? <Texto sutil>No se cargaron desperdicios.</Texto> : desp.map((x) => (
            <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: `1px solid ${T.border}`, fontFamily: FB, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 600, color: T.text }}>{x.nombre}</span> <span style={{ color: T.ink, fontWeight: 700 }}>{fmtCant(x.cantidad, x.unidad)}</span>
                <div style={{ fontSize: 12, color: T.text3 }}>{x.motivo}{x.comentario ? ` · ${x.comentario}` : ''}{x.plaza ? ` · ${x.plaza}` : ''}</div>
              </div>
              <span style={{ fontSize: 12, color: T.text3 }}>{x.usuario} · {fechaHora(x.created_at)}</span>
              {(x.propia || ctx?.planifica) && <Boton chico={!cel} peligro style={altoBtnBorrar} onClick={() => borrar('desperdicios', x.id)}>✕</Boton>}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Mermas medidas</div>
          {!mermas.length ? <Texto sutil>No se midieron mermas.</Texto> : mermas.map((x) => {
            const peor = x.pct_config != null && x.pct != null && x.pct > x.pct_config + 3;
            return (
              <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: `1px solid ${T.border}`, fontFamily: FB, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160, overflowWrap: 'anywhere' }}>
                  <span style={{ fontWeight: 600, color: T.text }}>{x.nombre}</span>{' '}
                  <span style={{ color: T.text2 }}>{fmtCant(x.bruto, x.unidad)} → {fmtCant(x.neto, x.unidad)}</span>
                  <div style={{ fontSize: 12, color: T.text3 }}>{x.nota || ''}</div>
                </div>
                <Pastilla color={peor ? T.warn : T.text2} fondo={peor ? '#FBF3E2' : T.card}
                  title={x.pct_config != null ? `La merma configurada del insumo es ${x.pct_config}%` : 'El insumo no tiene merma configurada'}>
                  merma {x.pct}%{x.pct_config != null ? ` · config. ${x.pct_config}%` : ''}
                </Pastilla>
                <span style={{ fontSize: 12, color: T.text3 }}>{x.usuario} · {fechaHora(x.created_at)}</span>
                {(x.propia || ctx?.planifica) && <Boton chico={!cel} peligro style={altoBtnBorrar} onClick={() => borrar('mermas', x.id)}>✕</Boton>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FormDesperdicio({ businessId, ctx, motivos, onListo, desde, hasta, cel }) {
  const [insumo, setInsumo] = useState(null);
  const [cant, setCant] = useState('');
  const [unidad, setUnidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comentario, setComentario] = useState('');
  const [plaza, setPlaza] = useState('');
  const [msg, setMsg] = useState('');
  const [k, setK] = useState(0);
  const altoCel = cel ? { minHeight: 44 } : undefined;
  const guardar = async () => {
    setMsg('');
    try {
      const r = await ProduccionAPI.crearDesperdicio(businessId, {
        insumo_id: insumo?.id || null, nombre: insumo?.nombre, cantidad: Number(String(cant).replace(',', '.')), unidad, motivo, comentario, plaza_id: Number(plaza) || null,
      }, desde, hasta);
      onListo(r); setInsumo(null); setCant(''); setComentario(''); setK((x) => x + 1); setMsg('Cargado ✓');
    } catch (e) { setMsg(textoError(e)); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <Campo label="Qué se tiró" ayuda="Elegí el insumo o elaborado, o escribí el nombre.">
        <BuscarInsumo key={k} businessId={businessId} valor={insumo?.id ? insumo : null} onElegir={(v) => { setInsumo(v); if (v?.unidad) setUnidad(v.unidad); }} />
      </Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px', gap: 8 }}>
        <Campo label="Cantidad" style={{ minWidth: 0 }}><Entrada inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} style={altoCel} /></Campo>
        <Campo label="Unidad" style={{ minWidth: 0 }}><Selector value={unidad} onChange={setUnidad} opciones={UNIDADES} vacio="—" style={altoCel} /></Campo>
      </div>
      <Campo label="Motivo">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(motivos.length ? motivos : ['Vencido', 'Se pasó de cocción', 'Dañado', 'Se cayó', 'Otro']).map((m) => (
            <Boton key={m} chico={!cel} activo={motivo === m} style={altoCel} onClick={() => setMotivo(m)}>{m}</Boton>
          ))}
        </div>
      </Campo>
      {(ctx?.plazas || []).length > 0 && (
        <Campo label="Plaza (opcional)"><Selector value={plaza} onChange={setPlaza} vacio="—" opciones={ctx.plazas.map((p) => ({ value: String(p.id), label: p.nombre }))} style={altoCel} /></Campo>
      )}
      <Campo label="Comentario (opcional)"><Entrada value={comentario} maxLength={300} onChange={(e) => setComentario(e.target.value)} placeholder="Ej.: se cortó la cadena de frío" style={altoCel} /></Campo>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {msg && <span style={{ fontFamily: FB, fontSize: 12.5, color: msg.endsWith('✓') ? T.ok : T.bad, flex: 1 }}>{msg}</span>}
        <Boton primario style={{ marginLeft: 'auto', ...(cel ? { minHeight: 44, width: '100%' } : {}) }} deshabilitado={!insumo?.nombre || !cant || !motivo} onClick={guardar}>Cargar desperdicio</Boton>
      </div>
    </div>
  );
}

function FormMerma({ businessId, onListo, desde, hasta, cel }) {
  const [insumo, setInsumo] = useState(null);
  const [bruto, setBruto] = useState('');
  const [neto, setNeto] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState('');
  const [k, setK] = useState(0);
  const [info, setInfo] = useState(null);
  const altoCel = cel ? { minHeight: 44 } : undefined;
  useEffect(() => {
    setInfo(null);
    if (!insumo?.id) return undefined;
    let vivo = true;
    ProduccionAPI.mermaInsumo(businessId, insumo.id).then((r) => { if (vivo) setInfo(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [businessId, insumo?.id]);
  const b = Number(String(bruto).replace(',', '.')), n = Number(String(neto).replace(',', '.'));
  const conf = info?.configuradas?.find((x) => x.es_default) || info?.configuradas?.[0]
    || (info?.desperdicio != null ? { nombre: 'desperdicio del insumo', pct: info.desperdicio } : null);
  const esperado = conf?.pct != null && b > 0 ? b * (1 - conf.pct / 100) : null;
  const pct = b > 0 && n >= 0 && n <= b ? Math.round(((b - n) / b) * 1000) / 10 : null;
  const guardar = async () => {
    setMsg('');
    try {
      const r = await ProduccionAPI.crearMerma(businessId, { insumo_id: insumo?.id || null, nombre: insumo?.nombre, bruto: b, neto: n, unidad, nota }, desde, hasta);
      onListo(r); setInsumo(null); setBruto(''); setNeto(''); setNota(''); setK((x) => x + 1); setMsg('Cargada ✓');
    } catch (e) { setMsg(textoError(e)); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <Texto sutil style={{ fontSize: 12 }}>Pesá antes y después de limpiar (carne, verdura, pescado…). Se compara con la merma que tiene cargada el insumo.</Texto>
      <Campo label="Insumo"><BuscarInsumo key={k} businessId={businessId} valor={insumo?.id ? insumo : null} obligatorio onElegir={setInsumo} /></Campo>
      {info && (
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', fontFamily: FB, fontSize: 12.5, color: T.text2, overflowWrap: 'anywhere' }}>
          {info.configuradas.length ? info.configuradas.map((m, i) => (
            <div key={i}>Merma cargada{m.nombre ? ` «${m.nombre}»` : ''}: <b style={{ color: T.ink }}>{m.pct}%</b> (de {fmtCant(m.peso_inicial, unidad)} quedan {fmtCant(m.peso_final, unidad)})</div>
          )) : info.desperdicio != null
            ? <div>No tiene merma de limpieza cargada; su desperdicio es <b style={{ color: T.ink }}>{info.desperdicio}%</b>.</div>
            : <div>El insumo no tiene merma cargada: lo que midas sirve para cargarla en su pestaña Merma.</div>}
          {info.ultimas.length > 0 && (
            <div style={{ marginTop: 4 }}>
              Últimas medidas: {info.ultimas.map((u) => `${u.pct}%`).join(' · ')}{info.promedio != null && <> · promedio <b>{info.promedio}%</b></>}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr 1fr' : '1fr 1fr 90px', gap: 8 }}>
        <Campo label="Peso bruto" style={{ minWidth: 0 }}><Entrada inputMode="decimal" value={bruto} onChange={(e) => setBruto(e.target.value)} style={altoCel} /></Campo>
        <Campo label="Peso limpio" style={{ minWidth: 0 }}><Entrada inputMode="decimal" value={neto} onChange={(e) => setNeto(e.target.value)} style={altoCel} /></Campo>
        <Campo label="Unidad" style={cel ? { gridColumn: '1 / -1', minWidth: 0 } : { minWidth: 0 }}><Selector value={unidad} onChange={setUnidad} opciones={UNIDADES.filter((u) => ['gr', 'kg', 'ml', 'lt'].includes(u.value))} style={altoCel} /></Campo>
      </div>
      {esperado != null && !neto && <Texto sutil>Con la merma cargada te tendrían que quedar {fmtCant(esperado, unidad)} limpios.</Texto>}
      {pct != null && <Texto>Merma: <b style={{ color: conf?.pct != null && pct > conf.pct + 3 ? T.warn : T.ink }}>{pct}%</b> ({fmtCant(b - n, unidad)} afuera)
        {conf?.pct != null && <> · cargada {conf.pct}%</>}</Texto>}
      <Campo label="Nota (opcional)"><Entrada value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} style={altoCel} /></Campo>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {msg && <span style={{ fontFamily: FB, fontSize: 12.5, color: msg.endsWith('✓') ? T.ok : T.bad, flex: 1 }}>{msg}</span>}
        <Boton primario style={{ marginLeft: 'auto', ...(cel ? { minHeight: 44, width: '100%' } : {}) }} deshabilitado={!insumo?.id || pct == null} onClick={guardar}>Cargar merma</Boton>
      </div>
    </div>
  );
}

// ── Consumos ─────────────────────────────────────────────────────────────────────────────────
export function Consumos({ businessId, desde, hasta, cel }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    setDatos(null);
    ProduccionAPI.consumos(businessId, desde, hasta).then((r) => { if (vivo) setDatos(r); }).catch((e) => setError(textoError(e)));
    return () => { vivo = false; };
  }, [businessId, desde, hasta]);
  const conCosto = useMemo(() => (datos?.items || []).some((i) => i.costo != null), [datos]);
  if (error) return <Texto style={{ color: T.bad }}>{error}</Texto>;
  if (!datos) return <Texto sutil>Cargando…</Texto>;
  const total = (datos.items || []).reduce((s, i) => s + (i.costo || 0), 0);
  const celda = { padding: 8, borderTop: `1px solid ${T.border}` };
  const c = (v, u) => (v ? fmtCant(v, u) : '—');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Texto sutil>
        Todo lo que salió de lo comprado esta semana sin pasar por una venta: lo usado en producción, el mise en place de las plazas,
        lo desperdiciado y lo que se fue en merma. Es lo que el stock tiene que descontar.
      </Texto>
      {!datos.items.length ? <Vacio emoji="📦" titulo="Sin consumos esta semana">Aparecen cuando se terminan tareas de producción o mise en place, o se cargan desperdicios y mermas.</Vacio> : cel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {datos.items.map((i) => (
            <FichaMovil key={`${i.insumo_id || i.nombre}|${i.unidad}`} titulo={i.nombre} sub={!i.insumo_id ? 'sin vincular' : null} filas={[
              ['Total', c(i.total, i.unidad), T.ink], conCosto ? ['Costo aprox.', i.costo != null ? pesos(i.costo) : '—'] : null,
              ['Producción', c(i.produccion, i.unidad)], ['Mise en place', c(i.mise, i.unidad)],
              ['Desperdicio', c(i.desperdicio, i.unidad), i.desperdicio ? T.bad : T.text2], ['Merma', c(i.merma, i.unidad), i.merma ? T.warn : T.text2],
            ]} />
          ))}
          {conCosto && <div style={{ textAlign: 'right', fontFamily: FT, fontWeight: 800, color: T.ink, fontSize: 15, padding: '4px 2px' }}>Total {pesos(total)}</div>}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FB, fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: T.text3, fontSize: 11.5 }}>
              <th style={{ padding: 8 }}>Insumo</th><th style={{ padding: 8 }}>Producción</th><th style={{ padding: 8 }}>Mise en place</th>
              <th style={{ padding: 8 }}>Desperdicio</th><th style={{ padding: 8 }}>Merma</th><th style={{ padding: 8 }}>Total</th>
              {conCosto && <th style={{ padding: 8 }}>Costo aprox.</th>}
            </tr></thead>
            <tbody>
              {datos.items.map((i) => (
                <tr key={`${i.insumo_id || i.nombre}|${i.unidad}`}>
                  <td style={{ ...celda, color: T.text, fontWeight: 600 }}>{i.nombre}{!i.insumo_id && <span style={{ color: T.text3, fontWeight: 400 }}> (sin vincular)</span>}</td>
                  <td style={celda}>{c(i.produccion, i.unidad)}</td><td style={celda}>{c(i.mise, i.unidad)}</td>
                  <td style={{ ...celda, color: i.desperdicio ? T.bad : T.text2 }}>{c(i.desperdicio, i.unidad)}</td>
                  <td style={{ ...celda, color: i.merma ? T.warn : T.text2 }}>{c(i.merma, i.unidad)}</td>
                  <td style={{ ...celda, fontWeight: 700, color: T.ink }}>{c(i.total, i.unidad)}</td>
                  {conCosto && <td style={celda}>{i.costo != null ? pesos(i.costo) : '—'}</td>}
                </tr>
              ))}
              {conCosto && <tr><td style={{ ...celda, fontWeight: 700 }} colSpan={6}>Total</td><td style={{ ...celda, fontWeight: 800 }}>{pesos(total)}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {datos.producido?.length > 0 && (
        <div>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Lo que se produjo (entra al stock de elaborados)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {datos.producido.map((p) => (
              <Pastilla key={p.insumo_id || p.titulo} style={{ fontSize: 12.5, padding: '6px 10px' }}>
                {p.titulo}: <b style={{ color: T.ink }}>{p.rinde != null ? fmtCant(p.rinde, p.unidad) : '—'}</b> · {fmtTandas(p.tandas)} tandas
              </Pastilla>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
