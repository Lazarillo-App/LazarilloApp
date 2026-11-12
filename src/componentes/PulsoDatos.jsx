// src/componentes/PulsoDatos.jsx
// Pulso del header, al lado del logo (Diego, 06/11/2026): qué tan al día están los datos del
// negocio activo. Recetas y Balance hoy salen de fuentes distintas (sync de la app con MaxiRest
// / lo que sube el kit), así que el punto toma la PEOR de las dos y el tooltip muestra cada una
// con su punto y sus fechas. Mismo criterio de colores que el "actualizado al" de Balance
// (gestion/frescura.js): verde hasta ayer, ámbar 2-3 días, rojo más viejo.
// Tocar el punto = "actualizar ahora" (Diego, 06/11): todo desde el kit — relee lo que cambió para
// Balance y corre los pipelines de Recetas (ventas del 12, compras y pagos del 25/80). Mientras corre, el punto late; al terminar
// se refrescan las pantallas. Solo dueño/admin (staff ve el punto pero no lo puede tocar).
// Ojo: no hace correr el kit en la PC; Balance llega hasta la última corrida del kit.
// Back: GET /api/businesses/:id/pulso (balance llega null para staff) y POST …/pulso/actualizar.
//
// Diego, 08/11: "dice compras 21/10 atrasado, yo no sé si es que está atrasado o que no hay
// compras cargadas después de esa fecha, ojo con esa falla". La fecha del último dato no dice
// si algo está al día (puede no haber compras hace semanas). Con data.kit (negocios que suben
// por el kit) el punto se juzga por CUÁNDO SUBIÓ el kit (verde hasta 26 h, ámbar hasta 3 días,
// rojo después) y, en Recetas, por si la app ya tomó todo lo que subió (si no: ámbar, "falta
// leer lo último"). Las fechas quedan como dato: "última venta" / "última compra".
// Sin data.kit (negocio que no sube por el kit) sigue el criterio de antes (frescura por fecha).
//
// Diego, 10/11: "¿no debería cada sucursal tener su propio pulso?" y "¿por qué separa entre
// Recetas y Balance? ¿no debería ser una única subida?". Con data.kit.sucursales: un renglón
// por PC/sucursal (cuándo subió · ventas al · compras al), cada una juzgada por SU subida (antes
// se tomaba la más nueva y una PC caída quedaba escondida). Balance y Recetas ya no se separan:
// solo aparece un aviso si Lazarillo no tomó lo que subió (Recetas atrás de las fechas del kit en
// esa sucursal, o Balance sin leer desde la última subida). El punto del header = la peor.
// Con una sucursal elegida en el header, solo esa.
//
// Diego, 11/11: "el pulso debería ser para saber cuándo se subió el último lote a Render, no para
// saber cuándo se cargó la última compra". Cada renglón muestra SOLO cuándo subió esa PC (sin
// "ventas al / compras al"). El aviso de Recetas ya no compara fechas (una factura cargada en
// MaxiRest al día siguiente de su fecha daba un falso "no tomó lo último"): avisa si la PC subió
// lo que lee Recetas (12/25/80) y Recetas no pasó después (leidoVentas/leidoCompras), con 1 h 15
// de margen para la pasada de cada hora.
//
// Diego, 11/11 (después): "si la información está subida, el resto es problema nuestro… tenemos que
// trabajar en que no suceda". Sin avisos de Recetas ni de Balance en el pulso: solo la subida de cada
// PC. Lazarillo lee lo subido apenas la PC termina (back: services/kit/despuesDeSubir.js) y una
// lectura que falla queda en el log del servidor, no en la pantalla del cliente.

import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/servicios/apiBase';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { frescura, hoyArgentina } from '@/gestion/frescura';

const PUNTO = { al_dia: '#059669', atrasado: '#f59e0b', viejo: '#dc2626' };
const LEYENDA = { al_dia: 'al día', atrasado: 'atrasado', viejo: 'desactualizado' };
const PESO = { al_dia: 0, atrasado: 1, viejo: 2 };

const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const fechas = (f) => [f.ventas && `última venta ${ddmm(f.ventas)}`, f.compras && `última compra ${ddmm(f.compras)}`]
  .filter(Boolean).join(' · ');
