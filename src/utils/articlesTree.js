// src/utils/articlesTree.js
// Arma el árbol subrubro→categoría→artículos a partir de una lista plana (fallback
// cuando /articles/tree viene vacío). Extraído de TablaArticulos.jsx para poder
// reusarlo desde useArticlesTree sin depender del componente.
export function buildTreeFromFlat(items = []) {
  const flat = items.map((row) => {
    const raw = row?.raw || {};
    const id = Number(row?.id ?? raw?.id ?? raw?.articulo_id ?? raw?.codigo ?? raw?.codigoArticulo);
    return {
      id,
      nombre: String(row?.nombre ?? raw?.nombre ?? raw?.descripcion ?? `#${id}`),
      categoria: String(row?.categoria ?? raw?.categoria ?? raw?.rubro ?? "Sin categoría"),
      subrubro: String(row?.subrubro ?? raw?.subrubro ?? raw?.subRubro ?? "Sin subrubro"),
      precio: Number(row?.precio ?? raw?.precio ?? raw?.precioVenta ?? raw?.importe ?? 0),
      costo: Number(row?.costo ?? raw?.costo ?? 0),
      origen: row?.origen ?? raw?.origen ?? null,
    };
  }).filter((a) => Number.isFinite(a.id));

  const bySub = new Map();
  for (const a of flat) {
    if (!bySub.has(a.subrubro)) bySub.set(a.subrubro, new Map());
    const byCat = bySub.get(a.subrubro);
    if (!byCat.has(a.categoria)) byCat.set(a.categoria, []);
    byCat.get(a.categoria).push(a);
  }
  return Array.from(bySub, ([subrubro, byCat]) => ({
    subrubro,
    categorias: Array.from(byCat, ([categoria, articulos]) => ({ categoria, articulos })),
  }));
}
