// src/componentes/gestion/IngresosManuales.jsx
// Ingresos cargados a mano en Ventas (lazarillo_gestion/components/ventas/ingresos-manuales.tsx):
// ventas que no están en el PDV, días en que falló, o todas las de un negocio sin POS. Tipo y
// forma de cobro son opcionales.

import React, { useMemo, useState } from 'react';
import { Alert, Box, Dialog, IconButton, Snackbar } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { diasEntre, itemsDeGrilla } from '@/gestion/cargaUtils';

const pesos = (n) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaCorto = (iso) => `${DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
// "1.250.000,50" → 1250000.5
const parseImporte = (s) => {
  const t = s.replace(/[$\s]/g, '');
  if (!t) return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/\.(?=\d{3}(\.|$))/g, ''));
};
const fmtTipeo = (s) => s.replace(/[^\d,.-]/g, '');
const hoy = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const sxInput = { width: '100%', boxSizing: 'border-box', height: 36, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1.25, fontSize: 14 };
const sxLab = { mb: 0.5, display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'text.secondary' };
const sxSeg = (on) => ({ all: 'unset', cursor: 'pointer', height: 28, px: 1.25, display: 'inline-flex', alignItems: 'center', borderRadius: 1.5, fontSize: 12, fontWeight: 500, ...(on ? { bgcolor: 'background.paper', boxShadow: 1 } : { color: 'text.secondary' }) });
const sxLink = { all: 'unset', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' };

// Barra arriba de la tabla de Ventas: botón + aviso si hay días con carga manual y ventas reales.
export default function BarraIngresosManuales() {
  const { businessId, sucursalCaja } = usePanelGestion();
  const { data } = useQuery({
    queryKey: ['gestionVentasManuales', businessId, sucursalCaja],
    queryFn: () => GestionAPI.ventasManuales(sucursalCaja),
    enabled: !!businessId && sucursalCaja !== undefined,
    staleTime: 60_000,
  });
  const [abierto, setAbierto] = useState(false);
  if (sucursalCaja === undefined) return null;
  const sol = data?.solapadas ?? [];
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, pt: 1.25, pb: 0.5 }}>
      <Box component="button" type="button" onClick={() => setAbierto(true)} sx={{ all: 'unset', cursor: 'pointer', height: 28, px: 1.25, display: 'inline-flex', alignItems: 'center', gap: 0.5, borderRadius: 2, border: 1, borderColor: 'divider', fontSize: 12, fontWeight: 500, '&:hover': { bgcolor: 'grey.50' } }}>
        <AddIcon sx={{ fontSize: 15 }} /> Cargar ingreso
      </Box>
      {sol.length > 0 && (
        <Box component="button" type="button" onClick={() => setAbierto(true)} sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.75, borderRadius: 2, bgcolor: '#fffbeb', px: 1.25, py: 0.5, fontSize: 12, fontWeight: 500, color: '#92400e' }}>
          <WarningAmberIcon sx={{ fontSize: 15 }} /> {sol.length} día{sol.length === 1 ? '' : 's'} con carga manual y ventas de MaxiRest · revisar
        </Box>
      )}
      {abierto && <ModalIngresos sucursal={sucursalCaja} data={data} onClose={() => setAbierto(false)} />}
    </Box>
  );
}

function ModalIngresos({ sucursal, data, onClose }) {
  const qc = useQueryClient();
  const [modo, setModo] = useState('suelto');
  const [errores, setErrores] = useState([]);
  const [repetidos, setRepetidos] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const tipos = data?.tipos ?? [];
  const cobros = data?.cobros ?? [];
  // Suelto
  const [fecha, setFecha] = useState(hoy());
  const [importe, setImporte] = useState('');
  const [tipo, setTipo] = useState('');
  const [cobro, setCobro] = useState('');
  const [detalle, setDetalle] = useState('');
  const [cliente, setCliente] = useState('');
  // Varios días
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [columnas, setColumnas] = useState('tipo');
  const [celdas, setCeldas] = useState({});
  const [detalleDias, setDetalleDias] = useState('');
  const dias = useMemo(() => diasEntre(desde, hasta), [desde, hasta]);
  const cols = columnas === 'tipo' ? (tipos.length ? tipos : ['SALON']) : columnas === 'cobro' ? (cobros.length ? cobros : ['EFECTIVO']) : ['total'];
  const totalDia = (d) => cols.reduce((s, c) => s + (parseImporte(celdas[d]?.[c] ?? '') || 0), 0);
  const itemsDias = itemsDeGrilla(columnas, Object.fromEntries(dias.map((d) => [d, Object.fromEntries(cols.map((c) => [c, celdas[d]?.[c] ?? '']))])), parseImporte, detalleDias.trim() || null);
  const diasConCarga = new Set(itemsDias.map((i) => i.fecha)).size;

  const refrescar = () => {
    for (const k of ['gestionVentasManuales', 'gestionPivotVentas', 'gestionAnual', 'gestionProyeccion', 'gestionActualizado', 'gestionDiferenciaCaja', 'gestionRangoAnios']) qc.invalidateQueries({ queryKey: [k] });
  };

  async function guardar(forzar = false) {
    const items = modo === 'suelto'
      ? [{ fecha, importe: Math.round(parseImporte(importe) * 100) / 100, tipo: tipo || null, cobro: cobro || null, detalle: detalle.trim() || null, cliente: cliente.trim() || null }]
      : itemsDias;
    const faltan = [];
    if (modo === 'suelto') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) faltan.push('Falta la fecha.');
      if (!(Math.abs(parseImporte(importe)) >= 0.01)) faltan.push('Poné el importe.');
    } else if (!dias.length) faltan.push('Elegí desde y hasta.');
    else if (!items.length) faltan.push('No hay importes cargados en la grilla.');
    if (faltan.length) { setErrores(faltan); return; }
    setErrores([]); setRepetidos(null); setGuardando(true);
    try {
      const d = await GestionAPI.crearVentasManuales({ sucursal, items, forzar });
      setAviso({ sev: 'success', txt: `${d.cargados} ingreso${d.cargados === 1 ? '' : 's'} cargado${d.cargados === 1 ? '' : 's'} · ${pesos(d.total)}` });
      refrescar();
      if (modo === 'suelto') { setImporte(''); setDetalle(''); setCliente(''); } else setCeldas({});
    } catch (e) {
      if (e?.status === 409 && e.data?.repetidos) setRepetidos(e.data.repetidos);
      else setErrores([e?.data?.error ?? 'No se pudo guardar.', ...(e?.data?.detalle ?? [])]);
    } finally {
      setGuardando(false);
    }
  }
  async function borrar(ids) {
    if (!ids.length) return;
    try {
      await GestionAPI.borrarVentasManuales(ids);
      setAviso({ sev: 'success', txt: ids.length === 1 ? 'Ingreso borrado' : `${ids.length} ingresos borrados` });
      refrescar();
    } catch {
      setAviso({ sev: 'error', txt: 'No se pudo borrar' });
    }
  }

  const sol = data?.solapadas ?? [];
  const idsSolapados = (data?.items ?? []).filter((i) => sol.some((s) => s.fecha === i.fecha)).map((i) => i.rowId);
  const celda2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, maxHeight: '90vh', display: 'flex', flexDirection: 'column' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2.5, pt: 2, pb: 1 }}>
        <div>
          <Box sx={{ fontSize: 18, fontWeight: 600 }}>Cargar ingreso</Box>
          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Ventas que no están en el PDV. Quedan marcadas MANUAL y reimportar no las toca.</Box>
        </div>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar" sx={{ ml: 'auto' }}><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
      </Box>
      <Box sx={{ overflowY: 'auto', px: 2.5, pb: 2.5 }}>
        {sol.length > 0 && (
          <Box sx={{ mb: 1.5, borderRadius: 3, border: '1px solid #fcd34d', bgcolor: '#fffbeb', px: 1.5, py: 1, fontSize: 12, color: '#78350f' }}>
            <b>Ya llegaron ventas de MaxiRest</b> en {sol.length} día{sol.length === 1 ? '' : 's'} con carga manual: {sol.slice(0, 6).map((s) => dm(s.fecha)).join(', ')}{sol.length > 6 ? '…' : ''}. Para no contar dos veces,{' '}
            <Box component="button" type="button" sx={sxLink} onClick={() => borrar(idsSolapados)}>borrá la carga manual de esos días</Box>.
          </Box>
        )}
        <Box sx={{ mb: 1.5, display: 'inline-flex', borderRadius: 2, bgcolor: 'grey.100', p: 0.25 }}>
          <Box component="button" type="button" sx={sxSeg(modo === 'suelto')} onClick={() => setModo('suelto')}>Ingreso suelto</Box>
          <Box component="button" type="button" sx={sxSeg(modo === 'dias')} onClick={() => setModo('dias')}>Varios días</Box>
        </Box>

        {modo === 'suelto' ? (
          <Box sx={celda2}>
            <div><Box component="span" sx={sxLab}>Fecha</Box><Box component="input" type="date" sx={sxInput} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            <div><Box component="span" sx={sxLab}>Importe</Box><Box component="input" inputMode="decimal" placeholder="0,00" sx={{ ...sxInput, textAlign: 'right', fontWeight: 600 }} value={importe} onChange={(e) => setImporte(fmtTipeo(e.target.value))} /></div>
            <div><Box component="span" sx={sxLab}>Tipo · opcional</Box><Opcional valor={tipo} opciones={tipos} onCambio={setTipo} /></div>
            <div><Box component="span" sx={sxLab}>Forma de cobro · opcional</Box><Opcional valor={cobro} opciones={cobros} onCambio={setCobro} /></div>
            <div><Box component="span" sx={sxLab}>Detalle / comprobante</Box><Box component="input" maxLength={120} sx={sxInput} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej: FC A 0006-00000123, evento" /></div>
            <div><Box component="span" sx={sxLab}>Cliente</Box><Box component="input" maxLength={80} sx={sxInput} value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
          </Box>
        ) : (
          <div>
            <Box sx={celda2}>
              <div><Box component="span" sx={sxLab}>Desde</Box><Box component="input" type="date" sx={sxInput} value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
              <div><Box component="span" sx={sxLab}>Hasta</Box><Box component="input" type="date" sx={sxInput} value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
            </Box>
            <Box sx={{ my: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ ...sxLab, mb: 0 }}>Columnas</Box>
              <Box sx={{ display: 'inline-flex', borderRadius: 2, bgcolor: 'grey.100', p: 0.25 }}>
                {[['tipo', 'Tipo'], ['cobro', 'Forma de cobro'], ['total', 'Solo total']].map(([k, t]) => (
                  <Box key={k} component="button" type="button" sx={sxSeg(columnas === k)} onClick={() => { setColumnas(k); setCeldas({}); }}>{t}</Box>
                ))}
              </Box>
            </Box>
            {dias.length > 0 ? (
              // La grilla scrollea en su propio recuadro y la fila de títulos queda fija arriba (Diego 06/11/2026).
              <Box sx={{ overflow: 'auto', maxHeight: 'min(52vh, 460px)' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `max-content repeat(${cols.length}, minmax(90px, 1fr))${cols.length > 1 ? ' max-content' : ''}`, alignItems: 'center', columnGap: 1, rowGap: 0.5, fontSize: 13 }}>
                  <Box sx={sxTitulo}>Día</Box>
                  {cols.map((c) => <Box key={c} sx={{ ...sxTitulo, textAlign: 'right' }}>{c === 'total' ? 'Total del día' : c}</Box>)}
                  {cols.length > 1 && <Box sx={{ ...sxTitulo, textAlign: 'right' }}>Total</Box>}
                  {dias.map((d, fi) => (
                    <React.Fragment key={d}>
                      <Box sx={{ whiteSpace: 'nowrap' }}>{diaCorto(d)}</Box>
                      {cols.map((c, ci) => (
                        <Box
                          key={c} component="input" inputMode="decimal" value={celdas[d]?.[c] ?? ''}
                          data-celda={`${fi}-${ci}`} onKeyDown={(e) => moverEnGrilla(e, fi, ci, dias.length, cols.length)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setCeldas((x) => ({ ...x, [d]: { ...(x[d] ?? {}), [c]: fmtTipeo(e.target.value) } }))}
                          sx={{ ...sxInput, height: 32, px: 1, textAlign: 'right', fontSize: 13 }}
                        />
                      ))}
                      {cols.length > 1 && <Box sx={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }}>{totalDia(d) ? pesos(totalDia(d)) : '—'}</Box>}
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            ) : <Box sx={{ py: 1.5, fontSize: 14, color: 'text.secondary' }}>Elegí el rango de días (hasta 62).</Box>}
            <Box sx={{ mt: 1.25 }}><Box component="span" sx={sxLab}>Detalle (para todos)</Box><Box component="input" maxLength={120} sx={sxInput} value={detalleDias} onChange={(e) => setDetalleDias(e.target.value)} placeholder="Ej: PDV caído, totales del cierre de caja" /></Box>
            <Box sx={{ mt: 0.75, fontSize: 11.5, color: 'text.secondary' }}>{columnas === 'tipo' ? 'Forma de cobro: queda sin especificar.' : columnas === 'cobro' ? 'Tipo: queda sin especificar.' : 'Tipo y forma de cobro quedan sin especificar.'}</Box>
          </div>
        )}

        {errores.length > 0 && <Box sx={{ mt: 1.5, borderRadius: 3, border: '1px solid #fca5a5', bgcolor: '#fef2f2', px: 1.5, py: 1, fontSize: 12, color: '#b91c1c' }}>{errores.map((e, i) => <div key={i}>• {e}</div>)}</Box>}
        {repetidos && (
          <Box sx={{ mt: 1.5, borderRadius: 3, border: '1px solid #fcd34d', bgcolor: '#fffbeb', px: 1.5, py: 1, fontSize: 12, color: '#78350f' }}>
            Ya hay {repetidos.length === 1 ? 'un ingreso igual cargado' : `${repetidos.length} ingresos iguales cargados`} ({repetidos.slice(0, 4).map((r) => `${dm(r.fecha)} ${pesos(r.importe)}`).join(', ')}{repetidos.length > 4 ? '…' : ''}). No se guardó nada.{' '}
            ¿Son otros? <Box component="button" type="button" sx={sxLink} onClick={() => guardar(true)}>Cargar igual</Box>
          </Box>
        )}
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Box component="button" type="button" disabled={guardando} onClick={() => guardar()} sx={{ all: 'unset', cursor: 'pointer', height: 36, px: 2, display: 'inline-flex', alignItems: 'center', borderRadius: 2, bgcolor: 'grey.900', color: '#fff', fontSize: 14, fontWeight: 600, '&:disabled': { opacity: 0.5 } }}>
            {guardando ? 'Guardando…' : modo === 'suelto' ? 'Guardar' : `Guardar ${diasConCarga} día${diasConCarga === 1 ? '' : 's'}`}
          </Box>
          <Box component="button" type="button" onClick={onClose} sx={{ all: 'unset', cursor: 'pointer', height: 36, px: 2, display: 'inline-flex', alignItems: 'center', borderRadius: 2, border: 1, borderColor: 'divider', fontSize: 14 }}>Cerrar</Box>
        </Box>

        {(data?.items.length ?? 0) > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={sxLab}>Cargados a mano</Box>
            <Box sx={{ maxHeight: 224, overflowY: 'auto', borderRadius: 3, border: 1, borderColor: 'divider' }}>
              {data.items.map((i) => (
                <Box key={i.rowId} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, fontSize: 13, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, bgcolor: sol.some((s) => s.fecha === i.fecha) ? 'rgba(255,251,235,.7)' : undefined }}>
                  <Box component="span" sx={{ width: 80, flexShrink: 0, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{dm(i.fecha)}</Box>
                  <Box component="span" sx={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[i.tipo, i.cobro].filter(Boolean).join(' · ') || 'Sin especificar'}{i.detalle ? <Box component="span" sx={{ color: 'text.disabled' }}> · {i.detalle}</Box> : null}
                  </Box>
                  <Box component="b" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pesos(i.importe)}</Box>
                  <IconButton size="small" title="Borrar" onClick={() => borrar([i.rowId])} sx={{ p: 0.5, '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
      <Snackbar open={!!aviso} autoHideDuration={3000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aviso ? <Alert severity={aviso.sev} variant="filled" onClose={() => setAviso(null)}>{aviso.txt}</Alert> : undefined}
      </Snackbar>
    </Dialog>
  );
}

// Select con "—" (sin especificar), las opciones del negocio y "Otro…" para escribir uno nuevo.
// Títulos de la grilla de varios días: fijos al scrollear.
const sxTitulo = { fontSize: 11, color: 'text.secondary', position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', py: 0.5, alignSelf: 'stretch' };

// Grilla de varios días como una planilla (Diego 06/11/2026): ↑ ↓ (y Enter) cambian de día, ← → de
// columna. ← y → solo saltan con el cursor en el borde del número, para poder corregir adentro.
function moverEnGrilla(e, fi, ci, nFilas, nCols) {
  const el = e.currentTarget;
  const enInicio = el.selectionStart === 0 && el.selectionEnd === 0;
  const enFin = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
  const todo = el.selectionStart === 0 && el.selectionEnd === el.value.length;
  let f = fi, c = ci;
  if (e.key === 'ArrowUp') f -= 1;
  else if (e.key === 'ArrowDown' || e.key === 'Enter') f += 1;
  else if (e.key === 'ArrowLeft' && (enInicio || todo)) c -= 1;
  else if (e.key === 'ArrowRight' && (enFin || todo)) c += 1;
  else return;
  if (f < 0 || f >= nFilas || c < 0 || c >= nCols) { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') e.preventDefault(); return; }
  e.preventDefault();
  const sig = el.closest('[role=dialog]')?.querySelector(`input[data-celda="${f}-${c}"]`);
  if (sig) sig.focus();
}

function Opcional({ valor, opciones, onCambio }) {
  const [otro, setOtro] = useState(false);
  if (otro || (valor && !opciones.includes(valor))) {
    return <Box component="input" autoFocus maxLength={40} value={valor} placeholder="Escribilo" sx={sxInput} onChange={(e) => onCambio(e.target.value.toUpperCase())} onBlur={() => { if (!valor) setOtro(false); }} />;
  }
  return (
    <Box component="select" sx={sxInput} value={valor} onChange={(e) => { if (e.target.value === '__otro') { setOtro(true); onCambio(''); } else onCambio(e.target.value); }}>
      <option value="">—</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__otro">Otro…</option>
    </Box>
  );
}
