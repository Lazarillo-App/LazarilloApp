// src/componentes/RrhhNominaCompartida.jsx
// RRHH · elegir otro negocio de la cartera para usar su nómina (vinculada, no
// copia: altas, bajas y ediciones se ven en los dos; cada negocio arma su
// cronograma). Lo usan la tarjeta de arranque de Cronogramas y la pantalla de
// Nómina cuando el negocio no tiene nómina propia.
import React, { useEffect, useState } from 'react';
import { RrhhAPI } from '../servicios/apiRrhh';

const C = {
  head: '#F7FAFD', text: '#15213E', text2: '#46587A', text3: '#8696B2', vacio: '#B9C7DA',
  border: '#E2E9F2', border2: '#C9D6E6', accent: '#5BC2EA', bad: '#D64545',
};
const FB = "'Archivo', sans-serif";

export default function ListaNegociosNomina({ onVinculado, onCancelar }) {
  const [estado, setEstado] = useState('cargando'); // cargando | lista | guardando | error
  const [negocios, setNegocios] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let vivo = true;
    RrhhAPI.candidatosNomina()
      .then((r) => { if (vivo) { setNegocios(r.negocios || []); setEstado('lista'); } })
      .catch((e) => { if (vivo) { setMsg(e?.data?.message || e.message || 'No se pudo leer tu cartera.'); setEstado('error'); } });
    return () => { vivo = false; };
  }, []);

  const elegir = async (n) => {
    if (!n.empleados || estado === 'guardando') return;
    setEstado('guardando'); setMsg('');
    try {
      const r = await RrhhAPI.vincularNomina(n.origenId || n.id);
      onVinculado?.(r.compartidaCon);
    } catch (e) {
      setMsg(e?.data?.message || e.message || 'No se pudo compartir la nómina.');
      setEstado('lista');
    }
  };

  return (
    <div style={{ textAlign: 'left', marginTop: 14 }}>
      <div style={{ fontFamily: FB, fontSize: 12, color: C.text2, marginBottom: 6 }}>
        Elegí de qué negocio usar la nómina. Queda <b>compartida</b>: las altas, bajas y cambios se ven en los dos; cada negocio arma su propio cronograma.
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {estado === 'cargando' && <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: C.text3 }}>Buscando los negocios de tu cartera…</div>}
        {estado === 'error' && <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: C.bad }}>{msg}</div>}
        {(estado === 'lista' || estado === 'guardando') && !negocios.length && (
          <div style={{ padding: 12, fontFamily: FB, fontSize: 12.5, color: C.text3 }}>No hay otros negocios en tu cartera.</div>
        )}
        {(estado === 'lista' || estado === 'guardando') && negocios.map((n, i) => {
          const usable = n.empleados > 0;
          return (
            <div key={n.id} onClick={() => elegir(n)} title={usable ? `Usar la nómina de ${n.nombre}` : 'Este negocio no tiene empleados'}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderTop: i ? `1px solid ${C.border}` : 'none', cursor: usable ? 'pointer' : 'default',
                fontFamily: FB, fontSize: 13, color: usable ? C.text : C.vacio, background: 'transparent' }}
              onMouseEnter={(e) => { if (usable) e.currentTarget.style.background = C.head; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontWeight: 700 }}>
                {n.nombre}
                {n.origenNombre && <span style={{ fontWeight: 400, color: C.text3 }}> · comparte la de {n.origenNombre}</span>}
              </span>
              <span style={{ fontSize: 12, color: C.text3, whiteSpace: 'nowrap' }}>{usable ? `${n.empleados} empleados` : 'sin empleados'}</span>
            </div>
          );
        })}
      </div>
      {msg && estado !== 'error' && <div style={{ fontFamily: FB, fontSize: 12.5, color: C.bad, marginTop: 8 }}>{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontFamily: FB, fontSize: 12, color: C.text3 }}>{estado === 'guardando' ? 'Compartiendo…' : ''}</span>
        {onCancelar && <span onClick={onCancelar} style={{ fontFamily: FB, fontSize: 12.5, fontWeight: 700, color: C.text2, cursor: 'pointer' }}>Cancelar</span>}
      </div>
    </div>
  );
}
