/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal.jsx
//
// Se abre al hacer click en la celda de nombre de un artículo.
// Permite ver, crear y editar la receta de ese artículo en el negocio activo.
//
// Props:
//   open        → bool
//   onClose     → fn()
//   articulo    → { id, nombre, precio, costo } — el artículo de la fila
//   businessId  → ID del negocio activo

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Divider, Chip, Tooltip,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

import { getReceta, saveReceta } from '@/servicios/apiOrganizations';
import { insumosList } from '@/servicios/apiInsumos';

/* ── Estilos ── */
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '98vw', sm: 680, md: 760 },
  maxHeight: '92vh',
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
  overflow: 'hidden',
};

const UNIDADES = ['gr', 'kg', 'ml', 'lt', 'u'];

/* ── Componente de una fila de item ── */
function ItemRow({ item, index, onChange, onRemove, insumos }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  const insumoSeleccionado = insumos.find(i => String(i.id) === String(item.supplyId));

  const filtrados = search.trim()
    ? insumos.filter(i =>
        i.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        String(i.codigo).includes(search)
      ).slice(0, 12)
    : insumos.slice(0, 12);

  const selectInsumo = (ins) => {
    onChange(index, {
      supplyId: ins.id,
      supplyNombre: ins.nombre,
      supplyMedida: ins.medida,
      costoUnitario: Number(ins.precio || 0),
      unidad: ins.medida || 'u',
    });
    setSearchOpen(false);
    setSearch('');
  };

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr 80px 80px 80px 32px',
      alignItems: 'center',
      gap: 1,
      py: 0.75,
      px: 1,
      borderRadius: 1,
      '&:hover': { bgcolor: 'action.hover' },
      position: 'relative',
    }}>
      {/* drag handle visual */}
      <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 18, cursor: 'grab' }} />

      {/* Selector de insumo */}
      <Box sx={{ position: 'relative' }}>
        <Box
          onClick={() => setSearchOpen(v => !v)}
          sx={{
            border: '1px solid',
            borderColor: item.supplyId ? 'divider' : 'warning.main',
            borderRadius: 1,
            px: 1,
            py: 0.5,
            cursor: 'pointer',
            minHeight: 32,
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          {item.supplyId ? (
            <Typography variant="caption" noWrap>
              {item.supplyNombre || `Insumo #${item.supplyId}`}
              {item.supplyMedida && (
                <Chip label={item.supplyMedida} size="small" sx={{ ml: 0.5, height: 16, fontSize: 10 }} />
              )}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Seleccioná insumo...
            </Typography>
          )}
        </Box>

        {searchOpen && (
          <Box sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 4,
            minWidth: 260,
          }}>
            <Box sx={{ p: 1 }}>
              <TextField
                autoFocus
                size="small"
                fullWidth
                placeholder="Buscar insumo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              />
            </Box>
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {filtrados.length === 0 ? (
                <Typography variant="caption" sx={{ p: 1, display: 'block', color: 'text.secondary' }}>
                  Sin resultados
                </Typography>
              ) : filtrados.map(ins => (
                <Box
                  key={ins.id}
                  onClick={() => selectInsumo(ins)}
                  sx={{
                    px: 1.5, py: 0.75, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <Typography variant="caption">{ins.nombre}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {ins.medida && <Chip label={ins.medida} size="small" sx={{ height: 16, fontSize: 10 }} />}
                    <Typography variant="caption" color="text.secondary">
                      ${Number(ins.precio || 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Cantidad */}
      <TextField
        size="small"
        type="number"
        value={item.cantidad || ''}
        onChange={e => onChange(index, { cantidad: Number(e.target.value) || 0 })}
        placeholder="0"
        inputProps={{ min: 0, step: 0.01 }}
        sx={{ '& input': { textAlign: 'right', fontSize: '0.8rem', py: 0.5 } }}
      />

      {/* Unidad */}
      <TextField
        select
        size="small"
        value={item.unidad || 'u'}
        onChange={e => onChange(index, { unidad: e.target.value })}
        SelectProps={{ native: true }}
        sx={{ '& select': { fontSize: '0.8rem', py: 0.5 } }}
      >
        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
      </TextField>

      {/* Costo unitario */}
      <TextField
        size="small"
        type="number"
        value={item.costoUnitario || ''}
        onChange={e => onChange(index, { costoUnitario: Number(e.target.value) || 0 })}
        placeholder="0.00"
        inputProps={{ min: 0, step: 0.01 }}
        sx={{ '& input': { textAlign: 'right', fontSize: '0.8rem', py: 0.5 } }}
      />

      {/* Eliminar */}
      <IconButton size="small" onClick={() => onRemove(index)} color="error">
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/* ── Modal principal ── */
export default function RecetaModal({ open, onClose, articulo, businessId }) {
  const [receta, setReceta]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);

  // Campos de la receta
  const [nombre, setNombre]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [porciones, setPorciones]     = useState(1);
  const [pctVenta, setPctVenta]       = useState(0);
  const [items, setItems]             = useState([]);

  // Insumos disponibles
  const [insumos, setInsumos]         = useState([]);
  const [insumosLoading, setInsumosLoading] = useState(false);

  const artId   = articulo?.id;
  const artNombre = articulo?.nombre || articulo?.name || '';

  /* ── Cargar receta e insumos al abrir ── */
  useEffect(() => {
    if (!open || !artId || !businessId) return;

    let alive = true;
    setError('');
    setSuccess(false);

    // Cargar receta
    (async () => {
      setLoading(true);
      try {
        const r = await getReceta(businessId, artId);
        if (!alive) return;

        if (r) {
          setReceta(r);
          setNombre(r.nombre || '');
          setDescripcion(r.descripcion || '');
          setPorciones(r.porciones || 1);
          setPctVenta(r.porcentaje_venta || 0);
          setItems((r.items || []).map(it => ({
            supplyId: it.supply_id,
            supplyNombre: it.supply_nombre,
            supplyMedida: it.supply_medida,
            cantidad: Number(it.cantidad),
            unidad: it.unidad || 'u',
            costoUnitario: Number(it.costo_unitario),
            notas: it.notas || '',
            orden: it.orden,
          })));
        } else {
          setReceta(null);
          setNombre('');
          setDescripcion('');
          setPorciones(1);
          setPctVenta(0);
          setItems([]);
        }
      } catch (e) {
        if (alive) setError('No se pudo cargar la receta');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Cargar insumos
    (async () => {
      setInsumosLoading(true);
      try {
        const res = await insumosList(businessId);
        if (!alive) return;
        const lista = Array.isArray(res) ? res : (res?.items || res?.insumos || []);
        setInsumos(lista);
      } catch (e) {
        console.warn('[RecetaModal] Error cargando insumos:', e);
      } finally {
        if (alive) setInsumosLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [open, artId, businessId]);

  /* ── Reset al cerrar ── */
  const handleClose = () => {
    if (saving) return;
    setReceta(null);
    setNombre('');
    setDescripcion('');
    setPorciones(1);
    setPctVenta(0);
    setItems([]);
    setError('');
    setSuccess(false);
    onClose();
  };

  /* ── Cálculos derivados ── */
  const costoTotal = items.reduce((acc, it) =>
    acc + (Number(it.cantidad || 0) * Number(it.costoUnitario || 0)), 0);

  const costoXPorcion = porciones > 0 ? costoTotal / porciones : costoTotal;

  const precioSugerido = pctVenta > 0 && pctVenta < 100
    ? costoXPorcion / ((100 - pctVenta) / 100)
    : 0;

  /* ── Items: agregar, cambiar, eliminar ── */
  const addItem = () => {
    setItems(prev => [...prev, {
      supplyId: null,
      supplyNombre: '',
      supplyMedida: '',
      cantidad: 0,
      unidad: 'u',
      costoUnitario: 0,
      notas: '',
      orden: prev.length,
    }]);
  };

  const changeItem = useCallback((index, patch) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...patch } : it));
  }, []);

  const removeItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Guardar ── */
  const handleSave = async () => {
    if (saving) return;

    const itemsValidos = items.filter(it => it.supplyId && it.cantidad > 0);
    if (itemsValidos.length === 0) {
      setError('Agregá al menos un ingrediente con cantidad mayor a 0');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const saved = await saveReceta(businessId, artId, {
        nombre: nombre.trim() || artNombre,
        descripcion: descripcion.trim() || null,
        porciones: Number(porciones) || 1,
        porcentajeVenta: Number(pctVenta) || 0,
        items: itemsValidos.map((it, i) => ({
          supplyId: Number(it.supplyId),
          cantidad: Number(it.cantidad),
          unidad: it.unidad || 'u',
          costoUnitario: Number(it.costoUnitario),
          notas: it.notas || null,
          orden: i,
        })),
      });

      setReceta(saved);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e?.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} aria-labelledby="receta-modal-title">
      <Box sx={modalStyle}>

        {/* Header */}
        <Box sx={{
          px: 3, py: 2,
          background: 'var(--color-primary, #111)',
          color: 'var(--on-primary, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MenuBookIcon />
            <Box>
              <Typography id="receta-modal-title" variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                Receta
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {artNombre}
                {articulo?.id && (
                  <span style={{ opacity: 0.6, marginLeft: 6 }}>#{articulo.id}</span>
                )}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{ color: 'inherit', opacity: 0.7, '&:hover': { opacity: 1 } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Body scrolleable */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={36} />
            </Box>
          ) : (
            <>
              {/* Datos generales */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' }, gap: 2, mb: 3 }}>
                <TextField
                  label="Nombre de la receta"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  size="small"
                  placeholder={artNombre}
                  helperText="Opcional, se usa el nombre del artículo por defecto"
                />
                <TextField
                  label="Porciones"
                  type="number"
                  value={porciones}
                  onChange={e => setPorciones(Math.max(1, Number(e.target.value) || 1))}
                  size="small"
                  inputProps={{ min: 1 }}
                />
                <TextField
                  label="% Margen venta"
                  type="number"
                  value={pctVenta}
                  onChange={e => setPctVenta(Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
                  size="small"
                  inputProps={{ min: 0, max: 99, step: 1 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Box>

              <Divider sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Ingredientes</Typography>
              </Divider>

              {/* Header de columnas */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 80px 80px 80px 32px',
                gap: 1,
                px: 1,
                mb: 0.5,
              }}>
                <span />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Insumo</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textAlign: 'right' }}>Cantidad</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textAlign: 'center' }}>Unidad</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textAlign: 'right' }}>$/u</Typography>
                <span />
              </Box>

              {/* Items */}
              {items.length === 0 ? (
                <Box sx={{
                  py: 4,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  mb: 2,
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Todavía no hay ingredientes.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hacé click en "Agregar ingrediente" para empezar.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ mb: 2 }}>
                  {items.map((item, i) => (
                    <ItemRow
                      key={i}
                      item={item}
                      index={i}
                      onChange={changeItem}
                      onRemove={removeItem}
                      insumos={insumos}
                    />
                  ))}
                </Box>
              )}

              <Button
                startIcon={insumosLoading ? <CircularProgress size={14} /> : <AddIcon />}
                onClick={addItem}
                size="small"
                disabled={insumosLoading}
                sx={{ mb: 3 }}
              >
                Agregar ingrediente
              </Button>

              <Divider sx={{ mb: 2 }} />

              {/* Resumen de costos */}
              <Box sx={{
                bgcolor: 'action.hover',
                borderRadius: 1.5,
                p: 2,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2,
                mb: 2,
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Costo total</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ${costoTotal.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Costo por porción {porciones > 1 ? `(÷${porciones})` : ''}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ${costoXPorcion.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Precio sugerido {pctVenta > 0 ? `(${pctVenta}% margen)` : ''}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color={precioSugerido > 0 ? 'success.main' : 'text.disabled'}>
                    {precioSugerido > 0 ? `$${precioSugerido.toFixed(2)}` : '—'}
                  </Typography>
                </Box>
              </Box>

              {/* Precio actual del artículo */}
              {articulo?.precio > 0 && (
                <Alert
                  severity={
                    precioSugerido > 0
                      ? (articulo.precio >= precioSugerido ? 'success' : 'warning')
                      : 'info'
                  }
                  sx={{ mb: 2 }}
                >
                  Precio actual del artículo: <strong>${Number(articulo.precio).toFixed(2)}</strong>
                  {precioSugerido > 0 && articulo.precio < precioSugerido && (
                    <span> — por debajo del sugerido (${precioSugerido.toFixed(2)})</span>
                  )}
                </Alert>
              )}

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>Receta guardada correctamente</Alert>}
            </>
          )}
        </Box>

        {/* Footer fijo */}
        <Box sx={{
          px: 3, py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          flexShrink: 0,
        }}>
          <Button onClick={handleClose} disabled={saving} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <MenuBookIcon />}
            sx={{
              bgcolor: 'var(--color-primary, #111)',
              color: 'var(--on-primary, #fff)',
              '&:hover': { bgcolor: 'var(--color-primary, #111)', filter: 'brightness(1.15)' },
            }}
          >
            {saving ? 'Guardando...' : receta ? 'Actualizar receta' : 'Crear receta'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}