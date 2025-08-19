const RAW = import.meta?.env?.VITE_BACKEND_URL;
const BASE_URL = (RAW && RAW !== 'undefined' ? RAW : '/api').replace(/\/$/, '');

// --- Insumos (backend: /api/insumos)
export const insumosList = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/insumos${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Error al listar insumos");
  return await res.json(); // { ok, data, pagination }
};

export const insumoCreate = async (payload) => {
  const res = await fetch(`${BASE_URL}/insumos`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error al crear insumo");
  return await res.json();
};

export const insumoUpdate = async (id, payload) => {
  const res = await fetch(`${BASE_URL}/insumos/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error al actualizar insumo");
  return await res.json();
};

export const insumoDelete = async (id) => {
  const res = await fetch(`${BASE_URL}/insumos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar insumo");
  return await res.json();
};

// --- Bulk
export const insumosBulkJSON = async (items) => {
  const res = await fetch(`${BASE_URL}/insumos/bulk`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error("Error en bulk JSON");
  return await res.json();
};

export const insumosBulkCSV = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE_URL}/insumos/bulk-csv`, {
    method: "POST", body: fd,
  });
  if (!res.ok) throw new Error("Error en bulk CSV");
  return await res.json();
};

export const insumosCleanup = async () => {
  const res = await fetch(`${BASE_URL}/insumos/admin/cleanup-null`, { method: "POST" });
  if (!res.ok) throw new Error("Error en cleanup");
  return await res.json();
};
