import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminAPI } from '../../servicios/apiAdmin';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const BRAND = { tinta: '#15213E' };

export default function AdminOrganizationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [org, setOrg] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await AdminAPI.getOrganization(id);
        if (!alive) return;
        setOrg(r.organization);
        setBusinesses(r.businesses || []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (!org) return <div style={{ padding: 24 }}>Organización no encontrada.</div>;

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '16px 28px', borderBottom: '0.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex' }}>
          <ArrowBackIosNewIcon fontSize="small" style={{ color: BRAND.tinta }} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: BRAND.tinta }}>
            {org.display_name || org.name}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>ID: {org.id}</p>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: BRAND.tinta, borderBottom: '0.5px solid #e2e8f0' }}>
            Negocios ({businesses.length})
          </div>
          {businesses.length === 0 && (
            <p style={{ padding: '16px', margin: 0, fontSize: 13, color: '#94a3b8' }}>Sin negocios en esta organización.</p>
          )}
          {businesses.map((b, i) => (
            <div
              key={b.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 200px 24px',
                padding: '10px 16px', gap: 12, alignItems: 'center', cursor: 'pointer',
                borderTop: i ? '0.5px solid #f8fafc' : 'none',
              }}
              onClick={() => nav(`/admin/negocios/${b.id}`)}
            >
              <span style={{ fontSize: 13, color: BRAND.tinta, fontWeight: 600 }}>{b.name}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{b.owner_name || b.owner_email || '—'}</span>
              <ChevronRightIcon style={{ fontSize: 18, color: '#cbd5e1' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
