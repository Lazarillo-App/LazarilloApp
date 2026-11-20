// src/componentes/BarraGestion.jsx
// Barra única de Menú e Insumos. Vive en GestionLayout y NO se desmonta al
// pasar de una página a la otra (pedido de Diego, 02/11): período, sucursal,
// buscador, food cost y "+ Agregar ▾" siguen montados ("Ventas / Compras ▾"
// pasó a ⚙ Configuración, Diego 06/11/2026);
// solo cambia lo que corresponde a cada página (el período — separado: Menú
// usa el de ventas, Insumos el de compras — y el buscador).
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Divider, IconButton, Menu, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import useCelular from '@/componentes/base/useCelular';

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

  // Celular (Diego 20/11/2026): el food cost arriba y grande (es lo único que no se puede ir);
  // abajo período, lupa y «+». El buscador se abre con la lupa.
  const celular = useCelular();
  const [buscando, setBuscando] = useState(false);

  const periodo = (
      <span data-tour="barra-periodo" style={{ display: 'inline-flex', ...(celular ? { flex: 1, minWidth: 0 } : null) }}>
      <SalesPickerIcon
        value={rango}
        onChange={setRango}
        firstDate={fd.firstDate}
        loadingFirst={fd.loadingFirst}
        labelOverride={esMenu && activeBranchFilter?.mode === 'all' ? '' : null}
        buttonSx={{
          borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', borderColor: '#2492C8', color: '#2492C8',
          minWidth: celular ? 0 : 160, ...(celular ? { width: '100%', height: 44 } : null),
          '&:hover': { borderColor: '#2492C8', bgcolor: 'rgba(36,146,200,0.06)' },
        }}
      />
      </span>
  );
  const buscador = (
      <div data-tour="barra-buscador" style={celular ? { width: '100%' } : { minWidth: 260, maxWidth: 360, flex: '0 1 360px' }}>
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
  );
  const foodCost = !isStaff && (
        <span data-tour="barra-foodcost" style={{ display: 'inline-flex', ...(celular ? { width: '100%' } : null) }}>
        <KpiFoodCost
          ventas={fc.ventas}
          compras={fc.compras}
          kpis={fcVentas.kpis}
          onChange={fcVentas.onChange}
          periodoLabel={fc.periodoLabel}
          porMes={fc.porMes}
        />
        </span>
  );
  const menuAgregar = (
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
  );

  if (celular) {
    return (
      <div className="lz-barra lz-barra-cel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, width: '100%' }}>
        <style>{CSS_CEL}</style>
        {foodCost}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
          {periodo}
          <IconButton aria-label="Buscar" onClick={() => setBuscando((b) => !b)}
            sx={{ width: 44, height: 44, border: '1px solid', borderColor: buscando ? '#2492C8' : '#cfd8dc', borderRadius: '12px', color: buscando ? '#2492C8' : 'inherit' }}>
            <SearchIcon fontSize="small" />
          </IconButton>
          <Button variant="contained" data-tour="barra-agregar" aria-label="Agregar" onClick={(e) => setAgAnchor(e.currentTarget)}
            sx={{ minWidth: 44, width: 44, height: 44, borderRadius: '12px', background: '#2492C8', fontSize: 22, fontWeight: 700, p: 0, '&:hover': { background: '#1a7aaa' } }}>
            +
          </Button>
          {menuAgregar}
        </div>
        {buscando && buscador}
      </div>
    );
  }

  return (
    <div className="lz-barra" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {periodo}

      {/* Botones propios de cada página (selección, listas, referencias). */}
      <span ref={setSlotEl} style={{ display: 'contents' }} />

      {buscador}

      {foodCost}

      {/* "Ventas / Compras ▾" (importar/exportar CSV) pasó a ⚙ Configuración (Diego, 06/11/2026). */}

      <div>
        <Button
          variant="contained"
          size="small"
          data-tour="barra-agregar"
          onClick={(e) => setAgAnchor(e.currentTarget)}
          sx={{
            background: '#2492C8', '&:hover': { background: '#1a7aaa' }, borderRadius: '8px',
            fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', px: 2,
          }}
        >
          + Agregar ▾
        </Button>
        {menuAgregar}
      </div>
    </div>
  );
}

// Food cost grande en el celular: el mismo KpiFoodCost, solo más grande y a lo ancho.
const CSS_CEL = `
.lz-barra-cel .kfc{width:100%;}
.lz-barra-cel [data-tour="barra-periodo"] > *{width:100%;}
.lz-barra-cel .kfc-chip{width:100%;box-sizing:border-box;padding:10px 14px;border-radius:14px;background:#fff;min-height:56px;}
.lz-barra-cel .kfc-ti{font-size:10px;}
.lz-barra-cel .kfc-ti b{font-size:11px;}
.lz-barra-cel .kfc-pill{font-size:26px;font-weight:800;margin-left:auto;}
`;
