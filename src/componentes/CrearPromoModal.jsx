// src/componentes/CrearPromoModal.jsx
// Modal para crear una promoción (v1).
// Una promo es un artículo nuevo cuya receta contiene otros artículos (+ insumos opcionales).
// El modal carga sus propios datos (artículos + insumos) para no acoplar props.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, IconButton,
  InputAdornment, Divider, CircularProgress, MenuItem, FormControl, Select,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

import { BusinessesAPI, PromocionesAPI } from '@/servicios/apiBusinesses';
import { insumosList } from '@/servicios/apiInsumos';

const UNIDADES = ['u', 'kg', 'gr', 'l', 'ml'];

const fmt = (v) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
};

export default function CrearPromoModal({ open, onClose, businessId, onCreated }) {
  const [articulos, setArticulos] = useState([]);
  const [insumosCat, setInsumosCat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [nombreEditado, setNombreEditado] = useState(false);
  const [componentes, setComponentes] = useState([]); // [{ id, nombre, costo, cantidad, unidad }]
  const [insumosSel, setInsumosSel] = useState([]);    // [{ id, nombre, precio_ref, unidad_med, cantidad, unidad }]

  const [queryArt, setQueryArt] = useState('');
  const [queryIns, setQueryIns] = useState('');

  // Cargar artículos + insumos al abrir
  useEffect(() => {
    if (!open || !businessId) return;
    setLoading(true);
    Promise.all([
      BusinessesAPI.articlesFromDB(businessId).catch(() => ({ items: [] })),
      insumosList(businessId, { limit: 99999 }).catch(() => ({ data: [] })),
    ]).then(([artResp, insResp]) => {
      const arts = Array.isArray(artResp?.items) ? artResp.items : [];
      setArticulos(arts.map(a => ({
        id: Number(a.id ?? a.articulo_id),
        nombre: String(a.nombre || a.name || `#${a.id}`),
        costo: Number(a.costo) || 0,
        precio: Number(a.precio) || 0,
        subrubro: a.subrubro || a.categoria || '',
      })).filter(a => Number.isFinite(a.id)));
      const ins = Array.isArray(insResp?.data) ? insResp.data
        : Array.isArray(insResp?.insumos) ? insResp.insumos : [];
      setInsumosCat(ins);
    }).finally(() => setLoading(false));
  }, [open, businessId]);

  // Reset al cerrar
  useEffect(() => {
    if (open) return;
    setNombre(''); setNombreEditado(false); setComponentes([]);
    setInsumosSel([]); setQueryArt(''); setQueryIns(''); setError('');
  }, [open]);

  // Nombre sugerido = concatenación de componentes (si no lo editó el usuario)
  useEffect(() => {
    if (nombreEditado) return;
    setNombre(componentes.map(c => c.nombre).join(' + '));
  }, [componentes, nombreEditado]);

  const idsUsados = useMemo(() => new Set(componentes.map(c => c.id)), [componentes]);

  const artFiltrados = useMemo(() => {
    const q = queryArt.trim().toLowerCase();
    if (!q) return [];
    return articulos
      .filter(a => !idsUsados.has(a.id))
      .filter(a => a.nombre.toLowerCase().includes(q) || String(a.id).includes(q))
      .slice(0, 8);
  }, [queryArt, articulos, idsUsados]);

  const insFiltrados = useMemo(() => {
    const q = queryIns.trim().toLowerCase();
    if (!q) return [];
    const idsIns = new Set(insumosSel.map(i => i.id));
    return insumosCat
      .filter(i => !idsIns.has(Number(i.id)))
      .filter(i => String(i.nombre || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [queryIns, insumosCat, insumosSel]);

  const addComponente = useCallback((art) => {
    setComponentes(prev => [...prev, { ...art, cantidad: 1, unidad: 'u' }]);
    setQueryArt('');
  }, []);

  const addInsumo = useCallback((ins) => {
    setInsumosSel(prev => [...prev, {
      id: Number(ins.id), nombre: ins.nombre,
      precio_ref: Number(ins.precio_ref) || 0,
      unidad_med: ins.unidad_med || 'u',
      cantidad: 0, unidad: (UNIDADES.includes(String(ins.unidad_med || '').toLowerCase()) ? ins.unidad_med.toLowerCase() : 'u'),
    }]);
    setQueryIns('');
  }, []);

  const updateComp = (idx, patch) =>
    setComponentes(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeComp = (idx) =>
    setComponentes(prev => prev.filter((_, i) => i !== idx));
  const updateIns = (idx, patch) =>
    setInsumosSel(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeIns = (idx) =>
    setInsumosSel(prev => prev.filter((_, i) => i !== idx));

  const costoTotal = useMemo(() => {
    let t = 0;
    for (const c of componentes) t += (Number(c.costo) || 0) * (Number(c.cantidad) || 0);
    for (const i of insumosSel) t += (Number(i.precio_ref) || 0) * (Number(i.cantidad) || 0);
    return t;
  }, [componentes, insumosSel]);

  const handleCrear = async () => {
    setError('');
    if (componentes.length < 1) { setError('Agregá al menos un artículo'); return; }
    if (!nombre.trim()) { setError('Poné un nombre a la promoción'); return; }
    setSaving(true);
    try {
      const body = {
        nombre: nombre.trim(),
        componentes: componentes.map(c => ({ articleId: c.id, cantidad: Number(c.cantidad) || 1, unidad: c.unidad || 'u' })),
        insumos: insumosSel.map(i => ({ insumoId: i.id, cantidad: Number(i.cantidad) || 0, unidad: i.unidad || 'u' })),
      };
      const r = await PromocionesAPI.crear(businessId, body);
      onCreated?.(r?.promo);
      onClose();
    } catch (e) {
      setError(e?.message || 'Error al crear la promoción');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalOfferIcon sx={{ color: '#7c3aed' }} />
        <Typography fontWeight={700} sx={{ flex: 1 }}>Crear promoción</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
        ) : (
          <>
            {/* Nombre */}
            <TextField
              size="small" fullWidth label="Nombre de la promoción"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setNombreEditado(true); }}
              placeholder="Ej: Café + 2 Medialunas"
              sx={{ mb: 2, mt: 0.5 }}
            />

            {/* Artículos componentes */}
            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Artículos de la promo
            </Typography>

            <Box sx={{ position: 'relative', mb: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Buscar artículo…"
                value={queryArt}
                onChange={e => setQueryArt(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              {artFiltrados.length > 0 && (
                <Box sx={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 220, overflowY: 'auto', boxShadow: 3 }}>
                  {artFiltrados.map(a => (
                    <Box key={a.id}
                      onClick={() => addComponente(a)}
                      sx={{ px: 1.5, py: 0.75, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', '&:hover': { bgcolor: 'action.hover' } }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{a.subrubro || 'Artículo'}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#7c3aed', fontWeight: 700, fontSize: '0.8rem' }}>
                        {Number(a.costo) > 0 ? `$${fmt(a.costo)}` : '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {componentes.map((c, idx) => (
              <Stack key={c.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>{c.nombre}</Typography>
                <TextField
                  size="small" type="number" sx={{ width: 70 }}
                  value={c.cantidad}
                  onChange={e => updateComp(idx, { cantidad: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <FormControl size="small" sx={{ width: 70 }}>
                  <Select value={c.unidad} onChange={e => updateComp(idx, { unidad: e.target.value })}>
                    {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ width: 70, textAlign: 'right', color: 'text.secondary' }}>
                  ${fmt((Number(c.costo) || 0) * (Number(c.cantidad) || 0))}
                </Typography>
                <IconButton size="small" onClick={() => removeComp(idx)}><DeleteIcon fontSize="small" color="error" /></IconButton>
              </Stack>
            ))}

            {/* Insumos opcionales (packaging) */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Insumos propios (opcional)
            </Typography>

            <Box sx={{ position: 'relative', mb: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Buscar insumo (packaging, etc.)…"
                value={queryIns}
                onChange={e => setQueryIns(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              {insFiltrados.length > 0 && (
                <Box sx={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1, maxHeight: 200, overflowY: 'auto', boxShadow: 3 }}>
                  {insFiltrados.map(i => (
                    <Box key={i.id}
                      onClick={() => addInsumo(i)}
                      sx={{ px: 1.5, py: 0.75, cursor: 'pointer', fontSize: '0.82rem', '&:hover': { bgcolor: 'action.hover' } }}>
                      {i.nombre}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {insumosSel.map((i, idx) => (
              <Stack key={i.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>{i.nombre}</Typography>
                <TextField
                  size="small" type="number" sx={{ width: 70 }}
                  value={i.cantidad}
                  onChange={e => updateIns(idx, { cantidad: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <FormControl size="small" sx={{ width: 70 }}>
                  <Select value={i.unidad} onChange={e => updateIns(idx, { unidad: e.target.value })}>
                    {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography variant="caption" sx={{ width: 70, textAlign: 'right', color: 'text.secondary' }}>
                  ${fmt((Number(i.precio_ref) || 0) * (Number(i.cantidad) || 0))}
                </Typography>
                <IconButton size="small" onClick={() => removeIns(idx)}><DeleteIcon fontSize="small" color="error" /></IconButton>
              </Stack>
            ))}

            {/* Costo total */}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" fontWeight={700}>Costo total de la promo</Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#7c3aed' }}>${fmt(costoTotal)}</Typography>
            </Box>

            {error && <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>{error}</Typography>}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" size="small">Cancelar</Button>
        <Button
          onClick={handleCrear}
          variant="contained"
          disabled={saving || loading || componentes.length === 0}
          sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'Crear promoción'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}