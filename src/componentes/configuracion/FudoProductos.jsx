// src/componentes/configuracion/FudoProductos.jsx
// Fudo (17/11/2026): vincular cada producto de Fudo con un artículo de Lazarillo. Fudo casi nunca tiene
// código de producto, así que el vínculo es por el producto de Fudo y queda aunque le cambien el nombre.
// Lazarillo sugiere el artículo por código o por nombre igual; el usuario acepta (de a uno o todas) o
// elige otro. Al vincular, el back recalcula las ventas de todos los días en que se vendió.
// Celular: tarjetas con el selector a todo el ancho; el buscador y los filtros arriba.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Chip, TextField, CircularProgress, Alert, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { FudoAPI } from '@/servicios/apiFudo';
import { showAlert } from '@/servicios/appAlert';
import SelectorBuscable from '@/componentes/SelectorBuscable';
import { useCelular } from '@/componentes/base';

const pesos = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const unidades = (n) => (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const FILTROS = [['sin', 'Sin vincular'], ['con', 'Vinculados'], ['todos', 'Todos']];

export default function FudoProductos({ businessId, themeColor = '#2492C8', onCambio }) {
  const celular = useCelular();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('sin');
  const [q, setQ] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await FudoAPI.productos(businessId));
      setError('');
    } catch {
      setError('No pude leer los productos de Fudo.');
    }
  }, [businessId]);
  useEffect(() => { cargar(); }, [cargar]);

  // El selector trabaja con textos: «Nombre · #id» los hace únicos aunque se repita el nombre.
  const { opciones, idDe, textoDe } = useMemo(() => {
    const arts = datos?.articulos || [];
    const t = (a) => `${a.nombre || 'Sin nombre'} · #${a.id}`;
    const porTexto = new Map(arts.map((a) => [t(a), a.id]));
    const porId = new Map(arts.map((a) => [Number(a.id), t(a)]));
    return { opciones: arts.map(t), idDe: (s) => porTexto.get(s) ?? null, textoDe: (id) => (id == null ? '' : porId.get(Number(id)) || `#${id}`) };
  }, [datos]);

  const productos = useMemo(() => datos?.productos || [], [datos]);
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return productos.filter((p) => {
      if (filtro === 'sin' && p.articulo_id != null) return false;
      if (filtro === 'con' && p.articulo_id == null) return false;
      return !t || `${p.nombre} ${p.categoria || ''} ${p.articulo_nombre || ''}`.toLowerCase().includes(t);
    });
  }, [productos, filtro, q]);
  const conSugerencia = productos.filter((p) => p.articulo_id == null && p.sugerido_id != null);
  const cuenta = { sin: productos.filter((p) => p.articulo_id == null).length, con: productos.filter((p) => p.articulo_id != null).length, todos: productos.length };

  const guardar = async (cambios, texto) => {
    setGuardando(true);
    // Se ve al instante; si falla, se recarga lo que hay en el servidor.
    setDatos((d) => ({
      ...d,
      productos: d.productos.map((p) => {
        const c = cambios.find((x) => x.fudo_id === p.fudo_id);
        return c ? { ...p, articulo_id: c.articulo_id } : p;
      }),
    }));
    try {
      const r = await FudoAPI.vincular(businessId, cambios);
      showAlert(texto(r), 'success');
      onCambio?.();
    } catch (e) {
      showAlert(`No se pudo guardar: ${e?.data?.error || e?.message || 'error'}`, 'error');
    } finally {
      setGuardando(false);
      cargar();
    }
  };
  const vincularUno = (p, articuloId) => guardar([{ fudo_id: p.fudo_id, articulo_id: articuloId }],
    (r) => (articuloId == null ? `Se desvinculó ${p.nombre}.` : `${p.nombre} vinculado${r?.dias ? ` · se recalcularon ${r.dias} día${r.dias === 1 ? '' : 's'}` : ''}.`));
  const aceptarTodas = () => guardar(conSugerencia.map((p) => ({ fudo_id: p.fudo_id, articulo_id: p.sugerido_id })),
    (r) => `Se vincularon ${r?.cambiados ?? conSugerencia.length} productos${r?.dias ? ` · se recalcularon ${r.dias} días` : ''}.`);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!datos) return <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>;

  const sugerido = (p) => p.articulo_id == null && p.sugerido_id != null;
  const selector = (p) => (
    <Stack spacing={0.5} sx={{ minWidth: celular ? 0 : 280 }}>
    <Stack direction="row" spacing={0.75} alignItems="center">
      <SelectorBuscable label={p.articulo_id == null ? 'Elegí un artículo' : 'Artículo'} value={textoDe(p.articulo_id)} opciones={opciones} deshabilitado={guardando}
        onChange={(s) => { const id = idDe(s); if (id != null) vincularUno(p, id); }} />
      {sugerido(p) && (
        <Button size="small" variant="outlined" disabled={guardando} onClick={() => vincularUno(p, p.sugerido_id)}
          sx={{ minHeight: 40, textTransform: 'none', fontWeight: 700, borderColor: themeColor, color: themeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Aceptar
        </Button>
      )}
      {p.articulo_id != null && (
        <Button size="small" disabled={guardando} onClick={() => vincularUno(p, null)} sx={{ minHeight: 40, textTransform: 'none', color: 'text.secondary', flexShrink: 0 }}>
          Quitar
        </Button>
      )}
    </Stack>
    {sugerido(p) && (
      <Typography sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'anywhere' }}>
        Sugerido: <b style={{ color: '#15213E' }}>{textoDe(p.sugerido_id)}</b>
      </Typography>
    )}
    </Stack>
  );

  return (
    <Box>
      <Stack spacing={1.25} sx={{ px: 2, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Cada producto de Fudo va con un artículo de Lazarillo. Una vez vinculado queda así aunque cambies el nombre en Fudo.
          {!datos.articulos?.length && <> <b>Todavía no tenés artículos cargados:</b> cargalos primero en Artículos y después volvé acá.</>}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
          <Stack direction="row" spacing={0.75}>
            {FILTROS.map(([k, l]) => (
              <Chip key={k} label={`${l} (${cuenta[k]})`} onClick={() => setFiltro(k)} variant={filtro === k ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, height: 32, ...(filtro === k ? { bgcolor: themeColor, color: '#fff' } : {}) }} />
            ))}
          </Stack>
          <TextField size="small" type="search" placeholder="Buscar producto o artículo…" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: { sm: '0 1 280px' } }} />
          <Box sx={{ flex: 1 }} />
          {conSugerencia.length > 0 && (
            <Button variant="contained" size="small" onClick={aceptarTodas} disabled={guardando}
              sx={{ minHeight: 40, textTransform: 'none', fontWeight: 700, bgcolor: themeColor, '&:hover': { bgcolor: themeColor, filter: 'brightness(0.92)' } }}>
              {conSugerencia.length === 1 ? 'Aceptar la sugerencia' : `Aceptar las ${conSugerencia.length} sugerencias`}
            </Button>
          )}
        </Stack>
      </Stack>

      {celular ? (
        // Tarjetas propias (no ListaTarjetas): el selector necesita el ancho entero de la tarjeta.
        <Stack spacing={1} sx={{ px: 1, pb: 1.5 }}>
          {visibles.length === 0 && (
            <Typography sx={{ p: 2, fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
              {filtro === 'sin' ? 'No hay productos sin vincular. ✓' : 'No hay productos para mostrar.'}
            </Typography>
          )}
          {visibles.map((p) => (
            <Box key={p.fudo_id} sx={{ bgcolor: '#fff', border: '1px solid rgba(21,33,62,.12)', borderRadius: 3, p: 1.5, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{p.nombre || `Producto ${p.fudo_id}`}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                    {[p.categoria, `${pesos(p.amount_90d)} · ${unidades(p.qty_90d)} u. en 90 días`, p.activo === false ? 'inactivo en Fudo' : null].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {p.articulo_id != null && <Chip size="small" label="Vinculado" sx={{ height: 22, fontWeight: 700, bgcolor: '#1a9c6e1a', color: '#1a9c6e' }} />}
              </Stack>
              <Box sx={{ mt: 1.25 }}>{selector(p)}</Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { color: 'text.secondary', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' } }}>
                <TableCell>Producto de Fudo</TableCell>
                <TableCell align="right">Vendido 90 días</TableCell>
                <TableCell align="right">Unidades</TableCell>
                <TableCell>Artículo en Lazarillo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.length === 0 && (
                <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                  {filtro === 'sin' ? 'No hay productos sin vincular. ✓' : 'No hay productos para mostrar.'}
                </TableCell></TableRow>
              )}
              {visibles.map((p) => (
                <TableRow key={p.fudo_id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.nombre || `Producto ${p.fudo_id}`}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {[p.categoria, p.codigo ? `cód. ${p.codigo}` : null, p.activo === false ? 'inactivo en Fudo' : null].filter(Boolean).join(' · ') || ' '}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>{pesos(p.amount_90d)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>{unidades(p.qty_90d)}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>{selector(p)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
