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

/* ================== ✅ NUEVO: resolveInsumoMonto ================== */
/**
 * Devuelve el monto total gastado de un insumo
 * Prioridad: total_gastos_periodo > total_gastos > importe_total > fallback qty*precio
 */
const resolveInsumoMonto = (insumo, metaById) => {
  if (!insumo) return 0;

  // Usar campos directos del insumo
  const monto = Number(
    insumo.total_gastos_periodo ??
    insumo.total_gastos ??
    insumo.importe_total ??
    insumo.monto ??
    0
  );

  if (Number.isFinite(monto) && monto !== 0) return monto;

  // Fallback: qty * precio
  const qty = Number(insumo.unidades_compradas ?? insumo.total_unidades ?? 0);
  const precio = Number(insumo.precio_ref ?? insumo.precio ?? 0);

  if (Number.isFinite(qty) && Number.isFinite(precio)) {
    return qty * precio;
  }

  // Si metaById está disponible, intentar desde ahí
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

const InsumosTable = forwardRef(function InsumosTable({
  rows = [],
  loading = false,
  onEdit,
  onDelete,
  noBusiness = false,
  vista = "no-elaborados",
  businessId,          // siempre el principal (para CRUD de grupos)
  originalBusinessId,  // el subnegocio si aplica (para Discontinuados y items)
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
  businesses = [],  // ✅ todos los negocios de la org (para selector en modal de compras)
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

    return () => {
      canceled = true;
    };
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

  // Código | Nombre | U.med | Precio | %Desp | Total | Cant.comprada | Neto | IVA | Total compras | Acciones
  const GRID_NO_ELAB = ".4fr 2fr .45fr .7fr .5fr .65fr 1fr .4fr"
  const GRID_ELAB = ".4fr 2fr .45fr .7fr .6fr .7fr  .6fr .6fr .55fr .65fr .4fr";

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
      const v = r.precio_promedio_periodo ?? r.precio_promedio ?? base;
      return v;
    }

    if (precioMode === "ultima") {
      const v = r.precio_ultima_compra ?? r.precio_ultimo ?? base;
      return v;
    }

    return base;
  };

  const getTotalRaw = (r) => {
    switch (totalMode) {
      case "unidades":
        return (
          r.total_unidades_periodo ??
          r.unidades_compradas ??
          r.total_unidades ??
          null
        );
      case "gastos":
        return (
          r.total_gastos_periodo ??
          r.total_gastos ??
          r.importe_total ??
          null
        );
      case "ratio":
        return r.ratio_ventas ?? r.ratio ?? r.relacion_ventas ?? null;
      default:
        return null;
    }
  };

  const renderTotalValue = (r) => {
    const raw = getTotalRaw(r);
    if (raw == null) return "-";

    if (totalMode === "unidades") {
      return formatNumber(raw, 0);
    }
    if (totalMode === "gastos") {
      return formatMoney(raw, 2);
    }
    if (totalMode === "ratio") {
      return formatNumber(raw, 2);
    }
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

  const colStyle = (key) => ({
    cursor: "pointer",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  });

  const getSortValue = (r) => {
    switch (sortBy) {
      case "codigo":
        return Number(r.codigo_maxi ?? r.id ?? 0);
      case "nombre":
        return String(r.nombre || "").toLowerCase();
      case "precio":
        return num(getDisplayedPrice(r));
      case "fecha":
        return new Date(r.updated_at || r.created_at || 0).getTime();
      default:
        return 0;
    }
  };

  const sortedRows = useMemo(() => {
    const getSortValueLocal = (r) => {
      switch (sortBy) {
        case "codigo":
          return Number(r.codigo_maxi ?? r.id ?? 0);
        case "nombre":
          return String(r.nombre || "").toLowerCase();
        case "unidad":
          return String(r.unidad_med || "").toLowerCase();
        case "precio": {
          const base = num(r.precio_ref ?? r.precio ?? r.precio_unitario);
          const v =
            precioMode === "promedio"
              ? (r.precio_promedio_periodo ?? r.precio_promedio ?? base)
              : precioMode === "ultima"
                ? (r.precio_ultima_compra ?? r.precio_ultimo ?? base)
                : base;
          return num(v) ?? 0;
        }
        case "desperdicio":
          return num(r.desperdicio ?? r.pct_desperdicio ?? 0) ?? 0;
        case "total":
          return num(
            r.total_gastos_periodo ?? r.total_gastos ?? r.importe_total ??
            r.total_unidades_periodo ?? r.unidades_compradas ?? r.total_unidades ?? 0
          ) ?? 0;
        case "cant_comprada": {
          const c = comprasMap.get(Number(r.id));
          return num(c?.cantidad ?? 0) ?? 0;
        }
        case "neto_compras": {
          const c = comprasMap.get(Number(r.id));
          return num(c?.neto ?? 0) ?? 0;
        }
        case "iva_compras": {
          const c = comprasMap.get(Number(r.id));
          return num(c?.iva ?? 0) ?? 0;
        }
        case "total_compras": {
          const c = comprasMap.get(Number(r.id));
          return c ? (num(c.neto ?? 0) ?? 0) + (num(c.iva ?? 0) ?? 0) : 0;
        }
        case "fecha":
          return new Date(r.updated_at || r.created_at || 0).getTime();
        default:
          return 0;
      }
    };

    const arr = [...rows];
    arr.sort((a, b) => {
      const va = getSortValueLocal(a);
      const vb = getSortValueLocal(b);

      if (typeof va === "string" || typeof vb === "string") {
        const r = String(va).localeCompare(String(vb), "es", {
          sensitivity: "base",
          numeric: true,
        });
        return sortDir === "asc" ? r : -r;
      }

      const na = Number(va ?? 0);
      const nb = Number(vb ?? 0);
      return sortDir === "asc" ? na - nb : nb - na;
    });

    return arr;
  }, [rows, sortBy, sortDir, precioMode, comprasMap]);

  /* ================== ✅ NUEVO: groupedRows con __ventasMonto ================== */
  const groupedRows = useMemo(() => {
    const map = new Map();

    for (const r of sortedRows) {
      const rubroLabel = getRubroLabel(r);
      if (!map.has(rubroLabel)) {
        map.set(rubroLabel, []);
      }
      map.get(rubroLabel).push(r);
    }

    // Convertir a array y calcular monto por rubro
    const groups = Array.from(map.entries()).map(([label, groupRows]) => {
      let ventasMonto = 0;

      groupRows.forEach((r) => {
        ventasMonto += resolveInsumoMonto(r, metaById);
      });

      return {
        label,
        rows: groupRows,
        __ventasMonto: ventasMonto,
      };
    });

    // ✅ Ordenar grupos según el criterio del usuario
    // Por defecto (sin sort activo o monto) → por __ventasMonto desc
    // Con sort activo → por el valor del primer insumo del grupo en esa columna
    groups.sort((a, b) => {
      // Si el sort es por monto o no hay criterio, usar monto descendente
      if (!sortBy || sortBy === 'monto') {
        if ((b.__ventasMonto || 0) !== (a.__ventasMonto || 0)) {
          return (b.__ventasMonto || 0) - (a.__ventasMonto || 0);
        }
        return String(a.label).localeCompare(String(b.label), "es", { sensitivity: "base", numeric: true });
      }

      // Con sort activo: tomar el valor representativo del grupo
      // (primer insumo ya ordenado dentro del grupo)
      const repA = a.rows[0];
      const repB = b.rows[0];
      if (!repA || !repB) return 0;

      const getSortValueGroup = (r) => {
        switch (sortBy) {
          case "codigo": return Number(r.codigo_maxi ?? r.id ?? 0);
          case "nombre": return String(r.nombre || "").toLowerCase();
          case "unidad": return String(r.unidad_med || "").toLowerCase();
          case "precio": {
            const base = num(r.precio_ref ?? r.precio ?? r.precio_unitario);
            const v = precioMode === "promedio"
              ? (r.precio_promedio_periodo ?? r.precio_promedio ?? base)
              : precioMode === "ultima"
                ? (r.precio_ultima_compra ?? r.precio_ultimo ?? base)
                : base;
            return num(v) ?? 0;
          }
          case "desperdicio": return num(r.desperdicio ?? r.pct_desperdicio ?? 0) ?? 0;
          case "total": return num(r.total_gastos_periodo ?? r.total_gastos ?? r.importe_total ?? r.total_unidades_periodo ?? 0) ?? 0;
          case "cant_comprada": { const c = comprasMap.get(Number(r.id)); return num(c?.cantidad ?? 0) ?? 0; }
          case "neto_compras": { const c = comprasMap.get(Number(r.id)); return num(c?.neto ?? 0) ?? 0; }
          case "iva_compras": { const c = comprasMap.get(Number(r.id)); return num(c?.iva ?? 0) ?? 0; }
          case "total_compras": { const c = comprasMap.get(Number(r.id)); return c ? (num(c.neto ?? 0) ?? 0) + (num(c.iva ?? 0) ?? 0) : 0; }
          case "fecha": return new Date(r.updated_at || r.created_at || 0).getTime();
          default: return 0;
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
  }, [sortedRows, getRubroLabel, metaById, sortBy, sortDir, precioMode, comprasMap]);

  /* ================== ✅ flatRows con __ventasMonto ================== */
  const flatRows = useMemo(() => {
    const out = [];

    groupedRows.forEach((group) => {
      out.push({
        type: "rubro",
        label: group.label,
        rows: group.rows,
        key: `rubro-${group.label || "sin-rubro"}`,
        __ventasMonto: group.__ventasMonto || 0, // ✅ propagamos el monto
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

  /* ================== ✅ idToIndex ================== */
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

      // todavía no existe el índice (render no terminó / cambió grupo)
      if (index == null) {
        jumpTriesRef.current += 1;
        if (jumpTriesRef.current > 25) {
          pendingJumpRef.current = null;
          return;
        }
        setTimeout(tick, 80);
        return;
      }

      // ✅ scroll real: VirtualList
      if (listRef.current?.scrollToIndex) {
        listRef.current.scrollToIndex(index);
      }

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

      // todavía no existe en la lista actual (cambio de grupo / refresh)
      if (idx == null) {
        jumpTriesRef.current += 1;
        if (jumpTriesRef.current > 25) {
          pendingJumpRef.current = null;
          return;
        }
        setTimeout(tick, 80);
        return;
      }

      // ✅ ahora sí: scrollear
      listRef.current?.scrollToIndex?.(idx);

      // opcional: volver a intentar 1 vez más por si VirtualList necesita un frame
      setTimeout(() => listRef.current?.scrollToIndex?.(idx), 60);

      pendingJumpRef.current = null;
    };

    const t0 = setTimeout(tick, 40);
    return () => clearTimeout(t0);
  }, [idToIndex]);

  const lastIndexSigRef = useRef("");

  useEffect(() => {
    if (!onIdToIndexChange) return;

    // firma barata: size + primer id + último id
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
        jumpToInsumoId,
        foundIndex: idx,
        flatRowsLength: flatRows.length,
        mapSize: idToIndex.size
      });
    }
  }, [jumpToInsumoId, idToIndex, flatRows.length]);

  const grupoSeleccionado = useMemo(() => {
    if (!selectedGroupId) return null;
    const n = Number(selectedGroupId);
    if (!Number.isFinite(n)) return null;
    return (groups || []).find((g) => Number(g.id) === n) || null;
  }, [groups, selectedGroupId]);

  const nombreGrupoSeleccionado = grupoSeleccionado?.nombre || "";

  const isGrupoDiscontinuados = !!grupoSeleccionado && esDiscontinuadosGroup(grupoSeleccionado);

  const isTodoView =
    todoGroupId && selectedGroupId && Number(selectedGroupId) === Number(todoGroupId);

  if (loading) {
    return <p style={{ padding: 16 }}>Cargando insumos...</p>;
  }

  const ITEM_HEIGHT = 48;

  return (
    <div className="tabla-articulos-inner" style={{ height: '100%' }}>
      <div
        style={{
          height: '100%',
          width: "100%",
          position: "relative",
        }}
      >
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
                <div>Precio final desp. ($)</div>
                <div onClick={() => toggleSort("total")} className="col-sortable">
                  {totalHeaderLabel} {sortIcon("total")}
                </div>
                <div>Vencimiento</div>
                <div>¿En recetas?</div>
                <div onClick={() => toggleSort("fecha")} className="col-sortable">
                  Fecha {sortIcon("fecha")}
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
              // ✅ HEADER DE RUBRO con totales
              if (row.type === "rubro") {
                const totalQty = row.rows.reduce((acc, r) => {
                  const qty = Number(
                    r.total_unidades_periodo ??
                    r.unidades_compradas ??
                    r.total_unidades ??
                    0
                  );
                  return acc + qty;
                }, 0);

                const totalAmount = row.__ventasMonto || 0;

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
                      <span>{row.label || "Sin rubro"}</span>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <small style={{ opacity: 0.7 }}>
                          {formatNumber(totalQty, 0)} u. · {formatMoney(totalAmount, 0)}
                        </small>
                        <InsumoRubroAccionesMenu
                          rubroLabel={row.label || "Sin rubro"}
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
                          businessId={originalBusinessId || businessId}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              // FILA DE INSUMO
              const r = row.data;

              const isJumping = jumpToInsumoId != null && Number(r.id) === Number(jumpToInsumoId);
              const isSelected = Number(r.id) === Number(selectedInsumoId);
              const shouldHighlight = jumpToInsumoId && Number(r.id) === Number(jumpToInsumoId);

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
                  {isSelected && (
                    <div className="row-left-bar" />
                  )}
                  <div>{displayCode(r)}</div>
                  <div title={r.nombre}>{r.nombre}</div>
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
                  <div>-</div>
                  <div>{renderTotalValue(r)}</div>
                  {/* ── Columna de compras ── */}
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
                      onCreateGroupFromInsumo={onOpenGroupModalForInsumo}
                      businessId={originalBusinessId || businessId}
                    />
                  </div>
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