// src/componentes/configuracion/ArcaCaja.jsx
// Configuración › Conexiones › ARCA (usuaria 18/11/2026, opción C: robot propio). La PC del negocio con
// el kit entra a ARCA con la CUIT y clave del cliente —guardadas cifradas SOLO en esa PC, Lazarillo
// nunca las ve—, baja «Mis Comprobantes › Recibidos» y los sube al Panel (Sin carga › ARCA). Acá se
// elige cada cuánto (diaria / semanal / mensual / solo a pedido) y se pide «Traer ahora» con un rango.
// Si el cliente baja el archivo a mano, el vigilante del kit lo detecta en Descargas y lo sube igual.
// Estilo: temaDiego (paleta y tipografías de Diego), con el formato de las otras tarjetas de Conexiones.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Paper, Stack, Typography, Box, Button, Chip, Alert, CircularProgress, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArcaAPI } from '@/servicios/apiArca';
import { showAlert } from '@/servicios/appAlert';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

const FRECUENCIAS = [
  ['diaria', 'Todos los días'],
  ['semanal', 'Una vez por semana'],
  ['mensual', 'Una vez por mes'],
  ['apagada', 'Solo cuando lo pida'],
];
const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const cuando = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hm}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hm}`;
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${hm}`;
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Atajos de rango (ARCA informa hasta ayer).
function atajos() {
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const iniPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const hace3 = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
  return [
    ['Mes pasado', iso(iniPasado), iso(finPasado)],
    ['Este mes', iso(iniMes > ayer ? ayer : iniMes), iso(ayer)],
    ['Últimos 3 meses', iso(hace3), iso(ayer)],
  ];
}

function Etiqueta({ children }) {
  return <Typography sx={{ fontFamily: FT, fontWeight: 700, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: T.text3, mb: 0.75 }}>{children}</Typography>;
}

