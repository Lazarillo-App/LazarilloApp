// src/componentes/super/SuperTablero.jsx
// Tablero de tareas del equipo (usuaria 13/11/2026): Mairene y Diego anotan pendientes, los pasan
// de "Pendiente" a "En curso" y "Hecha", los editan y les dejan notas. Con el tema de Diego.
// En la compu se ven las tres columnas; en el celular, una por vez con los botones de arriba.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, useMediaQuery } from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const COLUMNAS = [
  { k: 'pendiente', l: 'Pendiente', color: T.warn },
  { k: 'en_curso', l: 'En curso', color: T.accentTxt },
  { k: 'hecha', l: 'Hecha', color: T.ok },
];
const PRIORIDADES = [
  { k: 'alta', l: 'Alta', color: T.bad },
  { k: 'normal', l: 'Normal', color: T.accentTxt },
  { k: 'baja', l: 'Baja', color: T.text3 },
];
const SIGUIENTE = { pendiente: 'en_curso', en_curso: 'hecha' };
const ERRORES = { titulo_vacio: 'Poné un título', nota_vacia: 'La nota está vacía', no_es_tuya: 'Solo podés borrar tus notas' };
const errorDe = (e) => ERRORES[String(e?.message || '').split(':')[0]] || 'No se pudo guardar';

const fecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};
const primerNombre = (s) => String(s || '').split(/[\s@]/)[0] || '';
const inicial = (s) => (primerNombre(s)[0] || '?').toUpperCase();

