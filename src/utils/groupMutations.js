// src/utils/groupMutations.js

// Set de ids numéricos
const toIdSet = (ids) => new Set((ids || []).map(Number).filter(Number.isFinite));

// Enriquecedor robusto
const enrichList = (items = [], baseById) => {
  return (items || []).map((it) => {
    const id = Number(it?.id ?? it); // admite {id} o id suelto
    if (!Number.isFinite(id)) return null;
    const base = baseById?.get?.(id) || {};
    return {
      id,
      nombre: it?.nombre ?? base?.nombre ?? `#${id}`,
      categoria: it?.categoria ?? base?.categoria ?? 'Sin categoría',
      subrubro: it?.subrubro ?? base?.subrubro ?? 'Sin subrubro',
      precio: Number(it?.precio ?? base?.precio ?? 0),
    };
  }).filter(Boolean);
};

export function applyCreateGroup(agrupaciones, { id, nombre, articulos = [], baseById }) {
  const newArts = enrichList(articulos, baseById);
  const newG = { id: Number(id), nombre, articulos: newArts };
  const exists = agrupaciones.some(g => Number(g?.id) === Number(id));
  return exists
    ? agrupaciones.map(g => (Number(g.id) === Number(id) ? newG : g))
    : [...agrupaciones, newG];
}

export function applyAppend(agrupaciones, { groupId, articulos = [], baseById }) {
  const add = enrichList(articulos, baseById);
  if (!add.length) return agrupaciones;

  return agrupaciones.map(g => {
    if (Number(g.id) !== Number(groupId)) return g;

    const curr = Array.isArray(g.articulos) ? g.articulos : [];
    const seen = new Set(curr.map(a => Number(a.id)));

    // mantené lo existente (más “completo”) y agregá sólo los que falten
    const merged = [...curr];
    for (const a of add) {
      const id = Number(a.id);
      if (!seen.has(id)) { seen.add(id); merged.push(a); }
    }
    return { ...g, articulos: merged };
  });
}

export function applyRemove(agrupaciones, { groupId, ids }) {
  const rm = toIdSet(ids);
  return agrupaciones.map(g => {
    if (Number(g.id) !== Number(groupId)) return g;
    const curr = Array.isArray(g.articulos) ? g.articulos : [];
    return { ...g, articulos: curr.filter(a => !rm.has(Number(a.id))) };
  });
}

export function applyMove(agrupaciones, { fromId, toId, ids, baseById }) {
  // 1) quitá del origen
  let next = applyRemove(agrupaciones, { groupId: fromId, ids });

  // 2) agregá al destino (enriqueciendo en append)
  const toAdd = (ids || []).map(id => ({ id: Number(id) }));
  next = applyAppend(next, { groupId: toId, articulos: toAdd, baseById });

  return next;
}
