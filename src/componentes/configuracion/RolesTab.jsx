// src/componentes/configuracion/RolesTab.jsx
// Roles y permisos (Mi perfil › Equipo › Roles). Dueño, Administración y Staff son fijos;
// los roles a medida se arman sobre Administración: paso 1 qué secciones ve (y si edita),
// paso 2 qué partes no ve dentro de cada sección. La vista Staff no se toca.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, Switch, Checkbox, ToggleButton, ToggleButtonGroup, Chip, Divider, TextField, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { RolesAPI } from '@/servicios/apiRoles';
import { showConfirm } from '@/servicios/appConfirm';

// Catálogo de lo que se puede ocultar. Cada clave = un permiso (lo que no figura, se ve).
const SECCIONES = [
  {
    id: 'resultados', nombre: 'Resultados', desc: 'Panel de gestión',
    grupos: [
      { nombre: 'Tarjetas del mes', items: [
        ['tarjeta.ventas', 'Ventas'], ['tarjeta.equilibrio', 'Equilibrio'], ['tarjeta.resultado', 'Resultado'],
        ['tarjeta.mix', 'Mix (food cost y personal)'], ['tarjeta.canasta', 'Tu canasta'],
      ] },
      { nombre: 'Tabla', items: [
        ['tabla.totales_rubro', 'Totales por rubro'],
        ['tabla.ing_egr', 'Ingresos, egresos, resultado y equilibrio'],
        ['tabla.dif_caja', 'Flujo y diferencia de caja'], ['tabla.pct', 'Vista en % de ingresos'],
      ] },
      { nombre: 'Pestañas y botones', items: [
        ['tab.ventas', 'Pestaña Ventas'], ['tab.resultados', 'Pestaña Resultados'],
        ['btn.impagas', 'Impagas'], ['btn.sin_carga', 'Sin carga'], ['btn.eco_fin', 'Switch Económica / Financiera'],
      ] },
    ],
  },
  { id: 'carga', nombre: 'Carga de gastos', desc: 'Facturas, gastos varios y sueldos', grupos: [] },
  { id: 'recetas', nombre: 'Recetas', desc: 'Menú, insumos y costos', grupos: [] },
  { id: 'rrhh', nombre: 'RRHH', desc: 'Cronogramas y nómina', grupos: [] },
  { id: 'conceptos', nombre: 'Conceptos de caja', desc: 'Rubros y conceptos', grupos: [] },
  { id: 'medios', nombre: 'Medios de pago', desc: 'Cuentas, tarjetas y cheques', grupos: [] },
  { id: 'configuracion', nombre: 'Configuración', desc: 'Negocio, sucursales y sectores', grupos: [] },
  { id: 'conexiones', nombre: 'Conexiones', desc: 'Vincular PC y bajar el instalador', grupos: [] },
];

function Card({ children, sx }) {
  return <Box sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8eaf0', bgcolor: 'background.paper', ...sx }}>{children}</Box>;
}
function CardHeader({ icon, title, subtitle, action, tc }) {
  return (
    <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 64 }}>
      {icon && React.cloneElement(icon, { sx: { color: tc, fontSize: 17 } })}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={700} sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

const TODAS = Object.fromEntries(SECCIONES.map((s) => [s.id, 'editar']));
const DUENIO = { id: 'duenio', nombre: 'Dueño', fijo: true, nota: 'Ve y edita todo', secciones: TODAS, ocultos: [] };
// Staff y sus subroles (Diego 11/11/2026): por defecto restringidos; el dueño habilita lo que quiera.
// Las claves son las de AccessContext.staffPuede y las del back (services/auth/permisos.js).
const PERMISOS_STAFF = [
  { grupo: 'Recetas', items: [
    ['ver_precio', 'Ver el precio de venta'],
    ['ver_costo_pct', 'Ver el % de costo'],
    ['ver_objetivo', 'Ver el costo objetivo'],
    ['ver_sugerido', 'Ver el precio sugerido'],
    ['mover_agrupacion', 'Mover de Sin agrupación a otras agrupaciones'],
    ['ver_menu', 'Ver el Menú (vista diseño de la carta)'],
  ] },
  { grupo: 'Equipo', items: [
    ['aprobar_equipo', 'Dar el OK a los cambios de su equipo (es el jefe de sus sectores)'],
  ] },
];
const staffBaseDe = (permisos) => ({ id: 'staff', staff: true, esBase: true, nombre: 'Staff', nota: 'Vista operativa · por sectores',
  permisos: { ...(permisos || {}) }, secciones: {}, ocultos: [] });
