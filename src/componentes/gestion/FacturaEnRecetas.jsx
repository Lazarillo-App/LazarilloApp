// src/componentes/gestion/FacturaEnRecetas.jsx
// La carga de factura del Panel usada desde Recetas (modal de compras de un insumo, Diego 05/11/2026):
// «Cargar factura» y abrir la factura de una compra con el formato de la carga (ver / editar).
// El Panel provee su contexto (negocio + sucursal); acá se arma con el negocio activo y la sucursal
// elegida en la barra (con "todas", la principal).
import React, { useMemo, useState } from 'react';
import { Alert, Dialog, Snackbar } from '@mui/material';
import { Toaster } from 'sonner';
import { PanelGestionContext } from '@/gestion/panelContext';
import { useBranch } from '@/hooks/useBranch';
import { getSession } from '@/servicios/apiBase';
import { gestionFetch } from '@/servicios/apiGestion';
import CargarFactura, { VerFactura } from './CargarFactura';
import { useQueryClient } from '@tanstack/react-query';
import { useMaestrosFactura } from '@/gestion/hooksPanel';
import EnvasesEditor from './EnvasesEditor';
import FichaProveedor from './FichaProveedor';

export function ConContextoGestion({ children }) {
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
  const [soloDetalle, setSoloDetalle] = useState(null); // compra que está en el detalle pero no en Caja
  const [buscando, setBuscando] = useState(null);
  const [error, setError] = useState('');
  const abrir = async (purchaseId, comprobante) => {
    if (!purchaseId) return;
    setBuscando(purchaseId); setError('');
    try {
      const r = await gestionFetch(`/api/facturas/de-compra?purchaseId=${encodeURIComponent(purchaseId)}`);
      const d = await r.json().catch(() => null);
      if (r.ok && d && d.soloDetalle) setSoloDetalle(d);
      else if (!r.ok || !d || !d.rowId) setError((d && d.error) || 'No encontré la factura de esta compra.');
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
      {soloDetalle && <CompraSoloDetalle d={soloDetalle} onClose={() => setSoloDetalle(null)} />}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {error ? <Alert severity="warning" variant="filled" onClose={() => setError('')}>{error}</Alert> : undefined}
      </Snackbar>
    </>
  );
  return { abrir, buscando, modal };
}

// Envases de compra en la ficha del insumo (Recetas › Insumos › Equivalencias), los mismos de la carga
// de facturas (Diego 06/11/2026). El insumo se ubica por su código (el de MaxiRest o el L de Lazarillo).
function EnvasesFichaInterno({ codigo, nombre }) {
  const qc = useQueryClient();
  const { data: maestros, isLoading } = useMaestrosFactura(true);
  if (isLoading || !maestros) return <div style={{ fontSize: 12.5, color: '#8a8a8a' }}>Cargando envases…</div>;
  const ins = (maestros.insumos || []).find((i) => String(i.codigo).trim() === String(codigo).trim());
  if (!ins) return <div style={{ fontSize: 12.5, color: '#8a8a8a' }}>Este insumo todavía no figura en el maestro de compras: sus envases se cargan desde la carga de facturas.</div>;
  return <EnvasesEditor codigo={String(ins.codigo)} nombre={nombre || ins.nombre} medida={ins.medida} envases={ins.envases || []}
    onCambio={() => qc.invalidateQueries({ queryKey: ['gestionMaestrosFactura'] })} />;
}
export function EnvasesCompraFicha({ codigo, nombre }) {
  if (!codigo) return null;
  return (
    <ConContextoGestion>
      <Toaster position="bottom-right" />
      <EnvasesFichaInterno codigo={codigo} nombre={nombre} />
    </ConContextoGestion>
  );
}

// Ficha del proveedor desde una compra de Recetas (Diego 06/11/2026). purchases guarda el proveedor con el
// código de MaxiRest (o 9.000.000.000 + n para los "L<n>" de Lazarillo); la ficha es la del maestro de la carga.
const BASE_PROVEEDOR_PANEL = 9000000000;
const codigoDeSupplier = (id) => {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= BASE_PROVEEDOR_PANEL ? `L${n - BASE_PROVEEDOR_PANEL}` : String(n);
};
function FichaDeCompra({ ver, onCerrar }) {
  const { data: maestros, isLoading } = useMaestrosFactura(true);
  if (isLoading || !maestros) return null;
  const lista = maestros.proveedores || [];
  const cod = codigoDeSupplier(ver.proveedorId);
  const p = (cod && lista.find((x) => String(x.codigo).trim() === cod))
    || (ver.cuit && lista.find((x) => x.cuit && x.cuit.replace(/\D/g, '') === String(ver.cuit).replace(/\D/g, '')))
    || lista.find((x) => (x.nombre || '').trim().toUpperCase() === String(ver.nombre || '').trim().toUpperCase());
  if (!p) return <Snackbar open autoHideDuration={5000} onClose={onCerrar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity="warning" variant="filled" onClose={onCerrar}>No encontré la ficha de {ver.nombre || 'este proveedor'}.</Alert></Snackbar>;
  return <FichaProveedor id={p.id} onCerrar={onCerrar} onGuardado={onCerrar} />;
}
export function useFichaProveedorDeCompra() {
  const [ver, setVer] = useState(null); // { proveedorId, cuit, nombre }
  const modal = ver ? (
    <ConContextoGestion>
      <Toaster position="bottom-right" />
      <FichaDeCompra ver={ver} onCerrar={() => setVer(null)} />
    </ConContextoGestion>
  ) : null;
  return { abrir: (it) => setVer({ proveedorId: it.proveedor_id, cuit: it.proveedor_cuit, nombre: it.proveedor_nombre ?? it.proveedor }), modal };
}

// Compra que MaxiRest tiene en el detalle de compras (informe 25) pero no en Caja (informe 14): se ve con sus
// renglones y se avisa que no suma en Resultados. Pasa cuando el insumo no tiene concepto de caja en
// MaxiRest (Diego 06/11/2026, Ramos Flora en Comercio).
const pesos = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function CompraSoloDetalle({ d, onClose }) {
  const total = (d.lineas || []).reduce((a, l) => a + Number(l.total || 0), 0);
  const fecha = d.fecha ? d.fecha.split('-').reverse().join('/') : '';
  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8a8a', padding: '6px 8px', borderBottom: '1px solid #ececea' };
  const td = { padding: '6px 8px', borderBottom: '1px solid #f2f2f0', fontSize: 13 };
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <b style={{ fontSize: 16 }}>{d.comprobante}</b>
          <span style={{ color: '#666', fontSize: 13 }}>{d.proveedor || ''}{fecha ? ` · ${fecha}` : ''}</span>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ margin: '10px 0 12px', border: '1.5px solid #f0d5a8', background: '#fdf8ee', color: '#8a6d2f', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
          ⚠ Esta compra está en el <b>detalle de compras</b> de MaxiRest pero <b>no en Caja</b>: cuenta para el costo de las recetas pero <b>no suma en Resultados</b>.
          Suele pasar cuando el insumo no tiene concepto de caja en MaxiRest.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Insumo / concepto</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={{ ...th, textAlign: 'right' }}>Unit. $</th><th style={{ ...th, textAlign: 'right' }}>Neto $</th><th style={th}>Concepto de caja</th></tr></thead>
          <tbody>
            {(d.lineas || []).map((l, i) => (
              <tr key={i}>
                <td style={td}>{l.nombre}</td>
                <td style={{ ...td, textAlign: 'right' }}>{Number(l.cantidad || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {l.medida || ''}</td>
                <td style={{ ...td, textAlign: 'right' }}>{pesos(l.unitario)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{pesos(l.total)}</td>
                <td style={{ ...td, color: l.concepto ? '#333' : '#c62828', fontWeight: l.concepto ? 400 : 600 }}>{l.concepto || 'sin concepto'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total neto</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{pesos(total)}</td><td style={td} /></tr></tfoot>
        </table>
      </div>
    </Dialog>
  );
}
