import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, Box, Stack, Typography, TextField, Checkbox,
  Button, IconButton, Paper, Popper, ClickAwayListener, InputAdornment, Divider,
} from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import SelectorBuscable from './SelectorBuscable';
import { showConfirm } from '@/servicios/appConfirm';

// Mismos tokens que RecetaModal/helpers.js — los colores del negocio, no el
// tema genérico de MUI. Se duplican acá (son 2 líneas) para no acoplar este
// componente compartido a la carpeta de RecetaModal.
const PRIMARY = 'var(--color-primary, #3b82f6)';
const ON_PRIMARY = 'var(--on-primary, #fff)';

/* ──────────────────────────────────────────────────────────────
   EditarItemModal — Lazarillo Gestión

   Un solo modal para artículo y para insumo: la estructura es la misma
   y lo único que cambia son los campos propios de cada uno.

       tipo="articulo"  → Agrupación + Rubro + Subrubro + Descripción
                          + los precios por lista, debajo de la foto
       tipo="insumo"    → Agrupación + Rubro + Unidad + Precio de referencia

   Sobre los precios: en Lazarillo una lista es la favorita (la base) y las
   demás aplican un descuento o recargo sobre ella. Por eso acá solo se carga
   la base: las derivadas se muestran calculadas y no se editan. Si se
   pudieran escribir, se rompería la regla que define la configuración.

   Sobre el modal actual se agregan cuatro cosas:
     · flechas ‹ › para recorrer la lista sin cerrar
     · contador "4 de 8"
     · buscador por código o nombre que salta directo
     · foto, igual que en el modal de receta

   Y los selectores de rubro / subrubro / unidad pasan a ser
   SelectorBuscable: tienen buscador adentro y la fila de "Crear …"
   queda fija arriba, fuera del scroll.

   IMPORTANTE — las flechas recorren `items`, que tiene que ser la lista
   tal como está filtrada y ordenada en la tabla de atrás, no el maestro
   completo. Si no, el usuario toca › y aparece algo que no tiene que ver.
   ────────────────────────────────────────────────────────────── */

const CFG = {
  articulo: {
    titulo: 'Editar artículo',
    tomar: 'Tomar rubro/subrubro/precio de otro artículo',
    foto: 'Foto del artículo',
  },
  insumo: {
    titulo: 'Editar insumo',
    tomar: 'Tomar rubro/unidad/precio de otro insumo',
    foto: 'Foto del insumo',
  },
};

const vacio = (x) => x === undefined || x === null || x === '';

// Parser de número consciente del formato es-AR, usado en toda la app
// (toLocaleString('es-AR') agrupa de a 3 con punto). Un Number() directo
// rompe "670.000" (seiscientos setenta mil) leyéndolo como 670 — el punto
// en JS siempre es separador decimal, nunca de miles.
function parseNumeroAR(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  const tieneComa = s.includes(',');
  const tienePunto = s.includes('.');
  if (tieneComa && tienePunto) {
    // "670.000,50" → punto = miles, coma = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    // "67,5" → la coma es el separador decimal
    s = s.replace(',', '.');
  } else if (tienePunto) {
    // Solo puntos: ambiguo entre miles ("670.000") y decimal ("67.5").
    // Mismo criterio que toLocaleString('es-AR'): un grupo de EXACTAMENTE
    // 3 dígitos después del último punto es separador de miles.
    const partes = s.split('.');
    const ultima = partes[partes.length - 1];
    if (partes.length > 1 && ultima.length === 3) {
      s = partes.join('');
    }
    // si no, se deja el punto como decimal (ej. "67.5")
  }
  return Number(s);
}

// Devuelve el número parseado, o null si quedó vacío/no-numérico — "vacío"
// no es lo mismo que "cero" (un artículo sin precio cargado vs. uno que vale 0).
function numOrNull(raw) {
  if (raw === '' || raw == null) return null;
  const n = parseNumeroAR(raw);
  return Number.isFinite(n) ? n : null;
}

