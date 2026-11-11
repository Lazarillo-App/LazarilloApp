// src/componentes/gestion/SinRubro.jsx
// "Sin rubro · por qué" (Diego 06/11/2026): lo que cae en Sin rubro del tablero, agrupado por la causa
// y con lo que hay que hacer para corregirlo de raíz en MaxiRest. Se abre desde la tarjeta «Para mirar»
// (primera línea, solo si hay algo) y desde el chip «corregir» de la fila Sin rubro de la tabla.
// El panel se monta una sola vez (GestionPanel) y se abre con abrirSinRubro().
import React, { useEffect, useState } from 'react';
import { Box, Button, Drawer, IconButton, CircularProgress, TextField, Typography } from '@mui/material';
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

// Fecha de la compra, corta (dd/mm/aa). Diego 11/11/2026: sin la fecha no se sabe si es reposición o
// algo nuevo; va primero para que no la corte un proveedor largo.
const fechaCorta = (f) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}` : null);
const FechaCompra = ({ f }) => (fechaCorta(f)
  ? <Box component="span" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums', mr: 0.75 }}>{fechaCorta(f)}</Box>
  : null);

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
// Rubro de insumo: siempre el mismo concepto, o «depende de la compra» con varias opciones (Diego 07/11/2026,
// ej. Vajilla: Reposición → 702 Vajilla M / Ítem nuevo → 514 Vajilla I). Con opciones, al cargar se pregunta.
function EditorRubro({ it, conceptos, onCerrar, onGuardado }) {
  const e = it.editar;
  const previas = (e.alternativas ?? []).map((a) => ({ etiqueta: a.etiqueta, concepto: String(a.concepto) }));
  const [modo, setModo] = useState(previas.length >= 2 ? 'varios' : 'uno');
  const [valor, setValor] = useState('');
  const [alts, setAlts] = useState(previas.length >= 2 ? previas : [{ etiqueta: '', concepto: '' }, { etiqueta: '', concepto: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const opciones = conceptos.map((c) => ({ valor: String(c.codigo), texto: `${c.codigo} · ${c.nombre}` }));
  const cambiar = (k, campo, v) => setAlts((xs) => xs.map((x, i) => (i === k ? { ...x, [campo]: v } : x)));
  const completas = alts.filter((a) => a.etiqueta.trim() && a.concepto);
  const listo = modo === 'uno' ? !!valor : completas.length >= 2 && completas.length === alts.length;
  async function guardar() {
    setGuardando(true); setError(null);
    try {
      await GestionAPI.sinRubroRubroInsumo(e.codigo, modo === 'uno'
        ? { concepto: Number(valor) }
        : { alternativas: alts.map((a) => ({ etiqueta: a.etiqueta.trim(), concepto: Number(a.concepto) })) });
      onGuardado();
    } catch (err) {
      setError(err?.data?.error ?? 'No se pudo guardar');
      setGuardando(false);
    }
  }
  const seg = (on) => ({ all: 'unset', cursor: 'pointer', height: 30, display: 'inline-flex', alignItems: 'center', px: 1.5, fontSize: 12.5,
    bgcolor: on ? '#1f2937' : '#fff', color: on ? '#fff' : 'inherit', '& + &': { borderLeft: '1px solid #e5e7eb' } });
  return (
    <Box sx={sxCaja}>
      <Typography fontSize={12} fontWeight={500} sx={{ mb: 1 }}>Concepto de caja del rubro «{it.nombre}»</Typography>
      <Box sx={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden', mb: 1.25 }}>
        <Box component="button" type="button" sx={seg(modo === 'uno')} onClick={() => setModo('uno')}>Siempre el mismo</Box>
        <Box component="button" type="button" sx={seg(modo === 'varios')} onClick={() => setModo('varios')}>Depende de la compra</Box>
      </Box>
      {modo === 'uno' ? (
        <>
          <Box sx={{ mb: 1 }}><Buscador valor={valor} opciones={opciones} placeholder="Elegí un concepto" ancho={300} onCambio={setValor} /></Box>
          <Typography fontSize={11.5} color="text.secondary" sx={{ mb: 1.25 }}>Vale para todos sus insumos, también lo ya cargado.</Typography>
        </>
      ) : (
        <>
          <Typography fontSize={12} sx={{ mb: 0.75 }}>Al cargar se pregunta: <b>¿Es…?</b></Typography>
          {alts.map((a, k) => (
            <Box key={k} sx={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr) 22px', gap: 1, alignItems: 'center', mb: 1 }}>
              <TextField size="small" value={a.etiqueta} placeholder={k === 0 ? 'Ej. Reposición' : k === 1 ? 'Ej. Ítem nuevo' : 'Nombre'}
                slotProps={{ htmlInput: { maxLength: 40 } }} onChange={(ev) => cambiar(k, 'etiqueta', ev.target.value)} />
              <Buscador valor={a.concepto} opciones={opciones} placeholder="Concepto" ancho="100%" onCambio={(v) => cambiar(k, 'concepto', v)} />
              <IconButton size="small" aria-label="Quitar opción" disabled={alts.length <= 2} onClick={() => setAlts((xs) => xs.filter((_, i) => i !== k))}>
                <CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            </Box>
          ))}
          <Box component="button" type="button" onClick={() => setAlts((xs) => [...xs, { etiqueta: '', concepto: '' }])}
            sx={{ all: 'unset', cursor: 'pointer', color: '#0d6fa8', fontSize: 12.5, mb: 1.25, display: 'inline-block' }}>+ otra opción</Box>
        </>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="outlined" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
        <Button size="small" variant="contained" disabled={guardando || !listo} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </Box>
      {modo === 'varios' && it.cantidadComprobantes > 0 && (
        <Typography fontSize={11.5} color="text.secondary" sx={{ mt: 1.25, pt: 1, borderTop: '1px dashed #bae6fd' }}>
          {it.cantidadComprobantes === 1 ? 'La compra ya cargada queda' : `Las ${it.cantidadComprobantes} compras ya cargadas quedan`} en «Se decide en cada compra»: no se adivinan.
        </Typography>
      )}
      {error && <Typography color="error" fontSize={12} sx={{ mt: 1 }}>{error}</Typography>}
    </Box>
  );
}

// Una compra de un rubro con varios conceptos: un toque y queda resuelta (Diego 07/11/2026).
function CompraPorDecidir({ c, opciones, onVer, onResuelta }) {
  const [elegida, setElegida] = useState(null);
  const [error, setError] = useState(null);
  async function elegir(o) {
    if (elegida) return;
    setElegida(o.etiqueta); setError(null);
    try {
      await GestionAPI.sinRubroCompra(c.rowId, Number(o.concepto));
      setTimeout(onResuelta, 900);
    } catch (err) {
      setElegida(null);
      setError(err?.data?.error ?? 'No se pudo guardar');
    }
  }
  return (
    <Box sx={{ borderTop: '1px solid #f2f2f0', px: 2, py: 0.75 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 1, fontSize: 12, color: 'text.secondary', alignItems: 'center' }}>
        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <FechaCompra f={c.fecha} />
          <Box component="button" type="button" onClick={() => onVer(c)} sx={{ all: 'unset', cursor: 'pointer', color: '#0d6fa8', textDecoration: 'underline' }}>{c.comprobante}</Box>
          {c.proveedor ? <> · <Box component="span" sx={{ color: 'text.primary' }}>{c.proveedor}</Box></> : ''}
        </Box>
        <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'text.primary' }}>{fmtARS(c.importe)}</Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
        {opciones.map((o) => {
          const on = elegida === o.etiqueta;
          return (
            <Box key={o.etiqueta} component="button" type="button" onClick={() => elegir(o)}
              sx={{ all: 'unset', cursor: elegida ? 'default' : 'pointer', height: 28, display: 'inline-flex', alignItems: 'center', px: 1.25, borderRadius: 14, fontSize: 12.5, whiteSpace: 'nowrap',
                border: `1px solid ${on ? '#0d6fa8' : '#e5e7eb'}`, bgcolor: on ? '#0d6fa8' : '#fff', color: on ? '#fff' : 'inherit', fontWeight: on ? 600 : 400,
                opacity: elegida && !on ? 0.5 : 1, '&:hover': elegida ? {} : { borderColor: '#0d6fa8' } }}>{o.etiqueta}</Box>
          );
        })}
        {elegida ? <Box component="span" sx={{ fontSize: 11.5, color: '#2e7d32', ml: 0.5 }}>✓ guardado</Box>
          : c.insumos?.length ? <Box component="span" sx={{ fontSize: 11.5, color: 'text.secondary', ml: 0.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.insumos.join(', ')}</Box> : null}
      </Box>
      {error && <Typography color="error" fontSize={12} sx={{ mt: 0.5 }}>{error}</Typography>}
    </Box>
  );
}

function Editor({ it, maestros, rubrosInsumo, onCerrar, onGuardado }) {
  const e = it.editar;
  if (e.tipo === 'rubro-insumo') return <EditorRubro it={it} conceptos={maestros?.conceptos ?? []} onCerrar={onCerrar} onGuardado={onGuardado} />;
  return <EditorSimple it={it} maestros={maestros} rubrosInsumo={rubrosInsumo} onCerrar={onCerrar} onGuardado={onGuardado} />;
}

function EditorSimple({ it, maestros, rubrosInsumo, onCerrar, onGuardado }) {
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
  const titulo = { insumo: `Rubro del insumo «${it.nombre}»`,
    compra: `Concepto de caja de ${it.cantidadComprobantes === 1 ? 'la compra' : `las ${it.cantidadComprobantes} compras`}` }[e.tipo];
  async function guardar() {
    setGuardando(true); setError(null);
    try {
      if (e.tipo === 'insumo') await GestionAPI.sinRubroInsumo(e.id, valor);
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

function Item({ it, onVer, editando, onEditar, editor, onResuelta }) {
  const [abierto, setAbierto] = useState(false);
  const porCompra = !!it.opciones;
  const ej = porCompra ? `¿${it.opciones.map((o) => o.etiqueta).join(' o ')}?`
    : it.detalle.slice(0, 3).join(', ') + (it.detalle.length > 3 ? '…' : '');
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
        {porCompra ? <Box sx={{ textAlign: 'right', fontSize: 13, color: 'text.secondary' }} title="Compras por decidir">{it.cantidadComprobantes}</Box> : (
          <Box component="button" type="button" onClick={() => setAbierto((v) => !v)} title="Ver los comprobantes"
            sx={{ all: 'unset', cursor: 'pointer', textAlign: 'right', color: '#0d6fa8', textDecoration: 'underline', fontSize: 13 }}>
            {it.cantidadComprobantes}
          </Box>)}
        <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtARS(it.importe)}</Box>
      </Box>
      {editando && editor}
      {porCompra && it.comprobantes.map((c) => <CompraPorDecidir key={c.rowId} c={c} opciones={it.opciones} onVer={onVer} onResuelta={onResuelta} />)}
      {porCompra && it.cantidadComprobantes > it.comprobantes.length && <Box sx={{ px: 2, pb: 1, fontSize: 11.5, color: 'text.secondary' }}>+ {it.cantidadComprobantes - it.comprobantes.length} más (resolvé estas y aparecen)</Box>}
      {!porCompra && abierto && (
        <Box sx={{ px: 2, pb: 1 }}>
          {it.comprobantes.map((c) => (
            <Box key={c.rowId} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 1, py: 0.4, fontSize: 12, color: 'text.secondary' }}>
              <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <FechaCompra f={c.fecha} />
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
  const recalcular = async () => {
    await queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? '').startsWith('gestion') });
    refetch();
  };
  const guardado = async () => { setEditando(null); await recalcular(); };
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  return (
    <>
      {/* zIndex de modal (1300): con el panel maximizado (1250) el cajón quedaba atrás y «corregir» no se veía. */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} sx={{ zIndex: 1300 }} slotProps={{ paper: { sx: { width: 'min(480px, 100vw)' } } }}>
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
                <Item key={k} it={it} onVer={setVer} editando={editando === k} onEditar={() => setEditando(editando === k ? null : k)} onResuelta={recalcular}
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
