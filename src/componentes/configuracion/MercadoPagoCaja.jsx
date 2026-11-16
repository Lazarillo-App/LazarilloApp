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
import { GestionAPI } from '@/servicios/apiGestion';
import SelectorBuscable from '@/componentes/SelectorBuscable';

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
        {conSucursales && <Chip size="small" label="una o más cuentas por sucursal" sx={{ height: 22, fontSize: 11.5 }} />}
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
  // Varias cuentas por sucursal (Diego 15/11/2026): cada una se desconecta sola; las demás siguen.
  const desconectar = async (c) => {
    const quien = c?.nickname || c?.email || 'esta cuenta';
    if (!(await showConfirm(`¿Desconectar ${quien}${nombre ? ` de ${nombre}` : ''}? Lazarillo deja de traer sus cobros. Lo ya traído queda.`))) return;
    try { await MercadoPagoAPI.desconectar(businessId, suc, c?.user_id); cargar(); } catch { setError('No se pudo desconectar.'); }
  };
  const cuentas = est?.cuentas?.length ? est.cuentas : (est?.conectado ? [{ ...est.cuenta, conectado_at: est.conectado_at }] : []);
  const fmtCuit = (d) => { const x = String(d || '').replace(/\D/g, ''); return x.length === 11 ? `${x.slice(0, 2)}-${x.slice(2, 10)}-${x.slice(10)}` : (x || ''); };
  const cs = est?.cuit_sucursal;
  // Proveedor de cada cuenta (Diego 15/11/2026: «al asociar un banco lo tenemos que vincular con un proveedor»):
  // a él van las comisiones (pagos de su cuenta corriente) y los impuestos que descuenta.
  const [provs, setProvs] = useState(null);
  const [eligiendo, setEligiendo] = useState(null); // user_id de la cuenta que está eligiendo proveedor
  useEffect(() => {
    if (!cuentas.length || provs) return;
    GestionAPI.maestrosFactura().then((m) => setProvs(m?.proveedores || [])).catch(() => setProvs([]));
  }, [cuentas.length, provs]);
  const vincular = async (c, codPro) => {
    try { await MercadoPagoAPI.proveedor(businessId, suc, c.user_id, codPro); setEligiendo(null); cargar(); }
    catch { setError('No se pudo vincular el proveedor.'); }
  };
  const manda = (c) => cs?.cuenta != null && String(cs.cuenta) === String(c.user_id);
  const usarCuit = async (c) => {
    if (!(await showConfirm(`¿Usar el CUIT ${fmtCuit(c.doc)} (${c.titular || c.nickname}) como CUIT de ${cs?.sucursal || 'la sucursal'}?`))) return;
    try { await MercadoPagoAPI.cuitSucursal(businessId, suc, c.user_id); cargar(); } catch { setError('No se pudo cambiar el CUIT de la sucursal.'); }
  };

  return (
    <Box sx={{ px: 2, py: 1.25 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap>
        {nombre && <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{nombre}</Typography>}
        {est && (est.conectado
          ? <Chip size="small" label="Conectado" sx={{ height: 22, fontWeight: 700, bgcolor: '#1a9c6e1a', color: '#1a9c6e' }} />
          : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />)}
        <Box sx={{ flex: 1 }} />
        {est?.conectado ? (
          <Button size="small" onClick={conectar} disabled={!est?.configurado || yendo}
            startIcon={yendo ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, color: themeColor }}>
            {yendo ? 'Abriendo Mercado Pago…' : '+ Conectar otra cuenta'}
          </Button>
        ) : (
          <Button variant="contained" size="small" onClick={conectar} disabled={!est?.configurado || yendo}
            startIcon={yendo ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
            {yendo ? 'Abriendo Mercado Pago…' : 'Conectar'}
          </Button>
        )}
      </Stack>
      {/* Cada cuenta con su titular y su CUIT (Diego 15/11/2026: «que esté claro el CUIT y el titular de cada
          cuenta»), y cuál define el CUIT de la sucursal («se elige qué cuenta manda, bien clarito»). */}
      {cuentas.map((c) => (
        <Stack key={c.user_id || 'c'} direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap"
          sx={{ mt: 0.75, ml: nombre ? 1 : 0, px: 1.25, py: 0.75, borderRadius: 1.5, border: '1px solid', borderColor: manda(c) ? themeColor : 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
              <b>{c.nickname || c.email || `#${c.user_id}`}</b>
              {c.conectado_at ? <span style={{ color: '#64748b' }}> · desde el {fecha(c.conectado_at)}</span> : null}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.35 }}>
              Titular: <b>{c.titular || '—'}</b> · CUIT <b>{c.doc ? fmtCuit(c.doc) : '—'}</b>
            </Typography>
            {c.ultimo_sync_error ? <Typography variant="body2" sx={{ color: '#b45309' }}>Último error: {c.ultimo_sync_error}</Typography> : null}
            {eligiendo === c.user_id ? (
              <Box sx={{ mt: 0.75, maxWidth: 320 }}>
                <SelectorBuscable label="Proveedor" placeholder="Buscá el proveedor…" value={c.proveedor?.nombre || null}
                  opciones={(provs || []).map((p) => ({ id: p.codigo, nombre: p.nombre }))}
                  onChange={(nombre) => { const p = (provs || []).find((x) => x.nombre === nombre); if (p) vincular(c, p.codigo); }} />
                <Button size="small" onClick={() => setEligiendo(null)} sx={{ textTransform: 'none', color: 'text.secondary', mt: 0.5 }}>Cancelar</Button>
              </Box>
            ) : c.proveedor ? (
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.35 }}>
                Proveedor: <b>{c.proveedor.nombre}</b>
                <Button size="small" onClick={() => setEligiendo(c.user_id)} sx={{ textTransform: 'none', minWidth: 0, ml: 0.5, py: 0 }}>Cambiar</Button>
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: '#b45309', lineHeight: 1.35 }}>
                Sin proveedor vinculado{c.proveedor_sugerido ? <> · ¿es <b>{c.proveedor_sugerido.nombre}</b>?</> : null}
                {c.proveedor_sugerido && (
                  <Button size="small" onClick={() => vincular(c, c.proveedor_sugerido.codigo)} sx={{ textTransform: 'none', fontWeight: 700, minWidth: 0, ml: 0.5, py: 0 }}>
                    Usar {c.proveedor_sugerido.nombre}
                  </Button>
                )}
                <Button size="small" onClick={() => setEligiendo(c.user_id)} sx={{ textTransform: 'none', minWidth: 0, ml: 0.5, py: 0 }}>
                  {c.proveedor_sugerido ? 'Elegir otro' : 'Elegir proveedor'}
                </Button>
              </Typography>
            )}
          </Box>
          {manda(c)
            ? <Chip size="small" label="✓ Define el CUIT de la sucursal" sx={{ height: 24, fontWeight: 700, bgcolor: `${themeColor}1f`, color: '#12627F' }} />
            : (c.doc && String(c.doc).replace(/\D/g, '').length === 11 && (
              <Button size="small" onClick={() => usarCuit(c)} sx={{ textTransform: 'none', fontWeight: 600 }}>Usar su CUIT para la sucursal</Button>
            ))}
          <Button size="small" onClick={() => desconectar(c)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Desconectar</Button>
        </Stack>
      ))}
      {cs && cuentas.length > 0 && (
        <Typography variant="body2" sx={{ mt: 0.75, ml: nombre ? 1 : 0 }}>
          CUIT de {cs.sucursal}: <b>{cs.cuit || 'sin cargar'}</b>
          <span style={{ color: '#64748b' }}>
            {cs.cuenta != null
              ? ` — sale de la cuenta ${cuentas.find((c) => manda(c))?.nickname || ''}.`
              : (cs.cuit ? ' — cargado a mano (no coincide con ninguna cuenta).' : ' — elegí de qué cuenta sale.')}
          </span>
        </Typography>
      )}
      {est?.conectado && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: 12.5 }}>
          Para sumar otra cuenta, antes cerrá la sesión de Mercado Pago en este navegador (o usá una ventana de incógnito): si no, Mercado Pago vuelve a dar la que ya está abierta.
        </Typography>
      )}
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
