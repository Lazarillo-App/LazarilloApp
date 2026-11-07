/* eslint-disable no-unused-vars */
// src/paginas/RrhhNomina.jsx
// RRHH › Nómina — alta y edición de empleados (ABM).
// La nómina se sincroniza sola con la réplica de MaxiRest cada vez que se abre
// RRHH (GET /config): los códigos nuevos entran y los dados de baja en MaxiRest
// se desactivan. Lo que se edita acá (nombre, apellido, sector, activo) no lo
// pisa la sync. Los empleados no se borran: se desactivan (tienen historia).

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RrhhAPI } from '../servicios/apiRrhh';
import { useBusiness } from '../context/BusinessContext';

/* ───────── tema (el mismo de Cronogramas) ───────── */
const T = {
  bg: '#F3F6FA', band: '#FFFFFF', card: '#EAF1F8', head: '#F7FAFD',
  accent: '#5BC2EA', accentTxt: '#1E87B5', ink: '#15213E',
  text: '#15213E', text2: '#46587A', text3: '#8696B2',
  border: '#E2E9F2', border2: '#C9D6E6',
  ok: '#1FA866', warn: '#C8912B', bad: '#D64545', violet: '#8B5CF6',
  sombra: '0 20px 60px #15213E33', vacio: '#B9C7DA',
};
const FT = "'Sora', sans-serif";
const FB = "'Archivo', sans-serif";

