// src/componentes/RecetaModal/TabComprasInsumo.jsx
import { useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { BASE } from '@/servicios/apiBase';
import { ComprasDetalleContenido } from '../ComprasMiniDetalleModal';
import CostoPreferidoSelector from './CostoPreferidoSelector';

export default function TabComprasInsumo({ insumoId, businessId, insumoData, activeBizId = null, businesses = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Las compras son transacciones por SUCURSAL, a diferencia de `businessId` acá (que es
  // el negocio raíz donde vive el catálogo del insumo, usado para CostoPreferidoSelector
  // más abajo). Sin esto, en un subnegocio esta pestaña consultaba siempre las compras
  // del negocio raíz y nunca las de la sucursal realmente activa (ej. nunca se veían las
  // de "Ramos", solo las del negocio raíz) — y sin `businesses` tampoco había forma de
  // elegir otra sucursal/negocio a mano, a diferencia del ícono de compras junto al precio.
  const comprasBizId = activeBizId || businessId;

  // Rango amplio: todo el historial disponible del insumo
  const rango = useMemo(() => {
    const hoy = new Date();
    const to = hoy.toISOString().slice(0, 10);
    const from = `${hoy.getFullYear() - 5}-01-01`;
    return { from, to };
  }, []);

  useEffect(() => {
    if (!insumoId || !comprasBizId) return;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${BASE}/purchases?insumo_id=${insumoId}&from=${rango.from}&to=${rango.to}&limit=500`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-Business-Id': String(comprasBizId) },
        });
        const data = await res.json().catch(() => ({}));
        setItems(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [insumoId, comprasBizId, rango]);

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
        businessId={comprasBizId}
        businesses={businesses}
      />
    </Box>
  );
}
