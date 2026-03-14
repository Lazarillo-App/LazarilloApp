/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/componentes/AgrupacionesList.jsx
import React, { useMemo, useState, useCallback } from "react";
import { showAlert } from '../servicios/appAlert';
import {
  Box, Card, CardContent, CardActions, Accordion, AccordionSummary, AccordionDetails,
  Typography, IconButton, TextField, Button, Checkbox, FormControl, InputLabel,
  Select, MenuItem, Tooltip, Divider, Stack
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import { emitGroupsChanged } from "@/utils/groupsBus";
import {
  actualizarAgrupacion,
  eliminarAgrupacion,
  eliminarArticuloDeAgrupacion as quitarArticulo,
} from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";
import AgrupacionCreateModal from "./AgrupacionCreateModal";

const LAYOUT_KEY = 'lazarillo:agrupLayoutByGroup';

const loadLayoutPrefs = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveLayoutPrefs = (prefs) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(prefs));
  } catch { }
};

// normaliza para agrupar sin importar acentos / mayúsculas
const normKey = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// "rubro base": parte antes del primer guion
// "Pasteleria - PANADERIA"  -> "Pasteleria"
const getRubroBase = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return 'Sin rubro';
  const first = raw.split('-')[0].trim();
  return first || raw;
};

// detecta si este grupo SIGUE siendo el TODO virtual
const isRealTodoGroup = (g, todoGroupId) => {
  if (!g) return false;
  if (!Number.isFinite(Number(todoGroupId))) return false;
  return Number(g.id) === Number(todoGroupId);
};

const esNombreReservadoTodo = (nombre) => {
  const n = normKey(nombre);
  // normKey ya elimina tilde, así que "sin agrupación" también cae acá
  return n === 'todo' || n === 'sin agrupacion';
};

const isDiscontinuadosGroup = (g) => {
  const n = normKey(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

// helper puro (sin hooks) para agrupar según layout
// layout: 'sub-cat' (actual) | 'rubro-base' (une Pasteleria - ...)
function groupItemsByLayout(items = [], layout = 'sub-cat') {
  // ⭐ layout "rubro-base": un solo bloque por rubro base (Pasteleria)
  if (layout === 'rubro-base') {
    const byRubro = new Map(); // key normalizada -> { rubroLabel, categorias }

    items.forEach((a) => {
      const sub = String(a?.subrubro || 'Sin subrubro');   // ej: "Pasteleria - PANADERIA"
      const rubroBase = getRubroBase(sub); // "Pasteleria"
      const key = normKey(rubroBase);

      if (!byRubro.has(key)) {
        byRubro.set(key, {
          subrubro: rubroBase,
          categorias: [],
        });
      }
      const entry = byRubro.get(key);

      if (entry.categorias.length === 0) {
        entry.categorias.push({ categoria: rubroBase, articulos: [] });
      }
      entry.categorias[0].articulos.push(a);
    });

    const out = Array.from(byRubro.values());
    out.forEach((sub) => {
      sub.categorias[0].articulos.sort((x, y) =>
        String(x?.nombre || '').localeCompare(String(y?.nombre || ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        })
      );
    });
    out.sort((a, b) =>
      String(a.subrubro).localeCompare(String(b.subrubro), 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    );
    return out;
  }

  // ⭐ layout "sub-cat": Subrubro -> Categoría
  const bySub = new Map(); // subrubro -> (categoria -> artículos[])
  items.forEach((a) => {
    const sub = String(a?.subrubro || 'Sin subrubro');
    const cat = String(a?.categoria || 'Sin categoría');
    if (!bySub.has(sub)) bySub.set(sub, new Map());
    const byCat = bySub.get(sub);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(a);
  });

  const out = [];
  for (const [subrubro, byCat] of bySub.entries()) {
    const categorias = [];
    for (const [categoria, articulos] of byCat.entries()) {
      articulos.sort((x, y) =>
        String(x?.nombre || '').localeCompare(String(y?.nombre || ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        })
      );
      categorias.push({ categoria, articulos });
    }
    categorias.sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), 'es', {
        sensitivity: 'base',
        numeric: true,
      })
    );
    out.push({ subrubro, categorias });
  }
  out.sort((a, b) =>
    String(a.subrubro).localeCompare(String(b.subrubro), 'es', {
      sensitivity: 'base',
      numeric: true,
    })
  );
  return out;
}

