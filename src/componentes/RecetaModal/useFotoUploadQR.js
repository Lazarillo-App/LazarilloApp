/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal/useFotoUploadQR.js
// Hook compartido de subida de fotos por QR (celular → backend → polling).
// Usado por NotasModal (foto general de la receta) y NotasItemModal (foto por ingrediente).
// Antes generarToken/iniciarPolling vivían duplicados casi idénticos en ambos modales.
import { useState, useRef, useCallback, useEffect } from 'react';
import { BASE } from '@/servicios/apiBase';

/**
 * @param {object} opts
 * @param {number|string} opts.articuloId
 * @param {number|string} opts.businessId
 * @param {object} [opts.tokenBody] - campos extra para el POST de generación de token
 * @param {object} [opts.pollQuery] - query params extra para el polling
 * @param {(fotos: string[]) => void} opts.onFotosRecibidas - llamado con las URLs nuevas del polling
 */
export function useFotoUploadQR({ articuloId, businessId, tokenBody = {}, pollQuery = {}, onFotosRecibidas }) {
  const [uploadToken, setUploadToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [hayFotosQR, setHayFotosQR] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const pollingRef = useRef(null);

  // Ref siempre actualizada: evita que el setInterval quede con un closure viejo
  // (localFotos/fotos stale) — el callback del caller se re-lee en cada tick.
  const onFotosRef = useRef(onFotosRecibidas);
  useEffect(() => { onFotosRef.current = onFotosRecibidas; }, [onFotosRecibidas]);

  const iniciarPolling = useCallback((tok) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const jwt = localStorage.getItem('token') || '';
        const qs = new URLSearchParams({ token: tok, ...pollQuery }).toString();
        const res = await fetch(
          `${BASE}/recetas/${articuloId}/fotos-pendientes?${qs}`,
          { headers: { Authorization: `Bearer ${jwt}`, 'X-Business-Id': String(businessId) } }
        );
        const data = await res.json();
        if (data.fotos?.length > 0) onFotosRef.current?.(data.fotos);
      } catch { /* ignorar errores de red en polling */ }
    }, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articuloId, businessId, JSON.stringify(pollQuery)]);

  const generarToken = useCallback(async () => {
    if (!articuloId || !businessId) return;
    setTokenLoading(true);
    try {
      const jwt = localStorage.getItem('token') || '';
      const res = await fetch(`${BASE}/recetas/${articuloId}/upload-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'X-Business-Id': String(businessId),
        },
        body: JSON.stringify({ bizId: businessId, ...tokenBody }),
      });
      const data = await res.json();
      if (data.token) {
        const uploadUrl = data.uploadUrl || `${window.location.origin}/upload-foto?token=${data.token}`;
        setUploadToken({ ...data, uploadUrl });
        setShowQR(true);
        iniciarPolling(data.token);
      }
    } catch (err) {
      setUploadError('No se pudo generar el QR. Intentá de nuevo.');
    } finally {
      setTokenLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articuloId, businessId, JSON.stringify(tokenBody), iniciarPolling]);

  const toggleQR = useCallback(() => {
    if (!uploadToken) generarToken();
    else setShowQR(v => !v);
  }, [uploadToken, generarToken]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  return {
    uploadToken, tokenLoading, showQR, setShowQR, hayFotosQR, setHayFotosQR,
    uploadError, setUploadError, generarToken, toggleQR,
  };
}
