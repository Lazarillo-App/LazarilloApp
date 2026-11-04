// src/componentes/gestion/apertura/useReglasCarga.js
// Regla de apertura que precarga el reparto en la carga (components/facturas/cargar-factura.tsx).
// Si un destino es de otro negocio no se precarga: la carga reparte solo dentro del negocio. Igual se
// reparte al guardar, porque la regla reclama la compra.
import { useReglasApertura } from './use-reglas-apertura';
import { cubreFecha, hoyUTC } from '@/gestion/apertura/estado-vigencia';
import { construirEntidadIdProveedorTexto, candidatosEntidadIdProveedor } from '@/gestion/apertura/proveedor-entidad-id';
import { normalizarProveedorTexto } from '@/gestion/apertura/text-normalize';

const fechaDe = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : hoyUTC());
const vigente = (hoy, x) => cubreFecha(hoy, x, x.fechaDesde ? new Date(x.fechaDesde) : null, x.fechaHasta ? new Date(x.fechaHasta) : null) !== false;

export function useReglasCarga(pdvId, pdvsRef) {
  const { reglas } = useReglasApertura();
  const reparto = (r) => {
    if (!r) return null;
    const rep = r.destinos.map((d) => ({ pdv: pdvsRef.find((p) => p.id === d.puntoDeVentaId)?.nombre, pct: Number(d.porcentaje) }));
    return rep.every((x) => x.pdv) ? rep : null;
  };
  const delOrigen = (x, nivel) => x.estado === 'activa' && x.nivel === nivel && x.origenPuntoDeVentaId === pdvId;
  const reglaDe = (codigo, _pdvs, fechaISO) => {
    if (!codigo || pdvId == null) return null;
    const hoy = fechaDe(fechaISO);
    return reparto(reglas.find((x) => delOrigen(x, 'concepto') && x.entidadId === codigo && vigente(hoy, x)));
  };
  const reglaEmpleadoDe = (nombre, codigo, fechaISO) => {
    if (pdvId == null) return null;
    const hoy = fechaDe(fechaISO);
    const ids = candidatosEntidadIdProveedor(construirEntidadIdProveedorTexto(normalizarProveedorTexto(nombre), codigo));
    const vigentes = reglas.filter((x) => delOrigen(x, 'proveedor') && ids.includes(x.entidadId) && vigente(hoy, x));
    return reparto(ids.map((id) => vigentes.find((x) => x.entidadId === id)).find(Boolean));
  };
  return { reglaDe, reglaEmpleadoDe };
}
