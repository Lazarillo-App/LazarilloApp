// src/componentes/RecetaModal/TabFichaInsumo.jsx
// Pestaña FICHA del modal de insumo (Diego 11/11/2026): los datos que antes
// mostraba "Editar insumo" (EditarItemModal) + los envases de compra, que
// estaban en Equivalencias. Es la que se abre al tocar el código en la tabla.
// Se guarda sola al salir de cada campo (como Merma y Equivalencias): manda
// SOLO el dato cambiado, así no pisa el resto (ej. el precio de referencia).
import { useState, useEffect, useMemo } from 'react';
import { Box, Stack, TextField, Typography, InputAdornment, CircularProgress, Checkbox } from '@mui/material';
import SelectorBuscable from '@/componentes/SelectorBuscable';
import { insumoUpdate, insumoGroupCreateOrMove } from '@/servicios/apiInsumos';
import { EnvasesCompraFicha } from '@/componentes/gestion/FacturaEnRecetas';
import { BASE } from '@/servicios/apiBase';

const UNIDADES = ['u', 'kg', 'gr', 'lt', 'ml', 'porción'];
const SIN_AGRUPAR = ['todo', 'sin agrupacion', 'sin agrupación', 'sin agrupar', 'sin grupo'];
const n = (s) => String(s || '').trim().toLowerCase();

