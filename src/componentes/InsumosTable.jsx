/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// src/componentes/InsumosTable.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import InsumoAccionesMenu from "./InsumoAccionesMenu";
import InsumoRubroAccionesMenu from "./InsumoRubroAccionesMenu";
import { insumosRubrosList } from "../servicios/apiInsumos";
import VirtualList from "./shared/VirtualList";

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

export default function InsumosTable({
  listRef,  // 🆕 AGREGADO: recibir listRef desde InsumosMain
  rows = [],
  loading = false,
  onEdit,
  onDelete,
  noBusiness = false,
  vista = "no-elaborados",
  businessId,
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
}) {
  const isElaborados = vista === "elaborados";

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

  const getRubroLabel = (row) => {
    const code = row.rubro_codigo ?? row.rubroCodigo ?? row.codigo_rubro ?? row.rubro ?? null;

    if (code != null) {
      const rubroInfo = rubrosMap.get(String(code));
      if (rubroInfo?.nombre) {
        return rubroInfo.nombre;
      }
    }

    return row.rubro_nombre || row.rubroNombre || (code != null ? `Rubro ${code}` : "Sin rubro");
  };

  const GRID_NO_ELAB = ".4fr 1.2fr .5fr .6fr .5fr .5fr .6fr .6fr .6fr .6fr .4fr";
  const GRID_ELAB = ".4fr 1.2fr .5fr .6fr .6fr .6fr .5fr .6fr .6fr .4fr";

  const displayCode = (r) =>
    r.codigo_mostrar ||
    (r.codigo_maxi && String(r.codigo_maxi).trim() !== ""
      ? r.codigo_maxi
      : `INS-${r.id}`);

  const precioHeaderLabel =
    precioMode === "promedio"
      ? "Precio promedio"
      : precioMode === "ultima"
        ? "Última compra"
        : "Precio";

  const totalHeaderLabel =
    totalMode === "unidades"
      ? "Total unidades"
      : totalMode === "gastos"
        ? "Total gastado"
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
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  };

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
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);

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
  }, [rows, sortBy, sortDir, getSortValue]);

  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const r of sortedRows) {
      const rubroLabel = getRubroLabel(r);
      if (!map.has(rubroLabel)) {
        map.set(rubroLabel, []);
      }
      map.get(rubroLabel).push(r);
    }
    return Array.from(map.entries()).map(([label, groupRows]) => ({
      label,
      rows: groupRows,
    }));
  }, [sortedRows, getRubroLabel]);

  const flatRows = useMemo(() => {
    const out = [];

    groupedRows.forEach((group) => {
      out.push({
        type: "rubro",
        label: group.label,
        rows: group.rows,
        key: `rubro-${group.label || "sin-rubro"}`, // ✅ key estable
      });

      group.rows.forEach((r) => {
        out.push({
          type: "insumo",
          data: r,
          key: `insumo-${r.id}`, // ✅ key estable
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

const lastNotifiedSizeRef = useRef(-1);

useEffect(() => {
  if (!onIdToIndexChange) return;

  // ✅ solo notifico cuando cambia algo real (tamaño)
  if (idToIndex.size !== lastNotifiedSizeRef.current) {
    lastNotifiedSizeRef.current = idToIndex.size;
    onIdToIndexChange(idToIndex);
  }
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
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 3,
            background: "#fff",
            borderBottom: "1px solid #eee",
            padding: "8px 8px 6px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB,
              gap: 8,
              fontWeight: 700,
              userSelect: "none",
              alignItems: "center",
              color: "black",
              fontSize: "0.95rem",
            }}
          >
            <div
              onClick={() => toggleSort("codigo")}
              style={{ cursor: "pointer" }}
            >
              Código {sortBy === "codigo" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </div>

            <div
              onClick={() => toggleSort("nombre")}
              style={{ cursor: "pointer" }}
            >
              Nombre {sortBy === "nombre" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </div>

            <div>U. medida</div>

            <div
              onClick={() => toggleSort("precio")}
              style={{ cursor: "pointer" }}
            >
              {precioHeaderLabel}{" "}
              {sortBy === "precio" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </div>

            {isElaborados ? (
              <>
                <div>Precio final desp.</div>
                <div>{totalHeaderLabel}</div>
                <div>Vencimiento</div>
                <div>¿En recetas?</div>
                <div
                  onClick={() => toggleSort("fecha")}
                  style={{ cursor: "pointer" }}
                >
                  Fecha{" "}
                  {sortBy === "fecha" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </div>
                <div style={{ textAlign: "center" }}>Acciones</div>
              </>
            ) : (
              <>
                <div>% Desperdicio</div>
                <div>{totalHeaderLabel}</div>
                <div>Precio final M2</div>
                <div>Precio final M1</div>
                <div>¿En recetas?</div>
                <div
                  onClick={() => toggleSort("fecha")}
                  style={{ cursor: "pointer" }}
                >
                  Fecha{" "}
                  {sortBy === "fecha" ? (sortDir === "asc" ? "▲" : "▼") : ""}
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
              return null; // rubro headers no tienen id numérico
            }}
            renderRow={({ row, style }) => {
              // HEADER DE RUBRO
              if (row.type === "rubro") {
                return (
                  <div
                    style={{
                      ...style,
                      display: "grid",
                      gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB,
                      padding: "6px 8px",
                      background: "#f5f5f5",
                      borderTop: "1px solid #ddd",
                      borderBottom: "1px solid #ddd",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "#555",
                      alignItems: "center",
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
                      />
                    </div>
                  </div>
                );
              }

              // FILA DE INSUMO
              const r = row.data;

              // 🆕 Determinar si esta fila debe tener highlight
              const shouldHighlight = jumpToInsumoId && Number(r.id) === Number(jumpToInsumoId);

              return (
                <div
                  data-insumo-id={r.id}
                  className={`tabla-row-insumo ${shouldHighlight ? 'highlight-jump' : ''}`}
                  style={{
                    ...style,
                    display: "grid",
                    gridTemplateColumns: isElaborados ? GRID_ELAB : GRID_NO_ELAB,
                    alignItems: "center",
                    borderTop: "1px dashed #f0f0f0",
                    padding: "6px 8px",
                    fontSize: "0.9rem",
                    gap: 8,
                  }}
                >
                  <div>{displayCode(r)}</div>
                  <div title={r.nombre}>{r.nombre}</div>
                  <div>{r.unidad_med || "-"}</div>
                  <div>{formatMoney(getDisplayedPrice(r), 2)}</div>
                  <div>-</div>
                  <div>{renderTotalValue(r)}</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>{formatDate(r.updated_at || r.created_at)}</div>

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
}