// src/componentes/super/SuperTablero.jsx
// Pendientes de desarrollo (tablero de tareas del equipo, usuaria 13/11/2026; Diego 14/11/2026):
// la guía de trabajo de Diego, Mairene y Claude. Cada pendiente tiene módulo, negocio de donde
// viene (o «Todos»), prioridad en estrellas (★ a ★★★), quién lo hace, estado y un hilo de notas.
// Se ve como lista agrupada por módulo (el tablero de 3 columnas no escalaba con 50+ pendientes).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, useMediaQuery } from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { showConfirm } from '@/servicios/appConfirm';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

export const MODULOS = [
  ['tableros', 'Tableros'], ['resultados', 'Resultados'], ['compras', 'Compras y pagos'], ['recetas', 'Recetas'],
  ['stock', 'Stock'], ['rrhh', 'RRHH'], ['administracion', 'Administración'], ['conexiones', 'Conexiones y kit'],
  ['equipo', 'Usuarios y permisos'], ['celular', 'Celular'], ['super', 'Panel super'], ['general', 'General'],
];
const nombreModulo = (k) => MODULOS.find((m) => m[0] === k)?.[1] || 'General';

const ESTADOS = [
  { k: 'pendiente', l: 'Pendiente', color: T.warn },
  { k: 'en_curso', l: 'En curso', color: T.accentTxt },
  { k: 'hecha', l: 'Hecha', color: T.ok },
];
const estadoDe = (k) => ESTADOS.find((e) => e.k === k) || ESTADOS[0];
const SIGUIENTE = { pendiente: 'en_curso', en_curso: 'hecha', hecha: 'pendiente' };
const ESTRELLAS = { baja: 1, normal: 2, alta: 3 };
const PRIORIDAD_DE = { 1: 'baja', 2: 'normal', 3: 'alta' };
const ORDEN_ESTADO = { en_curso: 0, pendiente: 1, hecha: 2 };

const VISTAS = [['abiertas', 'Abiertas'], ['pendiente', 'Pendientes'], ['en_curso', 'En curso'], ['hecha', 'Hechas']];
const QUIEN = [['', 'Todos'], ['mias', 'Las mías'], ['nadie', 'Sin asignar']];

const ERRORES = { titulo_vacio: 'Poné un título', nota_vacia: 'La nota está vacía', no_es_tuya: 'Solo podés borrar tus notas' };
const errorDe = (e) => ERRORES[String(e?.message || '').split(':')[0]] || 'No se pudo guardar';
const fecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};
const diaMes = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '');
const primerNombre = (s) => String(s || '').split(/[\s@]/)[0] || '';
const inicial = (s) => (primerNombre(s)[0] || '?').toUpperCase();

const GUARDADO = 'lz.super.pendientes.filtros';
const leerFiltros = () => { try { return JSON.parse(localStorage.getItem(GUARDADO)) || {}; } catch { return {}; } };
const guardarFiltros = (f) => { try { localStorage.setItem(GUARDADO, JSON.stringify(f)); } catch { /* sin storage */ } };

const ALTO = 40;
const campo = {
  width: '100%', boxSizing: 'border-box', height: ALTO, fontFamily: FB, fontSize: 14, color: T.text,
  border: `1px solid ${T.border2}`, borderRadius: 10, padding: '0 12px', background: T.band, outline: 'none',
};
const area = { ...campo, height: 'auto', padding: '9px 12px', resize: 'vertical' };

/* ───────── piezas chicas ───────── */
const Boton = ({ children, onClick, primario, peligro, deshabilitado, title, sx }) => (
  <button type="button" onClick={deshabilitado ? undefined : onClick} title={title} style={{
    height: ALTO, padding: '0 16px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: FB, fontWeight: 700, fontSize: 13.5, cursor: deshabilitado ? 'default' : 'pointer',
    border: `1px solid ${primario ? T.accent : peligro ? T.bad + '88' : T.border2}`,
    background: primario ? T.accent : T.band, color: primario ? T.ink : peligro ? T.bad : T.text2,
    opacity: deshabilitado ? 0.45 : 1, ...sx,
  }}>{children}</button>
);

