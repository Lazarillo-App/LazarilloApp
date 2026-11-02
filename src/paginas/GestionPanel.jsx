// src/paginas/GestionPanel.jsx
// Panel de Gestión, igual a lazarillo_gestion (components/dashboard/dashboard-content.tsx,
// dashboard-filters.tsx, dashboard-tab-content.tsx, switch-eco-fin.tsx, vista-tabla-toggles.tsx).
// Solo owner/admin (la ruta va con RequireAdminOrOwner; el back también lo exige).
//
// Pasos del port: 1 Compras (hecho), 2 Ventas (hecho), 3 Resultados + tarjetas KPI, 4 lo editable.
// La sucursal sale del selector global de sucursales (BranchContext), como en el resto de la app.

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Paper, Typography, ToggleButton, ToggleButtonGroup, Select, MenuItem, Chip, Stack, Tooltip, Button,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { GestionAPI, sucursalParam } from '@/servicios/apiGestion';
import PivotCompras from '@/componentes/gestion/PivotCompras';
import PivotVentas from '@/componentes/gestion/PivotVentas';
import { MESES, MESES_IDX } from '@/gestion/formato';

const ANIO_ACTUAL = new Date().getFullYear();
// El kit trae el año actual y el anterior; el historial viejo llega con la migración desde gestion.
const ANIOS = [ANIO_ACTUAL, ANIO_ACTUAL - 1, ANIO_ACTUAL - 2];

const TABS = [
  { v: 'compras', label: 'Compras' },
  { v: 'ventas', label: 'Ventas' },
  { v: 'resultados', label: 'Resultados', proximamente: true },
];

// Preferencias de vista por negocio (en gestion: zustand persistido). Solo comodidad del
// usuario: si localStorage no está disponible, se usan los valores por defecto.
const claveEstado = (bizId) => `gestion:panel:${bizId || 'default'}`;
const ESTADO_INICIAL = {
  year: ANIO_ACTUAL, meses: [], tab: 'compras', agrupacion: 'concepto', modoCelda: 'importe',
  modo: 'economica', sort: { col: 1, dir: 'desc' },
};

function leerEstado(bizId) {
  try {
    const raw = localStorage.getItem(claveEstado(bizId));
    return raw ? { ...ESTADO_INICIAL, ...JSON.parse(raw) } : ESTADO_INICIAL;
  } catch {
    return ESTADO_INICIAL;
  }
}
function guardarEstado(bizId, estado) {
  try { localStorage.setItem(claveEstado(bizId), JSON.stringify(estado)); } catch { /* sin storage: no se recuerda */ }
}

// Botonera chica de la barra de la tarjeta (vista-tabla-toggles.tsx).
const sxGrupo = {
  bgcolor: 'background.paper',
  '& .MuiToggleButton-root': { height: 28, px: 1.25, py: 0, fontSize: 12, fontWeight: 500, textTransform: 'none', gap: 0.5, border: 0, borderRadius: '6px !important' },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'grey.900', color: '#fff' },
  border: 1, borderColor: 'divider', borderRadius: 2, p: 0.25,
};

