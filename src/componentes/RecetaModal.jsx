/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Divider, Chip, Tooltip,
  InputAdornment, Select, MenuItem, FormControl,
  Checkbox, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SaveIcon from '@mui/icons-material/Save';

import { getReceta, saveReceta } from '@/servicios/apiOrganizations';
import { insumosList } from '@/servicios/apiInsumos';
import { BASE } from '@/servicios/apiBase';

/* ── constantes ── */
const UNIDADES = ['gr', 'kg', 'ml', 'lt', 'u', 'oz', 'cc', 'taza', 'cdita', 'cda'];
const TIPO_COSTO_OPTS = [
  { value: 'total', label: 'Total' },
  { value: 'nulo', label: 'Nulo' },
  { value: 'al_costo', label: 'Al costo' },
  { value: 'sugerido', label: 'Precio sugerido' },
];

const PRIMARY = 'var(--color-primary, #3b82f6)';
const ON_PRIMARY = 'var(--on-primary, #fff)';

const fmt = (v, d = 2) => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (s) => {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d)) return null;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return null; }
};

/* ── helpers de costo por item ── */
// calcCostoItem eliminado — ahora usa calcPrecioEnUnidad directamente

// Normaliza unidades a minúsculas sin espacios (la DB puede traer "KG", "GR", "U", etc.)
function normUnit(u) {
  return String(u || 'u').toLowerCase().trim();
}

// Normaliza abreviaciones de MaxiRest a la forma canónica usada en UNIDADES[]
// K→kg, G→gr, L→lt, U→u, etc.
const MAXI_UNIT_MAP = { k: 'kg', g: 'gr', l: 'lt', cc: 'ml' };
function canonicalUnit(u) {
  const n = normUnit(u);
  return MAXI_UNIT_MAP[n] || n;
}

// Factores base en "unidad mínima" por tipo:
//   Peso: gr=1, kg=1000, oz=28.35, lb=453.59
//   Volumen: ml=1, cc=1, lt=1000, l=1000, oz_vol=29.57
//   Unidad: u=1
function getConversionFactor(from, to) {
  const n = normUnit;
  // Aliases de MaxiRest: K=kg, G=gr, L=litro
  const PESO = { gr: 1, gramo: 1, gramos: 1, g: 1, k: 1000, kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, oz: 28.35, onza: 28.35, lb: 453.59 };
  const VOLUM = { ml: 1, cc: 1, lt: 1000, l: 1000, litro: 1000, litros: 1000, 'oz fl': 29.57 };
  const UNIDAD = { u: 1, un: 1, unidad: 1, unidades: 1, und: 1, doc: 12, docena: 12, k: null, kg: null }; // k/kg en UNIDAD es inválido

  const f = n(from);
  const t = n(to);

  // Misma unidad → factor 1
  if (f === t) return 1;

  // Peso → Peso
  if (PESO[f] !== undefined && PESO[t] !== undefined) {
    return PESO[f] / PESO[t]; // factor: cuántas unidades destino hay en 1 unidad origen
  }
  // Volumen → Volumen
  if (VOLUM[f] !== undefined && VOLUM[t] !== undefined) {
    return VOLUM[f] / VOLUM[t];
  }
  // Sin conversión válida (ej: kg → ml) → factor 1 (no converge)
  return 1;
}

// Detecta si dos unidades son compatibles (misma dimensión: peso, volumen o unidad)
function isCompatibleUnits(a, b) {
  const PESO  = new Set(['gr','gramo','gramos','g','k','kg','kilo','kilos','kilogramo','oz','onza','lb']);
  const VOLUM = new Set(['ml','cc','lt','l','litro','litros']);
  const UNID  = new Set(['u','un','unidad','unidades','und','doc','docena']);
  const na = normUnit(a), nb = normUnit(b);
  if (na === nb) return true;
  if (PESO.has(na)  && PESO.has(nb))  return true;
  if (VOLUM.has(na) && VOLUM.has(nb)) return true;
  if (UNID.has(na)  && UNID.has(nb))  return true;
  return false;
}

// Calcula el precio por unidad de medida elegida a partir del precio_ref de la DB
// precio_ref está expresado en la unidad base del insumo (unidad_med)
function calcPrecioEnUnidad(precioRefDB, unidadDB, unidadElegida) {
  const pRef = Number(precioRefDB) || 0;
  if (!pRef) return 0;
  const factor = getConversionFactor(normUnit(unidadDB), normUnit(unidadElegida));
  // factor = unidades de unidadDB por cada unidad de unidadElegida
  // Si DB es kg ($1000/kg) y elegís gr: factor = 1000/1 = 1000 → precio por gr = 1000/1000 = $1
  return factor > 0 ? pRef / factor : pRef;
}

