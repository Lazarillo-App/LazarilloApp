// src/hooks/useAccesoEquipo.js
// Vista Operación — lógica compartida del QR de acceso de una sucursal:
// generar el código, dibujar el QR (con la L de Lazarillo en el centro),
// pausar/reanudar, copiar e imprimir. La usan tanto el modal (Perfil) como
// la sección inline de la ficha del negocio (Configuración > Organización).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import logoMark from '@/assets/brand/logo.png';
import { obtenerCodigoAcceso, pausarReanudarAcceso } from '@/servicios/apiAccesoEquipo';
import { showAlert } from '@/servicios/appAlert';

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// El logo del negocio va arriba del cartel (o el nombre, si no tiene logo) —
// el centro se deja fijo con la marca de Lazarillo porque el logo de cada
// negocio puede tener cualquier proporción y deformarse al forzarlo a un
// cuadrado chico. Necesita corrección de error alta ('H') para que siga
// siendo legible con el logo encima.
async function dibujarQrConLogo(link) {
  const size = 320;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, link, { width: size, margin: 1, errorCorrectionLevel: 'H' });

  const ctx = canvas.getContext('2d');
  const logo = await cargarImagen(logoMark);

  const logoSize = Math.round(size * 0.22);
  const cx = (size - logoSize) / 2;
  const pad = 6;
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - pad, cx - pad, logoSize + pad * 2, logoSize + pad * 2);
  ctx.drawImage(logo, cx, cx, logoSize, logoSize);

  return canvas.toDataURL('image/png');
}

export function abrirCartelParaImprimir({ qrDataUrl, code, businessName, branchName, businessLogo }) {
  const w = window.open('', '_blank', 'width=500,height=700');
  if (!w) return;
  const encabezado = businessLogo
    ? `<img class="logo-negocio" src="${businessLogo}" alt="${businessName}" />`
    : `<div class="marca-negocio">${businessName}</div>`;
  w.document.write(`
    <!doctype html><html><head><title>Acceso del equipo — ${businessName}</title>
    <style>
      @page { size: A5; margin: 0; }
      body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center;
             height: 100vh; margin: 0; }
      .cartel { border: 2px solid #111; border-radius: 16px; padding: 32px 40px; text-align: center; width: 340px; }
      .logo-negocio { max-width: 220px; max-height: 60px; object-fit: contain; margin-bottom: 14px; }
      .marca-negocio { font-size: 20px; font-weight: 900; margin-bottom: 14px; }
      h2 { margin: 0 0 4px; font-size: 18px; }
      p.instr { color: #555; font-size: 12.5px; margin: 0 0 16px; }
      .qr { width: 220px; height: 220px; }
      .code { font-size: 22px; font-weight: 800; letter-spacing: 6px; margin-top: 12px; }
      .code-hint { font-size: 10px; color: #888; margin-top: 2px; }
      .negocio { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #444; }
      .negocio b { display: block; font-size: 13.5px; color: #111; }
    </style></head>
    <body onload="window.print()">
      <div class="cartel">
        ${encabezado}
        <h2>Sumate al equipo</h2>
        <p class="instr">Escaneá con la cámara del celular<br/>para crear tu usuario</p>
        <img class="qr" src="${qrDataUrl}" alt="QR" />
        <div class="code">${code}</div>
        <div class="code-hint">o cargá este código</div>
        <div class="negocio">
          <b>${businessName}</b>
          ${branchName ? branchName : ''}
        </div>
      </div>
    </body></html>
  `);
  w.document.close();
}

export function useAccesoEquipo({ businessId, branchId, enabled = true }) {
  const [loading, setLoading] = useState(true);
  const [accessCode, setAccessCode] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const link = accessCode ? `${window.location.origin}/r/${accessCode.code}` : '';

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    obtenerCodigoAcceso(businessId, branchId)
      .then(async (ac) => {
        if (!alive) return;
        setAccessCode(ac);
        const url = `${window.location.origin}/r/${ac.code}`;
        const dataUrl = await dibujarQrConLogo(url);
        if (alive) setQrDataUrl(dataUrl);
      })
      .catch((e) => { if (alive) showAlert(e?.message || 'No se pudo generar el acceso', 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, businessId, branchId]);

  const togglePausa = async () => {
    setBusy(true);
    try {
      const next = await pausarReanudarAcceso(businessId, branchId, !accessCode.active);
      setAccessCode((prev) => ({ ...prev, active: next.active }));
    } catch (e) {
      showAlert(e?.message || 'No se pudo actualizar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copiar = (texto) => {
    navigator.clipboard?.writeText(texto).then(() => showAlert('Copiado', 'success')).catch(() => {});
  };

  return { loading, accessCode, qrDataUrl, link, busy, togglePausa, copiar };
}
