// src/componentes/gestion/SinRubro.jsx
// "Sin rubro · por qué" (Diego 06/11/2026): lo que cae en Sin rubro del tablero, agrupado por la causa
// y con lo que hay que hacer para corregirlo de raíz en MaxiRest. Se abre desde la tarjeta «Para mirar»
// (primera línea, solo si hay algo) y desde el chip «corregir» de la fila Sin rubro de la tabla.
// El panel se monta una sola vez (GestionPanel) y se abre con abrirSinRubro().
import React, { useEffect, useState } from 'react';
import { Box, Button, Drawer, IconButton, CircularProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS } from '@/gestion/formato';
import { VerFactura } from './CargarFactura';
import { Buscador, Formulario as FormularioConcepto } from '@/paginas/GestionConceptos';
import { esPropio } from '@/gestion/cargaUtils';

const AMBAR = '#b45309';
const EVENTO = 'lz:sin-rubro';
const millones = (n) => `$ ${(n / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;

export const abrirSinRubro = () => window.dispatchEvent(new CustomEvent(EVENTO));

export function useSinRubro() {
  const { businessId, year, sucursal } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionSinRubro', businessId, year, sucursal ?? 'todas'],
    queryFn: () => GestionAPI.sinRubro({ anio: year, sucursal }),
    enabled: !!businessId,
    staleTime: 60_000,
  });
}

// Primera línea de «Para mirar»: solo cuando hay algo (si queda vacío, desaparece).
export function SinRubroLinea() {
  const { data } = useSinRubro();
  if (!data || Math.abs(data.importe) < 0.01) return null;
  return (
    <Box component="button" type="button" onClick={abrirSinRubro}
      sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75, width: '100%', fontWeight: 700, color: AMBAR, '&:hover': { textDecoration: 'underline' } }}>
      <Box component="span" sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: '#f59e0b' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sin rubro · {millones(data.importe)}</Box>
      <Box component="span" sx={{ ml: 'auto', color: 'text.secondary', fontWeight: 400 }}>›</Box>
    </Box>
  );
}

// Chip de la fila Sin rubro de la tabla.
export function ChipCorregir() {
  return (
    <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); abrirSinRubro(); }}
      sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: 22, px: 1, ml: 1, borderRadius: 11, fontSize: 11.5, fontWeight: 600,
        border: '1px solid #f3d29b', bgcolor: '#fff', color: AMBAR, verticalAlign: 'middle', '&:hover': { bgcolor: '#fff8eb' } }}>
      corregir ›
    </Box>
  );
}

const sxCaja = { mx: 2, my: 1, borderRadius: 2, border: '1px solid #bae6fd', bgcolor: 'rgba(240,249,255,.6)', p: 1.5 };

// Corregir un ítem ahí mismo (Diego 06/11): rubro de insumo → concepto, insumo → rubro (como en Insumos),
// compra sin insumo → concepto, concepto → rubro (el mismo formulario del sector Conceptos).
function Editor({ it, maestros, rubrosInsumo, onCerrar, onGuardado }) {
  const e = it.editar;
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const conceptos = maestros?.conceptos ?? [];
  if (e.tipo === 'concepto') {
    const c = conceptos.find((x) => x.codigo === e.codigo);
    if (!c) return <Box sx={sxCaja}><Typography fontSize={12}>Cargando el concepto…</Typography></Box>;
    const inicial = { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo ?? '-', codRubro: c.codRubro != null ? String(c.codRubro) : '', padrino: null,
      ...(esPropio(c.codigo) ? {} : { original: c.original ?? { nombre: c.nombre, tipo: c.tipo, codRubro: c.codRubro, rubro: c.rubro }, editado: !!c.editado }) };
    return <FormularioConcepto inicial={inicial} rubros={maestros?.rubros ?? []} conceptos={conceptos} onCerrar={onCerrar} onGuardado={onGuardado} onAviso={() => {}} />;
  }
  const porRubro = e.tipo === 'insumo';
  const opciones = porRubro
    ? rubrosInsumo.map((r) => ({ valor: String(r.codigo), texto: r.nombre }))
    : conceptos.map((c) => ({ valor: String(c.codigo), texto: `${c.codigo} · ${c.nombre}${c.rubro ? ` (${c.rubro})` : ''}` }));
  const titulo = { 'rubro-insumo': `Concepto de caja del rubro «${it.nombre}» · vale para todos sus insumos, también lo ya cargado`,
    insumo: `Rubro del insumo «${it.nombre}»`,
    compra: `Concepto de caja de ${it.cantidadComprobantes === 1 ? 'la compra' : `las ${it.cantidadComprobantes} compras`}` }[e.tipo];
  async function guardar() {
    setGuardando(true); setError(null);
    try {
      if (e.tipo === 'rubro-insumo') await GestionAPI.sinRubroRubroInsumo(e.codigo, Number(valor));
      else if (e.tipo === 'insumo') await GestionAPI.sinRubroInsumo(e.id, valor);
      else await Promise.all(it.comprobantes.map((c) => GestionAPI.sinRubroCompra(c.rowId, Number(valor))));
      onGuardado();
    } catch (err) {
      setError(err?.data?.error ?? 'No se pudo guardar');
      setGuardando(false);
    }
  }
  return (
    <Box sx={sxCaja}>
      <Typography fontSize={12} fontWeight={500} sx={{ mb: 1 }}>{titulo}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Buscador valor={valor} opciones={opciones} placeholder={porRubro ? 'Elegí un rubro' : 'Elegí un concepto'} ancho={300} onCambio={setValor} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button size="small" variant="contained" disabled={guardando || !valor} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </Box>
      </Box>
      {error && <Typography color="error" fontSize={12} sx={{ mt: 1 }}>{error}</Typography>}
    </Box>
  );
}

function Item({ it, onVer, editando, onEditar, editor }) {
  const [abierto, setAbierto] = useState(false);
  const ej = it.detalle.slice(0, 3).join(', ') + (it.detalle.length > 3 ? '…' : '');
  return (
    <Box sx={{ borderTop: '1px solid #f2f2f0' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 54px 104px', gap: 1, px: 2, py: 0.9, alignItems: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          {it.editar ? (
            <Box component="button" type="button" onClick={onEditar} title="Corregir"
              sx={{ all: 'unset', cursor: 'pointer', fontSize: 13.5, overflowWrap: 'anywhere',
                color: editando ? '#0d6fa8' : 'inherit', '&:hover': { color: '#0d6fa8' }, '&:hover .lz-lapiz': { opacity: 1 } }}>
              {it.nombre}
              <EditOutlinedIcon className="lz-lapiz" sx={{ fontSize: 14, ml: 0.5, verticalAlign: '-2px', color: '#0d6fa8', opacity: editando ? 1 : 0.45 }} />
            </Box>
          ) : <Box sx={{ fontSize: 13.5 }}>{it.nombre}</Box>}
          {ej && <Box sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.detalle.join(', ')}>{ej}</Box>}
        </Box>
        <Box component="button" type="button" onClick={() => setAbierto((v) => !v)} title="Ver los comprobantes"
          sx={{ all: 'unset', cursor: 'pointer', textAlign: 'right', color: '#0d6fa8', textDecoration: 'underline', fontSize: 13 }}>
          {it.cantidadComprobantes}
        </Box>
        <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtARS(it.importe)}</Box>
      </Box>
      {editando && editor}
      {abierto && (
        <Box sx={{ px: 2, pb: 1 }}>
          {it.comprobantes.map((c) => (
            <Box key={c.rowId} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 1, py: 0.4, fontSize: 12, color: 'text.secondary' }}>
              <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Box component="button" type="button" onClick={() => onVer(c)} sx={{ all: 'unset', cursor: 'pointer', color: '#0d6fa8', textDecoration: 'underline' }}>{c.comprobante}</Box>
                {c.proveedor ? ` · ${c.proveedor}` : ''}
              </Box>
              <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtARS(c.importe)}</Box>
            </Box>
          ))}
          {it.cantidadComprobantes > it.comprobantes.length && <Box sx={{ fontSize: 11.5, color: 'text.secondary' }}>+ {it.cantidadComprobantes - it.comprobantes.length} más</Box>}
        </Box>
      )}
    </Box>
  );
}

export function SinRubroPanel() {
  const [open, setOpen] = useState(false);
  const [ver, setVer] = useState(null);
  const { year } = usePanelGestion();
  const { data, isLoading, refetch } = useSinRubro();
  const [editando, setEditando] = useState(null);
  const queryClient = useQueryClient();
  const { businessId } = usePanelGestion();
  const { data: maestros } = useQuery({
    queryKey: ['gestionConceptos', businessId],
    queryFn: () => GestionAPI.conceptos(),
    enabled: open && !!businessId,
    staleTime: 60_000,
  });
  // Tras corregir: se recalcula todo el Panel (tabla, tarjetas, este panel) y el sector Conceptos.
  const guardado = async () => {
    setEditando(null);
    await queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? '').startsWith('gestion') });
    refetch();
  };
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  return (
    <>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { width: 'min(480px, 100vw)' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid #e8e8e6' }}>
          <Box sx={{ fontWeight: 700, fontSize: 15 }}>Sin rubro · por qué</Box>
          <Box sx={{ ml: 'auto', color: 'text.secondary', fontSize: 13 }}>{year}{data ? ` · ${fmtARS(data.importe)}` : ''}</Box>
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Cerrar"><CloseIcon fontSize="small" /></IconButton>
        </Box>
        {isLoading && <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>}
        {data && !data.grupos.length && <Box sx={{ p: 3, color: 'text.secondary', fontSize: 13 }}>No hay nada sin rubro en {year}.</Box>}
        {data?.grupos.map((g, i) => (
          <Box key={g.tipo} sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, px: 2, pt: 1.5, fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'text.secondary' }}>
              <span>{i + 1} · {g.titulo}</span>
              <Box component="span" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>{g.items.length} · {millones(g.importe)}</Box>
            </Box>
            <Box sx={{ px: 2, pt: 0.5, pb: 1, fontSize: 12, color: 'text.secondary' }}>{g.accion}</Box>
            {g.items.map((it) => {
              const k = `${g.tipo}|${it.nombre}`;
              return (
                <Item key={k} it={it} onVer={setVer} editando={editando === k} onEditar={() => setEditando(editando === k ? null : k)}
                  editor={<Editor key={k} it={it} maestros={maestros} rubrosInsumo={data.rubrosInsumo ?? []} onCerrar={() => setEditando(null)} onGuardado={guardado} />} />
              );
            })}
          </Box>
        ))}
        {data && data.grupos.length > 0 && (
          <Box sx={{ px: 2, py: 1.5, mt: 'auto', borderTop: '1px solid #e8e8e6', fontSize: 11.5, color: 'text.secondary' }}>
            Tocá el nombre para corregirlo acá (vale solo en Lazarillo). Lo que corrijas en MaxiRest se pasa solo en la próxima actualización.
          </Box>
        )}
      </Drawer>
      {ver && <VerFactura rowId={ver.rowId} detalle={ver.comprobante} onClose={() => setVer(null)} />}
    </>
  );
}