export default function ArcaCaja({ businessId }) {
  const nav = useNavigate();
  const [est, setEst] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const rangos = useMemo(atajos, []);
  const [desde, setDesde] = useState(rangos[0][1]);
  const [hasta, setHasta] = useState(rangos[0][2]);

  useEffect(() => { cargarFuentes(); }, []);
  const cargar = useCallback(() => {
    if (!businessId) return;
    ArcaAPI.estado(businessId).then((e) => { setEst(e); setError(''); }).catch(() => setError('No pude leer la conexión con ARCA.'));
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarFrecuencia = async (f) => {
    if (!est || f === est.frecuencia) return;
    setEst((e) => ({ ...e, frecuencia: f }));
    try { await ArcaAPI.frecuencia(businessId, f); } catch { showAlert('No se pudo guardar. Probá de nuevo.', 'error'); cargar(); }
  };
  const traer = async () => {
    setGuardando(true);
    try {
      const r = await ArcaAPI.traer(businessId, desde, hasta);
      showAlert(`Listo: la PC trae del ${dmy(r.desde)} al ${dmy(r.hasta)} en su próxima consulta.`, 'success');
      cargar();
    } catch (e) {
      const k = e?.data?.error;
      showAlert(k === 'rango_largo' ? 'ARCA deja traer hasta 365 días por vez.' : k === 'rango_invertido' ? 'La fecha «desde» es posterior a «hasta».' : 'No se pudo pedir. Revisá las fechas.', 'warning');
    } finally { setGuardando(false); }
  };
  const cancelar = async () => { try { await ArcaAPI.cancelar(businessId); cargar(); } catch { /* sigue */ } };

  const conectado = est?.vinculada;
  const chip = !est ? null : conectado
    ? <Chip size="small" label="Conectado" sx={{ height: 22, fontWeight: 700, bgcolor: `${T.ok}1a`, color: T.ok }} />
    : <Chip size="small" label="Sin conectar" sx={{ height: 22, fontWeight: 600 }} />;

  const btnSel = (on) => ({
    textTransform: 'none', fontFamily: FB, fontWeight: on ? 700 : 500, fontSize: 13, borderRadius: 2, minHeight: 36, px: 1.5,
    border: `1px solid ${on ? T.accent : T.border2}`, bgcolor: on ? `${T.accent}22` : '#fff', color: on ? T.accentTxt : T.text2,
    '&:hover': { bgcolor: on ? `${T.accent}30` : T.head, borderColor: T.accent },
  });

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: T.border, fontFamily: FB }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.25, minHeight: 56, borderBottom: `1px solid ${T.border}`, bgcolor: T.head }}>
        <Typography sx={{ fontFamily: FT, fontWeight: 700, fontSize: '0.95rem', color: T.ink }}>ARCA · comprobantes recibidos</Typography>
        {chip}
        <Box sx={{ flex: 1 }} />
        {est?.comprobantes > 0 && (
          <Button size="small" onClick={() => nav('/gestion')} sx={{ textTransform: 'none', color: T.accentTxt, fontWeight: 600 }}>Ver en el Panel</Button>
        )}
      </Stack>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!est && !error && <Typography variant="body2" sx={{ color: T.text3 }}>Un segundo…</Typography>}
        {error && <Alert severity="error">{error}</Alert>}

        {est && (
          <Typography sx={{ fontSize: 13.5, color: T.text2, lineHeight: 1.55 }}>
            La PC del negocio entra a ARCA con <b>tu CUIT y tu clave fiscal</b>, baja <b>Mis Comprobantes › Recibidos</b> y los sube al Panel
            (Sin carga › ARCA), donde ves qué facturas de proveedores todavía no cargaste. <b>La clave queda guardada solo en esa PC</b>, cifrada:
            Lazarillo nunca la ve. Si bajás el archivo de ARCA a mano, el kit lo encuentra en Descargas y lo sube igual.
          </Typography>
        )}

        {/* Estado de la conexión */}
        {est && !conectado && (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: T.card, border: `1px solid ${T.border}` }}>
            <Etiqueta>Cómo se conecta</Etiqueta>
            {!est.hayPc ? (
              <Typography sx={{ fontSize: 13.5, color: T.text }}>
                Primero instalá el kit de Lazarillo en una PC del negocio (más arriba, <b>Vincular una PC</b>).
                Después, en esa PC, se conecta ARCA una sola vez.
              </Typography>
            ) : (
              <Box component="ol" sx={{ m: 0, pl: 2.25, fontSize: 13.5, color: T.text, '& li': { mb: 0.5 } }}>
                <li>En la PC del negocio, abrí la carpeta <b>Lazarillo</b>.</li>
                <li>Hacé doble clic en <b>VINCULAR ARCA</b>.</li>
                <li>Poné tu CUIT y tu clave fiscal. Quedan guardadas solo en esa PC, y desde ahí trae solo.</li>
              </Box>
            )}
            <Typography sx={{ mt: 1, fontSize: 12, color: T.text3 }}>Esto llega con la próxima versión del kit.</Typography>
          </Box>
        )}
        {est && conectado && (
          <Typography sx={{ fontSize: 13.5, color: T.text }}>
            <b>CUIT {est.cuit}</b> desde la PC <b>{est.pc?.nombre}</b>
            {est.recibidos_hasta ? <> · traído hasta el <b>{dmy(est.recibidos_hasta)}</b></> : ' · todavía no trajo nada'}
            {est.ultima_corrida_at ? ` · última vez ${cuando(est.ultima_corrida_at)}` : ''}
            {est.comprobantes ? ` · ${est.comprobantes} comprobantes en el Panel` : ''}
          </Typography>
        )}
        {est?.ultimo_error && (
          <Alert severity="warning">La última vez no se pudo{est.ultimo_error_at ? ` (${cuando(est.ultimo_error_at)})` : ''}: {est.ultimo_error}</Alert>
        )}

        {/* Cada cuánto */}
        {est && (
          <Box>
            <Etiqueta>Cada cuánto traer</Etiqueta>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, auto)' }, gap: 1, justifyContent: 'start' }}>
              {FRECUENCIAS.map(([k, l]) => (
                <Button key={k} onClick={() => cambiarFrecuencia(k)} sx={btnSel(est.frecuencia === k)}>{l}</Button>
              ))}
            </Box>
          </Box>
        )}

        {/* Traer ahora */}
        {est && (
          <Box>
            <Etiqueta>Traer ahora</Etiqueta>
            {est.pedido ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={0.5}>
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                  <CircularProgress size={14} sx={{ color: T.accent, flexShrink: 0, mt: 0.4 }} />
                  <Typography sx={{ fontSize: 13.5, color: T.text }}>
                    Pedido del <b>{dmy(est.pedido.desde)}</b> al <b>{dmy(est.pedido.hasta)}</b>: la PC lo trae en su próxima consulta.
                  </Typography>
                </Stack>
                <Button size="small" onClick={cancelar} sx={{ textTransform: 'none', color: T.text3, ml: { xs: 2.5, sm: 0 } }}>Cancelar</Button>
              </Stack>
            ) : (
              <>
                <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                  {rangos.map(([l, d, h]) => (
                    <Chip key={l} label={l} size="small" onClick={() => { setDesde(d); setHasta(h); }} clickable
                      sx={{ fontFamily: FB, fontWeight: 600, bgcolor: desde === d && hasta === h ? `${T.accent}22` : T.head, color: desde === d && hasta === h ? T.accentTxt : T.text2, border: `1px solid ${T.border}` }} />
                  ))}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <TextField type="date" size="small" label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} InputLabelProps={{ shrink: true }} />
                  <TextField type="date" size="small" label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} InputLabelProps={{ shrink: true }} />
                  <Button variant="contained" disableElevation onClick={traer} disabled={guardando || !desde || !hasta}
                    startIcon={guardando ? <CircularProgress size={14} color="inherit" /> : null}
                    sx={{ textTransform: 'none', fontFamily: FB, fontWeight: 700, borderRadius: 2, minHeight: 40, bgcolor: T.ink, '&:hover': { bgcolor: T.ink, filter: 'brightness(1.15)' } }}>
                    Traer ahora
                  </Button>
                </Stack>
              </>
            )}
          </Box>
        )}

        {/* Lo último que llegó */}
        {est?.subidas?.length > 0 && (
          <Box>
            <Etiqueta>Lo último que llegó</Etiqueta>
            <Box sx={{ border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
              {est.subidas.map((s, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center"
                  sx={{ px: 1.5, py: 0.9, borderTop: i ? `1px solid ${T.border}` : 'none', fontSize: 13, flexWrap: 'wrap', rowGap: 0.25 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.error ? T.bad : T.ok, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 13, color: T.text, minWidth: 92 }}>{cuando(s.creado_at)}</Typography>
                  <Typography sx={{ fontSize: 13, color: T.text2, flex: 1, minWidth: 160 }}>
                    {s.error ? `No se pudo: ${s.error}`
                      : `${s.comprobantes} comprobante${s.comprobantes === 1 ? '' : 's'}${s.nuevos ? ` (${s.nuevos} nuevo${s.nuevos === 1 ? '' : 's'})` : ''}`
                        + `${s.desde ? ` · ${dm(s.desde)} al ${dm(s.hasta)}` : ''}`}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: T.text3 }}>{s.origen === 'descargas' ? 'bajado a mano' : 'automático'}</Typography>
                </Stack>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
