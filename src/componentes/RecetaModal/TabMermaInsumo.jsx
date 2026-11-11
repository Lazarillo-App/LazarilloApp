/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabMermaInsumo.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Alert, Stack, Checkbox, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { insumoMermasList, insumoMermaCreate, insumoMermaUpdate, insumoMermaDelete } from '@/servicios/apiInsumos';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { sanitizeDecimal } from '@/utils/decimales';
import { canonicalUnit, fmt, PRIMARY } from './helpers';
import ConfirmDialog from './ConfirmDialog';
import ModalAplicarMermaDefault from './ModalAplicarMermaDefault';

export default function TabMermaInsumo({ insumoId, businessId, insumoData, desperdicioGlobalPct = 5, todosInsumos = [] }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', peso_inicial: '', peso_final: '' });
  // ── Aplicar la merma nueva a OTROS insumos de una (misma nombre/pesos) ──
  const [otrosOpen, setOtrosOpen] = useState(false);
  const [otrosQuery, setOtrosQuery] = useState('');
  const [otrosSeleccionados, setOtrosSeleccionados] = useState(() => new Set());
  const otrosFiltrados = useMemo(() => {
    const q = otrosQuery.trim().toLowerCase();
    return todosInsumos
      .filter(i => String(i.id) !== String(insumoId) && (!q || (i.nombre || '').toLowerCase().includes(q)))
      .slice(0, 50);
  }, [todosInsumos, otrosQuery, insumoId]);
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
      // No hay aviso en pantalla: la mayoría de los insumos simplemente no tiene
      // mermas cargadas todavía, y eso no es un error — se ve como lista vacía.
      // Una falla real de backend igual rompe el resto de la pantalla; queda en consola.
      .catch((e) => { console.error('[TabMermaInsumo] Error al cargar mermas:', e); setLista([]); })
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

  // Fila nueva completa = nombre + peso inicial + peso final (final ≤ inicial: si no, la merma da negativa).
  const finalMayor = Number(nuevo.peso_inicial) > 0 && Number(nuevo.peso_final) > Number(nuevo.peso_inicial);
  const nuevaCompleta = !!nuevo.nombre.trim() && Number(nuevo.peso_inicial) > 0 && Number(nuevo.peso_final) > 0 && !finalMayor;
  const guardandoRef = useRef(false);   // evita crearla dos veces (clic afuera + cierre del modal)

  const agregar = async () => {
    if (!nuevaCompleta || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true); setError(''); setInfo('');
    const payload = {
      nombre: nuevo.nombre.trim(),
      peso_inicial: Number(nuevo.peso_inicial),
      peso_final: Number(nuevo.peso_final),
    };
    try {
      await insumoMermaCreate(insumoId, {
        ...payload,
        es_default: lista.length === 0, // la primera que se crea es default
      }, businessId);

      // ── Copiarla también a otros insumos tildados (misma nombre/pesos) ──
      // No forzamos es_default acá: cada insumo mantiene su propia default tal como
      // estaba; el usuario la marca aparte si quiere que esta sea la nueva default ahí.
      const otrosIds = [...otrosSeleccionados];
      if (otrosIds.length) {
        const resultados = await Promise.allSettled(
          otrosIds.map(id => insumoMermaCreate(id, { ...payload, es_default: false }, businessId))
        );
        const ok = resultados.filter(r => r.status === 'fulfilled').length;
        const fallidos = resultados.length - ok;
        setInfo(
          `Merma creada en este insumo${ok ? ` y en ${ok} más` : ''}.` +
          (fallidos ? ` ${fallidos} no se pudieron crear (¿ya tenían una merma con ese nombre?).` : '')
        );
        otrosIds.forEach(id => {
          try { window.dispatchEvent(new CustomEvent('insumo:mermas-changed', { detail: { insumoId: id } })); } catch { }
        });
      }

      setNuevo({ nombre: '', peso_inicial: '', peso_final: '' });
      setOtrosSeleccionados(new Set());
      setOtrosOpen(false);
      cargar();
      avisarCambio();
    } catch (e) { setError(e.message || 'No se pudo agregar'); }
    finally { setGuardando(false); guardandoRef.current = false; }
  };

  // ── Guardado automático de la fila nueva (Diego 11/11: "muchas veces olvidé apretar el +") ──
  // Apenas la fila está completa y se sale de ella (Tab, clic en cualquier otro lado o cierre del
  // modal), la merma queda creada. Mientras se elige a qué otros insumos aplicarla, no se guarda:
  // la fila y ese panel son una misma "zona".
  const zonaNuevaRef = useRef(null);
  const agregarRef = useRef(agregar);
  agregarRef.current = agregar;
  const completaRef = useRef(nuevaCompleta);
  completaRef.current = nuevaCompleta;
  useEffect(() => {
    const alClicAfuera = (e) => {
      if (!completaRef.current) return;
      if (zonaNuevaRef.current && zonaNuevaRef.current.contains(e.target)) return;
      agregarRef.current();
    };
    document.addEventListener('mousedown', alClicAfuera, true);
    return () => {
      document.removeEventListener('mousedown', alClicAfuera, true);
      if (completaRef.current) agregarRef.current();   // se cerró el modal con la fila completa
    };
  }, []);

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
      {info && <Alert severity="success" sx={{ mb: 1.5, py: 0.5 }} onClose={() => setInfo('')}>{info}</Alert>}

      {/* Una sola franja (Diego 11/11): a la izquierda qué es una merma (texto breve en gris) y a la
          derecha, solo lectura, primero el precio de compra y después la unidad (recuadro chico). */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0, pr: 1, fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.5 }}>
          Las mermas de un insumo pueden darse por <b>procesamiento</b> (le quitás algo antes de usarlo: pelar, limpiar),
          por <b>cocción</b> (lo freís, lo reducís) o por <b>cambio de temperatura</b> (lo recibís congelado y lo usás descongelado).
          Cargala si en tus recetas usás el peso ya manipulado; si usás el peso tal como lo comprás, no hace falta.
        </Typography>
        <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, width: 180, flexShrink: 0 }}>
          <Typography variant="caption" sx={{ position: 'absolute', top: -8, left: 8, bgcolor: 'background.paper', px: 0.5, fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>Precio de compra ($/{unidad})</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>${fmt(precioCompra)}</Typography>
        </Box>
        <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, width: 96, flexShrink: 0, bgcolor: 'action.hover' }}>
          <Typography variant="caption" sx={{ position: 'absolute', top: -8, left: 8, bgcolor: 'background.paper', px: 0.5, fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>U de medida</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }}>{unidad}</Typography>
        </Box>
      </Stack>

      {/* Header columnas */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, mb: 0.5 }}>
        {/* La explicación de qué es cada cosa va en el tooltip de cada título (antes era una leyenda
            roja al pie que Diego encontró confusa, 11/11). */}
        {[
          ['Default', 'Si la tildás, esta merma se aplica sola cada vez que agregues este insumo a una receta.'],
          ['Nombre de la merma', 'Qué le hacés al insumo antes de usarlo: pelar, limpiar, cocinar, descarozar…'],
          ['Peso inicial', 'Cuánto entra: el peso tal como lo comprás (ej. 1.000 g de papa con cáscara).'],
          ['Peso final', 'Cuánto queda para usar después de ese proceso (ej. 800 g de papa pelada, frita, etc.).'],
          ['% Merma', 'Lo que se pierde en el proceso: (peso inicial − peso final) ÷ peso inicial.'],
          ['Precio c/merma', `Lo que te cuesta de verdad cada ${unidad} que usás: el precio de compra con el desperdicio, repartido en lo que queda.`],
          ['', ''],
        ].map(([h, ayuda], i) => {
          const titulo = (
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ fontSize: '0.66rem', textAlign: i >= 2 && i <= 5 ? 'right' : (i === 0 ? 'center' : 'left'),
                ...(ayuda ? { cursor: 'help', textDecoration: 'underline dotted', textUnderlineOffset: 2 } : {}) }}>
              {h}
            </Typography>
          );
          return ayuda
            ? <Tooltip key={i} title={ayuda} arrow placement="top">{titulo}</Tooltip>
            : <Box key={i}>{titulo}</Box>;
        })}
      </Box>

      {/* ── Fila del desperdicio GLOBAL (no eliminable, no default) ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 100px 75px 130px 36px', gap: 1, px: 0.5, py: 0.75, alignItems: 'center', bgcolor: '#fef9c3', borderRadius: 1, mb: 0.5 }}>
        <Box />
        <Tooltip arrow placement="top" title="Un % que se suma al precio de TODOS los insumos del local (roturas, sobrantes, lo que se tira). Se cambia acá o en Configuración.">
          <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#78350f', cursor: 'help', width: 'fit-content' }}>Desperdicio global</Typography>
        </Tooltip>
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
                  <IconButton size="small" onClick={() => marcarDefault(m)} title={esDef ? 'Esta merma se aplica sola cada vez que agregás este insumo a una receta' : 'Si la tildás, esta merma se aplica sola cada vez que agregues este insumo a una receta'}
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

          {/* Fila nueva + panel "aplicar a otros": una sola zona para el guardado automático */}
          <Box ref={zonaNuevaRef}
            onBlur={(e) => {
              if (zonaNuevaRef.current && zonaNuevaRef.current.contains(e.relatedTarget)) return;
              // El foco que vuelve al contenedor del modal (focus trap de MUI al tocar un texto de la
              // zona) no cuenta como "salir": solo Tab o foco a otro campo fuera de la zona.
              if (e.relatedTarget && e.relatedTarget.contains(zonaNuevaRef.current)) return;
              if (e.relatedTarget && nuevaCompleta) agregar();
            }}>
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
            {/* Sin botón "+": la fila se guarda sola al completarla y salir (Diego 11/11: "¿para qué usaría el +?").
                Solo se ve la ruedita mientras se guarda. */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              {guardando && <CircularProgress size={14} />}
            </Box>
          </Box>
          {finalMayor && (
            <Typography variant="caption" sx={{ display: 'block', px: 0.5, color: G.rojo, fontWeight: 600 }}>
              El peso final no puede ser mayor al inicial: la merma daría negativa y no se guarda.
            </Typography>
          )}

          {/* Aplicar la merma que se está por crear a otros insumos también (misma
              nombre/pesos) — evita cargarla insumo por insumo cuando varios comparten
              el mismo % de merma (ej. varias gaseosas con la misma pérdida por tapa). */}
          {todosInsumos.length > 0 && (
            <Box sx={{ mt: 0.5, px: 0.5 }}>
              <Typography
                variant="caption"
                onClick={() => setOtrosOpen(v => !v)}
                sx={{ color: PRIMARY, cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', userSelect: 'none' }}
              >
                {otrosOpen ? '▾' : '▸'} Aplicar esta merma nueva también a otros insumos
                {otrosSeleccionados.size > 0 ? ` (${otrosSeleccionados.size} elegidos)` : ''}
              </Typography>
              {otrosOpen && (
                <Box sx={{ mt: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <TextField
                    size="small" fullWidth placeholder="Buscar insumo…"
                    value={otrosQuery}
                    onChange={e => setOtrosQuery(e.target.value)}
                    inputProps={{ style: { fontSize: '0.78rem' } }}
                    sx={{ mb: 0.75 }}
                  />
                  <Box sx={{ maxHeight: 180, overflowY: 'auto' }}>
                    {otrosFiltrados.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">Sin resultados</Typography>
                    ) : otrosFiltrados.map(i => {
                      const checked = otrosSeleccionados.has(i.id);
                      return (
                        <Box key={i.id}
                          onClick={() => setOtrosSeleccionados(prev => {
                            const nx = new Set(prev);
                            checked ? nx.delete(i.id) : nx.add(i.id);
                            return nx;
                          })}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <Checkbox size="small" checked={checked} sx={{ p: 0.25 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{i.nombre}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}
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