export default function GestionPanel() {
  const { activeBusinessId, active } = useBusiness() || {};
  const { activeBranchFilter, activeBranch } = useBranch() || {};
  const [estado, setEstado] = useState(() => leerEstado(activeBusinessId));

  // Al cambiar de negocio, sus propias preferencias.
  useEffect(() => { setEstado(leerEstado(activeBusinessId)); }, [activeBusinessId]);
  useEffect(() => { guardarEstado(activeBusinessId, estado); }, [activeBusinessId, estado]);

  const cambiar = (parcial) => setEstado((e) => ({ ...e, ...parcial }));
  const toggleMes = (m) => setEstado((e) => {
    const set = new Set(e.meses);
    if (set.has(m)) set.delete(m); else set.add(m);
    // Los 12 marcados es lo mismo que ninguno (todo el año), como en gestion.
    return { ...e, meses: set.size === 12 ? [] : [...set].sort((a, b) => a - b) };
  });
  const ordenar = (col) => setEstado((e) => ({
    ...e,
    sort: e.sort.col === col ? { col, dir: e.sort.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' },
  }));

  const sucursal = sucursalParam(activeBranchFilter);
  const columnas = estado.meses.length ? estado.meses : MESES_IDX;

  const paramsCompras = useMemo(() => ({
    year: estado.year,
    sucursal,
    months: estado.meses,
    agrupacion: estado.agrupacion,
    modo: estado.modo === 'financiera' ? 'financiera' : undefined,
  }), [estado.year, sucursal, estado.meses, estado.agrupacion, estado.modo]);
  const paramsVentas = useMemo(() => ({ year: estado.year, sucursal, months: estado.meses }), [estado.year, sucursal, estado.meses]);

  const compras = useQuery({
    enabled: !!activeBusinessId && estado.tab === 'compras',
    queryKey: ['gestionPivot', activeBusinessId, paramsCompras],
    queryFn: () => GestionAPI.pivot(paramsCompras),
    staleTime: 60 * 1000,
  });
  // Ventas: su pestaña y, en Compras, la fila de Ingresos y el % (useOperacionKpis de gestion).
  const ventas = useQuery({
    enabled: !!activeBusinessId && (estado.tab === 'compras' || estado.tab === 'ventas'),
    queryKey: ['gestionPivotVentas', activeBusinessId, paramsVentas],
    queryFn: () => GestionAPI.pivotVentas(paramsVentas),
    staleTime: 60 * 1000,
  });

  const nombreSucursal = activeBranchFilter?.mode === 'all' || !activeBranchFilter
    ? 'Todas las sucursales'
    : activeBranch?.name || 'Principal';

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', height: { md: 'calc(100vh - 64px)' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={600} noWrap>Panel de Gestión</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Resumen general de operaciones · {active?.name || 'Negocio'} · {nombreSucursal}
          </Typography>
        </Box>
        {/* Switch Económica / Financiera, arriba, a la altura del título. */}
        <Tooltip title="Económica: cada gasto en el mes de la factura (o del período, en sueldos). Financiera: en el mes en que se pagó.">
          <ToggleButtonGroup size="small" exclusive value={estado.modo} onChange={(_, v) => v && cambiar({ modo: v })} sx={sxGrupo}>
            <ToggleButton value="economica">Económica</ToggleButton>
            <ToggleButton value="financiera">Financiera</ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ pt: 3, pb: 2 }}>
        <Select size="small" value={estado.year} onChange={(e) => cambiar({ year: Number(e.target.value) })}>
          {ANIOS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </Select>
        {MESES_IDX.map((m) => (
          <Chip
            key={m}
            label={MESES[m - 1]}
            size="small"
            color={estado.meses.includes(m) ? 'primary' : 'default'}
            variant={estado.meses.includes(m) ? 'filled' : 'outlined'}
            onClick={() => toggleMes(m)}
          />
        ))}
        {estado.meses.length > 0 && <Button size="small" onClick={() => cambiar({ meses: [] })}>Todo el año</Button>}
      </Stack>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <ToggleButtonGroup
            exclusive
            value={estado.tab}
            onChange={(_, v) => v && cambiar({ tab: v })}
            sx={{ ...sxGrupo, bgcolor: 'grey.50', '& .MuiToggleButton-root': { ...sxGrupo['& .MuiToggleButton-root'], height: 30, px: 2, fontSize: 14 }, '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'background.paper', color: 'text.primary', boxShadow: 1 } }}
          >
            {TABS.map((t) => (
              <ToggleButton key={t.v} value={t.v} disabled={t.proximamente} title={t.proximamente ? 'Próximamente' : undefined}>{t.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          {estado.tab === 'compras' && (
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>ver por</Typography>
              <ToggleButtonGroup exclusive value={estado.agrupacion} onChange={(_, v) => v && cambiar({ agrupacion: v })} sx={sxGrupo}>
                <ToggleButton value="concepto">Concepto</ToggleButton>
                <ToggleButton value="proveedor"><GroupsIcon sx={{ fontSize: 13 }} />Proveedor</ToggleButton>
                <ToggleButton value="insumo" title="Cada gasto por sus insumos (informe 25); sin detalle, por su concepto"><Inventory2Icon sx={{ fontSize: 13 }} />Insumos</ToggleButton>
              </ToggleButtonGroup>
              {/* $ / % ing: cada celda mensual como peso sobre los ingresos de ese mes. */}
              <ToggleButtonGroup exclusive value={estado.modoCelda} onChange={(_, v) => v && cambiar({ modoCelda: v })} sx={sxGrupo}>
                <ToggleButton value="importe" title="Celdas en pesos">$</ToggleButton>
                <ToggleButton value="pct" title="Celdas como % de los ingresos de cada mes">% ing</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
        </Stack>
        {estado.tab === 'compras' && (
          <PivotCompras
            data={compras.data}
            isLoading={compras.isLoading}
            error={compras.error}
            ventas={ventas.data}
            ventasLoading={ventas.isLoading}
            months={columnas}
            agrupacion={estado.agrupacion}
            modoCelda={estado.modoCelda}
            sort={estado.sort}
            onSort={ordenar}
          />
        )}
        {estado.tab === 'ventas' && (
          <PivotVentas
            data={ventas.data}
            isLoading={ventas.isLoading}
            error={ventas.error}
            year={estado.year}
            months={columnas}
            sort={estado.sort}
            onSort={ordenar}
          />
        )}
      </Paper>
    </Box>
  );
}
