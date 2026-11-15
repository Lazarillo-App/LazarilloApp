// Filtros por columna estilo Excel (los usa MenuColumna.jsx y las tablas que lo usan).

/** ¿La fila pasa el filtro de la columna? valor(fila) da lo que se compara; texto(fila) lo que se busca. */
export function pasaFiltro(valor, texto, f) {
  if (!f) return true;
  if (f.texto != null && f.texto !== '') return String(texto ?? valor ?? '').toLowerCase().includes(f.texto.toLowerCase());
  if (f.valores) return f.valores.includes(String(valor ?? ''));
  if (f.min !== '' && f.min != null && !(Number(valor) >= Number(f.min))) return false;
  if (f.max !== '' && f.max != null && !(Number(valor) <= Number(f.max))) return false;
  if (f.desde && !(String(valor || '') >= f.desde)) return false;
  if (f.hasta && !(String(valor || '') <= f.hasta)) return false;
  return true;
}

export const filtroActivo = (f) => !!f && ((f.texto != null && f.texto !== '') || !!f.valores || (f.min !== '' && f.min != null)
  || (f.max !== '' && f.max != null) || !!f.desde || !!f.hasta);
