// src/utils/ensureActiveBusiness.js
import { BusinessesAPI } from '../servicios/apiBusinesses';

export async function ensureActiveBusiness() {
  try {
    // si ya está en localStorage, listo
    const local = localStorage.getItem('activeBusinessId');
    if (local) return Number(local);

    // preguntamos al backend
    const { activeBusinessId } = await BusinessesAPI.getActive();
    if (activeBusinessId) {
      localStorage.setItem('activeBusinessId', String(activeBusinessId));
      window.dispatchEvent(new CustomEvent('business:switched', { detail: { businessId: activeBusinessId } }));
      return activeBusinessId;
    }

    // fallback: si el usuario tiene exactamente 1 negocio, lo activamos
    const list = await BusinessesAPI.listMine();
    if (Array.isArray(list) && list.length === 1) {
      const id = Number(list[0].id);
      await BusinessesAPI.setActive(id);          // o BusinessesAPI.select(id)
      localStorage.setItem('activeBusinessId', String(id));
      window.dispatchEvent(new CustomEvent('business:switched', { detail: { businessId: id } }));
      return id;
    }

    return null; // el usuario tiene 0 o varios y hay que elegir manualmente
  } catch {
    return null;
  }
}
