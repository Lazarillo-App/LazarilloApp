/* eslint-disable no-empty */
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
  DialogActions, DialogContentText, Menu
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
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ImageIcon from '@mui/icons-material/Image';
import TuneIcon from '@mui/icons-material/Tune';
import SortIcon from '@mui/icons-material/Sort';
import EditIcon from '@mui/icons-material/Edit';
import { getReceta, saveReceta } from '@/servicios/apiOrganizations';
import { insumosList } from '@/servicios/apiInsumos';
import { BASE } from '@/servicios/apiBase';
import { useConfig } from '@/context/ConfigContext';

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
  const PESO = { gr: 1, gramo: 1, gramos: 1, g: 1, k: 1000, kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, oz: 28.35, onza: 28.35, lb: 453.59 };
  const VOLUM = { ml: 1, cc: 1, lt: 1000, l: 1000, litro: 1000, litros: 1000, 'oz fl': 29.57 };
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return 1;
  if (PESO[f] !== undefined && PESO[t] !== undefined) return PESO[f] / PESO[t];
  if (VOLUM[f] !== undefined && VOLUM[t] !== undefined) return VOLUM[f] / VOLUM[t];
  return 1;
}

function isCompatibleUnits(a, b) {
  const PESO = new Set(['gr', 'gramo', 'gramos', 'g', 'k', 'kg', 'kilo', 'kilos', 'kilogramo', 'oz', 'onza', 'lb']);
  const VOLUM = new Set(['ml', 'cc', 'lt', 'l', 'litro', 'litros']);
  const UNID = new Set(['u', 'un', 'unidad', 'unidades', 'und', 'doc', 'docena']);
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
    fetch(`${BASE}/purchases?insumo_id=${item.supplyId}&limit=50&page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Business-Id': String(businessId),
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        setCompras(Array.isArray(d?.data) ? d.data : []);
      })
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
        height: 'auto', maxHeight: '80vh',
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

        <Box sx={{ p: 2, overflow: 'hidden' }}>
          {loading ? (
            <Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack>
          ) : compras.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              Sin compras registradas para este insumo.
            </Typography>
          ) : (
            <Box>
              {/* Header fijo fuera del scroll */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px', gap: 1, px: 1, mb: 0.5 }}>
                {['Fecha', 'Proveedor', 'Cantidad', 'Precio/u'].map(h => (
                  <Typography key={h} variant="caption" fontWeight={700} color="text.secondary"
                    sx={{ fontSize: '0.68rem', textAlign: h === 'Cantidad' || h === 'Precio/u' ? 'right' : 'left' }}>{h}</Typography>
                ))}
              </Box>
              {/* Lista con scroll */}
              <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
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
function NotasModal({
  notas,
  foto,
  notasUpdatedAt,
  onSave,
  onClose,
  articuloId,
  businessId,
  esElaborado,
}) {
  const [localNotas, setLocalNotas] = useState(notas || '');
  const [localFoto, setLocalFoto] = useState(foto || null); // base64 o URL
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Fecha de modificación: se actualiza al guardar
  const [localUpdatedAt, setLocalUpdatedAt] = useState(notasUpdatedAt || null);
  const [uploadToken, setUploadToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [hayFotosQR, setHayFotosQR] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const pollingRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLocalFoto(ev.target.result);
    reader.readAsDataURL(file);
    // reset para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  const generarToken = async () => {
    if (!articuloId || !businessId) return;
    setTokenLoading(true);
    try {
      const jwt = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/recetas/${articuloId}/upload-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'X-Business-Id': String(businessId),
        },
        body: JSON.stringify({ bizId: businessId }),
      });
      const data = await res.json();
      if (data.token) {
        const uploadUrl = data.uploadUrl || `${window.location.origin}/upload-foto?token=${data.token}`;
        setUploadToken({ ...data, uploadUrl });
        setShowQR(true);
        iniciarPolling(data.token);
      }
    } catch (err) {
      setUploadError('No se pudo generar el QR.');
    } finally {
      setTokenLoading(false);
    }
  };

  const iniciarPolling = (tok) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const jwt = localStorage.getItem('token') || '';
        const res = await fetch(
          `${BASE}/recetas/${articuloId}/fotos-pendientes?token=${tok}`,
          { headers: { Authorization: `Bearer ${jwt}`, 'X-Business-Id': String(businessId) } }
        );
        const data = await res.json();
        if (data.fotos?.length > 0) {
          const nueva = data.fotos[0];
          if (nueva !== localFoto) {
            setLocalFoto(nueva);
            setHayFotosQR(true);
            setUploadError('📱 Foto recibida del celular — guardá para confirmar');
          }
        }
      } catch { }
    }, 4000);
  };

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 600 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        maxHeight: '99vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <Box sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: PRIMARY,
          color: ON_PRIMARY,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
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
            fullWidth
            value={localNotas}
            onChange={e => setLocalNotas(e.target.value)}
            placeholder={esElaborado
              ? "Método de Envasado: Ej: envasar al vacío, conservar en frío…"
              : "Método de Servido: Ej: servir frío, acompañar con salsa…"}
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
                <Button
                  size="small" variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  Desde archivo
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => cameraInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  Cámara
                </Button>
                <Button
                  size="small" variant="outlined"
                  onClick={() => { if (!uploadToken) { generarToken(); } else { setShowQR(v => !v); } }}
                  disabled={tokenLoading}
                  sx={{ borderColor: '#78350f', color: '#78350f' }}
                >
                  {tokenLoading ? '…' : showQR ? 'Ocultar QR' : '📱 QR'}
                </Button>
              </Stack>

              {uploadError && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: hayFotosQR ? '#16a34a' : 'warning.main', fontWeight: hayFotosQR ? 600 : 400 }}>
                  {uploadError}
                </Typography>
              )}

              {showQR && uploadToken && (
                <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e7e5e4', textAlign: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uploadToken.uploadUrl)}`}
                    alt="QR para subir foto"
                    style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
                  />
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5, display: 'block' }}>
                    Escaneá para subir desde el celular
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block' }}>
                    Vence: {new Date(uploadToken.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              )}
              {/* inputs ocultos */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
            </Box>
          )}
        </Box>

        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          {/* Fecha última modificación */}
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
            {localUpdatedAt
              ? `Última modificación: ${fmtDate(localUpdatedAt)}`
              : 'Sin modificaciones previas'
            }
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
            <Button size="small" variant="contained"
              onClick={() => {
                const now = new Date().toISOString();
                setLocalUpdatedAt(now);
                onSave(localNotas, localFoto, now);
                onClose();
              }}
              sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
              Guardar notas
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

