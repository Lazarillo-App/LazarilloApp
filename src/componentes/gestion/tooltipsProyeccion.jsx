// src/componentes/gestion/tooltipsProyeccion.jsx
// Tooltips del bloque Operación, igual a lazarillo_gestion/components/dashboard/proyeccion-tooltip.tsx:
// proyección de cierre de Ingresos y de Egresos, el chico de Resultado OP / Gastos / Ventas y el
// del Punto de equilibrio. FaltaCargarTip llega con el módulo Sin carga.

import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { fmtMillones, DIA_SEMANA_CORTO } from '@/gestion/proyeccion';

const pct = (x) => `${Math.round(x * 100)}%`;
const pct1 = (x) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const OTROS = { unico: ['semanas', 'dias_mes'], semanas: ['unico', 'dias_mes'], dias_mes: ['unico', 'semanas'] };
const CORTO = { unico: 'Cálculo completo', semanas: '8 sem. × ritmo', dias_mes: 'Prom. del mes' };
const CELESTE = '#5BC2EA';
const RAYADO = `repeating-linear-gradient(45deg,${CELESTE}66 0 4px,transparent 4px 8px)`;

const nombreMes = (anio, mes) => {
  const m = new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
  return m.charAt(0).toUpperCase() + m.slice(1);
};
const capital = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

// Tooltip oscuro de ancho fijo, abajo y alineado a la derecha (TooltipContent de gestion).
function Tip({ ancho, contenido, children, subrayado = CELESTE }) {
  return (
    <Tooltip
      enterDelay={150}
      placement="bottom-end"
      title={contenido}
      slotProps={{ tooltip: { sx: { bgcolor: 'grey.900', maxWidth: 'none', width: ancho, p: 1.75, fontSize: 12.5, lineHeight: 1.45, fontWeight: 400, textAlign: 'left' } } }}
    >
      <Box component="span" sx={{ cursor: 'help', borderBottom: `1.5px dashed ${subrayado}` }}>{children}</Box>
    </Tooltip>
  );
}

function Fila({ izq, der }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
      <span>{izq}</span>
      <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{der}</Box>
    </Box>
  );
}
const Sep = () => <Box sx={{ borderTop: '1px solid rgba(255,255,255,.2)', my: 1.25 }} />;
const Tenue = ({ children, sx }) => <Box sx={{ opacity: 0.6, ...sx }}>{children}</Box>;

