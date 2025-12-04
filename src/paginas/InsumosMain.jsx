/* eslint-disable no-unused-vars */
// src/componentes/InsumosMain.jsx
import React, { useEffect, useState } from "react";
import InsumosSidebar from "../componentes/InsumosSidebar.jsx";
import InsumosTable from "../componentes/InsumosTable.jsx";
import InsumoGroupModal from "../componentes/InsumoGroupModal.jsx";
import Buscador from "../componentes/Buscador.jsx";

import {
  insumosList,
  insumoCreate,
  insumoUpdate,
  insumoDelete,
  insumosBulkJSON,
  insumosBulkCSV,
  insumosSyncMaxi,
  insumoGroupsList,
  // usamos los servicios en vez de fetch manual
  insumoGroupUpdate,
  insumoGroupDelete,
} from "../servicios/apiInsumos";

import BulkJsonModal from "../componentes/BulkJsonModal.jsx";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Stack,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";

import "../css/global.css";
import "../css/theme-layout.css";
import "../css/TablaArticulos.css";

const UNIDADES = ["kg", "g", "lt", "ml", "un"];

const norm = (s) => String(s || "").trim().toLowerCase();
const isDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === "discontinuados" || n === "descontinuados";
};

export default function InsumosMain() {
  // por ahora no usamos texto de búsqueda para filtrar, solo para saltar
  const q = "";

  /* ================== NEGOCIO ACTIVO ================== */

  const [activeBusiness, setActiveBusiness] = useState(() => {
    const id = localStorage.getItem("activeBusinessId");
    const nombre =
      localStorage.getItem("activeBusinessName") ||
      localStorage.getItem("activeBusinessNombre");
    return id ? { id, nombre: nombre || null } : null;
  });

  const businessId = activeBusiness?.id || null;

  useEffect(() => {
    const fromLocalStorage = () => {
      const id = localStorage.getItem("activeBusinessId");
      const nombre =
        localStorage.getItem("activeBusinessName") ||
        localStorage.getItem("activeBusinessNombre");
      setActiveBusiness(id ? { id, nombre: nombre || null } : null);
    };

    const handleBusinessSwitched = (evt) => {
      const d = evt?.detail;

      if (d?.business) {
        const b = d.business;
        setActiveBusiness({
          id: String(b.id),
          nombre: b.nombre || b.name || null,
        });
        localStorage.setItem("activeBusinessId", String(b.id));
        if (b.nombre || b.name) {
          localStorage.setItem("activeBusinessName", b.nombre || b.name);
        }
        return;
      }

      if (d?.id) {
        setActiveBusiness({
          id: String(d.id),
          nombre: d.nombre || d.name || null,
        });
        localStorage.setItem("activeBusinessId", String(d.id));
        if (d.nombre || d.name) {
          localStorage.setItem("activeBusinessName", d.nombre || d.name);
        }
        return;
      }

      fromLocalStorage();
    };

    const handleStorage = (evt) => {
      if (evt.key === "activeBusinessId" || evt.key === "activeBusinessName") {
        fromLocalStorage();
      }
    };

    fromLocalStorage();

    window.addEventListener("business:switched", handleBusinessSwitched);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("business:switched", handleBusinessSwitched);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  /* ================== ESTADO TABLA / FORM ================== */

  const [selectedRubroCodigo, setSelectedRubroCodigo] = useState(null);

  // 'no-elab' | 'elab' | 'all'
  const [vista, setVista] = useState("no-elab");

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  // 'lista' | 'por-rubro' (por ahora sólo usamos 'lista')
  const [insumosViewMode, setInsumosViewMode] = useState("lista");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    unidadMed: "",
    precioRef: "",
  });

  const [openBulk, setOpenBulk] = useState(false);

  // 🔍 Buscador de insumos + salto a fila
  const [insumosSearchOptions, setInsumosSearchOptions] = useState([]);
  const [jumpToInsumoId, setJumpToInsumoId] = useState(null);

  const pendingJumpRef = React.useRef(null);
  const jumpTriesRef = React.useRef(0);

  /* ================== AGRUPACIONES DE INSUMOS ================== */

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);

  // Modo de visualización de columnas
  const [precioMode, setPrecioMode] = useState("promedio"); // 'promedio' | 'ultima'
  const [totalMode, setTotalMode] = useState("gastos"); // 'unidades' | 'gastos' | 'ratio'

  // Filtro de periodo (por ahora clave simbólica)
  const [periodoKey, setPeriodoKey] = useState("mes-actual"); // luego mapeamos a from/to

  // Orden
  const [orderBy, setOrderBy] = useState("total"); // 'total' | 'ratio' | 'existe-receta'
  const [orderDir, setOrderDir] = useState("desc"); // 'asc' | 'desc'

  // Modal de agrupaciones de insumos
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalInitialGroupId, setGroupModalInitialGroupId] =
    useState(null);

  // Preseleccionar insumo y/o grupo al abrir el modal
  const [groupModalInsumo, setGroupModalInsumo] = useState(null);
  const [groupModalRubroLabel, setGroupModalRubroLabel] = useState(null);

  // ================== Buscador: cargar opciones ==================

  const loadInsumosSearchOptions = React.useCallback(async () => {
    if (!businessId) {
      setInsumosSearchOptions([]);
      return;
    }
    try {
      // traemos muchos insumos para poder buscarlos todos
      const resp = await insumosList({ page: 1, limit: 2000, search: "" });
      const data = Array.isArray(resp.data) ? resp.data : [];

      const opts = data
        .map((ins) => {
          const id = Number(ins.id);
          if (!Number.isFinite(id)) return null;

          const nombre = (ins.nombre || "").trim() || `#INS-${id}`;
          const codigo =
            ins.codigo_mostrar ||
            (ins.codigo_maxi && ins.codigo_maxi.trim() !== ""
              ? ins.codigo_maxi
              : `INS-${id}`);

          return {
            id,
            label: `[INS] ${codigo} · ${nombre}`,
            value: nombre,
          };
        })
        .filter(Boolean);

      setInsumosSearchOptions(opts);
    } catch (e) {
      console.error("[InsumosMain] Error al cargar opciones de buscador:", e);
      setInsumosSearchOptions([]);
    }
  }, [businessId]);

  useEffect(() => {
    loadInsumosSearchOptions();
  }, [loadInsumosSearchOptions]);

  // ================== Agrupaciones ==================

  // Podemos llamar esto desde la tabla / menú de insumo
  const handleOpenGroupModal = (insumo = null, initialGroupId = null) => {
    setGroupModalInsumo(insumo || null);
    const n = Number(initialGroupId);
    setGroupModalInitialGroupId(Number.isFinite(n) ? n : null);
    setGroupModalOpen(true);
  };

  const handleCloseGroupModal = (didSave = false) => {
    setGroupModalOpen(false);
    setGroupModalInsumo(null);
    setGroupModalInitialGroupId(null);

    if (didSave) {
      loadGroups();
      fetchData();
    }
  };

  // abrir desde INSUMO
  const handleOpenGroupModalForInsumo = (insumo) => {
    setGroupModalInsumo(insumo || null);
    setGroupModalRubroLabel(null);
    setGroupModalOpen(true);
  };

  // abrir desde RUBRO
  const handleOpenGroupModalForRubro = (rubroLabel) => {
    setGroupModalInsumo(null);
    setGroupModalRubroLabel(rubroLabel || null);
    setGroupModalOpen(true);
  };

  // Devuelve un Set de IDs de insumos pertenecientes al grupo seleccionado
  const selectedGroupItemIds = React.useMemo(() => {
    if (!selectedGroupId) return null;
    if (!Array.isArray(groups) || !groups.length) return null;

    const g = groups.find((gr) => Number(gr.id) === Number(selectedGroupId));
    if (!g) return null;

    const rawItems =
      g.items ||
      g.insumos ||
      g.articulos ||
      (Array.isArray(g.data) ? g.data : []) ||
      [];

    const ids = (rawItems || [])
      .map((it) =>
        Number(
          it.insumo_id ??
            it.insumoId ??
            it.id ??
            (it.insumo && (it.insumo.id || it.insumo.insumo_id))
        )
      )
      .filter(Number.isFinite);

    if (!ids.length) return null;

    const set = new Set(ids);
    console.log("[InsumosMain] selectedGroupItemIds =", set);
    return set;
  }, [groups, selectedGroupId]);

  const loadGroups = React.useCallback(async () => {
    if (!businessId) {
      setGroups([]);
      setFavoriteGroupId(null);
      setGroupsError("");
      return;
    }

    setGroupsLoading(true);
    setGroupsError("");
    try {
      const res = await insumoGroupsList();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setGroups(list);

      const fav = list.find((g) => g.es_favorita === true);
      setFavoriteGroupId(fav ? fav.id : null);
    } catch (e) {
      console.error("[InsumosMain] Error al cargar grupos de insumos:", e);
      setGroups([]);
      setFavoriteGroupId(null);
      setGroupsError(e.message || "Error al cargar agrupaciones de insumos");
    } finally {
      setGroupsLoading(false);
    }
  }, [businessId]);

  // Cargar agrupaciones cuando cambia el negocio / al montar
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // ================== Handlers gestión de agrupaciones (sidebar) ==================

  const handleSetFavoriteGroup = async (groupId) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de marcar favoritas.");
      return;
    }
    const id = Number(groupId);
    if (!Number.isFinite(id)) return;

    try {
      // si ya es favorita -> la desmarcamos
      if (favoriteGroupId && Number(favoriteGroupId) === id) {
        await insumoGroupUpdate(id, { es_favorita: false });
        setFavoriteGroupId(null);
      } else {
        // desmarcar favorita anterior (si hay)
        if (favoriteGroupId) {
          await insumoGroupUpdate(favoriteGroupId, { es_favorita: false });
        }
        // marcar nueva
        await insumoGroupUpdate(id, { es_favorita: true });
        setFavoriteGroupId(id);
      }

      await loadGroups();
    } catch (e) {
      console.error("[InsumosMain] Error setFavoriteGroup:", e);
      alert(e.message || "Error al actualizar favorita");
    }
  };

  const handleEditGroup = async (group) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de editar agrupaciones.");
      return;
    }
    const actual = String(group?.nombre || "");
    const nuevo = window.prompt("Nuevo nombre de la agrupación:", actual);
    if (nuevo == null) return;
    const trimmed = nuevo.trim();
    if (!trimmed) return;

    try {
      await insumoGroupUpdate(group.id, { nombre: trimmed });
      await loadGroups();
    } catch (e) {
      console.error("[InsumosMain] Error editGroup:", e);
      alert(e.message || "Error al renombrar agrupación");
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de eliminar agrupaciones.");
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar la agrupación "${group.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await insumoGroupDelete(group.id);

      if (selectedGroupId && Number(selectedGroupId) === Number(group.id)) {
        setSelectedGroupId(null);
      }

      if (favoriteGroupId && Number(favoriteGroupId) === Number(group.id)) {
        setFavoriteGroupId(null);
      }

      await loadGroups();
    } catch (e) {
      console.error("[InsumosMain] Error deleteGroup:", e);
      alert(e.message || "Error al eliminar agrupación");
    }
  };

  const discontinuadosGroupId = React.useMemo(() => {
    const g = (groups || []).find(isDiscontinuadosGroup);
    return g ? Number(g.id) : null;
  }, [groups]);

  const handleSelectGroupId = (rawId) => {
    const n = Number(rawId);
    const id = Number.isFinite(n) && n > 0 ? n : null;
    setSelectedGroupId(id);
    setPage(1);
    // cuando filtro por agrupación, limpio rubro para no mezclar filtros
    setSelectedRubroCodigo(null);
  };

  /* ========================= DATA INSUMOS ========================= */

  const fetchData = async () => {
    console.log("[InsumosMain] fetchData", {
      businessId,
      selectedGroupId,
      vista,
      q,
      periodoKey,
      precioMode,
      totalMode,
      orderBy,
      orderDir,
      jumpToInsumoId,
    });

    if (!businessId) {
      setRows([]);
      setPagination({ total: 0, pages: 1 });
      return;
    }

    setLoading(true);
    try {
      const effectiveLimit =
        selectedGroupItemIds || jumpToInsumoId ? 2000 : limit;

      const params = { page, limit: effectiveLimit, search: q };

      // por ahora el backend puede ignorar estos, pero ya van cableados
      params.periodo = periodoKey;
      params.precioMode = precioMode;
      params.totalMode = totalMode;
      params.orderBy = orderBy;
      params.orderDir = orderDir;

      if (selectedRubroCodigo != null) {
        params.rubro = selectedRubroCodigo;
      }

      if (vista === "elab") {
        params.elaborados = "true";
      } else if (vista === "no-elab") {
        params.elaborados = "false";
      }

      const r = await insumosList(params);
      let data = r.data || [];

      // filtro por agrupación (IDs del grupo)
      if (selectedGroupItemIds instanceof Set) {
        data = data.filter((row) => selectedGroupItemIds.has(Number(row.id)));
      }

      setRows(data);

      setPagination(
        selectedGroupItemIds
          ? { total: data.length, pages: 1 }
          : r.pagination || { total: data.length, pages: 1 }
      );
    } finally {
      setLoading(false);
    }
  };

  // Scroll + highlight al insumo
  const tryJumpNow = React.useCallback((id) => {
    const container = document.getElementById("tabla-insumos-scroll");
    const row = document.querySelector(`[data-insumo-id="${id}"]`);
    if (!container || !row) return false;

    const top = row.offsetTop - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    row.classList.add("highlight-jump");
    setTimeout(() => row.classList.remove("highlight-jump"), 1400);
    return true;
  }, []);

  const scheduleJump = React.useCallback((id) => {
    pendingJumpRef.current = Number(id);
    jumpTriesRef.current = 0;
  }, []);

  useEffect(() => {
    const id = Number(pendingJumpRef.current);
    if (!Number.isFinite(id) || id <= 0) return;

    const tick = () => {
      if (tryJumpNow(id)) {
        pendingJumpRef.current = null;
        return;
      }
      jumpTriesRef.current += 1;
      if (jumpTriesRef.current > 25) {
        pendingJumpRef.current = null;
        return;
      }
      setTimeout(tick, 80);
    };

    const t0 = setTimeout(tick, 40);
    return () => clearTimeout(t0);
  }, [rows, tryJumpNow]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    q,
    selectedRubroCodigo,
    businessId,
    vista,
    selectedGroupId,
    groups,
    periodoKey,
    precioMode,
    totalMode,
    orderBy,
    orderDir,
    jumpToInsumoId, // 👈 importante para recargar al saltar
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    q,
    selectedRubroCodigo,
    vista,
    periodoKey,
    precioMode,
    totalMode,
    orderBy,
    orderDir,
  ]);

  useEffect(() => {
    setSelectedRubroCodigo(null);
    setPage(1);
  }, [businessId]);

  /* ========================= CRUD INSUMOS ========================= */

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", unidadMed: "", precioRef: "" });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      nombre: row.nombre || "",
      unidadMed: row.unidad_med || "",
      precioRef: row.precio_ref ?? "",
    });
    setOpen(true);
  };

  const closeModal = () => setOpen(false);

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de crear/editar insumos.");
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      unidadMed: form.unidadMed || null,
      precioRef: form.precioRef === "" ? null : Number(form.precioRef),
      origen: editing ? undefined : "manual",
      activo: editing ? undefined : true,
    };

    if (!payload.nombre) return alert("El nombre es obligatorio");

    if (editing) {
      await insumoUpdate(editing.id, payload);
    } else {
      await insumoCreate(payload);
    }

    closeModal();
    fetchData();
  };

  const eliminar = async (row) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de eliminar insumos.");
      return;
    }
    if (!window.confirm(`Desactivar "${row.nombre}"?`)) return;
    await insumoDelete(row.id);
    fetchData();
  };

  /* ====================== BULK / SYNC ====================== */

  const onBulkJSON = () => setOpenBulk(true);

  const handleBulkConfirm = async (array) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de usar carga masiva.");
      return;
    }
    await insumosBulkJSON(array);
    setOpenBulk(false);
    fetchData();
  };

  const onBulkCSV = async (e) => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de usar carga masiva CSV.");
      e.target.value = "";
      return;
    }
    const f = e.target.files?.[0];
    if (!f) return;
    await insumosBulkCSV(f);
    e.target.value = "";
    fetchData();
  };

  const handleSyncMaxi = async () => {
    if (!businessId) {
      alert("Seleccioná un negocio antes de sincronizar desde Maxi.");
      return;
    }
    if (
      !window.confirm(
        "¿Sincronizar insumos desde Maxi para el negocio activo?"
      )
    )
      return;
    await insumosSyncMaxi();
    await fetchData();
  };

  /* ========================= RENDER ========================= */

  const titulo = activeBusiness?.nombre
    ? `Insumos — ${activeBusiness.nombre}`
    : "Insumos";

  const vistaTabla = vista === "elab" ? "elaborados" : "no-elaborados";

  return (
    <div>
      <div className="tabla-header">
        <div className="tabla-header-left">
          <h2>{titulo}</h2>
        </div>

        <div className="tabla-header-right">
          <div
            className="filtros-fechas"
            style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}
          >
            <Button
              variant="contained"
              onClick={openCreate}
              disabled={!businessId}
            >
              + Nuevo
            </Button>

            <Button
              variant="outlined"
              onClick={onBulkJSON}
              disabled={!businessId}
            >
              Carga masiva (JSON)
            </Button>

            {/* Filtros de compras / vista */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Periodo</InputLabel>
              <Select
                label="Periodo"
                value={periodoKey}
                onChange={(e) => setPeriodoKey(e.target.value)}
              >
                <MenuItem value="mes-actual">Mes actual</MenuItem>
                <MenuItem value="ultimos-3-meses">Últimos 3 meses</MenuItem>
                <MenuItem value="ultimo-ano">Último año</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Columna Precio</InputLabel>
              <Select
                label="Columna Precio"
                value={precioMode}
                onChange={(e) => setPrecioMode(e.target.value)}
              >
                <MenuItem value="promedio">Promedio del periodo</MenuItem>
                <MenuItem value="ultima">Última compra</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Columna Total</InputLabel>
              <Select
                label="Columna Total"
                value={totalMode}
                onChange={(e) => setTotalMode(e.target.value)}
              >
                <MenuItem value="unidades">Unidades compradas</MenuItem>
                <MenuItem value="gastos">Total gastado</MenuItem>
                <MenuItem value="ratio">Ratio (ventas)</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Ordenar por</InputLabel>
              <Select
                label="Ordenar por"
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
              >
                <MenuItem value="total">Total</MenuItem>
                <MenuItem value="ratio">Ratio ventas</MenuItem>
                <MenuItem value="existe-receta">Existe en recetas</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Dirección</InputLabel>
              <Select
                label="Dirección"
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value)}
              >
                <MenuItem value="desc">Desc</MenuItem>
                <MenuItem value="asc">Asc</MenuItem>
              </Select>
            </FormControl>

            <label className="btn-file">
              <span
                style={{
                  padding: "6px 12px",
                  border: "1px solid #1976d2",
                  borderRadius: 6,
                  color: "#1976d2",
                  cursor: businessId ? "pointer" : "not-allowed",
                  opacity: businessId ? 1 : 0.5,
                }}
              >
                Carga masiva (CSV)
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={onBulkCSV}
                style={{ display: "none" }}
                disabled={!businessId}
              />
            </label>

            {/* 🔍 Buscador local de insumos */}
            <div style={{ minWidth: 260, maxWidth: 360 }}>
              <Buscador
                placeholder="Buscar insumo…"
                opciones={insumosSearchOptions}
                clearOnPick={false}
                autoFocusAfterPick
                onPick={(opt) => {
                  if (!opt?.id) return;
                  const id = Number(opt.id);
                  if (!Number.isFinite(id)) return;

                  // Aseguramos que sea visible:
                  setSelectedRubroCodigo(null);
                  setVista("all");
                  setSelectedGroupId(null);
                  setPage(1);

                  setJumpToInsumoId(id);
                  scheduleJump(id);
                }}
              />
            </div>
          </div>

          {groupsError && (
            <p
              style={{
                color: "salmon",
                fontSize: "0.8rem",
                marginTop: 4,
              }}
            >
              {groupsError}
            </p>
          )}
        </div>
      </div>

      {/* LAYOUT: sidebar + tabla */}
      <div className="articulos-layoutInsumos">
        <main className="tabla-articulos-wrapper">
          <div className="tabla-articulos-container">
            <aside className="sidebar-categorias">
              <InsumosSidebar
                selectedRubroCodigo={selectedRubroCodigo}
                onSelectRubroCodigo={setSelectedRubroCodigo}
                businessId={businessId}
                vista={
                  vista === "elab"
                    ? "elaborados"
                    : vista === "no-elab"
                    ? "no-elaborados"
                    : "todos"
                }
                onVistaChange={(v) => {
                  if (v === "elaborados") setVista("elab");
                  else if (v === "no-elaborados") setVista("no-elab");
                  else setVista("all");
                }}
                groups={groups}
                groupsLoading={groupsLoading}
                selectedGroupId={selectedGroupId}
                onSelectGroupId={handleSelectGroupId}
                favoriteGroupId={favoriteGroupId}
                onSetFavorite={handleSetFavoriteGroup}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
              />
            </aside>
            <section
              id="tabla-insumos-scroll"
              className="tabla-articulos-wrapper-inner"
            >
              <InsumosTable
                rows={rows}
                loading={loading}
                page={page}
                pagination={pagination}
                onPageChange={setPage}
                onEdit={openEdit}
                onDelete={eliminar}
                noBusiness={!businessId}
                vista={vistaTabla}
                groupedView={insumosViewMode === "por-rubro"}
                businessId={businessId}
                groups={groups}
                selectedGroupId={selectedGroupId}
                discontinuadosGroupId={null}
                onOpenGroupModalForInsumo={handleOpenGroupModalForInsumo}
                onCreateGroupFromRubro={handleOpenGroupModalForRubro}
                precioMode={precioMode}
                totalMode={totalMode}
                orderBy={orderBy}
                orderDir={orderDir}
              />
            </section>
          </div>

          {/* Modales */}
          <Dialog open={open} onClose={closeModal} fullWidth maxWidth="sm">
            <DialogTitle>
              {editing ? "Editar insumo" : "Nuevo insumo"}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {editing && (
                  <TextField
                    label="Código"
                    value={
                      editing.codigo_mostrar ||
                      (editing.codigo_maxi &&
                      editing.codigo_maxi.trim() !== ""
                        ? editing.codigo_maxi
                        : `INS-${editing.id}`)
                    }
                    InputProps={{ readOnly: true }}
                  />
                )}
                <TextField
                  label="Nombre *"
                  value={form.nombre}
                  onChange={(e) => onChange("nombre", e.target.value)}
                />
                <TextField
                  select
                  label="Unidad de medida"
                  value={form.unidadMed}
                  onChange={(e) => onChange("unidadMed", e.target.value)}
                >
                  <MenuItem value="">(sin unidad)</MenuItem>
                  {UNIDADES.map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Precio ref"
                  type="number"
                  value={form.precioRef}
                  onChange={(e) => onChange("precioRef", e.target.value)}
                  inputProps={{ step: "0.01" }}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button variant="contained" onClick={save}>
                Guardar
              </Button>
            </DialogActions>
          </Dialog>

          <BulkJsonModal
            open={openBulk}
            onClose={() => setOpenBulk(false)}
            onConfirm={handleBulkConfirm}
            example={`[
  { "nombre": "Harina 000", "unidadMed": "kg", "precioRef": 1200 },
  { "nombre": "Leche entera", "unidadMed": "lt", "precioRef": 950 }
]`}
          />
          <InsumoGroupModal
            open={groupModalOpen}
            originRubroLabel={groupModalRubroLabel}
            onClose={handleCloseGroupModal}
            insumo={groupModalInsumo}
            businessId={businessId}
            groups={groups}
            initialGroupId={groupModalInitialGroupId}
            onGroupsReload={loadGroups}
          />
        </main>
      </div>
    </div>
  );
}