/** Grupo de opciones del mismo alto (estado, quién, prioridad en el detalle). */
function Segmentos({ opciones, valor, onCambio, deshabilitado, lleno }) {
  return (
    <div style={{ display: lleno ? 'flex' : 'inline-flex', width: lleno ? '100%' : undefined, height: ALTO, boxSizing: 'border-box', background: T.card, borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 }}>
      {opciones.map(([k, l, n]) => {
        const act = valor === k;
        return (
          <button key={k || 'todo'} type="button" disabled={deshabilitado} onClick={() => !act && onCambio(k)} style={{
            flex: lleno ? 1 : undefined, border: 'none', borderRadius: 8, padding: '0 12px', cursor: act ? 'default' : 'pointer', whiteSpace: 'nowrap',
            background: act ? T.band : 'transparent', boxShadow: act ? T.sombraSuave : 'none',
            fontFamily: FB, fontSize: 13, fontWeight: 700, color: act ? T.text : T.text2,
          }}>{l}{n !== undefined && <span style={{ marginLeft: 6, fontWeight: 600, color: T.text3 }}>{n}</span>}</button>
        );
      })}
    </div>
  );
}

const Selector = ({ valor, onCambio, children, ancho = 190, title }) => (
  <select value={valor} title={title} onChange={(e) => onCambio(e.target.value)}
    style={{ ...campo, width: ancho, flexShrink: 0, cursor: 'pointer', paddingRight: 8 }}>
    {children}
  </select>
);

/** ★★★ clickeables: tocar la 2ª deja ★★, tocar la que ya está marcada no cambia nada. */
function Estrellas({ prioridad, onCambio, tam = 17 }) {
  const n = ESTRELLAS[prioridad] || 2;
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3].map((i) => (
        <button key={i} type="button" title={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
          onClick={() => onCambio && i !== n && onCambio(PRIORIDAD_DE[i])}
          style={{ border: 'none', background: 'none', padding: 0, width: tam + 2, lineHeight: 1,
            cursor: onCambio ? 'pointer' : 'default', fontSize: tam, color: i <= n ? '#F2B53A' : T.border2 }}>★</button>
      ))}
    </span>
  );
}

const Avatar = ({ nombre, tam = 24 }) => (
  <span title={nombre || 'Sin asignar'} style={{
    width: tam, height: tam, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FT, fontSize: tam * 0.48, fontWeight: 700, flexShrink: 0,
    background: nombre ? T.accent : 'transparent', color: nombre ? T.ink : T.text3,
    border: nombre ? 'none' : `1px dashed ${T.border2}`, boxSizing: 'border-box',
  }}>{nombre ? inicial(nombre) : '·'}</span>
);

const ChipNegocio = ({ nombre }) => (
  <span title={nombre || 'Para todos los negocios'} style={{
    display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: FB, fontSize: 12, fontWeight: 700, borderRadius: 7, padding: '3px 8px', boxSizing: 'border-box',
    color: nombre ? T.accentTxt : T.text3, background: nombre ? T.accent + '1c' : T.card,
  }}>{nombre || 'Todos'}</span>
);

const ChipEstado = ({ estado, onClick }) => {
  const e = estadoDe(estado);
  return (
    <button type="button" title={onClick ? `Pasar a «${estadoDe(SIGUIENTE[estado]).l}»` : undefined}
      onClick={(ev) => { ev.stopPropagation(); onClick?.(); }}
      style={{ width: 92, height: 26, borderRadius: 13, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
        border: `1px solid ${e.color}55`, background: e.color + '14', color: e.color, fontFamily: FB, fontSize: 12, fontWeight: 700 }}>
      {e.l}
    </button>
  );
};

