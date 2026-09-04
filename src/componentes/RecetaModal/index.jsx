/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal/index.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Modal principal de receta/promoción. Antes vivía como un único archivo de
// ~6300 líneas (RecetaModal.jsx); se separó en esta carpeta por responsabilidad:
//  - helpers.js       → constantes y funciones puras (unidades, formato, orden)
//  - calcCosto.js     → cálculo de costo de un ítem (única fuente de verdad,
//                       usada acá y en ItemRow — antes estaba duplicada en ambos)
//  - useFotoUploadQR  → hook de subida de fotos por QR (compartido por los
//                       modales de notas, antes duplicado)
//  - un archivo por subcomponente (ItemRow, NotasModal, TabMermaInsumo, etc.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal, Box, Typography, TextField, Button, IconButton,
  Alert, CircularProgress, Divider, Chip, Tooltip,
  InputAdornment, Select, MenuItem, FormControl,
  Checkbox, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, DialogContentText,
  ToggleButton, ToggleButtonGroup, Slider, Popover,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SaveIcon from '@mui/icons-material/Save';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageIcon from '@mui/icons-material/Image';
import SortIcon from '@mui/icons-material/Sort';
import {
  insumosList,
  insumoGet,
  insumoEquivalenciasList,
  insumoMermasList,
  insumoUpdate,
} from '@/servicios/apiInsumos';
import { BASE } from '@/servicios/apiBase';
import { useConfig } from '@/context/ConfigContext';
import ExcluirListasModal from '../ExcluirListasModal';
import { createOrMoveAgrupacion } from '@/servicios/apiAgrupaciones';
import { PromocionesAPI, BusinessesAPI } from '@/servicios/apiBusinesses';
import { sanitizeDecimal, parseDecimal } from '@/utils/decimales';
import { aplicarRedondeo } from '@/utils/redondeoUtils';

