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

import {
  actualizarAgrupacion,
  eliminarAgrupacion,
  quitarArticulo
} from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";
import AgrupacionCreateModal from "./AgrupacionCreateModal";

const AgrupacionesList = ({
  agrupaciones = [],
  onActualizar,
  todoGroupId,
  todosArticulos = [],
  loading = false
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
    () => [...agrupaciones].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
    [agrupaciones]
  );

  const articleCount = (g) => Array.isArray(g.articulos) ? g.articulos.length : 0;

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
    await actualizarAgrupacion(g.id, { nombre: nuevo });
    setEditing((s) => ({ ...s, [g.id]: false }));
    onActualizar?.();
  };

  const removeGroup = async (g) => {
    if (g.id === todoGroupId) return; // no borrar TODO
    if (!window.confirm(`Eliminar la agrupación "${g.nombre}"?`)) return;
    await eliminarAgrupacion(g.id);
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
    await quitarArticulo(groupId, articuloId);
    onActualizar?.();
  };

  const moveSelected = async (fromId) => {
    const ids = Array.from(selectedByGroup[fromId] || []);
    const toId = Number(targetByGroup[fromId]);
    if (!ids.length || !Number.isFinite(toId) || toId === fromId) return;
    await httpBiz(`/agrupaciones/${fromId}/move-items`, {
      method: "POST",
      body: { toId, ids }
    });
    setSelectedByGroup((s) => ({ ...s, [fromId]: new Set() }));
    onActualizar?.();
  };

  // ✅ versión segura y memoizada
  const isArticuloBloqueadoForAppend = React.useMemo(() => {
    const gid = appendForGroup?.id;
    if (!gid) return () => false;

    const assigned = new Set();
    (agrupaciones || [])
      .filter(g => g && g.id != null)
      .filter(g => String(g.id) !== String(gid))
      .filter(g => (g?.nombre || '').toUpperCase() !== 'TODO')
      .forEach(g => (g.articulos || [])
        .forEach(a => a && assigned.add(String(a.id))));

    return (art) => assigned.has(String(art?.id));
  }, [agrupaciones, appendForGroup?.id]);


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
          onAppended={async () => {
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
          const allIds = (g.articulos || []).map((a) => Number(a.id)).filter(Boolean);
          const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
          const someChecked = allIds.some((id) => selected.has(id)) && !allChecked;

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
                        <Typography variant="body2" color="text.secondary">
                          ({articleCount(g)} artículo{articleCount(g) === 1 ? "" : "s"})
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
                        <Tooltip title={isTodo ? "No se puede renombrar/borrar TODO" : "Renombrar"}>
                          <span>
                            <IconButton onClick={() => startEdit(g)} disabled={isTodo}>
                              <EditIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isTodo ? "No se puede eliminar TODO" : "Eliminar"}>
                          <span>
                            <IconButton color="error" onClick={() => removeGroup(g)} disabled={isTodo}>
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isTodo ? "No se agrega en TODO" : "Agregar artículos"}>
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

                    {/* Selector de todos en el grupo */}
                    <Box display="flex" alignItems="center" mb={1}>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => selectAllInGroup(g)}
                      />
                      <Typography variant="body2">Seleccionar todos</Typography>
                    </Box>

                    {/* Lista de artículos del grupo */}
                    <Stack spacing={0.5}>
                      {(g.articulos || []).map((a) => {
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
                              />
                              <Typography variant="body2">
                                {a.nombre} <Typography component="span" variant="caption" color="text.secondary">#{a.id}</Typography>
                              </Typography>
                            </Box>
                            <Tooltip title={isTodo ? "No se quita desde TODO" : "Quitar del grupo"}>
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
                  </CardContent>

                  {/* Acciones: mover seleccionados */}
                  <CardActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1, px: 2, pb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
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
                      disabled={!(selectedByGroup[g.id]?.size) || !Number.isFinite(Number(targetByGroup[g.id]))}
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

