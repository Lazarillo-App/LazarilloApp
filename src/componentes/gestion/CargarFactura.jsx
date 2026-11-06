// src/componentes/gestion/CargarFactura.jsx
// Botón "+ Cargar Gastos" del Panel y "Ver factura" (lazarillo_gestion/components/facturas/
// cargar-factura.tsx y ver-factura.tsx). Se carga en la sucursal elegida arriba.

import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Dialog, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { refrescarCompras, useMaestrosFactura } from '@/gestion/hooksPanel';
import { ctxDesdeCelda } from '@/gestion/cargaUtils';
import ModalNuevaCarga, { edeDesdeFactura } from './ModalCargaFactura';
import CompraLineasModal from './CompraLineasModal';
import { useReglasCarga } from './apertura/useReglasCarga';

const pesos = (n) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
// Con "Todas las sucursales" se carga igual: arranca en la principal y el PDV se elige en cada
// registro (Diego 06/11/2026: en Container FC no dejaba cargar).
const lugarDe = (lugares, sucursalCaja, businessId) => {
  if (sucursalCaja === undefined) return (lugares ?? []).find((l) => l.id === -Number(businessId)) ?? (lugares ?? [])[0] ?? null;
  const id = sucursalCaja === 'principal' ? -Number(businessId) : Number(sucursalCaja);
  return (lugares ?? []).find((l) => l.id === id) ?? null;
};

// Lo que no pudo llegar a los costos de las recetas: mejor decirlo que dejar un costo viejo sin que se note.
function avisoConCostos(txt, costos) {
  const faltan = costos?.sinVincular ?? [];
  const partes = [];
  if (faltan.length) partes.push(`${faltan.length === 1 ? 'Este renglón no está vinculado' : `${faltan.length} renglones no están vinculados`} a un insumo y no mueve${faltan.length === 1 ? '' : 'n'} costos: ${faltan.slice(0, 4).join(', ')}${faltan.length > 4 ? '…' : ''}.`);
  if (costos?.descartados) partes.push(`${costos.descartados === 1 ? 'Un precio' : `${costos.descartados} precios`} muy distinto${costos.descartados === 1 ? '' : 's'} a los anteriores no se aplicó: revisá la cantidad o el envase.`);
  return partes.length ? { sev: 'warning', txt: `${txt}. ${partes.join(' ')}` } : { txt };
}

