// src/paginas/SuperPanel.jsx
// Panel de super usuarios (13/11/2026, usuaria): lo ven solo las cuentas con es_superusuario (los
// "Super usuarios" de Diego). Pedidos de los clientes, ajustes a medida, el chat de Anthony con los
// avisos por Telegram, y la lista de super usuarios. El back lo exige de nuevo en cada pedido.
import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Alert } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import SuperPedidos from '@/componentes/super/SuperPedidos';
import SuperAjustes from '@/componentes/super/SuperAjustes';
import SuperChatConfig from '@/componentes/super/SuperChatConfig';
import SuperUsuariosSection from '@/componentes/SuperUsuariosSection';
import { SuperAPI } from '@/servicios/apiSoporte';

const PESTANAS = [['pedidos', 'Pedidos'], ['ajustes', 'Ajustes a medida'], ['chat', 'Chat y avisos'], ['super', 'Super usuarios']];

export default function SuperPanel() {
  const { user } = useAuth() || {};
  const [params, setParams] = useSearchParams();
  const pedido = Number(params.get('pedido')) || null;
  const tab = PESTANAS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'pedidos';
  const [catalogo, setCatalogo] = useState([]);

  // El catálogo de claves lo necesitan tanto Ajustes como el detalle de un pedido.
  React.useEffect(() => { SuperAPI.ajustes().then((r) => setCatalogo(r?.catalogo || [])).catch(() => {}); }, []);

  const cambiarTab = (t) => setParams(t === 'pedidos' ? {} : { tab: t }, { replace: true });
  const alAbrirPedido = useCallback((id) => {
    setParams(id ? { pedido: String(id) } : {}, { replace: true });
  }, [setParams]);

  if (!user) return <Box sx={{ p: 3 }}>Cargando…</Box>;
  if (user.es_superusuario !== true) {
    return <Box sx={{ p: 3, maxWidth: 640, mx: 'auto' }}><Alert severity="warning">Esta pantalla es solo para super usuarios.</Alert></Box>;
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Typography variant="h5" fontWeight={800}>Panel de super usuarios</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Los pedidos que mandan los clientes desde el chat de Anthony y lo que se configura a medida para cada uno.
      </Typography>
      <Tabs value={tab} onChange={(_e, v) => cambiarTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        {PESTANAS.map(([k, l]) => <Tab key={k} value={k} label={l} sx={{ textTransform: 'none', fontWeight: 700 }} />)}
      </Tabs>
      {tab === 'pedidos' && <SuperPedidos pedidoInicial={pedido} onPedidoAbierto={alAbrirPedido} catalogo={catalogo} />}
      {tab === 'ajustes' && <SuperAjustes catalogo={catalogo} onCatalogo={setCatalogo} />}
      {tab === 'chat' && <SuperChatConfig />}
      {tab === 'super' && <SuperUsuariosSection />}
    </Box>
  );
}
