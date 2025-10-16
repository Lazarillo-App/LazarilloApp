// SalesSyncPanel.jsx
import { useEffect, useState } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export default function SalesSyncPanel({ businessId }) {
  const [loading, setLoading] = useState(false);
  const [maxi, setMaxi] = useState({ configured: false, email: null, codcli: null });
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await BusinessesAPI.maxiStatus(businessId);
        if (!mounted) return;
        setMaxi(s);
      } catch (e) {
        setError(e?.message || 'error_status');
      }
    })();
    return () => { mounted = false; };
  }, [businessId]);

  const run = async (mode) => {
    setError('');
    setLoading(true);
    try {
      const res = await BusinessesAPI.syncSales(businessId, { mode });
      setLastRun(res?.sales || res);
    } catch (e) {
      setError(e?.message || 'error_sync');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ventas (Maxi)</h3>
        <span className={`text-sm ${maxi.configured ? 'text-green-600' : 'text-red-600'}`}>
          {maxi.configured ? `Conectado · ${maxi.email} · ${maxi.codcli}` : 'No configurado'}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          disabled={loading || !maxi.configured}
          onClick={() => run('auto')}
        >
          {loading ? 'Sincronizando…' : 'Sincronizar hoy'}
        </button>
        <button
          className="px-3 py-2 rounded-lg border disabled:opacity-50"
          disabled={loading || !maxi.configured}
          onClick={() => run('backfill_30d')}
        >
          {loading ? 'Sincronizando…' : 'Sincronizar 30 días'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {lastRun && (
        <div className="text-sm rounded-lg bg-gray-50 p-3 leading-6">
          <div><b>Modo:</b> {lastRun.mode}</div>
          {lastRun.range && (
            <div><b>Rango:</b> {lastRun.range.from} → {lastRun.range.to}</div>
          )}
          {lastRun.counts && (
            <div>
              <b>Registros:</b> upserted {lastRun.counts.upserted} · updated {lastRun.counts.updated} · raw {lastRun.counts.raw}
            </div>
          )}
          {lastRun.touched && (
            <div>
              <b>Cubierto en base:</b> {lastRun.touched.minDay} → {lastRun.touched.maxDay}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
