// src/componentes/plazas/PlazasBoton.jsx — botón «Plaza ▾» del header (Diego 11/11/2026): lista las
// plazas que ve la persona (dueño/admin todas; Staff las de sus sectores). Sin plazas no se muestra.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Menu, MenuItem, ListSubheader } from '@mui/material';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';

export default function PlazasBoton({ activeSx = () => ({}) }) {
  const { activeId } = useBusiness() || {};
  const location = useLocation();
  const navigate = useNavigate();
  const [plazas, setPlazas] = useState([]);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    let vivo = true;
    PlazasAPI.listar().then((l) => { if (vivo) setPlazas(l); }).catch(() => { if (vivo) setPlazas([]); });
    const recargar = () => PlazasAPI.listar().then(setPlazas).catch(() => {});
    window.addEventListener('plazas:changed', recargar);
    return () => { vivo = false; window.removeEventListener('plazas:changed', recargar); };
  }, [activeId]);

  if (!plazas.length) return null;
  const m = location.pathname.match(/^\/plaza\/(\d+)/);
  const actual = m ? plazas.find((p) => String(p.id) === m[1]) : null;
  const sectores = [...new Set(plazas.map((p) => p.sectorNombre || ''))];

  return (
    <>
      <Button color="inherit" sx={{ color: 'inherit', position: 'relative', ...activeSx(!!actual) }} onClick={(e) => setAnchor(e.currentTarget)}>
        {actual ? `Plaza: ${actual.nombre}` : 'Plaza'} ▾
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {sectores.flatMap((s) => [
          sectores.length > 1 ? <ListSubheader key={`h-${s}`} sx={{ lineHeight: '28px', fontSize: '0.7rem', fontWeight: 700 }}>{s.toUpperCase()}</ListSubheader> : null,
          ...plazas.filter((p) => (p.sectorNombre || '') === s).map((p) => (
            <MenuItem key={p.id} selected={actual?.id === p.id} onClick={() => { setAnchor(null); navigate(`/plaza/${p.id}`); }} sx={{ fontSize: '0.9rem' }}>
              {p.nombre}
            </MenuItem>
          )),
        ].filter(Boolean))}
      </Menu>
    </>
  );
}