export default function TabFichaInsumo({ insumoId, businessId, insumoData }) {
  const ins = insumoData || {};
  const [d, setD] = useState({});
  const [rubros, setRubros] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [estado, setEstado] = useState(null); // null | 'guardando' | 'ok' | mensaje de error

  useEffect(() => {
    setD({
      nombre: ins.nombre ?? '',
      rubro: ins.rubro_nombre ?? ins.rubro ?? '',
      unidad: ins.unidad_med ?? ins.unidad ?? '',
      precio: ins.precio_ref != null ? String(ins.precio_ref).replace('.', ',') : '',
    });
    setEstado(null);
  }, [insumoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rubros y agrupaciones del negocio (mismas fuentes que usaba "Editar insumo").
  useEffect(() => {
    if (!businessId) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Business-Id': String(businessId) };
    fetch(`${BASE}/insumos/maxi/rubros`, { headers }).then((r) => r.json()).catch(() => ({}))
      .then((x) => setRubros((x?.items || []).map((r) => r.nombre).filter(Boolean)));
    fetch(`${BASE}/insumos/groups`, { headers }).then((r) => r.json()).catch(() => ({}))
      .then((x) => setGrupos((x?.data || []).filter((g) => !SIN_AGRUPAR.includes(n(g.nombre)) && !n(g.nombre).includes('discontinu'))));
  }, [businessId]);

  const agrupacion = useMemo(() => {
    const g = grupos.find((g) => (g.items || g.insumos || []).some((i) => Number(i.id ?? i.insumo_id ?? i) === Number(insumoId)));
    return g?.nombre || '';
  }, [grupos, insumoId]);

  const guardar = async (cambio) => {
    setEstado('guardando');
    try {
      if ('agrupacion' in cambio) {
        await insumoGroupCreateOrMove(cambio.agrupacion, [Number(insumoId)], businessId);
        setGrupos((gs) => gs.map((g) => ({ ...g, items: (g.items || []).filter((i) => Number(i.id ?? i) !== Number(insumoId)) }))
          .map((g) => (g.nombre === cambio.agrupacion ? { ...g, items: [...(g.items || []), { id: Number(insumoId) }] } : g)));
      } else {
        await insumoUpdate(insumoId, cambio, businessId);
      }
      setEstado('ok');
      window.dispatchEvent(new CustomEvent('insumos:updated', { detail: { insumoId: Number(insumoId) } }));
    } catch (e) {
      setEstado(e?.message || 'No se pudo guardar');
    }
  };

  const esManual = String(ins.origen || '').toLowerCase() === 'manual';
  const codLazarillo = esManual ? (ins.codigo_mostrar || ins.codigo_maxi || ins.id) : (ins.id ?? '');
  const nombreVacio = !String(d.nombre ?? '').trim();
  const campo = { size: 'small', sx: { '& .MuiOutlinedInput-root': { height: 40 } } };

  return (
    <Box sx={{ py: 1 }}>
      {/* Igual que "Editar insumo": foto a la izquierda y el tilde "Tomar rubro/unidad/precio
          de otro insumo" arriba de los campos (se mantienen tal cual estaban). */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch">
      <Box sx={{ width: { xs: '100%', sm: 148 }, flex: { sm: '0 0 148px' } }}>
        <Box component="label"
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: .8, height: 148, border: '1px solid', borderColor: 'divider', borderRadius: 2,
            bgcolor: 'action.hover', cursor: 'pointer', overflow: 'hidden',
            '&:hover': { borderColor: 'primary.main' },
          }}>
          <input type="file" accept="image/*" hidden />
          {ins.foto ? (
            <Box component="img" src={ins.foto} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <>
              <Box component="span" sx={{ fontSize: 26, color: 'text.disabled', lineHeight: 1 }}>🖼</Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Foto del insumo</Typography>
            </>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textAlign: 'center', mt: .7 }}>
          {ins.foto ? 'Tocá para cambiarla' : 'Tocá para agregar foto'}
        </Typography>
      </Box>
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}
          sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, px: 1.4, py: .7, bgcolor: 'action.hover' }}>
          <Checkbox size="small" sx={{ p: .4 }} />
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Tomar rubro/unidad/precio de otro insumo</Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField label="Cod. Lazarillo" disabled value={codLazarillo} {...campo} sx={{ ...campo.sx, width: { sm: 130 } }} />
          {!esManual && (
            <TextField label="Cod. Maxi" disabled value={ins.codigo_maxi ?? ''} {...campo} sx={{ ...campo.sx, width: { sm: 130 } }} />
          )}
          <TextField label="Nombre original" disabled fullWidth value={ins.nombre_original ?? ins.nombre ?? ''} {...campo} />
        </Stack>

        <TextField label="Nombre *" fullWidth value={d.nombre ?? ''} {...campo}
          onChange={(e) => setD((p) => ({ ...p, nombre: e.target.value }))}
          onBlur={() => { const v = String(d.nombre ?? '').trim(); if (v && v !== ins.nombre) guardar({ nombre: v }); }}
          error={nombreVacio} helperText={nombreVacio ? 'El nombre no puede quedar vacío' : undefined} />

        <SelectorBuscable label="Agrupación" value={agrupacion || null} opciones={grupos}
          onChange={(v) => { if (v && v !== agrupacion) guardar({ agrupacion: v }); }}
          onCrear={(nombre) => { if (nombre) guardar({ agrupacion: nombre }); }}
          textoCrear="Crear agrupación nueva…" />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <SelectorBuscable label="Rubro" requerido value={d.rubro || null} opciones={rubros}
            onChange={(v) => { if (v && v !== d.rubro) { setD((p) => ({ ...p, rubro: v })); guardar({ rubro: v }); } }} />
          <SelectorBuscable label="Unidad" requerido value={d.unidad || null} opciones={UNIDADES} ancho="150px"
            onChange={(v) => { if (v && v !== d.unidad) { setD((p) => ({ ...p, unidad: v })); guardar({ unidadMed: v }); } }} />
          <TextField label="Precio de referencia" value={d.precio ?? ''} {...campo} sx={{ ...campo.sx, width: { sm: 200 }, flexShrink: 0 }}
            onChange={(e) => setD((p) => ({ ...p, precio: e.target.value }))}
            onBlur={() => {
              const num = Number(String(d.precio ?? '').replace(/\./g, '').replace(',', '.'));
              if (Number.isFinite(num) && num > 0 && num !== Number(ins.precio_ref)) guardar({ precioRef: num });
            }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            inputProps={{ style: { textAlign: 'center' } }} />
        </Stack>

        <Box sx={{ minHeight: 18 }}>
          {estado === 'guardando' && <Stack direction="row" spacing={0.75} alignItems="center"><CircularProgress size={12} /><Typography variant="caption" color="text.secondary">Guardando…</Typography></Stack>}
          {estado === 'ok' && <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>✓ Guardado</Typography>}
          {estado && estado !== 'ok' && estado !== 'guardando' && <Typography variant="caption" color="error">{estado}</Typography>}
        </Box>
      </Stack>
      </Stack>

      {/* Envases de compra (X6, Pack…): los mismos de la carga de facturas. Antes vivían en Equivalencias. */}
      {ins.codigo_maxi && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Envases de compra</Typography>
          <EnvasesCompraFicha codigo={String(ins.codigo_maxi)} nombre={ins.nombre} />
        </Box>
      )}
    </Box>
  );
}
