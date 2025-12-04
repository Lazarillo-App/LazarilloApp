/* eslint-disable no-empty */
// src/componentes/BusinessCreateModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BusinessesAPI } from "@/servicios/apiBusinesses";
import { useBizTheme } from "../tema/ThemeProviderNegocio";

/* ───────────────── Color Field ───────────────── */
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
          const raw = e.target.value.trim();
          const v = raw.startsWith("#") ? raw : `#${raw}`;
          if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
          else onChange(raw);
        }}
      />
    </div>
  </div>
);

/* ───────────────── Wizard ───────────────── */
export default function BusinessCreateModal({ open, onClose, onCreateComplete }) {
  // pasos: 0=Datos, 1=Estilos, 2=Redes, 3=Maxi
  const [step, setStep] = useState(0);
  const steps = ["Datos", "Estilos", "Redes", "Maxi"];

  const [bizCreated, setBizCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  // Paso 0 — Datos del local
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [city, setCity] = useState("");

  // Paso 1 — Estilos
  const [primary, setPrimary] = useState("#38e07b");
  const [secondary, setSecondary] = useState("#1f2923");
  const [background, setBackground] = useState("#f6f8f7");
  const [font, setFont] = useState("Inter, system-ui, sans-serif");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);

  // Paso 2 — Redes
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [website, setWebsite] = useState("");

  // Paso 3 — Maxi
  const [mxEmail, setMxEmail] = useState("");
  const [mxPass, setMxPass] = useState("");
  const [mxCod, setMxCod] = useState("");
  const [showPass, setShowPass] = useState(false);

  const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => {} };
  const fileInputRef = useRef(null);
  const prevRestoreRef = useRef(null);
  const tempObjectUrlRef = useRef(null);

  const isHttpUrl = (u) => /^https?:\/\/.+/i.test(String(u || "").trim());
  const normalizeEmpty = (s) =>
    String(s || "").trim() === "" ? null : s.trim();
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

  /* ─── reset al cerrar ─── */
  useEffect(() => {
    if (open) return;
    setStep(0);
    setBizCreated(null);
    setBusy(false);
    setErr("");
    setNotice("");
    setName("");
    setPhone("");
    setDescription("");
    setAddrLine1("");
    setAddrLine2("");
    setCity("");
    setPrimary("#38e07b");
    setSecondary("#1f2923");
    setBackground("#f6f8f7");
    setFont("Inter, system-ui, sans-serif");
    setLogoUrl("");
    setLogoFile(null);
    setInstagram("");
    setFacebook("");
    setTiktok("");
    setWebsite("");
    setMxEmail("");
    setMxPass("");
    setMxCod("");
    setShowPass(false);
    if (tempObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(tempObjectUrlRef.current);
      } catch {}
      tempObjectUrlRef.current = null;
    }
  }, [open]);

  /* ─── preview de tema en vivo SOLO cuando el paso es Estilos ─── */
  useEffect(() => {
    // Solo cuando se abre el modal EN el paso 1
    if (!open || step !== 1) return;

    const draft = brandingToPalette({
      primary,
      secondary,
      background,
      font,
      logo_url: logoUrl || null,
    });

    // Aplica preview UNA vez al entrar al paso 1
    try {
      setPaletteForBiz(draft, { persist: false });
    } catch {}

    // para restaurar después si hace falta
    prevRestoreRef.current = () => {
      window.dispatchEvent(new CustomEvent("business:switched"));
    };
  }, [open, step]); // intencionalmente solo depende de step/open

  const handleClose = () => {
    if (busy) return;
    try {
      prevRestoreRef.current?.();
    } catch {}
    onClose?.();
  };

  /* ─── Validaciones por paso ─── */
  const canNext = useMemo(() => {
    if (step === 0) return name.trim().length > 0; // Datos
    if (step === 1) return true; // Estilos
    if (step === 2) return true; // Redes
    if (step === 3) return !!mxEmail && !!mxPass && !!mxCod; // Maxi
    return false;
  }, [step, name, mxEmail, mxPass, mxCod]);

  /* ─── Crear local si aún no existe ─── */
  async function ensureBusinessCreated() {
    if (bizCreated?.id) return bizCreated;

    const draftBranding = {
      primary,
      secondary,
      background,
      font,
      logo_url: null,
    };
    if (isHttpUrl(logoUrl) && !logoFile)
      draftBranding.logo_url = logoUrl.trim();

    const payload = {
      name: name.trim(),
      branding: draftBranding,
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
    if (!biz?.id) throw new Error("No se pudo crear el local.");

    // Subir logo si hay archivo
    let finalLogoUrl = draftBranding.logo_url || null;
    if (logoFile) {
      try {
        const up = await BusinessesAPI.uploadLogo(biz.id, logoFile);
        finalLogoUrl =
          up?.url || up?.logo_url || up?.secure_url || finalLogoUrl;

        if (finalLogoUrl) {
          await BusinessesAPI.update(biz.id, {
            props: {
              ...(biz.props || {}),
              branding: { ...draftBranding, logo_url: finalLogoUrl },
            },
          });
        }
      } catch (eUp) {
        console.warn("Falló subida de logo (continúo):", eUp);
      }
    }

    // 🔁 Construimos el objeto completo con props coherentes
    const full = {
      ...biz,
      props: {
        ...(biz.props || {}),
        branding: { ...draftBranding, logo_url: finalLogoUrl },
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

    setBizCreated(full);
    onCreateComplete?.(full);
    window.dispatchEvent(
      new CustomEvent("business:created", { detail: { id: biz.id } })
    );

    // ❌ OJO: acá YA NO cambiamos activeBusinessId ni disparamos business:switched
    return full;
  }

  /* ─── Navegación ─── */
  const onNext = async (e) => {
    e?.preventDefault?.();
    if (busy || !canNext) return;
    setErr("");
    setNotice("");
    if (step < steps.length - 1) setStep(step + 1);
  };
  const onBack = (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setErr("");
    setNotice("");
    if (step > 0) setStep(step - 1);
  };

  /* ─── Finalizar: guardar Maxi + sincronizar ─── */
  const onFinish = async (e) => {
    e?.preventDefault?.();
    if (busy || !canNext) return;
    setErr("");
    setNotice("");
    setBusy(true);

    try {
      // 1️⃣ Crear negocio si aún no existe
      const biz = await ensureBusinessCreated();

      // 2️⃣ Guardar credenciales de Maxi
      await BusinessesAPI.maxiSave(biz.id, {
        email: mxEmail,
        password: mxPass,
        codcli: mxCod,
      });

      // 3️⃣ Sincronizar catálogo (artículos + mapeos)
      setNotice("Sincronizando artículos…");
      const syncRes = await BusinessesAPI.syncNow(biz.id, { scope: "articles" });
      const up = Number(syncRes?.upserted ?? 0);
      const mp = Number(syncRes?.mapped ?? 0);
      setNotice(`Sync OK. Artículos: ${up} · Mapeos: ${mp}`);

      // 4️⃣ AHORA sí: marcar negocio como activo y persistir tema
      const branding =
        biz?.props?.branding || biz?.branding || {
          primary,
          secondary,
          background,
          font,
          logo_url:
            biz?.props?.branding?.logo_url ||
            biz?.branding?.logo_url ||
            null,
        };

      const palette = brandingToPalette(branding);

      // marcar activo
      localStorage.setItem("activeBusinessId", String(biz.id));

      try {
        // guardar tema por negocio
        setPaletteForBiz(palette, { persist: true, biz: biz.id });
        // espejo del tema actual para evitar flash en recarga
        localStorage.setItem("bizTheme:current", JSON.stringify(palette));
      } catch {}

      // notificar cambio de negocio activo
      window.dispatchEvent(
        new CustomEvent("business:switched", { detail: { id: biz.id } })
      );

      onClose?.();
    } catch (e2) {
      console.error(e2);
      const msg = String(e2?.message || "");
      if (msg.includes("UNAUTHORIZED_ACCESS") || msg.includes("401")) {
        setErr(
          "Maxi devolvió 401: credenciales inválidas o token caído. Revisá email/clave/codcli."
        );
      } else {
        setErr(msg || "No se pudo completar la creación/sincronización.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="gc-overlay" onClick={handleClose}>
      <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gc-header">
          <h3>Nuevo local</h3>
        </div>

        {/* Stepper */}
        <div className="gc-steps">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`gc-step ${
                i === step ? "active" : i < step ? "done" : ""
              }`}
            >
              <span className="gc-step-index">{i + 1}</span>
              <span className="gc-step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="gc-body">
          {step === 0 && (
            <form onSubmit={onNext}>
              <section>
                <h4 className="gc-section-title">Datos del local</h4>
                <div className="gc-field">
                  <label htmlFor="gc-name" className="gc-label">
                    Nombre
                  </label>
                  <input
                    id="gc-name"
                    className="gc-input"
                    placeholder="e.g., Downtown Eatery"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="gc-grid-3">
                  <div className="gc-field">
                    <label className="gc-label">Teléfono</label>
                    <input
                      className="gc-input"
                      placeholder="+54 9 ..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="gc-field">
                    <label className="gc-label">Ciudad</label>
                    <input
                      className="gc-input"
                      placeholder="Ciudad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
                <div className="gc-grid-3">
                  <div className="gc-field">
                    <label className="gc-label">Calle</label>
                    <input
                      className="gc-input"
                      placeholder="Calle 123"
                      value={addrLine1}
                      onChange={(e) => setAddrLine1(e.target.value)}
                    />
                  </div>
                  <div className="gc-field">
                    <label className="gc-label">Número</label>
                    <input
                      className="gc-input"
                      placeholder="(opcional)"
                      value={addrLine2}
                      onChange={(e) => setAddrLine2(e.target.value)}
                    />
                  </div>
                  <div className="gc-field">
                    <label className="gc-label">Descripción</label>
                    <input
                      className="gc-input"
                      placeholder="Breve descripción"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {err && <div className="gc-error">{err}</div>}
              {notice && <div className="gc-notice">{notice}</div>}

              <div className="gc-footer">
                <button
                  type="button"
                  className="gc-btn outline"
                  onClick={handleClose}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="gc-btn primary"
                  disabled={!canNext || busy}
                >
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={onNext}>
              <section>
                <h4 className="gc-section-title">Estilos</h4>
                <div className="gc-grid-3">
                  <ColorField
                    id="gc-primary"
                    label="Primary"
                    value={primary}
                    onChange={setPrimary}
                  />
                  <ColorField
                    id="gc-secondary"
                    label="Secondary"
                    value={secondary}
                    onChange={setSecondary}
                  />
                  <ColorField
                    id="gc-bg"
                    label="Background"
                    value={background}
                    onChange={setBackground}
                  />
                </div>

                <div className="gc-field">
                  <label className="gc-label">Logo</label>
                  <div className="gc-logo-wrap">
                    <input
                      className="gc-input flex-1"
                      placeholder="Pega una URL (https://...)"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setLogoFile(null);
                      }}
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
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (tempObjectUrlRef.current) {
                          try {
                            URL.revokeObjectURL(tempObjectUrlRef.current);
                          } catch {}
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
                  <label htmlFor="gc-font" className="gc-label">
                    Fuente (CSS)
                  </label>
                  <input
                    id="gc-font"
                    className="gc-input"
                    placeholder="Inter, system-ui, sans-serif"
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                  />
                </div>
              </section>

              {err && <div className="gc-error">{err}</div>}
              {notice && <div className="gc-notice">{notice}</div>}

              <div className="gc-footer">
                <button
                  type="button"
                  className="gc-btn outline"
                  onClick={onBack}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="gc-btn primary"
                  disabled={!canNext || busy}
                >
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={onNext}>
              <section>
                <h4 className="gc-section-title">Redes sociales</h4>
                <div className="gc-grid-3">
                  <div className="gc-field">
                    <label className="gc-label">Instagram</label>
                    <input
                      className="gc-input"
                      placeholder="https://instagram.com/..."
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                    />
                  </div>
                  <div className="gc-field">
                    <label className="gc-label">Facebook</label>
                    <input
                      className="gc-input"
                      placeholder="https://facebook.com/..."
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                    />
                  </div>
                  <div className="gc-field">
                    <label className="gc-label">TikTok</label>
                    <input
                      className="gc-input"
                      placeholder="https://tiktok.com/@..."
                      value={tiktok}
                      onChange={(e) => setTiktok(e.target.value)}
                    />
                  </div>
                </div>
                <div
                  className="gc-field"
                  style={{ padding: 0, marginTop: 8 }}
                >
                  <label className="gc-label">Sitio web</label>
                  <input
                    className="gc-input"
                    placeholder="https://..."
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </section>

              {err && <div className="gc-error">{err}</div>}
              {notice && <div className="gc-notice">{notice}</div>}

              <div className="gc-footer">
                <button
                  type="button"
                  className="gc-btn outline"
                  onClick={onBack}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="gc-btn primary"
                  disabled={!canNext || busy}
                >
                  Siguiente
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={onFinish}>
              <section>
                <h4 className="gc-section-title">Credenciales de MaxiRest</h4>
                <div className="gc-field">
                  <label htmlFor="gc-mx-email" className="gc-label">
                    Email
                  </label>
                  <input
                    id="gc-mx-email"
                    type="email"
                    className="gc-input"
                    placeholder="email@example.com"
                    value={mxEmail}
                    onChange={(e) => setMxEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="gc-field">
                  <label htmlFor="gc-mx-pass" className="gc-label">
                    Contraseña
                  </label>
                  <div className="gc-inline">
                    <input
                      id="gc-mx-pass"
                      type={showPass ? "text" : "password"}
                      className="gc-input"
                      placeholder="••••••••"
                      value={mxPass}
                      onChange={(e) => setMxPass(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="gc-btn outline"
                      onClick={() => setShowPass((s) => !s)}
                    >
                      {showPass ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>

                <div className="gc-field">
                  <label htmlFor="gc-mx-cod" className="gc-label">
                    Código de cliente
                  </label>
                  <input
                    id="gc-mx-cod"
                    className="gc-input"
                    placeholder="Ej: 12345"
                    value={mxCod}
                    onChange={(e) => setMxCod(e.target.value)}
                    required
                  />
                </div>
              </section>

              {err && <div className="gc-error">{err}</div>}
              {notice && <div className="gc-notice">{notice}</div>}

              <div className="gc-footer">
                <button
                  type="button"
                  className="gc-btn outline"
                  onClick={onBack}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="gc-btn primary"
                  disabled={!canNext || busy}
                >
                  {busy ? "Creando" : "Crear"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* estilos del modal/wizard */}
        <style>{`
          .gc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:10000}
          .gc-modal{width:min(820px,96vw);background:#fff;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25)}
          .gc-header{height:52px;display:grid;place-items:center;border-bottom:1px solid #e5e7eb}
          .gc-header h3{margin:0;font-size:1.05rem;font-weight:800}

          .gc-steps{display:flex;gap:8px;align-items:center;justify-content:center;padding:10px 12px;border-bottom:1px solid #eef2f7;background:#fafafa}
          .gc-step{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid #e5e7eb;font-weight:700;font-size:.85rem;color:#475569}
          .gc-step .gc-step-index{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#e5e7eb;font-size:.8rem}
          .gc-step.active{border-color:#34d399;color:#065f46}
          .gc-step.active .gc-step-index{background:#34d399;color:#0b0f0c}
          .gc-step.done{border-color:#a7f3d0;color:#065f46;opacity:.9}
          .gc-step.done .gc-step-index{background:#a7f3d0;color:#0b0f0c}

          .gc-body{padding:16px 18px 12px}
          section{margin-bottom:8px}
          .gc-section-title{margin:0 0 8px;font-size:1rem;font-weight:800}
          .gc-field{margin-top:10px}
          .gc-label{display:block;font-size:.9rem;font-weight:600;margin-bottom:6px;color:#111}
          .gc-input{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:12px;background:#fff;outline:none}
          .gc-input:focus{box-shadow:0 0 0 2px #a7f3d0;border-color:#34d399}
          .gc-input-hex{margin-top:8px}
          .gc-grid-3{display:grid;grid-template-columns:1fr;gap:12px}
          @media (min-width:640px){ .gc-grid-3{grid-template-columns:repeat(3,1fr)} }
          .gc-color-wrap{display:flex;flex-direction:column;gap:6px}
          .gc-color-ctrl{width:100%;height:44px;border:1px solid #d1d5db;border-radius:10px;padding:0;background:#fff;outline:none;cursor:pointer}
          .gc-logo-wrap{display:flex;gap:8px;align-items:center}
          .gc-muted{color:#6b7280;font-size:.9rem}
          .gc-hidden-file{display:none}
          .gc-inline{display:flex;gap:8px;align-items:center}
          .gc-preview{display:flex;align-items:center;gap:10px;margin-top:8px}
          .gc-preview img{height:40px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:4px;background:#fff}
          .gc-error{margin:12px 0 0;background:#ffebe9;border:1px solid #ffb3b3;color:#b42318;border-radius:10px;padding:10px;font-size:.9rem}
          .gc-notice{margin:12px 0 0;background:#eef6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:10px;padding:10px;font-size:.9rem}
          .gc-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 0 0}
          .gc-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}
          .gc-btn.primary{background:#34d399;color:#111}
          .gc-btn.primary:disabled{opacity:.6;cursor:default}
          .gc-btn.outline{background:#fff;border:1px solid #e5e7eb}
          .gc-btn.ghost{background:#e7f8ee;color:#0b0f0c;border:1px solid #c6f0d9}
        `}</style>
      </div>
    </div>
  );
}
