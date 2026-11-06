// src/componentes/gestion/FacturaEnRecetas.jsx
// La carga de factura del Panel usada desde Recetas (modal de compras de un insumo, Diego 05/11/2026):
// «Cargar factura» y abrir la factura de una compra con el formato de la carga (ver / editar).
// El Panel provee su contexto (negocio + sucursal); acá se arma con el negocio activo y la sucursal
// elegida en la barra (con "todas", la principal).
import React, { useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { Toaster } from 'sonner';
import { PanelGestionContext } from '@/gestion/panelContext';
import { useBranch } from '@/hooks/useBranch';
import { getSession } from '@/servicios/apiBase';
import { gestionFetch } from '@/servicios/apiGestion';
import CargarFactura, { VerFactura } from './CargarFactura';

function ConContextoGestion({ children }) {
  const { activeBusinessId } = getSession();
  const { activeBranchFilter } = useBranch() || {};
  const suc = activeBranchFilter && activeBranchFilter.mode === 'branch' && activeBranchFilter.branchId ? String(activeBranchFilter.branchId) : 'principal';
  const valor = useMemo(() => ({
    businessId: activeBusinessId, year: new Date().getFullYear(), sucursal: suc, sucursalCaja: suc, modo: 'economica',
    abrirDetalle: () => {}, abrirVentas: () => {},
  }), [activeBusinessId, suc]);
  return <PanelGestionContext.Provider value={valor}>{children}</PanelGestionContext.Provider>;
}

export function BotonCargarFactura() {
  return <ConContextoGestion><CargarFactura etiqueta="Cargar factura" /></ConContextoGestion>;
}

// Hook + modal: abrir(purchaseId, comprobante) busca la factura de esa compra y la muestra.
export function useVerFacturaDeCompra() {
  const [ver, setVer] = useState(null); // { rowId, comprobante }
  const [buscando, setBuscando] = useState(null);
  const [error, setError] = useState('');
  const abrir = async (purchaseId, comprobante) => {
    if (!purchaseId) return;
    setBuscando(purchaseId); setError('');
    try {
      const r = await gestionFetch(`/api/facturas/de-compra?purchaseId=${encodeURIComponent(purchaseId)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || !d.rowId) setError((d && d.error) || 'No encontré la factura de esta compra.');
      else setVer({ rowId: d.rowId, comprobante });
    } catch (_) { setError('Error de red: no se pudo abrir la factura.'); }
    setBuscando(null);
  };
  // Los avisos del modal de carga (sonner) necesitan su Toaster: en Recetas no hay otro.
  const modal = (
    <>
      <Toaster position="bottom-right" />
      <ConContextoGestion>
        <VerFactura rowId={ver ? ver.rowId : null} detalle={ver ? ver.comprobante : ''} onClose={() => setVer(null)} />
      </ConContextoGestion>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {error ? <Alert severity="warning" variant="filled" onClose={() => setError('')}>{error}</Alert> : undefined}
      </Snackbar>
    </>
  );
  return { abrir, buscando, modal };
}