const hm = (d) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// Estado por la subida del kit (ver arriba). Devuelve { estado, falta }.
function estadoPorKit(nombre, f, kit) {
  const horas = (Date.now() - new Date(kit.subida).getTime()) / 3_600_000;
  let estado = horas <= 26 ? 'al_dia' : horas <= 72 ? 'atrasado' : 'viejo';
  // Recetas: ¿la app ya tiene todo lo que subió el kit?
  const falta = nombre === 'Recetas'
    && ((kit.ventas && (!f.ventas || f.ventas < kit.ventas)) || (kit.compras && (!f.compras || f.compras < kit.compras)));
  if (falta && estado === 'al_dia') estado = 'atrasado';
  return { estado, falta: !!falta };
}

const horasDesde = (iso) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
const porSubida = (iso) => {
  if (!iso) return 'viejo';
  const h = horasDesde(iso);
  return h <= 26 ? 'al_dia' : h <= 72 ? 'atrasado' : 'viejo';
};
const peorDe = (estados) => estados.reduce((a, b) => (PESO[b] > PESO[a] ? b : a), 'al_dia');

// Renglones por sucursal (data.kit.sucursales): cuándo subió cada PC.
function porSucursal(data, filtro) {
  let filas = data.kit.sucursales;
  if (filtro?.mode === 'main') filas = filas.filter((x) => x.branchId == null);
  else if (filtro?.mode === 'branch') filas = filas.filter((x) => Number(x.branchId) === Number(filtro.branchId));
  if (!filas.length) return null;
  const conNombre = filas.length > 1; // con una sola (o una elegida) el nombre ya está en el título
  const conEstado = filas.map((x) => ({ ...x, estado: porSubida(x.subida) }));
  const peor = peorDe(conEstado.map((x) => x.estado));
  return { filas: conEstado, peor, conNombre };
}

// "hoy 11:37" / "ayer 08:02" / "05/11 08:01"
function cuando(iso, hoy) {
  const d = new Date(iso);
  const dia = new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const ayer = new Date(Date.parse(hoy + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  if (dia === hoy) return `hoy ${hm(d)}`;
  if (dia === ayer) return `ayer ${hm(d)}`;
  return `${ddmm(dia)} ${hm(d)}`;
}

const latido = {
  '@keyframes pulsoLatido': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.35, transform: 'scale(0.7)' } },
  animation: 'pulsoLatido 1s ease-in-out infinite',
};

