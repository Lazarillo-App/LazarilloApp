// src/componentes/MenuPerfil.jsx
// Desplegable del perfil (usuaria 13/11/2026: "el desplegable no me gusta"), con el tema de Diego:
// tarjeta blanca con quién sos arriba, opciones con ícono y secciones separadas. Antes era un
// MenuList del color del negocio dentro del Navbar.
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Avatar, Box } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { VerComoItems } from '@/componentes/VerComo';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const Seccion = ({ children }) => (
  <Box sx={{ px: 2, pt: 1.25, pb: 0.5, fontFamily: FB, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.text3 }}>
    {children}
  </Box>
);
const Linea = () => <Box sx={{ height: '1px', bgcolor: T.border, my: 0.5 }} />;

function Opcion({ icono, children, to, onClick, peligro, extra }) {
  const props = to ? { component: NavLink, to } : { component: 'button', type: 'button' };
  return (
    <Box {...props} role="menuitem" onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', boxSizing: 'border-box', px: 2, py: 1,
        border: 0, bgcolor: 'transparent', cursor: 'pointer', textDecoration: 'none', textAlign: 'left',
        fontFamily: FB, fontSize: 13.5, fontWeight: 600, color: peligro ? T.bad : T.text,
        '& svg': { fontSize: 19, color: peligro ? T.bad : T.text2 },
        '&:hover': { bgcolor: peligro ? `${T.bad}0F` : T.card },
      }}>
      {icono}
      <Box component="span" sx={{ flex: 1 }}>{children}</Box>
      {extra}
    </Box>
  );
}

export default function MenuPerfil({
  nombre, email, avatar, iniciales, esSuper, pendientes = 0, conPendientes, verComo, onPendientes, onCerrar, onSalir,
}) {
  React.useEffect(() => { cargarFuentes(); }, []);
  return (
    <Box role="menu" aria-label="Opciones de perfil" sx={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 268, maxWidth: 'calc(100vw - 24px)', zIndex: 1300,
      bgcolor: T.band, color: T.text, borderRadius: '14px', border: `1px solid ${T.border}`,
      boxShadow: '0 18px 50px #15213E2E', overflow: 'hidden', py: 0.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25 }}>
        <Avatar src={avatar || undefined} sx={{ width: 40, height: 40, bgcolor: T.accent, color: T.ink, fontFamily: FT, fontWeight: 700, fontSize: 15 }}>
          {!avatar && iniciales}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontFamily: FT, fontWeight: 700, fontSize: 14, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre || 'Usuario'}
          </Box>
          {email && <Box sx={{ fontFamily: FB, fontSize: 12, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</Box>}
        </Box>
      </Box>
      <Linea />
      <Opcion icono={<PersonOutlineIcon />} to="/perfil" onClick={onCerrar}>Mi perfil</Opcion>
      {conPendientes && (
        <Opcion icono={<TaskAltIcon />} onClick={() => { onCerrar(); onPendientes(); }}
          extra={pendientes > 0 && (
            <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, bgcolor: T.bad, color: '#fff', fontFamily: FB,
              fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {pendientes > 99 ? '99+' : pendientes}
            </Box>
          )}>
          Mis pendientes
        </Opcion>
      )}
      {esSuper && (
        <>
          <Linea />
          <Seccion>Equipo Lazarillo</Seccion>
          <Opcion icono={<AdminPanelSettingsOutlinedIcon />} to="/super" onClick={onCerrar}>Panel de super usuarios</Opcion>
        </>
      )}
      {verComo && (
        <>
          <Linea />
          {/* VerComo pinta con --on-primary (pensado para el menú de color): acá va sobre blanco. */}
          <Box sx={{ '--on-primary': T.ink, color: T.text, fontFamily: FB, '& [role=menuitem]:hover': { bgcolor: T.card } }}>
            <VerComoItems onElegido={onCerrar} />
          </Box>
        </>
      )}
      <Linea />
      <Opcion icono={<LogoutIcon />} onClick={onSalir} peligro>Salir</Opcion>
    </Box>
  );
}
