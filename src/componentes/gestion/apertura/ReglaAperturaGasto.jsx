// src/componentes/gestion/apertura/ReglaAperturaGasto.jsx
// Gastos Varios: si el concepto tiene regla de apertura vigente, se muestra SIEMPRE (Diego 20/11/2026),
// aunque sus destinos sean de otro negocio de la organización (antes, con un destino de otro negocio
// la regla no se veía en la carga, pero igual se aplicaba al guardar).
// Muestra cada destino con su % y la plata que le toca; «Ver la regla» abre Conceptos de caja en otra
// pestaña y «Repartir distinto solo este gasto» (solo si el negocio tiene más de un PDV) abre el reparto
// editable de la carga sin tocar la regla.
import React from 'react';
import { useFetchQuery } from '@/gestion/compat';
import { useReglasApertura } from './use-reglas-apertura';
import { cubreFecha, hoyUTC, resumenVigencia } from '@/gestion/apertura/estado-vigencia';

const fechaDe = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : hoyUTC());
const pesos = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' %';

// Regla vigente del concepto para el PDV de origen, con los nombres de negocio y PDV de cada destino.
export function useReglaAperturaConcepto(codigo, origenPdvId, fechaISO, nombrePdv) {
  const { reglas } = useReglasApertura();
  const { data: locales } = useFetchQuery(['locales-apertura'], '/api/apertura/locales', { staleTime: 5 * 60_000 });
  if (!codigo || origenPdvId == null) return null;
  const hoy = fechaDe(fechaISO);
  const r = reglas.find((x) => x.estado === 'activa' && x.nivel === 'concepto' && String(x.entidadId) === String(codigo)
    && x.origenPuntoDeVentaId === origenPdvId
    && cubreFecha(hoy, x, x.fechaDesde ? new Date(x.fechaDesde) : null, x.fechaHasta ? new Date(x.fechaHasta) : null) !== false);
  if (!r) return null;
  const locs = Array.isArray(locales) ? locales : [];
  const destinos = (r.destinos || []).map((d) => {
    const loc = locs.find((l) => l.id === d.localId);
    const pdv = loc && (loc.puntosDeVenta || []).find((p) => p.id === d.puntoDeVentaId);
    // El PDV de este negocio con el nombre que usa la carga (la principal es «Principal» en /apertura/locales).
    const nombre = (nombrePdv && nombrePdv(d.puntoDeVentaId)) || (pdv ? pdv.nombre : '');
    return { negocio: loc ? loc.nombre : `Negocio ${d.localId}`, pdv: nombre === 'Principal' ? '' : nombre, pct: Number(d.porcentaje) || 0 };
  });
  return { regla: r, destinos };
}

export default function ReglaAperturaGasto({ codigo, origenPdvId, fecha, importe, origenNombre, nombrePdv, onRepartir }) {
  const info = useReglaAperturaConcepto(codigo, origenPdvId, fecha, nombrePdv);
  if (!info) return null;
  const imp = Number(importe) || 0;
  const vig = resumenVigencia(info.regla);
  const link = { fontSize: 12, fontWeight: 700, color: '#2a88ad', cursor: 'pointer', whiteSpace: 'nowrap', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' };
  return (
    <div data-regla-apertura style={{ gridColumn: '1 / -1', border: '1.5px solid #bfe0f0', background: '#f3fafd', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 15, color: '#2a88ad' }}>⅄</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2a6b86' }}>Este concepto tiene regla de apertura</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#2a88ad', background: '#e1f1f9', borderRadius: 5, padding: '1px 6px' }}>REGLA</span>
        <button type="button" style={{ ...link, marginLeft: 'auto' }} title="Abre Conceptos de caja en otra pestaña"
          onClick={() => window.open(`/gestion/conceptos?q=${encodeURIComponent(codigo)}`, '_blank', 'noopener')}>Ver la regla ›</button>
      </div>
      {info.destinos.map((d, k) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 56px 116px', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #dcebf3' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2d3d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.negocio}{d.pdv ? <span style={{ fontWeight: 400, color: '#7a8a9c' }}> · {d.pdv}</span> : null}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#2a88ad' }}>{pct(d.pct)}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: imp > 0 ? '#1f2d3d' : '#b0b8c4', fontVariantNumeric: 'tabular-nums' }}>
            {imp > 0 ? pesos(imp * d.pct / 100) : '—'}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <span style={{ fontSize: 11.5, color: '#999' }}>Se carga en {origenNombre || 'este PDV'} y al guardar se reparte solo. Vigencia: {vig ? vig.charAt(0).toLowerCase() + vig.slice(1) : 'siempre'}.</span>
        {onRepartir && <button type="button" style={{ ...link, marginLeft: 'auto' }} onClick={onRepartir}>Repartir distinto solo este gasto</button>}
      </div>
    </div>
  );
}
