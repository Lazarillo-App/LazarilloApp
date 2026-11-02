// src/componentes/gestion/EquilibrioConfig.jsx
// ⚙ de la fila "Punto de equilibrio" (lazarillo_gestion/components/dashboard/equilibrio-config-modal.tsx
// y selector-variable.tsx): qué gastos acompañan a la venta, con el peso de cada rubro (promedio
// de 6 meses) y el equilibrio del último mes cerrado antes → después.
// En Lazarillo las variables son del negocio (valen para todas sus sucursales).

import React, { useMemo, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, CircularProgress,
  Typography, Table, TableHead, TableBody, TableRow, TableCell, Alert,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fmtMillones } from '@/gestion/proyeccion';
import { equilibrioMes } from '@/gestion/equilibrio';
import { cambiosEntre, claveVar, etiquetaPct, mapaVariables, pctEfectivo } from '@/gestion/equilibrioConfig';
import { useEquilibrioVariables } from '@/gestion/hooksPanel';

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VERDE = '#047857';

function agrupar(gastos) {
  const m = new Map();
  for (const g of gastos) {
    const k = g.rubroCodigo ?? '__sin';
    const r = m.get(k) ?? { codigo: g.rubroCodigo, nombre: g.rubro, prom: 0, conceptos: [] };
    r.prom += g.prom; r.conceptos.push(g); m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.prom - a.prom);
}

const nombre = (s) => s.toLowerCase().replace(/^\S/, (c) => c.toUpperCase());

function modoDe(valor, heredable) {
  if (valor === undefined) return heredable ? 'hereda' : 'fijo';
  if (valor === 0) return 'fijo';
  if (valor === 100) return 'variable';
  return 'pct';
}

const ESTILO_ON = {
  hereda: { bgcolor: 'grey.300', color: 'grey.900' },
  fijo: { bgcolor: 'grey.900', color: '#fff' },
  variable: { bgcolor: '#059669', color: '#fff' },
  pct: { bgcolor: '#0ea5e9', color: '#fff' },
};

// Fijo / Variable / % de un rubro o concepto. En un concepto (heredable) aparece "= rubro": sin
// marca propia sigue a su rubro; "Fijo" guarda 0 y gana aunque el rubro sea variable.
export function SelectorVariable({ valor, heredable = false, heredado, onChange, compacto = false }) {
  const modo = modoDe(valor, heredable);
  const opciones = [
    ...(heredable ? [{ m: 'hereda', label: '= rubro', title: `Igual que su rubro (${etiquetaPct(heredado).toLowerCase()})`, v: () => undefined }] : []),
    { m: 'fijo', label: 'Fijo', v: () => (heredable ? 0 : undefined) },
    { m: 'variable', label: 'Variable', v: () => 100 },
    { m: 'pct', label: '%', title: 'Una parte variable (ej. luz y gas que suben con la cocina)', v: () => (valor != null && valor > 0 && valor < 100 ? valor : 50) },
  ];
  const alto = compacto ? 24 : 28;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', p: 0.25 }}>
        {opciones.map((o) => (
          <Box
            key={o.m} component="button" type="button" title={o.title} aria-pressed={modo === o.m} onClick={() => onChange(o.v())}
            sx={{
              all: 'unset', cursor: 'pointer', height: alto, px: compacto ? 1 : 1.25, fontSize: compacto ? 11 : 12, fontWeight: 500, borderRadius: 1.5,
              display: 'inline-flex', alignItems: 'center',
              ...(modo === o.m ? ESTILO_ON[o.m] : { color: 'text.secondary', '&:hover': { color: 'text.primary' } }),
            }}
          >
            {o.label}
          </Box>
        ))}
      </Box>
      {modo === 'pct' && (
        <Box
          component="input" type="number" min={1} max={99} step={1} value={valor ?? ''} aria-label="% variable"
          onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n)) onChange(Math.min(99, Math.max(1, n))); }}
          sx={{ width: 56, height: alto, borderRadius: 1.5, border: '1px solid #38bdf8', px: 0.75, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: compacto ? 11 : 12, outline: 'none' }}
        />
      )}
    </Box>
  );
}