const subrolDe = (sr) => ({ id: `staff:${sr.id}`, staffId: sr.id, staff: true, nombre: sr.nombre, personas: sr.personas ?? 0,
  nota: 'Subrol de Staff', permisos: { ...(sr.permisos || {}) }, secciones: {}, ocultos: [] });
const SUBROL_NUEVO = { id: 'staff:nuevo', staff: true, nombre: '', personas: 0, nota: 'Subrol de Staff', permisos: {}, secciones: {}, ocultos: [] };
const STAFF = staffBaseDe({});
// Administración: editable por el dueño (vale para todos los admins sin rol a medida).
// Sin ajustar, ve todo.
const adminDe = (a) => ({
  id: 'admin', nombre: 'Administración', base: true, personas: a?.personas ?? 0, ajustada: !!a?.ajustada,
  secciones: a?.ajustada ? { ...a.secciones } : { ...TODAS }, ocultos: a?.ajustada ? [...(a.ocultos || [])] : [],
});
const NUEVO = { id: 'nuevo', nombre: '', secciones: { resultados: 'ver' }, ocultos: [], personas: 0 };

function resumen(rol) {
  if (rol.fijo) return rol.nota;
  if (rol.staff) {
    const n = Object.entries(rol.permisos || {}).filter(([k, v]) => v && k !== 'aprobar_equipo').length;
    return `${rol.permisos?.aprobar_equipo ? 'Jefe · ' : ''}${n ? `${n} habilitado${n !== 1 ? 's' : ''}` : 'lo básico'}`;
  }
  if (rol.base && !rol.ajustada) return 'Ve y edita todo';
  const vis = SECCIONES.filter((s) => rol.secciones[s.id]).map((s) => s.nombre);
  const parcial = rol.ocultos.length ? ` · ${rol.ocultos.length} oculto${rol.ocultos.length !== 1 ? 's' : ''}` : '';
  return (vis.join(', ') || 'Sin secciones') + parcial;
}

const MENSAJES = {
  nombre_repetido: 'Ya hay un rol con ese nombre.',
  nombre_requerido: 'Ponele un nombre al rol.',
  rol_en_uso: 'Hay personas con este rol: cambiales el rol en Editar acceso antes de borrarlo.',
  nombre_reservado: 'Ese nombre ya lo usa un rol fijo (Dueño, Administración o Staff).',
  only_owner: 'Solo el dueño puede cambiar los roles.',
};
const mensajeDe = (e) => MENSAJES[e?.response?.data?.error || e?.data?.error || e?.message] || e?.response?.data?.error || e?.message || 'No se pudo guardar';