/* ───────── grilla de la lista ───────── */
const COLS = '78px minmax(0,1fr) 168px 52px 104px 52px';
const COLS_MOVIL = '62px minmax(0,1fr) 30px';
const titulo = { fontFamily: FB, fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' };

function Fila({ t, movil, onAbrir, onCambio }) {
  const hecha = t.estado === 'hecha';
  return (
    <div onClick={() => onAbrir(t.id)} style={{
      display: 'grid', gridTemplateColumns: movil ? COLS_MOVIL : COLS, alignItems: 'center', columnGap: 12,
      padding: '9px 14px', borderTop: `1px solid ${T.border}`, cursor: 'pointer', background: T.band,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.head; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = T.band; }}>
      <div style={{ textAlign: 'center' }}><Estrellas prioridad={t.prioridad} onCambio={(p) => onCambio(t, { prioridad: p })} tam={movil ? 15 : 17} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FT, fontSize: 13.5, fontWeight: 600, color: hecha ? T.text3 : T.text, textDecoration: hecha ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
        {movil ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoDe(t.estado).color, flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden' }}><ChipNegocio nombre={t.negocio} /></span>
          </div>
        ) : t.detalle ? (
          <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{t.detalle}</div>
        ) : null}
      </div>
      {!movil && <div style={{ textAlign: 'center', minWidth: 0 }}><ChipNegocio nombre={t.negocio} /></div>}
      <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar nombre={t.asignado_nombre} /></div>
      {!movil && <div style={{ display: 'flex', justifyContent: 'center' }}><ChipEstado estado={t.estado} onClick={() => onCambio(t, { estado: SIGUIENTE[t.estado] })} /></div>}
      {!movil && (
        <div style={{ textAlign: 'center', fontFamily: FB, fontSize: 11.5, color: T.text3 }} title={t.notas ? `${t.notas} notas` : undefined}>
          {t.notas > 0 ? `💬 ${t.notas}` : diaMes(t.updated_at)}
        </div>
      )}
    </div>
  );
}

/* ───────── formulario compartido (nueva y detalle) ───────── */
const seccion = { fontFamily: FB, fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '14px 0 6px' };

function CamposClasificacion({ modulo, negocio, prioridad, negocios, onCambio, deshabilitado }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      <div>
        <div style={seccion}>Módulo</div>
        <select value={modulo} disabled={deshabilitado} onChange={(e) => onCambio({ modulo: e.target.value })} style={{ ...campo, cursor: 'pointer' }}>
          {MODULOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div>
        <div style={seccion}>De qué negocio viene</div>
        <select value={negocio || ''} disabled={deshabilitado} onChange={(e) => onCambio({ business_id: e.target.value ? Number(e.target.value) : null })}
          style={{ ...campo, cursor: 'pointer' }}>
          <option value="">Todos (Lazarillo)</option>
          {negocios.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>
      <div>
        <div style={seccion}>Prioridad</div>
        <div style={{ ...campo, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.head }}>
          <Estrellas prioridad={prioridad} onCambio={deshabilitado ? null : (p) => onCambio({ prioridad: p })} tam={21} />
        </div>
      </div>
    </div>
  );
}

function Encabezado({ children, onCerrar }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: T.band, borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text, flex: 1 }}>{children}</span>
      <button type="button" onClick={onCerrar} title="Cerrar" style={{ width: ALTO, height: ALTO, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: T.text3 }}>✕</button>
    </div>
  );
}

