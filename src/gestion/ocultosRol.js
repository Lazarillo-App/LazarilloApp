// src/gestion/ocultosRol.js
//
// Partes del Panel que un rol a medida NO ve salvo que se las habiliten (Diego 12/11/2026:
// «la columna Total, configurable, por defecto que no la vea»). En el rol se guardan al revés
// que el resto: la lista `ocultos` lleva «+clave» cuando se la habilitaron.
export const OCULTOS_POR_DEFECTO = new Set(['tabla.col_total']);

/** ¿Está oculta `clave` para un rol con esta lista de ocultos? */
export function esOculto(ocultos, clave) {
  const lista = ocultos || [];
  return OCULTOS_POR_DEFECTO.has(clave) ? !lista.includes(`+${clave}`) : lista.includes(clave);
}

/** La lista de ocultos con `clave` alternada (visible ↔ oculta). */
export function alternarOculto(ocultos, clave) {
  const lista = ocultos || [];
  const marca = OCULTOS_POR_DEFECTO.has(clave) ? `+${clave}` : clave;
  return lista.includes(marca) ? lista.filter((x) => x !== marca) : [...lista, marca];
}
