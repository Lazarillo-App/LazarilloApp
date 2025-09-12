// src/componentes/AdminActionsSidebar.jsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, Button, Stack, Typography, CircularProgress } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { BusinessesAPI } from '../servicios/apiBusinesses';
import { ventasCache } from '../servicios/ventasCache';

function rangoMesActualHastaAyer() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const fmt = (d) => d.toISOString().slice(0,10);
  return { from: fmt(start), to: fmt(yesterday) };
}

export default function AdminActionsSidebar({ onSynced }) {
  const [loading, setLoading] = useState(false);
  const activeBizId = useMemo(() => localStorage.getItem('activeBusinessId'), []);

  const syncVentas = async () => {
    if (!activeBizId) return alert('Seleccioná un local activo primero.');
    const { from, to } = rangoMesActualHastaAyer();
    setLoading(true);
    try {
      await BusinessesAPI.syncNow(activeBizId, { scope: 'sales', from, to });
      ventasCache.clear();                 // ✅ invalidar cache de series
      window.dispatchEvent(new Event('ventas:invalidate')); // opcional: listeners en vistas
      onSynced?.();                        // refrescar listado de locales si querés
      alert('Sincronización de ventas completada.');
    } catch (e) {
      console.error(e);
      alert('No se pudo sincronizar ventas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Acciones del administrador" />
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            Sincronizá las ventas del mes (hasta ayer) desde Maxi hacia la base. La UI siempre lee desde la DB.
          </Typography>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <SyncIcon />}
            disabled={loading}
            onClick={syncVentas}
          >
            Sincronizar ventas (mes actual)
          </Button>

          {/* Si querés más acciones, podés sumar acá:
          <Button onClick={() => syncScope('articles')}>Sincronizar artículos</Button>
          <Button onClick={() => syncScope('all')}>Sincronizar todo</Button>
          */}
        </Stack>
      </CardContent>
    </Card>
  );
}
