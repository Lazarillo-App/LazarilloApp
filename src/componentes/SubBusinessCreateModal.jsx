/* eslint-disable no-empty */
// src/componentes/SubBusinessCreateModal.jsx
//
// Wizard multipaso para crear un sub-negocio desde una agrupación existente.
// Pasos: 1) Datos  2) Estilos  3) Redes  4) Confirmación  → Éxito
//
// Usa ReactDOM.createPortal → escapa cualquier stacking context / overflow:hidden
// del árbol padre (como el contenedor de ArticulosMain).
//
// Sin credenciales MaxiRest: los sub-negocios heredan las del negocio principal.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useOrganization } from '@/context/OrganizationContext';
import { useBusiness } from '@/context/BusinessContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

/* ─────────────────────── helpers ─────────────────────── */
const artCount = (ag) =>
  Array.isArray(ag?.articulos) ? ag.articulos.length : 0;

const normalizeEmpty = (s) =>
  String(s || '').trim() === '' ? null : String(s).trim();

const isHttpUrl = (u) => /^https?:\/\/.+/i.test(String(u || '').trim());

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ASSETS_BASE_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://lazarilloapp-backend.onrender.com';

const toAbsoluteUrl = (u) => {
  const raw = String(u || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw}`;
};

/* ─────────────────────── ColorField ─────────────────────── */
function ColorField({ id, label, value, onChange, disabled }) {
  return (
    <div className="sbc-field">
      <label htmlFor={id} className="sbc-label">{label}</label>
      <div className="sbc-color-wrap">
        <input
          id={id}
          type="color"
          className="sbc-color-ctrl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <input
          type="text"
          className="sbc-input sbc-input-hex"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const v = raw.startsWith('#') ? raw : `#${raw}`;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
            else onChange(raw);
          }}
          disabled={disabled}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Paso 0 — Organización (solo primera vez) ─────────────────────── */
function StepOrg({ orgName, setOrgName, currentBizName, onNext, onClose, busy, err }) {
  return (
    <div className="sbc-step">
      <div className="sbc-info-box" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <p className="sbc-info-title" style={{ color: '#92400e' }}>Primera división</p>
        <ul style={{ color: '#92400e' }}>
          <li>Estás por dividir tu negocio por primera vez</li>
          <li>Se creará una <strong>Organización</strong> que engloba todos tus negocios</li>
          <li>El negocio actual <strong>"{currentBizName}"</strong> pasa a ser uno más dentro de ella</li>
        </ul>
      </div>

      <div className="sbc-section-title">Nombre de la Organización</div>

      <div className="sbc-field">
        <label className="sbc-label" htmlFor="sbc-org-name">Nombre *</label>
        <input
          id="sbc-org-name"
          className="sbc-input"
          placeholder={`Ej: ${currentBizName} Grupo, Mi Empresa…`}
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && orgName.trim() && onNext()}
          autoFocus
          disabled={busy}
        />
        <span className="sbc-muted" style={{ fontSize: '.78rem', marginTop: 2 }}>
          Este nombre agrupa todos tus negocios. Podés cambiarlo después desde Perfil.
        </span>
      </div>

      {err && <div className="sbc-error">{err}</div>}

      <div className="sbc-footer">
        <button className="sbc-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="sbc-btn primary" onClick={onNext}
          disabled={!orgName.trim() || busy}>Siguiente →</button>
      </div>
    </div>
  );
}
function StepDatos({ agrupacion, state, set, onNext, onClose, busy, err, canGoBack = false }) {
  const count = artCount(agrupacion);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    // Espera a que termine la animación del modal (.22s) antes de hacer focus
    const t = setTimeout(() => { inputRef.current?.focus(); }, 260);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="sbc-step">
      <div className="sbc-origin-banner">
        <div className="sbc-origin-left">
          <span className="sbc-origin-tag">Agrupación origen</span>
          <span className="sbc-origin-name">{agrupacion?.nombre}</span>
        </div>
        <span className="sbc-origin-pill">{count} art.</span>
      </div>

      <div className="sbc-info-box">
        <p className="sbc-info-title">¿Qué va a pasar?</p>
        <ul>
          <li>Se crea un nuevo negocio <strong>independiente</strong></li>
          <li>Los {count} artículos quedan en "Sin Agrupación" para organizar</li>
          <li><strong>No se modifica</strong> el negocio actual</li>
          <li>Hereda las credenciales MaxiRest del negocio principal</li>
        </ul>
      </div>

      <div className="sbc-section-title">Datos del sub-negocio</div>

      <div className="sbc-field">
        <label className="sbc-label" htmlFor="sbc-name">Nombre *</label>
        <input
          id="sbc-name"
          className="sbc-input"
          placeholder="Ej: Delivery, Cocina, Barra…"
          value={state.name}
          onChange={(e) => set('name', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && state.name.trim() && onNext()}
          ref={inputRef}
          disabled={busy}
        />
      </div>

      <div className="sbc-grid-2">
        <div className="sbc-field">
          <label className="sbc-label">Teléfono</label>
          <input className="sbc-input" placeholder="+54 9 …" value={state.phone}
            onChange={(e) => set('phone', e.target.value)} disabled={busy} />
        </div>
        <div className="sbc-field">
          <label className="sbc-label">Ciudad</label>
          <input className="sbc-input" placeholder="Ciudad" value={state.city}
            onChange={(e) => set('city', e.target.value)} disabled={busy} />
        </div>
      </div>

      <div className="sbc-grid-2">
        <div className="sbc-field">
          <label className="sbc-label">Dirección</label>
          <input className="sbc-input" placeholder="Calle 123" value={state.addrLine1}
            onChange={(e) => set('addrLine1', e.target.value)} disabled={busy} />
        </div>
        <div className="sbc-field">
          <label className="sbc-label">Descripción</label>
          <input className="sbc-input" placeholder="Breve descripción" value={state.description}
            onChange={(e) => set('description', e.target.value)} disabled={busy} />
        </div>
      </div>

      {err && <div className="sbc-error">{err}</div>}

      <div className="sbc-footer">
        <button className="sbc-btn ghost" onClick={onClose} disabled={busy}>
          {canGoBack ? '← Anterior' : 'Cancelar'}
        </button>
        <button className="sbc-btn primary" onClick={onNext}
          disabled={!state.name.trim() || busy}>Siguiente →</button>
      </div>
    </div>
  );
}

