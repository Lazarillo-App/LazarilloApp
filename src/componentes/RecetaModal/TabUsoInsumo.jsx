/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabUsoInsumo.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, CircularProgress, Select, MenuItem, Button, Checkbox, Divider, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  insumoUsoList, insumoMermasList, insumoUsoCambiarMerma, insumoUsoCambiarCantidad, insumoUsoQuitar,
  insumoMermaCreate,
} from '@/servicios/apiInsumos';
import { showConfirm } from '@/servicios/appConfirm';
import { PRIMARY } from './helpers';
import ModalAplicarMermaDefault from './ModalAplicarMermaDefault';
import { downwardMenuProps } from '@/utils/menuProps';

const NUEVA_MERMA = '__nueva__';

/* ════════════════════════════════════════
   TAB USO — recetas donde se usa el insumo
════════════════════════════════════════ */
export default function TabUsoInsumo({ insumoId, businessId, insumoData, desperdicioGlobalPct = 5, onReemplazar, onAbrirReceta }) {
  const [uso, setUso] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mermas, setMermas] = useState([]);
  const [mermaElegidaId, setMermaElegidaId] = useState('');
  const [mermaParaAplicar, setMermaParaAplicar] = useState(null);
  const [cambiandoItemId, setCambiandoItemId] = useState(null);
  const [editandoCantidadId, setEditandoCantidadId] = useState(null);
  const [cantidadDraft, setCantidadDraft] = useState('');
  const [sortBy, setSortBy] = useState(null); // 'codigo' | 'nombre' | 'cantidad' | 'merma'
  const [sortDir, setSortDir] = useState('asc');
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [quitando, setQuitando] = useState(false);

  // Mini-modal "+ Nueva merma…" disparado desde el Select de una fila puntual:
  // crea la merma en el catálogo del insumo y la deja aplicada a ESA receta,
  // sin navegar a la pestaña Merma (eso es lo que onIrAMerma hacía antes).
  const [mermaNuevaParaItemId, setMermaNuevaParaItemId] = useState(null);
  const [mermaNuevaIdsExistentes, setMermaNuevaIdsExistentes] = useState([]);
  const [nuevaMermaDraft, setNuevaMermaDraft] = useState({ nombre: '', peso_inicial: '', peso_final: '' });
  const [guardandoMermaNueva, setGuardandoMermaNueva] = useState(false);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  const usoOrdenado = useMemo(() => {
    if (!sortBy) return uso;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (u) => {
      if (sortBy === 'cantidad') return Number(u.cantidad) || 0;
      if (sortBy === 'codigo') return String(u.codigo || '');
      if (sortBy === 'merma') return String(u.merma_nombre || '');
      return String(u.nombre || '');
    };
    return [...uso].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * dir;
    });
  }, [uso, sortBy, sortDir]);

  const avisarCambio = () => {
    try { window.dispatchEvent(new CustomEvent('insumo:mermas-changed', { detail: { insumoId } })); } catch { }
    try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
    try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { }
    try { window.dispatchEvent(new CustomEvent('insumos:updated')); } catch { }
  };

  // nuevosIds: array de ids de merma combinadas (igual que el multi-select de
  // "avanzadas" en el editor de receta) — [] limpia la selección de esta fila.
  // `catalogo` es opcional: por defecto usa el estado `mermas`, pero al crear
  // una merma nueva hace falta pasarle el catálogo YA actualizado (el estado
  // recién seteado todavía no se refleja en este closure).
  const cambiarMermaFila = async (u, nuevosIds, catalogo = mermas) => {
    const anterior = { merma_id: u.merma_id, merma_ids: u.merma_ids, merma_nombre: u.merma_nombre };
    const nombres = nuevosIds
      .map(id => catalogo.find(m => Number(m.id) === Number(id))?.nombre)
      .filter(Boolean)
      .join(' + ');
    setUso(prev => prev.map(x => x.item_id === u.item_id
      ? { ...x, merma_id: nuevosIds[0] ?? null, merma_ids: nuevosIds, merma_nombre: nombres || null }
      : x));
    setCambiandoItemId(u.item_id);
    try {
      await insumoUsoCambiarMerma(insumoId, u.item_id, nuevosIds, businessId);
      avisarCambio();
    } catch {
      // Revertir en la fila si falló
      setUso(prev => prev.map(x => x.item_id === u.item_id ? { ...x, ...anterior } : x));
    } finally {
      setCambiandoItemId(null);
    }
  };

  // Corrige la cantidad de una fila puntual, sin reabrir la receta — mismo
  // criterio optimista que cambiarMermaFila (si falla, revierte la fila).
  const cambiarCantidadFila = async (u, nuevaCantidad) => {
    const anterior = u.cantidad;
    setUso(prev => prev.map(x => x.item_id === u.item_id ? { ...x, cantidad: nuevaCantidad } : x));
    setCambiandoItemId(u.item_id);
    try {
      await insumoUsoCambiarCantidad(insumoId, u.item_id, nuevaCantidad, businessId);
      avisarCambio();
    } catch {
      setUso(prev => prev.map(x => x.item_id === u.item_id ? { ...x, cantidad: anterior } : x));
    } finally {
      setCambiandoItemId(null);
    }
  };

  const toggleSeleccion = (itemId) => {
    setSeleccionados(prev => {
      const n = new Set(prev);
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
      return n;
    });
  };

  // Saca el insumo de una o varias recetas de un plumazo — optimista (las filas
  // desaparecen ya) con revert si el pedido falla.
  const quitarDeRecetas = async (itemIds) => {
    const idsNum = itemIds.map(Number).filter(Number.isFinite);
    if (!idsNum.length) return;
    const nombres = uso.filter(u => idsNum.includes(u.item_id)).map(u => u.nombre);
    const plural = idsNum.length > 1;
    const ok = await showConfirm(
      plural
        ? `¿Quitar ${insumoData?.nombre || 'este insumo'} de ${idsNum.length} recetas (${nombres.join(', ')})?`
        : `¿Quitar ${insumoData?.nombre || 'este insumo'} de "${nombres[0] || 'esta receta'}"?`,
      { danger: true }
    );
    if (!ok) return;

    const anterior = uso;
    setUso(prev => prev.filter(x => !idsNum.includes(x.item_id)));
    setSeleccionados(prev => { const n = new Set(prev); idsNum.forEach(id => n.delete(id)); return n; });
    setQuitando(true);
    try {
      await insumoUsoQuitar(insumoId, idsNum, businessId);
      avisarCambio();
    } catch {
      setUso(anterior);
    } finally {
      setQuitando(false);
    }
  };

  const abrirEdicionCantidad = (u) => {
    setEditandoCantidadId(u.item_id);
    setCantidadDraft(String(u.cantidad ?? ''));
  };

  const confirmarEdicionCantidad = (u) => {
    const n = Number(String(cantidadDraft).replace(',', '.'));
    setEditandoCantidadId(null);
    if (Number.isFinite(n) && n > 0 && n !== u.cantidad) cambiarCantidadFila(u, n);
  };

  const cargarUso = useCallback(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoUsoList(insumoId, businessId)
      .then(r => setUso(Array.isArray(r?.uso) ? r.uso : []))
      .catch(() => setUso([]))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  useEffect(() => { cargarUso(); }, [cargarUso]);

  const cargarMermas = useCallback(() => {
    if (!insumoId || !businessId) return;
    insumoMermasList(insumoId, businessId)
      .then(r => setMermas(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setMermas([]));
  }, [insumoId, businessId]);

  useEffect(() => { cargarMermas(); }, [cargarMermas]);

  const unidadBase = insumoData?.unidad_med || insumoData?.medida || 'u';

  // Mismas fórmulas que TabMermaInsumo.jsx (ahí el % y el $ ya se muestran
  // para las mermas existentes): precio de compra del insumo con el
  // desperdicio global ya aplicado, y el costo que queda por unidad
  // UTILIZABLE con una merma de peso_inicial→peso_final puntual.
  const precioCompra = Number(insumoData?.precio_ref)
    || Number(insumoData?.precio_ultima_compra)
    || Number(insumoData?.precio_promedio)
    || Number(insumoData?.precio)
    || 0;
  const precioConGlobal = precioCompra * (1 + (Number(desperdicioGlobalPct) || 0) / 100);
  const pctMermaPreview = (bruto, neto) => (Number(bruto) > 0 ? ((Number(bruto) - Number(neto)) / Number(bruto)) * 100 : 0);
  const precioConMermaPreview = (bruto, neto) => (Number(neto) > 0 ? precioConGlobal * (Number(bruto) / Number(neto)) : 0);

  const guardarNuevaMerma = async () => {
    const nombre = nuevaMermaDraft.nombre.trim();
    const pesoInicial = Number(String(nuevaMermaDraft.peso_inicial).replace(',', '.'));
    const pesoFinal = Number(String(nuevaMermaDraft.peso_final).replace(',', '.'));
    if (!nombre || !(pesoInicial > 0) || !(pesoFinal > 0) || mermaNuevaParaItemId == null) return;
    const fila = uso.find(x => x.item_id === mermaNuevaParaItemId);
    if (!fila) { setMermaNuevaParaItemId(null); return; }

    setGuardandoMermaNueva(true);
    try {
      const res = await insumoMermaCreate(insumoId, { nombre, peso_inicial: pesoInicial, peso_final: pesoFinal }, businessId);
      const creada = res?.data;
      if (!creada?.id) throw new Error('La merma se creó sin id');
      const catalogoActualizado = [...mermas, creada];
      setMermas(catalogoActualizado);
      await cambiarMermaFila(fila, [...mermaNuevaIdsExistentes, creada.id], catalogoActualizado);
      setMermaNuevaParaItemId(null);
      setNuevaMermaDraft({ nombre: '', peso_inicial: '', peso_final: '' });
    } catch {
      // se deja el modal abierto para reintentar
    } finally {
      setGuardandoMermaNueva(false);
    }
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Recetas donde se usa <b>{insumoData?.nombre || 'este insumo'}</b>
          {uso.length > 0 && ` · ${uso.length} ${uso.length === 1 ? 'receta' : 'recetas'}`}
        </Typography>
        {/* Acá (no en el selector de entrada) es donde en los hechos se decide si
            reemplazar el insumo: viendo en qué recetas se usa y por cuánto pesan. */}
        {onReemplazar && (
          <Button size="small" variant="outlined" onClick={onReemplazar} sx={{ flexShrink: 0 }}>
            🔁 Reemplazar insumo
          </Button>
        )}
      </Box>

      {/* Modificar la merma de uno o varios productos/elaborados a la vez, desde acá
          mismo — sin tener que ir insumo por insumo hasta la pestaña Merma. */}
      {mermas.length > 0 && uso.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Aplicar merma en estas recetas:
          </Typography>
          <Select MenuProps={downwardMenuProps()}
            size="small"
            displayEmpty
            value={mermaElegidaId}
            onChange={e => setMermaElegidaId(e.target.value)}
            sx={{ fontSize: '0.8rem', minWidth: 160, '& .MuiSelect-select': { py: 0.4 } }}
          >
            <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>Elegir merma…</MenuItem>
            {mermas.map(m => (
              <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.8rem' }}>{m.nombre}</MenuItem>
            ))}
          </Select>
          <Button
            size="small" variant="outlined"
            disabled={!mermaElegidaId}
            onClick={() => {
              const m = mermas.find(x => String(x.id) === String(mermaElegidaId));
              if (m) setMermaParaAplicar(m);
            }}
          >
            Aplicar…
          </Button>
        </Box>
      )}

      {/* Selección múltiple: quitar el insumo de varias recetas de una — las
          filas tildadas con el checkbox de la izquierda. */}
      {seleccionados.size > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {seleccionados.size} {seleccionados.size === 1 ? 'receta seleccionada' : 'recetas seleccionadas'}
          </Typography>
          <Button
            size="small" variant="outlined" color="error"
            disabled={quitando}
            onClick={() => quitarDeRecetas(Array.from(seleccionados))}
          >
            🗑 Quitar de {seleccionados.size > 1 ? `las ${seleccionados.size} recetas` : 'esta receta'}
          </Button>
        </Box>
      )}

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
          {/* Header — clickeable para ordenar de mayor a menor y viceversa */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: '28px 90px 1fr 130px 170px 32px', gap: 1,
            px: 1.5, py: 1, bgcolor: `${PRIMARY}0d`, borderBottom: '1px solid', borderColor: 'divider',
            fontWeight: 700, fontSize: '0.75rem', color: PRIMARY, alignItems: 'center',
          }}>
            <Checkbox
              size="small"
              checked={usoOrdenado.length > 0 && seleccionados.size === usoOrdenado.length}
              indeterminate={seleccionados.size > 0 && seleccionados.size < usoOrdenado.length}
              onChange={() => setSeleccionados(prev =>
                prev.size === usoOrdenado.length ? new Set() : new Set(usoOrdenado.map(u => u.item_id))
              )}
              sx={{ p: 0.25 }}
            />
            {[
              ['codigo', 'Código art.', 'left'],
              ['nombre', 'Nombre', 'left'],
              ['cantidad', 'Cantidad', 'right'],
              ['merma', 'Merma', 'left'],
            ].map(([key, label, align]) => (
              <div
                key={key}
                onClick={() => toggleSort(key)}
                style={{
                  cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center',
                  gap: 3, justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                {label}
                <span style={{ fontSize: '0.65rem', opacity: sortBy === key ? 1 : 0.3 }}>
                  {sortBy === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                </span>
              </div>
            ))}
            <div />
          </Box>
          {/* Filas */}
          {usoOrdenado.map((u, i) => (
            <Box key={u.item_id ?? i} sx={{
              display: 'grid', gridTemplateColumns: '28px 90px 1fr 130px 170px 32px', gap: 1,
              px: 1.5, py: 1, alignItems: 'center',
              borderBottom: i < usoOrdenado.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: '#f8fafc' },
            }}>
              <Checkbox
                size="small"
                checked={seleccionados.has(u.item_id)}
                onChange={() => toggleSeleccion(u.item_id)}
                sx={{ p: 0.25 }}
              />
              {(() => {
                const puedeAbrir = !!onAbrirReceta && u.owner_id != null;
                const abrir = () => puedeAbrir && onAbrirReceta(u);
                return (
                  <>
                    <div
                      onClick={abrir}
                      title={puedeAbrir ? 'Abrir esta receta' : undefined}
                      style={{
                        color: '#64748b', fontVariantNumeric: 'tabular-nums',
                        cursor: puedeAbrir ? 'pointer' : 'default',
                      }}
                    >
                      {u.codigo || '—'}
                    </div>
                    <div
                      onClick={abrir}
                      title={puedeAbrir ? 'Abrir esta receta' : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden',
                        cursor: puedeAbrir ? 'pointer' : 'default',
                      }}
                    >
                      {u.es_elaborado && (
                        <span title="Insumo elaborado" style={{ color: '#6366f1', fontSize: '0.7rem', flexShrink: 0 }}>●</span>
                      )}
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: puedeAbrir ? 'underline' : 'none', textDecorationColor: '#cbd5e1',
                      }}>
                        {u.nombre}
                      </span>
                    </div>
                  </>
                );
              })()}
              {editandoCantidadId === u.item_id ? (
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={cantidadDraft}
                  onChange={(e) => setCantidadDraft(e.target.value)}
                  onBlur={() => confirmarEdicionCantidad(u)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') { setEditandoCantidadId(null); }
                  }}
                  style={{
                    width: '100%', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    border: '1px solid', borderColor: PRIMARY, borderRadius: 4, padding: '2px 6px',
                    fontSize: '0.82rem', boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div
                  onClick={() => { if (cambiandoItemId !== u.item_id) abrirEdicionCantidad(u); }}
                  title="Click para corregir la cantidad"
                  style={{
                    textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    cursor: cambiandoItemId === u.item_id ? 'default' : 'pointer',
                    opacity: cambiandoItemId === u.item_id ? 0.5 : 1,
                    borderBottom: '1px dashed transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#cbd5e1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                >
                  {Number(u.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {u.unidad || unidadBase}
                </div>
              )}
              {(() => {
                const sel = Array.isArray(u.merma_ids) ? u.merma_ids.map(String) : [];
                return (
                  <Select MenuProps={downwardMenuProps()}
                    size="small"
                    multiple
                    displayEmpty
                    value={sel}
                    onChange={e => {
                      const raw = e.target.value;
                      const arr = typeof raw === 'string' ? raw.split(',') : raw;
                      if (arr.includes(NUEVA_MERMA)) {
                        // Mini-modal in-place: la merma queda aplicada a ESTA receta
                        // puntual, sin navegar a la pestaña Merma (ver guardarNuevaMerma).
                        setMermaNuevaParaItemId(u.item_id);
                        setMermaNuevaIdsExistentes(arr.filter(x => x !== NUEVA_MERMA).map(Number));
                        setNuevaMermaDraft({ nombre: '', peso_inicial: '', peso_final: '' });
                        return; // no persistir el sentinel ni tocar la fila
                      }
                      cambiarMermaFila(u, arr.filter(x => x !== '').map(Number));
                    }}
                    disabled={cambiandoItemId === u.item_id}
                    renderValue={(val) => {
                      const ids = (val || []).filter(x => x !== NUEVA_MERMA);
                      if (!ids.length) return u.aplica_merma ? 'Global (sin merma específica)' : 'No';
                      const factor = ids.reduce((acc, id) => {
                        const m = mermas.find(x => String(x.id) === String(id));
                        if (!m || !(Number(m.peso_final) > 0) || !(Number(m.peso_inicial) > 0)) return acc;
                        return acc * (Number(m.peso_inicial) / Number(m.peso_final));
                      }, 1);
                      const nombres = ids
                        .map(id => mermas.find(x => String(x.id) === String(id))?.nombre)
                        .filter(Boolean)
                        .join(' + ');
                      return `${nombres} (×${factor.toFixed(2)})`;
                    }}
                    sx={{ fontSize: '0.76rem', '& .MuiSelect-select': { py: 0.25 } }}
                  >
                    {mermas.map(m => (
                      <MenuItem key={m.id} value={String(m.id)} sx={{ fontSize: '0.76rem' }}>
                        <Checkbox size="small" checked={sel.includes(String(m.id))} sx={{ p: 0.25, mr: 0.5 }} />
                        {m.nombre}
                      </MenuItem>
                    ))}
                    {mermas.length > 0 && <Divider sx={{ my: 0.5 }} />}
                    <MenuItem value={NUEVA_MERMA} sx={{ fontSize: '0.76rem', color: PRIMARY, fontWeight: 700 }}>
                      + Nueva merma…
                    </MenuItem>
                  </Select>
                );
              })()}
              <Tooltip title="Quitar de esta receta">
                <span>
                  <IconButton size="small" disabled={quitando} onClick={() => quitarDeRecetas([u.item_id])}
                    sx={{ color: 'error.main', opacity: 0.5, p: 0.25, '&:hover': { opacity: 1 } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      {mermaNuevaParaItemId != null && (
        <Dialog open onClose={() => !guardandoMermaNueva && setMermaNuevaParaItemId(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: '1rem' }}>
            Nueva merma de {insumoData?.nombre || 'este insumo'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Nombre" size="small" fullWidth autoFocus
                value={nuevaMermaDraft.nombre}
                onChange={(e) => setNuevaMermaDraft((d) => ({ ...d, nombre: e.target.value }))}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Peso inicial" size="small" fullWidth
                  type="text" inputMode="decimal"
                  value={nuevaMermaDraft.peso_inicial}
                  onChange={(e) => setNuevaMermaDraft((d) => ({ ...d, peso_inicial: e.target.value }))}
                />
                <TextField
                  label="Peso final" size="small" fullWidth
                  type="text" inputMode="decimal"
                  value={nuevaMermaDraft.peso_final}
                  onChange={(e) => setNuevaMermaDraft((d) => ({ ...d, peso_final: e.target.value }))}
                />
              </Stack>
              {/* Preview en vivo: mismo cálculo que la pestaña Merma (precio de
                  compra con el desperdicio global ya aplicado, × bruto/neto). */}
              {(() => {
                const bruto = Number(String(nuevaMermaDraft.peso_inicial).replace(',', '.'));
                const neto = Number(String(nuevaMermaDraft.peso_final).replace(',', '.'));
                const hayPesos = bruto > 0 && neto > 0;
                return (
                  <Box sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    px: 1.5, py: 1, borderRadius: 1, bgcolor: 'action.hover',
                    fontSize: '0.8rem',
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      {precioCompra > 0
                        ? `Merma: ${hayPesos ? `${pctMermaPreview(bruto, neto).toFixed(1)}%` : '—'}`
                        : 'Sin precio de referencia cargado para este insumo'}
                    </Typography>
                    {precioCompra > 0 && (
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {hayPesos
                          ? `$ ${precioConMermaPreview(bruto, neto).toLocaleString('es-AR', { maximumFractionDigits: 2 })} / ${unidadBase}`
                          : '—'}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setMermaNuevaParaItemId(null)} disabled={guardandoMermaNueva}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={
                guardandoMermaNueva
                || !nuevaMermaDraft.nombre.trim()
                || !(Number(String(nuevaMermaDraft.peso_inicial).replace(',', '.')) > 0)
                || !(Number(String(nuevaMermaDraft.peso_final).replace(',', '.')) > 0)
              }
              onClick={guardarNuevaMerma}
            >
              Guardar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {mermaParaAplicar && (
        <ModalAplicarMermaDefault
          insumoId={insumoId}
          insumoNombre={insumoData?.nombre || ''}
          mermaId={mermaParaAplicar.id}
          mermaNombre={mermaParaAplicar.nombre}
          businessId={businessId}
          introText={
            <>
              Elegí a qué recetas de <b>{insumoData?.nombre || 'este insumo'}</b> aplicarle la
              merma <b>{mermaParaAplicar.nombre}</b>. A las que ya tenían otra asignada, se les
              reemplaza.
            </>
          }
          onClose={() => setMermaParaAplicar(null)}
          onAplicado={() => {
            setMermaParaAplicar(null);
            setMermaElegidaId('');
            cargarUso();
            avisarCambio();
          }}
        />
      )}
    </Box>
  );
}
