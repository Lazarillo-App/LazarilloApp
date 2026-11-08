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
const FIJOS = [
  { id: 'duenio', nombre: 'Dueño', fijo: true, nota: 'Ve y edita todo', secciones: TODAS, ocultos: [] },
  { id: 'admin', nombre: 'Administración', fijo: true, nota: 'Ve y edita todo', secciones: TODAS, ocultos: [] },
  { id: 'staff', nombre: 'Staff', fijo: true, nota: 'Vista operativa · por sectores', secciones: {}, ocultos: [] },
];
const NUEVO = { id: 'nuevo', nombre: '', secciones: { resultados: 'ver' }, ocultos: [], personas: 0 };

function resumen(rol) {
  if (rol.fijo) return rol.nota;
  const vis = SECCIONES.filter((s) => rol.secciones[s.id]).map((s) => s.nombre);
  const parcial = rol.ocultos.length ? ` · ${rol.ocultos.length} oculto${rol.ocultos.length !== 1 ? 's' : ''}` : '';
  return (vis.join(', ') || 'Sin secciones') + parcial;
}

const MENSAJES = {
  nombre_repetido: 'Ya hay un rol con ese nombre.',
  nombre_requerido: 'Ponele un nombre al rol.',
  rol_en_uso: 'Hay personas con este rol: cambiales el rol en Editar acceso antes de borrarlo.',
  only_owner: 'Solo el dueño puede cambiar los roles.',
};
const mensajeDe = (e) => MENSAJES[e?.response?.data?.error || e?.data?.error || e?.message] || e?.response?.data?.error || e?.message || 'No se pudo guardar';

export default function RolesTab({ themeColor = '#0ea5e9', soloLectura = false, onCambio }) {
  const tc = themeColor;
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [rolId, setRolId] = useState(null);
  const [borrador, setBorrador] = useState(null);   // copia editable del rol elegido
  const [seccionId, setSeccionId] = useState('resultados');
  const [guardando, setGuardando] = useState(false);

  const cargar = async (elegir) => {
    setCargando(true); setError(null);
    try {
      const lista = await RolesAPI.list();
      setRoles(lista);
      const id = elegir ?? rolId ?? lista[0]?.id ?? 'staff';
      elegirRol(id, lista);
    } catch (e) { setError(mensajeDe(e)); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todos = useMemo(() => [...FIJOS, ...roles], [roles]);
  function elegirRol(id, lista = roles) {
    const r = id === 'nuevo' ? NUEVO : [...FIJOS, ...lista].find((x) => x.id === id);
    if (!r) return;
    setRolId(id);
    setBorrador({ ...r, secciones: { ...r.secciones }, ocultos: [...r.ocultos] });
    setError(null);
  }

  const rol = borrador;
  const seccion = SECCIONES.find((s) => s.id === seccionId);
  const ocultos = useMemo(() => new Set(rol?.ocultos || []), [rol]);
  const editable = !!rol && !rol.fijo && !soloLectura;
  const original = rolId === 'nuevo' ? NUEVO : todos.find((x) => x.id === rolId);
  const cambiado = !!rol && JSON.stringify([rol.nombre, rol.secciones, [...rol.ocultos].sort()]) !== JSON.stringify([original?.nombre, original?.secciones, [...(original?.ocultos || [])].sort()]);

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
      const body = { nombre: rol.nombre.trim(), secciones: rol.secciones, ocultos: rol.ocultos };
      const res = rolId === 'nuevo' ? await RolesAPI.create(body) : await RolesAPI.update(rolId, body);
      await cargar(res?.rol?.id ?? rolId);
      onCambio?.();
    } catch (e) { setError(mensajeDe(e)); } finally { setGuardando(false); }
  };
  const borrar = async () => {
    if (rolId === 'nuevo') { elegirRol(roles[0]?.id ?? 'staff'); return; }
    if (!(await showConfirm(`¿Borrar el rol "${original?.nombre}"?`, { danger: true, confirmText: 'Borrar' }))) return;
    setGuardando(true); setError(null);
    try { await RolesAPI.remove(rolId); setRolId(null); await cargar(roles.find((r) => r.id !== rolId)?.id ?? 'staff'); onCambio?.(); }
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
        {[...todos, ...(rolId === 'nuevo' ? [{ ...rol, id: 'nuevo', nombre: rol.nombre || 'Rol nuevo' }] : [])].map((r) => (
          <Box key={r.id} onClick={() => elegirRol(r.id)}
            sx={{
              px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
              bgcolor: r.id === rolId ? `${tc}14` : 'transparent', boxShadow: r.id === rolId ? `inset 3px 0 ${tc}` : 'none',
              '&:hover': { bgcolor: r.id === rolId ? `${tc}14` : '#fafafa' },
            }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Typography fontWeight={700} sx={{ fontSize: '0.82rem' }}>{r.nombre}</Typography>
                {r.fijo && <LockOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.72rem' }}>{resumen(r)}</Typography>
            </Box>
            {!r.fijo && <Chip size="small" label={`${r.personas ?? 0}`} variant="outlined" sx={{ height: 20, fontSize: '0.7rem', minWidth: 28 }} />}
          </Box>
        ))}
      </Card>

      {/* ── Editor del rol ── */}
      <Card>
        <CardHeader tc={tc} icon={<ShieldOutlinedIcon />}
          title={editable ? (
            <TextField size="small" variant="standard" placeholder="Nombre del rol" value={rol.nombre} autoFocus={rolId === 'nuevo'}
              onChange={(e) => cambiar((r) => ({ ...r, nombre: e.target.value }))}
              InputProps={{ sx: { fontSize: '0.85rem', fontWeight: 700 } }} sx={{ width: 240 }} />
          ) : rol.nombre}
          subtitle={rol.fijo ? `Rol fijo · ${rol.nota}` : `Basado en Administración · ${rol.personas ? `${rol.personas} persona${rol.personas !== 1 ? 's' : ''}` : 'todavía nadie lo tiene'}`}
          action={editable && (
            <Stack direction="row" gap={1} alignItems="center">
              <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={borrar} disabled={guardando}>
                {rolId === 'nuevo' ? 'Descartar' : 'Borrar'}
              </Button>
              <Button size="small" variant="contained" disableElevation sx={{ bgcolor: tc }} onClick={guardar}
                disabled={guardando || !cambiado || !rol.nombre.trim()}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          )} />
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError(null)}>{error}</Alert>}

        {rol.id === 'staff' ? (
          <Box sx={{ p: 4, minHeight: 480 }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.9rem', mb: 1 }}>La vista Staff queda como está</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, lineHeight: 1.6 }}>
              Es la vista operativa para cocina y barra: ve las recetas de su sector sin costos, propone cambios que
              aprobás vos y no entra a Resultados ni a Carga de gastos. Qué recetas ve cada persona se elige con
              los <b>sectores</b>, en Editar acceso.
            </Typography>
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
