// src/pages/Dashboard.jsx
import { useState } from 'react';
import { useVentasSummary } from '../hooks/useVentasSummary';
import { useActiveBusiness } from '../context/ActiveBusinessProvider';

export default function Dashboard(){
  // rango por defecto 14 días
  const today = new Date();
  const toISO = (d) => d.toISOString().slice(0,10);
  const [to, setTo] = useState(toISO(today));
  const [from, setFrom] = useState(toISO(new Date(today.getTime() - 13*86400000)));

  const { loading: bizLoading, businessId } = useActiveBusiness();
  const ventas = useVentasSummary({ from, to, limit: 1000 });

  if (bizLoading || ventas.isLoading) return <div>Cargando…</div>;
  if (ventas.error) return <div>Error: {String(ventas.error)}</div>;

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-3">
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <span>Negocio activo: {businessId ?? '—'}</span>
      </div>
      <pre className="bg-gray-100 p-3 rounded">{JSON.stringify(ventas.data, null, 2)}</pre>
    </div>
  );
}
