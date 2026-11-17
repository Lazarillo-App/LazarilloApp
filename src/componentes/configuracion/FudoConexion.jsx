// src/componentes/configuracion/FudoConexion.jsx
// Fudo (usuaria 17/11/2026): conectar el negocio con la API oficial de Fudo. La usan Configuración ›
// Conexiones y el alta del negocio (paso POS, si elige Fudo): mismo componente, mismo texto.
//  - Sin conectar: los pasos para sacar la API Key y el API Secret en Fudo (verificados contra la
//    pantalla real de Fudo) y los dos campos.
//  - Conectada: hasta qué día hay ventas, la última lectura, «Traer ahora», los productos sin vincular
//    (FudoProductos) y Desconectar.
// Lazarillo solo LEE ventas de Fudo: no escribe nada allá (la API de Fudo es de solo lectura). Las
// claves se guardan cifradas y no se vuelven a mostrar.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress, TextField, Collapse } from '@mui/material';
import { FudoAPI } from '@/servicios/apiFudo';
import { showConfirm } from '@/servicios/appConfirm';
import { showAlert } from '@/servicios/appAlert';
import FudoProductos from './FudoProductos';

const fecha = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

const PASOS = [
  <>En Fudo entrá a <b>Configuración › Integraciones › API Pública General</b> y tocá <b>Habilitar API Pública General</b>. Si te pregunta para qué la vas a usar, marcá <i>gestión de stock, inventario y compras</i> y <i>tablero con métricas</i>.</>,
  <>Andá a <b>Configuración › Equipo › Usuarios</b> y tocá <b>+ Nuevo</b>. Usuario: <b>lazarillo</b> · Nombre: <b>Lazarillo API</b> · Rol: <b>admin</b> · <b>sin</b> marcar Superusuario. Poné una contraseña cualquiera y un mail tuyo.</>,
  <>Abrí ese usuario nuevo desde la lista. Abajo, en <b>API</b>, vas a ver la <b>API Key</b> y el <b>API Secret</b> «Sin asignar»: generá el secret.</>,
  <>Copiá las dos claves acá abajo. <b>Ojo:</b> Fudo muestra el secret una sola vez, pegalo antes de cerrar esa ventana.</>,
];

