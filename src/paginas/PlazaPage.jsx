// src/paginas/PlazaPage.jsx — /plaza/:id: la vista «diseño» de una plaza de despacho (Diego 11/11/2026).
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert, Stack } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import VistaPlaza from '@/componentes/plazas/VistaPlaza';
import { PlazasAPI } from '@/servicios/apiPlazas';
import { useBusiness } from '@/context/BusinessContext';
import RecetaModal from '@/componentes/RecetaModal';

// Lo que se guarda de cada tarjeta: orden de todos los renglones, ocultos y extras.
const fichaDe = (renglones) => ({
  orden: renglones.map((r) => r.key),
  ocultos: renglones.filter((r) => r.oculto && !r.extra).map((r) => r.key),
  extras: renglones.filter((r) => r.extra).map((r) => ({ id: r.key, texto: r.nombre, color: r.color })),
});

export default function PlazaPage() {
  const { id } = useParams();
  const { activeId } = useBusiness() || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [armando, setArmando] = useState(false);
  const [receta, setReceta] = useState(null); // { id, nombre } del producto abierto

  const cargar = useCallback(async () => {
    setError(null);
    try { setData(await PlazasAPI.vista(id)); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { setData(null); setArmando(false); cargar(); }, [cargar, activeId]);

  // Se actualiza al toque en pantalla y se guarda atrás (sin recargar la plaza).
  const cambiar = async (articleId, renglones) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => (p.articleId === articleId ? { ...p, renglones } : p)) }));
    try { await PlazasAPI.guardarFicha(id, articleId, fichaDe(renglones)); } catch (e) { setError(e.message); }
  };
  // Peso u observación: por ingrediente, en todas las tarjetas (como el color).
  const mostrarIngrediente = async (ref, mostrar) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, mostrar } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, undefined, mostrar); } catch (e) { setError(e.message); }
  };
  // Alias: solo cambia cómo se ve el ingrediente en las plazas (no la receta).
  const aliasIngrediente = async (ref, alias) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, alias } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, undefined, undefined, alias); } catch (e) { setError(e.message); }
  };
  const colorIngrediente = async (ref, color) => {
    setData((d) => ({ ...d, productos: d.productos.map((p) => ({ ...p, renglones: p.renglones.map((r) => (r.ref === ref ? { ...r, color } : r)) })) }));
    try { await PlazasAPI.guardarColor(ref, color); } catch (e) { setError(e.message); }
  };

  // Después de guardar la receta se refresca SOLO esa tarjeta (no la plaza entera).
  const refrescarProducto = async (articleId) => {
    try {
      const r = await PlazasAPI.vista(id, articleId);
      const nuevo = r?.productos?.[0];
      if (nuevo) setData((d) => ({ ...d, productos: d.productos.map((p) => (p.articleId === articleId ? nuevo : p)) }));
    } catch (e) { setError(e.message); }
  };

  if (error && !data) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={26} /></Stack>;

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100%', px: 3, py: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>{data.plaza.nombre}</Typography>
          <Typography variant="caption" color="text.secondary">
            {data.plaza.sectorNombre} · {data.productos.length} producto{data.productos.length !== 1 ? 's' : ''}
            {armando ? ' · arrastrá para ordenar, tocá un color para cambiarlo' : ''}
          </Typography>
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0 }}>{error}</Alert>}
        {data.puedeArmar && (
          <Button size="small" variant={armando ? 'contained' : 'outlined'} disableElevation
            startIcon={armando ? <CheckIcon /> : <EditOutlinedIcon />} onClick={() => setArmando((v) => !v)}
            sx={{ height: 34, whiteSpace: 'nowrap' }}>
            {armando ? 'Listo' : 'Armar'}
          </Button>
        )}
      </Stack>
      {!data.productos.length ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>Esta plaza todavía no tiene productos. Se asignan en ⚙ Configuración › Sectores.</Typography>
      ) : (
        <VistaPlaza productos={data.productos} armando={armando} onCambiar={cambiar} onColorIngrediente={colorIngrediente} onMostrarIngrediente={mostrarIngrediente} onAliasIngrediente={aliasIngrediente}
          onAbrir={(p) => setReceta({ id: p.articleId, nombre: p.nombre })} />
      )}
      {receta && (
        <RecetaModal open onClose={() => setReceta(null)} articulo={receta}
          businessId={activeId} activeBizId={activeId} recetasElaborados={{}}
          onSaved={() => refrescarProducto(receta.id)} />
      )}
    </Box>
  );
}
