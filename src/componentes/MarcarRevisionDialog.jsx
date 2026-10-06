// src/componentes/MarcarRevisionDialog.jsx
// Marca recetas o insumos para que alguien los revise, con una nota obligatoria.
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';
import { marcarARevision } from '@/servicios/apiRecetaProposals';
import { showAlert } from '@/servicios/appAlert';

export default function MarcarRevisionDialog({ open, onClose, businessId, items = [], titulo = 'Marcar a revisión', onDone }) {
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!nota.trim()) { showAlert('Escribí una nota para quien lo tiene que revisar', 'error'); return; }
    setEnviando(true);
    try {
      const r = await marcarARevision(businessId, items, nota.trim());
      showAlert(`Marcado a revisión: ${r.marcados} ${r.marcados === 1 ? 'elemento' : 'elementos'}`, 'success');
      setNota('');
      onDone?.(r.marcados);
      onClose?.();
    } catch (e) {
      showAlert(e.message || 'No se pudo marcar a revisión', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !enviando && onClose?.()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>{titulo}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Se va a marcar {items.length} {items.length === 1 ? 'elemento' : 'elementos'} para revisión. Quien tenga que revisarlo va a ver una alerta.
        </Typography>
        <TextField autoFocus fullWidth multiline minRows={3} size="small" label="Nota"
          placeholder="Qué hay que revisar…" value={nota} onChange={(e) => setNota(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose?.()} disabled={enviando} color="inherit">Cancelar</Button>
        <Button onClick={enviar} variant="contained" disabled={enviando || !items.length}>
          {enviando ? 'Marcando…' : 'Marcar a revisión'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
