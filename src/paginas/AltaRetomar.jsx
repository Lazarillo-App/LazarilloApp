// src/paginas/AltaRetomar.jsx
// Volver al asistente de alta con un negocio ya creado (Diego, 08/11: "si
// finalizo necesito algo que me vuelva al asistente"). Se entra desde Anthony
// (botón flotante) → /alta. Arranca en los pasos POS · Ventas · Menú · Compras ·
// Insumos con los datos del negocio activo (no vuelve a pedir los datos del local).
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import AsistenteOnboarding from '@/componentes/asistente/AsistenteOnboarding';

export default function AltaRetomar() {
  const { active, activeBusinessId, refetchBusinesses } = useBusiness() || {};
  const navigate = useNavigate();
  if (!activeBusinessId) return null;
  const p = active?.props || {};
  const br = p.branding || active?.branding || {};
  const negocio = {
    nombre: active?.name || '',
    logo: br.logo_url || '',
    colores: { primary: br.primary || '#2492C8', secondary: br.secondary || '#15213E', background: br.background || '#F2F4F7' },
    telefono: p.contact?.phone || '', web: p.contact?.web || '',
    ciudad: p.address?.city || '', calle: p.address?.street || '', numero: p.address?.number || '',
    instagram: p.social?.instagram || '', facebook: p.social?.facebook || '', tiktok: p.social?.tiktok || '',
    descripcion: p.perfil?.descripcion || '',
  };
  return (
    <AsistenteOnboarding
      key={activeBusinessId}
      businessId={activeBusinessId}
      negocioInicial={negocio}
      // Retoma en el paso guardado; entrando a mano (Anthony) arranca en POS, sin volver a pedir el local.
      pasoInicial={p.onboarding?.alta_paso || 'pos'}
      onDone={async () => {
        try { await refetchBusinesses?.(); } catch { /* sin refetch, igual sale */ }
        window.dispatchEvent(new CustomEvent('business:created')); // refresca permisos y guard
        navigate('/menu');
      }}
    />
  );
}
