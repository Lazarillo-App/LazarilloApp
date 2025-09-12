import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Button, TextField, Typography, Divider,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { BASE } from '../servicios/apiBase';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN';
};

// ✅ árbol desde filas planas de BD (con fallback a row.data)
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

export default function GestorAgrupacionesModal({
  open,
  onClose,
  preselectIds = [],
  agrupaciones = [],
  todoGroupId,
  notify,
  onRefetch,
}) {
  const [loading, setLoading] = useState(false);
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [search, setSearch] = useState('');
  const [seleccionIds, setSeleccionIds] = useState(preselectIds.map(Number));
  const [nombreAgr, setNombreAgr] = useState('');

  // cargar catálogo al abrir — **desde BD**
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

  // maestro (id -> datos) para el payload de creación
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

  // artículos ya asignados a alguna agrupación real → para bloquear duplicados
  const destinos = useMemo(
    () => (agrupaciones || []).filter(g => !esTodoGroup(g, todoGroupId)),
    [agrupaciones, todoGroupId]
  );
  const assignedIds = useMemo(() => {
    const s = new Set();
    destinos.forEach(g => (g.articulos || []).forEach(a => s.add(getId(a))));
    return s;
  }, [destinos]);
  const isBloqueado = (id) => assignedIds.has(Number(id));

  /* ===================== Árbol filtrado por búsqueda ===================== */
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

  const idsVisibles = useMemo(() => {
    const set = new Set();
    arbolCategorias.forEach(cat => {
      cat.subrubros.forEach(sr => idsDeSubrubro(sr).forEach(id => set.add(id)));
    });
    return set;
  }, [arbolCategorias]);

  const totalSeleccionablesVisibles = useMemo(() => {
    let n = 0;
    idsVisibles.forEach(id => { if (!isBloqueado(id)) n += 1; });
    return n;
  }, [idsVisibles, assignedIds]);

  const estadoDeIds = (ids) => {
    const disponibles = ids.filter(id => !isBloqueado(id));
    const marcados = disponibles.filter(id => seleccionIds.includes(id)).length;
    return {
      checked: disponibles.length > 0 && marcados === disponibles.length,
      indeterminate: marcados > 0 && marcados < disponibles.length,
    };
  };

  // toggles
  const toggleUno = (id) => {
    if (isBloqueado(id)) return;
    setSeleccionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSubrubro = (sr) => {
    const disponibles = idsDeSubrubro(sr).filter(id => !isBloqueado(id));
    setSeleccionIds(prev =>
      disponibles.some(id => prev.includes(id))
        ? prev.filter(id => !disponibles.includes(id))
        : [...prev, ...disponibles.filter(id => !prev.includes(id))]
    );
  };
  const toggleCategoria = (cat) => {
    const disponibles = idsDeCategoria(cat).filter(id => !isBloqueado(id));
    setSeleccionIds(prev =>
      disponibles.some(id => prev.includes(id))
        ? prev.filter(id => !disponibles.includes(id))
        : [...prev, ...disponibles.filter(id => !prev.includes(id))]
    );
  };
  const seleccionarTodoVisible = () => {
    const all = Array.from(idsVisibles).filter(id => !isBloqueado(id));
    setSeleccionIds(all);
  };

  /* ===================== Crear agrupación ===================== */
  const crearAgrupacion = async () => {
    if (!nombreAgr.trim() || seleccionIds.length === 0) return;
    try {
      const payload = seleccionIds.map(id => {
        const a = maestro.get(id) || {};
        return {
          id,
          nombre: a.nombre || '',
          categoria: a.categoria || 'Sin categoría',
          subrubro: a.subrubro || 'Sin subrubro',
          precio: a.precio ?? 0
        };
      });

      await axios.post(`${BASE}/agrupaciones`, {
        nombre: nombreAgr.trim(),
        articulos: payload
      });

      notify?.(`Agrupación “${nombreAgr.trim()}” creada con ${seleccionIds.length} artículo(s).`, 'success');
      onRefetch?.();
      onClose?.();
    } catch (e) {
      console.error('crearAgrupacion error', e);
      notify?.('No se pudo crear la agrupación', 'error');
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
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Buscar artículos"
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={seleccionarTodoVisible}
                disabled={totalSeleccionablesVisibles === 0}
              >
                Seleccionar todo ({totalSeleccionablesVisibles})
              </Button>
            </Stack>
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
                                const bloqueado = isBloqueado(id);
                                const sel = seleccionIds.includes(id);
                                return (
                                  <Box
                                    key={id}
                                    display="flex"
                                    alignItems="center"
                                    sx={{ pl: 2, opacity: bloqueado ? 0.5 : 1, mb: .5 }}
                                  >
                                    <Checkbox
                                      checked={sel}
                                      onChange={() => toggleUno(id)}
                                      disabled={bloqueado}
                                      sx={{ mr: 1 }}
                                    />
                                    <Typography>
                                      #{id} — {a.nombre} {bloqueado && '(ya en otra agrupación)'}
                                    </Typography>
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
          disabled={!nombreAgr.trim() || seleccionIds.length === 0}
        >
          Crear agrupación
        </Button>
      </DialogActions>
    </Dialog>
  );
}
