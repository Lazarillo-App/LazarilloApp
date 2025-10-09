// src/componentes/RequireMaxi.jsx
import React, { useEffect, useState } from 'react';
import MaxiSetupModal from './BusinessCreateModal';
import { BusinessesAPI } from '../servicios/apiBusinesses';

export default function RequireMaxi({ children }) {
  const [status, setStatus] = useState({ loading:true, configured:false });
  const [show, setShow] = useState(false);
  const activeId = localStorage.getItem('activeBusinessId');

  const check = async () => {
    if (!activeId) return setStatus({ loading:false, configured:false });
    try {
      const s = await BusinessesAPI.maxiStatus(activeId);
      setStatus({ loading:false, configured: !!s?.configured });
      setShow(!s?.configured);
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      setStatus({ loading:false, configured:false });
      setShow(true);
    }
  };

  useEffect(() => { check(); /* eslint-disable-next-line */ }, [activeId]);

  if (status.loading) return <div style={{padding:24}}>Cargando…</div>;
  if (!status.configured) {
    return (
      <>
        <EmptyState onConnect={() => setShow(true)} />
        <MaxiSetupModal
          open={show}
          activeBusinessId={activeId}
          onDone={() => { setShow(false); check(); }}
          onCancel={() => setShow(false)}
        />
      </>
    );
  }
  return <>{children}</>;
}

function EmptyState({ onConnect }) {
  return (
    <div style={{padding:'48px 24px', textAlign:'center'}}>
      <h2>Conectá tu MaxiRest</h2>
      <p>Para ver productos y ventas, primero vinculá las credenciales del local activo.</p>
      <button className="btn-primary" onClick={onConnect}>Conectar ahora</button>
    </div>
  );
}
