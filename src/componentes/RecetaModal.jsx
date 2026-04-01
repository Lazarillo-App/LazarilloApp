/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// MEJORAS:
//  1. $/u reactivo al cambiar unidad (ya no es estático)
//  2. Columna "$ total" eliminada del header/grid (era redundante con $/u × cant)
//  3. Modal de notas con foto (archivo / cámara)
//  4. Refresh mejorado post-guardado vía callback onSaved
//  5. Insumos elaborados: tipo_costo "total" → costo receta; "sugerido" → precio venta receta
//  6. Botón borrar receta (con confirmación)
//  7. Vista Cocina (preview de lectura para el personal)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Divider, Chip, Tooltip,
  InputAdornment, Select, MenuItem, FormControl,
  Checkbox, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText,
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
import NotesIcon from '@mui/icons-material/Notes';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ImageIcon from '@mui/icons-material/Image';

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

/* ── helpers de conversión de unidades ── */
function normUnit(u) {
  return String(u || 'u').toLowerCase().trim();
}

const MAXI_UNIT_MAP = { k: 'kg', g: 'gr', l: 'lt', cc: 'ml' };
function canonicalUnit(u) {
  const n = normUnit(u);
  return MAXI_UNIT_MAP[n] || n;
}

function getConversionFactor(from, to) {
  const PESO  = { gr: 1, gramo: 1, gramos: 1, g: 1, k: 1000, kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, oz: 28.35, onza: 28.35, lb: 453.59 };
  const VOLUM = { ml: 1, cc: 1, lt: 1000, l: 1000, litro: 1000, litros: 1000, 'oz fl': 29.57 };
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return 1;
  if (PESO[f]  !== undefined && PESO[t]  !== undefined) return PESO[f]  / PESO[t];
  if (VOLUM[f] !== undefined && VOLUM[t] !== undefined) return VOLUM[f] / VOLUM[t];
  return 1;
}

function isCompatibleUnits(a, b) {
  const PESO  = new Set(['gr','gramo','gramos','g','k','kg','kilo','kilos','kilogramo','oz','onza','lb']);
  const VOLUM = new Set(['ml','cc','lt','l','litro','litros']);
  const UNID  = new Set(['u','un','unidad','unidades','und','doc','docena']);
  const na = normUnit(a), nb = normUnit(b);
  if (na === nb) return true;
  if (PESO.has(na) && PESO.has(nb)) return true;
  if (VOLUM.has(na) && VOLUM.has(nb)) return true;
  if (UNID.has(na) && UNID.has(nb)) return true;
  return false;
}

/**
 * Dado el precio_ref de la DB (expresado en unidadDB),
 * devuelve el precio por cada 1 unidad de unidadElegida.
 * Ej: precioRefDB=$1000/kg, unidadElegida=gr → $1/gr
 */
function calcPrecioEnUnidad(precioRefDB, unidadDB, unidadElegida) {
  const pRef = Number(precioRefDB) || 0;
  if (!pRef) return 0;
  const factor = getConversionFactor(normUnit(unidadDB), normUnit(unidadElegida));
  return factor > 0 ? pRef / factor : pRef;
}

