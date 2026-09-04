/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabMermaInsumo.jsx
import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Alert, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { insumoMermasList, insumoMermaCreate, insumoMermaUpdate, insumoMermaDelete } from '@/servicios/apiInsumos';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { sanitizeDecimal } from '@/utils/decimales';
import { canonicalUnit, fmt, PRIMARY } from './helpers';
import ConfirmDialog from './ConfirmDialog';
import ModalAplicarMermaDefault from './ModalAplicarMermaDefault';

export default function TabMermaInsumo({ insumoId, businessId, insumoData, desperdicioGlobalPct = 5 }) {
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
      avisarCambio();
    } catch (e) { setError(e.message || 'No se pudo agregar'); }
    finally { setGuardando(false); }
  };

  // Avisa a los modales ancestros en cascada (receta padre que usa este insumo como
  // ingrediente) que la merma cambió, para que refresquen costo e insumo.
  const avisarCambio = () => {
    try { window.dispatchEvent(new CustomEvent('insumo:mermas-changed', { detail: { insumoId } })); } catch { }
    try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
  };

  const editar = async (m, campo, valor) => {
    const payload = { [campo]: campo === 'nombre' ? valor : Number(valor) };
    try {
      await insumoMermaUpdate(insumoId, m.id, payload, businessId);
      setLista(prev => prev.map(x => x.id === m.id ? { ...x, ...payload } : x));
      avisarCambio();
    } catch (e) { setError(e.message || 'No se pudo actualizar'); cargar(); }
  };

  const [mermaParaAplicar, setMermaParaAplicar] = useState(null); // merma recién marcada default → preguntar si aplicarla a recetas sin merma

  const marcarDefault = async (m) => {
    try {
      await insumoMermaUpdate(insumoId, m.id, { es_default: true }, businessId);
      setLista(prev => prev.map(x => ({ ...x, es_default: x.id === m.id })));
      avisarCambio();
      setMermaParaAplicar(m);
    } catch (e) { setError(e.message || 'No se pudo marcar default'); }
  };

  const [aBorrar, setABorrar] = useState(null); // merma a borrar (confirmación)
  const borrar = async (mId) => {
    try {
      await insumoMermaDelete(insumoId, mId, businessId);
      setLista(prev => prev.filter(x => x.id !== mId));
      avisarCambio();
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
      {mermaParaAplicar && (
        <ModalAplicarMermaDefault
          insumoId={insumoId}
          insumoNombre={insumoData?.nombre || ''}
          mermaId={mermaParaAplicar.id}
          mermaNombre={mermaParaAplicar.nombre}
          businessId={businessId}
          onClose={() => setMermaParaAplicar(null)}
          onAplicado={() => {
            setMermaParaAplicar(null);
            avisarCambio();
            try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { }
            try { window.dispatchEvent(new CustomEvent('insumos:updated')); } catch { }
          }}
        />
      )}
    </Box>
  );
}
