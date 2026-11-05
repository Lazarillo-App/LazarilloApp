// Traído de lazarillo_gestion/lib/apertura/mover.ts (misma lógica).
// "Mover a otro PDV" (Diego, 24/10/2026): un gasto entero pasa a otro punto de
// venta. Por dentro es la apertura de siempre a nivel registro, 100% a un solo
// destino, así que se deshace igual que cualquier apertura (⅄ → eliminar regla).
// Sobre qué filas actúa el ícono de una fila: si esa fila está tildada, sobre
// todas las tildadas; si no, solo sobre ella. Una compra distribuida aparece
// N veces con el mismo rowId: se mueve una sola vez.
export function objetivosMover(fila, tildadas, visibles) {
    const base = tildadas.has(fila.rowId) ? visibles.filter((r) => tildadas.has(r.rowId)) : [fila];
    const vistos = new Set();
    return base.filter((r) => (vistos.has(r.rowId) ? false : (vistos.add(r.rowId), true)));
}
// Opciones del popover: todos los PDV; el de origen queda deshabilitado
// cuando TODAS las filas a mover ya están ahí.
export function destinosMover(locales, filas) {
    const origenes = new Set(filas.map((f) => f.puntoDeVentaIdOrigen));
    return locales.flatMap((l) => l.puntosDeVenta.map((p) => ({
        localId: l.id,
        puntoDeVentaId: p.id,
        etiqueta: `${l.nombre} · ${p.nombre}`,
        deshabilitado: origenes.size === 1 && origenes.has(p.id),
    })));
}
// Cuerpo de POST /api/apertura/reglas para mover una fila.
export function cuerpoMover(fila, destino) {
    return {
        nivel: "registro",
        entidadId: fila.rowId,
        origenLocalId: fila.localIdOrigen,
        origenPuntoDeVentaId: fila.puntoDeVentaIdOrigen,
        modo: "historico",
        fechaDesde: null,
        fechaHasta: null,
        extremosInclusivos: true,
        confirmarHistorico: true,
        destinos: [{ localId: destino.localId, puntoDeVentaId: destino.puntoDeVentaId, porcentaje: 100 }],
    };
}
// Las que ya están en ese PDV no se mandan (no hay nada que mover).
export function filasAMover(filas, destino) {
    return filas.filter((f) => f.puntoDeVentaIdOrigen !== destino.puntoDeVentaId);
}
