/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabUsoInsumo.jsx
import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress, Select, MenuItem, Button } from '@mui/material';
import { insumoUsoList, insumoMermasList } from '@/servicios/apiInsumos';
import { PRIMARY } from './helpers';
import ModalAplicarMermaDefault from './ModalAplicarMermaDefault';

/* ════════════════════════════════════════
   TAB USO — recetas donde se usa el insumo
════════════════════════════════════════ */
export default function TabUsoInsumo({ insumoId, businessId, insumoData }) {
  const [uso, setUso] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mermas, setMermas] = useState([]);
  const [mermaElegidaId, setMermaElegidaId] = useState('');
  const [mermaParaAplicar, setMermaParaAplicar] = useState(null);

  const cargarUso = useCallback(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoUsoList(insumoId, businessId)
      .then(r => setUso(Array.isArray(r?.uso) ? r.uso : []))
      .catch(() => setUso([]))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  useEffect(() => { cargarUso(); }, [cargarUso]);

  useEffect(() => {
    if (!insumoId || !businessId) return;
    insumoMermasList(insumoId, businessId)
      .then(r => setMermas(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setMermas([]));
  }, [insumoId, businessId]);

  const unidadBase = insumoData?.unidad_med || insumoData?.medida || 'u';

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Recetas donde se usa <b>{insumoData?.nombre || 'este insumo'}</b>
        {uso.length > 0 && ` · ${uso.length} ${uso.length === 1 ? 'receta' : 'recetas'}`}
      </Typography>

      {/* Modificar la merma de uno o varios productos/elaborados a la vez, desde acá
          mismo — sin tener que ir insumo por insumo hasta la pestaña Merma. */}
      {mermas.length > 0 && uso.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Aplicar merma en estas recetas:
          </Typography>
          <Select
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
            try { window.dispatchEvent(new CustomEvent('insumo:mermas-changed', { detail: { insumoId } })); } catch { }
            try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
            try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { }
            try { window.dispatchEvent(new CustomEvent('insumos:updated')); } catch { }
          }}
        />
      )}
    </Box>
  );
}
