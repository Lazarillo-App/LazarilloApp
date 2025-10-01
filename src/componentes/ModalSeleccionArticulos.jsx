// src/componentes/ModalSeleccionArticulos.jsx
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Button, TextField, Typography, Divider,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BusinessesAPI } from '../servicios/apiBusinesses';

// ===== helpers (idénticos a los que te funcionan) =====
const mapRowToArticle = (row) => {
  const raw = row?.raw || {};
  const id  = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
  return {
    id,
    nombre   : row?.nombre    ?? raw?.nombre    ?? raw?.descripcion ?? `#${id}`,
    categoria: row?.categoria ?? raw?.categoria ?? raw?.rubro       ?? 'Sin categoría',
    subrubro : row?.subrubro  ?? raw?.subrubro  ?? raw?.subRubro    ?? 'Sin subrubro',
    precio   : Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
  };
};

const buildTree = (flatList = []) => {
  const cats = new Map();
  for (const a of flatList) {
    if (!Number.isFinite(a.id)) continue;
    const cat = a.categoria || 'Sin categoría';
    const sr  = a.subrubro  || 'Sin subrubro';
    if (!cats.has(cat)) cats.set(cat, { id: cat, nombre: cat, subrubros: [] });
    const catObj = cats.get(cat);
    let srObj = catObj.subrubros.find(s => s.nombre === sr);
    if (!srObj) { srObj = { nombre: sr, articulos: [] }; catObj.subrubros.push(srObj); }
    srObj.articulos.push({
      id: a.id,
      nombre: a.nombre,
      categoria: cat,
      subrubro: sr,
      precio: a.precio
    });
  }
  return Array.from(cats.values());
};

const evaluarCheckboxEstado = (articulos, seleccionIds, isBloq) => {
  const disponibles = articulos.filter(a => !isBloq(a.id));
  const total = disponibles.length;
  const seleccionados = disponibles.filter(a => seleccionIds.includes(Number(a.id))).length;
  return {
    checked: total > 0 && seleccionados === total,
    indeterminate: seleccionados > 0 && seleccionados < total
  };
};

// =======================================================

export default function ModalSeleccionArticulos({
  open,
  onClose,
  title = 'Seleccionar artículos',
  preselectIds = [],
  assignedIds = [],
  notify,
  onSubmit, // ({nombre, ids}) => Promise
}) {
  const [loading, setLoading] = React.useState(false);
  const [nombreAgr, setNombreAgr] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [tree, setTree] = React.useState([]); // categoría → subrubro → artículos
  const [seleccionIds, setSeleccionIds] = React.useState(preselectIds.map(Number));
  const [submitting, setSubmitting] = React.useState(false);

  const assignedSet = React.useMemo(() => {
    if (assignedIds instanceof Set) return assignedIds;
    return new Set((Array.isArray(assignedIds) ? assignedIds : []).map(Number));
  }, [assignedIds]);

  const isArticuloBloqueado = React.useCallback((id) => assignedSet.has(Number(id)), [assignedSet]);

  React.useEffect(() => {
    if (!open) return;
    setSeleccionIds(preselectIds.map(Number));
    setNombreAgr('');
    setSearch('');

    (async () => {
      try {
        setLoading(true);
        const bizId = localStorage.getItem('activeBusinessId');
        if (!bizId) throw new Error('No hay negocio activo');
        const res = await BusinessesAPI.articlesFromDB(bizId);
        const flat = (res?.items || []).map(mapRowToArticle).filter(a => Number.isFinite(a.id));
        setTree(buildTree(flat));
      } catch (e) {
        console.error('ModalSeleccionArticulos: cargar catálogo', e);
        notify?.('No se pudo cargar el catálogo desde la base', 'error');
        setTree([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // maestro (id -> datos) por si querés enriquecer payload más adelante
  const maestro = React.useMemo(() => {
    const out = [];
    (tree || []).forEach(cat => {
      (cat.subrubros || []).forEach(sr => {
        (sr.articulos || []).forEach(a => {
          out.push({
            id: Number(a.id),
            nombre: a.nombre || '',
            categoria: cat.nombre,
            subrubro: sr.nombre,
            precio: a.precio ?? 0,
          });
        });
      });
    });
    return new Map(out.map(a => [a.id, a]));
  }, [tree]);

  // Búsqueda
  const arbolFiltrado = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tree;
    return (tree || [])
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
  }, [tree, search]);

  const idsDeSubrubro = (sr) => (sr.articulos || []).map(a => Number(a.id));
  const idsDeCategoria = (cat) => (cat.subrubros || []).flatMap(idsDeSubrubro);

  // toggles
  const toggleUno = (id) =>
    !isArticuloBloqueado(id) &&
    setSeleccionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSubrubro = (sr) => {
    const ids = idsDeSubrubro(sr).filter(id => !isArticuloBloqueado(id));
    setSeleccionIds(prev =>
      ids.some(id => prev.includes(id))
        ? prev.filter(id => !ids.includes(id))
        : [...prev, ...ids.filter(id => !prev.includes(id))]
    );
  };

  const toggleCategoria = (cat) => {
    const ids = idsDeCategoria(cat).filter(id => !isArticuloBloqueado(id));
    setSeleccionIds(prev =>
      ids.some(id => prev.includes(id))
        ? prev.filter(id => !ids.includes(id))
        : [...prev, ...ids.filter(id => !prev.includes(id))]
    );
  };

  const handleSubmit = async () => {
    const nombre = nombreAgr.trim();
    if (!nombre || seleccionIds.length === 0 || submitting) {
      notify?.('Ingresá un nombre y elegí al menos un artículo', 'warning');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit?.({ nombre, ids: seleccionIds, maestro });
      notify?.(`“${nombre}” lista. ${seleccionIds.length} artículo(s).`, 'success');
      onClose?.();
    } catch (e) {
      console.error('ModalSeleccionArticulos onSubmit', e);
      const msg = e?.response?.data?.error || e.message || 'No se pudo completar la operación';
      notify?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <TextField
              label="Nombre de la agrupación"
              value={nombreAgr}
              onChange={e => setNombreAgr(e.target.value)}
              autoFocus
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
            <Box sx={{ maxHeight: '55vh', overflowY: 'auto', pr: 1 }}>
              {(arbolFiltrado || []).map((cat, iCat) => {
                const catIds = idsDeCategoria(cat);
                const estCat = evaluarCheckboxEstado(
                  catIds.map(id => ({ id })), seleccionIds, isArticuloBloqueado
                );

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
                        const estSr = evaluarCheckboxEstado(
                          srIds.map(id => ({ id })), seleccionIds, isArticuloBloqueado
                        );

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
                              {(sr.articulos || []).map(a => {
                                const id = Number(a.id);
                                const sel = seleccionIds.includes(id);
                                const bloqueado = isArticuloBloqueado(id);
                                return (
                                  <Box key={id} display="flex" alignItems="center" sx={{ pl: 2, mb: .5, opacity: bloqueado ? 0.5 : 1 }}>
                                    <Checkbox
                                      checked={sel}
                                      onChange={() => toggleUno(id)}
                                      disabled={bloqueado}
                                      sx={{ mr: 1 }}
                                    />
                                    <Typography>#{id} — {a.nombre} {bloqueado && '(ya asignado)'}</Typography>
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
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting || !nombreAgr.trim() || seleccionIds.length === 0}>
          {submitting ? 'Procesando…' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
