// src/componentes/configuracion/MercadoPagoCaja.jsx
// Configuración › Conexiones: conectar la cuenta de Mercado Pago del negocio (14/11/2026).
// "Conectar" lleva a Mercado Pago para autorizar; vuelve a /mercadopago/vuelta, que termina la
// conexión. Con la cuenta conectada, la conciliación trae los cobros sola (sin subir el extracto).
import React, { useCallback, useEffect, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { MercadoPagoAPI } from '@/servicios/apiConciliacion';
import { showConfirm } from '@/servicios/appConfirm';

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function MercadoPagoCaja({ businessId, themeColor = '#2492C8' }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [yendo, setYendo] = useState(false);

  const cargar = useCallback(() => {
    if (!businessId) return;
    MercadoPagoAPI.estado(businessId).then(setEst).catch(() => setError('No pude leer la conexión con Mercado Pago.'));
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);

  const conectar = async () => {
    setYendo(true); setError('');
    try {
      const r = await MercadoPagoAPI.autorizar(businessId);
      if (!r?.url) throw new Error('sin url');
      window.location.href = r.url;
    } catch {
      setYendo(false);
      setError('No se pudo empezar la conexión. Probá de nuevo en un rato.');
    }
  };
  const desconectar = async () => {
    if (!(await showConfirm('¿Desconectar Mercado Pago? Lazarillo deja de traer los cobros. Lo ya traído queda en la conciliación.'))) return;
    try { await MercadoPagoAPI.desconectar(businessId); cargar(); } catch { setError('No se pudo desconectar.'); }
  };

  const chip = est?.conectado
    ? <Chip size="small" label="Conectado" sx={{ height: 24, fontWeight: 700, bgcolor: '#1a9c6e1a', color: '#1a9c6e' }} />
    : <Chip size="small" label="Sin conectar" sx={{ height: 24, fontWeight: 600 }} />;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Mercado Pago</Typography>
        {est && chip}
        <Box sx={{ flex: 1 }} />
        {est?.conectado ? (
          <Button size="small" onClick={desconectar} sx={{ textTransform: 'none', color: 'text.secondary' }}>Desconectar</Button>
        ) : (
          <Button variant="contained" onClick={conectar} disabled={!est?.configurado || yendo}
            startIcon={yendo ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
            {yendo ? 'Abriendo Mercado Pago…' : 'Conectar'}
          </Button>
        )}
      </Stack>
      <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
        {!est && !error && <Typography variant="body2" color="text.secondary">Un segundo…</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {est && !est.configurado && !est.conectado && (
          <Typography variant="body2" color="text.secondary">
            La conexión con Mercado Pago todavía no está habilitada en Lazarillo. Mientras tanto, en Conciliación podés subir el extracto a mano.
          </Typography>
        )}
        {est && est.configurado && !est.conectado && (
          <Typography variant="body2" color="text.secondary">
            Conectá la cuenta de Mercado Pago donde cobra el negocio: Lazarillo trae los cobros solo y la <b>Conciliación</b> ya no necesita que subas el extracto.
            Te vamos a llevar a Mercado Pago para que lo autorices; solo damos permiso de lectura de los movimientos.
          </Typography>
        )}
        {est?.conectado && (
          <>
            <Typography variant="body2">
              Cuenta: <b>{est.cuenta?.nickname || est.cuenta?.email || `#${est.cuenta?.user_id}`}</b>
              {est.conectado_at ? <span style={{ color: '#64748b' }}> · conectada el {fecha(est.conectado_at)}</span> : null}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {est.ultimo_sync_at
                ? `Últimos cobros traídos: del ${fecha(est.ultimo_sync_desde + 'T12:00')} al ${fecha(est.ultimo_sync_hasta + 'T12:00')} (el ${fecha(est.ultimo_sync_at)}).`
                : 'Todavía no se trajeron cobros.'}
              {' '}<RouterLink to="/conciliacion">Ir a Conciliación</RouterLink>
            </Typography>
            {est.ultimo_sync_error && <Alert severity="warning">La última vez Mercado Pago respondió con un error: {est.ultimo_sync_error}</Alert>}
          </>
        )}
      </Stack>
    </Paper>
  );
}
