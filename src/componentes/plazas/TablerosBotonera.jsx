// src/componentes/plazas/TablerosBotonera.jsx — botonera del header en Operación › Tableros
// (Diego 12/11/2026): una pestaña por plaza de despacho y, al lado, «+» para crear otra.
// El «+» lo ven del jefe de cocina para arriba (dueño/admin en todos los sectores; el jefe en los que
// conduce); el back decide y lo informa en GET /plazas (puedeCrear + sectores).
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button, IconButton, Tooltip, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';
import EditorPlaza from './EditorPlaza';

export default function TablerosBotonera({ activeSx = () => ({}) }) {
  const { activeId } = useBusiness() || {};
  const location = useLocation();
  const navigate = useNavigate();
  const [t, setT] = useState({ plazas: [], puedeCrear: false, sectores: [] });
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = () => PlazasAPI.tablero().then((r) => { if (vivo) setT(r); }).catch(() => {});
    cargar();
    window.addEventListener('plazas:changed', cargar);
    return () => { vivo = false; window.removeEventListener('plazas:changed', cargar); };
  }, [activeId]);

  const m = location.pathname.match(/^\/tableros\/(\d+)/);
  return (
    <>
      {t.plazas.map((p) => (
        <Button key={p.id} color="inherit" component={NavLink} to={`/tableros/${p.id}`}
          sx={{ color: 'inherit', position: 'relative', whiteSpace: 'nowrap', ...activeSx(m?.[1] === String(p.id)) }}>
          {p.nombre}
        </Button>
      ))}
      {t.puedeCrear && (
        <Tooltip title="Agregar plaza">
          <IconButton color="inherit" size="small" onClick={() => setCreando(true)}
            sx={{ color: 'inherit', width: 30, height: 30, border: '1px solid', borderColor: 'currentColor', opacity: 0.85, ml: 0.5, alignSelf: 'center' }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
      {!t.plazas.length && !t.puedeCrear && <Box component="span" sx={{ opacity: 0.6, fontSize: '0.85rem', alignSelf: 'center' }}>Sin plazas</Box>}
      <EditorPlaza abierto={creando} sectores={t.sectores} onCerrar={() => setCreando(false)}
        onGuardado={(id) => { setCreando(false); if (id) navigate(`/tableros/${id}`); }} />
    </>
  );
}