/* ════════════════════════════════════════
   VISTA COCINA (preview de lectura)
════════════════════════════════════════ */
function VistaCocinaModal({ nombre, rendimiento, items, notas, foto, onClose }) {
  const ingredientesVisibles = items.filter(it => it.supplyId && it.tipoCosto !== 'nulo');
  const conNotas = ingredientesVisibles.filter(it => it.observaciones);
  const hayNotas = !!notas;
  const hayNotasIngredientes = conNotas.length > 0;

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

          {/* ── 1. Foto al inicio si hay ── */}
          {foto && (
            <Box sx={{ mb: 2.5, borderRadius: 1.5, overflow: 'hidden', boxShadow: 2 }}>
              <img src={foto} alt="Foto receta" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            </Box>
          )}

          {/* ── 2. Notas generales al principio ── */}
          {hayNotas && (
            <Box sx={{ mb: 2.5, bgcolor: '#fef9c3', borderRadius: 1.5, p: 2, border: '1px solid #fde68a' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
                Instrucciones generales
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.92rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {notas}
              </Typography>
            </Box>
          )}

          {/* ── 3. Ingredientes ── */}
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: 1, color: '#78350f' }}>
            Ingredientes
          </Typography>
          <Box sx={{ mb: hayNotasIngredientes ? 2 : 2.5 }}>
            {ingredientesVisibles.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin ingredientes cargados.</Typography>
            ) : ingredientesVisibles.map((it, i) => (
              <Box key={i} sx={{
                py: 0.75, borderBottom: '1px solid #e7e5e4',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    {it.supplyNombre || `Insumo #${it.supplyId}`}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: '#1c1917', ml: 2, flexShrink: 0 }}>
                    {it.cantidad} {it.unidad || it.supplyMedida || 'u'}
                  </Typography>
                </Box>
                {/* Nota e imagen del ingrediente si existen */}
                {(it.observaciones || it.fotosUrls?.length > 0) && (
                  <Box sx={{ mt: 0.5 }}>
                    {it.fotosUrls?.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                        {it.fotosUrls.map((url, fi) => (
                          <Box key={fi} sx={{ borderRadius: 1, overflow: 'hidden', width: 90, height: 70 }}>
                            <img src={url} alt={`${it.supplyNombre} ${fi + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </Box>
                        ))}
                      </Box>
                    )}
                    {it.observaciones && (
                      <Typography variant="caption" sx={{
                        fontSize: '0.78rem', color: '#78350f', fontStyle: 'italic',
                        display: 'block', lineHeight: 1.4,
                      }}>
                        ↳ {it.observaciones}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          {/* ── 4. Sin notas fallback ── */}
          {!hayNotas && !hayNotasIngredientes && (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mt: 1 }}>
              Sin instrucciones adicionales.
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
   MODAL DE NOTAS POR INGREDIENTE
════════════════════════════════════════ */
/**
 * NotasItemModal — Modal de notas por ingrediente
 * - Texto libre con persistencia
 * - Múltiples fotos (array de URLs)
 * - Upload autenticado via backend (/api/recetas/:articuloId/fotos) → Cloudinary server-side
 * - Fallback a base64 local si el endpoint no responde
 * - QR para subir desde celular
 */

function NotasItemModal({
  supplyNombre, observaciones, fotosUrls: fotosIniciales,
  updatedAt, onSave, onClose, articuloId, businessId,
}) {
  const [texto, setTexto] = useState(observaciones || '');
  const [fotos, setFotos] = useState(() => {
    if (!fotosIniciales) return [];
    if (Array.isArray(fotosIniciales)) return fotosIniciales.filter(Boolean);
    if (typeof fotosIniciales === 'string' && fotosIniciales) return [fotosIniciales];
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [hayFotosQR, setHayFotosQR] = useState(false); // fotos nuevas recibidas del celular

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const pollingRef = useRef(null);
  const textoRef = useRef(texto);

  // Mantener textoRef actualizado para usarlo dentro del interval
  useEffect(() => { textoRef.current = texto; }, [texto]);

  // ── Token QR ──
  const [uploadToken, setUploadToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);

  const generarToken = async () => {
    if (!articuloId || !businessId) return;
    setTokenLoading(true);
    try {
      const jwt = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/recetas/${articuloId}/upload-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'X-Business-Id': String(businessId),
        },
        body: JSON.stringify({ supplyId: articuloId, supplyNombre, bizId: businessId }),
      });
      const data = await res.json();
      if (data.token) {
        const uploadUrl = data.uploadUrl
          || `${window.location.origin}/upload-foto?token=${data.token}`;
        setUploadToken({ ...data, uploadUrl });
        setShowQR(true);
        iniciarPolling(data.token);
      }
    } catch (err) {
      console.warn('No se pudo generar token QR:', err);
      setUploadError('No se pudo generar el QR. Intentá de nuevo.');
    } finally {
      setTokenLoading(false);
    }
  };

  const iniciarPolling = (tok) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const jwt = localStorage.getItem('token') || '';
        const res = await fetch(
          `${BASE}/recetas/${articuloId}/fotos-pendientes?token=${tok}&supplyId=${articuloId}`,
          { headers: { Authorization: `Bearer ${jwt}`, 'X-Business-Id': String(businessId) } }
        );
        const data = await res.json();
        if (data.fotos?.length > 0) {
          setFotos(prev => {
            const nuevas = data.fotos.filter(u => !prev.includes(u));
            if (nuevas.length > 0) {
              setHayFotosQR(true);
              setUploadError(`📱 ${nuevas.length} foto(s) nueva(s) del celular — guardá para confirmar`);
              return [...prev, ...nuevas];
            }
            return prev;
          });
        }
      } catch { /* ignorar errores de red en polling */ }
    }, 4000);
  };

  // Limpiar polling al cerrar
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Upload desde la computadora via backend → Cloudinary ──
  const uploadViaBackend = async (file) => {
    setUploading(true);
    setUploadError('');
    try {
      const token = localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BASE}/recetas/${articuloId || 'general'}/fotos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId || ''),
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.url) {
        setFotos(prev => [...prev, data.url]);
      } else {
        throw new Error('Sin URL en respuesta');
      }
    } catch (err) {
      // Fallback base64 local si el backend falla
      console.warn('[NotasItemModal] Backend upload falló, usando base64 local:', err.message);
      const reader = new FileReader();
      reader.onload = (ev) => setFotos(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
      setUploadError('Sin conexión al servidor — foto guardada localmente (no persistirá)');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => uploadViaBackend(file));
    e.target.value = '';
  };

  const removePhoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx));

  const handleGuardar = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    onSave(texto, fotos);
  };

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'rgba(0,0,0,0.35)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Box sx={{
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 8,
        width: { xs: '95vw', sm: 500 }, maxHeight: '92vh',
        overflowY: 'auto', p: 2.5,
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>

        {/* ── Header ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotesIcon sx={{ fontSize: 16, color: PRIMARY }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: PRIMARY }}>
              Notas — {supplyNombre || 'Ingrediente'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* ── Textarea ── */}
        <TextField
          autoFocus
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          size="small"
          placeholder="Ej: agregar al final, mezclar suavemente, reservar en frío…"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          inputProps={{ style: { fontSize: '0.88rem', lineHeight: 1.6 } }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGuardar();
          }}
        />

        {/* ── Galería de fotos existentes ── */}
        {fotos.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {fotos.map((url, idx) => (
              <Box key={idx} sx={{
                position: 'relative', width: 110, height: 90,
                borderRadius: 1.5, overflow: 'hidden',
                border: '1px solid', borderColor: 'divider', flexShrink: 0,
              }}>
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <IconButton
                  size="small"
                  onClick={() => removePhoto(idx)}
                  sx={{
                    position: 'absolute', top: 2, right: 2, p: '2px',
                    bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* ── Zona de carga ── */}
        <Box sx={{
          border: '1px dashed', borderColor: hayFotosQR ? '#16a34a' : 'divider',
          borderRadius: 1.5, py: 1.5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
          bgcolor: hayFotosQR ? '#f0fdf4' : 'action.hover',
          transition: 'all 0.3s',
        }}>
          {uploading ? (
            <Stack direction="row" alignItems="center" spacing={1} py={0.5}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Subiendo foto…</Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="caption" sx={{ fontSize: '0.72rem', color: hayFotosQR ? '#16a34a' : 'text.secondary' }}>
                {hayFotosQR
                  ? '📱 Fotos recibidas del celular'
                  : fotos.length > 0 ? 'Agregar más fotos' : 'Foto del ingrediente o preparación'
                }
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                <Button
                  size="small" variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY, fontSize: '0.72rem' }}
                >
                  Archivo
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => cameraInputRef.current?.click()}
                  sx={{ borderColor: PRIMARY, color: PRIMARY, fontSize: '0.72rem' }}
                >
                  Cámara
                </Button>
                <Button
                  size="small" variant="outlined"
                  onClick={() => {
                    if (!uploadToken) { generarToken(); }
                    else { setShowQR(v => !v); }
                  }}
                  disabled={tokenLoading}
                  sx={{ borderColor: '#78350f', color: '#78350f', fontSize: '0.72rem' }}
                >
                  {tokenLoading ? '…' : showQR ? 'Ocultar QR' : '📱 QR'}
                </Button>
              </Stack>
            </>
          )}

          {/* Mensaje de estado / fotos QR recibidas */}
          {uploadError && (
            <Typography variant="caption"
              sx={{
                fontSize: '0.7rem', textAlign: 'center', px: 1,
                color: hayFotosQR ? '#16a34a' : 'warning.main',
                fontWeight: hayFotosQR ? 600 : 400,
              }}
            >
              {uploadError}
            </Typography>
          )}

          {/* QR */}
          {showQR && uploadToken && (
            <Box sx={{
              mt: 0.5, p: 1.5, bgcolor: '#fff',
              borderRadius: 1.5, border: '1px solid #e7e5e4', textAlign: 'center',
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uploadToken.uploadUrl)}`}
                alt="QR para subir foto"
                style={{ width: 130, height: 130, display: 'block', margin: '0 auto' }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Escaneá para subir desde el celular
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block' }}>
                Vence: {new Date(uploadToken.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          )}
        </Box>

        {/* inputs ocultos */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFile} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

        {/* Fecha última edición */}
        {updatedAt && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
            Última edición: {fmtDate(updatedAt)}
          </Typography>
        )}

        {/* ── Acciones ── */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleGuardar}
            disabled={uploading}
            sx={{
              bgcolor: hayFotosQR ? '#16a34a' : PRIMARY,
              color: ON_PRIMARY,
              fontWeight: 700,
              '&:hover': {
                filter: 'brightness(0.9)',
                bgcolor: hayFotosQR ? '#16a34a' : PRIMARY,
              },
              // Pulso suave cuando hay fotos QR esperando
              ...(hayFotosQR && {
                animation: 'qr-pulse 1.5s ease-in-out infinite',
              }),
            }}
          >
            {hayFotosQR ? '💾 Guardar fotos del celular' : 'Guardar nota'}
          </Button>
        </Box>
      </Box>

      {/* Animación pulso para el botón cuando hay fotos QR */}
      <style>{`
        @keyframes qr-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
        }
      `}</style>
    </Box>
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
  articuloId,
  businessId,
  onOpenRecetaElaborado,
  searchOpen,
  onSearchOpen,
  onSearchClose,
}) {
  const [search, setSearch] = useState('');
  const [notasOpen, setNotasOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const cantidadRef = useRef(null);
  const listRef = useRef(null);
  const [localRecetasElaborados, setLocalRecetasElaborados] = useState(recetasElaborados);
  const recetasElaboradosRef = useRef(recetasElaborados);

  const wasAutoOpened = useRef(autoOpenSearch && !item.supplyId);

  // Sincronizar solo cuando el contenido cambia realmente (evita loop por objeto nuevo)
  useEffect(() => {
    const prev = JSON.stringify(recetasElaboradosRef.current);
    const next = JSON.stringify(recetasElaborados);
    if (prev !== next) {
      recetasElaboradosRef.current = recetasElaborados;
      setLocalRecetasElaborados(recetasElaborados);
    }
  }, [recetasElaborados]);

  // Si el search se cierra y no hay insumo seleccionado, eliminar la fila
  useEffect(() => {
    if (!searchOpen && wasAutoOpened.current && !item.supplyId) {
      onRemove(index);
    }
    if (item.supplyId) {
      wasAutoOpened.current = false;
    }
  }, [searchOpen, item.supplyId, index, onRemove]);

  useEffect(() => {
    if (autoOpenSearch) {
      onSearchOpen();
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e) => {
      // Ignorar clicks en el dropdown o trigger de búsqueda
      if (e.target.closest('[data-search-dropdown]') ||
        e.target.closest('[data-search-trigger]')) return;
      onSearchClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, onSearchClose]);

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const els = listRef.current.querySelectorAll('[data-option-index]');
    const el = els[focusedIndex];
    if (!el) return;

    const container = listRef.current;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;

    if (elBottom > containerBottom) {
      container.scrollTop = elBottom - container.clientHeight;
    } else if (elTop < containerTop) {
      container.scrollTop = elTop;
    }
  }, [focusedIndex]);

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
      : [...insumos];

    list.sort((a, b) => {
      // 1. Más usados primero (tienen precio_promedio_periodo o total_unidades > 0)
      const aUsado = Number(a.total_unidades_periodo ?? a.unidades_compradas ?? 0) > 0;
      const bUsado = Number(b.total_unidades_periodo ?? b.unidades_compradas ?? 0) > 0;
      if (aUsado !== bUsado) return aUsado ? -1 : 1;

      // 2. Precio ascendente, excluyendo cero
      const aP = Number(a.precio_ref ?? a.precio_promedio ?? a.precio ?? 0);
      const bP = Number(b.precio_ref ?? b.precio_promedio ?? b.precio ?? 0);
      if (aP > 0 && bP > 0) return aP - bP;
      if (aP > 0) return -1;
      if (bP > 0) return 1;

      // 3. Alfabético como desempate
      return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
    });

    return list.slice(0, 30); // un poco más de margen
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
    onSearchClose();
    setSearch('');
    setTimeout(() => cantidadRef.current?.focus(), 50);
  }, [index, onChange]);

  // ── Detectar si es insumo elaborado (tiene receta propia) ──
  const elaboradoData = item.supplyId ? recetasElaborados[String(item.supplyId)] : null;
  const insumoData = item.supplyId
    ? insumos.find(i => String(i.id) === String(item.supplyId))
    : null;
  const esElaborado = !!elaboradoData || insumoData?.es_elaborado === true || insumoData?.tiene_receta === true;
  const elaborado = elaboradoData;
  const tipoCosto = item.tipoCosto || 'total';

  /**
   * Precio por unidad elegida, considerando:
   * - Si es elaborado Y tipoCosto==='total'     → costo/porcion de su receta
   * - Si es elaborado Y tipoCosto==='sugerido'  → precio sugerido de su receta
   * - En cualquier otro caso                   → calcPrecioEnUnidad desde la DB
   */
  const costoEnUnidadElegida = useMemo(() => {
    if (elaborado) {
      const porciones = Number(elaborado?.porciones) || 1;
      const unidadDB = canonicalUnit(item.supplyMedida || 'u');
      const unidadElegida = canonicalUnit(item.unidad || unidadDB);
      const factor = getConversionFactor(unidadDB, unidadElegida); // ← acá

      if (tipoCosto === 'sugerido' && (elaborado?.precioSugerido ?? 0) > 0) {
        return (elaborado.precioSugerido ?? 0) / factor;
      }
      if (tipoCosto !== 'nulo' && (elaborado?.costoTotal ?? 0) > 0) {
        return ((elaborado.costoTotal ?? 0) / porciones) / factor;
      }
    }
    const precioRef = Number(item.precioRefDB) || 0;
    const unidadDB = canonicalUnit(item.supplyMedida || 'u');
    const unidadElegida = canonicalUnit(item.unidad || unidadDB);
    return calcPrecioEnUnidad(precioRef, unidadDB, unidadElegida);
  }, [elaborado, tipoCosto, item.precioRefDB, item.supplyMedida, item.unidad]);

  // Costo línea (cantidad × $/u efectivo)
  const costoLinea = useMemo(() => {
    const cant = Number(item.cantidad) || 0;
    return cant * costoEnUnidadElegida;
  }, [item.cantidad, costoEnUnidadElegida]);

  const costoEfectivoLinea = (tipoCosto === 'nulo' || Number(item.cantidad) < 0) ? 0 : costoLinea;

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
    <Box sx={{
      width: '100%',
      borderRadius: 1,
      bgcolor: alertaBg || 'transparent',
      border: alertaBg ? '1px solid #fecaca' : '1px solid transparent',
      ...(isDuplicate && { bgcolor: '#fef2f2', border: '1px solid #fecaca' }),
      transition: 'background 0.2s',
      '&:hover': { bgcolor: alertaBg || (showAdvanced ? 'transparent' : 'action.hover') },
      position: 'relative',
    }}>
      {/* ── Fila principal ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '20px 1.8fr 68px 66px 80px 28px 1fr 28px 28px',
        alignItems: 'center',
        gap: '4px',
        py: 0.5, px: 0.5,
      }}>
        {/* drag */}
        <Tooltip title="Cambiar insumo">
          <IconButton data-search-trigger size="small" onClick={() => searchOpen ? onSearchClose() : onSearchOpen()} sx={{ p: '2px', color: 'text.disabled', '&:hover': { color: PRIMARY } }}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        {/* ── Selector insumo ── */}
        <Box sx={{ position: 'relative', minWidth: 0 }}>
          <Box
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!item.supplyId) return;
                    const tieneCompras = !!item.ultimaCompra;
                    if (tieneCompras) {
                      onOpenCompras?.(item);
                    } else {
                      // Sin compras → abrir receta (elaborado o no)
                      onOpenRecetaElaborado?.(item);
                    }
                  }}
                  title={item.ultimaCompra ? "Ver últimas compras" : "Ver/crear receta"}
                >
                  {item.supplyNombre || `#${item.supplyId}`}
                </Typography>

                {/* Precio en unidad base — para elaborados muestra costo/porción */}
                {(item.precioRefDB > 0 || elaborado) && (
                  <Chip
                    label={
                      elaborado
                        ? (costoEnUnidadElegida > 0 ? `$${fmt(costoEnUnidadElegida)}/u` : '—')
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
                        ? `Costo de receta elaborada: $${fmt(costoEnUnidadElegida)}/u`
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
            <Box data-search-dropdown sx={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, boxShadow: 6, minWidth: 340, mt: 0.5 }}>
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField autoFocus inputRef={searchInputRef} size="small" fullWidth placeholder="Código o nombre…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setFocusedIndex(-1);
                    setFocusedIndex(0);
                  }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { onSearchClose(); }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      e.stopPropagation(); // ← agregar
                      setFocusedIndex(i => Math.min(i + 1, filtrados.length - 1));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      e.stopPropagation(); // ← agregar
                      setFocusedIndex(i => Math.max(i - 1, 0));
                    }
                    if (e.key === 'Enter') {
                      e.stopPropagation(); // ← agregar
                      if (focusedIndex >= 0 && filtrados[focusedIndex]) selectInsumo(filtrados[focusedIndex]);
                      else if (filtrados.length === 1) selectInsumo(filtrados[0]);
                    }
                  }}
                />
              </Box>
              <Box ref={listRef} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {filtrados.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Sin resultados</Typography></Box>
                ) : filtrados.map((ins, idx) => {
                  const yaUsado = usedSupplyIds.has(String(ins.id));
                  const esElab = !!localRecetasElaborados[String(ins.id)] || !!ins.es_elaborado || !!ins.tiene_receta;
                  return (
                    <Box key={ins.id} data-option-index={idx}
                      onClick={() => selectInsumo(ins)}
                      sx={{
                        px: 1.5, py: 0.75, cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid', borderColor: 'divider',
                        // ← reemplazar bgcolor por esto:
                        bgcolor: focusedIndex === idx ? 'action.selected' : 'transparent',
                        outline: focusedIndex === idx ? '2px solid' : 'none',
                        outlineColor: focusedIndex === idx ? 'primary.main' : 'transparent',
                        outlineOffset: -2,
                        '&:hover': { bgcolor: focusedIndex === idx ? 'action.selected' : 'action.hover' },
                        ...(yaUsado && { opacity: 0.6 }),
                      }}>
                      <Box>
                        <Typography component="span" variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', display: 'block' }}>
                          {ins.nombre}
                          {yaUsado && <Chip label="Ya usado" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />}
                          {esElab && <Chip label="Elaborado" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#f0fdf4', color: '#16a34a' }} />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {ins.codigo_maxi || ins.codigo_mostrar ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}` : ins.unidad_med || ins.medida || 'u'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ color: PRIMARY, fontSize: '0.8rem', flexShrink: 0, ml: 1 }}>
                        {(() => {
                          if (esElab) {
                            const eData = localRecetasElaborados[String(ins.id)];
                            if (!eData) return '';  // ← agregar este guard
                            const p = Number(eData.porciones) || 1;
                            return eData.costoTotal > 0 ? `$${fmt(eData.costoTotal / p)}/u` : '';
                          }
                          const p = Number(ins.precio_ref) || Number(ins.precio_promedio_periodo) || Number(ins.precio_promedio) || Number(ins.precio_ultima_compra) || Number(ins.precio) || 0;
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

        {/* ── Cantidad — mínimo 0 ── */}
        <TextField
          inputRef={cantidadRef}
          size="small"
          type="number"
          value={item.cantidad === '' ? '' : item.cantidad}
          onChange={e => {
            const val = e.target.value === '' ? '' : Number(e.target.value);
            onChange(index, { cantidad: val });
          }}
          onFocus={e => e.target.select()}
          placeholder="0"
          inputProps={{
            min: 0,
            step: (() => {
              const n = Number(item.cantidad) || 1;
              const digitos = Math.floor(Math.log10(Math.max(n, 1))) + 1;
              return Math.pow(10, digitos - 1) / 2;
            })(),
            style: { textAlign: 'right', fontSize: '0.78rem', padding: '4px 6px' }
          }}
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

        {/* ── $ total (unitario × cantidad) ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, minHeight: 30, bgcolor: elaborado ? '#f0fdf4' : '#f8fafc', overflow: 'hidden' }}>
          <Tooltip title={elaborado ? `De receta elaborada` : `$${fmt(costoEnUnidadElegida)}/${item.unidad || item.supplyMedida || 'u'} × ${item.cantidad || 0}`}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: costoEfectivoLinea > 0 ? (elaborado ? '#16a34a' : PRIMARY) : 'text.disabled', whiteSpace: 'nowrap' }}>
              {item.supplyId ? (costoEfectivoLinea > 0 ? `$${fmt(costoEfectivoLinea)}` : '—') : '—'}
            </Typography>
          </Tooltip>
        </Box>

        {/* ── Botón avanzadas + fecha + eliminar ── */}
        <Tooltip title={showAdvanced ? 'Ocultar avanzadas' : 'Merma · Pedido · Tipo costo'}>
          <IconButton size="small" onClick={() => setShowAdvanced(v => !v)}
            sx={{
              p: '3px',
              color: showAdvanced ? PRIMARY : (item.merma === false || item.pedido === false || tipoCosto !== 'total') ? '#f59e0b' : 'text.disabled',
              '&:hover': { color: PRIMARY },
            }}>
            <TuneIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        {/* ── Observaciones ── */}
        <Box sx={{ position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          <Tooltip title={item.observaciones ? (item.updatedAt ? `Editado: ${fmtDate(item.updatedAt)} — ${item.observaciones}` : item.observaciones) : 'Agregar nota para este ingrediente'} placement="top">
            <Box onClick={() => setNotasOpen(true)} sx={{
              border: '1px solid', borderColor: item.observaciones ? `${PRIMARY}60` : 'divider',
              borderRadius: 1, px: 0.75, minHeight: 30,
              display: 'flex', alignItems: 'center',
              cursor: 'pointer', bgcolor: 'background.paper',
              '&:hover': { borderColor: PRIMARY, bgcolor: `${PRIMARY}05` },
              overflow: 'hidden',
            }}>
              <Typography noWrap sx={{ fontSize: '0.72rem', color: item.observaciones ? 'text.primary' : 'text.disabled', fontStyle: item.observaciones ? 'normal' : 'italic', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.observaciones || 'Notas…'}
              </Typography>
              {(item.observaciones || item.fotosUrls?.length > 0) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, ml: 0.25 }}>
                  {item.observaciones && <NotesIcon sx={{ fontSize: 11, color: PRIMARY }} />}
                  {item.fotosUrls?.length > 0 && <PhotoCameraIcon sx={{ fontSize: 11, color: PRIMARY }} />}
                </Box>
              )}
            </Box>
          </Tooltip>

          {notasOpen && (
            <NotasItemModal
              supplyNombre={item.supplyNombre}
              observaciones={item.observaciones || ''}
              fotosUrls={item.fotosUrls || []}
              updatedAt={item.updatedAt}
              articuloId={articuloId}
              businessId={businessId}
              onSave={(val, fotos) => {
                onChange(index, {
                  observaciones: val,
                  fotosUrls: Array.isArray(fotos) ? fotos : (fotos ? [fotos] : []),
                  updatedAt: new Date().toISOString(),
                });
                setNotasOpen(false);
              }}
              onClose={() => setNotasOpen(false)}
            />
          )}
        </Box>

        {/* ── Fecha última modificación ── */}
        <Tooltip title={item.updatedAt ? `Modificado: ${fmtDate(item.updatedAt)}` : 'Sin modificaciones'}>
          <Box sx={{ textAlign: 'center', cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <HistoryIcon sx={{ fontSize: 13, color: item.updatedAt ? PRIMARY : 'text.disabled' }} />
          </Box>
        </Tooltip>

        {/* ── Eliminar ── */}
        <Tooltip title="Eliminar">
          <IconButton size="small" onClick={() => onRemove(index)}
            sx={{ color: 'error.main', opacity: 0.5, p: 0.25, '&:hover': { opacity: 1 } }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>{/* fin fila principal */}

      {/* ── Panel avanzadas ── */}
      {showAdvanced && (
        <Box sx={{
          mx: 0.5, mb: 0.5, px: 1.5, py: 1,
          bgcolor: `${PRIMARY}08`,
          borderRadius: 1,
          border: `1px solid ${PRIMARY}20`,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          {/* Merma */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox
              size="small"
              checked={item.merma !== false}
              onChange={e => onChange(index, { merma: e.target.checked })}
              sx={{ p: 0.25, color: PRIMARY, '&.Mui-checked': { color: PRIMARY } }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', userSelect: 'none', cursor: 'pointer' }}
              onClick={() => onChange(index, { merma: item.merma === false })}>
              Merma
            </Typography>
          </Box>

          {/* Pedido */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox
              size="small"
              checked={item.pedido !== false}
              onChange={e => onChange(index, { pedido: e.target.checked })}
              sx={{ p: 0.25, color: PRIMARY, '&.Mui-checked': { color: PRIMARY } }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', userSelect: 'none', cursor: 'pointer' }}
              onClick={() => onChange(index, { pedido: item.pedido === false })}>
              Pedido
            </Typography>
          </Box>

          {/* Tipo costo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Tipo:</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {TIPO_COSTO_OPTS.map(o => (
                <Chip
                  key={o.value}
                  label={o.label}
                  size="small"
                  onClick={() => onChange(index, { tipoCosto: o.value })}
                  sx={{
                    height: 22, fontSize: '0.7rem', cursor: 'pointer',
                    bgcolor: tipoCosto === o.value ? PRIMARY : 'transparent',
                    color: tipoCosto === o.value ? '#fff' : 'text.secondary',
                    border: `1px solid ${tipoCosto === o.value ? PRIMARY : '#e2e8f0'}`,
                    '&:hover': { bgcolor: tipoCosto === o.value ? PRIMARY : `${PRIMARY}15` },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Cerrar */}
          <Box sx={{ ml: 'auto' }}>
            <Typography
              variant="caption"
              onClick={() => setShowAdvanced(false)}
              sx={{ fontSize: '0.7rem', color: 'text.disabled', cursor: 'pointer', '&:hover': { color: PRIMARY } }}
            >
              cerrar ✕
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/* ════════════════════════════════════════
   MODAL PRINCIPAL
════════════════════════════════════════ */
export default function RecetaModal({
  open, onClose, articulo, businessId, onSaved, costoObjetivoExterno,
  insumosBizId = null,
  recetasElaborados = {},
  esElaborado = false,
  getRecetaUrl = null,
  saveRecetaUrl = null,
  onPriceConfigSave = null,
  allArticulos = [],
}) {
  const [receta, setReceta] = useState(null);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  // Leer config global del contexto — se actualiza automáticamente sin fetch propio
  const appConfig = useConfig();
  const [openSearchIdx, setOpenSearchIdx] = useState(null);
  const [pctCostoIdeal, setPctCostoIdeal] = useState(30);
  // globalConfigObjetivo viene del contexto global, no de un fetch local
  const globalConfigObjetivo = esElaborado
    ? (appConfig.insumosCostoIdeal ?? 30)
    : (appConfig.articulosCostoIdeal ?? 30);
  const [items, setItems] = useState([]);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const alertaSemanas = appConfig.comprasAlertaSemanas ?? 4;
  const [sortByCosto, setSortByCosto] = useState(false);

  // Notas y foto de la receta
  const [notas, setNotas] = useState('');
  const [notasUpdatedAt, setNotasUpdatedAt] = useState(null); // fecha última edición de notas
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

  const [localRecetasElaborados, setLocalRecetasElaborados] = useState(recetasElaborados);
  const recetasElabRef = useRef(recetasElaborados);

  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excluirAnchor, setExcluirAnchor] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [exclusionesArt, setExclusionesArt] = useState(new Set()); // listNumbers donde está excluido
  const [orgIdLocal, setOrgIdLocal] = useState(null);

  useEffect(() => {
    const prev = JSON.stringify(recetasElabRef.current);
    const next = JSON.stringify(recetasElaborados);
    if (prev !== next) {
      recetasElabRef.current = recetasElaborados;
      setLocalRecetasElaborados(recetasElaborados);
    }
  }, [recetasElaborados]);

  // ── Estados para panel de gemelos (artículos que comparten esta receta) ──
  const [gemelosGroup, setGemelosGroup] = useState(null);
  const [gemelosLoading, setGemelosLoading] = useState(false);
  const [gemelosOpen, setGemelosOpen] = useState(false);
  const [gemelosSearch, setGemelosSearch] = useState('');
  const [gemelosResults, setGemelosResults] = useState([]);
  const [gemelosSearching, setGemelosSearching] = useState(false);
  const gemelosSearchRef = useRef(null);
  const gemelosPanelRef = useRef(null);
  const [elaboradosStack, setElaboradosStack] = useState([]);

  const pushElaborado = useCallback((item) => {
    setElaboradosStack(prev => [...prev, item]);
  }, []);

  const popElaborado = useCallback(() => {
    setElaboradosStack(prev => prev.slice(0, -1));
  }, []);

  /**
   * Jerarquía de costo objetivo (de mayor a menor prioridad):
   *  1. costoObjetivoExterno  — viene de la tabla (artículo > rubro > agrupación)
   *  2. globalConfigObjetivo  — definido en Configuración — pisa el guardado en receta
   *  3. rec.porcentaje_venta  — guardado individualmente en la receta
   *  4. 30                    — fallback final
   *
   * El global de Config tiene prioridad sobre el guardado en receta porque cuando
   * el usuario cambia el global quiere que aplique a TODAS las recetas.
   */
  const costoObjetivoExternoRef = useRef(costoObjetivoExterno);
  useEffect(() => { costoObjetivoExternoRef.current = costoObjetivoExterno; }, [costoObjetivoExterno]);

  const resolveObjetivo = useCallback((recPct) => {
    const externo = costoObjetivoExternoRef.current;
    // Para artículos: respetar el externo (viene de la tabla)
    if (!esElaborado && externo != null) return Number(externo);
    // Para elaborados (y artículos sin externo): individual > global > 30
    if (recPct != null && Number(recPct) > 0) return Number(recPct);
    if (globalConfigObjetivo != null) return Number(globalConfigObjetivo);
    return 30;
  }, [globalConfigObjetivo, esElaborado]);

  // Cuando cambia costoObjetivoExterno desde la tabla, aplicarlo inmediatamente
  useEffect(() => {
    if (!open) return;
    if (esElaborado) return;
    if (costoObjetivoExterno != null) {
      setPctCostoIdeal(Number(costoObjetivoExterno));
    }
  }, [costoObjetivoExterno, open, esElaborado]);

  /* ── Cargar gemelos al abrir + función reutilizable ── */
  const loadGemelosGroup = useCallback(() => {
    if (!businessId || !articulo?.id || esElaborado) return;
    setGemelosLoading(true);
    const token = localStorage.getItem('token') || '';
    return fetch(`${BASE}/businesses/${businessId}/article-links/by-article/${articulo.id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
    })
      .then(r => r.json())
      .then(d => {
        const group = d?.group || null;
        // Solo nos interesan los grupos de tipo "receta" en este modal.
        // Las vinculaciones por precio se gestionan desde la tabla.
        if (group && group.syncRecipe === false) {
          setGemelosGroup(null);
          return;
        }
        setGemelosGroup(group);
      })
      .catch(() => setGemelosGroup(null))
      .finally(() => setGemelosLoading(false));
  }, [businessId, articulo?.id, esElaborado]);

  useEffect(() => {
    if (!open) return;
    loadGemelosGroup();
  }, [open, loadGemelosGroup]);

  useEffect(() => {
    if (!gemelosOpen) return;
    const handleClickOutside = (e) => {
      if (gemelosPanelRef.current && !gemelosPanelRef.current.contains(e.target)) {
        setGemelosOpen(false);
        setGemelosResults([]);
        setGemelosSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gemelosOpen]);

  const [todosArticulos, setTodosArticulos] = useState([]);

  const buscarGemelos = useCallback(async (q) => {
    if (!q || !q.trim()) { setGemelosResults([]); return; }
    setGemelosSearching(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(
        `${BASE}/businesses/${businessId}/articles/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) } }
      );
      const d = await res.json();
      const lista = (d?.items || [])
        .filter(a => Number(a.id) !== Number(articulo?.id));
      setGemelosResults(lista);
    } catch (e) {
      console.error('[buscarGemelos]', e.message);
      setGemelosResults([]);
    } finally {
      setGemelosSearching(false);
    }
  }, [businessId, articulo?.id]);

  const agregarGemelo = useCallback(async (targetArticleId) => {
    if (!businessId || !articulo?.id) return;
    const token = localStorage.getItem('token') || '';
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': String(businessId),
      'Content-Type': 'application/json'
    };

    try {
      if (gemelosGroup?.groupId) {
        await fetch(`${BASE}/businesses/${businessId}/article-links/${gemelosGroup.groupId}/members`, {
          method: 'POST', headers,
          body: JSON.stringify({ articleId: targetArticleId }),
        });
      } else {
        const r = await fetch(`${BASE}/businesses/${businessId}/article-links`, {
          method: 'POST', headers,
          body: JSON.stringify({
            articleIds: [articulo.id, targetArticleId],
            syncRecipe: true,    // ← gemelos de receta
            syncObjetivo: false, // ← objetivo separado por artículo
            syncPrecio: false,   // ← precio separado por artículo
          }),
        });
        const d = await r.json();
        if (!r.ok && r.status === 409 && d?.existingGroup?.groupId) {
          await fetch(`${BASE}/businesses/${businessId}/article-links/${d.existingGroup.groupId}/members`, {
            method: 'POST', headers,
            body: JSON.stringify({ articleId: targetArticleId }),
          });
        }
      }

      // Si ya tiene receta guardada → propagar al nuevo gemelo
      if (receta) {
        fetch(
          `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta/propagate`,
          { method: 'POST', headers }
        ).catch(e => console.warn('[agregarGemelo] propagate falló:', e.message));
      }

    } catch (e) { console.error('[agregarGemelo]', e.message); }

    // Recargar grupo
    try {
      const r2 = await fetch(`${BASE}/businesses/${businessId}/article-links/by-article/${articulo.id}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });
      const d2 = await r2.json();
      if (d2?.group) setGemelosGroup(d2.group);
    } catch { }

    // Notificar a la tabla para que refresque los íconos de vinculación
    try { window.dispatchEvent(new CustomEvent('article:links-changed')); } catch { }
    onSaved?.({ article_id: articulo.id, _gemelo_added: targetArticleId });

  }, [businessId, articulo?.id, gemelosGroup, receta, onSaved]);

  const quitarGemelo = useCallback(async (targetArticleId) => {
    if (!businessId || !gemelosGroup) return;
    const token = localStorage.getItem('token') || '';
    try {
      await fetch(`${BASE}/businesses/${businessId}/article-links/${gemelosGroup.groupId}/members/${targetArticleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      });

      // Borrar la receta del artículo desvinculado
      await fetch(`${BASE}/businesses/${businessId}/articles/${targetArticleId}/receta`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
      }).catch(e => console.warn('[quitarGemelo] no se pudo borrar receta:', e.message));

      setGemelosGroup(prev => prev ? {
        ...prev,
        members: prev.members.filter(m => Number(m.article_id) !== Number(targetArticleId)),
      } : null);
      try { window.dispatchEvent(new CustomEvent('article:links-changed')); } catch { }
    } catch (e) { console.error('[quitarGemelo]', e.message); }
  }, [businessId, gemelosGroup]);

  const actualizarObjetivoGemelo = useCallback(async (targetArticleId, pctObjetivo) => {
    if (!businessId || !gemelosGroup || !onPriceConfigSave) return;
    const val = pctObjetivo != null ? Number(pctObjetivo) : null;
    try {
      // Guardar en article_price_config (misma fuente que usa la tabla principal
      // y el modal del gemelo cuando edita su Costo Objetivo).
      onPriceConfigSave({
        scope: 'articulo',
        scopeId: String(targetArticleId),
        objetivo: val,
      });
      // Optimistic update sobre el panel
      setGemelosGroup(prev => prev ? {
        ...prev,
        members: prev.members.map(m =>
          Number(m.article_id) === Number(targetArticleId)
            ? { ...m, pct_objetivo: val }
            : m
        ),
      } : null);
      try { window.dispatchEvent(new CustomEvent('article:links-changed')); } catch { }
    } catch (e) { console.error('[actualizarObjetivoGemelo]', e.message); }
  }, [businessId, gemelosGroup, onPriceConfigSave]);

  /* ── Cargar insumos ── */
  useEffect(() => {
    if (!open || !businessId) return;
    setInsumosLoading(true);
    insumosList(insumosBizId || businessId, { limit: 99999 })
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

    const fetchUrl = getRecetaUrl || `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta`;
    const token = localStorage.getItem('token') || '';
    fetch(fetchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Business-Id': String(businessId),
        'Content-Type': 'application/json',
      },
    })
      .then(r => r.json())
      .then(json => {
        // El endpoint de elaborados devuelve { ok, receta, insumos_costo_ideal }
        // globalConfigObjetivo ya viene del ConfigContext — no necesitamos sobreescribir
        if (json?.insumos_costo_ideal && esElaborado && costoObjetivoExterno == null) {
          const pct = Number(json.insumos_costo_ideal);
          setPctCostoIdeal(prev => prev === 30 ? pct : prev);
        }
        const rec = json?.receta ?? json ?? null;
        return rec;
      })
      .then(rec => {
        setReceta(rec);
        if (rec) {
          setNombre(rec.nombre || artNombre);
          setRendimiento(rec.porciones || rec.rendimiento || 1);
          setPctCostoIdeal(resolveObjetivo(rec.porcentaje_venta));
          setNotas(rec.notas || '');
          setNotasUpdatedAt(rec.notas_updated_at || rec.notasUpdatedAt || null);
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
              fotosUrls: (() => {
                const arr = it.fotos_urls || it.fotosUrls;
                if (Array.isArray(arr)) return arr.filter(Boolean);
                const legacy = it.foto_url || it.fotoUrl;
                return legacy ? [legacy] : [];
              })(),
              updatedAt: it.updated_at || it.updatedAt || null,
            };
          }));

          // Cargar datos de elaborados internamente
          const elaboradosIds = (rec.items || [])
            .filter(it => it.tipo_costo !== 'nulo')
            .map(it => it.supply_id)
            .filter(Boolean);

          if (elaboradosIds.length > 0) {
            const token = localStorage.getItem('token') || '';
            Promise.all(
              elaboradosIds.map(id =>
                fetch(`${BASE}/businesses/${businessId}/insumos/${id}/receta`, {
                  headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) }
                })
                  .then(r => r.json())
                  .then(d => {
                    const r = d?.receta;
                    if (!r) return null;
                    return [String(id), {
                      costoTotal: Number(r.costo_total) || 0,
                      porciones: Number(r.porciones) || 1,
                      precioSugerido: Number(d.precio_sugerido) || 0,
                    }];
                  })
                  .catch(() => null)
              )
            ).then(results => {
              const mapa = {};
              results.filter(Boolean).forEach(([id, data]) => { mapa[id] = data; });
              if (Object.keys(mapa).length > 0) {
                setLocalRecetasElaborados(prev => ({ ...prev, ...mapa }));
              }
            });
          }

        } else {
          setNombre(artNombre);
          setRendimiento(1);
          setPctCostoIdeal(resolveObjetivo(null));
          setNotas('');
          setNotasUpdatedAt(null);
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

  // Items ordenados por costo descendente (opcional)
  const itemsOrdenados = useMemo(() => {
    if (!sortByCosto) return items;
    return [...items].sort((a, b) => {
      const getCosto = (it) => {
        const elaborado = it.supplyId ? localRecetasElaborados[String(it.supplyId)] : null;
        const cant = Number(it.cantidad) || 0;
        if (elaborado) return ((elaborado.costoTotal || 0) / (Number(elaborado.porciones) || 1)) * cant;
        return calcPrecioEnUnidad(Number(it.precioRefDB) || 0, it.supplyMedida || 'u', it.unidad || it.supplyMedida || 'u') * cant;
      };
      return getCosto(b) - getCosto(a);
    });
  }, [items, sortByCosto, localRecetasElaborados]);

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
      // Si la última fila no tiene insumo, no agregar otra — solo enfocar la búsqueda
      const last = prev[prev.length - 1];
      if (last && !last.supplyId) {
        setNewItemIndex(prev.length - 1);
        setOpenSearchIdx(prev.length - 1); // ← sincronizar para evitar race con el useEffect del remove
        return prev;
      }
      const next = [...prev, {
        supplyId: null, supplyNombre: '', supplyMedida: 'u',
        cantidad: 1,
        unidad: 'u', costoUnitario: '',
        merma: true, pedido: true, tipoCosto: 'total',
        ultimaCompra: null, observaciones: '', updatedAt: null,
      }];
      setNewItemIndex(next.length - 1);
      setOpenSearchIdx(next.length - 1); // ← sincronizar para evitar race con el useEffect del remove
      return next;
    });
  }, []);;

  /* ── Cálculos ── */
  const costoTotal = useMemo(() =>
    items.reduce((acc, it) => {
      if (it.tipoCosto === 'nulo') return acc;
      if (Number(it.cantidad) < 0) return acc;
      const cant = Number(it.cantidad) || 0;
      const elaborado = it.supplyId ? localRecetasElaborados[String(it.supplyId)] : null;
      let precioU;

      if (elaborado) {
        const porciones = Number(elaborado.porciones) || 1;
        const unidadDB = canonicalUnit(it.supplyMedida || 'u');
        const unidadElegida = canonicalUnit(it.unidad || unidadDB);
        const factor = getConversionFactor(unidadDB, unidadElegida);

        if (it.tipoCosto === 'sugerido' && elaborado.precioSugerido > 0) {
          precioU = elaborado.precioSugerido / factor;
        } else {
          precioU = elaborado.costoTotal > 0 ? (elaborado.costoTotal / porciones) / factor : 0;
        }
      } else {
        // ← este bloque falta o está roto
        precioU = calcPrecioEnUnidad(
          Number(it.precioRefDB) || 0,
          it.supplyMedida || 'u',
          it.unidad || it.supplyMedida || 'u'
        );
      }

      return acc + cant * precioU;
    }, 0),
    [items, localRecetasElaborados]);

  const costoXRendimiento = rendimiento > 0 ? costoTotal / rendimiento : 0;
  const precioSugerido = pctCostoIdeal > 0 ? costoXRendimiento / (pctCostoIdeal / 100) : 0;
  const pctCostoActual = precioActual > 0 ? (costoXRendimiento / precioActual) * 100 : null;
  const estaPorDebajo = precioActual > 0 && precioSugerido > 0 && precioActual < precioSugerido;

  /* ── Guardar ── */
  const handleSave = async () => {
    setError('');

    // ← Filtrar filas vacías antes de validar
    const itemsValidos = items.filter(it => it.supplyId);

    const tieneContenido = itemsValidos.length > 0 || notas || foto || pctCostoIdeal !== 30;
    if (!tieneContenido) { setError('Agregá al menos un ingrediente'); return; }
    if (hasDuplicates) { setError('Hay ingredientes duplicados'); return; }

    const itemsOrdenados = [...itemsValidos].sort((a, b) => {
      const getCosto = (it) => {
        const elaborado = it.supplyId ? localRecetasElaborados[String(it.supplyId)] : null;
        const cant = Number(it.cantidad) || 0;
        if (elaborado) return ((elaborado.costoTotal || 0) / (Number(elaborado.porciones) || 1)) * cant;
        return calcPrecioEnUnidad(Number(it.precioRefDB) || 0, it.supplyMedida || 'u', it.unidad || it.supplyMedida || 'u') * cant;
      };
      return getCosto(b) - getCosto(a);
    });
    setItems(itemsOrdenados);

    const payload = {
      nombre: nombre || artNombre,
      porciones: Math.max(1, Number(rendimiento) || 1),
      porcentajeVenta: pctCostoIdeal,
      notas,
      notasUpdatedAt: notasUpdatedAt || null,
      foto,
      items: itemsOrdenados.map(it => {
        const elaborado = it.supplyId ? localRecetasElaborados[String(it.supplyId)] : null;
        const porciones = Number(elaborado?.porciones) || 1;
        let costoUnitario;
        if (elaborado) {
          const unidadDB = canonicalUnit(it.supplyMedida || 'u');
          const unidadElegida = canonicalUnit(it.unidad || unidadDB);
          const factor = getConversionFactor(unidadDB, unidadElegida);
          costoUnitario = it.tipoCosto === 'sugerido' && elaborado.precioSugerido > 0
            ? elaborado.precioSugerido / factor
            : (elaborado.costoTotal > 0 ? (elaborado.costoTotal / porciones) / factor : 0);
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
          fotosUrls: Array.isArray(it.fotosUrls) ? it.fotosUrls : (it.fotoUrl ? [it.fotoUrl] : []),
          updatedAt: it.updatedAt || new Date().toISOString(),
        };
      }),
    };

    setSaving(true);
    try {
      const postUrl = saveRecetaUrl || `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta`;
      const token = localStorage.getItem('token') || '';
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || d?.error || `Error ${res.status}`);
      }
      const json = await res.json();
      const saved = json?.receta ?? json;
      setReceta(saved);
      setSuccess(true);

      // ← Propagar a gemelos si los hay
      if (gemelosGroup?.members?.length > 1) {
        fetch(
          `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta/propagate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Business-Id': String(businessId),
              'Content-Type': 'application/json',
            },
          }
        ).catch(e => console.warn('[handleSave] propagate falló:', e.message));
      }

      onSaved?.({
        ...saved,
        article_id: articulo.id,
        costo_total: costoTotal,
        costo_por_porcion: costoXRendimiento,
        precio_sugerido: json?.precio_sugerido ?? precioSugerido,
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
      const deleteUrl = `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta`;
      const res = await fetch(deleteUrl, {
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
      // Sacar el artículo del grupo de gemelos (autodesvinculación).
      // El resto de gemelos mantiene su receta igual — consistente con "quitar de vinculación" en la tabla.
      if (gemelosGroup?.groupId) {
        try {
          await fetch(
            `${BASE}/businesses/${businessId}/article-links/${gemelosGroup.groupId}/members/${articulo.id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) } }
          );
          try { window.dispatchEvent(new CustomEvent('article:links-changed')); } catch { }
        } catch (e) {
          console.warn('[handleDelete] no se pudo autodesvincular:', e.message);
        }
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

  const handleClose = useCallback(async () => {
    if (saving || deleting) return;
    // Si hay items cargados, guardar automáticamente antes de cerrar
    const tieneContenido = items.length > 0 || notas || foto;
    if (tieneContenido && !hasDuplicates && !items.some(it => !it.supplyId)) {
      await handleSave();
    } else {
      onClose();
    }
  }, [saving, deleting, items, notas, foto, hasDuplicates, handleSave]);

  const handleCancel = useCallback(() => {
    if (saving || deleting) return;
    onClose();
  }, [saving, deleting, onClose]);

  useEffect(() => {
    if (!open || !articulo?.id || !businessId) return;
    const token = localStorage.getItem('token') || '';

    // 1. Obtener orgId del negocio
    fetch(`${BASE}/businesses/${businessId}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) }
    })
      .then(r => r.json())
      .then(biz => {
        const oid = biz?.organization_id;
        if (!oid) return;
        setOrgIdLocal(oid);

        // 2. Cargar config de listas
        return fetch(`${BASE}/organizations/${oid}/price-lists/config`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) }
        })
          .then(r => r.json())
          .then(d => {
            setPriceLists(d?.config || []);

            // 3. Cargar exclusiones de este artículo
            return fetch(`${BASE}/organizations/${oid}/price-lists/discount-exceptions`, {
              headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) }
            })
              .then(r => r.json())
              .then(exc => {
                const excSet = new Set();
                (exc?.exceptions || []).forEach(e => {
                  if (e.scope === 'articulo' && String(e.scope_id) === String(articulo.id)) {
                    excSet.add(e.list_number);
                  }
                });
                setExclusionesArt(excSet);
              });
          });
      })
      .catch(() => { });
  }, [open, articulo?.id, businessId]);

  // Toggle exclusión de una lista
  const toggleExclusionLista = useCallback(async (listNumber) => {
    if (!orgIdLocal || !articulo?.id) return;
    const token = localStorage.getItem('token') || '';
    const isExcluido = exclusionesArt.has(listNumber);

    try {
      const url = `${BASE}/organizations/${orgIdLocal}/price-lists/discount-exceptions`;
      await fetch(url, {
        method: isExcluido ? 'DELETE' : 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: 'articulo', scopeId: String(articulo.id), listNumber }),
      });

      setExclusionesArt(prev => {
        const next = new Set(prev);
        isExcluido ? next.delete(listNumber) : next.add(listNumber);
        return next;
      });
    } catch (e) { console.error('[toggleExclusionLista]', e.message); }
  }, [orgIdLocal, articulo?.id, exclusionesArt, businessId]);

  // Toggle TODAS las listas no-principales
  const toggleExclusionTodas = useCallback(async () => {
    const noPrincipales = priceLists.filter(l => !l.isPrincipal);
    const todasExcluidas = noPrincipales.every(l => exclusionesArt.has(l.listNumber));

    for (const l of noPrincipales) {
      if (todasExcluidas) {
        if (exclusionesArt.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      } else {
        if (!exclusionesArt.has(l.listNumber)) await toggleExclusionLista(l.listNumber);
      }
    }
  }, [priceLists, exclusionesArt, toggleExclusionLista]);

  return (
    <>
      <Modal open={open} onClose={handleClose}>
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
              {/* Botón exclusión de descuentos */}
              {priceLists.length > 0 && (
                <Tooltip title="Excluir de listas con descuento/recargo">
                  <IconButton
                    size="small"
                    onClick={(e) => setExcluirAnchor(e.currentTarget)}
                    sx={{
                      color: 'inherit',
                      opacity: exclusionesArt.size > 0 ? 1 : 0.7,
                      '&:hover': { opacity: 1 }
                    }}
                  >
                    <LocalOfferIcon fontSize="small" />
                    {exclusionesArt.size > 0 && (
                      <Box sx={{
                        position: 'absolute', top: 2, right: 2, width: 8, height: 8,
                        borderRadius: '50%', bgcolor: '#fbbf24', border: '1px solid #fff',
                      }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}

              {/* Notas + foto */}
              <Tooltip title={notas || foto ? 'Notas e imagen' : 'Agregar notas'}>
                <IconButton size="small" onClick={() => setNotasModalOpen(true)} sx={{ color: 'inherit' }}>
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* Vista Cocina */}
              <Tooltip title="Vista Cocina">
                <IconButton size="small" onClick={() => setCocinaModalOpen(true)}
                  sx={{ color: 'inherit', opacity: 0.85, '&:hover': { opacity: 1 } }}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton onClick={handleClose} size="small" sx={{ color: 'inherit' }}>
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
                    onBlur={(e) => {
                      const val = Number(e.target.value) || 0;
                      if (!val || !articulo?.id) return;
                      onPriceConfigSave?.({
                        scope: 'articulo',
                        scopeId: String(articulo.id),
                        objetivo: val,
                      });
                    }}
                    size="small"
                    inputProps={{ min: 0, max: 150 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Box>

                {/* ── Panel de gemelos — entre datos generales e ingredientes ── */}
                {!esElaborado && (
                  <Box sx={{ mb: 1.5 }}>
                    {/* Header colapsable */}
                    <Box onClick={() => {
                      setGemelosOpen(v => !v);
                      if (!gemelosOpen) {
                        setTimeout(() => gemelosSearchRef.current?.focus(), 50);
                      }
                    }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        cursor: 'pointer', py: 0.6, px: 1, borderRadius: 1,
                        bgcolor: gemelosGroup ? 'rgba(124,58,237,0.06)' : 'transparent',
                        border: '1px solid', borderColor: gemelosGroup ? 'rgba(124,58,237,0.2)' : 'divider',
                        '&:hover': { bgcolor: 'rgba(124,58,237,0.06)' }, transition: 'all .15s',
                      }}>
                      <Box sx={{ fontSize: 13, color: '#7c3aed' }}>🔗</Box>
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#7c3aed', fontSize: '0.75rem', flex: 1 }}>
                        {gemelosGroup
                          ? (() => {
                            const otros = (gemelosGroup.members || []).filter(m => Number(m.article_id) !== Number(articulo?.id)).length;
                            return `Gemelos (${otros} artículo${otros !== 1 ? 's' : ''} comparten esta receta)`;
                          })()
                          : 'Vincular receta con otro artículo'}
                      </Typography>
                      {gemelosLoading && <CircularProgress size={11} />}
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{gemelosOpen ? '▲' : '▼'}</Typography>
                    </Box>
                    {gemelosOpen && (
                      <Box ref={gemelosPanelRef} sx={{ mt: 0.75, border: '1px solid', borderColor: 'rgba(124,58,237,0.15)', borderRadius: 1, bgcolor: 'rgba(124,58,237,0.02)', overflow: 'visible' }}>

                        {/* Header columnas */}
                        <Box sx={{
                          display: 'grid', gridTemplateColumns: '1fr 90px 28px',
                          gap: 1, px: 1.25, pt: 0.75, pb: 0.25,
                          borderBottom: '1px solid rgba(124,58,237,0.08)',
                        }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Artículo
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                            Objetivo %
                          </Typography>
                          <Box />
                        </Box>

                        {/* Buscador como primera línea */}
                        <Box sx={{ px: 0.75, pt: 0.5 }}>
                          <Box sx={{ position: 'relative' }}>
                            <TextField
                              inputRef={gemelosSearchRef}
                              size="small"
                              fullWidth
                              placeholder="Buscar artículo para vincular…"
                              value={gemelosSearch}
                              onChange={e => {
                                setGemelosSearch(e.target.value);
                                if (e.target.value.length >= 1) buscarGemelos(e.target.value);
                                else setGemelosResults([]);
                              }}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">
                                  {gemelosSearching ? <CircularProgress size={12} /> : <SearchIcon sx={{ fontSize: 14, color: '#7c3aed' }} />}
                                </InputAdornment>,
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 1,
                                  fontSize: '0.78rem',
                                  bgcolor: '#fff',
                                  minHeight: 32,
                                  '& fieldset': { borderColor: 'rgba(124,58,237,0.2)' },
                                },
                              }}
                            />
                            {gemelosResults.length > 0 && (
                              <Box sx={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                                bgcolor: 'background.paper', border: '1px solid', borderColor: 'rgba(124,58,237,0.2)',
                                borderRadius: 1.5, boxShadow: 6, mt: 0.5, maxHeight: 200, overflowY: 'auto',
                              }}>
                                {gemelosResults.map(art => {
                                  const yaGemelo = gemelosGroup?.members?.some(m => Number(m.article_id) === Number(art.id));
                                  const tieneReceta = !!art.tiene_receta;
                                  if (Number(art.id) === Number(articulo?.id)) return null;
                                  return (
                                    <Box key={art.id}
                                      onClick={async () => {
                                        if (yaGemelo || tieneReceta) return;
                                        await agregarGemelo(art.id);
                                        setGemelosSearch('');
                                        setGemelosResults([]);
                                        gemelosSearchRef.current?.focus();
                                      }}
                                      sx={{
                                        px: 1.5, py: 0.6, cursor: (yaGemelo || tieneReceta) ? 'default' : 'pointer',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        borderBottom: '1px solid', borderColor: 'divider',
                                        opacity: tieneReceta ? 0.5 : 1,
                                        '&:hover': { bgcolor: (yaGemelo || tieneReceta) ? 'transparent' : 'rgba(124,58,237,0.06)' },
                                      }}>
                                      <Box sx={{ overflow: 'hidden' }}>
                                        <Typography variant="body2" noWrap fontWeight={600} sx={{ fontSize: '0.78rem' }}>
                                          {art.nombre || art.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                          #{art.id} {tieneReceta && '· Ya tiene receta propia'}
                                        </Typography>
                                      </Box>
                                      <Chip
                                        label={yaGemelo ? '✓' : tieneReceta ? 'Con receta' : '+ Vincular'}
                                        size="small"
                                        sx={{
                                          height: 18, fontSize: '0.62rem', ml: 1, flexShrink: 0,
                                          bgcolor: tieneReceta ? '#fee2e2' : yaGemelo ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.1)',
                                          color: tieneReceta ? '#ef4444' : '#7c3aed',
                                          border: `1px solid ${tieneReceta ? '#fecaca' : 'rgba(124,58,237,0.2)'}`,
                                        }}
                                      />
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Gemelos actuales — DEBAJO del buscador */}
                        <Box sx={{ px: 0.75, pt: 0.5, pb: 0.75 }}>
                          {gemelosGroup?.members
                            ?.filter(m => Number(m.article_id) !== Number(articulo?.id))
                            .map(m => {
                              const objVal = m.pct_objetivo;
                              return (
                                <Box
                                  key={m.article_id}
                                  onClick={() => {
                                    pushElaborado({
                                      id: m.article_id,
                                      nombre: m.nombre || `#${m.article_id}`,
                                      precio: 0,
                                      esArticulo: true,
                                      pctObjetivo: m.pct_objetivo,
                                    });
                                  }}
                                  sx={{
                                    display: 'grid', gridTemplateColumns: '1fr 90px 28px',
                                    alignItems: 'center', gap: 1,
                                    py: 0.5, px: 0.5, borderRadius: 1, mb: 0.35,
                                    bgcolor: '#fff',
                                    border: '1px solid #eaecf0',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    '&:hover': {
                                      bgcolor: 'rgba(124,58,237,0.04)',
                                      borderColor: 'rgba(124,58,237,0.3)',
                                    },
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, overflow: 'hidden' }}>
                                    <Typography variant="caption" sx={{
                                      fontSize: '0.63rem', color: 'text.disabled', flexShrink: 0,
                                      bgcolor: '#f1f5f9', px: 0.5, py: '1px', borderRadius: 0.5,
                                    }}>
                                      #{m.article_id}
                                    </Typography>
                                    <Typography
                                      variant="caption" noWrap
                                      sx={{
                                        fontSize: '0.78rem', fontWeight: 500,
                                        color: 'text.primary', flex: 1, minWidth: 0,
                                      }}
                                    >
                                      {m.nombre || `Artículo #${m.article_id}`}
                                    </Typography>
                                  </Box>

                                  <Box
                                    onClick={(e) => e.stopPropagation()}
                                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}
                                  >
                                    <TextField
                                      size="small"
                                      type="number"
                                      defaultValue={objVal != null ? objVal : ''}
                                      placeholder="—"
                                      onClick={(e) => e.stopPropagation()}
                                      onBlur={(e) => {
                                        const raw = e.target.value;
                                        const nuevo = raw === '' ? null : Number(raw);
                                        const anterior = objVal;
                                        // Solo persistir si cambió realmente
                                        if (nuevo === anterior) return;
                                        if (nuevo != null && (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 150)) return;
                                        actualizarObjetivoGemelo(m.article_id, nuevo);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          e.target.blur();
                                        }
                                        if (e.key === 'Escape') {
                                          e.target.value = objVal != null ? objVal : '';
                                          e.target.blur();
                                        }
                                      }}
                                      inputProps={{
                                        min: 0,
                                        max: 150,
                                        style: {
                                          textAlign: 'center',
                                          fontSize: '0.78rem',
                                          fontWeight: 600,
                                          padding: '2px 4px',
                                          width: 44,
                                        },
                                      }}
                                      InputProps={{
                                        endAdornment: (
                                          <InputAdornment position="end" sx={{ ml: 0, '& .MuiTypography-root': { fontSize: '0.72rem' } }}>
                                            %
                                          </InputAdornment>
                                        ),
                                        sx: {
                                          fontSize: '0.78rem',
                                          bgcolor: '#fff',
                                          '& fieldset': { borderColor: 'transparent' },
                                          '&:hover fieldset': { borderColor: 'rgba(124,58,237,0.3) !important' },
                                          '&.Mui-focused fieldset': { borderColor: 'rgba(124,58,237,0.5) !important' },
                                        },
                                      }}
                                    />
                                  </Box>

                                  <Tooltip title="Desvincular">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        quitarGemelo(m.article_id);
                                      }}
                                      sx={{ p: '2px', color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}
                                    >
                                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              );
                            })}
                        </Box>

                      </Box>
                    )}
                  </Box>
                )}

                <Divider sx={{ mb: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Ingredientes ({items.length})
                    </Typography>                    <Tooltip title={sortByCosto ? 'Orden manual' : 'Ordenar por costo'}>
                      <IconButton size="small" onClick={() => setSortByCosto(v => !v)}
                        sx={{ p: '2px', color: sortByCosto ? PRIMARY : 'text.disabled' }}>
                        <SortIcon sx={{ fontSize: 14 }} /> {/* importar SortIcon */}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Divider>

                {/* ── Header columnas ── */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1.8fr 68px 66px 80px 28px 1fr 28px 28px',
                  gap: '4px', px: 0.5, mb: 0.5,
                }}>
                  {['', 'Insumo', 'Cantidad', 'Unidad', '$ total', '', 'Observaciones', '', ''].map((col, i) => (
                    <Typography key={i} variant="caption" color="text.secondary"
                      fontWeight={700} sx={{ fontSize: '0.68rem', textAlign: i >= 4 && i <= 6 ? 'center' : 'left' }}>
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
                    {itemsOrdenados.map((item, i) => {
                      const realIndex = items.indexOf(item); // índice real en el array original
                      return (
                        <ItemRow
                          key={realIndex}
                          item={item}
                          index={realIndex} // ← índice real, no i
                          onChange={(idx, partial) => {
                            changeItem(idx, partial);
                            if (newItemIndex === idx) setNewItemIndex(null);
                          }}
                          onRemove={removeItem}
                          onOpenCompras={(it) => setComprasInsumo(it)}
                          onOpenRecetaElaborado={(it) => {
                            const ins = insumos.find(i => String(i.id) === String(it.supplyId));
                            pushElaborado({
                              id: it.supplyId,
                              nombre: it.supplyNombre,
                              precio: ins?.precio_ref || ins?.precio || 0,
                            });
                          }}
                          insumos={insumos}
                          usedSupplyIds={usedSupplyIds}
                          alertaSemanas={alertaSemanas}
                          autoOpenSearch={newItemIndex === realIndex}
                          recetasElaborados={localRecetasElaborados}
                          articuloId={articulo?.id}
                          businessId={businessId}
                          searchOpen={openSearchIdx === realIndex}
                          onSearchOpen={() => setOpenSearchIdx(realIndex)}
                          onSearchClose={() => setOpenSearchIdx(null)}
                        />
                      );
                    })}
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

                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: Number(rendimiento) > 1 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                  gap: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1.5, p: 2,
                  mb: 2
                }}>
                  {Number(rendimiento) > 1 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
                      <Typography variant="h6" fontWeight={800}>${fmt(costoTotal)}</Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {Number(rendimiento) > 1 ? `Costo x porción (÷${Number(rendimiento)})` : 'Costo total'}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>${fmt(costoXRendimiento)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Precio sugerido ({pctCostoIdeal}% costo)</Typography>
                    <Typography variant="h6" fontWeight={800} color="success.main">{precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}</Typography>
                    {precioActual > 0 && (
                      <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: estaPorDebajo ? '#ef4444' : 'text.secondary' }}>Actual: ${fmt(precioActual)}</Typography>
                        {estaPorDebajo && <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>% Costo actual</Typography>
                    {pctCostoActual !== null ? (
                      <>
                        <Typography variant="h6" fontWeight={800} color={pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main'}>{fmt(pctCostoActual, 1)}%</Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>Ideal: {pctCostoIdeal}%</Typography>
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
            <Stack direction="row" spacing={1} alignItems="center">
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Borrar receta — solo si ya existe */}
              {receta && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={saving || deleting}
                  startIcon={deleting ? <CircularProgress size={13} color="inherit" /> : <DeleteForeverIcon />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Borrar receta
                </Button>
              )}
              <Button onClick={handleCancel} disabled={saving || deleting} color="inherit" size="small">
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
        </Box >
      </Modal >

      {/* ── Modal últimas compras ── */}
      {
        comprasInsumo && (
          <UltimasComprasModal
            item={comprasInsumo}
            businessId={businessId}
            onClose={() => setComprasInsumo(null)}
            insumos={insumos}
          />
        )
      }

      {/* ── Modal notas + foto ── */}
      {
        notasModalOpen && (
          <NotasModal
            notas={notas}
            foto={foto}
            notasUpdatedAt={notasUpdatedAt}
            articuloId={articulo?.id}
            businessId={businessId}
            esElaborado={esElaborado}  // ← agregar
            onSave={(n, f, ts) => { setNotas(n); setFoto(f); if (ts) setNotasUpdatedAt(ts); }}
            onClose={() => setNotasModalOpen(false)}
          />
        )
      }

      {/* ── Vista Cocina ── */}
      {
        cocinaModalOpen && (
          <VistaCocinaModal
            nombre={nombre || artNombre}
            rendimiento={rendimiento}
            items={items}
            notas={notas}
            foto={foto}
            onClose={() => setCocinaModalOpen(false)}
          />
        )
      }

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

      <Menu
        anchorEl={excluirAnchor}
        open={Boolean(excluirAnchor)}
        onClose={() => setExcluirAnchor(null)}
        PaperProps={{ sx: { minWidth: 240 } }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
            Excluir de listas
          </Typography>
        </Box>

        <MenuItem onClick={toggleExclusionTodas}>
          <Checkbox
            checked={priceLists.filter(l => !l.isPrincipal).every(l => exclusionesArt.has(l.listNumber))}
            indeterminate={
              exclusionesArt.size > 0 &&
              !priceLists.filter(l => !l.isPrincipal).every(l => exclusionesArt.has(l.listNumber))
            }
            size="small"
          />
          <Typography variant="body2" fontWeight={700}>Todas las listas</Typography>
        </MenuItem>

        <Divider />

        {priceLists.filter(l => !l.isPrincipal && l.discountPct != null).map(l => (
          <MenuItem key={l.listNumber} onClick={() => toggleExclusionLista(l.listNumber)}>
            <Checkbox checked={exclusionesArt.has(l.listNumber)} size="small" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2">{l.alias}</Typography>
              <Typography variant="caption" color="text.secondary">
                {l.tipo === 'descuento' ? '−' : '+'}{l.discountPct}%
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {
        elaboradosStack.map((elaborado, stackIdx) => (
          <RecetaModal
            key={`elaborado-${elaborado.id}-${stackIdx}`}
            open={true}
            esElaborado={!elaborado.esArticulo}  // ← false si es artículo gemelo
            costoObjetivoExterno={elaborado.pctObjetivo != null ? Number(elaborado.pctObjetivo) : globalConfigObjetivo}
            onClose={() => {
              if (stackIdx === elaboradosStack.length - 1) {
                popElaborado();
                // Si estamos cerrando el último del stack, refrescar gemelos del modal base
                // para reflejar cambios de objetivo individuales
                if (elaboradosStack.length === 1) {
                  loadGemelosGroup();
                }
              }
            }}
            articulo={elaborado}
            businessId={businessId}
            getRecetaUrl={
              elaborado.esArticulo
                ? `${BASE}/businesses/${businessId}/articles/${elaborado.id}/receta`
                : `${BASE}/businesses/${businessId}/insumos/${elaborado.id}/receta`
            }
            saveRecetaUrl={
              elaborado.esArticulo
                ? `${BASE}/businesses/${businessId}/articles/${elaborado.id}/receta`
                : `${BASE}/businesses/${businessId}/insumos/${elaborado.id}/receta`
            }
            recetasElaborados={localRecetasElaborados}
            onSaved={(saved) => {
              popElaborado();
              // Refrescar gemelos del modal base si era el último
              if (elaboradosStack.length === 1) {
                loadGemelosGroup();
              }
              if (saved?.costo_total != null || saved?.costo_por_porcion != null) {
                const costoTotal = saved.costo_total ?? (saved.costo_por_porcion * (saved.porciones || 1));
                const porciones = saved.porciones || 1;
                const precioSugerido = saved.precio_sugerido || 0;
                setLocalRecetasElaborados(prev => ({
                  ...prev,
                  [String(elaborado.id)]: { costoTotal, porciones, precioSugerido },
                }));
                setInsumos(prev => prev.map(ins =>
                  String(ins.id) === String(elaborado.id)
                    ? { ...ins, es_elaborado: true, tiene_receta: true }
                    : ins
                ));
                setItems(prev => prev.map(it =>
                  String(it.supplyId) === String(elaborado.id)
                    ? { ...it, _refreshed: Date.now() }
                    : it
                ));
              }
            }}
          />
        ))
      }
    </>
  );
}