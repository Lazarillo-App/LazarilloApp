import React, { useEffect, useState } from 'react';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { useBizTheme } from '../tema/ThemeProviderNegocio';

export default function BusinessCreateModal({ open, onClose, onCreateComplete }) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#000000');
  const [secondary, setSecondary] = useState('#ffffff');
  const [background, setBackground] = useState('#6c6c6cff');
  const [font, setFont] = useState('Inter, system-ui, sans-serif');
  const [logoUrl, setLogoUrl] = useState('');

  // Maxi
  const [mxEmail, setMxEmail] = useState('');
  const [mxPass, setMxPass] = useState('');
  const [mxCod, setMxCod]   = useState('');

  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Para aplicar tema al vuelo
   const { setPaletteForBiz } = useBizTheme?.() || { setPaletteForBiz: () => {} };

  useEffect(() => {
    if (!open) {
      setName('');
      setPrimary('#000000');
      setSecondary('#ffffff');
      setBackground('#003b4a');
      setFont('Inter, system-ui, sans-serif');
      setLogoUrl('');
      setMxEmail(''); setMxPass(''); setMxCod('');
      setShowPass(false);
      setBusy(false); setErr('');
    }
  }, [open]);

  if (!open) return null;

 const brandingToPalette = (br) => ({
    name: 'Custom',
    primary  : br.primary,
    secondary: br.secondary,
    bg       : br.background,
    surface  : '#f8fafc',
    border   : '#e2e8f0',
    fg       : '#1a4f67',           
    hover    : undefined,           
    font     : br.font,
    logo_url : br.logo_url || null,
  });

   const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('Ingresá un nombre para el local.');
    if (!mxEmail || !mxPass || !mxCod) return setErr('Completá las credenciales de Maxi.');

    setBusy(true);
    try {
      // ✅ 1) crear negocio con branding TOP-LEVEL (consistente con edit)
      const payload = {
        name: name.trim(),
        branding: { primary, secondary, background, font, logo_url: logoUrl || null },
      };
      const resp = await BusinessesAPI.create(payload);
      const biz = resp?.business ?? resp;
      if (!biz?.id) throw new Error('No se pudo crear el local');

      // 2) guardar credenciales Maxi
      await BusinessesAPI.maxiSave(biz.id, { email: mxEmail, password: mxPass, codcli: mxCod });

      // 3) marcar activo y avisar
      localStorage.setItem('activeBusinessId', biz.id);
      window.dispatchEvent(new CustomEvent('business:switched'));

      // 4) aplicar tema y persistir
      setPaletteForBiz(brandingToPalette(payload.branding), { persist: true });

      // 5) notificar arriba y cerrar
      onCreateComplete?.(biz);
      onClose?.();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || 'No se pudo completar la creación del local.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Nuevo local</h3>

        <form onSubmit={submit} className="form-grid">
          {/* ===== Datos del local ===== */}
          <div className="group">
            <label>Nombre del local *</label>
            <input
              placeholder="Ej: Container Bar"
              value={name}
              onChange={e=>setName(e.target.value)}
              required
            />
          </div>

          <div className="row">
            <div className="group">
              <label>Color primario</label>
              <input type="color" value={primary} onChange={e=>setPrimary(e.target.value)} />
            </div>
            <div className="group">
              <label>Color secundario</label>
              <input type="color" value={secondary} onChange={e=>setSecondary(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="group">
              <label>Fondo</label>
              <input type="color" value={background} onChange={e=>setBackground(e.target.value)} />
            </div>
            <div className="group">
              <label>Fuente CSS</label>
              <input value={font} onChange={e=>setFont(e.target.value)} />
            </div>
          </div>

          <div className="group">
            <label>Logo (URL)</label>
            <input placeholder="https://…/logo.png" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} />
          </div>

          <hr/>

          {/* ===== Credenciales Maxi ===== */}
          <h3 style={{marginTop:0}}>Vincular MaxiRest</h3>
          <div className="group">
            <label>Email (Maxi) *</label>
            <input type="email" value={mxEmail} onChange={e=>setMxEmail(e.target.value)} required />
          </div>
          <div className="row">
            <div className="group">
              <label>Contraseña (Maxi) *</label>
              <input type={showPass ? 'text':'password'} value={mxPass} onChange={e=>setMxPass(e.target.value)} required />
            </div>
            <div className="group">
              <label style={{visibility:'hidden'}}>Mostrar</label>
              <button type="button" className="btn-secondary" onClick={()=>setShowPass(s=>!s)}>
                {showPass ? 'Ocultar' : 'Mostrar'} contraseña
              </button>
            </div>
          </div>
          <div className="group">
            <label>Código de cliente (Maxi) *</label>
            <input value={mxCod} onChange={e=>setMxCod(e.target.value)} required />
          </div>

          {!!err && <div className="error">{err}</div>}

          <div className="actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creando…' : 'Crear local'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay{position:fixed;inset:0;background:#0006;display:grid;place-items:center;z-index:10000}
        .modal-card{width:min(870px,96vw);background:#1a4f67;color:#fff;border-radius:14px;padding:50px 20px 16px;box-shadow:0 20px 60px #0007}
        .form-grid{display:grid;gap:12px}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .group label{display:block;font-size:.9rem;margin-bottom:6px;font-weight:600}
        input{width:95%;padding:10px;border-radius:8px;border:2px solid #dfe3e6;background:#f7f8f9;color:#222}
        input[type="color"]{padding:0;height:40px}
        hr{border:none;border-top:1px solid #ffffff33;margin:2px 0 8px}
        h2{margin:0 0 12px} h3{margin:8px 0}
        .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}
        .btn-primary{background:#000;border:0;color:#fff;padding:10px 16px;border-radius:8px;cursor:pointer}
        .btn-secondary{background:#fff;border:0;color:#333;padding:10px 14px;border-radius:8px;cursor:pointer}
        .error{background:#ffebe9;color:#b30000;border:1px solid #ffb3b3;padding:8px;border-radius:8px}
        @media (max-width:640px){ .row{grid-template-columns:1fr} }
      `}</style>
    </div>
  );
}
