// src/componentes/AgregarArticuloModal.jsx
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, InputAdornment,
} from '@mui/material';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { BASE } from '../servicios/apiBase';

export default function AgregarArticuloModal({ open, onClose, onCreated, businessId }) {

  const [nombre,       setNombre]       = useState('');
  const [precio,       setPrecio]       = useState('');
  const [rubro,        setRubro]        = useState('');
  const [subrubro,     setSubrubro]     = useState('');
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState('');
  const [rubrosData,   setRubrosData]   = useState([]); // { nombre, subrubros[] }
  const [subrubros,    setSubrubros]    = useState([]);

  // Cargar rubros del backend al abrir
  React.useEffect(() => {
    if (!open || !businessId) return;
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/businesses/${businessId}/rubros`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.ok) setRubrosData(data.categorias || []);
      })
      .catch(() => {});
  }, [open, businessId]);

  // Actualizar subrubros cuando cambia el rubro seleccionado
  React.useEffect(() => {
    const found = rubrosData.find(r => r.nombre === rubro);
    setSubrubros(found?.subrubros || []);
    setSubrubro('');
  }, [rubro, rubrosData]);

  const rubros = useMemo(() => rubrosData.map(r => r.nombre).sort(), [rubrosData]);

  const valid = nombre.trim().length >= 1 && Number(precio) >= 0;

  const handleClose = () => {
    setNombre(''); setPrecio(''); setRubro(''); setSubrubro('');
    setErr(''); setRubrosData([]); setSubrubros([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!valid) return;
    if (!businessId) {
      setErr('No hay un negocio activo seleccionado. Creá o seleccioná un negocio primero.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await BusinessesAPI.createManualArticle(businessId, {
        nombre:   nombre.trim(),
        precio:   Number(precio) || 0,
        rubro:    rubro.trim()    || 'Sin rubro',
        subrubro: subrubro.trim() || null,
      });
      onCreated?.(res);
      handleClose();
    } catch (e) {
      setErr(e?.message || 'Error al crear el artículo');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Sora', system-ui, sans-serif" }}>
        Nuevo artículo
      </DialogTitle>

      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
          <TextField
            label="Nombre"
            size="small"
            fullWidth
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Milanesa napolitana"
          />

          <TextField
            label="Precio"
            size="small"
            fullWidth
            type="number"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            placeholder="0"
          />

          {rubros.length > 0 ? (
            <TextField
              select
              label="Rubro / categoría"
              size="small"
              fullWidth
              value={rubro}
              onChange={e => setRubro(e.target.value)}
            >
              <MenuItem value="">Sin rubro</MenuItem>
              {rubros.map(r => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Rubro / categoría"
              size="small"
              fullWidth
              value={rubro}
              onChange={e => setRubro(e.target.value)}
              placeholder="Ej: Platos principales"
            />
          )}

          {subrubros.length > 0 ? (
            <TextField
              select
              label="Subrubro (opcional)"
              size="small"
              fullWidth
              value={subrubro}
              onChange={e => setSubrubro(e.target.value)}
            >
              <MenuItem value="">Sin subrubro</MenuItem>
              {subrubros.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Subrubro (opcional)"
              size="small"
              fullWidth
              value={subrubro}
              onChange={e => setSubrubro(e.target.value)}
              placeholder="Ej: Carnes"
            />
          )}

          {err && (
            <div style={{ fontSize: 13, color: '#ef4444', background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
              {err}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!valid || busy}
          sx={{ background: '#2492C8', '&:hover': { background: '#1a7aaa' } }}
        >
          {busy ? 'Creando…' : 'Crear artículo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}