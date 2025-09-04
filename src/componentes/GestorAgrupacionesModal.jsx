import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Button, TextField, Typography, Divider,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import axios from 'axios';
import { BASE } from '../servicios/apiBase';

const getId = (x) => Number(x?.id ?? x?.articuloId ?? x?.codigo ?? x?.codigoArticulo);
const esTodoGroup = (g, todoGroupId) => {
  const n = String(g?.nombre || '').trim().toUpperCase();
  return g?.id === todoGroupId || n === 'TODO' || n === 'SIN AGRUPACIÓN';
};

export default function GestorAgrupacionesModal({
  open,
  onClose,
  preselectIds = [],          // ids preseleccionados (opcional)
  agrupaciones = [],          // todas las agrupaciones actuales (para bloquear duplicados)
  todoGroupId,
  notify,                     // (msg, type)
  onRefetch,                  // refrescar listado después de crear
}) {
  // estado y catálogo
  const [loading, setLoading] = useState(false);
  const [todosArticulos, setTodosArticulos] = useState([]);
  const [search, setSearch] = useState('');
  const [seleccionIds, setSeleccionIds] = useState(preselectIds.map(Number));
  const [nombreAgr, setNombreAgr] = useState('');

  // cargar catálogo al abrir
  useEffect(() => {
    if (!open) return;
    setSeleccionIds(preselectIds.map(Number));
    setNombreAgr('');
    setSearch('');
    (async () => {
      try {
        setLoading(true);
        const token = await obtenerToken();
        const data = await obtenerArticulos(token);
        setTodosArticulos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('CrearAgrupacionModal: cargar catálogo', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // maestro (id -> datos) para el payload
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

  // artículos ya asignados a alguna agrupación real (no TODO/Sin Agrupación) -> para no duplicar
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

  /* ===================== Árbol 3 niveles ===================== */
  // Estructura: [{ nombre: categoria, subrubros: [{ nombre, articulos: [...] }] }]
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

  /* ===================== Acción: crear ===================== */
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
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
