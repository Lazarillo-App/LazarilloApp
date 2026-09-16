import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../../servicios/apiAdmin';
import { showAlert } from '../../servicios/appAlert';
import { showConfirm } from '../../servicios/appConfirm';
import { TextField, Button } from '@mui/material';

const BRAND = { tinta: '#15213E' };

export default function AdminMantenimiento() {
  const [state, setState] = useState({ enabled: false, message: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await AdminAPI.getMaintenance();
      setState({ enabled: !!r.enabled, message: r.message || '' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async () => {
    const turningOn = !state.enabled;
    const ok = await showConfirm(
      turningOn
        ? 'Esto pausa la app entera para todos los usuarios (menos vos). ¿Continuar?'
        : 'Esto reactiva la app para todos los usuarios. ¿Continuar?',
      { danger: turningOn }
    );
    if (!ok) return;
    setSaving(true);
    try {
      await AdminAPI.setMaintenance(turningOn, state.message);
      await load();
      showAlert(turningOn ? 'App pausada.' : 'App reactivada.', 'success');
    } catch {
      showAlert('No se pudo cambiar el estado.', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <div style={{ background: '#fff', padding: '20px 28px', borderBottom: '0.5px solid #e2e8f0' }}>
        <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: BRAND.tinta }}>
          Mantenimiento de la app
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
          Pausa la app entera para todos los usuarios, menos vos.
        </p>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: 480 }}>
        <div style={{
          background: '#fff', borderRadius: 10, border: '0.5px solid #e2e8f0', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: BRAND.tinta, fontSize: 14 }}>
                Estado actual
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, marginTop: 4,
                color: state.enabled ? '#b91c1c' : '#16a34a',
              }}>
                {state.enabled ? 'Pausada' : 'Activa'}
              </div>
            </div>
            <Button
              variant="contained"
              color={state.enabled ? 'primary' : 'error'}
              disabled={saving}
              onClick={handleToggle}
            >
              {state.enabled ? 'Reactivar app' : 'Pausar app'}
            </Button>
          </div>

          <TextField
            label="Mensaje para los usuarios (opcional)"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={state.message}
            onChange={e => setState(s => ({ ...s, message: e.target.value }))}
            onBlur={() => AdminAPI.setMaintenance(state.enabled, state.message).catch(() => {})}
          />
        </div>
      </div>
    </div>
  );
}
