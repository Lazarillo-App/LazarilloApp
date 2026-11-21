// src/componentes/produccion/Sugerencias.jsx — cuánto producir según las ventas (usuaria 21/11/2026).
// Por elaborado: lo que se usó por semana en las últimas 4 (ventas de los platos que lo llevan ×
// lo que lleva cada uno), las tandas que eso significa, cómo se reparte por día, lo ya programado
// esta semana y lo que falta, con un botón para programarlo.
import React, { useMemo, useState } from 'react';
import { T, FT, FB } from '@/componentes/ui/temaDiego';
import { Boton, Entrada, Texto, Vacio, Pastilla } from './ui';
import { fmtCant, fmtTandas, DIAS_CORTOS } from './util';

export default function Sugerencias({ datos, onProgramar, cel }) {
  const [q, setQ] = useState('');
  const [soloFaltan, setSoloFaltan] = useState(true);
  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (datos?.items || []).filter((x) => (!soloFaltan || x.faltan > 0 || x.sin_conversion) && (!s || `${x.nombre} ${x.rubro || ''}`.toLowerCase().includes(s)));
  }, [datos, q, soloFaltan]);
  if (!datos) return <Texto sutil>Calculando según las ventas…</Texto>;
  if (!datos.items.length) {
    return <Vacio emoji="📈" titulo="Sin datos para sugerir">No hay ventas en las últimas {datos.semanas || 4} semanas de platos que lleven elaborados con receta.</Vacio>;
  }
  const faltan = datos.items.filter((x) => x.faltan > 0).length;
  return (
    <div>
      <Texto sutil style={{ marginBottom: 10 }}>
        Según lo que se vendió del {datos.desde.slice(8, 10)}/{datos.desde.slice(5, 7)} al {datos.hasta.slice(8, 10)}/{datos.hasta.slice(5, 7)} (promedio
        por semana): cada plato vendido × lo que lleva de cada elaborado. «Faltan» compara con lo ya programado esta semana. Las ventas son del negocio entero.
      </Texto>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Entrada value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar elaborado…" style={{ maxWidth: 280 }} />
        <Boton activo={soloFaltan} onClick={() => setSoloFaltan(true)}>Lo que falta ({faltan})</Boton>
        <Boton activo={!soloFaltan} onClick={() => setSoloFaltan(false)}>Todos ({datos.items.length})</Boton>
      </div>
      {!lista.length && <Vacio emoji="✅" titulo="Está todo programado">Lo programado esta semana cubre lo que se suele vender.</Vacio>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((x) => {
          const max = Math.max(...(x.tandas_dia || [0]), 0.0001);
          return (
            <div key={x.insumo_id} style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px', fontFamily: FB,
              display: 'grid', gridTemplateColumns: cel ? '1fr' : 'minmax(200px, 1.4fr) minmax(180px, 1fr) minmax(220px, 1.2fr) auto', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: T.text, fontSize: 14 }}>{x.nombre}</div>
                <div style={{ fontSize: 12, color: T.text3 }}>
                  {x.rubro || ''}{x.platos.length ? ` · ${x.platos.slice(0, 3).map((p) => (p.vendidos_semana != null ? `${p.nombre} (${p.vendidos_semana}/sem)` : p.nombre)).join(', ')}` : ''}
                </div>
                {x.sin_conversion && <Pastilla color={T.warn} fondo="#FBF3E2" style={{ marginTop: 4 }} title="Algún plato lo usa en una unidad que no se puede pasar a la del rinde (ej. gramos y el elaborado rinde porciones sin peso)">revisar unidades</Pastilla>}
              </div>
              <div style={{ fontSize: 13, color: T.text2 }}>
                Se usa <b style={{ color: T.ink }}>{fmtCant(x.uso_semana, x.unidad)}</b> por semana
                {x.tandas_semana != null && <div style={{ fontSize: 12, color: T.text3 }}>= {String(x.tandas_semana).replace('.', ',')} tandas (1 tanda rinde {fmtCant(x.rinde_tanda, x.unidad)})</div>}
              </div>
              {x.tandas_dia ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 46 }} title="Tandas por día según en qué días se vende">
                  {x.tandas_dia.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', maxWidth: 22, height: Math.max(2, (t / max) * 28), background: T.accent, borderRadius: 3, opacity: t > 0 ? 1 : 0.25 }} />
                      <span style={{ fontSize: 9.5, color: T.text3 }}>{DIAS_CORTOS[i].slice(0, 2)}</span>
                    </div>
                  ))}
                </div>
              ) : <span />}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: cel ? 'space-between' : 'flex-end' }}>
                <div style={{ textAlign: 'right', fontSize: 12, color: T.text3 }}>
                  <div>Sugerido <b style={{ fontFamily: FT, color: T.ink, fontSize: 15 }}>{x.sugeridas != null ? fmtTandas(x.sugeridas) : '—'}</b></div>
                  <div>Programado {fmtTandas(x.programadas)}</div>
                </div>
                {x.faltan > 0
                  ? <Boton primario chico onClick={() => onProgramar(x)}>+ {fmtTandas(x.faltan)} {x.faltan === 1 ? 'tanda' : 'tandas'}</Boton>
                  : x.sugeridas == null ? <Pastilla color={T.warn} fondo="#FBF3E2">Sin cálculo</Pastilla>
                    : <Pastilla color={T.ok} fondo="#E4F6EC">Cubierto</Pastilla>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
