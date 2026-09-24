// src/componentes/AccesoEquipoInline.jsx
// Vista Operación — el mismo QR de acceso de AccesoEquipoModal, pero como
// sección fija dentro de la ficha del negocio (Configuración > Organización)
// en vez de un modal detrás de un ícono. Mismo criterio: no da acceso por sí
// solo, solo permite pedirlo; el admin lo aprueba después en Sectores.
import { Chip, CircularProgress, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAccesoEquipo, abrirCartelParaImprimir } from '@/hooks/useAccesoEquipo';

export default function AccesoEquipoInline({ businessId, branchId, businessName, branchName, businessLogo }) {
  const { loading, accessCode, qrDataUrl, link, busy, togglePausa, copiar } = useAccesoEquipo({
    businessId, branchId, enabled: !!businessId,
  });

  return (
    <div className="aei-section">
      <div className="aei-header">
        <span className="aei-label">Acceso del equipo</span>
        <Chip label="Nuevo" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />
      </div>

      {loading ? (
        <div className="aei-loading"><CircularProgress size={22} /></div>
      ) : (
        <div className="aei-body">
          <div className="aei-qr-col">
            <div className="aei-qr-wrap" style={{ opacity: accessCode?.active ? 1 : 0.35 }}>
              {qrDataUrl && <img src={qrDataUrl} alt="QR de acceso" width={104} height={104} />}
              {!accessCode?.active && <div className="aei-paused">PAUSADO</div>}
            </div>
            <span className="aei-qr-caption">{businessName}</span>
          </div>

          <div className="aei-info-col">
            <p className="aei-descr">
              QR de acceso para empleados. <b>Se imprime y se pega en el local.</b> Quien lo
              escanea crea su usuario con este negocio ya asignado, y queda esperando que lo apruebes.
            </p>

            <div className="aei-row">
              <span className="aei-row-label">CÓDIGO</span>
              <span className="aei-code">{accessCode?.code}</span>
              <button type="button" className="aei-link-btn" onClick={() => copiar(accessCode?.code)}>Copiar</button>
              <span className="aei-hint">generado por el sistema</span>
            </div>

            <div className="aei-row">
              <span className="aei-row-label">LINK</span>
              <span className="aei-link-value" title={link}>{link}</span>
              <button type="button" className="aei-link-btn" onClick={() => copiar(link)}>Copiar</button>
            </div>

            <div className="aei-actions">
              <button type="button" className="aei-btn aei-btn-primary"
                disabled={!qrDataUrl}
                onClick={() => abrirCartelParaImprimir({ qrDataUrl, code: accessCode?.code, businessName, branchName, businessLogo })}>
                <PrintIcon sx={{ fontSize: 16 }} /> Imprimir QR
              </button>
              <button type="button" className="aei-btn"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Sumate al equipo de ${businessName}: ${link}`)}`, '_blank')}>
                <WhatsAppIcon sx={{ fontSize: 16 }} /> Compartir por WhatsApp
              </button>
              <button type="button" className="aei-btn" disabled={busy} onClick={togglePausa}>
                {accessCode?.active ? <PauseCircleOutlineIcon sx={{ fontSize: 16 }} /> : <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />}
                {accessCode?.active ? 'Pausar acceso' : 'Reanudar acceso'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .aei-section{border-top:1px solid var(--color-border,#e5e7eb);padding-top:10px;display:flex;flex-direction:column;gap:8px;}
        .aei-header{display:flex;align-items:center;gap:8px;}
        .aei-label{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}
        .aei-loading{display:flex;justify-content:center;padding:12px 0;}
        .aei-body{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;}
        .aei-qr-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}
        .aei-qr-wrap{position:relative;width:104px;height:104px;}
        .aei-qr-wrap img{display:block;width:100%;height:100%;}
        .aei-paused{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;color:#c0392b;}
        .aei-qr-caption{font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.04em;}
        .aei-info-col{flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px;}
        .aei-descr{margin:0;font-size:12.5px;color:#4b5563;line-height:1.5;}
        .aei-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .aei-row-label{font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.04em;width:48px;flex-shrink:0;}
        .aei-code{font-weight:800;letter-spacing:2px;font-size:0.95rem;}
        .aei-link-value{color:#6b7280;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}
        .aei-link-btn{border:none;background:transparent;color:var(--color-primary,#0ea5e9);font-weight:700;font-size:12px;cursor:pointer;padding:0;}
        .aei-link-btn:hover{text-decoration:underline;}
        .aei-hint{font-size:11px;color:#9ca3af;}
        .aei-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;}
        .aei-btn{border:1px solid var(--color-border,#e5e7eb);background:var(--color-surface,#fff);color:var(--color-fg,#111827);border-radius:10px;padding:8px 12px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s;}
        .aei-btn:hover:not(:disabled){background:var(--color-surface-hover,#f9fafb);}
        .aei-btn:disabled{opacity:.6;cursor:default;}
        .aei-btn-primary{background:var(--color-primary,#0ea5e9);color:var(--on-primary,#fff);border-color:transparent;}
        .aei-btn-primary:hover:not(:disabled){filter:brightness(.96);background:var(--color-primary,#0ea5e9);}
      `}</style>
    </div>
  );
}
