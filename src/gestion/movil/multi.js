// Traído de lazarillo_gestion/lib/movil/multi.ts (misma lógica).
const sumarRubros = (listas) => {
    const m = new Map();
    for (const l of listas)
        for (const r of l) {
            const k = r.rubro.trim().toLowerCase();
            const x = m.get(k);
            if (x)
                x.total += r.total;
            else
                m.set(k, { rubro: r.rubro.trim(), total: r.total });
        }
    return [...m.values()].filter((r) => Math.abs(r.total) > 0.5).sort((a, b) => b.total - a.total);
};
export function sumarResumen(lista) {
    if (lista.length === 1)
        return lista[0];
    const ventas = lista.reduce((s, r) => s + r.ventas, 0);
    const rubros = sumarRubros(lista.map((r) => r.rubros));
    const gastos = rubros.reduce((s, r) => s + r.total, 0);
    return { ...lista[0], ventas, gastos, resultado: ventas - gastos, rubros };
}
export function sumarAnual(lista) {
    if (lista.length === 1)
        return lista[0];
    const meses = Array.from({ length: 12 }, (_, i) => {
        const del = lista.map((a) => a.meses.find((m) => m.mes === i + 1)).filter((m) => !!m);
        const rubros = sumarRubros(del.map((m) => m.rubros));
        return { ...(del[0] ?? {}), mes: i + 1, ventas: del.reduce((s, m) => s + m.ventas, 0), gastos: rubros.reduce((s, r) => s + r.total, 0), rubros };
    });
    return { ...lista[0], meses };
}
/** Proyección de varios PDV: se suman lo facturado y lo proyectado. Si alguno no proyecta (mes ya cerrado), no hay proyección. */
export function sumarProyeccion(lista) {
    if (lista.length === 1)
        return lista[0];
    if (!lista.length || lista.some((p) => !p))
        return null;
    const ps = lista;
    if (ps.some((p) => p.anio !== ps[0].anio || p.mes !== ps[0].mes))
        return null;
    const s = (f) => ps.reduce((a, p) => a + f(p), 0);
    return {
        ...ps[0],
        facturado: s((p) => p.facturado), estimadoRestante: s((p) => p.estimadoRestante), proyeccion: s((p) => p.proyeccion),
        diasRestantes: Math.max(...ps.map((p) => p.diasRestantes)),
        // El error del método es de cada PDV: sumado no se puede decir.
        backtest: null, rango: null,
    };
}
/** Sin carga de varios PDV: por mes, todos los gastos esperados. */
export function unirSinCarga(lista) {
    if (lista.length === 1)
        return lista[0];
    const m = new Map();
    for (const r of lista)
        for (const x of r.meses) {
            const prev = m.get(x.mes);
            m.set(x.mes, { mes: x.mes, items: [...(prev?.items ?? []), ...x.items] });
        }
    return { ...lista[0], meses: [...m.values()].sort((a, b) => b.mes.localeCompare(a.mes)) };
}
/** Etiqueta del selector: "Ramos Mejía · Bar + Canchas", "Todo Ramos Mejía", "3 PDV". */
export function etiquetaSeleccion(locales, ids) {
    if (!ids.length)
        return "Elegí un PDV";
    const total = locales.reduce((s, l) => s + l.puntosDeVenta.length, 0);
    if (ids.length === total && total > 1)
        return "Todos los PDV";
    const porLocal = locales.map((l) => ({ l, ps: l.puntosDeVenta.filter((p) => ids.includes(p.id)) })).filter((x) => x.ps.length);
    if (porLocal.length === 1) {
        const { l, ps } = porLocal[0];
        if (ps.length === l.puntosDeVenta.length && ps.length > 1)
            return `Todo ${l.nombre}`;
        return `${l.nombre} · ${ps.map((p) => p.nombre).join(" + ")}`;
    }
    return `${ids.length} PDV`;
}
