/* eslint-disable no-empty */
// src/componentes/AgrupacionesList.jsx
import React, { useMemo, useState } from "react";
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
  quitarArticulo
} from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";
import AgrupacionCreateModal from "./AgrupacionCreateModal";

// 🆕 helper puro (sin hooks) para agrupar y ordenar
function groupBySubrubroCategoria(items = []) {
  const bySub = new Map(); // subrubro -> (categoria -> artículos[])
  items.forEach((a) => {
    const sub = String(a?.subrubro || "Sin subrubro");
    const cat = String(a?.categoria || "Sin categoría");
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
        String(x?.nombre || "").localeCompare(String(y?.nombre || ""), "es", { sensitivity: "base", numeric: true })
      );
      categorias.push({ categoria, articulos });
    }
    categorias.sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), "es", { sensitivity: "base", numeric: true })
    );
    out.push({ subrubro, categorias });
  }
  out.sort((a, b) =>
    String(a.subrubro).localeCompare(String(b.subrubro), "es", { sensitivity: "base", numeric: true })
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
    // mutación local para que el select/tabla se actualicen al instante
    onMutateGroups?.({ type: 'create', id: g.id, nombre: nuevo, articulos: g.articulos || [] });
    await actualizarAgrupacion(g.id, { nombre: nuevo });
    emitGroupsChanged("rename", { groupId: g.id });
    setEditing((s) => ({ ...s, [g.id]: false }));
    onActualizar?.();
  };

  const removeGroup = async (g) => {
    if (g.id === todoGroupId) return; // no borrar TODO
    if (!window.confirm(`Eliminar la agrupación "${g.nombre}"?`)) return;
    await eliminarAgrupacion(g.id);
    emitGroupsChanged("delete", { groupId: g.id });
    onActualizar?.();
  };

  const toggleArticle = (groupId, artId) => {
    setSelectedByGroup((prev) => {
      const set = new Set(prev[groupId] || []);
      set.has(artId) ? set.delete(artId) : set.add(artId);
      return { ...prev, [groupId]: set };
    });
  };

  const selectAllInGroup = (g) => {
    const allIds = (g.articulos || []).map((a) => Number(a.id)).filter(Boolean);
    setSelectedByGroup((prev) => {
      const cur = prev[g.id] || new Set();
      const every = allIds.every((id) => cur.has(id));
      return { ...prev, [g.id]: new Set(every ? [] : allIds) };
    });
  };

  const removeOne = async (groupId, articuloId) => {
    onMutateGroups?.({ type: 'remove', groupId, ids: [articuloId] }); // instantáneo
    try {
      await quitarArticulo(groupId, articuloId);
      emitGroupsChanged("remove", { groupId, ids: [articuloId] });
    } catch {
      // opcional: revertir mutación optimista si quisieras
    }
    setSelectedByGroup(prev => {
      const set = new Set(prev[groupId] || []);
      set.delete(Number(articuloId));
      return { ...prev, [groupId]: set };
    });
  };

  const moveSelected = async (fromId) => {
    const ids = Array.from(selectedByGroup[fromId] || []);
    const toId = Number(targetByGroup[fromId]);
    if (!ids.length || !Number.isFinite(toId) || toId === fromId) return;

    onMutateGroups?.({ type: 'move', fromId, toId, ids, baseById: null });
    try {
      await httpBiz(`/agrupaciones/${fromId}/move-items`, { method: 'POST', body: { toId, ids } });
      emitGroupsChanged("move", { fromId, toId, ids });
    } catch { }
    setSelectedByGroup((s) => ({ ...s, [fromId]: new Set() }));
  };

  // 🔒 Bloqueo para "Agregar": bloquea artículos asignados a cualquier agrupación (incluida la actual), excepto TODO.
  const isArticuloBloqueadoForAppend = useMemo(() => {
    const assigned = new Set();
    (Array.isArray(agrupaciones) ? agrupaciones : [])
      .filter(Boolean)
      .filter(g => g?.id !== todoGroupId)
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
          const isTodo = g.id === todoGroupId;
          const selected = selectedByGroup[g.id] || new Set();
          const itemsForGroup = isTodo ? (todoVirtualArticulos || []) : (g.articulos || []);
          const allIds = itemsForGroup.map((a) => Number(a.id)).filter(Boolean);
          const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
          const someChecked = allIds.some((id) => selected.has(id)) && !allChecked;

          // 🆕 agrupado listo para render
          const grouped = groupBySubrubroCategoria(itemsForGroup);

          return (
            <Accordion key={g.id} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" gap={2} flexWrap="wrap">
                  <Box display="flex" alignItems="center" gap={1}>
                    {!editing[g.id] ? (
                      <>
                        <Typography variant="h6" sx={{ mr: 1 }}>
                          {g.nombre}
                        </Typography>
                      </>
                    ) : (
                      <TextField
                        size="small"
                        value={nameDraft[g.id] ?? ""}
                        onChange={(e) => setNameDraft((s) => ({ ...s, [g.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveName(g)}
                      />
                    )}
                  </Box>

                  <Box>
                    {!editing[g.id] ? (
                      <>
                        <Tooltip title={isTodo ? "No se puede renombrar/borrar Sin Agrupación" : "Renombrar"}>
                          <span>
                            <IconButton onClick={() => startEdit(g)} disabled={isTodo}>
                              <EditIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isTodo ? "No se puede eliminar Sin Agrupación" : "Eliminar"}>
                          <span>
                            <IconButton color="error" onClick={() => removeGroup(g)} disabled={isTodo}>
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isTodo ? "No se agrega en Sin Agrupación" : "Agregar artículos"}>
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => !isTodo && setAppendForGroup({ id: g.id, nombre: g.nombre })}
                              disabled={isTodo}
                              sx={{ ml: 1, textTransform: "none" }}
                            >
                              Agregar
                            </Button>
                          </span>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); onSetFavorite?.(g.id); }}
                          title={
                            Number(favoriteGroupId) === Number(g.id)
                              ? 'Quitar como favorita'
                              : 'Marcar como favorita'
                          }
                          sx={{ mr: 1 }}
                        >
                          {Number(favoriteGroupId) === Number(g.id)
                            ? <StarIcon color="warning" />
                            : <StarBorderIcon />}
                        </IconButton>
                      </>
                    ) : (
                      <IconButton color="primary" onClick={() => saveName(g)}>
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

                    {isTodo && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Esta agrupación es <strong>virtual</strong>: muestra todos los artículos que aún no pertenecen a ninguna agrupación.
                        No admite edición desde aquí.
                      </Typography>
                    )}

                    {/* Selector de todos en el grupo */}
                    <Box display="flex" alignItems="center" mb={1}>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => !isTodo && selectAllInGroup(g)}
                        disabled={isTodo}
                      />
                      <Typography variant="body2">Seleccionar todos</Typography>
                    </Box>

                    {/* 🆕 Lista agrupada: Rubro (subrubro) -> Subrubro/Categoría (categoría) -> artículos */}
                    <Stack spacing={1.5}>
                      {grouped.map((sub) => (
                        <Box key={`sub-${sub.subrubro}`}>
                          {/* Encabezado SUBRubro */}
                          {/* <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".2px", opacity: 0.85, mb: 0.5 }}
                          >
                            {sub.subrubro}
                          </Typography> */}
                           {/* Encabezado Rubro */}
                          {/* <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, color: "text.secondary", mb: 0.5 }}
                            title={cat.categoria}
                          >
                            {cat.categoria}
                          </Typography> */}
                          <Divider sx={{ mb: 1 }} />
                          {sub.categorias.map((cat) => (
                            <Box key={`cat-${sub.subrubro}-${cat.categoria}`} sx={{ ml: 1.5, mb: 1 }}>
                              {/* Encabezado Subrubro/Categoría */}
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600, color: "text.secondary", mb: 0.5 }}
                                title={`${sub.subrubro} - ${cat.categoria}`}
                              >
                                {cat.categoria} - {sub.subrubro}
                              </Typography>

                              {/* Artículos */}
                              <Stack spacing={0.5}>
                                {cat.articulos.map((a) => {
                                  const checked = selected.has(Number(a.id));
                                  return (
                                    <Box
                                      key={a.id}
                                      display="flex"
                                      alignItems="center"
                                      justifyContent="space-between"
                                      sx={{ px: 1, py: 0.5, borderRadius: 1, "&:hover": { backgroundColor: "rgba(0,0,0,0.03)" } }}
                                    >
                                      <Box display="flex" alignItems="center" gap={1}>
                                        <Checkbox
                                          size="small"
                                          checked={checked}
                                          onChange={() => toggleArticle(g.id, Number(a.id))}
                                          disabled={isTodo}
                                        />
                                        <Typography variant="body2" noWrap title={a?.nombre}>
                                          {a.nombre}{" "}
                                          <Typography component="span" variant="caption" color="text.secondary">
                                            #{a.id}
                                          </Typography>
                                        </Typography>
                                      </Box>

                                      <Tooltip title={isTodo ? "No se quita desde Sin Agrupación" : "Quitar del grupo"}>
                                        <span>
                                          <Button
                                            size="small"
                                            color="error"
                                            variant="text"
                                            onClick={() => removeOne(g.id, Number(a.id))}
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
                          ))}
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>

                  {/* Acciones: mover seleccionados */}
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
                      onClick={() => moveSelected(g.id)}
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
