/* eslint-disable no-empty */
// src/componentes/BusinessCreateModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { useBizTheme } from "../tema/ThemeProviderNegocio";

export default function BusinessCreateModal({ open, onClose, onCreateComplete }) {
  // Branding base
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#38e07b");
  const [secondary, setSecondary] = useState("#1f2923");
  const [background, setBackground] = useState("#f6f8f7");
  const [font, setFont] = useState("Inter, system-ui, sans-serif");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  // Datos opcionales del local
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [city, setCity] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");

  // Maxi
  const [mxEmail, setMxEmail] = useState("");
  const [mxPass, setMxPass] = useState("");
  const [mxCod, setMxCod] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => {} };
  const fileInputRef = useRef(null);
  const prevRestoreRef = useRef(null);
  const tempObjectUrlRef = useRef(null);

  // Reset al cerrar
  useEffect(() => {
    if (open) return;
    setName("");
    setPrimary("#38e07b");
    setSecondary("#1f2923");
    setBackground("#f6f8f7");
    setFont("Inter, system-ui, sans-serif");
    setLogoUrl("");
    setLogoFile(null);

    setPhone(""); setDescription("");
    setAddrLine1(""); setAddrLine2(""); setCity("");
    setInstagram(""); setFacebook(""); setTiktok(""); setWebsite("");

    setMxEmail(""); setMxPass(""); setMxCod("");
    setShowPass(false);
    setBusy(false); setErr("");

    if (tempObjectUrlRef.current) {
      try { URL.revokeObjectURL(tempObjectUrlRef.current); } catch {}
      tempObjectUrlRef.current = null;
    }
  }, [open]);

  const brandingToPalette = (br) => ({
    name: "Custom",
    primary: br.primary,
    secondary: br.secondary,
    bg: br.background,
    surface: "#ffffff",
    border: "#e5e7eb",
    fg: br.fg || br.primary || "#1f2923",
    font: br.font,
    logo_url: br.logo_url || null,
  });

  // Preview en vivo (no persistente)
  useEffect(() => {
    if (!open) return;
    const draft = brandingToPalette({
      primary, secondary, background, font, logo_url: logoUrl || null
    });
    setPaletteForBiz(draft, { persist: false });
    prevRestoreRef.current = () => {
      // Reaplica paleta del negocio activo
      window.dispatchEvent(new CustomEvent("business:switched"));
    };
  }, [open, primary, secondary, background, font, logoUrl, setPaletteForBiz]);

  const handleClose = () => {
    if (busy) return;
    try { prevRestoreRef.current?.(); } catch {}
    onClose?.();
  };

  const isHttpUrl = (u) => /^https?:\/\/.+/i.test(String(u || "").trim());
  const normalizeEmpty = (s) => (String(s || "").trim() === "" ? null : s.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setErr("");
    if (!name.trim()) return setErr("Ingresá un nombre para el local.");
    if (!mxEmail || !mxPass || !mxCod) return setErr("Completá las credenciales de Maxi.");

    setBusy(true);
    try {
      // 1) Crear negocio sin logo definitivo si es archivo
      const draftBranding = { primary, secondary, background, font, logo_url: null };
      if (isHttpUrl(logoUrl) && !logoFile) draftBranding.logo_url = logoUrl.trim();

      const payload = {
        name: name.trim(),
        branding: draftBranding,
        // opcionales
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
      };

      const resp = await BusinessesAPI.create(payload);
      const biz = resp?.business ?? resp;
      if (!biz?.id) throw new Error("No se pudo crear el local");

      // 2) Subir logo si hay archivo
      let finalLogoUrl = draftBranding.logo_url || null;
      if (logoFile) {
        try {
          const up = await BusinessesAPI.uploadLogo(biz.id, logoFile);
          finalLogoUrl = up?.url || up?.logo_url || up?.secure_url || null;
          if (finalLogoUrl) {
            await BusinessesAPI.update(biz.id, {
              props: {
                ...(biz.props || {}),
                branding: { ...draftBranding, logo_url: finalLogoUrl },
              }
            });
          }
        } catch (eUp) {
          console.warn("Falló subida de logo (continuo sin romper):", eUp);
        }
      }

      // 3) Guardar credenciales Maxi
      await BusinessesAPI.maxiSave(biz.id, { email: mxEmail, password: mxPass, codcli: mxCod });

      // 4) Activar y aplicar tema
      localStorage.setItem("activeBusinessId", biz.id);
      window.dispatchEvent(new CustomEvent("business:switched"));

      const persisted = brandingToPalette({ ...draftBranding, logo_url: finalLogoUrl });
      setPaletteForBiz(persisted, { persist: true, biz: biz.id });

      // 5) Avisar arriba y cerrar
      onCreateComplete?.({
        ...biz,
        props: {
          ...(biz.props || {}),
          branding: { ...draftBranding, logo_url: finalLogoUrl },
        }
      });
      onClose?.();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "No se pudo completar la creación del local.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const ColorField = ({ id, label, value, onChange }) => (
    <div className="gc-field">
      <label htmlFor={id} className="gc-label">{label}</label>
      <div className="gc-color-wrap">
        <input
          id={id}
          aria-label={`${label} picker`}
          type="color"
          className="gc-color-ctrl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="gc-input gc-input-hex"
          placeholder="#000000"
          value={value}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v); else onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="gc-overlay" onClick={handleClose}>
      <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gc-header"><h3>Crear nuevo local</h3></div>

        <form onSubmit={submit} className="gc-body">
          <section>
            <h4 className="gc-section-title">Detalles del local</h4>
            <div className="gc-field">
              <label htmlFor="gc-name" className="gc-label">Nombre</label>
              <input id="gc-name" className="gc-input" placeholder="e.g., Downtown Eatery"
                     value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </section>

          <section>
            <h4 className="gc-section-title">Estilos</h4>
            <div className="gc-grid-3">
              <ColorField id="gc-primary" label="Primary Color" value={primary} onChange={setPrimary} />
              <ColorField id="gc-secondary" label="Secondary Color" value={secondary} onChange={setSecondary} />
              <ColorField id="gc-bg" label="Background Color" value={background} onChange={setBackground} />
            </div>

            <div className="gc-field">
              <label className="gc-label">Logo</label>
              <div className="gc-logo-wrap">
                <input
                  className="gc-input flex-1"
                  placeholder="Pega una URL (https://...)"
                  value={logoUrl}
                  onChange={(e) => { setLogoUrl(e.target.value); setLogoFile(null); }}
                />
                <span className="gc-muted">o</span>
                <button
                  type="button"
                  className="gc-btn ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  Subir archivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="gc-hidden-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    if (tempObjectUrlRef.current) {
                      try { URL.revokeObjectURL(tempObjectUrlRef.current); } catch {}
                    }
                    setLogoFile(f);
                    const temp = URL.createObjectURL(f);
                    tempObjectUrlRef.current = temp;
                    setLogoUrl(temp);
                  }}
                />
              </div>
              {!!logoUrl && (
                <div className="gc-preview">
                  <img src={logoUrl} alt="preview logo" />
                </div>
              )}
            </div>

            <div className="gc-field">
              <label htmlFor="gc-font" className="gc-label">Fuente (CSS)</label>
              <input id="gc-font" className="gc-input" placeholder="Inter, system-ui, sans-serif"
                     value={font} onChange={(e) => setFont(e.target.value)} />
            </div>
          </section>

          <section>
            <h4 className="gc-section-title">Información del local (opcional)</h4>

            <div className="gc-field">
              <label htmlFor="gc-phone" className="gc-label">Teléfono</label>
              <input id="gc-phone" className="gc-input" placeholder="+54 9 ..."
                     value={phone} onChange={(e)=>setPhone(e.target.value)} />
            </div>

            <div className="gc-field">
              <label htmlFor="gc-desc" className="gc-label">Descripción</label>
              <textarea id="gc-desc" className="gc-input" rows={3} placeholder="Breve descripción"
                        value={description} onChange={(e)=>setDescription(e.target.value)} />
            </div>

            <div className="gc-field">
              <label className="gc-label">Ubicación</label>
              <div className="gc-grid-3">
                <input className="gc-input" placeholder="Calle y número"
                       value={addrLine1} onChange={e=>setAddrLine1(e.target.value)} />
                <input className="gc-input" placeholder="Piso/Depto (opcional)"
                       value={addrLine2} onChange={e=>setAddrLine2(e.target.value)} />
                <input className="gc-input" placeholder="Ciudad"
                       value={city} onChange={e=>setCity(e.target.value)} />
              </div>
            </div>

            <div className="gc-field">
              <label className="gc-label">Redes sociales</label>
              <div className="gc-grid-3">
                <input className="gc-input" placeholder="Instagram (https://...)"
                       value={instagram} onChange={e=>setInstagram(e.target.value)} />
                <input className="gc-input" placeholder="Facebook (https://...)"
                       value={facebook} onChange={e=>setFacebook(e.target.value)} />
                <input className="gc-input" placeholder="TikTok (https://...)"
                       value={tiktok} onChange={e=>setTiktok(e.target.value)} />
              </div>
              <div className="gc-field" style={{padding:0, marginTop:8}}>
                <input className="gc-input" placeholder="Sitio web (https://...)"
                       value={website} onChange={e=>setWebsite(e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h4 className="gc-section-title">Credenciales de MaxiRest</h4>
            <div className="gc-field">
              <label htmlFor="gc-mx-email" className="gc-label">Email</label>
              <input id="gc-mx-email" type="email" className="gc-input" placeholder="email@example.com"
                     value={mxEmail} onChange={(e) => setMxEmail(e.target.value)} required />
            </div>

            <div className="gc-field">
              <label htmlFor="gc-mx-pass" className="gc-label">Contraseña</label>
              <div className="gc-inline">
                <input id="gc-mx-pass" type={showPass ? "text" : "password"} className="gc-input"
                       placeholder="••••••••" value={mxPass} onChange={(e) => setMxPass(e.target.value)} required />
                <button type="button" className="gc-btn outline" onClick={() => setShowPass(s => !s)}>
                  {showPass ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="gc-field">
              <label htmlFor="gc-mx-cod" className="gc-label">Código de cliente</label>
              <input id="gc-mx-cod" className="gc-input" placeholder="Ej: 12345"
                     value={mxCod} onChange={(e) => setMxCod(e.target.value)} required />
            </div>
          </section>

          {err && <div className="gc-error">{err}</div>}

          <div className="gc-footer">
            <button type="button" className="gc-btn outline" onClick={handleClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="gc-btn primary" disabled={busy}>
              {busy ? "Creando…" : "Crear Local"}
            </button>
          </div>
        </form>

        <style>{`
          .gc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;align-items:center;z-index:10000}
          .gc-modal{width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25)}
          .gc-header{height:48px;display:grid;place-items:center;border-bottom:1px solid #e5e7eb}
          .gc-header h3{margin:0;font-size:1rem;font-weight:800}
          .gc-body{overflow-y:auto;padding:0 0 72px}
          .gc-section-title{margin:18px 20px 8px;font-size:1.05rem;font-weight:800}
          section > .gc-field:first-of-type{margin-top:0}
          .gc-field{padding:0 20px;margin-top:12px}
          .gc-label{display:block;font-size:.9rem;font-weight:600;margin-bottom:6px;color:#111}
          .gc-input{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:12px 12px;background:#fff;outline:none}
          .gc-input:focus{box-shadow:0 0 0 2px #a7f3d0;border-color:#34d399}
          .gc-input-hex{margin-top:8px}
          .gc-grid-3{display:grid;grid-template-columns:1fr;gap:12px;padding:0 20px}
          @media (min-width:640px){ .gc-grid-3{grid-template-columns:repeat(3,1fr)} }
          .gc-color-wrap{display:flex;flex-direction:column;gap:6px}
          .gc-color-ctrl{width:100%;height:44px;border:1px solid #d1d5db;border-radius:10px;padding:0;background:#fff;outline:none;cursor:pointer}
          .gc-logo-wrap{display:flex;gap:8px;align-items:center}
          .gc-muted{color:#6b7280;font-size:.9rem}
          .gc-hidden-file{display:none}
          .gc-inline{display:flex;gap:8px;align-items:center}
          .gc-preview{display:flex;align-items:center;gap:10px;margin-top:8px}
          .gc-preview img{height:40px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:4px;background:#fff}
          .gc-error{margin:16px 20px 0;background:#ffebe9;border:1px solid #ffb3b3;color:#b42318;border-radius:10px;padding:10px;font-size:.9rem}
          .gc-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:12px 16px;display:flex;gap:8px;justify-content:flex-end}
          .gc-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}
          .gc-btn.primary{background:#34d399;color:#111}
          .gc-btn.primary:disabled{opacity:.6;cursor:default}
          .gc-btn.outline{background:#fff;border:1px solid #e5e7eb}
          .gc-btn.ghost{background:#e7f8ee;color:#0b0f0c;border:1px solid #c6f0d9}
          @media (max-width:640px){
            .gc-header{height:44px}
            .gc-section-title{margin:14px 16px 6px}
            .gc-field{padding:0 16px}
            .gc-grid-3{padding:0 16px}
            .gc-footer{padding:10px 12px}
          }
        `}</style>
      </div>
    </div>
  );
}
