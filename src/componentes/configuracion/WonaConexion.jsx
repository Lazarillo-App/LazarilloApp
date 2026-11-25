// src/componentes/configuracion/WonaConexion.jsx
// Wona Sports (usuaria 25/11/2026): conectar el negocio con una sede de Wona (canchas y buffet). La usa
// Configuración › Conexiones y el alta del negocio (paso POS, si elige Wona Sports).
//  - Sin conectar: usuario y clave de Wona → «Ver mis sedes» → elegir la sede de este negocio → Conectar.
//  - Conectada: sede, hasta qué día hay datos, lo que trajo la última lectura, «Traer ahora», Desconectar.
// Lazarillo solo LEE de Wona: no cambia nada allá. Usuario y clave se guardan cifrados y no se muestran.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress, TextField, MenuItem } from '@mui/material';
import { WonaAPI } from '@/servicios/apiWona';
import { showConfirm } from '@/servicios/appConfirm';
import { showAlert } from '@/servicios/appAlert';
import { downwardMenuProps } from '@/utils/menuProps';

const fecha = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
const pesos = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

function resumen(r) {
  if (!r) return '';
  const partes = [];
  if (r.panel?.total) partes.push(`${pesos(r.panel.total)} en ventas al Panel`);
  if (r.turnos?.turnos) partes.push(`${r.turnos.turnos.toLocaleString('es-AR')} turnos`);
  if (r.buffet?.unidades) partes.push(`${Math.round(r.buffet.unidades).toLocaleString('es-AR')} unidades del buffet`);
  if (r.articulos?.nuevos) partes.push(`${r.articulos.nuevos} artículos nuevos`);
  if (r.compras?.nuevas) partes.push(`${r.compras.nuevas} compras`);
  return partes.join(', ');
}

