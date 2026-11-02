// src/paginas/GestionPanel.jsx
// Panel de Gestión (port de lazarillo_gestion: components/dashboard/dashboard-content.tsx,
// dashboard-filters.tsx, dashboard-tab-content.tsx, switch-eco-fin.tsx, vista-tabla-toggles.tsx).
// Solo owner/admin (la ruta va con RequireAdminOrOwner; el back también lo exige).
//
// Paso 1 del port: pestaña Compras. Ventas y Resultados se suman en los próximos pasos.
// La sucursal sale del selector global de sucursales (BranchContext), como en el resto de la app.

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Paper, Typography, Tabs, Tab, ToggleButton, ToggleButtonGroup, Select, MenuItem,
  Chip, Stack, Tooltip, Button,
} from '@mui/material';
import { useBusiness } from '@/context/BusinessContext';
import { useBranch } from '@/hooks/useBranch';
import { GestionAPI, sucursalParam } from '@/servicios/apiGestion';
import PivotCompras from '@/componentes/gestion/PivotCompras';
import { MESES, MESES_IDX } from '@/gestion/formato';

const ANIO_ACTUAL = new Date().getFullYear();
// El kit trae el año actual y el anterior; el historial viejo llega con la migración desde gestion.
const ANIOS = [ANIO_ACTUAL, ANIO_ACTUAL - 1, ANIO_ACTUAL - 2];

// Preferencias de vista por negocio (en gestion: zustand persistido). Solo comodidad del
// usuario: si localStorage no está disponible, se usan los valores por defecto.
const claveEstado = (bizId) => `gestion:panel:${bizId || 'default'}`;
const ESTADO_INICIAL = { year: ANIO_ACTUAL, meses: [], agrupacion: 'concepto', modo: 'economica', sort: { col: 'total', dir: 'desc' } };

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

export default function GestionPanel() {
  const { activeBusinessId, active } = useBusiness() || {};
  const { activeBranchFilter, activeBranch } = useBranch() || {};
  const [estado, setEstado] = useState(() => leerEstado(activeBusinessId));
  const [tab, setTab] = useState('compras');

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

  const params = useMemo(() => ({
    year: estado.year,
    sucursal,
    months: estado.meses,
    agrupacion: estado.agrupacion,
    modo: estado.modo === 'financiera' ? 'financiera' : undefined,
  }), [estado.year, sucursal, estado.meses, estado.agrupacion, estado.modo]);

  const pivot = useQuery({
    enabled: !!activeBusinessId && tab === 'compras',
    queryKey: ['gestionPivot', activeBusinessId, params],
    queryFn: () => GestionAPI.pivot(params),
    staleTime: 60 * 1000,
  });

  const nombreSucursal = activeBranchFilter?.mode === 'all' || !activeBranchFilter
    ? 'Todas las sucursales'
    : activeBranch?.name || 'Principal';

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, height: { md: 'calc(100vh - 64px)' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Panel de Gestión</Typography>
          <Typography variant="body2" color="text.secondary">
            {active?.name || 'Negocio'} · {nombreSucursal}
          </Typography>
        </Box>
        <Tooltip title="Económica: cada gasto en el mes de la factura (o del período, en sueldos). Financiera: en el mes en que se pagó.">
          <ToggleButtonGroup size="small" exclusive value={estado.modo} onChange={(_, v) => v && cambiar({ modo: v })}>
            <ToggleButton value="economica">Económica</ToggleButton>
            <ToggleButton value="financiera">Financiera</ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
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

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="compras" label="Compras" />
            <Tab value="ventas" label="Ventas" disabled />
            <Tab value="resultados" label="Resultados" disabled />
          </Tabs>
          {tab === 'compras' && (
            <ToggleButtonGroup size="small" exclusive value={estado.agrupacion} onChange={(_, v) => v && cambiar({ agrupacion: v })} sx={{ my: 1 }}>
              <ToggleButton value="concepto">Concepto</ToggleButton>
              <ToggleButton value="proveedor">Proveedor</ToggleButton>
              <ToggleButton value="insumo">Insumo</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
        {tab === 'compras' && (
          <PivotCompras
            data={pivot.data}
            isLoading={pivot.isLoading}
            error={pivot.error}
            months={columnas}
            agrupacion={estado.agrupacion}
            sort={estado.sort}
            onSort={ordenar}
          />
        )}
      </Paper>
    </Box>
  );
}
