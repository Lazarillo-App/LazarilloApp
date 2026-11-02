// src/componentes/gestion/BuscadorPanel.jsx
// Buscador del Panel (⌘K / Ctrl+K), igual a lazarillo_gestion/components/dashboard/command-palette.tsx:
// "Buscar en" Rubros / Conceptos / Proveedores / Observaciones / Importes; al tipear busca en el
// servidor (debounce 300 ms). Elegir un resultado deja la tabla filtrada (chip arriba). Si lo
// elegido no tiene compras en la sucursal que se mira, se va a la sucursal donde las tiene; las
// observaciones e importes además llevan al año del gasto.

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, InputBase, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { TIPOS } from '@/gestion/buscadorTipos';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS } from '@/gestion/formato';
import { quitarAcentos, opcionContiene } from '@/gestion/busquedaTexto';
import { parsearImporte } from '@/gestion/busquedaImporte';
import { anioDeFecha, formatFechaConAnio } from '@/gestion/fechaObservacion';

const ORDEN_SUGERENCIAS = ['rubro', 'concepto', 'proveedor'];
const CATEGORIAS = ['rubro', 'concepto', 'proveedor', 'observacion', 'importe'];
const VACIO = [];

// "En la sucursal que se mira": sin sucursal elegida (todas), todo cuenta como acá.
const enActual = (sucursal) => (s) => (sucursal === undefined ? true : (sucursal === null ? s.sucursal === null : s.sucursal === sucursal));
const contiene = (texto, q) => quitarAcentos(String(texto ?? '')).toLowerCase().includes(quitarAcentos(q).toLowerCase());