export function EquilibrioConfigModal({ anio, mes, ventasMes, egresosMes }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton size="small" onClick={() => setOpen(true)} title="Qué gastos son variables" sx={{ ml: 0.5, p: 0.25, color: 'text.disabled', '&:hover': { color: 'text.primary' } }}>
        <TuneIcon sx={{ fontSize: 15 }} />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        {open && <Contenido anio={anio} mes={mes} ventasMes={ventasMes} egresosMes={egresosMes} onCerrar={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function Contenido({ anio, mes, ventasMes, egresosMes, onCerrar }) {
  const { variables, gastos, isLoading, guardar } = useEquilibrioVariables({ anio, mes });
  const orig = useMemo(() => mapaVariables(variables ?? []), [variables]);
  const [draft, setDraft] = useState(null);
  const actual = draft ?? orig;
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const rubros = useMemo(() => agrupar(gastos ?? []), [gastos]);
  const cambios = cambiosEntre(orig, actual);

  const set = (k, v) => {
    const n = new Map(actual);
    if (v === undefined) n.delete(k); else n.set(k, v);
    setDraft(n);
  };
  const g = gastos ?? [];
  const varProm = g.reduce((s, x) => s + x.prom * pctEfectivo(actual, x.rubroCodigo, x.codigo) / 100, 0);
  const totProm = g.reduce((s, x) => s + x.prom, 0);
  const varMes = (m) => g.reduce((s, x) => s + x.mes * pctEfectivo(m, x.rubroCodigo, x.codigo) / 100, 0);
  const antes = equilibrioMes(ventasMes, egresosMes, varMes(orig));
  const despues = equilibrioMes(ventasMes, egresosMes, varMes(actual));

  async function onGuardar() {
    setGuardando(true);
    const err = await guardar(cambios);
    setGuardando(false);
    if (err) setError(err); else onCerrar();
  }
  const toggle = (k) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const th = { fontSize: 11, color: 'text.secondary', fontWeight: 500, py: 0.75 };

  return (
    <>
      <DialogTitle sx={{ fontSize: 16, pb: 0.5 }}>
        Qué gastos acompañan a la venta
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 0.5 }}>
          Variable = sube y baja con lo que vendés; lo demás es fijo. Vale para todas las sucursales del negocio. Un concepto marcado manda sobre su rubro.
          Importes: promedio por mes de los 6 meses hasta {MESES_LARGOS[mes - 1]} {anio}.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 2 }}>
        {isLoading || !gastos ? (
          <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={th}>Rubro / concepto</TableCell>
                <TableCell sx={{ ...th, textAlign: 'right' }}>prom./mes</TableCell>
                <TableCell sx={th}>Cómo se comporta</TableCell>
                <TableCell sx={{ ...th, textAlign: 'right' }}>variable/mes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rubros.map((r) => {
                const k = r.codigo ?? '__sin';
                const kr = r.codigo != null ? claveVar('rubro', r.codigo) : null;
                const abierto = abiertos.has(k);
                const marcados = r.conceptos.filter((c) => actual.has(claveVar('concepto', c.codigo))).length;
                const varR = r.conceptos.reduce((s, c) => s + c.prom * pctEfectivo(actual, c.rubroCodigo, c.codigo) / 100, 0);
                return [
                  <TableRow key={k}>
                    <TableCell sx={{ py: 0.75 }}>
                      <Box component="button" type="button" onClick={() => toggle(k)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5, fontWeight: 500, fontSize: 14 }}>
                        <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary', transition: 'transform .15s', transform: abierto ? 'rotate(90deg)' : 'none' }} />
                        {nombre(r.nombre)}
                      </Box>
                      {marcados > 0 && (
                        <Box component="span" sx={{ ml: 0.75, borderRadius: 4, border: '1px solid #a7f3d0', bgcolor: '#ecfdf5', px: 0.75, fontSize: 10, color: VERDE }}>
                          {marcados} concepto{marcados > 1 ? 's' : ''} aparte
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMillones(r.prom)}</TableCell>
                    <TableCell>{kr ? <SelectorVariable valor={actual.get(kr)} onChange={(v) => set(kr, v)} /> : <Typography variant="caption" color="text.secondary">sin rubro: por concepto</Typography>}</TableCell>
                    <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...(varR > 0 ? { color: VERDE, fontWeight: 500 } : { color: 'text.disabled' }) }}>
                      {varR > 0 ? fmtMillones(varR) : '—'}
                    </TableCell>
                  </TableRow>,
                  ...(abierto ? r.conceptos.filter((c) => c.prom > 0 || actual.has(claveVar('concepto', c.codigo))).map((c) => {
                    const kc = claveVar('concepto', c.codigo);
                    const pc = pctEfectivo(actual, c.rubroCodigo, c.codigo);
                    return (
                      <TableRow key={kc} sx={{ '& td': { fontSize: 12, color: 'text.secondary', borderBottom: 0 } }}>
                        <TableCell sx={{ py: 0.5, pl: 4 }}>{c.codigo} · {nombre(c.nombre)}</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMillones(c.prom)}</TableCell>
                        <TableCell><SelectorVariable compacto heredable heredado={kr ? actual.get(kr) : undefined} valor={actual.get(kc)} onChange={(v) => set(kc, v)} /></TableCell>
                        <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pc > 0 ? fmtMillones(c.prom * pc / 100) : '—'}</TableCell>
                      </TableRow>
                    );
                  }) : []),
                ];
              })}
            </TableBody>
          </Table>
        )}
        {gastos && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 2 }}>
            <Caja titulo="Variable"><Box sx={{ color: VERDE }}>{fmtMillones(varProm)}/mes</Box></Caja>
            <Caja titulo="Fijo">{fmtMillones(totProm - varProm)}/mes</Caja>
            <Caja titulo={`Equilibrio de ${MESES_LARGOS[mes - 1]}`}>
              {antes?.equilibrio != null ? fmtMillones(antes.equilibrio) : '—'}
              {cambios.length > 0 && <> → <Box component="span" sx={{ color: '#0284c7' }}>{despues?.equilibrio != null ? fmtMillones(despues.equilibrio) : '—'}</Box></>}
            </Caja>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        {cambios.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', pl: 1 }}>{cambios.length} cambio{cambios.length > 1 ? 's' : ''} sin guardar</Typography>}
        <Button size="small" onClick={onCerrar}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={onGuardar} disabled={!cambios.length || guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </DialogActions>
    </>
  );
}

function Caja({ titulo, children }) {
  return (
    <Box sx={{ borderRadius: 2, bgcolor: 'grey.100', px: 1.5, py: 1 }}>
      <Typography variant="caption" color="text.secondary">{titulo}</Typography>
      <Box sx={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{children}</Box>
    </Box>
  );
}
