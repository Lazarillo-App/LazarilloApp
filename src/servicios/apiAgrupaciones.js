const RAW = import.meta?.env?.VITE_BACKEND_URL;
const BASE_URL = (RAW && RAW !== 'undefined' ? RAW : '/api').replace(/\/$/, '');

export const obtenerAgrupaciones = async () => {
  const res = await fetch(`${BASE_URL}/agrupaciones`);
  if (!res.ok) throw new Error('Error al obtener agrupaciones');
  return await res.json();
};

export const crearAgrupacion = async ({ nombre, articulos }) => {
  const res = await fetch(`${BASE_URL}/agrupaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, articulos })
  });
  if (!res.ok) throw new Error('Error al crear agrupación');
  return await res.json();
};
