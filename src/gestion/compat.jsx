/* eslint-disable react-refresh/only-export-components */
// src/gestion/compat.jsx
// Lo que las pantallas traídas de lazarillo_gestion (src/componentes/gestion/pagos) esperan encontrar:
// utilidades y componentes de shadcn con las mismas firmas, sobre los datos de Lazarillo. Así esas
// pantallas quedan casi iguales a las originales.

import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { getSession } from '@/servicios/apiBase';
import { gestionFetch } from '@/servicios/apiGestion';
import { usePanelGestion } from '@/gestion/panelContext';
import { useMaestrosFactura } from '@/gestion/hooksPanel';
import ModalCargaFactura from '@/componentes/gestion/ModalCargaFactura';
import '@/gestion/gestion-tw.css';

export function cn(...clases) {
  return twMerge(clases.flat(Infinity).filter(Boolean).join(' '));
}

// Contenedor que activa los estilos de estas pantallas (ver scripts/gestion-tw.cjs).
export function ScopeGestion({ children }) {
  return <div className="gestion-tw" style={{ display: 'contents' }}>{children}</div>;
}

// useFetchQuery de gestion. El negocio va al final de la clave para que los invalidate/setQueriesData
// por prefijo de esas pantallas sigan valiendo.
export function useFetchQuery(queryKey, url, opts) {
  const { activeBusinessId } = getSession();
  return useQuery({
    queryKey: [...queryKey, activeBusinessId],
    queryFn: async () => {
      const res = await gestionFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: opts?.enabled !== false && url !== null,
    staleTime: opts?.staleTime ?? 30_000,
    retry: 1,
  });
}

// El "PDV" de gestion es un lugar: la principal (-negocio) o una sucursal (su id).
export function lugarDe(businessId, sucursal) {
  if (sucursal === undefined || sucursal === null || !businessId) return null;
  return sucursal === 'principal' ? -Number(businessId) : Number(sucursal);
}

export function useDashboard() {
  const { businessId, sucursalCaja } = usePanelGestion();
  return { localId: businessId ?? null, pdvId: lugarDe(businessId, sucursalCaja) };
}

// Los maestros de la carga con la forma que espera Sin carga. Sin reglas de apertura hasta ese bloque.
const sinRegla = () => null;
export function useCargaFactura(enabled) {
  const { data: maestros } = useMaestrosFactura(enabled);
  return { maestros: maestros ?? null, pdvsRef: maestros?.lugares ?? [], reglaDe: sinRegla };
}

// El modal de carga tiene sus propios estilos: se dibuja fuera de `.gestion-tw`.
export function ModalNuevaCarga(props) {
  return createPortal(<ModalCargaFactura {...props} />, document.body);
}

// El lugar de una fila del Detalle ("negocio:sucursal") con la numeración de estas pantallas.
export function lugarDeCompra(pdvCompraId) {
  const [negocio, sucursal] = String(pdvCompraId ?? '').split(':');
  if (!negocio || !sucursal) return null;
  return sucursal === 'p' ? -Number(negocio) : Number(sucursal);
}

// ── shadcn ──
export function Spinner({ size = 'md', className }) {
  const tam = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' };
  return <Loader2 className={cn('animate-spin text-muted-foreground', tam[size], className)} />;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={cn('h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pl-8 text-sm outline-none focus-visible:border-ring', value ? 'pr-8' : 'pr-2.5')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda" className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const DialogCtx = createContext(null);

export function Dialog({ open, onOpenChange, children }) {
  return <DialogCtx.Provider value={{ open: !!open, onOpenChange }}>{children}</DialogCtx.Provider>;
}

export function DialogContent({ className, children, showCloseButton = true }) {
  const { open, onOpenChange } = useContext(DialogCtx);
  return (
    <Modal open={open} onClose={() => onOpenChange?.(false)} disableEnforceFocus>
      <div className="gestion-tw" tabIndex={-1} style={{ outline: 'none' }}>
        <div className={cn(
          'fixed top-1/2 z-[1350] grid gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none inset-x-5 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2 sm:max-w-sm',
          className,
        )}>
          {children}
          {showCloseButton && (
            <button type="button" onClick={() => onOpenChange?.(false)} aria-label="Cerrar" className="absolute top-2.5 right-2.5 inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function DialogTitle({ className, children }) {
  return <h2 className={cn('text-base leading-none font-medium', className)}>{children}</h2>;
}

// ── ARCA llega en otro bloque: Sin carga funciona sin esa fuente ──
export const ARCA_KEY = ['arca'];
export const useCruceArca = () => ({ data: null, isLoading: false, isError: false, refetch: () => {} });
export const useAjusteAutomatico = () => {};
export const ctxArca = () => ({ ctx: {}, aviso: null });
export const ListaArca = () => null;
export const ListaCorregir = () => null;
export const SubirArca = () => null;