export default function BuscadorPanel({ open, onClose, onElegir }) {
  const { businessId, sucursal } = usePanelGestion();
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState(null);
  const [activo, setActivo] = useState(0);
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => setDebounced(q.length >= 2 ? q : ''), q.length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  // Preview ("Buscar en"): de la sucursal que se mira; cacheado entre aperturas.
  const preview = useQuery({
    queryKey: ['gestionBuscarPreview', businessId, sucursal],
    queryFn: () => GestionAPI.sugerencias({ sucursal }),
    enabled: open && !!businessId,
  });
  const busqueda = useQuery({
    queryKey: ['gestionBuscar', businessId, debounced],
    queryFn: () => GestionAPI.sugerencias({ q: debounced, sucursal }),
    enabled: open && !!businessId && !!debounced,
  });
  const obsOn = debounced.length >= 2 && (tipo === null || tipo === 'observacion');
  const obs = useQuery({
    queryKey: ['gestionBuscarObs', businessId, debounced],
    queryFn: () => GestionAPI.observaciones(debounced),
    enabled: open && !!businessId && obsOn,
  });
  const impOn = parsearImporte(debounced) !== null && (tipo === null || tipo === 'importe');
  const imp = useQuery({
    queryKey: ['gestionBuscarImp', businessId, debounced],
    queryFn: () => GestionAPI.importes(debounced),
    enabled: open && !!businessId && impOn,
  });

  const cerrar = () => { setQuery(''); setTipo(null); setActivo(0); onClose(); };
  const q = query.trim();
  const mostrarResultados = q.length > 0 || tipo !== null;
  const sugerencias = (q.length >= 2 ? busqueda.data : preview.data) ?? VACIO;
  const observaciones = q.length >= 2 && (tipo === null || tipo === 'observacion') ? obs.data ?? VACIO : VACIO;
  const importes = parsearImporte(q) !== null && (tipo === null || tipo === 'importe') ? imp.data ?? VACIO : VACIO;
  const opcion = observaciones.length > 0 ? opcionContiene(query) : null;
  const esActual = enActual(sucursal);

  // Lista plana de lo que se ve (para navegar con flechas), agrupada por categoría.
  const grupos = useMemo(() => {
    if (!mostrarResultados) {
      return [{ titulo: 'Buscar en', items: CATEGORIAS.map((t) => ({ key: `cat-${t}`, kind: 'categoria', tipo: t })) }];
    }
    const out = [];
    for (const t of tipo ? [tipo] : ORDEN_SUGERENCIAS) {
      if (t === 'observacion' || t === 'importe') continue;
      // Como cmdk: lo que vino del servidor también se filtra por lo tipeado (sin acentos).
      const items = sugerencias.filter((s) => s.type === t && (!q || contiene(s.label, q)));
      if (items.length) out.push({ titulo: TIPOS[t].plural, items: items.map((s) => ({ key: s.id, kind: 'sugerencia', s })) });
    }
    if (observaciones.length) {
      out.push({
        titulo: 'Observaciones',
        items: [
          ...(opcion ? [{ key: 'obs-contiene', kind: 'contiene', opcion }] : []),
          ...observaciones.map((o) => ({ key: o.id, kind: 'observacion', o })),
        ],
      });
    }
    if (importes.length) out.push({ titulo: 'Importes', items: importes.map((i) => ({ key: i.id, kind: 'importe', i })) });
    return out;
  }, [mostrarResultados, tipo, sugerencias, observaciones, importes, opcion, q]);
  const plano = grupos.flatMap((g) => g.items);
  const conteos = {
    ...Object.fromEntries(ORDEN_SUGERENCIAS.map((t) => [t, (preview.data ?? VACIO).filter((s) => s.type === t).length])),
    observacion: observaciones.length,
    importe: importes.length,
  };

  // Lo elegido vive en otra sucursal → se navega a la primera donde tiene compras.
  const sucursalDestino = (lista) => (lista && lista.length && !lista.some(esActual) ? lista[0].sucursal : undefined);

  function elegir(item) {
    if (!item) return;
    if (item.kind === 'categoria') { setTipo(item.tipo); setActivo(0); return; }
    if (item.kind === 'sugerencia') {
      onElegir({ param: item.s.param, value: item.s.value, label: item.s.label, sucursal: sucursalDestino(item.s.sucursales) });
    } else if (item.kind === 'contiene') {
      onElegir({ param: 'observacionQuery', value: item.opcion.query, label: item.opcion.label });
    } else if (item.kind === 'observacion') {
      onElegir({ param: 'observacionQuery', value: item.o.label, label: item.o.label, anio: anioDeFecha(item.o.fecha), sucursal: esActual(item.o) ? undefined : item.o.sucursal });
    } else if (item.kind === 'importe') {
      onElegir({ param: 'importeQuery', value: q, label: fmtARS(Number(item.i.importe)), anio: anioDeFecha(item.i.fecha), sucursal: esActual(item.i) ? undefined : item.i.sucursal });
    }
    cerrar();
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(plano.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(plano[activo]); }
    else if (e.key === 'Backspace' && !query && tipo) { setTipo(null); setActivo(0); }
  };

  const cargando = preview.isLoading || busqueda.isFetching || obs.isFetching || imp.isFetching;
  const promptVacio = (tipo === 'observacion' || tipo === 'importe') && !q;
  let indice = -1;

  return (
    <Dialog open={open} onClose={cerrar} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden', alignSelf: 'flex-start', mt: '12vh' } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, height: 56, borderBottom: 1, borderColor: 'divider' }}>
        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <InputBase
          autoFocus fullWidth value={query} onKeyDown={onKeyDown}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value) setTipo(null); setActivo(0); }}
          placeholder="Buscar rubro, concepto, proveedor, observación o importe…"
          sx={{ fontSize: 16 }}
        />
        {cargando && <CircularProgress size={14} />}
        <Box component="button" type="button" onClick={cerrar} aria-label="Cerrar" sx={{ all: 'unset', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </Box>
      </Box>

      <Box sx={{ maxHeight: 380, overflowY: 'auto', p: 0.5 }}>
        {promptVacio && (
          <Box sx={{ py: 5, textAlign: 'center', fontSize: 14, color: 'text.disabled' }}>
            {tipo === 'observacion' ? 'Escribí para buscar en observaciones…' : 'Escribí un importe, por ejemplo 811.980 o 811980,50…'}
          </Box>
        )}
        {!promptVacio && mostrarResultados && plano.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'text.disabled' }}>{cargando ? 'Buscando…' : `Sin resultados para "${query}"`}</Box>
        )}
        {!promptVacio && grupos.map((g) => (
          <Box key={g.titulo} sx={{ mb: 0.5 }}>
            <Box sx={{ px: 1.5, py: 1, fontSize: 11, fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase', color: 'text.disabled' }}>{g.titulo}</Box>
            {g.items.map((item) => {
              indice += 1;
              const i = indice;
              return (
                <Fila key={item.key} item={item} activo={i === activo} onHover={() => setActivo(i)} onClick={() => elegir(item)} conteos={conteos} esActual={esActual} />
              );
            })}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', fontSize: 11, color: 'text.disabled' }}>
        <span><Tecla>↑</Tecla><Tecla>↓</Tecla> navegar</span>
        <span><Tecla>↵</Tecla> seleccionar</span>
        <span><Tecla>esc</Tecla> cerrar</span>
        {tipo && (
          <Box component="button" type="button" onClick={() => { setTipo(null); setActivo(0); }} sx={{ all: 'unset', cursor: 'pointer', ml: 'auto', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
            ← todas las categorías
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

function Tecla({ children }) {
  return <Box component="kbd" sx={{ display: 'inline-flex', minWidth: 16, height: 16, px: 0.5, mr: 0.5, alignItems: 'center', justifyContent: 'center', borderRadius: 0.5, border: 1, borderColor: 'divider', bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: 10 }}>{children}</Box>;
}

function Icono({ tipo, grande }) {
  const { Icon, color, bg } = TIPOS[tipo];
  const s = grande ? 28 : 24;
  return <Box component="span" sx={{ width: s, height: s, flexShrink: 0, borderRadius: 1.5, bgcolor: bg, display: 'grid', placeItems: 'center' }}><Icon sx={{ fontSize: grande ? 15 : 13, color }} /></Box>;
}

function Etiqueta({ tipo }) {
  const { label, color, bg } = TIPOS[tipo];
  return <Box component="span" sx={{ flexShrink: 0, fontSize: 10, fontWeight: 500, px: 0.75, py: 0.25, borderRadius: 999, bgcolor: bg, color }}>{label}</Box>;
}

function EnOtra({ texto }) {
  return <Box component="span" title={texto} sx={{ flexShrink: 0, maxWidth: 224, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, fontWeight: 500, px: 0.75, py: 0.25, borderRadius: 999, border: 1, borderColor: 'divider', color: 'text.secondary' }}>{texto}</Box>;
}

const Dos = ({ meta, texto }) => (
  <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
    <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</Box>
    <Box component="span" sx={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</Box>
  </Box>
);

function Fila({ item, activo, onHover, onClick, conteos, esActual }) {
  const sx = {
    display: 'flex', alignItems: 'center', gap: 1.5, mx: 0.5, px: 1, py: 1, borderRadius: 2, cursor: 'pointer',
    bgcolor: activo ? 'grey.100' : 'transparent',
  };
  if (item.kind === 'categoria') {
    return (
      <Box sx={sx} onMouseEnter={onHover} onClick={onClick}>
        <Icono tipo={item.tipo} grande />
        <Box component="span" sx={{ flex: 1, fontSize: 14 }}>{TIPOS[item.tipo].plural}</Box>
        <Box component="span" sx={{ fontSize: 12, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{conteos[item.tipo] || ''}</Box>
        <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      </Box>
    );
  }
  if (item.kind === 'sugerencia') {
    const { s } = item;
    const enOtras = s.sucursales && s.sucursales.length && !s.sucursales.some(esActual) ? s.sucursales.map((x) => x.nombre) : [];
    return (
      <Box sx={sx} onMouseEnter={onHover} onClick={onClick}>
        <Icono tipo={s.type} />
        <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</Box>
        {enOtras.length > 0 && <EnOtra texto={`en: ${enOtras.join(' · ')}`} />}
        <Etiqueta tipo={s.type} />
      </Box>
    );
  }
  if (item.kind === 'contiene') {
    return (
      <Box sx={sx} onMouseEnter={onHover} onClick={onClick}>
        <Icono tipo="observacion" />
        <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Todas las observaciones que {item.opcion.label}</Box>
      </Box>
    );
  }
  if (item.kind === 'observacion') {
    const { o } = item;
    const meta = [formatFechaConAnio(o.fecha), o.proveedorNombre ?? o.conceptoNombre, o.importe != null ? fmtARS(Number(o.importe)) : null].filter(Boolean).join(' · ');
    return (
      <Box sx={sx} onMouseEnter={onHover} onClick={onClick}>
        <Icono tipo="observacion" />
        <Dos meta={meta} texto={o.label} />
        {!esActual(o) && <EnOtra texto={o.nombre} />}
        <Etiqueta tipo="observacion" />
      </Box>
    );
  }
  const { i } = item;
  const meta = [formatFechaConAnio(i.fecha), i.proveedorNombre ?? i.conceptoNombre ?? 'Sin proveedor'].filter(Boolean).join(' · ');
  return (
    <Box sx={sx} onMouseEnter={onHover} onClick={onClick}>
      <Icono tipo="importe" />
      <Dos meta={meta} texto={i.observac?.trim() ? i.observac : (i.conceptoNombre ?? '')} />
      <Box component="span" sx={{ flexShrink: 0, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmtARS(Number(i.importe))}</Box>
      {!esActual(i) && <EnOtra texto={i.nombre} />}
      <Etiqueta tipo="importe" />
    </Box>
  );
}
