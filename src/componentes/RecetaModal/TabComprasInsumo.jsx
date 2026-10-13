// src/componentes/RecetaModal/TabComprasInsumo.jsx
import { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { BASE } from '@/servicios/apiBase';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { ComprasDetalleContenido } from '../ComprasMiniDetalleModal';
import CostoPreferidoSelector from './CostoPreferidoSelector';

export default function TabComprasInsumo({
  insumoId, businessId, insumoData, activeBizId = null, businesses = [],
  // Rango del período consultado y callback para pisarlo con el botón "📅
  // Fechas" del detalle — ambos viven en RecetaModal para sobrevivir el
  // salto a otro insumo desde el ranking "Top por gasto" sin perderse.
  rango, onCambiarRango = null,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facturacionPorMes, setFacturacionPorMes] = useState(null);

  // Las compras son transacciones por SUCURSAL, a diferencia de `businessId` acá (que es
  // el negocio raíz donde vive el catálogo del insumo, usado para CostoPreferidoSelector
  // más abajo). Sin esto, en un subnegocio esta pestaña consultaba siempre las compras
  // del negocio raíz y nunca las de la sucursal realmente activa (ej. nunca se veían las
  // de "Ramos", solo las del negocio raíz) — y sin `businesses` tampoco había forma de
  // elegir otra sucursal/negocio a mano, a diferencia del ícono de compras junto al precio.
  const comprasBizId = activeBizId || businessId;

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

  // Facturación del negocio por mes, para el KPI "sobre facturación" del
  // detalle de compras — si falla, ese KPI y su serie simplemente no se ven.
  useEffect(() => {
    if (!comprasBizId) return;
    let vivo = true;
    BusinessesAPI.salesMonthly(comprasBizId, { from: rango.from, to: rango.to })
      .then((resp) => { if (vivo) setFacturacionPorMes(resp?.porMes || null); })
      .catch(() => { if (vivo) setFacturacionPorMes(null); });
    return () => { vivo = false; };
  }, [comprasBizId, rango]);

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
        facturacionPorMes={facturacionPorMes}
        onCambiarRango={onCambiarRango}
      />
    </Box>
  );
}
