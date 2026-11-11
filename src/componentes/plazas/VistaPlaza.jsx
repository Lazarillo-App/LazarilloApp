// src/componentes/plazas/VistaPlaza.jsx
// Vista de una plaza de despacho (Diego 11/11/2026): una tarjeta por producto con su nombre y los
// ingredientes de la receta apilados en el orden en que se arma, cada uno con su color.
// En modo «Armar»: arrastrar para ordenar, ojito para ocultar, renglones extra (notas, vajilla) y
// color por ingrediente (tocando la muestra; vale en todas las plazas).
import React, { useState } from 'react';
import { Box, Typography, IconButton, Popover, InputBase, Tooltip } from '@mui/material';
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

function Renglon({ r, armando, onOcultar, onBorrar, onColor, dragProps }) {
  const c = PALETA[(Number(r.color) || 0) % PALETA.length];
  const cant = fmtCant(r.cantidad, r.unidad);
  if (!armando && r.oculto) return null;
  return (
    <Box {...dragProps} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: '5px', opacity: r.oculto ? 0.35 : 1 }}>
      {armando && <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab', flexShrink: 0 }} />}
      <Box onClick={armando ? onColor : undefined} sx={{
        flex: 1, minWidth: 0, bgcolor: c.bg, color: c.fg, border: c.borde ? '1.5px solid #111827' : '1px solid rgba(0,0,0,.08)',
        borderRadius: '3px', px: 0.75, py: 0.4, minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', cursor: armando ? 'pointer' : 'default',
      }}>
        <Typography sx={{ fontWeight: 800, fontStyle: 'italic', fontSize: '0.86rem', letterSpacing: '.02em', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {cant ? <span style={{ marginRight: 6 }}>{cant}</span> : null}{r.nombre}
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
}

function Tarjeta({ p, armando, onCambiar, onColorIngrediente }) {
  const [arrastrando, setArrastrando] = useState(null);
  const [nuevo, setNuevo] = useState('');
  const [paleta, setPaleta] = useState(null); // { anchor, renglon }

  const guardar = (renglones) => onCambiar(p.articleId, renglones);
  const mover = (desde, hasta) => {
    if (desde === hasta || desde == null) return;
    const lista = [...p.renglones];
    const [x] = lista.splice(desde, 1);
    lista.splice(hasta, 0, x);
    guardar(lista);
  };
  const agregar = () => {
    const texto = nuevo.trim();
    if (!texto) return;
    guardar([...p.renglones, { key: `x:${Date.now().toString(36)}`, nombre: texto, color: 11, extra: true, oculto: false }]);
    setNuevo('');
  };
  const elegirColor = (i) => {
    const r = paleta.renglon;
    setPaleta(null);
    if (r.extra) guardar(p.renglones.map((x) => (x.key === r.key ? { ...x, color: i } : x)));
    else onColorIngrediente(r.ref, i);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.3rem', textAlign: 'center',
        textTransform: 'uppercase', lineHeight: 1.05, mb: 1, minHeight: '2.2em', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {p.nombre}
      </Typography>
      {p.renglones.map((r, i) => (
        <Renglon key={r.key} r={r} armando={armando}
          dragProps={armando ? {
            draggable: true,
            onDragStart: () => setArrastrando(i),
            onDragOver: (e) => e.preventDefault(),
            onDrop: () => { mover(arrastrando, i); setArrastrando(null); },
          } : {}}
          onOcultar={() => guardar(p.renglones.map((x) => (x.key === r.key ? { ...x, oculto: !x.oculto } : x)))}
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
        <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: 0.75 }}>
          {PALETA.map((c, i) => (
            <Box key={i} onClick={() => elegirColor(i)} sx={{ width: 24, height: 24, borderRadius: '4px', bgcolor: c.bg, cursor: 'pointer',
              border: c.borde ? '1.5px solid #111827' : '1px solid rgba(0,0,0,.15)',
              outline: Number(paleta?.renglon?.color) === i ? '2px solid #2492C8' : 'none', outlineOffset: 1 }} />
          ))}
        </Box>
        {paleta && !paleta.renglon.extra && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, pb: 1 }}>Cambia este ingrediente en todas las plazas</Typography>
        )}
      </Popover>
    </Box>
  );
}

export default function VistaPlaza({ productos, armando = false, onCambiar, onColorIngrediente }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', columnGap: 3, rowGap: 3.5, alignItems: 'start' }}>
      {productos.map((p) => (
        <Tarjeta key={p.articleId} p={p} armando={armando} onCambiar={onCambiar} onColorIngrediente={onColorIngrediente} />
      ))}
    </Box>
  );
}
