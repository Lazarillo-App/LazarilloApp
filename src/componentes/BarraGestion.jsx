// src/componentes/BarraGestion.jsx
// Barra única de Menú e Insumos. Vive en GestionLayout y NO se desmonta al
// pasar de una página a la otra (pedido de Diego, 02/11): período, sucursal,
// buscador, food cost, "Ventas / Compras ▾" y "+ Agregar ▾" siguen montados;
// solo cambia lo que corresponde a cada página (el período — separado: Menú
// usa el de ventas, Insumos el de compras — y el buscador).
import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import SalesPickerIcon from './SalesPickerIcon';
import SucursalSelector from './SucursalSelector';
import Buscador from './Buscador.jsx';
import KpiFoodCost from './KpiFoodCost';
import { useBarraGestion, useDatosBarra } from '@/context/BarraGestionContext';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { useBranch } from '@/hooks/useBranch';
import { useFirstDate } from '@/hooks/useFirstDate';
import { useFoodCostKpi } from '@/hooks/useFoodCostKpi';
import { downloadVentasCSV } from '@/servicios/apiVentas';
import { purchasesDownloadCsv } from '@/servicios/apiPurchases';
import { showAlert } from '@/servicios/appAlert';

const fmtRango = (r) => {
  if (!r?.from || !r?.to) return 'sin período';
  try {
    const f = (iso) => format(new Date(`${String(iso).slice(0, 10)}T00:00:00`), 'dd/MM/yy', { locale: es });
    return `${f(r.from)} — ${f(r.to)}`;
  } catch { return 'período elegido'; }
};

const branchDe = (f) => (f?.mode === 'branch' ? f.branchId : f?.mode === 'main' ? 'main' : null);

const SX_ITEM = { py: 1, px: 2 };
const SX_TIT = {
  px: 2, pt: 1, pb: 0.5, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '.07em',
  color: 'text.secondary', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.75,
};