const AgrupacionesList = ({
  onMutateGroups,
  agrupaciones = [],
  onActualizar,
  todoGroupId,
  todosArticulos = [],
  loading = false,
  favoriteGroupId,
  onSetFavorite,
  todoVirtualArticulos = [],
  notify,
  businessId,
}) => {

  // edición de nombre por grupo
  const [editing, setEditing] = useState({}); // { [groupId]: true }
  const [nameDraft, setNameDraft] = useState({}); // { [groupId]: 'nuevo nombre' }

  // selección de artículos por grupo para mover
  const [selectedByGroup, setSelectedByGroup] = useState({}); // { [groupId]: Set<number> }
  const [targetByGroup, setTargetByGroup] = useState({}); // { [groupId]: targetId }

  // modal de "agregar artículos" (append)
  const [appendForGroup, setAppendForGroup] = useState(null); // { id, nombre } | null

  const groupsSorted = useMemo(
    () => [...(agrupaciones || [])].sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''))),
    [agrupaciones]
  );

  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = useCallback((id, isOpen) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (isOpen) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  // layout por agrupación: 'sub-cat' | 'rubro-base'
  const [layoutByGroup, setLayoutByGroup] = useState(() => loadLayoutPrefs());

  const setLayoutForGroup = useCallback((groupId, layout) => {
    setLayoutByGroup((prev) => {
      const next = { ...prev, [groupId]: layout };
      saveLayoutPrefs(next);
      return next;
    });
  }, []);

  // helper para evitar que clicks en botones/textfields abran/cierren el acordeón
  const stop = useCallback((e) => { e.stopPropagation(); }, []);

  const showMsg = useCallback((msg, type = 'info') => {
    if (typeof notify === 'function') {
      notify(msg, type);
    } else {
      showAlert(msg, type);
    }
  }, [notify]);

  const startEdit = (g) => {
    setEditing((s) => ({ ...s, [g.id]: true }));
    setNameDraft((s) => ({ ...s, [g.id]: g.nombre || "" }));
  };

  const saveName = async (g) => {
    const nuevo = String(nameDraft[g.id] ?? "").trim();
    if (!nuevo || nuevo === g.nombre) {
      setEditing((s) => ({ ...s, [g.id]: false }));
      return;
    }

    const isTodo = isRealTodoGroup(g, todoGroupId);

    // ✅ Si NO es el grupo TODO, no dejamos usar nombres reservados
    if (!isTodo && esNombreReservadoTodo(nuevo)) {
      showMsg('Ese nombre está reservado para el grupo "Sin agrupación".', 'warning');
      return;
    }

    const baseArticulos = isTodo
      ? (todoVirtualArticulos || [])
      : (g.articulos || []);

    // Mutación optimista
    onMutateGroups?.({
      type: 'create',
      id: g.id,
      nombre: nuevo,
      articulos: baseArticulos,
    });

    const payload = isTodo
      ? { nombre: nuevo, articulos: baseArticulos }
      : { nombre: nuevo };

    try {
      await actualizarAgrupacion(g.id, payload);
      emitGroupsChanged("rename", { groupId: g.id });
      setEditing((s) => ({ ...s, [g.id]: false }));
      onActualizar?.();
      showMsg('Nombre de agrupación actualizado.', 'success');
    } catch (err) {
      console.error('ERROR_UPDATE_GROUP_NAME', err);
      showMsg('No se pudo actualizar el nombre de la agrupación.', 'error');
      setEditing((s) => ({ ...s, [g.id]: false }));
      setNameDraft((s) => ({ ...s, [g.id]: g.nombre || "" }));
    }
  };

  const removeGroup = async (g) => {
    if (!g?.id) return;

    // NO borrar TODO ni Discontinuados
    if (isRealTodoGroup(g, todoGroupId) || isDiscontinuadosGroup(g)) return;

    if (!window.confirm(`Eliminar la agrupación "${g.nombre}"?`)) return;

    try {
      // ✅ antes funcionaba así: eliminarAgrupacion(group)
      await eliminarAgrupacion(g);
      emitGroupsChanged("delete", { groupId: g.id });
      onActualizar?.();
      showMsg('Agrupación eliminada.', 'success');
    } catch (e) {
      console.error('ERROR_DELETE_GROUP', e);
      showMsg('No se pudo eliminar la agrupación.', 'error');
    }
  };

  const toggleArticle = (groupId, artId) => {
    setSelectedByGroup((prev) => {
      const set = new Set(prev[groupId] || []);
      set.has(artId) ? set.delete(artId) : set.add(artId);
      return { ...prev, [groupId]: set };
    });
  };

  const selectAllInGroup = (g) => {
    const itemsForGroup = isRealTodoGroup(g, todoGroupId) ? (todoVirtualArticulos || []) : (g.articulos || []);
    const allIds = itemsForGroup.map((a) => Number(a.id)).filter(Boolean);

    setSelectedByGroup((prev) => {
      const cur = prev[g.id] || new Set();
      const every = allIds.every((id) => cur.has(id));
      return { ...prev, [g.id]: new Set(every ? [] : allIds) };
    });
  };

  const removeOne = async (groupId, articuloId, isTodo) => {
    if (isTodo) return;

    onMutateGroups?.({ type: 'remove', groupId, ids: [articuloId] });

    try {
      // ✅ antes funcionaba así: quitarArticulo(groupId, articuloId)
      await quitarArticulo(groupId, articuloId);
      emitGroupsChanged("remove", { groupId, ids: [articuloId] });
    } catch (e) {
      console.error('REMOVE_ONE_FAIL', e);
      showMsg('No se pudo quitar el artículo.', 'error');
    }

    setSelectedByGroup(prev => {
      const set = new Set(prev[groupId] || []);
      set.delete(Number(articuloId));
      return { ...prev, [groupId]: set };
    });
  };

  const moveSelected = async (fromId, isTodo) => {
    if (isTodo) return;

    const ids = Array.from(selectedByGroup[fromId] || []);
    const toId = Number(targetByGroup[fromId]);
    if (!ids.length || !Number.isFinite(toId) || toId === fromId) return;

    onMutateGroups?.({ type: 'move', fromId, toId, ids, baseById: null });

    try {
      await httpBiz(`/agrupaciones/${fromId}/move-items`, {
        method: 'POST',
        body: { toId, ids }
      });
      emitGroupsChanged("move", { fromId, toId, ids });
      showMsg(`Movidos ${ids.length} artículo(s).`, 'success');
    } catch (e) {
      console.error('MOVE_SELECTED_FAIL', e);
      showMsg('No se pudo mover.', 'error');
    }

    setSelectedByGroup((s) => ({ ...s, [fromId]: new Set() }));
  };

  // 🔒 Bloqueo para "Agregar": bloquea artículos asignados a cualquier agrupación, excepto TODO.
  const isArticuloBloqueadoForAppend = useMemo(() => {
    const assigned = new Set();
    (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => !isRealTodoGroup(g, todoGroupId))
      .forEach(g => {
        const arts = Array.isArray(g?.articulos) ? g.articulos : [];
        arts.filter(Boolean).forEach(a => {
          const id = Number(a?.id);
          if (Number.isFinite(id)) assigned.add(String(id));
        });
      });
    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones, todoGroupId]);

  return (
    <>
      {appendForGroup && (
        <AgrupacionCreateModal
          open
          onClose={() => setAppendForGroup(null)}
          mode="append"
          groupId={appendForGroup.id}
          groupName={appendForGroup.nombre || ''}
          todosArticulos={todosArticulos || []}
          loading={!!loading}
          isArticuloBloqueado={isArticuloBloqueadoForAppend}
          onAppended={async (groupId, _n, articulos) => {
            onMutateGroups?.({ type: 'append', groupId, articulos, baseById: null });
            setAppendForGroup(null);
            await onActualizar?.();
          }}
          saveButtonLabel="Agregar a la agrupación"
        />
      )}

      <Stack spacing={2} sx={{ mt: 3 }}>
        {groupsSorted.map((g) => {
          const isTodo = isRealTodoGroup(g, todoGroupId);
          const selected = selectedByGroup[g.id] || new Set();
          const itemsForGroup = isTodo ? (todoVirtualArticulos || []) : (g.articulos || []);
          const isOpen = expanded.has(g.id);

          const allIds = itemsForGroup.map((a) => Number(a.id)).filter(Boolean);
          const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
          const someChecked = allIds.some((id) => selected.has(id)) && !allChecked;

          const layout = layoutByGroup[g.id] || 'sub-cat';
          const grouped = isOpen ? groupItemsByLayout(itemsForGroup, layout) : [];

          return (
            <Accordion
              key={g.id}
              disableGutters
              expanded={isOpen}
              onChange={(_, open) => toggleExpanded(g.id, open)}
              TransitionProps={{ unmountOnExit: true }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" gap={2} flexWrap="wrap">
                  <Box display="flex" alignItems="center" gap={1}>
                    {!editing[g.id] ? (
                      <Typography variant="h6" sx={{ mr: 1 }}>
                        {g.nombre}
                      </Typography>
                    ) : (
                      <TextField
                        size="small"
                        value={nameDraft[g.id] ?? ""}
                        onChange={(e) => setNameDraft((s) => ({ ...s, [g.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveName(g)}
                        onClick={stop}
                        onMouseDown={stop}
                        onFocus={stop}
                      />
                    )}
                  </Box>

                  <Box>
                    {!editing[g.id] ? (
                      <>
                        {!isDiscontinuadosGroup(g) && (
                          <Tooltip title={isTodo ? "Renombrar grupo automático de sobrantes" : "Renombrar"}>
                            <span>
                              <IconButton onClick={(e) => { stop(e); startEdit(g); }}>
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}

                        <Tooltip
                          title={isTodo
                            ? "No se agregan artículos directamente en este grupo"
                            : "Agregar artículos"}
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={(e) => { stop(e); !isTodo && setAppendForGroup({ id: g.id, nombre: g.nombre }); }}
                              disabled={isTodo}
                              sx={{ ml: 1, textTransform: "none" }}
                            >
                              Agregar
                            </Button>
                          </span>
                        </Tooltip>

                        {!isTodo && !isDiscontinuadosGroup(g) && (
                          <Tooltip title="Eliminar agrupación">
                            <span>
                              <IconButton
                                color="error"
                                onClick={(e) => { stop(e); removeGroup(g); }}
                                sx={{ ml: 0.5 }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}

                        <IconButton
                          size="small"
                          onClick={(e) => { stop(e); onSetFavorite?.(g.id); }}
                          title={Number(favoriteGroupId) === Number(g.id)
                            ? 'Quitar como favorita'
                            : 'Marcar como favorita'}
                          sx={{ mr: 1 }}
                        >
                          {Number(favoriteGroupId) === Number(g.id)
                            ? <StarIcon color="warning" />
                            : <StarBorderIcon />}
                        </IconButton>
                      </>
                    ) : (
                      <IconButton color="primary" onClick={(e) => { stop(e); saveName(g); }}>
                        <SaveIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <Card variant="outlined">
                  <CardContent>
                    <Divider sx={{ mb: 1.5 }} />

                    <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
                      <Typography variant="caption" sx={{ mr: 1 }}>
                        Vista:
                      </Typography>
                      <Select
                        size="small"
                        value={layout}
                        onChange={(e) => setLayoutForGroup(g.id, e.target.value)}
                        sx={{ minWidth: 210 }}
                      >
                        <MenuItem value="sub-cat">Subrubro → Categoría</MenuItem>
                        <MenuItem value="rubro-base">Rubro unificado</MenuItem>
                      </Select>
                    </Box>

                    {isTodo && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Esta agrupación es <strong>virtual</strong>: muestra todos los artículos que aún no pertenecen a ninguna agrupación.
                      </Typography>
                    )}

                    <Box display="flex" alignItems="center" mb={1}>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => selectAllInGroup(g)}
                        disabled={isTodo}
                      />
                      <Typography variant="body2">Seleccionar todos</Typography>
                    </Box>

                    <Stack spacing={1.5}>
                      {grouped.map((sub) => (
                        <Box key={`sub-${sub.subrubro}`}>
                          <Divider sx={{ mb: 1 }} />

                          {sub.categorias.map((cat) => {
                            const label =
                              layout === 'rubro-base'
                                ? sub.subrubro
                                : `${cat.categoria} - ${sub.subrubro}`;

                            return (
                              <Box
                                key={`cat-${sub.subrubro}-${cat.categoria}`}
                                sx={{ ml: 1.5, mb: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}
                                  title={label}
                                >
                                  {label}
                                </Typography>

                                <Stack spacing={0.5}>
                                  {cat.articulos.map((a) => {
                                    const checked = selected.has(Number(a.id));
                                    return (
                                      <Box
                                        key={a.id}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                          px: 1,
                                          py: 0.5,
                                          borderRadius: 1,
                                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.03)' },
                                        }}
                                      >
                                        <Box display="flex" alignItems="center" gap={1}>
                                          <Checkbox
                                            size="small"
                                            checked={checked}
                                            onChange={() => toggleArticle(g.id, Number(a.id))}
                                            disabled={isTodo}
                                          />
                                          <Typography variant="body2" noWrap title={a?.nombre}>
                                            {a.nombre}{' '}
                                            <Typography component="span" variant="caption" color="text.secondary">
                                              #{a.id}
                                            </Typography>
                                          </Typography>
                                        </Box>

                                        <Tooltip
                                          title={isTodo ? 'No se pueden quitar artículos desde este grupo automático' : 'Quitar del grupo'}
                                        >
                                          <span>
                                            <Button
                                              size="small"
                                              color="error"
                                              variant="text"
                                              onClick={() => removeOne(g.id, Number(a.id), isTodo)}
                                              disabled={isTodo}
                                            >
                                              Quitar
                                            </Button>
                                          </span>
                                        </Tooltip>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            );
                          })}
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1, px: 2, pb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 220 }} disabled={isTodo}>
                      <InputLabel>Mover seleccionados a…</InputLabel>
                      <Select
                        label="Mover seleccionados a…"
                        value={targetByGroup[g.id] ?? ""}
                        onChange={(e) => setTargetByGroup((s) => ({ ...s, [g.id]: e.target.value }))}
                      >
                        {groupsSorted
                          .filter((x) => x.id !== g.id)
                          .map((x) => (
                            <MenuItem key={x.id} value={x.id}>
                              {x.nombre}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    <Button
                      size="small"
                      variant="contained"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => moveSelected(g.id, isTodo)}
                      disabled={
                        isTodo ||
                        !(selectedByGroup[g.id]?.size) ||
                        !Number.isFinite(Number(targetByGroup[g.id]))
                      }
                      sx={{ textTransform: "none" }}
                    >
                      Mover
                    </Button>
                  </CardActions>
                </Card>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </>
  );
};

export default AgrupacionesList;