/* ── colores de alerta de última compra ── */
function getAlertaColor(ultimaCompra, alertaSemanas) {
  // Sin compras registradas → siempre alerta
  if (!ultimaCompra) return alertaSemanas ? '#fef2f2' : null;
  const d = new Date(ultimaCompra);
  if (isNaN(d)) return alertaSemanas ? '#fef2f2' : null;
  const semanas = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 7);
  return semanas > Number(alertaSemanas) ? '#fef2f2' : null;
}

/* ════════════════════════════════════════
   MODAL ÚLTIMAS 5 COMPRAS DE UN INSUMO
════════════════════════════════════════ */
function UltimasComprasModal({ item, businessId, onClose, insumos = [] }) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item?.supplyId || !businessId) return;
    setLoading(true);
    const token = localStorage.getItem('token') || '';
    fetch(`${BASE}/purchases?insumo_id=${item.supplyId}&limit=5&page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Business-Id': String(businessId),
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .catch(() => ({}))
      .then(d => setCompras(Array.isArray(d?.data) ? d.data.slice(0, 5) : []))
      .finally(() => setLoading(false));
  }, [item?.supplyId, businessId]);

  // Buscar el insumo en la lista para obtener precio y unidad actualizados
  const insumoData = insumos.find(i => String(i.id) === String(item?.supplyId));
  // Prioridad: precioRefDB del item (ya procesado al seleccionar) → precio_ref de DB → fallbacks
  const precioRef = Number(item?.precioRefDB)
    || Number(insumoData?.precio_ref)
    || Number(insumoData?.precio_promedio_periodo)
    || Number(insumoData?.precio_promedio)
    || Number(insumoData?.precio_ultima_compra)
    || Number(insumoData?.precio)
    || 0;
  // Normalizar la unidad de la DB (MaxiRest puede traer K, G, L, etc.)
  const unidadDB = canonicalUnit(insumoData?.unidad_med || insumoData?.medida || item?.supplyMedida || 'u');
  const precioUltCompra = Number(insumoData?.precio_ultima_compra) || 0;
  // Unidad elegida en la receta, normalizada
  const unidadReceta = canonicalUnit(item?.unidad || unidadDB);

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 560 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{
          px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ReceiptLongIcon fontSize="small" />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Últimas compras</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{item?.supplyNombre}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Info precio actual */}
        <Box sx={{
          px: 2.5, py: 1.25, bgcolor: `${PRIMARY}10`,
          borderBottom: '1px solid', borderColor: 'divider',
          display: 'flex', gap: 3, flexWrap: 'wrap'
        }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Precio en DB</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY }}>
              ${fmt(precioRef)} / {unidadDB}
            </Typography>
          </Box>
          {precioUltCompra > 0 && precioUltCompra !== precioRef && (
            <Box>
              <Typography variant="caption" color="text.secondary">Última compra</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a' }}>
                ${fmt(precioUltCompra)} / {unidadDB}
              </Typography>
            </Box>
          )}
          {unidadReceta !== unidadDB && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Convertido a {unidadReceta}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY }}>
                ${fmt(calcPrecioEnUnidad(precioRef, unidadDB, unidadReceta))} / {unidadReceta}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Tabla de compras */}
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Stack alignItems="center" py={3}>
              <CircularProgress size={24} />
            </Stack>
          ) : compras.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              Sin compras registradas para este insumo.
            </Typography>
          ) : (
            <Box>
              {/* Header tabla */}
              <Box sx={{
                display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px',
                gap: 1, px: 1, mb: 0.5
              }}>
                {['Fecha', 'Proveedor', 'Cantidad', 'Precio/u'].map(h => (
                  <Typography key={h} variant="caption" fontWeight={700}
                    color="text.secondary" sx={{
                      fontSize: '0.68rem',
                      textAlign: h === 'Cantidad' || h === 'Precio/u' ? 'right' : 'left'
                    }}>{h}</Typography>
                ))}
              </Box>
              {compras.map((c, i) => (
                <Box key={i} sx={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px',
                  gap: 1, px: 1, py: 0.75, borderRadius: 1,
                  bgcolor: i === 0 ? `${PRIMARY}08` : 'transparent',
                  border: i === 0 ? `1px solid ${PRIMARY}25` : '1px solid transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}>
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    {fmtDate(c.fecha) || '—'}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {c.proveedor_nombre || '—'}
                  </Typography>
                  {/* Cantidad + unidad juntas en la misma celda */}
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                      {fmt(c.cantidad, 2)}
                    </Typography>
                    {unidadDB && (
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                        {unidadDB}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" fontWeight={700}
                    sx={{ fontSize: '0.75rem', textAlign: 'right', color: PRIMARY }}>
                    ${fmt(c.precio)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{
          px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider',
          display: 'flex', justifyContent: 'flex-end'
        }}>
          <Button size="small" onClick={onClose}
            sx={{ color: PRIMARY, borderColor: PRIMARY }} variant="outlined">
            Cerrar
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

/* ════════════════════════════════════════
   FILA DE INGREDIENTE
════════════════════════════════════════ */
function ItemRow({
  item, index, onChange, onRemove, onOpenCompras,
  insumos, usedSupplyIds, alertaSemanas,
  autoOpenSearch,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const cantidadRef = useRef(null);

  // ✅ Abrir buscador automáticamente al agregar ingrediente
  useEffect(() => {
    if (autoOpenSearch) {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const insumoSel = useMemo(
    () => insumos.find(i => String(i.id) === String(item.supplyId)),
    [insumos, item.supplyId]
  );

  const isDuplicate = item.supplyId &&
    usedSupplyIds.has(String(item.supplyId)) &&
    usedSupplyIds.get(String(item.supplyId)) !== index;

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? insumos.filter(i =>
        i.nombre?.toLowerCase().includes(q) ||
        String(i.id).includes(q) ||
        String(i.codigo_maxi || '').includes(q)
      )
      : insumos;
    return list.slice(0, 20);
  }, [insumos, search]);

  const selectInsumo = useCallback((ins) => {
    const unidadDB = canonicalUnit(ins.unidad_med || ins.medida || 'u');
    // Misma cadena de fallback que InsumosTable: precio_ref → precio_promedio → precio_ultima_compra → precio
    const precioRef = Number(ins.precio_ref)
      || Number(ins.precio_promedio_periodo)
      || Number(ins.precio_promedio)
      || Number(ins.precio_ultima_compra)
      || Number(ins.precio_ultimo)
      || Number(ins.precio)
      || 0;
    onChange(index, {
      supplyId: ins.id,
      supplyNombre: ins.nombre,
      supplyMedida: unidadDB,
      precioRefDB: precioRef,
      codigoMaxi: ins.codigo_maxi || ins.codigo_mostrar || '',
      unidad: unidadDB,
      ultimaCompra: ins.fecha_ultima_compra
        ? { precio: ins.precio_ultima_compra, fecha: ins.fecha_ultima_compra }
        : null,
    });
    setSearchOpen(false);
    setSearch('');
    setTimeout(() => cantidadRef.current?.focus(), 50);
  }, [index, onChange]);

  // $/u base = precio_ref de la DB convertido a la unidad elegida
  const costoEnUnidadElegida = useMemo(() => {
    const precioRef = Number(item.precioRefDB) || 0;
    const unidadDB = canonicalUnit(item.supplyMedida || 'u');
    const unidadElegida = canonicalUnit(item.unidad || unidadDB);
    return calcPrecioEnUnidad(precioRef, unidadDB, unidadElegida);
  }, [item.precioRefDB, item.supplyMedida, item.unidad]);

  // $ total = cantidad × precio de DB convertido
  const costoLinea = useMemo(() => {
    const cant = Number(item.cantidad) || 0;
    return cant * costoEnUnidadElegida;
  }, [item.cantidad, costoEnUnidadElegida]);

  const precioEfectivo = costoEnUnidadElegida; // siempre el de DB

  // Detectar si la unidad elegida es incompatible con la del insumo
  const unidadIncompatible = useMemo(() => {
    if (!item.supplyId || !item.supplyMedida || !item.unidad) return false;
    return !isCompatibleUnits(item.supplyMedida, item.unidad);
  }, [item.supplyId, item.supplyMedida, item.unidad]);

  const alertaBg = useMemo(
    () => getAlertaColor(item.ultimaCompra?.fecha || item.ultimaCompra, alertaSemanas),
    [item.ultimaCompra, alertaSemanas]
  );

  const tipoCosto = item.tipoCosto || 'total';
  const costoEfectivoLinea = tipoCosto === 'nulo' ? 0 : costoLinea;

  return (
    <Box
      sx={{
        width: '90%',
        display: 'grid',
        gridTemplateColumns: '20px 1.6fr 68px 66px 66px 76px 76px 36px 36px 88px 1fr 70px 28px',
        alignItems: 'center',
        gap: '4px',
        py: 0.5,
        px: 0.5,
        borderRadius: 1,
        bgcolor: alertaBg || 'transparent',
        border: alertaBg ? '1px solid #fecaca' : '1px solid transparent',
        transition: 'background 0.2s',
        '&:hover': { bgcolor: alertaBg || 'action.hover' },
        position: 'relative',
        ...(isDuplicate && { bgcolor: '#fef2f2', border: '1px solid #fecaca' }),
      }}
    >
      {/* drag */}
      <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 16, cursor: 'grab' }} />

      {/* ── Selector insumo ── */}
      <Box sx={{ position: 'relative' }}>
        <Box
          onClick={() => { setSearchOpen(v => !v); }}
          sx={{
            border: '1px solid',
            borderColor: isDuplicate ? 'error.main' : item.supplyId ? 'success.light' : 'warning.main',
            borderRadius: 1, px: 0.75, py: 0.4, cursor: 'pointer',
            minHeight: 30, display: 'flex', alignItems: 'center',
            bgcolor: 'background.paper',
            '&:hover': { borderColor: PRIMARY },
          }}
        >
          {item.supplyId ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
              {alertaBg
                ? <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444', flexShrink: 0 }} />
                : <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />
              }
              {/* Nombre — clickeable para ver compras */}
              <Typography
                variant="caption"
                noWrap
                sx={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (onOpenCompras && item.supplyId) onOpenCompras(item); }}
                title="Click para ver compras"
              >
                {item.supplyNombre || `#${item.supplyId}`}
              </Typography>
              {/* Código Maxirest del insumo */}
              {item.codigoMaxi && (
                <Typography variant="caption" sx={{
                  fontSize: '0.65rem', color: 'text.disabled', flexShrink: 0,
                }}>
                  {item.codigoMaxi}
                </Typography>
              )}
              {/* Unidad predefinida del insumo */}
              {item.supplyMedida && (
                <Chip
                  label={item.supplyMedida}
                  size="small"
                  sx={{
                    height: 16, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: `${PRIMARY}18`, color: PRIMARY, border: 'none'
                  }}
                />
              )}
              {/* Precio de DB convertido a la unidad elegida */}
              {costoEnUnidadElegida > 0 && (
                <Chip
                  label={`$${fmt(costoEnUnidadElegida)}/${item.unidad || item.supplyMedida || 'u'}`}
                  size="small"
                  sx={{
                    height: 16, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: unidadIncompatible ? '#fef3c720' : `${PRIMARY}18`,
                    color:  unidadIncompatible ? '#d97706'   : PRIMARY,
                    border: unidadIncompatible ? '1px solid #fbbf24' : 'none',
                  }}
                  title={unidadIncompatible
                    ? `⚠️ Unidad incompatible: el insumo está en "${item.supplyMedida}" y elegiste "${item.unidad}". El precio no se puede convertir automáticamente.`
                    : `Precio de DB: $${fmt(item.precioRefDB || 0)}/${item.supplyMedida || 'u'}`
                  }
                />
              )}
              {/* Advertencia de incompatibilidad */}
              {unidadIncompatible && (
                <Tooltip title={`Unidad incompatible: el insumo está en "${item.supplyMedida}". Usá la misma dimensión (ej: si el insumo es por unidad, usá "u"; si es por litro, usá "ml" o "lt").`}>
                  <WarningAmberIcon sx={{ fontSize: 13, color: '#d97706', flexShrink: 0 }} />
                </Tooltip>
              )}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }}>
              Seleccioná insumo…
            </Typography>
          )}
        </Box>

        {/* Dropdown búsqueda */}
        {searchOpen && (
          <Box sx={{
            position: 'absolute', top: '100%', left: 0, zIndex: 20,
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
            borderRadius: 1.5, boxShadow: 6, minWidth: 340, mt: 0.5,
          }}>
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                autoFocus
                inputRef={searchInputRef}
                size="small" fullWidth
                placeholder="Código o nombre…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                onKeyDown={e => {
                  if (e.key === 'Escape') setSearchOpen(false);
                  if (e.key === 'Enter' && filtrados.length === 1) selectInsumo(filtrados[0]);
                }}
              />
            </Box>
            <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {filtrados.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Sin resultados</Typography>
                </Box>
              ) : filtrados.map(ins => {
                const yaUsado = usedSupplyIds.has(String(ins.id));
                return (
                  <Box key={ins.id} onClick={() => selectInsumo(ins)} sx={{
                    px: 1.5, py: 0.75, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid', borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.selected' },
                    ...(yaUsado && { opacity: 0.6 }),
                  }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                        {ins.nombre}
                        {yaUsado && <Chip label="Ya usado" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {ins.codigo_maxi || ins.codigo_mostrar
                          ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}`
                          : ins.unidad_med || ins.medida || 'u'
                        }
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY, fontSize: '0.8rem', flexShrink: 0, ml: 1 }}>
                      {(() => {
                        const p = Number(ins.precio_ref)
                          || Number(ins.precio_promedio_periodo)
                          || Number(ins.precio_promedio)
                          || Number(ins.precio_ultima_compra)
                          || Number(ins.precio)
                          || 0;
                        return p > 0 ? `$${fmt(p)}` : '';
                      })()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Cantidad ── */}
      <TextField
        inputRef={cantidadRef}
        size="small" type="number"
        value={item.cantidad || ''}
        onChange={e => onChange(index, { cantidad: e.target.value === '' ? '' : Number(e.target.value) })}
        placeholder="0"
        inputProps={{ min: 0, step: 0.001, style: { textAlign: 'right', fontSize: '0.78rem', padding: '4px 6px' } }}
        onKeyDown={e => {
          if (e.key === 'Tab') { /* tabulación natural */ }
        }}
      />

      {/* ── Unidad (desplegable) — incluye la del insumo aunque no esté en UNIDADES ── */}
      <Select
        size="small"
        value={item.unidad || item.supplyMedida || 'u'}
        onChange={e => {
          // Solo cambiar la unidad; $/u se recalcula automáticamente desde precioRefDB
          onChange(index, { unidad: e.target.value });
        }}
        sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.75rem' } }}
      >
        {/* ✅ Incluir la unidad del insumo si no está en la lista fija */}
        {[
          ...UNIDADES,
          ...(item.supplyMedida && !UNIDADES.includes(item.supplyMedida) ? [item.supplyMedida] : []),
        ].map(u => (
          <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem', fontWeight: u === item.supplyMedida ? 700 : 400 }}>
            {u === item.supplyMedida ? `${u} ✓` : u}
          </MenuItem>
        ))}
      </Select>

      {/* ── $/u: precio de DB convertido — estático, click en ícono = ver compras ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px',
        border: '1px solid', borderColor: 'divider', borderRadius: 1,
        px: 0.75, minHeight: 30, bgcolor: '#f8fafc',
      }}>
        <Typography sx={{
          fontSize: '0.75rem', fontWeight: 700,
          color: costoEnUnidadElegida > 0 ? PRIMARY : 'text.disabled',
          flex: 1, textAlign: 'right',
        }}>
          {item.supplyId
            ? (costoEnUnidadElegida > 0 ? `$${fmt(costoEnUnidadElegida)}` : '—')
            : '—'
          }
        </Typography>

      </Box>
      <Box>
        {item.supplyId && (
          <Tooltip title="Ver últimas compras">
            <IconButton
              size="small"
              onClick={() => onOpenCompras && onOpenCompras(item)}
              sx={{ p: '2px', color: `${PRIMARY}70`, '&:hover': { color: PRIMARY }, flexShrink: 0 }}
            >
              <ReceiptLongIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {/* ── $ por cantidad (costo línea) ── */}
      <Box sx={{ textAlign: 'right', px: 0.5 }}>
        <Typography variant="caption" sx={{
          fontSize: '0.78rem', fontWeight: 700,
          color: tipoCosto === 'nulo' ? 'text.disabled' : PRIMARY,
          textDecoration: tipoCosto === 'nulo' ? 'line-through' : 'none',
        }}>
          ${fmt(costoEfectivoLinea)}
        </Typography>
      </Box>

      {/* ── Merma ── */}
      <Tooltip title="Aplicar merma">
        <Checkbox
          size="small"
          checked={item.merma !== false}
          onChange={e => onChange(index, { merma: e.target.checked })}
          sx={{ p: 0.25, color: PRIMARY, '&.Mui-checked': { color: PRIMARY } }}
        />
      </Tooltip>

      {/* ── Pedido ── */}
      <Tooltip title="Incluir en pedido">
        <Checkbox
          size="small"
          checked={item.pedido !== false}
          onChange={e => onChange(index, { pedido: e.target.checked })}
          sx={{ p: 0.25, color: PRIMARY, '&.Mui-checked': { color: PRIMARY } }}
        />
      </Tooltip>

      {/* ── Tipo de costo ── */}
      <Select
        size="small"
        value={tipoCosto}
        onChange={e => onChange(index, { tipoCosto: e.target.value })}
        sx={{ fontSize: '0.7rem', '& .MuiSelect-select': { py: '3px', fontSize: '0.7rem' } }}
      >
        {TIPO_COSTO_OPTS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.78rem' }}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* ── Observaciones ── */}
      <TextField
        size="small"
        value={item.observaciones || ''}
        onChange={e => onChange(index, { observaciones: e.target.value, updatedAt: new Date().toISOString() })}
        placeholder="Notas…"
        inputProps={{ style: { fontSize: '0.72rem', padding: '4px 6px' } }}
      />

      {/* ── Fecha última modificación ── */}
      <Tooltip title={item.updatedAt ? `Modificado: ${fmtDate(item.updatedAt)}` : 'Sin modificaciones'}>
        <Box sx={{
          textAlign: 'center', cursor: 'default',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <HistoryIcon sx={{ fontSize: 13, color: item.updatedAt ? PRIMARY : 'text.disabled' }} />
          {item.updatedAt && (
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.1 }}>
              {fmtDate(item.updatedAt)}
            </Typography>
          )}
        </Box>
      </Tooltip>

      {/* ── Eliminar ── */}
      <Tooltip title="Eliminar">
        <IconButton size="small" onClick={() => onRemove(index)}
          sx={{ color: 'error.main', opacity: 0.5, p: 0.25, '&:hover': { opacity: 1 } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/* ════════════════════════════════════════
   MODAL PRINCIPAL
════════════════════════════════════════ */
export default function RecetaModal({ open, onClose, articulo, businessId, onSaved }) {
  const [receta, setReceta] = useState(null);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [pctCostoIdeal, setPctCostoIdeal] = useState(30);
  const [items, setItems] = useState([]);
  const [newItemIndex, setNewItemIndex] = useState(null); // ✅ índice del ítem recién agregado
  const [insumos, setInsumos] = useState([]);
  const [alertaSemanas, setAlertaSemanas] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Modal de compras del insumo (inline, no el ComprasMiniDetalleModal)
  const [comprasInsumo, setComprasInsumo] = useState(null);

  const artNombre = articulo?.nombre || '';
  const precioActual = Number(articulo?.precio || 0);

  /* ── Cargar config del negocio (alerta semanas y % costo ideal) ── */
  useEffect(() => {
    if (!open || !businessId) return;
    (async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${BASE}/businesses/${businessId}/config`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        const d = await res.json().catch(() => ({}));
        if (d?.config?.compras_alerta_semanas) setAlertaSemanas(Number(d.config.compras_alerta_semanas));
        if (d?.config?.articulos_costo_ideal) setPctCostoIdeal(Number(d.config.articulos_costo_ideal));
      } catch { /* ignorar */ }
    })();
  }, [open, businessId]);

  /* ── Cargar insumos ── */
  useEffect(() => {
    if (!open || !businessId) return;
    setInsumosLoading(true);
    insumosList(businessId, { limit: 99999 })
      .then(resp => {
        const lista = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp?.insumos) ? resp.insumos : [];
        setInsumos(lista);
      })
      .catch(() => setError('No se pudieron cargar los insumos'))
      .finally(() => setInsumosLoading(false));
  }, [open, businessId]);

  /* ── Cargar receta existente ── */
  useEffect(() => {
    if (!open || !businessId || !articulo?.id) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    getReceta(businessId, articulo.id)
      .then(rec => {
        setReceta(rec);
        if (rec) {
          setNombre(rec.nombre || artNombre);
          setRendimiento(rec.porciones || rec.rendimiento || 1);
          setPctCostoIdeal(prev => rec.porcentaje_venta ?? prev);
          setItems((rec.items || []).map(it => {
            // supply_medida viene de la DB en la unidad nativa del insumo (ej: 'K')
            // la normalizamos para que la conversión funcione correctamente
            const supplyMedidaRaw = it.supply_medida || it.unidad || 'u';
            const supplyMedida = canonicalUnit(supplyMedidaRaw);
            const unidad       = canonicalUnit(it.unidad || supplyMedidaRaw);
            return {
              supplyId:      it.supply_id,
              supplyNombre:  it.supply_nombre,
              supplyMedida,
              // precio_ref_db = precio del insumo en su unidad nativa (el backend ya lo renombró)
              // costo_unitario es el precio ya convertido a la unidad del item (fallback)
              precioRefDB: Number(it.precio_ref_db) || Number(it.supply_precio_base) || 0,
              codigoMaxi:    it.codigo_maxi_insumo || it.codigo_maxi || '',
              cantidad:      Number(it.cantidad || 0),
              unidad,
              ultimaCompra:  it.ultima_compra || null,  // se enrichece después con datos frescos de insumos
              merma:         it.merma !== false,
              pedido:        it.pedido !== false,
              tipoCosto:     it.tipo_costo || 'total',
              observaciones: it.observaciones || '',
              updatedAt:     it.updated_at || it.updatedAt || null,
            };
          }));
        } else {
          setNombre(artNombre);
          setRendimiento(1);
          setItems([]);
        }
      })
      .catch(() => setError('No se pudo cargar la receta'))
      .finally(() => setLoading(false));
  }, [open, businessId, articulo?.id]);

  // ── Enriquecer items con fecha_ultima_compra desde el array insumos fresco ──
  // Cuando se carga una receta existente, los items no traen la fecha de última compra.
  // Una vez que insumos se carga, la inyectamos para que la alerta funcione.
  useEffect(() => {
    if (!insumos.length) return;
    setItems(prev => prev.map(it => {
      if (!it.supplyId) return it;
      const ins = insumos.find(i => String(i.id) === String(it.supplyId));
      if (!ins) return it;
      return {
        ...it,
        ultimaCompra: ins.fecha_ultima_compra
          ? { precio: ins.precio_ultima_compra, fecha: ins.fecha_ultima_compra }
          : it.ultimaCompra,
        // También actualizar precioRefDB con el precio fresco
        precioRefDB: Number(ins.precio_ref) || it.precioRefDB || 0,
      };
    }));
  }, [insumos]);

  /* ── usedSupplyIds ── */
  const usedSupplyIds = useMemo(() =>
    new Map(items.map((it, idx) => [String(it.supplyId), idx]).filter(([id]) => id !== 'undefined' && id !== 'null')),
    [items]
  );

  const hasDuplicates = useMemo(() =>
    items.some((it, i) => it.supplyId && items.findIndex(x => String(x.supplyId) === String(it.supplyId)) !== i),
    [items]
  );

  const changeItem = useCallback((idx, partial) => {
    setItems(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], ...partial };
      return arr;
    });
  }, []);

  const removeItem = useCallback((idx) => setItems(prev => prev.filter((_, i) => i !== idx)), []);

  const addItem = useCallback(() => {
    setItems(prev => {
      const next = [...prev, {
        supplyId: null, supplyNombre: '', supplyMedida: 'u',
        cantidad: '', unidad: 'u', costoUnitario: '',
        merma: true, pedido: true, tipoCosto: 'total',
        ultimaCompra: null, observaciones: '', updatedAt: null,
      }];
      setNewItemIndex(next.length - 1); // ✅ marcar el último como nuevo
      return next;
    });
  }, []);

  /* ── Cálculos ── */
  const costoTotal = useMemo(() =>
    items.reduce((acc, it) => {
      if (it.tipoCosto === 'nulo') return acc;
      const cant = Number(it.cantidad) || 0;
      const precio = calcPrecioEnUnidad(
        Number(it.precioRefDB) || 0,
        it.supplyMedida || 'u',
        it.unidad || it.supplyMedida || 'u'
      );
      return acc + cant * precio;
    }, 0),
    [items]
  );

  const costoXRendimiento = rendimiento > 0 ? costoTotal / rendimiento : 0;

  // Precio sugerido = Costo / (% costo ideal / 100)
  // Ej: costo $100, % ideal 30 → sugerido = 100 / 0.30 = $333
  const precioSugerido = pctCostoIdeal > 0
    ? costoXRendimiento / (pctCostoIdeal / 100)
    : 0;

  // % costo actual = costo / precio actual * 100
  const pctCostoActual = precioActual > 0
    ? (costoXRendimiento / precioActual) * 100
    : null;

  const estaPorDebajo = precioActual > 0 && precioSugerido > 0 && precioActual < precioSugerido;

  /* ── Guardar ── */
  const handleSave = async () => {
    setError('');
    if (items.length === 0) { setError('Agregá al menos un ingrediente'); return; }
    if (hasDuplicates) { setError('Hay ingredientes duplicados'); return; }
    const sinSupply = items.filter(it => !it.supplyId);
    if (sinSupply.length) { setError(`${sinSupply.length} ingrediente(s) sin insumo asignado`); return; }

    const payload = {
      nombre: nombre || artNombre,
      porciones: Math.max(1, Number(rendimiento) || 1),
      porcentajeVenta: pctCostoIdeal,
      items: items.map(it => ({
        supplyId: it.supplyId,
        cantidad: Number(it.cantidad) || 0,
        unidad: it.unidad || 'u',
        precioRefDb: Number(it.precioRefDB) || 0,
        costoUnitario: calcPrecioEnUnidad(
          Number(it.precioRefDB) || 0,
          it.supplyMedida || 'u',
          it.unidad || it.supplyMedida || 'u'
        ),
        merma: it.merma !== false,
        pedido: it.pedido !== false,
        tipoCosto: it.tipoCosto || 'total',
        observaciones: it.observaciones || '',
        updatedAt: it.updatedAt || new Date().toISOString(),
      })),
    };

    setSaving(true);
    try {
      const saved = await saveReceta(businessId, articulo.id, payload);
      setReceta(saved);
      setSuccess(true);
      onSaved?.(saved);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '99vw', sm: '98vw', md: '1100px' },
        maxWidth: '1200px',
        maxHeight: '94vh',
        bgcolor: 'background.paper',
        borderRadius: 2, boxShadow: 24,
        display: 'flex', flexDirection: 'column', outline: 'none', overflow: 'hidden',
      }}>

        {/* ── HEADER ── */}
        <Box sx={{
          px: 3, py: 1.5,
          bgcolor: PRIMARY, color: ON_PRIMARY,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <MenuBookIcon />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
                Receta — {artNombre}
              </Typography>
              {articulo?.id && (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>#{articulo.id}</Typography>
              )}
            </Box>
          </Stack>
          <IconButton onClick={() => !saving && onClose()} size="small" sx={{ color: 'inherit' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* ── BODY ── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* ── Datos generales ── */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '2fr 80px 100px' },
                gap: 1.5, mb: 2,
              }}>
                <TextField
                  label="Nombre de la receta"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  size="small"
                  placeholder={artNombre}
                />
                <TextField
                  label="Rendimiento"
                  type="number"
                  value={rendimiento}
                  onChange={e => setRendimiento(Math.max(1, Number(e.target.value) || 1))}
                  size="small"
                  inputProps={{ min: 1 }}
                  helperText="porciones"
                />
                <TextField
                  label="Costo Objetivo"
                  type="number"
                  value={pctCostoIdeal}
                  onChange={e => setPctCostoIdeal(Number(e.target.value) || 0)}
                  size="xsmall"
                  inputProps={{ min: 0, max: 150 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                />
              </Box>

              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Ingredientes ({items.length})
                </Typography>
              </Divider>

              {/* ── Header columnas tabla ── */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '20px 1.6fr 68px 66px 76px 76px 36px 36px 88px 1fr 70px 28px',
                gap: '4px', px: 0.5, mb: 0.5,
              }}>
                {[
                  '', 'Insumo', 'Cantidad', 'Unidad', '$/u', '$ total',
                  <Tooltip key="m" title="Merma"><span>Merma</span></Tooltip>,
                  <Tooltip key="p" title="Pedido"><span>Pedido</span></Tooltip>,
                  'Tipo costo', 'Observaciones', 'Modif.', '',
                ].map((col, i) => (
                  <Typography key={i} variant="caption" color="text.secondary"
                    fontWeight={700} sx={{ fontSize: '0.68rem', textAlign: i >= 4 && i < 9 ? 'center' : 'left' }}>
                    {col}
                  </Typography>
                ))}
              </Box>

              {/* ── Items ── */}
              {hasDuplicates && (
                <Alert severity="error" sx={{ mb: 1, py: 0.5 }}>Hay ingredientes duplicados</Alert>
              )}

              {items.length === 0 ? (
                <Box sx={{
                  py: 4, textAlign: 'center',
                  border: '2px dashed', borderColor: 'divider', borderRadius: 1.5, mb: 1.5,
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Sin ingredientes. Hacé click en "Agregar ingrediente".
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ mb: 1.5 }}>
                  {items.map((item, i) => (
                    <ItemRow
                      key={i}
                      item={item}
                      index={i}
                      onChange={(idx, partial) => {
                        changeItem(idx, partial);
                        if (newItemIndex === idx) setNewItemIndex(null);
                      }}
                      onRemove={removeItem}
                      onOpenCompras={(it) => setComprasInsumo(it)}
                      insumos={insumos}
                      usedSupplyIds={usedSupplyIds}
                      alertaSemanas={alertaSemanas}
                      autoOpenSearch={newItemIndex === i}
                    />
                  ))}
                </Box>
              )}

              <Button
                startIcon={insumosLoading ? <CircularProgress size={14} /> : <AddIcon />}
                onClick={addItem}
                size="small"
                disabled={insumosLoading}
                variant="outlined"
                sx={{ mb: 2.5, borderColor: PRIMARY, color: PRIMARY }}
              >
                Agregar ingrediente
              </Button>

              <Divider sx={{ mb: 2 }} />

              {/* ── Panel de costos y precios ── */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1.5, p: 2, mb: 2,
              }}>
                {/* Costo total */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
                  <Typography variant="h6" fontWeight={800}>${fmt(costoTotal)}</Typography>
                </Box>

                {/* Costo x porción */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Costo x porción{rendimiento > 1 ? ` (÷${rendimiento})` : ''}
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>${fmt(costoXRendimiento)}</Typography>
                </Box>

                {/* Precio sugerido */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Precio sugerido ({pctCostoIdeal}% costo)
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">
                    {precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}
                  </Typography>
                  {/* ✅ Precio actual debajo del sugerido */}
                  {precioActual > 0 && (
                    <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: estaPorDebajo ? '#ef4444' : 'text.secondary',
                        }}
                      >
                        Actual: ${fmt(precioActual)}
                      </Typography>
                      {estaPorDebajo && (
                        <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
                      )}
                    </Stack>
                  )}
                </Box>

                {/* % costo actual */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>% Costo actual</Typography>
                  {pctCostoActual !== null ? (
                    <>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        color={pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main'}
                      >
                        {fmt(pctCostoActual, 1)}%
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                        Ideal: {pctCostoIdeal}%
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="h6" color="text.disabled">—</Typography>
                  )}
                </Box>
              </Box>

              {/* ── Modal últimas 5 compras del insumo ── */}
              {comprasInsumo && (
                <UltimasComprasModal
                  item={comprasInsumo}
                  businessId={businessId}
                  onClose={() => setComprasInsumo(null)}
                  insumos={insumos}
                />
              )}

              {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 1.5 }}>¡Receta guardada!</Alert>}
            </>
          )}
        </Box>

        {/* ── FOOTER ── */}
        <Box sx={{
          px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, bgcolor: 'background.paper',
        }}>
          <Typography variant="caption" color="text.secondary">
            {receta ? `Última modificación: ${fmtDate(receta.updated_at) || '—'}` : 'Receta nueva'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => !saving && onClose()} disabled={saving} color="inherit" size="small">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              size="small"
              disabled={saving || loading || hasDuplicates}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}
            >
              {saving ? 'Guardando…' : 'Guardar receta'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}