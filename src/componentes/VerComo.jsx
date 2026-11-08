// src/componentes/VerComo.jsx
// "Ver como" (solo el dueño): elegir un rol y ver la app como la ve ese rol, sin cerrar
// sesión. Mientras está activo no se guarda nada (servicios/vistaPrevia.js) y una franja
// arriba permite volver a la vista propia en cualquier momento.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import { useAccess } from '@/context/AccessContext';
import { RolesAPI } from '@/servicios/apiRoles';

export function VerComoMenu() {
  const { rolReal, verComo, setVerComo } = useAccess() || {};
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState(null);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto || opciones) return;
    RolesAPI.listCompleto()
      .then(({ roles, administracion }) => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin',
          permisos: administracion?.ajustada ? { secciones: administracion.secciones, ocultos: administracion.ocultos } : null },
        ...roles.map((r) => ({ id: `rol:${r.id}`, nombre: r.nombre, rol: 'admin', permisos: { secciones: r.secciones, ocultos: r.ocultos } })),
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null },
      ]))
      .catch(() => setOpciones([
        { id: 'admin', nombre: 'Administración', rol: 'admin', permisos: null },
        { id: 'staff', nombre: 'Staff', rol: 'staff', permisos: null },
      ]));
  }, [abierto, opciones]);

  if (rolReal !== 'owner') return null;

  const elegir = (o) => {
    setAbierto(false);
    setVerComo(o ? { id: o.id, nombre: o.nombre, rol: o.rol, permisos: o.permisos } : null);
    navigate('/inicio');
  };

  return (
    <Box ref={caja} sx={{ position: 'relative', ml: 1, flexShrink: 0 }}>
      <Button color="inherit" size="small" onClick={() => setAbierto((v) => !v)}
        startIcon={<VisibilityOutlinedIcon sx={{ fontSize: '18px !important' }} />} endIcon={<ExpandMoreIcon />}
        sx={{ textTransform: 'none', fontWeight: 600, height: 34, px: 1.25, borderRadius: 2,
          ...(verComo ? { bgcolor: 'color-mix(in srgb, var(--on-primary, #fff) 18%, transparent)' } : {}) }}>
        {verComo ? verComo.nombre : 'Ver como'}
      </Button>
      {abierto && (
        <Box sx={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 1500, minWidth: 220,
          bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, boxShadow: 6, border: '1px solid #e8eaf0', py: 0.75 }}>
          <Box sx={{ px: 2, py: 0.75, fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '.04em' }}>VER LA APP COMO</Box>
          {!opciones ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={18} /></Box>
          ) : (
            <>
              {[{ id: null, nombre: 'Yo (Dueño)' }, ...opciones].map((o) => {
                const activo = (verComo?.id ?? null) === o.id;
                return (
                  <Box key={o.id ?? 'yo'} onClick={() => elegir(o.id ? o : null)}
                    sx={{ px: 2, height: 36, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', fontSize: '0.85rem',
                      fontWeight: activo ? 700 : 400, '&:hover': { bgcolor: '#f5f7fa' } }}>
                    <Box sx={{ width: 18, display: 'flex' }}>{activo && <CheckIcon sx={{ fontSize: 16 }} />}</Box>
                    {o.nombre}
                  </Box>
                );
              })}
            </>
          )}
        </Box>
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
          : <>Estás viendo la app como <b>{verComo.nombre}</b> · no se guardan cambios</>}
      </span>
      <Button size="small" onClick={volver} variant="contained" disableElevation
        sx={{ bgcolor: '#fff', color: '#111827', textTransform: 'none', fontWeight: 700, height: 26, '&:hover': { bgcolor: '#e5e7eb' } }}>
        Volver a mi vista
      </Button>
    </Box>
  );
}
