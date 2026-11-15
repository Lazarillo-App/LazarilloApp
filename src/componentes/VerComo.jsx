// src/componentes/VerComo.jsx
// "Ver como" (solo el dueño): elegir un rol y ver la app como la ve ese rol, sin cerrar
// sesión. Mientras está activo no se guarda nada (servicios/vistaPrevia.js) y una franja
// arriba permite volver a la vista propia en cualquier momento.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import { useAccess } from '@/context/AccessContext';
import { RolesAPI } from '@/servicios/apiRoles';
import { listMembers, efectivosAcceso } from '@/servicios/apiTeam';
import { useBusiness } from '@/context/BusinessContext';

// Opciones de "Ver como" dentro del desplegable del perfil (solo el dueño real).
// Hereda los colores del desplegable (fondo del negocio).
export function VerComoItems({ onElegido }) {
  const { rolReal, verComo, setVerComo } = useAccess() || {};
  const navigate = useNavigate();
  const [opciones, setOpciones] = useState(null);
  // Personas (Diego 15/11/2026): ver como una persona puntual = su rol + sus ajustes propios.
  const { activeId } = useBusiness() || {};
  const [personas, setPersonas] = useState([]);
  const [cargandoId, setCargandoId] = useState(null);
  const [abierto, setAbierto] = useState(null); // 'roles' | 'personas' | null
  const [filtro, setFiltro] = useState('');
  const yoId = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null')?.id ?? null; } catch { return null; } })();

  useEffect(() => {
    if (rolReal !== 'owner') return;
    let vivo = true;
    listMembers().then((rows) => {
      if (!vivo) return;
      const porPersona = new Map();
      for (const r of rows || []) {
        if (!r.id || !['admin', 'staff'].includes(r.role) || Number(r.user_id) === Number(yoId) || r.account_status === 'invited') continue;
        // Se prefiere el acceso del negocio activo.
        const esDeAca = r.scope_type === 'business' && Number(r.scope_id) === Number(activeId);
        const previo = porPersona.get(r.user_id);
        if (!previo || (esDeAca && !previo.esDeAca)) porPersona.set(r.user_id, { ...r, esDeAca });
      }
      setPersonas([...porPersona.values()]
        .map((r) => ({ id: `persona:${r.id}`, assignmentId: r.id, nombre: r.alias || r.name || r.email, rol: r.role,
          rolNombre: r.custom_role_nombre || (r.role === 'staff' ? 'Staff' : 'Administración') }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }).catch(() => { if (vivo) setPersonas([]); });
    return () => { vivo = false; };
  }, [rolReal, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegirPersona = async (pers) => {
    setCargandoId(pers.id);
    try {
      const e = await efectivosAcceso(pers.assignmentId);
      onElegido?.();
      setVerComo(e.tipo === 'staff'
        ? { id: pers.id, assignmentId: pers.assignmentId, nombre: pers.nombre, rol: 'staff', subrol: pers.rolNombre !== 'Staff' ? pers.rolNombre : null, permisos: null, permisosStaff: e.permisos || {} }
        : { id: pers.id, assignmentId: pers.assignmentId, nombre: pers.nombre, rol: 'admin', subrol: null, permisos: { secciones: e.secciones || {}, ocultos: e.ocultos || [] }, permisosStaff: null });
      navigate('/inicio');
    } catch { /* si falla, se queda el menú abierto */ }
    finally { setCargandoId(null); }
  };

  useEffect(() => {
    if (rolReal !== 'owner') return;
    RolesAPI.listCompleto()
      .then(({ roles, administracion, staff }) => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin',
          permisos: administracion?.ajustada || administracion?.porDefecto ? { secciones: administracion.secciones, ocultos: administracion.ocultos } : null },
        ...roles.map((r) => ({ id: `rol:${r.id}`, nombre: r.nombre, rol: 'admin', permisos: { secciones: r.secciones, ocultos: r.ocultos } })),
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null, permisosStaff: { ...(staff?.base || {}) } },
        // Subroles de Staff (Diego 11/11/2026): lo del Staff base + lo del subrol.
        ...(staff?.subroles || []).map((sr) => ({ id: `staff:${sr.id}`, nombre: `└ ${sr.nombre}`, rol: 'staff', subrol: sr.nombre,
          permisos: null, permisosStaff: { ...(staff?.base || {}), ...(sr.permisos || {}) } })),
      ]))
      .catch(() => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin', permisos: null },
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null, permisosStaff: {} },
      ]));
  }, [rolReal]);

  if (rolReal !== 'owner') return null;

  const elegir = (o) => {
    onElegido?.();
    setVerComo(o ? { id: o.id, nombre: o.nombre.replace(/^└\s*/, ''), rol: o.rol, subrol: o.subrol || null, permisos: o.permisos, permisosStaff: o.permisosStaff || null } : null);
    navigate('/inicio');
  };

  // Acordeón (usuaria 15/11/2026): con un equipo largo la lista no tiene fin. "Ver como" (roles) y
  // "Personas" se despliegan de a uno; al abrir uno se cierra el otro, así siempre se ve todo.
  const viendoPersona = String(verComo?.id || '').startsWith('persona:');
  const nombreRol = (opciones || []).find((o) => o.id === verComo?.id)?.nombre?.replace(/^└\s*/, '');
  const filtradas = filtro.trim()
    ? personas.filter((p) => `${p.nombre} ${p.rolNombre}`.toLowerCase().includes(filtro.trim().toLowerCase()))
    : personas;
  const fila = { px: 2, minHeight: 32, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', fontSize: '0.875rem',
    '&:hover': { bgcolor: 'color-mix(in srgb, var(--on-primary, #000) 10%, transparent)' } };
  const Cabecera = ({ id, icono, titulo, resumen }) => (
    <Box role="button" aria-expanded={abierto === id} onClick={() => setAbierto((a) => (a === id ? null : id))}
      sx={{ ...fila, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.05em' }}>
      <Box sx={{ display: 'flex', opacity: 0.75 }}>{icono}</Box>
      <Box component="span" sx={{ opacity: 0.75 }}>{titulo}</Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0, textAlign: 'right', fontWeight: 600, letterSpacing: 0, fontSize: '0.75rem', opacity: 0.7,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</Box>
      <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.7, transition: 'transform .15s', transform: abierto === id ? 'rotate(180deg)' : 'none' }} />
    </Box>
  );

  return (
    <Box sx={{ py: 0.5 }}>
      <Cabecera id="roles" icono={<VisibilityOutlinedIcon sx={{ fontSize: 14 }} />} titulo="VER COMO"
        resumen={!verComo ? 'Yo (Dueño)' : viendoPersona ? '' : (nombreRol || verComo.nombre)} />
      {abierto === 'roles' && (!opciones ? (
        <Box sx={{ py: 1, display: 'flex', justifyContent: 'center' }}><CircularProgress size={16} sx={{ color: 'inherit' }} /></Box>
      ) : [{ id: null, nombre: 'Yo (Dueño)' }, ...opciones].map((o) => {
        const activo = (verComo?.id ?? null) === o.id;
        return (
          <Box key={o.id ?? 'yo'} role="menuitem" onClick={() => elegir(o.id ? o : null)}
            sx={{ px: 2, minHeight: 32, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', fontSize: '0.875rem',
              fontWeight: activo ? 700 : 400, '&:hover': { bgcolor: 'color-mix(in srgb, var(--on-primary, #000) 10%, transparent)' } }}>
            <Box sx={{ width: 16, display: 'flex' }}>{activo && <CheckIcon sx={{ fontSize: 16 }} />}</Box>
            {o.nombre}
          </Box>
        );
      }))}
      {opciones && personas.length > 0 && (
        <>
          <Cabecera id="personas" icono={<PeopleOutlineIcon sx={{ fontSize: 14 }} />} titulo="PERSONAS"
            resumen={viendoPersona ? verComo.nombre : `${personas.length}`} />
          {abierto === 'personas' && personas.length > 8 && (
            <Box sx={{ px: 2, pb: 0.5 }} onClick={(e) => e.stopPropagation()}>
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar persona…" autoFocus
                style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 13, padding: '5px 8px', borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--on-primary, #000) 25%, transparent)', background: 'transparent', color: 'inherit', outline: 'none' }} />
            </Box>
          )}
          {abierto === 'personas' && (
          <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {!filtradas.length && <Box sx={{ px: 2, py: 0.75, fontSize: '0.8rem', opacity: 0.6 }}>Nadie con ese nombre</Box>}
            {filtradas.map((pe) => {
              const activo = verComo?.id === pe.id;
              return (
                <Box key={pe.id} role="menuitem" onClick={() => elegirPersona(pe)}
                  sx={{ px: 2, minHeight: 32, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', fontSize: '0.875rem',
                    fontWeight: activo ? 700 : 400, '&:hover': { bgcolor: 'color-mix(in srgb, var(--on-primary, #000) 10%, transparent)' } }}>
                  <Box sx={{ width: 16, display: 'flex' }}>
                    {cargandoId === pe.id ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : activo && <CheckIcon sx={{ fontSize: 16 }} />}
                  </Box>
                  <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pe.nombre}</Box>
                  <Box component="span" sx={{ fontSize: '0.7rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{pe.rolNombre}</Box>
                </Box>
              );
            })}
          </Box>
          )}
        </>
      )}
    </Box>
  );
}

