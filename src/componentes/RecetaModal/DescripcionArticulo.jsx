// src/componentes/RecetaModal/DescripcionArticulo.jsx
// Descripción del artículo en el encabezado del modal de receta (Diego 12/11/2026).
// Cerrada: una línea con «…» y «ver ▾». Abierta: se lee completa y se edita ahí mismo;
// guarda al salir del campo. Es la MISMA descripción que «Editar artículo»: la propia
// de Lazarillo manda sobre la de MaxiRest; vacía o igual a la de MaxiRest = sin propia.
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, InputBase } from '@mui/material';
import { httpBiz } from '@/servicios/apiBusinesses';

const limpio = (v) => String(v ?? '').trim();

// onArticulo: recibe la ficha que trae el servidor (la usa la ⓘ del encabezado, sin pedirla dos veces).
export default function DescripcionArticulo({ articulo, businessId, editable = true, onArticulo }) {
  // Lo que trae la fila sirve para pintar al instante; la del servidor (GET /articles/:id)
  // manda, porque según desde dónde se abra el modal el objeto puede no traerla
  // (Diego 12/11: #571 la tiene en MaxiRest y no aparecía).
  const deFila = limpio(articulo?.descripcion_propia) || limpio(articulo?.descripcion_original) || limpio(articulo?.descripcion);
  const [original, setOriginal] = useState(limpio(articulo?.descripcion_original));
  const [texto, setTexto] = useState(deFila);
  const [guardado, setGuardado] = useState(deFila);
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState(''); // '' | 'guardando' | 'error'
  const inputRef = useRef(null);

  // Al abrir o navegar ‹ › a otro artículo: arranca cerrada con la suya y la confirma con el servidor.
  useEffect(() => {
    setTexto(deFila); setGuardado(deFila); setOriginal(limpio(articulo?.descripcion_original));
    setAbierta(false); setEstado('');
    const id = Number(articulo?.id);
    if (!Number.isFinite(id) || !id) return undefined;
    let vivo = true;
    httpBiz(`/articles/${id}`, {}, businessId)
      .then((r) => {
        const a = r?.articulo;
        if (!vivo || !a) return;
        onArticulo?.(a);
        const orig = limpio(a.descripcion_original);
        const usada = limpio(a.descripcion_propia) || orig;
        setOriginal(orig);
        setGuardado(usada);
        setTexto((t) => (t === deFila ? usada : t)); // no pisar lo que ya esté escribiendo
      })
      .catch(() => { /* queda la de la fila */ });
    return () => { vivo = false; };
  }, [articulo?.id, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!articulo?.id) return null;

  const guardar = async () => {
    const ahora = texto.trim();
    if (ahora === guardado) return;
    setEstado('guardando');
    try {
      await httpBiz(`/articles/${Number(articulo.id)}`, {
        method: 'PATCH',
        body: { descripcion: (!ahora || ahora === original) ? null : ahora },
      }, businessId);
      setGuardado(ahora || original);
      if (!ahora) setTexto(original);
      setEstado('');
      try { window.dispatchEvent(new CustomEvent('articulos:updated')); } catch { /* sin window */ }
    } catch {
      setEstado('error');
    }
  };

  const abrir = () => { setAbierta(true); setTimeout(() => inputRef.current?.focus(), 30); };
  const linkSx = { fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: 0.9, '&:hover': { opacity: 1, textDecoration: 'underline' } };

  if (!abierta) {
    if (!guardado) {
      return editable ? (
        <Typography variant="caption" onClick={abrir} sx={{ ...linkSx, display: 'inline-block', mt: 0.5, fontSize: '0.78rem' }}>
          + Agregar descripción
        </Typography>
      ) : null;
    }
    return (
      <Box onClick={abrir} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5, cursor: 'pointer', minWidth: 0, maxWidth: 720 }}>
        <Typography variant="caption" sx={{ fontSize: '0.8rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {guardado}
        </Typography>
        <Typography variant="caption" sx={{ ...linkSx, fontSize: '0.75rem' }}>ver ▾</Typography>
      </Box>
    );
  }

  const esDeMaxi = !!original && texto.trim() === original;
  return (
    <Box sx={{ mt: 0.75, maxWidth: 720 }}>
      <InputBase
        inputRef={inputRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => { if (e.key === 'Escape') { setTexto(guardado); setAbierta(false); } }}
        readOnly={!editable}
        multiline minRows={1} maxRows={4}
        placeholder="Descripción del producto (la que va en la carta)…"
        sx={{
          width: '100%', bgcolor: '#fff', color: 'text.primary', borderRadius: 1, px: 1.25, py: 0.75,
          fontSize: '0.85rem', lineHeight: 1.45, border: '1px solid', borderColor: estado === 'error' ? 'error.main' : 'rgba(0,0,0,0.12)',
          '&.Mui-focused': { borderColor: '#5BC2EA' },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.4, gap: 2 }}>
        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
          {estado === 'guardando' ? 'Guardando…'
            : estado === 'error' ? 'No se pudo guardar. Probá de nuevo.'
              : esDeMaxi ? 'Descripción de MaxiRest · si la cambiás, manda la tuya'
                : original ? 'Descripción propia · vaciala para volver a la de MaxiRest' : 'Se guarda al salir del campo'}
        </Typography>
        <Typography variant="caption" onClick={() => { guardar(); setAbierta(false); }} sx={{ ...linkSx, fontSize: '0.72rem' }}>
          ocultar ▴
        </Typography>
      </Box>
    </Box>
  );
}
