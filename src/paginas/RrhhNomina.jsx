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
import ListaNegociosNomina from '../componentes/RrhhNominaCompartida';

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
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const bajaDe = (e) => e.fechaBaja || e.bajaMaxi || null;

/* Chip de estado clickeable: Activo → dar de baja · Inactivo → reactivar.
   Al pasar el mouse dice qué va a hacer. */
function ChipEstado({ empleado, onBaja, onReactivar }) {
  const [hover, setHover] = useState(false);
  const activo = empleado.activo !== false;
  const baja = bajaDe(empleado);
  const color = hover ? (activo ? T.bad : T.accentTxt) : (activo ? T.ok : T.text3);
  return (
    <span
      onClick={(ev) => { ev.stopPropagation(); (activo ? onBaja : onReactivar)(empleado); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={activo ? 'Dar de baja' : 'Reactivar'}
      style={{ display: 'inline-block', cursor: 'pointer', fontFamily: FB, fontSize: 11, fontWeight: 700, color,
        border: `1px solid ${color}55`, background: color + '12', borderRadius: 7, padding: '1px 7px', whiteSpace: 'nowrap', minWidth: 72, textAlign: 'center', boxSizing: 'border-box' }}>
      {hover ? (activo ? 'Dar de baja' : 'Reactivar') : activo ? 'Activo' : `Inactivo${baja ? ` · baja ${ddmmaaaa(baja)}` : ''}`}
    </span>
  );
}

/* Chip de Cronogramas: muestra los espacios APRENDIDOS de los cronogramas (no se
   cargan a mano) y al tocarlo marca/desmarca "No aplica a cronogramas"
   (contador, dueño, usuarios técnicos). Al pasar el mouse dice qué va a hacer. */
function ChipCrono({ empleado, onCambiar }) {
  const [hover, setHover] = useState(false);
  const noAplica = !!empleado.noAplica;
  const espacios = (empleado.espacios || []).map((x) => x.nombre).join(' · ');
  const sug = !!empleado.sugerirBaja;
  const texto = hover
    ? (noAplica ? 'Vuelve a cronogramas' : 'Marcar No aplica')
    : noAplica ? 'No aplica' : sug ? 'Sin turnos hace 8+ sem' : (espacios || 'Sin turnos aún');
  const color = hover ? T.accentTxt : noAplica ? T.text3 : sug ? T.warn : espacios ? T.accentTxt : T.vacio;
  return (
    <span
      onClick={(ev) => { ev.stopPropagation(); onCambiar(empleado, !noAplica); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={noAplica ? 'No aparece para asignar en Cronogramas' : 'Se completa solo con los cronogramas de las últimas 8 semanas'}
      style={{ display: 'inline-block', cursor: 'pointer', fontFamily: FB, fontSize: 11, fontWeight: 700, color,
        border: `1px ${noAplica || (!espacios && !sug && !hover) ? 'dashed' : 'solid'} ${color}66`, background: hover || espacios || sug ? color + '12' : 'transparent',
        borderRadius: 7, padding: '1px 7px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', verticalAlign: 'middle' }}>
      {texto}
    </span>
  );
}

// Vista previa de EJEMPLO (nómina vacía): solo se dibuja, nunca se guarda.
const EJEMPLO_NOMINA = [
  ['Ana López', '12', 'MaxiRest', 'Salón · Cocina'],
  ['Juan Pérez', '15', 'MaxiRest', 'Salón'],
  ['Mara Díaz', '21', 'Manual', 'Cocina'],
  ['Estudio contable', '—', 'Manual', 'No aplica'],
];

/* ───────── modal chico: fecha de baja ───────── */
function ModalBaja({ empleado, onConfirmar, onCerrar }) {
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const confirmar = async () => { setGuardando(true); try { await onConfirmar(fecha); } finally { setGuardando(false); } };
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: '#15213E66', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 340, maxWidth: '94vw', background: T.band, borderRadius: 16, boxShadow: T.sombra, padding: 18, border: `1px solid ${T.border}`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, color: T.text }}>Dar de baja</div>
          <span onClick={onCerrar} style={{ cursor: 'pointer', color: T.text3, fontSize: 18 }}>✕</span>
        </div>
        <div style={{ fontFamily: FB, fontSize: 12.5, color: T.text2, marginTop: 2 }}>{nombreDe(empleado)} deja de aparecer para asignar en los cronogramas.</div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text2, margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fecha de baja</div>
        <input type="date" value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} autoFocus
          style={{ width: '100%', boxSizing: 'border-box', height: 40, fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 6 }}>Si la dejás vacía, queda hoy ({ddmmaaaa(hoyIso())}).</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton peligro deshabilitado={guardando} onClick={confirmar}>{guardando ? 'Guardando…' : 'Dar de baja'}</Boton>
        </div>
      </div>
    </div>
  );
}
const normTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ───────── modal: alta / edición ───────── */
function ModalEmpleado({ empleado, sectores, onGuardar, onCerrar }) {
  const nuevo = !empleado;
  const [nombre, setNombre] = useState(empleado?.nombre || '');
  const [apellido, setApellido] = useState(empleado?.apellido || '');
  const [sector, setSector] = useState(empleado?.sector || '');
  const [activo, setActivo] = useState(empleado ? empleado.activo !== false : true);
  const [fechaBaja, setFechaBaja] = useState(empleado?.fechaBaja || '');
  // Fecha de alta y DNI (Diego 12/11/2026). El DNI no es obligatorio todavía: va a ser la clave
  // única de cada persona para accesos y fichajes.
  const [fechaAlta, setFechaAlta] = useState(empleado?.fechaAlta || (empleado ? '' : hoyIso()));
  const [dni, setDni] = useState(empleado?.dni || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const input = { width: '100%', height: 40, boxSizing: 'border-box', fontFamily: FB, fontSize: 13, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head };
  const rotulo = { fontFamily: FB, fontSize: 12, color: T.text2, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 };
  const guardar = async () => {
    if (!nombre.trim()) { setError('Poné al menos el nombre.'); return; }
    setGuardando(true);
    try {
      const dniLimpio = dni.replace(/\D/g, '');
      await onGuardar({
        nombre: nombre.trim(), apellido: apellido.trim(), sector: sector.trim(), activo,
        ...(!activo && fechaBaja ? { fechaBaja } : {}),
        fechaAlta,
        // Solo si cambió: el servidor controla que no se repita en la nómina.
        ...(dniLimpio !== (empleado?.dni || '') ? { dni: dniLimpio } : {}),
      });
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
          {nuevo ? 'Alta propia de Lazarillo (sin código de tu PDV).'
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

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={rotulo}>Fecha de alta</div>
            <input type="date" value={fechaAlta} max={hoyIso()} onChange={(e) => setFechaAlta(e.target.value)} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={rotulo}>DNI</div>
            <input value={dni} inputMode="numeric" onChange={(e) => { setDni(e.target.value.replace(/[^\d.\s]/g, '')); setError(''); }} placeholder="Opcional" style={input} />
          </div>
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, marginTop: 6 }}>
          {empleado?.origen === 'maxirest'
            ? 'Si están en tu PDV, la fecha de alta y el DNI se completan solos; lo que cargues acá no se pisa. '
            : ''}
          El DNI no es obligatorio por ahora: más adelante va a ser la clave única de cada persona para entrar al sistema y fichar.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FB, fontSize: 13, color: T.text, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ accentColor: T.accent }} />
          Activo
        </label>
        <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '2px 0 0 24px' }}>Los inactivos no aparecen para asignar en los cronogramas.</div>
        {!activo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0 24px' }}>
            <span style={{ fontFamily: FB, fontSize: 12, color: T.text2 }}>Fecha de baja</span>
            <input type="date" value={fechaBaja} max={hoyIso()} onChange={(e) => setFechaBaja(e.target.value)}
              style={{ height: 32, fontFamily: FB, fontSize: 12.5, padding: '0 8px', borderRadius: 8, border: `1px solid ${T.border2}`, outline: 'none', color: T.text, background: T.head }} />
            <span style={{ fontFamily: FB, fontSize: 11.5, color: T.text3 }}>vacía = hoy</span>
          </div>
        )}
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
  const [eligiendo, setEligiendo] = useState(false);
  const [bajaDeQuien, setBajaDeQuien] = useState(null); // empleado al que se le está dando de baja

  const avisar = useCallback((msj, tipo = 'ok') => {
    setToast({ msj, tipo });
    setTimeout(() => setToast((t) => (t && t.msj === msj ? null : t)), 3600);
  }, []);

  const cargar = useCallback(async () => {
    const mi = ++cargaSeq.current;
    setCargando(true); setErrorCarga(''); setEditando(null); setEligiendo(false);
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
  const compartidaCon = config?.nomina?.compartidaCon || null;
  const dejarDeCompartir = async () => {
    try {
      await RrhhAPI.desvincularNomina();
      avisar('Dejaste de compartir la nómina ✓');
      cargar();
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo dejar de compartir.', 'error');
    }
  };
  const sugeridos = useMemo(() => empleados.filter((e) => e.sugerirBaja), [empleados]);
  const historia = config?.historia || { semanas: 0, alcanza: false };
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
      .filter((e) => (filtro === 'todos' ? true : filtro === 'sugeridos' ? e.sugerirBaja : filtro === 'activos' ? e.activo !== false : e.activo === false))
      .filter((e) => !txt || normTxt(nombreDe(e)).includes(txt) || String(e.codigoMaxi || '').includes(txt) || normTxt(e.sector).includes(txt))
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  }, [empleados, filtro, q]);

  // el PATCH devuelve el empleado sin lo aprendido (espacios, sugerencia): se conserva lo que ya estaba
  const reemplazar = (emp, extra = {}) => setConfig((c) => ({
    ...c, empleados: c.empleados.map((e) => (e.id === emp.id ? { ...e, ...emp, ...extra } : e)),
  }));
  const cambiarNoAplica = async (emp, noAplica) => {
    reemplazar({ ...emp, noAplica }, { sugerirBaja: noAplica ? false : emp.sugerirBaja }); // optimista
    try {
      const r = await RrhhAPI.editarEmpleado(emp.id, { noAplica });
      reemplazar(r.empleado);
      avisar(noAplica ? `${nombreDe(emp)} no va en cronogramas` : `${nombreDe(emp)} vuelve a cronogramas ✓`);
    } catch (e) {
      reemplazar(emp);
      avisar(e?.data?.message || e.message || 'No se pudo guardar.', 'error');
    }
  };
  const sigueActivo = async (emp) => {
    reemplazar(emp, { sugerirBaja: false });
    try {
      await RrhhAPI.editarEmpleado(emp.id, { silenciarBaja: true });
      avisar(`${nombreDe(emp)} sigue activo: no se vuelve a sugerir por 8 semanas.`);
    } catch (e) {
      reemplazar(emp);
      avisar(e?.data?.message || e.message || 'No se pudo guardar.', 'error');
    }
  };
  const darDeBaja = async (fecha) => {
    try {
      const r = await RrhhAPI.editarEmpleado(bajaDeQuien.id, { activo: false, ...(fecha ? { fechaBaja: fecha } : {}) });
      reemplazar(r.empleado, { sugerirBaja: false });
      setBajaDeQuien(null);
      avisar(`${nombreDe(r.empleado)} dado de baja · ${ddmmaaaa(r.empleado.fechaBaja)}`);
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo dar de baja.', 'error');
    }
  };
  const reactivar = async (emp) => {
    try {
      const r = await RrhhAPI.editarEmpleado(emp.id, { activo: true });
      reemplazar(r.empleado);
      avisar(`${nombreDe(r.empleado)} reactivado ✓`);
    } catch (e) {
      avisar(e?.data?.message || e.message || 'No se pudo reactivar.', 'error');
    }
  };

  const guardar = async (datos) => {
    if (editando === 'nuevo') {
      const r = await RrhhAPI.crearEmpleado({ nombre: datos.nombre, apellido: datos.apellido, sector: datos.sector || null, fechaAlta: datos.fechaAlta || null, dni: datos.dni || null });
      let emp = r.empleado;
      if (!datos.activo && emp) emp = (await RrhhAPI.editarEmpleado(emp.id, { activo: false })).empleado;
      setConfig((c) => ({ ...c, empleados: [...c.empleados, emp] }));
      avisar(`${nombreDe(emp)} dado de alta ✓`);
    } else {
      const r = await RrhhAPI.editarEmpleado(editando.id, datos);
      reemplazar(r.empleado);
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
        {compartidaCon ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontFamily: FB, fontSize: 12.5, color: T.accentTxt, background: T.accent + '18', border: `1px solid ${T.accent}66`, borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
            <span>Nómina compartida con <b>{compartidaCon.nombre}</b>: las altas, bajas y cambios se ven en los dos negocios.</span>
            <span onClick={dejarDeCompartir} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>Dejar de compartir</span>
          </div>
        ) : sync === null && !empleados.length && !eligiendo ? null : sync === null ? (
          <div style={{ fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '14', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>Este negocio no está integrado con tu PDV: la nómina no entra sola. Dá de alta a tu equipo con <b>+ Nuevo empleado</b>{empleados.length ? '.' : ', o usá la de otro negocio.'}</span>
              {!empleados.length && !eligiendo && (
                <span onClick={() => setEligiendo(true)} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>Usar la nómina de otro negocio</span>
              )}
            </div>
            {eligiendo && (
              <div style={{ background: T.band, borderRadius: 10, padding: '2px 12px 10px', marginTop: 8 }}>
                <ListaNegociosNomina
                  onCancelar={() => setEligiendo(false)}
                  onVinculado={(o) => { avisar(`Ahora usás la nómina de ${o?.nombre || 'ese negocio'} ✓`); cargar(); }}
                />
              </div>
            )}
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

        {empleados.length > 0 && (
          <div style={{ fontFamily: FB, fontSize: 12, color: T.text3, margin: '-6px 0 12px' }}>
            {historia.semanas > 0
              ? `Cronogramas: los espacios se completan solos con las últimas 8 semanas. ${historia.alcanza ? '' : `Las sugerencias de baja aparecen cuando haya 8 semanas de cronogramas (van ${historia.semanas}).`}`
              : 'Cronogramas: el espacio de cada uno se completa solo cuando lo pongas en un cronograma. Si alguien no va en cronogramas (contador, dueño), tocá su chip y marcalo No aplica.'}
          </div>
        )}
        {(sugeridos.length > 0 || filtro === 'sugeridos') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontFamily: FB, fontSize: 12.5, color: T.warn, background: T.warn + '14', border: `1px solid ${T.warn}55`, borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
            <span>{sugeridos.length
              ? <><b>{sugeridos.length} {sugeridos.length === 1 ? 'empleado activo' : 'empleados activos'}</b> sin turnos hace más de 8 semanas: ¿{sugeridos.length === 1 ? 'le' : 'les'} cargás la baja?</>
              : 'Ya no quedan empleados sin turnos para revisar ✓'}</span>
            <span onClick={() => setFiltro(filtro === 'sugeridos' ? 'activos' : 'sugeridos')} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              {filtro === 'sugeridos' ? 'Ver todos' : 'Revisar'}
            </span>
          </div>
        )}

        <div style={{ position: 'relative', background: T.band, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
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
                  <th style={{ ...th, width: 190 }}>Cronogramas</th>
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
                    <td style={{ ...td, maxWidth: 190 }}><ChipCrono empleado={e} onCambiar={cambiarNoAplica} /></td>
                    <td style={td}>
                      {e.origen === 'maxirest' ? <Etiqueta color={T.accentTxt}>MaxiRest</Etiqueta> : <Etiqueta color={T.violet}>Manual</Etiqueta>}
                    </td>
                    <td style={td}>
                      <ChipEstado empleado={e} onBaja={setBajaDeQuien} onReactivar={reactivar} />
                      {e.sugerirBaja && (
                        <span onClick={(ev) => { ev.stopPropagation(); sigueActivo(e); }} title="No se vuelve a sugerir por 8 semanas"
                          style={{ marginLeft: 8, fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: T.warn, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>Sigue activo</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}><span style={{ color: T.accentTxt, fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>✎ Editar</span></td>
                  </tr>
                ))}
                {!visibles.length && empleados.length > 0 && (
                  <tr><td colSpan={6} style={{ ...td, color: T.text3, textAlign: 'center', padding: 28 }}>Nadie coincide con el filtro.</td></tr>
                )}
                {!empleados.length && EJEMPLO_NOMINA.map(([nom, cod, origen, crono]) => (
                  <tr key={nom} aria-hidden style={{ opacity: 0.38, pointerEvents: 'none' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{nom}</td>
                    <td style={{ ...td, color: T.text3, fontSize: 12 }}>{cod}</td>
                    <td style={td}><Etiqueta color={crono === 'No aplica' ? T.text3 : T.accentTxt}>{crono}</Etiqueta></td>
                    <td style={td}><Etiqueta color={origen === 'MaxiRest' ? T.accentTxt : T.violet}>{origen}</Etiqueta></td>
                    <td style={td}><Etiqueta color={T.ok}>Activo</Etiqueta></td>
                    <td style={td} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!empleados.length && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 16px 22px' }}>
                <div style={{ width: 440, maxWidth: '100%', background: T.band, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.sombra, padding: 22, textAlign: 'center', boxSizing: 'border-box' }}>
                  <span style={{ display: 'inline-block', fontFamily: FB, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, color: T.text3, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '2px 8px', marginBottom: 10 }}>ARRIBA, UN EJEMPLO</span>
                  <div style={{ fontFamily: FT, fontWeight: 800, fontSize: 18, color: T.text, marginBottom: 6 }}>Cargá a tu equipo</div>
                  <div style={{ fontFamily: FB, fontSize: 13, color: T.text2, marginBottom: 16 }}>
                    {sync === null
                      ? 'Este negocio no está integrado con tu PDV: das de alta a cada uno o usás la nómina de otro negocio de tu cartera.'
                      : 'La nómina de MaxiRest entra sola al abrir RRHH; si falta alguien, dalo de alta acá.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Boton activo onClick={() => setEditando('nuevo')}>+ Nuevo empleado</Boton>
                    {sync === null && !compartidaCon && <Boton onClick={() => setEligiendo(true)}>Usar la de otro negocio</Boton>}
                  </div>
                </div>
              </div>
            </>
          )}
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
      {bajaDeQuien && <ModalBaja empleado={bajaDeQuien} onConfirmar={darDeBaja} onCerrar={() => setBajaDeQuien(null)} />}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.band, border: `1px solid ${toast.tipo === 'error' ? T.bad : T.accent}88`, color: toast.tipo === 'error' ? T.bad : T.text, fontFamily: FB, fontSize: 13.5, fontWeight: 600, padding: '11px 18px', borderRadius: 12, boxShadow: T.sombra, zIndex: 60 }}>
          {toast.msj}
        </div>
      )}
    </div>
  );
}
