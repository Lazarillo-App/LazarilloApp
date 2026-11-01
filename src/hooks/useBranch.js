// src/hooks/useBranch.js
// Hook separado del Provider para satisfacer Fast Refresh de Vite.
// Importar SIEMPRE desde acá, no desde BranchContext.
import { useContext } from 'react';
import { BranchCtx } from '@/context/BranchContext';

export const useBranch = () => useContext(BranchCtx);