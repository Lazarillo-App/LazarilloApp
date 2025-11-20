// src/componentes/SincronizarVentas.jsx
import React, { useState } from 'react';
import { syncUltimos7Dias } from '@/servicios/syncVentasService';
import { getActiveBusinessId } from '@/servicios/apiBusinesses';

export default function SincronizarVentas({ businessId: propBizId, onNotify }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const bizId = Number(propBizId ?? getActiveBusinessId());

  const notify = (payload) => {
    // si te pasan onNotify (toast/snackbar), úsalo; sino, log
    if (typeof onNotify === 'function') onNotify(payload);
    else console.log(`[${payload.type}]`, payload.msg);
  };

  const handleSync = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await syncUltimos7Dias({ businessId: bizId, notify });
      const s = res?.sales || {};
      setStatus({
        ok: true,
        from: s.from,
        to: s.to,
        upserted: s.upserted ?? 0,
        updated: s.updated ?? 0,
      });
    } catch (e) {
      setStatus({ ok: false, error: e.message || 'sync_failed' });
    } finally {
      setLoading(false);
    }
  };

  if (!Number.isFinite(bizId)) {
    return <div className="text-sm text-red-600">No hay negocio activo.</div>;
  }

  return (
    <div className="p-3 rounded border flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-3 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {loading ? 'Sincronizando…' : 'Sincronizar últimos 7 días'}
      </button>

      {status?.ok && (
        <span className="text-green-700 text-sm">
          OK · {status.from} → {status.to} · upserted: {status.upserted} · updated: {status.updated}
        </span>
      )}
      {status && !status.ok && (
        <span className="text-red-600 text-sm">Error: {status.error}</span>
      )}
    </div>
  );
}
