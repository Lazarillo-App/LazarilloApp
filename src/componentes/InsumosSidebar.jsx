// src/componentes/InsumosSidebar.jsx
import React, { useEffect, useState, useMemo } from "react";
import { insumosRubrosList } from "../servicios/apiInsumos";
import {
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

import "../css/SidebarCategorias.css";

export default function InsumosSidebar({
  selectedRubroCodigo,
  onSelectRubroCodigo,
  businessId,
  vista,
  onVistaChange,
  groups = [],
  groupsLoading = false,
  selectedGroupId = null,
  onSelectGroupId,
  favoriteGroupId,
  onSetFavorite,
  onEditGroup,
  onDeleteGroup,
}) {
  const [rubros, setRubros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRubros = async () => {
    if (!businessId) {
      setRubros([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await insumosRubrosList(businessId);
      setRubros(res.items || []);
    } catch (e) {
      console.error("[InsumosSidebar] Error rubros:", e);
      setError(e.message || "Error al cargar rubros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRubros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // 🔹 helper para saber si un rubro es "elaborador"
  const esElaborador = (r) => {
    if (r.es_elaborador === true) return true;
    if (typeof r.nombre === "string") {
      return r.nombre.toUpperCase().startsWith("ELABORADOS");
    }
    return false;
  };

  // 🔹 filtramos la lista de rubros según la vista
  const rubrosFiltrados = useMemo(() => {
    if (!Array.isArray(rubros)) return [];
    if (vista === "elaborados") {
      return rubros.filter((r) => esElaborador(r));
    }
    if (vista === "no-elaborados") {
      return rubros.filter((r) => !esElaborador(r));
    }
    return rubros;
  }, [rubros, vista]);

  const isSelected = (codigo) => selectedRubroCodigo === codigo;

  const handleVistaChange = (_, value) => {
    if (!value) return;
    onVistaChange && onVistaChange(value);
  };

  // ================== Agrupaciones: helpers ==================

  const gruposOrdenados = useMemo(() => {
    const arr = Array.isArray(groups) ? groups.filter(Boolean) : [];
    if (!arr.length) return [];
    // por ahora sin TODO/discontinuados especiales, solo orden alfabético
    return [...arr].sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [groups]);

  const selectedGroupValue = selectedGroupId || "";

  const labelAgrup = (g) => g?.nombre || "";

  const renderSelectedGroupLabel = (value) => {
    if (!value) {
      return "(Sin filtro de agrupación)";
    }
    const g = gruposOrdenados.find(
      (x) => Number(x.id) === Number(value)
    );
    return g ? labelAgrup(g) : "(Sin filtro de agrupación)";
  };

  return (
    <div className="sidebar">
      {/* 🔹 Select de agrupaciones de insumos con gestión (favorito / editar / borrar) */}
      <FormControl
        size="small"
        fullWidth
        sx={{ mb: 2 }}
        disabled={!businessId || groupsLoading}
      >
        <InputLabel>Agrupaciones de insumos</InputLabel>
        <Select
          label="Agrupaciones de insumos"
          value={selectedGroupValue}
          onChange={(e) =>
            onSelectGroupId && onSelectGroupId(e.target.value || null)
          }
          renderValue={renderSelectedGroupLabel}
        >
          <MenuItem value="">
            <em>
              {groupsLoading
                ? "Cargando agrupaciones..."
                : "(Sin filtro de agrupación)"}
            </em>
          </MenuItem>

          {gruposOrdenados.map((g) => (
            <MenuItem key={g.id} value={Number(g.id)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 8,
                }}
              >
                <span>{labelAgrup(g)}</span>

                {/* Botonera de acciones (favorito / editar / borrar) */}
                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {onSetFavorite && (
                    <Tooltip
                      title={
                        Number(favoriteGroupId) === Number(g.id)
                          ? "Quitar como favorita"
                          : "Marcar como favorita"
                      }
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetFavorite(g.id);
                        }}
                      >
                        {Number(favoriteGroupId) === Number(g.id) ? (
                          <StarIcon fontSize="inherit" color="warning" />
                        ) : (
                          <StarBorderIcon fontSize="inherit" />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}

                  {onEditGroup && (
                    <Tooltip title="Renombrar agrupación">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditGroup(g);
                        }}
                      >
                        <EditIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {onDeleteGroup && (
                    <Tooltip title="Eliminar agrupación">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGroup(g);
                          }}
                        >
                          <DeleteIcon fontSize="inherit" color="error" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </span>
              </div>
            </MenuItem>
          ))}

          {!gruposOrdenados.length && !groupsLoading && (
            <MenuItem disabled>
              <em>Sin agrupaciones aún</em>
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {/* 🔄 Switch elaborados / no elaborados */}
      <div>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={vista}
          onChange={handleVistaChange}
        >
          <ToggleButton value="no-elaborados">No elaborados</ToggleButton>
          <ToggleButton value="elaborados">Elaborados</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {loading && <p>Cargando rubros...</p>}
      {error && <p style={{ color: "salmon" }}>{error}</p>}

      {!loading && !error && (
        <ul className="sidebar-lista">
          <li
            className={
              selectedRubroCodigo == null
                ? "sidebar-item active"
                : "sidebar-item"
            }
            onClick={() => onSelectRubroCodigo(null)}
          >
            <span>
              {vista === "elaborados"
                ? "Todos los elaborados"
                : "Todos los rubros"}
            </span>
          </li>

          {rubrosFiltrados.map((r) => (
            <li
              key={r.codigo}
              className={
                isSelected(r.codigo) ? "sidebar-item active" : "sidebar-item"
              }
              onClick={() => onSelectRubroCodigo(r.codigo)}
            >
              <span>{r.nombre}</span>
            </li>
          ))}

          {!rubrosFiltrados.length && !loading && !error && (
            <li className="sidebar-item">
              <span>
                {businessId
                  ? "Sin rubros en esta vista (probá cambiar el toggle)."
                  : "Seleccioná un negocio para ver rubros."}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
