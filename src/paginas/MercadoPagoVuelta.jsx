// src/paginas/MercadoPagoVuelta.jsx
// Mercado Pago vuelve acá después de que el negocio autoriza la conexión (14/11/2026), con
// ?code&state (o ?error si la cancelaron). Se termina la conexión y se vuelve a Conexiones.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { useBusiness } from '@/context/BusinessContext';
import { MercadoPagoAPI } from '@/servicios/apiConciliacion';

const MENSAJES = {
  otro_negocio: 'La conexión se empezó desde otro negocio. Cambiá a ese negocio y volvé a tocar Conectar.',
  otro_usuario: 'La conexión la empezó otro usuario. Volvé a tocar Conectar desde tu sesión.',
  estado_vencido: 'Pasó demasiado tiempo desde que tocaste Conectar. Probá de nuevo.',
  mp_rechazo_codigo: 'Mercado Pago no aceptó la autorización. Probá de nuevo.',
  mp_sin_configurar: 'La conexión con Mercado Pago todavía no está habilitada en Lazarillo.',
};

export default function MercadoPagoVuelta() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { activeBusinessId } = useBusiness() || {};
  const [estado, setEstado] = useState('trabajando'); // trabajando | ok | error
  const [msg, setMsg] = useState('');
  const hecho = useRef(false);

  useEffect(() => {
    if (hecho.current || !activeBusinessId) return;
    hecho.current = true;
    const code = sp.get('code');
    const state = sp.get('state');
    if (!code) {
      setEstado('error');
      setMsg(sp.get('error') ? 'Cancelaste la autorización en Mercado Pago. No se conectó nada.' : 'Mercado Pago no devolvió la autorización.');
      return;
    }
    MercadoPagoAPI.conectar(activeBusinessId, code, state)
      .then(() => { setEstado('ok'); setTimeout(() => navigate('/configuracion?tab=7', { replace: true }), 1200); })
      .catch((e) => {
        setEstado('error');
        const c = String(e?.message || '').split(':')[0].trim(); // http() arma el Error con el código
        setMsg(MENSAJES[c] || 'No se pudo terminar la conexión con Mercado Pago. Probá de nuevo.');
      });
  }, [activeBusinessId, sp, navigate]);

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 8, px: 2, textAlign: 'center' }}>
      {estado === 'trabajando' && (<><CircularProgress /><Typography sx={{ mt: 2 }}>Conectando con Mercado Pago…</Typography></>)}
      {estado === 'ok' && <Alert severity="success">¡Listo! Mercado Pago quedó conectado.</Alert>}
      {estado === 'error' && (
        <>
          <Alert severity="error" sx={{ textAlign: 'left' }}>{msg}</Alert>
          <Button sx={{ mt: 2, textTransform: 'none' }} onClick={() => navigate('/configuracion?tab=7')}>Volver a Conexiones</Button>
        </>
      )}
    </Box>
  );
}
