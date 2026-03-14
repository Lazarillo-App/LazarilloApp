/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Divider, Chip, Tooltip,
  InputAdornment, Badge,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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
  bgcolor: 'primary.contrastText',
  borderRadius: 2,
  boxShadow: 24,
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
  overflow: 'hidden',
};

const UNIDADES = ['gr', 'kg', 'ml', 'lt', 'u'];

/* ── Componente de una fila de item ── */
function ItemRow({ item, index, onChange, onRemove, insumos, usedSupplyIds }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  const insumoSeleccionado = insumos.find(i => String(i.id) === String(item.supplyId));

  // ✅ MEJORA: Validar si el insumo ya está usado en otro item
  const isDuplicate = item.supplyId && usedSupplyIds.has(String(item.supplyId)) &&
    usedSupplyIds.get(String(item.supplyId)) !== index;

  const filtrados = search.trim()
    ? insumos.filter(i =>
      i.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      String(i.codigo).includes(search)
    ).slice(0, 15) // ✅ MEJORA: Mostrar más resultados
    : insumos.slice(0, 15);

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
      // ✅ MEJORA: Indicar visualmente si hay duplicado
      ...(isDuplicate && {
        bgcolor: 'error.lighter',
        border: '1px solid',
        borderColor: 'error.light',
      }),
    }}>
      {/* drag handle visual */}
      <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 18, cursor: 'grab' }} />

      {/* Selector de insumo */}
      <Box sx={{ position: 'relative' }}>
        <Box
          onClick={() => setSearchOpen(v => !v)}
          sx={{
            border: '1px solid',
            borderColor: isDuplicate ? 'error.main' : item.supplyId ? 'success.light' : 'warning.main',
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
              {isDuplicate && (
                <Tooltip title="Insumo duplicado">
                  <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />
                </Tooltip>
              )}
              {!isDuplicate && (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
              )}
              <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                {item.supplyNombre || `Insumo #${item.supplyId}`}
              </Typography>
              {item.supplyMedida && (
                <Chip
                  label={item.supplyMedida}
                  size="small"
                  sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
                />
              )}
            </Box>
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
            minWidth: 320, // ✅ MEJORA: Más ancho para mostrar info
            mt: 0.5,
          }}>
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                autoFocus
                size="small"
                fullWidth
                placeholder="Buscar por nombre o código..."
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
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {filtrados.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    {search ? 'Sin resultados para tu búsqueda' : 'No hay insumos disponibles'}
                  </Typography>
                </Box>
              ) : filtrados.map(ins => {
                // ✅ MEJORA: Marcar insumos ya usados
                const yaUsado = Array.from(usedSupplyIds.keys()).includes(String(ins.id));

                return (
                  <Box
                    key={ins.id}
                    onClick={() => selectInsumo(ins)}
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      '&:hover': { bgcolor: 'action.selected' },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      ...(yaUsado && {
                        bgcolor: 'action.disabledBackground',
                        opacity: 0.7,
                      }),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {ins.nombre}
                        </Typography>
                        {yaUsado && (
                          <Chip
                            label="Ya usado"
                            size="small"
                            color="warning"
                            sx={{ height: 18, fontSize: 9 }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="primary" fontWeight={700}>
                        ${Number(ins.precio || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Código: {ins.codigo || 'N/A'}
                      </Typography>
                      {ins.medida && (
                        <>
                          <Typography variant="caption" color="text.disabled">•</Typography>
                          <Chip
                            label={`Unidad: ${ins.medida}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: 10 }}
                          />
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
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
        sx={{
          '& input': {
            textAlign: 'right',
            fontSize: '0.8rem',
            py: 0.5,
            fontWeight: 600,
          }
        }}
      />

      {/* Unidad */}
      <TextField
        select
        size="small"
        value={item.unidad || 'u'}
        onChange={e => onChange(index, { unidad: e.target.value })}
        SelectProps={{ native: true }}
        sx={{ '& select': { fontSize: '0.8rem', py: 0.5, fontWeight: 600 } }}
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
        sx={{
          '& input': {
            textAlign: 'right',
            fontSize: '0.8rem',
            py: 0.5,
            fontWeight: 600,
          }
        }}
      />

      {/* Eliminar */}
      <Tooltip title="Eliminar ingrediente">
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          sx={{
            color: 'error.main',
            opacity: 0.6,
            '&:hover': { opacity: 1, bgcolor: 'error.lighter' }
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/* ── Modal principal ── */
export default function RecetaModal({ open, onClose, articulo, businessId }) {
  // Estados de datos
  const [receta, setReceta] = useState(null);
  const [nombre, setNombre] = useState('');
  const [porciones, setPorciones] = useState(1);
  const [pctVenta, setPctVenta] = useState(30);
  const [items, setItems] = useState([]);
  const [insumos, setInsumos] = useState([]);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const artNombre = articulo?.nombre || '';

  // ✅ MEJORA: Calcular IDs de insumos usados para evitar duplicados
  const usedSupplyIds = new Map(
    items.map((item, idx) => [String(item.supplyId), idx]).filter(([id]) => id !== 'undefined')
  );

  const hasDuplicates = items.some((item, index) => {
    if (!item.supplyId) return false;
    const firstIndex = items.findIndex(i => String(i.supplyId) === String(item.supplyId));
    return firstIndex !== index;
  });

  // Cargar insumos
  useEffect(() => {
    if (!open || !businessId) return;

    setInsumosLoading(true);
    insumosList(businessId)
      .then(resp => {
        const lista = Array.isArray(resp?.data) ? resp.data
          : Array.isArray(resp?.insumos) ? resp.insumos
            : [];
        setInsumos(lista);
      })
      .catch(err => {
        console.error('Error al cargar insumos:', err);
        setError('No se pudieron cargar los insumos');
      })
      .finally(() => setInsumosLoading(false));
  }, [open, businessId]);

  // Cargar receta existente
  useEffect(() => {
    if (!open || !businessId || !articulo?.id) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    getReceta(businessId, articulo.id)
      .then(rec => {
        setReceta(rec);
        if (rec) {
          // ✅ MEJORA: Si no hay nombre, usar el del artículo por defecto
          setNombre(rec.nombre || artNombre);
          setPorciones(rec.porciones || 1);
          setPctVenta(rec.porcentaje_venta ?? 30);
          setItems((rec.items || []).map(it => ({
            supplyId: it.supply_id,
            supplyNombre: it.supply_nombre,
            supplyMedida: it.supply_medida,
            cantidad: Number(it.cantidad || 0),
            unidad: it.unidad || 'u',
            costoUnitario: Number(it.costo_unitario || 0),
          })));
        } else {
          // Nueva receta: nombre por defecto del artículo
          setNombre(artNombre);
          setPorciones(1);
          setPctVenta(30);
          setItems([]);
        }
      })
      .catch(err => {
        console.error('Error al cargar receta:', err);
        setError('No se pudo cargar la receta');
      })
      .finally(() => setLoading(false));
  }, [open, businessId, articulo?.id]); // artNombre se lee dentro, no como dep

  const changeItem = (idx, partial) => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], ...partial };
      return arr;
    });
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      supplyId: null,
      supplyNombre: '',
      supplyMedida: '',
      cantidad: 0,
      unidad: 'u',
      costoUnitario: 0,
    }]);
  };

  // Cálculos
  const costoTotal = items.reduce((acc, it) => {
    const cant = Number(it.cantidad) || 0;
    const cu = Number(it.costoUnitario) || 0;
    return acc + (cant * cu);
  }, 0);

  const costoXPorcion = porciones > 0 ? costoTotal / porciones : 0;
  const precioSugerido = pctVenta > 0
    ? costoXPorcion * (1 + pctVenta / 100)
    : 0;

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    // Validaciones
    if (items.length === 0) {
      setError('Agregá al menos un ingrediente');
      return;
    }

    // ✅ MEJORA: Validar duplicados antes de guardar
    if (hasDuplicates) {
      setError('Hay ingredientes duplicados. Por favor, eliminá los duplicados antes de guardar.');
      return;
    }

    const sinSupply = items.filter(it => !it.supplyId);
    if (sinSupply.length > 0) {
      setError(`Hay ${sinSupply.length} ingrediente(s) sin insumo asignado`);
      return;
    }

    const payload = {
      nombre: nombre || artNombre, // ✅ Usar nombre del artículo si está vacío
      descripcion: '',
      porciones: Math.max(1, porciones),
      porcentajeVenta: Math.max(0, Math.min(99, pctVenta)),
      items: items.map(it => ({
        supplyId: it.supplyId,
        cantidad: Number(it.cantidad) || 0,
        unidad: it.unidad || 'u',
        costoUnitario: Number(it.costoUnitario) || 0,
      })),
    };

    setSaving(true);
    try {
      const saved = await saveReceta(businessId, articulo.id, payload);
      setReceta(saved);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('Error al guardar:', err);
      setError(err.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="receta-modal-title"
    >
      <Box sx={modalStyle}>
        {/* Header fijo */}
        <Box sx={{
          px: 3, py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'var(--color-primary)',
          color: 'var(--on-primary)',
          flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MenuBookIcon />
            <Box>
              <Typography id="receta-modal-title" variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                Receta
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {artNombre}
                {articulo?.id && (
                  <span style={{ opacity: 0.7, marginLeft: 6 }}>#{articulo.id}</span>
                )}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{ color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}
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
                  helperText={`Por defecto: "${artNombre}"`}
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
                <Badge badgeContent={items.length} color="primary">
                  <Typography variant="caption" color="text.secondary" sx={{ pr: 2 }}>
                    Ingredientes
                  </Typography>
                </Badge>
              </Divider>

              {/* ✅ MEJORA: Alerta de duplicados */}
              {hasDuplicates && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight={600}>
                    ⚠️ Hay ingredientes duplicados
                  </Typography>
                  <Typography variant="caption">
                    Por favor, eliminá los ingredientes marcados en rojo antes de guardar la receta.
                  </Typography>
                </Alert>
              )}

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
                      usedSupplyIds={usedSupplyIds}
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
                variant="outlined"
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
              {success && <Alert severity="success" sx={{ mb: 2 }}>¡Receta guardada correctamente!</Alert>}
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
            disabled={saving || loading || hasDuplicates}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <MenuBookIcon />}
            sx={{
              bgcolor: 'var(--color-primary)',
              color: 'var(--on-primary)',
            }}
          >
            {saving ? 'Guardando...' : receta ? 'Actualizar receta' : 'Crear receta'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}