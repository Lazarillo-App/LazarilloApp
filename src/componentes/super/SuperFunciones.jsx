// src/componentes/super/SuperFunciones.jsx
// Funciones por negocio (Diego 17/11/2026): Lazarillo decide qué áreas (Operación, Rentabilidad,
// Administración) y qué funciones dentro de cada área ve cada negocio. Hay un default para todos
// y cada negocio puede tener lo suyo. Los negocios cuyo dueño es super usuario ven todo.
import React, { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import { AREAS } from '@/funciones';

const DEFAULT = 'default';
const ALTO = 40;

function Interruptor({ prendido, onCambio, deshabilitado, titulo }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} title={titulo} disabled={deshabilitado}
      onClick={() => !deshabilitado && onCambio(!prendido)}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0, flexShrink: 0, position: 'relative',
        cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? 0.45 : 1,
        background: prendido ? T.accent : T.border2, transition: 'background .15s',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: prendido ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px #15213E33', transition: 'left .15s',
      }} />
    </button>
  );
}

const Chip = ({ children, color }) => (
  <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color, background: `${color}1a`, borderRadius: 7, padding: '2px 7px', whiteSpace: 'nowrap' }}>{children}</span>
);

export default function SuperFunciones() {
  const movil = useMediaQuery('(max-width:760px)');
  const [datos, setDatos] = useState(null);
  const [sel, setSel] = useState(DEFAULT);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarFuentes(); }, []);
  useEffect(() => {
    SuperAPI.funciones().then((r) => setDatos({ global: r.global || [], negocios: r.negocios || [] }))
      .catch(() => setDatos({ global: [], negocios: [] }));
  }, []);

  const negocio = useMemo(() => (sel === DEFAULT ? null : (datos?.negocios || []).find((n) => String(n.id) === String(sel))), [sel, datos]);
  const propios = negocio ? Array.isArray(negocio.ocultos) : true;
  const ocultos = !datos ? [] : sel === DEFAULT ? datos.global : (propios ? negocio.ocultos : datos.global);
  const veTodo = !!negocio?.dueno_super;

  const guardar = async (nuevos) => {
    const antes = ocultos;
    const bid = negocio ? negocio.id : null;
    // Se ve al instante; si falla, vuelve.
    const aplicar = (lista) => setDatos((d) => (bid == null ? { ...d, global: lista }
      : { ...d, negocios: d.negocios.map((n) => (n.id === bid ? { ...n, ocultos: lista } : n)) }));
    aplicar(nuevos);
    setGuardando(true);
    try { await SuperAPI.guardarFunciones(bid, nuevos, antes); }
    catch { aplicar(bid == null ? antes : (propios ? antes : null)); showAlert('No se pudo guardar', 'error'); }
    finally { setGuardando(false); }
  };
  const cambiar = (id, visible) => {
    const set = new Set(ocultos);
    if (visible) set.delete(id); else set.add(id);
    guardar([...set]);
  };

  if (!datos) return <div style={{ fontFamily: FB, color: T.text3, padding: 12 }}>Cargando…</div>;

  const lista = [{ id: DEFAULT, name: 'Default · todos los negocios' }, ...datos.negocios];
  const fila = (n) => {
    const act = String(sel) === String(n.id);
    return (
      <button key={n.id} type="button" onClick={() => setSel(n.id)} style={{
        width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${T.border}`, padding: '9px 12px',
        background: act ? `${T.accent}22` : T.band, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: FT, fontSize: 13, fontWeight: act ? 700 : 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
          {n.id !== DEFAULT && <span style={{ display: 'block', fontFamily: FB, fontSize: 11.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>de {String(n.dueno || '—').split(' ')[0]}</span>}
        </span>
        {n.dueno_super ? <Chip color={T.text3}>ve todo</Chip> : Array.isArray(n.ocultos) ? <Chip color={T.accentTxt}>a medida</Chip> : null}
      </button>
    );
  };

  return (
    <div style={{ fontFamily: FB, color: T.text, display: 'grid', gridTemplateColumns: movil ? '1fr' : '280px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      {movil ? (
        <select value={sel} onChange={(e) => setSel(e.target.value === DEFAULT ? DEFAULT : Number(e.target.value))}
          style={{ height: 44, borderRadius: 10, border: `1px solid ${T.border2}`, padding: '0 12px', fontFamily: FB, fontSize: 14, background: T.band }}>
          {lista.map((n) => <option key={n.id} value={n.id}>{n.name}{n.dueno_super ? ' (ve todo)' : Array.isArray(n.ocultos) ? ' (a medida)' : ''}</option>)}
        </select>
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: T.sombraSuave }}>
          <div style={{ padding: '10px 12px', background: T.card, fontFamily: FB, fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Negocios</div>
          {lista.map(fila)}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: ALTO, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FT, fontSize: 17, fontWeight: 700 }}>{negocio ? negocio.name : 'Default para todos los negocios'}</div>
            <div style={{ fontSize: 12.5, color: T.text2, marginTop: 2 }}>
              {!negocio ? 'Lo que ven los negocios que no tienen nada a medida. Un negocio nuevo arranca así.'
                : veTodo ? 'El dueño es super usuario: ve todas las funciones siempre.'
                  : propios ? 'Tiene funciones a medida.' : 'Usa el default de todos los negocios.'}
            </div>
          </div>
          {negocio && !veTodo && propios && (
            <button type="button" disabled={guardando} onClick={async () => {
              const antes = ocultos;
              setDatos((d) => ({ ...d, negocios: d.negocios.map((n) => (n.id === negocio.id ? { ...n, ocultos: null } : n)) }));
              try { await SuperAPI.guardarFunciones(negocio.id, null, antes); } catch { showAlert('No se pudo guardar', 'error'); }
            }} style={{ height: ALTO, padding: '0 14px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.band, fontFamily: FB, fontWeight: 700, fontSize: 13, color: T.text2, cursor: 'pointer' }}>
              Volver al default
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {AREAS.map((a) => {
            const areaVisible = veTodo || !ocultos.includes(a.id);
            return (
              <section key={a.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', background: T.band, boxShadow: T.sombraSuave }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 48, background: T.card }}>
                  <span style={{ flex: 1, fontFamily: FT, fontSize: 14, fontWeight: 700 }}>{a.label}</span>
                  <Interruptor prendido={areaVisible} deshabilitado={veTodo || guardando}
                    titulo={areaVisible ? `Ocultar ${a.label}` : `Mostrar ${a.label}`} onCambio={(v) => cambiar(a.id, v)} />
                </div>
                {a.funciones.map(([id, label]) => {
                  const vis = veTodo || (areaVisible && !ocultos.includes(id));
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderTop: `1px solid ${T.border}`, opacity: areaVisible ? 1 : 0.5 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: vis ? T.text : T.text3 }}>{label}</span>
                      <Interruptor prendido={vis} deshabilitado={veTodo || !areaVisible || guardando}
                        titulo={!areaVisible ? `Primero mostrá ${a.label}` : vis ? `Ocultar ${label}` : `Mostrar ${label}`}
                        onCambio={(v) => cambiar(id, v)} />
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: T.text3, marginTop: 10 }}>
          Lo oculto no aparece en Inicio ni en el menú de módulos, y si entran por el link vuelven a Inicio. Cada cambio en un negocio le llega a su campanita.
        </div>
      </div>
    </div>
  );
}
