/* eslint-disable react-refresh/only-export-components */
// src/gestion/compat.jsx
// Lo que las pantallas traídas de lazarillo_gestion (src/componentes/gestion/pagos) esperan encontrar:
// utilidades y componentes de shadcn con las mismas firmas, sobre los datos de Lazarillo. Así esas
// pantallas quedan casi iguales a las originales.

import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Popover as MuiPopover } from '@mui/material';
import { Loader2, Search, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { usePanelGestion } from '@/gestion/panelContext';
import { useMaestrosFactura } from '@/gestion/hooksPanel';
import { useReglasCarga } from '@/componentes/gestion/apertura/useReglasCarga';
import ModalCargaFactura from '@/componentes/gestion/ModalCargaFactura';
import '@/gestion/gestion-tw.css';

export { fmtARS } from '@/gestion/formato';

export function cn(...clases) {
  return twMerge(clases.flat(Infinity).filter(Boolean).join(' '));
}

// Contenedor que activa los estilos de estas pantallas (ver scripts/gestion-tw.cjs).
export function ScopeGestion({ children }) {
  return <div className="gestion-tw" style={{ display: 'contents' }}>{children}</div>;
}

// useFetchQuery de gestion. El negocio va al final de la clave para que los invalidate/setQueriesData
// por prefijo de esas pantallas sigan valiendo.
export { useFetchQuery } from '@/gestion/hooksPanel';

// El "PDV" de gestion es un lugar: la principal (-negocio) o una sucursal (su id).
export function lugarDe(businessId, sucursal) {
  if (sucursal === undefined || sucursal === null || !businessId) return null;
  return sucursal === 'principal' ? -Number(businessId) : Number(sucursal);
}

export function useDashboard() {
  const { businessId, sucursalCaja } = usePanelGestion();
  return { localId: businessId ?? null, pdvId: lugarDe(businessId, sucursalCaja) };
}

// Los maestros de la carga con la forma que espera Sin carga, y sus reglas de apertura.
export function useCargaFactura(enabled, pdvId) {
  const { data: maestros } = useMaestrosFactura(enabled);
  const pdvsRef = maestros?.lugares ?? [];
  return { maestros: maestros ?? null, pdvsRef, ...useReglasCarga(pdvId, pdvsRef) };
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

export const DialogHeader = ({ className, children }) => <div className={cn('flex flex-col gap-2', className)}>{children}</div>;

export function DialogTitle({ className, children }) {
  return <h2 className={cn('text-base leading-none font-medium', className)}>{children}</h2>;
}

// Select de shadcn sobre un <select> nativo: toma el placeholder y las clases del trigger.
export const SelectTrigger = () => null;
export const SelectValue = () => null;
export const SelectContent = ({ children }) => children;
export function SelectItem({ value, disabled, children }) {
  return <option value={value} disabled={disabled}>{children}</option>;
}
export function Select({ value, onValueChange, disabled, children }) {
  const hijos = React.Children.toArray(children);
  const trigger = hijos.find((h) => h.type === SelectTrigger);
  const contenido = hijos.find((h) => h.type === SelectContent);
  const placeholder = React.Children.toArray(trigger?.props.children).find((h) => h.type === SelectValue)?.props.placeholder;
  return (
    <select
      value={value ?? ''} disabled={disabled} onChange={(e) => onValueChange?.(e.target.value)}
      className={cn('h-7 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring disabled:opacity-50', trigger?.props.className)}
    >
      <option value="" hidden>{placeholder ?? ''}</option>
      {contenido?.props.children}
    </select>
  );
}

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring disabled:opacity-50', className)} {...props} />;
});

export function Switch({ checked, onCheckedChange, disabled, className, id }) {
  return (
    <button
      type="button" role="switch" id={id} aria-checked={!!checked} disabled={disabled} onClick={() => onCheckedChange?.(!checked)}
      className={cn('inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary' : 'bg-input', className)}
    >
      <span className={cn('block size-3.5 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
export const Separator = ({ className }) => <div className={cn('h-px w-full shrink-0 bg-border', className)} />;

export function Badge({ variant = 'default', className, children }) {
  const estilos = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive/10 text-destructive',
    outline: 'border-border text-foreground',
  };
  return <span className={cn('inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap', estilos[variant], className)}>{children}</span>;
}

const PopoverCtx = createContext(null);
export function Popover({ open, onOpenChange, children }) {
  const [ancla, setAncla] = React.useState(null);
  return <PopoverCtx.Provider value={{ open: !!open, onOpenChange, ancla, setAncla }}>{children}</PopoverCtx.Provider>;
}
export function PopoverTrigger({ children }) {
  const { open, onOpenChange, setAncla } = useContext(PopoverCtx);
  return React.cloneElement(children, {
    onClick: (e) => { e.stopPropagation(); setAncla(e.currentTarget); children.props.onClick?.(e); onOpenChange?.(!open); },
  });
}
export function PopoverContent({ className, align = 'center', children }) {
  const { open, onOpenChange, ancla } = useContext(PopoverCtx);
  const horizontal = align === 'end' ? 'right' : align === 'start' ? 'left' : 'center';
  return (
    <MuiPopover open={open && !!ancla} anchorEl={ancla} onClose={() => onOpenChange?.(false)} disableEnforceFocus
      anchorOrigin={{ vertical: 'bottom', horizontal }} transformOrigin={{ vertical: 'top', horizontal }}>
      <div className="gestion-tw"><div className={cn('w-72 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground', className)}>{children}</div></div>
    </MuiPopover>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive, confirming, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{title}</DialogTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={confirming} onClick={() => onOpenChange(false)} className="h-8 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">{cancelLabel}</button>
          <button type="button" disabled={confirming} onClick={onConfirm} className={cn('h-8 rounded-lg px-3 text-sm font-medium disabled:opacity-50', destructive ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground')}>{confirmLabel}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ARCA llega en otro bloque: Sin carga funciona sin esa fuente ──
export const ARCA_KEY = ['arca'];
export const useCruceArca = () => ({ data: null, isLoading: false, isError: false, refetch: () => {} });
export const useAjusteAutomatico = () => {};
export const ctxArca = () => ({ ctx: {}, aviso: null });
export const ListaArca = () => null;
export const ListaCorregir = () => null;
export const SubirArca = () => null;
