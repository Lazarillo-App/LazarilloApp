// src/componentes/gestion/OrganizarGastos.jsx
// «Organizá tus gastos» (usuaria + Diego, 17/11/2026): una sola pantalla para dejar el Panel armado de
// una vez, venga de donde venga la compra (cargada a mano, MaxiRest, Fudo…). Cada gasto entra al
// Panel por su concepto de caja, y el concepto sale del RUBRO DEL INSUMO (lo que tiene insumo: «esto es
// carne») o del PROVEEDOR (lo que no: alquiler, luz, contador). Acá se ven los que faltan, con una
// sugerencia ya puesta y ejemplos; «Guardar» asocia todo y corrige las compras que estaban en Sin rubro.
// Se monta una vez en GestionPanel y se abre con abrirOrganizar(); AvisoOrganizar es la franja que lo
// ofrece cuando hay algo para revisar. Celular: pantalla completa.
import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Drawer, IconButton, CircularProgress, TextField, Typography, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { showAlert } from '@/servicios/appAlert';
import { fmtARS } from '@/gestion/formato';

const EVENTO = 'lz:organizar-gastos';
// eslint-disable-next-line react-refresh/only-export-components -- abre el panel desde cualquier lado (como abrirSinRubro)
export const abrirOrganizar = () => window.dispatchEvent(new CustomEvent(EVENTO));

const useOrganizar = (habilitado = true) => useQuery({
  queryKey: ['gestion', 'organizar'],
  queryFn: () => GestionAPI.organizar(),
  enabled: habilitado,
  staleTime: 60_000,
});

const pendientesDe = (d) => (d ? d.rubros.filter((r) => !r.concepto && !r.varios).length + d.proveedores.filter((p) => !p.concepto && p.sin_concepto > 0).length : 0);

/** Franja que ofrece organizar cuando hay rubros o proveedores sin concepto. */
export function AvisoOrganizar() {
  const { data } = useOrganizar();
  const n = pendientesDe(data);
  if (!n) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: 1.25, px: 1.75, mb: 1.5, borderRadius: 2, border: '1px solid #f3d19c', bgcolor: '#fff8eb' }}>
      <Typography sx={{ flex: 1, minWidth: 220, fontSize: 13.5 }}>
        <b>Organizá tus gastos:</b> {n === 1 ? 'hay 1 rubro o proveedor' : `hay ${n} rubros o proveedores`} sin concepto de caja, por eso parte de las compras no entra al panel. Te dejamos una sugerencia para cada uno.
      </Typography>
      <Button variant="contained" disableElevation onClick={abrirOrganizar} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 40 }}>Organizar</Button>
    </Box>
  );
}

function Fila({ titulo, detalle, valor, sugerido, opciones, onCambio }) {
  const elegido = opciones.find((o) => o.codigo === valor) || null;
  return (
    <Box sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{titulo}</Typography>
        {detalle && <Typography sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'anywhere' }}>{detalle}</Typography>}
      </Box>
      <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
        <Autocomplete
          size="small" options={opciones} value={elegido}
          groupBy={(o) => o.rubro || 'Otros'}
          getOptionLabel={(o) => o.nombre}
          isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
          onChange={(_, o) => onCambio(o?.codigo ?? null)}
          renderInput={(p) => <TextField {...p} placeholder="Elegí un concepto de caja"
            helperText={sugerido && valor === sugerido ? 'Sugerido por Lazarillo' : ' '} />}
        />
      </Box>
    </Box>
  );
}