/* ───────── piezas chicas ───────── */
const Boton = ({ children, onClick, activo, peligro, deshabilitado, grande, title, color }) => (
  <button type="button" onClick={deshabilitado ? undefined : onClick} title={title} style={{
    fontFamily: FB, fontWeight: 700, fontSize: grande ? 14 : 12.5, padding: grande ? '9px 16px' : '6px 12px',
    borderRadius: 10, cursor: deshabilitado ? 'default' : 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${peligro ? T.bad + '88' : activo ? (color || T.accent) : T.border2}`,
    background: activo ? (color ? color + '18' : T.accent) : 'transparent',
    color: deshabilitado ? T.text3 : peligro ? T.bad : activo ? (color || T.ink) : T.text2,
    opacity: deshabilitado ? 0.5 : 1,
  }}>{children}</button>
);
const Etiqueta = ({ color, children, title }) => (
  <span title={title} style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FB, fontSize: 11, fontWeight: 700, color,
    border: `1px solid ${color}55`, background: color + '12', borderRadius: 7, padding: '1px 7px', whiteSpace: 'nowrap',
  }}>{children}</span>
);
const Avatar = ({ nombre, tam = 22 }) => (
  <span title={nombre || 'Sin asignar'} style={{
    width: tam, height: tam, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FT, fontSize: tam * 0.5, fontWeight: 700, flexShrink: 0,
    background: nombre ? T.accent : 'transparent', color: nombre ? T.ink : T.text3,
    border: nombre ? 'none' : `1px dashed ${T.border2}`,
  }}>{nombre ? inicial(nombre) : '·'}</span>
);
const campo = {
  width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 14, color: T.text,
  border: `1px solid ${T.border2}`, borderRadius: 10, padding: '9px 12px', background: T.band, outline: 'none',
};

/* ───────── tarjeta ───────── */
function Tarjeta({ t, onAbrir, onAvanzar }) {
  const pr = PRIORIDADES.find((p) => p.k === t.prioridad) || PRIORIDADES[1];
  const hecha = t.estado === 'hecha';
  return (
    <div onClick={() => onAbrir(t.id)} style={{
      background: T.band, border: `1px solid ${T.border}`, borderLeft: `3px solid ${hecha ? T.ok : pr.color}`,
      borderRadius: 12, padding: '10px 12px', cursor: 'pointer', boxShadow: T.sombraSuave,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: FT, fontSize: 13.5, fontWeight: 600, color: hecha ? T.text3 : T.text,
          textDecoration: hecha ? 'line-through' : 'none', wordBreak: 'break-word' }}>{t.titulo}</div>
        {SIGUIENTE[t.estado] && (
          <button type="button" title={t.estado === 'pendiente' ? 'Empezar' : 'Marcar como hecha'}
            onClick={(e) => { e.stopPropagation(); onAvanzar(t); }}
            style={{ border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 8, cursor: 'pointer',
              width: 28, height: 28, flexShrink: 0, color: t.estado === 'pendiente' ? T.accentTxt : T.ok, fontSize: 14, lineHeight: 1 }}>
            {t.estado === 'pendiente' ? '▶' : '✓'}
          </button>
        )}
      </div>
      {t.detalle && (
        <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text2, marginTop: 4, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>{t.detalle}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Avatar nombre={t.asignado_nombre} />
        {!hecha && t.prioridad !== 'normal' && <Etiqueta color={pr.color}>{pr.l}</Etiqueta>}
        {t.notas > 0 && <Etiqueta color={T.text2} title="Notas">💬 {t.notas}</Etiqueta>}
        <span style={{ marginLeft: 'auto', fontFamily: FB, fontSize: 11, color: T.text3 }}>
          {hecha ? `hecha ${fecha(t.hecha_at).slice(0, 5)}` : fecha(t.updated_at).slice(0, 5)}
        </span>
      </div>
    </div>
  );
}

/* ───────── detalle (pantalla completa en el celu) ───────── */
function Detalle({ id, equipo, yo, onCerrar, onCambio, onBorrada }) {
  const movil = useMediaQuery('(max-width:700px)');
  const [t, setT] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    SuperAPI.tarea(id).then((r) => {
      if (!vivo) return;
      setT(r.tarea); setTitulo(r.tarea.titulo); setDetalle(r.tarea.detalle || '');
    }).catch(() => { showAlert('No se pudo abrir la tarea', 'error'); onCerrar(); });
    return () => { vivo = false; };
  }, [id, onCerrar]);

  const aplicar = (r) => { setT(r.tarea); onCambio(r.tarea); };
  const cambiar = async (cambios) => {
    setGuardando(true);
    try { aplicar(await SuperAPI.actualizarTarea(id, cambios)); } catch (e) { showAlert(errorDe(e), 'error'); } finally { setGuardando(false); }
  };
  const textoCambiado = t && (titulo.trim() !== t.titulo || (detalle.trim() || '') !== (t.detalle || ''));
  const guardarTexto = () => cambiar({ titulo, detalle });
  const agregarNota = async () => {
    if (!nota.trim()) return;
    setGuardando(true);
    try { aplicar(await SuperAPI.notaTarea(id, nota)); setNota(''); } catch (e) { showAlert(errorDe(e), 'error'); } finally { setGuardando(false); }
  };
  const borrarNota = async (n) => {
    if (!(await showConfirm('¿Borrar esta nota?', { danger: true }))) return;
    try { aplicar(await SuperAPI.borrarNotaTarea(id, n.id)); } catch (e) { showAlert(errorDe(e), 'error'); }
  };
  const borrar = async () => {
    if (!(await showConfirm(`¿Borrar la tarea "${t.titulo}" con sus notas? No se puede deshacer.`, { danger: true, confirmText: 'Borrar' }))) return;
    try { await SuperAPI.borrarTarea(id); onBorrada(id); } catch (e) { showAlert(errorDe(e), 'error'); }
  };

  const seccion = { fontFamily: FB, fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '16px 0 6px' };

  return (
    <Dialog open onClose={onCerrar} fullScreen={movil} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: movil ? 0 : '16px', bgcolor: T.bg, boxShadow: T.sombra } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: T.band, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, flex: 1 }}>Tarea {t ? `#${t.id}` : ''}</span>
        {t && <Boton peligro onClick={borrar}>Borrar</Boton>}
        <Boton onClick={onCerrar}>Cerrar</Boton>
      </div>
      {!t ? <div style={{ padding: 24, fontFamily: FB, color: T.text3 }}>Cargando…</div> : (
        <div style={{ padding: '8px 16px 20px', overflowY: 'auto' }}>
          <div style={seccion}>Título</div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} style={{ ...campo, fontFamily: FT, fontWeight: 600 }} />
          <div style={seccion}>Detalle</div>
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={4} placeholder="Qué hay que hacer, links, pasos…"
            style={{ ...campo, resize: 'vertical' }} />
          {textoCambiado && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Boton onClick={() => { setTitulo(t.titulo); setDetalle(t.detalle || ''); }}>Descartar</Boton>
              <Boton activo deshabilitado={guardando || !titulo.trim()} onClick={guardarTexto}>Guardar</Boton>
            </div>
          )}

          <div style={seccion}>Estado</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLUMNAS.map((c) => <Boton key={c.k} activo={t.estado === c.k} color={c.color} deshabilitado={guardando}
              onClick={() => t.estado !== c.k && cambiar({ estado: c.k })}>{c.l}</Boton>)}
          </div>
          <div style={seccion}>Prioridad</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRIORIDADES.map((p) => <Boton key={p.k} activo={t.prioridad === p.k} color={p.color} deshabilitado={guardando}
              onClick={() => t.prioridad !== p.k && cambiar({ prioridad: p.k })}>{p.l}</Boton>)}
          </div>
          <div style={seccion}>Quién la hace</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Boton activo={!t.asignado_a} deshabilitado={guardando} onClick={() => t.asignado_a && cambiar({ asignado_a: null })}>Nadie todavía</Boton>
            {equipo.map((u) => (
              <Boton key={u.id} activo={String(t.asignado_a) === String(u.id)} deshabilitado={guardando}
                onClick={() => String(t.asignado_a) !== String(u.id) && cambiar({ asignado_a: u.id })}>
                {primerNombre(u.display_name || u.name || u.email)}{String(u.id) === String(yo) ? ' (vos)' : ''}
              </Boton>
            ))}
          </div>
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 14 }}>
            Creada por {primerNombre(t.creado_nombre) || '—'} el {fecha(t.created_at)}
            {t.hecha_at ? ` · hecha por ${primerNombre(t.hecha_nombre) || '—'} el ${fecha(t.hecha_at)}` : ''}
          </div>

          <div style={seccion}>Notas {t.lista_notas.length ? `(${t.lista_notas.length})` : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {t.lista_notas.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Avatar nombre={n.autor} tam={26} />
                <div style={{ flex: 1, minWidth: 0, background: T.band, border: `1px solid ${T.border}`, borderRadius: 12, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: FT, fontSize: 12, fontWeight: 700, color: T.text }}>{primerNombre(n.autor)}</span>
                    <span style={{ fontFamily: FB, fontSize: 11, color: T.text3 }}>{fecha(n.created_at)}</span>
                    {String(n.autor_id) === String(yo) && (
                      <button type="button" onClick={() => borrarNota(n)} title="Borrar nota"
                        style={{ marginLeft: 'auto', border: 'none', background: 'none', color: T.text3, cursor: 'pointer', fontSize: 12 }}>✕</button>
                    )}
                  </div>
                  <div style={{ fontFamily: FB, fontSize: 13.5, color: T.text2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{n.texto}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Escribí una nota…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregarNota(); }}
              style={{ ...campo, resize: 'vertical', flex: 1 }} />
            <Boton grande activo deshabilitado={guardando || !nota.trim()} onClick={agregarNota}>Enviar</Boton>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ───────── tablero ───────── */
export default function SuperTablero({ tareaInicial = null }) {
  const movil = useMediaQuery('(max-width:700px)');
  const [tareas, setTareas] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [yo, setYo] = useState(null);
  const [nueva, setNueva] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [colMovil, setColMovil] = useState('pendiente');
  const [abierta, setAbierta] = useState(tareaInicial);
  const [creando, setCreando] = useState(false);

  useEffect(() => { cargarFuentes(); }, []);
  const cargar = useCallback(() => SuperAPI.tareas().then((r) => setTareas(r.tareas || [])).catch(() => setTareas([])), []);
  useEffect(() => {
    cargar();
    SuperAPI.superusuarios().then((r) => { setEquipo(r?.usuarios || []); setYo(r?.yo ?? null); }).catch(() => {});
  }, [cargar]);

  const reemplazar = useCallback((t) => setTareas((ls) => (ls || []).map((x) => (x.id === t.id ? { ...x, ...t } : x))), []);
  const cerrar = useCallback(() => { setAbierta(null); cargar(); }, [cargar]);

  const crear = async () => {
    const titulo = nueva.trim();
    if (!titulo) return;
    setCreando(true);
    try {
      const r = await SuperAPI.crearTarea({ titulo, estado: movil ? colMovil : 'pendiente' });
      setTareas((ls) => [r.tarea, ...(ls || [])]);
      setNueva('');
    } catch (e) { showAlert(errorDe(e), 'error'); } finally { setCreando(false); }
  };
  const avanzar = async (t) => {
    try { reemplazar((await SuperAPI.actualizarTarea(t.id, { estado: SIGUIENTE[t.estado] })).tarea); } catch (e) { showAlert(errorDe(e), 'error'); }
  };

  const visibles = useMemo(() => (tareas || []).filter((t) => (
    filtro === 'mias' ? String(t.asignado_a) === String(yo) : filtro === 'nadie' ? !t.asignado_a : true
  )), [tareas, filtro, yo]);
  const porColumna = (k) => visibles.filter((t) => t.estado === k);

  const columna = (c) => {
    const lista = porColumna(c.k);
    return (
      <div key={c.k} style={{ background: T.card, borderRadius: 14, padding: 10, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!movil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            <span style={{ fontFamily: FT, fontSize: 13, fontWeight: 700, color: T.text }}>{c.l}</span>
            <span style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>{lista.length}</span>
          </div>
        )}
        {lista.map((t) => <Tarjeta key={t.id} t={t} onAbrir={setAbierta} onAvanzar={avanzar} />)}
        {!lista.length && <div style={{ fontFamily: FB, fontSize: 12.5, color: T.vacio, textAlign: 'center', padding: '18px 0' }}>Nada por acá</div>}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FB, color: T.text }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
          placeholder="Anotá una tarea nueva y apretá Enter" style={{ ...campo, flex: 1 }} />
        <Boton grande activo deshabilitado={creando || !nueva.trim()} onClick={crear}>Agregar</Boton>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['todas', 'Todas'], ['mias', 'Las mías'], ['nadie', 'Sin asignar']].map(([k, l]) => (
          <Boton key={k} activo={filtro === k} onClick={() => setFiltro(k)}>{l}</Boton>
        ))}
      </div>

      {tareas === null ? <div style={{ color: T.text3, padding: 12 }}>Cargando…</div> : movil ? (
        <>
          <div style={{ display: 'flex', background: T.card, borderRadius: 12, padding: 4, gap: 4, marginBottom: 10 }}>
            {COLUMNAS.map((c) => {
              const act = colMovil === c.k;
              return (
                <button key={c.k} type="button" onClick={() => setColMovil(c.k)} style={{
                  flex: 1, border: 'none', borderRadius: 9, padding: '8px 4px', cursor: 'pointer',
                  background: act ? T.band : 'transparent', boxShadow: act ? T.sombraSuave : 'none',
                  fontFamily: FT, fontSize: 12.5, fontWeight: 700, color: act ? c.color : T.text2,
                }}>{c.l} <span style={{ fontFamily: FB, fontWeight: 600, color: T.text3 }}>{porColumna(c.k).length}</span></button>
              );
            })}
          </div>
          {columna(COLUMNAS.find((c) => c.k === colMovil))}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'start' }}>
          {COLUMNAS.map(columna)}
        </div>
      )}

      {abierta && (
        <Detalle id={abierta} equipo={equipo} yo={yo} onCerrar={cerrar} onCambio={reemplazar}
          onBorrada={(id) => { setTareas((ls) => (ls || []).filter((x) => x.id !== id)); setAbierta(null); }} />
      )}
    </div>
  );
}
