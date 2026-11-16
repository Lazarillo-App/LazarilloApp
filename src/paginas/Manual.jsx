// src/paginas/Manual.jsx — /manual: todas las guías de Lazarillo, con buscador y un link por guía
// (Diego 16/11/2026: «que cada guía tenga un link único e ir armando un manual, así lo comparto
// cuando me piden algo; que tenga un buscador así lo encuentra el usuario»). Vive dentro de la app:
// «Ver la guía» lleva a la pantalla y la guía arranca sola; «Copiar link» da /guia/<id>.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';
import { GUIAS, GRUPOS_GUIAS, NOMBRE_SECTOR, pedirGuia, linkGuia, buscarGuias } from '@/componentes/asistente/guias';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { ANT } from '@/componentes/asistente/anthonyAssets';

// /guia/:id(/:sector): el link que se comparte. Abre la pantalla de la guía y la arranca.
export function AbrirGuia() {
  const { id, sector } = useParams();
  const navigate = useNavigate();
  const g = GUIAS.find((x) => x.id === id);
  useEffect(() => {
    if (g) pedirGuia(g, (ruta) => navigate(ruta, { replace: true }), g.sectores?.includes(sector) ? sector : null);
  }, [g, sector, navigate]);
  if (!g) return <Navigate to="/manual" replace />;
  return <div style={{ padding: 32, fontFamily: FB, color: T.text2 }}>Abriendo la guía…</div>;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sin permiso */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

const btn = (principal) => ({
  fontFamily: FB, fontWeight: 700, fontSize: 13, height: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
  whiteSpace: 'nowrap', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${principal ? T.accent : T.border2}`, background: principal ? T.accent : T.band, color: principal ? T.ink : T.text2,
});

export default function Manual() {
  useEffect(() => { cargarFuentes(); }, []);
  const navigate = useNavigate();
  const { isStaff } = useAccess() || {};
  const [q, setQ] = useState('');
  const [aviso, setAviso] = useState('');
  const [cel, setCel] = useState(() => window.innerWidth < 700);
  useEffect(() => { const f = () => setCel(window.innerWidth < 700); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const propias = useMemo(() => GUIAS.filter((g) => !(g.soloGestion && isStaff)), [isStaff]);
  const encontradas = useMemo(() => buscarGuias(q, propias), [q, propias]);
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso((a) => (a === t ? '' : a)), 2500); };
  const copiarLink = async (g, sector = null) => {
    const ok = await copiar(linkGuia(g, sector));
    avisar(ok ? `Link copiado: ${g.titulo}${sector ? ` · ${NOMBRE_SECTOR[sector] || sector}` : ''}` : 'No se pudo copiar el link');
  };
  const h = cel ? 44 : 36; // para el dedo en el celular

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: cel ? '14px 16px 40px' : '22px 24px 48px', boxSizing: 'border-box', fontFamily: FB, color: T.text }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <img src={ANT.saluda || ANT.presenta} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <div style={{ fontFamily: FT, fontWeight: 800, fontSize: cel ? 20 : 22 }}>Manual de Lazarillo</div>
            <div style={{ fontSize: 13, color: T.text2 }}>Cada guía te muestra en la pantalla real cómo se usa, paso a paso. Copiá su link para compartirla.</div>
          </div>
        </div>

        {/* Buscador arriba: busca en todo el manual */}
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={!cel} placeholder="Buscá qué querés hacer: factura, receta, turnos, food cost…"
          style={{ width: '100%', boxSizing: 'border-box', height: 44, margin: '14px 0 18px', padding: '0 14px', borderRadius: 12, border: `1px solid ${T.border2}`,
            fontFamily: FB, fontSize: 14.5, color: T.text, background: T.band, outline: 'none' }} />

        {!encontradas.length && (
          <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, textAlign: 'center', color: T.text2, fontSize: 14 }}>
            No encontré guías con «{q}». Probá con otra palabra o preguntale a Anthony (el botón de abajo a la derecha).
          </div>
        )}

        {GRUPOS_GUIAS.map((grupo) => {
          const del = encontradas.filter((g) => g.grupo === grupo);
          if (!del.length) return null;
          return (
            <div key={grupo} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 8px 2px' }}>{grupo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: cel ? '1fr' : '1fr 1fr', gap: 10 }}>
                {del.map((g) => (
                  <div key={g.id} style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 15 }}>{g.titulo}</div>
                      <div style={{ fontSize: 13, color: T.text2, marginTop: 2 }}>{g.detalle}</div>
                    </div>
                    {g.sectores?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: T.text3 }}>Por partes:</span>
                        {g.sectores.map((sec) => (
                          <button key={sec} type="button" onClick={() => pedirGuia(g, navigate, sec)} title={`Ver solo: ${NOMBRE_SECTOR[sec] || sec}`}
                            style={{ height: cel ? 36 : 26, padding: '0 10px', borderRadius: 13, border: `1px solid ${T.border2}`, background: T.band,
                              color: T.accentTxt, fontFamily: FB, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {NOMBRE_SECTOR[sec] || sec}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                      <button type="button" onClick={() => pedirGuia(g, navigate)} style={{ ...btn(true), height: h, flex: cel ? 1 : 'none' }}>Ver la guía ›</button>
                      <button type="button" onClick={() => copiarLink(g)} title={linkGuia(g)} style={{ ...btn(false), height: h, flex: cel ? 1 : 'none' }}>🔗 Copiar link</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {aviso && (
        <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.ink, color: '#fff', fontFamily: FB,
          fontSize: 13.5, fontWeight: 600, padding: '10px 16px', borderRadius: 12, boxShadow: T.sombra, zIndex: 1400, maxWidth: 'calc(100vw - 32px)' }}>
          {aviso}
        </div>
      )}
    </div>
  );
}