export default function WonaConexion({ businessId, themeColor = '#2492C8', enAlta = false, onConectado, onEstado }) {
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [sedes, setSedes] = useState(null);
  const [sede, setSede] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const espera = useRef(null);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    try {
      const r = await WonaAPI.estado(businessId);
      setEst(r);
      onEstado?.(r);
      setError('');
      clearTimeout(espera.current);
      if (r?.sincronizando) espera.current = setTimeout(cargar, 10000);
    } catch {
      setError('No pude leer la conexión con Wona.');
    }
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps -- onEstado es un aviso al padre
  useEffect(() => { cargar(); return () => clearTimeout(espera.current); }, [cargar]);

  const textoError = (e, porDefecto) => {
    const d = e?.data || e?.response?.data || {};
    return d.message || (d.error === 'wona_claves_invalidas' ? 'Wona no aceptó ese usuario o clave.' : porDefecto);
  };

  const verSedes = async () => {
    setOcupado(true); setError('');
    try {
      const r = await WonaAPI.sedes(businessId, usuario.trim(), clave);
      setSedes(r.sedes || []);
      setSede(r.sedes?.length === 1 ? r.sedes[0].uuid : '');
    } catch (e) {
      setError(textoError(e, 'No pude hablar con Wona. Probá de nuevo en unos minutos.'));
    } finally {
      setOcupado(false);
    }
  };

  const conectar = async () => {
    setOcupado(true); setError('');
    try {
      const r = await WonaAPI.conectar(businessId, usuario.trim(), clave, sede);
      setUsuario(''); setClave(''); setSedes(null); setSede('');
      showAlert(`Wona conectado (${r.sede}). Estamos trayendo el último año: puede tardar unos minutos.`, 'success');
      onConectado?.();
      setTimeout(cargar, 1500);
    } catch (e) {
      setError(textoError(e, 'No se pudo conectar con Wona. Probá de nuevo en unos minutos.'));
    } finally {
      setOcupado(false);
    }
  };

  const traerAhora = async () => {
    try {
      await WonaAPI.sincronizar(businessId);
      setEst((s) => ({ ...s, sincronizando: true }));
      setTimeout(cargar, 3000);
    } catch (e) {
      const d = e?.data || {};
      showAlert(d.error === 'wona_en_curso' ? 'Ya se están trayendo los datos.' : 'No se pudo empezar a traer los datos.', 'warning');
    }
  };

  const desconectar = async () => {
    const ok = await showConfirm('¿Desconectar Wona? Lazarillo deja de traer los datos de esta sede. Lo que ya está cargado queda.', { danger: true, confirmText: 'Desconectar' });
    if (!ok) return;
    try { await WonaAPI.desconectar(businessId); cargar(); } catch { setError('No se pudo desconectar.'); }
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', rowGap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Wona Sports{est?.sede ? ` · ${est.sede}` : ''}</Typography>
        {est && (est.conectado
          ? <Chip size="small" label={est.ultimo_sync_error ? 'Con error' : 'Conectado'} sx={{ height: 22, fontWeight: 700, bgcolor: est.ultimo_sync_error ? '#f59e0b22' : '#1a9c6e1a', color: est.ultimo_sync_error ? '#b45309' : '#1a9c6e' }} />
          : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />)}
        <Box sx={{ flex: 1 }} />
        {est?.conectado && (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={traerAhora} disabled={est.sincronizando}
              startIcon={est.sincronizando ? <CircularProgress size={14} /> : null}
              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 36, borderColor: themeColor, color: themeColor }}>
              {est.sincronizando ? 'Trayendo datos…' : 'Traer ahora'}
            </Button>
            {!enAlta && <Button size="small" onClick={desconectar} sx={{ textTransform: 'none', color: 'text.secondary', minHeight: 36 }}>Desconectar</Button>}
          </Stack>
        )}
      </Stack>

      <Box sx={{ px: 2, py: 1.5 }}>
        {!est && !error && <Typography variant="body2" color="text.secondary">Un segundo…</Typography>}

        {est && !est.conectado && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Con Wona nos conectamos solos: Lazarillo trae todas las noches tus <b>ventas</b> (turnos, señas y buffet), los <b>turnos por cancha</b>,
              los <b>productos del buffet</b> con su costo y precio, y las <b>cargas de stock</b> como compras. Solo <b>leemos</b>: no cambiamos nada en tu Wona.
              Usá el mismo usuario y clave con que entrás a Wona.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <TextField size="small" label="Usuario de Wona" value={usuario} onChange={(e) => { setUsuario(e.target.value); setSedes(null); }} fullWidth
                autoComplete="off" inputProps={{ spellCheck: false }} />
              <TextField size="small" label="Clave" type="password" value={clave} onChange={(e) => { setClave(e.target.value); setSedes(null); }} fullWidth
                autoComplete="new-password" />
            </Stack>
            {!sedes && (
              <Box>
                <Button variant="contained" onClick={verSedes} disabled={!usuario.trim() || !clave || ocupado}
                  startIcon={ocupado ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
                  {ocupado ? 'Entrando a Wona…' : 'Ver mis sedes'}
                </Button>
              </Box>
            )}
            {sedes && (
              <Stack spacing={1.25}>
                {sedes.length > 1 && (
                  <Typography variant="body2" color="text.secondary">
                    Tu cuenta tiene <b>{sedes.length} sedes</b>. Elegí la de <b>este negocio</b>; las otras se conectan desde su propio negocio en Lazarillo.
                  </Typography>
                )}
                <TextField select size="small" label="Sede de este negocio" value={sede} onChange={(e) => setSede(e.target.value)}
                  SelectProps={{ MenuProps: downwardMenuProps() }} sx={{ maxWidth: 420 }}>
                  {sedes.map((s) => <MenuItem key={s.uuid} value={s.uuid}>{s.nombre}{s.razon ? ` · ${s.razon}` : ''}</MenuItem>)}
                </TextField>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                  <Button variant="contained" onClick={conectar} disabled={!sede || ocupado}
                    startIcon={ocupado ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
                    {ocupado ? 'Conectando…' : 'Conectar esta sede'}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Usuario y clave se guardan cifrados y no se vuelven a mostrar. Solo dueño o administrador.
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Stack>
        )}

        {est?.conectado && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {est.sincronizando
                ? 'Trayendo datos de Wona… la primera vez es un año de ventas y turnos, puede tardar unos minutos.'
                : est.ventas_hasta ? <>Datos al día hasta el <b style={{ color: '#15213E' }}>{fecha(est.ventas_hasta)}</b></> : 'Todavía no se trajeron datos.'}
              {est.ultimo_sync_at && !est.sincronizando ? ` · última lectura ${fechaHora(est.ultimo_sync_at)}` : ''}
              {' · '}se actualiza sola todas las noches.
            </Typography>
            {resumen(est.ultimo_resumen) && !est.sincronizando && (
              <Typography variant="body2" color="text.secondary">Última lectura: {resumen(est.ultimo_resumen)}.</Typography>
            )}
            {est.ultimo_sync_error && (
              /usuario o la clave/i.test(est.ultimo_sync_error)
                ? <Alert severity="warning">Wona no acepta el usuario o la clave guardados. Si cambiaste la clave en Wona, desconectá y volvé a conectar.</Alert>
                : <Alert severity="warning">La última lectura no terminó bien ({est.ultimo_sync_error}). Se reintenta sola esta noche, o tocá «Traer ahora».</Alert>
            )}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>
    </Paper>
  );
}
