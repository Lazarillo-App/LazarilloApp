/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-undef */
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
  DialogActions, DialogContentText, Menu,
  ToggleButton, ToggleButtonGroup, Slider, Popover,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import NotesIcon from '@mui/icons-material/Notes';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageIcon from '@mui/icons-material/Image';
import TuneIcon from '@mui/icons-material/Tune';
import SortIcon from '@mui/icons-material/Sort';
import EditIcon from '@mui/icons-material/Edit';
import { getReceta, saveReceta } from '@/servicios/apiOrganizations';
import {
  insumosList,
  insumoEquivalenciasList,
  insumoGet,
  insumoEquivalenciaCreate,
  insumoEquivalenciaUpdate,
  insumoEquivalenciaDelete,
  insumoMermasList,
  insumoMermaCreate,
  insumoMermaUpdate,
  insumoMermaDelete,
  insumoDesperdicioOverride,
  insumoReemplazarPreview,
  insumoUsoList,
  insumoReemplazar,
  insumoUpdate,
  insumoComprasList,
} from '@/servicios/apiInsumos';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/cropImage';
import { BASE } from '@/servicios/apiBase';
import { useConfig } from '@/context/ConfigContext';
import ExcluirListasModal from './ExcluirListasModal';
import { createOrMoveAgrupacion } from '@/servicios/apiAgrupaciones';
import { PromocionesAPI, BusinessesAPI } from '@/servicios/apiBusinesses';
import { ComprasDetalleContenido } from './ComprasMiniDetalleModal';
import { sanitizeDecimal, parseDecimal } from '@/utils/decimales';

/* ── constantes ── */
const UNIDADES = ['u', 'kg', 'gr', 'lt', 'ml', 'oz'];
const TIPO_COSTO_OPTS = [
  { value: 'total', label: 'Total' },
  { value: 'nulo', label: 'Nulo' },
  { value: 'sugerido', label: 'Precio sugerido' },
];

const PRIMARY = 'var(--color-primary, #3b82f6)';
const ON_PRIMARY = 'var(--on-primary, #fff)';
const DEFAULT_LIST_COLORS = ['#2492C8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const colorForList = (list, idx) => list?.color || DEFAULT_LIST_COLORS[idx % DEFAULT_LIST_COLORS.length];

const fmt = (v, d = 2) => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (s) => {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d)) return null;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return null; }
};

/* ── Step progresivo de cantidad para las flechitas ──
   Bandas por magnitud: <10 → 0.5 | <100 → 5 | ≥100 → 50
   Redondea al escalón de la banda (10▼=9.5, 100▼=95). Cruza el 0 espejado. */
function stepCantidad(valor, dir) {
  const v = Number(valor) || 0;
  const stepFor = (a) => (a < 10 ? 0.5 : a < 100 ? 5 : 50);
  if (v >= 0) {
    if (dir > 0) {
      const s = stepFor(v + 1e-9);
      return Number((Math.floor(v / s + 1e-9) * s + s).toFixed(4));
    }
    const s = stepFor(v - 1e-9);
    return Number((Math.ceil(v / s - 1e-9) * s - s).toFixed(4));
  }
  // v < 0: operar sobre la magnitud con dirección invertida (▲ acerca a 0)
  const mag = -v;
  if (dir > 0) {
    const s = stepFor(mag - 1e-9);
    return Number((-(Math.ceil(mag / s - 1e-9) * s - s)).toFixed(4));
  }
  const s = stepFor(mag + 1e-9);
  return Number((-(Math.floor(mag / s + 1e-9) * s + s)).toFixed(4));
}

/* ── helpers de conversión de unidades ── */
function normUnit(u) {
  return String(u || 'u').toLowerCase().trim();
}

// Mapa de variantes → unidad canónica. Cubre lo que viene de MaxiRest y cargas manuales
// (mayúsculas, plurales, abreviaturas). Cualquier variante no listada se trata como
// unidad discreta (se devuelve tal cual, sin romper la familia).
const UNIT_ALIASES = {
  // peso → gr
  g: 'gr', gr: 'gr', grs: 'gr', gramo: 'gr', gramos: 'gr',
  // peso → kg
  k: 'kg', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  // volumen → ml
  ml: 'ml', mls: 'ml', cc: 'ml', mililitro: 'ml', mililitros: 'ml',
  // volumen → lt
  l: 'lt', lt: 'lt', lts: 'lt', litro: 'lt', litros: 'lt',
  // unidad → u
  u: 'u', un: 'u', uni: 'u', unid: 'u', unidad: 'u', unidades: 'u', und: 'u',
  doc: 'u', docena: 'u',
  // otras de peso
  oz: 'oz', onza: 'oz', onzas: 'oz', lb: 'lb', libra: 'lb', libras: 'lb',
};
function canonicalUnit(u) {
  const n = normUnit(u);
  return UNIT_ALIASES[n] || n;
}

// Devuelve las unidades válidas para elegir en la receta según la unidad base del insumo.
// - peso (kg/gr) → [gr, kg]
// - volumen (lt/ml/oz) → [ml, lt, oz]
// - unidad/porción CON envase → [u] + las del tipo del envase; SIN envase → [u]
function unidadesParaInsumo(insumoData) {
  const base = canonicalUnit(insumoData?.unidad_med || insumoData?.medida || 'u');
  const PESO = ['gr', 'kg'];
  const VOLUM = ['ml', 'lt', 'oz'];
  if (PESO.includes(base)) return PESO;
  if (VOLUM.includes(base)) return VOLUM;
  // base 'u' o 'porcion': ver si tiene envase cargado
  const contEnvase = Number(insumoData?.contenido_envase) || 0;
  const uniEnvase = canonicalUnit(insumoData?.unidad_envase || '');
  if (contEnvase > 0 && uniEnvase) {
    if (PESO.includes(uniEnvase)) return ['u', ...PESO];
    if (VOLUM.includes(uniEnvase)) return ['u', ...VOLUM];
  }
  return ['u'];
}

function getConversionFactor(from, to) {
  const PESO = { gr: 1, gramo: 1, gramos: 1, g: 1, k: 1000, kg: 1000, kilo: 1000, kilos: 1000, kilogramo: 1000, oz: 28.35, onza: 28.35, lb: 453.59 };
  const VOLUM = { ml: 1, cc: 1, lt: 1000, l: 1000, litro: 1000, litros: 1000, oz: 30, 'oz fl': 29.57 };
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return 1;
  if (PESO[f] !== undefined && PESO[t] !== undefined) return PESO[f] / PESO[t];
  if (VOLUM[f] !== undefined && VOLUM[t] !== undefined) return VOLUM[f] / VOLUM[t];
  // Cruce peso↔volumen: asumir densidad 1 (1gr = 1ml) — llevar ambos a su base (gr/ml) y convertir
  const pesoF = PESO[f], volF = VOLUM[f];
  const pesoT = PESO[t], volT = VOLUM[t];
  const baseF = pesoF !== undefined ? pesoF : volF; // valor en gr o ml
  const baseT = pesoT !== undefined ? pesoT : volT;
  if (baseF !== undefined && baseT !== undefined) return baseF / baseT;
  return 1;
}

function isCompatibleUnits(a, b) {
  const PESO = new Set(['gr', 'gramo', 'gramos', 'g', 'k', 'kg', 'kilo', 'kilos', 'kilogramo', 'oz', 'onza', 'lb']);
  const VOLUM = new Set(['ml', 'cc', 'lt', 'l', 'litro', 'litros', 'oz']);
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

function calcCostoUnitarioElaborado(elaborado, unidadItem, unidadElegida, tipoCosto) {
  if (!elaborado || tipoCosto === 'nulo') return 0;
  const medibles = ['kg', 'gr', 'lt', 'ml', 'l'];
  const cantidad = Number(elaborado?.porciones) || 1;          // divisor SIEMPRE = cantidad
  const pesoEq = Number(elaborado?.rendimientoPeso) || 0;
  const rendUnidad = canonicalUnit(elaborado?.rendimientoUnidad || 'porcion');
  const costoBase = (tipoCosto === 'sugerido' && (elaborado?.precioSugerido ?? 0) > 0)
    ? elaborado.precioSugerido * cantidad
    : (elaborado?.costoTotal ?? 0);
  // 1) Costo por UNIDAD de rendimiento (dividir por cantidad, NO por peso)
  const costoPorUnidad = costoBase / (cantidad > 0 ? cantidad : 1);
  const uElegida = canonicalUnit(unidadElegida || rendUnidad);
  // 2) Rendimiento medible (kg/gr/lt/ml): la unidad de rendimiento ya es física
  if (medibles.includes(rendUnidad)) {
    const factor = getConversionFactor(rendUnidad, uElegida);
    return factor > 0 ? costoPorUnidad / factor : costoPorUnidad;
  }
  // 3) Rendimiento en porción/unidad:
  //    - misma unidad (u/porción) → costo por unidad completo
  //    - peso/volumen con pesoEq definido → convertir vía peso equivalente
  if (uElegida === rendUnidad || uElegida === 'u' || uElegida === 'porcion') {
    return costoPorUnidad;
  }
  const isPeso = (u) => ['gr', 'kg', 'oz', 'lb'].includes(canonicalUnit(u));
  const isVolum = (u) => ['ml', 'lt'].includes(canonicalUnit(u));
  if (pesoEq > 0 && (isPeso(uElegida) || isVolum(uElegida))) {
    const unidadFisica = canonicalUnit(elaborado?.unidadPeso || 'gr');
    const costoPorUnidadFisica = costoPorUnidad / pesoEq;      // costo por 1 unidadFísica
    const factor = getConversionFactor(unidadFisica, uElegida);
    return factor > 0 ? costoPorUnidadFisica / factor : costoPorUnidadFisica;
  }
  return costoPorUnidad;
}

/* ── colores de alerta de última compra ── */
function getAlertaColor(ultimaCompra, alertaSemanas, esElaborado = false) {
  // Los insumos elaborados no se compran, tienen receta. No aplica alerta.
  if (esElaborado) return null;
  // Insumo que nunca tuvo compras: no es una alerta útil ("hace mucho que no comprás"
  // no aplica si nunca se compró). La referencia de precio se maneja aparte.
  if (!ultimaCompra) return null;
  const d = new Date(ultimaCompra);
  if (isNaN(d)) return alertaSemanas ? '#fef2f2' : null;
  const semanas = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 7);
  return semanas > Number(alertaSemanas) ? '#fef2f2' : null;
}

/**
 * Fila de resultado de búsqueda (insumo). Compartida entre el buscador de
 * ingredientes y la lupa del header. Presentación pura: mismas reglas de
 * costo (4 casos), colores por compras, badges y fecha.
 * @param {object} ins - insumo (con campos receta_*, precio_*, fecha_ultima_compra)
 * @param {object} opts - { alertaSemanas, onClick, keySuffix, selected }
 */
function FilaResultadoInsumo({ ins, alertaSemanas, onClick, selected = false }) {
  const esElab = ins.es_elaborado === true || ins.tiene_receta === true;
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.75, cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      }}>
      <Box>
        <Typography component="span" variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', display: 'block' }}>
          {ins.nombre}
          {!esElab && <Chip label="Insumo" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: `${PRIMARY}15`, color: PRIMARY }} />}
          {esElab && <Chip label="Elaborado" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#f0fdf4', color: '#16a34a' }} />}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {ins.codigo_maxi || ins.codigo_mostrar ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}` : ins.unidad_med || ins.medida || 'u'}
          {(() => {
            if (esElab) {
              const f = fmtDate(ins.receta_updated_at);
              return f ? ` · Mod: ${f}` : '';
            }
            const f = fmtDate(ins.fecha_ultima_compra);
            return f ? ` · Compra: ${f}` : ' · Sin compras';
          })()}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0, ml: 1 }}>
        {(() => {
          if (esElab) {
            const porc = Number(ins.receta_porciones) || 1;
            const costoUnit = Number(ins.receta_costo_unitario) || 0;
            const costoTot = Number(ins.costo_receta) || 0;
            const rendU = ins.receta_rend_unidad || 'porcion';
            const conRendimiento = porc > 1;
            const valor = conRendimiento ? costoUnit : costoTot;
            const etiqueta = conRendimiento
              ? (rendU === 'porcion' ? '/porción' : `/${canonicalUnit(rendU)}`)
              : '';
            return (
              <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a', fontSize: '0.8rem' }}>
                {valor > 0 ? `$${fmt(valor)}${etiqueta}` : ''}
              </Typography>
            );
          }
          const p = Number(ins.precio_ref) || Number(ins.precio_promedio_periodo) || Number(ins.precio_promedio) || Number(ins.precio_ultima_compra) || Number(ins.precio) || 0;
          const sinCompraReciente = !!getAlertaColor(ins.fecha_ultima_compra, alertaSemanas, false);
          const tieneCompraAlDia = !!ins.fecha_ultima_compra && !sinCompraReciente;
          const colorPrecio = sinCompraReciente ? '#ef4444' : (tieneCompraAlDia ? '#16a34a' : PRIMARY);
          return (
            <>
              {sinCompraReciente && (
                <Tooltip title={ins.fecha_ultima_compra
                  ? `Última compra: ${fmtDate(ins.fecha_ultima_compra)} — precio posiblemente desactualizado`
                  : 'Sin compras registradas — precio de referencia, no de compra'}>
                  <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
                </Tooltip>
              )}
              <Typography variant="body2" fontWeight={700} sx={{ color: colorPrecio, fontSize: '0.8rem' }}>
                {p > 0 ? `$${fmt(p)}` : '—'}
              </Typography>
            </>
          );
        })()}
      </Box>
    </Box>
  );
}

/**
 * Ordena insumos con las mismas reglas del buscador de ingredientes:
 * 1) con compras primero  2) más compras primero  3) precio asc  4) alfabético.
 * (Sin la parte de búsqueda numérica de código, que aplica solo al filtrar.)
 */
function ordenarInsumosBusqueda(list) {
  return [...list].sort((a, b) => {
    const aCompra = !!a.fecha_ultima_compra;
    const bCompra = !!b.fecha_ultima_compra;
    if (aCompra !== bCompra) return aCompra ? -1 : 1;
    if (aCompra && bCompra) {
      const aCnt = Number(a.cantidad_compras || 0);
      const bCnt = Number(b.cantidad_compras || 0);
      if (aCnt !== bCnt) return bCnt - aCnt;
    }
    const aP = Number(a.precio_ref ?? a.precio_promedio ?? a.precio ?? 0);
    const bP = Number(b.precio_ref ?? b.precio_promedio ?? b.precio ?? 0);
    if (aP > 0 && bP > 0) return aP - bP;
    if (aP > 0) return -1;
    if (bP > 0) return 1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
  });
}

