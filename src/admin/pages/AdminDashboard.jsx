import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';
import { Card, CardContent } from '@mui/material';

const Kpi = ({ title, value }) => (
  <Card sx={{ borderRadius: 2 }}>
    <CardContent>
      <div style={{ color: '#64748b', fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </CardContent>
  </Card>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    AdminAPI.overview().then(setData).catch(console.error);
  }, []);

  if (!data) return <div>Cargando...</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Kpi title="Usuarios totales" value={data.totals.users} />
        <Kpi title="Usuarios activos" value={data.totals.active_users} />
        <Kpi title="Negocios" value={data.totals.businesses} />
      </div>

      <div>
        <h3>Usuarios recientes</h3>
        <ul>
          {data.recentUsers.map(u => (
            <li key={u.id}>
              {u.email} — {u.name || '—'} ({u.role}) · {u.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
