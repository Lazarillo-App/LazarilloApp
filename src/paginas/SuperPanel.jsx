// src/paginas/SuperPanel.jsx
// Panel de super usuarios (13/11/2026, usuaria): lo ven solo las cuentas con es_superusuario (los
// "Super usuarios" de Diego). Pedidos de los clientes, ajustes a medida, el chat de Anthony con los
// avisos por Telegram, y la lista de super usuarios. El back lo exige de nuevo en cada pedido.
import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Alert } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import SuperPedidos from '@/componentes/super/SuperPedidos';
import SuperTablero from '@/componentes/super/SuperTablero';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';
import SuperAjustes from '@/componentes/super/SuperAjustes';
import SuperChatConfig from '@/componentes/super/SuperChatConfig';
import SuperUsuariosSection from '@/componentes/SuperUsuariosSection';
import { SuperAPI } from '@/servicios/apiSoporte';

const PESTANAS = [['pedidos', 'Pedidos'], ['tareas', 'Tareas del equipo'], ['ajustes', 'Ajustes a medida'], ['chat', 'Chat y avisos'], ['super', 'Super usuarios']];

export default function SuperPanel() {
  const { user } = useAuth() || {};
  const [params, setParams] = useSearchParams();
  const pedido = Number(params.get('pedido')) || null;
  const tarea = Number(params.get('tarea')) || null;
  const tab = PESTANAS.some(([k]) => k === params.get('tab')) ? params.get('tab') : (tarea ? 'tareas' : 'pedidos');
  const [catalogo, setCatalogo] = useState([]);

  // El catálogo de claves lo necesitan tanto Ajustes como el detalle de un pedido.
  React.useEffect(() => { cargarFuentes(); }, []);
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
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Typography sx={{ fontFamily: FT, fontWeight: 700, fontSize: { xs: 20, md: 24 }, color: T.text }}>Panel de super usuarios</Typography>
      <Typography sx={{ fontFamily: FB, fontSize: 13.5, color: T.text2, mb: 2 }}>
        Los pedidos de los clientes, las tareas del equipo y lo que se configura a medida para cada uno.
      </Typography>
      <Tabs value={tab} onChange={(_e, v) => cambiarTab(v)} variant="scrollable" allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: `1px solid ${T.border}`, minHeight: 40,
          '& .MuiTabs-indicator': { backgroundColor: T.accent, height: 3, borderRadius: 3 } }}>
        {PESTANAS.map(([k, l]) => <Tab key={k} value={k} label={l} sx={{ textTransform: 'none', fontFamily: FT, fontWeight: 600, fontSize: 13.5,
          minHeight: 40, color: T.text2, '&.Mui-selected': { color: T.text } }} />)}
      </Tabs>
      {tab === 'pedidos' && <SuperPedidos pedidoInicial={pedido} onPedidoAbierto={alAbrirPedido} catalogo={catalogo} />}
      {tab === 'tareas' && <SuperTablero key={tarea || 'tablero'} tareaInicial={tarea} />}
      {tab === 'ajustes' && <SuperAjustes catalogo={catalogo} onCatalogo={setCatalogo} />}
      {tab === 'chat' && <SuperChatConfig />}
      {tab === 'super' && <SuperUsuariosSection />}
    </Box>
  );
}
