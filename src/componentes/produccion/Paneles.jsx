// src/componentes/produccion/Paneles.jsx
// Lo del jefe / dueño / admin alrededor de la semana:
//  · TurnosModal: cada negocio arma sus turnos (Mañana, Tarde, Noche…)
//  · Estimados: minutos por tanda de cada elaborado + plaza y responsable de siempre
//  · Cambios: los cambios de ingrediente que esperan aprobación
//  · PanelGeneral: quién hizo qué y en cuánto tiempo (estimado contra real)
import React, { useEffect, useMemo, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Modal, Boton, Entrada, Selector, Texto, Vacio, Pastilla } from './ui';
import { fmtMin, fmtTandas, textoTandas, fmtCant, diaLargo, unidadCorta, textoError } from './util';

export function TurnosModal({ abierto, onCerrar, businessId, turnos, onCambio, cel }) {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { if (abierto) { setLista((turnos || []).map((t) => ({ ...t }))); setError(''); } }, [abierto, turnos]);
  const set = (i, k, v) => setLista((l) => l.map((t, j) => (j === i ? { ...t, [k]: v, sucio: true } : t)));
  const guardar = async () => {
    try {
      for (const [i, t] of lista.entries()) {
        if (t.borrar && t.id) await ProduccionAPI.borrarTurno(businessId, t.id);
        else if (!t.borrar && t.nombre?.trim() && (t.sucio || !t.id)) await ProduccionAPI.guardarTurno(businessId, { id: t.id, nombre: t.nombre.trim(), desde: t.desde, hasta: t.hasta, orden: i });
      }
      onCambio(); onCerrar();
    } catch (e) { setError(textoError(e)); }
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Turnos de producción" cel={cel} ancho={520}
      pie={<>{error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton><Boton primario onClick={guardar}>Guardar</Boton></>}>
      <Texto sutil style={{ marginBottom: 10 }}>Armalos como trabaja tu cocina. Si borrás uno, sus tareas quedan «sin turno».</Texto>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((t, i) => !t.borrar && (
          <div key={t.id ?? `n${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Entrada value={t.nombre || ''} maxLength={40} onChange={(e) => set(i, 'nombre', e.target.value)} placeholder="Nombre" style={{ flex: 1 }} />
            <Entrada value={t.desde || ''} onChange={(e) => set(i, 'desde', e.target.value)} placeholder="08:00" style={{ width: 74 }} aria-label="Desde" />
            <Entrada value={t.hasta || ''} onChange={(e) => set(i, 'hasta', e.target.value)} placeholder="15:00" style={{ width: 74 }} aria-label="Hasta" />
            <Boton chico peligro title="Borrar turno" onClick={() => set(i, 'borrar', true)}>✕</Boton>
          </div>
        ))}
        <div><Boton chico onClick={() => setLista((l) => [...l, { nombre: '', desde: '', hasta: '' }])}>+ Turno</Boton></div>
      </div>
    </Modal>
  );
}

export function Estimados({ businessId, elaborados, ctx, onCambio, cel }) {
  const [q, setQ] = useState('');
  const [guardando, setGuardando] = useState(null);
  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? elaborados.filter((e) => `${e.nombre} ${e.rubro || ''}`.toLowerCase().includes(s)) : elaborados;
  }, [q, elaborados]);
  const guardar = async (e, cambios) => {
    setGuardando(e.insumo_id);
    try {
      await ProduccionAPI.guardarElaborado(businessId, e.insumo_id, {
        minutos_tanda: e.minutos_tanda, plaza_id: e.plaza_id, responsable_user_id: e.responsable_user_id, dias_vida: e.dias_vida, ...cambios,
      });
      onCambio();
    } finally { setGuardando(null); }
  };
  if (!elaborados.length) return <Vacio titulo="No hay elaborados con receta">Cargá la receta de tus elaborados en Insumos para poder programarlos.</Vacio>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <Entrada value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Buscar elaborado…" style={{ maxWidth: 320 }} />
        <Texto sutil style={{ fontSize: 12 }}>El estimado es por tanda: al programar se multiplica por las tandas. «Real» sale de lo ya producido.</Texto>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FB, fontSize: 13, minWidth: cel ? 640 : 0 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: T.text3, fontSize: 11.5 }}>
              <th style={{ padding: 8 }}>Elaborado</th><th style={{ padding: 8 }}>Rinde / tanda</th><th style={{ padding: 8 }}>Min / tanda</th>
              <th style={{ padding: 8 }}>Real</th><th style={{ padding: 8 }}>Por semana</th><th style={{ padding: 8 }} title="Para el vencimiento de la etiqueta">Vida útil (días)</th><th style={{ padding: 8 }}>Plaza</th><th style={{ padding: 8 }}>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.insumo_id} style={{ borderTop: `1px solid ${T.border}`, opacity: guardando === e.insumo_id ? 0.6 : 1 }}>
                <td style={{ padding: 8 }}><div style={{ color: T.text, fontWeight: 600 }}>{e.nombre}</div><div style={{ color: T.text3, fontSize: 11.5 }}>{e.rubro || ''}</div></td>
                <td style={{ padding: 8, color: T.text2 }}>{e.rinde_tanda != null ? `${e.rinde_tanda} ${unidadCorta(e.unidad)}` : '—'}</td>
                <td style={{ padding: 8 }}>
                  <Entrada inputMode="numeric" defaultValue={e.minutos_tanda ?? ''} style={{ width: 80 }} aria-label={`Minutos por tanda de ${e.nombre}`}
                    onBlur={(ev) => { const v = ev.target.value.trim() === '' ? null : Number(ev.target.value); if (v !== e.minutos_tanda) guardar(e, { minutos_tanda: v }); }} />
                </td>
                <td style={{ padding: 8, color: e.minutos_reales_tanda != null && e.minutos_tanda != null && e.minutos_reales_tanda > e.minutos_tanda * 1.15 ? T.warn : T.text2 }}>
                  {e.minutos_reales_tanda != null ? fmtMin(e.minutos_reales_tanda) : '—'}
                </td>
                <td style={{ padding: 8, color: T.text2 }}>{e.tandas_semana ? `${fmtTandas(e.tandas_semana)} tandas` : '—'}</td>
                <td style={{ padding: 8 }}>
                  <Entrada inputMode="numeric" defaultValue={e.dias_vida ?? ''} style={{ width: 70 }} aria-label={`Días de vida útil de ${e.nombre}`}
                    onBlur={(ev) => { const v = ev.target.value.trim() === '' ? null : Number(ev.target.value); if (v !== e.dias_vida) guardar(e, { dias_vida: v }); }} />
                </td>
                <td style={{ padding: 8 }}>
                  <Selector value={e.plaza_id ? String(e.plaza_id) : ''} vacio="—" style={{ minWidth: 120 }}
                    opciones={(ctx?.plazas || []).map((p) => ({ value: String(p.id), label: p.nombre }))} onChange={(v) => guardar(e, { plaza_id: Number(v) || null })} />
                </td>
                <td style={{ padding: 8 }}>
                  <Selector value={e.responsable_user_id ? String(e.responsable_user_id) : ''} vacio="—" style={{ minWidth: 130 }}
                    opciones={(ctx?.equipo || []).map((u) => ({ value: String(u.id), label: u.nombre }))} onChange={(v) => guardar(e, { responsable_user_id: Number(v) || null })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Cambios({ cambios, onAbrir, onDecidir, onAprobaciones }) {
  if (!cambios.length) return <Vacio emoji="✅" titulo="No hay cambios para aprobar">Cuando un cocinero cambie un ingrediente (no había, usó otro u otra cantidad), aparece acá.</Vacio>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cambios.map((c) => (
        <div key={c.id} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, fontFamily: FB, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, color: T.text, fontSize: 14, cursor: 'pointer' }} onClick={() => onAbrir(c.tarea_id)}>
              {c.titulo} <span style={{ fontWeight: 400, color: T.text3, fontSize: 12 }}>· {diaLargo(c.fecha)} · {textoTandas(c.tandas)} · {c.responsable || 'sin asignar'}</span>
            </div>
            <div style={{ fontSize: 13.5, color: T.text2, marginTop: 4 }}>
              {c.agregado ? <>Agregó <b>{c.nombre_real || c.nombre} {fmtCant(c.cantidad_real, c.unidad_real)}</b></>
                : c.falta ? <>No había <b>{c.nombre}</b> ({fmtCant(c.cantidad, c.unidad)})</>
                  : <><b>{c.nombre} {fmtCant(c.cantidad, c.unidad)}</b> → <b>{c.nombre_real || c.nombre} {fmtCant(c.cantidad_real ?? c.cantidad, c.unidad_real || c.unidad)}</b></>}
            </div>
            {c.motivo && <div style={{ fontSize: 12.5, color: T.text3, marginTop: 2 }}>«{c.motivo}»</div>}
            <div style={{ marginTop: 6 }}>
              {c.alcance === 'receta'
                ? <Pastilla color={T.violet} fondo="#F1EBFE">Cambio de receta (permanente)</Pastilla>
                : <Pastilla>Solo esta producción</Pastilla>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {c.alcance === 'receta' ? <Boton chico onClick={onAprobaciones}>Ver en Aprobaciones ›</Boton> : <>
              <Boton chico onClick={() => onDecidir(c, 'aprobado')}>✓ Aprobar</Boton>
              <Boton chico peligro onClick={() => onDecidir(c, 'rechazado')}>Rechazar</Boton>
            </>}
          </div>
        </div>
      ))}
      <Texto sutil style={{ fontSize: 12 }}>«Solo esta producción» se decide acá. Los cambios de receta se deciden en Aprobaciones, con el antes, el después y el costo.</Texto>
    </div>
  );
}

function Kpi({ label, valor, sub, color }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: '12px 14px', minWidth: 140, flex: 1 }}>
      <div style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>{label}</div>
      <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 22, color: color || T.ink }}>{valor}</div>
      {sub && <div style={{ fontFamily: FB, fontSize: 11.5, color: T.text3 }}>{sub}</div>}
    </div>
  );
}
const desvio = (real, est) => (est > 0 && real > 0 ? Math.round(((real - est) / est) * 100) : null);
const txtDesvio = (d) => (d == null ? '—' : `${d > 0 ? '+' : ''}${d}%`);
const colorDesvio = (d) => (d == null ? T.text3 : d > 15 ? T.warn : d < -15 ? T.accentTxt : T.ok);

export function PanelGeneral({ datos, cel }) {
  if (!datos) return <Texto sutil>Cargando…</Texto>;
  const { total, personas, elaborados } = datos;
  if (!total.tareas) return <Vacio emoji="📊" titulo="Sin tareas en esta semana">Cuando se programen y se hagan tareas, acá ves quién hizo qué y en cuánto tiempo.</Vacio>;
  const dT = desvio(total.minutos_reales, total.estimado_de_hechas);
  const celda = { padding: 8, borderTop: `1px solid ${T.border}` };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Kpi label="Hechas" valor={`${total.hechas} / ${total.tareas - total.canceladas}`} sub={`${total.pendientes} pendientes · ${total.en_curso} en curso`} />
        <Kpi label="Tiempo real" valor={fmtMin(total.minutos_reales)} sub={`estimado ${fmtMin(total.estimado_de_hechas)} para lo hecho`} />
        <Kpi label="Contra el estimado" valor={txtDesvio(dT)} color={colorDesvio(dT)} sub="+ = tardaron más" />
        <Kpi label="Con cambios" valor={total.cambios} sub="tareas con ingredientes cambiados" color={total.cambios ? T.warn : T.ink} />
      </div>
      <div>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Por persona</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FB, fontSize: 13, minWidth: cel ? 560 : 0 }}>
            <thead><tr style={{ textAlign: 'left', color: T.text3, fontSize: 11.5 }}>
              <th style={{ padding: 8 }}>Persona</th><th style={{ padding: 8 }}>Hechas</th><th style={{ padding: 8 }}>Pendientes</th>
              <th style={{ padding: 8 }}>Tiempo real</th><th style={{ padding: 8 }}>Estimado</th><th style={{ padding: 8 }}>Desvío</th><th style={{ padding: 8 }}>Cambios</th>
            </tr></thead>
            <tbody>{personas.map((p) => {
              const d = desvio(p.minutos_reales, p.estimado_de_hechas);
              return (
                <tr key={p.user_id ?? 0}>
                  <td style={{ ...celda, color: T.text, fontWeight: 600 }}>{p.nombre}</td>
                  <td style={celda}>{p.hechas}</td><td style={celda}>{p.pendientes + p.en_curso}</td>
                  <td style={celda}>{fmtMin(p.minutos_reales)}</td><td style={celda}>{fmtMin(p.estimado_de_hechas)}</td>
                  <td style={{ ...celda, color: colorDesvio(d), fontWeight: 700 }}>{txtDesvio(d)}</td>
                  <td style={celda}>{p.cambios || '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 6 }}>Por elaborado</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FB, fontSize: 13, minWidth: cel ? 620 : 0 }}>
            <thead><tr style={{ textAlign: 'left', color: T.text3, fontSize: 11.5 }}>
              <th style={{ padding: 8 }}>Elaborado</th><th style={{ padding: 8 }}>Tandas hechas</th><th style={{ padding: 8 }}>Tenía que rendir</th>
              <th style={{ padding: 8 }}>Rindió</th><th style={{ padding: 8 }}>Tiempo real</th><th style={{ padding: 8 }}>Desvío tiempo</th>
            </tr></thead>
            <tbody>{elaborados.map((e) => {
              const d = desvio(e.minutos_reales, e.estimado_de_hechas);
              const rindeMenos = e.rinde_esperado > 0 && e.rinde_real < e.rinde_esperado * 0.95;
              return (
                <tr key={e.insumo_id ?? e.titulo}>
                  <td style={{ ...celda, color: T.text, fontWeight: 600 }}>{e.titulo}</td>
                  <td style={celda}>{e.hechas ? fmtTandas(e.tandas) : '—'}</td>
                  <td style={celda}>{e.hechas && e.rinde_esperado ? `${Number(e.rinde_esperado).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unidadCorta(e.unidad)}` : '—'}</td>
                  <td style={{ ...celda, color: rindeMenos ? T.warn : T.text }}>
                    {e.hechas && e.rinde_real ? `${Number(e.rinde_real).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unidadCorta(e.unidad)}` : '—'}
                    {rindeMenos && <Pastilla color={T.warn} fondo="#FBF3E2" style={{ marginLeft: 6 }}>rindió menos</Pastilla>}
                  </td>
                  <td style={celda}>{e.hechas ? fmtMin(e.minutos_reales) : '—'}</td>
                  <td style={{ ...celda, color: colorDesvio(d), fontWeight: 700 }}>{txtDesvio(d)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


/** Equipo de cocina: qué áreas cubre cada cocinero. El jefe de cocina ve todos los artículos e
 *  insumos; al resto se le asignan áreas, y el jefe las cambia cuando hay que cubrir un puesto. */
export function EquipoAreas({ businessId, ctx, onCambio }) {
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState('');
  const sectores = ctx?.sectores || [];
  const gente = (ctx?.equipo || []).filter((u) => u.rol === 'staff');
  const toggle = async (u, sid) => {
    const ids = u.sector_ids.includes(sid) ? u.sector_ids.filter((x) => x !== sid) : [...u.sector_ids, sid];
    setGuardando(u.id); setError('');
    try { await ProduccionAPI.asignarAreas(businessId, u.id, ids); await onCambio(); } catch (e) { setError(textoError(e)); }
    finally { setGuardando(null); }
  };
  if (!gente.length) return <Vacio emoji="👩‍🍳" titulo="Todavía no hay staff">Invitá a tu equipo de cocina desde Equipo; al jefe dale el rol de jefe de cocina.</Vacio>;
  return (
    <div>
      <Texto sutil style={{ marginBottom: 10 }}>
        El <b>jefe de cocina</b> ve todos los artículos e insumos. A cada cocinero le asignás las áreas que cubre; cambialas cuando
        alguien tiene que cubrir otro puesto. Para una sola tarea no hace falta: asignásela directamente en la semana.
      </Texto>
      {error && <div style={{ color: T.bad, fontFamily: FB, fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {gente.map((u) => (
          <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: `1px solid ${T.border}`,
            borderRadius: 12, background: '#fff', opacity: guardando === u.id ? 0.6 : 1 }}>
            <div style={{ minWidth: 170, fontFamily: FB }}>
              <div style={{ fontWeight: 600, color: T.text }}>{u.nombre}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>{u.jefe ? 'Jefe de cocina · ve todo' : u.sector_ids.length ? `${u.sector_ids.length} área${u.sector_ids.length === 1 ? '' : 's'}` : 'Sin áreas: ve todo'}</div>
            </div>
            {u.jefe ? <Pastilla color={T.accentTxt} fondo="#E3F4FB">Todos los artículos e insumos</Pastilla> : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sectores.map((s) => (
                  <Boton key={s.id} chico activo={u.sector_ids.includes(s.id)} deshabilitado={!!guardando || !ctx.planifica} onClick={() => toggle(u, s.id)}>{s.nombre}</Boton>
                ))}
                {!sectores.length && <Texto sutil>No hay áreas creadas (Configuración › Sectores).</Texto>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