export function OrganizarGastosPanel() {
  const [abierto, setAbierto] = useState(false);
  const movil = useMediaQuery('(max-width:600px)');
  const qc = useQueryClient();
  const { data, isLoading } = useOrganizar(abierto);
  const [rubros, setRubros] = useState({});
  const [provs, setProvs] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  // Al abrir: lo elegido arranca en la sugerencia de Lazarillo (o lo que ya tenía).
  useEffect(() => {
    if (!abierto || !data) return;
    setRubros(Object.fromEntries(data.rubros.map((r) => [r.codigo, r.concepto || r.sugerido || null])));
    setProvs(Object.fromEntries(data.proveedores.map((p) => [p.id, p.concepto || p.sugerido || null])));
  }, [abierto, data]);

  const rubrosVer = useMemo(() => (data?.rubros || []).filter((r) => !r.varios && (verTodo || !r.concepto)), [data, verTodo]);
  const provsVer = useMemo(() => (data?.proveedores || []).filter((p) => verTodo || (!p.concepto && p.sin_concepto > 0)), [data, verTodo]);
  const cambiosRubros = (data?.rubros || []).filter((r) => !r.varios && rubros[r.codigo] && rubros[r.codigo] !== r.concepto);
  const cambiosProvs = (data?.proveedores || []).filter((p) => provs[p.id] && provs[p.id] !== p.concepto);
  const total = cambiosRubros.length + cambiosProvs.length;

  const guardar = async () => {
    setGuardando(true);
    let ok = 0;
    const errores = [];
    for (const r of cambiosRubros) {
      try { await GestionAPI.sinRubroRubroInsumo(r.codigo, { concepto: rubros[r.codigo] }); ok++; } catch (e) { errores.push(`${r.nombre}: ${e?.data?.error || e?.message}`); }
    }
    for (const p of cambiosProvs) {
      try { await GestionAPI.organizarProveedor(p.id, provs[p.id]); ok++; } catch (e) { errores.push(`${p.nombre}: ${e?.data?.error || e?.message}`); }
    }
    setGuardando(false);
    qc.invalidateQueries({ queryKey: ['gestion'] });
    if (errores.length) showAlert(`Se guardaron ${ok}. No se pudo: ${errores.join(' · ')}`, 'warning');
    else { showAlert(ok === 1 ? 'Listo: 1 asociación guardada.' : `Listo: ${ok} asociaciones guardadas. El panel ya las usa.`, 'success'); setAbierto(false); }
  };

  const opciones = data?.conceptos || [];
  return (
    <Drawer anchor="right" open={abierto} onClose={() => setAbierto(false)}
      PaperProps={{ sx: { width: movil ? '100%' : 560, maxWidth: '100%', display: 'flex', flexDirection: 'column' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 17 }}>Organizá tus gastos</Typography>
        <IconButton onClick={() => setAbierto(false)} aria-label="Cerrar"><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mb: 1.5 }}>
          Cada compra entra al panel por su <b>concepto de caja</b>. Lo que tiene insumo va por el <b>rubro del insumo</b> («esto es carne»); lo que no, por el <b>proveedor</b> (alquiler, luz, contador). Se asocia una vez y queda para siempre: las compras que estaban en Sin rubro se acomodan solas.
        </Typography>
        {isLoading || !data ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box> : (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mt: 1 }}>Rubros de insumo</Typography>
            {rubrosVer.length ? rubrosVer.map((r) => (
              <Fila key={r.codigo} titulo={r.nombre || `Rubro ${r.codigo}`}
                detalle={`${r.insumos} insumo${r.insumos === 1 ? '' : 's'}${r.ejemplos.length ? `: ${r.ejemplos.join(', ')}${r.insumos > r.ejemplos.length ? '…' : ''}` : ''}`}
                valor={rubros[r.codigo] ?? null} sugerido={r.sugerido} opciones={opciones}
                onCambio={(v) => setRubros((x) => ({ ...x, [r.codigo]: v }))} />
            )) : <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>Todos los rubros tienen concepto. ✓</Typography>}

            <Typography sx={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mt: 2.5 }}>Proveedores (gastos sin insumo)</Typography>
            {provsVer.length ? provsVer.map((p) => (
              <Fila key={p.id} titulo={p.nombre}
                detalle={p.sin_concepto ? `${p.sin_concepto} compra${p.sin_concepto === 1 ? '' : 's'} sin concepto · ${fmtARS(p.importe_sin_concepto)}` : `${p.compras} compra${p.compras === 1 ? '' : 's'}`}
                valor={provs[p.id] ?? null} sugerido={p.sugerido} opciones={opciones}
                onCambio={(v) => setProvs((x) => ({ ...x, [p.id]: v }))} />
            )) : <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>Ningún proveedor tiene compras sin concepto. ✓</Typography>}

            <Button size="small" onClick={() => setVerTodo((v) => !v)} sx={{ mt: 1.5, textTransform: 'none' }}>
              {verTodo ? 'Ver solo lo que falta' : 'Ver también lo que ya está organizado'}
            </Button>
          </>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Button onClick={() => setAbierto(false)} sx={{ textTransform: 'none', minHeight: 44 }}>Cancelar</Button>
        <Button variant="contained" disableElevation disabled={!total || guardando} onClick={guardar}
          startIcon={guardando ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}>
          {total ? `Guardar ${total} asociaci${total === 1 ? 'ón' : 'ones'}` : 'Nada para guardar'}
        </Button>
      </Box>
    </Drawer>
  );
}
