/* eslint-disable react-hooks/exhaustive-deps */
// src/componentes/RecetaModal/ItemRow.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, IconButton, Tooltip, Chip,
  Select, MenuItem, Checkbox, InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import NotesIcon from '@mui/icons-material/Notes';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TuneIcon from '@mui/icons-material/Tune';
import { insumoEquivalenciasList, insumoMermasList } from '@/servicios/apiInsumos';
import { sanitizeDecimal } from '@/utils/decimales';
import {
  PRIMARY, UNIDADES, TIPO_COSTO_OPTS, fmt, fmtDate, stepCantidad,
  canonicalUnit, unidadesParaInsumo, getAlertaColor,
} from './helpers';
import { calcFactorMerma, calcCostoUnitarioItem } from './calcCosto';
import NotasItemModal from './NotasItemModal';

/* ════════════════════════════════════════
   FILA DE INGREDIENTE
════════════════════════════════════════ */
/**
 * recetasElaborados: { [supplyId]: { costoTotal, porciones, precioSugerido } }
 * Permite que cuando un insumo es un "elaborado", el costo se tome de su receta.
 */
export default function ItemRow({
  item, index, onChange, onRemove,
  insumos, usedSupplyIds, alertaSemanas,
  autoOpenSearch, recetasElaborados = {},
  allArticulos = [],
  objetivoReceta = 30,
  articuloId,
  businessId,
  insumosBizId,
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
  precioVenta = 0,
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

    // Cargar equivalencias propias del insumo (para el dropdown de unidad). Usa el
    // negocio donde vive el insumo (insumosBizId), no el de la receta actual — en
    // setups de agrupaciones pueden ser negocios distintos.
    const bizIdInsumo = insumosBizId || businessId;
    insumoEquivalenciasList(ins.id, bizIdInsumo)
      .then(r => {
        const eqs = Array.isArray(r?.data) ? r.data : [];
        onChange(index, { equivalencias: eqs });
      })
      .catch(() => { });
    // Cargar mermas del insumo + preseleccionar la default
    insumoMermasList(ins.id, bizIdInsumo)
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
  const factorMerma = useMemo(
    () => calcFactorMerma(item, appConfigDesperdicio),
    [item.desperdicioPct, item.mermas, item.mermaIds, item.mermaId, appConfigDesperdicio, item.esArticulo, item.articleRefId]
  );

  /**
   * Precio por unidad elegida — única fuente de verdad (calcCostoUnitarioItem, compartida
   * con el total de la receta en RecetaModal/index.jsx). Antes esta lógica estaba duplicada
   * acá con ligeras diferencias respecto al total, lo que podía mostrar números distintos
   * entre la fila y el costo total de la receta.
   */
  const costoEnUnidadElegida = useMemo(
    () => calcCostoUnitarioItem(item, {
      insumos, recetasElaborados: localRecetasElaborados, allArticulos, objetivoReceta, appConfigDesperdicio,
    }),
    [item, insumos, localRecetasElaborados, allArticulos, objetivoReceta, appConfigDesperdicio]
  );

  // Costo línea (cantidad × $/u efectivo)
  const costoLinea = useMemo(() => {
    const cant = Number(item.cantidad) || 0;
    return cant * costoEnUnidadElegida;
  }, [item.cantidad, costoEnUnidadElegida]);

  const costoEfectivoLinea = tipoCosto === 'nulo' ? 0 : costoLinea;

  // Alerta dura: el costo de ESTE ingrediente no puede superar el precio de venta del
  // artículo — si pasa, algo está mal (cantidad/unidad/rendimiento), aunque la receta
  // "esté bien" en el sentido de que los datos individuales sean correctos. Se resalta
  // en rojo lo que normalmente se ve en verde (chip $/unidad y "$ Costo Total" del
  // elaborado, badge "Elab.") para que salte a la vista de inmediato.
  const superaPrecioVenta = Number(precioVenta) > 0 && costoEfectivoLinea > Number(precioVenta);

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
                        bgcolor: superaPrecioVenta
                          ? '#fef2f2'
                          : elaborado
                            ? '#f0fdf4'
                            : (tienePrecio ? `${PRIMARY}18` : '#f1f5f9'),
                        color: superaPrecioVenta
                          ? '#ef4444'
                          : elaborado
                            ? '#16a34a'
                            : (tienePrecio ? PRIMARY : '#64748b'),
                        border: 'none',
                      }}
                      title={superaPrecioVenta ? `⚠ Este costo supera el precio de venta ($${fmt(precioVenta)}) — revisar cantidad/unidad` : titleStr}
                    />
                  );
                })()}

                {/* Chip elaborado */}
                {elaborado && (
                  <Chip label="Elab." size="small" sx={{
                    height: 16, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: superaPrecioVenta ? '#fef2f2' : '#f0fdf4',
                    color: superaPrecioVenta ? '#ef4444' : '#16a34a',
                    border: superaPrecioVenta ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  }} />
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: '1px solid', borderColor: superaPrecioVenta ? '#fecaca' : 'divider', borderRadius: 1, px: 0.75, minHeight: 30, bgcolor: superaPrecioVenta ? '#fef2f2' : (elaborado ? '#f0fdf4' : '#f8fafc'), overflow: 'hidden' }}>
          <Tooltip title={superaPrecioVenta
            ? `⚠ Este ingrediente cuesta más que el precio de venta ($${fmt(precioVenta)}) — revisar cantidad/unidad`
            : (elaborado ? `De receta elaborada` : `$${fmt(costoEnUnidadElegida)}/${item.unidad || item.supplyMedida || 'u'} × ${item.cantidad || 0}`)}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: superaPrecioVenta ? '#ef4444' : (costoEfectivoLinea < 0 ? '#ef4444' : costoEfectivoLinea > 0 ? (elaborado ? '#16a34a' : PRIMARY) : 'text.disabled'), whiteSpace: 'nowrap' }}>
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
