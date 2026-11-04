// src/paginas/GestionMediosPago.jsx
// Gestor de medios de pago (lazarillo_gestion/app/(shell)/medios-pago/page.tsx): la lista que
// ofrecen los pagos del Panel. Es de cada negocio. Un medio con pagos no se borra: se desactiva.

import React, { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, IconButton, MenuItem, Paper, Select, Snackbar, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/context/BusinessContext';
import { GestionAPI } from '@/servicios/apiGestion';
import { PanelGestionContext } from '@/gestion/panelContext';
import { useMediosPago } from '@/gestion/hooksPanel';
import { TIPOS_MEDIO, etiquetaTipoMedio } from '@/gestion/cargaUtils';
import { sxTablaPanel } from '@/gestion/estilos';

function Fila({ inicial, onCerrar, onGuardado, onAviso }) {
  const [f, setF] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  async function guardar() {
    setError(null);
    if (!f.nombre.trim()) { setError('Poné un nombre'); return; }
    setGuardando(true);
    try {
      const cuerpo = { nombre: f.nombre, tipo: f.tipo, pideId: f.pideId };
      if (f.id) await GestionAPI.editarMedio(f.id, cuerpo); else await GestionAPI.crearMedio(cuerpo);
      onAviso({ sev: 'success', txt: f.id ? 'Medio actualizado' : 'Medio agregado' });
      onGuardado();
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }
  return (
    <TableRow sx={{ bgcolor: 'rgba(240,249,255,.6)' }}>
      <TableCell>
        <TextField
          size="small" autoFocus value={f.nombre} placeholder="ej. Mercado Pago" error={!!error} helperText={error}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onCerrar(); }}
          sx={{ width: 224 }}
        />
      </TableCell>
      <TableCell>
        <Select size="small" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {TIPOS_MEDIO.map((t) => <MenuItem key={t.valor} value={t.valor}>{t.etiqueta}</MenuItem>)}
        </Select>
      </TableCell>
      <TableCell>
        <FormControlLabel control={<Checkbox size="small" checked={f.pideId} onChange={(e) => setF({ ...f, pideId: e.target.checked })} />} label="Pide ID" slotProps={{ typography: { fontSize: 14 } }} />
      </TableCell>
      <TableCell />
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        <Button size="small" variant="contained" disabled={guardando} startIcon={<CheckIcon />} onClick={guardar} sx={{ mr: 0.5 }}>Guardar</Button>
        <IconButton size="small" title="Cancelar" onClick={onCerrar}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </TableCell>
    </TableRow>
  );
}

function Contenido() {
  const { data, isLoading, error } = useMediosPago();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [aviso, setAviso] = useState(null);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['gestionMediosPago'] });

  async function cambiarActivo(m) {
    try {
      await GestionAPI.editarMedio(m.id, { nombre: m.nombre, tipo: m.tipo, pideId: m.pideId, activo: !m.activo });
      setAviso({ sev: 'success', txt: m.activo ? `${m.nombre} desactivado: ya no se ofrece al pagar` : `${m.nombre} activado` });
      refrescar();
    } catch {
      setAviso({ sev: 'error', txt: 'No se pudo cambiar' });
    }
  }
  async function borrar(m) {
    try {
      await GestionAPI.borrarMedio(m.id);
      setAviso({ sev: 'success', txt: `${m.nombre} borrado` });
      refrescar();
    } catch (e) {
      setAviso({ sev: 'error', txt: e?.message ?? 'No se pudo borrar' });
    }
  }
  const lista = data ?? [];
  const cerrarYRefrescar = () => { setForm(null); refrescar(); };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div>
        <Typography variant="h5" fontWeight={600}>Medios de pago</Typography>
        <Typography variant="body2" color="text.secondary">La lista que ofrecen todos los pagos del Panel. Un medio con pagos no se borra: se desactiva y deja de ofrecerse.</Typography>
      </div>
      {isLoading ? (
        <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box>
      ) : error ? (
        <Typography color="error" fontSize={14}>No se pudieron leer los medios de pago.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', maxWidth: 896 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography fontSize={14} fontWeight={500}>{lista.length} medio{lista.length === 1 ? '' : 's'}</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={form?.id === null} onClick={() => setForm({ id: null, nombre: '', tipo: 'banco', pideId: false })}>Nuevo medio</Button>
          </Box>
          <Table size="small" sx={sxTablaPanel}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell><TableCell>Tipo</TableCell><TableCell>ID</TableCell><TableCell align="right">Pagos</TableCell><TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {form?.id === null && <Fila inicial={form} onCerrar={() => setForm(null)} onGuardado={cerrarYRefrescar} onAviso={setAviso} />}
              {lista.map((m) => (form?.id === m.id ? (
                <Fila key={m.id} inicial={form} onCerrar={() => setForm(null)} onGuardado={cerrarYRefrescar} onAviso={setAviso} />
              ) : (
                <TableRow key={m.id} sx={m.activo ? undefined : { '& td': { color: 'text.secondary' } }}>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {m.nombre}
                    {!m.activo && <Box component="span" sx={{ ml: 1, border: 1, borderColor: 'divider', borderRadius: 0.5, px: 0.5, fontSize: 10, fontWeight: 400 }}>desactivado</Box>}
                  </TableCell>
                  <TableCell>{etiquetaTipoMedio(m.tipo)}</TableCell>
                  <TableCell>{m.pideId ? 'Pide ID' : '—'}</TableCell>
                  <TableCell align="right">{m.usos || '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Box component="button" type="button" onClick={() => cambiarActivo(m)} sx={{ all: 'unset', cursor: 'pointer', mr: 1.5, fontSize: 12, color: 'text.secondary', '&:hover': { textDecoration: 'underline' } }}>{m.activo ? 'Desactivar' : 'Activar'}</Box>
                    <IconButton size="small" title="Editar" onClick={() => setForm({ id: m.id, nombre: m.nombre, tipo: m.tipo, pideId: m.pideId })}><EditIcon sx={{ fontSize: 15 }} /></IconButton>
                    {m.usos === 0
                      ? <IconButton size="small" title="Borrar" onClick={() => borrar(m)} sx={{ '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
                      : <Box component="span" sx={{ display: 'inline-block', width: 28 }} />}
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </Paper>
      )}
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

export default function GestionMediosPago() {
  const { activeBusinessId } = useBusiness() || {};
  return <PanelGestionContext.Provider value={{ businessId: activeBusinessId }}><Contenido /></PanelGestionContext.Provider>;
}
