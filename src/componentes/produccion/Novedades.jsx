// src/componentes/produccion/Novedades.jsx — Producción › Novedades de cocina (etapa 1, 24/11/2026).
// Avisos del equipo de cocina con foto opcional (algo dañado, algo sucio, se hizo limpieza, cómo
// quedó algo, otro). Crean y ven: cocineros, jefes de cocina, dueño y admin.
// Solo dueño y admin (ctx.decide) pueden marcar «Vista» o «Eliminar».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { ProduccionAPI } from '@/servicios/apiProduccion';
import { Boton, Campo, Selector, Texto, Vacio, Pastilla, Modal } from './ui';
import { textoError } from './util';

const TIPOS = [
  { key: 'danado', label: 'Algo dañado', emoji: '⚠️', color: T.bad, fondo: '#FBE9E9' },
  { key: 'sucio', label: 'Algo sucio', emoji: '🧹', color: T.warn, fondo: '#FBF3E2' },
  { key: 'limpieza', label: 'Se hizo limpieza', emoji: '✨', color: T.ok, fondo: '#E4F6EC' },
  { key: 'estado', label: 'Cómo quedó algo', emoji: '📌', color: T.accentTxt, fondo: '#E3F4FB' },
  { key: 'otro', label: 'Otro', emoji: '💬', color: T.text2, fondo: T.card },
];
const MAPA_TIPO = Object.fromEntries(TIPOS.map((t) => [t.key, t]));