export default function BarraGestion() {
  const ctx = useBarraGestion();
  const location = useLocation();
  const navigate = useNavigate();
  const pagina = location.pathname.startsWith('/insumos') ? 'insumos' : 'menu';

  const { activeBusinessId } = useBusiness() || {};
  const bizId = Number(activeBusinessId) || 0;
  const { isStaff } = useAccess() || {};
  const { activeBranchFilter } = useBranch() || {};
  const branchFirst = branchDe(activeBranchFilter);

  const {
    rangoVentas, setRangoVentas, rangoCompras, setRangoCompras,
    handlersRef, alertaVentas, setSlotEl, setAccionPendiente,
  } = ctx;
  const datosPagina = useDatosBarra();

  // Las dos primeras fechas quedan montadas siempre → al cambiar de página
  // el calendario no vuelve a "cargar".
  const fdVentas = useFirstDate(bizId || null, 'sales', branchFirst);
  const fdCompras = useFirstDate(bizId || null, 'purchases', branchFirst);

  // Food cost de los dos períodos, siempre montado (los dos quedan en caché y
  // el KPI no parpadea al cambiar de página). Los KPI configurados son los
  // mismos: se usa una sola instancia para editarlos.
  const fcVentas = useFoodCostKpi({
    bizId: isStaff ? 0 : bizId, from: rangoVentas?.from, to: rangoVentas?.to, activeBranchFilter,
  });
  const fcCompras = useFoodCostKpi({
    bizId: isStaff ? 0 : bizId, from: rangoCompras?.from, to: rangoCompras?.to, activeBranchFilter,
  });
  const fc = pagina === 'insumos' ? fcCompras : fcVentas;

  const esMenu = pagina === 'menu';
  const rango = esMenu ? rangoVentas : rangoCompras;
  const setRango = esMenu ? setRangoVentas : setRangoCompras;
  const fd = esMenu ? fdVentas : fdCompras;

  const datos = datosPagina?.[pagina] || {};
  const h = (nombre) => handlersRef.current?.[pagina]?.[nombre];

  /* ── Ventas / Compras ▾ ── */
  const [vcAnchor, setVcAnchor] = useState(null);
  const cerrarVc = () => setVcAnchor(null);

  const importar = useCallback((tipo) => {
    cerrarVc();
    const duena = tipo === 'ventas' ? 'menu' : 'insumos';
    const fn = handlersRef.current?.[duena]?.importar;
    if (pagina === duena && typeof fn === 'function') { fn(); return; }
    setAccionPendiente(tipo === 'ventas' ? 'importarVentas' : 'importarCompras');
    navigate(duena === 'menu' ? '/menu' : '/insumos');
  }, [handlersRef, pagina, navigate, setAccionPendiente]);

  const exportarVentas = useCallback(async () => {
    cerrarVc();
    const from = rangoVentas?.from?.slice(0, 10);
    const to = rangoVentas?.to?.slice(0, 10);
    if (!bizId || !from || !to) { showAlert('Falta negocio activo o período de ventas.', 'warning'); return; }
    try {
      const blob = await downloadVentasCSV(bizId, { from, to });
      if (!blob || blob.size === 0) { showAlert('El CSV vino vacío.', 'warning'); return; }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventas_${bizId}_${from}_a_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      showAlert(`Error al descargar ventas: ${e?.message || e}`, 'error');
    }
  }, [bizId, rangoVentas]);

  const exportarCompras = useCallback(async () => {
    cerrarVc();
    if (!bizId || !rangoCompras?.from || !rangoCompras?.to) { showAlert('Falta negocio activo o período de compras.', 'warning'); return; }
    try {
      await purchasesDownloadCsv(bizId, { from: rangoCompras.from, to: rangoCompras.to });
    } catch (e) {
      showAlert(`Error al descargar compras: ${e?.message || e}`, 'error');
    }
  }, [bizId, rangoCompras]);

  const hayAlerta = !!alertaVentas?.hayAlerta;
  const textoAlerta = useMemo(() => {
    if (!hayAlerta) return '';
    const d = alertaVentas.diasSinVentas;
    let ultima = '';
    try {
      if (alertaVentas.ultimaVenta) ultima = ` (última: ${format(new Date(alertaVentas.ultimaVenta), 'dd/MM/yyyy', { locale: es })})`;
    } catch { /* fecha inválida */ }
    return `${d != null ? `Hace ${d} día${d === 1 ? '' : 's'} que no se sincronizan ventas` : 'No hay ventas sincronizadas'}${ultima}.`;
  }, [hayAlerta, alertaVentas]);

  /* ── + Agregar ▾ ── */
  const [agAnchor, setAgAnchor] = useState(null);
  const agregar = (tipo) => { setAgAnchor(null); h('agregar')?.(tipo); };

  return (
    <div className="lz-barra" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <SalesPickerIcon
        value={rango}
        onChange={setRango}
        firstDate={fd.firstDate}
        loadingFirst={fd.loadingFirst}
        labelOverride={esMenu && activeBranchFilter?.mode === 'all' ? '' : null}
      />

      <SucursalSelector variant="inline" />

      {/* Botones propios de cada página (selección, listas, referencias). */}
      <span ref={setSlotEl} style={{ display: 'contents' }} />

      <div style={{ minWidth: 260, maxWidth: 360, flex: '0 1 360px' }}>
        <Buscador
          placeholder={datos.placeholder || 'Buscar artículos, insumos…'}
          opciones={datos.opciones || []}
          value={datos.value ?? ''}
          onChange={(v) => h('onBuscar')?.(v || '')}
          clearOnPick={false}
          autoFocusAfterPick
          noResultsText="Sin resultados"
          onPick={(opt) => h('onPick')?.(opt)}
        />
      </div>

      {!isStaff && (
        <KpiFoodCost
          ventas={fc.ventas}
          compras={fc.compras}
          kpis={fcVentas.kpis}
          onChange={fcVentas.onChange}
          periodoLabel={fc.periodoLabel}
          porMes={fc.porMes}
        />
      )}

      {!isStaff && (
        <>
          <Tooltip title={textoAlerta} arrow disableHoverListener={!hayAlerta}>
            <Badge
              badgeContent={hayAlerta ? '!' : null}
              color="warning"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16, fontWeight: 700 } }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setVcAnchor(e.currentTarget)}
                disabled={!bizId}
                sx={{
                  borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap',
                  textTransform: 'none', px: 1.5, borderColor: '#2492C8', color: '#2492C8',
                }}
              >
                Ventas / Compras ▾
              </Button>
            </Badge>
          </Tooltip>
          <Menu
            anchorEl={vcAnchor}
            open={Boolean(vcAnchor)}
            onClose={cerrarVc}
            PaperProps={{ sx: { borderRadius: 2, minWidth: 260, mt: 0.5, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } }}
          >
            <Box sx={SX_TIT}>
              Ventas
              {hayAlerta && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />}
              <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none', marginLeft: 'auto' }}>{fmtRango(rangoVentas)}</span>
            </Box>
            {hayAlerta && (
              <Typography sx={{ px: 2, pb: 0.5, fontSize: '0.72rem', color: '#b45309' }}>{textoAlerta}</Typography>
            )}
            <MenuItem onClick={() => importar('ventas')} sx={SX_ITEM}>
              <ListItemIcon><CloudUploadIcon fontSize="small" sx={{ color: '#2492C8' }} /></ListItemIcon>
              <ListItemText primary="Importar ventas" secondary="Subir archivo CSV/Excel"
                primaryTypographyProps={{ fontSize: '0.86rem' }} secondaryTypographyProps={{ fontSize: '0.72rem' }} />
            </MenuItem>
            <MenuItem onClick={exportarVentas} sx={SX_ITEM}>
              <ListItemIcon><CloudDownloadIcon fontSize="small" sx={{ color: '#10b981' }} /></ListItemIcon>
              <ListItemText primary="Exportar ventas" secondary="Del período de Menú"
                primaryTypographyProps={{ fontSize: '0.86rem' }} secondaryTypographyProps={{ fontSize: '0.72rem' }} />
            </MenuItem>
            <Divider />
            <Box sx={SX_TIT}>
              Compras
              <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none', marginLeft: 'auto' }}>{fmtRango(rangoCompras)}</span>
            </Box>
            <MenuItem onClick={() => importar('compras')} sx={SX_ITEM}>
              <ListItemIcon><CloudUploadIcon fontSize="small" sx={{ color: '#2492C8' }} /></ListItemIcon>
              <ListItemText primary="Importar compras" secondary="Subir archivo CSV/Excel de MaxiRest"
                primaryTypographyProps={{ fontSize: '0.86rem' }} secondaryTypographyProps={{ fontSize: '0.72rem' }} />
            </MenuItem>
            <MenuItem onClick={exportarCompras} sx={SX_ITEM}>
              <ListItemIcon><CloudDownloadIcon fontSize="small" sx={{ color: '#10b981' }} /></ListItemIcon>
              <ListItemText primary="Exportar compras" secondary="Del período de Insumos"
                primaryTypographyProps={{ fontSize: '0.86rem' }} secondaryTypographyProps={{ fontSize: '0.72rem' }} />
            </MenuItem>
          </Menu>
        </>
      )}

      <div>
        <Button
          variant="contained"
          size="small"
          onClick={(e) => setAgAnchor(e.currentTarget)}
          sx={{
            background: '#2492C8', '&:hover': { background: '#1a7aaa' }, borderRadius: '8px',
            fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', px: 2,
          }}
        >
          + Agregar ▾
        </Button>
        <Menu
          anchorEl={agAnchor}
          open={Boolean(agAnchor)}
          onClose={() => setAgAnchor(null)}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 200, mt: 0.5, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } }}
        >
          {!isStaff && (
            <MenuItem onClick={() => agregar('articulo')} sx={{ fontSize: '0.88rem', gap: 1.5, py: 1.2 }}>
              <span style={{ fontSize: 16 }}>📄</span> Un artículo
            </MenuItem>
          )}
          {!isStaff && (
            <MenuItem onClick={() => agregar('loteArticulos')} sx={{ fontSize: '0.88rem', gap: 1.5, py: 1.2 }}>
              <span style={{ fontSize: 16 }}>📦</span> Lote de artículos
            </MenuItem>
          )}
          {!isStaff && <Divider />}
          <MenuItem onClick={() => agregar('insumo')} sx={{ fontSize: '0.88rem', gap: 1.5, py: 1.2 }}>
            <span style={{ fontSize: 16 }}>🧂</span> Un insumo
          </MenuItem>
          {!isStaff && (
            <MenuItem onClick={() => agregar('loteInsumos')} sx={{ fontSize: '0.88rem', gap: 1.5, py: 1.2 }}>
              <span style={{ fontSize: 16 }}>📦</span> Lote de insumos
            </MenuItem>
          )}
        </Menu>
      </div>
    </div>
  );
}
