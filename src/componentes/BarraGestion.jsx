// src/componentes/BarraGestion.jsx
// Barra única de Menú e Insumos. Vive en GestionLayout y NO se desmonta al
// pasar de una página a la otra (pedido de Diego, 02/11): período, sucursal,
// buscador, food cost y "+ Agregar ▾" siguen montados ("Ventas / Compras ▾"
// pasó a ⚙ Configuración, Diego 06/11/2026);
// solo cambia lo que corresponde a cada página (el período — separado: Menú
// usa el de ventas, Insumos el de compras — y el buscador).
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Divider, Menu, MenuItem } from '@mui/material';

import SalesPickerIcon from './SalesPickerIcon';
import Buscador from './Buscador.jsx';
import KpiFoodCost from './KpiFoodCost';
import { useBarraGestion, useDatosBarra } from '@/context/BarraGestionContext';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { useBranch } from '@/hooks/useBranch';
import { useFirstDate } from '@/hooks/useFirstDate';
import { useFoodCostKpi } from '@/hooks/useFoodCostKpi';

const branchDe = (f) => (f?.mode === 'branch' ? f.branchId : f?.mode === 'main' ? 'main' : null);

export default function BarraGestion() {
  const ctx = useBarraGestion();
  const location = useLocation();
  const pagina = location.pathname.startsWith('/insumos') ? 'insumos' : 'menu';

  const { activeBusinessId } = useBusiness() || {};
  const bizId = Number(activeBusinessId) || 0;
  const { isStaff } = useAccess() || {};
  const { activeBranchFilter } = useBranch() || {};
  const branchFirst = branchDe(activeBranchFilter);

  const {
    rangoVentas, setRangoVentas, rangoCompras, setRangoCompras,
    handlersRef, setSlotEl,
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
        buttonSx={{
          borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', borderColor: '#2492C8', color: '#2492C8',
          minWidth: 160, '&:hover': { borderColor: '#2492C8', bgcolor: 'rgba(36,146,200,0.06)' },
        }}
      />

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

      {/* "Ventas / Compras ▾" (importar/exportar CSV) pasó a ⚙ Configuración (Diego, 06/11/2026). */}

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