const fechaHora = (s) => (s ? new Date(s).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function Novedades({ businessId, ctx, cel }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPersona, setFiltroPersona] = useState('');
  const [tipo, setTipo] = useState('danado');
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState(null); // { url, public_id }
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  // Solo dueño y admin (ctx.decide) pueden marcar vista o eliminar; cocinero y jefe no.
  const esDuenoOAdmin = !!(ctx?.decide || puedeGestionar);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const r = await ProduccionAPI.novedades(businessId);
      setItems(r.items || []);
      setPuedeGestionar(!!r.puede_gestionar);
    } catch (e) {
      setError(textoError(e));
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const personas = useMemo(() => {
    const m = new Map();
    for (const u of ctx?.equipo || []) {
      if (u.id && u.nombre) m.set(String(u.id), u.nombre);
    }
    for (const it of items) {
      if (it.user_id && it.usuario) m.set(String(it.user_id), it.usuario);
    }
    return [...m.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [ctx?.equipo, items]);

  const visibles = useMemo(() => items.filter((it) => {
    if (filtroTipo && it.tipo !== filtroTipo) return false;
    if (filtroPersona && String(it.user_id) !== filtroPersona) return false;
    return true;
  }), [items, filtroTipo, filtroPersona]);

  const onElegirArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Solo imágenes JPG, PNG o WEBP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La foto supera el máximo de 8 MB');
      return;
    }
    setError('');
    setSubiendoFoto(true);
    try {
      const r = await ProduccionAPI.subirFotoNovedad(businessId, file);
      setFoto({ url: r.url, public_id: r.public_id });
    } catch (err) {
      setError(textoError(err));
    } finally {
      setSubiendoFoto(false);
    }
  };

  const publicar = async () => {
    if (!texto.trim() || subiendoFoto || guardando) return;
    setError('');
    setGuardando(true);
    try {
      const r = await ProduccionAPI.crearNovedad(businessId, {
        tipo,
        texto: texto.trim(),
        foto_url: foto?.url || null,
        foto_public_id: foto?.public_id || null,
      });
      setItems(r.items || []);
      setTexto('');
      setFoto(null);
    } catch (err) {
      setError(textoError(err));
    } finally {
      setGuardando(false);
    }
  };

  const marcarVista = async (id) => {
    setError('');
    try {
      const r = await ProduccionAPI.marcarNovedadVista(businessId, id);
      setItems(r.items || []);
    } catch (err) {
      setError(textoError(err));
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta novedad?')) return;
    setError('');
    try {
      const r = await ProduccionAPI.borrarNovedad(businessId, id);
      setItems(r.items || []);
    } catch (err) {
      setError(textoError(err));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : 'minmax(300px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* Formulario de alta */}
      <div style={{ background: T.head, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15, color: T.text }}>Dejar una novedad</div>
        <Campo label="Qué pasó">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIPOS.map((t) => (
              <Boton key={t.key} chico={!cel} activo={tipo === t.key} onClick={() => setTipo(t.key)} style={cel ? { minHeight: 40 } : undefined}>
                {t.emoji} {t.label}
              </Boton>
            ))}
          </div>
        </Campo>
        <Campo label="Detalle">
          <textarea
            value={texto}
            maxLength={1500}
            rows={3}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej.: llegué y encontré la mesada sucia / dejé la bacha limpia y desinfectada…"
            style={{
              fontFamily: FB, fontSize: 14, color: T.text, background: '#fff', border: `1px solid ${T.border2}`,
              borderRadius: 10, padding: '9px 11px', width: '100%', boxSizing: 'border-box', outline: 'none', resize: 'vertical',
            }}
          />
        </Campo>
        <Campo label="Foto (opcional)" ayuda="JPG, PNG o WEBP · hasta 8 MB">
          <input ref={camRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onElegirArchivo} style={{ display: 'none' }} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onElegirArchivo} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Boton chico={!cel} deshabilitado={subiendoFoto} onClick={() => camRef.current?.click()} style={cel ? { minHeight: 40 } : undefined}>
              📷 Sacar foto
            </Boton>
            <Boton chico={!cel} deshabilitado={subiendoFoto} onClick={() => fileRef.current?.click()} style={cel ? { minHeight: 40 } : undefined}>
              🖼 Elegir imagen
            </Boton>
            {subiendoFoto && <Texto sutil>Subiendo foto…</Texto>}
          </div>
          {foto?.url && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: 8 }}>
              <img src={foto.url} alt="Vista previa" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}` }} />
              <span style={{ flex: 1, fontSize: 12.5, color: T.ok, fontWeight: 600 }}>Foto cargada ✓</span>
              <Boton chico peligro onClick={() => setFoto(null)}>✕ Quitar</Boton>
            </div>
          )}
        </Campo>
        {error && <div style={{ color: T.bad, fontFamily: FB, fontSize: 13 }}>{error}</div>}
        <Boton primario deshabilitado={!texto.trim() || subiendoFoto || guardando} onClick={publicar} style={{ minHeight: cel ? 44 : 38 }}>
          {guardando ? 'Publicando…' : 'Publicar novedad'}
        </Boton>
      </div>

      {/* Filtros + listado de tarjetas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : '1fr 1fr', gap: 8 }}>
          <Selector
            value={filtroTipo}
            onChange={setFiltroTipo}
            vacio="Todos los tipos"
            opciones={TIPOS.map((t) => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
            style={cel ? { minHeight: 44 } : undefined}
          />
          <Selector
            value={filtroPersona}
            onChange={setFiltroPersona}
            vacio="Todas las personas"
            opciones={personas}
            style={cel ? { minHeight: 44 } : undefined}
          />
        </div>

        {cargando && !items.length ? (
          <Texto sutil>Cargando novedades…</Texto>
        ) : !visibles.length ? (
          <Vacio emoji="📌" titulo={items.length ? 'Sin novedades para ese filtro' : 'Todavía no hay novedades'}>
            {items.length
              ? 'Probá cambiando el tipo o la persona.'
              : 'Dejá un aviso cuando encuentres algo dañado o sucio, cuando termines una limpieza o para contar cómo quedó tu puesto.'}
          </Vacio>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibles.map((n) => {
              const info = MAPA_TIPO[n.tipo] || MAPA_TIPO.otro;
              return (
                <div
                  key={n.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    borderLeft: `4px solid ${info.color}`,
                    borderRadius: 14,
                    padding: 12,
                    boxShadow: T.sombraSuave,
                    fontFamily: FB,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Pastilla color={info.color} fondo={info.fondo}>{info.emoji} {info.label}</Pastilla>
                    {n.vista && (
                      <Pastilla color={T.ok} fondo="#E4F6EC" title={n.vista_por ? `Vista por ${n.vista_por} · ${fechaHora(n.vista_at)}` : undefined}>
                        ✓ Vista{n.vista_por ? ` · ${n.vista_por}` : ''}
                      </Pastilla>
                    )}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: T.text3 }}>{n.usuario} · {fechaHora(n.created_at)}</span>
                  </div>

                  <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {n.texto}
                  </div>

                  {n.foto_url && (
                    <div>
                      <img
                        src={n.foto_url}
                        alt={info.label}
                        onClick={() => setFotoAmpliada(n)}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          cursor: 'pointer',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}

                  {esDuenoOAdmin && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
                      {!n.vista && (
                        <Boton chico={!cel} onClick={() => marcarVista(n.id)} style={cel ? { minHeight: 40 } : undefined}>
                          ✓ Vista
                        </Boton>
                      )}
                      <Boton chico={!cel} peligro onClick={() => eliminar(n.id)} style={cel ? { minHeight: 40 } : undefined}>
                        Eliminar
                      </Boton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        abierto={!!fotoAmpliada}
        onCerrar={() => setFotoAmpliada(null)}
        titulo={fotoAmpliada ? `${MAPA_TIPO[fotoAmpliada.tipo]?.label || 'Novedad'} · ${fotoAmpliada.usuario}` : 'Foto'}
        cel={cel}
        ancho={680}
      >
        {fotoAmpliada && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <img src={fotoAmpliada.foto_url} alt={fotoAmpliada.texto} style={{ width: '100%', height: 'auto', borderRadius: 12 }} />
            <Texto>{fotoAmpliada.texto}</Texto>
          </div>
        )}
      </Modal>
    </div>
  );
}
