// src/componentes/gestion/DetalleModalShell.jsx
// Marco de los modales de detalle (lazarillo_gestion/components/dashboard/detalle-modal-shell.tsx,
// sortable-table-head.tsx, detalle-periodo-controls.tsx y edit-row-controls.tsx): título, período,
// buscador, orden por columna, tildar filas y dibujo por tandas (con miles de filas, recién se
// dibujan más al acercarse al final del scroll).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Dialog, CircularProgress, InputBase, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { sxTablaPanel } from '@/gestion/estilos';
import { labelPeriodo, navegar, cambiarModo } from '@/gestion/detallePeriodo';

const TANDA = 100;
const norm = (s) => (s ? String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') : '');

export default function DetalleModalShell({
  open, onClose, title, subtitle, cols, queryKey, queryFn, searchFields, sortFn, renderRow, saveError, footerNote,
  headerControls, periodoLabel, onServerQuery, resetKey, seleccion, anchoAcciones = 68,
}) {
  const [sort, setSort] = useState(null);
  const [query, setQuery] = useState('');
  const [visibles, setVisibles] = useState(TANDA);
  const { data: response, isLoading, error } = useQuery({
    queryKey,
    queryFn,
    enabled: open,
    staleTime: 60_000,
    // Al buscar en el servidor no se vacía la tabla mientras llega la respuesta.
    placeholderData: onServerQuery ? keepPreviousData : undefined,
  });
  const rawData = response?.data;
  const count = rawData?.length ?? 0;

  const ordenado = useMemo(() => {
    if (!rawData || !sort || !sortFn) return rawData ?? [];
    return [...rawData].sort((a, b) => sortFn(a, b, sort));
  }, [rawData, sort, sortFn]);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? ordenado.filter((item) => searchFields(item).some((f) => norm(f).includes(q))) : ordenado;
  }, [ordenado, query, searchFields]);

  // Buscador limpio al abrir con otro filtro, NO al navegar el período.
  const claveReset = JSON.stringify(resetKey ?? queryKey);
  useEffect(() => { setQuery(''); }, [claveReset]);
  useEffect(() => { setVisibles(TANDA); }, [claveReset, sort, query]);
  useEffect(() => {
    if (!onServerQuery) return undefined;
    const t = setTimeout(() => onServerQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query, onServerQuery]);

  const scrollRef = useRef(null);
  const finRef = useRef(null);
  const quedan = filtered.length > visibles;
  useEffect(() => {
    const fin = finRef.current;
    if (!quedan || !fin) return undefined;
    const obs = new IntersectionObserver(
      (entradas) => { if (entradas.some((e) => e.isIntersecting)) setVisibles((v) => v + TANDA); },
      { root: scrollRef.current, rootMargin: '800px 0px' },
    );
    obs.observe(fin);
    return () => obs.disconnect();
  }, [quedan, visibles]);

  const ordenar = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'asc' };
    return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
  });

  const idsSel = seleccion ? [...new Set(filtered.map(seleccion.idDe))] : [];
  const tildados = seleccion ? idsSel.filter((id) => seleccion.ids.has(id)).length : 0;

  return (
    <Dialog
      open={open} onClose={onClose} maxWidth={false}
      slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 32px)', sm: '94vw' }, maxWidth: 1600, maxHeight: '85vh', m: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 } } }}
    >
      <Box sx={{ px: 3, pt: 2, pb: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: 16, fontWeight: 600 }}>{title}</Box>
            {subtitle && <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{subtitle}</Box>}
          </Box>
          {headerControls}
        </Box>
        {!error && (!!query || (!isLoading && count > 1)) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: 176, flexShrink: 0, height: 32, px: 1, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <SearchIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
            <InputBase value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" sx={{ fontSize: 13, flex: 1 }} />
          </Box>
        )}
      </Box>

      {isLoading && <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box>}
      {error && <Box sx={{ py: 6, textAlign: 'center', fontSize: 14, color: 'error.main' }}>Error al cargar los datos.</Box>}
      {!isLoading && !error && count === 0 && <Box sx={{ py: 6, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>Sin registros para la selección.</Box>}
      {/* La API recorta en el tope de registros: el corte nunca puede pasar callado. */}
      {!isLoading && !error && response?.hasMore && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1, flexShrink: 0, fontSize: 12, bgcolor: 'warning.50', borderBottom: 1, borderColor: 'warning.light' }}>
          <WarningAmberIcon sx={{ fontSize: 15, color: 'warning.main' }} />
          Se muestran los primeros {count.toLocaleString('es-AR')} registros — filtrá por mes para ver el resto.
        </Box>
      )}

      {!isLoading && !error && count > 0 && (
        <Box ref={scrollRef} sx={{ overflowY: 'auto', overflowX: 'hidden', minHeight: 0, flex: 1, pb: 1 }}>
          <Table size="small" sx={[sxTablaPanel, { tableLayout: 'fixed', width: '100%', '& td, & th': { fontSize: 12 } }]}>
            <TableHead>
              <TableRow>
                {seleccion && (
                  <TableCell sx={{ width: 32, pl: 1.5, pr: 0 }}>
                    <Box
                      component="input" type="checkbox" aria-label="Tildar todos"
                      checked={idsSel.length > 0 && tildados === idsSel.length}
                      ref={(el) => { if (el) el.indeterminate = tildados > 0 && tildados < idsSel.length; }}
                      onChange={(e) => seleccion.onCambiar(filtered, e.target.checked)}
                      sx={{ cursor: 'pointer', verticalAlign: 'middle' }}
                    />
                  </TableCell>
                )}
                {cols.map((col) => {
                  const activa = sort?.key === col.sortKey;
                  const Icono = activa ? (sort.dir === 'asc' ? KeyboardArrowUpIcon : KeyboardArrowDownIcon) : UnfoldMoreIcon;
                  return (
                    <TableCell key={col.label} sx={{ width: col.width, px: 1.5, py: 1, textAlign: col.right ? 'right' : 'left', fontWeight: 500 }}>
                      {col.sortKey ? (
                        <Box component="button" type="button" onClick={() => ordenar(col.sortKey)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.25, color: activa ? 'text.primary' : 'text.secondary' }}>
                          {col.label}<Icono sx={{ fontSize: 13, opacity: activa ? 1 : 0.4 }} />
                        </Box>
                      ) : col.label}
                    </TableCell>
                  );
                })}
                <TableCell sx={{ width: anchoAcciones, p: 0 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {(quedan ? filtered.slice(0, visibles) : filtered).map((item) => renderRow(item))}
              {quedan && (
                <TableRow ref={finRef} aria-hidden>
                  <TableCell colSpan={cols.length + (seleccion ? 2 : 1)} sx={{ py: 1.5, textAlign: 'center', fontSize: 11, color: 'text.disabled' }}>Cargando más registros…</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      {saveError && <Box sx={{ borderTop: 1, borderColor: 'error.light', px: 3, py: 1, fontSize: 12, color: 'error.main' }}>{saveError}</Box>}
      {count > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderTop: 1, borderColor: 'divider', px: 3, py: 1.25, flexShrink: 0, fontSize: 11 }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {query.trim() ? `${filtered.length} de ${count} registro${count !== 1 ? 's' : ''}` : `${count} registro${count !== 1 ? 's' : ''}`}
            {periodoLabel ? ` — ${periodoLabel}` : ''}
            {seleccion && seleccion.ids.size > 0 && (
              <>
                {' · '}<Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{seleccion.ids.size} tildado{seleccion.ids.size !== 1 ? 's' : ''}</Box>{' · '}
                <Box component="button" type="button" onClick={seleccion.onLimpiar} sx={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', '&:hover': { color: 'text.primary' } }}>destildar</Box>
              </>
            )}
          </Box>
          {footerNote && <Box component="span" sx={{ color: 'text.secondary' }}>{footerNote}</Box>}
        </Box>
      )}
    </Dialog>
  );
}

const MODOS = [{ id: 'mes', label: 'Mes' }, { id: 'anio', label: 'Año' }, { id: 'historico', label: 'Histórico' }];

// ‹ Julio 2026 › + Mes / Año / Histórico. En Histórico no hay a dónde navegar.
export function DetallePeriodoControls({ periodo, onChange }) {
  const navegable = periodo.modo !== 'historico';
  const flecha = { width: 28, height: 28, border: 1, borderColor: 'divider', borderRadius: 1.5 };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {navegable && <IconButton size="small" aria-label={periodo.modo === 'mes' ? 'Mes anterior' : 'Año anterior'} onClick={() => onChange(navegar(periodo, -1))} sx={flecha}><ChevronLeftIcon sx={{ fontSize: 16 }} /></IconButton>}
        <Box component="span" sx={{ minWidth: 120, border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.5, textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{labelPeriodo(periodo)}</Box>
        {navegable && <IconButton size="small" aria-label={periodo.modo === 'mes' ? 'Mes siguiente' : 'Año siguiente'} onClick={() => onChange(navegar(periodo, 1))} sx={flecha}><ChevronRightIcon sx={{ fontSize: 16 }} /></IconButton>}
      </Box>
      <Box sx={{ display: 'inline-flex', gap: 0.25, border: 1, borderColor: 'divider', borderRadius: 2, p: 0.25 }}>
        {MODOS.map((m) => (
          <Box
            key={m.id} component="button" type="button" aria-pressed={periodo.modo === m.id} onClick={() => onChange(cambiarModo(periodo, m.id))}
            sx={{ all: 'unset', cursor: 'pointer', height: 28, px: 1.25, display: 'inline-flex', alignItems: 'center', borderRadius: 1.5, fontSize: 12, fontWeight: 500, ...(periodo.modo === m.id ? { bgcolor: 'grey.900', color: '#fff' } : { color: 'text.secondary', '&:hover': { color: 'text.primary' } }) }}
          >
            {m.label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function EditActionButtons({ onSave, onCancel, saving, saveDisabled = false, saveDisabledTitle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton size="small" onClick={onSave} disabled={saving || saveDisabled} title={saveDisabled ? saveDisabledTitle : 'Guardar'} sx={{ p: 0.25, color: 'success.main' }}><CheckIcon sx={{ fontSize: 15 }} /></IconButton>
      <IconButton size="small" onClick={onCancel} disabled={saving} title="Cancelar" sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
    </Box>
  );
}

// El lápiz aparece al pasar por la fila (la fila lleva className="fila-editable").
export function EditTriggerButton({ onClick }) {
  return (
    <IconButton className="lapiz" size="small" title="Editar" onClick={onClick} sx={{ p: 0.25, opacity: 0, '&:focus-visible': { opacity: 1 } }}>
      <EditIcon sx={{ fontSize: 13 }} />
    </IconButton>
  );
}

export function EditedDot() {
  return (
    <Tooltip title="Editado manualmente">
      <Box component="span" sx={{ display: 'inline-block', width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: 'warning.main' }} />
    </Tooltip>
  );
}
