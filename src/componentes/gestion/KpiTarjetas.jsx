// src/componentes/gestion/KpiTarjetas.jsx
// Tarjetas arriba de la tabla, igual a lazarillo_gestion/components/dashboard/kpi-tarjetas.tsx:
// el ÚLTIMO MES CERRADO (Ventas → Equilibrio → Resultado, Mix con food cost y personal adentro,
// Tu canasta) y el MES EN CURSO solo como proyección. Tocar una tarjeta abre su evolución debajo,
// a todo el ancho.
// "Para mirar": Impagas, Sin carga y las alertas del mes.

import { ScopeGestion, useDashboard, useFetchQuery } from '@/gestion/compat';
import { ImpagasBoton } from './pagos/impagas-boton';
import { SinCargaBoton } from './pagos/sin-carga-boton';
import { SinRubroLinea, useSinRubro } from './SinRubro';
import React, { useMemo, useState } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import { useAnual, useCanasta, useEgresosProyeccion, useEquilibrio, useProyeccionIngresos } from '@/gestion/hooksPanel';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtMillones } from '@/gestion/proyeccion';
import { equilibrioMes, equilibrioProyectado, pctVariableReciente } from '@/gestion/equilibrio';
import { alertasDelMes, conPersonalCompleto, mesCerrado, tarjetasDelMes } from '@/gestion/tarjetas';
import { serieIndicador, sentido, INFO_INDICADOR } from '@/gestion/evolucion';
import { resumirCanasta } from '@/gestion/canasta';
import { CanastaDetalle, CanastaMini } from './CanastaTarjeta';

