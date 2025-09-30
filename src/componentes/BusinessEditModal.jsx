import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useBizTheme } from '../tema/ThemeProviderNegocio';

export default function BusinessEditModal({ open, business, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#3b82f6');
  const [secondary, setSecondary] = useState('#6366f1');
  const [background, setBackground] = useState('#ffffff');
  const [font, setFont] = useState('Inter, system-ui, sans-serif');
  const [logoUrl, setLogoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // aplicar tema en vivo
  const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => {} };

  useEffect(() => {
    if (!open || !business) return;
    const br = business?.props?.branding || business?.branding || {};
    setName(business?.name || '');
    setPrimary(br.primary ?? '#3b82f6');
    setSecondary(br.secondary ?? '#6366f1');
    setBackground(br.background ?? '#ffffff');
    setFont(br.font ?? 'Inter, system-ui, sans-serif');
    setLogoUrl(br.logo_url ?? '');
    setErr('');
  }, [open, business]);

  if (!open) return null;

  const brandingToPalette = (br) => ({
    name: 'Custom',
    primary: br.primary,
    secondary: br.secondary,
    bg: br.background,
    surface: '#f8fafc',
    border: '#e2e8f0',
    fg: br.fg || br.primary || '#1a4f67',
    hover: 'rgba(40,90,115,.10)',
    font: br.font,
    logo_url: br.logo_url || null,
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const payload = {
        name,
        props: {
          ...(business?.props || {}),
          branding: {
            primary,
            secondary,
            background,
            font,
            logo_url: logoUrl || null,
            fg: primary,
          },
        },
      };

      const res = await BusinessesAPI.update(business.id, payload); // (admin, sin X-Business-Id)
      const saved = res?.business ?? res ?? { ...business, ...payload };

      // aplica tema al vuelo y persiste en localStorage
      setPaletteForBiz(brandingToPalette(payload.props.branding), { persist: true });

      // notifica arriba y cierra
      onSaved?.(saved);
      onClose?.();

      // broadcast opcional por si otras vistas escuchan
      window.dispatchEvent(new CustomEvent('business:branding-updated', {
        detail: { businessId: business.id, branding: payload.props.branding }
      }));
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
        <h2>Editar local</h2>
        <form onSubmit={save} className="form">
          <label>Nombre</label>
          <input value={name} onChange={e=>setName(e.target.value)} />

          <div className="row">
            <div><label>Primario</label><input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} /></div>
            <div><label>Secundario</label><input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} /></div>
            <div><label>Fondo</label><input type="color" value={background} onChange={e=>setBackground(e.target.value)} /></div>
          </div>

          <label>Fuente (CSS font-family)</label>
          <input value={font} onChange={e=>setFont(e.target.value)} placeholder='Inter, system-ui, sans-serif' />

          <label>Logo (URL)</label>
          <input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://..." />

          {!!err && <div className="error">{err}</div>}

          <div className="actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay{position:fixed;inset:0;background:#0006;display:grid;place-items:center;z-index:10000}
        .modal-card{width:min(720px,96vw);background:#fff;border-radius:14px;padding:20px;box-shadow:0 20px 60px #0007}
        .form{display:grid;gap:10px}
        .row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        input{width:100%;padding:10px;border-radius:8px;border:1px solid #dfe3e6;background:#fff}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
        .btn{background:#111;color:#fff;border:0;border-radius:8px;padding:10px 14px;cursor:pointer}
        .btn.ghost{background:#f3f4f6;color:#111}
        .error{background:#ffebe9;color:#b30000;border:1px solid #ffb3b3;padding:8px;border-radius:8px}
        @media (max-width:640px){ .row{grid-template-columns:1fr} }
      `}</style>
    </div>
  );
}

