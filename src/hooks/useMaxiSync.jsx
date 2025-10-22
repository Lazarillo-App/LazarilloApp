// src/hooks/useMaxiSync.js
import { useEffect, useState, useCallback } from 'react';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export default function useMaxiSync(businessId) {
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
        setMaxi(s || { configured: false });
      } catch (e) {
        if (!mounted) return;
        setMaxi({ configured: false });
        setError(e?.message || 'error_status');
      }
    })();
    return () => { mounted = false; };
  }, [businessId]);

  const run = useCallback(async (mode = 'auto') => {
    setError('');
    setLoading(true);
    try {
      const res = await BusinessesAPI.syncSales(businessId, { mode });
      const payload = res?.sales || res;
      setLastRun(payload || null);
      // mismo evento que ya usa tu app
      window.dispatchEvent(new CustomEvent('business:synced'));
      return payload;
    } catch (e) {
      setError(e?.message || 'error_sync');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  return { loading, maxi, lastRun, error, run, setError };
}
