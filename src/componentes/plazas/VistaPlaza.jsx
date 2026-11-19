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
  if (!uu || uu === 'u' || uu === 'un' || uu === 'unidad' || uu === 'porcion' || uu === 'media_porcion') return n;
  return `${n} ${uu === 'gr' ? 'g' : uu}`;
};

const Renglon = React.forwardRef(function Renglon({ r, armando, levantado, arrastreActivo, onOcultar, onBorrar, onColor, onAgarrar }, ref) {
  const c = PALETA[(Number(r.color) || 0) % PALETA.length];
  // Peso, observación o ambos, según lo elegido para ese ingrediente (vale en todas las recetas).
  // La observación va en otro renglón con «↳», como en la vista cocina (Diego 12/11/2026). Si se eligió
  // solo observación y esta receta no la tiene, va el peso.
  const conObs = (r.mostrar === 'obs' || r.mostrar === 'ambos') && !!String(r.obs || '').trim();
  const cant = r.mostrar === 'obs' && conObs ? '' : fmtCant(r.cantidad, r.unidad);
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
        borderRadius: '3px', px: 0.75, py: 0.4, minHeight: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', cursor: armando ? 'pointer' : 'default',
      }}>
        <Typography sx={{ fontWeight: 800, fontStyle: 'italic', fontSize: '0.86rem', letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {cant ? <span style={{ marginRight: 6 }}>{cant}</span> : null}{r.alias || r.nombre}
        </Typography>
        {conObs && (
          <Typography sx={{ fontStyle: 'italic', fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.15, mt: '2px', opacity: 0.9 }}>
            ↳ {r.obs}
          </Typography>
        )}
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
  // El alias arranca con el nombre del ingrediente, listo para editar (Diego 12/11/2026).
  const [alias, setAlias] = useState(r.alias || r.nombre || '');
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
  // Igual al nombre (o vacío) = sin alias.
  const guardarAlias = () => {
    const a = alias.trim();
    const nuevo = !a || a.toLowerCase() === String(r.nombre || '').trim().toLowerCase() ? '' : a;
    if (nuevo !== (r.alias || '')) onCambiar({ alias: nuevo });
    if (!a) setAlias(r.nombre || '');
  };
  const actual = ['obs', 'ambos'].includes(r.mostrar) ? r.mostrar : 'peso';
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
            <ToggleButton value="ambos">Ambos</ToggleButton>
          </ToggleButtonGroup>
          {/* Lo normal es seguir a la plaza; tocar otra opción lo deja como excepción de este ingrediente (Diego 14/11/2026). */}
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textAlign: 'center', mt: -0.5, mb: 1, lineHeight: 1.3 }}>
            {r.mostrarPropio ? (
              <>Propio de este ingrediente ·{' '}
                <Box component="span" onClick={() => onCambiar({ mostrar: 'plaza' })}
                  sx={{ color: '#2492C8', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>usar el de la plaza</Box>
              </>
            ) : 'Sigue a la plaza. Si lo cambiás, queda propio de este ingrediente.'}
          </Typography>
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

function Tarjeta({ p, armando, mostrarPlaza = 'peso', cardRef, levantada = false, arrastreTarjetas = false, onAgarrarTarjeta, onQuitar, onCambiar, onColorIngrediente, onMostrarIngrediente, onAliasIngrediente, onOcultarIngrediente, onEditarItem, onCrearEquivalencia, onAbrir }) {
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
    <Box ref={cardRef} sx={{ width: '100%', display: 'grid', gridRow: 'span 2', gridTemplateRows: 'subgrid', rowGap: 0,
      position: 'relative', zIndex: levantada ? 3 : 'auto', borderRadius: '6px', bgcolor: levantada ? '#fff' : 'transparent',
      outline: levantada ? '2px solid #5BC2EA' : 'none', outlineOffset: 6, boxShadow: levantada ? '0 12px 28px rgba(0,0,0,.22)' : 'none',
      transform: levantada ? 'scale(1.02)' : 'none', transition: 'box-shadow .12s, transform .12s',
      pointerEvents: arrastreTarjetas && !levantada ? 'none' : 'auto' }}>
      {/* Título (y la observación del producto, si tiene). En «Armar»: ⋮⋮ a la izquierda para mover la tarjeta
          (Diego 17/11/2026) y ✕ a la derecha para sacarla (14/11). Padding a los dos lados: el título sigue centrado. */}
      <Box sx={{ alignSelf: 'start', mb: 1 }}>
      <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.3rem', textAlign: 'center',
        textTransform: 'uppercase', lineHeight: 1.05, position: 'relative', px: armando && (onQuitar || onAgarrarTarjeta) ? 3.5 : 0 }}>
        {armando && onAgarrarTarjeta && (
          <Box component="span" onPointerDown={onAgarrarTarjeta} title="Arrastrar para ordenar los productos"
            sx={{ position: 'absolute', left: 0, top: -4, width: 22, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: levantada ? 'grabbing' : 'grab', touchAction: 'none', borderRadius: '3px', '&:hover': { bgcolor: 'action.hover' } }}>
            <DragIndicatorIcon sx={{ fontSize: 20, color: levantada ? '#2492C8' : 'text.disabled' }} />
          </Box>
        )}
        {armando && onQuitar && (
          <Tooltip title="Quitar de la plaza">
            <IconButton size="small" aria-label={`Quitar ${p.nombre} de la plaza`} onClick={() => onQuitar(p)}
              sx={{ position: 'absolute', right: 0, top: -2, width: 26, height: 26, color: 'text.secondary', '&:hover': { color: '#C0392B', bgcolor: 'rgba(192,57,43,.08)' } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={onAbrir ? 'Abrir la receta' : ''} placement="top">
          <Box component="span" onClick={onAbrir ? () => onAbrir(p) : undefined}
            sx={{ cursor: onAbrir ? 'pointer' : 'default', '&:hover': onAbrir ? { color: '#2492C8' } : undefined }}>
            {p.nombre}
          </Box>
        </Tooltip>
      </Typography>
      {!!p.obs && (
        <Typography sx={{ fontStyle: 'italic', fontWeight: 600, fontSize: '0.78rem', color: 'text.secondary', textAlign: 'center', lineHeight: 1.2, mt: 0.5 }}>
          ↳ {p.obs}
        </Typography>
      )}
      </Box>
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
              const vista = cambio.mostrar ? { mostrar: cambio.mostrar === 'plaza' ? mostrarPlaza : cambio.mostrar, mostrarPropio: cambio.mostrar !== 'plaza' } : {};
              setPaleta({ ...paleta, renglon: { ...r, ...cambio, ...vista } });
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

// Lugares de la plaza (Diego 19/11/2026: «al mover un producto no necesariamente otro tiene que ocupar su
// lugar»). Cada producto tiene su CASILLA (1, 2, 3…) y puede haber casillas vacías: el producto se suelta en
// un lugar libre y el suyo queda vacío. Si se suelta sobre otro, se corren solo los que hace falta hasta el
// lugar libre más cercano (los demás no se mueven).
export function casillasDe(productos) {
  const s = [];
  (productos || []).forEach((p) => {
    let c = Number(p.casilla) > 0 ? Number(p.casilla) - 1 : s.length;
    if (s[c]) c = s.length;
    s[c] = p;
  });
  return Array.from({ length: s.length }, (_, i) => s[i] || null);
}
// Lleva lo que está en la casilla `desde` a la casilla `hasta` (vista previa y resultado son lo mismo).
const moverACasilla = (casillas, desde, hasta) => {
  const s = [...casillas];
  const x = s[desde];
  s[desde] = null;
  if (!s[hasta]) { s[hasta] = x; return s; }
  // Lugar libre más cercano a `hasta` (a igual distancia, del lado de donde viene el producto).
  const libre = (k) => k >= s.length || (k >= 0 && !s[k]);
  let h = s.length;
  for (let d = 1; d <= s.length; d++) {
    const [p1, p2] = desde < hasta ? [hasta - d, hasta + d] : [hasta + d, hasta - d];
    if (p1 >= 0 && libre(p1)) { h = p1; break; }
    if (p2 >= 0 && libre(p2)) { h = p2; break; }
  }
  if (h < hasta) for (let k = h; k < hasta; k++) s[k] = s[k + 1];
  else for (let k = h; k > hasta; k--) s[k] = s[k - 1];
  s[hasta] = x;
  return s;
};

// Arrastrar las tarjetas (pointer events: mouse y touch). La grilla se acomoda EN VIVO: la tarjeta levantada
// queda donde va a caer (borde celeste + sombra) y las que se corren lo hacen con animación. Esc cancela.
// El destino es la casilla (tarjeta o lugar libre) cuyo centro, medido al agarrar, está más cerca del puntero.
function useArrastreTarjetas(base, onSoltar) {
  const [arr, setArr] = useState(null); // { key, desde, hasta, centros }
  const arrRef = useRef(null);
  arrRef.current = arr;
  const grilla = useRef(null);
  const nodos = useRef(new Map());
  const antes = useRef(new Map());
  const medir = () => { const m = new Map(); nodos.current.forEach((el, k) => { if (el) { const b = el.getBoundingClientRect(); m.set(k, [b.left, b.top]); } }); return m; };
  useLayoutEffect(() => {
    const prev = antes.current;
    if (!prev.size) return;
    nodos.current.forEach((el, k) => {
      if (!el || !prev.has(k) || k === arr?.key) return;
      const b = el.getBoundingClientRect();
      const dx = prev.get(k)[0] - b.left; const dy = prev.get(k)[1] - b.top;
      if (!dx && !dy) return;
      el.style.transition = 'none'; el.style.translate = `${dx}px ${dy}px`;
      requestAnimationFrame(() => { el.style.transition = 'translate .18s ease'; el.style.translate = '0 0'; });
    });
    antes.current = new Map();
  }, [arr?.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const agarrar = (e, i) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const centros = [...(grilla.current?.children || [])].map((el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    setArr({ key: base[i].articleId, desde: i, hasta: i, centros });
  };
  useEffect(() => {
    if (!arr) return undefined;
    const alMover = (e) => {
      const a = arrRef.current; if (!a) return;
      let mejor = a.hasta; let dist = Infinity;
      a.centros.forEach(([x, y], j) => { const d = (x - e.clientX) ** 2 + (y - e.clientY) ** 2; if (d < dist) { dist = d; mejor = j; } });
      if (mejor !== a.hasta) { antes.current = medir(); setArr({ ...a, hasta: mejor }); }
    };
    const alSoltar = () => {
      const a = arrRef.current; setArr(null);
      if (a && a.hasta !== a.desde) onSoltar?.(moverACasilla(base, a.desde, a.hasta));
    };
    const alTecla = (e) => { if (e.key === 'Escape') setArr(null); };
    document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', alMover); window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', alSoltar); window.addEventListener('keydown', alTecla);
    return () => {
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      window.removeEventListener('pointermove', alMover); window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alSoltar); window.removeEventListener('keydown', alTecla);
    };
  }, [!!arr, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = arr ? moverACasilla(base, arr.desde, arr.hasta) : base;
  return { arr, lista, agarrar, nodos, grilla };
}

// Lugar libre: en «Armar», recuadro punteado donde se puede soltar; mirando, espacio vacío (en el celular,
// con una sola columna, no ocupa lugar).
function Hueco({ armando }) {
  return (
    <Box aria-hidden={!armando} sx={{ gridRow: 'span 2', minHeight: 120, borderRadius: 2, alignSelf: 'stretch',
      display: armando ? 'flex' : { xs: 'none', sm: 'block' }, alignItems: 'center', justifyContent: 'center',
      ...(armando ? { border: '2px dashed #d3dbe3', color: '#a0aab5', fontSize: '0.75rem', fontWeight: 600 } : null) }}>
      {armando ? 'Lugar libre' : null}
    </Box>
  );
}

export default function VistaPlaza({ productos, armando = false, mostrarPlaza, onOrdenar, onQuitar, onCambiar, onColorIngrediente, onMostrarIngrediente, onAliasIngrediente, onOcultarIngrediente, onEditarItem, onCrearEquivalencia, onAbrir }) {
  // Casillas con sus lugares libres; en «Armar» suma uno al final para poder correr un producto ahí.
  const base = React.useMemo(() => {
    const c = casillasDe(productos);
    return armando && onOrdenar ? [...c, null] : c;
  }, [productos, armando, onOrdenar]);
  // Al soltar: cada producto con su casilla nueva (los lugares vacíos del final no se guardan).
  const soltar = (casillas) => onOrdenar?.(casillas.map((p, i) => (p ? { ...p, casilla: i + 1 } : null)).filter(Boolean));
  const { arr, lista, agarrar, nodos, grilla } = useArrastreTarjetas(base, soltar);
  return (
    <Box ref={grilla} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', columnGap: 3, rowGap: 3.5, alignItems: 'start' }}>
      {lista.map((p, i) => (!p ? <Hueco key={`h${i}`} armando={armando && !!onOrdenar} /> : (
        <Tarjeta key={p.articleId} p={p} armando={armando} mostrarPlaza={mostrarPlaza}
          cardRef={(el) => { if (el) nodos.current.set(p.articleId, el); else nodos.current.delete(p.articleId); }}
          levantada={arr?.key === p.articleId} arrastreTarjetas={!!arr}
          onAgarrarTarjeta={armando && onOrdenar ? (e) => agarrar(e, base.findIndex((x) => x?.articleId === p.articleId)) : null}
          onQuitar={onQuitar} onCambiar={onCambiar} onColorIngrediente={onColorIngrediente} onMostrarIngrediente={onMostrarIngrediente}
          onAliasIngrediente={onAliasIngrediente} onOcultarIngrediente={onOcultarIngrediente} onEditarItem={onEditarItem} onCrearEquivalencia={onCrearEquivalencia} onAbrir={onAbrir} />
      )))}
    </Box>
  );
}
