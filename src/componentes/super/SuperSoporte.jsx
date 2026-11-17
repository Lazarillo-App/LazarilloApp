// src/componentes/super/SuperSoporte.jsx
// Soporte de cuentas (tablero #103, 17/11/2026). Con el soporte activo, los super usuarios entran a
// los negocios de la cuenta como dueños sin sumarse al equipo del cliente. Acá se ve qué cuentas lo
// tienen y se suelta o se vuelve a activar. Al soltar, la cuenta deja de aparecer en el selector de
// los super usuarios y el cliente recibe el aviso en la campanita. Mismo interruptor y chips que
// Funciones por negocio (tema de Diego).
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogActions, useMediaQuery } from '@mui/material';
import { SuperAPI } from '@/servicios/apiSoporte';
import { showAlert } from '@/servicios/appAlert';
import { T, FT, FB, cargarFuentes } from '@/componentes/ui/temaDiego';

function Interruptor({ prendido, onCambio, deshabilitado, titulo }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} title={titulo} disabled={deshabilitado}
      onClick={() => !deshabilitado && onCambio(!prendido)}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', padding: 0, flexShrink: 0, position: 'relative',
        cursor: deshabilitado ? 'default' : 'pointer', opacity: deshabilitado ? 0.45 : 1,
        background: prendido ? T.accent : T.border2, transition: 'background .15s',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: prendido ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px #15213E33', transition: 'left .15s',
      }} />
    </button>
  );
}

const Chip = ({ children, color }) => (
  <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color, background: `${color}1a`, borderRadius: 7, padding: '2px 7px', whiteSpace: 'nowrap' }}>{children}</span>
);

const boton = (principal, peligro) => ({
  height: 44, padding: '0 16px', borderRadius: 10, cursor: 'pointer', fontFamily: FB, fontWeight: 700, fontSize: 13.5,
  border: principal ? 'none' : `1px solid ${T.border2}`, color: principal ? '#fff' : T.text,
  background: principal ? (peligro ? T.bad : T.accentTxt) : '#fff',
});

export default function SuperSoporte() {
  const movil = useMediaQuery('(max-width:760px)');
  const [cuentas, setCuentas] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [confirmar, setConfirmar] = useState(null); // cuenta a soltar
  const [guardando, setGuardando] = useState(null);

  useEffect(() => { cargarFuentes(); }, []);
  useEffect(() => {
    SuperAPI.soporteCuentas().then((r) => setCuentas(r?.cuentas || [])).catch(() => setCuentas([]));
  }, []);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (cuentas || []).filter((c) => !q || `${c.name} ${c.duenio || ''} ${(c.negocios || []).map((n) => n.name).join(' ')}`.toLowerCase().includes(q));
  }, [cuentas, buscar]);
  const activas = (cuentas || []).filter((c) => c.soporte_activo).length;

  const cambiar = async (cuenta, activo) => {
    setConfirmar(null);
    setGuardando(cuenta.id);
    // Se ve al instante; si falla, vuelve.
    setCuentas((cs) => cs.map((c) => (c.id === cuenta.id ? { ...c, soporte_activo: activo } : c)));
    try {
      await SuperAPI.cambiarSoporte(cuenta.id, activo);
      showAlert(activo ? `Soporte activado en ${cuenta.name}.` : `Soltaste ${cuenta.name}: ya no la ven los super usuarios.`, 'success');
    } catch (e) {
      setCuentas((cs) => cs.map((c) => (c.id === cuenta.id ? { ...c, soporte_activo: !activo } : c)));
      showAlert(`No se pudo guardar: ${e?.message || 'error'}`, 'error');
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div style={{ fontFamily: FB, color: T.text }}>
      <div style={{ fontSize: 13.5, color: T.text2, marginBottom: 12, lineHeight: 1.5 }}>
        Con el soporte activo, los super usuarios entran a los negocios de la cuenta como dueños, sin sumarse a su equipo.
        Al soltarla dejan de verla y el cliente recibe un aviso. Las cuentas nuevas nacen con soporte activo.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cuenta, negocio o dueño…"
          style={{ height: 40, flex: movil ? '1 1 100%' : '0 1 340px', boxSizing: 'border-box', padding: '0 12px', borderRadius: 10,
            border: `1px solid ${T.border2}`, fontFamily: FB, fontSize: 13.5, color: T.text, background: '#fff' }} />
        {cuentas && <span style={{ fontSize: 12.5, color: T.text3 }}>{activas} de {cuentas.length} con soporte activo</span>}
      </div>

      {!cuentas && <div style={{ color: T.text3, fontSize: 13.5 }}>Cargando…</div>}
      {cuentas && !visibles.length && <div style={{ color: T.text3, fontSize: 13.5, padding: 16, textAlign: 'center' }}>No hay cuentas que coincidan.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibles.map((c) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: movil ? 'flex-start' : 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
            background: '#fff', border: `1px solid ${T.border}`, flexDirection: movil ? 'column' : 'row',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: FT, fontWeight: 700, fontSize: 14.5 }}>{c.name || 'Sin nombre'}</span>
                {c.soporte_activo ? <Chip color={T.ok}>Soporte activo</Chip> : <Chip color={T.text3}>Sin soporte</Chip>}
              </div>
              <div style={{ fontSize: 12.5, color: T.text2, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: movil ? 'normal' : 'nowrap' }}>
                {(c.negocios || []).map((n) => n.name).join(' · ')}{c.duenio ? ` — dueño: ${c.duenio}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: movil ? 'flex-end' : 'center', minHeight: 44 }}>
              <span style={{ fontSize: 12.5, color: T.text2 }}>{c.soporte_activo ? 'Activo' : 'Soltada'}</span>
              <Interruptor prendido={!!c.soporte_activo} deshabilitado={guardando === c.id}
                titulo={c.soporte_activo ? 'Soltar la cuenta' : 'Volver a activar el soporte'}
                onCambio={(v) => (v ? cambiar(c, true) : setConfirmar(c))} />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!confirmar} onClose={() => setConfirmar(null)} fullScreen={movil} maxWidth="xs" fullWidth>
        <DialogContent sx={{ fontFamily: FB, color: T.text, pt: 3 }}>
          <div style={{ fontFamily: FT, fontWeight: 700, fontSize: 17, marginBottom: 8 }}>¿Soltar {confirmar?.name}?</div>
          <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.5 }}>
            Los super usuarios dejan de ver sus negocios y el cliente recibe un aviso en la campanita.
            Se puede volver a activar cuando haga falta.
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1, ...(movil ? { position: 'sticky', bottom: 0, background: '#fff' } : {}) }}>
          <button type="button" style={boton(false)} onClick={() => setConfirmar(null)}>Cancelar</button>
          <button type="button" style={boton(true, true)} onClick={() => cambiar(confirmar, false)}>Soltar cuenta</button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
