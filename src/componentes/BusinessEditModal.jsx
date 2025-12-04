/* eslint-disable no-empty */
// src/componentes/BusinessEditModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { useBizTheme } from "../tema/ThemeProviderNegocio";

/* ───────────────── ColorField ───────────────── */
const ColorField = ({ id, label, value, onChange }) => (
  <div className="gx-field">
    <label htmlFor={id} className="gx-label">{label}</label>
    <div className="gx-color-wrap">
      <input
        id={id}
        aria-label={`${label} picker`}
        type="color"
        className="gx-color-ctrl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="gx-input gx-input-hex"
        placeholder="#000000"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const v = raw.startsWith("#") ? raw : `#${raw}`;
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
          else onChange(raw);
        }}
      />
    </div>
  </div>
);

export default function BusinessEditModal({ open, business, onClose, onSaved }) {
  /* ───────────────── Wizard ───────────────── */
  const [step, setStep] = useState(1); // 1 Datos, 2 Estilos, 3 Info, 4 Redes, 5 Maxi
  const next = () => setStep((s) => Math.min(5, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  /* ───────────────── Estado ───────────────── */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  // Branding/Datos
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#38e07b");
  const [secondary, setSecondary] = useState("#1f2923");
  const [background, setBackground] = useState("#f6f8f7");
  const [font, setFont] = useState("Inter, system-ui, sans-serif");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  // Info
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [city, setCity] = useState("");

  // Redes
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");

  // Maxi (sin sync automática)
  const [mxEmail, setMxEmail] = useState("");
  const [mxPass, setMxPass] = useState(""); // opcional en edición
  const [mxCod, setMxCod] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [maxiStatus, setMaxiStatus] = useState(null);

  // Tema / refs
  const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => { } };
  const fileInputRef = useRef(null);
  const tempObjectUrlRef = useRef(null);

  /* ───────────────── Helpers ───────────────── */
  const normalizeEmpty = (s) => (String(s || "").trim() === "" ? null : s.trim());
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

  /* ───────────────── Dirty check ───────────────── */
  const snapshotRef = useRef(null);
  const makeSnapshot = () => ({
    name, primary, secondary, background, font, logoUrl,
    phone, description, addrLine1, addrLine2, city,
    instagram, facebook, tiktok, website,
    mxEmail, mxCod, hasPass: Boolean(mxPass && mxPass.trim()),
  });
  const isDirty = useMemo(() => {
    if (!snapshotRef.current) return false;
    const a = makeSnapshot();
    const b = snapshotRef.current;
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [name, primary, secondary, background, font, logoUrl, phone, description, addrLine1, addrLine2, city, instagram, facebook, tiktok, website, mxEmail, mxCod, mxPass]);

  /* ───────────────── Cargar negocio ───────────────── */
  useEffect(() => {
    if (!open || !business) return;

    const br = business?.branding || business?.props?.branding || {};
    const contact = business?.props?.contact || {};
    const address = business?.props?.address || {};
    const social = business?.props?.social || {};
    const maxi = business?.props?.maxi || {};

    setStep(1);
    setBusy(false); setErr(""); setNotice("");

    setName(business?.name || "");
    setPrimary(br.primary ?? "#38e07b");
    setSecondary(br.secondary ?? "#1f2923");
    setBackground(br.background ?? "#f6f8f7");
    setFont(br.font ?? "Inter, system-ui, sans-serif");
    setLogoUrl(br.logo_url ?? "");
    setLogoFile(null);

    setPhone(contact.phone || "");
    setDescription(business?.props?.description || "");
    setAddrLine1(address.line1 || "");
    setAddrLine2(address.line2 || "");
    setCity(address.city || "");
    setInstagram(social.instagram || "");
    setFacebook(social.facebook || "");
    setTiktok(social.tiktok || "");
    setWebsite(social.website || "");

    setMxEmail(maxi.email || "");
    setMxPass(""); // no exponer
    setMxCod(maxi.codcli || "");
    setMaxiStatus(null);

    // snapshot inicial
    setTimeout(() => {
      snapshotRef.current = {
        name: business?.name || "",
        primary: br.primary ?? "#38e07b",
        secondary: br.secondary ?? "#1f2923",
        background: br.background ?? "#f6f8f7",
        font: br.font ?? "Inter, system-ui, sans-serif",
        logoUrl: br.logo_url ?? "",
        phone: contact.phone || "",
        description: business?.props?.description || "",
        addrLine1: address.line1 || "",
        addrLine2: address.line2 || "",
        city: address.city || "",
        instagram: social.instagram || "",
        facebook: social.facebook || "",
        tiktok: social.tiktok || "",
        website: social.website || "",
        mxEmail: maxi.email || "",
        mxCod: maxi.codcli || "",
        hasPass: false,
      };
    }, 0);
  }, [open, business]);

  /* ───────────────── Preview de tema en vivo (sin persistir) ───────────────── */
  useEffect(() => {
    if (!open) return;
    const draft = brandingToPalette({
      primary, secondary, background, font, logo_url: logoUrl || null
    });
    // Preview en vivo, sin persistir
    try { setPaletteForBiz(draft, { persist: false }); } catch { }
  }, [open, primary, secondary, background, font, logoUrl, setPaletteForBiz]);

  /* ───────────────── Handlers ───────────────── */
  const handleClose = () => {
    if (tempObjectUrlRef.current) {
      try { URL.revokeObjectURL(tempObjectUrlRef.current); } catch { }
      tempObjectUrlRef.current = null;
    }
    onClose?.();
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (tempObjectUrlRef.current) {
      try { URL.revokeObjectURL(tempObjectUrlRef.current); } catch { }
      tempObjectUrlRef.current = null;
    }
    const temp = URL.createObjectURL(f);
    tempObjectUrlRef.current = temp;
    setLogoUrl(temp);
    setLogoFile(f);
  };

  async function saveBrandingAndInfo(bizId) {
    // 1) subir logo si corresponde
    let finalLogoUrl = logoUrl || null;
    if (logoFile) {
      const up = await BusinessesAPI.uploadLogo(bizId, logoFile);
      finalLogoUrl = up?.url || up?.logo_url || up?.secure_url || finalLogoUrl;
    }

    // 2) armar branding
    const branding = { primary, secondary, background, font, logo_url: finalLogoUrl };

    // 3) patch: ACTUALIZAMOS raíz y props
    const prevProps = business?.props || {};
    const payload = {
      name,
      branding, // ⬅️ NUEVO: reflejamos también en la raíz del negocio
      props: {
        ...prevProps,                  // mantenemos maxi, etc.
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

    const res = await BusinessesAPI.update(bizId, payload);

    // 4) persistir tema para el refresh
    try {
      const palette = brandingToPalette(branding);
      setPaletteForBiz(palette, { persist: true, biz: bizId });
      window.dispatchEvent(new CustomEvent("theme:updated"));
    } catch { }

    return res?.business ?? res ?? { id: bizId, ...payload };
  }

  async function saveMaxi(bizId) {
    const changes = {};
    if (mxEmail.trim()) changes.email = mxEmail.trim();
    if (mxCod.trim()) changes.codcli = mxCod.trim();
    if (mxPass.trim()) changes.password = mxPass.trim();
    if (Object.keys(changes).length) {
      await BusinessesAPI.maxiSave(bizId, changes);
    }
  }

  async function handleTestMaxi(e) {
    e?.preventDefault?.();
    if (!business?.id) return;
    setErr(""); setNotice("Chequeando credenciales de Maxi…");
    try {
      await saveMaxi(business.id);
      const st = await BusinessesAPI.maxiStatus(business.id);
      setMaxiStatus(st || null);
      setNotice(st?.ok ? "Maxi: OK" : (st?.detail || "Maxi: error"));
    } catch (e2) {
      setMaxiStatus({ ok: false, detail: String(e2?.message || "error") });
      setNotice("");
      setErr("No se pudo validar con Maxi. Revisá email/codcli/clave.");
    }
  }

  async function handleSaveNow(e) {
    e?.preventDefault?.();
    if (!business?.id || busy || !isDirty) return;

    setBusy(true); setErr(""); setNotice("");
    try {
      // 1) Guardar branding + info (y logo si hay)
      const saved = await saveBrandingAndInfo(business.id);
      await saveMaxi(business.id);

      // 2) Persistir tema como en create
      const branding = saved?.props?.branding || saved?.branding || {
        primary, secondary, background, font, logo_url: logoUrl || null,
      };
      const persisted = brandingToPalette(branding);

      // aplica y guarda en LS (por-biz y mirror CURRENT)
      setPaletteForBiz(persisted, { persist: true, biz: business.id });

      // si este negocio es el activo, mantenerlo
      const active = localStorage.getItem("activeBusinessId");
      if (String(active) === String(business.id)) {
        // espejo para evitar flash en recarga
        try { localStorage.setItem("bizTheme:current", JSON.stringify(persisted)); } catch { }
      }

      // 3) Notificar a toda la app
      window.dispatchEvent(new CustomEvent("business:branding-updated", {
        detail: { id: business.id, branding }
      }));
      window.dispatchEvent(new CustomEvent("business:updated", {
        detail: { id: business.id, business: saved }
      }));

      // 4) Notificar al padre y cerrar
      snapshotRef.current = makeSnapshot();
      onSaved?.(saved);
      onClose?.();
    } catch (e2) {
      console.error(e2);
      const msg = String(e2?.message || "");
      setErr(msg || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  /* ───────────────── Validación para “Siguiente” ───────────────── */
  const canNextDatos = useMemo(() => name.trim().length > 0, [name]);

  if (!open) return null;

  return (
    <div className="gx-overlay" onClick={handleClose}>
      <div className="gx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gx-header">
          <h3>Editar local — {["Datos", "Estilos", "Información", "Redes", "Maxi"][step - 1]}</h3>
          <div className="gx-steps">
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} className={n === step ? "on" : (n < step ? "done" : "")}>{n}</span>
            ))}
          </div>
        </div>

        {/* STEP 1: Datos */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (canNextDatos) next(); }} className="gx-body">
            <section>
              <h4 className="gx-section-title">Detalles del local</h4>
              <div className="gx-field">
                <label htmlFor="gx-name" className="gx-label">Nombre</label>
                <input id="gx-name" className="gx-input" placeholder="e.g., Downtown Eatery"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </section>

            <div className="gx-footer">
              <button type="button" className="gx-btn outline" onClick={handleClose} disabled={busy}>Cancelar</button>
              <button type="button" className="gx-btn primary" onClick={handleSaveNow} disabled={!isDirty || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="submit" className="gx-btn outline" disabled={!canNextDatos || busy}>Siguiente</button>
            </div>
          </form>
        )}

        {/* STEP 2: Estilos */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); next(); }} className="gx-body">
            <section>
              <h4 className="gx-section-title">Estilos</h4>
              <div className="gx-grid-3">
                <ColorField id="gx-primary" label="Primary Color" value={primary} onChange={setPrimary} />
                <ColorField id="gx-secondary" label="Secondary Color" value={secondary} onChange={setSecondary} />
                <ColorField id="gx-bg" label="Background Color" value={background} onChange={setBackground} />
              </div>

              <div className="gx-field">
                <label className="gx-label">Logo</label>
                <div className="gx-logo-wrap">
                  <input
                    className="gx-input flex-1"
                    placeholder="Pega una URL (https://...)"
                    value={logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); setLogoFile(null); }}
                  />
                  <span className="gx-muted">o</span>
                  <button type="button" className="gx-btn ghost" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    Subir archivo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="gx-hidden-file"
                    onChange={onPickFile}
                  />
                </div>
                {!!logoUrl && (
                  <div className="gx-preview">
                    <img src={logoUrl} alt="preview logo" />
                    <button
                      type="button"
                      className="gx-btn outline"
                      onClick={() => {
                        try { if (tempObjectUrlRef.current) URL.revokeObjectURL(tempObjectUrlRef.current); } catch { }
                        tempObjectUrlRef.current = null;
                        setLogoUrl(""); setLogoFile(null);
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <div className="gx-field">
                <label htmlFor="gx-font" className="gx-label">Fuente (CSS)</label>
                <input id="gx-font" className="gx-input" placeholder="Inter, system-ui, sans-serif"
                  value={font} onChange={(e) => setFont(e.target.value)} />
              </div>
            </section>

            <div className="gx-footer">
              <button type="button" className="gx-btn outline" onClick={prev} disabled={busy}>Atrás</button>
              <button type="button" className="gx-btn primary" onClick={handleSaveNow} disabled={!isDirty || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="submit" className="gx-btn outline" disabled={busy}>Siguiente</button>
            </div>
          </form>
        )}

        {/* STEP 3: Información */}
        {step === 3 && (
          <form onSubmit={(e) => { e.preventDefault(); next(); }} className="gx-body">
            <section>
              <h4 className="gx-section-title">Información del local</h4>
              <div className="gx-field">
                <label htmlFor="gx-phone" className="gx-label">Teléfono</label>
                <input id="gx-phone" className="gx-input" placeholder="+54 9 ..."
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="gx-field">
                <label htmlFor="gx-desc" className="gx-label">Descripción</label>
                <textarea id="gx-desc" className="gx-input" rows={3} placeholder="Breve descripción"
                  value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="gx-field">
                <label className="gx-label">Ubicación</label>
                <div className="gx-grid-3">
                  <input className="gx-input" placeholder="Calle y número"
                    value={addrLine1} onChange={e => setAddrLine1(e.target.value)} />
                  <input className="gx-input" placeholder="Piso/Depto (opcional)"
                    value={addrLine2} onChange={e => setAddrLine2(e.target.value)} />
                  <input className="gx-input" placeholder="Ciudad"
                    value={city} onChange={e => setCity(e.target.value)} />
                </div>
              </div>
            </section>

            <div className="gx-footer">
              <button type="button" className="gx-btn outline" onClick={prev} disabled={busy}>Atrás</button>
              <button type="button" className="gx-btn primary" onClick={handleSaveNow} disabled={!isDirty || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="submit" className="gx-btn outline" disabled={busy}>Siguiente</button>
            </div>
          </form>
        )}

        {/* STEP 4: Redes */}
        {step === 4 && (
          <form onSubmit={(e) => { e.preventDefault(); next(); }} className="gx-body">
            <section>
              <h4 className="gx-section-title">Redes y web</h4>
              <div className="gx-grid-3">
                <input className="gx-input" placeholder="Instagram (https://...)"
                  value={instagram} onChange={e => setInstagram(e.target.value)} />
                <input className="gx-input" placeholder="Facebook (https://...)"
                  value={facebook} onChange={e => setFacebook(e.target.value)} />
                <input className="gx-input" placeholder="TikTok (https://...)"
                  value={tiktok} onChange={e => setTiktok(e.target.value)} />
              </div>
              <div className="gx-field" style={{ padding: 0, marginTop: 8 }}>
                <input className="gx-input" placeholder="Sitio web (https://...)"
                  value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
            </section>

            <div className="gx-footer">
              <button type="button" className="gx-btn outline" onClick={prev} disabled={busy}>Atrás</button>
              <button type="button" className="gx-btn primary" onClick={handleSaveNow} disabled={!isDirty || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="submit" className="gx-btn outline" disabled={busy}>Siguiente</button>
            </div>
          </form>
        )}

        {/* STEP 5: Maxi (sin sincronización) */}
        {step === 5 && (
          <form onSubmit={handleSaveNow} className="gx-body">
            <section>
              <h4 className="gx-section-title">Credenciales de MaxiRest</h4>

              <div className="gx-field">
                <label htmlFor="gx-mx-email" className="gx-label">Email</label>
                <input id="gx-mx-email" type="email" className="gx-input" placeholder="email@example.com"
                  value={mxEmail} onChange={(e) => setMxEmail(e.target.value)} />
              </div>

              <div className="gx-field">
                <label htmlFor="gx-mx-pass" className="gx-label">Contraseña (opcional)</label>
                <div className="gx-inline">
                  <input id="gx-mx-pass" type={showPass ? "text" : "password"} className="gx-input"
                    placeholder="••••••••" value={mxPass} onChange={(e) => setMxPass(e.target.value)} />
                  <button type="button" className="gx-btn outline" onClick={() => setShowPass(s => !s)}>
                    {showPass ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <div className="gx-field">
                <label htmlFor="gx-mx-cod" className="gx-label">Código de cliente</label>
                <input id="gx-mx-cod" className="gx-input" placeholder="Ej: 12345"
                  value={mxCod} onChange={(e) => setMxCod(e.target.value)} />
              </div>

              <div className="gx-field">
                <button type="button" className="gx-btn outline" onClick={handleTestMaxi} disabled={busy}>
                  Probar credenciales
                </button>
                {maxiStatus && (
                  <span className="gx-badge" data-ok={maxiStatus.ok ? "1" : "0"}>
                    {maxiStatus.ok ? "OK" : "ERROR"} {maxiStatus.detail ? `· ${maxiStatus.detail}` : ""}
                  </span>
                )}
              </div>
            </section>

            {err && <div className="gx-error">{err}</div>}
            {notice && <div className="gx-notice">{notice}</div>}

            <div className="gx-footer">
              <button type="button" className="gx-btn outline" onClick={prev} disabled={busy}>Atrás</button>
              <button type="submit" className="gx-btn primary" disabled={!isDirty || busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}

        {/* ───────── estilos ───────── */}
        <style>{`
          .gx-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;align-items:center;z-index:10000}
          .gx-modal{width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25)}
          .gx-header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #e5e7eb}
          .gx-header h3{margin:0;font-size:1rem;font-weight:800}
          .gx-steps{display:flex;gap:6px}
          .gx-steps span{width:22px;height:22px;border-radius:999px;border:1px solid #d1d5db;display:grid;place-items:center;font-size:.8rem}
          .gx-steps span.on{background:#34d399;color:#111;border-color:#34d399;font-weight:800}
          .gx-steps span.done{background:#e8f9f0;color:#111;border-color:#c2f0da}

          .gx-body{overflow-y:auto;padding:0 0 72px}
          .gx-section-title{margin:18px 20px 8px;font-size:1.05rem;font-weight:800}
          section > .gx-field:first-of-type{margin-top:0}
          .gx-field{padding:0 20px;margin-top:12px}
          .gx-label{display:block;font-size:.9rem;font-weight:600;margin-bottom:6px;color:#111}
          .gx-input{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:12px 12px;background:#fff;outline:none}
          .gx-input:focus{box-shadow:0 0 0 2px #a7f3d0;border-color:#34d399}
          .gx-input-hex{margin-top:8px}
          .gx-grid-3{display:grid;grid-template-columns:1fr;gap:12px;padding:0 20px}
          @media (min-width:640px){ .gx-grid-3{grid-template-columns:repeat(3,1fr)} }
          .gx-color-wrap{display:flex;flex-direction:column;gap:6px}
          .gx-color-ctrl{width:100%;height:44px;border:1px solid #d1d5db;border-radius:10px;padding:0;background:#fff;outline:none;cursor:pointer}
          .gx-logo-wrap{display:flex;gap:8px;align-items:center}
          .gx-muted{color:#6b7280;font-size:.9rem}
          .gx-hidden-file{display:none}
          .gx-inline{display:flex;gap:8px;align-items:center}
          .gx-preview{display:flex;align-items:center;gap:10px;margin-top:8px}
          .gx-preview img{height:40px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:4px;background:#fff}
          .gx-error{margin:16px 20px 0;background:#ffebe9;border:1px solid #ffb3b3;color:#b42318;border-radius:10px;padding:10px;font-size:.9rem}
          .gx-notice{margin:16px 20px 0;background:#eef6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:10px;padding:10px;font-size:.9rem}
          .gx-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:12px 16px;display:flex;gap:8px;justify-content:flex-end}
          .gx-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}
          .gx-btn.primary{background:#34d399;color:#111}
          .gx-btn.primary:disabled{opacity:.6;cursor:default}
          .gx-btn.outline{background:#fff;border:1px solid #e5e7eb}
          .gx-btn.ghost{background:#e7f8ee;color:#0b0f0c;border:1px solid #c6f0d9}
          .gx-badge{margin-left:8px;padding:4px 8px;border-radius:999px;border:1px solid #d1d5db;font-size:.8rem}
          .gx-badge[data-ok="1"]{background:#e8f9f0;border-color:#c2f0da}
          .gx-badge[data-ok="0"]{background:#ffebe9;border-color:#ffc9c6}
          @media (max-width:640px){
            .gx-header{height:50px}
            .gx-section-title{margin:14px 16px 6px}
            .gx-field{padding:0 16px}
            .gx-grid-3{padding:0 16px}
            .gx-footer{padding:10px 12px}
          }
        `}</style>
      </div>
    </div>
  );
}
