/* eslint-disable no-empty */
// src/componentes/AgrupacionCreateModal.jsx
import React, { useMemo, useState, useEffect, useCallback, useDeferredValue } from "react";
import {
  Modal, Box, Typography, Checkbox, Accordion, AccordionSummary,
  AccordionDetails, Button, TextField, Snackbar, Alert
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { crearAgrupacion } from "../servicios/apiAgrupaciones";
import { httpBiz } from "../servicios/apiBusinesses";

/* ---------------- VirtualList (sin dependencias) ---------------- */
function VirtualList({
  rows = [],
  rowHeight = 40,
  height = 360,
  overscan = 6,
  renderRow,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = rows.length * rowHeight;

  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const endIdx = Math.min(rows.length - 1, startIdx + visibleCount);

  const offsetY = startIdx * rowHeight;
  const visibleRows = rows.slice(startIdx, endIdx + 1);

  return (
    <div
      style={{ height, overflow: 'auto', position: 'relative', willChange: 'transform' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) =>
            renderRow({ row, index: startIdx + i, style: { height: rowHeight, display: 'flex', alignItems: 'center' } })
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
const safeId = (x) => {
  const n = Number(x?.id);
  return Number.isFinite(n) ? n : null;
};
const normalize = (s) => String(s || '').trim().toLowerCase();
function nextAvailableName(baseName, names) {
  const base = String(baseName || '').trim();
  if (!base) return base;
  const set = new Set((names || []).map(normalize));
  if (!set.has(normalize(base))) return base;
  let i = 2;
  while (set.has(normalize(`${base} (${i})`))) i++;
  return `${base} (${i})`;
}
// subrubro → [ { nombre:cat, articulos:[] } ]
const agruparPorSubrubro = (data = []) => {
  const agrupado = {};
  (data || []).forEach(cat => {
    (cat?.subrubros || []).forEach(sub => {
      const subName = sub?.nombre ?? 'Sin subrubro';
      if (!agrupado[subName]) agrupado[subName] = [];
      agrupado[subName].push({
        nombre: cat?.nombre ?? 'Sin categoría',
        articulos: (sub?.articulos || []),
      });
    });
  });
  return Object.entries(agrupado).map(([nombre, rubros]) => ({ nombre, rubros }));
};
// checkbox state
const estadoCheckbox = (idsDisponibles, selectedIds) => {
  const total = idsDisponibles.length;
  if (total === 0) return { checked: false, indeterminate: false };
  let count = 0;
  for (const id of idsDisponibles) if (selectedIds.has(id)) count++;
  return { checked: count === total, indeterminate: count > 0 && count < total };
};

export default function AgrupacionCreateModal({
  open,
  onClose,
  todosArticulos = [],
  loading = false,
  isArticuloBloqueado = () => false,
  mode = "create",
  groupId,
  groupName,
  onCreated,
  onAppended,
  saveButtonLabel,
  preselect = null, // { articleIds:number[], fromGroupId:number|null, allowAssigned:boolean }
  existingNames = [],
}) {
  /* ---------- hooks (orden fijo) ---------- */
  const [nombreRubro, setNombreRubro] = useState("");
  const [expandedSub, setExpandedSub] = useState(null);
  const [expandedCat, setExpandedCat] = useState({});
  const [query, setQuery] = useState("");
  const queryDeferred = useDeferredValue(query);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMensaje, setSnackbarMensaje] = useState("");
  const [snackbarTipo, setSnackbarTipo] = useState("success");
  const [saving, setSaving] = useState(false);

  const showSnack = useCallback((msg, type = "success") => {
    setSnackbarMensaje(msg);
    setSnackbarTipo(type);
    setSnackbarOpen(true);
  }, []);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const preselectedIds = useMemo(
    () => new Set((preselect?.articleIds || []).map(Number).filter(Number.isFinite)),
    [preselect]
  );

  const isBlocked = useCallback((art) => {
    const id = safeId(art);
    if (id == null) return true;
    if (preselect?.allowAssigned && preselectedIds.has(id)) return false;
    try { return !!isArticuloBloqueado(art); } catch { return false; }
  }, [isArticuloBloqueado, preselect, preselectedIds]);

  const articleById = useMemo(() => {
    const m = new Map();
    for (const cat of todosArticulos || []) {
      for (const sr of cat?.subrubros || []) {
        for (const a of sr?.articulos || []) {
          const id = safeId(a);
          if (id != null) m.set(id, a);
        }
      }
    }
    return m;
  }, [todosArticulos]);

  const uiSubrubrosRaw = useMemo(() => agruparPorSubrubro(todosArticulos || []), [todosArticulos]);

  // filtrar por query (defer) — SIN hooks adentro de loops
  const uiSubrubros = useMemo(() => {
    const q = String(queryDeferred || '').trim().toLowerCase();
    if (!q) return uiSubrubrosRaw;
    const res = [];
    for (const sr of uiSubrubrosRaw) {
      const rubrosFiltrados = [];
      for (const rc of (sr?.rubros || [])) {
        const arts = (rc?.articulos || []).filter(a => {
          const name = String(a?.nombre || '').toLowerCase();
          return name.includes(q) || String(safeId(a) ?? '').includes(q);
        });
        if (arts.length) rubrosFiltrados.push({ ...rc, articulos: arts });
      }
      if (rubrosFiltrados.length) res.push({ ...sr, rubros: rubrosFiltrados });
    }
    return res;
  }, [uiSubrubrosRaw, queryDeferred]);

  // preselección al abrir (sin introducir hooks en loops)
  useEffect(() => {
    if (!open) return;
    if (preselectedIds.size > 0) {
      const next = new Set();
      let sugSub = '';
      for (const sr of uiSubrubrosRaw) {
        for (const rc of (sr?.rubros || [])) {
          for (const a of (rc?.articulos || [])) {
            const id = safeId(a);
            if (id != null && preselectedIds.has(id)) {
              next.add(id);
              if (!sugSub) sugSub = sr?.nombre || '';
            }
          }
        }
      }
      setSelectedIds(next);
      if (mode === 'create' && !nombreRubro.trim()) {
        setNombreRubro(groupName || sugSub || nombreRubro);
      }
      setExpandedSub(sugSub || null);
    } else {
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedIds, uiSubrubrosRaw, mode]);

  /* ---------- handlers selección (memoizados y fuera de loops) ---------- */
  const toggleOne = useCallback((id) => {
    if (!Number.isFinite(id)) return;
    setSelectedIds(prev => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id); else nx.add(id);
      return nx;
    });
  }, []);

  const toggleMany = useCallback((ids) => {
    setSelectedIds(prev => {
      let any = false;
      for (const id of ids) if (prev.has(id)) { any = true; break; }
      const nx = new Set(prev);
      if (any) { for (const id of ids) nx.delete(id); }
      else { for (const id of ids) nx.add(id); }
      return nx;
    });
  }, []);

  /* ---------- guardar ---------- */
  const guardar = async () => {
    if (saving) return;
    setSaving(true);

    const selectedAsArray = Array.from(selectedIds).filter(Number.isFinite);

    if (mode === "create") {
      if (!nombreRubro.trim() || selectedAsArray.length === 0) {
        showSnack("Debes ingresar un nombre y seleccionar artículos", "error");
        setSaving(false);
        return;
      }

      const nombreBase = nombreRubro.trim();
      let finalName = nextAvailableName(nombreBase, existingNames);
      if (finalName !== nombreBase) {
        showSnack(`El nombre ya existía. Usando “${finalName}”.`, "info");
      }

      const payload = {
        nombre: finalName,
        articulos: selectedAsArray.map((id) => {
          const a = articleById.get(id) || {};
          return {
            id,
            nombre: a?.nombre || "",
            categoria: a?.categoria || "Sin categoría",
            subrubro: a?.subrubro || "Sin subrubro",
            precio: a?.precio ?? 0,
          };
        }),
      };

      try {
        let nuevo;
        try {
          nuevo = await crearAgrupacion(payload);
        } catch (err) {
          const msg = String(err?.message || '').toLowerCase();
          if (err?.status === 409 || msg.includes('existe')) {
            const retryName = nextAvailableName(payload.nombre, existingNames);
            if (retryName !== payload.nombre) {
              payload.nombre = retryName;
              showSnack(`Otro lo registró antes. Guardé como “${retryName}”.`, "info");
              nuevo = await crearAgrupacion(payload);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }

        const newGroupId = Number(nuevo?.id);

        const fromId = Number(preselect?.fromGroupId);
        if (Number.isFinite(fromId) && fromId > 0) {
          const ids = payload.articulos.map(a => a.id).filter(Number.isFinite);
          await Promise.all(
            ids.map(id =>
              httpBiz(`/agrupaciones/${fromId}/articulos/${id}`, { method: 'DELETE' }).catch(() => {})
            )
          );
        }

        const nombreCreado = payload.nombre;
        setNombreRubro("");
        setSelectedIds(new Set());

        onCreated?.(nombreCreado, newGroupId, payload.articulos)

        showSnack(`Agrupación "${nombreCreado}" creada correctamente`);
        setTimeout(() => {
          setSnackbarOpen(false);
          onClose?.();
        }, 600);
      } catch (err) {
        console.error("Error al crear agrupación:", err);
        showSnack("No se pudo crear la agrupación", "error");
      } finally {
        setSaving(false);
      }
      return;
    }

    // append
    const articulos = selectedAsArray
      .map(id => {
        const a = articleById.get(id);
        return {
          id,
          nombre: a?.nombre || "",
          categoria: a?.categoria || "Sin categoría",
          subrubro: a?.subrubro || "Sin subrubro",
          precio: a?.precio ?? 0,
        };
      })
      .filter(x => Number.isFinite(x.id));

    if (!Number.isFinite(Number(groupId)) || articulos.length === 0) {
      showSnack("Seleccioná al menos un artículo", "error");
      setSaving(false);
      return;
    }

    try {
      await httpBiz(`/agrupaciones/${groupId}/articulos`, {
        method: "PUT",
        body: { articulos },
      });

      const n = articulos.length;
      setSelectedIds(new Set());
      onAppended?.(groupId, n);
      showSnack(`Se agregaron ${n} artículo${n === 1 ? "" : "s"} a "${groupName}"`);

      setTimeout(() => { setSnackbarOpen(false); onClose?.(); }, 600);
    } catch (err) {
      console.error("Error al agregar artículos:", err);
      showSnack("Error al agregar artículos", "error");
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode === "create";

  /* ---------- UI: solo lógica normal (sin hooks en loops) ---------- */
  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarTipo} sx={{ width: "100%" }}>
          {snackbarMensaje}
        </Alert>
      </Snackbar>

      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            overflowY: "auto",
            maxHeight: "80vh",
            width: "92%",
            maxWidth: 800,
            margin: "50px auto",
            p: 3,
            backgroundColor: "white",
            borderRadius: 2,
            boxShadow: 24,
          }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {isCreate ? "Crear Agrupación" : `Agregar a "${groupName}"`}
          </Typography>

          {isCreate && (
            <TextField
              label="Nombre del Rubro"
              value={nombreRubro}
              onChange={(e) => setNombreRubro(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            size="small"
            placeholder="Buscar artículo o código…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Seleccioná Categorías y Artículos
          </Typography>

          {loading ? (
            <Typography>Cargando artículos...</Typography>
          ) : (
            <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
              {(uiSubrubros || []).map((subrubro) => {
                const subName = subrubro?.nombre ?? 'Sin subrubro';
                const rubrosSafe = (subrubro?.rubros || []).filter(Boolean);

                // ids disponibles por subrubro
                const idsSub = [];
                for (const rc of rubrosSafe) {
                  for (const a of (rc?.articulos || [])) {
                    const id = safeId(a);
                    if (id != null && !isBlocked(a)) idsSub.push(id);
                  }
                }
                const { checked, indeterminate } = estadoCheckbox(idsSub, selectedIds);
                const isSubExpanded = expandedSub === subName;

                return (
                  <Accordion
                    key={subName}
                    expanded={isSubExpanded}
                    onChange={(_, exp) => setExpandedSub(exp ? subName : null)}
                  >
                    <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                      <Checkbox
                        checked={checked}
                        indeterminate={indeterminate}
                        onChange={() => toggleMany(idsSub)}
                        sx={{ mr: 1 }}
                      />
                      <Typography fontWeight="bold">{subName}</Typography>
                    </AccordionSummary>

                    <AccordionDetails>
                      {rubrosSafe.map((rubroCat) => {
                        const catName = rubroCat?.nombre ?? 'Sin categoría';
                        const artsSafe = (rubroCat?.articulos || []).filter(Boolean);

                        const idsCat = [];
                        const rowsCat = [];
                        for (const a of artsSafe) {
                          const id = safeId(a);
                          if (id == null) continue;
                          const bloqueado = isBlocked(a);
                          rowsCat.push({ id, a, bloqueado });
                          if (!bloqueado) idsCat.push(id);
                        }
                        const { checked: catChecked, indeterminate: catInd } = estadoCheckbox(idsCat, selectedIds);
                        const catIsExpanded = expandedCat[subName] === catName;

                        return (
                          <Accordion
                            key={`${subName}-${catName}`}
                            expanded={catIsExpanded}
                            onChange={(_, exp) =>
                              setExpandedCat((s) => ({ ...s, [subName]: exp ? catName : null }))
                            }
                            sx={{ mb: 1 }}
                          >
                            <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                              <Checkbox
                                checked={catChecked}
                                indeterminate={catInd}
                                onChange={() => toggleMany(idsCat)}
                                sx={{ mr: 1 }}
                              />
                              <Typography>{catName}</Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                              <VirtualList
                                rows={rowsCat}
                                rowHeight={36}
                                height={Math.min(320, Math.max(160, rowsCat.length * 36))}
                                overscan={6}
                                renderRow={({ row, style }) => {
                                  const { id, a, bloqueado } = row;
                                  const seleccionado = selectedIds.has(id);
                                  return (
                                    <Box
                                      key={id}
                                      style={style}
                                      sx={{
                                        pl: 4,
                                        pr: 1,
                                        opacity: bloqueado ? 0.5 : 1,
                                        pointerEvents: bloqueado ? 'none' : 'auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <Checkbox
                                        checked={!!seleccionado}
                                        onChange={() => toggleOne(id)}
                                        sx={{ mr: 1 }}
                                        disabled={bloqueado}
                                      />
                                      <Typography noWrap title={a?.nombre || ''}>
                                        {a?.nombre ?? '—'} {bloqueado && "(ya asignado)"}
                                      </Typography>
                                    </Box>
                                  );
                                }}
                              />
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

          <Box display="flex" justifyContent="flex-end" mt={3}>
            <Button onClick={onClose} variant="text" sx={{ mr: 1 }}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              variant="contained"
              color="success"
              disabled={
                saving ||
                (mode === "create" && (!nombreRubro.trim() || selectedIds.size === 0)) ||
                (mode !== "create" && selectedIds.size === 0)
              }
            >
              {saving ? 'Guardando…' : (saveButtonLabel ?? (mode === "create" ? "Guardar Agrupación" : "Agregar a la agrupación"))}
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
