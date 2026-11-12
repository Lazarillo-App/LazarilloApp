// src/componentes/plazas/VistaPlaza.jsx
// Vista de una plaza de despacho (Diego 11/11/2026): una tarjeta por producto con su nombre y los
// ingredientes de la receta apilados en el orden en que se arma, cada uno con su color.
// En modo «Armar»: arrastrar para ordenar, ojito para ocultar, renglones extra (notas, vajilla) y
// color por ingrediente (tocando la muestra; vale en todas las plazas). Tocando el nombre se abre la receta.
//
// Arrastre (Diego 11/11/2026: «no me queda claro dónde va a quedar»): con pointer events (mouse y
// touch, no el drag nativo del navegador). Mientras se arrastra, la lista se REORDENA EN VIVO: el
// renglón levantado ocupa el lugar exacto donde va a quedar (resaltado celeste con sombra) y los
// demás se corren con animación. Lo que se ve al soltar es lo que se guarda. Esc cancela.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Popover, InputBase, Tooltip, ToggleButtonGroup, ToggleButton, Divider, Button, Select, MenuItem } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// Paleta de despacho (mismo orden que el back: plazasController.COLOR_POR_PALABRA).
export const PALETA = [
  { bg: '#C0392B', fg: '#fff' }, { bg: '#E8D9A8', fg: '#1f2937' }, { bg: '#F2E35B', fg: '#1f2937' },
  { bg: '#A8582B', fg: '#fff' }, { bg: '#DCE8D8', fg: '#1f2937' }, { bg: '#5FA862', fg: '#fff' },
  { bg: '#C49A6C', fg: '#1f2937' }, { bg: '#F4D6E4', fg: '#1f2937' }, { bg: '#2F2F2F', fg: '#fff' },
  { bg: '#6B3A1E', fg: '#fff' }, { bg: '#F6E7B0', fg: '#1f2937' }, { bg: '#FFFFFF', fg: '#111827', borde: true },
  { bg: '#E9A23B', fg: '#1f2937' },
];

const fmtCant = (c, u) => {
  if (c == null || !(Number(c) > 0)) return '';
  const n = Number(c).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const uu = String(u || '').toLowerCase();
  if (!uu || uu === 'u' || uu === 'un' || uu === 'unidad' || uu === 'porcion') return n;
  return `${n} ${uu === 'gr' ? 'g' : uu}`;
};

