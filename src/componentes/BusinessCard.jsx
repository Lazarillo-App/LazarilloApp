import React, { useMemo } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function BusinessCard({
  biz,
  activeId,
  onSetActive,
  onEdit,
  onDelete,
  onOpenSync,
}) {
  const branding = useMemo(
    () => biz?.branding || biz?.props?.branding || {},
    [biz]
  );

  const name =
    biz?.name || biz?.nombre || (biz?.slug ? String(biz.slug) : `#${biz?.id}`);

  // address -> string seguro
  const address = useMemo(() => {
    const raw =
      biz?.address ??
      biz?.direccion ??
      biz?.props?.address ??
      biz?.props?.direccion ??
      "";
    if (raw && typeof raw === "object") {
      const { street, calle, number, numero, city, ciudad, line1, line2 } = raw;
      return [street ?? calle ?? line1, number ?? numero, line2, city ?? ciudad]
        .filter(Boolean)
        .join(", ");
    }
    return String(raw || "");
  }, [biz]);

  // fuentes posibles
  const photo =
    biz?.photo_url || branding?.cover_url || biz?.image_url || "";
  const logo = branding?.logo_url || "";

  // decide “modo thumb”
  const hasLogo = !!logo;
  const thumbnail = hasLogo ? logo : photo;

  // si es logo: mostrar en 'contain' y fondo blanco; si es foto: 'cover'
  const isLogoThumb = hasLogo;
  const isActive = String(activeId) === String(biz?.id);

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
            <img
              className="bc-thumb"
              src={thumbnail}
              alt={name}
              loading="lazy"
            />
          ) : (
            <div className="bc-thumb bc-thumb-fallback" aria-label="thumbnail" />
          )}
        </div>
      </div>

      <div className="bc-actions">
        {!isActive && (
          <button className="bc-btn bc-btn-outline" onClick={() => onSetActive?.(biz.id)}>
            Activar
          </button>
        )}

        <button className="bc-btn bc-btn-edit" onClick={() => onEdit?.(biz)}>
          <EditIcon fontSize="small" />
          Editar
        </button>

        {onOpenSync && (
          <button className="bc-btn bc-btn-outline" onClick={() => onOpenSync(biz)}>
            Sincronizar
          </button>
        )}

        <button className="bc-icon bc-icon-danger" onClick={() => onDelete?.(biz)} title="Eliminar negocio">
          <DeleteIcon fontSize="small" />
        </button>
      </div>

      <style>{`
        .bc-card{
          background:var(--color-surface,#fff);
          border:1px solid var(--color-border,#e5e7eb);
          border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;
        }
        .bc-top{ display:flex; gap:16px; }
        .bc-left{ flex:1; min-width:0; }

        /* —— Título con avatar —— */
        .bc-title-row{ display:flex; align-items:center; gap:8px; min-width:0; }
        .bc-title{ margin:0; font-weight:700; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .bc-avatar{
          width:28px; height:28px; border-radius:999px; overflow:hidden; flex:0 0 28px;
          border:1px solid var(--color-border,#e5e7eb); background:#fff; display:grid; place-items:center;
        }
        .bc-avatar-img{ width:100%; height:100%; object-fit:cover; display:block; }
        .bc-avatar-initial{ font-size:.8rem; font-weight:800; color:#444; }

        .bc-badge-active{
          margin-left:auto; display:inline-flex; align-items:center; gap:6px;
          background: color-mix(in srgb, var(--color-primary,#34d399) 18%, white);
          color:#166534; font-weight:700; padding:2px 8px; border-radius:999px; font-size:12px;
        }

        .bc-address{ margin:.125rem 0 0 0; color:#6b7280; font-size:.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* —— Thumbnail 16:9 con modo logo/foto —— */
        .bc-thumb-wrap{
          width:180px; /* puedes bajar a 140 si querés más compacto */
          aspect-ratio:16/9; border-radius:12px; overflow:hidden; flex-shrink:0;
          border:1px solid var(--color-border,#e5e7eb); background:#f3f4f6; display:block;
          position:relative;
        }
        .bc-thumb{ width:100%; height:100%; display:block; }

        /* Logo: que se vea completo, fondo blanco y un poco de padding visual */
        .bc-thumb-wrap.logo-mode{ background:#fff; }
        .bc-thumb-wrap.logo-mode .bc-thumb{
          object-fit:contain; padding:6px;
        }

        /* Foto: que llene el encuadre tipo portada */
        .bc-thumb-wrap.photo-mode .bc-thumb{
          object-fit:cover;
        }

        .bc-thumb-fallback{ background:#f3f4f6; }
        .bc-actions{ display:flex; align-items:center; gap:8px; }
        .bc-btn{ border:0; border-radius:10px; padding:10px 12px; font-weight:700; cursor:pointer; transition:filter .15s, background .15s; }
        .bc-btn-edit{ flex:1; background: color-mix(in srgb, var(--color-primary,#34d399) 22%, white); color: var(--on-primary,#0b0f0c); }
        .bc-btn-outline{ border:1px solid var(--color-border,#e5e7eb); background:var(--color-surface,#fff); color:var(--color-fg,#111827); }
        .bc-icon{ width:40px; height:40px; border-radius:10px; background:#fff; border:1px solid var(--color-border,#e5e7eb);
          display:grid; place-items:center; color:#e11d48; }
        .bc-icon-danger{ color:#e11d48; }
        
        @media (max-width:720px){
          .bc-thumb-wrap{ width:140px; }
        }
      `}</style>
    </div>
  );
}

