// src/paginas/Conciliacion.jsx
// Módulo de conciliación bancaria (14/11/2026). El módulo (ModuloConciliacion, de Diego) cruza
// las ventas del POS y las cobranzas de cuenta corriente de MaxiRest con Mercado Pago. Esta
// página lo monta para el negocio activo y le da el guardado en el servidor: lo que se sube,
// el trabajo de cada período y la memoria de pagadores. Solo dueño y admin (App.jsx).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { ConciliacionAPI, MercadoPagoAPI } from '@/servicios/apiConciliacion';
import { Link as RouterLink } from 'react-router-dom';
import ModuloConciliacion from '@/componentes/conciliacion/ModuloConciliacion';

const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function Conciliacion() {
  const { activeBusinessId, active } = useBusiness() || {};
  const bid = Number(activeBusinessId) || null;
  const [inicial, setInicial] = useState(null);   // { fuentes, pagadores } del servidor
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');         // "Guardado" / errores de guardado
  const avisoT = useRef(null);
  const pagT = useRef(null);
  const [ver, setVer] = useState(0);             // sube cuando se recargan las fuentes (rearma el módulo)
  const [mp, setMp] = useState(null);            // estado de la conexión con Mercado Pago

  const avisar = useCallback((t, ms = 2500) => {
    setAviso(t);
    clearTimeout(avisoT.current);
    if (ms) avisoT.current = setTimeout(() => setAviso(''), ms);
  }, []);

  useEffect(() => {
    if (!bid) return;
    MercadoPagoAPI.estado(bid).then(setMp).catch(() => setMp(null));
  }, [bid, ver]);

  useEffect(() => {
    if (!bid) return;
    let vivo = true;
    setInicial(null); setError('');
    ConciliacionAPI.cargar(bid)
      .then((r) => {
        if (!vivo) return;
        const f = r?.fuentes || {};
        setInicial({
          fuentes: {
            ventas: f.ventas?.filas || null,
            pagos: f.pagos?.filas || null,
            banco: f.banco?.filas || null,
            facturas_cc: f.facturas_cc?.filas || [],
          },
          pagadores: r?.pagadores || {},
        });
      })
      .catch(() => { if (vivo) setError('No pude cargar la conciliación de este negocio. Probá de nuevo en un rato.'); });
    return () => { vivo = false; clearTimeout(pagT.current); };
  }, [bid, ver]);

  const persist = useMemo(() => (bid && inicial ? {
    fuentes: inicial.fuentes,
    onFuente: (tipo, filas, archivo) => {
      avisar('Guardando el archivo…', 0);
      ConciliacionAPI.guardarFuente(bid, tipo, filas, archivo)
        .then(() => avisar('Archivo guardado'))
        .catch(() => avisar('No se pudo guardar el archivo en el servidor: si cerrás, se pierde.', 8000));
    },
    cargarEstado: (periodo) => ConciliacionAPI.leerEstado(bid, periodo).then((r) => r?.estado || null),
    guardarEstado: (periodo, estado) => {
      ConciliacionAPI.guardarEstado(bid, periodo, estado)
        .then(() => avisar('Cambios guardados', 1500))
        .catch(() => avisar('No se pudieron guardar los últimos cambios. Revisá la conexión.', 8000));
    },
  } : null), [bid, inicial, avisar]);

  // La memoria de pagadores cambia seguido (cada conciliación de cuenta corriente): se manda
  // con una pausa corta.
  const onPagadorMap = useCallback((mapa) => {
    if (!bid) return;
    clearTimeout(pagT.current);
    pagT.current = setTimeout(() => { ConciliacionAPI.guardarPagadores(bid, mapa).catch(() => {}); }, 1500);
  }, [bid]);

  if (!bid) return <div style={{ padding: 32 }}>Elegí un negocio para conciliar.</div>;
  if (error) return <div style={{ padding: 32, color: '#991b1b' }}>{error}</div>;
  if (!inicial) return <div style={{ padding: 32, color: '#64748b' }}>Cargando la conciliación…</div>;

  const business = {
    group: active?.organization_name || active?.org_name || '',
    name: active?.name || 'Negocio',
    initials: iniciales(active?.name),
    color: 'var(--color-primary, #5BC2EA)',
  };

  return (
    <div style={{ position: 'relative' }}>
      {aviso && (
        <div style={{
          position: 'fixed', left: 20, bottom: 20, zIndex: 1300, background: '#15213E', color: '#fff',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, boxShadow: '0 6px 20px rgba(0,0,0,.25)',
        }}>{aviso}</div>
      )}
      <BarraMercadoPago bid={bid} mp={mp} onTraido={() => setVer((n) => n + 1)} avisar={avisar} />
      {/* key: al cambiar de negocio (o al traer cobros nuevos) se arma de cero */}
      <ModuloConciliacion key={bid + ':' + ver} business={business} embedded persist={persist}
        pagadorMap={inicial.pagadores} onPagadorMap={onPagadorMap} />
    </div>
  );
}