function Punto({ estado, size = 10, late = false }) {
  return <Box component="span" sx={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', bgcolor: PUNTO[estado], display: 'inline-block', ...(late ? latido : null) }} />;
}

export default function PulsoDatos({ puedeActualizar = false }) {
  const { activeBusinessId, active } = useBusiness() || {};
  const { activeBranchFilter, activeBranch } = useBranch() || {};
  const queryClient = useQueryClient();
  const [pedido, setPedido] = React.useState(false); // tocado, esperando que el back confirme
  const [aviso, setAviso] = React.useState(null);
  const { data } = useQuery({
    queryKey: ['pulsoDatos', activeBusinessId],
    queryFn: () => api(`/businesses/${activeBusinessId}/pulso`, { redirectOn401: false }),
    enabled: !!activeBusinessId,
    staleTime: 5 * 60_000,
    // mientras actualiza, pregunta cada 5 s; si no, cada 15 min
    refetchInterval: (q) => (q.state.data?.actualizando ? 5_000 : 15 * 60_000),
    retry: 1,
  });
  const actualizando = pedido || !!data?.actualizando;

  // Al terminar: refrescar lo que está en pantalla y avisar.
  const terminar = React.useCallback(() => {
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'pulsoDatos' });
    setAviso('Actualizado');
  }, [queryClient]);
  React.useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Venía actualizando y ya no → terminó.
  const antes = React.useRef(false);
  React.useEffect(() => {
    if (data?.actualizando) antes.current = true;
    else if (antes.current) { antes.current = false; terminar(); }
  }, [data?.actualizando, terminar]);

  const actualizar = async () => {
    if (!puedeActualizar || actualizando || !activeBusinessId) return;
    setPedido(true);
    setAviso(null);
    try {
      await api(`/businesses/${activeBusinessId}/pulso/actualizar`, { method: 'POST', redirectOn401: false });
      const d = await queryClient.fetchQuery({
        queryKey: ['pulsoDatos', activeBusinessId],
        queryFn: () => api(`/businesses/${activeBusinessId}/pulso`, { redirectOn401: false }),
        staleTime: 0,
      });
      if (!d?.actualizando) terminar(); // ya había terminado (nada nuevo que leer)
    } catch {
      setAviso('No se pudo actualizar');
    } finally {
      setPedido(false);
    }
  };

  const hoy = hoyArgentina();
  const suc = data?.kit?.sucursales?.length ? porSucursal(data, activeBranchFilter) : null;
  const fuentes = [
    ['Balance', data?.balance],
    ['Recetas', data?.recetas],
  ]
    .filter(([, f]) => f && (f.ventas || f.compras))
    .map(([nombre, f]) => (data?.kit?.subida
      ? { nombre, f, ...estadoPorKit(nombre, f, data.kit) }
      : { nombre, f, estado: frescura(f.ventas ?? f.compras, hoy), falta: false }));
  if (!suc && !fuentes.length) return null;

  const peor = suc ? suc.peor : fuentes.reduce((a, b) => (PESO[b.estado] > PESO[a.estado] ? b : a)).estado;
  const imp = data?.balance?.importado ? new Date(data.balance.importado) : null;
  const lectura = imp
    ? `${String(imp.getDate()).padStart(2, '0')}/${String(imp.getMonth() + 1).padStart(2, '0')} ${imp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : null;
  const pie = [
    data?.balance && `Balance: lo que sube el kit${lectura ? `, última lectura ${lectura}` : ''}`,
    data?.recetas && 'Recetas: del kit al tocar el punto',
  ].filter(Boolean).join(' · ');
  const nombre = (suc && activeBranchFilter && activeBranchFilter.mode !== 'all' && activeBranch?.name) || active?.name || 'Negocio';

  return (
    <Tooltip
      enterDelay={150}
      placement="bottom-start"
      slotProps={{ tooltip: { sx: { maxWidth: 'none' } } }}
      title={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 12, lineHeight: 1.45, py: 0.25 }}>
          <Box sx={{ fontWeight: 600 }}>{nombre} · {LEYENDA[peor]}</Box>
          {suc && (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${suc.conNombre ? 3 : 2}, max-content)`, justifyContent: 'start', alignItems: 'center', columnGap: 1.25, rowGap: 0.25, whiteSpace: 'nowrap' }}>
              {suc.filas.map((x) => (
                <React.Fragment key={x.pdv}>
                  <Punto estado={x.estado} size={9} />
                  {suc.conNombre && <Box component="span" sx={{ fontWeight: 600 }}>{x.nombre}</Box>}
                  <span>{x.subida ? `${horasDesde(x.subida) > 26 ? 'no sube desde' : 'subió'} ${cuando(x.subida, hoy)}` : 'todavía no subió'}</span>
                </React.Fragment>
              ))}
            </Box>
          )}
          {!suc && data?.kit?.subida && (
            <Box sx={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
              {(Date.now() - new Date(data.kit.subida).getTime()) / 3_600_000 > 26 ? 'El kit no sube desde' : 'El kit subió'} {cuando(data.kit.subida, hoy)}
            </Box>
          )}
          {!suc && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', justifyContent: 'start', alignItems: 'center', columnGap: 1, rowGap: 0.25, whiteSpace: 'nowrap' }}>
            {fuentes.map(({ nombre: n, f, estado, falta }) => (
              <React.Fragment key={n}>
                <Punto estado={estado} size={9} />
                <Box component="span" sx={{ opacity: 0.8, pr: 1 }}>{n}</Box>
                <span>{fechas(f)}{falta ? ' — falta leer lo último' : (estado !== 'al_dia' ? ` — ${LEYENDA[estado]}` : '')}</span>
              </React.Fragment>
            ))}
          </Box>}
          {!suc && pie && <Box sx={{ opacity: 0.7, mt: 0.25, whiteSpace: 'nowrap' }}>{pie}</Box>}
          {puedeActualizar && (
            <Box sx={{ mt: 0.25, fontWeight: 500 }}>
              {actualizando ? 'Actualizando…' : (aviso || 'Tocá el punto para actualizar ahora')}
            </Box>
          )}
        </Box>
      }
    >
      <Box
        component="button"
        type="button"
        aria-label={`Datos de ${nombre}: ${LEYENDA[peor]}${puedeActualizar ? ' — actualizar ahora' : ''}`}
        aria-busy={actualizando || undefined}
        onClick={actualizar}
        sx={{ all: 'unset', cursor: puedeActualizar ? (actualizando ? 'progress' : 'pointer') : 'help', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', '&:focus-visible': { outline: '2px solid currentColor' } }}
      >
        <Punto estado={peor} late={actualizando} />
      </Box>
    </Tooltip>
  );
}