const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const VERDE = '#047857';
const ROJO = '#dc2626';
const AMBAR = '#b45309';
const CELESTE = '#5BC2EA';
const pc = (x) => (x == null ? '—' : `${(x * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const ppTxt = (d) => `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('es-AR', { maximumFractionDigits: 1 })}`;

export default function KpiTarjetas() {
  const { year, modo, sucursalCaja, busquedaActiva } = usePanelGestion();
  const { data: anual } = useAnual(year);
  const { data: anualAnt } = useAnual(year - 1);
  const { data: eq } = useEquilibrio();
  const proy = useProyeccionIngresos();
  const egresosPorMes = useMemo(() => Object.fromEntries((anual?.meses ?? []).map((m) => [m.mes, m.rubros.reduce((s, r) => s + r.total, 0)])), [anual]);
  const { proyectado: egrProy, ventasProy } = useEgresosProyeccion(egresosPorMes);
  const [abierta, setAbierta] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Canasta del último mes cerrado: se pide acá arriba porque los hooks no pueden ir después de un return.
  const hoy = new Date();
  const mc = anual && modo === 'economica' && !busquedaActiva ? mesCerrado(anual.meses, year, { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }) : null;
  const canasta = useCanasta(mc ? { anio: year, mes: mc } : null);
  const rc = canasta.data && canasta.data.componentes.length ? resumirCanasta(canasta.data) : null;

  if (modo !== 'economica' || busquedaActiva) return null;
  const anteriorDic = anualAnt?.meses.find((m) => m.mes === 12) ?? null;
  const t = anual && mc ? tarjetasDelMes(anual.meses, mc, eq ? eq.porMes[mc]?.total ?? 0 : null, mc === 1 ? anteriorDic : undefined) : null;
  if (!anual || !t) return null;

  // Mes en curso: ventas proyectadas, egresos proyectados y equilibrio con el % variable de los cerrados.
  const enCurso = proy && proy.anio === year && egrProy && ventasProy != null ? proy.mes : null;
  const previos = anual.meses.filter((m) => enCurso && m.mes < enCurso && m.ventas > 0).slice(-3);
  const pctVar = eq ? pctVariableReciente(previos.map((m) => ({ ventas: m.ventas, variable: eq.porMes[m.mes]?.total ?? 0 }))) : null;
  const eqProy = enCurso && pctVar != null
    ? equilibrioProyectado({ ventasProy, egresosProy: egrProy.total, pctVariable: pctVar, facturado: proy.facturado, diasRestantes: proy.diasRestantes })
    : null;

  const toggle = (k) => setAbierta((a) => (a === k ? null : k));
  const e = t.equilibrio;
  const alertas = [
    ...alertasDelMes(conPersonalCompleto([...anual.meses].sort((a, b) => a.mes - b.mes)), t, t.mes <= 6 ? (anualAnt?.meses ?? []).filter((m) => m.mes > t.mes + 6) : []),
    ...(eqProy && eqProy.falta > 0 && enCurso ? [{ texto: `${MES[enCurso - 1]}: faltan ${fmtMillones(eqProy.falta)} para el equilibrio`, nivel: 'ambar' }] : []),
  ];
  const conMirar = alertas.length > 0;
  const columnas = [rc ? '3.5fr' : '3fr', ...(enCurso ? ['1.4fr'] : []), ...(conMirar ? ['0.95fr'] : [])].join(' ');
  const aviseError = (p) => p.then((err) => { if (err) setAviso(err); });

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { lg: columnas } }}>
        <div>
          <Grupo>{MES[t.mes - 1]} · último mes cerrado</Grupo>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', md: rc ? '1fr 1fr 1fr 1.5fr 1.1fr' : '1fr 1fr 1fr 1.5fr' } }}>
            <Tarjeta titulo="Ventas" activa={abierta === 'ventas'} onClick={() => toggle('ventas')}>
              <Grande>{fmtMillones(t.ventas)}</Grande>
              {t.ventasVsAnterior != null && (
                <Chico color={t.ventasVsAnterior >= 0 ? VERDE : ROJO}>
                  {t.ventasVsAnterior >= 0 ? '▲' : '▼'} {pc(Math.abs(t.ventasVsAnterior))} vs {MES[(t.mes + 10) % 12].slice(0, 3).toLowerCase()}
                </Chico>
              )}
            </Tarjeta>
            <Tarjeta titulo="Equilibrio" activa={abierta === 'equilibrio'} onClick={() => toggle('equilibrio')} deshabilitada={!e?.equilibrio}>
              <Grande>{e?.equilibrio != null ? fmtMillones(e.equilibrio) : '—'}</Grande>
              {e?.equilibrio != null && <Chico color={e.diferencia >= 0 ? VERDE : ROJO}>{e.diferencia >= 0 ? '✓ superado' : `faltaron ${fmtMillones(-e.diferencia)}`}</Chico>}
            </Tarjeta>
            <Tarjeta titulo="Resultado" activa={abierta === 'resultado'} onClick={() => toggle('resultado')}>
              <Grande color={t.resultado < 0 ? ROJO : VERDE}>{fmtMillones(t.resultado)}</Grande>
              <Chico color="text.secondary">{pc(t.rentabilidad)} rentab.{t.personalEstimado ? ' · personal est.' : ''}</Chico>
            </Tarjeta>
            <Tarjeta titulo="Mix" activa={abierta === 'mix' || abierta === 'foodCost' || abierta === 'personal'} onClick={() => toggle('mix')}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Grande>{pc(t.mix)}</Grande>
                {t.difMix != null && Math.abs(t.difMix) >= 0.05 && <Chico color={t.difMix < 0 ? VERDE : ROJO}>{ppTxt(t.difMix)} pp</Chico>}
              </Box>
              <Box sx={{ mt: 0.5, display: 'flex', gap: 1.5, borderTop: '1px dashed', borderColor: 'divider', pt: 0.5, fontSize: 12 }}>
                <SubIndicador nombre="Food cost" valor={t.foodCost} dif={t.difFoodCost} onClick={() => toggle('foodCost')} />
                <SubIndicador nombre="Personal" valor={t.personal} dif={t.difPersonal} onClick={() => toggle('personal')}
                  estimado={t.personalEstimado ? `Estimado: el personal del mes está a medio cargar (${fmtMillones(t.personalEstimado.cargado)}); se usa el último mes completo (${fmtMillones(t.personalEstimado.usado)}) hasta que se cargue.` : null} />
              </Box>
            </Tarjeta>
            {rc && (
              <Tarjeta titulo="Tu canasta" activa={abierta === 'canasta'} onClick={() => toggle('canasta')}>
                <CanastaMini r={rc} d={canasta.data} />
              </Tarjeta>
            )}
          </Box>
        </div>
        {enCurso && (
          <div>
            <Grupo>{MES[enCurso - 1]} · proyección al cierre</Grupo>
            <Box sx={{ borderRadius: 3, border: `1px solid ${CELESTE}`, bgcolor: `${CELESTE}1a`, px: 1.5, py: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                <div>
                  <Box sx={{ fontSize: 11.5, color: 'text.secondary' }}>Ventas proy.</Box>
                  <Grande color="#0369a1">{fmtMillones(ventasProy)}</Grande>
                  <Chico color="text.secondary">real {fmtMillones(proy.facturado)} al {proy.corte.slice(8, 10)}/{proy.corte.slice(5, 7)}</Chico>
                </div>
                <Box sx={{ textAlign: 'right' }}>
                  <Box sx={{ fontSize: 11.5, color: 'text.secondary' }}>Resultado proy.</Box>
                  <Grande color={ventasProy - egrProy.total < 0 ? ROJO : '#0369a1'}>{fmtMillones(ventasProy - egrProy.total)}</Grande>
                  <Chico color="text.secondary">con gastos estimados</Chico>
                </Box>
              </Box>
              {eqProy?.equilibrio != null && (
                <>
                  <Box sx={{ position: 'relative', mt: 1, height: 8, borderRadius: 1, bgcolor: 'rgba(255,255,255,.7)' }}>
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 1, bgcolor: CELESTE, width: `${Math.min(100, (proy.facturado / Math.max(ventasProy, eqProy.equilibrio)) * 100)}%` }} />
                    <Box sx={{ position: 'absolute', top: -4, bottom: -4, width: 2, bgcolor: 'grey.900', left: `${Math.min(100, (eqProy.equilibrio / Math.max(ventasProy, eqProy.equilibrio)) * 100)}%` }} />
                  </Box>
                  <Chico color={eqProy.falta > 0 ? AMBAR : VERDE} sx={{ mt: 0.5 }}>
                    {eqProy.falta > 0
                      ? <>equilibrio {fmtMillones(eqProy.equilibrio)} · faltan {fmtMillones(eqProy.falta)}{eqProy.porDia != null && <> · {fmtMillones(eqProy.porDia)}/día</>}</>
                      : <>✓ equilibrio {fmtMillones(eqProy.equilibrio)} superado</>}
                  </Chico>
                </>
              )}
            </Box>
          </div>
        )}
        {conMirar && <Box sx={{ display: 'flex', flexDirection: 'column' }}><Grupo>&nbsp;</Grupo><ParaMirar alertas={alertas} /></Box>}
      </Box>
      {abierta === 'canasta' && canasta.data && rc && (
        <CanastaDetalle
          d={canasta.data} r={rc} mesRef={t.mes} conSucursal={sucursalCaja !== undefined}
          onAgregar={(f) => aviseError(canasta.agregarAumento(f))} onQuitar={(f) => aviseError(canasta.quitarAumento(f))} onCerrar={() => setAbierta(null)}
        />
      )}
      {abierta && abierta !== 'canasta' && (
        <Evolucion
          clave={abierta} anio={year} mesHasta={t.mes} meses={anual.meses} mesesAnt={anualAnt?.meses ?? []}
          variablePorMes={eq?.porMes ?? null} onCerrar={() => setAbierta(null)}
        />
      )}
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity="error" variant="filled" onClose={() => setAviso(null)}>{aviso}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function SubIndicador({ nombre, valor, dif, onClick, estimado }) {
  return (
    <Box
      component="button" type="button" onClick={(ev) => { ev.stopPropagation(); onClick(); }}
      sx={{ all: 'unset', cursor: 'pointer', textAlign: 'left', '&:hover': { textDecoration: 'underline' } }}
    >
      {nombre} <b title={estimado || undefined}>{pc(valor)}{estimado && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>*</Box>}</b>
      {dif != null && Math.abs(dif) >= 0.05 && <Box component="span" sx={{ ml: 0.5, fontWeight: 700, color: dif < 0 ? VERDE : ROJO }}>{ppTxt(dif)}</Box>}
    </Box>
  );
}

// Renglones de Impagas y Sin carga: solo con un lugar concreto, sus datos son por lugar.
function AccesosPagos() {
  const { pdvId } = useDashboard();
  const { data: locales } = useFetchQuery(['locales'], '/api/locales', { staleTime: 5 * 60_000 });
  if (pdvId == null) return null;
  return (
    <ScopeGestion>
      <ImpagasBoton locales={locales ?? []} pdvId={pdvId} variante="linea" />
      <SinCargaBoton variante="linea" />
    </ScopeGestion>
  );
}

// Alertas del mes en una tarjeta que NUNCA es más alta que las de KPI: una a la vista y el resto en "+N más".
function ParaMirar({ alertas }) {
  const [mas, setMas] = useState(false);
  // Con «Sin rubro» arriba (Diego 06/11/2026) la tarjeta no crece: las alertas pasan a "+N más".
  const { data: sinRubro } = useSinRubro();
  const conSinRubro = !!sinRubro && Math.abs(sinRubro.importe) >= 0.01;
  const visibles = alertas.slice(0, conSinRubro ? 0 : 1);
  const resto = alertas.slice(conSinRubro ? 0 : 1);
  const linea = (a) => (
    <Box key={a.texto} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box component="span" sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: a.nivel === 'rojo' ? '#ef4444' : '#f59e0b' }} />
      <Box component="span" title={a.texto} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.texto}</Box>
    </Box>
  );
  return (
    <Box sx={{ position: 'relative', flex: 1, borderRadius: 3, border: '1px solid rgba(252,211,77,.7)', bgcolor: 'rgba(255,251,235,.7)', px: 1.5, py: 1, fontSize: 12.5, lineHeight: 1.55, maxHeight: 96 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'text.secondary' }}>
        <span>Para mirar</span>{alertas.length > 0 && <Box component="b" sx={{ color: AMBAR }}>{alertas.length}</Box>}
      </Box>
      <SinRubroLinea />
      <AccesosPagos />
      {visibles.map(linea)}
      {resto.length > 0 && (
        <Box component="button" type="button" onClick={() => setMas((v) => !v)} sx={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: AMBAR, '&:hover': { textDecoration: 'underline' } }}>
          {mas ? 'menos ▴' : `+${resto.length} más ›`}
        </Box>
      )}
      {mas && (
        <Box sx={{ position: 'absolute', right: 0, top: '100%', zIndex: 30, mt: 0.5, width: 288, borderRadius: 3, border: '1px solid #fcd34d', bgcolor: 'background.paper', px: 1.5, py: 1, boxShadow: 3 }}>
          {resto.map(linea)}
        </Box>
      )}
    </Box>
  );
}

function Grupo({ children }) {
  return <Box sx={{ mb: 0.75, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>{children}</Box>;
}
function Grande({ children, color }) {
  return <Box component="b" sx={{ display: 'block', fontSize: 18, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, color }}>{children}</Box>;
}
function Chico({ children, color, sx }) {
  return <Box sx={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, color, ...sx }}>{children}</Box>;
}
function Tarjeta({ titulo, activa, deshabilitada, onClick, children }) {
  return (
    <Box
      role="button" tabIndex={0}
      onClick={() => { if (!deshabilitada) onClick(); }}
      onKeyDown={(ev) => { if (!deshabilitada && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); onClick(); } }}
      sx={{
        borderRadius: 3, border: 1, bgcolor: 'background.paper', px: 1.5, py: 1, textAlign: 'left', transition: 'background-color .15s',
        cursor: deshabilitada ? 'default' : 'pointer',
        '&:hover': deshabilitada ? undefined : { bgcolor: 'grey.50' },
        borderColor: activa ? 'grey.900' : 'divider',
        boxShadow: activa ? (th) => `0 0 0 1px ${th.palette.grey[900]}` : 'none',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'text.secondary' }}>
        <span>{titulo}</span>{!deshabilitada && <span>{activa ? '▴' : '▾'}</span>}
      </Box>
      {children}
    </Box>
  );
}

// Evolución de la tarjeta tocada, a todo el ancho (como en el celu): barras de los últimos 3/6/9/12 meses.
function Evolucion({ clave, anio, mesHasta, meses, mesesAnt, variablePorMes, onCerrar }) {
  const [n, setN] = useState(6);
  // Mismo criterio que las tarjetas (Diego 06/11/2026: "en la barra dice una cosa y en el número otra"):
  // el personal a medio cargar se completa con el último mes completo y la barra queda marcada.
  const todos = conPersonalCompleto([
    ...[...mesesAnt].sort((a, b) => a.mes - b.mes).map((m) => ({ ...m, anio: anio - 1 })),
    ...[...meses].sort((a, b) => a.mes - b.mes).map((m) => ({ ...m, anio })),
  ]);
  let serie;
  let titulo;
  let plata;
  let claveSentido;
  if (clave === 'equilibrio') {
    // Barras = ventas; marca = equilibrio del mes (solo el año que se mira: las variables vienen por año).
    titulo = 'Ventas y punto de equilibrio'; plata = true; claveSentido = 'ventas';
    serie = serieIndicador({ meses: todos, clave: 'ventas', hasta: { anio, mes: mesHasta }, n }).map((p) => {
      const m = p.anio === anio ? todos.find((x) => x.anio === anio && x.mes === p.mes) : null;
      const e = m && variablePorMes ? equilibrioMes(m.ventas, m.rubros.reduce((s, r) => s + r.total, 0), variablePorMes[p.mes]?.total ?? 0) : null;
      return { ...p, marca: e?.equilibrio ?? null, estimado: !!m?.personalEstimado };
    });
  } else {
    titulo = INFO_INDICADOR[clave].titulo; plata = INFO_INDICADOR[clave].tipo === 'plata'; claveSentido = clave;
    serie = serieIndicador({ meses: todos, clave, hasta: { anio, mes: mesHasta }, n });
  }
  // Misma escala para barras y marca; la más baja arranca en 25% para que se vean las diferencias
  // sin exagerarlas (como en el celu).
  const vals = serie.flatMap((x) => [x.valor, x.marca ?? null]).filter((v) => v != null);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const alto = (v) => (max > min ? 25 + ((v - min) / (max - min)) * 75 : 60);
  const fmt = (v) => (plata ? fmtMillones(v) : pc(v));
  return (
    <Box sx={{ mt: 1.5, borderRadius: 3, border: 1, borderColor: 'grey.300', bgcolor: 'rgba(250,250,250,.6)', px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box component="b" sx={{ fontSize: 15 }}>{titulo}</Box>
        <Box component="span" sx={{ display: 'inline-flex', borderRadius: 2, bgcolor: 'rgba(228,228,231,.7)', p: 0.25, fontSize: 12 }}>
          {[3, 6, 9, 12].map((k) => (
            <Box
              key={k} component="button" type="button" onClick={() => setN(k)}
              sx={{ all: 'unset', cursor: 'pointer', borderRadius: 1.5, px: 1.25, py: 0.25, fontWeight: 600, ...(n === k ? { bgcolor: 'background.paper', boxShadow: 1 } : { color: 'text.secondary' }) }}
            >
              {k}
            </Box>
          ))}
          <Box component="span" sx={{ alignSelf: 'center', px: 0.75, color: 'text.secondary' }}>meses</Box>
        </Box>
        <Box component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>{plata ? '% contra el mes anterior' : 'pp = puntos contra el mes anterior'} · verde mejora · rojo empeora</Box>
        <Box component="button" type="button" onClick={onCerrar} sx={{ all: 'unset', cursor: 'pointer', ml: 'auto', fontSize: 12, fontWeight: 600, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>▴ cerrar</Box>
      </Box>
      <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
        {serie.map((x) => {
          const s = sentido(claveSentido, x.dif);
          return (
            <Box key={`${x.anio}-${x.mes}`} sx={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ position: 'relative', height: 144, width: '100%', maxWidth: 72 }}>
                {x.valor != null && (
                  <>
                    <Box title={x.estimado ? 'Estimado: el personal del mes está a medio cargar; se usa el del último mes completo.' : undefined}
                      sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '6px 6px 0 0', bgcolor: x.valor < 0 ? '#f87171' : CELESTE, height: `${alto(x.valor) * 0.82}%`,
                        ...(x.estimado ? { opacity: 0.55, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.45) 0 4px, transparent 4px 8px)' } : {}) }} />
                    <Box component="span" sx={{ position: 'absolute', left: -12, right: -12, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', bottom: `calc(${alto(x.valor) * 0.82}% + 2px)` }}>{fmt(x.valor)}{x.estimado ? '*' : ''}</Box>
                  </>
                )}
                {x.marca != null && (
                  <Box title={`Equilibrio ${fmtMillones(x.marca)}`} sx={{ position: 'absolute', left: -5, right: -5, height: 3, borderRadius: 1, bgcolor: 'grey.900', bottom: `${alto(x.marca) * 0.82}%` }} />
                )}
              </Box>
              <Box component="span" sx={{ mt: 0.5, height: 16, fontSize: 11, color: 'text.secondary' }}>
                {MES[x.mes - 1].slice(0, 3).toLowerCase()}{x.anio !== anio ? ` ${String(x.anio).slice(2)}` : ''}
              </Box>
              <Box component="span" sx={{ height: 16, fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s === 'bueno' ? VERDE : s === 'malo' ? ROJO : 'text.secondary' }}>
                {x.dif != null && Math.abs(x.dif) >= 0.05 ? `${x.dif > 0 ? '▲' : '▼'}${Math.abs(x.dif).toLocaleString('es-AR', { maximumFractionDigits: 1 })}${plata ? '%' : ''}` : ''}
              </Box>
            </Box>
          );
        })}
      </Box>
      {clave === 'equilibrio' && <Box sx={{ mt: 0.5, fontSize: 11.5, color: 'text.secondary' }}>Barra = ventas · línea negra = punto de equilibrio del mes (con los gastos variables configurados).</Box>}
      {serie.some((x) => x.estimado) && <Box sx={{ mt: 0.5, fontSize: 11.5, color: 'text.secondary' }}>* rayada = personal a medio cargar: se usa el del último mes completo hasta que se cargue.</Box>}
    </Box>
  );
}
