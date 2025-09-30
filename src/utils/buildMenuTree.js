// Construye: Categoria -> Subrubro -> Artículos a partir de items planos
// items: [{ id, nombre, categoria, subrubro, precio, costo, ... }]
export function buildMenuTree(items = []) {
  const categorias = new Map(); // nombreCat -> { nombre, subrubros: Map }

  for (const it of items || []) {
    const cat = (it.categoria || 'Sin categoría').trim();
    const sub = (it.subrubro  || 'Sin subrubro').trim();

    if (!categorias.has(cat)) categorias.set(cat, { nombre: cat, subrubros: new Map() });
    const catNode = categorias.get(cat);

    if (!catNode.subrubros.has(sub)) catNode.subrubros.set(sub, { nombre: sub, articulos: [] });
    catNode.subrubros.get(sub).articulos.push(it);
  }

  // Orden alfabético básico
  return Array.from(categorias.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(c => ({
      nombre: c.nombre,
      subrubros: Array.from(c.subrubros.values())
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(sr => ({
          nombre: sr.nombre,
          articulos: [...sr.articulos].sort((x, y) => String(x.nombre).localeCompare(String(y.nombre))),
        })),
    }));
}

// Invierte: Categoria -> Subrubro -> Artículos  ⟶  Subrubro -> Categoria -> Artículos
export function flipCatSubTree(catTree = []) {
  const idFrom = (label) =>
    Math.abs([...String(label)].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0));

  const subrubros = new Map(); // subrubro -> { id, nombre, categorias: Map }

  for (const cat of catTree || []) {
    const catName = (cat?.nombre ?? 'Sin categoría').trim();
    for (const sr of (cat?.subrubros || [])) {
      const subName = (sr?.nombre ?? 'Sin subrubro').trim();

      if (!subrubros.has(subName)) {
        subrubros.set(subName, { id: idFrom(subName), nombre: subName, categorias: new Map() });
      }
      const subNode = subrubros.get(subName);

      if (!subNode.categorias.has(catName)) {
        subNode.categorias.set(catName, { id: idFrom(`${subName}|${catName}`), nombre: catName, articulos: [] });
      }
      const catNode = subNode.categorias.get(catName);

      for (const a of (sr?.articulos || [])) catNode.articulos.push(a);
    }
  }

  // Orden alfabético
  return Array.from(subrubros.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(s => ({
      id: s.id,
      nombre: s.nombre,              // ⬅️ primer nivel: Subrubro
      categorias: Array.from(s.categorias.values())
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(cat => ({
          id: cat.id,
          nombre: cat.nombre,        // ⬅️ segundo nivel: Categoría
          articulos: [...cat.articulos].sort((x, y) => String(x.nombre).localeCompare(String(y.nombre))),
        })),
    }));
}
