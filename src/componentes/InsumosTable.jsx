/* eslint-disable no-unused-vars */
// src/componentes/InsumosTable.jsx
import React, { useMemo, useState, useEffect } from "react";
import InsumoAccionesMenu from "./InsumoAccionesMenu";
import InsumoRubroAccionesMenu from "./InsumoRubroAccionesMenu";
import { insumosRubrosList } from "../servicios/apiInsumos";

const num = (v) => (v == null || v === "" ? null : Number(v));
const norm = (s) => String(s || "").trim().toLowerCase();

const formatMoney = (v, d = 2) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

const formatNumber = (v, d = 0) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

const formatRatio = (v) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("es-AR"); // dd/mm/aaaa
};

export default function InsumosTable({
  rows = [],
  loading = false,
  page = 1,
  pagination = { total: 0, pages: 1 },
  onPageChange,
  onEdit,
  onDelete,
  noBusiness = false,
  vista = "no-elaborados",
  businessId,

  // 🔹 contexto de agrupaciones de insumos
  groups = [],
  selectedGroupId = null,
  discontinuadosGroupId = null,
  onOpenGroupModalForInsumo,
  // alias legacy
  onCreateGroupFromRubro,

  // modos de visualización
  precioMode = "promedio",
  totalMode = "gastos",
  orderBy,
  orderDir,
}) {
  const isElaborados = vista === "elaborados";

  // 🔹 Rubros para poder mostrar el NOMBRE en el header (igual que el sidebar)
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

  // mapa codigo -> nombre
  const rubroNombreMap = useMemo(() => {
    const m = new Map();
    (rubros || []).forEach((r) => {
      if (r && r.codigo != null) {
        m.set(String(r.codigo), r.nombre || "");
      }
    });
    return m;
  }, [rubros]);

  // helper: label de rubro para cada insumo (usa el mapa de arriba)
  const getRubroLabel = (row) => {
    const code =
      row.rubro_codigo ??
      row.rubroCodigo ??
      row.codigo_rubro ??
      row.rubro ??
      null;

    if (code != null) {
      const fromMap = rubroNombreMap.get(String(code));
      if (fromMap && fromMap.trim() !== "") return fromMap;
    }

    // fallback por si en algún momento el back ya manda el nombre
    return (
      row.rubro_nombre ||
      row.rubroNombre ||
      row.nombre_rubro ||
      row.rubro_maxi ||
      (code != null ? String(code) : "Sin rubro")
    );
  };

  // mismos strings que usamos en tablas tipo grid
  const GRID_NO_ELAB =
    ".4fr 1.2fr .4fr .6fr .5fr .5fr .6fr .6fr .6fr .6fr .4fr"; // 11 columnas
  const GRID_ELAB =
    ".4fr 1.2fr .4fr .6fr .6fr .6fr .5fr .6fr .6fr .4fr"; // 10 columnas

  const displayCode = (r) =>
    r.codigo_mostrar ||
    (r.codigo_maxi && String(r.codigo_maxi).trim() !== ""
      ? r.codigo_maxi
      : `INS-${r.id}`);

  /* ============== helpers nuevos para Precio / Total ============== */

  // 🔸 Etiquetas de cabecera según modo
  const precioHeaderLabel =
    precioMode === "promedio"
      ? "Precio promedio (periodo)"
      : precioMode === "ultima"
      ? "Última compra (U. medida)"
      : "Precio por U. de medida";

  const totalHeaderLabel =
    totalMode === "unidades"
      ? "Total unidades compradas"
      : totalMode === "gastos"
      ? "Total gastado"
      : totalMode === "ratio"
      ? "Ratio (ventas)"
      : "Total";

  // 🔸 Cómo calculamos el valor de precio que mostramos
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

  // 🔸 Cómo calculamos el valor de "Total" que mostramos
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
        return (
          r.ratio_ventas ??
          r.ratio ??
          r.relacion_ventas ??
          null
        );
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
      return `$ ${formatMoney(raw, 2)}`;
    }
    if (totalMode === "ratio") {
      return formatRatio(raw);
    }
    return "-";
  };

  /* ============== orden simple local (nombre / código / precio / fecha) ============== */

  const [sortBy, setSortBy] = useState("nombre"); // 'codigo' | 'nombre' | 'precio' | 'fecha'
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    // Si cambia la vista, reseteamos orden a nombre asc
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
        return num(getDisplayedPrice(r)); // ordena por el precio "mostrado"
      case "fecha":
        return new Date(r.updated_at || r.created_at || 0).getTime();
      default:
        return 0;
    }
  };

  // 🔹 1) ordenamos la lista plana (localmente)
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
  }, [rows, sortBy, sortDir]);

  // 🔹 2) agrupamos por rubro manteniendo el orden
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
  }, [sortedRows, rubroNombreMap]);

  /* ============== contexto de agrupación actual ============== */

  const grupoSeleccionado = useMemo(() => {
    if (!selectedGroupId) return null;
    const n = Number(selectedGroupId);
    if (!Number.isFinite(n)) return null;
    return (groups || []).find((g) => Number(g.id) === n) || null;
  }, [groups, selectedGroupId]);

  const nombreGrupoSeleccionado = grupoSeleccionado?.nombre || "";

  const isGrupoDiscontinuados =
    !!grupoSeleccionado &&
    (
      norm(grupoSeleccionado.nombre) === "discontinuados" ||
      norm(grupoSeleccionado.nombre) === "descontinuados" ||
      (discontinuadosGroupId &&
        Number(grupoSeleccionado.id) === Number(discontinuadosGroupId))
    );

  /* ============================================================ */

  if (loading) {
    return <p>Cargando...</p>;
  }

  const handlePrev = () => {
    if (page <= 1) return;
    onPageChange && onPageChange(page - 1);
  };

  const handleNext = () => {
    if (page >= (pagination.pages || 1)) return;
    onPageChange && onPageChange(page + 1);
  };

  return (
    <div className="tabla-articulos-inner">
      <div
        style={{
          height:
            typeof window !== "undefined" && window.innerHeight
              ? Math.max(260, window.innerHeight - 220)
              : 520,
          width: "100%",
          overflow: "auto",
          position: "relative",
        }}
      >
        {/* HEADER sticky de columnas */}
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
              gap: 0,
              fontWeight: 700,
              userSelect: "none",
              alignItems: "center",
              color: "black",
              fontSize: "0.95rem",
            }}
          >
            {/* 1 Código */}
            <div
              onClick={() => toggleSort("codigo")}
              style={{ cursor: "pointer" }}
            >
              Código{" "}
              {sortBy === "codigo"
                ? sortDir === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </div>

            {/* 2 Nombre */}
            <div
              onClick={() => toggleSort("nombre")}
              style={{ cursor: "pointer" }}
            >
              Nombre{" "}
              {sortBy === "nombre"
                ? sortDir === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </div>

            {/* 3 U medida */}
            <div>U. de medida</div>

            {/* 4 Precio por U (según modo) */}
            <div
              onClick={() => toggleSort("precio")}
              style={{ cursor: "pointer" }}
            >
              {precioHeaderLabel}{" "}
              {sortBy === "precio"
                ? sortDir === "asc"
                  ? "▲"
                  : "▼"
                : ""}
            </div>

            {isElaborados ? (
              <>
                {/* ELABORADOS */}
                <div>Precio final por desperdicio</div>
                <div>{totalHeaderLabel}</div>
                <div>Vencimiento</div>
                <div>Existe en recetas?</div>
                <div
                  onClick={() => toggleSort("fecha")}
                  style={{ cursor: "pointer" }}
                >
                  Fecha última modificación{" "}
                  {sortBy === "fecha"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </div>
                <div style={{ textAlign: "center" }}>Acciones</div>
              </>
            ) : (
              <>
                {/* NO ELABORADOS */}
                <div>% Desperdicio</div>
                <div>{totalHeaderLabel}</div>
                <div>Precio final merma 2"</div>
                <div>Precio final merma 1"</div>
                <div>Existe en recetas?</div>
                <div
                  onClick={() => toggleSort("fecha")}
                  style={{ cursor: "pointer" }}
                >
                  Fecha última modificación{" "}
                  {sortBy === "fecha"
                    ? sortDir === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </div>
                <div style={{ textAlign: "center" }}>Acciones</div>
              </>
            )}
          </div>
        </div>

        {/* CONTENIDO AGRUPADO POR RUBRO */}
        {sortedRows.length === 0 ? (
          <div
            style={{
              padding: 16,
              color: "#777",
            }}
          >
            {noBusiness
              ? "Seleccioná un negocio para ver sus insumos."
              : "No hay insumos (probá crear uno, sincronizar desde Maxi o usar carga masiva)."}
          </div>
        ) : (
          groupedRows.map((group) => (
            <React.Fragment key={group.label || "sin-rubro"}>
              {/* encabezado de rubro (fila separadora) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isElaborados
                    ? GRID_ELAB
                    : GRID_NO_ELAB,
                  padding: "6px 8px",
                  background: "#fafafa",
                  borderTop: "1px solid #eee",
                  borderBottom: "1px solid #eee",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "#444",
                }}
              >
                {/* 1ª col vacía para respetar la grilla (código) */}
                <div />

                {/* 2ª col: de "Nombre" hasta el final, con título + menú de acciones */}
                <div
                  style={{
                    gridColumn: "2 / -1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{group.label || "Sin rubro"}</span>

                  {onCreateGroupFromRubro && (
                    <InsumoRubroAccionesMenu
                      rubroLabel={group.label || "Sin rubro"}
                      onCreateGroupFromRubro={onCreateGroupFromRubro}
                    />
                  )}
                </div>
              </div>

              {/* filas del rubro */}
              {group.rows.map((r) => {
                const updatedAt = r.updated_at || r.created_at || null;
                const vencimiento =
                  r.vencimiento || r.fecha_vencimiento || null;

                const precioMostrado = getDisplayedPrice(r);
                const totalMostrado = renderTotalValue(r);

                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isElaborados
                        ? GRID_ELAB
                        : GRID_NO_ELAB,
                      alignItems: "center",
                      borderTop: "1px dashed #f0f0f0",
                      padding: "6px 8px",
                      fontSize: "0.9rem",
                      color: "#373737",
                    }}
                  >
                    {/* comunes */}
                    <div>{displayCode(r)}</div>
                    <div>{r.nombre}</div>
                    <div>{r.unidad_med || "-"}</div>
                    <div>$ {formatMoney(precioMostrado, 2)}</div>

                    {isElaborados ? (
                      <>
                        {/* elaborados */}
                        <div>-</div>
                        <div>{totalMostrado}</div>
                        <div>{formatDate(vencimiento)}</div>
                        <div>-</div>
                        <div>{formatDate(updatedAt)}</div>
                        <div style={{ textAlign: "center" }}>
                          <InsumoAccionesMenu
                            insumo={r}
                            // básicas (aunque en el menú ya sacamos editar/eliminar)
                            onEdit={() => onEdit && onEdit(r)}
                            onDelete={() => onDelete && onDelete(r)}
                            // contexto de agrupación
                            isInDiscontinuados={isGrupoDiscontinuados}
                            grupoActualNombre={nombreGrupoSeleccionado}
                            onToggleDiscontinuado={(insumo, nowDiscontinuado) => {
                              if (!onOpenGroupModalForInsumo) return;
                              const target =
                                discontinuadosGroupId && nowDiscontinuado
                                  ? discontinuadosGroupId
                                  : discontinuadosGroupId || null;
                              onOpenGroupModalForInsumo(insumo, target);
                            }}
                            onMove={(insumo) => {
                              if (!onOpenGroupModalForInsumo) return;
                              onOpenGroupModalForInsumo(
                                insumo,
                                selectedGroupId || null
                              );
                            }}
                            onRemoveFromGroup={(insumo) => {
                              if (!onOpenGroupModalForInsumo || !selectedGroupId)
                                return;
                              onOpenGroupModalForInsumo(
                                insumo,
                                selectedGroupId
                              );
                            }}
                            onCreateGroupFromInsumo={(insumo) => {
                              if (onOpenGroupModalForInsumo) {
                                onOpenGroupModalForInsumo(insumo, null);
                              } else if (onCreateGroupFromRubro) {
                                onCreateGroupFromRubro(insumo);
                              }
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* no elaborados */}
                        <div>-</div>
                        <div>{totalMostrado}</div>
                        <div>-</div>
                        <div>-</div>
                        <div>-</div>
                        <div>{formatDate(updatedAt)}</div>
                        <div style={{ textAlign: "center" }}>
                          <InsumoAccionesMenu
                            insumo={r}
                            onEdit={() => onEdit && onEdit(r)}
                            onDelete={() => onDelete && onDelete(r)}
                            isInDiscontinuados={isGrupoDiscontinuados}
                            grupoActualNombre={nombreGrupoSeleccionado}
                            onToggleDiscontinuado={(insumo, nowDiscontinuado) => {
                              if (!onOpenGroupModalForInsumo) return;
                              const target =
                                discontinuadosGroupId && nowDiscontinuado
                                  ? discontinuadosGroupId
                                  : discontinuadosGroupId || null;
                              onOpenGroupModalForInsumo(insumo, target);
                            }}
                            onMove={(insumo) => {
                              if (!onOpenGroupModalForInsumo) return;
                              onOpenGroupModalForInsumo(
                                insumo,
                                selectedGroupId || null
                              );
                            }}
                            onRemoveFromGroup={(insumo) => {
                              if (!onOpenGroupModalForInsumo || !selectedGroupId)
                                return;
                              onOpenGroupModalForInsumo(
                                insumo,
                                selectedGroupId
                              );
                            }}
                            onCreateGroupFromInsumo={(insumo) => {
                              if (onOpenGroupModalForInsumo) {
                                onOpenGroupModalForInsumo(insumo, null);
                              } else if (onCreateGroupFromRubro) {
                                onCreateGroupFromRubro(insumo);
                              }
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Paginado abajo, igual que antes */}
      <div className="paginado" style={{ marginTop: 12 }}>
        Página {page} / {pagination.pages || 1} — Total:{" "}
        {pagination.total || 0}
        &nbsp;
        <button disabled={page <= 1} onClick={handlePrev}>
          Anterior
        </button>
        <button
          disabled={page >= (pagination.pages || 1)}
          onClick={handleNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
