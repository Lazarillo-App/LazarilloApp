const BASE_URL = import.meta.env.VITE_BACKEND_URL; // Asegurate de tener esta variable en tu .env

// Obtener todas las agrupaciones
export const obtenerAgrupaciones = async () => {
  const res = await fetch(`${BASE_URL}/agrupaciones`);
  if (!res.ok) throw new Error('Error al obtener agrupaciones');
  return await res.json();
};

// Crear una nueva agrupación
export const crearAgrupacion = async ({ nombre, articulos }) => {
  const res = await fetch(`${BASE_URL}/agrupaciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nombre, articulos })
  });

  if (!res.ok) throw new Error('Error al crear agrupación');
  return await res.json();
};

// Eliminar una agrupación
export const eliminarAgrupacion = async (id) => {
  const res = await fetch(`${BASE_URL}/agrupaciones/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Error al eliminar agrupación');
};