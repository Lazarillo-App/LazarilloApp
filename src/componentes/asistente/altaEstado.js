// src/componentes/asistente/altaEstado.js
// Estado del alta en el negocio (props.onboarding): alta_estado = en_curso | omitido | terminado y
// alta_paso = pos | ventas | menu | compras | insumos | tablero. Al volver a entrar con el alta en
// curso, la app lleva a /alta y el asistente retoma en ese paso (pedido de la usuaria, 09/11).
import { BusinessesAPI } from '../../servicios/apiBusinesses';

export const PASOS_ALTA = ['ventas', 'menu', 'compras', 'insumos'];

export async function guardarAlta(businessId, estado, paso) {
  if (!businessId) return;
  try {
    if (estado) await BusinessesAPI.setOnboardingFlag(businessId, 'alta_estado', estado);
    if (paso) await BusinessesAPI.setOnboardingFlag(businessId, 'alta_paso', paso);
  } catch (e) { console.warn('[alta] no se pudo guardar el paso:', e?.message); }
}

/** El alta de este negocio quedó a medias (hay que retomarla al entrar). */
export const altaEnCurso = (negocio) => negocio?.props?.onboarding?.alta_estado === 'en_curso';

/** Qué pedir (pura, para poder probarla): null si no se muestra nada. */
export function avisoDatos(props) {
  const ob = props?.onboarding || {};
  if (!['omitido', 'terminado'].includes(ob.alta_estado)) return null; // negocios de antes del alta nueva: nada
  if (ob.avisos_datos_off) return null;
  if (String(ob.pos || '').toLowerCase() === 'maxirest' || props?.maxi?.email) return null;
  const ventas = !ob.ventas_subidas;
  const compras = !ob.compras_subidas;
  const volver = ob.alta_estado === 'omitido';
  return ventas || compras || volver ? { ventas, compras, volver } : null;
}