function Aviso({ aviso, onClose }) {
  return (
    <Snackbar open={!!aviso} autoHideDuration={aviso?.sev === 'warning' ? 12000 : 4000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      {aviso ? <Alert severity={aviso.sev ?? 'success'} variant="filled" onClose={onClose}>{aviso.txt}</Alert> : undefined}
    </Snackbar>
  );
}

// `pedido`: celda vacía tocada en el Panel; abre un Gasto Vario ya armado.
export default function CargarFactura({ pedido, onPedidoAtendido, etiqueta = 'Cargar Gastos' }) {
  const { businessId, sucursal, sucursalCaja } = usePanelGestion();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Los maestros se piden al abrir el Panel: cuando se abre el modal ya están.
  const { data: maestros, isError } = useMaestrosFactura(true);
  const lugar = lugarDe(maestros?.lugares, sucursalCaja, businessId);
  const puede = true;
  const reglasCarga = useReglasCarga(lugar?.id ?? null, maestros?.lugares ?? []);

  useEffect(() => {
    if (!pedido) return undefined;
    let vivo = true;
    const abrir = (fechaPagoPrev) => {
      if (!vivo) return;
      setCtx(ctxDesdeCelda(pedido, fechaPagoPrev));
      setAbierto(true);
      onPedidoAtendido?.();
    };
    if (!pedido.prev) { abrir(null); return () => { vivo = false; }; }
    // Del mes anterior se trae la fecha de pago; si no llega, la carga abre igual.
    GestionAPI.detalle({ year: pedido.anio, sucursal, conceptoCodigo: pedido.conceptoCodigo, mes: pedido.prev.mes })
      .catch(() => null)
      .then((d) => {
        const filas = (d?.data ?? []).filter((f) => f.fechaPago);
        filas.sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
        abrir(filas[0]?.fechaPago ? String(filas[0].fechaPago) : null);
      });
    return () => { vivo = false; };
  }, [pedido, sucursal, onPedidoAtendido]);
  const cerrar = () => { setAbierto(false); setCtx(null); };

  return (
    <>
      <Box
        component="button" type="button" disabled={!puede} onClick={() => setAbierto(true)}
        title={sucursalCaja !== undefined ? 'Cargar una factura en esta sucursal' : 'Cargar una factura (el PDV se elige en cada registro)'}
        sx={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', height: 32, px: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0, borderRadius: 2, bgcolor: 'grey.900', color: '#fff', fontSize: 14, fontWeight: 500, '&:hover': { bgcolor: 'grey.800' }, '&:disabled': { opacity: 0.4, cursor: 'default' } }}
      >
        <AddIcon sx={{ fontSize: 15 }} /> {etiqueta}
      </Box>
      {abierto && puede && (maestros ? (
        <ModalNuevaCarga
          maestros={maestros}
          pdvsRef={maestros.lugares}
          pdvActual={lugar?.nombre}
          reglaDe={reglasCarga.reglaDe}
          reglaEmpleadoDe={reglasCarga.reglaEmpleadoDe}
          ctx={ctx ?? undefined}
          onCerrar={cerrar}
          onProveedorCreado={() => queryClient.invalidateQueries({ queryKey: ['gestionMaestrosFactura'] })}
          onGuardado={(d) => {
            cerrar();
            refrescarCompras(queryClient);
            if (d.empleado) {
              setAviso({ txt: `${d.tipo === 'sueldo' ? 'Sueldo' : 'Adelanto'} cargado: ${d.nombre} · ${pesos(d.total)}` });
              return;
            }
            const importe = pesos(d.total);
            const conPago = d.pago ? ` · ${d.pago.numero ?? `Pago Nº ${d.pago.id}`}` : '';
            setAviso(d.gastoVario
              ? { txt: `${d.pago ? 'Gasto cargado y pagado' : 'Gasto cargado (impago)'}: ${d.concepto ?? 'Gastos Varios'} · ${importe}${conPago}` }
              : avisoConCostos(`${d.pago ? 'Factura cargada y pagada' : 'Factura cargada'}: ${d.comprobante} · ${importe}${conPago}`, d.costos));
          }}
        />
      ) : (
        <Box onClick={isError ? cerrar : undefined} sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,.3)', color: '#fff', fontSize: 14 }}>{isError ? 'No se pudieron leer los maestros. Tocá para cerrar.' : 'Cargando maestros…'}</Box>
      ))}
      <Aviso aviso={aviso} onClose={() => setAviso(null)} />
    </>
  );
}

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '');

