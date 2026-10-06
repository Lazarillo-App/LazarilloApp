// Ejecuta fn sobre items con como máximo `limite` promesas en vuelo a la vez.
// Mantiene el orden de los resultados.
export async function mapConLimite(items, fn, limite = 4) {
  const out = new Array(items.length);
  let siguiente = 0;
  const worker = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker));
  return out;
}
