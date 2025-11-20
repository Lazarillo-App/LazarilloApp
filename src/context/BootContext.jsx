/* eslint-disable no-empty */
/* eslint-disable react-refresh/only-export-components */
// src/context/BootContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { BusinessesAPI, authHeaders } from '../servicios/apiBusinesses';

const Ctx = createContext({ ready:false, activeBusinessId:'' });
export const useBoot = () => useContext(Ctx);

export function BootProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [activeBusinessId, setActiveBusinessId] = useState(localStorage.getItem('activeBusinessId') || '');

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setReady(true); return; } // irá a login

        // Si tenés /auth/me úsalo, si no, sáltalo.
        try { await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, { headers: authHeaders() }); } catch {}

        let bid = localStorage.getItem('activeBusinessId');
        if (!bid) {
          const mine = await BusinessesAPI.listMine(); // withBusinessId:false
          const first = mine?.[0]?.id;
          if (first) {
            await BusinessesAPI.select(first); // set en backend
            bid = String(first);
            localStorage.setItem('activeBusinessId', bid);
          }
        }
        setActiveBusinessId(bid || '');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return <Ctx.Provider value={{ ready, activeBusinessId }}>{children}</Ctx.Provider>;
}
