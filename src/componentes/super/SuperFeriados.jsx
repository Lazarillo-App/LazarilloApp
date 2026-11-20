// src/componentes/super/SuperFeriados.jsx
// Panel super › Feriados (Diego 20/11/2026): el calendario ÚNICO de Lazarillo, por zona. Todos los
// negocios heredan los nacionales + los de su provincia (sin copiar). Lo mantienen los super usuarios
// cuando sale un decreto (trasladables, días turísticos, feriados extraordinarios).
import React, { useEffect, useMemo, useState } from 'react';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const ALTO = 40;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIPO_TXT = { inamovible: 'Inamovible', trasladable: 'Trasladable', no_laborable: 'No laborable', extraordinario: 'Extraordinario' };
const campo = { height: ALTO, boxSizing: 'border-box', padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, fontFamily: FB, fontSize: 13.5, color: T.text, background: T.band };
const boton = (primario, peligro) => ({
  height: ALTO, padding: '0 14px', borderRadius: 10, fontFamily: FB, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${peligro ? T.bad + '66' : primario ? T.accent : T.border2}`, background: primario ? T.accent : T.band, color: peligro ? T.bad : primario ? T.ink : T.text2,
});
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const diaDe = (f) => DIAS[new Date(f + 'T12:00:00').getDay()];
const VACIO = { fecha: '', nombre: '', tipo: 'inamovible', zona: 'AR', fuente: '' };

export default function SuperFeriados() {
  useEffect(() => { cargarFuentes(); }, []);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [datos, setDatos] = useState({ feriados: [], zonas: [], tipos: [] });
  const [zona, setZona] = useState('');
  const [ed, setEd] = useState(null); // { id?, fecha, nombre, tipo, zona, fuente }
  const [guardando, setGuardando] = useState(false);

  const cargar = async (a = anio) => {
    try { const r = await SuperAPI.feriados(a); setDatos({ feriados: r.feriados || [], zonas: r.zonas || [], tipos: r.tipos || [] }); }
    catch (e) { showAlert(e?.message || 'No se pudieron leer los feriados', 'error'); }
  };
  useEffect(() => { cargar(anio); }, [anio]); // eslint-disable-line react-hooks/exhaustive-deps

  const nombreZona = (z) => (datos.zonas.find((x) => x.zona === z) || { nombre: z }).nombre;
  const zonasUsadas = useMemo(() => [...new Set(datos.feriados.map((f) => f.zona))], [datos.feriados]);
  const lista = datos.feriados.filter((f) => !zona || f.zona === zona);

  const guardar = async () => {
    if (!ed?.fecha || !ed?.nombre?.trim()) { showAlert('Fecha y nombre', 'error'); return; }
    setGuardando(true);
    try {
      if (ed.id) await SuperAPI.editarFeriado(ed.id, ed); else await SuperAPI.crearFeriado(ed);
      showAlert(ed.id ? 'Feriado guardado ✓' : 'Feriado agregado ✓', 'success');
      setEd(null);
      if (Number(ed.fecha.slice(0, 4)) !== anio) setAnio(Number(ed.fecha.slice(0, 4))); else cargar();
    } catch (e) {
      showAlert(e?.data?.error === 'ya_existe' ? 'Ya hay un feriado ese día en esa zona' : (e?.message || 'No se pudo guardar'), 'error');
    } finally { setGuardando(false); }
  };
  const borrar = async (f) => {
    if (!window.confirm(`¿Quitar «${f.nombre}» del ${ddmm(f.fecha)} (${nombreZona(f.zona)})? Deja de valer para todos los negocios de esa zona.`)) return;
    try { await SuperAPI.borrarFeriado(f.id); showAlert('Feriado quitado', 'success'); cargar(); }
    catch (e) { showAlert(e?.message || 'No se pudo quitar', 'error'); }
  };

  const chip = (activo) => ({ ...boton(false), height: 34, fontWeight: 600, fontSize: 12.5, background: activo ? T.accent : T.band, color: activo ? T.ink : T.text2, border: `1px solid ${activo ? T.accent : T.border2}` });

  return (
    <div style={{ fontFamily: FB, color: T.text, maxWidth: 980 }}>
      <div style={{ fontSize: 13, color: T.text2, marginBottom: 12 }}>
        Un solo calendario para todos los negocios: cada uno hereda los <b>nacionales</b> y los de <b>su provincia</b> (la elige en Cronogramas › 📅 › Fechas especiales). Cuando sale un decreto, se corrige acá y vale para todos.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={boton(false)} onClick={() => setAnio((a) => a - 1)} title="Año anterior">‹</button>
        <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 16, minWidth: 54, textAlign: 'center' }}>{anio}</div>
        <button style={boton(false)} onClick={() => setAnio((a) => a + 1)} title="Año siguiente">›</button>
        <div style={{ width: 1, alignSelf: 'stretch', background: T.border2, margin: '0 4px' }} />
        <button style={chip(!zona)} onClick={() => setZona('')}>Todas · {datos.feriados.length}</button>
        {zonasUsadas.map((z) => (
          <button key={z} style={chip(zona === z)} onClick={() => setZona(z)}>{nombreZona(z)} · {datos.feriados.filter((f) => f.zona === z).length}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={boton(true)} onClick={() => setEd({ ...VACIO, fecha: `${anio}-`, zona: zona || 'AR' })}>+ Agregar feriado</button>
      </div>

      {ed && (
        <div style={{ border: `1px solid ${T.accent}`, borderRadius: 12, padding: 12, marginBottom: 12, background: T.head, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[['Fecha', <input key="f" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(ed.fecha) ? ed.fecha : ''} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} style={{ ...campo, width: 150 }} />],
            ['Nombre', <input key="n" value={ed.nombre} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} placeholder="Ej.: Soberanía Nacional" style={{ ...campo, width: 230 }} />],
            ['Tipo', <select key="t" value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value })} style={{ ...campo, width: 150 }}>{datos.tipos.map((t) => <option key={t} value={t}>{TIPO_TXT[t] || t}</option>)}</select>],
            ['Zona', <select key="z" value={ed.zona} onChange={(e) => setEd({ ...ed, zona: e.target.value })} style={{ ...campo, width: 200 }}>{datos.zonas.map((z) => <option key={z.zona} value={z.zona}>{z.nombre}</option>)}</select>],
            ['Fuente', <input key="s" value={ed.fuente || ''} onChange={(e) => setEd({ ...ed, fuente: e.target.value })} placeholder="Decreto / ley" style={{ ...campo, width: 170 }} />],
          ].map(([t, c]) => (
            <label key={t} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t}{c}</label>
          ))}
          <div style={{ flex: 1 }} />
          <button style={boton(false)} onClick={() => setEd(null)}>Cancelar</button>
          <button style={boton(true)} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      )}

      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', background: T.band }}>
        {!lista.length && <div style={{ padding: 14, fontSize: 13, color: T.text3 }}>Sin feriados cargados para {anio}{zona ? ` en ${nombreZona(zona)}` : ''}.</div>}
        {lista.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderTop: i ? `1px solid ${T.border}` : 'none', fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ width: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{ddmm(f.fecha)}</span>
            <span style={{ width: 78, color: T.text2 }}>{diaDe(f.fecha)}</span>
            <span style={{ flex: '1 1 200px', minWidth: 0, fontWeight: 600 }}>{f.nombre}</span>
            <span style={{ width: 110, color: T.text2 }}>{TIPO_TXT[f.tipo] || f.tipo}</span>
            <span style={{ width: 170, color: T.text2 }}>{nombreZona(f.zona)}</span>
            <span style={{ width: 170, color: T.text3, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.fuente || ''}>{f.fuente || ''}</span>
            <button style={{ ...boton(false), height: 32, padding: '0 10px' }} onClick={() => setEd({ ...f })} title="Editar">✎</button>
            <button style={{ ...boton(false, true), height: 32, padding: '0 10px' }} onClick={() => borrar(f)} title="Quitar">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
