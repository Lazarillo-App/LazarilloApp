// src/componentes/configuracion/MercadoLibreCaja.jsx
// Configuración › Conexiones: conectar Mercado Libre (14/11/2026), una cuenta por negocio. Con la
// cuenta conectada, las compras que el negocio hace en Mercado Libre aparecen en el Panel de
// Gestión (Sin carga › Mercado Libre) para cargarlas como factura.
import React, { useCallback, useEffect, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress } from '@mui/material';
import { MercadoLibreAPI } from '@/servicios/apiMercadoLibre';
import { showConfirm } from '@/servicios/appConfirm';

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function MercadoLibreCaja({ businessId, themeColor = '#2492C8' }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [yendo, setYendo] = useState(false);

  const cargar = useCallback(() => {
    if (!businessId) return;
    MercadoLibreAPI.estado(businessId).then(setEst).catch(() => setError('No pude leer la conexión con Mercado Libre.'));
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);

  const conectar = async () => {
    setYendo(true); setError('');
    try {
      const r = await MercadoLibreAPI.autorizar(businessId);
      if (!r?.url) throw new Error('sin url');
      window.location.href = r.url;
    } catch {
      setYendo(false);
      setError('No se pudo empezar la conexión. Probá de nuevo en un rato.');
    }
  };
  const desconectar = async () => {
    if (!(await showConfirm('¿Desconectar Mercado Libre? Lazarillo deja de traer las compras. Lo ya traído queda en el Panel.'))) return;
    try { await MercadoLibreAPI.desconectar(businessId); cargar(); } catch { setError('No se pudo desconectar.'); }
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Mercado Libre</Typography>
        {est && (est.conectado
          ? <Chip size="small" label="Conectado" sx={{ height: 22, fontWeight: 700, bgcolor: '#1a9c6e1a', color: '#1a9c6e' }} />
          : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />)}
        <Box sx={{ flex: 1 }} />
        {est?.conectado ? (
          <Button size="small" onClick={desconectar} sx={{ textTransform: 'none', color: 'text.secondary' }}>Desconectar</Button>
        ) : (
          <Button variant="contained" size="small" onClick={conectar} disabled={!est?.configurado || yendo}
            startIcon={yendo ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
            {yendo ? 'Abriendo Mercado Libre…' : 'Conectar'}
          </Button>
        )}
      </Stack>
      <Box sx={{ px: 2, py: 1.25 }}>
        {!est && !error && <Typography variant="body2" color="text.secondary">Un segundo…</Typography>}
        {est && !est.configurado && (
          <Typography variant="body2" color="text.secondary">La conexión con Mercado Libre todavía no está habilitada en Lazarillo.</Typography>
        )}
        {est?.configurado && !est.conectado && (
          <Typography variant="body2" color="text.secondary">
            Conectá la cuenta de Mercado Libre con la que el negocio compra: las compras aparecen en el <b>Panel de Gestión</b> (Sin carga › Mercado Libre) para cargarlas como factura.
            Hacelo desde la compu donde está abierto <b>ese</b> Mercado Libre (o en una ventana de incógnito). Solo pedimos permiso de lectura.
          </Typography>
        )}
        {est?.conectado && (
          <Typography variant="body2" color="text.secondary">
            <b style={{ color: '#15213E' }}>{est.cuenta?.nickname || est.cuenta?.email || `#${est.cuenta?.user_id}`}</b>
            {est.conectado_at ? ` · desde el ${fecha(est.conectado_at)}` : ''}
            {' · '}{est.ultimo_sync_at ? `compras traídas el ${fecha(est.ultimo_sync_at)}` : 'todavía no se trajeron compras'}
            {est.pendientes ? ` · ${est.pendientes} por cargar en el Panel` : ''}
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {est?.ultimo_sync_error && <Alert severity="warning" sx={{ mt: 1 }}>La última vez Mercado Libre respondió con un error: {est.ultimo_sync_error}</Alert>}
      </Box>
    </Paper>
  );
}
