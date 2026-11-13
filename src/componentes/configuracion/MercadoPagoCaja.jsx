// src/componentes/configuracion/MercadoPagoCaja.jsx
// Configuración › Conexiones: conectar Mercado Pago (14/11/2026), UNA CUENTA POR SUCURSAL (cada
// sucursal cobra en la suya). "Conectar" lleva a Mercado Pago para autorizar; vuelve a
// /mercadopago/vuelta, que termina la conexión (la sucursal viaja en el estado firmado).
// Con la cuenta conectada, la conciliación de esa sucursal trae los cobros sola.
import React, { useCallback, useEffect, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useBranch } from '@/hooks/useBranch';
import { MercadoPagoAPI, sucursalNum } from '@/servicios/apiConciliacion';
import { showConfirm } from '@/servicios/appConfirm';

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function MercadoPagoCaja({ businessId, themeColor = '#2492C8' }) {
  const { branches = [] } = useBranch() || {};
  const conSucursales = branches.filter((b) => b.id !== 'main').length > 0;
  const filas = branches.length ? branches : [{ id: 'main', name: '' }];
  const [configurado, setConfigurado] = useState(null);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Mercado Pago</Typography>
        {conSucursales && <Chip size="small" label="una cuenta por sucursal" sx={{ height: 22, fontSize: 11.5 }} />}
      </Stack>
      <Stack sx={{ px: 2, pt: 1.25 }} spacing={0.75}>
        {configurado === false && (
          <Typography variant="body2" color="text.secondary">
            La conexión con Mercado Pago todavía no está habilitada en Lazarillo. Mientras tanto, en Conciliación podés subir el extracto a mano.
          </Typography>
        )}
        {configurado && (
          <Typography variant="body2" color="text.secondary">
            Conectá la cuenta de Mercado Pago donde cobra {conSucursales ? 'cada sucursal' : 'el negocio'}: Lazarillo trae los cobros solo y la <b>Conciliación</b> ya no necesita el extracto.
            Hacelo desde la compu donde está abierto <b>ese</b> Mercado Pago (o en una ventana de incógnito), así no se conecta otra cuenta por error. Solo pedimos permiso de lectura.
          </Typography>
        )}
      </Stack>
      <Stack divider={<Divider flexItem />} sx={{ py: 0.5 }}>
        {filas.map((b) => (
          <FilaSucursal key={b.id} businessId={businessId} suc={sucursalNum(b.id)}
            nombre={conSucursales ? b.name : ''} themeColor={themeColor} onConfigurado={setConfigurado} />
        ))}
      </Stack>
    </Paper>
  );
}

function FilaSucursal({ businessId, suc, nombre, themeColor, onConfigurado }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [yendo, setYendo] = useState(false);

  const cargar = useCallback(() => {
    if (!businessId) return;
    MercadoPagoAPI.estado(businessId, suc)
      .then((e) => { setEst(e); onConfigurado(!!e?.configurado); })
      .catch(() => setError('No pude leer la conexión con Mercado Pago.'));
  }, [businessId, suc, onConfigurado]);
  useEffect(() => { cargar(); }, [cargar]);

  const conectar = async () => {
    setYendo(true); setError('');
    try {
      const r = await MercadoPagoAPI.autorizar(businessId, suc);
      if (!r?.url) throw new Error('sin url');
      window.location.href = r.url;
    } catch {
      setYendo(false);
      setError('No se pudo empezar la conexión. Probá de nuevo en un rato.');
    }
  };
  const desconectar = async () => {
    if (!(await showConfirm(`¿Desconectar Mercado Pago${nombre ? ` de ${nombre}` : ''}? Lazarillo deja de traer los cobros. Lo ya traído queda en la conciliación.`))) return;
    try { await MercadoPagoAPI.desconectar(businessId, suc); cargar(); } catch { setError('No se pudo desconectar.'); }
  };

  return (
    <Box sx={{ px: 2, py: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
        {nombre && <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{nombre}</Typography>}
        {est && (est.conectado
          ? <Chip size="small" label="Conectado" sx={{ height: 22, fontWeight: 700, bgcolor: '#1a9c6e1a', color: '#1a9c6e' }} />
          : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />)}
        {est?.conectado && (
          <Typography variant="body2">
            <b>{est.cuenta?.nickname || est.cuenta?.email || `#${est.cuenta?.user_id}`}</b>
            {est.conectado_at ? <span style={{ color: '#64748b' }}> · desde el {fecha(est.conectado_at)}</span> : null}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {est?.conectado ? (
          <Button size="small" onClick={desconectar} sx={{ textTransform: 'none', color: 'text.secondary' }}>Desconectar</Button>
        ) : (
          <Button variant="contained" size="small" onClick={conectar} disabled={!est?.configurado || yendo}
            startIcon={yendo ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
            {yendo ? 'Abriendo Mercado Pago…' : 'Conectar'}
          </Button>
        )}
      </Stack>
      {!est && !error && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Un segundo…</Typography>}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {est?.conectado && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {est.ultimo_sync_at
            ? `Últimos cobros traídos: del ${fecha(est.ultimo_sync_desde + 'T12:00')} al ${fecha(est.ultimo_sync_hasta + 'T12:00')}.`
            : 'Todavía no se trajeron cobros.'}
          {' '}<RouterLink to="/conciliacion">Ir a Conciliación</RouterLink>
        </Typography>
      )}
      {est?.ultimo_sync_error && <Alert severity="warning" sx={{ mt: 1 }}>La última vez Mercado Pago respondió con un error: {est.ultimo_sync_error}</Alert>}
    </Box>
  );
}
