// src/servicios/setActiveBusiness.js
import { BusinessesAPI } from "@/servicios/apiBusinesses";

/**
 * Cambia el negocio activo en backend + front.
 * - Llama a BusinessesAPI.setActive (POST /businesses/:id/select o similar)
 * - Actualiza localStorage.activeBusinessId con lo que devuelva el back
 * - Opcionalmente trae los datos del negocio
 * - Lanza eventos globales para que el resto de la UI reaccione
 */
export async function setActiveBusiness(
  id,
  {
    fetchBiz = true,
    broadcast = true,
  } = {}
) {
  // 1) Backend: marca activo y nos devuelve el id final
  const res = await BusinessesAPI.setActive(id);
  const finalId = Number(res?.activeBusinessId ?? id);

  // 2) Front: persistir en localStorage
  localStorage.setItem("activeBusinessId", String(finalId));

  // 3) Opcional: traer datos del negocio
  let biz = null;
  if (fetchBiz) {
    try {
      biz = await BusinessesAPI.get(finalId);
    } catch {
      // no rompemos nada si falla
    }
  }

  // 4) Eventos globales para tema / tablas / etc.
  if (broadcast) {
    try {
      window.dispatchEvent(
        new CustomEvent("business:switched", {
          detail: { bizId: finalId, biz },
        })
      );
      window.dispatchEvent(
        new CustomEvent("palette:changed", { detail: { bizId: finalId } })
      );
    } catch {
      // por si el objeto window no está disponible en algún contexto raro
    }
  }

  // Devolvemos ambos por comodidad
  return { id: finalId, biz };
}