const Renglon = React.forwardRef(function Renglon({ r, armando, levantado, arrastreActivo, onOcultar, onBorrar, onColor, onAgarrar }, ref) {
  const c = PALETA[(Number(r.color) || 0) % PALETA.length];
  // Peso de la receta u observación del renglón, según lo elegido para ese ingrediente (vale en
  // todas las recetas). Si se eligió observación y esta receta no la tiene, va el peso.
  const cant = r.mostrar === 'obs' && r.obs ? r.obs : fmtCant(r.cantidad, r.unidad);
  if (!armando && r.oculto) return null;
  return (
    <Box ref={ref} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: '5px', opacity: r.oculto && !levantado ? 0.35 : 1,
      position: 'relative', zIndex: levantado ? 2 : 'auto', borderRadius: '4px',
      outline: levantado ? '2px solid #5BC2EA' : 'none', outlineOffset: 2,
      boxShadow: levantado ? '0 8px 18px rgba(0,0,0,.22)' : 'none', bgcolor: levantado ? '#fff' : 'transparent',
      transform: levantado ? 'scale(1.03)' : 'none', transition: 'box-shadow .12s, transform .12s',
      pointerEvents: arrastreActivo && !levantado ? 'none' : 'auto' }}>
      {armando && (
        <Box onPointerDown={onAgarrar} title="Arrastrar para ordenar"
          sx={{ width: 22, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            cursor: levantado ? 'grabbing' : 'grab', touchAction: 'none', borderRadius: '3px', '&:hover': { bgcolor: 'action.hover' } }}>
          <DragIndicatorIcon sx={{ fontSize: 18, color: levantado ? '#2492C8' : 'text.disabled' }} />
        </Box>
      )}
      <Box onClick={armando ? onColor : undefined} sx={{
        flex: 1, minWidth: 0, bgcolor: c.bg, color: c.fg, border: c.borde ? '1.5px solid #111827' : '1px solid rgba(0,0,0,.08)',
        borderRadius: '3px', px: 0.75, py: 0.4, minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', cursor: armando ? 'pointer' : 'default',
      }}>
        <Typography sx={{ fontWeight: 800, fontStyle: 'italic', fontSize: '0.86rem', letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {cant ? <span style={{ marginRight: 6 }}>{cant}</span> : null}{r.alias || r.nombre}
        </Typography>
      </Box>
      {armando && (r.extra ? (
        <Tooltip title="Quitar renglón"><IconButton size="small" onClick={onBorrar} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      ) : (
        <Tooltip title={r.oculto ? 'Mostrar' : 'Ocultar en la plaza'}>
          <IconButton size="small" onClick={onOcultar} sx={{ p: 0.25 }}>
            {r.oculto ? <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
});

// Panel al tocar un ingrediente en «Armar» (Diego 11/11/2026). Arriba, lo de ESTA receta
// (cantidad, observación) si se habilita onEditarItem; abajo, lo de la VISTA, que vale para el
// ingrediente en todas las recetas y plazas: alias, peso u observación, color.
const lbl = { fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', letterSpacing: '.04em', textAlign: 'center', mb: 0.5 };
const campo = { height: 40, border: '1px solid', borderColor: 'divider', borderRadius: '6px', px: 1.25, fontSize: '0.85rem', width: '100%',
  '&.Mui-focused': { borderColor: '#5BC2EA', boxShadow: '0 0 0 2px rgba(91,194,234,.25)' } };
function PanelIngrediente({ r, producto, onCambiar, onEditarItem, onCrearEquivalencia }) {
  const [alias, setAlias] = useState(r.alias || '');
  const [cantidad, setCantidad] = useState(r.cantidad != null ? String(r.cantidad).replace('.', ',') : '');
  const [obs, setObs] = useState(r.obs || '');
  const [unidad, setUnidad] = useState(r.unidad || '');
  const [guardando, setGuardando] = useState(false);
  // Unidades del ingrediente: las físicas de su familia + sus equivalencias
  // (r.unidades: [{ nombre, detalle, familia, valor }], valor = tamaño en gr / ml / u).
  const unidades = Array.isArray(r.unidades) && r.unidades.length ? r.unidades : [{ nombre: r.unidad || 'u' }];
  const datosDe = (nombre) => unidades.find((u) => String(u.nombre).toLowerCase() === String(nombre || '').toLowerCase());
  const actualU = datosDe(unidad);
  // Cambiar de unidad mantiene la misma cantidad real: 75 g → 1,5 dip (si el dip es 50 g).
  const cambiarUnidad = (nueva) => {
    const a = datosDe(unidad), b = datosDe(nueva);
    const n = Number(String(cantidad).replace(',', '.'));
    if (a?.valor > 0 && b?.valor > 0 && a.familia === b.familia && Number.isFinite(n)) {
      const conv = Math.round((n * a.valor / b.valor) * 1000) / 1000;
      setCantidad(String(conv).replace('.', ','));
    }
    setUnidad(nueva);
  };
  const guardarAlias = () => { const a = alias.trim(); if (a !== (r.alias || '')) onCambiar({ alias: a }); };
  const actual = r.mostrar === 'obs' ? 'obs' : 'peso';
  const cambioReceta = cantidad !== (r.cantidad != null ? String(r.cantidad).replace('.', ',') : '') || obs !== (r.obs || '') || unidad !== (r.unidad || '');
  return (
    <Box sx={{ p: 1.5, width: 300 }}>
      <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '0.9rem', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.15, mb: 1.25 }}>
        {r.nombre}
      </Typography>
      {onEditarItem && r.editable && (
        <>
          <Typography sx={lbl}>EN ESTA RECETA · {String(producto || '').toUpperCase()}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
            <Box>
              <Typography sx={{ ...lbl, fontWeight: 600 }}>Cantidad</Typography>
              <InputBase value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^0-9.,]/g, ''))} sx={campo}
                inputProps={{ style: { textAlign: 'center' }, inputMode: 'decimal' }} />
            </Box>
            <Box>
              <Typography sx={{ ...lbl, fontWeight: 600 }}>Unidad</Typography>
              <Select value={unidad} size="small" fullWidth
                onChange={(e) => { if (e.target.value === '__crear_eq') { onCrearEquivalencia?.(r); return; } cambiarUnidad(e.target.value); }}
                sx={{ height: 40, borderRadius: '6px', fontSize: '0.85rem', '& .MuiSelect-select': { textAlign: 'center' } }}>
                {/* Acción primero, en franja gris (mismo patrón que «+ Crear merma» / SelectorBuscable). */}
                <MenuItem value="__crear_eq" sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'primary.main', justifyContent: 'center',
                  bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.selected' } }}>
                  + Crear equivalencia
                </MenuItem>
                {unidades.map((u) => (
                  // Una unidad de otra familia (g ↔ ml ↔ u) no se puede convertir desde acá.
                  <MenuItem key={u.nombre} value={u.nombre} disabled={!!actualU?.familia && !!u.familia && u.familia !== actualU.familia}
                    sx={{ fontSize: '0.85rem', justifyContent: 'center' }}>
                    {u.detalle ? `${u.nombre} (${u.detalle})` : u.nombre}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
          <Typography sx={{ ...lbl, fontWeight: 600 }}>Observación</Typography>
          <InputBase value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ej. 1 dip y medio" sx={{ ...campo, mb: 1 }}
            inputProps={{ style: { textAlign: 'center' } }} />
          <Button fullWidth size="small" variant="contained" disableElevation disabled={!cambioReceta || guardando}
            onClick={async () => {
              setGuardando(true);
              try { await onEditarItem({ key: r.key, cantidad: Number(String(cantidad).replace(',', '.')), unidad, observaciones: obs.trim() }); }
              finally { setGuardando(false); }
            }}
            sx={{ height: 34, textTransform: 'none', fontWeight: 700 }}>
            {guardando ? 'Guardando…' : 'Guardar en la receta'}
          </Button>
          <Divider sx={{ my: 1.5 }} />
        </>
      )}
      {!r.extra && (
        <>
          <Typography sx={lbl}>EN LA VISTA · TODAS LAS RECETAS Y PLAZAS</Typography>
          <Typography sx={{ ...lbl, fontWeight: 600 }}>Alias</Typography>
          <InputBase value={alias} onChange={(e) => setAlias(e.target.value)} onBlur={guardarAlias}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder={r.nombre} sx={{ ...campo, mb: 1 }} inputProps={{ style: { textAlign: 'center', textTransform: 'uppercase' } }} />
          <Typography sx={{ ...lbl, fontWeight: 600 }}>Mostrar</Typography>
          <ToggleButtonGroup exclusive fullWidth size="small" value={actual}
            onChange={(_, v) => { if (v && v !== actual) onCambiar({ mostrar: v }); }}
            sx={{ mb: 1, '& .MuiToggleButton-root': { height: 34, textTransform: 'none', fontSize: '0.8rem', fontWeight: 600 } }}>
            <ToggleButton value="peso">Peso</ToggleButton>
            <ToggleButton value="obs">Observación</ToggleButton>
          </ToggleButtonGroup>
        </>
      )}
      <Typography sx={{ ...lbl, fontWeight: 600 }}>Color</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, justifyItems: 'center' }}>
        {PALETA.map((c, i) => (
          <Box key={i} onClick={() => onCambiar({ color: i })} sx={{ width: 28, height: 28, borderRadius: '5px', bgcolor: c.bg, cursor: 'pointer',
            border: c.borde ? '1.5px solid #111827' : '1px solid rgba(0,0,0,.15)',
            outline: Number(r.color) === i ? '2px solid #2492C8' : 'none', outlineOffset: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

// Pasa el elemento de la posición `desde` a la posición `hasta`.
const moverEn = (lista, desde, hasta) => {
  const l = [...lista];
  const [x] = l.splice(desde, 1);
  l.splice(hasta, 0, x);
  return l;
};

function Tarjeta({ p, armando, onCambiar, onColorIngrediente, onMostrarIngrediente, onAliasIngrediente, onOcultarIngrediente, onEditarItem, onCrearEquivalencia, onAbrir }) {
  // arrastre: { key, desde, hasta, mids } — mids = centro vertical de cada renglón al agarrar.
  const [arrastre, setArrastre] = useState(null);
  const arrastreRef = useRef(null);
  arrastreRef.current = arrastre;
  const nodos = useRef(new Map());     // key → elemento, para medir y animar
  const posAntes = useRef(new Map());  // key → top antes del último reordenamiento (animación FLIP)
  const [nuevo, setNuevo] = useState('');
  const [paleta, setPaleta] = useState(null); // { anchor, renglon }

  const guardar = (renglones) => onCambiar(p.articleId, renglones);

  // Lo que se pinta: mientras se arrastra, la lista ya reordenada (vista previa exacta del resultado).
  const visibles = arrastre ? moverEn(p.renglones, arrastre.desde, arrastre.hasta) : p.renglones;

  const medirTops = () => {
    const m = new Map();
    nodos.current.forEach((el, k) => { if (el) m.set(k, el.getBoundingClientRect().top); });
    return m;
  };
  // Animación: cada renglón que cambió de lugar se desliza desde su posición anterior.
  useLayoutEffect(() => {
    const antes = posAntes.current;
    if (!antes.size) return;
    nodos.current.forEach((el, k) => {
      if (!el || !antes.has(k) || k === arrastre?.key) return;
      const dy = antes.get(k) - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.translate = `0 ${dy}px`;
      requestAnimationFrame(() => { el.style.transition = 'translate .15s ease'; el.style.translate = '0 0'; });
    });
    posAntes.current = new Map();
  }, [arrastre?.hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const agarrar = (e, i) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const mids = p.renglones.map((r) => {
      const b = nodos.current.get(r.key)?.getBoundingClientRect();
      return b ? b.top + b.height / 2 : 0;
    });
    setArrastre({ key: p.renglones[i].key, desde: i, hasta: i, mids });
  };

  useEffect(() => {
    if (!arrastre) return undefined;
    const alMover = (e) => {
      const a = arrastreRef.current;
      if (!a) return;
      // Destino = cuántos de los OTROS renglones tienen el centro por encima del puntero.
      const hasta = a.mids.reduce((n, m, j) => (j !== a.desde && m < e.clientY ? n + 1 : n), 0);
      if (hasta !== a.hasta) { posAntes.current = medirTops(); setArrastre({ ...a, hasta }); }
    };
    const alSoltar = () => {
      const a = arrastreRef.current;
      setArrastre(null);
      if (a && a.hasta !== a.desde) guardar(moverEn(p.renglones, a.desde, a.hasta));
    };
    const alTecla = (e) => { if (e.key === 'Escape') setArrastre(null); };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', alSoltar);
    window.addEventListener('keydown', alTecla);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alSoltar);
      window.removeEventListener('keydown', alTecla);
    };
  }, [!!arrastre, p.renglones]); // eslint-disable-line react-hooks/exhaustive-deps
  const agregar = () => {
    const texto = nuevo.trim();
    if (!texto) return;
    guardar([...p.renglones, { key: `x:${Date.now().toString(36)}`, nombre: texto, color: 11, extra: true, oculto: false }]);
    setNuevo('');
  };

  // La tarjeta ocupa 2 filas de la grilla (título | renglones) con subgrid: todos los títulos de
  // una misma fila arrancan arriba y los renglones empiezan a la misma altura; si un título
  // usa menos renglones, queda el espacio (Diego 11/11/2026).
  return (
    <Box sx={{ width: '100%', display: 'grid', gridRow: 'span 2', gridTemplateRows: 'subgrid', rowGap: 0 }}>
      <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.3rem', textAlign: 'center',
        textTransform: 'uppercase', lineHeight: 1.05, mb: 1, alignSelf: 'start' }}>
        <Tooltip title={onAbrir ? 'Abrir la receta' : ''} placement="top">
          <Box component="span" onClick={onAbrir ? () => onAbrir(p) : undefined}
            sx={{ cursor: onAbrir ? 'pointer' : 'default', '&:hover': onAbrir ? { color: '#2492C8' } : undefined }}>
            {p.nombre}
          </Box>
        </Tooltip>
      </Typography>
      <Box>
      {visibles.map((r) => (
        <Renglon key={r.key} r={r} armando={armando}
          ref={(el) => { if (el) nodos.current.set(r.key, el); else nodos.current.delete(r.key); }}
          levantado={arrastre?.key === r.key} arrastreActivo={!!arrastre}
          onAgarrar={(e) => agarrar(e, p.renglones.findIndex((x) => x.key === r.key))}
          // Ojito: si es un ingrediente de la receta, se oculta en TODAS sus recetas (Diego 12/11/2026);
          // los renglones sin insumo siguen guardándose en la ficha de la plaza.
          onOcultar={() => (onOcultarIngrediente && /^[ia]:/.test(r.ref || '')
            ? onOcultarIngrediente(r.ref, !r.oculto)
            : guardar(p.renglones.map((x) => (x.key === r.key ? { ...x, oculto: !x.oculto } : x))))}
          onBorrar={() => guardar(p.renglones.filter((x) => x.key !== r.key))}
          onColor={(e) => setPaleta({ anchor: e.currentTarget, renglon: r })} />
      ))}
      {!p.renglones.length && !armando && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>Sin receta cargada</Typography>
      )}
      {armando && (
        <Box sx={{ mt: 0.5, border: '1px dashed #cbd5e1', borderRadius: '3px', px: 1, display: 'flex', alignItems: 'center', minHeight: 30 }}>
          <InputBase value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
            onBlur={agregar} placeholder="+ Renglón (ej. cortar en 5, cuenco)" sx={{ fontSize: '0.78rem', flex: 1 }} />
        </Box>
      )}
      <Popover open={!!paleta} anchorEl={paleta?.anchor} onClose={() => setPaleta(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}>
        {paleta && (
          <PanelIngrediente key={paleta.renglon.key} r={paleta.renglon} producto={p.nombre}
            onCambiar={(cambio) => {
              const r = paleta.renglon;
              setPaleta({ ...paleta, renglon: { ...r, ...cambio } });
              if (r.extra) { if (cambio.color != null) guardar(p.renglones.map((x) => (x.key === r.key ? { ...x, color: cambio.color } : x))); return; }
              if (cambio.color != null) onColorIngrediente?.(r.ref, cambio.color);
              if (cambio.mostrar) onMostrarIngrediente?.(r.ref, cambio.mostrar);
              if (cambio.alias !== undefined) onAliasIngrediente?.(r.ref, cambio.alias);
            }}
            onEditarItem={onEditarItem && !paleta.renglon.extra ? async (datos) => {
              if (await onEditarItem(p.articleId, datos)) setPaleta(null);
            } : null}
            onCrearEquivalencia={onCrearEquivalencia ? (r) => { setPaleta(null); onCrearEquivalencia(p.articleId, r); } : null} />
        )}
      </Popover>
      </Box>
    </Box>
  );
}

export default function VistaPlaza({ productos, armando = false, onCambiar, onColorIngrediente, onMostrarIngrediente, onAliasIngrediente, onOcultarIngrediente, onEditarItem, onCrearEquivalencia, onAbrir }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', columnGap: 3, rowGap: 3.5, alignItems: 'start' }}>
      {productos.map((p) => (
        <Tarjeta key={p.articleId} p={p} armando={armando} onCambiar={onCambiar} onColorIngrediente={onColorIngrediente} onMostrarIngrediente={onMostrarIngrediente}
          onAliasIngrediente={onAliasIngrediente} onOcultarIngrediente={onOcultarIngrediente} onEditarItem={onEditarItem} onCrearEquivalencia={onCrearEquivalencia} onAbrir={onAbrir} />
      ))}
    </Box>
  );
}