// Barra de Mercado Pago arriba del módulo (14/11): con la cuenta conectada, trae los cobros del
// período y los deja como "Movimientos del banco" (reemplaza lo que había de esas fechas).
const hoyISO = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoyISO().slice(0, 8) + '01';
function BarraMercadoPago({ bid, mp, onTraido, avisar }) {
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoyISO);
  const [trayendo, setTrayendo] = useState(false);
  if (!mp) return null;
  const caja = { maxWidth: 1180, margin: '16px auto 0', padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13.5 };
  if (!mp.conectado) {
    if (!mp.configurado) return null;
    return (
      <div style={{ ...caja, background: '#5BC2EA14', border: '1px solid #5BC2EA55', color: '#15213E' }}>
        <span>💡 Conectá <b>Mercado Pago</b> y los movimientos del banco llegan solos, sin subir el extracto.</span>
        <RouterLink to="/configuracion?tab=7" style={{ marginLeft: 'auto', fontWeight: 700 }}>Conectar</RouterLink>
      </div>
    );
  }
  const traer = async () => {
    if (!desde || !hasta || desde > hasta) { avisar('Revisá las fechas', 3000); return; }
    setTrayendo(true);
    try {
      const r = await MercadoPagoAPI.sincronizar(bid, desde, hasta);
      avisar(`Listo: ${r.cobros} cobro${r.cobros === 1 ? '' : 's'} de Mercado Pago`, 4000);
      onTraido();
    } catch (e) {
      const c = String(e?.message || '').split(':')[0].trim();
      avisar(c === 'periodo_muy_largo' ? 'Elegí hasta 3 meses por vez.' : c === 'mp_vencido' ? 'Venció la conexión con Mercado Pago: volvé a conectarla en Conexiones.' : 'Mercado Pago no respondió. Probá de nuevo en un rato.', 8000);
    } finally { setTrayendo(false); }
  };
  const inp = { fontFamily: 'inherit', fontSize: 13.5, padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(21,33,62,.16)' };
  return (
    <div style={{ ...caja, background: '#fff', border: '1px solid rgba(21,33,62,.16)', color: '#15213E' }}>
      <span style={{ fontWeight: 700 }}>🏦 Mercado Pago</span>
      <span style={{ color: '#5b6577' }}>{mp.cuenta?.nickname || mp.cuenta?.email || 'conectado'}{mp.ultimo_sync_hasta ? ` · último: ${mp.ultimo_sync_desde} a ${mp.ultimo_sync_hasta}` : ''}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} />
        <span>a</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} />
        <button type="button" onClick={traer} disabled={trayendo}
          title="Trae los cobros de esas fechas y reemplaza los movimientos del banco de esos días"
          style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#5BC2EA', color: '#12111F', cursor: trayendo ? 'wait' : 'pointer' }}>
          {trayendo ? 'Trayendo…' : 'Traer cobros'}
        </button>
      </span>
    </div>
  );
}
