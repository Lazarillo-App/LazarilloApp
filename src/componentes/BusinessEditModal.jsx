import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';

export default function BusinessEditModal({ open, business, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#000000');
  const [secondary, setSecondary] = useState('#ffffff');
  const [background, setBackground] = useState('#ffffff');
  const [font, setFont] = useState('Inter, system-ui, sans-serif');
  const [logoUrl, setLogoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && business) {
      const b = business;
      const br = b?.props?.branding || {};
      setName(b?.name || '');
      setPrimary(br.primary || '#000000');
      setSecondary(br.secondary || '#ffffff');
      setBackground(br.background || '#ffffff');
      setFont(br.font || 'Inter, system-ui, sans-serif');
      setLogoUrl(br.logo_url || '');
      setErr('');
    }
  }, [open, business]);

  if (!open) return null;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const payload = {
        name,
        branding: { primary, secondary, background, font, logo_url: logoUrl || null }
      };
      const { business: saved } = await BusinessesAPI.update(business.id, payload);
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error(e);
      setErr(e?.message || 'No se pudo guardar.');
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

          <label>Fuente</label>
          <input value={font} onChange={e=>setFont(e.target.value)} />

          <label>Logo (URL)</label>
          <input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} />

          {!!err && <div className="error">{err}</div>}

          <div className="actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn" disabled={busy}>{busy?'Guardando…':'Guardar'}</button>
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
