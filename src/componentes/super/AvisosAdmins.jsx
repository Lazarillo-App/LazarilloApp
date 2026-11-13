/* eslint-disable react-refresh/only-export-components */
// src/componentes/super/AvisosAdmins.jsx
// Solapa "Admins" de la campana (usuaria 13/11/2026), solo para super usuarios: todo lo que pasa en
// el panel de super usuarios ("Mairene agregó una tarea", "Diego agregó una nota", "Ana mandó un
// pedido"). Lo visto se guarda en la base, así vale igual en el celu y en la compu.
import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';
import { agruparPorDia, horaDe } from '@/gestion/actividadFormato';

const ICONO = { tarea: '📋', nota: '💬', pedido: '📨', ajuste: '⚙️' };
const primerNombre = (s) => String(s || '').split(/[\s@]/)[0] || 'Alguien';

/** Cuántos avisos nuevos hay (de otros). Se refresca cada minuto mientras está habilitado. */
export function useAvisosAdmins(habilitado) {
  const [datos, setDatos] = useState({ actividad: [], nuevos: 0, visto_hasta: null, cargado: false });
  const cargar = useCallback(() => {
    if (!habilitado) return Promise.resolve();
    return SuperAPI.actividad()
      .then((r) => setDatos({ actividad: r.actividad || [], nuevos: r.nuevos || 0, visto_hasta: r.visto_hasta || null, cargado: true }))
      .catch(() => setDatos((d) => ({ ...d, cargado: true })));
  }, [habilitado]);
  useEffect(() => {
    if (!habilitado) return undefined;
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [habilitado, cargar]);
  const marcarVisto = useCallback(() => {
    if (!habilitado) return;
    setDatos((d) => ({ ...d, nuevos: 0, visto_hasta: new Date().toISOString() }));
    SuperAPI.actividadVista().catch(() => {});
  }, [habilitado]);
  return { ...datos, nuevos: habilitado ? datos.nuevos : 0, cargar, marcarVisto };
}

/** La lista, agrupada por día. vistoAlAbrir marca con punto lo nuevo de otros. */
export function AvisosAdminsContenido({ avisos, miId, vistoAlAbrir, onIr }) {
  if (!avisos.cargado) return <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={20} /></Box>;
  if (!avisos.actividad.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center', fontSize: 12.5 }}>Todavía no hay movimientos del equipo</Typography>;
  }
  const lista = avisos.actividad.map((a) => ({ ...a, creadoEn: a.created_at }));
  return agruparPorDia(lista).map((g) => (
    <Box key={g.dia}>
      <Box sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{g.dia}</Box>
      {g.items.map((a) => {
        const mio = String(a.actor_id) === String(miId);
        const nuevo = !mio && (!vistoAlAbrir || new Date(a.created_at) > new Date(vistoAlAbrir));
        const fecha = new Date(a.created_at);
        return (
          <Box key={a.id} component="button" type="button" onClick={() => onIr(a)}
            sx={{ display: 'flex', gap: 1.25, width: '100%', textAlign: 'left', border: 0, bgcolor: 'transparent', cursor: 'pointer',
              font: 'inherit', px: 2, py: 1, alignItems: 'flex-start', position: 'relative', '&:hover': { bgcolor: 'rgba(91,194,234,.08)' } }}>
            {nuevo && <Box sx={{ position: 'absolute', left: 6, top: 18, width: 6, height: 6, borderRadius: '50%', bgcolor: '#5BC2EA' }} />}
            <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: '#EAF1F8', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
              {ICONO[a.tipo] || '•'}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, lineHeight: 1.35, color: '#15213E', fontWeight: nuevo ? 700 : 400 }}>
                <b>{mio ? 'Vos' : primerNombre(a.actor)}</b> {a.accion}
              </Typography>
              {a.titulo && <Typography sx={{ fontSize: 12, color: '#46587A', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</Typography>}
              {a.detalle && <Typography sx={{ fontSize: 12, color: '#8696B2', mt: 0.25, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>«{a.detalle}»</Typography>}
            </Box>
            <Typography sx={{ mt: 0.25, fontSize: 11, color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {Number.isFinite(fecha.getTime()) ? horaDe(fecha) : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  ));
}

/** A dónde lleva cada aviso dentro del panel. */
export function rutaDeAviso(a) {
  if (a.tarea_id) return `/super?tab=tareas&tarea=${a.tarea_id}`;
  if (a.tipo === 'tarea' || a.tipo === 'nota') return '/super?tab=tareas';
  if (a.tipo === 'ajuste') return '/super?tab=ajustes';
  if (a.pedido_id) return `/super?pedido=${a.pedido_id}`;
  return '/super';
}