/* ════════════════════════════════════════
   MODAL DE NOTAS + FOTO
════════════════════════════════════════ */
function NotasModal({
  notas,
  foto,
  fotos,
  notasUpdatedAt,
  onSave,
  onClose,
  articuloId,
  businessId,
  esElaborado,
}) {
  const [localNotas, setLocalNotas] = useState(notas || '');
  // Array de fotos (hasta 6). Compat: si viene `fotos` la usa, si no cae al `foto` single.
  const [localFotos, setLocalFotos] = useState(() => {
    if (Array.isArray(fotos) && fotos.length) return fotos.filter(Boolean).slice(0, 6);
    return foto ? [foto] : [];
  });

  // Snapshot inicial para detectar cambios al cerrar
  const initialNotasRef = useRef(notas || '');
  const initialFotosRef = useRef(
    Array.isArray(fotos) && fotos.length ? fotos.filter(Boolean).slice(0, 6) : (foto ? [foto] : [])
  );

  // Cierre "accidental" (X, click afuera): guarda solo si cambió algo
  const handleCloseGuardando = () => {
    const cambio =
      localNotas !== initialNotasRef.current ||
      JSON.stringify(localFotos) !== JSON.stringify(initialFotosRef.current);
    if (cambio) {
      const now = new Date().toISOString();
      onSave(localNotas, localFotos, now);
    }
    onClose();
  };

  const [fotoActiva, setFotoActiva] = useState(0); // índice de la foto que se está viendo
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
  const [fotoParaEditar, setFotoParaEditar] = useState(null); // foto cruda esperando recorte

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFotoParaEditar(ev.target.result); // abrir editor en vez de guardar directo
    reader.readAsDataURL(file);
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
          if (!localFotos.includes(nueva)) {
            setFotoParaEditar(nueva); // abrir editor con la foto del celular
            setHayFotosQR(true);
            setUploadError('📱 Foto recibida del celular — ajustala y guardá');
          }
        }
      } catch { }
    }, 4000);
  };

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  return (
    <>
      <Modal open onClose={handleCloseGuardando}>
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
            <IconButton size="small" onClick={handleCloseGuardando} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
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
            {localFotos.length > 0 ? (
              <Box>
                {/* Foto activa con navegación */}
                <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <img
                    src={localFotos[fotoActiva]}
                    alt={`Foto receta ${fotoActiva + 1}`}
                    style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
                  />
                  {/* Quitar la foto activa */}
                  <IconButton
                    size="small"
                    onClick={() => {
                      setLocalFotos(prev => {
                        const next = prev.filter((_, i) => i !== fotoActiva);
                        setFotoActiva(a => Math.max(0, Math.min(a, next.length - 1)));
                        return next;
                      });
                    }}
                    sx={{
                      position: 'absolute', top: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  {/* Contador */}
                  {localFotos.length > 1 && (
                    <Box sx={{
                      position: 'absolute', bottom: 6, right: 6,
                      bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                      px: 1, py: 0.25, borderRadius: 1, fontSize: '0.7rem',
                    }}>
                      {fotoActiva + 1}/{localFotos.length}
                    </Box>
                  )}
                </Box>

                {/* Miniaturas + botón agregar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                  {localFotos.map((url, i) => (
                    <Box
                      key={i}
                      onClick={() => setFotoActiva(i)}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                        border: i === fotoActiva ? '2px solid' : '1px solid',
                        borderColor: i === fotoActiva ? PRIMARY : 'divider',
                      }}
                    >
                      <img src={url} alt={`mini ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                  {/* Agregar más (hasta 6) */}
                  {localFotos.length < 6 && (
                    <Box
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        width: 54, height: 42, borderRadius: 1, cursor: 'pointer',
                        border: '2px dashed', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'text.disabled',
                      }}
                    >
                      +
                    </Box>
                  )}
                </Box>
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

              </Box>
            )}
          </Box>
          {/* inputs ocultos */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
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
                  onSave(localNotas, localFotos, now);
                  onClose();
                }}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}>
                Guardar notas
              </Button>
            </Box>
          </Box>
        </Box>

      </Modal>
      {fotoParaEditar && (
        <EditorFotoModal
          imagenSrc={fotoParaEditar}
          onConfirmar={(recortada) => {
            setLocalFotos(prev => {
              const next = [...prev, recortada].slice(0, 6); // suma al array, tope 6
              setFotoActiva(next.length - 1); // mostrar la recién agregada
              return next;
            });
            setFotoParaEditar(null);
          }}
          onCancelar={() => setFotoParaEditar(null)}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════
    MODAL DE EDITOR DE FOTO
════════════════════════════════════════ */

function EditorFotoModal({ imagenSrc, onConfirmar, onCancelar }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const confirmar = async () => {
    if (!croppedAreaPixels) return;
    setProcesando(true);
    try {
      const recortada = await getCroppedImg(imagenSrc, croppedAreaPixels, rotation);
      onConfirmar(recortada);
    } catch (e) {
      console.error('[EditorFoto] error al recortar:', e);
      onConfirmar(imagenSrc); // fallback: usar la original si falla
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal open onClose={onCancelar}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 480 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700}>Ajustar foto</Typography>
          <IconButton size="small" onClick={onCancelar} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Área de crop */}
        <Box sx={{ position: 'relative', width: '100%', height: 340, bgcolor: '#1c1917' }}>
          <Cropper
            image={imagenSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </Box>

        {/* Controles */}
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ width: 44, color: 'text.secondary' }}>Zoom</Typography>
            <input type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: PRIMARY }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button size="small" onClick={() => setRotation(r => (r + 90) % 360)}
              sx={{ color: PRIMARY }}>
              ↻ Rotar 90°
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" color="inherit" onClick={onCancelar} disabled={procesando}>Cancelar</Button>
              <Button size="small" variant="contained" onClick={confirmar} disabled={procesando || !croppedAreaPixels}
                startIcon={procesando ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
                {procesando ? 'Procesando…' : 'Usar foto'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

// Vista previa de la foto en un modal, con opciones de editar o quitar

// Diálogo de confirmación reutilizable para borrados (receta / equivalencia / merma)
function ConfirmDialog({ open, tipo = 'elemento', nombre = '', onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>¿Borrar {tipo}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          ¿Seguro querés borrar esta {tipo}{nombre ? <> (<strong>{nombre}</strong>)</> : ''}? Esta acción no se puede deshacer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" size="small">Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained" size="small">Sí, borrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function VistaPreviaFotoModal({ foto, onEditar, onQuitar, onClose }) {
  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 520 },
        maxHeight: '90vh',
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700}>Foto de la receta</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', bgcolor: '#1c1917', overflow: 'auto' }}>
          <img src={foto} alt="Foto receta" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={onQuitar}>
            Quitar foto
          </Button>
          <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={onEditar}
            sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
            Editar / Recortar
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
  const ingredientesVisibles = items.filter(it => it.supplyId && it.tipoCosto !== 'nulo' && it.secreto !== true);
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

  const initialTextoRef = useRef(observaciones || '');
  const initialFotosRef = useRef(
    !fotosIniciales ? []
      : Array.isArray(fotosIniciales) ? fotosIniciales.filter(Boolean)
        : (typeof fotosIniciales === 'string' && fotosIniciales) ? [fotosIniciales]
          : []
  );

  // Cierre "accidental" (X, click afuera, Escape): guarda solo si cambió algo
  const handleCloseGuardando = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const cambio =
      texto !== initialTextoRef.current ||
      JSON.stringify(fotos) !== JSON.stringify(initialFotosRef.current);
    if (cambio) onSave(texto, fotos);
    onClose();
  };

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
      onClick={(e) => { if (e.target === e.currentTarget) handleCloseGuardando(); }}
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
          <IconButton size="small" onClick={handleCloseGuardando}><CloseIcon fontSize="small" /></IconButton>
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
            if (e.key === 'Escape') handleCloseGuardando();
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
  item, index, onChange, onRemove,
  insumos, usedSupplyIds, alertaSemanas,
  autoOpenSearch, recetasElaborados = {},
  allArticulos = [],
  objetivoReceta = 30,
  articuloId,
  businessId,
  onOpenRecetaElaborado,
  colorSinPromo = '#7c3aed',
  searchOpen,
  onSearchOpen,
  onSearchClose,
  gridTemplate = '20px 1.8fr 68px 66px 80px 28px 1fr 28px 28px',
  esPromo = false,
  getPrecioSinPromo = null,
  soloConCompras = false,
  onToggleSoloConCompras,
  appConfigDesperdicio = 5,
}) {
  const [search, setSearch] = useState('');
  const [notasOpen, setNotasOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const cantidadRef = useRef(null);
  const listRef = useRef(null);
  // Leemos directo del prop (el padre ya mantiene el mapa actualizado). Un estado local
  // acá desincronizaba: al completarse el fetch de porciones el prop cambia pero la copia
  // local se quedaba con porciones=1 hasta remontar, mostrando el costo total sin dividir.
  const localRecetasElaborados = recetasElaborados;

  const wasAutoOpened = useRef(autoOpenSearch && !item.supplyId && !item.articleRefId);

  // Si el search se cierra y no hay insumo seleccionado, eliminar la fila
  useEffect(() => {
    if (!searchOpen && wasAutoOpened.current && !item.supplyId && !item.articleRefId) {
      onRemove(index);
    }
    if (item.supplyId || item.articleRefId) {
      wasAutoOpened.current = false;
    }
  }, [searchOpen, item.supplyId, item.articleRefId, index, onRemove]);

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

    // ── Buscador GENERAL: artículos + insumos juntos, con etiqueta _tipo ──
    // Artículos (excluyendo el propio dueño de la receta)
    let arts = !esPromo ? [] : (q
      ? allArticulos.filter(a =>
        a.nombre?.toLowerCase().includes(q) ||
        String(a.id).includes(q))
      : [...allArticulos])
      .filter(a => Number(a.id) !== Number(articuloId))
      .map(a => ({ ...a, _tipo: 'articulo' }));
    // Búsqueda numérica: priorizar coincidencia exacta de código en artículos
    if (q.length > 0 && /^\d+$/.test(q)) {
      arts.sort((a, b) => {
        const aCod = String(a.codigo ?? a.codigo_maxi ?? a.id ?? '');
        const bCod = String(b.codigo ?? b.codigo_maxi ?? b.id ?? '');
        const aExact = aCod === q;
        const bExact = bCod === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aCod.startsWith(q);
        const bStarts = bCod.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return 0;
      });
    }

    let list = q
      ? insumos.filter(i =>
        i.nombre?.toLowerCase().includes(q) ||
        String(i.id).includes(q) ||
        String(i.codigo_maxi || '').includes(q)
      )
      : [...insumos];

    // Filtro "solo con compras"
    if (soloConCompras) {
      list = list.filter(i => !!i.fecha_ultima_compra);
    }

    const esBusquedaNumerica = q.length > 0 && /^\d+$/.test(q);
    list.sort((a, b) => {
      // 0) Búsqueda por código: coincidencia exacta primero
      if (esBusquedaNumerica) {
        const aCod = String(a.codigo_maxi ?? a.codigo_mostrar ?? a.id ?? '');
        const bCod = String(b.codigo_maxi ?? b.codigo_mostrar ?? b.id ?? '');
        const aExact = aCod === q || String(a.id) === q;
        const bExact = bCod === q || String(b.id) === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        // Después, los que empiezan con esos dígitos
        const aStarts = aCod.startsWith(q);
        const bStarts = bCod.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
      }
      // 1) Siempre: los que tienen compras van primero (aunque el ojo esté off)
      const aCompra = !!a.fecha_ultima_compra;
      const bCompra = !!b.fecha_ultima_compra;
      if (aCompra !== bCompra) return aCompra ? -1 : 1;
      // 2) Entre los que tienen compras, más recientes/frecuentes primero
      if (aCompra && bCompra) {
        const aCnt = Number(a.cantidad_compras || 0);
        const bCnt = Number(b.cantidad_compras || 0);
        if (aCnt !== bCnt) return bCnt - aCnt;
      }
      // 3) Luego por precio asc, luego alfabético
      const aP = Number(a.precio_ref ?? a.precio_promedio ?? a.precio ?? 0);
      const bP = Number(b.precio_ref ?? b.precio_promedio ?? b.precio ?? 0);
      if (aP > 0 && bP > 0) return aP - bP;
      if (aP > 0) return -1;
      if (bP > 0) return 1;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
    });

    // Etiquetar insumos y combinar: artículos primero, luego insumos
    const insumosTag = list.slice(0, 30).map(i => ({ ...i, _tipo: 'insumo' }));
    return [...arts.slice(0, 30), ...insumosTag];
  }, [insumos, search, soloConCompras, allArticulos, articuloId, esPromo]);

  const selectInsumo = useCallback((ins) => {
    // ── Modo artículo (promo): el "ins" es en realidad un artículo ──
    if (ins._tipo === 'articulo') {
      const costoArt = Number(ins.costoTotal) || Number(ins.precio) || 0;  // costo de producción: receta si tiene, sino precio
      onChange(index, {
        esArticulo: true,
        articleRefId: Number(ins.id),
        supplyId: null,
        supplyNombre: ins.nombre,
        supplyMedida: 'u',
        precioRefDB: costoArt,   // costo del artículo como precio de referencia
        codigoMaxi: ins.codigo || ins.codigo_maxi || '',
        unidad: 'u',
        ultimaCompra: null,
      });
      onSearchClose();
      setSearch('');
      setTimeout(() => cantidadRef.current?.focus(), 50);
      return;
    }

    // ── Costo/unidad del elaborado (precio_ref YA materializado en backend) ──
    // Regla:
    //  a) Rinde en peso/volumen directo (gr/kg/ml/lt): precio_ref es por esa unidad.
    //  b) Rinde en porcion/u CON equivalente medible (rendimiento_peso + unidad_peso):
    //     precarga cantidad = peso de 1 porcion, unidad = gr/ml, y costo/unidad = precio_ref / peso.
    //  c) Rinde en porcion/u SIN equivalente: elaborado normal, unidad 'u', costo = precio_ref directo.
    const precioRef = Number(ins.precio_ref)
      || Number(ins.precio_promedio_periodo)
      || Number(ins.precio_promedio)
      || Number(ins.precio_ultima_compra)
      || Number(ins.precio_ultimo)
      || Number(ins.precio)
      || 0;

    let unidadDB = canonicalUnit(ins.unidad_med || ins.medida || 'u');
    let costoUnidadDB = precioRef;   // costo por 1 unidad de supplyMedida
    let cantidadInicial = 1;

    const rendU = canonicalUnit(ins.receta_rend_unidad || '');
    const pesoPorcion = Number(ins.receta_rend_peso) || 0;
    const uPeso = canonicalUnit(ins.receta_unidad_peso || '');

    if (ins.receta_rend_unidad) {
      if (['kg', 'gr', 'lt', 'ml', 'l'].includes(rendU)) {
        // (a) rinde en peso/volumen: precio_ref ya es por esa unidad
        unidadDB = rendU;
        costoUnidadDB = precioRef;
      } else if (pesoPorcion > 0 && uPeso) {
        // (b) rinde en porcion/u CON equivalente: costo por unidad medible = precio_ref / peso_porcion
        unidadDB = uPeso;
        costoUnidadDB = precioRef / pesoPorcion;
        cantidadInicial = pesoPorcion;   // precarga el peso de 1 porcion
      } else {
        // (c) rinde en porcion/u SIN equivalente: elaborado normal
        unidadDB = 'u';
        costoUnidadDB = precioRef;
      }
    }

    onChange(index, {
      supplyId: ins.id,
      supplyNombre: ins.nombre,
      supplyMedida: unidadDB,
      precioRefDB: costoUnidadDB,   // costo por 1 unidad de supplyMedida (ya resuelto)
      cantidad: cantidadInicial,
      codigoMaxi: ins.codigo_maxi || ins.codigo_mostrar || '',
      unidad: unidadDB,
      ultimaCompra: ins.fecha_ultima_compra
        ? { precio: ins.precio_ultima_compra, fecha: ins.fecha_ultima_compra }
        : null,
    });

    // Cargar equivalencias propias del insumo (para el dropdown de unidad)
    insumoEquivalenciasList(ins.id, businessId)
      .then(r => {
        const eqs = Array.isArray(r?.data) ? r.data : [];
        onChange(index, { equivalencias: eqs });
      })
      .catch(() => { });
    // Cargar mermas del insumo + preseleccionar la default
    insumoMermasList(ins.id, businessId)
      .then(r => {
        const mermas = Array.isArray(r?.data) ? r.data : [];
        const def = mermas.find(m => m.es_default);
        onChange(index, {
          mermas,
          mermaIds: def ? [def.id] : [],           // preselecciona la default
          desperdicioPct: ins.desperdicio_pct_override != null ? Number(ins.desperdicio_pct_override) : null,
        });
      })
      .catch(() => { });
    onSearchClose();
    setSearch('');
    setTimeout(() => cantidadRef.current?.focus(), 50);
  }, [index, onChange, item.esArticulo, localRecetasElaborados, onSearchClose, businessId]);

  // ── Detectar si es insumo elaborado (tiene receta propia) ──
  const elaboradoData = item.supplyId ? localRecetasElaborados[String(item.supplyId)] : null;
  const insumoData = item.supplyId
    ? insumos.find(i => String(i.id) === String(item.supplyId))
    : null;
  // Origen de costo efectivo (resuelto por el backend: fecha o override manual)
  const origenCosto = insumoData?.costo_efectivo_origen;   // 'compra' | 'elaboracion' | undefined
  const forzarCompra = origenCosto === 'compra';
  const esElaborado = !forzarCompra && (!!elaboradoData || insumoData?.es_elaborado === true || insumoData?.tiene_receta === true);
  // Si el origen es compra, ignoramos la receta y usamos el precio de compra (insumo simple)
  const elaborado = forzarCompra ? null : elaboradoData;
  const tipoCosto = item.tipoCosto || 'total';

  // Factor de merma total = global (siempre) × merma específica elegida (si hay)
  const factorMerma = useMemo(() => {
    // Los ítems-artículo (promo) no llevan merma: si tienen receta, ya está aplicada dentro;
    // si no, es un producto de venta con precio fijo.
    if (item.esArticulo || item.articleRefId) return 1;
    const pctGlobal = item.desperdicioPct != null ? Number(item.desperdicioPct) : Number(appConfigDesperdicio || 0);
    const fGlobal = 1 + (pctGlobal / 100);
    // Las mermas específicas se apilan multiplicativamente (pelado × cocción × …)
    const ids = Array.isArray(item.mermaIds)
      ? item.mermaIds
      : (item.mermaId != null ? [item.mermaId] : []);
    const fEspecifica = ids.reduce((acc, id) => {
      const m = (item.mermas || []).find(x => Number(x.id) === Number(id));
      if (!m || !(Number(m.peso_final) > 0)) return acc;
      return acc * (Number(m.peso_inicial) / Number(m.peso_final));
    }, 1);
    return fGlobal * fEspecifica;
  }, [item.desperdicioPct, item.mermas, item.mermaIds, item.mermaId, appConfigDesperdicio, item.esArticulo, item.articleRefId]);

  /**
   * Precio por unidad elegida, considerando:
   * - Si es elaborado Y tipoCosto==='total'     → costo/porcion de su receta
   * - Si es elaborado Y tipoCosto==='sugerido'  → precio sugerido de su receta
   * - En cualquier otro caso                   → calcPrecioEnUnidad desde la DB
   */
  const costoEnUnidadElegida = useMemo(() => {
    // ── Si la unidad elegida es una equivalencia propia del insumo (prioridad) ──
    const eqSel = (item.equivalencias || []).find(e => e.nombre === item.unidad);
    if (eqSel) {
      const contenido = Number(eqSel.contenido) || 0;
      if (elaborado) {
        // Elaborado como insumo: aplicar su merma propia (opción A, coherente con la fila y el total).
        const costoPorUnidadEq = calcCostoUnitarioElaborado(elaborado, item.supplyMedida, eqSel.unidad, tipoCosto);
        return contenido * costoPorUnidadEq * factorMerma;
      }
      const precioParaCosto = forzarCompra
        ? (Number(insumoData?.precio_ultima_compra) || Number(item.precioRefDB) || 0)
        : (Number(item.precioRefDB) || 0);
      const precioBase = precioParaCosto * factorMerma;
      // Insumo unidad CON envase: la equivalencia (ml/gr) se cuesta vía envase, no vía precio_ref directo
      const insData = item.supplyId ? insumos.find(i => String(i.id) === String(item.supplyId)) : null;
      const contEnvase = Number(insData?.contenido_envase) || 0;
      const uniEnvase = canonicalUnit(insData?.unidad_envase || '');
      const baseInsumo = canonicalUnit(item.supplyMedida || 'u');
      if (baseInsumo === 'u' && contEnvase > 0 && uniEnvase) {
        const costoPorUnidadEnvase = precioBase / contEnvase;                    // ej. $8214,90/750ml = $10,95/ml
        const factor = getConversionFactor(canonicalUnit(eqSel.unidad), uniEnvase); // unidad de la equiv → unidad del envase
        return contenido * factor * costoPorUnidadEnvase;                        // ej. 85 × 1 × 10,95 = $931
      }
      // Insumo medible normal: contenido convertido a la unidad base × precio_ref
      const factor = getConversionFactor(canonicalUnit(eqSel.unidad), canonicalUnit(item.supplyMedida || eqSel.unidad));
      return (contenido * factor) * precioBase;
    }
    if (elaborado) {
      // DB-puro: precio_ref del elaborado YA es el costo por unidad de RENDIMIENTO
      // (materializado en backend). La unidad base es rendimiento_unidad, NO supplyMedida
      // (que puede venir sucia de MaxiRest: 'K'/'L'/'U'). Convertimos desde ahí.
      const costoBase = (tipoCosto === 'sugerido' && Number(elaborado?.precioSugerido) > 0)
        ? Number(elaborado.precioSugerido)
        : (Number(item.precioRefDB) || 0);
      const unidadBase = canonicalUnit(elaborado?.rendimientoUnidad || item.supplyMedida || 'u');
      const unidadElegida = canonicalUnit(item.unidad || unidadBase);
      return calcPrecioEnUnidad(costoBase, unidadBase, unidadElegida) * factorMerma;
    }
    // ── Item-artículo (promo): costo del ARTÍCULO, jerarquía costoTotal receta > costo > precio ──
    if (item.esArticulo || item.articleRefId) {
      const refId = Number(item.articleRefId);
      const art = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === refId);
      if (tipoCosto === 'sugerido') {
        const costoArt = Number(art?.costoTotal) || 0;
        const objArt = Number(objetivoReceta) || 30;
        const precioSug = (costoArt > 0 && objArt > 0) ? costoArt / (objArt / 100) : 0;
        const unidadDBart = canonicalUnit(item.supplyMedida || 'u');
        return calcPrecioEnUnidad(precioSug, unidadDBart, canonicalUnit(item.unidad || unidadDBart));
      }
      // Costo del componente = precio de venta del artículo
      const costoComp = Number(art?.costoTotal) || Number(art?.precio) || Number(item.precioRefDB) || 0;
      const unidadDBart = canonicalUnit(item.supplyMedida || 'u');
      return calcPrecioEnUnidad(costoComp, unidadDBart, canonicalUnit(item.unidad || unidadDBart));
    }
    let precioRef = forzarCompra
      ? (Number(insumoData?.precio_ultima_compra) || Number(item.precioRefDB) || 0)
      : (Number(item.precioRefDB) || 0);
    const unidadDB = canonicalUnit(item.supplyMedida || 'u');
    const unidadElegida = canonicalUnit(item.unidad || unidadDB);
    // ── Insumo unidad "u" CON envase, unidad elegida medible (ml/gr/etc, no equivalencia nombrada) ──
    //    El envase ES la unidad de compra al 100%: costo/unidadMedible = precioRef / contenido_envase.
    //    Sin esto caía en calcPrecioEnUnidad con unidadDB='u' → conversión u→ml disparatada.
    {
      const insDataEnv = item.supplyId ? insumos.find(i => String(i.id) === String(item.supplyId)) : null;
      const contEnvase = Number(insDataEnv?.contenido_envase) || 0;
      const uniEnvase = canonicalUnit(insDataEnv?.unidad_envase || '');
      if (unidadDB === 'u' && contEnvase > 0 && uniEnvase && unidadElegida !== 'u') {
        const costoPorUnidadEnvase = (precioRef * factorMerma) / contEnvase;   // ej. $5.269,98 / 750ml = $7,0266/ml
        const factor = getConversionFactor(unidadElegida, uniEnvase);          // unidad elegida → unidad del envase
        return factor * costoPorUnidadEnvase;                                  // costo por 1 unidad elegida
      }
    }
    return calcPrecioEnUnidad(precioRef * factorMerma, unidadDB, unidadElegida);
  }, [elaborado, tipoCosto, item.precioRefDB, item.supplyMedida, item.unidad, item.esArticulo, item.articleRefId, item.equivalencias, factorMerma, allArticulos, insumos, objetivoReceta]);

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
    () => getAlertaColor(item.ultimaCompra?.fecha || item.ultimaCompra, alertaSemanas, esElaborado),
    [item.ultimaCompra, alertaSemanas, esElaborado]
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
        gridTemplateColumns: gridTemplate,
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
              borderColor: isDuplicate ? 'error.main' : (item.supplyId || item.articleRefId) ? 'success.light' : 'warning.main',
              borderRadius: 1, px: 0.75, py: 0.4, cursor: 'pointer',
              minHeight: 30, display: 'flex', alignItems: 'center',
              bgcolor: 'background.paper',
              '&:hover': { borderColor: PRIMARY },
            }}
          >
            {(item.supplyId || item.articleRefId) ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', overflow: 'hidden' }}>
                {alertaBg
                  ? <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444', flexShrink: 0 }} />
                  : <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />
                }
                {/* Nombre clickeable → ver compras */}
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', minWidth: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Item-artículo (promo): abrir la receta del artículo componente
                    if (item.esArticulo || item.articleRefId) {
                      onOpenRecetaElaborado?.(item);
                      return;
                    }
                    if (!item.supplyId) return;
                    // Buscar el insumo para saber si tiene compras y/o receta
                    // Siempre abrir el modal completo del insumo (4 pestañas).
                    // El popup rápido de compras queda en el ícono de la derecha.
                    onOpenRecetaElaborado?.(item);
                  }}
                  title={(item.esArticulo || item.articleRefId) ? "Ver receta del artículo" : "Abrir insumo (merma, receta, compras, equivalencias)"}
                >
                  {item.supplyNombre || `#${item.articleRefId || item.supplyId}`}
                </Typography>
                {/* Fecha: última compra (insumo) o última modificación de receta (elaborado) */}
                {!item.articleRefId && (() => {
                  const insDat = item.supplyId ? insumos.find(i => String(i.id) === String(item.supplyId)) : null;
                  const raw = elaborado
                    ? (insDat?.receta_updated_at || null)
                    : (item.ultimaCompra?.fecha || item.ultimaCompra || insDat?.fecha_ultima_compra || null);
                  const f = fmtDate(raw);
                  if (!f) return null;
                  // Insumo: la fecha se muestra SOLO si la compra está desactualizada (alertaBg != null).
                  //         Si las compras están al día, no se muestra nada. Elaborado: siempre (fecha de receta).
                  if (!elaborado && !alertaBg) return null;
                  return (
                    <Tooltip title={elaborado
                      ? `Receta modificada: ${f}`
                      : `Este ítem contiene compras desactualizadas desde ${f}`}>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.6rem', flexShrink: 0,
                          color: alertaBg ? '#ef4444' : 'text.disabled',
                          fontWeight: alertaBg ? 700 : 400,
                          ml: -0.25,
                        }}
                      >
                        ({f})
                      </Typography>
                    </Tooltip>
                  );
                })()}
                <Box sx={{ flex: 1, minWidth: 0 }} />

                {/* Precio + unidad base — siempre visible cuando hay insumo seleccionado.
                    Si no hay precio cargado (insumo sin compras), muestra solo la unidad
                    en gris para que el contexto de la fila siga siendo claro. */}
                {(item.supplyId || item.articleRefId) && (() => {
                  const unidadStr = item.supplyMedida || 'u';
                  // Para item-artículo: costo del artículo con jerarquía (costoTotal receta > costo > precio)
                  const precioArt = item.articleRefId
                    ? (() => {
                      const art = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === Number(item.articleRefId));
                      return Number(art?.costoTotal) || Number(art?.precio) || Number(item.precioRefDB) || 0;
                    })()
                    : 0;
                  // Precio base FIJO del elaborado: costo por unidad de rendimiento,
                  // materializado en backend (insumoData.receta_costo_unitario).
                  // Si rinde en porcion/u → mostrar "$X/porcion" (no el costo/gr interno).
                  // Si rinde en peso/volumen → mostrar "$X/gr|ml".
                  const rendUnid = insumoData?.receta_rend_unidad || elaborado?.rendimientoUnidad || 'porcion';
                  const costoUnitElab = Number(insumoData?.receta_costo_unitario) || 0;
                  const esElab = costoUnitElab > 0 && !!insumoData?.receta_rend_unidad;
                  const precioBaseElaborado = esElab
                    ? costoUnitElab * factorMerma
                    : 0;
                  // Etiqueta: 'porcion' se muestra como 'porción'
                  const unidadBaseStr = esElab
                    ? (rendUnid === 'porcion' ? 'porción' : canonicalUnit(rendUnid))
                    : canonicalUnit(item.supplyMedida || 'u');

                  const precioMostrado = item.articleRefId
                    ? precioArt
                    : forzarCompra
                      ? (Number(insumoData?.precio_ultima_compra) || Number(item.precioRefDB) || 0)
                      : (Number(item.precioRefDB) || 0);
                  const tienePrecio = esElab
                    ? precioBaseElaborado > 0
                    : precioMostrado > 0;
                  const label = (() => {
                    if (esElab) {
                      return tienePrecio
                        ? `$${fmt(precioBaseElaborado)}/${unidadBaseStr}`
                        : `/${unidadBaseStr}`;
                    }
                    return tienePrecio
                      ? `$${fmt(precioMostrado)}/${unidadStr}`
                      : `/${unidadStr}`;
                  })();

                  const titleStr = (() => {
                    if (elaborado) {
                      return tienePrecio
                        ? `Costo de receta elaborada: $${fmt(costoEnUnidadElegida)}/${unidadStr}`
                        : `Unidad base: ${unidadStr} (la receta elaborada aún no tiene costo calculado)`;
                    }
                    return tienePrecio
                      ? `Precio de DB: $${fmt(item.precioRefDB)}/${unidadStr} (fijo)`
                      : `Unidad base: ${unidadStr} (insumo sin compras registradas)`;
                  })();

                  return (
                    <Chip
                      label={label}
                      size="small"
                      sx={{
                        height: 16, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                        bgcolor: elaborado
                          ? '#f0fdf4'
                          : (tienePrecio ? `${PRIMARY}18` : '#f1f5f9'),
                        color: elaborado
                          ? '#16a34a'
                          : (tienePrecio ? PRIMARY : '#64748b'),
                        border: 'none',
                      }}
                      title={titleStr}
                    />
                  );
                })()}

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
                {item.esArticulo ? 'Seleccioná artículo…' : 'Seleccioná insumo…'}
              </Typography>
            )}
          </Box>

          {/* Dropdown búsqueda */}
          {searchOpen && (
            <Box data-search-dropdown sx={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, boxShadow: 6, minWidth: 340, mt: 0.5 }}>
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <TextField autoFocus inputRef={searchInputRef} size="small" fullWidth placeholder="Código o nombre…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setFocusedIndex(-1);
                    setFocusedIndex(0);
                  }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <span
                          onClick={(e) => { e.stopPropagation(); onToggleSoloConCompras?.(); }}
                          title={soloConCompras ? 'Mostrando solo insumos con compras — click para ver todos' : 'Filtrar: solo insumos con compras'}
                          style={{
                            cursor: 'pointer', fontSize: '0.9rem',
                            opacity: soloConCompras ? 1 : 0.35,
                            color: soloConCompras ? 'var(--color-primary)' : 'inherit',
                            lineHeight: 1, userSelect: 'none', padding: '0 4px',
                          }}
                        >
                          👁
                        </span>
                      </InputAdornment>
                    ),
                  }}
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
                  // ── Opción de artículo (promo) ──
                  if (ins._tipo === 'articulo') {
                    return (
                      <Box key={`art-${ins.id}`} data-option-index={idx}
                        onClick={() => selectInsumo(ins)}
                        sx={{
                          px: 1.5, py: 0.75, cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderBottom: '1px solid', borderColor: 'divider',
                          bgcolor: focusedIndex === idx ? 'action.selected' : 'transparent',
                          outline: focusedIndex === idx ? '2px solid' : 'none',
                          outlineColor: focusedIndex === idx ? 'primary.main' : 'transparent',
                          outlineOffset: -2,
                          '&:hover': { bgcolor: focusedIndex === idx ? 'action.selected' : 'action.hover' },
                        }}>
                        <Box>
                          <Typography component="span" variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', display: 'block' }}>
                            {ins.nombre}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label="Artículo" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#7c3aed15', color: '#7c3aed', '& .MuiChip-label': { px: 0.75 } }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {`Cód: ${ins.codigo || ins.codigo_maxi || ins.id}`}{(ins.subrubro || ins.categoria) ? ` · ${ins.subrubro || ins.categoria}` : ''}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#7c3aed', fontSize: '0.8rem', flexShrink: 0, ml: 1 }}>
                          {(() => {
                            const p = Number(ins.precio ?? ins.price ?? ins.precio_venta) || 0;
                            return p > 0 ? `$${fmt(p)}` : '—';
                          })()}
                        </Typography>
                      </Box>
                    );
                  }

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
                          {!esElab && <Chip label="Insumo" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: `${PRIMARY}15`, color: PRIMARY }} />}
                          {yaUsado && <Chip label="Ya usado" size="small" color="warning" sx={{ ml: 0.5, height: 16, fontSize: 9 }} />}
                          {esElab && <Chip label="Elaborado" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#f0fdf4', color: '#16a34a' }} />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {ins.codigo_maxi || ins.codigo_mostrar ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}` : ins.unidad_med || ins.medida || 'u'}
                          {(() => {
                            // Elaborado → fecha de última modificación de su receta; Insumo → última compra
                            if (esElab) {
                              const eData = localRecetasElaborados[String(ins.id)];
                              const f = fmtDate(eData?.updatedAt || ins.receta_updated_at);
                              return f ? ` · Mod: ${f}` : '';
                            }
                            const f = fmtDate(ins.fecha_ultima_compra);
                            return f ? ` · Compra: ${f}` : ' · Sin compras';
                          })()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0, ml: 1 }}>
                        {(() => {
                          if (esElab) {
                            // Reglas del costo del elaborado en el buscador (datos ya en `ins`):
                            //  3) Con rendimiento (porciones > 1): costo/porcion o /u
                            //  4) Sin rendimiento (porciones = 1): costo total de la receta
                            const porc = Number(ins.receta_porciones) || 1;
                            const costoUnit = Number(ins.receta_costo_unitario) || 0;
                            const costoTot = Number(ins.costo_receta) || 0;
                            const rendU = ins.receta_rend_unidad || 'porcion';
                            const conRendimiento = porc > 1;
                            const valor = conRendimiento ? costoUnit : costoTot;
                            const etiqueta = conRendimiento
                              ? (rendU === 'porcion' ? '/porción' : `/${canonicalUnit(rendU)}`)
                              : '';   // sin rendimiento: costo total, sin sufijo de unidad
                            return (
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a', fontSize: '0.8rem' }}>
                                {valor > 0 ? `$${fmt(valor)}${etiqueta}` : ''}
                              </Typography>
                            );
                          }
                          const p = Number(ins.precio_ref) || Number(ins.precio_promedio_periodo) || Number(ins.precio_promedio) || Number(ins.precio_ultima_compra) || Number(ins.precio) || 0;
                          // Alerta si no hay compra reciente (dentro del período de config)
                          const sinCompraReciente = !!getAlertaColor(ins.fecha_ultima_compra, alertaSemanas, false);
                          // Tiene compras registradas y al día → verde; desactualizado → rojo; sin compras → base
                          const tieneCompraAlDia = !!ins.fecha_ultima_compra && !sinCompraReciente;
                          const colorPrecio = sinCompraReciente ? '#ef4444' : (tieneCompraAlDia ? '#16a34a' : PRIMARY);
                          return (
                            <>
                              {sinCompraReciente && (
                                <Tooltip title={ins.fecha_ultima_compra
                                  ? `Última compra: ${fmtDate(ins.fecha_ultima_compra)} — precio posiblemente desactualizado`
                                  : 'Sin compras registradas — precio de referencia, no de compra'}>
                                  <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
                                </Tooltip>
                              )}
                              <Typography variant="body2" fontWeight={700}
                                sx={{ color: colorPrecio, fontSize: '0.8rem' }}>
                                {p > 0 ? `$${fmt(p)}` : '—'}
                              </Typography>
                            </>
                          );
                        })()}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Cantidad con flechitas de step progresivo ── */}
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '2px' }}>
          <TextField
            inputRef={cantidadRef}
            size="small"
            type="text"
            inputMode="decimal"
            value={item.cantidad === '' ? '' : String(item.cantidad).replace('.', ',')}
            onChange={e => {
              const raw = e.target.value;
              // Permitir estados intermedios de tipeo: vacío o solo el signo
              if (raw === '' || raw === '-') { onChange(index, { cantidad: raw }); return; }
              // Preservar el signo negativo (sanitizeDecimal lo descarta)
              const neg = raw.trim().startsWith('-');
              const limpio = sanitizeDecimal(raw);
              onChange(index, { cantidad: (neg ? '-' : '') + limpio });
            }}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              if (e.key === 'ArrowUp') { e.preventDefault(); onChange(index, { cantidad: stepCantidad(item.cantidad, +1) }); }
              if (e.key === 'ArrowDown') { e.preventDefault(); onChange(index, { cantidad: stepCantidad(item.cantidad, -1) }); }
            }}
            placeholder="0"
            inputProps={{
              inputMode: 'decimal',
              style: { textAlign: 'right', fontSize: '0.78rem', padding: '4px 6px' }
            }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <IconButton
              size="small" tabIndex={-1}
              onClick={() => onChange(index, { cantidad: stepCantidad(item.cantidad, +1) })}
              sx={{ p: 0, height: 15, width: 16, color: 'text.secondary', '&:hover': { color: PRIMARY } }}
            >
              <Box component="span" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>▲</Box>
            </IconButton>
            <IconButton
              size="small" tabIndex={-1}
              onClick={() => onChange(index, { cantidad: stepCantidad(item.cantidad, -1) })}
              sx={{ p: 0, height: 15, width: 16, color: 'text.secondary', '&:hover': { color: PRIMARY } }}
            >
              <Box component="span" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>▼</Box>
            </IconButton>
          </Box>
        </Box>

        {/* ── Unidad ── */}
        <Select
          size="small"
          value={item.unidad || item.supplyMedida || 'u'}
          onChange={e => onChange(index, { unidad: e.target.value })}
          onKeyDown={e => {
            // Typeahead manual: saltar a la primera unidad que empiece con la tecla
            if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
              const letra = e.key.toLowerCase();
              const opciones = [
                ...UNIDADES,
                ...(item.supplyMedida && !UNIDADES.includes(item.supplyMedida) ? [item.supplyMedida] : []),
              ];
              const match = opciones.find(u => u.toLowerCase().startsWith(letra));
              if (match) {
                e.preventDefault();
                onChange(index, { unidad: match });
              }
            }
          }}
          sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: '4px', fontSize: '0.75rem' } }}
        >
          {(() => {
            // Unidades válidas según la unidad base del insumo (+ equivalencias propias)
            // Unidades válidas según la unidad base del insumo (+ equivalencias propias)
            const insData = item.supplyId ? insumos.find(i => String(i.id) === String(item.supplyId)) : null;
            const elabDataOpc = item.supplyId ? localRecetasElaborados[String(item.supplyId)] : null;
            let unidadesValidas;
            if (elabDataOpc) {
              // Elaborado: las unidades salen de su rendimiento (equivalente medible)
              const rp = Number(elabDataOpc.rendimientoPeso) || 0;
              const ru = canonicalUnit(elabDataOpc.rendimientoUnidad || 'porcion');
              const up = canonicalUnit(elabDataOpc.unidadPeso || '');
              if (rp > 0 && up) {
                // Rinde en porción/unidad con peso equivalente → ofrecer u + las del tipo del equivalente
                unidadesValidas = ['gr', 'kg'].includes(up) ? ['u', 'gr', 'kg']
                  : ['ml', 'lt', 'oz'].includes(up) ? ['u', 'ml', 'lt', 'oz']
                    : ['u'];
              } else if (['gr', 'kg'].includes(ru)) {
                unidadesValidas = ['gr', 'kg'];
              } else if (['ml', 'lt', 'oz'].includes(ru)) {
                unidadesValidas = ['ml', 'lt', 'oz'];
              } else {
                unidadesValidas = ['u'];
              }
            } else {
              unidadesValidas = unidadesParaInsumo(insData || { unidad_med: item.supplyMedida });
            }
            // Para elaborados, las unidades salen de su rendimiento (ya en unidadesValidas):
            // NO agregar su unidad_med base cruda, que no aplica a un elaborado por porción.
            // Para insumos normales sí se agrega su unidad de compra si falta.
            const base = (!elabDataOpc && item.supplyMedida && !unidadesValidas.includes(canonicalUnit(item.supplyMedida)))
              ? [item.supplyMedida] : [];
            const eqs = (item.equivalencias || []).map(e => e.nombre);
            const opciones = [...unidadesValidas, ...base, ...eqs];
            const unidadActual = item.unidad || item.supplyMedida || 'u';
            return opciones.map(u => {
              const eqData = (item.equivalencias || []).find(e => e.nombre === u);
              const seleccionada = u === unidadActual;
              return (
                <MenuItem key={u} value={u} sx={{
                  fontSize: '0.8rem',
                  fontWeight: seleccionada ? 800 : 400,
                  bgcolor: seleccionada ? `${PRIMARY}25` : 'transparent',
                  '&:hover': { bgcolor: seleccionada ? `${PRIMARY}35` : 'action.hover' },
                }}>
                  {eqData ? `${u} (${fmt(Number(eqData.contenido), 0)}${eqData.unidad})` : u}
                </MenuItem>
              );
            });
          })()}
        </Select>

        {/* ── $ total (unitario × cantidad) ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, minHeight: 30, bgcolor: elaborado ? '#f0fdf4' : '#f8fafc', overflow: 'hidden' }}>
          <Tooltip title={elaborado ? `De receta elaborada` : `$${fmt(costoEnUnidadElegida)}/${item.unidad || item.supplyMedida || 'u'} × ${item.cantidad || 0}`}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: costoEfectivoLinea < 0 ? '#ef4444' : costoEfectivoLinea > 0 ? (elaborado ? '#16a34a' : PRIMARY) : 'text.disabled', whiteSpace: 'nowrap' }}>
              {(item.supplyId || item.articleRefId) ? (costoEfectivoLinea !== 0 ? `$${fmt(costoEfectivoLinea)}` : '—') : '—'}
            </Typography>
          </Tooltip>
        </Box>
        {/* ── $ sin promo (solo en promo, precio de venta del componente × cantidad) ── */}
        {esPromo && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, minHeight: 30, bgcolor: '#faf5ff', overflow: 'hidden' }}>
            {item.articleRefId ? (() => {
              const pSin = getPrecioSinPromo ? getPrecioSinPromo(item.articleRefId) : 0;
              const total = (Number(pSin) || 0) * (Number(item.cantidad) || 0);
              return (
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: total > 0 ? colorSinPromo : 'text.disabled', whiteSpace: 'nowrap' }}>
                  {total > 0 ? `$${fmt(total)}` : '—'}
                </Typography>
              );
            })() : (
              <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>—</Typography>
            )}
          </Box>
        )}
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
          {/* Merma — dropdown con "No" + las mermas del insumo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Merma:</Typography>
            <Select
              size="small"
              multiple
              displayEmpty
              value={Array.isArray(item.mermaIds) ? item.mermaIds : (item.mermaId != null ? [item.mermaId] : [])}
              onChange={e => {
                const v = e.target.value;
                onChange(index, { mermaIds: (typeof v === 'string' ? v.split(',') : v).map(Number) });
              }}
              renderValue={(sel) => {
                if (!sel || sel.length === 0) return 'No';
                const factor = sel.reduce((acc, id) => {
                  const m = (item.mermas || []).find(x => Number(x.id) === Number(id));
                  if (!m || !(Number(m.peso_final) > 0)) return acc;
                  return acc * (Number(m.peso_inicial) / Number(m.peso_final));
                }, 1);
                const nombres = sel
                  .map(id => (item.mermas || []).find(x => Number(x.id) === Number(id))?.nombre)
                  .filter(Boolean)
                  .join(' + ');
                return `${nombres} (×${factor.toFixed(2)})`;
              }}
              sx={{ fontSize: '0.75rem', minWidth: 140, '& .MuiSelect-select': { py: '2px', fontSize: '0.75rem' } }}
            >
              {(item.mermas || []).map(m => {
                const factor = Number(m.peso_final) > 0 ? (Number(m.peso_inicial) / Number(m.peso_final)) : 1;
                const sel = Array.isArray(item.mermaIds) ? item.mermaIds : [];
                return (
                  <MenuItem key={m.id} value={Number(m.id)} sx={{ fontSize: '0.78rem' }}>
                    <Checkbox size="small" checked={sel.some(x => Number(x) === Number(m.id))} sx={{ p: 0.25, mr: 0.5 }} />
                    {m.nombre} (×{factor.toFixed(2)})
                  </MenuItem>
                );
              })}
            </Select>
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

          {/* Secreto — no se muestra en la vista de cocina (solo control de costos del dueño/admin) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox
              size="small"
              checked={item.secreto === true}
              onChange={e => onChange(index, { secreto: e.target.checked })}
              sx={{ p: 0.25, color: PRIMARY, '&.Mui-checked': { color: PRIMARY } }}
            />
            <Tooltip title="Secreto: no se mostrará en la vista de cocina (solo para control de costos)">
              <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', userSelect: 'none', cursor: 'pointer' }}
                onClick={() => onChange(index, { secreto: item.secreto !== true })}>
                Secreto
              </Typography>
            </Tooltip>
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
   TABS NUEVAS PARA INSUMOS (andamiaje inicial)
   TODO: reemplazar por implementación real
════════════════════════════════════════ */
function ModalReemplazarInsumo({ insumoId, insumoNombre, businessId, insumos = [], alertaSemanas, onClose, onReemplazado }) {
  const [search, setSearch] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [preview, setPreview] = useState(null);
  const [excluidas, setExcluidas] = useState(() => new Set());   // recetaIds destildadas
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState('');

  // Cargar recetas afectadas al abrir
  useEffect(() => {
    if (!insumoId || !businessId) return;
    insumoReemplazarPreview(insumoId, businessId)
      .then(r => setPreview({
        recetas: r.recetas, items: r.items, negocios: r.negocios,
        detalle: Array.isArray(r.detalle) ? r.detalle : [],
      }))
      .catch(() => setPreview({ recetas: 0, items: 0, negocios: 0, detalle: [] }));
  }, [insumoId, businessId]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    // Mismas reglas que el buscador de ingredientes.
    return ordenarInsumosBusqueda(
      insumos
        .filter(i => Number(i.id) !== Number(insumoId))
        .filter(i => (i.nombre || '').toLowerCase().includes(q) || String(i.codigo_maxi || '').includes(q))
    ).slice(0, 20);
  }, [insumos, search, insumoId]);

  const detalle = preview?.detalle || [];
  const multiNegocio = useMemo(() => new Set(detalle.map(d => d.businessId)).size > 1, [detalle]);
  const recetaIdsElegidos = useMemo(
    () => detalle.map(d => d.recetaId).filter(id => !excluidas.has(id)),
    [detalle, excluidas]
  );
  const totalElegidas = recetaIdsElegidos.length;

  const toggleReceta = (rid) => setExcluidas(prev => {
    const nx = new Set(prev);
    if (nx.has(rid)) nx.delete(rid); else nx.add(rid);
    return nx;
  });

  const ejecutar = async () => {
    if (!seleccionado || !totalElegidas) return;
    setEjecutando(true); setError('');
    try {
      // Si están todas tildadas no mandamos filtro: el back se comporta como antes.
      const recetaIds = totalElegidas === detalle.length ? null : recetaIdsElegidos;
      const r = await insumoReemplazar(insumoId, seleccionado.id, businessId, recetaIds);
      onReemplazado?.(r);
    } catch (e) {
      setError(e.message || 'No se pudo reemplazar');
      setEjecutando(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '95vw', sm: 520 },
        bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24,
        outline: 'none', overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: PRIMARY, color: ON_PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ fontSize: 20 }}>🔁</Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>Reemplazar insumo</Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>{insumoNombre}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          {!confirmando ? (
            <>
              {/* Buscador de insumo nuevo */}
              <Box sx={{ position: 'relative' }}>
                <TextField
                  autoFocus size="small" fullWidth
                  label="Reemplazar por"
                  placeholder="Buscar insumo…"
                  value={seleccionado ? seleccionado.nombre : search}
                  onChange={e => { setSeleccionado(null); setSearch(e.target.value); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                {!seleccionado && filtrados.length > 0 && (
                  <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, boxShadow: 6, mt: 0.5, maxHeight: 240, overflowY: 'auto' }}>
                    {filtrados.map(ins => (
                      <FilaResultadoInsumo
                        key={ins.id}
                        ins={ins}
                        alertaSemanas={alertaSemanas}
                        onClick={() => { setSeleccionado(ins); setSearch(''); }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Recetas afectadas — destildá las que no querés tocar */}
              {preview == null ? (
                <Typography variant="caption" color="text.secondary">Buscando recetas…</Typography>
              ) : detalle.length === 0 ? (
                <Box sx={{ bgcolor: '#fff8ec', border: '1px solid #f0c98a', borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.78rem', color: '#7a5200' }}>
                    Este insumo no se usa en ninguna receta.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      Recetas afectadas ({totalElegidas} de {detalle.length})
                    </Typography>
                    <Box>
                      <Button size="small" sx={{ minWidth: 0, fontSize: '0.7rem', px: 0.75 }}
                        onClick={() => setExcluidas(new Set())}>Todas</Button>
                      <Button size="small" sx={{ minWidth: 0, fontSize: '0.7rem', px: 0.75 }}
                        onClick={() => setExcluidas(new Set(detalle.map(d => d.recetaId)))}>Ninguna</Button>
                    </Box>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, maxHeight: 220, overflowY: 'auto' }}>
                    {detalle.map(d => {
                      const incluida = !excluidas.has(d.recetaId);
                      const cant = d.items.map(it => `${fmt(it.cantidad)} ${it.unidad || ''}`.trim()).join(' + ');
                      return (
                        <Box key={d.recetaId}
                          onClick={() => toggleReceta(d.recetaId)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, cursor: 'pointer',
                            borderBottom: '1px solid', borderColor: 'divider',
                            opacity: incluida ? 1 : 0.5,
                            '&:hover': { bgcolor: 'action.hover' },
                          }}>
                          <Checkbox size="small" checked={incluida} sx={{ p: 0.25 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" noWrap sx={{
                              fontSize: '0.8rem', fontWeight: 600,
                              textDecoration: incluida ? 'none' : 'line-through',
                            }}>
                              {d.titulo}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {cant}
                              {d.esElaborado ? ' · Elaborado' : ''}
                              {multiNegocio ? ` · Negocio #${d.businessId}` : ''}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontSize: '0.72rem', color: '#7a5200' }}>
                    Los costos se recalculan en las recetas tildadas. <b>Esta acción no se puede deshacer.</b>
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" color="inherit" onClick={onClose}>Cancelar</Button>
                <Button size="small" variant="contained"
                  disabled={!seleccionado || preview == null || totalElegidas === 0}
                  onClick={() => setConfirmando(true)}
                  sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}>
                  Continuar
                </Button>
              </Box>
            </>
          ) : (
            <>
              {/* Confirmación final */}
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Vas a reemplazar <b>{insumoNombre}</b> por <b>{seleccionado.nombre}</b> en{' '}
                  <b>{totalElegidas} receta{totalElegidas !== 1 ? 's' : ''}</b>
                  {totalElegidas !== detalle.length && <> (de {detalle.length})</>}.
                </Typography>
                <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
                  Esta acción no se puede deshacer.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" color="inherit" disabled={ejecutando} onClick={() => setConfirmando(false)}>Volver</Button>
                <Button size="small" variant="contained" color="error"
                  disabled={ejecutando}
                  startIcon={ejecutando ? <CircularProgress size={14} color="inherit" /> : null}
                  onClick={ejecutar}>
                  {ejecutando ? 'Reemplazando…' : `Sí, reemplazar en ${totalElegidas}`}
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Modal>
  );
}

function TabMermaInsumo({ insumoId, businessId, insumoData, desperdicioGlobalPct = 5 }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', peso_inicial: '', peso_final: '' });
  const [guardando, setGuardando] = useState(false);
  const [globalPct, setGlobalPct] = useState(Number(desperdicioGlobalPct) || 0);
  // Reflejar el global del negocio cuando cambia (config u otra edición)
  useEffect(() => { setGlobalPct(Number(desperdicioGlobalPct) || 0); }, [desperdicioGlobalPct]);

  // Precio de compra del insumo (probamos varios campos comunes)
  const precioCompra = Number(insumoData?.precio_ref)
    || Number(insumoData?.precio_ultima_compra)
    || Number(insumoData?.precio_promedio)
    || Number(insumoData?.precio)
    || 0;
  const unidad = canonicalUnit(insumoData?.unidad_med || insumoData?.medida || 'u');

  const cargar = useCallback(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoMermasList(insumoId, businessId)
      .then(r => setLista(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setError('No se pudieron cargar las mermas'))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Precio con el global aplicado (base para las mermas específicas — se apilan sobre este)
  const precioConGlobal = precioCompra * (1 + (Number(globalPct) || 0) / 100);

  // % merma = (bruto - neto) / bruto
  const pctMerma = (bruto, neto) => (Number(bruto) > 0 ? ((Number(bruto) - Number(neto)) / Number(bruto)) * 100 : 0);
  // precio con merma = precioConGlobal × (bruto / neto)
  const precioConMerma = (bruto, neto) => (Number(neto) > 0 ? precioConGlobal * (Number(bruto) / Number(neto)) : 0);

  const guardarGlobal = async (nuevoPct) => {
    const val = nuevoPct === '' ? null : Number(nuevoPct);
    if (val == null) return;
    try {
      // La merma global es del NEGOCIO (afecta a todos los insumos), no de este insumo.
      await BusinessesAPI.update(Number(businessId), { props: { desperdicio_global_pct: val } });
      window.dispatchEvent(new CustomEvent('config:updated', {
        detail: { key: 'desperdicio_global_pct', value: val }
      }));
    } catch (e) {
      setError('No se pudo guardar el desperdicio global');
    }
  };

  const agregar = async () => {
    if (!nuevo.nombre.trim() || !(Number(nuevo.peso_inicial) > 0) || !(Number(nuevo.peso_final) > 0)) return;
    setGuardando(true); setError('');
    try {
      await insumoMermaCreate(insumoId, {
        nombre: nuevo.nombre.trim(),
        peso_inicial: Number(nuevo.peso_inicial),
        peso_final: Number(nuevo.peso_final),
        es_default: lista.length === 0, // la primera que se crea es default
      }, businessId);
      setNuevo({ nombre: '', peso_inicial: '', peso_final: '' });
      cargar();
    } catch (e) { setError(e.message || 'No se pudo agregar'); }
    finally { setGuardando(false); }
  };

  const editar = async (m, campo, valor) => {
    const payload = { [campo]: campo === 'nombre' ? valor : Number(valor) };
    try {
      await insumoMermaUpdate(insumoId, m.id, payload, businessId);
      setLista(prev => prev.map(x => x.id === m.id ? { ...x, ...payload } : x));
    } catch (e) { setError(e.message || 'No se pudo actualizar'); cargar(); }
  };

  const marcarDefault = async (m) => {
    try {
      await insumoMermaUpdate(insumoId, m.id, { es_default: true }, businessId);
      setLista(prev => prev.map(x => ({ ...x, es_default: x.id === m.id })));
    } catch (e) { setError(e.message || 'No se pudo marcar default'); }
  };

  const [aBorrar, setABorrar] = useState(null); // merma a borrar (confirmación)
  const borrar = async (mId) => {
    try {
      await insumoMermaDelete(insumoId, mId, businessId);
      setLista(prev => prev.filter(x => x.id !== mId));
    } catch (e) { setError(e.message || 'No se pudo borrar'); }
  };

  const G = { rojo: '#c62828', verde: '#4caf50' };

  return (
    <Box sx={{ py: 1 }}>
      {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}

      {/* Unidad de medida + precio de compra (solo lectura) */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, width: 220, bgcolor: 'action.hover' }}>
          <Typography variant="caption" sx={{ position: 'absolute', top: -8, left: 8, bgcolor: 'background.paper', px: 0.5, fontSize: '0.65rem', color: 'text.secondary' }}>Unidad de medida del insumo</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{unidad}</Typography>
        </Box>
        <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, width: 200 }}>
          <Typography variant="caption" sx={{ position: 'absolute', top: -8, left: 8, bgcolor: 'background.paper', px: 0.5, fontSize: '0.65rem', color: 'text.secondary' }}>Precio de compra ($/{unidad})</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>${fmt(precioCompra)}</Typography>
        </Box>
      </Stack>

      {/* Header columnas */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, mb: 0.5 }}>
        {['Default', 'Nombre de la merma', 'Peso inicial', 'Peso final', '% Merma', `Precio c/merma`, ''].map((h, i) => (
          <Typography key={i} variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.66rem', textAlign: i >= 2 && i <= 5 ? 'right' : (i === 0 ? 'center' : 'left') }}>{h}</Typography>
        ))}
      </Box>

      {/* ── Fila del desperdicio GLOBAL (no eliminable, no default) ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, py: 0.75, alignItems: 'center', bgcolor: '#fef9c3', borderRadius: 1, mb: 0.5 }}>
        <Box />
        <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#78350f' }}>Desperdicio global</Typography>
        {/* Peso bruto / neto: no aplican a la global (es un % directo) */}
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'right' }}>—</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'right' }}>—</Typography>
        {/* % Merma: acá sí, editable (único lugar del %) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
          <TextField size="small" type="text" inputMode="decimal"
            value={String(globalPct).replace('.', ',')}
            onChange={e => setGlobalPct(sanitizeDecimal(e.target.value))}
            onBlur={e => guardarGlobal(sanitizeDecimal(e.target.value))}
            inputProps={{ style: { textAlign: 'right', fontSize: '0.78rem', width: 40 } }} />
          <Typography variant="caption">%</Typography>
        </Box>
        <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 700, color: '#111' }}>${fmt(precioConGlobal)}</Typography>
        <Box />
      </Box>

      {loading ? (
        <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>
      ) : (
        <>
          {lista.map(m => {
            const esDef = m.es_default;
            return (
              <Box key={m.id} sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, py: 0.5, alignItems: 'center', borderRadius: 1, bgcolor: esDef ? '#f2fbf2' : 'transparent' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <IconButton size="small" onClick={() => marcarDefault(m)} title="Usar por default"
                    sx={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${esDef ? G.verde : '#ccc'}`, bgcolor: esDef ? G.verde : '#fff', color: '#fff', '&:hover': { bgcolor: esDef ? G.verde : '#f5f5f5' } }}>
                    {esDef && <CheckCircleIcon sx={{ fontSize: 15, color: '#fff' }} />}
                  </IconButton>
                </Box>
                <TextField size="small" defaultValue={m.nombre}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== m.nombre) editar(m, 'nombre', e.target.value.trim()); }}
                  inputProps={{ style: { fontSize: '0.8rem' } }} />
                <TextField size="small" type="text" inputMode="decimal" defaultValue={String(Number(m.peso_inicial)).replace('.', ',')}
                  onBlur={e => { const v = sanitizeDecimal(e.target.value); if (Number(v) > 0 && Number(v) !== Number(m.peso_inicial)) editar(m, 'peso_inicial', v); }}
                  inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
                <TextField size="small" type="text" inputMode="decimal" defaultValue={String(Number(m.peso_final)).replace('.', ',')}
                  onBlur={e => { const v = sanitizeDecimal(e.target.value); if (Number(v) > 0 && Number(v) !== Number(m.peso_final)) editar(m, 'peso_final', v); }}
                  inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
                <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: G.rojo }}>{pctMerma(m.peso_inicial, m.peso_final).toFixed(1)}%</Typography>
                <Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 800, color: '#111' }}>${fmt(precioConMerma(m.peso_inicial, m.peso_final))}</Typography>
                <IconButton size="small" onClick={() => setABorrar({ id: m.id, nombre: m.nombre })} sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}

          {/* Fila nueva */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, py: 0.75, mt: 0.5, alignItems: 'center', borderTop: '1px dashed', borderColor: 'divider' }}>
            <Box />
            <TextField size="small" placeholder="Ej: Pelada, Cepillada…" value={nuevo.nombre}
              onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') agregar(); }}
              inputProps={{ style: { fontSize: '0.8rem' } }} />
            <TextField size="small" type="text" inputMode="decimal" placeholder="1000" value={nuevo.peso_inicial}
              onChange={e => setNuevo(n => ({ ...n, peso_inicial: sanitizeDecimal(e.target.value) }))}
              inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
            <TextField size="small" type="text" inputMode="decimal" placeholder="930" value={nuevo.peso_final}
              onChange={e => setNuevo(n => ({ ...n, peso_final: sanitizeDecimal(e.target.value) }))}
              inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
            <Typography variant="caption" sx={{ textAlign: 'right', color: G.rojo, fontWeight: 700 }}>
              {Number(nuevo.peso_inicial) > 0 && Number(nuevo.peso_final) > 0 ? `${pctMerma(nuevo.peso_inicial, nuevo.peso_final).toFixed(1)}%` : '—'}
            </Typography>
            <Typography variant="caption" sx={{ textAlign: 'right', fontWeight: 700 }}>
              {Number(nuevo.peso_final) > 0 ? `$${fmt(precioConMerma(nuevo.peso_inicial, nuevo.peso_final))}` : '—'}
            </Typography>
            <IconButton size="small" onClick={agregar} disabled={guardando || !nuevo.nombre.trim() || !(Number(nuevo.peso_inicial) > 0) || !(Number(nuevo.peso_final) > 0)} sx={{ color: PRIMARY }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Texto explicativo */}
          <Box sx={{ mt: 2, bgcolor: '#fdeaea', border: '1px solid #f2b8be', borderRadius: 1, px: 2, py: 1.25 }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#7a3034', lineHeight: 1.5 }}>
              La merma marcada como <b>default</b> ✓ es la que usan las recetas. El <b>precio con merma</b> es el precio de compra (con el desperdicio global aplicado) dividido por el rendimiento (neto/bruto): lo que realmente cuesta cada {unidad} utilizable.
            </Typography>
          </Box>
        </>
      )}
      <ConfirmDialog
        open={!!aBorrar}
        tipo="merma"
        nombre={aBorrar?.nombre || ''}
        onCancel={() => setABorrar(null)}
        onConfirm={async () => { const id = aBorrar?.id; setABorrar(null); if (id != null) await borrar(id); }}
      />
    </Box>
  );
}

