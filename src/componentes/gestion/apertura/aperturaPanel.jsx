/* eslint-disable react-refresh/only-export-components */
// src/componentes/gestion/apertura/aperturaPanel.jsx
// Une el Panel con las pantallas de apertura: qué reglas ve cada fila y el botón de cada nivel.

import React, { useMemo, useState } from 'react';
import { ScopeGestion, useDashboard } from '@/gestion/compat';
import { candidatosEntidadIdProveedor } from '@/gestion/apertura/proveedor-entidad-id';
import { useReglasApertura } from './use-reglas-apertura';
import { useReglasActivasPorNivel } from './use-reglas-activas-por-nivel';
import { AperturaSplitButton } from './apertura-split-button';
import { AperturaGastosModal } from './apertura-gastos-modal';

// El lugar de origen de una fila: el back manda negocio y sucursal (sin sucursal = la principal).
export const lugarOrigen = (negocio, sucursal) => (sucursal != null ? Number(sucursal) : negocio != null ? -Number(negocio) : null);

export function useAperturaPanel() {
  const { localId, pdvId } = useDashboard();
  const { reglas } = useReglasApertura();
  const porNivel = useReglasActivasPorNivel(reglas, localId ?? undefined, pdvId ?? undefined);
  const [apertura, setApertura] = useState(null);
  return useMemo(() => {
    const abrir = (nivel, entidadId, entidadNombre, origen) => setApertura({
      nivel, entidadId, entidadNombre,
      origenLocalId: origen?.localId ?? localId ?? null,
      origenPdvId: origen?.pdvId ?? pdvId ?? null,
      lote: origen?.lote ?? null,
    });
    return { puede: localId != null && pdvId != null, porNivel, reglas, apertura, cerrar: () => setApertura(null), abrir };
  }, [localId, pdvId, porNivel, reglas, apertura]);
}

// Botón de un concepto o de un proveedor (nivel de bloque, siempre visible).
export function BotonApertura({ panel, nivel, entidadId, nombre }) {
  const ids = nivel === 'proveedor' ? candidatosEntidadIdProveedor(entidadId) : [entidadId];
  const activas = panel.porNivel[nivel];
  const vencidas = panel.porNivel.vencidas?.[nivel];
  return (
    <ScopeGestion>
      <AperturaSplitButton
        variant="block"
        puedeAperturar={panel.puede}
        tieneReglaActiva={ids.some((c) => activas?.has(c))}
        reglaVencida={ids.some((c) => vencidas?.has(c))}
        onClick={() => panel.abrir(nivel, entidadId, nombre)}
      />
    </ScopeGestion>
  );
}

// Botón de un registro: aparece al pasar por la fila (la fila lleva la clase `group`).
export function BotonAperturaRegistro({ panel, rowId, nombre, negocio, sucursal, onClick }) {
  return (
    <ScopeGestion>
      <AperturaSplitButton
        puedeAperturar={panel.puede}
        tieneReglaActiva={!!panel.porNivel.registro?.has(rowId)}
        onClick={onClick ?? (() => panel.abrir('registro', rowId, nombre, { localId: negocio, pdvId: lugarOrigen(negocio, sucursal) }))}
      />
    </ScopeGestion>
  );
}

export function ModalAperturaPanel({ panel }) {
  const a = panel.apertura;
  return (
    <ScopeGestion>
      <AperturaGastosModal
        nivel={a?.nivel ?? 'concepto'}
        entidadId={a?.entidadId ?? null}
        entidadNombre={a?.entidadNombre ?? ''}
        origenLocalId={a?.origenLocalId ?? null}
        origenPdvId={a?.origenPdvId ?? null}
        lote={a?.lote ?? null}
        onClose={panel.cerrar}
      />
    </ScopeGestion>
  );
}