function NuevaTarea({ negocios, moduloInicial, onCerrar, onCreada }) {
  const movil = useMediaQuery('(max-width:700px)');
  const [f, setF] = useState({ titulo: '', detalle: '', modulo: moduloInicial || 'general', business_id: null, prioridad: 'normal' });
  const [guardando, setGuardando] = useState(false);
  const crear = async () => {
    if (!f.titulo.trim()) return;
    setGuardando(true);
    try { onCreada((await SuperAPI.crearTarea(f)).tarea); } catch (e) { showAlert(errorDe(e), 'error'); setGuardando(false); }
  };
  return (
    <Dialog open onClose={onCerrar} fullScreen={movil} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: movil ? 0 : '16px', bgcolor: T.bg, boxShadow: T.sombra } }}>
      <Encabezado onCerrar={onCerrar}>Nuevo pendiente</Encabezado>
      <div style={{ padding: '4px 16px 0' }}>
        <div style={seccion}>Qué hay que hacer</div>
        <input autoFocus value={f.titulo} maxLength={200} onChange={(e) => setF({ ...f, titulo: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} style={{ ...campo, fontFamily: FT, fontWeight: 600 }} />
        <div style={seccion}>Detalle (opcional)</div>
        <textarea value={f.detalle} rows={3} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Contexto, pasos, links…" style={area} />
        <CamposClasificacion modulo={f.modulo} negocio={f.business_id} prioridad={f.prioridad} negocios={negocios}
          onCambio={(c) => setF({ ...f, ...c })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton primario deshabilitado={guardando || !f.titulo.trim()} onClick={crear}>Agregar</Boton>
      </div>
    </Dialog>
  );
}

function Detalle({ id, equipo, yo, negocios, onCerrar, onCambio, onBorrada }) {
  const movil = useMediaQuery('(max-width:700px)');
  const [t, setT] = useState(null);
  const [tituloTxt, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    SuperAPI.tarea(id).then((r) => {
      if (!vivo) return;
      setT(r.tarea); setTitulo(r.tarea.titulo); setDetalle(r.tarea.detalle || '');
    }).catch(() => { showAlert('No se pudo abrir el pendiente', 'error'); onCerrar(); });
    return () => { vivo = false; };
  }, [id, onCerrar]);

  const aplicar = (r) => { setT(r.tarea); onCambio(r.tarea); };
  const cambiar = async (cambios) => {
    setGuardando(true);
    try { aplicar(await SuperAPI.actualizarTarea(id, cambios)); } catch (e) { showAlert(errorDe(e), 'error'); } finally { setGuardando(false); }
  };
  const textoCambiado = t && (tituloTxt.trim() !== t.titulo || (detalle.trim() || '') !== (t.detalle || ''));
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
    if (!(await showConfirm(`¿Borrar «${t.titulo}» con sus notas? No se puede deshacer.`, { danger: true, confirmText: 'Borrar' }))) return;
    try { await SuperAPI.borrarTarea(id); onBorrada(id); } catch (e) { showAlert(errorDe(e), 'error'); }
  };

  return (
    <Dialog open onClose={onCerrar} fullScreen={movil} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: movil ? 0 : '16px', bgcolor: T.bg, boxShadow: T.sombra } }}>
      <Encabezado onCerrar={onCerrar}>{t ? `Pendiente #${t.id}` : 'Pendiente'}{t?.pedido_id ? ` · pedido #${t.pedido_id}` : ''}</Encabezado>
      {!t ? <div style={{ padding: 24, fontFamily: FB, color: T.text3 }}>Cargando…</div> : (
        <div style={{ padding: '4px 16px 16px', overflowY: 'auto' }}>
          <div style={seccion}>Qué hay que hacer</div>
          <input value={tituloTxt} onChange={(e) => setTitulo(e.target.value)} maxLength={200} style={{ ...campo, fontFamily: FT, fontWeight: 600 }} />
          <div style={seccion}>Detalle</div>
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={4} placeholder="Contexto, pasos, links…" style={area} />
          {textoCambiado && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Boton onClick={() => { setTitulo(t.titulo); setDetalle(t.detalle || ''); }}>Descartar</Boton>
              <Boton primario deshabilitado={guardando || !tituloTxt.trim()} onClick={() => cambiar({ titulo: tituloTxt, detalle })}>Guardar</Boton>
            </div>
          )}

          <CamposClasificacion modulo={t.modulo} negocio={t.business_id} prioridad={t.prioridad} negocios={negocios}
            deshabilitado={guardando} onCambio={cambiar} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            <div>
              <div style={seccion}>Estado</div>
              <Segmentos lleno opciones={ESTADOS.map((e) => [e.k, e.l])} valor={t.estado} deshabilitado={guardando} onCambio={(k) => cambiar({ estado: k })} />
            </div>
            <div>
              <div style={seccion}>Quién lo hace</div>
              <select value={t.asignado_a || ''} disabled={guardando} onChange={(e) => cambiar({ asignado_a: e.target.value ? Number(e.target.value) : null })}
                style={{ ...campo, cursor: 'pointer' }}>
                <option value="">Nadie todavía</option>
                {equipo.map((u) => (
                  <option key={u.id} value={u.id}>{primerNombre(u.display_name || u.name || u.email)}{String(u.id) === String(yo) ? ' (vos)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 12 }}>
            Creado por {primerNombre(t.creado_nombre) || '—'} el {fecha(t.created_at)}
            {t.hecha_at ? ` · hecho por ${primerNombre(t.hecha_nombre) || '—'} el ${fecha(t.hecha_at)}` : ''}
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
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Escribí una nota… (Ctrl+Enter envía)"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregarNota(); }}
              style={{ ...area, flex: 1 }} />
            <Boton primario deshabilitado={guardando || !nota.trim()} onClick={agregarNota}>Enviar</Boton>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <Boton peligro onClick={borrar}>Borrar pendiente</Boton>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ───────── pantalla ───────── */
export default function SuperTablero({ tareaInicial = null }) {
  const movil = useMediaQuery('(max-width:760px)');
  const [tareas, setTareas] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [yo, setYo] = useState(null);
  const inicial = useMemo(leerFiltros, []);
  const [vista, setVista] = useState(inicial.vista || 'abiertas');
  const [modulo, setModulo] = useState(inicial.modulo || '');
  const [negocio, setNegocio] = useState(inicial.negocio || '');
  const [quien, setQuien] = useState(inicial.quien || '');
  const [q, setQ] = useState('');
  const [cerrados, setCerrados] = useState(inicial.cerrados || {});
  const [abierta, setAbierta] = useState(tareaInicial);
  const [creando, setCreando] = useState(false);

  useEffect(() => { cargarFuentes(); }, []);
  useEffect(() => { guardarFiltros({ vista, modulo, negocio, quien, cerrados }); }, [vista, modulo, negocio, quien, cerrados]);
  const cargar = useCallback(() => SuperAPI.tareas().then((r) => {
    setTareas(r.tareas || []);
    if (r.negocios) setNegocios(r.negocios);
  }).catch(() => setTareas((ls) => ls || [])), []);
  useEffect(() => {
    cargar();
    SuperAPI.superusuarios().then((r) => { setEquipo(r?.usuarios || []); setYo(r?.yo ?? null); }).catch(() => {});
  }, [cargar]);

  const reemplazar = useCallback((t) => setTareas((ls) => (ls || []).map((x) => (x.id === t.id ? { ...x, ...t } : x))), []);
  const cambiarRapido = async (t, cambios) => {
    reemplazar({ ...t, ...cambios }); // se ve al instante; si falla, vuelve
    try { reemplazar((await SuperAPI.actualizarTarea(t.id, cambios)).tarea); }
    catch (e) { reemplazar(t); showAlert(errorDe(e), 'error'); }
  };

  // Filtros que no son de estado (para contar por estado en los segmentos).
  const base = useMemo(() => {
    const txt = q.trim().toLowerCase();
    return (tareas || []).filter((t) => (
      (!modulo || (t.modulo || 'general') === modulo)
      && (!negocio || (negocio === 'todos' ? !t.business_id : String(t.business_id) === negocio))
      && (quien !== 'mias' || String(t.asignado_a) === String(yo))
      && (quien !== 'nadie' || !t.asignado_a)
      && (!txt || `${t.titulo} ${t.detalle || ''} ${t.negocio || ''}`.toLowerCase().includes(txt))
    ));
  }, [tareas, modulo, negocio, quien, q, yo]);
  const cuenta = (k) => base.filter((t) => (k === 'abiertas' ? t.estado !== 'hecha' : t.estado === k)).length;
  const visibles = base.filter((t) => (vista === 'abiertas' ? t.estado !== 'hecha' : t.estado === vista));

  const grupos = useMemo(() => {
    const ord = (a, b) => (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado])
      || ((ESTRELLAS[b.prioridad] || 2) - (ESTRELLAS[a.prioridad] || 2))
      || (new Date(b.updated_at) - new Date(a.updated_at));
    return MODULOS.map(([k, l]) => ({ k, l, items: visibles.filter((t) => (t.modulo || 'general') === k).sort(ord) }))
      .filter((g) => g.items.length);
  }, [visibles]);

  const negociosUsados = useMemo(() => {
    const ids = new Set((tareas || []).map((t) => t.business_id).filter(Boolean));
    return negocios.filter((n) => ids.has(n.id));
  }, [tareas, negocios]);

  return (
    <div style={{ fontFamily: FB, color: T.text }}>
      {/* Barra: una sola fila, todo de 40 px */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Segmentos opciones={VISTAS.map(([k, l]) => [k, l, cuenta(k)])} valor={vista} onCambio={setVista} />
        <Selector valor={modulo} onCambio={setModulo} ancho={160} title="Módulo">
          <option value="">Todos los módulos</option>
          {MODULOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Selector>
        <Selector valor={negocio} onCambio={setNegocio} ancho={160} title="De qué negocio viene">
          <option value="">Todos los negocios</option>
          <option value="todos">Solo «Todos» (Lazarillo)</option>
          {negociosUsados.map((n) => <option key={n.id} value={String(n.id)}>{n.name}</option>)}
        </Selector>
        <Selector valor={quien} onCambio={setQuien} ancho={112} title="Quién lo hace">
          {QUIEN.map(([k, l]) => <option key={k || 'todos'} value={k}>{l}</option>)}
        </Selector>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ ...campo, flex: '1 1 140px', minWidth: 110, width: 'auto' }} />
        <Boton primario onClick={() => setCreando(true)} title="Anotar un pendiente nuevo">+ Nuevo</Boton>
      </div>

      {tareas === null ? <div style={{ color: T.text3, padding: 12 }}>Cargando…</div> : !grupos.length ? (
        <div style={{ background: T.card, borderRadius: 14, padding: '36px 16px', textAlign: 'center', fontFamily: FB, fontSize: 13.5, color: T.text2 }}>
          {(tareas || []).length ? 'No hay pendientes con estos filtros.' : 'Todavía no hay pendientes. Anotá el primero con «+ Nuevo».'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!movil && (
            <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 12, padding: '0 15px' }}>
              <span style={titulo}>Prioridad</span>
              <span style={{ ...titulo, textAlign: 'left' }}>Pendiente</span>
              <span style={titulo}>Negocio</span>
              <span style={titulo}>Quién</span>
              <span style={titulo}>Estado</span>
              <span style={titulo}>Act.</span>
            </div>
          )}
          {grupos.map((g) => {
            const cerrado = !!cerrados[g.k];
            const tres = g.items.filter((t) => t.prioridad === 'alta' && t.estado !== 'hecha').length;
            return (
              <section key={g.k} style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: T.sombraSuave }}>
                <button type="button" onClick={() => setCerrados({ ...cerrados, [g.k]: !cerrado })} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px', border: 'none',
                  background: T.card, cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ color: T.text3, fontSize: 11, width: 12 }}>{cerrado ? '▸' : '▾'}</span>
                  <span style={{ fontFamily: FT, fontSize: 14, fontWeight: 700, color: T.text }}>{g.l}</span>
                  <span style={{ fontFamily: FB, fontSize: 12.5, fontWeight: 600, color: T.text3 }}>{g.items.length}</span>
                  {tres > 0 && <span style={{ marginLeft: 'auto', fontFamily: FB, fontSize: 12, fontWeight: 700, color: '#B98316' }}>★★★ {tres}</span>}
                </button>
                {!cerrado && g.items.map((t) => <Fila key={t.id} t={t} movil={movil} onAbrir={setAbierta} onCambio={cambiarRapido} />)}
              </section>
            );
          })}
        </div>
      )}

      {creando && (
        <NuevaTarea negocios={negocios} moduloInicial={modulo} onCerrar={() => setCreando(false)}
          onCreada={(t) => { setTareas((ls) => [t, ...(ls || [])]); setCreando(false); }} />
      )}
      {abierta && (
        <Detalle id={abierta} equipo={equipo} yo={yo} negocios={negocios} onCerrar={() => setAbierta(null)} onCambio={reemplazar}
          onBorrada={(id) => { setTareas((ls) => (ls || []).filter((x) => x.id !== id)); setAbierta(null); }} />
      )}
    </div>
  );
}