/* ════════════════════════════════════════
   SELECTOR DE COSTO PREFERIDO DEL INSUMO
   costo_preferido: null=auto (gana el más reciente por fecha) | 'compra' | 'elaboracion'
════════════════════════════════════════ */
function CostoPreferidoSelector({ insumoId, businessId, costoPreferido, origenEfectivo, variant = 'switch', onChanged }) {
  const [valor, setValor] = useState(costoPreferido ?? 'auto'); // 'auto' | 'compra' | 'elaboracion'
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setValor(costoPreferido ?? 'auto'); }, [costoPreferido]);

  const guardar = async (nuevo) => {
    setValor(nuevo);
    setGuardando(true);
    try {
      await insumoUpdate(insumoId, {
        costoPreferido: nuevo === 'auto' ? null : nuevo,
      }, businessId);
      onChanged?.(nuevo === 'auto' ? null : nuevo);
      // Avisar a otros montajes del selector (popup ↔ cabeceras) para que se sincronicen
      try {
        window.dispatchEvent(new CustomEvent('insumo:costo-preferido-changed', {
          detail: { insumoId, costoPreferido: nuevo === 'auto' ? null : nuevo },
        }));
      } catch { }
      setAbierto(false);
    } catch (e) {
      console.error('[CostoPreferidoSelector]', e.message);
    } finally {
      setGuardando(false);
    }
  };

  // Texto del costo activo (para el aviso)
  const activoTxt = origenEfectivo === 'compra' ? 'última compra' : 'receta';
  const esAuto = valor === 'auto';

  const chips = (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {[
        { v: 'auto', label: 'Automático' },
        { v: 'compra', label: 'Compra' },
        { v: 'elaboracion', label: 'Receta' },
      ].map(opt => (
        <Chip
          key={opt.v}
          label={opt.label}
          size="small"
          disabled={guardando}
          onClick={() => guardar(opt.v)}
          color={valor === opt.v ? 'primary' : 'default'}
          variant={valor === opt.v ? 'filled' : 'outlined'}
          sx={{ fontSize: '0.72rem', height: 24, cursor: 'pointer' }}
        />
      ))}
    </Box>
  );

  if (variant === 'switch') {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
          ¿Qué costo usar para este insumo en las recetas?
        </Typography>
        {chips}
        {esAuto && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.68rem', mt: 0.5 }}>
            Automático: usa el más reciente entre la receta y la última compra. Ahora activo: {activoTxt}.
          </Typography>
        )}
      </Box>
    );
  }

  // variant === 'aviso'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Chip
        label={`Costo activo: ${activoTxt}${esAuto ? ' (auto)' : ''}`}
        size="small"
        onClick={() => setAbierto(v => !v)}
        variant="outlined"
        sx={{ fontSize: '0.72rem', height: 24, cursor: 'pointer', borderColor: PRIMARY, color: PRIMARY }}
      />
      {abierto && chips}
    </Box>
  );
}

