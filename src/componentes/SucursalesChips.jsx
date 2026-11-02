// src/componentes/SucursalesChips.jsx
// Sucursales en el header, debajo de Artículos · Insumos | Menú (pedido de
// Diego, 02/11 — reemplaza al selector de la barra). Una pastilla por
// sucursal + "Todas", un "+" para agregar sin salir de la pantalla y un "?"
// que explica para qué sirven. Con una sola sucursal queda solo el "+".
// Mismo estado que SucursalSelector (useBranch) y mismo modal de alta/edición.
import React, { useState } from 'react';
import { Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

import { useBranch } from '@/hooks/useBranch';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import BranchFormModal from './BranchFormModal';

const CHIP = {
  height: 22, padding: '0 9px', borderRadius: 11, fontSize: 11, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--on-primary) 22%, transparent)',
  background: 'color-mix(in srgb, var(--on-primary) 8%, transparent)',
  color: 'var(--on-primary)', fontFamily: 'inherit', lineHeight: 1,
};
const CHIP_ON = {
  background: 'var(--on-primary)', color: 'var(--color-primary)',
  borderColor: 'var(--on-primary)',
};
const REDONDO = {
  width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', fontWeight: 700, fontSize: 13, lineHeight: 1, cursor: 'pointer',
  color: 'var(--on-primary)', background: 'transparent', fontFamily: 'inherit', padding: 0,
};

const AYUDA = (
  <span style={{ display: 'block', lineHeight: 1.45, padding: 2 }}>
    <b>Sucursales</b><br />
    Elegí una para ver sus ventas y compras, o <b>Todas</b> para verlas juntas.
    Los artículos e insumos son los mismos en todas. Con <b>+</b> agregás una nueva.
  </span>
);

export default function SucursalesChips() {
  const { branches, activeBranchId, setActiveBranch, loadBranches } = useBranch() || {};
  const { activeBusinessId } = useBusiness() || {};
  const { isStaff } = useAccess() || {};
  const [modalOpen, setModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [hover, setHover] = useState(null);

  const lista = branches || [];
  // Siempre se ven (aunque haya una sola): si no, en un negocio con una
  // sola sucursal no aparecía nada (pedido de Diego).
  const varias = lista.length > 1;
  const esTodas = activeBranchId === null || activeBranchId === undefined;

  const abrirAlta = () => { setEditBranch(null); setModalOpen(true); };
  const abrirEdicion = (e, b) => { e.stopPropagation(); setEditBranch(b); setModalOpen(true); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {lista.length > 0 && (
        <>
          {varias && (
            <button type="button" onClick={() => setActiveBranch?.(null)}
              style={{ ...CHIP, ...(esTodas ? CHIP_ON : null) }}>
              Todas
            </button>
          )}
          {lista.map((b) => {
            // Con una sola sucursal, esa es la que se ve siempre (queda marcada).
            const on = varias ? (!esTodas && String(activeBranchId) === String(b.id)) : true;
            const color = b.color || (b.isMain ? 'var(--color-primary)' : '#1976d2');
            return (
              <button key={b.id} type="button"
                onClick={() => setActiveBranch?.(varias ? b.id : null)}
                onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}
                title={b.isMain ? `${b.name} (principal)` : b.name}
                style={{ ...CHIP, ...(on ? CHIP_ON : null) }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, border: '1px solid rgba(0,0,0,.15)' }} />
                {b.name || 'Todas'}
                {!isStaff && hover === b.id && (
                  <EditIcon onClick={(e) => abrirEdicion(e, b)} titleAccess="Editar sucursal"
                    sx={{ fontSize: 12, ml: 0.25, opacity: 0.75, '&:hover': { opacity: 1 } }} />
                )}
              </button>
            );
          })}
        </>
      )}
      {!isStaff && (
        <Tooltip title="Agregar sucursal" arrow>
          <button type="button" onClick={abrirAlta} aria-label="Agregar sucursal"
            style={{ ...REDONDO, border: '1px dashed color-mix(in srgb, var(--on-primary) 45%, transparent)' }}>
            +
          </button>
        </Tooltip>
      )}
      <Tooltip title={AYUDA} arrow>
        <span aria-label="Qué son las sucursales"
          style={{ ...REDONDO, width: 16, height: 16, fontSize: 10, cursor: 'help', opacity: 0.75,
            border: '1px solid color-mix(in srgb, var(--on-primary) 40%, transparent)' }}>
          ?
        </span>
      </Tooltip>

      <BranchFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditBranch(null); }}
        onSaved={() => loadBranches?.(activeBusinessId)}
        bizId={activeBusinessId}
        branch={editBranch}
      />
    </div>
  );
}