export default function EditarItemModal({
  open,
  tipo = 'articulo',
  items = [],                 // la lista de la tabla, en su orden y con su filtro
  itemId,                     // código del que se abre
  agrupaciones = [],
  // string[] | {nombre, subrubros: string[]}[] — si cada rubro trae sus
  // propios subrubros anidados (como ya devuelve GET /businesses/:id/rubros),
  // el selector de Subrubro se acota solo a los del rubro elegido, igual que
  // en el modal viejo (subrubrosDelRubro en ABMModals.jsx).
  rubros = [],
  unidades = ['U', 'kg', 'gr', 'lt', 'ml', 'porción'],
  // Las listas de precio configuradas en Lazarillo. Hoy son cuatro, pero el
  // componente toma las que le pasen: si mañana son seis, no hay que tocarlo.
  // Las listas tal como se configuran en Lazarillo: una con tipo 'base' y
  // las demás con 'descuento' o 'recargo' y su porcentaje sobre la base.
  listas = [
    { id: 1, nombre: 'PRECIO DE LISTA', tipo: 'base',      valor: 0,  color: '#2E86C1' },
    { id: 2, nombre: 'EFECTIVO',        tipo: 'descuento', valor: 10, color: '#27AE60' },
    { id: 3, nombre: 'TAKEAWAY',        tipo: 'descuento', valor: 20, color: '#E67E22' },
  ],
  onClose,
  onGuardar,                  // (datos) => void | Promise
  onBorrar,                   // (id) => void
  onNavegar,                  // (id) => void — opcional, para avisar al padre
  onCrearAgrupacion,          // (nombre|null) => void
  onCrearRubro,               // (nombre|null) => void
  onCrearSubrubro,            // (nombre|null) => void
  onSubirFoto,                // (file) => Promise<url>
}) {
  const cfg = CFG[tipo] ?? CFG.articulo;

  const idx = useMemo(
    () => Math.max(0, items.findIndex((x) => String(x.id ?? x.codigo) === String(itemId))),
    [items, itemId]);

  const [i, setI] = useState(idx);
  useEffect(() => { setI(idx); }, [idx]);

  const item = items[i];

  // ── borrador local: no se toca el item hasta guardar ──
  const [d, setD] = useState({});
  const [sucio, setSucio] = useState(false);
  useEffect(() => {
    if (!item) return;
    setD({
      nombre: item.nombre ?? '',
      agrupacion: item.agrupacion ?? null,
      rubro: item.rubro ?? null,
      subrubro: item.subrubro ?? null,
      unidad: item.unidad ?? null,
      precio: item.precio ?? '',
      descripcion: item.descripcion ?? '',
      // Solo el precio de la lista base. Vacío no es cero: un artículo sin
      // precio cargado y uno que vale cero no son lo mismo.
      precioBase: item.precioBase ?? item.precio ?? '',
      foto: item.foto ?? null,
    });
    setSucio(false);
  }, [item]);

  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setSucio(true); };
  // Cambiar de rubro vacía el subrubro: uno de otro rubro no tiene sentido acá.
  const setRubro = (v) => { setD((p) => ({ ...p, rubro: v, subrubro: '' })); setSucio(true); };

  // Nombres de rubro, y los subrubros ANIDADOS del rubro actualmente elegido
  // (si `rubros` vino como objetos {nombre, subrubros}; si vino como string[]
  // plano, no hay anidado y el selector de subrubro queda vacío).
  const rubroNombres = useMemo(
    () => rubros.map((r) => (typeof r === 'string' ? r : r?.nombre)).filter(Boolean),
    [rubros]);
  const subrubrosDelRubro = useMemo(() => {
    const r = rubros.find((x) => (typeof x === 'string' ? x : x?.nombre) === d.rubro);
    return (typeof r === 'object' && Array.isArray(r?.subrubros)) ? r.subrubros : [];
  }, [rubros, d.rubro]);

  // El precio de una lista derivada no se guarda: sale de la base.
  const precioDe = useCallback((l) => {
    const base = parseNumeroAR(d.precioBase);
    if (!Number.isFinite(base) || base === 0) return null;
    if (l.tipo === 'base') return base;
    if (l.tipo === 'descuento') return base * (1 - (l.valor ?? 0) / 100);
    if (l.tipo === 'recargo') return base * (1 + (l.valor ?? 0) / 100);
    return base;
  }, [d.precioBase]);

  // Confirma antes de perder cambios sin guardar — navegar (‹ ›, buscador) o
  // cerrar descartaba el borrador en silencio; con la navegación rápida entre
  // ítems que esto habilita, era fácil perder una edición sin darse cuenta.
  const confirmarSiSucio = useCallback(async (mensaje) => {
    if (!sucio) return true;
    return showConfirm(mensaje, { danger: true });
  }, [sucio]);

  // ── navegación ──
  const irA = useCallback(async (n) => {
    if (!items.length) return;
    if (!(await confirmarSiSucio('Tenés cambios sin guardar en este ítem. ¿Descartarlos y continuar?'))) return;
    const t = (n + items.length) % items.length;
    setI(t);
    onNavegar?.(items[t].id ?? items[t].codigo);
  }, [items, onNavegar, confirmarSiSucio]);

  const cerrar = useCallback(async () => {
    if (!(await confirmarSiSucio('Tenés cambios sin guardar. ¿Cerrar igual?'))) return;
    onClose?.();
  }, [confirmarSiSucio, onClose]);

  // ── buscador de ítems ──
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState('');
  const lupaRef = useRef(null);
  const qRef = useRef(null);
  useEffect(() => { if (buscando) setTimeout(() => qRef.current?.focus(), 30); else setQ(''); }, [buscando]);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items
      .map((x, n) => ({ x, n }))
      .filter(({ x }) => !t
        || String(x.id ?? x.codigo).includes(t)
        || String(x.nombre ?? '').toLowerCase().includes(t))
      .slice(0, 50);
  }, [items, q]);

  const irAResultado = useCallback(async (n) => {
    if (!(await confirmarSiSucio('Tenés cambios sin guardar en este ítem. ¿Descartarlos y continuar?'))) return;
    setI(n);
    setBuscando(false);
    onNavegar?.(items[n].id ?? items[n].codigo);
  }, [items, onNavegar, confirmarSiSucio]);

  useEffect(() => {
    if (!open) return;
    const k = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') irA(i - 1);
      if (e.key === 'ArrowRight') irA(i + 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, i, irA]);

  if (!item) return null;

  const faltan = vacio(d.nombre) || vacio(d.rubro) || (tipo === 'insumo' && vacio(d.unidad));

  const guardar = () => {
    if (faltan) return;
    const payload = { ...d };
    if (tipo === 'articulo') payload.precioBase = numOrNull(d.precioBase);
    else payload.precio = numOrNull(d.precio);
    onGuardar?.({ id: item.id ?? item.codigo, tipo, ...payload });
  };

  const subirFoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !onSubirFoto) return;
    const url = await onSubirFoto(f);
    if (url) set('foto', url);
  };

  return (
    <Dialog open={!!open} onClose={cerrar} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: 'visible' } }}>

      {/* ───────── encabezado: navegación, posición y buscador ─────────
          Mismo estilo y lugar que el header de RecetaModal: flecha
          anterior a la izquierda del nombre, flecha siguiente a la
          derecha, colores del negocio (no el tema genérico de MUI). */}
      <Stack direction="row" alignItems="center" spacing={2}
        sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, px: 3, py: 1.5, borderRadius: '8px 8px 0 0', gap: 2 }}>

        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <IconButton size="small" sx={{ p: 0.25, mt: '-2px', color: 'inherit', opacity: i > 0 ? 1 : 0.3 }}
            disabled={i <= 0} title="Anterior (←)" onClick={() => irA(i - 1)}>
            <KeyboardArrowLeftIcon />
          </IconButton>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {cfg.titulo}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              #{item.id ?? item.codigo}{item.rubro ? ` · ${item.rubro}` : ''}
            </Typography>
          </Box>

          <IconButton size="small" sx={{ p: 0.25, mt: '-2px', color: 'inherit', opacity: i < items.length - 1 ? 1 : 0.3 }}
            disabled={i >= items.length - 1} title="Siguiente (→)" onClick={() => irA(i + 1)}>
            <KeyboardArrowRightIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Box ref={lupaRef} sx={{ position: 'relative' }}>
          <IconButton size="small" onClick={() => setBuscando((b) => !b)} title="Buscar" sx={{ color: 'inherit' }}>
            <SearchIcon fontSize="small" />
          </IconButton>
          <Popper open={buscando} anchorEl={lupaRef.current} placement="bottom-end" style={{ zIndex: 1400 }}>
            <ClickAwayListener onClickAway={() => setBuscando(false)}>
              <Paper elevation={8} sx={{ mt: 1, width: 350, borderRadius: 1.5, overflow: 'hidden' }}>
                <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <TextField inputRef={qRef} value={q} onChange={(e) => setQ(e.target.value)}
                    size="small" fullWidth placeholder="Buscar por código o nombre…"
                    onKeyDown={(e) => { if (e.key === 'Escape') setBuscando(false); }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Box component="span" sx={{ fontSize: 13, color: 'text.disabled' }}>🔍</Box>
                          </InputAdornment>
                        ),
                      },
                    }} />
                </Box>
                <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
                  {resultados.length === 0 ? (
                    <Typography sx={{ px: 1.6, py: 1.4, fontSize: '0.8rem', color: 'text.secondary' }}>
                      Sin resultados
                    </Typography>
                  ) : resultados.map(({ x, n }) => (
                    <Stack key={x.id ?? x.codigo} direction="row" spacing={1.2}
                      onClick={() => irAResultado(n)}
                      sx={{
                        px: 1.6, py: 0.9, cursor: 'pointer', borderBottom: '1px solid',
                        borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' },
                        bgcolor: n === i ? 'action.selected' : 'transparent',
                      }}>
                      <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary',
                        width: 52, flex: '0 0 52px', fontVariantNumeric: 'tabular-nums' }}>
                        {x.id ?? x.codigo}
                      </Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '0.82rem' }}>{x.nombre}</Typography>
                        {x.rubro && (
                          <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                            {x.rubro}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ))}
                </Box>
              </Paper>
            </ClickAwayListener>
          </Popper>
        </Box>

        <IconButton size="small" onClick={cerrar} sx={{ color: 'inherit' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* ───────── cuerpo ───────── */}
      <DialogContent sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch">

          {/* foto, como en el modal de receta */}
          <Box sx={{ width: { xs: '100%', sm: tipo === 'articulo' ? 228 : 148 }, flex: { sm: tipo === 'articulo' ? '0 0 228px' : '0 0 148px' } }}>
            <Box component="label"
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: .8, height: 148, border: '1px solid', borderColor: 'divider', borderRadius: 2,
                bgcolor: 'action.hover', cursor: 'pointer', overflow: 'hidden',
                '&:hover': { borderColor: 'primary.main' },
              }}>
              <input type="file" accept="image/*" hidden onChange={subirFoto} />
              {d.foto ? (
                <Box component="img" src={d.foto} alt=""
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <Box component="span" sx={{ fontSize: 26, color: 'text.disabled', lineHeight: 1 }}>🖼</Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{cfg.foto}</Typography>
                </>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textAlign: 'center', mt: .7 }}>
              {d.foto ? 'Tocá para cambiarla' : 'Tocá para agregar foto'}
            </Typography>

            {/* Precios por lista, debajo de la foto. Solo en artículo:
                un insumo tiene un precio de referencia y nada más.
                Se carga únicamente la base; las derivadas se calculan. */}
            {tipo === 'articulo' && listas.length > 0 && (
              <Box sx={{ mt: 1.6, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Typography sx={{
                  bgcolor: 'action.hover', px: 1.2, py: .7, fontSize: '0.55rem', fontWeight: 800,
                  letterSpacing: '.06em', color: 'text.disabled',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}>
                  PRECIOS POR LISTA
                </Typography>

                {listas.map((l) => {
                  const esBase = l.tipo === 'base';
                  const v = precioDe(l);
                  return (
                    <Stack key={l.id} direction="row" alignItems="center" spacing={.8}
                      sx={{ px: 1.1, py: .6, borderBottom: '1px solid', borderColor: 'divider' }}>

                      <Box sx={{ width: 8, height: 8, borderRadius: .4, flex: '0 0 8px',
                        bgcolor: l.color || 'grey.400' }} />

                      <Typography noWrap sx={{ fontSize: '0.6rem', color: 'text.secondary', flex: 1, minWidth: 0 }}>
                        {l.nombre}
                      </Typography>

                      <Typography sx={{
                        fontSize: '0.56rem', fontWeight: 700, flex: '0 0 auto',
                        color: esBase ? '#B07B23' : 'text.disabled',
                      }}>
                        {esBase ? '★' : `${l.tipo === 'descuento' ? '−' : '+'}${l.valor}%`}
                      </Typography>

                      {esBase ? (
                        <TextField
                          size="small" placeholder="—"
                          value={d.precioBase ?? ''}
                          onChange={(e) => set('precioBase', e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: <InputAdornment position="start"
                                sx={{ mr: .4, '& p': { fontSize: '0.64rem' } }}>$</InputAdornment>,
                              sx: { fontSize: '0.74rem' },
                            },
                            htmlInput: { style: { textAlign: 'right', padding: '3px 0' } },
                          }}
                          sx={{ width: 94, flex: '0 0 94px' }} />
                      ) : (
                        <Stack direction="row" alignItems="center" spacing={.5}
                          sx={{
                            width: 94, flex: '0 0 94px', border: '1px dashed', borderColor: 'divider',
                            borderRadius: 1, px: .8, py: .45, bgcolor: 'action.hover',
                          }}>
                          <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>$</Typography>
                          <Typography sx={{
                            flex: 1, textAlign: 'right', fontSize: '0.74rem', color: 'text.secondary',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {v == null ? '—' : Math.round(v).toLocaleString('es-AR')}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  );
                })}

                <Typography sx={{
                  px: 1.1, py: .8, fontSize: '0.55rem', color: 'text.disabled',
                  lineHeight: 1.45, bgcolor: 'action.hover',
                }}>
                  Solo se carga la lista base. Las demás se calculan con el descuento
                  o recargo configurado en Lazarillo.
                </Typography>
              </Box>
            )}
          </Box>

          {/* campos */}
          <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>

            <Stack direction="row" alignItems="center" spacing={1}
              sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2,
                px: 1.4, py: .7, bgcolor: 'action.hover' }}>
              <Checkbox size="small" sx={{ p: .4 }} />
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{cfg.tomar}</Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
              <TextField label="Código" size="small" disabled
                value={item.id ?? item.codigo ?? ''} sx={{ width: { sm: 110 } }} />
              <TextField label="Código Maxi" size="small" disabled
                value={item.codigo_maxi ?? item.codigoMaxi ?? ''} sx={{ width: { sm: 110 } }} />
              <TextField label="Nombre original" size="small" disabled fullWidth
                value={item.nombreOriginal ?? item.nombre ?? ''} />
            </Stack>

            <TextField label="Nombre *" size="small" fullWidth autoFocus
              value={d.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)}
              error={vacio(d.nombre)}
              helperText={vacio(d.nombre) ? 'El nombre no puede quedar vacío' : ' '} />

            <SelectorBuscable
              label="Agrupación" value={d.agrupacion} opciones={agrupaciones}
              onChange={(v) => set('agrupacion', v)}
              onCrear={onCrearAgrupacion}
              textoCrear="Crear agrupación nueva…" />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
              <SelectorBuscable
                label="Rubro" requerido value={d.rubro} opciones={rubroNombres}
                onChange={setRubro}
                onCrear={onCrearRubro}
                textoCrear="Crear rubro nuevo…" />

              {tipo === 'articulo' ? (
                <SelectorBuscable
                  label="Subrubro" value={d.subrubro} opciones={subrubrosDelRubro}
                  onChange={(v) => set('subrubro', v)}
                  onCrear={onCrearSubrubro}
                  textoCrear="Crear subrubro nuevo…" />
              ) : (
                <SelectorBuscable
                  label="Unidad" requerido value={d.unidad} opciones={unidades}
                  onChange={(v) => set('unidad', v)}
                  ancho="150px" />
              )}
            </Stack>

            {tipo === 'articulo' ? (
              /* crece hasta emparejar el alto de la columna de la foto, así las
                 dos terminan a la misma altura y no queda un hueco al costado */
              <TextField
                label="Descripción para el menú" size="small" fullWidth multiline minRows={3}
                placeholder="Cómo se describe el producto en la carta…"
                value={d.descripcion ?? ''} onChange={(e) => set('descripcion', e.target.value)}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
                  '& textarea': { height: '100% !important', overflow: 'auto !important' },
                }} />
            ) : (
              <Stack direction="row" spacing={1.4}>
                <TextField
                  label="Precio de referencia" size="small"
                  value={d.precio ?? ''} onChange={(e) => set('precio', e.target.value)}
                  sx={{ width: { xs: '100%', sm: 240 } }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }} />
              </Stack>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <Divider />
      <Stack direction="row" alignItems="center" spacing={1.6} sx={{ px: 2, py: 1.4 }}>
        {onBorrar && (
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => onBorrar(item.id ?? item.codigo)}>
            Borrar
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={cerrar} sx={{ color: 'text.secondary' }}>CANCELAR</Button>
        <Button size="small" variant="contained" onClick={guardar} disabled={faltan || !sucio}>
          GUARDAR CAMBIOS
        </Button>
      </Stack>
    </Dialog>
  );
}
