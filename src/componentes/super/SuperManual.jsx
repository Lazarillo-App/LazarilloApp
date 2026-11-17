// src/componentes/super/SuperManual.jsx
// Editor del Manual (Diego 16/11/2026, tarea #96): los capítulos viven en la base y se editan
// desde acá, sin tocar código. A la izquierda los capítulos por grupo; a la derecha el capítulo
// abierto: datos, resumen y sus secciones (título, texto, imagen, pie y consejo).
// Formato del texto: párrafos separados por un renglón en blanco, **negrita** y renglones que
// empiezan con «- » como lista (el mismo que muestra /manual).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SuperAPI } from '@/servicios/apiSoporte';
import { BASE } from '@/servicios/apiBase';
import { showAlert } from '@/servicios/appAlert';
import { GUIAS, GRUPOS_GUIAS } from '@/componentes/asistente/guias';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const ALTO = 40;
const boton = (primario, peligro) => ({
  height: ALTO, padding: '0 16px', borderRadius: 10, fontFamily: FB, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${peligro ? T.bad : primario ? T.accent : T.border2}`,
  background: primario ? T.accent : T.band, color: peligro ? T.bad : primario ? T.ink : T.text2,
});
const chico = { ...boton(false), height: 32, padding: '0 10px', fontSize: 12.5 };
const apagado = (st, off) => (off ? { ...st, opacity: 0.45, cursor: 'default' } : st);
// Para comparar con lo guardado sin la marca interna de las secciones.
const limpio = (c) => (c ? JSON.stringify({ ...c, secciones: (c.secciones || []).map(({ idFijo, ...x }) => x) }) : '');
const campo = { height: ALTO, boxSizing: 'border-box', width: '100%', border: `1px solid ${T.border2}`, borderRadius: 10, padding: '0 12px', fontFamily: FB, fontSize: 14, color: T.text, background: '#fff' };
const area = { ...campo, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' };
const etiqueta = { fontFamily: FB, fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: T.text3, margin: '0 0 4px' };
const urlImagen = (u) => (String(u || '').startsWith('/api/') ? String(BASE).replace(/\/api\/?$/, '') + u : u);
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
// «Cargar una factura» → «cargar-una-factura» (sin tildes ni signos).
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const slug = (s) => String(s || '').normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nuevaSeccion = (n) => ({ id: `seccion-${n}`, titulo: '', texto: '', imagen: '', pie: '', tip: '' });

function Campo({ label, children, style }) {
  return <label style={{ display: 'block', ...style }}><div style={etiqueta}>{label}</div>{children}</label>;
}

/** Una sección del capítulo. */
function Seccion({ s, i, total, onCambio, onMover, onBorrar }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);
  const set = (k) => (e) => onCambio({ ...s, [k]: e.target.value });
  const subir = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showAlert('La imagen pesa más de 3 MB: achicala o pasala a JPG.', 'error'); return; }
    setSubiendo(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await SuperAPI.subirImagenManual(fd);
      if (!r?.url) throw new Error('sin url');
      onCambio({ ...s, imagen: r.url });
    } catch { showAlert('No se pudo subir la imagen', 'error'); }
    finally { setSubiendo(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: '#fff', padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: T.accent, color: T.ink, fontFamily: FT, fontWeight: 800, fontSize: 13,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
        <input style={{ ...campo, fontFamily: FT, fontWeight: 700 }} value={s.titulo} onChange={(e) => onCambio({ ...s, titulo: e.target.value, id: s.idFijo ? s.id : slug(e.target.value) || s.id })}
          placeholder="Título de la sección" />
        <button type="button" style={apagado(chico, i === 0)} disabled={i === 0} onClick={() => onMover(-1)} title="Subir">↑</button>
        <button type="button" style={apagado(chico, i === total - 1)} disabled={i === total - 1} onClick={() => onMover(1)} title="Bajar">↓</button>
        <button type="button" style={{ ...chico, color: T.bad }} onClick={onBorrar} title="Borrar la sección">✕</button>
      </div>
      <Campo label="Texto" style={{ marginBottom: 12 }}>
        <textarea style={area} rows={5} value={s.texto} onChange={set('texto')}
          placeholder={'Un párrafo por renglón en blanco. **negrita**.\n- Un renglón con guion es una lista'} />
      </Campo>
      <div className="sm-fila" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 12 }}>
        <Campo label="Consejo (recuadro celeste)"><input style={campo} value={s.tip || ''} onChange={set('tip')} placeholder="Opcional" /></Campo>
        <Campo label="Pie de la imagen"><input style={campo} value={s.pie || ''} onChange={set('pie')} placeholder="Opcional" /></Campo>
      </div>
      <div style={etiqueta}>Imagen</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {s.imagen ? (
          <a href={urlImagen(s.imagen)} target="_blank" rel="noreferrer" style={{ display: 'block', border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden', lineHeight: 0 }}>
            <img src={urlImagen(s.imagen)} alt="" style={{ maxWidth: 260, maxHeight: 140, display: 'block' }} />
          </a>
        ) : <span style={{ fontFamily: FB, fontSize: 13, color: T.text3 }}>Sin imagen</span>}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => subir(e.target.files?.[0])} />
        <button type="button" style={boton(false)} disabled={subiendo} onClick={() => inputRef.current?.click()}>
          {subiendo ? 'Subiendo…' : s.imagen ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        {s.imagen && <button type="button" style={boton(false)} onClick={() => onCambio({ ...s, imagen: '' })}>Quitar</button>}
      </div>
    </div>
  );
}

export default function SuperManual() {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(null);   // id del capítulo abierto
  const [borrador, setBorrador] = useState(null); // copia editable
  const [esNuevo, setEsNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarFuentes(); }, []);
  useEffect(() => {
    SuperAPI.manual().then((r) => setLista(r?.capitulos || [])).catch(() => setLista([]));
  }, []);

  const grupos = useMemo(() => {
    const g = [...GRUPOS_GUIAS];
    (lista || []).forEach((c) => { if (c.grupo && !g.includes(c.grupo)) g.push(c.grupo); });
    return g;
  }, [lista]);
  const sinCapitulo = useMemo(() => GUIAS.filter((g) => !(lista || []).some((c) => c.guia_id === g.id)), [lista]);
  const original = (lista || []).find((c) => c.id === abierto);
  const cambiado = !!borrador && (esNuevo || limpio(borrador) !== limpio(original));

  const abrir = (c) => {
    if (cambiado && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    setEsNuevo(false); setAbierto(c.id);
    setBorrador(JSON.parse(JSON.stringify({ ...c, secciones: (c.secciones || []).map((s) => ({ ...s, idFijo: true })) })));
  };
  const crear = (guia) => {
    if (cambiado && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    const titulo = guia?.titulo || '';
    const grupo = guia?.grupo || grupos[0];
    const orden = ((lista || []).filter((c) => c.grupo === grupo).reduce((m, c) => Math.max(m, c.orden || 0), 0)) + 10;
    setEsNuevo(true); setAbierto(null);
    setBorrador({ id: slug(titulo), grupo, titulo, resumen: '', guia_id: guia?.id || '', orden, publicado: false, secciones: [nuevaSeccion(1)] });
  };
  const set = (k) => (e) => setBorrador((b) => ({ ...b, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setSeccion = (i, s) => setBorrador((b) => ({ ...b, secciones: b.secciones.map((x, j) => (j === i ? s : x)) }));
  const mover = (i, d) => setBorrador((b) => {
    const xs = [...b.secciones]; const [x] = xs.splice(i, 1); xs.splice(i + d, 0, x); return { ...b, secciones: xs };
  });

  const guardar = async () => {
    const b = borrador;
    const id = esNuevo ? slug(b.id || b.titulo) : b.id;
    if (!b.titulo.trim() || !id) { showAlert('Falta el título del capítulo', 'error'); return; }
    if (esNuevo && (lista || []).some((c) => c.id === id)) { showAlert('Ya hay un capítulo con ese link', 'error'); return; }
    const ids = new Set();
    const secciones = b.secciones.map((s, i) => {
      let sid = s.id || `seccion-${i + 1}`; while (ids.has(sid)) sid += '-2'; ids.add(sid);
      return { id: sid, titulo: s.titulo.trim(), texto: s.texto, imagen: s.imagen || '', pie: s.pie || '', tip: s.tip || '' };
    });
    setGuardando(true);
    try {
      const r = await SuperAPI.guardarCapitulo(id, { ...b, id, orden: Number(b.orden) || 0, guia_id: b.guia_id || null, secciones });
      const cap = r?.capitulo || { ...b, id, secciones };
      setLista((l) => [...(l || []).filter((c) => c.id !== id), cap]);
      setEsNuevo(false); setAbierto(id);
      setBorrador(JSON.parse(JSON.stringify({ ...cap, secciones: (cap.secciones || []).map((s) => ({ ...s, idFijo: true })) })));
      showAlert('Capítulo guardado', 'success');
    } catch { showAlert('No se pudo guardar el capítulo', 'error'); }
    finally { setGuardando(false); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar el capítulo «${borrador.titulo}»? No se puede deshacer.`)) return;
    try {
      await SuperAPI.borrarCapitulo(borrador.id);
      setLista((l) => l.filter((c) => c.id !== borrador.id));
      setAbierto(null); setBorrador(null);
    } catch { showAlert('No se pudo borrar', 'error'); }
  };

  if (!lista) return <div style={{ fontFamily: FB, color: T.text2, padding: 16 }}>Cargando el manual…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }} className="super-manual">
      <style>{'@media (max-width: 899.95px){ .super-manual{ grid-template-columns: minmax(0,1fr) !important; } } @media (max-width: 599.95px){ .sm-fila{ grid-template-columns: minmax(0,1fr) !important; } }'}</style>
      {/* Capítulos */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: T.bg, padding: 12 }}>
        <button type="button" style={{ ...boton(true), width: '100%', marginBottom: 8 }} onClick={() => crear(null)}>+ Capítulo</button>
        {grupos.map((g) => {
          const caps = lista.filter((c) => c.grupo === g).sort((a, b) => (a.orden || 0) - (b.orden || 0));
          if (!caps.length) return null;
          return (
            <div key={g}>
              <div style={{ ...etiqueta, margin: '14px 8px 6px' }}>{g}</div>
              {caps.map((c) => (
                <button key={c.id} type="button" onClick={() => abrir(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 36, textAlign: 'left', border: 'none', borderRadius: 8, cursor: 'pointer',
                    padding: '6px 10px', fontFamily: FB, fontSize: 13.5,
                    background: abierto === c.id ? '#fff' : 'transparent', color: abierto === c.id ? T.text : T.text2, fontWeight: abierto === c.id ? 700 : 500,
                    boxShadow: abierto === c.id ? `inset 3px 0 0 ${T.accent}` : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</span>
                  {!c.publicado && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.warn }}>BORRADOR</span>}
                </button>
              ))}
            </div>
          );
        })}
        {sinCapitulo.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <div style={{ ...etiqueta, margin: '0 8px 2px' }}>Guías sin capítulo</div>
            <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '0 8px 6px' }}>En el manual se ven como «pendiente», con su paso a paso.</div>
            {sinCapitulo.map((g) => (
              <button key={g.id} type="button" onClick={() => crear(g)}
                style={{ display: 'block', width: '100%', minHeight: 32, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '4px 10px', fontFamily: FB, fontSize: 13, color: T.accentTxt }}>+ {g.titulo}</button>
            ))}
          </div>
        )}
      </div>

      {/* Capítulo abierto */}
      {!borrador ? (
        <div style={{ border: `1px dashed ${T.border2}`, borderRadius: 12, padding: 32, fontFamily: FB, fontSize: 14, color: T.text2, textAlign: 'center' }}>
          Elegí un capítulo para editarlo, o creá uno nuevo.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 20, color: T.text, flex: 1, minWidth: 200 }}>{borrador.titulo || 'Capítulo nuevo'}</div>
            {!esNuevo && original?.actualizado_en && <span style={{ fontFamily: FB, fontSize: 12, color: T.text3 }}>Guardado {fecha(original.actualizado_en)}</span>}
            {!esNuevo && <a href={`/manual/${borrador.id}`} target="_blank" rel="noreferrer" style={{ ...boton(false), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Ver en el manual ↗</a>}
            <button type="button" style={apagado(boton(true), guardando || !cambiado)} disabled={guardando || !cambiado} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: '#fff', padding: 16, marginBottom: 16 }}>
            <div className="sm-fila" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 12, marginBottom: 12 }}>
              <Campo label="Título"><input style={campo} value={borrador.titulo} onChange={(e) => {
                const v = e.target.value; setBorrador((b) => ({ ...b, titulo: v, ...(esNuevo ? { id: slug(v) } : {}) }));
              }} /></Campo>
              <Campo label="Grupo">
                <select style={campo} value={borrador.grupo} onChange={set('grupo')}>
                  {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Campo>
            </div>
            <div className="sm-fila" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) 110px', gap: 12, marginBottom: 12 }}>
              <Campo label="Link">
                <div style={{ ...campo, display: 'flex', alignItems: 'center', background: T.head, color: T.text2, overflow: 'hidden', whiteSpace: 'nowrap' }}>/manual/{esNuevo ? slug(borrador.titulo) || '…' : borrador.id}</div>
              </Campo>
              <Campo label="Paso a paso en la app">
                <select style={campo} value={borrador.guia_id || ''} onChange={set('guia_id')}>
                  <option value="">Ninguno</option>
                  {GUIAS.map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}
                </select>
              </Campo>
              <Campo label="Orden"><input style={{ ...campo, textAlign: 'center' }} type="number" value={borrador.orden} onChange={set('orden')} /></Campo>
            </div>
            <Campo label="Resumen (lo primero que se lee)" style={{ marginBottom: 12 }}>
              <textarea style={area} rows={3} value={borrador.resumen || ''} onChange={set('resumen')} />
            </Campo>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FB, fontSize: 14, color: T.text, cursor: 'pointer', minHeight: 32 }}>
              <input type="checkbox" checked={!!borrador.publicado} onChange={set('publicado')} style={{ width: 18, height: 18 }} />
              Publicado <span style={{ color: T.text3, fontSize: 12.5 }}>(sin tildar, solo lo ven los super usuarios acá)</span>
            </label>
          </div>

          <div style={{ ...etiqueta, margin: '0 0 8px' }}>Secciones ({borrador.secciones.length})</div>
          {borrador.secciones.map((s, i) => (
            <Seccion key={i} s={s} i={i} total={borrador.secciones.length}
              onCambio={(x) => setSeccion(i, x)} onMover={(d) => mover(i, d)}
              onBorrar={() => setBorrador((b) => ({ ...b, secciones: b.secciones.filter((_, j) => j !== i) }))} />
          ))}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" style={boton(false)} onClick={() => setBorrador((b) => ({ ...b, secciones: [...b.secciones, nuevaSeccion(b.secciones.length + 1)] }))}>+ Sección</button>
            <div style={{ display: 'flex', gap: 10 }}>
              {!esNuevo && <button type="button" style={boton(false, true)} onClick={borrar}>Borrar capítulo</button>}
              <button type="button" style={apagado(boton(true), guardando || !cambiado)} disabled={guardando || !cambiado} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