function TabComprasInsumo({ insumoId, businessId, insumoData }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Rango amplio: todo el historial disponible del insumo
  const rango = useMemo(() => {
    const hoy = new Date();
    const to = hoy.toISOString().slice(0, 10);
    const from = `${hoy.getFullYear() - 5}-01-01`;
    return { from, to };
  }, []);

  useEffect(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${BASE}/purchases?insumo_id=${insumoId}&from=${rango.from}&to=${rango.to}&limit=500`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        const data = await res.json().catch(() => ({}));
        setItems(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [insumoId, businessId, rango]);

  return (
    <Box sx={{ py: 1 }}>
      {insumoData && (
        <Box sx={{ mb: 1.5 }}>
          <CostoPreferidoSelector
            insumoId={insumoId}
            businessId={businessId}
            costoPreferido={insumoData.costo_preferido ?? null}
            origenEfectivo={insumoData.costo_efectivo_origen}
            variant="aviso"
          />
        </Box>
      )}
      <ComprasDetalleContenido
        open={true}
        insumoId={insumoId}
        insumoNombre={insumoData?.nombre || ''}
        insumoUnidad={insumoData?.unidad_med || insumoData?.medida || ''}
        rango={rango}
        items={items}
        loading={loading}
        businessId={businessId}
        businesses={[]}
      />
    </Box>
  );
}

function TabEquivalenciasInsumo({ insumoId, businessId, insumoData, recetaInfo = null }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Fila nueva en edición
  const [nuevo, setNuevo] = useState({ nombre: '', contenido: '', unidad: '' });
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);  // lock síncrono: evita doble disparo (onBlur + Enter/onClose)

  // La prop insumoData puede llegar incompleta (sin contenido_envase) por timing de la
  // lista del modal. Traemos el insumo fresco del backend para tener el envase real.
  const [insumoFull, setInsumoFull] = useState(insumoData);
  useEffect(() => {
    if (!insumoId || !businessId) return;
    insumoGet(insumoId, businessId)
      .then(r => { if (r?.data) setInsumoFull(r.data); })
      .catch(() => setInsumoFull(insumoData));
  }, [insumoId, businessId]);

  const [envase, setEnvase] = useState({
    contenido: insumoFull?.contenido_envase != null ? String(insumoFull.contenido_envase).replace('.', ',') : '',
    unidad: insumoFull?.unidad_envase || 'ml',
  });
  // Re-sincronizar el envase cuando llega el insumo fresco del backend.
  useEffect(() => {
    setEnvase({
      contenido: insumoFull?.contenido_envase != null ? String(insumoFull.contenido_envase).replace('.', ',') : '',
      unidad: insumoFull?.unidad_envase || 'ml',
    });
  }, [insumoFull?.contenido_envase, insumoFull?.unidad_envase]);

  const guardarEnvase = useCallback(async (override = {}) => {
    // override permite pasar el valor recién seleccionado antes de que el estado se actualice
    // (el Select dispara guardado en el mismo ciclo que el setState, que es asíncrono).
    const unidadFinal = override.unidad ?? envase.unidad;
    const contenidoRaw = override.contenido ?? envase.contenido;
    const cont = contenidoRaw === '' ? null : Number(String(contenidoRaw).replace(',', '.'));
    try {
      await insumoUpdate(insumoId, {
        contenidoEnvase: cont,
        unidadEnvase: cont == null ? null : unidadFinal,
      }, businessId);
      // Reflejar el cambio en insumoData (mismo objeto de la lista `insumos` en memoria)
      // para que al remontar el tab no lea el valor viejo.
      if (insumoData) {
        insumoData.contenido_envase = cont;
        insumoData.unidad_envase = cont == null ? null : unidadFinal;
      }
      // Reflejar en el estado local para que el tab actualice sin refetch
      setInsumoFull(prev => ({ ...(prev || {}), contenido_envase: cont, unidad_envase: cont == null ? null : unidadFinal }));
      // Avisar al resto (dropdown de unidades en ingredientes, etc.)
      try { window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId } })); } catch { }
    } catch (e) {
      setError(e.message || 'No se pudo guardar el envase');
    }
  }, [envase, insumoId, businessId, insumoData]);

  const precioRef = Number(insumoFull?.precio_ref) || 0;
  const unidadBase = canonicalUnit(insumoFull?.unidad_med || insumoFull?.medida || 'u');

  // Unidades válidas según la familia del insumo (igual que en recetas):
  // peso (gr/kg), volumen (ml/lt), o unidad. No se mezclan familias.
  const UNIDADES_EQ = useMemo(() => {
    // Caso elaborado con rendimiento en peso: la equivalencia fracciona la receta,
    // así que la familia la manda la unidad de peso del rendimiento (gr/kg o ml/lt).
    if (recetaInfo?.esElaborado && Number(recetaInfo.rendimientoPeso) > 0) {
      const famPeso = canonicalUnit(recetaInfo.unidadPeso || 'gr');
      if (famPeso === 'kg' || famPeso === 'gr') return ['gr', 'kg'];
      if (famPeso === 'lt' || famPeso === 'ml') return ['ml', 'lt'];
    }
    const fam = canonicalUnit(unidadBase);
    if (fam === 'kg' || fam === 'gr') return ['gr', 'kg'];
    if (fam === 'lt' || fam === 'ml') return ['ml', 'lt'];
    // Insumo en unidad: la familia la hereda del contenido del envase definido arriba.
    const famEnvase = canonicalUnit(envase?.unidad || insumoFull?.unidad_envase || '');
    if (famEnvase === 'kg' || famEnvase === 'gr') return ['gr', 'kg'];
    if (famEnvase === 'lt' || famEnvase === 'ml') return ['ml', 'lt'];
    // Sin envase definido: todas las medibles (el usuario decide la familia al crear la equivalencia)
    return ['gr', 'kg', 'ml', 'lt'];
  }, [unidadBase, envase?.unidad, insumoFull?.unidad_envase, recetaInfo]);

  // Costo de una equivalencia: distingue elaborado (costo/rendimiento) de insumo simple (precio_ref)
  const calcCosto = useCallback((contenido, unidad) => {
    if (!(Number(contenido) > 0)) return 0;
    // ── Elaborado con peso equivalente: costo por gr = (costoTotal/cantidad) / pesoEq ──
    if (recetaInfo?.esElaborado && recetaInfo.rendimientoPeso > 0 && recetaInfo.cantidad > 0) {
      const costoPorUnidad = recetaInfo.costoTotal / recetaInfo.cantidad;       // ej. $1.718 por unidad
      const costoPorPeso = costoPorUnidad / recetaInfo.rendimientoPeso;         // ej. $11,45/gr
      const factor = getConversionFactor(canonicalUnit(unidad), canonicalUnit(recetaInfo.unidadPeso || 'gr'));
      return Number(contenido) * factor * costoPorPeso;
    }
    // ── Insumo unidad CON envase cargado: costo = contenido × (precio_ref / contenido_envase) ──
    // Usar el estado local del envase (actualizado en vivo) en vez de la prop insumoData
    // que puede estar desactualizada hasta que se refresque el modal.
    const contEnvaseLocal = envase?.contenido !== '' && envase?.contenido != null
      ? Number(String(envase.contenido).replace(',', '.'))
      : Number(insumoFull?.contenido_envase) || 0;
    const contEnvase = Number(contEnvaseLocal) || 0;
    const uniEnvase = canonicalUnit(envase?.unidad || insumoFull?.unidad_envase || '');
    if (unidadBase === 'u' && contEnvase > 0 && uniEnvase) {
      if (!precioRef) return 0;
      const costoPorUnidadEnvase = precioRef / contEnvase;               // ej. $8215/750ml = $10,95/ml
      const factor = getConversionFactor(canonicalUnit(unidad), uniEnvase); // convertir la unidad de la equiv. a la del envase
      return Number(contenido) * factor * costoPorUnidadEnvase;
    }
    // ── Insumo simple medible: contenido convertido a unidad base × precio_ref ──
    if (!precioRef) return 0;
    const factor = getConversionFactor(canonicalUnit(unidad), unidadBase);
    return Number(contenido) * factor * precioRef;
  }, [precioRef, unidadBase, recetaInfo, insumoFull, envase]);

  const cargar = useCallback(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoEquivalenciasList(insumoId, businessId)
      .then(r => setLista(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setError('No se pudieron cargar las equivalencias'))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Si la unidad elegida ya no pertenece a la familia (cambió el insumo/envase), limpiarla.
  // No forzamos una por defecto: el usuario debe elegir, y eso evita autoguardar antes de tiempo.
  useEffect(() => {
    setNuevo(n => (n.unidad === '' || UNIDADES_EQ.includes(n.unidad) ? n : { ...n, unidad: '' }));
  }, [UNIDADES_EQ]);

  // Autoguardado: se dispara al salir de un campo (onBlur) si la fila está completa.
  // No hay botón: agregar = escribir nombre + contenido + unidad.
  const guardarNueva = useCallback(async () => {
    const nombre = nuevo.nombre.trim();
    const contenido = Number(String(nuevo.contenido).replace(',', '.'));
    if (!nombre || !(contenido > 0) || !nuevo.unidad) return;  // fila incompleta: no guardar aún
    if (guardandoRef.current) return;   // ya hay un guardado en curso (chequeo síncrono)
    guardandoRef.current = true;
    setGuardando(true);
    setError('');
    try {
      await insumoEquivalenciaCreate(insumoId, {
        nombre,
        contenido,
        unidad: nuevo.unidad,
      }, businessId);
      setNuevo({ nombre: '', contenido: '', unidad: '' });
      cargar();
      try { window.dispatchEvent(new CustomEvent('insumo:equivalencias-changed', { detail: { insumoId } })); } catch { }
    } catch (e) {
      setError(e.message || 'No se pudo agregar');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }, [nuevo, guardando, insumoId, businessId, cargar, UNIDADES_EQ]);

  const editar = async (eq, campo, valor) => {
    // Optimistic: actualizar en local, persistir onBlur
    const payload = { [campo]: campo === 'contenido' ? Number(valor) : valor };
    try {
      await insumoEquivalenciaUpdate(insumoId, eq.id, payload, businessId);
      setLista(prev => prev.map(x => x.id === eq.id ? { ...x, ...payload } : x));
      try { window.dispatchEvent(new CustomEvent('insumo:equivalencias-changed', { detail: { insumoId } })); } catch { }
    } catch (e) {
      setError(e.message || 'No se pudo actualizar');
      cargar();
    }
  };

  const [aBorrar, setABorrar] = useState(null); // equivalencia a borrar (confirmación)
  const borrar = async (eqId) => {
    try {
      await insumoEquivalenciaDelete(insumoId, eqId, businessId);
      setLista(prev => prev.filter(x => x.id !== eqId));
      try { window.dispatchEvent(new CustomEvent('insumo:equivalencias-changed', { detail: { insumoId } })); } catch { }
    } catch (e) {
      setError(e.message || 'No se pudo borrar');
    }
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Definí medidas propias de este insumo (ej: "Cucharada sopera = 15 gr"). Luego las usás como unidad en la receta.
      </Typography>
      {/* Info del insumo: base de cálculo según el caso (elaborado con peso / simple medible) */}
      {(() => {
        const fmtAR = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // Caso elaborado con rendimiento en peso: mostrar costo por unidad de rendimiento y por peso
        if (recetaInfo?.esElaborado && Number(recetaInfo.rendimientoPeso) > 0 && Number(recetaInfo.cantidad) > 0) {
          const costoPorUnidad = Number(recetaInfo.costoTotal) / Number(recetaInfo.cantidad);
          const costoPorPeso = costoPorUnidad / Number(recetaInfo.rendimientoPeso);
          const uPeso = canonicalUnit(recetaInfo.unidadPeso || 'gr');
          return (
            <Box sx={{ mb: 1.5, bgcolor: '#eaf1fb', border: '1px solid #c3d7f0', borderRadius: 1, px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', color: '#2d4a6b' }}>
                Rinde {recetaInfo.cantidad} {recetaInfo.rendimientoUnidad || 'porción'}(es) de {recetaInfo.rendimientoPeso} {uPeso} c/u · Costo total ${fmtAR(recetaInfo.costoTotal)}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#2d4a6b' }}>
                Costo por {uPeso} = ${fmtAR(costoPorPeso)}
              </Typography>
            </Box>
          );
        }
        // Caso insumo simple medible (kg/gr/lt/ml): mostrar costo por unidad base
        if (precioRef > 0 && unidadBase !== 'u') {
          return (
            <Box sx={{ mb: 1.5, bgcolor: '#eaf1fb', border: '1px solid #c3d7f0', borderRadius: 1, px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#2d4a6b' }}>
                Costo por {unidadBase} = ${fmtAR(precioRef)}
              </Typography>
            </Box>
          );
        }
        return null;
      })()}
      {/* Contenido del envase: solo para insumos comprados en unidad (no medibles) */}
      {unidadBase === 'u' && !insumoFull?.es_elaborado && (
        <Box sx={{
          mb: 2, p: 1.5, borderRadius: 1.5,
          border: '1px solid', borderColor: 'divider', bgcolor: `${PRIMARY}06`,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}>
            Contenido del envase
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontSize: '0.72rem' }}>
            Cuánto trae 1 unidad de este insumo. Ej: 1 botella = 750 ml. Con esto podés usarlo por ml/gr en las recetas.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>1 unidad =</Typography>
            <TextField
              type="text"
              inputMode="decimal"
              size="small"
              value={envase.contenido}
              onChange={e => setEnvase(v => ({ ...v, contenido: sanitizeDecimal(e.target.value) }))}
              onBlur={() => guardarEnvase()}
              placeholder="000"
              inputProps={{ style: { textAlign: 'right', padding: '6px 8px' } }}
              sx={{ width: 90 }}
            />
            <FormControl size="small" sx={{ width: 80 }}>
              <Select
                value={envase.unidad}
                onChange={e => {
                  const nuevaUnidad = e.target.value;
                  setEnvase(v => ({ ...v, unidad: nuevaUnidad }));
                  guardarEnvase({ unidad: nuevaUnidad });   // guardar con el valor nuevo, no el del estado stale
                }}
                sx={{ '& .MuiSelect-select': { py: '6px' } }}
              >
                <MenuItem value="ml">ml</MenuItem>
                <MenuItem value="lt">lt</MenuItem>
                <MenuItem value="gr">gr</MenuItem>
                <MenuItem value="kg">kg</MenuItem>
              </Select>
            </FormControl>
            {precioRef > 0 && (() => {
              const cont = Number(String(envase.contenido).replace(',', '.')) || 0;
              const uCh = canonicalUnit(envase.unidad || 'ml');           // unidad chica (ml/gr)
              const uGr = (uCh === 'ml' || uCh === 'lt') ? 'lt'
                : (uCh === 'gr' || uCh === 'kg') ? 'kg' : uCh;     // unidad grande (lt/kg)
              const fmtAR = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              // Costo por 1 unidad grande = (precio / contenido) convertido a la unidad grande.
              // getConversionFactor(chica, grande): cuántas unidades grandes hay en 1 chica (ej. ml→lt = 0.001)
              const factorChicaAGrande = getConversionFactor(uCh, uGr);   // 0.001 para ml→lt
              const costoPorGrande = (cont > 0 && factorChicaAGrande > 0)
                ? (precioRef / cont) / factorChicaAGrande
                : 0;
              return (
                <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                  {cont > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Costo por {String(envase.contenido)} {uCh} = ${fmtAR(precioRef)}
                    </Typography>
                  )}
                  {costoPorGrande > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
                      Costo por 1 {uGr} = ${fmtAR(costoPorGrande)}
                    </Typography>
                  )}
                </Box>
              );
            })()}
          </Box>
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>{error}</Alert>}

      {/* Header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 90px 90px 120px 90px', gap: 1, px: 1, mb: 0.5 }}>
        {['Nombre', 'Contenido', 'Unidad', 'Costo', ''].map((h, i) => (
          <Typography key={i} variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.68rem' }}>{h}</Typography>
        ))}
      </Box>

      {loading ? (
        <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>
      ) : (
        <>
          {lista.map(eq => (
            <Box key={eq.id} sx={{ display: 'grid', gridTemplateColumns: '1.5fr 90px 90px 120px 90px', gap: 1, px: 1, py: 0.5, alignItems: 'center', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
              <TextField size="small" defaultValue={eq.nombre}
                onBlur={e => { if (e.target.value.trim() && e.target.value !== eq.nombre) editar(eq, 'nombre', e.target.value.trim()); }}
                inputProps={{ style: { fontSize: '0.8rem' } }} />
              <TextField size="small" type="text" inputMode="decimal"
                defaultValue={String(Number(eq.contenido)).replace('.', ',')}
                onBlur={e => { const v = sanitizeDecimal(e.target.value); if (Number(v) > 0 && Number(v) !== Number(eq.contenido)) editar(eq, 'contenido', v); }}
                inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
              <Select size="small" value={eq.unidad}
                onChange={e => editar(eq, 'unidad', e.target.value)}
                sx={{ fontSize: '0.78rem', '& .MuiSelect-select': { py: '4px' } }}>
                {UNIDADES_EQ.map(u => <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem' }}>{u}</MenuItem>)}
              </Select>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: PRIMARY }}>
                {calcCosto(eq.contenido, eq.unidad) > 0 ? `$${fmt(calcCosto(eq.contenido, eq.unidad))}` : '—'}
              </Typography>
              <IconButton size="small" onClick={() => setABorrar({ id: eq.id, nombre: eq.nombre })} sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}

          {/* Fila nueva */}
          <Box
            onBlur={(e) => {
              // Guardar solo cuando el foco sale de TODA la fila (no al saltar entre sus campos)
              if (!e.currentTarget.contains(e.relatedTarget)) guardarNueva();
            }}
            sx={{ display: 'grid', gridTemplateColumns: '1.5fr 90px 90px 120px 90px', gap: 1, px: 1, py: 0.75, mt: 0.5, alignItems: 'center', borderTop: '1px dashed', borderColor: 'divider' }}>
            <TextField size="small" placeholder="Ej: Cucharada sopera" value={nuevo.nombre}
              onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') guardarNueva(); }}
              inputProps={{ style: { fontSize: '0.8rem' } }} />
            <TextField size="small" type="text" inputMode="decimal" placeholder="15" value={nuevo.contenido}
              onChange={e => setNuevo(n => ({ ...n, contenido: sanitizeDecimal(e.target.value) }))}
              onKeyDown={e => { if (e.key === 'Enter') guardarNueva(); }}
              inputProps={{ style: { textAlign: 'right', fontSize: '0.8rem' } }} />
            <Select size="small" value={nuevo.unidad} displayEmpty
              onChange={e => setNuevo(n => ({ ...n, unidad: e.target.value }))}
              sx={{ fontSize: '0.78rem', '& .MuiSelect-select': { py: '4px' }, color: nuevo.unidad ? 'inherit' : 'text.disabled' }}>
              <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>unidad</MenuItem>
              {UNIDADES_EQ.map(u => <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem' }}>{u}</MenuItem>)}
            </Select>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.disabled', gridColumn: 'span 2' }}>
              {calcCosto(nuevo.contenido, nuevo.unidad) > 0 ? `$${fmt(calcCosto(nuevo.contenido, nuevo.unidad))}` : '—'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.disabled', gridColumn: 'span 2' }}>
              {calcCosto(nuevo.contenido, nuevo.unidad) > 0 ? `$${fmt(calcCosto(nuevo.contenido, nuevo.unidad))}` : '—'}
            </Typography>
          </Box>
        </>
      )}
      <ConfirmDialog
        open={!!aBorrar}
        tipo="equivalencia"
        nombre={aBorrar?.nombre || ''}
        onCancel={() => setABorrar(null)}
        onConfirm={async () => { const id = aBorrar?.id; setABorrar(null); if (id != null) await borrar(id); }}
      />
    </Box>
  );
}

/* ════════════════════════════════════════
   TAB USO — recetas donde se usa el insumo (solo lectura)
════════════════════════════════════════ */
function TabUsoInsumo({ insumoId, businessId, insumoData }) {
  const [uso, setUso] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoUsoList(insumoId, businessId)
      .then(r => setUso(Array.isArray(r?.uso) ? r.uso : []))
      .catch(() => setUso([]))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  const unidadBase = insumoData?.unidad_med || insumoData?.medida || 'u';

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Recetas donde se usa <b>{insumoData?.nombre || 'este insumo'}</b>
        {uso.length > 0 && ` · ${uso.length} ${uso.length === 1 ? 'receta' : 'recetas'}`}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : uso.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
          <Typography variant="body2">Este insumo no se usa en ninguna receta todavía.</Typography>
        </Box>
      ) : (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: '90px 1fr 130px 140px', gap: 1,
            px: 1.5, py: 1, bgcolor: `${PRIMARY}0d`, borderBottom: '1px solid', borderColor: 'divider',
            fontWeight: 700, fontSize: '0.75rem', color: PRIMARY,
          }}>
            <div>Código art.</div>
            <div>Nombre</div>
            <div style={{ textAlign: 'right' }}>Cantidad</div>
            <div>Merma</div>
          </Box>
          {/* Filas */}
          {uso.map((u, i) => (
            <Box key={u.item_id ?? i} sx={{
              display: 'grid', gridTemplateColumns: '90px 1fr 130px 140px', gap: 1,
              px: 1.5, py: 1, alignItems: 'center',
              borderBottom: i < uso.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: '#f8fafc' },
            }}>
              <div style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {u.codigo || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                {u.es_elaborado && (
                  <span title="Insumo elaborado" style={{ color: '#6366f1', fontSize: '0.7rem', flexShrink: 0 }}>●</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.nombre}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {Number(u.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {u.unidad || unidadBase}
              </div>
              <div style={{ color: u.aplica_merma ? '#0891b2' : '#94a3b8', fontSize: '0.78rem' }}>
                {u.merma_nombre
                  ? u.merma_nombre
                  : (u.aplica_merma ? 'Sí (global)' : 'No')}
              </div>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ════════════════════════════════════════
   SELECTOR PREVIO (4 opciones al abrir un insumo)
════════════════════════════════════════ */
function SelectorInsumo({ nombre, insumoId, onElegir }) {
  const opciones = [
    {
      id: 'merma', titulo: 'Merma', icono: '🔻', bg: '#fdeaea',
      desc: 'Registrá el desperdicio del insumo: peladura, cepillado, limpieza. Ajusta el costo real por unidad utilizable.'
    },
    {
      id: 'receta', titulo: 'Receta / Compras', icono: '📖', bg: '#e8f4e8',
      desc: 'Costeá el insumo por receta o por sus compras registradas.'
    },
    {
      id: 'equivalencias', titulo: 'Equivalencias', icono: '⚖️', bg: '#eaf1fb',
      desc: 'Definí medidas propias (cuchara, dip, unidad) para convertir a gramos o ml en las recetas.'
    },
    {
      id: 'reemplazar', titulo: 'Reemplazar', icono: '🔁', bg: '#f3eafb',
      desc: 'Sustituí este insumo por otro en todas las recetas donde aparece.'
    },
  ];
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} textAlign="center" sx={{ mb: 2.5 }}>
        ¿Qué querés configurar de este insumo?
      </Typography>
      <Stack spacing={1.5}>
        {opciones.map(o => (
          <Box key={o.id}
            onClick={() => onElegir(o.id)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              px: 2, py: 1.75, cursor: 'pointer', transition: 'all .15s',
              '&:hover': { borderColor: PRIMARY, bgcolor: `${PRIMARY}05` },
            }}>
            <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: o.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {o.icono}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={800}>{o.titulo}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>{o.desc}</Typography>
            </Box>
            <Typography sx={{ color: 'text.disabled', fontSize: 18 }}>›</Typography>
          </Box>
        ))}
      </Stack>
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
  esPromo = false,
  modoPromoNueva = false,
  getRecetaUrl = null,
  saveRecetaUrl = null,
  calcPrecioPorLista = null,
  onPriceConfigSave = null,
  onNavigate = null,
  canNavigate = { prev: false, next: false },
  priceConfig = { byArticle: {}, byRubro: {}, byAgrupacion: {} },
  allArticulos = [],
  promoIds = new Set(),
  priceLists = [],
  priceListsByList = {},
  modoInsumo = false,
  saltarSelector = false,   // cascada / tabla artículos: abrir directo sin la vista de 4 opciones
}) {
  const [receta, setReceta] = useState(null);
  const [tab, setTab] = useState('receta'); // 'merma' | 'receta' | 'compras' | 'equivalencias' — solo aplica si modoInsumo
  // Selector previo: null = mostrar selector (solo en modoInsumo), true = ya eligió, mostrar modal
  const [entradaElegida, setEntradaElegida] = useState(!modoInsumo || saltarSelector);
  const [recetaConfirmada, setRecetaConfirmada] = useState(false);
  const [reemplazarModalOpen, setReemplazarModalOpen] = useState(false);
  const [reemplazarAviso, setReemplazarAviso] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [rendimientoUnidad, setRendimientoUnidad] = useState('porcion');
  const [rendimientoPeso, setRendimientoPeso] = useState(null);
  const [unidadPeso, setUnidadPeso] = useState(null);
  // Leer config global del contexto — se actualiza automáticamente sin fetch propio
  const appConfig = useConfig();
  const [openSearchIdx, setOpenSearchIdx] = useState(null);
  const [pctCostoIdeal, setPctCostoIdeal] = useState(30);
  // globalConfigObjetivo viene del contexto global, no de un fetch local
  const globalConfigObjetivo = esElaborado
    ? (appConfig.insumosCostoIdeal ?? 30)
    : (appConfig.articulosCostoIdeal ?? 30);
  const [items, setItems] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);
  const bodyRef = useRef(null);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const alertaSemanas = appConfig.comprasAlertaSemanas ?? 4;
  const [sortByCosto, setSortByCosto] = useState(false);

  // Notas y foto de la receta
  const [notas, setNotas] = useState('');
  const [notasUpdatedAt, setNotasUpdatedAt] = useState(null); // fecha última edición de notas
  const [foto, setFoto] = useState(null);   // base64 o URL (compat: primera del array)
  const [fotos, setFotos] = useState([]);   // array de fotos (hasta 6)

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sub-modales
  const [notasModalOpen, setNotasModalOpen] = useState(false);
  const [previewFotoOpen, setPreviewFotoOpen] = useState(false);
  const [editarFotoSrc, setEditarFotoSrc] = useState(null); // foto en edición desde el preview
  const [cocinaModalOpen, setCocinaModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [verCostosExtra, setVerCostosExtra] = useState(false); // insumos: mostrar sugerido + % costo (solo vista)

  const [soloConCompras, setSoloConCompras] = useState(() => {
    try { return localStorage.getItem('receta_solo_con_compras') === '1'; } catch { return false; }
  });
  const toggleSoloConCompras = useCallback(() => {
    setSoloConCompras(prev => {
      const next = !prev;
      try { localStorage.setItem('receta_solo_con_compras', next ? '1' : '0'); } catch { }
      return next;
    });
  }, []);

  const artNombre = articulo?.nombre || '';
  const precioActual = Number(articulo?.precio || 0);

  const [localRecetasElaborados, setLocalRecetasElaborados] = useState(recetasElaborados);
  const recetasElabRef = useRef(recetasElaborados);

  const [excluirOpen, setExcluirOpen] = useState(false);

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

  const skipAutoSaveRef = useRef(false);

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
  // Inicializa el objetivo mostrado con el externo SOLO al abrir el modal.
  // Después, los cambios en la receta mandan (no re-pisar con el externo viejo).
  useEffect(() => {
    if (!open) return;
    if (esElaborado) return;
    if (costoObjetivoExterno != null) {
      setPctCostoIdeal(Number(costoObjetivoExterno));
      costoObjetivoExternoRef.current = Number(costoObjetivoExterno);
    }
  }, [open, esElaborado]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cargar gemelos al abrir + función reutilizable ── */
  const loadGemelosGroup = useCallback(() => {
    if (!businessId || !articulo?.id || esElaborado || promoMode) return;
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
  }, [businessId, articulo?.id, esElaborado, esPromo]);

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

  // ── Lupa: buscar artículo/insumo y abrir en cascada ──
  const [lupaAnchor, setLupaAnchor] = useState(null);
  const [lupaQuery, setLupaQuery] = useState('');
  const [lupaResults, setLupaResults] = useState([]);
  const [lupaLoading, setLupaLoading] = useState(false);

  const buscarLupa = useCallback(async (q) => {
    if (!q || !q.trim()) { setLupaResults([]); return; }
    setLupaLoading(true);
    const term = q.trim().toLowerCase();
    try {
      const token = localStorage.getItem('token') || '';
      // Buscar insumos y artículos en paralelo, juntar ambos
      const [insumosRes, articlesRes] = await Promise.allSettled([
        insumosList(insumosBizId || businessId, { limit: 99999 }),
        fetch(
          `${BASE}/businesses/${businessId}/articles/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) } }
        ).then(r => r.json()),
      ]);

      const insumosItems = insumosRes.status === 'fulfilled' && Array.isArray(insumosRes.value?.data)
        ? ordenarInsumosBusqueda(
          insumosRes.value.data
            .filter(i => (i.nombre || '').toLowerCase().includes(term) && Number(i.id) !== Number(articulo?.id))
        )
          .slice(0, 20)
          .map(i => ({ ...i, esArticulo: false }))   // objeto completo, no pelado
        : [];

      const articulosItems = articlesRes.status === 'fulfilled' && Array.isArray(articlesRes.value?.items)
        ? articlesRes.value.items
          .filter(a => Number(a.id) !== Number(articulo?.id))
          .slice(0, 20)
          .map(a => ({ id: a.id, nombre: a.nombre, esArticulo: true }))
        : [];

      setLupaResults([...insumosItems, ...articulosItems]);
    } catch {
      setLupaResults([]);
    } finally {
      setLupaLoading(false);
    }
  }, [businessId, insumosBizId, articulo?.id]);

  useEffect(() => {
    if (!open) return;
    setEntradaElegida(!modoInsumo || saltarSelector);
    // Si se salta el selector en modo insumo (cascada), resolver el tab igual que "Receta / Compras"
    if (modoInsumo && saltarSelector) {
      const insData = insumos.find(i => String(i.id) === String(articulo?.id));
      // Guard anti-parpadeo: no resolver hasta tener el insumo cargado.
      // Sin esto, la 1ra pasada corre con `insumos` vacío y cae en 'receta',
      // luego llega la lista y salta a 'compras' (parpadeo visible).
      if (insData) {
        const tieneCompras = Number(insData.cantidad_compras) > 0;
        const tieneReceta = insData.tiene_receta === true || insData.es_elaborado === true;
        let destino;
        if (tieneCompras && tieneReceta) {
          // Ambos: el modificado más reciente gana (mismo patrón que línea ~3731).
          const fCompra = insData.fecha_ultima_compra ? new Date(insData.fecha_ultima_compra).getTime() : 0;
          const fReceta = insData.receta_updated_at ? new Date(insData.receta_updated_at).getTime() : 0;
          destino = fReceta >= fCompra ? 'receta' : 'compras';
        } else if (tieneCompras) {
          destino = 'compras';
        } else {
          destino = 'receta';   // solo receta, o nada
        }
        setTab(destino);
      }
    }
    setRecetaConfirmada(false);
  }, [open, modoInsumo, saltarSelector, insumos, articulo?.id]);

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

  const handleElegirEntrada = useCallback((opcion) => {
    if (opcion === 'reemplazar') {
      setReemplazarModalOpen(true);
      return;
    }
    // Botón compartido "Receta / Compras": dirigir según lo que tenga el insumo
    if (opcion === 'receta') {
      const insData = insumos.find(i => String(i.id) === String(articulo?.id));
      const origen = insData?.costo_efectivo_origen;
      const tieneCompras = Number(insData?.cantidad_compras) > 0;
      // 'compra' solo dirige a compras si realmente hay compras; sin compras ni receta → receta
      const destino = (origen === 'compra' && tieneCompras) ? 'compras'
        : origen === 'elaboracion' ? 'receta'
          : tieneCompras ? 'compras'
            : 'receta';
      setTab(destino);
    } else {
      setTab(opcion);   // merma, equivalencias
    }
    setEntradaElegida(true);
  }, [insumos, articulo?.id]);

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

  // Escuchar cambios de costo_preferido (desde el selector en el popup de compras)
  // y actualizar el insumo en memoria para que el cálculo refresque al instante.
  useEffect(() => {
    const handler = (e) => {
      const { insumoId, costoPreferido } = e.detail || {};
      if (!insumoId) return;
      setInsumos(prev => prev.map(i => {
        if (String(i.id) !== String(insumoId)) return i;
        let origen;
        if (costoPreferido) {
          origen = costoPreferido;
        } else {
          const fCompra = i.fecha_ultima_compra ? new Date(i.fecha_ultima_compra).getTime() : 0;
          const fReceta = i.receta_updated_at ? new Date(i.receta_updated_at).getTime() : 0;
          const tieneReceta = fReceta > 0;
          const tieneCompra = fCompra > 0;
          origen = !tieneReceta ? 'compra'
            : !tieneCompra ? 'elaboracion'
              : (fCompra > fReceta ? 'compra' : 'elaboracion');
        }
        return { ...i, costo_preferido: costoPreferido, costo_efectivo_origen: origen };
      }));
    };
    window.addEventListener('insumo:costo-preferido-changed', handler);
    return () => window.removeEventListener('insumo:costo-preferido-changed', handler);
  }, []);

  // Detección automática de promo: si hay al menos un ítem-artículo, es promo
  const esPromoDetectada = useMemo(
    () => items.some(it => Number(it.articleRefId) && Number(it.articleRefId) !== 0),
    [items]
  );
  const esPromoEfectiva = esPromo || esPromoDetectada;
  // Estado editable del switch Producto/Promoción. Inicializa según el estado real.
  // Solo se PERSISTE al Guardar; el autoSave no convierte tipo.
  const [promoMode, setPromoMode] = useState(esPromoEfectiva);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);
  // Se prende al activar el switch en un artículo COMÚN (no vive en Promociones):
  // el artículo se auto-agrega como primer componente y al guardar se crea la promo (flujo v1).
  const [convertirEnPromo, setConvertirEnPromo] = useState(false);
  // ¿Se puede degradar a Producto? Solo si es promo v1 (ID negativo) o si el artículo
  // llegó a Promociones por el switch desde otra agrupación (tiene fromGroupName).
  // Un artículo que nació en Promociones queda fijo en Promoción.
  const puedeVolverAProducto = Number(articulo?.id) < 0 || !!(articulo?.fromGroupName && String(articulo.fromGroupName).trim());
  // Resincronizar cuando cambia el artículo o su condición de promo (al abrir otro modal)
  useEffect(() => { setPromoMode(esPromoEfectiva); }, [esPromoEfectiva]);
  // Al abrir otro artículo, resetear el flag de conversión a promo
  useEffect(() => { setConvertirEnPromo(false); }, [articulo?.id, open]);
  const [listaSinPromo, setListaSinPromo] = useState(null); // null = principal/favorita

  // Color de la lista activa para la columna "$ Sin Promo"
  const colorSinPromo = useMemo(() => {
    if (!listaSinPromo) return '#7c3aed';  // principal → violeta por defecto
    const idx = (priceLists || []).findIndex(l => String(l.id) === String(listaSinPromo));
    return idx >= 0 ? colorForList(priceLists[idx], idx) : '#7c3aed';
  }, [listaSinPromo, priceLists]);

  // Grid de la tabla de ingredientes: en promo suma la columna "$ sin promo"
  const gridIngredientes = promoMode
    ? '20px 1.8fr 68px 66px 80px 90px 28px 1fr 28px 28px'   // +90px para $ sin promo
    : '20px 1.8fr 68px 66px 80px 28px 1fr 28px 28px';

  const getPrecioSinPromo = useCallback((articleRefId) => {
    if (!articleRefId) return null;
    const art = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === Number(articleRefId));
    if (!art) return 0;
    // Precio base (lista principal): nuevo precio si se definió en la tabla, sino el precio de venta
    // El nuevo precio (precio_manual) vive en priceConfig.byArticle — la misma fuente
    // que usa la columna "Nuevo precio" de la tabla. priceListsByList._base venía incompleto.
    // Nuevo precio de la lista principal (precio_manual) si se definió; sino, precio de venta.
    const baseEntry = priceListsByList?._base?.byArticle?.[String(articleRefId)];
    const nuevoPrecio = Number(baseEntry?.precioManual ?? baseEntry?.precio_manual);
    const precioBase = nuevoPrecio > 0 ? nuevoPrecio : (Number(art?.precio) || 0);
    // Si hay otra lista elegida, aplicar su ajuste
    if (listaSinPromo && calcPrecioPorLista) {
      const r = calcPrecioPorLista(
        precioBase,
        Number(articleRefId),
        art.subrubro ?? art.categoria ?? null,   // rubroKey
        null,                                     // agrupacionId (no aplica acá)
        listaSinPromo
      );
      return Number(r?.precio) || precioBase;
    }
    return precioBase;
  }, [allArticulos, listaSinPromo, calcPrecioPorLista, priceListsByList]);

  /* ── Cargar receta ── */
  useEffect(() => {
    if (!open || !businessId) return;
    // ── Modo promo nueva: no hay receta que cargar; reset + precarga del componente ──
    if (modoPromoNueva) {
      setNombre('');
      setRendimiento(1);
      setError('');
      setSuccess(false);
      setLoading(false);
      const comp = articulo?.componentePrecargado;
      if (comp) {
        const costoArt = Number(comp.costo) || Number(comp.costoTotal) || Number(comp.precio) || 0;
        setItems([{
          esArticulo: true,
          articleRefId: Number(comp.id ?? comp.articulo_id),
          supplyId: null,
          supplyNombre: comp.nombre,
          supplyMedida: 'u',
          precioRefDB: costoArt,
          codigoMaxi: comp.codigo || comp.codigo_maxi || '',
          unidad: 'u',
          cantidad: 1,
          tipoCosto: 'total',
          ultimaCompra: null,
        }]);
      } else {
        setItems([]);
      }
      return;
    }
    if (!articulo?.id) return;
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
          setRendimiento(Number(rec.porciones) || Number(rec.rendimiento) || 1);
          setRendimientoUnidad(rec.rendimiento_unidad || 'porcion');
          setRendimientoPeso(rec.rendimiento_peso != null ? Number(rec.rendimiento_peso) : null);
          setUnidadPeso(rec.unidad_peso || null);
          setPctCostoIdeal(resolveObjetivo(rec.porcentaje_venta));
          setNotas(rec.notas || '');
          setNotasUpdatedAt(rec.notas_updated_at || rec.notasUpdatedAt || null);
          setFoto(rec.foto || null);
          setFotos(Array.isArray(rec.fotos) && rec.fotos.length
            ? rec.fotos
            : (rec.foto ? [rec.foto] : [])); // compat: si no hay array, usa la foto single
          setItems((rec.items || []).map(it => {
            const supplyMedidaRaw = it.supply_medida || it.unidad || 'u';
            const supplyMedida = canonicalUnit(supplyMedidaRaw);
            const unidad = canonicalUnit(it.unidad || supplyMedidaRaw);
            const esArt = it.article_ref_id != null && Number(it.article_ref_id) !== 0;
            return {
              esArticulo: esArt,
              articleRefId: esArt ? Number(it.article_ref_id) : null,
              supplyId: it.supply_id,
              supplyNombre: it.supply_nombre || it.nombre_insumo_maxi,
              supplyMedida,
              precioRefDB: Number(it.precio_ref_db) || Number(it.supply_precio_base) || Number(it.costo_unitario) || 0,
              codigoMaxi: it.codigo_maxi_insumo || it.codigo_maxi || '',
              cantidad: Number(it.cantidad || 0),
              unidad,
              ultimaCompra: it.ultima_compra || null,
              merma: it.merma !== false,
              mermaId: it.merma_id ?? null,
              mermaIds: Array.isArray(it.merma_ids) && it.merma_ids.length
                ? it.merma_ids.map(Number)
                : (it.merma_id != null ? [Number(it.merma_id)] : []),
              pedido: it.pedido !== false,
              secreto: it.secreto === true,
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
                      rendimientoUnidad: r.rendimiento_unidad || 'porcion',
                      rendimientoPeso: r.rendimiento_peso != null ? Number(r.rendimiento_peso) : null,
                      unidadPeso: r.unidad_peso || null,
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

          // Cargar equivalencias de todos los ingredientes (para el dropdown de unidad al reabrir)
          // Cargar equivalencias y mermas de todos los ingredientes al reabrir la receta
          const supplyIdsConEq = (rec.items || [])
            .map(it => it.supply_id)
            .filter(Boolean);
          if (supplyIdsConEq.length > 0) {
            Promise.all(
              supplyIdsConEq.map(id =>
                Promise.all([
                  insumoEquivalenciasList(id, businessId).then(r => Array.isArray(r?.data) ? r.data : []).catch(() => []),
                  insumoMermasList(id, businessId).then(r => Array.isArray(r?.data) ? r.data : []).catch(() => []),
                ]).then(([eqs, mermas]) => [String(id), eqs, mermas])
              )
            ).then(results => {
              const eqMap = {}, mermaMap = {};
              results.forEach(([id, eqs, mermas]) => {
                if (eqs.length) eqMap[id] = eqs;
                if (mermas.length) mermaMap[id] = mermas;
              });
              if (Object.keys(eqMap).length > 0 || Object.keys(mermaMap).length > 0) {
                setItems(prev => prev.map(it => {
                  if (!it.supplyId) return it;
                  const patch = {};
                  if (eqMap[String(it.supplyId)]) patch.equivalencias = eqMap[String(it.supplyId)];
                  if (mermaMap[String(it.supplyId)]) patch.mermas = mermaMap[String(it.supplyId)];
                  return Object.keys(patch).length ? { ...it, ...patch } : it;
                }));
              }
            });
          }
        } else {
          setNombre(artNombre);
          setRendimiento(1);
          setRendimientoUnidad('porcion');
          setRendimientoPeso(null);
          setUnidadPeso(null);
          setPctCostoIdeal(resolveObjetivo(null));
          setNotas('');
          setNotasUpdatedAt(null);
          setFoto(null);
          setFotos([]);
          setItems([]);
        }
      })
      .catch(() => setError('No se pudo cargar la receta'))
      .finally(() => setLoading(false));
  }, [open, businessId, articulo?.id, modoPromoNueva, reloadTick]);

  // Refresh en cascada: si un elaborado hijo cambió su costo y este modal lo usa
  // como ingrediente, recargar los items (la propagación ya persistió en DB).
  useEffect(() => {
    const onCostoChanged = (e) => {
      const changedId = e?.detail?.insumoId;
      if (changedId == null) return;
      setItems(prev => {
        const loUsa = prev.some(it => String(it.supplyId) === String(changedId));
        if (loUsa) setReloadTick(t => t + 1);
        return prev;   // no muta items acá, solo dispara el reload
      });
    };
    window.addEventListener('receta-elaborado:costo-changed', onCostoChanged);
    return () => window.removeEventListener('receta-elaborado:costo-changed', onCostoChanged);
  }, []);

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

  //* ── Costo de un ítem: equivalencia > elaborado > artículo > insumo simple ── */
  const calcCostoItem = useCallback((it) => {
    if (it.tipoCosto === 'nulo') return 0;
    const cant = Number(it.cantidad) || 0;
    const elaborado = it.supplyId ? localRecetasElaborados[String(it.supplyId)] : null;
    const insData = it.supplyId ? insumos.find(i => String(i.id) === String(it.supplyId)) : null;
    const forzarCompra = insData?.costo_efectivo_origen === 'compra';

    // Factor de merma: idéntico al de la fila (ítems-artículo no llevan merma)
    let factorMerma = 1;
    if (!it.esArticulo && !it.articleRefId) {
      const pctGlobal = it.desperdicioPct != null ? Number(it.desperdicioPct) : Number(appConfig.desperdicioGlobalPct || 0);
      // Las mermas específicas se apilan multiplicativamente (pelado × cocción × …)
      const ids = Array.isArray(it.mermaIds)
        ? it.mermaIds
        : (it.mermaId != null ? [it.mermaId] : []);
      const fEspecifica = ids.reduce((acc, id) => {
        const m = (it.mermas || []).find(x => Number(x.id) === Number(id));
        if (!m || !(Number(m.peso_final) > 0)) return acc;
        return acc * (Number(m.peso_inicial) / Number(m.peso_final));
      }, 1);
      factorMerma = (1 + pctGlobal / 100) * fEspecifica;
    }

    let precioU;
    const eqSel = (it.equivalencias || []).find(e => e.nombre === it.unidad);
    if (eqSel) {
      const contenido = Number(eqSel.contenido) || 0;
      if (elaborado && !forzarCompra) {
        // El elaborado es un insumo: su merma propia (producto terminado) también aplica.
        // Su costoTotal ya trae la merma de sus componentes internos, no se duplica.
        precioU = contenido * calcCostoUnitarioElaborado(elaborado, it.supplyMedida, eqSel.unidad, it.tipoCosto) * factorMerma;
      } else {
        const precioParaCosto = forzarCompra
          ? (Number(insData?.precio_ultima_compra) || Number(it.precioRefDB) || 0)
          : (Number(it.precioRefDB) || 0);
        const precioBase = precioParaCosto * factorMerma;
        const contEnvase = Number(insData?.contenido_envase) || 0;
        const uniEnvase = canonicalUnit(insData?.unidad_envase || '');
        const baseInsumo = canonicalUnit(it.supplyMedida || 'u');
        if (baseInsumo === 'u' && contEnvase > 0 && uniEnvase) {
          const costoPorUnidadEnvase = precioBase / contEnvase;
          const factor = getConversionFactor(canonicalUnit(eqSel.unidad), uniEnvase);
          precioU = contenido * factor * costoPorUnidadEnvase;
        } else {
          const factor = getConversionFactor(canonicalUnit(eqSel.unidad), canonicalUnit(it.supplyMedida || eqSel.unidad));
          precioU = (contenido * factor) * precioBase;
        }
      }
    } else if (elaborado && !forzarCompra) {
      // DB-puro: precio_ref del elaborado YA es el costo por unidad de RENDIMIENTO
      // (materializado en backend). Unidad base = rendimiento_unidad, NO supplyMedida.
      // Misma lógica que costoEnUnidadElegida → fila y total leen el mismo dato fijo.
      const costoBaseElab = (it.tipoCosto === 'sugerido' && Number(elaborado?.precioSugerido) > 0)
        ? Number(elaborado.precioSugerido)
        : (Number(it.precioRefDB) || 0);
      const uBaseElab = canonicalUnit(elaborado?.rendimientoUnidad || it.supplyMedida || 'u');
      const uElegElab = canonicalUnit(it.unidad || uBaseElab);
      precioU = calcPrecioEnUnidad(costoBaseElab, uBaseElab, uElegElab) * factorMerma;
    } else if (it.esArticulo || it.articleRefId) {
      const art = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === Number(it.articleRefId));
      const costoComp = Number(art?.costoTotal) || Number(art?.precio) || Number(it.precioRefDB) || 0;
      const unidadDBart = canonicalUnit(it.supplyMedida || 'u');
      precioU = calcPrecioEnUnidad(costoComp, unidadDBart, canonicalUnit(it.unidad || unidadDBart));
    } else {
      const precioRef = forzarCompra
        ? (Number(insData?.precio_ultima_compra) || Number(it.precioRefDB) || 0)
        : (Number(it.precioRefDB) || 0);
      const unidadDB = canonicalUnit(it.supplyMedida || 'u');
      const unidadElegida = canonicalUnit(it.unidad || unidadDB);
      // ── Insumo "u" CON envase, unidad elegida medible: costo/unidad = precioRef / contenido_envase ──
      //    (gemelo de la lógica en costoEnUnidadElegida; el envase es la unidad de compra al 100%)
      const contEnvase = Number(insData?.contenido_envase) || 0;
      const uniEnvase = canonicalUnit(insData?.unidad_envase || '');
      if (unidadDB === 'u' && contEnvase > 0 && uniEnvase && unidadElegida !== 'u') {
        const costoPorUnidadEnvase = (precioRef * factorMerma) / contEnvase;
        const factor = getConversionFactor(unidadElegida, uniEnvase);
        precioU = factor * costoPorUnidadEnvase;
      } else {
        precioU = calcPrecioEnUnidad(precioRef * factorMerma, unidadDB, unidadElegida);
      }
    }
    return cant * precioU;
  }, [localRecetasElaborados, allArticulos, insumos, appConfig.desperdicioGlobalPct]);

  // Items ordenados por costo descendente (opcional)
  const itemsOrdenados = useMemo(() => {
    if (!sortByCosto) return items;
    return [...items].sort((a, b) => calcCostoItem(b) - calcCostoItem(a));
  }, [items, sortByCosto, calcCostoItem]);

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
      if (last && !last.supplyId && !last.articleRefId) {
        setNewItemIndex(prev.length - 1);
        setOpenSearchIdx(prev.length - 1);
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
      setOpenSearchIdx(next.length - 1);
      return next;
    });

    // Scroll al final para que el dropdown del search recién abierto sea visible
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTo({
          top: bodyRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    });
  }, []);

  // ── Agregar un item-artículo (para promos) ──
  const addArticleItem = useCallback(() => {
    setItems(prev => {
      const last = prev[prev.length - 1];
      if (last && !last.supplyId && !last.articleRefId) {
        setNewItemIndex(prev.length - 1);
        setOpenSearchIdx(prev.length - 1);
        return prev;
      }
      const next = [...prev, {
        esArticulo: true,
        articleRefId: null, supplyId: null,
        supplyNombre: '', supplyMedida: 'u',
        cantidad: 1,
        unidad: 'u', costoUnitario: '',
        merma: true, pedido: true, tipoCosto: 'total',
        ultimaCompra: null, observaciones: '', updatedAt: null,
      }];
      setNewItemIndex(next.length - 1);
      setOpenSearchIdx(next.length - 1);
      return next;
    });
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
      }
    });
  }, []);

  /* ── Cálculos ── */
  const costoTotal = useMemo(() =>
    items.reduce((acc, it) => acc + calcCostoItem(it), 0),
    [items, calcCostoItem]);

  // Label para el cuadro "Costo / unidad" según el rendimiento del lote
  const labelPorUnidad = useMemo(() => {
    const unidadStr = {
      porcion: 'porción',
      u: 'unidad',
      lt: 'litro',
      ml: 'ml',
      kg: 'kilo',
      gr: 'gr',
    }[rendimientoUnidad] || 'porción';
    // El divisor del costo es SIEMPRE la cantidad de rendimiento
    return `Costo / ${unidadStr} (÷${Number(rendimiento) || 1})`;
  }, [rendimiento, rendimientoUnidad]);

  // Divisor efectivo: si hay peso equivalente (unidad no medible), usar ese; sino el rendimiento
  // El divisor del costo SIEMPRE es la cantidad de rendimiento (no el peso equivalente).
  const divisorRend = Number(rendimiento) || 1;
  const costoXRendimiento = divisorRend > 0 ? costoTotal / divisorRend : 0;
  const precioSugerido = pctCostoIdeal > 0 ? costoXRendimiento / (pctCostoIdeal / 100) : 0;
  const pctCostoActual = precioActual > 0 ? (costoXRendimiento / precioActual) * 100 : null;
  const estaPorDebajo = precioActual > 0 && precioSugerido > 0 && precioActual < precioSugerido;

  // Venta sin promo: suma de los precios de venta de los componentes-artículo
  const ventaSinPromo = useMemo(() => {
    if (!promoMode) return 0;
    return items.reduce((acc, it) => {
      if (!it.articleRefId) return acc;
      const p = getPrecioSinPromo ? getPrecioSinPromo(it.articleRefId) : 0;
      return acc + (Number(p) || 0) * (Number(it.cantidad) || 0);
    }, 0);
  }, [items, promoMode, getPrecioSinPromo]);
  const sugeridoExcedeVenta = promoMode && ventaSinPromo > 0 && precioSugerido > ventaSinPromo;

  /* ── Guardar ── */
  const handleSave = async ({ keepOpen = false, itemsOverride = null } = {}) => {
    setError('');

    // ── Modo promo nueva: crear artículo-promo vía endpoint dedicado ──
    if (modoPromoNueva || convertirEnPromo) {
      if (!nombre.trim()) { setError('Poné un nombre para la promoción'); return; }
      const comps = items
        .filter(it => Number(it.articleRefId) && Number(it.articleRefId) !== 0)
        .map(it => ({
          articleId: Number(it.articleRefId),
          cantidad: Number(it.cantidad) || 1,
          unidad: it.unidad || 'u',
        }));
      const insus = items
        .filter(it => it.supplyId && !it.articleRefId)
        .map(it => ({
          insumoId: Number(it.supplyId),
          cantidad: Number(it.cantidad) || 1,
          unidad: it.unidad || 'u',
        }));
      if (comps.length < 1) { setError('Agregá al menos un artículo a la promoción'); return; }
      setSaving(true);
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${BASE}/businesses/${businessId}/promociones`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Business-Id': String(businessId),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nombre: nombre.trim(),
            componentes: comps,
            insumos: insus,
            porcentajeVenta: pctCostoIdeal,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || d?.message || `Error ${res.status}`);
        }
        setSuccess(true);
        try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { }
        onSaved?.({ __promoCreated: true });
        if (!keepOpen) setTimeout(() => onClose?.(), 600);
      } catch (e) {
        setError(e.message || 'No se pudo crear la promoción');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Filtrar filas vacías: vale si tiene insumo (supplyId) o artículo (articleRefId)
    const itemsBase = itemsOverride || items;
    const itemsValidos = itemsBase.filter(it => it.supplyId || it.articleRefId);
    const tieneContenido = itemsValidos.length > 0 || notas || foto || fotos.length > 0 || pctCostoIdeal !== 30; if (!tieneContenido) { setError('Agregá al menos un ingrediente'); return; }
    if (hasDuplicates) { setError('Hay ingredientes duplicados'); return; }

    const itemsOrdenados = [...itemsValidos].sort((a, b) => calcCostoItem(b) - calcCostoItem(a));
    setItems(itemsOrdenados);

    const payload = {
      nombre: nombre || artNombre,
      porciones: Math.max(0.001, Number(rendimiento) || 1),
      porcentajeVenta: pctCostoIdeal,
      rendimientoUnidad,
      rendimientoPeso,
      unidadPeso,
      notas,
      notasUpdatedAt: notasUpdatedAt || null,
      foto,
      fotos,
      items: itemsOrdenados.map(it => {
        let precioRefDbItem = Number(it.precioRefDB) || 0;
        // ── Costo unitario CON merma: derivado de calcCostoItem (única fuente de verdad
        //    del costo en vivo). calcCostoItem devuelve cant × precioU, así que dividimos
        //    por la cantidad para obtener el unitario que se persiste. Antes se recalculaba
        //    aparte sin factorMerma → recetas.costo_total quedaba sin merma. ──
        const cantItem = Number(it.cantidad) || 0;
        const costoItemTotal = calcCostoItem(it);
        let costoUnitario = cantItem > 0 ? costoItemTotal / cantItem : 0;
        if (it.articleRefId) {
          precioRefDbItem = costoUnitario;
        }
        return {
          supplyId: it.supplyId,
          articleRefId: it.articleRefId ?? null,
          cantidad: Number(it.cantidad) || 0,
          unidad: it.unidad || 'u',
          precioRefDb: precioRefDbItem,
          costoUnitario,
          merma: it.merma !== false,
          mermaId: Array.isArray(it.mermaIds) && it.mermaIds.length
            ? Number(it.mermaIds[0])
            : (it.mermaId ?? null),
          mermaIds: Array.isArray(it.mermaIds)
            ? it.mermaIds.map(Number)
            : (it.mermaId != null ? [Number(it.mermaId)] : []),
          pedido: it.pedido !== false,
          secreto: it.secreto === true,
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

      // ── Si cambió el nombre, renombrar también el artículo/insumo ──
      const nombreNuevo = (nombre || '').trim();
      if (nombreNuevo && nombreNuevo !== (artNombre || '').trim() && articulo?.id) {
        try {
          if (modoInsumo || esElaborado) {
            // Insumo (elaborado o no)
            await insumoUpdate(articulo.id, { nombre: nombreNuevo }, insumosBizId || businessId);
          } else {
            // Artículo (incluye promos)
            await fetch(`${BASE}/businesses/${businessId}/articles/${articulo.id}`, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Business-Id': String(businessId),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ nombre: nombreNuevo }),
            });
          }
          try {
            window.dispatchEvent(new CustomEvent('articulos:updated'));
            window.dispatchEvent(new CustomEvent('insumos:updated'));
          } catch { }
        } catch (e) {
          console.warn('[rename] no se pudo actualizar el nombre:', e.message);
        }
      }

      // ── Promo: SOLO el dueño va a "Promociones", y solo si no está ya ahí.
      //    Los componentes (article_ref_id) se referencian en la receta y NUNCA se mueven
      //    de su agrupación de origen — igual que un insumo dentro de una receta. ──
      const hayComponentesArticulo = payload.items
        .some(it => it.articleRefId != null && Number(it.articleRefId) !== 0);
      const dueñoYaEnPromo = promoIds.has(Number(articulo.id));
      if (hayComponentesArticulo && !dueñoYaEnPromo) {
        try {
          // Solo el dueño. Ningún componente entra en ids.
          await createOrMoveAgrupacion(businessId, { nombre: 'Promociones', ids: [Number(articulo.id)] });
          window.dispatchEvent(new CustomEvent('articulos:updated'));
        } catch (e) {
          console.warn('[promo] no se pudo mover el dueño a Promociones:', e.message);
        }
      }

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

      // En autoguardado (keepOpen) no propagamos onSaved: el padre refetchea/cierra
      // y desmonta el modal en medio de la edición. Solo propagamos al guardar de verdad.
      if (!keepOpen) {
        onSaved?.({
          ...saved,
          article_id: articulo.id,
          costo_total: costoTotal,
          costo_por_porcion: costoXRendimiento,
          precio_sugerido: json?.precio_sugerido ?? precioSugerido,
          porciones: Math.max(1, Number(rendimiento) || 1),
        });
        setTimeout(() => onClose(), 1200);
      }
    } catch (err) {
      setError(err.message || 'Error al guardar');
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

      // Promo: desarmar todo (receta, artículo-promo, agrupación) vía endpoint dedicado
      if (esPromo) {
        const res = await fetch(`${BASE}/businesses/${businessId}/promociones/${articulo.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || d?.message || `Error ${res.status}`);
        }
        try {
          // En autoguardado (keepOpen) no refrescamos la grilla: el refetch externo
          // reconstruye agrupaciones y desmonta el modal en medio de la edición.
          if (!keepOpen) {
            window.dispatchEvent(new CustomEvent('articulos:updated'));
            window.dispatchEvent(new CustomEvent('insumos:updated'));
          }
        } catch { }
        onSaved?.({ article_id: articulo.id, deleted: true });
        onClose();
        return;
      }

      // En modo insumo la receta vive en insumo_id, no en article_id
      const deleteUrl = modoInsumo
        ? `${BASE}/businesses/${businessId}/insumos/${articulo.id}/receta`
        : `${BASE}/businesses/${businessId}/articles/${articulo.id}/receta`;
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Business-Id': String(businessId),
        },
      });
      // Si tira 404, la receta no existe a nivel article_id (lo más común: este
      // artículo es gemelo y la receta real vive en otro miembro del grupo).
      // Seguimos con la auto-desvinculación: el efecto para el usuario es el mismo.
      if (!res.ok && !(res.status === 404 && !modoInsumo)) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || `Error ${res.status}`);
      }
      // Sacar el artículo del grupo de gemelos (autodesvinculación).
      // El resto de gemelos mantiene su receta igual — consistente con "quitar de vinculación" en la tabla.
      if (!modoInsumo && gemelosGroup?.groupId) {
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
    if (skipAutoSaveRef.current) { skipAutoSaveRef.current = false; onClose(); return; }
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

  // ── Autoguardado sin cerrar: reusa handleSave con keepOpen, respetando los guards.
  // Se dispara al cambiar de pestaña (saliendo de "receta") y al abrir una receta hija en cascada.
  const autoSave = useCallback(async () => {
    if (saving || deleting) return;
    if (skipAutoSaveRef.current) return;         // reemplazo de insumo en curso: no pisar la DB
    if (modoPromoNueva || convertirEnPromo) return;  // promo en creación: aún sin datos válidos
    if (modoInsumo && tab !== 'receta') return;  // merma/equivalencias/compras guardan por su cuenta
    const tieneContenido = items.length > 0 || notas || foto;
    if (tieneContenido && !hasDuplicates && !items.some(it => !it.supplyId)) {
      await handleSave({ keepOpen: true });
    }
  }, [saving, deleting, modoInsumo, tab, items, notas, foto, hasDuplicates, handleSave, modoPromoNueva]);

  const abrirDesdeLupa = useCallback(async (item) => {
    setLupaAnchor(null);
    setLupaQuery('');
    setLupaResults([]);
    await autoSave(); // guardar el modal actual antes de abrir en cascada
    pushElaborado({
      id: item.id,
      nombre: item.nombre,
      esArticulo: item.esArticulo,
      precio: 0,
    });
  }, [autoSave, pushElaborado]);

  // ── Desactivar promo (switch Promoción → Producto), ya confirmado por el usuario ──
  const desactivarPromo = useCallback(async () => {
    const artId = Number(articulo?.id);
    try {
      setSaving(true);
      if (artId < 0) {
        // v1: promo manual (ID negativo) → eliminar por completo
        await PromocionesAPI.eliminar(businessId, artId);
        window.dispatchEvent(new CustomEvent('articulos:updated'));
        skipAutoSaveRef.current = true;
        onSaved?.({ __promoDeleted: true, article_id: artId });
        onClose();
        return;
      }
      // v2: artículo (ID positivo) en Promociones → degradar a producto.
      // Guardar la receta SIN items-artículo → backend marca es_promo=FALSE.
      const soloInsumos = items.filter(it => !(it.articleRefId != null && Number(it.articleRefId) !== 0));
      await handleSave({ keepOpen: true, itemsOverride: soloInsumos });
      // Devolver el dueño a su agrupación de origen (o Sin Agrupación si no hay origen guardado)
      // Devolver el dueño a su origen SOLO si llegó a Promociones por el switch (tiene fromGroupName).
      // Si ya vivía en Promociones de antes (sin fromGroupName), se queda ahí.
      const origen = articulo?.fromGroupName && String(articulo.fromGroupName).trim();
      if (origen) {
        try {
          await createOrMoveAgrupacion(businessId, { nombre: origen, ids: [artId] });
        } catch (e) {
          console.warn('[desactivarPromo] no se pudo devolver a origen:', e.message);
        }
      }
      window.dispatchEvent(new CustomEvent('articulos:updated'));
      setPromoMode(false);
      skipAutoSaveRef.current = true;
      onSaved?.({ __promoDowngraded: true, article_id: artId });
      onClose();
    } catch (err) {
      console.error('[desactivarPromo]', err);
      setError(err.message || 'No se pudo deshacer la promoción');
    } finally {
      setSaving(false);
    }
  }, [articulo, businessId, items, handleSave, onSaved, onClose]);

  const articuloIdNum = Number(articulo?.id);
  const hayListasNoFavoritas = useMemo(
    () => !esElaborado && (priceLists || []).some(l => !l.is_favorite),
    [priceLists, esElaborado]
  );

  const exclusionesCount = useMemo(() => {
    if (!articuloIdNum || !priceLists?.length) return 0;
    const baseEntry = priceListsByList?._base?.byArticle?.[String(articuloIdNum)];
    if (baseEntry?.excluido) return priceLists.filter(l => !l.is_favorite).length;
    let n = 0;
    for (const l of priceLists) {
      if (l.is_favorite) continue;
      const entry = priceListsByList?.[l.id]?.byArticle?.[String(articuloIdNum)];
      if (entry?.excluido) n++;
    }
    return n;
  }, [articuloIdNum, priceLists, priceListsByList]);

  // Cuando ocurre un reemplazo de insumo, evitar que el autoguardado al cerrar
  // pise el cambio hecho en la DB (afecta a todos los RecetaModal abiertos en cascada).
  useEffect(() => {
    const handler = () => { skipAutoSaveRef.current = true; };
    window.addEventListener('insumo:reemplazado', handler);
    return () => window.removeEventListener('insumo:reemplazado', handler);
  }, []);

  // Refrescar equivalencias de un item cuando cambian en el modal del insumo (cascada).
  // Cubre crear/editar/borrar; si se borraron todas, el item queda con equivalencias vacías.
  useEffect(() => {
    const handler = (e) => {
      const insId = e?.detail?.insumoId;
      if (!insId || !businessId) return;
      insumoEquivalenciasList(insId, businessId)
        .then(r => {
          const eqs = Array.isArray(r?.data) ? r.data : [];
          setItems(prev => prev.map(it => {
            if (String(it.supplyId) !== String(insId)) return it;
            // Si la unidad actual era una equivalencia que ya no existe, volver a la unidad base
            const unidadSigueValida = eqs.some(x => x.nombre === it.unidad)
              || ['gr', 'kg', 'ml', 'lt', 'u'].includes(canonicalUnit(it.unidad));
            return {
              ...it,
              equivalencias: eqs,
              unidad: unidadSigueValida ? it.unidad : canonicalUnit(it.supplyMedida || 'u'),
            };
          }));
        })
        .catch(() => { });
    };
    window.addEventListener('insumo:equivalencias-changed', handler);
    return () => window.removeEventListener('insumo:equivalencias-changed', handler);
  }, [businessId]);

  // Navegación por teclado: ← anterior, → siguiente.
  // Solo si el foco NO está en un input/textarea/select (para no interferir al escribir).
  useEffect(() => {
    if (!open || !onNavigate || modoInsumo) return;
    const handler = (e) => {
      // No navegar si se está escribiendo en un campo
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable;
      if (editable) return;
      if (e.key === 'ArrowLeft' && canNavigate.prev) {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && canNavigate.next) {
        e.preventDefault();
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onNavigate, modoInsumo, canNavigate]);

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
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              {/* Flecha anterior — a la izquierda del nombre */}
              {onNavigate && !modoInsumo && (
                <IconButton size="small" sx={{ p: 0.25, mt: '-2px', color: 'inherit', opacity: canNavigate.prev ? 1 : 0.3 }}
                  disabled={!canNavigate.prev}
                  onClick={() => onNavigate('prev')}>
                  <KeyboardArrowLeftIcon />
                </IconButton>
              )}

              <Box>
                <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
                  {modoInsumo
                    ? `${artNombre}${(() => {
                      const insData = insumos.find(i => String(i.id) === String(articulo?.id));
                      const u = insData?.unidad_med || insData?.medida || articulo?.unidad_med;
                      return u ? ` × ${canonicalUnit(u).toUpperCase()}` : '';
                    })()}`
                    : `${promoMode ? 'Promoción' : 'Receta'} — ${artNombre}`}
                </Typography>
                {articulo?.id && (
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>#{articulo.id}</Typography>
                )}
              </Box>
              {/* Flecha siguiente — a la derecha del nombre */}
              {onNavigate && !modoInsumo && (
                <IconButton size="small" sx={{ p: 0.25, mt: '-2px', color: 'inherit', opacity: canNavigate.next ? 1 : 0.3 }}
                  disabled={!canNavigate.next}
                  onClick={() => onNavigate('next')}>
                  <KeyboardArrowRightIcon />
                </IconButton>
              )}
            </Stack>
            {modoInsumo && entradaElegida && (
              <Stack direction="row" spacing={0.5} sx={{ alignSelf: 'flex-end' }}>
                {[
                  { id: 'merma', label: 'MERMA' },
                  { id: 'receta', label: 'RECETA' },
                  { id: 'compras', label: 'COMPRAS' },
                  { id: 'equivalencias', label: 'EQUIVALENCIAS' },
                  { id: 'uso', label: 'USO' },
                ].map(t => (
                  <Box
                    key={t.id}
                    onClick={async () => { if (tab === 'receta') await autoSave(); setTab(t.id); }}
                    sx={{
                      px: 1.75, py: 0.9,
                      borderRadius: '8px 8px 0 0',
                      bgcolor: tab === t.id ? 'background.paper' : 'rgba(255,255,255,0.25)',
                      color: tab === t.id ? PRIMARY : ON_PRIMARY,
                      fontWeight: 800, fontSize: '0.72rem', letterSpacing: 0.4,
                      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </Box>
                ))}
              </Stack>
            )}
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {/* Lupa: buscar y abrir en cascada (artículo o insumo según contexto) */}
              <Tooltip title={modoInsumo ? 'Buscar insumo' : 'Buscar artículo'}>
                <IconButton
                  size="small"
                  onClick={(e) => setLupaAnchor(e.currentTarget)}
                  sx={{ color: 'inherit', opacity: 0.85, '&:hover': { opacity: 1 } }}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* Botón exclusión de descuentos */}
              {hayListasNoFavoritas && (
                <Tooltip title="Excluir de listas de precios">
                  <IconButton
                    size="small"
                    onClick={() => setExcluirOpen(true)}
                    sx={{
                      color: 'inherit',
                      opacity: exclusionesCount > 0 ? 1 : 0.7,
                      '&:hover': { opacity: 1 }
                    }}
                  >
                    <LocalOfferIcon fontSize="small" />
                    {exclusionesCount > 0 && (
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
                <IconButton
                  size="small"
                  onClick={() => setNotasModalOpen(true)}
                  sx={{ color: 'inherit' }}>
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
          <Box ref={bodyRef} sx={{ flex: 1, overflowY: 'auto', p: 2.5, minHeight: '60vh' }}>
            {modoInsumo && !entradaElegida ? (
              <SelectorInsumo nombre={artNombre} insumoId={articulo?.id} onElegir={handleElegirEntrada} />
            ) : loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : modoInsumo && tab === 'merma' ? (
              <TabMermaInsumo
                insumoId={articulo?.id}
                businessId={businessId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id)) || articulo}
                desperdicioGlobalPct={appConfig.desperdicioGlobalPct ?? 5}
              />
            ) : modoInsumo && tab === 'compras' ? (
              <TabComprasInsumo
                insumoId={articulo?.id}
                businessId={businessId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id))}
              />
            ) : modoInsumo && tab === 'equivalencias' ? (
              <TabEquivalenciasInsumo
                insumoId={articulo?.id}
                businessId={businessId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id)) || articulo}
                recetaInfo={{
                  esElaborado: true,
                  costoTotal,
                  cantidad: Number(rendimiento) || 1,
                  rendimientoPeso: Number(rendimientoPeso) || 0,
                  unidadPeso: unidadPeso || 'gr',
                  rendimientoUnidad,
                }}
              />
            ) : modoInsumo && tab === 'uso' ? (
              <TabUsoInsumo
                insumoId={articulo?.id}
                businessId={businessId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id)) || articulo}
              />
            ) : (() => {
              // Cartel de advertencia: insumo con compras que aún no tiene receta
              const insDat = insumos.find(i => String(i.id) === String(articulo?.id));
              const tieneCompras = Number(insDat?.cantidad_compras) > 0;
              const tieneReceta = items.length > 0;   // ya hay ingredientes cargados
              const mostrarCartel = modoInsumo && tieneCompras && !tieneReceta && !recetaConfirmada;
              if (mostrarCartel) {
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, px: 3, textAlign: 'center', gap: 2 }}>
                    <WarningAmberIcon sx={{ fontSize: 48, color: 'warning.main' }} />
                    <Typography variant="h6" fontWeight={800}>Este insumo tiene compras registradas</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
                      Si cargás una receta, su costo pasará a calcularse por elaboración cuando la receta sea más reciente que la última compra. Podés cambiar el criterio en cualquier momento desde el aviso de costo.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setRecetaConfirmada(true)}
                      sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, mt: 1, '&:hover': { bgcolor: PRIMARY, filter: 'brightness(0.9)' } }}
                    >
                      Entendido, continuar
                    </Button>
                  </Box>
                );
              }
              return (
                <>
                  {/* ── Datos generales con foto ── */}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '150px 1fr' },
                    gap: 2, mb: 2,
                    alignItems: 'stretch',
                  }}>
                    {/* Columna izquierda: FOTO */}
                    <Box
                      onClick={() => setNotasModalOpen(true)}
                      sx={{
                        display: 'flex', flexDirection: 'column', gap: 0.5,
                        cursor: 'pointer',
                      }}
                    >
                      <Box sx={{
                        position: 'relative', width: '100%', aspectRatio: '1 / 1',
                        borderRadius: 1.5, overflow: 'hidden',
                        border: '1px solid', borderColor: 'divider',
                        bgcolor: foto ? 'transparent' : `${PRIMARY}08`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        '&:hover': { borderColor: PRIMARY },
                        transition: 'border-color 0.15s',
                      }}>
                        {foto ? (
                          <img src={foto} alt="Foto receta" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <Box sx={{ textAlign: 'center', px: 1 }}>
                            <ImageIcon sx={{ fontSize: 32, color: `${PRIMARY}80` }} />
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem', mt: 0.5 }}>
                              Foto del producto
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.disabled', fontSize: '0.62rem' }}>
                        {foto ? 'Tocá la foto para editar' : 'Tocá para agregar foto'}
                      </Typography>
                    </Box>

                    {/* Columna derecha: nombre + rendimiento + objetivo */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {modoInsumo && (() => {
                        const insDat = insumos.find(i => String(i.id) === String(articulo?.id));
                        const tieneCompras = Number(insDat?.cantidad_compras) > 0;
                        if (!tieneCompras) return null;  // sin compras no hay decisión de costo
                        return (
                          <CostoPreferidoSelector
                            insumoId={articulo?.id}
                            businessId={businessId}
                            costoPreferido={insDat?.costo_preferido ?? null}
                            origenEfectivo={insDat?.costo_efectivo_origen}
                            variant="aviso"
                          />
                        );
                      })()}
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <TextField
                          label={promoMode ? "Nombre" : "Nombre"}
                          value={nombre}
                          onChange={e => setNombre(e.target.value)}
                          placeholder={artNombre}
                          sx={{ flex: 1 }}
                        />
                        {!modoInsumo && (
                          <ToggleButtonGroup
                            value={promoMode ? 'promo' : 'producto'}
                            exclusive
                            size="small"
                            onChange={(e, val) => {
                              if (val == null) return;               // no permitir deseleccionar
                              const quierePromo = val === 'promo';
                              if (quierePromo === promoMode) return;  // sin cambio
                              if (quierePromo) {
                                setPromoMode(true);                   // activar: sin confirmación
                                const artId = Number(articulo?.id);
                                const viveEnPromo = promoIds.has(artId);
                                // Artículo común → se convierte en promo v1: auto-agregarlo como primer componente.
                                if (!viveEnPromo && artId !== 0 && !Number.isNaN(artId)) {
                                  setConvertirEnPromo(true);
                                  const yaEsta = items.some(it => Number(it.articleRefId) === artId);
                                  if (!yaEsta) {
                                    // Costo real del artículo: buscar en allArticulos (trae costoTotal de receta).
                                    // Jerarquía: costo total de receta > precio (mismo criterio que el backend).
                                    const artFull = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === artId) || {};
                                    const costoArt = Number(artFull.costoTotal) || Number(articulo?.costoTotal) || Number(artFull.precio) || Number(articulo?.precio) || 0;
                                    // La receta propia del artículo queda representada por su costo como componente;
                                    // sus insumos NO se arrastran sueltos a la promo. Se reemplaza la lista por el artículo.
                                    setItems([{
                                      esArticulo: true,
                                      articleRefId: artId,
                                      supplyId: null,
                                      supplyNombre: artNombre,
                                      supplyMedida: 'u',
                                      precioRefDB: costoArt,
                                      codigoMaxi: articulo?.codigo || articulo?.codigo_maxi || '',
                                      unidad: 'u',
                                      cantidad: 1,
                                      tipoCosto: 'total',
                                      ultimaCompra: null,
                                    }]);
                                  }
                                  // Nombre por defecto: el del artículo principal
                                  if (!nombre.trim()) setNombre(artNombre);
                                }
                              } else {
                                setConfirmarDesactivar(true);         // desactivar: pedir confirmación
                              }
                            }}
                            disabled={saving || deleting}
                            sx={{ flexShrink: 0 }}
                          >
                            <ToggleButton
                              value="producto"
                              disabled={promoMode && !puedeVolverAProducto}
                              sx={{ px: 1.5, fontSize: '0.7rem', fontWeight: 700 }}
                            >
                              Producto
                            </ToggleButton>
                            <ToggleButton value="promo" sx={{ px: 1.5, fontSize: '0.7rem', fontWeight: 700 }}>
                              Promoción
                            </ToggleButton>
                          </ToggleButtonGroup>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch', flexWrap: 'wrap' }}>
                        {/* ── Bloque rendimiento del lote ── */}
                        <Box sx={{
                          flex: 1, minWidth: 360,
                          display: 'flex', flexDirection: 'column', gap: 0.5,
                        }}>
                          <Typography variant="caption" sx={{
                            color: 'text.secondary', fontWeight: 400, fontSize: '0.75rem',
                            ml: 0.25,
                          }}>
                            Rendimiento del lote
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <TextField
                              label="Cantidad"
                              type="text"
                              inputMode="decimal"
                              value={rendimiento === '' ? '' : String(rendimiento).replace('.', ',')}
                              onChange={e => {
                                const raw = e.target.value;
                                setRendimiento(raw === '' ? '' : sanitizeDecimal(raw));
                              }}
                              size="small"
                              inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', padding: '6px 8px' } }}
                              sx={{ width: 72, flexShrink: 0 }}
                            />
                            <FormControl size="small" sx={{ width: 110, flexShrink: 0 }}>
                              <Select
                                value={rendimientoUnidad}
                                onChange={e => {
                                  const nueva = e.target.value;
                                  setRendimientoUnidad(nueva);
                                  if (!['porcion', 'u'].includes(nueva)) {
                                    setRendimientoPeso(null);
                                    setUnidadPeso(null);
                                  } else if (!unidadPeso) {
                                    setUnidadPeso('gr');
                                  }
                                }}
                                sx={{ fontSize: '0.85rem', '& .MuiSelect-select': { py: '6px' } }}
                              >
                                <MenuItem value="porcion">Porción</MenuItem>
                                <MenuItem value="u">Unidad</MenuItem>
                                <MenuItem value="lt">Litro</MenuItem>
                                <MenuItem value="ml">ml</MenuItem>
                                <MenuItem value="kg">Kilo</MenuItem>
                                <MenuItem value="gr">gr</MenuItem>
                              </Select>
                            </FormControl>
                            {['porcion', 'u'].includes(rendimientoUnidad) && (
                              <Box sx={{ display: 'flex', gap: 0.5, flex: 1, minWidth: 130 }}>
                                <TextField
                                  label="Equivalente"
                                  type="text"
                                  inputMode="decimal"
                                  value={rendimientoPeso == null ? '' : String(rendimientoPeso).replace('.', ',')}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    setRendimientoPeso(raw === '' ? null : sanitizeDecimal(raw));
                                    // Si hay peso y aún no se eligió unidad, fijar el default visual (gr) como valor real.
                                    // El usuario puede cambiarlo a kg/ml/lt en el Select de al lado.
                                    if (raw !== '' && !unidadPeso) setUnidadPeso('gr');
                                  }}
                                  placeholder="—"
                                  size="small"
                                  inputProps={{ min: 0, step: 0.1, style: { textAlign: 'right', padding: '6px 8px' } }}
                                  sx={{ flex: 1, minWidth: 0 }}
                                />
                                <FormControl size="small" sx={{ width: 64, flexShrink: 0 }}>
                                  <Select
                                    value={unidadPeso || ''}
                                    onChange={e => setUnidadPeso(e.target.value)}
                                    displayEmpty
                                    renderValue={(v) => v || 'u.'}
                                    sx={{ fontSize: '0.8rem', color: unidadPeso ? 'inherit' : 'text.disabled', '& .MuiSelect-select': { py: '6px' } }}
                                  >
                                    <MenuItem value="gr">gr</MenuItem>
                                    <MenuItem value="kg">kg</MenuItem>
                                    <MenuItem value="ml">ml</MenuItem>
                                    <MenuItem value="lt">lt</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                            )}
                          </Box>
                        </Box>
                        {/* Costo objetivo */}
                        <TextField
                          label="Costo Objetivo"
                          type="text"
                          inputMode="decimal"
                          value={pctCostoIdeal}
                          onChange={e => setPctCostoIdeal(parseDecimal(e.target.value))}
                          onBlur={(e) => {
                            const val = Number(e.target.value) || 0;
                            if (!val || !articulo?.id) return;
                            // Sincronizar el ref del externo: el cambio en la receta
                            // pasa a ser la verdad, así resolveObjetivo no lo pisa con el viejo.
                            costoObjetivoExternoRef.current = val;
                            onPriceConfigSave?.({
                              scope: 'articulo',
                              scopeId: String(articulo.id),
                              objetivo: val,
                            });
                            try { window.dispatchEvent(new CustomEvent('objetivo:changed', { detail: { articleId: articulo.id, objetivo: val } })); } catch { }
                          }}
                          size="small"
                          inputProps={{ min: 0, max: 150 }}
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                          sx={{ width: 96, flexShrink: 0, alignSelf: 'flex-start', mt: '18px' }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* ── Panel de gemelos — entre datos generales e ingredientes ── */}
                  {!esElaborado && !promoMode && (
                    <Box sx={{ mb: 1.5 }}>
                      {/* Header colapsable */}
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
                                          // Mantener el término escrito y refrescar resultados
                                          // (el recién agregado pasa a verse como "✓" gracias a yaGemelo)
                                          if (gemelosSearch.trim()) {
                                            buscarGemelos(gemelosSearch);
                                          }
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
                                    onClick={async () => {
                                      await autoSave(); // guardar la receta padre antes de bajar en cascada
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
                                        type="text"
                                        inputMode="decimal"
                                        defaultValue={objVal != null ? String(objVal).replace('.', ',') : ''}
                                        placeholder="—"
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={(e) => {
                                          const raw = e.target.value;
                                          const nuevo = raw === '' ? null : parseDecimal(raw);
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
                    gridTemplateColumns: gridIngredientes,
                    gap: '4px', px: 0.5, mb: 0.5,
                  }}>
                    {(promoMode
                      ? ['', 'Ingrediente', 'Cantidad', 'Unidad', '$ Costo Total', '__SIN_PROMO__', '', 'Observaciones', '', '']
                      : ['', 'Ingrediente', 'Cantidad', 'Unidad', '$ Costo Total', '', 'Observaciones', '', '']
                    ).map((col, i) => {
                      if (col === '__SIN_PROMO__') {
                        const listaActiva = listaSinPromo
                          ? (priceLists || []).find(l => String(l.id) === String(listaSinPromo))
                          : (priceLists || []).find(l => l.is_favorite);
                        return (
                          <Select
                            key={i}
                            size="small"
                            value={listaSinPromo ?? '_base'}
                            onChange={e => setListaSinPromo(e.target.value === '_base' ? null : e.target.value)}
                            variant="standard"
                            disableUnderline
                            renderValue={() => (
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                <Box component="span" sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }}>
                                  $ Sin Promo
                                </Box>
                                <Box component="span" sx={{ fontSize: '0.62rem', fontWeight: 700, color: colorSinPromo }}>
                                  {listaActiva?.name || listaActiva?.nombre || 'Principal'}
                                </Box>
                              </Box>
                            )}
                            MenuProps={{
                              anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
                              transformOrigin: { vertical: 'top', horizontal: 'center' },
                            }}
                            sx={{
                              '& .MuiSelect-select': { py: 0, textAlign: 'center' },
                              '& .MuiSvgIcon-root': { fontSize: 14, color: colorSinPromo },
                            }}
                          >
                            <MenuItem value="_base" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                              {(priceLists || []).find(l => l.is_favorite)?.name || 'Principal'}
                            </MenuItem>
                            {(priceLists || []).filter(l => !l.is_favorite).map((l) => {
                              const idxReal = (priceLists || []).findIndex(x => String(x.id) === String(l.id));
                              const c = colorForList(l, idxReal);
                              return (
                                <MenuItem key={l.id} value={l.id} sx={{ fontSize: '0.75rem', fontWeight: 700, color: c }}>
                                  {l.name}
                                </MenuItem>
                              );
                            })}
                          </Select>
                        );
                      }
                      return (
                        <Typography key={i} variant="caption" color="text.secondary"
                          fontWeight={700} sx={{ fontSize: '0.68rem', textAlign: 'center' }}>
                          {col}
                        </Typography>
                      );
                    })}
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
                            index={realIndex}
                            gridTemplate={gridIngredientes}
                            esPromo={promoMode || modoPromoNueva}
                            getPrecioSinPromo={getPrecioSinPromo}
                            colorSinPromo={colorSinPromo}
                            objetivoReceta={pctCostoIdeal}
                            onChange={(idx, partial) => {
                              changeItem(idx, partial);
                              if (newItemIndex === idx) setNewItemIndex(null);
                            }}
                            onRemove={removeItem}
                            onOpenRecetaElaborado={async (it) => {
                              await autoSave(); // guardar la receta padre antes de bajar en cascada
                              // Item-artículo (promo): abrir receta del artículo componente
                              if (it.esArticulo || it.articleRefId) {
                                const artId = Number(it.articleRefId);
                                const art = (allArticulos || []).find(a => Number(a.id ?? a.articulo_id) === artId);
                                pushElaborado({
                                  id: artId,
                                  nombre: it.supplyNombre || art?.nombre || `#${artId}`,
                                  precio: Number(art?.precio) || 0,
                                  esArticulo: true,
                                });
                                return;
                              }
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
                            allArticulos={allArticulos}
                            articuloId={articulo?.id}
                            businessId={businessId}
                            searchOpen={openSearchIdx === realIndex}
                            onSearchOpen={() => setOpenSearchIdx(realIndex)}
                            onSearchClose={() => setOpenSearchIdx(null)}
                            soloConCompras={soloConCompras}
                            onToggleSoloConCompras={toggleSoloConCompras}
                            appConfigDesperdicio={appConfig.desperdicioGlobalPct ?? 5}
                          />
                        );
                      })}
                    </Box>
                  )}

                  <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                    <Button
                      startIcon={insumosLoading ? <CircularProgress size={14} /> : <AddIcon />}
                      onClick={addItem}
                      size="small"
                      disabled={insumosLoading}
                      variant="outlined"
                      sx={{ borderColor: PRIMARY, color: PRIMARY }}
                    >
                      Agregar ingrediente
                    </Button>

                  </Stack>

                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: (() => {
                      const ocultarExtras = modoInsumo && !verCostosExtra;
                      const colPeso = Number(rendimientoPeso) > 0 ? 1 : 0;
                      const cols = (Number(rendimiento) > 1 ? 2 : 1) + colPeso + (ocultarExtras ? 0 : 2);
                      return `repeat(${cols}, 1fr)`;
                    })(),
                    gap: 1.5,
                    bgcolor: 'action.hover',
                    borderRadius: 1.5, p: 2,
                    mb: 2,
                    position: 'relative',
                  }}>
                    {modoInsumo && (
                      <IconButton
                        size="small"
                        onClick={() => setVerCostosExtra(v => !v)}
                        sx={{ position: 'absolute', top: 4, right: 4, p: 0.25 }}
                        title={verCostosExtra ? 'Ocultar sugerido y % costo' : 'Ver sugerido y % costo'}
                      >
                        <VisibilityIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                      </IconButton>
                    )}
                    {Number(rendimiento) > 1 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Costo total</Typography>
                        <Typography variant="h6" fontWeight={800}>${fmt(costoTotal)}</Typography>
                      </Box>
                    )}

                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {Number(rendimiento) > 1 || rendimientoUnidad !== 'porcion'
                          ? labelPorUnidad
                          : 'Costo total'}
                      </Typography>
                      <Typography variant="h6" fontWeight={800}>${fmt(costoXRendimiento)}</Typography>
                    </Box>
                    {Number(rendimientoPeso) > 0 && (() => {
                      // Mostrar el costo por unidad GRANDE: gr→kg, ml→L (× 1000).
                      const uBase = canonicalUnit(unidadPeso || 'gr');
                      const esPeso = uBase === 'gr' || uBase === 'kg';
                      const uGrande = esPeso ? 'kg' : 'lt';
                      // costo por unidad base (gr/ml) × 1000 = costo por unidad grande (kg/L)
                      const costoUnitBase = costoXRendimiento / Number(rendimientoPeso);
                      const costoGrande = costoUnitBase * 1000;
                      return (
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Costo / {uGrande} (÷{fmt(Number(rendimientoPeso))} {uBase})
                          </Typography>
                          <Typography variant="h6" fontWeight={800}>
                            ${fmt(costoGrande)}
                          </Typography>
                        </Box>
                      );
                    })()}
                    {(!modoInsumo || verCostosExtra) && <Box>
                      {/* KPI Venta sin promo — solo en promos, como leyenda arriba del sugerido */}
                      {promoMode && ventaSinPromo > 0 && (
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: colorSinPromo, fontSize: '0.75rem' }}>
                          Venta sin promo: ${fmt(ventaSinPromo)}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Precio sugerido ({pctCostoIdeal}% costo)</Typography>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        sx={{ color: sugeridoExcedeVenta ? '#ef4444' : 'success.main' }}
                      >
                        {precioSugerido > 0 ? `$${fmt(precioSugerido)}` : '—'}
                      </Typography>
                      {sugeridoExcedeVenta && (
                        <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                          <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444' }}>
                            Supera la venta sin promo
                          </Typography>
                        </Stack>
                      )}
                      {precioActual > 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: estaPorDebajo ? '#ef4444' : 'text.secondary' }}>Actual: ${fmt(precioActual)}</Typography>
                          {estaPorDebajo && <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />}
                        </Stack>
                      )}
                      {/* Barra de ajuste del Costo Objetivo — debajo del sugerido, visible siempre */}
                      <Slider
                        value={Number(pctCostoIdeal) || 0}
                        min={0}
                        max={100}
                        step={1}
                        size="small"
                        onChange={(_, val) => setPctCostoIdeal(val)}
                        onChangeCommitted={(_, val) => {
                          // Mismo comportamiento que el campo "Costo Objetivo" de arriba.
                          const num = Number(val) || 0;
                          if (!num || !articulo?.id) return;
                          costoObjetivoExternoRef.current = num;
                          onPriceConfigSave?.({
                            scope: 'articulo',
                            scopeId: String(articulo.id),
                            objetivo: num,
                          });
                          try { window.dispatchEvent(new CustomEvent('objetivo:changed', { detail: { articleId: articulo.id, objetivo: num } })); } catch { }
                        }}
                        sx={{ mt: 0.5, py: 0.5 }}
                      />
                    </Box>}
                    {!modoInsumo && <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>% Costo actual</Typography>
                      {pctCostoActual !== null ? (
                        <>
                          <Typography variant="h6" fontWeight={800} color={pctCostoActual > pctCostoIdeal ? '#ef4444' : 'success.main'}>{fmt(pctCostoActual, 1)}%</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>Ideal: {pctCostoIdeal}%</Typography>
                        </>
                      ) : (
                        <Typography variant="h6" color="text.disabled">—</Typography>
                      )}
                    </Box>}
                  </Box>

                  {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
                  {success && <Alert severity="success" sx={{ mb: 1.5 }}>¡Receta guardada!</Alert>}
                </>
              );
            })()}
          </Box>

          {/* ── FOOTER ── */}
          <Box sx={{
            px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0, bgcolor: 'background.paper',
          }}>
            <Stack direction="row" spacing={1} alignItems="center">
            </Stack>
            {!(modoInsumo && tab !== 'receta') && <Stack direction="row" spacing={1} alignItems="center">
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
                  {promoMode ? 'Borrar' : 'Borrar'}
                </Button>
              )}
              <Button onClick={handleCancel} disabled={saving || deleting} color="inherit" size="small">
                Cancelar
              </Button>
              <Button
                onClick={() => handleSave()}
                variant="contained"
                size="small"
                disabled={saving || deleting || loading || hasDuplicates}
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, '&:hover': { filter: 'brightness(0.9)', bgcolor: PRIMARY } }}
              >
                {saving ? 'Guardando…' : (modoPromoNueva ? 'Guardar' : 'Guardar')}
              </Button>
            </Stack>}
          </Box>
        </Box >
      </Modal >

      {/* ── Modal notas + foto ── */}
      {
        notasModalOpen && (
          <NotasModal
            notas={notas}
            foto={foto}
            fotos={fotos}
            notasUpdatedAt={notasUpdatedAt}
            articuloId={articulo?.id}
            businessId={businessId}
            esElaborado={esElaborado}  // ← agregar
            onSave={(n, fArr, ts) => {
              setNotas(n);
              setFotos(fArr);                        // array de fotos
              setFoto(fArr[0] || null);              // compat: `foto` = primera del array
              if (ts) setNotasUpdatedAt(ts);
            }}
            onClose={() => setNotasModalOpen(false)}
          />
        )
      }

      {previewFotoOpen && foto && (
        <VistaPreviaFotoModal
          foto={foto}
          onEditar={() => { setEditarFotoSrc(foto); setPreviewFotoOpen(false); }}
          onQuitar={() => { setFoto(null); setPreviewFotoOpen(false); }}
          onClose={() => setPreviewFotoOpen(false)}
        />
      )}
      {editarFotoSrc && (
        <EditorFotoModal
          imagenSrc={editarFotoSrc}
          onConfirmar={(recortada) => { setFoto(recortada); setEditarFotoSrc(null); }}
          onCancelar={() => setEditarFotoSrc(null)}
        />
      )}

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

      {reemplazarModalOpen && (
        <ModalReemplazarInsumo
          insumoId={articulo?.id}
          insumoNombre={artNombre}
          businessId={businessId}
          insumos={insumos}
          onClose={() => setReemplazarModalOpen(false)}
          businessId={businessId}
          insumos={insumos}
          alertaSemanas={alertaSemanas}
          onReemplazado={(r) => {
            setReemplazarModalOpen(false);
            // Avisar a TODOS los RecetaModal abiertos (cascada) que no autoguarden
            try { window.dispatchEvent(new CustomEvent('insumo:reemplazado')); } catch { }
            skipAutoSaveRef.current = true;
            setElaboradosStack([]);
            try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { }
            try { window.dispatchEvent(new CustomEvent('recetas:bulk-deleted')); } catch { }
            try { window.dispatchEvent(new CustomEvent('insumos:updated')); } catch { }
            onClose();
          }}
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

      {/* ── Confirmación al desactivar promo (switch Promoción → Producto) ── */}
      <Dialog open={confirmarDesactivar} onClose={() => setConfirmarDesactivar(false)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          ¿Deshacer la promoción?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {Number(articulo?.id) < 0
              ? <>Esto eliminará por completo la promoción <strong>{artNombre}</strong>: se borra la promo y sus componentes dejan de estar vinculados. Esta acción no se puede deshacer.</>
              : <>Esto quitará todos los artículos agregados a <strong>{artNombre}</strong> y la devolverá a producto normal. Sus insumos propios se conservan. ¿Continuar?</>}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarDesactivar(false)} color="inherit" size="small">
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              setConfirmarDesactivar(false);
              await desactivarPromo();
            }}
            color="error"
            variant="contained"
            size="small"
          >
            Sí, deshacer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reemplazarAviso} onClose={() => setReemplazarAviso(false)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Reemplazar insumo</DialogTitle>
        <DialogContent>
          <DialogContentText>Esta función está en construcción. Pronto vas a poder reemplazar el insumo en todas las recetas.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReemplazarAviso(false)}>Entendido</Button>
        </DialogActions>
      </Dialog>

      {/* Popover de búsqueda de la lupa */}
      <Popover
        open={Boolean(lupaAnchor)}
        anchorEl={lupaAnchor}
        onClose={() => { setLupaAnchor(null); setLupaQuery(''); setLupaResults([]); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 340, maxHeight: 420, p: 1.5 } }}
      >
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder={modoInsumo ? 'Buscar insumo…' : 'Buscar artículo…'}
          value={lupaQuery}
          onChange={(e) => { setLupaQuery(e.target.value); buscarLupa(e.target.value); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Box sx={{ mt: 1, maxHeight: 330, overflowY: 'auto' }}>
          {lupaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
          ) : lupaResults.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
              {lupaQuery.trim() ? 'Sin resultados' : 'Escribí para buscar'}
            </Typography>
          ) : (
            lupaResults.map(item => (
              item.esArticulo ? (
                // Artículo: render simple (no tiene los campos de insumo)
                <Box
                  key={`a-${item.id}`}
                  onClick={() => abrirDesdeLupa(item)}
                  sx={{
                    px: 1.5, py: 0.75, borderRadius: 1, cursor: 'pointer',
                    borderBottom: '1px solid', borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>{item.nombre}</Typography>
                  <Chip label="Artículo" size="small"
                    sx={{ height: 16, fontSize: 9, bgcolor: '#7c3aed15', color: '#7c3aed' }} />
                </Box>
              ) : (
                // Insumo: misma fila que el buscador de ingredientes (costo, colores, badges)
                <FilaResultadoInsumo
                  key={`i-${item.id}`}
                  ins={item}
                  alertaSemanas={alertaSemanas}
                  onClick={() => abrirDesdeLupa(item)}
                />
              )
            ))
          )}
        </Box>
      </Popover>

      <ExcluirListasModal
        open={excluirOpen}
        onClose={() => setExcluirOpen(false)}
        bizId={businessId}
        lists={priceLists}
        byList={priceListsByList}
        scope="articulo"
        scopeIds={articuloIdNum ? [articuloIdNum] : []}
        scopeLabel={artNombre}
        notify={(msg) => { /* opcional */ }}
      />

      {
        elaboradosStack.map((elaborado, stackIdx) => (
          <RecetaModal
            key={`elaborado-${elaborado.id}-${stackIdx}`}
            open={true}
            esElaborado={!elaborado.esArticulo}  // ← false si es artículo gemelo
            modoInsumo={!elaborado.esArticulo}
            saltarSelector
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
            priceLists={priceLists}
            priceListsByList={priceListsByList}
            onSaved={(saved) => {
              popElaborado();
              // Avisar a los modales padre que este elaborado cambió su costo,
              // para que recarguen sus items (propagación ya persistida en DB).
              try {
                window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', {
                  detail: { insumoId: elaborado.id }
                }));
              } catch { }
              // Refrescar gemelos del modal base si era el último
              if (elaboradosStack.length === 1) {
                loadGemelosGroup();
              }
              // Receta borrada: sacar del mapa para que deje de figurar como elaborado
              if (saved?.costo_total === 0 && saved?.costo_por_porcion === 0) {
                setLocalRecetasElaborados(prev => {
                  const next = { ...prev };
                  delete next[String(elaborado.id)];
                  return next;
                });
                // Sin receta: vuelve a ser insumo simple, el costo sale de la compra
                setInsumos(prev => prev.map(i =>
                  String(i.id) === String(elaborado.id)
                    ? { ...i, es_elaborado: false, tiene_receta: false, costo_efectivo_origen: 'compra' }
                    : i
                ));
                setItems(prev => prev.map(it =>
                  String(it.supplyId) === String(elaborado.id)
                    ? { ...it, _refreshed: Date.now() }
                    : it
                ));
                return;
              }
              if (saved?.costo_total != null || saved?.costo_por_porcion != null) {
                const costoTotal = saved.costo_total ?? (saved.costo_por_porcion * (saved.porciones || 1));
                const porciones = saved.porciones || 1;
                const precioSugerido = saved.precio_sugerido || 0;
                setLocalRecetasElaborados(prev => ({
                  ...prev,
                  [String(elaborado.id)]: {
                    costoTotal, porciones, precioSugerido,
                    rendimientoPeso: saved.rendimiento_peso != null ? Number(saved.rendimiento_peso) : (prev[String(elaborado.id)]?.rendimientoPeso ?? null),
                    unidadPeso: saved.unidad_peso || prev[String(elaborado.id)]?.unidadPeso || null,
                    rendimientoUnidad: saved.rendimiento_unidad || prev[String(elaborado.id)]?.rendimientoUnidad || 'porcion',
                  },
                }));
                // La receta recién guardada es lo más nuevo: el origen pasa a elaboración
                setInsumos(prev => prev.map(i =>
                  String(i.id) === String(elaborado.id)
                    ? { ...i, es_elaborado: true, tiene_receta: true, costo_efectivo_origen: 'elaboracion' }
                    : i
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
