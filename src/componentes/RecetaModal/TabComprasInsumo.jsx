// src/componentes/RecetaModal/TabComprasInsumo.jsx
import { useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { BASE } from '@/servicios/apiBase';
import { ComprasDetalleContenido } from '../ComprasMiniDetalleModal';
import CostoPreferidoSelector from './CostoPreferidoSelector';

export default function TabComprasInsumo({ insumoId, businessId, insumoData }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Rango amplio: todo el historial disponible del insumo
  const rango = useMemo(() => {
    const hoy = new Date();
    const to = hoy.toISOString().slice(0, 10);
    const from = `${hoy.getFullYear() - 5}-01-01`;
    return { from, to };
  }, []);

  useEffect(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${BASE}/purchases?insumo_id=${insumoId}&from=${rango.from}&to=${rango.to}&limit=500`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(businessId) },
        });
        const data = await res.json().catch(() => ({}));
        setItems(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [insumoId, businessId, rango]);

  return (
    <Box sx={{ py: 1 }}>
      {insumoData && (
        <Box sx={{ mb: 1.5 }}>
          <CostoPreferidoSelector
            insumoId={insumoId}
            businessId={businessId}
            costoPreferido={insumoData.costo_preferido ?? null}
            origenEfectivo={insumoData.costo_efectivo_origen}
            variant="aviso"
          />
        </Box>
      )}
      <ComprasDetalleContenido
        open={true}
        insumoId={insumoId}
        insumoNombre={insumoData?.nombre || ''}
        insumoUnidad={insumoData?.unidad_med || insumoData?.medida || ''}
        rango={rango}
        items={items}
        loading={loading}
        businessId={businessId}
        businesses={[]}
      />
    </Box>
  );
}
