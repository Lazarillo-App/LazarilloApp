// src/componentes/VerComo.jsx
// "Ver como" (solo el dueño): elegir un rol y ver la app como la ve ese rol, sin cerrar
// sesión. Mientras está activo no se guarda nada (servicios/vistaPrevia.js) y una franja
// arriba permite volver a la vista propia en cualquier momento.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useAccess } from '@/context/AccessContext';
import { RolesAPI } from '@/servicios/apiRoles';

// Opciones de "Ver como" dentro del desplegable del perfil (solo el dueño real).
// Hereda los colores del desplegable (fondo del negocio).
export function VerComoItems({ onElegido }) {
  const { rolReal, verComo, setVerComo } = useAccess() || {};
  const navigate = useNavigate();
  const [opciones, setOpciones] = useState(null);

  useEffect(() => {
    if (rolReal !== 'owner') return;
    RolesAPI.listCompleto()
      .then(({ roles, administracion }) => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin',
          permisos: administracion?.ajustada ? { secciones: administracion.secciones, ocultos: administracion.ocultos } : null },
        ...roles.map((r) => ({ id: `rol:${r.id}`, nombre: r.nombre, rol: 'admin', permisos: { secciones: r.secciones, ocultos: r.ocultos } })),
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null },
        { id: 'staff:jefe', nombre: '└ Jefe de cocina', rol: 'staff', subrol: 'jefe', permisos: null },
      ]))
      .catch(() => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin', permisos: null },
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null },
        { id: 'staff:jefe', nombre: '└ Jefe de cocina', rol: 'staff', subrol: 'jefe', permisos: null },
      ]));
  }, [rolReal]);

  if (rolReal !== 'owner') return null;

  const elegir = (o) => {
    onElegido?.();
    setVerComo(o ? { id: o.id, nombre: o.nombre.replace(/^└\s*/, ''), rol: o.rol, subrol: o.subrol || null, permisos: o.permisos } : null);
    navigate('/inicio');
  };

  return (
    <Box sx={{ py: 0.5 }}>
      <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.05em', opacity: 0.75 }}>
        <VisibilityOutlinedIcon sx={{ fontSize: 14 }} /> VER COMO
      </Box>
      {!opciones ? (
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
      })}
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
          : <>Estás viendo la app como <b>{verComo.nombre}</b> · no se guardan cambios</>}
      </span>
      <Button size="small" onClick={volver} variant="contained" disableElevation
        sx={{ bgcolor: '#fff', color: '#111827', textTransform: 'none', fontWeight: 700, height: 26, '&:hover': { bgcolor: '#e5e7eb' } }}>
        Volver a mi vista
      </Button>
    </Box>
  );
}