// Ver una factura con el formato de la carga: si es de Lazarillo, Editar o Eliminar. Si la fila no
// es una factura (gasto o sueldo sin comprobante), el detalle de líneas de siempre.
// vistaInicial "repetir": abre directo la carga nueva con esta estructura (Diego 06/11/2026: desde la
// cta cte, "Repetir" abría la factura y había que volver a apretar Repetir).
// facturaDirecta: una factura que no está en Caja y llega armada desde su detalle (no tiene rowId).
export function VerFactura({ rowId, detalle, onClose, vistaInicial = 'ver', facturaDirecta = null }) {
  const { businessId } = usePanelGestion();
  const queryClient = useQueryClient();
  const [vista, setVista] = useState(vistaInicial);
  const [aviso, setAviso] = useState(null);
  const consulta = useQuery({
    queryKey: ['gestionFactura', businessId, rowId],
    queryFn: () => GestionAPI.factura(rowId),
    enabled: !!rowId && !facturaDirecta,
  });
  const data = facturaDirecta || consulta.data;
  const isLoading = !facturaDirecta && consulta.isLoading;
  const fa = data && !data.noEsFactura ? data : null;
  const { data: maestros } = useMaestrosFactura(!!fa);
  const { reglaDe } = useReglasCarga(fa?.factura.registros[0]?.puntoDeVentaId ?? null, maestros?.lugares ?? []);

  // Sin factura abierta queda solo el aviso de lo último que se hizo.
  if (!rowId && !facturaDirecta) return <Aviso aviso={aviso} onClose={() => setAviso(null)} />;
  if (data?.noEsFactura) return <CompraLineasModal compraId={rowId} comprobante={detalle} onClose={onClose} />;
  const pdvsRef = maestros?.lugares ?? [];
  const pdvActual = pdvsRef.find((p) => p.id === fa?.factura.registros[0]?.puntoDeVentaId)?.nombre;
  const cerrar = () => { setVista('ver'); onClose(); };
  const ede = fa && maestros ? edeDesdeFactura(fa.rowId, fa.factura, { maestros, pdvsRef }) : null;
  const avisoFactura = !fa ? null
    : fa.soloDetalle
      ? 'Cargada en MaxiRest, pero no está en Caja: no suma en Resultados (sí en el costo de las recetas). Pasa cuando el insumo no tiene concepto de caja: en MaxiRest el concepto sale del rubro del insumo.'
    : fa.origen === 'maxirest'
      ? `Cargada desde MaxiRest: se ve con el formato de la carga, pero se modifica en MaxiRest.${fa.estimado ? ' Sin detalle de insumos (informe 25): el neto y el IVA se estiman al 21% sobre el importe.' : ''}`
      : `Cargada en Lazarillo${fa.cargadaPor ? ` por ${fa.cargadaPor}` : ''}${fa.cargadaEn ? ` el ${fechaCorta(fa.cargadaEn)}` : ''}${fa.editadaEn && fa.cargadaEn && String(fa.editadaEn).slice(0, 16) !== String(fa.cargadaEn).slice(0, 16) ? ` · editada el ${fechaCorta(fa.editadaEn)}` : ''}.`;

  return (
    <>
      <Dialog open onClose={cerrar} maxWidth={false} slotProps={{ paper: { sx: { width: 'min(1120px, 96vw)', maxHeight: '92vh', overflow: 'auto', borderRadius: 3 } } }}>
        {isLoading || !fa || !maestros ? (
          <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress size={32} /></Box>
        ) : vista === 'repetir' ? (
          <ModalNuevaCarga
            key="repetir" embebido vista="nueva" ctx={{ repetirDe: ede }} maestros={maestros} pdvsRef={pdvsRef} pdvActual={pdvActual} reglaDe={reglaDe}
            onCerrar={vistaInicial === 'repetir' ? cerrar : () => setVista('ver')}
            onGuardado={(d) => { setAviso(avisoConCostos(`Factura cargada: ${d.comprobante} · ${pesos(d.total)}`, d.costos)); refrescarCompras(queryClient); cerrar(); }}
          />
        ) : (
          <ModalNuevaCarga
            key={vista} embebido vista={vista} ctx={{ editarDe: ede }} editRowId={fa.rowId} editable={fa.editable} aviso={avisoFactura}
            maestros={maestros} pdvsRef={pdvsRef} pdvActual={pdvActual} reglaDe={reglaDe}
            onEditar={() => setVista('editar')}
            onRepetir={() => setVista('repetir')}
            onCerrar={vista === 'editar' ? () => setVista('ver') : cerrar}
            onGuardado={(d) => {
              setAviso(d.correccionesPerdidas
                ? { sev: 'warning', txt: `Factura modificada. ${d.correccionesPerdidas} corrección(es) a mano quedaron en registros que cambiaron de sucursal o concepto: revisalas en Detalle de compras.` }
                : avisoConCostos(`Factura modificada: ${d.comprobante} · ${pesos(d.total)}`, d.costos));
              refrescarCompras(queryClient);
              cerrar();
            }}
            onEliminado={() => { setAviso({ txt: 'Factura eliminada' }); refrescarCompras(queryClient); cerrar(); }}
          />
        )}
      </Dialog>
      <Aviso aviso={aviso} onClose={() => setAviso(null)} />
    </>
  );
}