// Celda de Ingresos del mes incompleto: el valor subrayado y, al pasar el mouse, cómo se llega a
// la proyección de cierre. Compacto: el número arriba, una línea por idea y los otros cálculos en
// una grilla chica.
export function ProyeccionIngresos({ p, children }) {
  const mesLargo = new Date(Date.UTC(p.anio, p.mes - 1, 1)).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
  const mesNombre = mesLargo.charAt(0).toUpperCase() + mesLargo.slice(1);
  const pctFacturado = Math.min(100, (p.facturado / p.proyeccion) * 100);
  const signo = (f) => `${f >= 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)}%`;
  const como = p.metodo === 'unico'
    ? <>día de semana{p.estacional != null && Math.abs(p.estacional - 1) >= 0.02 ? <> × época <b>{signo(p.estacional)}</b></> : null} × ritmo <b>{pct(p.ritmoEstacional)}</b></>
    : p.metodo === 'semanas' ? <>día de semana (8 sem.) × ritmo <b>{pct(p.ritmo)}</b></> : <>promedio de cada día en {mesLargo}</>;
  const otros = [
    ...OTROS[p.metodo].map((m) => [CORTO[m], p.proyecciones[m]]),
    ['Regla de 3', p.reglaDeTres],
    ...(p.cierreAnioAnterior != null ? [[`${mesNombre.slice(0, 3)} ${p.anio - 1} cerró`, p.cierreAnioAnterior]] : []),
  ];
  const errOtros = p.backtest ? [...OTROS[p.metodo].map((m) => p.backtest.errores[m]), ...(p.backtest.errorReglaDeTres != null ? [p.backtest.errorReglaDeTres] : [])] : [];

  const contenido = (
    <Box sx={{ fontSize: 12, lineHeight: 1.4 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Tenue>Cierre {mesNombre}</Tenue>
        <Box sx={{ fontSize: 20, fontWeight: 700 }}>{fmtMillones(p.proyeccion)}</Box>
      </Box>
      {p.rango && <Tenue sx={{ textAlign: 'right', fontSize: 11 }}>{fmtMillones(p.rango.min)} – {fmtMillones(p.rango.max)} (±{pct(p.backtest.errorMetodo)})</Tenue>}
      <Box sx={{ position: 'relative', height: 6, borderRadius: 1, bgcolor: 'rgba(255,255,255,.15)', my: 0.75, overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pctFacturado}%`, bgcolor: CELESTE }} />
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, left: `${pctFacturado}%`, background: RAYADO }} />
      </Box>
      <Fila izq={`Facturado al ${ddmm(p.corte)}`} der={fmtMillones(p.facturado)} />
      <Fila izq={`Faltan ${p.diasRestantes} días (${p.restantesPorDia.map((d) => `${d.cantidad} ${DIA_SEMANA_CORTO[d.dow]}`).join(', ')})`} der={`+${fmtMillones(p.estimadoRestante)}`} />
      <Box sx={{ opacity: 0.7, mt: 0.5 }}>Cómo: {como}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, mt: 0.75, pt: 0.75, borderTop: '1px solid rgba(255,255,255,.2)', opacity: 0.6, fontSize: 11 }}>
        {otros.map(([a, b]) => (
          <Box key={a} sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5 }}><span>{a}</span><Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMillones(b)}</Box></Box>
        ))}
      </Box>
      {p.backtest && (
        <Tenue sx={{ fontSize: 11, mt: 0.5 }}>
          Error medio{p.backtest.fuente === 'backtest' ? ` (${p.backtest.meses} meses, día ${p.backtest.dia})` : ''}: este <b>{pct1(p.backtest.errorMetodo)}</b>
          {errOtros.length ? <> · otros {pct1(Math.min(...errOtros))}–{pct1(Math.max(...errOtros))}</> : null}
        </Tenue>
      )}
    </Box>
  );
  return <Tip ancho={300} contenido={contenido}>{children}</Tip>;
}

// Egresos del mes en curso: proyección de cierre con el cálculo del celu.
export function ProyeccionEgresos({ e, anio, corte, ventasProy, children }) {
  // % de cada rubro sobre las ventas proyectadas.
  const sv = (n) => (ventasProy && ventasProy > 0 ? ` · ${((n / ventasProy) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%` : '');
  const pc = (n) => `${Math.max(0, Math.min(100, (n / e.total) * 100))}%`;
  const top = e.rubros.slice(0, 4);
  const otros = e.rubros.slice(4).reduce((s, r) => s + r.total, 0);
  const contenido = (
    <Box>
      <Tenue>Egresos · proyección de cierre {nombreMes(anio, e.mes)} {anio}</Tenue>
      <Box sx={{ fontSize: 22, fontWeight: 700, my: 0.25 }}>{fmtMillones(e.total)}</Box>
      <Tenue>hoy cargado {fmtMillones(e.cargado)}</Tenue>
      <Box sx={{ display: 'flex', height: 8, borderRadius: 1, bgcolor: 'rgba(255,255,255,.15)', my: 1, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: CELESTE, width: pc(e.cargado) }} />
        <Box sx={{ bgcolor: '#f5c26b', width: pc(e.sinCargar) }} />
        <Box sx={{ flex: 1, background: RAYADO }} />
      </Box>
      <Fila izq={`Cargado${corte ? ` al ${corte.slice(8, 10)}/${corte.slice(5, 7)}` : ''}`} der={fmtMillones(e.cargado)} />
      <Fila izq="Falta cargar (Sin carga)" der={fmtMillones(e.sinCargar)} />
      <Fila izq="Variable estimado" der={fmtMillones(e.variable)} />
      <Sep />
      <Tenue sx={{ mb: 0.5, display: 'flex', justifyContent: 'space-between' }}><span>Por rubro</span><span>% s/ ventas proy.</span></Tenue>
      {top.map((r) => <Fila key={r.rubro} izq={capital(r.rubro)} der={fmtMillones(r.total) + sv(r.total)} />)}
      {otros > 0.5 && <Fila izq="Otros" der={fmtMillones(otros) + sv(otros)} />}
      <Box sx={{ mt: 0.5, opacity: 0.8 }}><Fila izq="Total" der={fmtMillones(e.total) + sv(e.total)} /></Box>
      <Sep />
      <Tenue>
        Mercaderías: food cost de los meses cerrados{e.foodCost != null ? ` (${Math.round(e.foodCost * 100)}%)` : ''} × ventas proyectadas.
        El resto de los rubros, su promedio. Nunca menos que lo cargado + lo que falta cargar.
      </Tenue>
      <RevisarArca />
    </Box>
  );
  return <Tip ancho={360} contenido={contenido}>{children}</Tip>;
}

// Lo de ARCA queda afuera del cálculo ("dejalo afuera y en todo caso poné revisar ARCA").
function RevisarArca() {
  return (
    <Box sx={{ mt: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,.1)', px: 1, py: 0.75 }}>
      <b>Revisar ARCA</b> <Box component="span" sx={{ opacity: 0.7 }}>· las facturas que ARCA tiene y no están cargadas no se cuentan acá (Sin carga → ARCA).</Box>
    </Box>
  );
}

// Tooltip chico para Resultado OP y Gastos / Ventas: la celda muestra lo real y acá va lo proyectado.
export function TipProyectado({ titulo, grande, negativo, filas, children }) {
  const contenido = (
    <Box>
      <Tenue>{titulo}</Tenue>
      <Box sx={{ fontSize: 20, fontWeight: 700, my: 0.25, color: negativo ? '#f87171' : undefined }}>{grande}</Box>
      {filas.map(([a, b]) => <Fila key={a} izq={a} der={b} />)}
    </Box>
  );
  return <Tip ancho={300} contenido={contenido}>{children}</Tip>;
}

// Punto de equilibrio de un mes: cuánto había que vender, de dónde sale y cuánto quedó de lo
// vendido arriba. En el mes en curso, con la proyección y lo que falta por día.
export function EquilibrioTip({ e, p, anio, mes, detalle, variables, children }) {
  const pc = (x) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
  const arriba = e.diferencia >= 0;
  const resultado = e.diferencia * e.queda;
  const contenido = (
    <Box>
      <Tenue>Punto de equilibrio · {nombreMes(anio, mes)} {anio}{p ? ' · proyección' : ''}</Tenue>
      <Box sx={{ fontSize: 22, fontWeight: 700, my: 0.25 }}>{e.equilibrio == null ? '—' : fmtMillones(e.equilibrio)}</Box>
      <Box sx={{ color: arriba ? '#34d399' : '#f87171' }}>
        {p ? 'vendería' : 'vendió'} {fmtMillones(e.ventas)} · {arriba ? `${fmtMillones(e.diferencia)} arriba` : `${fmtMillones(-e.diferencia)} abajo`}
      </Box>
      <Sep />
      <Fila izq="Gastos fijos" der={fmtMillones(e.fijos)} />
      <Fila izq={`Gastos variables (${pc(e.pctVariable)} de la venta)`} der={fmtMillones(e.variable)} />
      {!p && <Tenue>{detalle.slice(0, 4).map((d) => <Fila key={d.nombre} izq={`· ${capital(d.nombre)}`} der={fmtMillones(d.total)} />)}</Tenue>}
      <Tenue sx={{ mt: 0.5 }}>Fijos ÷ (1 − {pc(e.pctVariable)}) = {e.equilibrio == null ? '—' : fmtMillones(e.equilibrio)}</Tenue>
      <Sep />
      <div>
        De cada $ 100 que se venden arriba del equilibrio quedan <b>$ {Math.round(e.queda * 100)}</b>{' '}
        (el resto se va en los gastos variables). {p ? 'Te quedaría' : 'Te quedó'}{' '}
        <Box component="b" sx={{ color: resultado < 0 ? '#f87171' : undefined }}>{p ? '~' : ''}{fmtMillones(resultado)}</Box>.
      </div>
      {p && (
        <>
          <Sep />
          {p.falta > 0
            ? <div>Facturado {fmtMillones(p.facturado)}: faltan <b>{fmtMillones(p.falta)}</b> para llegar{p.porDia != null ? <> · <b>{fmtMillones(p.porDia)} por día</b> en los {p.diasRestantes} días que quedan</> : null}.</div>
            : <Box sx={{ color: '#34d399' }}>Ya se superó con lo facturado ({fmtMillones(p.facturado)}).</Box>}
          <Tenue sx={{ mt: 0.5 }}>Con los egresos proyectados y el % variable de los meses cerrados.</Tenue>
        </>
      )}
      <Sep />
      <Tenue>Variables: {variables.join(', ')}. El resto es fijo.</Tenue>
    </Box>
  );
  return <Tip ancho={360} contenido={contenido} subrayado="rgba(0,0,0,.25)">{children}</Tip>;
}
