import React, { useEffect, useMemo, useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CircularProgress from "@mui/material/CircularProgress";

export default function BusinessCard({
  biz,
  activeId,
  onSetActive,
  onEdit,
  onDelete,
  onOpenSync,
  showNotice,
}) {
  const [syncing, setSyncing] = useState(false);

  // 🔄 estado de "vista" que parte de la prop y se actualiza por evento
  const [viewBiz, setViewBiz] = useState(biz);

  // si el padre trae una nueva versión, sincronizamos
  useEffect(() => { setViewBiz(biz); }, [biz]);

  // escuchar cambios globales (emitidos por el modal al guardar)
  useEffect(() => {
    const onUpdated = (ev) => {
      const updated = ev?.detail?.business;
      const id = ev?.detail?.id ?? updated?.id;
      if (!id) return;
      // si es esta misma card, refrescamos su estado de vista
      if (String(id) === String(viewBiz?.id)) {
        setViewBiz((prev) => ({ ...prev, ...updated }));
      }
    };
    window.addEventListener("business:updated", onUpdated);
    return () => window.removeEventListener("business:updated", onUpdated);
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
  const isActive = String(activeId) === String(viewBiz?.id);

  const handleSync = async () => {
    if (!onOpenSync || syncing) return;
    setSyncing(true);
    try {
      const resp = await onOpenSync(viewBiz);
      const up = Number(resp?.upserted ?? 0);
      const mp = Number(resp?.mapped ?? 0);
      showNotice?.(`Sync OK. Artículos: ${up} · Mapeos: ${mp}`);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("UNAUTHORIZED_ACCESS") || msg.includes("UNAUTHORIZED")) {
        showNotice?.("Maxi devolvió 401: credenciales inválidas o token caído. Revisa email/clave/codcli del local.");
      } else {
        showNotice?.("No se pudo sincronizar. Probá nuevamente o revisá credenciales de Maxi.");
      }
    } finally {
      setSyncing(false);
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
        {!isActive && (
          <button className="bc-btn bc-btn-outline" onClick={() => onSetActive?.(viewBiz.id)}>
            Activar
          </button>
        )}

        <button className="bc-btn bc-btn-edit" onClick={() => onEdit?.(viewBiz)}>
          <EditIcon fontSize="small" />
          Editar
        </button>

        {onOpenSync && (
          <button className="bc-btn bc-btn-outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <CircularProgress size={16} /> : <AutorenewIcon fontSize="small" />}
            {syncing ? " Sincronizando..." : " Sincronizar"}
          </button>
        )}
        <button
          className="bc-icon bc-icon-danger"
          onClick={() => onDelete?.(viewBiz)}
          title="Eliminar negocio"
        >
          <DeleteIcon fontSize="small" />
        </button>
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
        .bc-actions{display:flex;align-items:stretch;gap:8px;}
        .bc-btn{border:0;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer;transition:filter .15s, background .15s;}
        .bc-btn-edit{flex:1;background:var(--color-primary,#0ea5e9);color:var(--on-primary,#ffffff);box-shadow:0 1px 0 rgba(0,0,0,.06) inset;}
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
