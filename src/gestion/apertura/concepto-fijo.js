// Traído de lazarillo_gestion/lib/empleados/concepto-fijo.ts (misma lógica).
import { encontrarSuperposicion } from "@/gestion/apertura/validaciones";
const aDate = (s) => (s ? new Date(s) : null);
/** Falta una fecha que el modo exige → mensaje; si está todo bien, null. */
export function errorVigencia(r) {
    if ((r.modo === "entre_fechas" || r.modo === "desde_adelante") && !r.fechaDesde)
        return "Falta la fecha desde.";
    if ((r.modo === "entre_fechas" || r.modo === "desde_atras") && !r.fechaHasta)
        return "Falta la fecha hasta.";
    if (r.modo === "entre_fechas" && r.fechaDesde > r.fechaHasta)
        return "La fecha desde es posterior a la fecha hasta.";
    return null;
}
/** id de una regla activa del mismo empleado y PDV cuyo período se pisa con el de la nueva, o null. */
export function superposicion(nueva, existentes) {
    const mismas = existentes.filter((e) => e.entidadId === nueva.entidadId && e.origenPuntoDeVentaId === nueva.origenPuntoDeVentaId && e.id !== nueva.id);
    const v = (r) => ({ modo: r.modo, fechaDesde: aDate(r.fechaDesde), fechaHasta: aDate(r.fechaHasta), extremosInclusivos: r.extremosInclusivos });
    return encontrarSuperposicion(v(nueva), mismas.map((e) => ({ ...v(e), id: e.id })));
}
/** Texto corto del período, como en las reglas de apertura. */
export function describirPeriodo(r) {
    const f = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
    switch (r.modo) {
        case "historico": return "todo el histórico";
        case "entre_fechas": return `${f(r.fechaDesde)} a ${f(r.fechaHasta)}`;
        case "desde_adelante": return `desde ${f(r.fechaDesde)}`;
        case "desde_atras": return `hasta ${f(r.fechaHasta)}`;
    }
}
