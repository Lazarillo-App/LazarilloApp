// src/componentes/asistente/AvisoVolverAlAlta.jsx
// Anthony arriba de Artículos/Insumos, para negocios que pasaron por el alta nueva (pedido de la
// usuaria, 09/11): ventas y compras no se piden en el alta; se ofrecen acá, sin obligar (mucha gente
// las lleva a mano). Cada una desaparece cuando se sube; "Ahora no" lo esconde hasta la próxima
// vez y "No mostrar más" para siempre. Con MaxiRest no aparece: el actualizador ya las trae.
// Si el alta se omitió, también ofrece volver al asistente (conectar el POS, subir archivos).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import UploadInsumosModal from '../UploadInsumosModal';
import { ANT } from './anthonyAssets';
import { avisoDatos } from './altaEstado';

const LEIDO_KEY = (biz) => `lazarillo:aviso-datos-ahora-no:${biz}`;
const leerAhoraNo = (biz) => { try { return sessionStorage.getItem(LEIDO_KEY(biz)) === '1'; } catch { return false; } };

const boton = (principal) => ({
  border: principal ? 'none' : '1px solid #bfdcef', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: principal ? 'var(--color-primary, #2492C8)' : '#fff', color: principal ? 'var(--on-primary, #fff)' : '#15213E',
});
const link = { border: 'none', background: 'none', color: '#5b6b7c', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 };

export default function AvisoVolverAlAlta() {
  const { active, activeBusinessId, refetchBusinesses } = useBusiness() || {};
  const { isStaff } = useAccess() || {};
  const navigate = useNavigate();
  const [ahoraNo, setAhoraNo] = useState(() => leerAhoraNo(activeBusinessId));
  const [subiendo, setSubiendo] = useState(null); // 'ventas' | 'compras'
  const [ocultos, setOcultos] = useState({}); // lo que se subió en esta sesión (antes de que vuelva el negocio)

  const que = avisoDatos(active?.props);
  if (isStaff || ahoraNo || !que) return null;
  const pedirVentas = que.ventas && !ocultos.ventas;
  const pedirCompras = que.compras && !ocultos.compras;
  if (!pedirVentas && !pedirCompras && !que.volver) return null;

  const marcar = async (key, value = true) => {
    try { await BusinessesAPI.setOnboardingFlag(activeBusinessId, key, value); await refetchBusinesses?.(); } catch { /* el aviso igual se ajusta */ }
  };
  const esconderAhora = () => { setAhoraNo(true); try { sessionStorage.setItem(LEIDO_KEY(activeBusinessId), '1'); } catch { /* sin storage */ } };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 10px', padding: '10px 14px',
      background: '#eaf4fb', border: '1px solid #bfdcef', borderRadius: 12, fontSize: 14, color: '#15213E',
    }}>
      <img src={ANT.senala} alt="" style={{ height: 40, width: 'auto' }} />
      <div style={{ flex: 1, minWidth: 240, lineHeight: 1.45 }}>
        {pedirVentas || pedirCompras ? (
          <>
            <b>¿Sumamos tus datos?</b>{' '}
            {pedirVentas && 'Con las ventas te muestro qué se vende y cuánto. '}
            {pedirCompras && 'Con las compras tengo el precio real de tus insumos. '}
            <span style={{ color: '#5b6b7c' }}>Si lo llevás a mano, podés ir subiéndolas de a poco.</span>
          </>
        ) : (
          <><b>¿Tenés un POS?</b> Podés volver al asistente para conectarlo.</>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {pedirVentas && <button type="button" style={boton(true)} onClick={() => setSubiendo('ventas')}>Subir ventas</button>}
        {pedirCompras && <button type="button" style={boton(!pedirVentas)} onClick={() => setSubiendo('compras')}>Subir compras</button>}
        {que.volver && <button type="button" style={boton(false)} onClick={() => navigate('/alta')}>Conectar mi POS</button>}
        <button type="button" style={link} onClick={esconderAhora}>Ahora no</button>
        <button type="button" style={link} onClick={() => { esconderAhora(); marcar('avisos_datos_off'); }}>No mostrar más</button>
      </div>
      <UploadInsumosModal
        open={!!subiendo}
        tipo={subiendo || 'ventas'}
        businessId={activeBusinessId}
        onClose={() => setSubiendo(null)}
        onSuccess={() => {
          const k = subiendo;
          setOcultos((o) => ({ ...o, [k]: true }));
          marcar(k === 'ventas' ? 'ventas_subidas' : 'compras_subidas');
        }}
      />
    </div>
  );
}
