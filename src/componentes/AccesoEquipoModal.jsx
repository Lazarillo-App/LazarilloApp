// src/componentes/AccesoEquipoModal.jsx
// Vista Operación — QR de acceso de una sucursal: la persona lo escanea, se
// registra sola, y cae en la lista de pendientes del negocio. El QR no da
// acceso a nada por sí solo, solo permite pedirlo.
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, CircularProgress, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QRCode from 'qrcode';
import logoMark from '@/assets/brand/logo.png';
import { obtenerCodigoAcceso, pausarReanudarAcceso } from '@/servicios/apiAccesoEquipo';
import { showAlert } from '@/servicios/appAlert';

// Dibuja el QR con el logo Lazarillo en el centro — necesita corrección de
// error alta ('H') para que siga siendo legible con el logo encima.
async function dibujarQrConLogo(link) {
  const size = 320;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, link, { width: size, margin: 1, errorCorrectionLevel: 'H' });

  const ctx = canvas.getContext('2d');
  const logo = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = logoMark;
  });

  const logoSize = Math.round(size * 0.22);
  const cx = (size - logoSize) / 2;
  const pad = 6;
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - pad, cx - pad, logoSize + pad * 2, logoSize + pad * 2);
  ctx.drawImage(logo, cx, cx, logoSize, logoSize);

  return canvas.toDataURL('image/png');
}

function abrirCartelParaImprimir({ qrDataUrl, code, businessName, branchName }) {
  const w = window.open('', '_blank', 'width=500,height=700');
  if (!w) return;
  w.document.write(`
    <!doctype html><html><head><title>Acceso del equipo — ${businessName}</title>
    <style>
      @page { size: A4; margin: 0; }
      body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center;
             height: 100vh; margin: 0; }
      .cartel { border: 2px solid #111; border-radius: 16px; padding: 32px 40px; text-align: center; width: 340px; }
      .marca { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
      .sub { font-size: 10px; letter-spacing: 2px; color: #666; margin-bottom: 18px; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p.instr { color: #555; font-size: 12.5px; margin: 0 0 16px; }
      img { width: 220px; height: 220px; }
      .code { font-size: 22px; font-weight: 800; letter-spacing: 6px; margin-top: 12px; }
      .code-hint { font-size: 10px; color: #888; margin-top: 2px; }
      .negocio { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #444; }
      .negocio b { display: block; font-size: 13.5px; color: #111; }
    </style></head>
    <body onload="window.print()">
      <div class="cartel">
        <div class="marca">LAZARILLO</div>
        <div class="sub">GESTIÓN GASTRONÓMICA</div>
        <h2>Sumate al equipo</h2>
        <p class="instr">Escaneá con la cámara del celular<br/>para crear tu usuario</p>
        <img src="${qrDataUrl}" alt="QR" />
        <div class="code">${code}</div>
        <div class="code-hint">o cargá este código</div>
        <div class="negocio">
          <b>${businessName}</b>
          ${branchName ? branchName : ''}
        </div>
      </div>
    </body></html>
  `);
  w.document.close();
}

export default function AccesoEquipoModal({ open, onClose, businessId, branchId, businessName, branchName }) {
  const [loading, setLoading] = React.useState(true);
  const [accessCode, setAccessCode] = React.useState(null);
  const [qrDataUrl, setQrDataUrl] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const link = accessCode ? `${window.location.origin}/r/${accessCode.code}` : '';

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    obtenerCodigoAcceso(businessId, branchId)
      .then(async (ac) => {
        if (!alive) return;
        setAccessCode(ac);
        const url = `${window.location.origin}/r/${ac.code}`;
        const dataUrl = await dibujarQrConLogo(url);
        if (alive) setQrDataUrl(dataUrl);
      })
      .catch((e) => { if (alive) showAlert(e?.message || 'No se pudo generar el acceso', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, businessId, branchId]);

  const togglePausa = async () => {
    setBusy(true);
    try {
      const next = await pausarReanudarAcceso(businessId, branchId, !accessCode.active);
      setAccessCode((prev) => ({ ...prev, active: next.active }));
    } catch (e) {
      showAlert(e?.message || 'No se pudo actualizar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copiar = (texto) => {
    navigator.clipboard?.writeText(texto).then(() => showAlert('Copiado', 'success')).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        Acceso del equipo
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" py={4}><CircularProgress size={26} /></Stack>
        ) : (
          <Stack spacing={2} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              QR de acceso para empleados. Se imprime y se pega en el local. Quien lo escanea
              crea su usuario para este negocio y queda esperando que lo apruebes.
            </Typography>

            {qrDataUrl && (
              <Box sx={{ opacity: accessCode?.active ? 1 : 0.35, position: 'relative' }}>
                <img src={qrDataUrl} alt="QR de acceso" width={180} height={180} />
                {!accessCode?.active && (
                  <Box sx={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, color: '#c0392b',
                  }}>
                    PAUSADO
                  </Box>
                )}
              </Box>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography fontWeight={800} sx={{ letterSpacing: 3 }}>{accessCode?.code}</Typography>
              <IconButton size="small" onClick={() => copiar(accessCode?.code)}><ContentCopyIcon sx={{ fontSize: 15 }} /></IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ maxWidth: '100%' }}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>{link}</Typography>
              <IconButton size="small" onClick={() => copiar(link)}><ContentCopyIcon sx={{ fontSize: 15 }} /></IconButton>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          startIcon={<PrintIcon />}
          disabled={loading || !qrDataUrl}
          onClick={() => abrirCartelParaImprimir({ qrDataUrl, code: accessCode?.code, businessName, branchName })}
        >
          Imprimir QR
        </Button>
        <Button
          startIcon={<WhatsAppIcon />}
          disabled={loading}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Sumate al equipo de ${businessName}: ${link}`)}`, '_blank')}
        >
          Compartir por WhatsApp
        </Button>
        <Button
          startIcon={accessCode?.active ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />}
          disabled={loading || busy}
          color={accessCode?.active ? 'warning' : 'success'}
          onClick={togglePausa}
        >
          {accessCode?.active ? 'Pausar acceso' : 'Reanudar acceso'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
