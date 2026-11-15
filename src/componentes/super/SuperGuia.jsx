// src/componentes/super/SuperGuia.jsx
// Guía del proyecto (Diego 14/11/2026): qué queremos lograr y cómo trabajamos, para que Mairene,
// Diego y quien se sume tengan el mismo norte que «Pendientes de desarrollo». Un solo texto,
// editable por los super usuarios. Formato simple: «# Título», «## Subtítulo», «═══ X ═══»,
// renglones que empiezan con «- », «· » o «• » van como viñetas.
import React, { useEffect, useState } from 'react';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const ALTO = 40;
const boton = (primario) => ({
  height: ALTO, padding: '0 16px', borderRadius: 10, fontFamily: FB, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
  border: `1px solid ${primario ? T.accent : T.border2}`, background: primario ? T.accent : T.band, color: primario ? T.ink : T.text2,
});
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/** Convierte el texto en bloques (títulos, viñetas, párrafos) sin librerías. */
function Texto({ texto }) {
  const out = [];
  let lista = null;
  const cerrarLista = () => { if (lista) { out.push(<ul key={`l${out.length}`} style={{ margin: '4px 0 10px', paddingLeft: 20 }}>{lista}</ul>); lista = null; } };
  String(texto || '').split('\n').forEach((raw, i) => {
    const l = raw.trimEnd();
    const sec = l.match(/^═+\s*(.+?)\s*═+$/) || l.match(/^#{1,2}\s+(.+)$/);
    const vi = l.match(/^\s*(?:[-·•]|\d+\))\s+(.+)$/);
    if (sec) {
      cerrarLista();
      const grande = /^#\s/.test(l);
      out.push(<div key={i} style={{ fontFamily: FT, fontWeight: 700, fontSize: grande ? 18 : 15, color: T.text,
        margin: out.length ? '22px 0 8px' : '0 0 8px', paddingBottom: 6, borderBottom: grande ? 'none' : `1px solid ${T.border}` }}>{sec[1]}</div>);
    } else if (vi) {
      (lista = lista || []).push(<li key={i} style={{ margin: '3px 0', paddingLeft: 2 }}>{vi[1]}</li>);
    } else if (!l.trim()) {
      cerrarLista();
    } else {
      cerrarLista();
      out.push(<p key={i} style={{ margin: '4px 0 8px' }}>{l.trim()}</p>);
    }
  });
  cerrarLista();
  return <div style={{ fontFamily: FB, fontSize: 14, lineHeight: 1.55, color: T.text2 }}>{out}</div>;
}

export default function SuperGuia() {
  const [guia, setGuia] = useState(null);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarFuentes(); }, []);
  useEffect(() => {
    SuperAPI.guia().then((r) => setGuia(r.guia || { texto: '' })).catch(() => setGuia({ texto: '' }));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try { const r = await SuperAPI.guardarGuia(borrador); setGuia(r.guia); setEditando(false); }
    catch { showAlert('No se pudo guardar la guía', 'error'); }
    finally { setGuardando(false); }
  };

  if (!guia) return <div style={{ color: T.text3, padding: 12, fontFamily: FB }}>Cargando…</div>;
  const vacia = !String(guia.texto || '').trim();

  return (
    <div style={{ fontFamily: FB, color: T.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, minHeight: ALTO }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.text3 }}>
          {guia.updated_at && !vacia ? `Actualizada ${fecha(guia.updated_at)}${guia.updated_nombre ? ` por ${String(guia.updated_nombre).split(' ')[0]}` : ''}` : 'Lo que queremos lograr y cómo trabajamos: el norte de los pendientes.'}
        </div>
        {editando ? (
          <>
            <button type="button" style={boton(false)} onClick={() => setEditando(false)}>Cancelar</button>
            <button type="button" style={{ ...boton(true), opacity: guardando ? 0.5 : 1 }} disabled={guardando} onClick={guardar}>Guardar</button>
          </>
        ) : (
          <button type="button" style={boton(false)} onClick={() => { setBorrador(guia.texto || ''); setEditando(true); }}>Editar</button>
        )}
      </div>

      <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sombraSuave, padding: editando ? 12 : '20px 24px' }}>
        {editando ? (
          <>
            <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} rows={28}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.5,
                color: T.text, border: `1px solid ${T.border2}`, borderRadius: 10, padding: 12, outline: 'none', resize: 'vertical' }} />
            <div style={{ fontSize: 12, color: T.text3, marginTop: 6 }}>
              «# Título», «## Sección» o «═══ Sección ═══» arman títulos; los renglones que empiezan con «- » o «· » son viñetas.
            </div>
          </>
        ) : vacia ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13.5, color: T.text2 }}>
            Todavía no hay guía. Tocá «Editar» y escribí qué queremos lograr y cómo trabajamos.
          </div>
        ) : <Texto texto={guia.texto} />}
      </div>
    </div>
  );
}