// Franja fija mientras se ve como otro rol: siempre a mano "Volver a mi vista".
export function VerComoBanner() {
  const { verComo, setVerComo } = useAccess() || {};
  const navigate = useNavigate();
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    let t;
    const onBloqueo = () => { setAviso(true); clearTimeout(t); t = setTimeout(() => setAviso(false), 3500); };
    window.addEventListener('vista-previa:bloqueado', onBloqueo);
    return () => { window.removeEventListener('vista-previa:bloqueado', onBloqueo); clearTimeout(t); };
  }, []);

  if (!verComo) return null;
  const volver = () => { setVerComo(null); navigate('/inicio'); };

  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 1.5, flexWrap: 'wrap', bgcolor: aviso ? '#b45309' : '#1f2937', color: '#fff', px: 2, py: 0.75, fontSize: 13, fontWeight: 600 }}>
      <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
      <span>
        {aviso
          ? 'No se guardó: en "Ver como" la app es solo para mirar.'
          : <>Estás viendo la app como <b>{verComo.nombre}</b> · los cambios se guardan con tu usuario</>}
      </span>
      <Button size="small" onClick={volver} variant="contained" disableElevation
        sx={{ bgcolor: '#fff', color: '#111827', textTransform: 'none', fontWeight: 700, height: 26, '&:hover': { bgcolor: '#e5e7eb' } }}>
        Volver a mi vista
      </Button>
    </Box>
  );
}
