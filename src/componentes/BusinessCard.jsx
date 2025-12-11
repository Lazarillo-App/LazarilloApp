/* eslint-disable no-unused-vars */
// src/componentes/BusinessCard.jsx
import React, { useEffect, useMemo, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CircularProgress from "@mui/material/CircularProgress";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import SyncVentasButton from './SyncVentasButton';
import {
  syncArticulos,
  syncVentas,
  syncInsumos,
  isMaxiConfigured,
} from "@/servicios/syncService";

export default function BusinessCard({
  biz,
  activeId,
  onSetActive,
  onEdit,
  onDelete,
  showNotice,
}) {
  const [syncingArt, setSyncingArt] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [syncingInsumos, setSyncingInsumos] = useState(false);
  const [viewBiz, setViewBiz] = useState(biz);
  const [maxiLoading, setMaxiLoading] = useState(true);
  const [maxiConfigured, setMaxiConfigured] = useState(false);

  useEffect(() => { setViewBiz(biz); }, [biz]);

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

  // ⚡ Auto-sincronización al tener negocio activo + Maxi configurado
  useEffect(() => {
    const bizId = viewBiz?.id;
    if (!bizId) return;

    // Solo para el negocio ACTIVO
    if (!isActive) return;

    // Esperamos a que haya respondido maxiStatus
    if (maxiLoading) return;
    if (!maxiConfigured) return;

    // Evitar repetir auto-sync en la misma sesión/navegador
    const key = `lazarillo:autoSyncOnLogin:${bizId}`;
    try {
      if (sessionStorage.getItem(key) === 'done') {
        return; // Ya se hizo antes en esta sesión
      }
      sessionStorage.setItem(key, 'done');
    } catch {
      // Si sessionStorage falla, no pasa nada, solo podría repetirse
    }

    // Ejecutamos sincronizaciones en segundo plano
    (async () => {
      try {
        // 1) Artículos
        await handleSyncArticulos();

        // 2) Ventas últimos 7 días
        await handleSyncVentas7d();

        // 3) Insumos
        await handleSyncInsumos();
      } catch (e) {
        console.error('[BusinessCard] auto-sync on login error', e);
      }
    })();
  }, [viewBiz?.id, isActive, maxiLoading, maxiConfigured]);

  // ▶ Chequear si Maxi está configurado
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

    return () => { mounted = false; };
  }, [viewBiz?.id]);

  const branding = useMemo(
    () => viewBiz?.branding || viewBiz?.props?.branding || {},
    [viewBiz]
  );

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

  const photo = viewBiz?.photo_url || branding?.cover_url || viewBiz?.image_url || "";
  const logo = branding?.logo_url || "";
  const hasLogo = !!logo;
  const thumbnail = hasLogo ? logo : photo;
  const isLogoThumb = hasLogo;

  /* ============ Sincronizar ARTÍCULOS ============ */
  const handleSyncArticulos = async () => {
    if (syncingArt) return;
    setSyncingArt(true);
    try {
      const result = await syncArticulos(viewBiz.id, {
        onProgress: (msg, type) => {
          if (type === 'success' || type === 'error') {
            showNotice?.(msg);
          }
        },
      });

      if (result.ok && !result.cached) {
        window.dispatchEvent(new Event('business:synced'));
      }
    } catch (e) {
      showNotice?.(`Error: ${e.message}`);
    } finally {
      setSyncingArt(false);
    }
  };

  /* ============ Sincronizar VENTAS (últimos 7 días) ============ */
  const handleSyncVentas7d = async () => {
    if (syncingSales) return;
    setSyncingSales(true);
    try {
      const result = await syncVentas(viewBiz.id, {
        days: 7,
        onProgress: (msg, type) => {
          if (type === 'success' || type === 'error') {
            showNotice?.(msg);
          }
        },
      });

      // El servicio ya emite evento 'ventas:updated' internamente
    } catch (e) {
      showNotice?.(`Error: ${e.message}`);
    } finally {
      setSyncingSales(false);
    }
  };

  /* ============ Sincronizar INSUMOS ============ */
  const handleSyncInsumos = async () => {
    if (syncingInsumos) return;
    setSyncingInsumos(true);
    try {
      const result = await syncInsumos(viewBiz.id, {
        onProgress: (msg, type) => {
          if (type === 'success' || type === 'error') {
            showNotice?.(msg);
          }
        },
      });
    } catch (e) {
      showNotice?.(`Error: ${e.message}`);
    } finally {
      setSyncingInsumos(false);
    }
  };

  return (
    <div className="bc-card">
      <div className="bc-top">
        <div className="bc-left">
          <div className="bc-title-row">
            <h4 className="bc-title" title={name}>{name}</h4>
            {isActive && (
              <span className="bc-badge-active" title="Negocio activo">
                <CheckCircleIcon fontSize="inherit" />
                Activo
              </span>
            )}
          </div>
          {address && <p className="bc-address" title={address}>{address}</p>}
        </div>

        <div className={`bc-thumb-wrap ${isLogoThumb ? "logo-mode" : "photo-mode"}`}>
          {thumbnail ? (
            <img className="bc-thumb" src={thumbnail} alt={name} loading="lazy" />
          ) : (
            <div className="bc-thumb bc-thumb-fallback" aria-label="thumbnail" />
          )}
        </div>
      </div>

      <div className="bc-actions">
        {/* Fila principal: activar / editar / eliminar */}
        <div className="bc-actions-main">
          {!isActive && (
            <button
              className="bc-btn bc-btn-outline"
              onClick={() => onSetActive?.(viewBiz.id)}
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
            onClick={() => onDelete?.(viewBiz)}
            title="Eliminar negocio"
          >
            <DeleteIcon fontSize="small" />
          </button>
        </div>

        <div className="bc-actions-sync">
          {/* Artículos */}
          <button
            className="bc-btn bc-btn-outline"
            onClick={handleSyncArticulos}
            disabled={syncingArt}
            title="Sincronizar catálogo / artículos"
          >
            {syncingArt ? (
              <CircularProgress size={16} />
            ) : (
              <AutorenewIcon fontSize="small" />
            )}
            {syncingArt ? " Artículos…" : " Artículos"}
          </button>

          {/* Ventas: con modal para elegir modo */}
          {!maxiLoading && maxiConfigured && (
            <SyncVentasButton
              businessId={viewBiz.id}
              onSuccess={() => {
                showNotice?.('✅ Ventas sincronizadas correctamente');
                window.dispatchEvent(new Event('ventas:updated'));
              }}
            />
          )}

          {/* Insumos */}
          {!maxiLoading && maxiConfigured && (
            <button
              className="bc-btn bc-btn-outline"
              onClick={handleSyncInsumos}
              disabled={syncingInsumos}
              title="Sincronizar insumos desde Maxi"
            >
              {syncingInsumos ? (
                <CircularProgress size={16} />
              ) : (
                <Inventory2Icon fontSize="small" />
              )}
              {syncingInsumos ? " Insumos…" : " Insumos"}
            </button>
          )}

          {/* Hint cuando Maxi no está configurado */}
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
        .bc-icon{width:40px;height:40px;border-radius:10px;background:#fff;border:1px solid var(--color-border,#e5e7eb);display:grid;place-items:center;}
        .bc-icon-danger{color:#e11d48;}
        @media (max-width:720px){ .bc-thumb-wrap{ width:140px; } }
      `}</style>
    </div>
  );
}