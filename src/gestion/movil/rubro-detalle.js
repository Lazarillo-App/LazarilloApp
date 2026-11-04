// Traído de lazarillo_gestion/lib/movil/rubro-detalle.ts (misma lógica).
// Detalle de un rubro en "Gastos del mes por rubro" del celu (Diego 29/10/2026): al tocar
// el rubro se despliega, de mayor a menor. Personal por empleado (como la vista Proveedor
// del Panel); el resto por insumo o, si la factura no tiene detalle, por concepto (como la
// vista Insumos). En un mes proyectado se suman lo que falta cargar y el estimado del resto.
const norm = (t) => t.trim().toLowerCase();
export const esPersonal = (rubro) => /personal/i.test(rubro);
/** Líneas cargadas de un rubro, desde la respuesta del pivot (por proveedor o por insumo) del mes. */
export function cargadasDe(rows, rubro) {
    // Con varios PDV llegan varias filas del mismo rubro: se suman.
    const filas = (rows ?? []).filter((x) => norm(x.nombre) === norm(rubro));
    const m = new Map();
    for (const c of filas.flatMap((r) => r.children ?? [])) {
        const k = c.nombre.trim();
        m.set(k, (m.get(k) ?? 0) + c.rowTotal);
    }
    return [...m].filter(([, t]) => Math.abs(t) > 0.5).map(([nombre, total]) => ({ nombre, total, tipo: "cargado" }));
}
export function lineasRubro(p) {
    const sc = p.sinCargar.filter((s) => norm(s.rubro) === norm(p.rubro) && Math.abs(s.ultimo) > 0.5)
        .map((s) => ({ nombre: s.nombre, total: s.ultimo, tipo: "sinCargar", nota: "sin cargar" }));
    const est = p.estimado > 0.5 ? [{ nombre: "Resto estimado", total: p.estimado, tipo: "estimado", nota: "promedio" }] : [];
    return [...p.cargadas, ...sc, ...est].sort((a, b) => b.total - a.total);
}
