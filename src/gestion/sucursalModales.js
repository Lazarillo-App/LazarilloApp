// Sucursal elegida en los modales de compras del insumo y de cuenta corriente del proveedor
// (Diego 10/11/2026): por defecto la sucursal que se está mirando en la app, con «Todas» como
// opción, y si se cambia en un modal cambia también en el otro.
//
// Valor: 'all' (todas) | 'main' (la principal: compras sin sucursal) | '<id de app_branches>'.
// Vive en memoria mientras la página está abierta; al cambiar la sucursal activa de la app
// vuelve a seguirla.
import { useEffect, useState } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { MAIN_BRANCH_ID } from '@/context/BranchContext';

const EVENTO = 'lz:sucursal-modales';
let elegida = null; // { base, valor }: base = sucursal activa cuando se eligió

const desdeActiva = (activeBranchId) =>
  activeBranchId == null ? 'all' : activeBranchId === MAIN_BRANCH_ID ? 'main' : String(activeBranchId);

export function useSucursalModales() {
  const { activeBranchId } = useBranch() || {};
  const base = desdeActiva(activeBranchId);
  const leer = () => (elegida && elegida.base === base ? elegida.valor : base);
  const [valor, setValorLocal] = useState(leer);

  useEffect(() => {
    setValorLocal(leer());
    const onCambio = () => setValorLocal(leer());
    window.addEventListener(EVENTO, onCambio);
    return () => window.removeEventListener(EVENTO, onCambio);
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValor = (v) => {
    elegida = { base, valor: String(v) };
    setValorLocal(String(v));
    try { window.dispatchEvent(new CustomEvent(EVENTO)); } catch { /* sin window */ }
  };
  return [valor, setValor];
}
