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
import { useAccesoEquipo, abrirCartelParaImprimir } from '@/hooks/useAccesoEquipo';

export default function AccesoEquipoModal({ open, onClose, businessId, branchId, businessName, branchName, businessLogo }) {
  const { loading, accessCode, qrDataUrl, link, busy, togglePausa, copiar } = useAccesoEquipo({
    businessId, branchId, enabled: open,
  });

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
          onClick={() => abrirCartelParaImprimir({ qrDataUrl, code: accessCode?.code, businessName, branchName, businessLogo })}
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
