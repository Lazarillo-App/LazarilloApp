// src/utils/ensureActiveBusiness.js
/* eslint-disable no-empty */
import { BusinessesAPI } from "@/servicios/apiBusinesses";

/**
 * Devuelve el id de negocio activo, sincronizando:
 * 1) Pregunta primero al backend (getActive)
 * 2) Si no hay nada, mira listMine() y elige el primero
 * 3) Actualiza localStorage y dispara business:switched
 */
export async function ensureActiveBusiness() {
  // 1) Intentar leer del backend
  try {
    const act = await BusinessesAPI.getActive(); // { activeBusinessId: 60 } ó similar
    const backendId =
      act?.activeBusinessId ??
      act?.id ??
      act?.businessId ??
      null;

    if (backendId) {
      const bid = String(backendId);
      localStorage.setItem("activeBusinessId", bid);

      try {
        window.dispatchEvent(
          new CustomEvent("business:switched", {
            detail: { bizId: Number(bid) }
          })
        );
      } catch {
        window.dispatchEvent(new Event("business:switched"));
      }
      return Number(backendId);
    }
  } catch (e) {
    console.warn(
      "[ensureActiveBusiness] getActive falló, intento fallback:",
      e?.message || e
    );
  }

  // 2) Fallback: si backend no dice nada, miramos localStorage
  const lsId = localStorage.getItem("activeBusinessId");
  if (lsId) {
    console.log(
      "[ensureActiveBusiness] usando id desde localStorage (fallback):",
      lsId
    );
    return Number(lsId);
  }

  // 3) Fallback final: primer negocio de la lista
  const resp = await BusinessesAPI.listMine();
  const list = Array.isArray(resp) ? resp : resp?.items || [];
  const first = list[0];

  if (!first?.id) {
    throw new Error("Sin negocios disponibles");
  }

  const bid = String(first.id);
  localStorage.setItem("activeBusinessId", bid);

  try {
    await BusinessesAPI.setActive(first.id);
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent("business:switched", {
        detail: { bizId: Number(bid) }
      })
    );
  } catch {
    window.dispatchEvent(new Event("business:switched"));
  }

  console.log(
    "[ensureActiveBusiness] usando primer negocio como activo:",
    first.id
  );
  return Number(first.id);
}