/* ─────────────────────── Paso 2 — Estilos ─────────────────────── */
function StepEstilos({ state, set, onNext, onBack, busy, err }) {
  const fileRef = useRef(null);
  const tempUrl = useRef(null);

  return (
    <div className="sbc-step">
      <div className="sbc-section-title">Identidad visual</div>

      <div className="sbc-grid-3">
        <ColorField id="sbc-primary" label="Color principal"
          value={state.primary} onChange={(v) => set('primary', v)} disabled={busy} />
        <ColorField id="sbc-secondary" label="Secundario"
          value={state.secondary} onChange={(v) => set('secondary', v)} disabled={busy} />
        <ColorField id="sbc-bg" label="Fondo"
          value={state.background} onChange={(v) => set('background', v)} disabled={busy} />
      </div>

      <div className="sbc-color-preview" style={{
        background: state.background,
        borderColor: state.secondary,
      }}>
        <div className="sbc-color-preview-pill" style={{ background: state.primary }} />
        <span style={{ color: state.secondary, fontWeight: 700, fontSize: '.83rem' }}>
          Vista previa de paleta
        </span>
      </div>

      <div className="sbc-field">
        <label className="sbc-label">Logo</label>
        <div className="sbc-logo-row">
          <input
            className="sbc-input"
            style={{ flex: 1 }}
            placeholder="Pegá una URL (https://…)"
            value={state.logoUrl}
            onChange={(e) => { set('logoUrl', e.target.value); set('logoFile', null); }}
            disabled={busy}
          />
          <span className="sbc-muted">o</span>
          <button type="button" className="sbc-btn ghost"
            onClick={() => fileRef.current?.click()} disabled={busy}>
            Subir archivo
          </button>
          <input ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (tempUrl.current) { try { URL.revokeObjectURL(tempUrl.current); } catch { } }
              set('logoFile', f);
              const t = URL.createObjectURL(f);
              tempUrl.current = t;
              set('logoUrl', t);
            }}
          />
        </div>
        {state.logoUrl && (
          <div className="sbc-logo-preview">
            <img src={state.logoUrl} alt="preview logo" />
          </div>
        )}
      </div>

      {err && <div className="sbc-error">{err}</div>}

      <div className="sbc-footer">
        <button className="sbc-btn ghost" onClick={onBack} disabled={busy}>← Atrás</button>
        <button className="sbc-btn primary" onClick={onNext} disabled={busy}>Siguiente →</button>
      </div>
    </div>
  );
}

