// src/componentes/produccion/ProgramarModal.jsx
// Programar producción: un elaborado (o una tarea libre), cuántas tandas, uno o varios días de la
// semana, turno, responsable y plaza. Lo que el jefe dejó fijo para el elaborado (minutos por
// tanda, plaza y responsable de siempre) se propone solo.
import React, { useEffect, useMemo, useState } from 'react';
import { T, FB } from '@/componentes/ui/temaDiego';
import { Modal, Boton, Campo, Entrada, Selector, Texto } from './ui';
import { diaLargo, fmtTandas, fmtMin, unidadCorta } from './util';

const TANDAS = [0.5, 1, 1.5, 2, 3];

export default function ProgramarModal({ abierto, onCerrar, onGuardar, ctx, elaborados, dias, inicial, cel }) {
  const [tipo, setTipo] = useState('produccion');
  const [buscar, setBuscar] = useState('');
  const [insumoId, setInsumoId] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [tandas, setTandas] = useState('1');
  const [fechas, setFechas] = useState([]);
  const [turno, setTurno] = useState('');
  const [resp, setResp] = useState('');
  const [plaza, setPlaza] = useState('');
  const [minutos, setMinutos] = useState('');
  const [minTocado, setMinTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setTipo('produccion'); setBuscar(''); setInsumoId(null); setTitulo(''); setTandas('1'); setError('');
    setFechas(inicial?.fecha ? [inicial.fecha] : []);
    setTurno(inicial?.turno_id ? String(inicial.turno_id) : String(ctx?.turnos?.[0]?.id ?? ''));
    setResp(inicial?.responsable_user_id ? String(inicial.responsable_user_id) : '');
    setPlaza(inicial?.plaza_id ? String(inicial.plaza_id) : '');
    setMinutos(''); setMinTocado(false);
  }, [abierto, inicial, ctx]);

  const elab = useMemo(() => elaborados.find((e) => e.insumo_id === insumoId) || null, [elaborados, insumoId]);
  const k = Number(String(tandas).replace(',', '.'));

  // Al elegir el elaborado: su plaza/responsable de siempre (si la celda no los fijó) y el estimado.
  useEffect(() => {
    if (!elab) return;
    if (!inicial?.responsable_user_id && elab.responsable_user_id) setResp(String(elab.responsable_user_id));
    if (!inicial?.plaza_id && elab.plaza_id) setPlaza(String(elab.plaza_id));
  }, [elab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (minTocado) return;
    const base = elab?.minutos_tanda ?? elab?.minutos_reales_tanda;
    setMinutos(base != null && k > 0 ? String(Math.round(base * k)) : '');
  }, [elab, k, minTocado]);

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const l = q ? elaborados.filter((e) => `${e.nombre} ${e.rubro || ''}`.toLowerCase().includes(q)) : elaborados;
    return l.slice(0, 60);
  }, [buscar, elaborados]);

  const equipo = (ctx?.equipo || []).map((u) => ({ value: String(u.id), label: `${u.nombre}${u.jefe ? ' · jefe' : u.rol !== 'staff' ? ` · ${u.rol === 'owner' ? 'dueño' : 'admin'}` : ''}` }));
  const toggleFecha = (d) => setFechas((f) => (f.includes(d) ? f.filter((x) => x !== d) : [...f, d].sort()));

  const valido = fechas.length > 0 && (tipo === 'produccion' ? insumoId && k > 0 : tipo === 'mise_en_place' ? !!plaza : titulo.trim());
  const guardar = async () => {
    if (!valido) return;
    setGuardando(true); setError('');
    const base = {
      turno_id: Number(turno) || null, responsable_user_id: Number(resp) || null, plaza_id: Number(plaza) || null,
      minutos_estimados: minutos === '' ? null : Number(minutos),
      ...(tipo === 'produccion' ? { insumo_id: insumoId, tandas: k } : tipo === 'mise_en_place' ? { tipo: 'mise_en_place' } : { titulo: titulo.trim() }),
    };
    const err = await onGuardar(fechas.map((fecha) => ({ ...base, fecha })));
    setGuardando(false);
    if (err) setError(err); else onCerrar();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Programar producción" cel={cel} ancho={620}
      pie={<>
        {error && <span style={{ color: T.bad, fontFamily: FB, fontSize: 12.5, marginRight: 'auto' }}>{error}</span>}
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton primario deshabilitado={!valido || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : fechas.length > 1 ? `Programar ${fechas.length} días` : 'Programar'}
        </Boton>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Boton activo={tipo === 'produccion'} onClick={() => setTipo('produccion')}>Elaborado</Boton>
          <Boton activo={tipo === 'mise_en_place'} onClick={() => setTipo('mise_en_place')}>Mise en place</Boton>
          <Boton activo={tipo === 'otra'} onClick={() => setTipo('otra')}>Otra tarea</Boton>
        </div>

        {tipo === 'produccion' ? (
          <Campo label="Elaborado">
            {elab ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${T.border2}`, borderRadius: 10, background: T.head }}>
                <div style={{ flex: 1, fontFamily: FB }}>
                  <div style={{ fontWeight: 600, color: T.text, fontSize: 14 }}>{elab.nombre}</div>
                  <div style={{ fontSize: 11.5, color: T.text3 }}>
                    {elab.rubro || 'Sin rubro'}{elab.rinde_tanda != null && ` · 1 tanda rinde ${elab.rinde_tanda} ${unidadCorta(elab.unidad)}`}
                    {elab.tandas_semana ? ` · suele hacerse ${fmtTandas(elab.tandas_semana)} por semana` : ''}
                  </div>
                </div>
                <Boton chico onClick={() => setInsumoId(null)}>Cambiar</Boton>
              </div>
            ) : (
              <>
                <Entrada autoFocus placeholder={`Buscar entre ${elaborados.length} elaborados con receta…`} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                <div style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4 }}>
                  {!filtrados.length && <Texto sutil style={{ padding: 12 }}>No hay elaborados con receta que coincidan.</Texto>}
                  {filtrados.map((e) => (
                    <div key={e.insumo_id} onClick={() => setInsumoId(e.insumo_id)}
                      style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, fontFamily: FB, display: 'flex', gap: 8 }}>
                      <span style={{ flex: 1, color: T.text, fontSize: 13.5 }}>{e.nombre}</span>
                      <span style={{ color: T.text3, fontSize: 11.5 }}>{e.rubro || ''}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Campo>
        ) : tipo === 'mise_en_place' ? (
          <Texto sutil>Armar la plaza al empezar el turno. Lo que se deja (sal, aceite, salsas…) sale de la plantilla de la plaza y cuenta como consumo al terminar.</Texto>
        ) : (
          <Campo label="Qué hay que hacer" ayuda="Para tareas que no son un elaborado: limpiar la cámara, armar un pedido…">
            <Entrada autoFocus value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Limpieza de cámara" />
          </Campo>
        )}

        {tipo === 'produccion' && (
          <Campo label="Tandas" ayuda={elab?.rinde_tanda != null && k > 0 ? `Rinde ${(elab.rinde_tanda * k).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unidadCorta(elab.unidad)}` : '1 tanda = la receta completa'}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {TANDAS.map((n) => <Boton key={n} chico activo={k === n} onClick={() => setTandas(String(n))}>{fmtTandas(n)}</Boton>)}
              <Entrada inputMode="decimal" value={tandas} onChange={(e) => setTandas(e.target.value)} style={{ width: 80 }} aria-label="Otra cantidad de tandas" />
            </div>
          </Campo>
        )}

        <Campo label="Días" ayuda="Podés elegir varios: se crea una tarea por día.">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {dias.map((d) => <Boton key={d} chico activo={fechas.includes(d)} onClick={() => toggleFecha(d)}>{diaLargo(d)}</Boton>)}
          </div>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Campo label="Turno">
            <Selector value={turno} onChange={setTurno} vacio="Sin turno" opciones={(ctx?.turnos || []).map((t) => ({ value: String(t.id), label: `${t.nombre}${t.desde ? ` (${t.desde}${t.hasta ? `–${t.hasta}` : ''})` : ''}` }))} />
          </Campo>
          <Campo label="Responsable">
            <Selector value={resp} onChange={setResp} vacio="Sin asignar (la toma quien pueda)" opciones={equipo} />
          </Campo>
          <Campo label={tipo === 'mise_en_place' ? 'Plaza (obligatoria)' : 'Plaza'}>
            <Selector value={plaza} onChange={setPlaza} vacio="Sin plaza" opciones={(ctx?.plazas || []).map((p) => ({ value: String(p.id), label: p.sector ? `${p.nombre} · ${p.sector}` : p.nombre }))} />
          </Campo>
          <Campo label="Tiempo estimado (min)" ayuda={minutos ? fmtMin(minutos) : 'Lo organiza el jefe; se aprende de lo que se va produciendo.'}>
            <Entrada inputMode="numeric" value={minutos} onChange={(e) => { setMinTocado(true); setMinutos(e.target.value.replace(/[^\d]/g, '')); }} placeholder="Ej.: 45" />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}
