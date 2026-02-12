import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import {
  Modal,
  Box,
  Typography,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { httpBiz } from "../servicios/apiBusinesses";
import { emitGroupsChanged } from "@/utils/groupsBus";

/* ------------ VirtualList liviana (FIX) ------------ */
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
  const endIdx = Math.min(rows.length - 1, startIdx + visibleCount - 1);

  const offsetY = startIdx * rowHeight;
  const visibleRows = rows.slice(startIdx, endIdx + 1);

  return (
    <div
      style={{ height, overflow: "auto", position: "relative" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
          {visibleRows.map((row, i) =>
            renderRow({
              row,
              index: startIdx + i,
              style: {
                height: rowHeight,
                display: "flex",
                alignItems: "center",
              },
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
const safeId = (x) => {
  const raw =
    x?.article_id ??
    x?.articulo_id ??
    x?.articuloId ??
    x?.idArticulo ??
    x?.id ??
    x?.codigo ??
    x?.codigoArticulo;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalize = (s) => String(s || "").trim().toLowerCase();

function nextAvailableName(baseName, names) {
  const base = String(baseName || "").trim();
  if (!base) return base;
  const set = new Set((names || []).map(normalize));
  if (!set.has(normalize(base))) return base;
  let i = 2;
  while (set.has(normalize(`${base} (${i})`))) i++;
  return `${base} (${i})`;
}

const estadoCheckbox = (idsDisponibles, selectedIds) => {
  const total = idsDisponibles.length;
  if (total === 0) return { checked: false, indeterminate: false };
  let count = 0;
  for (const id of idsDisponibles) if (selectedIds.has(id)) count++;
  return {
    checked: count === total,
    indeterminate: count > 0 && count < total,
  };
};

export default function AgrupacionCreateModal({
  open,
  onClose,
  todosArticulos = [],
  loading = false,
  isArticuloBloqueado = () => false,

  // create | append
  mode = "create",
  groupId,
  groupName,

  onCreated,
  onAppended,
  saveButtonLabel,

  preselect = null,
  existingNames = [],
  treeMode = "cat-first", // "cat-first" | "sr-first"

  // ✅ NUEVO: para no depender de localStorage
  businessId: businessIdProp,
  allowedIds = null, // Set<number> | null
}) {
  /* ---------- businessId efectivo ---------- */
  const effectiveBusinessId = useMemo(() => {
    const v =
      businessIdProp ??
      localStorage.getItem("activeBusinessId") ??
      localStorage.getItem("effectiveBusinessId") ??
      null;

    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [businessIdProp]);

  /* ---------- state ---------- */
  const [nombreRubro, setNombreRubro] = useState("");
  const [expandedCategoria, setExpandedCategoria] = useState(null);
  const [expandedRubro, setExpandedRubro] = useState({});
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
    () =>
      new Set((preselect?.articleIds || []).map(Number).filter(Number.isFinite)),
    [preselect]
  );

  const disabledBlockSx = {
    opacity: 0.5,
    pointerEvents: "none",
    filter: "grayscale(15%)",
  };

  const isBlocked = useCallback(
    (art) => {
      const id = safeId(art);
      if (id == null) return true;

      // ✅ si no está permitido por división, bloqueado
      if (allowedIds && !allowedIds.has(id)) return true;

      if (preselect?.allowAssigned && preselectedIds.has(id)) return false;
      try { return !!isArticuloBloqueado(art); } catch { return false; }
    },
    [isArticuloBloqueado, preselect, preselectedIds, allowedIds]
  );

  // Index por id para armar payload
  const articleById = useMemo(() => {
    if (!open) return new Map();
    const m = new Map();
    const fuente = Array.isArray(todosArticulos)
      ? todosArticulos
      : todosArticulos?.tree || [];
    for (const sub of fuente || []) {
      for (const c of sub?.categorias || []) {
        for (const a of c?.articulos || []) {
          const id = safeId(a);
          if (id != null) m.set(id, a);
        }
      }
    }
    return m;
  }, [todosArticulos, open]);

  /* ========= Re-agrupado UI en dos modos ========= */
  const uiCategoriasRaw = useMemo(() => {
    if (!open) return [];

    const fuente = Array.isArray(todosArticulos)
      ? todosArticulos
      : todosArticulos?.tree || [];

    const allow = (a) => {
      if (!allowedIds) return true;
      const id = safeId(a);
      return id != null && allowedIds.has(id);
    };

    // 🟣 sr-first: Subrubro → Rubro → Artículos
    if (treeMode === "sr-first") {
      const out = [];

      for (const sub of fuente || []) {
        const subName = String(sub?.subrubro || "Sin subrubro");
        const rubros = [];

        for (const cat of sub?.categorias || []) {
          const rubroName = String(cat?.categoria || "Sin categoría");

          const articulos = (cat?.articulos || []).filter(allow);
          if (!articulos.length) continue;

          rubros.push({ rubro: rubroName, articulos });
        }

        if (!rubros.length) continue;

        rubros.sort((a, b) =>
          String(a.rubro).localeCompare(String(b.rubro), "es", {
            sensitivity: "base",
            numeric: true,
          })
        );

        out.push({ categoria: subName, rubros });
      }

      out.sort((a, b) =>
        String(a.categoria).localeCompare(String(b.categoria), "es", {
          sensitivity: "base",
          numeric: true,
        })
      );

      return out;
    }

    // 🟢 cat-first: Categoría → Rubro → Artículos
    const byCat = new Map();

    for (const sub of fuente || []) {
      const rubroFromSub = String(sub?.subrubro || "Sin subrubro");

      for (const cat of sub?.categorias || []) {
        const catName = String(cat?.categoria || "Sin categoría");

        for (const a of cat?.articulos || []) {
          if (!allow(a)) continue;

          const rubroName = String(a?.subrubro || rubroFromSub || "Sin subrubro");

          if (!byCat.has(catName)) byCat.set(catName, new Map());
          const byRubro = byCat.get(catName);

          if (!byRubro.has(rubroName)) byRubro.set(rubroName, []);
          byRubro.get(rubroName).push(a);
        }
      }
    }

    const out = [];
    for (const [categoria, byRubro] of byCat.entries()) {
      const rubros = [];
      for (const [rubro, articulos] of byRubro.entries()) {
        if (!articulos.length) continue;
        rubros.push({ rubro, articulos });
      }

      if (!rubros.length) continue;

      rubros.sort((a, b) =>
        String(a.rubro).localeCompare(String(b.rubro), "es", {
          sensitivity: "base",
          numeric: true,
        })
      );

      out.push({ categoria, rubros });
    }

    out.sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), "es", {
        sensitivity: "base",
        numeric: true,
      })
    );

    return out;
  }, [todosArticulos, open, treeMode, allowedIds]);

  // Filtro por búsqueda
  const uiCategorias = useMemo(() => {
    if (!open) return [];
    const q = String(queryDeferred || "").trim().toLowerCase();
    if (!q) return uiCategoriasRaw;

    const res = [];

    for (const cat of uiCategoriasRaw) {
      const rubrosFiltrados = [];

      for (const r of cat.rubros || []) {
        const arts = (r.articulos || []).filter((a) => {
          const name = String(a?.nombre || "").toLowerCase();
          return name.includes(q) || String(safeId(a) ?? "").includes(q);
        });

        if (arts.length) rubrosFiltrados.push({ ...r, articulos: arts });
      }

      if (rubrosFiltrados.length) res.push({ ...cat, rubros: rubrosFiltrados });
    }

    return res;
  }, [uiCategoriasRaw, queryDeferred, open]);

  // Preselección
  useEffect(() => {
    if (!open) return;

    if (preselectedIds.size > 0) {
      const next = new Set();
      let sugCategoria = "";
      for (const cat of uiCategoriasRaw) {
        for (const r of cat.rubros || []) {
          for (const a of r.articulos || []) {
            const id = safeId(a);
            if (id != null && preselectedIds.has(id)) {
              next.add(id);
              if (!sugCategoria) sugCategoria = cat?.categoria || "";
            }
          }
        }
      }
      setSelectedIds(next);
      if (mode === "create" && !nombreRubro.trim()) {
        setNombreRubro(groupName || sugCategoria || "");
      }
      setExpandedCategoria(sugCategoria || null);
    } else {
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedIds, uiCategoriasRaw, mode]);

  /* ---------- selección ---------- */
  const toggleOne = useCallback((id) => {
    if (!Number.isFinite(id)) return;
    setSelectedIds((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });
  }, []);

  const toggleMany = useCallback((ids) => {
    setSelectedIds((prev) => {
      let any = false;
      for (const id of ids) if (prev.has(id)) { any = true; break; }
      const nx = new Set(prev);
      if (any) for (const id of ids) nx.delete(id);
      else for (const id of ids) nx.add(id);
      return nx;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!allowedIds) return;

    setSelectedIds((prev) => {
      const next = new Set();
      for (const id of prev) if (allowedIds.has(Number(id))) next.add(id);
      return next;
    });
  }, [open, allowedIds]);

  /* ---------- guardar ---------- */
  const guardar = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!effectiveBusinessId) {
        showSnack("No hay business activo (businessId). Volvé a entrar al negocio.", "error");
        return;
      }

      let selectedAsArray = Array.from(selectedIds).filter(Number.isFinite);
      if (allowedIds) selectedAsArray = selectedAsArray.filter((id) => allowedIds.has(Number(id)));

      // ===== CREATE =====
      if (mode === "create") {
        if (!nombreRubro.trim() || selectedAsArray.length === 0) {
          showSnack("Debes ingresar un nombre y seleccionar artículos", "error");
          return;
        }

        const nombreBase = nombreRubro.trim();
        let finalName = nextAvailableName(nombreBase, existingNames);
        if (finalName !== nombreBase) {
          showSnack(`El nombre ya existía. Usando “${finalName}”.`, "info");
        }

        // armamos detalle para callbacks / mutaciones
        const articulosDetallados = selectedAsArray.map((id) => {
          const a = articleById.get(id) || {};
          return {
            id,
            nombre: a?.nombre || "",
            categoria: a?.categoria || "Sin categoría",
            subrubro: a?.subrubro || "Sin subrubro",
            precio: a?.precio ?? 0,
          };
        });

        // ✅ si venimos desde una agrupación: crear VACÍA + mover con move-items
        const fromId = Number(preselect?.fromGroupId);
        const haveFrom = Number.isFinite(fromId) && fromId > 0;

        // 1) crear agrupación (solo nombre)
        const nuevo = await httpBiz(
          `/agrupaciones`,
          { method: "POST", body: { nombre: finalName } },
          effectiveBusinessId
        );

        const newGroupId = Number(nuevo?.id ?? nuevo?.groupId ?? nuevo?.agrupacionId);
        if (!Number.isFinite(newGroupId) || newGroupId <= 0) {
          throw new Error("No se pudo obtener id de la agrupación creada");
        }

        // 2) mover o agregar ids
        const ids = selectedAsArray;

        if (haveFrom) {
          // 🔥 esto evita duplicados: saca del fromId y mete en newGroupId
          await httpBiz(
            `/agrupaciones/${fromId}/move-items`,
            { method: "POST", body: { toId: newGroupId, ids } },
            effectiveBusinessId
          );
        } else {
          // desde TODO: sólo agregamos al nuevo grupo (TODO no se “vacía”)
          await httpBiz(
            `/agrupaciones/${newGroupId}/articulos`,
            { method: "PUT", body: { ids } },
            effectiveBusinessId
          );
        }

        // UI callbacks
        setNombreRubro("");
        setSelectedIds(new Set());
        onCreated?.(finalName, newGroupId, articulosDetallados);

        showSnack(`Agrupación "${finalName}" creada correctamente`);
        emitGroupsChanged("create", { groupId: newGroupId, count: ids.length });

        setTimeout(() => {
          setSnackbarOpen(false);
          onClose?.();
        }, 600);
        return;
      }

      // ===== APPEND =====
      const articulos = selectedAsArray
        .map((id) => {
          const a = articleById.get(id);
          return {
            id,
            nombre: a?.nombre || "",
            categoria: a?.categoria || "Sin categoría",
            subrubro: a?.subrubro || "Sin subrubro",
            precio: a?.precio ?? 0,
          };
        })
        .filter((x) => Number.isFinite(x.id));

      if (!Number.isFinite(Number(groupId)) || articulos.length === 0) {
        showSnack("Seleccioná al menos un artículo", "error");
        return;
      }

      await httpBiz(
        `/agrupaciones/${groupId}/articulos`,
        { method: "PUT", body: { articulos } },
        effectiveBusinessId
      );

      const n = articulos.length;
      setSelectedIds(new Set());
      onAppended?.(groupId, n, articulos);

      showSnack(`Se agregaron ${n} artículo${n === 1 ? "" : "s"} a "${groupName}"`);
      emitGroupsChanged("append", {
        groupId,
        count: n,
        ids: articulos.map((a) => Number(a.id)).filter(Boolean),
      });

      setTimeout(() => {
        setSnackbarOpen(false);
        onClose?.();
      }, 600);
    } catch (err) {
      console.error("AgrupacionCreateModal guardar ERROR:", err);
      showSnack("No se pudo guardar la agrupación", "error");
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode === "create";

  return (
    <>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarTipo}
          sx={{ width: "100%" }}
        >
          {snackbarMensaje}
        </Alert>
      </Snackbar>

      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
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
          {/* Header */}
          <Box sx={{ pb: 2 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {isCreate ? "Crear Agrupación" : `Agregar a "${groupName}"`}
            </Typography>

            {isCreate && (
              <TextField
                label="Nombre de la Agrupación"
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
            />

            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>
              Seleccioná Rubros / Subrubros / Artículos
            </Typography>
          </Box>

          {/* Lista scrollable */}
          <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
            {loading ? (
              <Typography>Cargando artículos...</Typography>
            ) : (
              (uiCategorias || []).map((catItem) => {
                const catName = catItem?.categoria ?? "Sin categoría";
                const rubrosSafe = (catItem?.rubros || []).filter(Boolean);

                const idsCategoria = [];
                let categoriaTieneAlgunoSeleccionable = false;

                for (const r of rubrosSafe) {
                  for (const a of r?.articulos || []) {
                    const id = safeId(a);
                    if (id != null && !isBlocked(a)) {
                      idsCategoria.push(id);
                      categoriaTieneAlgunoSeleccionable = true;
                    }
                  }
                }

                const catAllBlocked = !categoriaTieneAlgunoSeleccionable;
                const { checked: catCheckedTop, indeterminate: catIndTop } =
                  estadoCheckbox(idsCategoria, selectedIds);
                const isCatExpanded = expandedCategoria === catName;

                return (
                  <Accordion
                    key={catName}
                    expanded={isCatExpanded && !catAllBlocked}
                    onChange={(_, exp) =>
                      !catAllBlocked && setExpandedCategoria(exp ? catName : null)
                    }
                    sx={catAllBlocked ? disabledBlockSx : undefined}
                    TransitionProps={{ unmountOnExit: true }}
                  >
                    <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                      <Checkbox
                        checked={catCheckedTop}
                        indeterminate={catIndTop}
                        onChange={() => toggleMany(idsCategoria)}
                        sx={{ mr: 1 }}
                        disabled={catAllBlocked}
                      />
                      <Typography fontWeight="bold">
                        {catName} {catAllBlocked ? "· (completo en otra agrupación)" : ""}
                      </Typography>
                    </AccordionSummary>

                    <AccordionDetails>
                      {rubrosSafe.map((rubro) => {
                        const rubroName = rubro?.rubro ?? "Sin subrubro";
                        const artsSafe = (rubro?.articulos || []).filter(Boolean);

                        const idsRubro = [];
                        const rows = [];

                        for (const a of artsSafe) {
                          const id = safeId(a);
                          if (id == null) continue;
                          const bloqueado = isBlocked(a);
                          rows.push({ id, a, bloqueado });
                          if (!bloqueado) idsRubro.push(id);
                        }

                        const rubroAllBlocked = idsRubro.length === 0;
                        const { checked: rubroChecked, indeterminate: rubroInd } =
                          estadoCheckbox(idsRubro, selectedIds);
                        const rubroIsExpanded = expandedRubro[catName] === rubroName;

                        return (
                          <Accordion
                            key={`${catName}-${rubroName}`}
                            expanded={rubroIsExpanded && !rubroAllBlocked}
                            onChange={(_, exp) =>
                              !rubroAllBlocked &&
                              setExpandedRubro((s) => ({
                                ...s,
                                [catName]: exp ? rubroName : null,
                              }))
                            }
                            sx={{
                              mb: 1,
                              ...(rubroAllBlocked ? disabledBlockSx : {}),
                            }}
                            TransitionProps={{ unmountOnExit: true }}
                          >
                            <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />}>
                              <Checkbox
                                checked={rubroChecked}
                                indeterminate={rubroInd}
                                onChange={() => toggleMany(idsRubro)}
                                sx={{ mr: 1 }}
                                disabled={rubroAllBlocked}
                              />
                              <Typography>
                                {rubroName}{" "}
                                {rubroAllBlocked ? "· (completo en otra agrupación)" : ""}
                              </Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                              <VirtualList
                                rows={rows}
                                rowHeight={36}
                                height={Math.min(320, Math.max(160, rows.length * 36))}
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
                                        pointerEvents: bloqueado ? "none" : "auto",
                                        display: "flex",
                                        alignItems: "center",
                                      }}
                                    >
                                      <Checkbox
                                        checked={!!seleccionado}
                                        onChange={() => toggleOne(id)}
                                        sx={{ mr: 1 }}
                                        disabled={bloqueado}
                                      />
                                      <Typography noWrap title={a?.nombre || ""}>
                                        {a?.nombre ?? "—"} {bloqueado && "(ya asignado)"}
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
              })
            )}
          </Box>

          {/* Footer fijo */}
          <Box
            sx={{
              pt: 2,
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              borderTop: "1px solid #eee",
              background: "white",
            }}
          >
            <Button onClick={onClose} variant="text">
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              variant="contained"
              color="success"
              disabled={
                saving ||
                (mode === "create" &&
                  (!nombreRubro.trim() || selectedIds.size === 0)) ||
                (mode !== "create" && selectedIds.size === 0)
              }
            >
              {saving
                ? "Guardando…"
                : saveButtonLabel ??
                (mode === "create" ? "Guardar Agrupación" : "Agregar a la agrupación")}
            </Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