import { PRIMARY, ON_PRIMARY, canonicalUnit, normalizarUnidadGuardada, resolverUnidadConEquivalencia, ordenarInsumosBusqueda, fmt, colorForList } from './helpers';
import { calcCostoUnitarioItem } from './calcCosto';
import FilaResultadoInsumo from './FilaResultadoInsumo';
import NotasModal from './NotasModal';
import EditorFotoModal from './EditorFotoModal';
import VistaPreviaFotoModal from './VistaPreviaFotoModal';
import VistaCocinaModal from './VistaCocinaModal';
import ItemRow from './ItemRow';
import ModalReemplazarInsumo from './ModalReemplazarInsumo';
import TabMermaInsumo from './TabMermaInsumo';
import CostoPreferidoSelector from './CostoPreferidoSelector';
import TabComprasInsumo from './TabComprasInsumo';
import TabEquivalenciasInsumo from './TabEquivalenciasInsumo';
import TabUsoInsumo from './TabUsoInsumo';
import SelectorInsumo from './SelectorInsumo';

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
  // Negocio donde REALMENTE viven los insumos. En setups de agrupaciones/franquicias,
  // TablaArticulos pasa `insumosBizId` (negocio raíz) distinto de `businessId` (la
  // sucursal de la receta actual) — los insumos, sus equivalencias, mermas y su propia
  // receta (si es elaborado) viven bajo `insumosBizId`. Usar `businessId` a secas para
  // esas llamadas las scopea mal: el fetch vuelve vacío sin error (no hay excepción que
  // avisar) y el ítem "pierde" silenciosamente su equivalencia/merma en cada carga.
  const insumoBizId = insumosBizId || businessId;
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
  // Minimizado por default (confunde si siempre está a la vista); null = todavía sin
  // tocar por el usuario → se auto-abre solo si la receta YA tiene un rendimiento
  // distinto del default (1 porción, sin equivalente) — se resetea con cada receta.
  const [rendimientoManualOpen, setRendimientoManualOpen] = useState(null);
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

  // Recuerda para qué artículo ya resolvimos el tab inicial en esta apertura, para no
  // volver a navegar cada vez que `insumos` se refresca por otro motivo (ej. cambiar una
  // merma) mientras el usuario ya está navegando manualmente entre tabs.
  const tabResueltoParaRef = useRef(null);
  useEffect(() => {
    if (!open) { tabResueltoParaRef.current = null; return; }
    if (tabResueltoParaRef.current === articulo?.id) return; // ya resuelto para este artículo
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
        tabResueltoParaRef.current = articulo?.id;
      }
    } else {
      tabResueltoParaRef.current = articulo?.id;
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
    setRendimientoManualOpen(null); // re-evaluar auto-open para esta receta/artículo
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
            const unidad = normalizarUnidadGuardada(it.unidad || supplyMedidaRaw);
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
                fetch(`${BASE}/businesses/${insumoBizId}/insumos/${id}/receta`, {
                  headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(insumoBizId) }
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
                  insumoEquivalenciasList(id, insumoBizId).then(r => Array.isArray(r?.data) ? r.data : [])
                    .catch(e => { console.warn('[RecetaModal] fallo equivalencias insumo', id, e); return []; }),
                  insumoMermasList(id, insumoBizId).then(r => Array.isArray(r?.data) ? r.data : [])
                    .catch(e => { console.warn('[RecetaModal] fallo mermas insumo', id, e); return []; }),
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
                  const eqsFrescas = eqMap[String(it.supplyId)];
                  if (eqsFrescas) {
                    patch.equivalencias = eqsFrescas;
                    patch.unidad = resolverUnidadConEquivalencia(it.unidad, eqsFrescas, it.supplyMedida);
                  }
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

  // Refresca un insumo puntual (mermas, equivalencias, envase, costo, fecha de compra,
  // receta_*) sin recargar toda la lista: trae el insumo fresco del backend y lo mezcla
  // en `insumos`. Se usa cuando un modal anidado en cascada (merma/equivalencias/compras
  // de un insumo o insumo elaborado) cambia algo y hay que reflejarlo en este nivel.
  const refrescarInsumoPuntual = useCallback(async (insumoId) => {
    if (insumoId == null || !businessId) return;
    try {
      const r = await insumoGet(insumoId, insumoBizId);
      const fresh = r?.data;
      if (fresh) {
        setInsumos(prev => prev.map(i => String(i.id) === String(insumoId) ? { ...i, ...fresh } : i));
      }
    } catch { /* refresco best-effort: si falla, el usuario puede reabrir el modal */ }
  }, [businessId, insumosBizId]);

  // Refresh en cascada: si un insumo (o insumo elaborado) usado como ingrediente cambió
  // algo en un modal anidado — receta, merma, equivalencia, envase, compra/bonificación —
  // refrescar tanto el insumo (chips/badges) como, si este modal lo usa, la receta entera
  // (la propagación de costo ya persistió en DB).
  useEffect(() => {
    const onCostoChanged = (e) => {
      const changedId = e?.detail?.insumoId;
      if (changedId == null) return;
      refrescarInsumoPuntual(changedId);
      setItems(prev => {
        const loUsa = prev.some(it => String(it.supplyId) === String(changedId));
        if (loUsa) setReloadTick(t => t + 1);
        return prev;   // no muta items acá, solo dispara el reload
      });
    };
    window.addEventListener('receta-elaborado:costo-changed', onCostoChanged);
    return () => window.removeEventListener('receta-elaborado:costo-changed', onCostoChanged);
  }, [refrescarInsumoPuntual]);

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

  //* ── Costo de un ítem: única fuente de verdad (calcCostoUnitarioItem, compartida con
  //   ItemRow). Antes esta lógica estaba duplicada acá con ligeras diferencias respecto a
  //   la fila (ítems-artículo con tipoCosto "sugerido" daban un número distinto, y el
  //   desperdicio global por defecto mientras la config no cargó también difería: 0% acá
  //   vs 5% en la fila). Unificado, ambos leen exactamente lo mismo. ── */
  const calcCostoItem = useCallback((it) => {
    const cant = Number(it.cantidad) || 0;
    return cant * calcCostoUnitarioItem(it, {
      insumos,
      recetasElaborados: localRecetasElaborados,
      allArticulos,
      objetivoReceta: pctCostoIdeal,
      appConfigDesperdicio: appConfig.desperdicioGlobalPct ?? 5,
    });
  }, [insumos, localRecetasElaborados, allArticulos, pctCostoIdeal, appConfig.desperdicioGlobalPct]);

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

  // El bloque "Rendimiento del lote" confunde si siempre está a la vista — se muestra
  // minimizado salvo que la receta ya tenga un rendimiento distinto del default (1
  // porción, sin equivalente) o el usuario lo haya abierto a mano. Es solo una cuestión
  // de visibilidad: rendimiento/rendimientoUnidad/rendimientoPeso no cambian, así que
  // el cálculo de costo (costoXRendimiento, divisorRend, etc. más abajo) no se ve afectado.
  const rendimientoNoDefault = Number(rendimiento) !== 1 || rendimientoUnidad !== 'porcion' || rendimientoPeso != null;
  const rendimientoOpen = rendimientoManualOpen != null ? rendimientoManualOpen : rendimientoNoDefault;

  // Divisor efectivo: si hay peso equivalente (unidad no medible), usar ese; sino el rendimiento
  // El divisor del costo SIEMPRE es la cantidad de rendimiento (no el peso equivalente).
  const divisorRend = Number(rendimiento) || 1;
  const costoXRendimiento = divisorRend > 0 ? costoTotal / divisorRend : 0;
  // Redondeado con el mismo criterio elegido en Configuración (múltiplo más cercano),
  // igual que los precios manuales/aumentos masivos en la tabla de artículos.
  const precioSugeridoCrudo = pctCostoIdeal > 0 ? costoXRendimiento / (pctCostoIdeal / 100) : 0;
  const precioSugerido = precioSugeridoCrudo > 0
    ? aplicarRedondeo(precioSugeridoCrudo, appConfig.redondeoPrecios)
    : 0;
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
          window.dispatchEvent(new CustomEvent('articulos:updated'));
          window.dispatchEvent(new CustomEvent('insumos:updated'));
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
  // También refresca el insumo (envase, precio, etc.) para que chips/badges no queden stale.
  useEffect(() => {
    const handler = (e) => {
      const insId = e?.detail?.insumoId;
      if (!insId || !businessId) return;
      refrescarInsumoPuntual(insId);
      insumoEquivalenciasList(insId, insumoBizId)
        .then(r => {
          const eqs = Array.isArray(r?.data) ? r.data : [];
          setItems(prev => prev.map(it => {
            if (String(it.supplyId) !== String(insId)) return it;
            return {
              ...it,
              equivalencias: eqs,
              unidad: resolverUnidadConEquivalencia(it.unidad, eqs, it.supplyMedida),
            };
          }));
        })
        .catch(() => { });
    };
    window.addEventListener('insumo:equivalencias-changed', handler);
    window.addEventListener('insumos:updated', handler);
    return () => {
      window.removeEventListener('insumo:equivalencias-changed', handler);
      window.removeEventListener('insumos:updated', handler);
    };
  }, [businessId, refrescarInsumoPuntual]);

  // Mermas de un insumo cambiadas en el modal anidado (cascada): refrescar el insumo y
  // la lista de mermas cacheada en los items que lo usan, para que el factor de merma
  // (y por lo tanto el costo de línea) se recalcule con los datos nuevos.
  useEffect(() => {
    const handler = (e) => {
      const insId = e?.detail?.insumoId;
      if (!insId || !businessId) return;
      refrescarInsumoPuntual(insId);
      insumoMermasList(insId, insumoBizId)
        .then(r => {
          const mermas = Array.isArray(r?.data) ? r.data : [];
          setItems(prev => prev.map(it =>
            String(it.supplyId) === String(insId) ? { ...it, mermas } : it
          ));
        })
        .catch(() => { });
    };
    window.addEventListener('insumo:mermas-changed', handler);
    return () => window.removeEventListener('insumo:mermas-changed', handler);
  }, [businessId, refrescarInsumoPuntual]);

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
                businessId={insumoBizId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id)) || articulo}
                desperdicioGlobalPct={appConfig.desperdicioGlobalPct ?? 5}
              />
            ) : modoInsumo && tab === 'compras' ? (
              <TabComprasInsumo
                insumoId={articulo?.id}
                businessId={insumoBizId}
                insumoData={insumos.find(i => String(i.id) === String(articulo?.id))}
              />
            ) : modoInsumo && tab === 'equivalencias' ? (
              <TabEquivalenciasInsumo
                insumoId={articulo?.id}
                businessId={insumoBizId}
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
                businessId={insumoBizId}
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
                            businessId={insumoBizId}
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
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* ── Bloque rendimiento del lote — minimizado por default, se
                            expande solo si hace falta (mismo patrón que el panel de
                            gemelos, más abajo) ── */}
                        <Box sx={{ flex: 1, minWidth: 260 }}>
                          <Box
                            onClick={() => setRendimientoManualOpen(!rendimientoOpen)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                              py: 0.6, px: 1, borderRadius: 1,
                              bgcolor: rendimientoNoDefault ? 'rgba(3,105,161,0.05)' : 'transparent',
                              border: '1px solid', borderColor: rendimientoNoDefault ? 'rgba(3,105,161,0.2)' : 'divider',
                              '&:hover': { bgcolor: 'action.hover' }, transition: 'all .15s',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', flex: 1 }}>
                              {rendimientoNoDefault
                                ? `Rendimiento del lote: ${fmt(rendimiento)} ${{
                                    porcion: 'porciones', u: 'unidades', lt: 'litros', ml: 'ml', kg: 'kilos', gr: 'gr',
                                  }[rendimientoUnidad] || 'porciones'}`
                                : 'Rendimiento del lote (1 porción)'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{rendimientoOpen ? '▲' : '▼'}</Typography>
                          </Box>
                          {rendimientoOpen && (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 0.75 }}>
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
                          )}
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
                          sx={{ width: 96, flexShrink: 0 }}
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
                            insumosBizId={insumoBizId}
                            searchOpen={openSearchIdx === realIndex}
                            onSearchOpen={() => setOpenSearchIdx(realIndex)}
                            onSearchClose={() => setOpenSearchIdx(null)}
                            soloConCompras={soloConCompras}
                            onToggleSoloConCompras={toggleSoloConCompras}
                            appConfigDesperdicio={appConfig.desperdicioGlobalPct ?? 5}
                            precioVenta={precioActual}
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
          businessId={insumoBizId}
          insumos={insumos}
          onClose={() => setReemplazarModalOpen(false)}
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
                // Red de seguridad: refrescar el insumo aunque el cambio hecho adentro
                // (merma/equivalencia/compra) no haya disparado su evento correspondiente.
                if (!elaborado.esArticulo) refrescarInsumoPuntual(elaborado.id);
                // Si estamos cerrando el último del stack, refrescar gemelos del modal base
                // para reflejar cambios de objetivo individuales
                if (elaboradosStack.length === 1) {
                  loadGemelosGroup();
                }
              }
            }}
            articulo={elaborado}
            businessId={elaborado.esArticulo ? businessId : insumoBizId}
            insumosBizId={insumoBizId}
            getRecetaUrl={
              elaborado.esArticulo
                ? `${BASE}/businesses/${businessId}/articles/${elaborado.id}/receta`
                : `${BASE}/businesses/${insumoBizId}/insumos/${elaborado.id}/receta`
            }
            saveRecetaUrl={
              elaborado.esArticulo
                ? `${BASE}/businesses/${businessId}/articles/${elaborado.id}/receta`
                : `${BASE}/businesses/${insumoBizId}/insumos/${elaborado.id}/receta`
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
