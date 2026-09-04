/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-empty */
// src/componentes/RecetaModal/TabEquivalenciasInsumo.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton, CircularProgress, Alert,
  Select, MenuItem, FormControl,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  insumoGet, insumoEquivalenciasList, insumoEquivalenciaCreate,
  insumoEquivalenciaUpdate, insumoEquivalenciaDelete, insumoUpdate,
} from '@/servicios/apiInsumos';
import { sanitizeDecimal } from '@/utils/decimales';
import { PRIMARY, canonicalUnit, getConversionFactor, fmt } from './helpers';
import ConfirmDialog from './ConfirmDialog';

export default function TabEquivalenciasInsumo({ insumoId, businessId, insumoData, recetaInfo = null }) {
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
      // Avisar al resto (dropdown de unidades en ingredientes, etc.) y a la receta padre
      // en cascada (refresca costo/insumo si este insumo se usa como ingrediente).
      try { window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId } })); } catch { }
      try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
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
      try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
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
      try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
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
      try { window.dispatchEvent(new CustomEvent('receta-elaborado:costo-changed', { detail: { insumoId } })); } catch { }
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