/* ─────────────────────── Paso 3 — Redes ─────────────────────── */
function StepRedes({ state, set, onNext, onBack, busy, err }) {
  const fields = [
    { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/…' },
    { key: 'facebook',  label: 'Facebook',  ph: 'https://facebook.com/…' },
    { key: 'tiktok',    label: 'TikTok',    ph: 'https://tiktok.com/@…'  },
    { key: 'website',   label: 'Sitio web', ph: 'https://…'              },
  ];
  return (
    <div className="sbc-step">
      <div className="sbc-section-title">
        Redes sociales <span className="sbc-optional">(opcional)</span>
      </div>

      <div className="sbc-grid-2">
        {fields.map(({ key, label, ph }) => (
          <div key={key} className="sbc-field">
            <label className="sbc-label">{label}</label>
            <input className="sbc-input" placeholder={ph}
              value={state[key]} onChange={(e) => set(key, e.target.value)}
              disabled={busy} />
          </div>
        ))}
      </div>

      {err && <div className="sbc-error">{err}</div>}

      <div className="sbc-footer">
        <button className="sbc-btn ghost" onClick={onBack} disabled={busy}>← Atrás</button>
        <button className="sbc-btn primary" onClick={onNext} disabled={busy}>Siguiente →</button>
      </div>
    </div>
  );
}

/* ─────────────────────── Paso 4 — Confirmación ─────────────────────── */
function StepConfirm({ agrupacion, state, onBack, onSubmit, busy, err }) {
  const count = artCount(agrupacion);

  const rows = [
    { label: 'Nombre',       val: state.name },
    { label: 'Artículos',    val: `${count}` },
    { label: 'Agrupación origen', val: agrupacion?.nombre },
    {
      label: 'Color principal',
      val: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 14, height: 14, borderRadius: 4,
            background: state.primary, display: 'inline-block',
            border: '1px solid rgba(0,0,0,.1)',
          }} />
          {state.primary}
        </span>
      ),
    },
    state.phone     && { label: 'Teléfono',   val: state.phone },
    state.city      && { label: 'Ciudad',      val: state.city  },
    state.instagram && { label: 'Instagram',   val: state.instagram },
    state.website   && { label: 'Sitio web',   val: state.website },
  ].filter(Boolean);

  return (
    <div className="sbc-step">
      <div className="sbc-confirm-hero">
        <div className="sbc-confirm-icon">🏪</div>
        <h3 className="sbc-confirm-title">¿Todo bien?</h3>
        <p className="sbc-confirm-sub">Revisá los datos antes de crear el sub-negocio</p>
      </div>

      {state.logoUrl && (
        <div className="sbc-confirm-logo-wrap">
          <img src={state.logoUrl} alt="Logo" />
        </div>
      )}

      <div className="sbc-summary">
        {rows.map(({ label, val }) => (
          <div key={label} className="sbc-summary-row">
            <span className="sbc-summary-label">{label}</span>
            <span className="sbc-summary-val">{val}</span>
          </div>
        ))}
        <div className="sbc-summary-row">
          <span className="sbc-summary-label">Credenciales MaxiRest</span>
          <span className="sbc-summary-val sbc-inherited">Heredadas del principal ✓</span>
        </div>
      </div>

      {err && <div className="sbc-error">{err}</div>}

      <div className="sbc-footer">
        <button className="sbc-btn ghost" onClick={onBack} disabled={busy}>← Atrás</button>
        <button className="sbc-btn primary" onClick={onSubmit} disabled={busy}>
          {busy
            ? <span className="sbc-spinner-row"><span className="sbc-spinner" />Creando…</span>
            : 'Crear sub-negocio'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── Éxito ─────────────────────── */
function StepSuccess({ name, count, logoUrl, primary, onClose, newBizId }) {
  
  const handleFinish = () => {
    // 1) Marcar el nuevo negocio como activo
    if (newBizId) {
      localStorage.setItem('activeBusinessId', String(newBizId));
      
      // 2) Disparar evento de cambio
      window.dispatchEvent(
        new CustomEvent('business:switched', { detail: { id: newBizId } })
      );
    }
    
    // 3) Cerrar modal
    onClose?.();
    
    // 4) Recargar página para que todo se actualice
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };
  
  return (
    <div className="sbc-step sbc-step-success">
      <div className="sbc-success-confetti" aria-hidden="true">
        {['🎉', '✨', '🏪', '🎊', '⭐'].map((e, i) => (
          <span key={i} className="sbc-confetti-piece" style={{ '--i': i }}>{e}</span>
        ))}
      </div>
      {logoUrl && (
        <div className="sbc-success-logo">
          <img src={logoUrl} alt={name} />
        </div>
      )}
      <h3 className="sbc-success-title">¡Sub-negocio creado!</h3>
      <p className="sbc-success-body">
        <strong>{name}</strong> fue creado con {count} artículo{count !== 1 ? 's' : ''} listos
        para organizar en "Sin Agrupación".
      </p>
      <p className="sbc-success-hint">
        Ya podés cambiar a este negocio desde el selector en la barra superior.
      </p>
      <div className="sbc-success-pill" style={{ '--c': primary }}>
        <span className="sbc-dot" style={{ background: primary }} />
        {name}
      </div>
      <div className="sbc-footer sbc-footer-center">
        <button 
          className="sbc-btn primary" 
          onClick={handleFinish} 
          style={{ minWidth: 160 }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Componente principal
═══════════════════════════════════════════════════════════ */
const SubBusinessCreateModal = React.memo(function SubBusinessCreateModal({ open, onClose, agrupacion, onCreated, onNeedOrgName }) {
  const { organization, createSubBusiness, createOrg } = useOrganization() || {};
  const { active } = useBusiness() || {};

  // Steps siempre fijos — el nombre de la org se pide en un modal separado
  // DESPUÉS de crear el subnegocio exitosamente
  const STEPS = ['Datos', 'Estilos', 'Redes', 'Confirmar'];
  const STEP_SUCCESS = STEPS.length;
  const STEP_DATOS   = 0;
  const STEP_ESTILOS = 1;
  const STEP_REDES   = 2;
  const STEP_CONFIRM = 3;

  const [step,    setStep]    = useState(0);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');
  const [created, setCreated] = useState(null);

  // Modal de nombre de org — se muestra DESPUÉS del éxito si no hay org
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgName,      setOrgName]      = useState('');
  const [savingOrg,    setSavingOrg]    = useState(false);
  const [orgErr,       setOrgErr]       = useState('');

  // Estado del formulario del subnegocio
  const [form, setFormRaw] = useState({
    name:        '',
    phone:       '',
    city:        '',
    addrLine1:   '',
    description: '',
    primary:     '#38e07b',
    secondary:   '#1f2923',
    background:  '#f6f8f7',
    logoUrl:     '',
    logoFile:    null,
    instagram:   '',
    facebook:    '',
    tiktok:      '',
    website:     '',
  });
  const set = useCallback((k, v) => setFormRaw(prev => ({ ...prev, [k]: v })), []);

  // Ref que captura el estado de la org al momento de ABRIR el modal
  // (no al hacer submit, porque para entonces ya cambió)
  const orgStateAtOpenRef = useRef(null);

  /* Reset al abrir */
  useEffect(() => {
    if (open) {
      // Capturar estado de org en el momento exacto de apertura
      orgStateAtOpenRef.current = {
        hasOrg: !!organization,
        bizCount: organization?.businesses?.length ?? 0,
      };
      setStep(0);
      setErr('');
      setBusy(false);
      setCreated(null);
      setShowOrgModal(false);
      setOrgName('');
      setOrgErr('');
      setFormRaw({
        name:        agrupacion?.nombre || '',
        phone:       '',
        city:        '',
        addrLine1:   '',
        description: '',
        primary:     '#38e07b',
        secondary:   '#1f2923',
        background:  '#f6f8f7',
        logoUrl:     '',
        logoFile:    null,
        instagram:   '',
        facebook:    '',
        tiktok:      '',
        website:     '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agrupacion?.nombre]);
  // NOTA: solo [open, agrupacion?.nombre] — NO incluir active?.name ni organization
  // porque si cambian mientras el modal está abierto re-ejecutan el reset y borran lo que el usuario escribió

  /* Esc */
  const handleClose = useCallback(() => { if (busy) return; onClose?.(); }, [busy, onClose]);
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, handleClose]);

  const goNext = () => { setErr(''); setStep(s => s + 1); };
  const goBack = () => { setErr(''); setStep(s => s - 1); };

  /* Submit */
  const handleSubmit = async () => {
    setBusy(true);
    setErr('');
    try {
      const branding = {
        primary:    form.primary,
        secondary:  form.secondary,
        background: form.background,
        logo_url:   isHttpUrl(form.logoUrl) && !form.logoFile ? form.logoUrl : null,
      };

      // Si no hay org todavía, crear una con nombre temporal antes de crear el subnegocio.
      // createSubBusiness requiere organization.id — sin esto tira error.
      // Después del éxito mostramos el modal para que el usuario le ponga el nombre real.
      const isFirstSubBusiness = !organization;
      let newOrgId = null;
      if (isFirstSubBusiness) {
        // Crear org con nombre placeholder — el usuario podrá renombrarla después.
        // createOrg hace setOrganization(org) pero el closure de createSubBusiness
        // aún apunta al valor anterior (null), así que pasamos el id directamente.
        const placeholder = active?.name || form.name.trim() || 'Mi Organización';
        const createdOrg = await createOrg(placeholder);
        newOrgId = createdOrg?.id ?? null;
      }

      const newBiz = await createSubBusiness({
        ...(newOrgId ? { organizationId: newOrgId } : {}),
        sourceGroupId: agrupacion.id,
        name:          form.name.trim(),
        branding,
        contact:     { phone: normalizeEmpty(form.phone) },
        description:   normalizeEmpty(form.description),
        address: {
          line1: normalizeEmpty(form.addrLine1),
          city:  normalizeEmpty(form.city),
        },
        social: {
          instagram: normalizeEmpty(form.instagram),
          facebook:  normalizeEmpty(form.facebook),
          tiktok:    normalizeEmpty(form.tiktok),
          website:   normalizeEmpty(form.website),
        },
      });

      /* Subir logo si es archivo local */
      if (form.logoFile && newBiz?.id) {
        try {
          const up     = await BusinessesAPI.uploadLogo(newBiz.id, form.logoFile);
          const rawLog = up?.url || up?.logo_url || up?.secure_url;
          const absLog = toAbsoluteUrl(rawLog);
          if (absLog) {
            await BusinessesAPI.update(newBiz.id, {
              props: { branding: { ...branding, logo_url: absLog } },
            });
            set('logoUrl', absLog);
          }
        } catch (eUp) {
          console.warn('[SubBusinessCreateModal] Error subiendo logo:', eUp);
        }
      }

      setCreated(newBiz);
      setStep(STEPS.length); // paso "éxito" = después del último step
      onCreated?.(newBiz);

      // Avisar al padre que debe mostrar el modal de nombre de org,
      // si al abrir el modal era la primera vez (org nueva o solo 1 negocio).
      // Lo hace el padre (ArticulosMain) para que no se pierda al cerrar este modal.
      const { hasOrg, bizCount } = orgStateAtOpenRef.current || {};
      const shouldAskOrgName = !hasOrg || bizCount <= 1;
      if (shouldAskOrgName) {
        onNeedOrgName?.();
      }
    } catch (e) {
      setErr(e?.message || 'No se pudo crear el sub-negocio. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const count = artCount(agrupacion);

  const content = (
    <div className="sbc-overlay" onClick={step < STEP_SUCCESS ? handleClose : undefined}>
      <div className="sbc-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sbc-header">
          <span className="sbc-header-title">
            {step === STEP_SUCCESS ? '¡Listo!' : 'Nuevo sub-negocio'}
          </span>
          {step < STEP_SUCCESS && (
            <span className="sbc-header-step">Paso {step + 1} de {STEPS.length}</span>
          )}
          {step < STEP_SUCCESS && (
            <button className="sbc-x" onClick={handleClose} aria-label="Cerrar">✕</button>
          )}
        </div>

        {/* Stepper */}
        {step < STEP_SUCCESS && (
          <div className="sbc-stepper">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`sbc-step-dot${i < step ? ' done' : i === step ? ' active' : ''}`}>
                  <span className="sbc-step-num">{i < step ? '✓' : i + 1}</span>
                  <span className="sbc-step-name">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`sbc-step-line${i < step ? ' done' : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Progress */}
        {step < STEP_SUCCESS && (
          <div className="sbc-progress">
            <div className="sbc-progress-fill"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        )}

        {/* Body */}
        <div className="sbc-body">
          {step === STEP_DATOS && (
            <StepDatos agrupacion={agrupacion} state={form} set={set}
              onNext={() => { if (form.name.trim()) goNext(); else setErr('El nombre es requerido'); }}
              onClose={handleClose}
              canGoBack={false}
              busy={busy} err={err} />
          )}
          {step === STEP_ESTILOS && (
            <StepEstilos state={form} set={set}
              onNext={goNext} onBack={goBack} busy={busy} err={err} />
          )}
          {step === STEP_REDES && (
            <StepRedes state={form} set={set}
              onNext={goNext} onBack={goBack} busy={busy} err={err} />
          )}
          {step === STEP_CONFIRM && (
            <StepConfirm agrupacion={agrupacion} state={form}
              onBack={goBack} onSubmit={handleSubmit} busy={busy} err={err} />
          )}
          {step === STEP_SUCCESS && (
            <StepSuccess
              name={created?.name || form.name}
              count={count}
              logoUrl={form.logoUrl}
              primary={form.primary}
              newBizId={created?.id}
              onClose={handleClose}
            />
          )}
        </div>
      </div>

      {/* ══════ Estilos ══════ */}
      <style>{`
        .sbc-overlay {
          position: fixed; inset: 0;
          background: rgba(10,12,16,.65);
          backdrop-filter: blur(6px);
          display: grid; place-items: center;
          z-index: 99999;
          animation: sbc-fadein .18s ease;
        }
        @keyframes sbc-fadein { from { opacity:0 } to { opacity:1 } }

        .sbc-modal {
          width: min(680px, 96vw);
          max-height: 92vh;
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          display: flex; flex-direction: column;
          box-shadow:
            0 0 0 1px rgba(0,0,0,.07),
            0 8px 24px rgba(0,0,0,.1),
            0 40px 80px rgba(0,0,0,.22);
          animation: sbc-slideup .22s cubic-bezier(.22,.68,0,1.15);
        }
        @keyframes sbc-slideup {
          from { opacity:0; transform: translateY(20px) scale(.96) }
          to   { opacity:1; transform: translateY(0) scale(1) }
        }

        /* Header */
        .sbc-header {
          display: flex; align-items: center;
          padding: 14px 20px; gap: 10px;
          border-bottom: 1px solid #f0f0f2;
          flex-shrink: 0;
        }
        .sbc-header-title { font-weight: 800; font-size: .98rem; color: #111; flex:1; }
        .sbc-header-step  { font-size: .72rem; color: #bbb; font-weight: 600; letter-spacing:.03em; }
        .sbc-x {
          border: none; background: none; cursor: pointer;
          font-size: .9rem; color: #ccc;
          padding: 4px 7px; border-radius: 7px; line-height:1;
          transition: color .15s, background .15s;
        }
        .sbc-x:hover { color: #555; background: #f4f4f4; }

        /* Stepper */
        .sbc-stepper {
          display: flex; align-items: center;
          padding: 10px 24px; gap: 0;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f2;
          flex-shrink: 0; overflow-x: auto;
        }
        .sbc-step-dot {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          flex-shrink: 0;
        }
        .sbc-step-num {
          width: 27px; height: 27px; border-radius: 50%;
          display: grid; place-items: center;
          font-size: .77rem; font-weight: 800;
          background: #ebebeb; color: #aaa;
          transition: background .2s, color .2s;
        }
        .sbc-step-name {
          font-size: .65rem; font-weight: 700; color: #ccc;
          letter-spacing: .05em; white-space: nowrap;
          transition: color .2s;
        }
        .sbc-step-dot.active .sbc-step-num {
          background: var(--color-primary, #38e07b); color: #0a0a0a;
        }
        .sbc-step-dot.active .sbc-step-name { color: #333; }
        .sbc-step-dot.done .sbc-step-num    { background: #d4f5e4; color: #1a7a46; }
        .sbc-step-dot.done .sbc-step-name   { color: #1a7a46; }
        .sbc-step-line {
          flex: 1; height: 2px; background: #e8e8ea;
          min-width: 24px; margin: 0 6px; margin-bottom: 16px;
          transition: background .3s;
        }
        .sbc-step-line.done { background: #d4f5e4; }

        /* Progress */
        .sbc-progress { height: 3px; background: #f2f2f2; flex-shrink: 0; }
        .sbc-progress-fill {
          height: 100%;
          background: var(--color-primary, #38e07b);
          transition: width .35s cubic-bezier(.4,0,.2,1);
        }

        /* Body scrollable */
        .sbc-body { overflow-y: auto; flex: 1; }

        /* Steps */
        .sbc-step {
          padding: 20px 24px 24px;
          display: flex; flex-direction: column; gap: 14px;
        }

        /* Origin banner */
        .sbc-origin-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          background: #f9fafb; border: 1px solid #e8e8ea;
          border-radius: 12px; padding: 12px 16px;
        }
        .sbc-origin-left  { display: flex; flex-direction: column; gap: 2px; }
        .sbc-origin-tag   { font-size: .67rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #bbb; }
        .sbc-origin-name  { font-weight: 800; font-size: .95rem; color: #111; }
        .sbc-origin-pill  {
          background: var(--color-primary, #38e07b); color: #0a0a0a;
          border-radius: 999px; padding: 4px 12px;
          font-size: .75rem; font-weight: 800; flex-shrink: 0;
        }

        /* Info box */
        .sbc-info-box {
          background: #f0f6ff; border: 1px solid #dce9ff;
          border-radius: 12px; padding: 12px 16px;
        }
        .sbc-info-title {
          margin: 0 0 6px; font-size: .75rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: .06em; color: #4a6fa5;
        }
        .sbc-info-box ul { margin:0; padding-left:16px; font-size:.83rem; color:#4a6fa5; line-height:1.9; }

        /* Section */
        .sbc-section-title { font-weight: 800; font-size: .88rem; color: #222; padding-bottom: 4px; border-bottom: 1px solid #f0f0f2; }
        .sbc-optional      { font-weight: 400; font-size: .75rem; color: #bbb; margin-left: 4px; }

        /* Fields */
        .sbc-field { display:flex; flex-direction:column; gap:5px; }
        .sbc-label { font-size:.83rem; font-weight:700; color:#333; }
        .sbc-input {
          border: 1.5px solid #e0e0e5; border-radius: 10px;
          padding: 10px 13px; font-size: .9rem; outline: none;
          transition: border-color .15s, box-shadow .15s;
          background: #fff; color: #111; width: 100%; box-sizing: border-box;
        }
        .sbc-input:focus {
          border-color: var(--color-primary, #38e07b);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary,#38e07b) 16%, transparent);
        }
        .sbc-input:disabled { opacity:.55; background:#fafafa; }
        .sbc-input-hex { margin-top:6px; }

        /* Grids */
        .sbc-grid-2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
        .sbc-grid-3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }

        /* Color */
        .sbc-color-wrap    { display:flex; flex-direction:column; gap:5px; }
        .sbc-color-ctrl    { width:100%; height:42px; border:1.5px solid #e0e0e5; border-radius:10px; padding:2px; background:#fff; cursor:pointer; outline:none; }
        .sbc-color-preview {
          border-radius:10px; border:2px solid;
          padding:10px 14px; display:flex; align-items:center; gap:10px;
          transition: background .3s, border-color .3s;
        }
        .sbc-color-preview-pill { width:22px; height:22px; border-radius:50%; border:2px solid rgba(255,255,255,.4); box-shadow:0 2px 6px rgba(0,0,0,.14); flex-shrink:0; transition:background .3s; }

        /* Logo */
        .sbc-logo-row   { display:flex; align-items:center; gap:8px; }
        .sbc-muted      { font-size:.82rem; color:#bbb; }
        .sbc-logo-preview { display:flex; align-items:center; margin-top:8px; }
        .sbc-logo-preview img { height:48px; object-fit:contain; border:1px solid #e5e7eb; border-radius:10px; padding:6px; background:#fff; }

        /* Confirm */
        .sbc-confirm-hero  { text-align:center; padding:4px 0 2px; }
        .sbc-confirm-icon  { font-size:2.5rem; margin-bottom:6px; }
        .sbc-confirm-title { margin:0 0 4px; font-size:1.1rem; font-weight:800; color:#111; }
        .sbc-confirm-sub   { margin:0; font-size:.83rem; color:#888; }
        .sbc-confirm-logo-wrap { display:flex; justify-content:center; }
        .sbc-confirm-logo-wrap img { height:56px; object-fit:contain; border:1px solid #e5e7eb; border-radius:12px; padding:8px; background:#fafafa; }

        .sbc-summary { border:1px solid #ebebed; border-radius:12px; overflow:hidden; }
        .sbc-summary-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; gap:12px; border-bottom:1px solid #f5f5f7; font-size:.84rem; }
        .sbc-summary-row:last-child { border-bottom:none; }
        .sbc-summary-label { color:#999; font-weight:600; flex-shrink:0; }
        .sbc-summary-val   { color:#111; font-weight:600; text-align:right; }
        .sbc-inherited     { color:#1a7a46 !important; }

        /* Error */
        .sbc-error { background:#fff5f4; border:1px solid #ffc9c9; color:#c0392b; border-radius:10px; padding:10px 14px; font-size:.84rem; }

        /* Success */
        .sbc-step-success { align-items:center; text-align:center; padding:36px 24px 32px; position:relative; overflow:hidden; }
        .sbc-success-confetti { position:absolute; top:0; left:0; right:0; height:60px; overflow:hidden; display:flex; justify-content:space-around; align-items:flex-start; pointer-events:none; }
        .sbc-confetti-piece { font-size:1.4rem; animation:sbc-confetti calc(1.2s + var(--i) * .15s) ease-out both; opacity:0; }
        @keyframes sbc-confetti {
          0%   { opacity:0; transform:translateY(-20px) rotate(-10deg) scale(.6) }
          40%  { opacity:1; transform:translateY(12px) rotate(8deg) scale(1.1) }
          100% { opacity:0; transform:translateY(40px) rotate(-5deg) scale(.9) }
        }
        .sbc-success-logo { margin-bottom:12px; }
        .sbc-success-logo img { height:64px; object-fit:contain; border:1px solid #e5e7eb; border-radius:14px; padding:8px; background:#fafafa; }
        .sbc-success-title { margin:0 0 10px; font-size:1.2rem; font-weight:800; color:#111; }
        .sbc-success-body  { margin:0 0 6px; font-size:.9rem; color:#444; max-width:360px; }
        .sbc-success-hint  { margin:0 0 20px; font-size:.78rem; color:#aaa; max-width:320px; }
        .sbc-success-pill  { display:inline-flex; align-items:center; gap:8px; border:2px solid var(--c,#38e07b); border-radius:999px; padding:6px 16px; font-weight:700; font-size:.88rem; color:#111; margin-bottom:20px; }
        .sbc-dot           { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

        /* Footer */
        .sbc-footer        { display:flex; gap:10px; justify-content:flex-end; padding-top:6px; }
        .sbc-footer-center { justify-content:center; }

        /* Buttons */
        .sbc-btn { border:none; border-radius:10px; padding:11px 20px; font-size:.88rem; font-weight:800; cursor:pointer; transition:all .15s; line-height:1; white-space:nowrap; }
        .sbc-btn:disabled  { opacity:.5; cursor:default; pointer-events:none; }
        .sbc-btn.primary   { background:var(--color-primary,#38e07b); color:var(--on-primary,#0a0a0a); }
        .sbc-btn.primary:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.14); }
        .sbc-btn.ghost     { background:#fff; border:1.5px solid #e0e0e5; color:#555; }
        .sbc-btn.ghost:hover:not(:disabled) { background:#f7f7f8; color:#222; }

        /* Spinner */
        .sbc-spinner-row { display:flex; align-items:center; gap:8px; }
        .sbc-spinner { width:14px; height:14px; border:2px solid rgba(0,0,0,.18); border-top-color:currentColor; border-radius:50%; animation:sbc-spin .6s linear infinite; display:inline-block; }
        @keyframes sbc-spin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );

  /* ── Handlers del modal de nombre de org ── */
  const handleSaveOrg = async () => {
    if (!orgName.trim()) {
      setOrgErr('El nombre de la organización es requerido');
      return;
    }
    setSavingOrg(true);
    setOrgErr('');
    try {
      await createOrg(orgName.trim());
      setShowOrgModal(false);
    } catch (e) {
      setOrgErr(e?.message || 'No se pudo crear la organización');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSkipOrg = () => {
    setShowOrgModal(false);
  };

  /* ── Modal de nombre de organización (se muestra sobre la pantalla de éxito) ── */
  const orgModalContent = showOrgModal ? (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10,12,16,.72)',
      backdropFilter: 'blur(6px)',
      display: 'grid', placeItems: 'center',
      zIndex: 100000,
      animation: 'sbc-fadein .18s ease',
    }}>
      <div style={{
        width: 'min(460px, 94vw)',
        background: '#fff',
        borderRadius: 18,
        padding: '32px 28px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,.22)',
        display: 'flex', flexDirection: 'column', gap: 16,
        animation: 'sbc-slideup .22s cubic-bezier(.22,.68,0,1.15)',
      }}>
        {/* Ícono + título */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111' }}>
            ¿Cómo se llama tu organización?
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: '.88rem', color: '#666', lineHeight: 1.5 }}>
            Se creó automáticamente una organización que agrupa a <strong>{active?.name}</strong> y
            los sub-negocios que crees. Dale un nombre para identificarla fácilmente.
          </p>
        </div>

        {/* Input */}
        <div>
          <input
            type="text"
            value={orgName}
            onChange={e => { setOrgName(e.target.value); setOrgErr(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveOrg(); }}
            placeholder={`Ej: ${active?.name || 'Container Group'}`}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px',
              fontSize: '.95rem', fontWeight: 600,
              border: orgErr ? '2px solid #f44336' : '2px solid #e0e0e5',
              borderRadius: 10, outline: 'none',
              transition: 'border-color .15s',
            }}
            onFocus={e => { if (!orgErr) e.target.style.borderColor = 'var(--color-primary, #38e07b)'; }}
            onBlur={e => { if (!orgErr) e.target.style.borderColor = '#e0e0e5'; }}
          />
          {orgErr && (
            <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: '#f44336' }}>{orgErr}</p>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={handleSkipOrg} disabled={savingOrg}
            style={{ border: 'none', background: 'none', color: '#999',
                      fontSize: '.85rem', cursor: 'pointer', padding: '8px 12px' }}>
            Omitir por ahora
          </button>
          <button onClick={handleSaveOrg} disabled={savingOrg || !orgName.trim()}
            style={{
              border: 'none', borderRadius: 10, padding: '11px 24px',
              fontSize: '.88rem', fontWeight: 800, cursor: 'pointer',
              background: 'var(--color-primary, #1a1a2e)',
              color: 'var(--on-primary, #fff)',
              opacity: savingOrg || !orgName.trim() ? .5 : 1,
              transition: 'all .15s',
            }}>
            {savingOrg
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)',
                                  borderTopColor: 'currentColor', borderRadius: '50%',
                                  animation: 'sbc-spin .6s linear infinite', display: 'inline-block' }} />
                  Guardando…
                </span>
              : 'Guardar nombre'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {ReactDOM.createPortal(content, document.body)}
      {showOrgModal && ReactDOM.createPortal(orgModalContent, document.body)}
    </>
  );
});
export default SubBusinessCreateModal;