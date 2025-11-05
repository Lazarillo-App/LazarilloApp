// src/servicios/setActiveBusiness.js
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export async function setActiveBusiness(id, {
  fetchBiz = true,
  broadcast = true
} = {}) {
  // 1) backend: marca activo
  await BusinessesAPI.setActive(id);

  // 2) client: persistir y opcionalmente traer datos del biz
  localStorage.setItem("activeBusinessId", String(id));
  let biz = null;
  if (fetchBiz) {
    try { biz = await BusinessesAPI.get(id); } catch { /* no-op */ }
  }

  // 3) evento global para que toda la UI reaccione (Tema, tablas, etc.)
  if (broadcast) {
    window.dispatchEvent(new CustomEvent("business:switched", { detail: { bizId: id, biz } }));
    window.dispatchEvent(new CustomEvent("palette:changed", { detail: { bizId: id } }));
  }

  return biz;
}
