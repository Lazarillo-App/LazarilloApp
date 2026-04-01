/* eslint-disable no-unused-vars */
// src/componentes/InsumosTable.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef, forwardRef } from "react";
import InsumoAccionesMenu from "./InsumoAccionesMenu";
import InsumoRubroAccionesMenu from "./InsumoRubroAccionesMenu";
import { insumosRubrosList } from "../servicios/apiInsumos";
import VirtualList from "./shared/VirtualList";
import ComprasCell from './ComprasCell';

const num = (v) => (v == null || v === "" ? null : Number(v));
const norm = (s) => String(s || "").trim().toLowerCase();

const formatMoney = (v, d = 2) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return `$ ${n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
};

const formatNumber = (v, d = 0) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

const formatDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("es-AR");
};

const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return (
    n === 'todo' ||
    n === 'sin agrupacion' ||
    n === 'sin agrupación' ||
    n === 'sin agrupar' ||
    n === 'sin grupo'
  );
};

const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

const resolveInsumoMonto = (insumo, metaById) => {
  if (!insumo) return 0;

  const monto = Number(
    insumo.total_gastos_periodo ??
    insumo.total_gastos ??
    insumo.importe_total ??
    insumo.monto ??
    0
  );

  if (Number.isFinite(monto) && monto !== 0) return monto;

  const qty = Number(insumo.unidades_compradas ?? insumo.total_unidades ?? 0);
  const precio = Number(insumo.precio_ref ?? insumo.precio ?? 0);

  if (Number.isFinite(qty) && Number.isFinite(precio)) {
    return qty * precio;
  }

  if (metaById && typeof metaById.get === 'function') {
    const id = Number(insumo.id);
    if (Number.isFinite(id)) {
      const meta = metaById.get(id);
      if (meta) {
        const metaMonto = Number(
          meta.total_gastos_periodo ?? meta.total_gastos ?? meta.importe_total ?? 0
        );
        if (Number.isFinite(metaMonto) && metaMonto !== 0) return metaMonto;

        const metaQty = Number(meta.unidades_compradas ?? meta.total_unidades ?? 0);
        const metaPrecio = Number(meta.precio ?? 0);
        if (Number.isFinite(metaQty) && Number.isFinite(metaPrecio)) {
          return metaQty * metaPrecio;
        }
      }
    }
  }

  return 0;
};

// Calcula el estado elaborado real de un grupo de insumos
// Retorna: 'all' | 'some' | 'none'
function calcElaboradoState(rows = []) {
  if (!rows.length) return 'none';
  const count = rows.filter(r => r.es_elaborado === true).length;
  if (count === 0) return 'none';
  if (count === rows.length) return 'all';
  return 'some'; // mixto
}

// ── Ícono de receta (libro pequeño SVG inline) ─────────────────────────────
function RecetaIcon({ filled = false, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={filled ? 'var(--color-primary, #3b82f6)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      {filled && <path d="M9 7h6M9 11h6M9 15h4" stroke="var(--color-primary, #3b82f6)" />}
    </svg>
  );
}

const InsumosTable = forwardRef(function InsumosTable({
  rows = [],
  loading = false,
  onEdit,
  onDelete,
  noBusiness = false,
  vista = "no-elaborados",
  businessId,
  originalBusinessId,
  groups = [],
  selectedGroupId = null,
  discontinuadosGroupId = null,
  onOpenGroupModalForInsumo,
  onCreateGroupFromRubro,
  rubrosMap = new Map(),
  onRefetch,
  onMutateGroups,
  notify,
  todoGroupId = null,
  idsSinAgrup = [],
  onReloadCatalogo,
  forceRefresh,
  precioMode = "promedio",
  totalMode = "gastos",
  orderBy,
  orderDir,
  jumpToInsumoId = null,
  selectedInsumoId = null,
  onIdToIndexChange,
  metaById,
  getAmountForId,
  comprasMap = new Map(),
  comprasLoading = false,
  rangoCompras = null,
  businesses = [],
  branches = [],
  comprasMapByBranch = {},
  onAfterToggleElaborado,
  onAfterToggleElaboradoBulk,
  // ── Nuevas props para recetas de elaborados ──────────────────────────────
  // Callback: (insumo) => void — abre RecetaModal para ese insumo elaborado
  onOpenRecetaElaborado,
  // Mapa de recetas ya cargadas: { [supplyId]: { costoTotal, porciones, precioSugerido } }
  recetasElaborados = {},
}, ref) {
  const isElaborados = vista === "elaborados";
  const listRef = useRef(null);
  const [rubros, setRubros] = useState([]);

  useEffect(() => {
    if (!businessId) {
      setRubros([]);
      return;
    }

    let canceled = false;

    (async () => {
      try {
        const res = await insumosRubrosList(businessId);
        if (!canceled) {
          setRubros(res.items || []);
        }
      } catch (e) {
        if (!canceled) {
          console.error("[InsumosTable] Error cargando rubros:", e);
          setRubros([]);
        }
      }
    })();

    return () => { canceled = true; };
  }, [businessId]);

  const handleAfterAction = useCallback(async () => {
    console.log('🔄 [InsumosTable] Acción completada, iniciando refresh...');

    try {
      console.log('🔄 [1/3] Recargando catálogo...');
      await onReloadCatalogo?.();

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🔄 [2/3] Recargando datos...');
      await onRefetch?.();

      console.log('🔄 [3/3] Forzando re-render...');
      forceRefresh?.();

      console.log('✅ Refresh completado');
    } catch (e) {
      console.error('[handleAfterAction] Error:', e);
    }
  }, [onReloadCatalogo, onRefetch, forceRefresh]);

  const rubroNombreMap = useMemo(() => {
    const m = new Map();
    (rubros || []).forEach((r) => {
      if (r && r.codigo != null) {
        m.set(String(r.codigo), r.nombre || "");
      }
    });
    return m;
  }, [rubros]);

  const rubroNombreToInfo = useMemo(() => {
    const m = new Map();
    rubrosMap.forEach((info) => {
      if (info?.nombre) m.set(info.nombre, info);
    });
    return m;
  }, [rubrosMap]);

  const getRubroLabel = useCallback(
    (row) => {
      const code =
        row?.rubro_codigo ?? row?.rubroCodigo ?? row?.codigo_rubro ?? row?.rubro ?? null;

      if (code != null) {
        const rubroInfo = rubrosMap.get(String(code));
        if (rubroInfo?.nombre) return rubroInfo.nombre;
      }

      return row?.rubro_nombre || row?.rubroNombre || (code != null ? `Rubro ${code}` : "Sin rubro");
    },
    [rubrosMap]
  );

  const branchExtraCols = branches && branches.length > 1
    ? branches.map(() => '.55fr').join(' ')
    : '';
  const GRID_NO_ELAB = branches && branches.length > 1
    ? `.4fr 2fr .45fr .7fr .5fr .65fr ${branchExtraCols} 1fr .4fr`
    : ".4fr 2fr .45fr .7fr .5fr .65fr 1fr .4fr";
  // En la vista elaborados agregamos columna "Receta" antes de acciones
  const GRID_ELAB = branches && branches.length > 1
    ? `.4fr 2fr .45fr .7fr 1fr .6fr .6fr ${branchExtraCols} 1fr .65fr .55fr .4fr`
    : ".4fr 2fr .45fr .7fr 1fr .6fr .6fr 1fr .65fr .55fr .4fr";

  const displayCode = (r) =>
    r.codigo_mostrar ||
    (r.codigo_maxi && String(r.codigo_maxi).trim() !== ""
      ? r.codigo_maxi
      : `INS-${r.id}`);

  const precioHeaderLabel =
    precioMode === "promedio"
      ? "Precio promedio ($)"
      : precioMode === "ultima"
        ? "Última compra ($)"
        : "Precio ($)";

  const totalHeaderLabel =
    totalMode === "unidades"
      ? "Total unidades (u.)"
      : totalMode === "gastos"
        ? "Total gastado ($)"
        : totalMode === "ratio"
          ? "Ratio ventas"
          : "Total";

  const getDisplayedPrice = (r) => {
    const base = num(r.precio_ref ?? r.precio ?? r.precio_unitario);

    if (precioMode === "promedio") {
      return r.precio_promedio_periodo ?? r.precio_promedio ?? base;
    }

    if (precioMode === "ultima") {
      return r.precio_ultima_compra ?? r.precio_ultimo ?? base;
    }

    return base;
  };

  const getTotalRaw = (r) => {
    switch (totalMode) {
      case "unidades":
        return r.total_unidades_periodo ?? r.unidades_compradas ?? r.total_unidades ?? null;
      case "gastos":
        return r.total_gastos_periodo ?? r.total_gastos ?? r.importe_total ?? null;
      case "ratio":
        return r.ratio_ventas ?? r.ratio ?? r.relacion_ventas ?? null;
      default:
        return null;
    }
  };

  const renderTotalValue = (r) => {
    const raw = getTotalRaw(r);
    if (raw == null) return "-";

    if (totalMode === "unidades") return formatNumber(raw, 0);
    if (totalMode === "gastos")   return formatMoney(raw, 2);
    if (totalMode === "ratio")    return formatNumber(raw, 2);
    return "-";
  };

  const [sortBy, setSortBy] = useState("nombre");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    setSortBy("nombre");
    setSortDir("asc");
  }, [vista]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key) => {
    if (sortBy !== key) return <span style={{ opacity: 0.25, fontSize: '0.75rem' }}>↕</span>;
    return <span style={{ fontSize: '0.85rem' }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const sortedRows = useMemo(() => {
    const getSortValueLocal = (r) => {
      switch (sortBy) {
        case "codigo":   return Number(r.codigo_maxi ?? r.id ?? 0);
        case "nombre":   return String(r.nombre || "").toLowerCase();
        case "unidad":   return String(r.unidad_med || "").toLowerCase();
        case "precio": {
          const base = num(r.precio_ref ?? r.precio ?? r.precio_unitario);
          const v = precioMode === "promedio"
            ? (r.precio_promedio_periodo ?? r.precio_promedio ?? base)
            : precioMode === "ultima"
              ? (r.precio_ultima_compra ?? r.precio_ultimo ?? base)
              : base;
          return num(v) ?? 0;
        }
        case "desperdicio":    return num(r.desperdicio ?? r.pct_desperdicio ?? 0) ?? 0;
        case "total":          return num(r.total_gastos_periodo ?? r.total_gastos ?? r.importe_total ?? r.total_unidades_periodo ?? r.unidades_compradas ?? r.total_unidades ?? 0) ?? 0;
        case "cant_comprada":  { const c = comprasMap.get(Number(r.id)); return num(c?.cantidad ?? 0) ?? 0; }
        case "neto_compras":   { const c = comprasMap.get(Number(r.id)); return num(c?.neto ?? 0) ?? 0; }
        case "iva_compras":    { const c = comprasMap.get(Number(r.id)); return num(c?.iva ?? 0) ?? 0; }
        case "total_compras":  { const c = comprasMap.get(Number(r.id)); return c ? (num(c.neto ?? 0) ?? 0) + (num(c.iva ?? 0) ?? 0) : 0; }
        case "fecha":          return new Date(r.updated_at || r.created_at || 0).getTime();
        default:               return 0;
      }
    };

    const arr = [...rows];
    arr.sort((a, b) => {
      const va = getSortValueLocal(a);
      const vb = getSortValueLocal(b);

      if (typeof va === "string" || typeof vb === "string") {
        const r = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
        return sortDir === "asc" ? r : -r;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return sortDir === "asc" ? na - nb : nb - na;
    });

    return arr;
  }, [rows, sortBy, sortDir, precioMode, comprasMap]);

  const groupedRows = useMemo(() => {
    const map = new Map();

    for (const r of sortedRows) {
      const rubroLabel = getRubroLabel(r);
      if (!map.has(rubroLabel)) {
        const infoByNombre = rubroNombreToInfo.get(rubroLabel);
        if (infoByNombre) {
          map.set(rubroLabel, { rows: [], codigo: String(infoByNombre.codigo), es_elaborador: infoByNombre.es_elaborador === true });
        } else {
          const rubroCodigo = String(r?.rubro_codigo ?? r?.rubro ?? '');
          const rubroInfo = rubroCodigo ? rubrosMap.get(rubroCodigo) : null;
          map.set(rubroLabel, { rows: [], codigo: rubroCodigo, es_elaborador: rubroInfo?.es_elaborador === true });
        }
      }
      map.get(rubroLabel).rows.push(r);
    }

    const groups = Array.from(map.entries()).map(([label, groupData]) => {
      const groupRows = groupData.rows;
      let ventasMonto = 0;
      groupRows.forEach((r) => { ventasMonto += resolveInsumoMonto(r, metaById); });

      return {
        label,
        codigo: groupData.codigo,
        es_elaborador: groupData.es_elaborador,
        rows: groupRows,
        __ventasMonto: ventasMonto,
      };
    });

    groups.sort((a, b) => {
      if (!sortBy || sortBy === 'monto') {
        if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0)) {
          return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
        }
        return String(a.label).localeCompare(String(b.label), "es", { sensitivity: "base", numeric: true });
      }

      const repA = a.rows[0];
      const repB = b.rows[0];
      if (!repA || !repB) return 0;

      const getSortValueGroup = (r) => {
        switch (sortBy) {
          case "codigo":   return Number(r.codigo_maxi ?? r.id ?? 0);
          case "nombre":   return String(r.nombre || "").toLowerCase();
          case "unidad":   return String(r.unidad_med || "").toLowerCase();
          case "precio": {
            const base = num(r.precio_ref ?? r.precio ?? r.precio_unitario);
            const v = precioMode === "promedio"
              ? (r.precio_promedio_periodo ?? r.precio_promedio ?? base)
              : precioMode === "ultima"
                ? (r.precio_ultima_compra ?? r.precio_ultimo ?? base)
                : base;
            return num(v) ?? 0;
          }
          case "desperdicio":    return num(r.desperdicio ?? r.pct_desperdicio ?? 0) ?? 0;
          case "total":          return num(r.total_gastos_periodo ?? r.total_gastos ?? r.importe_total ?? r.total_unidades_periodo ?? 0) ?? 0;
          case "cant_comprada":  { const c = comprasMap.get(Number(r.id)); return num(c?.cantidad ?? 0) ?? 0; }
          case "neto_compras":   { const c = comprasMap.get(Number(r.id)); return num(c?.neto ?? 0) ?? 0; }
          case "iva_compras":    { const c = comprasMap.get(Number(r.id)); return num(c?.iva ?? 0) ?? 0; }
          case "total_compras":  { const c = comprasMap.get(Number(r.id)); return c ? (num(c.neto ?? 0) ?? 0) + (num(c.iva ?? 0) ?? 0) : 0; }
          case "fecha":          return new Date(r.updated_at || r.created_at || 0).getTime();
          default:               return 0;
        }
      };

      const va = getSortValueGroup(repA);
      const vb = getSortValueGroup(repB);

      if (typeof va === "string" || typeof vb === "string") {
        const r = String(va).localeCompare(String(vb), "es", { sensitivity: "base", numeric: true });
        return sortDir === "asc" ? r : -r;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return sortDir === "asc" ? na - nb : nb - na;
    });

    return groups;
  }, [sortedRows, getRubroLabel, metaById, sortBy, sortDir, precioMode, comprasMap, rubrosMap, rubroNombreToInfo]);

  const flatRows = useMemo(() => {
    const out = [];

    groupedRows.forEach((group) => {
      const elaboradoState = calcElaboradoState(group.rows);

      out.push({
        type: "rubro",
        label: group.label,
        codigo: group.codigo,
        es_elaborador: group.es_elaborador,
        elaboradoState,
        isElaborado: elaboradoState !== 'none',
        isMixto: elaboradoState === 'some',
        rows: group.rows,
        key: `rubro-${group.label || "sin-rubro"}`,
        __ventasMonto: group.__ventasMonto || 0,
      });

      group.rows.forEach((r) => {
        out.push({
          type: "insumo",
          data: r,
          key: `insumo-${r.id}`,
        });
      });
    });

    return out;
  }, [groupedRows]);

  const idToIndex = useMemo(() => {
    const m = new Map();
    flatRows.forEach((row, i) => {
      if (row.type === "insumo") {
        const id = Number(row.data?.id);
        if (Number.isFinite(id)) m.set(id, i);
      }
    });
    return m;
  }, [flatRows]);

  const pendingJumpRef = useRef(null);
  const jumpTriesRef = useRef(0);

  useEffect(() => {
    if (!jumpToInsumoId) return;

    pendingJumpRef.current = Number(jumpToInsumoId);
    jumpTriesRef.current = 0;

    const tick = () => {
      const id = Number(pendingJumpRef.current);
      if (!Number.isFinite(id) || id <= 0) return;

      const index = idToIndex.get(id);

      if (index == null) {
        jumpTriesRef.current += 1;
        if (jumpTriesRef.current > 25) { pendingJumpRef.current = null; return; }
        setTimeout(tick, 80);
        return;
      }

      if (listRef.current?.scrollToIndex) listRef.current.scrollToIndex(index);
      pendingJumpRef.current = null;
    };

    const t0 = setTimeout(tick, 40);
    return () => clearTimeout(t0);
  }, [jumpToInsumoId, idToIndex]);

  useEffect(() => {
    const id = Number(pendingJumpRef.current);
    if (!Number.isFinite(id) || id <= 0) return;

    const tick = () => {
      const idx = idToIndex.get(id);
      if (idx == null) {
        jumpTriesRef.current += 1;
        if (jumpTriesRef.current > 25) { pendingJumpRef.current = null; return; }
        setTimeout(tick, 80);
        return;
      }
      listRef.current?.scrollToIndex?.(idx);
      setTimeout(() => listRef.current?.scrollToIndex?.(idx), 60);
      pendingJumpRef.current = null;
    };

    const t0 = setTimeout(tick, 40);
    return () => clearTimeout(t0);
  }, [idToIndex]);

  const lastIndexSigRef = useRef("");

  useEffect(() => {
    if (!onIdToIndexChange) return;
    const keys = Array.from(idToIndex.keys());
    const sig = `${idToIndex.size}|${keys[0] ?? ""}|${keys[keys.length - 1] ?? ""}`;
    if (sig === lastIndexSigRef.current) return;
    lastIndexSigRef.current = sig;
    onIdToIndexChange(idToIndex);
  }, [idToIndex, onIdToIndexChange]);

  useEffect(() => {
    if (jumpToInsumoId) {
      const idx = idToIndex.get(Number(jumpToInsumoId));
      console.log('📊 [InsumosTable] idToIndex lookup:', {
        jumpToInsumoId, foundIndex: idx,
        flatRowsLength: flatRows.length, mapSize: idToIndex.size
      });
    }
  }, [jumpToInsumoId, idToIndex, flatRows.length]);

  const grupoSeleccionado = useMemo(() => {
    if (!selectedGroupId) return null;
    const n = Number(selectedGroupId);
    if (!Number.isFinite(n)) return null;
    return (groups || []).find((g) => Number(g.id) === n) || null;
  }, [groups, selectedGroupId]);

  const isGrupoDiscontinuados = !!grupoSeleccionado && esDiscontinuadosGroup(grupoSeleccionado);

  const isTodoView =
    todoGroupId && selectedGroupId && Number(selectedGroupId) === Number(todoGroupId);

  if (loading) {
    return <p style={{ padding: 16 }}>Cargando insumos...</p>;
  }

  const ITEM_HEIGHT = 48;

  return (
    <div className="tabla-articulos-inner" style={{ height: '100%' }}>
      <div style={{ height: '100%', width: "100%", position: "relative" }}>
        {/* HEADER sticky */}
        <div className="table-col-header">
          <div
            className="table-col-header-inner"
            style={{ gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB, gap: 8 }}
          >
            <div onClick={() => toggleSort("codigo")} className="col-sortable">
              Código {sortIcon("codigo")}
            </div>
            <div onClick={() => toggleSort("nombre")} className="col-sortable">
              Nombre {sortIcon("nombre")}
            </div>
            <div onClick={() => toggleSort("unidad")} className="col-sortable">
              U. medida {sortIcon("unidad")}
            </div>
            <div onClick={() => toggleSort("precio")} className="col-sortable">
              {precioHeaderLabel} {sortIcon("precio")}
            </div>

            {isElaborados ? (
              <>
                <div>Precio final</div>
                <div onClick={() => toggleSort("total")} className="col-sortable">
                  {totalHeaderLabel} {sortIcon("total")}
                </div>
                <div>Vencimiento</div>
                <div>¿En recetas?</div>
                <div onClick={() => toggleSort("fecha")} className="col-sortable">
                  Fecha {sortIcon("fecha")}
                </div>
                {/* ── Nueva columna: Receta del elaborado ── */}
                <div style={{ textAlign: "center" }} title="Receta de producción del elaborado">
                  Receta
                </div>
                <div style={{ textAlign: "center" }}>Acciones</div>
              </>
            ) : (
              <>
                <div onClick={() => toggleSort("desperdicio")} className="col-sortable">
                  % Desperdicio {sortIcon("desperdicio")}
                </div>
                <div onClick={() => toggleSort("total")} className="col-sortable">
                  {totalHeaderLabel} {sortIcon("total")}
                </div>
                <div
                  onClick={() => toggleSort("total_compras")}
                  className="col-sortable"
                  style={{ color: comprasLoading ? 'var(--color-border)' : 'var(--color-primary)', fontSize: '0.85rem' }}
                  title="Total compras del período (clic para ver detalle)"
                >
                  Compras{comprasLoading ? ' ⟳' : ''} ($) {sortIcon("total_compras")}
                </div>
                {branches && branches.length > 1 && branches.map(branch => (
                  <div
                    key={branch.id}
                    style={{ fontSize: '0.7rem', fontWeight: 700, textAlign: 'center', color: branch.color || 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={`Compras — ${branch.name}`}
                  >
                    {branch.name}
                  </div>
                ))}
                <div style={{ textAlign: "center" }}>Acciones</div>
              </>
            )}
          </div>
        </div>

        {/* CONTENIDO (virtualizado) */}
        {flatRows.length === 0 ? (
          <div style={{ padding: 16, color: "#777" }}>
            {noBusiness
              ? "Seleccioná un negocio para ver sus insumos."
              : "No hay insumos en este filtro."}
          </div>
        ) : (
          <VirtualList
            ref={listRef}
            rows={flatRows}
            rowHeight={ITEM_HEIGHT}
            overscan={10}
            height={
              typeof window !== "undefined"
                ? Math.max(300, window.innerHeight - 220)
                : 600
            }
            getRowId={(row) => {
              if (row?.type === "insumo") {
                const id = Number(row?.data?.id);
                return Number.isFinite(id) ? id : null;
              }
              return null;
            }}
            renderRow={({ row, style }) => {
              // ── HEADER DE RUBRO ──
              if (row.type === "rubro") {
                return (
                  <div
                    className="table-section-row"
                    style={{
                      ...style,
                      display: "grid",
                      alignItems: "center",
                      gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB,
                    }}
                  >
                    <div />
                    <div
                      style={{
                        gridColumn: "2 / -1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {row.label || "Sin rubro"}
                        {row.isMixto && (
                          <span
                            title="Este rubro tiene insumos elaborados y no elaborados mezclados"
                            style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--color-warning, #f59e0b)', opacity: 0.8 }}
                          >
                            ⚡ mixto
                          </span>
                        )}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <InsumoRubroAccionesMenu
                          rubroLabel={row.label || "Sin rubro"}
                          rubroCodigo={row.codigo || null}
                          isElaborado={row.isElaborado}
                          isMixto={row.isMixto}
                          elaboradoState={row.elaboradoState}
                          insumoIds={row.rows.map((r) => r.id)}
                          groups={groups}
                          selectedGroupId={selectedGroupId}
                          discontinuadosGroupId={discontinuadosGroupId}
                          onRefetch={handleAfterAction}
                          notify={notify}
                          onMutateGroups={onMutateGroups}
                          onCreateGroupFromRubro={onCreateGroupFromRubro}
                          todoGroupId={todoGroupId}
                          isTodoView={isTodoView}
                          onReloadCatalogo={onReloadCatalogo}
                          onAfterAction={handleAfterAction}
                          onAfterRubroUpdate={handleAfterAction}
                          businessId={originalBusinessId || businessId}
                          onAfterToggleElaboradoBulk={onAfterToggleElaboradoBulk}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // ── FILA DE INSUMO ──
              const r = row.data;

              const isSelected = Number(r.id) === Number(selectedInsumoId);
              const shouldHighlight = jumpToInsumoId && Number(r.id) === Number(jumpToInsumoId);

              // Datos de receta del elaborado (si existe)
              const recetaData = r.es_elaborado ? (recetasElaborados[String(r.id)] || recetasElaborados[Number(r.id)]) : null;
              const tieneReceta = !!recetaData && recetaData.costoTotal > 0;

              return (
                <div
                  data-insumo-id={r.id}
                  className={`table-item-row${isSelected ? " is-selected" : ""}${shouldHighlight ? " highlight-jump" : ""}`}
                  style={{
                    ...style,
                    display: "grid",
                    alignItems: "center",
                    gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB,
                    fontSize: "0.9rem",
                    gap: 8,
                    ...(isSelected ? { position: "relative" } : {}),
                  }}
                >
                  {isSelected && <div className="row-left-bar" />}
                  <div>{displayCode(r)}</div>

                  {/* Nombre: con indicador si tiene receta cargada */}
                  <div title={r.nombre} style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    {r.es_elaborado && (
                      <span
                        title={tieneReceta ? `Elaborado — costo $${recetaData.costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 2 })}` : 'Elaborado sin receta'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          fontSize: '0.65rem', fontWeight: 700,
                          background: tieneReceta ? 'var(--color-primary, #3b82f6)' : '#e2e8f0',
                          color: tieneReceta ? '#fff' : '#94a3b8',
                        }}
                      >
                        {tieneReceta ? '●' : '○'}
                      </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.nombre}
                    </span>
                  </div>

                  <div>{r.unidad_med || "-"}</div>
                  <div
                    title={
                      r.precio_promedio
                        ? `Promedio compras 90d: ${formatMoney(r.precio_promedio, 4)}\nÚltima compra: ${formatMoney(r.precio_ultima_compra, 4)}`
                        : 'Precio de referencia (sin compras registradas)'
                    }
                    style={{ cursor: 'help' }}
                  >
                    {formatMoney(getDisplayedPrice(r), 2)}
                    {r.precio_promedio && Math.abs(Number(r.precio_promedio) - Number(r.precio_ref)) / (Number(r.precio_ref) || 1) > 0.05 && (
                      <span title="Diferencia >5% entre precio ref y promedio de compras" style={{ color: '#f59e0b', marginLeft: 3, fontSize: '0.75rem' }}>⚠</span>
                    )}
                  </div>

                  {isElaborados ? (
                    <>
                      {/* Precio final (de receta si existe, o precio_ref) */}
                      <div style={{ fontWeight: tieneReceta ? 700 : 400, color: tieneReceta ? 'var(--color-primary, #3b82f6)' : 'inherit' }}>
                        {tieneReceta
                          ? formatMoney(recetaData.costoTotal / (recetaData.porciones || 1), 2)
                          : formatMoney(getDisplayedPrice(r), 2)
                        }
                      </div>
                      <div>{renderTotalValue(r)}</div>
                      <div>{r.vencimiento ? formatDate(r.vencimiento) : "-"}</div>
                      <div>{r.en_recetas != null ? (r.en_recetas > 0 ? `${r.en_recetas} recetas` : "-") : "-"}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {formatDate(r.updated_at || r.created_at)}
                      </div>

                      {/* ── Columna Receta: botón para abrir RecetaModal del elaborado ── */}
                      <div style={{ textAlign: "center" }}>
                        {onOpenRecetaElaborado ? (
                          <button
                            onClick={() => onOpenRecetaElaborado(r)}
                            title={tieneReceta ? `Ver/editar receta — costo $${(recetaData.costoTotal / (recetaData.porciones || 1)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}/u` : 'Cargar receta de producción'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              gap: 4,
                              border: 'none', borderRadius: 6,
                              padding: '3px 8px',
                              cursor: 'pointer',
                              fontSize: '0.72rem', fontWeight: 600,
                              background: tieneReceta
                                ? 'color-mix(in srgb, var(--color-primary, #3b82f6) 12%, transparent)'
                                : '#f1f5f9',
                              color: tieneReceta
                                ? 'var(--color-primary, #3b82f6)'
                                : '#64748b',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = tieneReceta ? 'color-mix(in srgb, var(--color-primary, #3b82f6) 22%, transparent)' : '#e2e8f0'}
                            onMouseLeave={e => e.currentTarget.style.background = tieneReceta ? 'color-mix(in srgb, var(--color-primary, #3b82f6) 12%, transparent)' : '#f1f5f9'}
                          >
                            <RecetaIcon filled={tieneReceta} size={12} />
                            {tieneReceta ? 'Ver receta' : 'Cargar'}
                          </button>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.72rem' }}>—</span>
                        )}
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <InsumoAccionesMenu
                          insumo={r}
                          groups={groups}
                          selectedGroupId={selectedGroupId}
                          discontinuadosGroupId={discontinuadosGroupId}
                          todoGroupId={todoGroupId}
                          onRefetch={handleAfterAction}
                          onReloadCatalogo={onReloadCatalogo}
                          notify={notify}
                          onMutateGroups={onMutateGroups}
                          onAfterMutation={handleAfterAction}
                          onAfterToggleElaborado={onAfterToggleElaborado}
                          onCreateGroupFromInsumo={onOpenGroupModalForInsumo}
                          businessId={originalBusinessId || businessId}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>-</div>
                      <div>{renderTotalValue(r)}</div>
                      <ComprasCell
                        insumoId={r.id}
                        insumoNombre={r.nombre}
                        insumoUnidad={r.unidad_med || ''}
                        comprasEntry={comprasMap.get(Number(r.id))}
                        from={rangoCompras?.from}
                        to={rangoCompras?.to}
                        businessId={originalBusinessId || businessId}
                        businesses={businesses}
                        loading={comprasLoading}
                      />
                      {branches && branches.length > 1 && branches.map(branch => {
                        const bMap = comprasMapByBranch[branch.id] || comprasMapByBranch[String(branch.id)];
                        const bEntry = bMap ? bMap.get(Number(r.id)) : null;
                        const bTotal = bEntry ? (Number(bEntry.neto ?? 0) + Number(bEntry.iva ?? 0)) : 0;
                        return (
                          <div
                            key={branch.id}
                            style={{ fontSize: '0.78rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: bTotal > 0 ? (branch.color || 'var(--color-primary)') : '#94a3b8', paddingRight: 4 }}
                          >
                            {bTotal > 0 ? `$${bTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'}
                          </div>
                        );
                      })}
                      <div style={{ textAlign: "center" }}>
                        <InsumoAccionesMenu
                          insumo={r}
                          groups={groups}
                          selectedGroupId={selectedGroupId}
                          discontinuadosGroupId={discontinuadosGroupId}
                          todoGroupId={todoGroupId}
                          onRefetch={handleAfterAction}
                          onReloadCatalogo={onReloadCatalogo}
                          notify={notify}
                          onMutateGroups={onMutateGroups}
                          onAfterMutation={handleAfterAction}
                          onAfterToggleElaborado={onAfterToggleElaborado}
                          onCreateGroupFromInsumo={onOpenGroupModalForInsumo}
                          businessId={originalBusinessId || businessId}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
});

export default InsumosTable;