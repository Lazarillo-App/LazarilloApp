// src/componentes/gestion/DesdeElBanco.jsx
// «Desde el banco» (Diego 19/11/2026: «en Sin concepto de caja asociado deberían estar estos movimientos
// cuando aún no estén configurados… como atajo en el tablero, agrupados como "desde el banco"»).
// Lo que descontó Mercado Pago (comisiones, cargos de Mercado Libre, impuestos y retenciones) y TODAVÍA no
// entró al tablero, por mes. Va debajo de Sin rubro, en gris y sin sumar al total. Desde que arranca la carga
// sola (20/11/2026: por defecto, desde el 1/12) todo se carga y deja de verse acá; las comisiones de los meses
// con factura de Mercado Pago tampoco se ven (ya entraron por la factura).
// Al abrirlo, cada leyenda del débito; un clic en un mes lleva a esa pantalla con ese mes.
import React, { useState } from 'react';
import { Box, TableRow, TableCell } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GestionAPI } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { fmtARS } from '@/gestion/formato';
import { sxStickyNombre, sxNum, sxClic } from '@/gestion/estilos';
import { Expansor } from './piezasPivot';

const FONDO = '#f6f8fa';
// Las leyendas son largas: van en dos renglones (no ensanchan la columna de nombres).
const ANCHO = 170; // en dos renglones si hace falta: no ensancha la columna · ⚠ = falta elegir el concepto
const vacio = (v) => v == null || Math.abs(v) < 0.01;

function useDesdeElBanco() {
  const { businessId, year, sucursal } = usePanelGestion();
  return useQuery({
    queryKey: ['gestionDesdeElBanco', businessId, year, sucursal === undefined ? 'todas' : sucursal ?? 'principal'],
    queryFn: () => GestionAPI.desdeElBanco({ anio: year, sucursal }),
    enabled: !!businessId && !!year,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function FilasDesdeElBanco({ months, sinColTotal, extra = 0 }) {
  const { year } = usePanelGestion();
  const { data } = useDesdeElBanco();
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  if (!data?.grupos?.length || vacio(data.total)) return null;
  const ir = (mes) => navigate(`/movimientos-bancarios?tab=descuentos${mes ? `&mes=${year}-${String(mes).padStart(2, '0')}` : ''}`);
  const celdas = (values, total, sx = {}) => (<>
    {months.map((mes) => (
      <TableCell key={mes} onClick={vacio(values?.[mes]) ? undefined : () => ir(mes)}
        sx={{ ...sxNum, px: 1.5, color: 'text.secondary', fontStyle: 'italic', ...(vacio(values?.[mes]) ? {} : sxClic), ...sx }}>
        {vacio(values?.[mes]) ? '' : fmtARS(values[mes])}
      </TableCell>
    ))}
    {!sinColTotal && <TableCell onClick={() => ir()} sx={{ ...sxNum, px: 2, color: 'text.secondary', fontStyle: 'italic', ...sxClic, ...sx }}>{fmtARS(total)}</TableCell>}
  </>);
  return (<>
    <TableRow sx={{ '& td': { bgcolor: FONDO } }}>
      <TableCell sx={{ ...sxStickyNombre(FONDO), px: 2, py: 1 }}>
        <Expansor abierto={abierto} onClick={() => setAbierto((x) => !x)} indent={2.5}>
          <Box component="span" title="Lo que descontó Mercado Pago (comisiones, cargos e impuestos) y todavía no entró al tablero" sx={{ fontWeight: 600, color: 'text.secondary' }}>Desde el banco</Box>
        </Expansor>
        <Box sx={{ pl: 5.5, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11, color: 'text.disabled', whiteSpace: 'nowrap' }}>
          <span>no suma ·</span>
          <Box component="span" title="Lo que descontó Mercado Pago y todavía no entró al tablero (antes de que arrancara la carga sola). No suma al total."
            onClick={() => ir()} sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            elegir concepto ›
          </Box>
        </Box>
      </TableCell>
      {celdas(data.values, data.total, { py: 1 })}
      <TableCell colSpan={1 + extra} />
    </TableRow>
    {abierto && data.grupos.map((g) => (
      <TableRow key={g.grupo} hover sx={{ '& td': { bgcolor: FONDO } }}>
        <TableCell sx={{ ...sxStickyNombre(FONDO), px: 2, pl: 5.5, py: 0.75, fontSize: 12, color: g.concepto ? 'text.secondary' : '#b45309' }}>
          <Box sx={{ maxWidth: ANCHO, whiteSpace: 'normal', lineHeight: 1.3 }}
            title={`${g.nombre} · ${g.concepto ? `concepto ${g.concepto}, todavía no se cargó` : 'falta elegir el concepto de caja'}`}>
            {!g.concepto && '⚠ '}{g.nombre}
          </Box>
        </TableCell>
        {celdas(g.values, g.total, { py: 0.75, fontSize: 12 })}
        <TableCell colSpan={1 + extra} />
      </TableRow>
    ))}
  </>);
}
