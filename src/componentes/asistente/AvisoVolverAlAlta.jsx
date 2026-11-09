// src/componentes/asistente/AvisoVolverAlAlta.jsx
// Quien omitió el asistente de alta y arranca con la tabla de Artículos vacía puede volver a él para
// cargar ventas, compras o conectar el POS (pedido de la usuaria, 09/11). Se muestra arriba de
// Artículos/Insumos mientras el alta esté "omitido"; "No mostrar más" lo da por terminado.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { guardarAlta } from './altaEstado';
import { ANT } from './anthonyAssets';

export default function AvisoVolverAlAlta() {
  const { active, activeBusinessId, refetchBusinesses } = useBusiness() || {};
  const { isStaff } = useAccess() || {};
  const navigate = useNavigate();
  const [oculto, setOculto] = useState(false);
  if (oculto || isStaff || active?.props?.onboarding?.alta_estado !== 'omitido') return null;

  const noMostrar = async () => {
    setOculto(true);
    await guardarAlta(activeBusinessId, 'terminado');
    try { await refetchBusinesses?.(); } catch { /* el aviso ya se ocultó */ }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 10px', padding: '10px 14px',
      background: '#eaf4fb', border: '1px solid #bfdcef', borderRadius: 12, fontSize: 14, color: '#15213E',
    }}>
      <img src={ANT.senala} alt="" style={{ height: 40, width: 'auto' }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>¿Tenés tus ventas, compras o un POS?</b> Cargalos y armo tu menú y tus insumos solo.
      </div>
      <button
        type="button"
        onClick={() => navigate('/alta')}
        style={{ border: 'none', borderRadius: 8, padding: '8px 14px', background: 'var(--color-primary, #2492C8)', color: 'var(--on-primary, #fff)', fontWeight: 600, cursor: 'pointer' }}
      >
        Volver al asistente
      </button>
      <button
        type="button"
        onClick={noMostrar}
        style={{ border: 'none', background: 'none', color: '#5b6b7c', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
      >
        No mostrar más
      </button>
    </div>
  );
}
