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
