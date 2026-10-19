/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabUsoInsumo.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, CircularProgress, Select, MenuItem, Button, Checkbox, Divider } from '@mui/material';
import { insumoUsoList, insumoMermasList, insumoUsoCambiarMerma, insumoUsoCambiarCantidad } from '@/servicios/apiInsumos';
import { PRIMARY } from './helpers';
import ModalAplicarMermaDefault from './ModalAplicarMermaDefault';
import { downwardMenuProps } from '@/utils/menuProps';

const NUEVA_MERMA = '__nueva__';

/* ════════════════════════════════════════
   TAB USO — recetas donde se usa el insumo
════════════════════════════════════════ */
export default function TabUsoInsumo({ insumoId, businessId, insumoData, onIrAMerma, onReemplazar, onAbrirReceta }) {
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
  const cambiarMermaFila = async (u, nuevosIds) => {
    const anterior = { merma_id: u.merma_id, merma_ids: u.merma_ids, merma_nombre: u.merma_nombre };
    const nombres = nuevosIds
      .map(id => mermas.find(m => Number(m.id) === Number(id))?.nombre)
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
            display: 'grid', gridTemplateColumns: '90px 1fr 130px 170px', gap: 1,
            px: 1.5, py: 1, bgcolor: `${PRIMARY}0d`, borderBottom: '1px solid', borderColor: 'divider',
            fontWeight: 700, fontSize: '0.75rem', color: PRIMARY,
          }}>
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
          </Box>
          {/* Filas */}
          {usoOrdenado.map((u, i) => (
            <Box key={u.item_id ?? i} sx={{
              display: 'grid', gridTemplateColumns: '90px 1fr 130px 170px', gap: 1,
              px: 1.5, py: 1, alignItems: 'center',
              borderBottom: i < usoOrdenado.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: '#f8fafc' },
            }}>
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
                        onIrAMerma?.();
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
            </Box>
          ))}
        </Box>
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
