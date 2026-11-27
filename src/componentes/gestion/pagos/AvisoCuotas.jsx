// src/componentes/gestion/pagos/AvisoCuotas.jsx
// Aviso flotante de cuotas que vencen (usuaria 27/11/2026): el día que vence una cuota de un pago en cuotas
// (con «Avisarme»), aparece abajo a la izquierda en cualquier pantalla y no se va hasta que se marca como
// paga o se pospone. «Marcar como paga» registra el pago con el mismo circuito que la barra de pago, contra
// las mismas facturas. Solo dueño y admin (el staff no ve plata).
import React, { useCallback, useEffect, useState } from 'react';
import { gestionFetch } from '@/servicios/apiGestion';
import { useAccess } from '@/context/AccessContext';

const fmt = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const claveSnooze = (bid) => `cuotas_pospuestas_${bid}`;
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const leerPospuestas = (bid) => { try { return JSON.parse(localStorage.getItem(claveSnooze(bid)) || '{}'); } catch { return {}; } };

export default function AvisoCuotas({ businessId }) {
  const { isStaff } = useAccess() || {};
  const [cuotas, setCuotas] = useState([]);
  const [pospuestas, setPospuestas] = useState(() => leerPospuestas(businessId));
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    if (!businessId || isStaff) { setCuotas([]); return; }
    try {
      const r = await gestionFetch('/api/pagos-cuotas/vencidas');
      if (!r.ok) return;
      const j = await r.json();
      setCuotas(j?.cuotas || []);
    } catch { /* sin red: se reintenta en la próxima vuelta */ }
  }, [businessId, isStaff]);

  useEffect(() => {
    setPospuestas(leerPospuestas(businessId));
    cargar();
    const t = setInterval(cargar, 10 * 60 * 1000);
    const alCambiar = () => cargar();
    window.addEventListener('gestion:cuotas-cambio', alCambiar);
    return () => { clearInterval(t); window.removeEventListener('gestion:cuotas-cambio', alCambiar); };
  }, [businessId, cargar]);

  const hoy = hoyLocal();
  const visibles = cuotas.filter((c) => !(pospuestas[`${c.planId}-${c.n}`] > hoy));
  if (isStaff || !visibles.length) return null;

  const posponer = (c) => {
    const man = new Date(); man.setDate(man.getDate() + 1);
    const hasta = `${man.getFullYear()}-${String(man.getMonth() + 1).padStart(2, '0')}-${String(man.getDate()).padStart(2, '0')}`;
    // vuelve a aparecer mañana (se guarda «hasta» = mañana: se ve cuando hoy >= mañana)
    const nuevo = { ...pospuestas, [`${c.planId}-${c.n}`]: hasta };
    setPospuestas(nuevo);
    try { localStorage.setItem(claveSnooze(businessId), JSON.stringify(nuevo)); } catch { /* noop */ }
  };
  const pagar = async (c) => {
    setOcupado(`${c.planId}-${c.n}`); setMsg('');
    try {
      const r = await gestionFetch(`/api/pagos-cuotas/${c.planId}/cuotas/${c.n}/pagar`, { method: 'POST', body: JSON.stringify({}) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setMsg(j?.error || 'No se pudo registrar el pago.'); return; }
      setCuotas((xs) => xs.filter((x) => !(x.planId === c.planId && x.n === c.n)));
      try { window.dispatchEvent(new CustomEvent('gestion:pagos-cambio')); } catch { /* noop */ }
    } catch { setMsg('No se pudo registrar el pago. Probá de nuevo.'); }
    finally { setOcupado(null); }
  };

  return (
    <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 1400, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(360px, calc(100vw - 32px))' }}>
      {visibles.slice(0, 3).map((c) => {
        const k = `${c.planId}-${c.n}`;
        const atrasada = c.vence < hoy;
        return (
          <div key={k} role="alert" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 28px rgba(15,23,42,.22)', border: `1px solid ${atrasada ? '#f59e0b' : '#5BC2EA'}`, padding: '12px 14px', fontSize: 13.5, color: '#1f2933' }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>💳 Cuota {c.n} de {c.cantidad} · {c.proveedor || 'Proveedor'}</div>
            <div style={{ color: '#52606d', fontSize: 12.5 }}>
              <b style={{ color: '#1f2933' }}>{fmt(c.importe)}</b> · {atrasada ? `venció el ${fecha(c.vence)}` : 'vence hoy'}{c.medio ? ` · ${c.medio}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={ocupado === k} onClick={() => pagar(c)}
                style={{ flex: 1, minHeight: 36, border: 'none', borderRadius: 8, background: '#1f2933', color: '#fff', fontWeight: 700, cursor: 'pointer', padding: '0 12px' }}>
                {ocupado === k ? 'Registrando…' : 'Marcar como paga'}
              </button>
              <button type="button" onClick={() => posponer(c)} title="Vuelve a aparecer mañana"
                style={{ minHeight: 36, border: '1px solid #cbd2d9', borderRadius: 8, background: '#fff', color: '#52606d', fontWeight: 600, cursor: 'pointer', padding: '0 12px' }}>
                Mañana
              </button>
            </div>
          </div>
        );
      })}
      {visibles.length > 3 && <div style={{ fontSize: 12, color: '#52606d', background: '#fff', borderRadius: 8, padding: '4px 10px', alignSelf: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>+{visibles.length - 3} cuotas más</div>}
      {msg && <div style={{ fontSize: 12.5, color: '#b91c1c', background: '#fff', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>{msg}</div>}
    </div>
  );
}
