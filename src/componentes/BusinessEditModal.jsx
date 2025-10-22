/* eslint-disable no-empty */
// src/componentes/BusinessEditModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { useBizTheme } from '../tema/ThemeProviderNegocio';

export default function BusinessEditModal({ open, business, onClose, onSaved }) {
  // ----- estado UI -----
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#3b82f6');
  const [secondary, setSecondary] = useState('#6366f1');
  const [background, setBackground] = useState('#ffffff');
  const [font, setFont] = useState('Inter, system-ui, sans-serif');

  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  // Datos opcionales
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [city, setCity] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [website, setWebsite] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);

  // refs
  const fileInputRef = useRef(null);
  const originalBrandingRef = useRef(null);
  const objectUrlRef = useRef(null);

  // tema
  const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => { } };

  const brandingToPalette = (br) => ({
    name: 'Custom',
    primary: br.primary,
    secondary: br.secondary,
    bg: br.background,
    surface: '#ffffff',
    border: '#e5e7eb',
    fg: br.fg || br.primary || '#1a4f67',
    font: br.font,
    logo_url: br.logo_url || null,
  });

  // Cargar datos al abrir
  useEffect(() => {
    if (!open || !business) return;

    const br = business?.branding || business?.props?.branding || {};
    originalBrandingRef.current = br;

    setName(business?.name || '');
    setPrimary(br.primary ?? '#3b82f6');
    setSecondary(br.secondary ?? '#6366f1');
    setBackground(br.background ?? '#ffffff');
    setFont(br.font ?? 'Inter, system-ui, sans-serif');
    setLogoUrl(br.logo_url ?? '');
    setLogoFile(null);
    setErr('');
    setDirty(false);

    const contact = business?.props?.contact || {};
    const address = business?.props?.address || {};
    const social  = business?.props?.social  || {};

    setPhone(contact.phone || '');
    setDescription(business?.props?.description || '');
    setAddrLine1(address.line1 || '');
    setAddrLine2(address.line2 || '');
    setCity(address.city || '');
    setInstagram(social.instagram || '');
    setFacebook(social.facebook || '');
    setTiktok(social.tiktok || '');
    setWebsite(social.website || '');
  }, [open, business]);

  // Preview en vivo SOLO si hay cambios
  useEffect(() => {
    if (!open || !dirty) return;
    const draft = brandingToPalette({
      primary, secondary, background, font, logo_url: logoUrl || null, fg: primary
    });
    try { setPaletteForBiz(draft, { persist: false }); } catch { }
  }, [open, dirty, primary, secondary, background, font, logoUrl, setPaletteForBiz]);

  // Helpers URL
  const isHttpUrl = (u) => typeof u === 'string' && /^(https?:)?\/\//i.test(u);
  const isLocalUploadUrl = (u) => typeof u === 'string' && u.startsWith('/uploads/');
  const isValidLogoUrlForSave = (u) => !u ? true : (isHttpUrl(u) || isLocalUploadUrl(u));
  const normalizeEmpty = (s) => (String(s || "").trim() === "" ? null : s.trim());

  // Cerrar con rollback
  const handleClose = () => {
    if (dirty) {
      const orig = originalBrandingRef.current;
      if (orig) {
        try { setPaletteForBiz(brandingToPalette(orig), { persist: false }); } catch { }
      }
    }
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { }
      objectUrlRef.current = null;
    }
    onClose?.();
  };

  // Subida de archivo -> preview y flag
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { }
      objectUrlRef.current = null;
    }
    const temp = URL.createObjectURL(f);
    objectUrlRef.current = temp;
    setLogoUrl(temp);
    setLogoFile(f);
    setDirty(true);
  };

  const save = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setErr('');

    try {
      if (!name.trim()) throw new Error('Ingresá un nombre para el local.');

      // 1) Logo definitivo
      let finalLogoUrl = null;
      if (logoFile) {
        try {
          const up = await BusinessesAPI.uploadLogo(business.id, logoFile);
          finalLogoUrl = up?.url || null;
        } catch (eUp) {
          console.error('Falló subida de logo', eUp);
          throw new Error('No se pudo subir el logo. Probá nuevamente o usá una URL.');
        }
      } else if (logoUrl) {
        if (!isValidLogoUrlForSave(logoUrl)) {
          throw new Error('URL de logo inválida. Debe comenzar con http(s):// o /uploads/.');
        }
        finalLogoUrl = logoUrl;
      } else {
        finalLogoUrl = null;
      }

      // 2) PATCH con branding + secciones opcionales
      const branding = { primary, secondary, background, font, logo_url: finalLogoUrl, fg: primary };

      const payload = {
        name,
        props: {
          ...(business?.props || {}),
          branding,
          contact: { phone: normalizeEmpty(phone) },
          description: normalizeEmpty(description),
          address: {
            line1: normalizeEmpty(addrLine1),
            line2: normalizeEmpty(addrLine2),
            city: normalizeEmpty(city),
          },
          social: {
            instagram: normalizeEmpty(instagram),
            facebook: normalizeEmpty(facebook),
            tiktok: normalizeEmpty(tiktok),
            website: normalizeEmpty(website),
          },
        },
      };

      const res = await BusinessesAPI.update(business.id, payload);
      const saved = res?.business ?? res ?? { ...business, ...payload };

      // 3) Aplicar tema persistente para este negocio
      try { setPaletteForBiz(brandingToPalette(branding), { persist: true }); } catch { }

      // 4) Evento + cleanup + close
      window.dispatchEvent(new CustomEvent('business:branding-updated', {
        detail: { activeBusinessId: business.id, branding }
      }));

      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch { }
        objectUrlRef.current = null;
      }

      onSaved?.(saved);
      onClose?.();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const ColorField = ({ id, label, value, onChange }) => (
    <div className="ge-field">
      <label htmlFor={id} className="ge-label">{label}</label>
      <div className="ge-color-wrap">
        <input
          id={id}
          aria-label={`${label} picker`}
          type="color"
          className="ge-color-ctrl"
          value={value}
          onChange={(e) => { onChange(e.target.value); setDirty(true); }}
        />
        <input
          type="text"
          className="ge-input ge-input-hex"
          placeholder="#000000"
          value={value}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) { onChange(v); setDirty(true); }
            else { onChange(e.target.value); setDirty(true); }
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="ge-overlay" onClick={handleClose}>
      <div className="ge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ge-header"><h3>Editar local</h3></div>

        <form onSubmit={save} className="ge-body">
          <section>
            <h4 className="ge-section-title">Detalles del local</h4>
            <div className="ge-field">
              <label htmlFor="ge-name" className="ge-label">Nombre</label>
              <input
                id="ge-name"
                className="ge-input"
                placeholder="e.g., Downtown Eatery"
                value={name}
                onChange={(e)=>{ setName(e.target.value); setDirty(true); }}
              />
            </div>
          </section>

          <section>
            <h4 className="ge-section-title">Branding</h4>
            <div className="ge-grid-3">
              <ColorField id="ge-primary" label="Color primario" value={primary} onChange={setPrimary} />
              <ColorField id="ge-secondary" label="Color secundario" value={secondary} onChange={setSecondary} />
              <ColorField id="ge-bg" label="Fondo" value={background} onChange={setBackground} />
            </div>

            <div className="ge-field">
              <label className="ge-label">Logo</label>
              <div className="ge-logo-wrap">
                <input
                  className="ge-input flex-1"
                  placeholder="Pega una URL (http… o /uploads/…)"
                  value={logoUrl}
                  onChange={(e) => { setLogoUrl(e.target.value); setLogoFile(null); setDirty(true); }}
                />
                <span className="ge-muted">o</span>
                <button
                  type="button"
                  className="ge-btn outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Subir archivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="ge-hidden-file"
                  onChange={onPickFile}
                />
              </div>

              {!!logoUrl && (
                <div className="ge-preview">
                  <img src={logoUrl} alt="preview logo" />
                  <button
                    type="button"
                    className="ge-btn ghost"
                    onClick={() => {
                      if (objectUrlRef.current) {
                        try { URL.revokeObjectURL(objectUrlRef.current); } catch {}
                        objectUrlRef.current = null;
                      }
                      setLogoUrl('');
                      setLogoFile(null);
                      setDirty(true);
                    }}
                  >
                    Quitar logo
                  </button>
                </div>
              )}
            </div>

            <div className="ge-field">
              <label htmlFor="ge-font" className="ge-label">Fuente (CSS)</label>
              <input
                id="ge-font"
                className="ge-input"
                placeholder="Inter, system-ui, sans-serif"
                value={font}
                onChange={(e)=>{ setFont(e.target.value); setDirty(true); }}
              />
            </div>
          </section>

          <section>
            <h4 className="ge-section-title">Información del local (opcional)</h4>

            <div className="ge-field">
              <label className="ge-label" htmlFor="ge-phone">Teléfono</label>
              <input id="ge-phone" className="ge-input" placeholder="+54 9 ..."
                     value={phone} onChange={(e)=>{ setPhone(e.target.value); setDirty(true); }} />
            </div>

            <div className="ge-field">
              <label className="ge-label" htmlFor="ge-desc">Descripción</label>
              <textarea id="ge-desc" className="ge-input" rows={3} placeholder="Breve descripción"
                        value={description} onChange={(e)=>{ setDescription(e.target.value); setDirty(true); }} />
            </div>

            <div className="ge-field">
              <label className="ge-label">Ubicación</label>
              <div className="ge-grid-3">
                <input className="ge-input" placeholder="Calle y número"
                       value={addrLine1} onChange={e=>{ setAddrLine1(e.target.value); setDirty(true); }} />
                <input className="ge-input" placeholder="Piso/Depto (opcional)"
                       value={addrLine2} onChange={e=>{ setAddrLine2(e.target.value); setDirty(true); }} />
                <input className="ge-input" placeholder="Ciudad"
                       value={city} onChange={e=>{ setCity(e.target.value); setDirty(true); }} />
              </div>
            </div>

            <div className="ge-field">
              <label className="ge-label">Redes sociales</label>
              <div className="ge-grid-3">
                <input className="ge-input" placeholder="Instagram (https://...)"
                       value={instagram} onChange={e=>{ setInstagram(e.target.value); setDirty(true); }} />
                <input className="ge-input" placeholder="Facebook (https://...)"
                       value={facebook} onChange={e=>{ setFacebook(e.target.value); setDirty(true); }} />
                <input className="ge-input" placeholder="TikTok (https://...)"
                       value={tiktok} onChange={e=>{ setTiktok(e.target.value); setDirty(true); }} />
              </div>
              <div className="ge-field" style={{padding:0, marginTop:8}}>
                <input className="ge-input" placeholder="Sitio web (https://...)"
                       value={website} onChange={e=>{ setWebsite(e.target.value); setDirty(true); }} />
              </div>
            </div>
          </section>

          {err && <div className="ge-error">{err}</div>}

          <div className="ge-footer">
            <button type="button" className="ge-btn outline" onClick={handleClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="ge-btn primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>

        <style>{`
          .ge-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;align-items:center;z-index:10000}
          .ge-modal{width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25)}
          .ge-header{height:48px;display:grid;place-items:center;border-bottom:1px solid #e5e7eb}
          .ge-header h3{margin:0;font-size:1rem;font-weight:800}
          .ge-body{overflow-y:auto;padding:0 0 72px}
          .ge-section-title{margin:18px 20px 8px;font-size:1.05rem;font-weight:800}
          section > .ge-field:first-of-type{margin-top:0}
          .ge-field{padding:0 20px;margin-top:12px}
          .ge-label{display:block;font-size:.9rem;font-weight:600;margin-bottom:6px;color:#111}
          .ge-input{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:12px 12px;background:#fff;outline:none}
          .ge-input:focus{box-shadow:0 0 0 2px #a7f3d0;border-color:#34d399}
          .ge-input-hex{margin-top:8px}
          .ge-grid-3{display:grid;grid-template-columns:1fr;gap:12px;padding:0 20px}
          @media (min-width:640px){ .ge-grid-3{grid-template-columns:repeat(3,1fr)} }

          .ge-color-wrap{display:flex;flex-direction:column;gap:6px}
          .ge-color-ctrl{
            width:100%;
            height:44px;
            border:1px solid #d1d5db;
            border-radius:10px;
            padding:0; background:#fff; outline:none; cursor:pointer;
          }

          .ge-logo-wrap{display:flex;gap:8px;align-items:center}
          .ge-muted{color:#6b7280;font-size:.9rem}
          .ge-hidden-file{display:none}
          .ge-preview{display:flex;align-items:center;gap:10px;margin-top:8px}
          .ge-preview img{height:40px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:4px;background:#fff}

          .ge-error{margin:16px 20px 0;background:#ffebe9;border:1px solid #ffb3b3;color:#b42318;border-radius:10px;padding:10px;font-size:.9rem}
          .ge-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:12px 16px;display:flex;gap:8px;justify-content:flex-end}
          .ge-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}
          .ge-btn.primary{background:#34d399;color:#111}
          .ge-btn.primary:disabled{opacity:.6;cursor:default}
          .ge-btn.outline{background:#fff;border:1px solid #e5e7eb}
          .ge-btn.ghost{background:#f3f4f6;border:1px solid #e5e7eb}
          @media (max-width:640px){
            .ge-header{height:44px}
            .ge-section-title{margin:14px 16px 6px}
            .ge-field{padding:0 16px}
            .ge-grid-3{padding:0 16px}
            .ge-footer{padding:10px 12px}
          }
        `}</style>
      </div>
    </div>
  );
}