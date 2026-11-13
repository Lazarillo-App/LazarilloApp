// ✦ Novedades de Lazarillo (Diego 13/11/2026): un lugar común para todos los módulos, al lado
// de la campanita. Separado de Notificaciones a propósito: la campana es «qué hizo el equipo»,
// esto es «qué hay de nuevo en Lazarillo». Las entradas viven en src/novedades.js.
// Lo visto se guarda por usuario en este navegador (no pide nada al servidor).
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Divider, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { useAccess } from '@/context/AccessContext';
import NOVEDADES from '@/novedades';

const MODULOS = [
  { id: 'recetas', nombre: 'Recetas', seccion: 'recetas' },
  { id: 'tableros', nombre: 'Tableros', seccion: 'recetas' },
  { id: 'resultados', nombre: 'Resultados', seccion: 'resultados' },
  { id: 'rrhh', nombre: 'RRHH', seccion: 'rrhh' },
  { id: 'configuracion', nombre: 'Configuración', seccion: 'configuracion' },
];
const NOMBRE = Object.fromEntries(MODULOS.map((m) => [m.id, m.nombre]));
const DIAS = 60;

const usuarioId = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null')?.id ?? 'anon'; } catch { return 'anon'; }
};
const leerVistas = (clave) => {
  try { const v = JSON.parse(localStorage.getItem(clave) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
};
const fechaCorta = (f) => { const [, m, d] = f.split('-'); return `${d}/${m}`; };

export default function NovedadesPanel() {
  const navigate = useNavigate();
  const { isStaff, puedeVer = () => true } = useAccess() || {};
  const botonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [solapa, setSolapa] = useState('todas');
  const clave = `lz-novedades-vistas-${usuarioId()}`;

  // Solo lo que este usuario puede ver, de los últimos 60 días, la más nueva primero.
  const lista = useMemo(() => {
    const desde = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
    const seccion = Object.fromEntries(MODULOS.map((m) => [m.id, m.seccion]));
    return NOVEDADES
      .filter((n) => n.fecha >= desde)
      .filter((n) => (isStaff ? n.para === 'todos' : puedeVer(seccion[n.modulo] || n.modulo)))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [isStaff, puedeVer]);

  // Primera vez en este navegador (usuario o negocio nuevo): todo lo anterior cuenta como visto,
  // para no recibirlo con una lista de cambios de algo que todavía no conocía.
  const [vistas, setVistas] = useState(() => {
    const v = leerVistas(clave);
    if (v) return v;
    const todas = NOVEDADES.map((n) => n.id);
    try { localStorage.setItem(clave, JSON.stringify(todas)); } catch { /* sin storage: no cuenta */ }
    return todas;
  });
  const visto = useMemo(() => new Set(vistas), [vistas]);
  const sinVer = lista.filter((n) => !visto.has(n.id)).length;

  const modulos = MODULOS.filter((m) => lista.some((n) => n.modulo === m.id));
  const mostradas = solapa === 'todas' ? lista : lista.filter((n) => n.modulo === solapa);
  const porFecha = mostradas.reduce((acc, n) => { (acc[n.fecha] ||= []).push(n); return acc; }, {});

  // Al cerrar, lo que había queda visto (lo resaltado se ve mientras el panel está abierto).
  const cerrar = () => {
    setOpen(false);
    const ids = Array.from(new Set([...vistas, ...lista.map((n) => n.id)])).slice(-300);
    setVistas(ids);
    try { localStorage.setItem(clave, JSON.stringify(ids)); } catch { /* nada */ }
  };
  const probar = (n) => { cerrar(); navigate(n.ruta); };

  if (!lista.length) return null;

  const chip = (id, nombre, n) => (
    <Box key={id} component="button" type="button" onClick={() => setSolapa(id)}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', font: 'inherit', fontSize: 12,
        px: 1.25, py: 0.5, borderRadius: 999, border: '1px solid', whiteSpace: 'nowrap',
        borderColor: solapa === id ? '#15213E' : '#e3e6eb',
        bgcolor: solapa === id ? '#15213E' : 'transparent', color: solapa === id ? '#fff' : '#5b6577',
      }}>
      {nombre}
      {n > 0 && <Box component="span" sx={{ bgcolor: '#5BC2EA', color: '#fff', borderRadius: 999, px: 0.75, fontSize: 10.5, fontWeight: 700, lineHeight: '16px' }}>{n}</Box>}
    </Box>
  );

  return (
    <>
      <Tooltip title="Novedades de Lazarillo">
        <IconButton ref={botonRef} onClick={() => { setSolapa('todas'); setOpen(true); }} color="inherit" aria-label="Novedades de Lazarillo">
          <Badge badgeContent={sinVer} sx={{ '& .MuiBadge-badge': { bgcolor: '#fff', color: '#0d6fa8', fontWeight: 700 } }}>
            <AutoAwesomeIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={botonRef.current}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 440, maxWidth: '94vw', borderRadius: '14px', mt: 1, boxShadow: '0 18px 50px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', maxHeight: 'min(640px, 78vh)' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.75, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Novedades</Typography>
          <IconButton onClick={cerrar} size="small" aria-label="Cerrar"><CloseIcon fontSize="small" /></IconButton>
        </Box>
        {modulos.length > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 2, pb: 1.25, flexWrap: 'nowrap', overflowX: 'auto' }}>
            {chip('todas', 'Todas', sinVer)}
            {modulos.map((m) => chip(m.id, m.nombre, 0))}
          </Box>
        )}
        <Divider />
        <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {Object.entries(porFecha).map(([fecha, items]) => (
            <Box key={fecha}>
              <Typography sx={{ px: 2, py: 0.75, fontSize: 11.5, color: 'text.secondary', bgcolor: '#fafbfc', borderBottom: '1px solid #eef1f5' }}>
                {fechaCorta(fecha)}
              </Typography>
              {items.map((n) => (
                <Box key={n.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: '1px solid #eef1f5',
                  bgcolor: visto.has(n.id) ? 'transparent' : 'rgba(91,194,234,.08)',
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#0d6fa8' }}>{NOMBRE[n.modulo] || n.modulo}</Typography>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: n.texto }} />
                  </Box>
                  {n.ruta && (
                    <Box component="button" type="button" onClick={() => probar(n)}
                      sx={{ flexShrink: 0, height: 30, px: 1.75, border: '1px solid #5BC2EA', bgcolor: '#fff', color: '#0d6fa8', borderRadius: '6px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      Probar
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
