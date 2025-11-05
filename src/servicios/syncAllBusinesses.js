/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import { BusinessesAPI } from "@/servicios/apiBusinesses";

/**
 * Sincroniza todos los negocios del usuario.
 * - scope: 'articles' por defecto
 * - alsoSalesDays: si >0, además dispara sync de ventas del rango (hasta ayer)
 * - concurrency: # de syncs en paralelo
 * Emite eventos para UI: business:auto-sync-start / business:auto-sync-done
 */
export async function syncAllBusinesses({
  scope = "articles",
  alsoSalesDays = 0,
  concurrency = 2
} = {}) {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  if (user?.role === "app_admin") return; // nada que sincronizar en admin

  let list = [];
  try {
    list = await BusinessesAPI.listMine();
  } catch { list = []; }
  if (!Array.isArray(list) || list.length === 0) return;

  const prevActive = localStorage.getItem("activeBusinessId") || null;

  // Emite inicio global
  try { window.dispatchEvent(new CustomEvent("business:auto-sync-start", { detail: { total: list.length } })); } catch {}

  // Particiona por lotes para limitar concurrencia
  const chunks = [];
  for (let i = 0; i < list.length; i += concurrency) chunks.push(list.slice(i, i + concurrency));

  const results = [];
  for (const chunk of chunks) {
    const tasks = chunk.map(async (biz) => {
      const id = biz?.id;
      if (!id) return { id, ok: false, error: "invalid_id" };

      // Importante: asegurar encabezado X-Business-Id correcto para cada llamado
      const prev = localStorage.getItem("activeBusinessId");
      localStorage.setItem("activeBusinessId", String(id));
      try {
        // 1) artículos / catálogo
        const r1 = await BusinessesAPI.syncNow(id, { scope });

        // 2) opcional ventas últimos N días (hasta ayer)
        let r2 = null;
        if (alsoSalesDays > 0) {
          const to = new Date(); // hoy
          to.setDate(to.getDate() - 1); // ayer
          const from = new Date(to);
          from.setDate(from.getDate() - (alsoSalesDays - 1));
          const fmt = (d) => d.toISOString().slice(0, 10);
          r2 = await BusinessesAPI.syncSales(id, {
            mode: "auto",
            from: fmt(from),
            to: fmt(to),
          });
        }

        // Notifica por-local
        try { window.dispatchEvent(new CustomEvent("business:synced", { detail: { bizId: id } })); } catch {}

        return { id, ok: true, r1, r2 };
      } catch (e) {
        const msg = String(e?.message || "");
        // Mensaje amistoso típico de credencial caída en Maxi
        const friendly = msg.includes("401") || msg.includes("UNAUTHORIZED")
          ? "MAXI_401"
          : msg || "SYNC_ERROR";
        return { id, ok: false, error: friendly };
      } finally {
        // Restaurar activo previo del bucle
        if (prev) localStorage.setItem("activeBusinessId", prev);
        else localStorage.removeItem("activeBusinessId");
      }
    });

    // Ejecuta lote
    const settled = await Promise.allSettled(tasks);
    for (const it of settled) {
      results.push(it.status === "fulfilled" ? it.value : { ok: false, error: "promise_rejected" });
    }
  }

  // Emite fin global (con resumen)
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  try {
    window.dispatchEvent(new CustomEvent("business:auto-sync-done", {
      detail: { total: results.length, ok, fail, results }
    }));
  } catch {}

  return { total: results.length, ok, fail, results };
}
