import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Button, TextField, Typography, Divider,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { httpBiz } from '../servicios/apiBusinesses';

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);

function buildTreeFromDB(items = []) {
  const flat = items.map(row => {
    const raw = row?.raw || {};
    const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
    return {
      id,
      nombre: String(row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`).trim(),
      categoria: String(row?.categoria ?? raw?.categoria ?? raw?.rubro ?? 'Sin categoría').trim() || 'Sin categoría',
      subrubro: String(row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? 'Sin subrubro').trim() || 'Sin subrubro',
      precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
    };
  }).filter(a => Number.isFinite(a.id));

  const byCat = new Map();
  for (const a of flat) {
    if (!byCat.has(a.categoria)) byCat.set(a.categoria, new Map());
    const bySr = byCat.get(a.categoria);
    if (!bySr.has(a.subrubro)) bySr.set(a.subrubro, []);
    bySr.get(a.subrubro).push({ id: a.id, nombre: a.nombre, precio: a.precio });
  }

  return Array.from(byCat, ([catNombre, bySr]) => ({
    nombre: catNombre,
    subrubros: Array.from(bySr, ([srNombre, articulos]) => ({ nombre: srNombre, articulos })),
  }));
}

export default function GestorAgrupacionesModal({
  open,
  onClose,
  preselectIds = [],
  notify,
  onRefetch,
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [search, setSearch] = useState('');
  const [seleccionIds, setSeleccionIds] = useState(preselectIds.map(Number));
  const [nombreAgr, setNombreAgr] = useState('');

  useEffect(() => {
    if (!open) return;
    setSeleccionIds(preselectIds.map(Number));
    setNombreAgr('');
    setSearch('');

    (async () => {
      try {
        setLoading(true);
        const activeBizId = localStorage.getItem('activeBusinessId');
        if (!activeBizId) throw new Error('No hay negocio activo');

        const res = await BusinessesAPI.articlesFromDB(activeBizId);
        const items = Array.isArray(res?.items) ? res.items : [];
        const tree = buildTreeFromDB(items);
        setTodosArticulos(tree);
      } catch (e) {
        console.error('GestorAgrupacionesModal: cargar catálogo BD', e);
        notify?.('No se pudo cargar el catálogo desde la base', 'error');
        setTodosArticulos([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // maestro (id -> datos) para payload
  const maestro = useMemo(() => {
    const out = [];
    (todosArticulos || []).forEach(cat => {
      (cat.subrubros || []).forEach(sr => {
        (sr.articulos || []).forEach(a => {
          out.push({
            id: getId(a),
            nombre: a.nombre || '',
            categoria: cat.nombre,
            subrubro: sr.nombre,
            precio: a.precio ?? 0,
          });
        });
      });
    });
    return new Map(out.map(a => [a.id, a]));
  }, [todosArticulos]);

  /* ================= filtrado por búsqueda ================= */
  const arbolCategorias = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (todosArticulos || [])
      .map(cat => {
        const subrs = (cat.subrubros || [])
          .map(sr => {
            const arts = (sr.articulos || []).filter(a =>
              (a?.nombre || '').toLowerCase().includes(q)
            );
            return { nombre: sr.nombre, articulos: arts };
          })
          .filter(sr => sr.articulos.length > 0);
        return { nombre: cat.nombre, subrubros: subrs };
      })
      .filter(cat => cat.subrubros.length > 0);
  }, [todosArticulos, search]);

  const idsDeSubrubro = (sr) => (sr.articulos || []).map(getId);
  const idsDeCategoria = (cat) => (cat.subrubros || []).flatMap(idsDeSubrubro);

  // Estado de check (ahora NO bloqueamos por estar en otra agrupación)
  const estadoDeIds = (ids) => {
    const marcados = ids.filter(id => seleccionIds.includes(id)).length;
    return {
      checked: ids.length > 0 && marcados === ids.length,
      indeterminate: marcados > 0 && marcados < ids.length,
    };
  };

  // toggles (sin bloqueos)
  const toggleUno = (id) =>
    setSeleccionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSubrubro = (sr) => {
    const ids = idsDeSubrubro(sr);
    setSeleccionIds(prev =>
      ids.some(id => prev.includes(id))
        ? prev.filter(id => !ids.includes(id))
        : [...prev, ...ids.filter(id => !prev.includes(id))]
    );
  };

  const toggleCategoria = (cat) => {
    const ids = idsDeCategoria(cat);
    setSeleccionIds(prev =>
      ids.some(id => prev.includes(id))
        ? prev.filter(id => !ids.includes(id))
        : [...prev, ...ids.filter(id => !prev.includes(id))]
    );
  };

  /* ===================== Crear o MOVER agrupación ===================== */
  const crearAgrupacion = async () => {
    const nombre = nombreAgr.trim();
    if (!nombre || seleccionIds.length === 0 || submitting) return;
    try {
      setSubmitting(true);
      // Ligero: mandamos solo IDs (el backend ya hace merge/move)
      await httpBiz('/agrupaciones/create-or-move', {
        method: 'POST',
        body: { nombre: nombreAgr.trim(), ids: seleccionIds }
      });
      notify?.(`“${nombre}” lista. Se movieron ${seleccionIds.length} artículo(s).`, 'success');
      onRefetch?.();   // refetch de agrupaciones  tabla
      onClose?.();     // cerramos modal
    } catch (e) {
      console.error('create-or-move error', e);
      const msg = e?.response?.data?.error || e.message || 'No se pudo crear/mover';
      notify?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Crear nueva agrupación</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <TextField
              label="Nombre de la agrupación"
              value={nombreAgr}
              onChange={e => setNombreAgr(e.target.value)}
            />
            <TextField
              label="Buscar artículos"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
            />
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : (
            <Box sx={{ maxHeight: '50vh', overflowY: 'auto', pr: 1 }}>
              {arbolCategorias.map((cat, iCat) => {
                const catIds = idsDeCategoria(cat);
                const estCat = estadoDeIds(catIds);

                return (
                  <Accordion key={`cat-${iCat}`} sx={{ mb: 1 }}>
                    <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                      <Checkbox
                        checked={estCat.checked}
                        indeterminate={estCat.indeterminate}
                        onChange={() => toggleCategoria(cat)}
                        sx={{ mr: 1 }}
                      />
                      <Typography fontWeight="bold">{cat.nombre}</Typography>
                    </AccordionSummary>

                    <AccordionDetails>
                      {cat.subrubros.map((sr, iSr) => {
                        const srIds = idsDeSubrubro(sr);
                        const estSr = estadoDeIds(srIds);

                        return (
                          <Accordion key={`sr-${iCat}-${iSr}`} sx={{ mb: 1 }}>
                            <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                              <Checkbox
                                checked={estSr.checked}
                                indeterminate={estSr.indeterminate}
                                onChange={() => toggleSubrubro(sr)}
                                sx={{ mr: 1 }}
                              />
                              <Typography>{sr.nombre}</Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                              {sr.articulos.map(a => {
                                const id = getId(a);
                                const sel = seleccionIds.includes(id);
                                return (
                                  <Box key={id} display="flex" alignItems="center" sx={{ pl: 2, mb: .5 }}>
                                    <Checkbox
                                      checked={sel}
                                      onChange={() => toggleUno(id)}
                                      sx={{ mr: 1 }}
                                    />
                                    <Typography>#{id} — {a.nombre}</Typography>
                                  </Box>
                                );
                              })}
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}

          <Divider />
          <Typography variant="body2">
            Seleccionados: <b>{seleccionIds.length}</b>
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button
          onClick={crearAgrupacion}
          variant="contained"
          disabled={!nombreAgr.trim() || seleccionIds.length === 0 || submitting}
        >
          Crear agrupación
          {submitting ? 'Procesando…' : 'Crear agrupación'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