/* ── colores de alerta de última compra ── */
function getAlertaColor(ultimaCompra, alertaSemanas) {
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
      .then(r => r.json()).catch(() => ({}))
      .then(d => setCompras(Array.isArray(d?.data) ? d.data.slice(0, 5) : []))
      .finally(() => setLoading(false));
  }, [item?.supplyId, businessId]);

  const insumoData = insumos.find(i => String(i.id) === String(item?.supplyId));
  const precioRef = Number(item?.precioRefDB)
    || Number(insumoData?.precio_ref)
    || Number(insumoData?.precio_promedio_periodo)
    || Number(insumoData?.precio_promedio)
    || Number(insumoData?.precio_ultima_compra)
    || Number(insumoData?.precio)
    || 0;
  const unidadDB = canonicalUnit(insumoData?.unidad_med || insumoData?.medida || item?.supplyMedida || 'u');
  const precioUltCompra = Number(insumoData?.precio_ultima_compra) || 0;
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
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ReceiptLongIcon fontSize="small" />
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Últimas compras</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{item?.supplyNombre}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ px: 2.5, py: 1.25, bgcolor: `${PRIMARY}10`, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Precio en DB</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY }}>${fmt(precioRef)} / {unidadDB}</Typography>
          </Box>
          {precioUltCompra > 0 && precioUltCompra !== precioRef && (
            <Box>
              <Typography variant="caption" color="text.secondary">Última compra</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a' }}>${fmt(precioUltCompra)} / {unidadDB}</Typography>
            </Box>
          )}
          {unidadReceta !== unidadDB && (
            <Box>
              <Typography variant="caption" color="text.secondary">Convertido a {unidadReceta}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY }}>
                ${fmt(calcPrecioEnUnidad(precioRef, unidadDB, unidadReceta))} / {unidadReceta}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2 }}>
          {loading ? (
            <Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack>
          ) : compras.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              Sin compras registradas para este insumo.
            </Typography>
          ) : (
            <Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px', gap: 1, px: 1, mb: 0.5 }}>
                {['Fecha', 'Proveedor', 'Cantidad', 'Precio/u'].map(h => (
                  <Typography key={h} variant="caption" fontWeight={700} color="text.secondary"
                    sx={{ fontSize: '0.68rem', textAlign: h === 'Cantidad' || h === 'Precio/u' ? 'right' : 'left' }}>{h}</Typography>
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
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{fmtDate(c.fecha) || '—'}</Typography>
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{c.proveedor_nombre || '—'}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>{fmt(c.cantidad, 2)}</Typography>
                    {unidadDB && <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{unidadDB}</Typography>}
                  </Box>
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem', textAlign: 'right', color: PRIMARY }}>
                    ${fmt(c.precio)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onClose} sx={{ color: PRIMARY, borderColor: PRIMARY }} variant="outlined">Cerrar</Button>
        </Box>
      </Box>
    </Modal>
  );
}

/* ════════════════════════════════════════
   MODAL DE NOTAS + FOTO
════════════════════════════════════════ */
function NotasModal({ notas, foto, onSave, onClose }) {
  const [localNotas, setLocalNotas] = useState(notas || '');
  const [localFoto, setLocalFoto] = useState(foto || null); // base64 o URL
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLocalFoto(ev.target.result);
    reader.readAsDataURL(file);
    // reset para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 600 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotesIcon fontSize="small" />
            <Typography variant="subtitle2" fontWeight={700}>Notas e imagen de la receta</Typography>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Área de texto */}
          <TextField
            label="Notas / Instrucciones"
            multiline
            minRows={6}
            maxRows={12}
            fullWidth
            value={localNotas}
            onChange={e => setLocalNotas(e.target.value)}
            placeholder="Ej: Mezclar bien, hornear a 180°, servir frío…"
            inputProps={{ style: { fontSize: '0.9rem', lineHeight: 1.6 } }}
          />

          {/* Foto */}
          {localFoto ? (
            <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <img
                src={localFoto}
                alt="Foto receta"
                style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
              />
              <IconButton
                size="small"
                onClick={() => setLocalFoto(null)}
                sx={{
                  position: 'absolute', top: 6, right: 6,
                  bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{
              border: '2px dashed', borderColor: 'divider', borderRadius: 1.5,
              py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
              bgcolor: 'action.hover',
            }}>
              <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">Adjuntá una foto de la receta</Typography>
              <Stack direction="row" spacing={1}>
                {/* Desde archivo */}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  Desde archivo
                </Button>
                {/* Desde cámara (móvil) */}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => cameraInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  Cámara
                </Button>
              </Stack>
              {/* inputs ocultos */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
            </Box>
          )}
        </Box>

        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
          <Button size="small" variant="contained" onClick={() => { onSave(localNotas, localFoto); onClose(); }}
            sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
            Guardar notas
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

/* ════════════════════════════════════════
   VISTA COCINA (preview de lectura)
════════════════════════════════════════ */
function VistaCocinaModal({ nombre, rendimiento, items, notas, foto, onClose }) {
  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 680 },
        maxHeight: '92vh',
        bgcolor: '#fffdf7',
        borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header cocina */}
        <Box sx={{
          px: 3, py: 2,
          bgcolor: '#1c1917', color: '#fef9c3',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <RestaurantMenuIcon />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1} sx={{ letterSpacing: 0.5 }}>
                {nombre || 'Receta'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Rinde {rendimiento} {rendimiento === 1 ? 'porción' : 'porciones'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip label="Vista Cocina" size="small" sx={{ bgcolor: '#fef9c3', color: '#1c1917', fontWeight: 700, fontSize: '0.7rem' }} />
            <IconButton size="small" onClick={onClose} sx={{ color: '#fef9c3' }}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {/* Foto */}
          {foto && (
            <Box sx={{ mb: 2.5, borderRadius: 1.5, overflow: 'hidden', boxShadow: 2 }}>
              <img src={foto} alt="Foto receta" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            </Box>
          )}

          {/* Ingredientes */}
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
            Ingredientes
          </Typography>
          <Box sx={{ mb: 2.5 }}>
            {items.filter(it => it.supplyId && it.tipoCosto !== 'nulo').map((it, i) => (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                py: 0.75, borderBottom: '1px solid #e7e5e4',
              }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                  {it.supplyNombre || `Insumo #${it.supplyId}`}
                </Typography>
                <Typography variant="body2" sx={{
                  fontWeight: 700, fontSize: '1rem',
                  color: '#1c1917', ml: 2, flexShrink: 0,
                }}>
                  {it.cantidad} {it.unidad || it.supplyMedida || 'u'}
                </Typography>
              </Box>
            ))}
            {items.filter(it => it.supplyId && it.tipoCosto !== 'nulo').length === 0 && (
              <Typography variant="body2" color="text.secondary">Sin ingredientes cargados.</Typography>
            )}
          </Box>

          {/* Notas */}
          {notas && (
            <>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
                Instrucciones
              </Typography>
              <Box sx={{
                bgcolor: '#fef9c3', borderRadius: 1.5, p: 2,
                border: '1px solid #fde68a',
                whiteSpace: 'pre-wrap',
              }}>
                <Typography variant="body2" sx={{ fontSize: '0.92rem', lineHeight: 1.7 }}>{notas}</Typography>
              </Box>
            </>
          )}

          {!notas && (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              Sin instrucciones cargadas.
            </Typography>
          )}
        </Box>

        <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid #e7e5e4', display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onClose} variant="outlined" sx={{ borderColor: '#1c1917', color: '#1c1917' }}>
            Cerrar vista
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

/* ════════════════════════════════════════
   FILA DE INGREDIENTE
════════════════════════════════════════ */
/**
 * recetasElaborados: { [supplyId]: { costoTotal, porciones, precioSugerido } }
 * Permite que cuando un insumo es un "elaborado", el costo se tome de su receta.
 */
function ItemRow({
  item, index, onChange, onRemove, onOpenCompras,
  insumos, usedSupplyIds, alertaSemanas,
  autoOpenSearch, recetasElaborados = {},
  onOpenNotasModal,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const cantidadRef = useRef(null);

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

  // ── Detectar si es insumo elaborado (tiene receta propia) ──
  const elaborado = item.supplyId ? recetasElaborados[String(item.supplyId)] : null;
  const tipoCosto = item.tipoCosto || 'total';

  /**
   * Precio por unidad elegida, considerando:
   * - Si es elaborado Y tipoCosto==='total'     → costo/porcion de su receta
   * - Si es elaborado Y tipoCosto==='sugerido'  → precio sugerido de su receta
   * - En cualquier otro caso                   → calcPrecioEnUnidad desde la DB
   */
  const costoEnUnidadElegida = useMemo(() => {
    if (elaborado) {
      const porciones = Number(elaborado.porciones) || 1;
      if (tipoCosto === 'sugerido' && elaborado.precioSugerido > 0) {
        // precio sugerido de venta del elaborado, por porción
        return elaborado.precioSugerido / porciones;
      }
      if (tipoCosto !== 'nulo' && elaborado.costoTotal > 0) {
        // costo de la receta del elaborado, por porción
        return elaborado.costoTotal / porciones;
      }
    }
    // Insumo normal: precio de DB convertido a la unidad elegida
    const precioRef = Number(item.precioRefDB) || 0;
    const unidadDB = canonicalUnit(item.supplyMedida || 'u');
    const unidadElegida = canonicalUnit(item.unidad || unidadDB);
    return calcPrecioEnUnidad(precioRef, unidadDB, unidadElegida);
  }, [
    elaborado, tipoCosto,
    item.precioRefDB, item.supplyMedida, item.unidad,
  ]);

  // Costo línea (cantidad × $/u efectivo)
  const costoLinea = useMemo(() => {
    const cant = Number(item.cantidad) || 0;
    return cant * costoEnUnidadElegida;
  }, [item.cantidad, costoEnUnidadElegida]);

  const costoEfectivoLinea = tipoCosto === 'nulo' ? 0 : costoLinea;

  // Incompatibilidad de unidades (solo para no-elaborados)
  const unidadIncompatible = useMemo(() => {
    if (!item.supplyId || !item.supplyMedida || !item.unidad || elaborado) return false;
    return !isCompatibleUnits(item.supplyMedida, item.unidad);
  }, [item.supplyId, item.supplyMedida, item.unidad, elaborado]);

  const alertaBg = useMemo(
    () => getAlertaColor(item.ultimaCompra?.fecha || item.ultimaCompra, alertaSemanas),
    [item.ultimaCompra, alertaSemanas]
  );

  return (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        // Columnas: drag | insumo | cantidad | unidad | $/u | merma | pedido | tipo_costo | obs | fecha | del
        gridTemplateColumns: '20px 1.8fr 68px 66px 80px 36px 36px 88px 1fr 56px 28px',
        alignItems: 'center',
        gap: '4px',
        py: 0.5, px: 0.5,
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
          onClick={() => setSearchOpen(v => !v)}
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
              {/* Nombre clickeable → ver compras */}
              <Typography
                variant="caption"
                noWrap
                sx={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (onOpenCompras && item.supplyId) onOpenCompras(item); }}
                title="Click para ver compras"
              >
                {item.supplyNombre || `#${item.supplyId}`}
              </Typography>

              {/* Precio FIJO de DB en la unidad base — no cambia al elegir otra unidad */}
              {item.precioRefDB > 0 && (
                <Chip
                  label={
                    elaborado
                      ? (tipoCosto === 'sugerido' ? 'vta·rec' : 'rec')
                      : `$${fmt(item.precioRefDB)}/${item.supplyMedida || 'u'}`
                  }
                  size="small"
                  sx={{
                    height: 16, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: elaborado ? '#f0fdf4' : `${PRIMARY}18`,
                    color: elaborado ? '#16a34a' : PRIMARY,
                    border: 'none',
                  }}
                  title={
                    elaborado
                      ? `Insumo elaborado — costo de receta`
                      : `Precio de DB: $${fmt(item.precioRefDB)}/${item.supplyMedida || 'u'} (fijo)`
                  }
                />
              )}

              {/* Botón ver compras (solo insumos no elaborados) */}
              {!elaborado && (
                <Tooltip title="Ver últimas compras">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onOpenCompras && onOpenCompras(item); }}
                    sx={{ p: '1px', color: `${PRIMARY}70`, '&:hover': { color: PRIMARY }, flexShrink: 0 }}
                  >
                    <ReceiptLongIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Chip elaborado */}
              {elaborado && (
                <Chip label="Elab." size="small" sx={{
                  height: 16, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                  bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                }} />
              )}
              {/* Incompatibilidad */}
              {unidadIncompatible && (
                <Tooltip title={`Unidad incompatible: el insumo está en "${item.supplyMedida}".`}>
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
                autoFocus inputRef={searchInputRef}
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
                const esElab = !!recetasElaborados[String(ins.id)];
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
                        {esElab && <Chip label="Elaborado" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#f0fdf4', color: '#16a34a' }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {ins.codigo_maxi || ins.codigo_mostrar
                          ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}`
                          : ins.unidad_med || ins.medida || 'u'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY, fontSize: '0.8rem', flexShrink: 0, ml: 1 }}>
                      {(() => {
                        if (esElab) {
                          const eData = recetasElaborados[String(ins.id)];
                          const p = Number(eData.porciones) || 1;
                          return eData.costoTotal > 0 ? `$${fmt(eData.costoTotal / p)}/u` : '';
                        }
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
      />

      {/* ── Unidad ── */}
      <Select
        size="small"
        value={item.unidad || item.supplyMedida || 'u'}
        onChange={e => onChange(index, { unidad: e.target.value })}
        sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.75rem' } }}
      >
        {[
          ...UNIDADES,
          ...(item.supplyMedida && !UNIDADES.includes(item.supplyMedida) ? [item.supplyMedida] : []),
        ].map(u => (
          <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem', fontWeight: u === item.supplyMedida ? 700 : 400 }}>
            {u === item.supplyMedida ? `${u} ✓` : u}
          </MenuItem>
        ))}
      </Select>

      {/* ── $/u reactivo: precio de DB convertido a la unidad elegida ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        border: '1px solid', borderColor: 'divider', borderRadius: 1,
        px: 0.75, minHeight: 30,
        bgcolor: elaborado ? '#f0fdf4' : '#f8fafc',
        overflow: 'hidden',
      }}>
        <Typography sx={{
          fontSize: '0.72rem', fontWeight: 700,
          color: costoEnUnidadElegida > 0
            ? (elaborado ? '#16a34a' : PRIMARY)
            : 'text.disabled',
          whiteSpace: 'nowrap',
        }}
          title={
            elaborado
              ? `De receta elaborada (${tipoCosto === 'sugerido' ? 'precio sugerido' : 'costo'})`
              : `$${fmt(item.precioRefDB || 0)}/${item.supplyMedida || 'u'} → convertido a ${item.unidad || item.supplyMedida || 'u'}`
          }
        >
          {item.supplyId
            ? (costoEnUnidadElegida > 0 ? `$${fmt(costoEnUnidadElegida)}` : '—')
            : '—'
          }
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

      {/* ── Observaciones — click abre modal de notas/foto ── */}
      <Box
        onClick={() => onOpenNotasModal?.()}
        title="Click para editar notas e instrucciones"
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 1,
          px: 0.75, minHeight: 30, display: 'flex', alignItems: 'center',
          cursor: 'pointer', bgcolor: 'background.paper',
          '&:hover': { borderColor: PRIMARY, bgcolor: `${PRIMARY}05` },
          overflow: 'hidden',
        }}
      >
        <Typography noWrap sx={{
          fontSize: '0.72rem',
          color: item.observaciones ? 'text.primary' : 'text.disabled',
          fontStyle: item.observaciones ? 'normal' : 'italic',
          flex: 1,
        }}>
          {item.observaciones || 'Notas…'}
        </Typography>
        {item.observaciones && (
          <NotesIcon sx={{ fontSize: 11, color: PRIMARY, flexShrink: 0, ml: 0.25 }} />
        )}
      </Box>

      {/* ── Fecha última modificación ── */}
      <Tooltip title={item.updatedAt ? `Modificado: ${fmtDate(item.updatedAt)}` : 'Sin modificaciones'}>
        <Box sx={{ textAlign: 'center', cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <HistoryIcon sx={{ fontSize: 13, color: item.updatedAt ? PRIMARY : 'text.disabled' }} />
          {item.updatedAt && (
            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.1 }}>{fmtDate(item.updatedAt)}</Typography>
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
export default function RecetaModal({
  open, onClose, articulo, businessId, onSaved, costoObjetivoExterno,
  // recetasElaborados: mapa de insumos que son elaborados con sus costos de receta
  // { [supplyId]: { costoTotal, porciones, precioSugerido } }
  recetasElaborados = {},
}) {
  const [receta, setReceta] = useState(null);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [pctCostoIdeal, setPctCostoIdeal] = useState(30);
  // Guardamos el global de config para usarlo como último fallback
  const [globalConfigObjetivo, setGlobalConfigObjetivo] = useState(null);
  const [items, setItems] = useState([]);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [alertaSemanas, setAlertaSemanas] = useState(null);

  // Notas y foto de la receta
  const [notas, setNotas] = useState('');
  const [foto, setFoto] = useState(null); // base64 o URL

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sub-modales
  const [comprasInsumo, setComprasInsumo] = useState(null);
  const [notasModalOpen, setNotasModalOpen] = useState(false);
  const [cocinaModalOpen, setCocinaModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const artNombre = articulo?.nombre || '';
  const precioActual = Number(articulo?.precio || 0);

  /**
   * Jerarquía de costo objetivo (de mayor a menor prioridad):
   *  1. costoObjetivoExterno  — viene de la tabla (artículo > rubro > agrupación)
   *  2. rec.porcentaje_venta  — guardado en la receta (solo cuando NO hay externo)
   *  3. globalConfigObjetivo  — config global del negocio
   *  4. 30                    — hardcoded final fallback
   *
   * Regla clave: si el usuario configuró un objetivo en la tabla (externo != null),
   * ese SIEMPRE gana sobre lo que tenga guardado la receta.
   */
  const resolveObjetivo = useCallback((recPct) => {
    if (costoObjetivoExterno != null) return Number(costoObjetivoExterno);
    if (recPct != null) return Number(recPct);
    if (globalConfigObjetivo != null) return Number(globalConfigObjetivo);
    return 30;
  }, [costoObjetivoExterno, globalConfigObjetivo]);

  // Cuando cambia costoObjetivoExterno desde la tabla, actualizar pctCostoIdeal en tiempo real
  useEffect(() => {
    if (!open) return;
    if (costoObjetivoExterno != null) {
      setPctCostoIdeal(Number(costoObjetivoExterno));
    }
  }, [costoObjetivoExterno, open]);

  /* ── Config negocio ── */
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
        if (d?.config?.articulos_costo_ideal) {
          const globalVal = Number(d.config.articulos_costo_ideal);
          setGlobalConfigObjetivo(globalVal);
          // Solo aplicar el global si no hay externo ni receta ya cargada con su propio %
          if (costoObjetivoExterno == null) {
            setPctCostoIdeal(prev => prev === 30 ? globalVal : prev);
          }
        }
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

  /* ── Cargar receta ── */
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
          // resolveObjetivo: externo (tabla) > guardado en receta > global config > 30
          setPctCostoIdeal(resolveObjetivo(rec.porcentaje_venta));
          setNotas(rec.notas || '');
          setFoto(rec.foto || null);
          setItems((rec.items || []).map(it => {
            const supplyMedidaRaw = it.supply_medida || it.unidad || 'u';
            const supplyMedida = canonicalUnit(supplyMedidaRaw);
            const unidad = canonicalUnit(it.unidad || supplyMedidaRaw);
            return {
              supplyId: it.supply_id,
              supplyNombre: it.supply_nombre,
              supplyMedida,
              precioRefDB: Number(it.precio_ref_db) || Number(it.supply_precio_base) || 0,
              codigoMaxi: it.codigo_maxi_insumo || it.codigo_maxi || '',
              cantidad: Number(it.cantidad || 0),
              unidad,
              ultimaCompra: it.ultima_compra || null,
              merma: it.merma !== false,
              pedido: it.pedido !== false,
              tipoCosto: it.tipo_costo || 'total',
              observaciones: it.observaciones || '',
              updatedAt: it.updated_at || it.updatedAt || null,
            };
          }));
        } else {
          setNombre(artNombre);
          setRendimiento(1);
          // Receta nueva: externo > global config > 30
          setPctCostoIdeal(resolveObjetivo(null));
          setNotas('');
          setFoto(null);
          setItems([]);
        }
      })
      .catch(() => setError('No se pudo cargar la receta'))
      .finally(() => setLoading(false));
  }, [open, businessId, articulo?.id]);

  /* ── Enriquecer items con data fresca de insumos ── */
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
      setNewItemIndex(next.length - 1);
      return next;
    });
  }, []);

  /* ── Cálculos ── */
  const costoTotal = useMemo(() =>
    items.reduce((acc, it) => {
      if (it.tipoCosto === 'nulo') return acc;
      const cant = Number(it.cantidad) || 0;
      // Usar la misma lógica que ItemRow para consistencia
      const elaborado = it.supplyId ? recetasElaborados[String(it.supplyId)] : null;
      let precioU;
      if (elaborado) {
        const porciones = Number(elaborado.porciones) || 1;
        if (it.tipoCosto === 'sugerido' && elaborado.precioSugerido > 0) {
          precioU = elaborado.precioSugerido / porciones;
        } else {
          precioU = elaborado.costoTotal > 0 ? elaborado.costoTotal / porciones : 0;
        }
      } else {
        precioU = calcPrecioEnUnidad(
          Number(it.precioRefDB) || 0,
          it.supplyMedida || 'u',
          it.unidad || it.supplyMedida || 'u'
        );
      }
      return acc + cant * precioU;
    }, 0),
    [items, recetasElaborados]
  );

  const costoXRendimiento = rendimiento > 0 ? costoTotal / rendimiento : 0;
  const precioSugerido = pctCostoIdeal > 0 ? costoXRendimiento / (pctCostoIdeal / 100) : 0;
  const pctCostoActual = precioActual > 0 ? (costoXRendimiento / precioActual) * 100 : null;
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
      notas,
      foto, // base64 — el backend debe manejarlo (guardarlo en S3/local y devolver URL)
      items: items.map(it => {
        const elaborado = it.supplyId ? recetasElaborados[String(it.supplyId)] : null;
        const porciones = Number(elaborado?.porciones) || 1;
        let costoUnitario;
        if (elaborado) {
          costoUnitario = it.tipoCosto === 'sugerido' && elaborado.precioSugerido > 0
            ? elaborado.precioSugerido / porciones
            : (elaborado.costoTotal > 0 ? elaborado.costoTotal / porciones : 0);
        } else {
          costoUnitario = calcPrecioEnUnidad(
            Number(it.precioRefDB) || 0,
            it.supplyMedida || 'u',
            it.unidad || it.supplyMedida || 'u'
          );
        }
        return {
          supplyId: it.supplyId,
          cantidad: Number(it.cantidad) || 0,
          unidad: it.unidad || 'u',
          precioRefDb: Number(it.precioRefDB) || 0,
          costoUnitario,
          merma: it.merma !== false,
          pedido: it.pedido !== false,
          tipoCosto: it.tipoCosto || 'total',
          observaciones: it.observaciones || '',
          updatedAt: it.updatedAt || new Date().toISOString(),
        };
      }),
    };

    setSaving(true);
    try {
      const saved = await saveReceta(businessId, articulo.id, payload);
      setReceta(saved);
      setSuccess(true);
      // Notificar al padre con datos completos para refresh inmediato
      onSaved?.({
        ...saved,
        article_id: articulo.id,
        costo_total: costoTotal,
        costo_por_porcion: costoXRendimiento,
        precio_sugerido: precioSugerido,
        porciones: Math.max(1, Number(rendimiento) || 1),
      });
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err.message || 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  /* ── Borrar receta ── */
  const handleDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/organizations/${businessId}/articulos/${articulo.id}/receta`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
        },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Error ${res.status}`);
      }
      // Notificar al padre que la receta fue borrada (costoTotal=0)
      onSaved?.({
        article_id: articulo.id,
        costo_total: 0,
        costo_por_porcion: 0,
        precio_sugerido: 0,
        porciones: 1,
        deleted: true,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al borrar la receta');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={() => !saving && !deleting && onClose()}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '99vw', sm: '98vw', md: '1060px' },
          maxWidth: '1140px',
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
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {/* Vista Cocina */}
              <Tooltip title="Vista Cocina (cómo lo ve el personal)">
                <IconButton
                  size="small"
                  onClick={() => setCocinaModalOpen(true)}
                  sx={{ color: 'inherit', opacity: 0.85, '&:hover': { opacity: 1 } }}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton onClick={() => !saving && !deleting && onClose()} size="small" sx={{ color: 'inherit' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
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
                    size="small"
                    inputProps={{ min: 0, max: 150 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Box>

                <Divider sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Ingredientes ({items.length})
                  </Typography>
                </Divider>

                {/* ── Header columnas ── */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1.8fr 68px 66px 80px 36px 36px 88px 1fr 56px 28px',
                  gap: '4px', px: 0.5, mb: 0.5,
                }}>
                  {[
                    '',
                    'Insumo',
                    'Cantidad',
                    'Unidad',
                    '$/u',
                    <Tooltip key="m" title="Merma"><span>Merma</span></Tooltip>,
                    <Tooltip key="p" title="Pedido"><span>Pedido</span></Tooltip>,
                    'Tipo costo',
                    'Observaciones',
                    'Modif.',
                    '',
                  ].map((col, i) => (
                    <Typography key={i} variant="caption" color="text.secondary"
                      fontWeight={700} sx={{ fontSize: '0.68rem', textAlign: i >= 4 && i <= 8 ? 'center' : 'left' }}>
                      {col}
                    </Typography>
                  ))}
                </Box>

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
                        onOpenNotasModal={() => setNotasModalOpen(true)}
                        insumos={insumos}
                        usedSupplyIds={usedSupplyIds}
                        alertaSemanas={alertaSemanas}
                        autoOpenSearch={newItemIndex === i}
                        recetasElaborados={recetasElaborados}
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

                {/* ── Panel de costos ── */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1.5, p: 2, mb: 2,
                }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
                    <Typography variant="h6" fontWeight={800}>${fmt(costoTotal)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Costo x porción{rendimiento > 1 ? ` (÷${rendimiento})` : ''}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>${fmt(costoXRendimiento)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Precio sugerido ({pctCostoIdeal}% costo)
                    </Typography>
                    <Typography variant="h6" fontWeight={800} color="success.main">
                      {precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}
                    </Typography>
                    {precioActual > 0 && (
                      <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                        <Typography variant="caption" sx={{
                          fontSize: '0.75rem', fontWeight: 600,
                          color: estaPorDebajo ? '#ef4444' : 'text.secondary',
                        }}>
                          Actual: ${fmt(precioActual)}
                        </Typography>
                        {estaPorDebajo && <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>% Costo actual</Typography>
                    {pctCostoActual !== null ? (
                      <>
                        <Typography variant="h6" fontWeight={800}
                          color={pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main'}>
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
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Borrar receta — solo si ya existe, en el footer */}
              {receta && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={saving || deleting}
                  startIcon={deleting ? <CircularProgress size={13} color="inherit" /> : <DeleteForeverIcon />}
                  onClick={() => setConfirmDelete(true)}
                  sx={{ mr: 1 }}
                >
                  Borrar receta
                </Button>
              )}
              <Button onClick={() => !saving && !deleting && onClose()} disabled={saving || deleting} color="inherit" size="small">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                size="small"
                disabled={saving || deleting || loading || hasDuplicates}
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}
              >
                {saving ? 'Guardando…' : 'Guardar receta'}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Modal>

      {/* ── Modal últimas compras ── */}
      {comprasInsumo && (
        <UltimasComprasModal
          item={comprasInsumo}
          businessId={businessId}
          onClose={() => setComprasInsumo(null)}
          insumos={insumos}
        />
      )}

      {/* ── Modal notas + foto ── */}
      {notasModalOpen && (
        <NotasModal
          notas={notas}
          foto={foto}
          onSave={(n, f) => { setNotas(n); setFoto(f); }}
          onClose={() => setNotasModalOpen(false)}
        />
      )}

      {/* ── Vista Cocina ── */}
      {cocinaModalOpen && (
        <VistaCocinaModal
          nombre={nombre || artNombre}
          rendimiento={rendimiento}
          items={items}
          notas={notas}
          foto={foto}
          onClose={() => setCocinaModalOpen(false)}
        />
      )}

      {/* ── Confirmar borrar ── */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>¿Borrar receta?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta acción eliminará permanentemente la receta de <strong>{artNombre}</strong>.
            Los costos calculados dejarán de mostrarse.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} color="inherit" size="small">Cancelar</Button>
          <Button
            onClick={handleDelete}
            color="error" variant="contained" size="small"
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon />}
            disabled={deleting}
          >
            {deleting ? 'Borrando…' : 'Sí, borrar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}