/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/componentes/BusinessCard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import * as apiDivisions from "@/servicios/apiDivisions";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CircularProgress from "@mui/material/CircularProgress";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AutoGroupModal from "./AutoGroupModal";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { useBusiness } from "@/context/BusinessContext";

import { syncArticulos, syncInsumos, isMaxiConfigured } from "@/servicios/syncService";

import {
  checkNewArticlesAndSuggest,
  applyAutoGrouping,
  createNewAgrupacion,
} from "@/servicios/autoGrouping";

export default function BusinessCard({
  biz,
  activeId,
  onSetActive,
  onEdit,
  onDelete,
  showNotice,
}) {
  const {
    activeDivisionId,
    selectDivision,
    divisions,
    divisionsLoading,
    refetchDivisions,
  } = useBusiness() || {};

  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "https://lazarilloapp-backend.onrender.com";

  const toAbsolute = (u) => {
    const raw = String(u || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;          // ya es absoluta
    if (raw.startsWith("/")) return `${API_BASE}${raw}`; // ruta relativa del backend
    return `${API_BASE}/${raw}`;
  };

  const [syncingArt, setSyncingArt] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [syncingInsumos, setSyncingInsumos] = useState(false);
  const [viewBiz, setViewBiz] = useState(biz);
  const [maxiLoading, setMaxiLoading] = useState(true);
  const [maxiConfigured, setMaxiConfigured] = useState(false);
  const [editDivisionId, setEditDivisionId] = useState(null);
  const [editDivisionName, setEditDivisionName] = useState("");
  const [divisionBusyId, setDivisionBusyId] = useState(null); // para bloquear UI mientras guarda/borra

  // Modal de auto-agrupación
  const [autoGroupModal, setAutoGroupModal] = useState({
    open: false,
    suggestions: [],
    loading: false,
  });

  // Panel de “subnegocios” (divisiones)
  const [divPanelOpen, setDivPanelOpen] = useState(false);
  const [showCreateDivModal, setShowCreateDivModal] = useState(false);

  // Refs para evitar doble click
  const syncingArtRef = useRef(false);
  const syncingSalesRef = useRef(false);
  const syncingInsumosRef = useRef(false);

  useEffect(() => {
    setViewBiz(biz);
  }, [biz]);

  // Refresco card si llega evento externo
  useEffect(() => {
    const onUpdated = (ev) => {
      const updated = ev?.detail?.business;
      const id = ev?.detail?.id ?? updated?.id;
      if (!id) return;
      if (String(id) === String(viewBiz?.id)) {
        setViewBiz((prev) => ({ ...prev, ...updated }));
      }
    };
    window.addEventListener("business:updated", onUpdated);
    return () => window.removeEventListener("business:updated", onUpdated);
  }, [viewBiz?.id]);

  const isActive = String(activeId) === String(viewBiz?.id);

  // Auto-sync al tener negocio activo + Maxi configurado
  useEffect(() => {
    const bizId = viewBiz?.id;
    if (!bizId) return;
    if (!isActive) return;
    if (maxiLoading) return;
    if (!maxiConfigured) return;

    const key = `lazarillo:autoSyncOnLogin:${bizId}`;
    try {
      if (sessionStorage.getItem(key) === "done") return;
      sessionStorage.setItem(key, "done");
    } catch { }

    (async () => {
      try {
        console.log("[BusinessCard] 🔄 Auto-sync iniciando...");

        await syncArticulos(viewBiz.id, { onProgress: () => { } });

        setTimeout(async () => {
          try {
            const suggestions = await checkNewArticlesAndSuggest(bizId);
            if (suggestions && suggestions.length > 0) {
              setAutoGroupModal({ open: true, suggestions, loading: false });
            }
          } catch (error) {
            console.error("[Auto-group] Error verificando:", error);
          }
        }, 1500);

        await syncInsumos(viewBiz.id, { onProgress: () => { } });

        console.log("[BusinessCard] ✅ Auto-sync completado");
      } catch (e) {
        console.error("[BusinessCard] ❌ auto-sync error:", e);
      }
    })();
  }, [viewBiz?.id, isActive, maxiLoading, maxiConfigured]);

  // Chequear si Maxi está configurado
  useEffect(() => {
    let mounted = true;
    const id = viewBiz?.id;
    if (!id) return;

    (async () => {
      try {
        setMaxiLoading(true);
        const configured = await isMaxiConfigured(id);
        if (!mounted) return;
        setMaxiConfigured(configured);
      } catch {
        if (!mounted) return;
        setMaxiConfigured(false);
      } finally {
        if (mounted) setMaxiLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [viewBiz?.id]);

  const branding = useMemo(() => viewBiz?.branding || viewBiz?.props?.branding || {}, [viewBiz]);

  const name =
    viewBiz?.name ||
    viewBiz?.nombre ||
    (viewBiz?.slug ? String(viewBiz.slug) : `#${viewBiz?.id}`);

  const address = useMemo(() => {
    const raw =
      viewBiz?.address ??
      viewBiz?.direccion ??
      viewBiz?.props?.address ??
      viewBiz?.props?.direccion ??
      "";
    if (raw && typeof raw === "object") {
      const { street, calle, number, numero, city, ciudad, line1, line2 } = raw;
      return [street ?? calle ?? line1, number ?? numero, line2, city ?? ciudad]
        .filter(Boolean)
        .join(", ");
    }
    return String(raw || "");
  }, [viewBiz]);

  const photo = toAbsolute(viewBiz?.photo_url || branding?.cover_url || viewBiz?.image_url || "");
  const logo = toAbsolute(branding?.logo_url || "");
  const hasLogo = !!logo;
  const thumbnail = hasLogo ? logo : photo;
  const isLogoThumb = hasLogo;

  // --------- DIVISIONES (Subnegocios) ----------
  // Solo mostramos divisiones si este es el negocio activo
  const divisionsList = isActive ? (divisions || []) : [];
  const divLoading = isActive ? !!divisionsLoading : false;
  const hasDivisions = divisionsList.length > 0;

  const toggleDivPanel = async () => {
    const next = !divPanelOpen;
    setDivPanelOpen(next);

    // Si abrimos el panel y es el negocio activo, refrescar divisiones
    if (next && isActive) {
      await refetchDivisions?.();
    }
  };

  const handlePickDivision = async (divisionId) => {
    const bizId = viewBiz?.id;
    if (!bizId) return;

    // Si no es el activo, activarlo primero
    if (!isActive) {
      await onSetActive?.(bizId);
    }

    // Setear división (null = Principal)
    await selectDivision?.(divisionId ?? null);

    setDivPanelOpen(false);
  };

  const handleCreateDivision = () => {
    setShowCreateDivModal(true);
  };

  const handleDivisionCreated = async () => {
    setShowCreateDivModal(false);

    // recargar divisiones
    await refetchDivisions?.();

    showNotice?.("✅ Subnegocio creado correctamente");

    window.dispatchEvent(
      new CustomEvent("division:created", {
        detail: { businessId: viewBiz?.id },
      })
    );
  };

  // --------- SYNC HANDLERS ----------
  const handleSyncArticulos = async () => {
    if (syncingArt || syncingArtRef.current) return;

    setSyncingArt(true);
    syncingArtRef.current = true;

    try {
      const result = await syncArticulos(viewBiz.id, {
        force: true,
        onProgress: (msg, type) => {
          if (type === "success" || type === "error") showNotice?.(msg);
        },
      });

      if (result.ok && !result.cached) {
        window.dispatchEvent(new Event("business:synced"));

        setTimeout(async () => {
          try {
            const suggestions = await checkNewArticlesAndSuggest(viewBiz.id);
            if (suggestions && suggestions.length > 0) {
              setAutoGroupModal({ open: true, suggestions, loading: false });
            }
          } catch (error) {
            console.error("[Auto-group] Error verificando:", error);
          }
        }, 1500);
      }
    } catch (e) {
      showNotice?.(`Error: ${e.message}`);
    } finally {
      setSyncingArt(false);
      syncingArtRef.current = false;
    }
  };

  const handleSyncInsumos = async () => {
    if (syncingInsumos || syncingInsumosRef.current) return;

    setSyncingInsumos(true);
    syncingInsumosRef.current = true;

    try {
      await syncInsumos(viewBiz.id, {
        force: true,
        onProgress: (msg, type) => {
          if (type === "success" || type === "error") showNotice?.(msg);
        },
      });
    } catch (e) {
      showNotice?.(`Error: ${e.message}`);
    } finally {
      setSyncingInsumos(false);
      syncingInsumosRef.current = false;
    }
  };

  // --------- AUTO GROUP HANDLERS ----------
  const handleApplyAutoGrouping = async (selections) => {
    setAutoGroupModal((prev) => ({ ...prev, loading: true }));
    try {
      const { httpBiz } = await import("@/servicios/apiBusinesses");
      const { success, failed } = await applyAutoGrouping(selections, httpBiz);

      setAutoGroupModal({ open: false, suggestions: [], loading: false });
      window.dispatchEvent(new Event("agrupaciones:updated"));

      if (failed === 0) {
        showNotice?.(
          `✅ ${success} artículo${success !== 1 ? "s" : ""} agrupado${success !== 1 ? "s" : ""
          } correctamente`
        );
      } else {
        showNotice?.(`✅ ${success} agrupados, ⚠️ ${failed} fallaron`);
      }
    } catch (error) {
      console.error("[Auto-group] Error aplicando agrupación:", error);
      setAutoGroupModal((prev) => ({ ...prev, loading: false }));
      showNotice?.("❌ Error al agrupar artículos");
    }
  };

  const handleCreateGroup = async (nombre) => {
    try {
      const newGroupId = await createNewAgrupacion(viewBiz.id, nombre);
      window.dispatchEvent(new Event("agrupaciones:updated"));
      return newGroupId;
    } catch (error) {
      showNotice?.("❌ Error al crear agrupación");
      throw error;
    }
  };

  // --------- RENOMBRAR Y ELIMINAR HANDLERS ----------

  const startRenameDivision = (d) => {
    setEditDivisionId(String(d.id));
    setEditDivisionName(String(d.name || d.nombre || ""));
  };

  const cancelRenameDivision = () => {
    setEditDivisionId(null);
    setEditDivisionName("");
  };

  const saveRenameDivision = async (divisionId) => {
    const newName = String(editDivisionName || "").trim();
    if (!newName) {
      showNotice?.("⚠️ El nombre no puede estar vacío");
      return;
    }

    try {
      setDivisionBusyId(String(divisionId));
      await apiDivisions.updateDivision(divisionId, { name: newName });
      showNotice?.("✅ Nombre actualizado");
      cancelRenameDivision();
      await refetchDivisions?.();
    } catch (e) {
      showNotice?.(`❌ Error renombrando: ${e.message || "falló"}`);
    } finally {
      setDivisionBusyId(null);
    }
  };

  const deleteDivision = async (divisionId) => {
    const ok = window.confirm("¿Eliminar este subnegocio? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setDivisionBusyId(String(divisionId));

      // si estás parado en esa división, volvés a Principal antes
      if (String(activeDivisionId ?? "") === String(divisionId)) {
        await selectDivision?.(null);
      }

      await apiDivisions.deleteDivision(divisionId);

      showNotice?.("🗑️ Subnegocio eliminado");
      await refetchDivisions?.();
    } catch (e) {
      showNotice?.(`❌ Error eliminando: ${e.message || "falló"}`);
    } finally {
      setDivisionBusyId(null);
    }
  };


  return (
    <>
      <AutoGroupModal
        open={autoGroupModal.open}
        suggestions={autoGroupModal.suggestions}
        onClose={() => setAutoGroupModal({ open: false, suggestions: [], loading: false })}
        onApply={handleApplyAutoGrouping}
        onCreateGroup={handleCreateGroup}
        loading={autoGroupModal.loading}
      />

      <div className="bc-card">
        <div className="bc-top">
          <div className="bc-left">
            <div className="bc-title-row">
              <h4 className="bc-title" title={name}>
                {name}
              </h4>
              {isActive && (
                <span className="bc-badge-active" title="Negocio activo">
                  <CheckCircleIcon fontSize="inherit" />
                  Activo
                </span>
              )}
            </div>
            {address && (
              <p className="bc-address" title={address}>
                {address}
              </p>
            )}
          </div>

          <div className={`bc-thumb-wrap ${isLogoThumb ? "logo-mode" : "photo-mode"}`}>
            {thumbnail ? (
              <img
                className="bc-thumb"
                src={thumbnail}
                alt={name}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = photo || "";
                }}
              />
            ) : (
              <div className="bc-thumb bc-thumb-fallback" aria-label="thumbnail" />
            )}
          </div>
        </div>

        <div className="bc-actions">
          <div className="bc-actions-main">
            {!isActive && (
              <button
                className="bc-btn bc-btn-outline"
                onClick={async () => {
                  // Al activar negocio, forzar Principal
                  await onSetActive?.(viewBiz.id);
                  await selectDivision?.(null);
                }}
              >
                Activar
              </button>
            )}
            <button className="bc-btn bc-btn-edit" onClick={() => onEdit?.(viewBiz)}>
              <EditIcon fontSize="small" />
              Editar
            </button>
            <button
              className="bc-icon bc-icon-danger"
              onClick={(e) => {
                // ✅ soltá el foco ANTES de borrar (evita warning aria-hidden)
                try { e.currentTarget.blur(); } catch { }
                e.stopPropagation();
                onDelete?.(viewBiz);
              }}
              title="Eliminar negocio"
            >
              <DeleteIcon fontSize="small" />
            </button>
            {/* Botón para abrir panel */}
            <button
              className="bc-btn bc-btn-outline"
              onClick={toggleDivPanel}
              title="Ver subnegocios (divisiones)"
            >
              Subnegocios
            </button>
          </div>

          {divPanelOpen && (
            <div className="bc-div-panel">
              <div className="bc-div-head">
                <strong>Subnegocios</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="bc-btn bc-btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={handleCreateDivision}
                  >
                    + Crear
                  </button>
                  <button
                    className="bc-btn bc-btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={() => setDivPanelOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {!isActive ? (
                <div className="bc-div-empty">Activá este negocio para ver sus subnegocios.</div>
              ) : divLoading ? (
                <div className="bc-div-loading">
                  <CircularProgress size={18} /> Cargando…
                </div>
              ) : !hasDivisions ? (
                <div className="bc-div-empty">
                  Este negocio no tiene subnegocios.
                  <br />
                  <button
                    className="bc-btn bc-btn-outline"
                    style={{ marginTop: 8 }}
                    onClick={handleCreateDivision}
                  >
                    Crear el primero
                  </button>
                </div>
              ) : (
                <div className="bc-div-list">
                  {divisionsList.map((d) => {
                    const isSel = String(activeDivisionId ?? "") === String(d.id);
                    const isEditing = String(editDivisionId ?? "") === String(d.id);
                    const busy = String(divisionBusyId ?? "") === String(d.id);

                    return (
                      <div
                        key={d.id}
                        className={`bc-btn bc-btn-outline ${isSel ? "bc-btn-selected" : ""}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                        }}
                        title={`Seleccionar ${d.name || d.nombre || `#${d.id}`}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => !isEditing && handlePickDivision(d.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isEditing) handlePickDivision(d.id);
                        }}
                      >
                        {/* IZQ: nombre */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={editDivisionName}
                              onChange={(e) => setEditDivisionName(e.target.value)}
                              autoFocus
                              disabled={busy}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRenameDivision(d.id);
                                if (e.key === "Escape") cancelRenameDivision();
                              }}
                              sx={{
                                flex: 1,
                                "& .MuiInputBase-root": { height: 34 },
                              }}
                            />
                          ) : (
                            <>
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {d.name || d.nombre || `División #${d.id}`}
                              </span>
                              {isSel && <CheckCircleIcon fontSize="small" style={{ opacity: 0.8 }} />}
                            </>
                          )}
                        </div>

                        {/* DER: acciones */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ opacity: 0.6, fontSize: 12 }}>#{d.id}</span>

                          {isEditing ? (
                            <>
                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveRenameDivision(d.id);
                                }}
                                title="Guardar"
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>

                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelRenameDivision();
                                }}
                                title="Cancelar"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRenameDivision(d);
                                }}
                                title="Cambiar nombre"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>

                              {!d.is_main && (
                                <IconButton
                                  size="small"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteDivision(d.id);
                                  }}
                                  title="Eliminar"
                                >
                                  <DeleteForeverIcon fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="bc-actions-sync">
            <button
              className="bc-btn bc-btn-outline"
              onClick={handleSyncArticulos}
              disabled={syncingArt}
              title="Sincronizar catálogo / artículos"
            >
              {syncingArt ? <CircularProgress size={16} /> : <AutorenewIcon fontSize="small" />}
              {syncingArt ? " Artículos…" : " Artículos"}
            </button>

            {!maxiLoading && maxiConfigured && (
              <button
                className="bc-btn bc-btn-outline"
                onClick={handleSyncInsumos}
                disabled={syncingInsumos}
                title="Sincronizar insumos desde Maxi"
              >
                {syncingInsumos ? <CircularProgress size={16} /> : <Inventory2Icon fontSize="small" />}
                {syncingInsumos ? " Insumos…" : " Insumos"}
              </button>
            )}

            {!maxiLoading && !maxiConfigured && (
              <button
                className="bc-btn bc-btn-outline"
                disabled
                title="Configura Maxi (email, codcli y clave) para habilitar la sincronización"
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                <PointOfSaleIcon fontSize="small" />
                Maxi no configurado
              </button>
            )}
          </div>
        </div>

        <style>{`
          .bc-card{background:var(--color-surface,#fff);border:1px solid var(--color-border,#e5e7eb);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;}
          .bc-top{display:flex;gap:16px;}
          .bc-left{flex:1;min-width:0;}
          .bc-title-row{display:flex;align-items:center;gap:8px;min-width:0;}
          .bc-title{margin:0;font-weight:700;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-badge-active{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb,var(--color-primary,#34d399) 18%,white);color:#166534;font-weight:700;padding:2px 8px;border-radius:999px;font-size:12px;}
          .bc-address{margin:.125rem 0 0 0;color:#6b7280;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .bc-thumb-wrap{width:180px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid var(--color-border,#e5e7eb);background:#f3f4f6;display:block;position:relative;}
          .bc-thumb{width:100%;height:100%;display:block;}
          .bc-thumb-wrap.logo-mode{background:#fff;}
          .bc-thumb-wrap.logo-mode .bc-thumb{object-fit:contain;padding:6px;}
          .bc-thumb-wrap.photo-mode .bc-thumb{object-fit:cover;}
          .bc-actions{ display:flex;flex-direction:column;gap:6px;}
          .bc-actions-main{ display:flex; align-items:stretch;gap:8px; flex-wrap:wrap;}
          .bc-actions-sync{ display:flex;align-items:stretch;gap:8px;flex-wrap:wrap; }
          .bc-btn{border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer;transition:filter .15s, background .15s;display:inline-flex;align-items:center;gap:6px;}
          .bc-btn-edit{background:var(--color-primary,#0ea5e9);color:var(--on-primary,#ffffff);box-shadow:0 1px 0 rgba(0,0,0,.06) inset;}
          .bc-btn-edit:hover{filter:brightness(.96);}
          .bc-btn-edit:disabled{opacity:.6;cursor:default;filter:none;}
          .bc-btn-outline{border:1px solid var(--color-border,#e5e7eb);background:var(--color-surface,#fff);color:var(--color-fg,#111827);}
          .bc-btn-outline:hover{background:var(--color-surface-hover,#f9fafb);}
          .bc-btn-selected{background:color-mix(in srgb,var(--color-primary,#0ea5e9) 12%,white);border-color:var(--color-primary,#0ea5e9);}
          .bc-icon{width:40px;height:40px;border-radius:10px;background:#fff;border:1px solid var(--color-border,#e5e7eb);display:grid;place-items:center;}
          .bc-icon-danger{color:#e11d48;}

          .bc-div-panel{margin-top:8px;border:1px solid var(--color-border,#e5e7eb);border-radius:12px;padding:10px;background:var(--color-surface,#fff);}
          .bc-div-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
          .bc-div-loading{display:flex;align-items:center;gap:8px;opacity:.8;font-size:13px;padding:8px;}
          .bc-div-empty{opacity:.8;font-size:13px;padding:8px;}
          .bc-div-list{display:flex;flex-direction:column;gap:6px;}

          @media (max-width:720px){ .bc-thumb-wrap{ width:140px; } }
        `}</style>
      </div>
    </>
  );
}
