// src/componentes/ListaPosSucursales.jsx
// Lista del POS por sucursal (Diego 23/11/2026: «uso de MaxiRest la lista 1 para San Justo y la 2
// para Ramos»). Vive en el modal «Configurar listas de precios», junto a las listas de Lazarillo.
// Se guarda al elegir (sin botón Guardar). Solo aparece si el POS trae listas y hay sucursales.
import React from 'react';
import { Box, Typography, Select, MenuItem } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { getListasSucursales, setListaSucursal } from '@/servicios/apiMaxiPriceLists';

export default function ListaPosSucursales({ businessId }) {
  const qc = useQueryClient();
  const [cfg, setCfg] = React.useState(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!businessId) return undefined;
    let cancel = false;
    // Reintenta si el servidor no respondió (reinicio o arranque en frío): getListasSucursales
    // devuelve disponible:false cuando el pedido falla.
    (async () => {
      for (let i = 0; i < 3 && !cancel; i++) {
        const r = await getListasSucursales(businessId).catch(() => null);
        if (r?.ok) { if (!cancel) setCfg(r); return; }
        await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
      }
    })();
    return () => { cancel = true; };
  }, [businessId]);
  if (!cfg?.disponible || !cfg.sucursales?.length) return null;
  const elegir = async (branchId, listNumber) => {
    const antes = cfg;
    setError('');
    setCfg({ ...cfg, sucursales: cfg.sucursales.map((s) => (s.branchId === branchId ? { ...s, listNumber } : s)) });
    try {
      const r = await setListaSucursal(businessId, branchId, listNumber);
      if (r?.ok) setCfg(r); else throw new Error(r?.error || 'No se pudo guardar');
      qc.invalidateQueries({ queryKey: ['preciosSucursal', Number(businessId)] });
    } catch (e) { setCfg(antes); setError(e.message || 'No se pudo guardar'); }
  };
  return (
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>Qué lista de tu POS cobra cada sucursal</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, mb: 1.25 }}>
        El <b>Precio</b> de Artículos y el costo % salen de esa lista según la sucursal que mirás; con «Todas», ponderado por lo que vendió cada una.
      </Typography>
      {error && <Typography sx={{ color: '#C0392B', fontSize: 12, mb: 1 }}>{error}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr) 190px', sm: 'repeat(auto-fill, minmax(320px, 1fr))' }, gap: 1 }}>
        {cfg.sucursales.map((s) => (
          <Box key={s.branchId} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) 190px' }, alignItems: 'center', gap: { xs: 0.5, sm: 1 }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</Typography>
            <Select size="small" value={s.listNumber ?? ''} displayEmpty
              onChange={(e) => elegir(s.branchId, Number(e.target.value))}
              sx={{ height: 44, width: { xs: '100%', sm: 190 }, fontSize: '0.82rem' }}>
              <MenuItem value="" disabled>Elegí una lista</MenuItem>
              {cfg.listas.map((l) => (
                <MenuItem key={l.listNumber} value={l.listNumber}>
                  Lista {l.listNumber}{l.alias && l.alias !== `Lista ${l.listNumber}` ? ` · ${l.alias}` : ''}
                </MenuItem>
              ))}
            </Select>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
