// src/servicios/setActiveBusiness.js
import { BusinessesAPI } from "@/servicios/apiBusinesses";

/**
 * Cambia el negocio activo en backend + front.
 * - Llama a BusinessesAPI.setActive (POST /businesses/:id/select o similar)
 * - Actualiza localStorage.activeBusinessId con lo que devuelva el back
 * - Opcionalmente trae los datos del negocio
 * - Lanza eventos globales para que el resto de la UI reaccione (Navbar incluido)
 */
export async function setActiveBusiness(
  id,
  {
    fetchBiz = true,
    broadcast = true,
    source = "ui", // "ui" | "navbar" | "perfil" | "boot" | etc.
  } = {}
) {
  // 1) Backend: marca activo y nos devuelve el id final
  const res = await BusinessesAPI.setActive(id);
  const finalId = Number(res?.activeBusinessId ?? id);

  // 2) Front: persistir en localStorage
  localStorage.setItem("activeBusinessId", String(finalId));

  // 3) Opcional: traer datos del negocio
  let business = null;
  if (fetchBiz) {
    try {
      business = await BusinessesAPI.get(finalId);
    } catch {
      business = null;
    }
  }

  // 4) Eventos globales (contrato único)
  if (broadcast) {
    try {
      const detail = {
        businessId: String(finalId),
        business,
        source,

        // ✅ compat legacy (para no romper listeners viejos)
        bizId: finalId,
        biz: business,
      };

      window.dispatchEvent(new CustomEvent("business:switched", { detail }));
      window.dispatchEvent(new CustomEvent("palette:changed", { detail }));
    } catch {
      // por si window no está disponible
    }
  }

  return { id: finalId, biz: business, business };
}