export default function RolesTab({ themeColor = '#0ea5e9', soloLectura = false, onCambio }) {
  const tc = themeColor;
  const [roles, setRoles] = useState([]);
  const [admin, setAdmin] = useState(adminDe(null));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [rolId, setRolId] = useState(null);
  const [borrador, setBorrador] = useState(null);   // copia editable del rol elegido
  const [seccionId, setSeccionId] = useState('resultados');
  const [guardando, setGuardando] = useState(false);

  const cargar = async (elegir) => {
    setCargando(true); setError(null);
    try {
      const { roles: lista, administracion, staff } = await RolesAPI.listCompleto();
      const adm = adminDe(administracion);
      const sr = [staffBaseDe(staff?.base), ...(staff?.subroles || []).map(subrolDe)];
      setRoles(lista); setAdmin(adm); setStaffRoles(sr);
      const id = elegir ?? rolId ?? 'admin';
      elegirRol(id, lista, adm, sr);
    } catch (e) { setError(mensajeDe(e)); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [staffRoles, setStaffRoles] = useState([STAFF]);
  const todos = useMemo(() => [DUENIO, admin, ...staffRoles, ...roles], [roles, admin, staffRoles]);
  function elegirRol(id, lista = roles, adm = admin, sr = staffRoles) {
    const r = id === 'nuevo' ? NUEVO : id === 'staff:nuevo' ? SUBROL_NUEVO : [DUENIO, adm, ...sr, ...lista].find((x) => x.id === id);
    if (!r) return;
    setRolId(id);
    setBorrador({ ...r, secciones: { ...r.secciones }, ocultos: [...r.ocultos], ...(r.permisos ? { permisos: { ...r.permisos } } : {}) });
    setError(null);
  }

  const rol = borrador;
  const seccion = SECCIONES.find((s) => s.id === seccionId);
  const ocultos = useMemo(() => new Set(rol?.ocultos || []), [rol]);
  const editable = !!rol && !rol.fijo && !soloLectura;
  const original = rolId === 'nuevo' ? NUEVO : rolId === 'staff:nuevo' ? SUBROL_NUEVO : todos.find((x) => x.id === rolId);
  const normPerm = (p) => Object.keys(p || {}).filter((k) => p[k]).sort();
  const cambiado = !!rol && JSON.stringify([rol.nombre, rol.secciones, [...rol.ocultos].sort(), normPerm(rol.permisos)]) !== JSON.stringify([original?.nombre, original?.secciones, [...(original?.ocultos || [])].sort(), normPerm(original?.permisos)]);

  const cambiar = (fn) => setBorrador((r) => fn(r));
  const toggleSeccion = (id) => cambiar((r) => {
    const s = { ...r.secciones };
    if (s[id]) delete s[id]; else s[id] = 'ver';
    return { ...r, secciones: s };
  });
  const setModo = (id, modo) => modo && cambiar((r) => ({ ...r, secciones: { ...r.secciones, [id]: modo } }));
  const toggleItem = (k) => cambiar((r) => ({ ...r, ocultos: ocultos.has(k) ? r.ocultos.filter((x) => x !== k) : [...r.ocultos, k] }));
  const ocultosDe = (s) => s.grupos.flatMap((g) => g.items).filter(([k]) => ocultos.has(k)).length;

  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      if (rol.staff) {
        if (rol.esBase) { await RolesAPI.setStaffBase(rol.permisos); await cargar('staff'); onCambio?.(); return; }
        let id = rol.staffId;
        if (!id) { const res = await RolesAPI.createStaff(rol.nombre.trim()); id = res?.subrol?.id; }
        await RolesAPI.updateStaff(id, rol.nombre.trim(), rol.permisos);
        await cargar(`staff:${id}`); onCambio?.(); return;
      }
      const body = { nombre: rol.nombre.trim(), secciones: rol.secciones, ocultos: rol.ocultos };
      if (rolId === 'admin') {
        await RolesAPI.setAdministracion(body);
        await cargar('admin');
        onCambio?.();
        return;
      }
      const res = rolId === 'nuevo' ? await RolesAPI.create(body) : await RolesAPI.update(rolId, body);
      await cargar(res?.rol?.id ?? rolId);
      onCambio?.();
    } catch (e) { setError(mensajeDe(e)); } finally { setGuardando(false); }
  };
  const volverATodo = async () => {
    if (!(await showConfirm('¿Volver a que Administración vea y edite todo?', { confirmText: 'Volver a todo' }))) return;
    setGuardando(true); setError(null);
    try { await RolesAPI.resetAdministracion(); await cargar('admin'); onCambio?.(); }
    catch (e) { setError(mensajeDe(e)); } finally { setGuardando(false); }
  };
  const borrar = async () => {
    if (rolId === 'nuevo' || rolId === 'staff:nuevo') { elegirRol(roles[0]?.id ?? 'staff'); return; }
    if (!(await showConfirm(`¿Borrar el rol "${original?.nombre}"?`, { danger: true, confirmText: 'Borrar' }))) return;
    setGuardando(true); setError(null);
    try {
      await RolesAPI.remove(rol.staff ? rol.staffId : rolId); setRolId(null);
      await cargar(rol.staff ? 'staff' : (roles.find((r) => r.id !== rolId)?.id ?? 'staff')); onCambio?.();
    }
    catch (e) { setError(mensajeDe(e)); } finally { setGuardando(false); }
  };

  if (cargando && !rol) return <Stack alignItems="center" py={6}><CircularProgress size={24} /></Stack>;
  if (!rol) return <Alert severity="error">{error || 'No se pudieron cargar los roles'}</Alert>;
  const seccionActiva = !!rol.secciones[seccionId];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 2, alignItems: 'start' }}>
      {/* ── Lista de roles ── */}
      <Card>
        <CardHeader tc={tc} icon={<ShieldOutlinedIcon />} title="Roles" subtitle={`${todos.length} roles`}
          action={!soloLectura && <Button size="small" variant="contained" startIcon={<AddIcon />} disableElevation sx={{ bgcolor: tc }} onClick={() => elegirRol('nuevo')}>Nuevo</Button>} />
        {[...todos, ...(rolId === 'nuevo' ? [{ ...rol, id: 'nuevo', nombre: rol.nombre || 'Rol nuevo' }] : [])]
          .flatMap((r) => {
            // Subrol nuevo: debajo de los subroles de Staff. «+ Subrol de Staff» al final del grupo.
            const ultimoStaff = r.staff && staffRoles[staffRoles.length - 1]?.id === r.id;
            if (!ultimoStaff) return [r];
            return [r, ...(rolId === 'staff:nuevo' ? [{ ...rol, id: 'staff:nuevo', nombre: rol.nombre || 'Subrol nuevo' }] : []),
              ...(soloLectura ? [] : [{ id: 'accion:subrol', accion: true }])];
          })
          .map((r) => r.accion ? (
          <Box key={r.id} onClick={() => elegirRol('staff:nuevo')}
            sx={{ pl: 4.5, pr: 2.5, py: 1, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', bgcolor: 'action.hover',
              color: 'primary.main', fontSize: '0.78rem', fontWeight: 600, '&:hover': { bgcolor: 'action.selected' } }}>
            + Crear subrol de Staff
          </Box>
        ) : (
          <Box key={r.id} onClick={() => elegirRol(r.id)}
            sx={{
              px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
              bgcolor: r.id === rolId ? `${tc}14` : 'transparent', boxShadow: r.id === rolId ? `inset 3px 0 ${tc}` : 'none',
              '&:hover': { bgcolor: r.id === rolId ? `${tc}14` : '#fafafa' },
            }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Typography fontWeight={700} sx={{ fontSize: '0.82rem' }}>{r.staff && !r.esBase ? <span style={{ color: '#9ca3af', fontWeight: 400, marginRight: 4 }}>└</span> : null}{r.nombre}</Typography>
                {r.fijo && <LockOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.72rem' }}>{resumen(r)}</Typography>
            </Box>
            {!r.fijo && !r.esBase && <Chip size="small" label={`${r.personas ?? 0}`} variant="outlined" sx={{ height: 20, fontSize: '0.7rem', minWidth: 28 }} />}
          </Box>
        ))}
      </Card>

      {/* ── Editor del rol ── */}
      <Card>
        <CardHeader tc={tc} icon={<ShieldOutlinedIcon />}
          title={editable && !rol.base && !rol.esBase ? (
            <TextField size="small" variant="standard" placeholder={rol.staff ? 'Nombre del subrol (ej. Cocinero)' : 'Nombre del rol'} value={rol.nombre} autoFocus={rolId === 'nuevo' || rolId === 'staff:nuevo'}
              onChange={(e) => cambiar((r) => ({ ...r, nombre: e.target.value }))}
              InputProps={{ sx: { fontSize: '0.85rem', fontWeight: 700 } }} sx={{ width: 240 }} />
          ) : rol.nombre}
          subtitle={rol.fijo ? `Rol fijo · ${rol.nota}` : rol.staff ? (rol.esBase ? 'Lo que puede todo el Staff · los subroles suman lo suyo' : `Subrol de Staff · ${rol.personas ? `${rol.personas} persona${rol.personas !== 1 ? 's' : ''}` : 'todavía nadie lo tiene'}`)
            : rol.base ? `${original?.ajustada ? 'Ajustado' : 'Ve y edita todo'} · vale para quienes tienen Administración${rol.personas ? ` (${rol.personas})` : ''}`
            : `Basado en Administración · ${rol.personas ? `${rol.personas} persona${rol.personas !== 1 ? 's' : ''}` : 'todavía nadie lo tiene'}`}
          action={editable && (
            <Stack direction="row" gap={1} alignItems="center">
              {rol.esBase ? null : rol.base ? (
                original?.ajustada && <Button size="small" onClick={volverATodo} disabled={guardando} sx={{ color: 'text.secondary' }}>Volver a todo</Button>
              ) : (
              <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={borrar} disabled={guardando}>
                {rolId === 'nuevo' || rolId === 'staff:nuevo' ? 'Descartar' : 'Borrar'}
              </Button>
              )}
              <Button size="small" variant="contained" disableElevation sx={{ bgcolor: tc }} onClick={guardar}
                disabled={guardando || !cambiado || !String(rol.nombre || '').trim()}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          )} />
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError(null)}>{error}</Alert>}

        {rol.staff ? (
          <Box sx={{ py: 1.5, px: 2.5, minHeight: 480 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              QUÉ PUEDE HACER · TILDÁ PARA HABILITAR
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.78rem' }}>
              Ve las recetas de sus sectores (se eligen en Editar acceso) y propone cambios que aprobás vos. No entra a Resultados ni a Carga de gastos.
              {!rol.esBase && ' Además de esto, tiene todo lo que tenga habilitado el Staff.'}
            </Typography>
            {PERMISOS_STAFF.map((g, gi) => (
              <Box key={g.grupo} sx={{ mb: 1.5 }}>
                {gi > 0 && <Divider sx={{ mb: 1.5 }} />}
                <Typography fontWeight={700} sx={{ fontSize: '0.78rem', mb: 0.5 }}>{g.grupo}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: 2 }}>
                  {g.items.map(([k, label]) => {
                    const fijo = rol.esBase && k === 'aprobar_equipo';
                    const on = !!rol.permisos?.[k];
                    return (
                      <Stack key={k} direction="row" alignItems="center" sx={{ minHeight: 34 }}>
                        <Checkbox size="small" checked={on} disabled={!editable || fijo}
                          onChange={() => cambiar((r) => ({ ...r, permisos: { ...r.permisos, [k]: !r.permisos?.[k] } }))}
                          sx={{ p: 0.5, mr: 0.5, '&.Mui-checked': { color: tc } }} />
                        <Typography sx={{ fontSize: '0.78rem', minWidth: 0, color: on ? 'text.primary' : 'text.disabled' }}>{label}</Typography>
                        {fijo && <LockOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', ml: 0.75 }} titleAccess="Solo en un subrol" />}
                      </Stack>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 480 }}>
          {/* Paso 1 */}
          <Box sx={{ borderRight: '1px solid #f0f0f0', py: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2.5, display: 'block', mb: 1 }}>
              1 · QUÉ SECCIONES VE
            </Typography>
            {SECCIONES.map((s) => {
              const on = !!rol.secciones[s.id];
              const sel = s.id === seccionId;
              const n = ocultosDe(s);
              return (
                <Box key={s.id} onClick={() => setSeccionId(s.id)} sx={{
                  px: 2, py: 0.75, mx: 1, mb: 0.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', minHeight: 48,
                  bgcolor: sel ? `${tc}14` : 'transparent', '&:hover': { bgcolor: sel ? `${tc}14` : '#fafafa' },
                }}>
                  <Switch size="small" checked={on} disabled={!editable} onClick={(e) => e.stopPropagation()} onChange={() => toggleSeccion(s.id)}
                    sx={{ '& .Mui-checked': { color: `${tc} !important` }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${tc} !important` } }} />
                  <Box sx={{ flex: 1, minWidth: 0, opacity: on ? 1 : 0.45 }}>
                    <Typography fontWeight={600} sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>{s.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
                      {on && n ? `${n} oculto${n !== 1 ? 's' : ''}` : s.desc}
                    </Typography>
                  </Box>
                  {on && (
                    <ToggleButtonGroup size="small" exclusive value={rol.secciones[s.id]} disabled={!editable}
                      onClick={(e) => e.stopPropagation()} onChange={(_, v) => setModo(s.id, v)}
                      sx={{ '& .MuiToggleButton-root': { py: 0.15, px: 1, fontSize: '0.68rem', textTransform: 'none', height: 24 },
                        '& .Mui-selected': { bgcolor: `${tc}22 !important`, color: 'text.primary' } }}>
                      <ToggleButton value="ver">Ver</ToggleButton>
                      <ToggleButton value="editar">Editar</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                  <ChevronRightIcon sx={{ fontSize: 16, color: sel ? tc : 'text.disabled' }} />
                </Box>
              );
            })}
          </Box>

          {/* Paso 2 */}
          <Box sx={{ py: 1.5, px: 2.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              2 · DENTRO DE {seccion.nombre.toUpperCase()}, DESTILDÁ LO QUE NO VE
            </Typography>
            {!seccionActiva ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Este rol no ve {seccion.nombre}. Activala a la izquierda para elegir el detalle.
              </Typography>
            ) : !seccion.grupos.length ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {seccion.nombre} se ve completa: no tiene partes para ocultar.
              </Typography>
            ) : seccion.grupos.map((g, gi) => (
              <Box key={g.nombre} sx={{ mb: 1.5 }}>
                {gi > 0 && <Divider sx={{ mb: 1.5 }} />}
                <Typography fontWeight={700} sx={{ fontSize: '0.78rem', mb: 0.5 }}>{g.nombre}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', columnGap: 2 }}>
                  {g.items.map(([k, label]) => {
                    const visible = !ocultos.has(k);
                    return (
                      <Stack key={k} direction="row" alignItems="center" sx={{ minHeight: 34 }}>
                        <Checkbox size="small" checked={visible} disabled={!editable} onChange={() => toggleItem(k)}
                          sx={{ p: 0.5, mr: 0.5, '&.Mui-checked': { color: tc } }} />
                        <Typography sx={{ fontSize: '0.78rem', flex: 1, minWidth: 0, color: visible ? 'text.primary' : 'text.disabled',
                          textDecoration: visible ? 'none' : 'line-through' }}>{label}</Typography>
                        {!visible && <VisibilityOffOutlinedIcon sx={{ fontSize: 15, color: 'error.light', mr: 1 }} />}
                      </Stack>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        )}
      </Card>
    </Box>
  );
}
