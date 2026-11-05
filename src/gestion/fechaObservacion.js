// Portado de lazarillo_gestion/lib/dashboard/fecha-observacion.ts (misma lógica).
// Las fechas de los resultados de búsqueda viajan como "YYYY-MM-DD" (TO_CHAR en SQL).
// Se parsean por regex y no con Date para evitar corrimientos por zona horaria.
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function anioDeFecha(fecha) {
  const m = fecha ? FECHA_ISO.exec(fecha) : null;
  return m ? Number(m[1]) : null;
}

// Incluye el año: los resultados de la búsqueda pueden ser de cualquier año, no solo del que se está mirando.
export function formatFechaConAnio(fecha) {
  const m = fecha ? FECHA_ISO.exec(fecha) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