const Boton = ({ children, onClick, activo, peligro, deshabilitado, title }) => (
  <button onClick={deshabilitado ? undefined : onClick} title={title} style={{
    fontFamily: FB, fontWeight: 700, fontSize: 12.5, padding: '6px 12px', borderRadius: 10,
    cursor: deshabilitado ? 'default' : 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${peligro ? T.bad + '88' : activo ? T.accent : T.border2}`,
    background: activo ? T.accent : 'transparent',
    color: deshabilitado ? T.text3 : peligro ? T.bad : activo ? T.ink : T.text2,
    opacity: deshabilitado ? 0.5 : 1,
  }}>{children}</button>
);
const Etiqueta = ({ color, children, title }) => (
  <span title={title} style={{
    display: 'inline-block', fontFamily: FB, fontSize: 11, fontWeight: 700, color,
    border: `1px solid ${color}55`, background: color + '12', borderRadius: 7, padding: '1px 7px', whiteSpace: 'nowrap',
  }}>{children}</span>
);
const ddmmaaaa = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const nombreDe = (e) => `${e.nombre || ''}${e.apellido ? ` ${e.apellido}` : ''}`.trim();
const normTxt = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ───────── modal: alta / edición ───────── */
function ModalEmpleado({ empleado, sectores, onGuardar, onCerrar }) {
  const nuevo = !empleado;
  const [nombre, setNombre] = useState(empleado?.nombre || '');
  const [apellido, setApellido] = useState(empleado?.apellido || '');
  const [sector, setSector] = useState(empleado?.sector || '');
  const [activo, setActivo] = useState(empleado ? empleado.activo !== false : true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const input = { width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head };
  const rotulo = { fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 };
  const guardar = async () => {
    if (!nombre.trim()) { setError('Poné al menos el nombre.'); return; }
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), apellido: apellido.trim(), sector: sector.trim(), activo });
    } catch (e) {
      setError(e?.data?.message || e.message || 'No se pudo guardar.');
      setGuardando(false);
    }
  };
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>{nuevo ? 'Nuevo empleado' : nombreDe(empleado)}</div>
          <span onClick={onCerrar} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 2 }}>
          {nuevo ? 'Alta propia de Lazarillo (sin código de MaxiRest).'
            : empleado.origen === 'maxirest' ? `Código MaxiRest ${empleado.codigoMaxi} · lo que cambies acá no lo pisa la sincronización.`
              : 'Alta propia de Lazarillo.'}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={rotulo}>Nombre</div>
            <input autoFocus value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Ej.: Camila" style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={rotulo}>Apellido</div>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej.: Cancino" style={input} />
          </div>
        </div>
        <div style={rotulo}>Sector</div>
        <input value={sector} onChange={(e) => setSector(e.target.value)} list="rrhh-sectores" placeholder="Ej.: Salón, Cocina" style={input} />
        <datalist id="rrhh-sectores">{sectores.map((s) => <option key={s} value={s} />)}</datalist>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FB, fontSize: 13, color: T.text, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ accentColor: T.accent }} />
          Activo
        </label>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '2px 0 0 24px' }}>Los inactivos no aparecen para asignar en los cronogramas.</div>
        {empleado?.bajaMaxi && (
          <div style={{ fontFamily: FB, fontSize: 12, color: T.warn, marginTop: 6 }}>
            MaxiRest le dio la baja el {ddmmaaaa(empleado.bajaMaxi)}. Si lo reactivás, la sincronización lo respeta.
          </div>
        )}
        {error && <div style={{ fontFamily: FB, fontSize: 12.5, color: T.bad, marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton activo deshabilitado={guardando} onClick={guardar}>{guardando ? 'Guardando…' : nuevo ? 'Crear' : 'Guardar'}</Boton>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ página ═══════════════ */
export default function RrhhNomina() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [config, setConfig] = useState(null);
  const [filtro, setFiltro] = useState('activos'); // activos | inactivos | todos
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState(null);   // null | 'nuevo' | empleado
  const [toast, setToast] = useState(null);
  const [sync, setSync] = useState(undefined);           // null = el negocio no tiene MaxiRest
  const { activeBusinessId } = useBusiness() || {};
  const cargaSeq = useRef(0);

  const avisar = useCallback((msj, tipo = 'ok') => {
    setToast({ msj, tipo });
    setTimeout(() => setToast((t) => (t && t.msj === msj ? null : t)), 3600);
  }, []);

  const cargar = useCallback(async () => {
    const mi = ++cargaSeq.current;
    setCargando(true); setErrorCarga(''); setEditando(null);
    try {
      const r = await RrhhAPI.getConfig();
      if (mi !== cargaSeq.current) return; // se cambió de negocio mientras cargaba
      setConfig(r.config);
      setSync(r.sync);
      const s = r.sync;
      if (s && (s.altas?.length || s.bajas?.length)) {
        const partes = [];
        if (s.altas.length) partes.push(`${s.altas.length} ${s.altas.length === 1 ? 'alta' : 'altas'}`);
        if (s.bajas.length) partes.push(`${s.bajas.length} ${s.bajas.length === 1 ? 'baja' : 'bajas'}`);
        avisar(`Sincronizado con MaxiRest: ${partes.join(' · ')}.`);
      }
    } catch (e) {
      setErrorCarga(e?.data?.message || e.message || 'No se pudo cargar la nómina.');
    } finally {
      if (mi === cargaSeq.current) setCargando(false);
    }
    // activeBusinessId: al cambiar de negocio en el header se recarga
  }, [avisar, activeBusinessId]);
  useEffect(() => { cargar(); }, [cargar]);

  const empleados = config?.empleados || [];
  const cuenta = useMemo(() => ({
    activos: empleados.filter((e) => e.activo !== false).length,
    inactivos: empleados.filter((e) => e.activo === false).length,
    todos: empleados.length,
  }), [empleados]);
  const sectores = useMemo(() => {
    const set = new Set();
    (config?.espacios || []).forEach((e) => e.sectorNomina && set.add(e.sectorNomina));
    empleados.forEach((e) => e.sector && set.add(e.sector));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [config, empleados]);
  const visibles = useMemo(() => {
    const txt = normTxt(q.trim());
    return empleados
      .filter((e) => (filtro === 'todos' ? true : filtro === 'activos' ? e.activo !== false : e.activo === false))
      .filter((e) => !txt || normTxt(nombreDe(e)).includes(txt) || String(e.codigoMaxi || '').includes(txt) || normTxt(e.sector).includes(txt))
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  }, [empleados, filtro, q]);

  const guardar = async (datos) => {
    if (editando === 'nuevo') {
      const r = await RrhhAPI.crearEmpleado({ nombre: datos.nombre, apellido: datos.apellido, sector: datos.sector || null });
      let emp = r.empleado;
      if (!datos.activo && emp) emp = (await RrhhAPI.editarEmpleado(emp.id, { activo: false })).empleado;
      setConfig((c) => ({ ...c, empleados: [...c.empleados, emp] }));
      avisar(`${nombreDe(emp)} dado de alta ✓`);
    } else {
      const r = await RrhhAPI.editarEmpleado(editando.id, datos);
      setConfig((c) => ({ ...c, empleados: c.empleados.map((e) => (e.id === r.empleado.id ? r.empleado : e)) }));
      avisar(`${nombreDe(r.empleado)} guardado ✓`);
    }
    setEditando(null);
  };

  const th = { padding: '9px 12px', fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', borderBottom: `1px solid ${T.border2}`, background: T.head, position: 'sticky', top: 0, zIndex: 1 };
  const td = { padding: '8px 12px', fontFamily: FB, fontSize: 13, color: T.text, borderBottom: `1px solid ${T.border}` };

  if (cargando) return <div style={{ padding: 32, fontFamily: FB, color: T.text2, background: T.bg, minHeight: '60vh' }}>Cargando la nómina…</div>;
  if (errorCarga) {
    return (
      <div style={{ padding: 32, fontFamily: FB, background: T.bg, minHeight: '60vh' }}>
        <div style={{ color: T.bad, fontWeight: 700, marginBottom: 10 }}>{errorCarga}</div>
        <Boton activo onClick={cargar}>Reintentar</Boton>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: 'calc(100vh - 64px)', padding: '14px 18px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* barra: título + filtros + acción principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 20, color: T.text, marginRight: 6 }}>Nómina</div>
          <Boton activo={filtro === 'activos'} onClick={() => setFiltro('activos')}>Activos · {cuenta.activos}</Boton>
          <Boton activo={filtro === 'inactivos'} onClick={() => setFiltro('inactivos')}>Inactivos · {cuenta.inactivos}</Boton>
          <Boton activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos · {cuenta.todos}</Boton>
          <div style={{ flex: 1 }} />
          <Boton activo onClick={() => setEditando('nuevo')}>+ Nuevo empleado</Boton>
        </div>
        {sync === null ? (
          <div style={{ fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '14', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
            Este negocio no tiene MaxiRest conectado: la nómina no entra sola. Dá de alta a tu equipo con <b>+ Nuevo empleado</b>.
          </div>
        ) : sync?.error ? (
          <div style={{ fontFamily: FB, fontSize: 12.5, color: T.bad, background: T.bad + '10', border: `1px solid ${T.bad}44`, borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
            No se pudo leer la nómina de MaxiRest en este momento: se muestra lo último que se sincronizó.
          </div>
        ) : (
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginBottom: 12 }}>
            Se sincroniza sola con MaxiRest al abrir RRHH: las altas entran y las bajas se desactivan. Lo que edites acá no se pisa.
          </div>
        )}

        <div style={{ background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* buscador pegado a la lista (filtra solo esta tabla) */}
          <div style={{ padding: 10, borderBottom: `1px solid ${T.border}` }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o sector…"
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
          </div>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Empleado</th>
                  <th style={{ ...th, width: 90 }}>Código</th>
                  <th style={{ ...th, width: 160 }}>Sector</th>
                  <th style={{ ...th, width: 110 }}>Origen</th>
                  <th style={{ ...th, width: 220 }}>Estado</th>
                  <th style={{ ...th, width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => (
                  <tr key={e.id} onClick={() => setEditando(e)} style={{ cursor: 'pointer', opacity: e.activo === false ? 0.6 : 1 }} title="Editar">
                    <td style={{ ...td, fontWeight: 700 }}>{nombreDe(e) || '—'}</td>
                    <td style={{ ...td, color: T.text3, fontSize: 12 }}>{e.codigoMaxi || '—'}</td>
                    <td style={{ ...td, color: T.text2 }}>{e.sector || <span style={{ color: T.vacio }}>sin sector</span>}</td>
                    <td style={td}>
                      {e.origen === 'maxirest' ? <Etiqueta color={T.accentTxt}>MaxiRest</Etiqueta> : <Etiqueta color={T.violet}>Manual</Etiqueta>}
                    </td>
                    <td style={td}>
                      {e.activo === false
                        ? <Etiqueta color={T.text3} title={e.bajaMaxi ? `Baja en MaxiRest el ${ddmmaaaa(e.bajaMaxi)}` : 'Desactivado en Lazarillo'}>
                          Inactivo{e.bajaMaxi ? ` · baja ${ddmmaaaa(e.bajaMaxi)}` : ''}
                        </Etiqueta>
                        : <Etiqueta color={T.ok}>Activo</Etiqueta>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}><span style={{ color: T.accentTxt, fontWeight: 700, fontSize: 12.5 }}>✎ Editar</span></td>
                  </tr>
                ))}
                {!visibles.length && (
                  <tr><td colSpan={6} style={{ ...td, color: T.text3, textAlign: 'center', padding: 28 }}>
                    {empleados.length ? 'Nadie coincide con el filtro.' : 'Todavía no hay empleados: agregá el primero con "+ Nuevo empleado".'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editando && (
        <ModalEmpleado
          empleado={editando === 'nuevo' ? null : editando}
          sectores={sectores}
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.band, border: `1px solid ${toast.tipo === 'error' ? T.bad : T.accent}88`, color: toast.tipo === 'error' ? T.bad : T.text, fontFamily: FB, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 12, boxShadow: T.sombra, zIndex: 60 }}>
          {toast.msj}
        </div>
      )}
    </div>
  );
}
