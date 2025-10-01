// src/componentes/ModalSeleccionArticulos.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Button, TextField, Typography, Divider,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);

function buildTreeFromDB(items = []) {
  const flat = items.map(row => {
    const raw = row?.raw || {};
    const id  = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
    return {
      id,
      nombre   : String(row?.nombre    ?? raw?.nombre    ?? raw?.descripcion ?? `#${id}`).trim(),
      categoria: String(row?.categoria ?? raw?.categoria ?? raw?.rubro       ?? 'Sin categoría').trim() || 'Sin categoría',
      subrubro : String(row?.subrubro  ?? raw?.subrubro  ?? raw?.subRubro    ?? 'Sin subrubro').trim()  || 'Sin subrubro',
      precio   : Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
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

export default function ModalSeleccionArticulos({
  open,
  onClose,
  title = 'Crear agrupación y mover',
  preselectIds = [],
  assignedIds = [],      // opcional: ids ya ocupados (para deshabilitar si quisieras)
  notify,
  onSubmit,              // ( { nombre, ids } ) => Promise<void>
}) {
  const [loading, setLoading] = useState(false);
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
        setTodosArticulos(buildTreeFromDB(items));
      } catch (e) {
        console.error('ModalSeleccionArticulos: cargar catálogo BD', e);
        notify?.('No se pudo cargar el catálogo desde la base', 'error');
        setTodosArticulos([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  const estadoDeIds = (ids) => {
    const marcados = ids.filter(id => seleccionIds.includes(id)).length;
    return {
      checked: ids.length > 0 && marcados === ids.length,
      indeterminate: marcados > 0 && marcados < ids.length,
    };
  };

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

  const confirmar = async () => {
    const nombre = nombreAgr.trim();
    if (!nombre || seleccionIds.length === 0) return;
    try {
      await onSubmit?.({ nombre, ids: seleccionIds });
      onClose?.();
    } catch (e) {
      console.error('ModalSeleccionArticulos onSubmit Error:', e);
      notify?.('No se pudo completar la operación', 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>

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
                      {(cat.subrubros || []).map((sr, iSr) => {
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
                                const disabled = Array.isArray(assignedIds) && assignedIds.includes(id);
                                return (
                                  <Box key={id} display="flex" alignItems="center" sx={{ pl: 2, mb: .5, opacity: disabled ? .5 : 1 }}>
                                    <Checkbox
                                      checked={sel}
                                      onChange={() => !disabled && toggleUno(id)}
                                      sx={{ mr: 1 }}
                                      disabled={disabled}
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={confirmar}
          variant="contained"
          disabled={!nombreAgr.trim() || seleccionIds.length === 0}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
