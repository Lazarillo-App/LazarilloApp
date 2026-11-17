// src/componentes/gestion/usePosConectado.js
// ¿El negocio ya tiene su POS conectado? (usuaria 17/11/2026: el panel vacío no tiene que ofrecer
// «Conectar mi punto de venta» si ya está conectado). Devuelve el nombre del POS conectado o null.
//  - POS por API (Fudo): la conexión dice «conectado».
//  - MaxiRest: hay una PC con el kit vinculada (o el negocio tiene la API de MaxiRest configurada).
import { useEffect, useState } from 'react';
import { api } from '@/servicios/apiBase';
import { FudoAPI } from '@/servicios/apiFudo';
import { conectaPorApi, tieneActualizador } from '@/componentes/asistente/posLista';

export default function usePosConectado(businessId, props) {
  const pos = props?.onboarding?.pos || '';
  const conApiMaxi = !!props?.maxi?.email;
  const [conectado, setConectado] = useState(null);

  useEffect(() => {
    let vivo = true;
    setConectado(null);
    if (!businessId) return undefined;
    (async () => {
      try {
        if (conectaPorApi(pos)) {
          const r = await FudoAPI.estado(businessId);
          if (vivo && r?.conectado) setConectado(pos);
        } else if (conApiMaxi) {
          if (vivo) setConectado('MaxiRest');
        } else if (tieneActualizador(pos)) {
          const r = await api(`/businesses/${businessId}/kit/pcs`, { timeout: 30000 });
          if (vivo && (r?.pcs || []).some((p) => !p.revocado_en)) setConectado('MaxiRest');
        }
      } catch { /* sin dato: se muestra el cartel de siempre */ }
    })();
    return () => { vivo = false; };
  }, [businessId, pos, conApiMaxi]);

  return conectado;
}