export default function FudoConexion({ businessId, themeColor = '#2492C8', enAlta = false, onConectado }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [conectando, setConectando] = useState(false);
  const [verProductos, setVerProductos] = useState(false);
  const espera = useRef(null);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    try {
      const r = await FudoAPI.estado(businessId);
      setEst(r);
      setError('');
      // Mientras trae ventas (la primera vez son 3 meses), se vuelve a mirar cada 10 s.
      clearTimeout(espera.current);
      if (r?.sincronizando) espera.current = setTimeout(cargar, 10000);
    } catch {
      setError('No pude leer la conexión con Fudo.');
    }
  }, [businessId]);
  useEffect(() => { cargar(); return () => clearTimeout(espera.current); }, [cargar]);

  const conectar = async () => {
    setConectando(true); setError('');
    try {
      await FudoAPI.conectar(businessId, key.trim(), secret.trim());
      setKey(''); setSecret('');
      showAlert('Fudo conectado. Ya estamos trayendo los últimos 3 meses de ventas.', 'success');
      onConectado?.();
      setTimeout(cargar, 1500);
    } catch (e) {
      const d = e?.data || e?.response?.data || {};
      setError(d.message || (d.error === 'fudo_claves_invalidas'
        ? 'Fudo no aceptó esas claves. Revisá la API Key y el API Secret del usuario lazarillo en Fudo.'
        : 'No se pudo conectar con Fudo. Probá de nuevo en unos minutos.'));
    } finally {
      setConectando(false);
    }
  };

  const traerAhora = async () => {
    try {
      await FudoAPI.sincronizar(businessId);
      setEst((s) => ({ ...s, sincronizando: true }));
      setTimeout(cargar, 3000);
    } catch (e) {
      const d = e?.data || {};
      showAlert(d.error === 'fudo_en_curso' ? 'Ya se están trayendo las ventas.' : 'No se pudo empezar a traer las ventas.', 'warning');
    }
  };

  const desconectar = async () => {
    const ok = await showConfirm('¿Desconectar Fudo? Lazarillo deja de traer las ventas de Fudo. Las que ya están cargadas quedan.', { danger: true, confirmText: 'Desconectar' });
    if (!ok) return;
    try { await FudoAPI.desconectar(businessId); setVerProductos(false); cargar(); } catch { setError('No se pudo desconectar.'); }
  };

  const listo = key.trim().length > 3 && secret.trim().length > 3;
  const sinVincular = est?.sin_vincular_con_ventas || 0;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', rowGap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Fudo</Typography>
        {est && (est.conectado
          ? <Chip size="small" label={est.ultimo_sync_error ? 'Con error' : 'Conectado'} sx={{ height: 22, fontWeight: 700, bgcolor: est.ultimo_sync_error ? '#f59e0b22' : '#1a9c6e1a', color: est.ultimo_sync_error ? '#b45309' : '#1a9c6e' }} />
          : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />)}
        <Box sx={{ flex: 1 }} />
        {est?.conectado && (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={traerAhora} disabled={est.sincronizando}
              startIcon={est.sincronizando ? <CircularProgress size={14} /> : null}
              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 36, borderColor: themeColor, color: themeColor }}>
              {est.sincronizando ? 'Trayendo ventas…' : 'Traer ahora'}
            </Button>
            <Button size="small" onClick={desconectar} sx={{ textTransform: 'none', color: 'text.secondary', minHeight: 36 }}>Desconectar</Button>
          </Stack>
        )}
      </Stack>

      <Box sx={{ px: 2, py: 1.5 }}>
        {!est && !error && <Typography variant="body2" color="text.secondary">Un segundo…</Typography>}

        {est && !est.conectado && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Con Fudo nos conectamos solos: Lazarillo trae tus <b>ventas</b> todas las noches, sin instalar nada ni dejar ninguna compu prendida.
              Solo <b>leemos</b>: Lazarillo no cambia nada en tu Fudo. Necesitamos dos claves que se sacan en Fudo en 5 minutos:
            </Typography>
            <Stack component="ol" spacing={1} sx={{ m: 0, pl: 0, listStyle: 'none' }}>
              {PASOS.map((t, i) => (
                <Stack key={i} component="li" direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', bgcolor: `${themeColor}1a`, color: themeColor, fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center' }}>{i + 1}</Box>
                  <Typography variant="body2" sx={{ lineHeight: 1.5, pt: 0.2 }}>{t}</Typography>
                </Stack>
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField size="small" label="API Key" value={key} onChange={(e) => setKey(e.target.value)} fullWidth
                autoComplete="off" inputProps={{ spellCheck: false }} />
              <TextField size="small" label="API Secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} fullWidth
                autoComplete="new-password" inputProps={{ spellCheck: false }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
              <Button variant="contained" onClick={conectar} disabled={!listo || conectando}
                startIcon={conectando ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
                {conectando ? 'Probando las claves con Fudo…' : 'Conectar Fudo'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Las claves se guardan cifradas y no se vuelven a mostrar. Solo dueño o administrador.
              </Typography>
            </Stack>
          </Stack>
        )}

        {est?.conectado && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {est.sincronizando
                ? 'Trayendo ventas de Fudo… la primera vez son 3 meses y puede tardar unos minutos.'
                : est.ventas_hasta ? <>Ventas al día hasta el <b style={{ color: '#15213E' }}>{fecha(est.ventas_hasta)}</b></> : 'Todavía no se trajeron ventas.'}
              {est.ultimo_sync_at && !est.sincronizando ? ` · última lectura ${fechaHora(est.ultimo_sync_at)}` : ''}
              {' · '}se actualiza sola todas las noches.
            </Typography>
            {est.ultimo_sync_error && (
              <Alert severity="warning">La última vez Fudo respondió con un error: {est.ultimo_sync_error}. Si cambiaste el usuario o el API Secret en Fudo, desconectá y volvé a conectar.</Alert>
            )}
            {est.productos > 0 && (
              <Alert severity={sinVincular ? 'warning' : 'success'} sx={{ alignItems: 'center' }}
                action={
                  <Button size="small" onClick={() => setVerProductos((v) => !v)} sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {verProductos ? 'Ocultar' : sinVincular ? 'Vincular' : 'Ver productos'}
                  </Button>
                }>
                {sinVincular
                  ? <><b>{sinVincular} producto{sinVincular === 1 ? '' : 's'} de Fudo</b> vendieron y no están vinculados a un artículo: sus ventas todavía no cuentan.</>
                  : <>Los {est.vinculados} productos de Fudo que vendieron están vinculados a tus artículos.</>}
              </Alert>
            )}
          </Stack>
        )}

        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>

      {est?.conectado && !enAlta && (
        <Collapse in={verProductos} unmountOnExit>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <FudoProductos businessId={businessId} themeColor={themeColor} onCambio={cargar} />
          </Box>
        </Collapse>
      )}
    </Paper>
  );
}
