/* eslint-disable no-unused-vars */
import React, { useMemo } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { useBusiness } from '../context/BusinessContext';

/* ─── helpers ─── */
const norm = (s) => String(s || '').trim();

function getInitials(name) {
  return norm(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function isDark(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

/* ─── SubCard ─── */
function SubCard({ biz, isActive, onClick }) {
  const color = biz.color_hex || '#3b82f6';
  const dark = isDark(color);
  const rgb = hexToRgb(color);
  const rgbStr = rgb ? `${rgb.r},${rgb.g},${rgb.b}` : '59,130,246';

  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: isActive
          ? `0 0 0 3px ${color}, 0 8px 32px rgba(${rgbStr},.35)`
          : '0 2px 12px rgba(0,0,0,.08)',
        transition: 'all .2s ease',
        background: '#fff',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 0 0 2px ${color}, 0 16px 40px rgba(${rgbStr},.25)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isActive
          ? `0 0 0 3px ${color}, 0 8px 32px rgba(${rgbStr},.35)`
          : '0 2px 12px rgba(0,0,0,.08)';
      }}
    >
      {/* Header con color */}
      <div style={{
        background: color,
        padding: '28px 24px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        minHeight: 90,
      }}>
        {/* Logo o iniciales */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: biz.brand_logo_url
            ? `url(${biz.brand_logo_url}) center/cover`
            : `rgba(${dark ? '255,255,255' : '0,0,0'},.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 18,
          fontWeight: 700,
          color: dark ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.6)',
          letterSpacing: '-0.5px',
        }}>
          {!biz.brand_logo_url && getInitials(biz.name)}
        </div>

        {isActive && (
          <span style={{
            background: 'rgba(255,255,255,.25)',
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: dark ? '#fff' : 'rgba(0,0,0,.7)',
            backdropFilter: 'blur(4px)',
          }}>
            Activo
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#111',
          marginBottom: 4,
          lineHeight: 1.3,
        }}>
          {biz.name}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
            Ir al subnegocio →
          </span>
        </div>
      </div>
    </button>
  );
}

/* ─── OrgDashboard ─── */
export default function OrgDashboard({ onSelectBusiness, discGroup, discCount = 0, onSelectDiscontinuados }) {
  const { organization, allBusinesses, rootBusiness } = useOrganization();
  const { activeBusinessId, selectBusiness } = useBusiness();

  // El principal es el más antiguo (rootBusiness)
  const principalId = rootBusiness?.id;

  // Subnegocios = todos excepto el principal
  const subNegocios = useMemo(() =>
    (allBusinesses || [])
      .filter((b) => b.id !== principalId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [allBusinesses, principalId]
  );

  const handleSelect = async (biz) => {
    try {
      await selectBusiness?.(biz.id);
      onSelectBusiness?.(biz);
    } catch (e) {
      console.error('[OrgDashboard] Error cambiando negocio:', e);
    }
  };

  return (
    <div style={{
      padding: '32px 24px',
      maxWidth: 1100,
      margin: '0 auto',
      minHeight: '60vh',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
        }}>
          {organization?.name || 'Organización'}
        </div>
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          color: '#111',
          letterSpacing: '-0.5px',
        }}>
          Subnegocios
        </h2>
        <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>
          {subNegocios.length === 0
            ? 'No hay subnegocios creados todavía.'
            : `${subNegocios.length} subnegocio${subNegocios.length !== 1 ? 's' : ''} en esta organización. Seleccioná uno para gestionarlo.`}
        </p>
      </div>

      {/* Grid de cards */}
      {subNegocios.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 20,
        }}>
          {subNegocios.map((biz) => (
            <SubCard
              key={biz.id}
              biz={biz}
              isActive={String(biz.id) === String(activeBusinessId)}
              onClick={() => handleSelect(biz)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          color: '#aaa',
          gap: 12,
        }}>
          <div style={{ fontSize: 48 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>
            Esta es la organización principal
          </div>
          <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', maxWidth: 320 }}>
            Creá agrupaciones y convertílas en subnegocios para empezar a organizar tu catálogo.
          </div>
        </div>
      )}

      {/* Sección Discontinuados — solo si hay artículos discontinuados */}
      {discCount > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}>
                Organización
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
                Discontinuados
              </h3>
            </div>
          </div>

          <button
            onClick={onSelectDiscontinuados}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid #f0d5d5',
              background: '#fff8f8',
              width: '100%',
              boxSizing: 'border-box',
              maxWidth: 400,
              transition: 'all .15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fee'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff8f8'}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              ⛔
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                {discCount} artículo{discCount !== 1 ? 's' : ''} discontinuado{discCount !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Ver y gestionar discontinuados →
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}