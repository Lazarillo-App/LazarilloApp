// src/paginas/GestionMovil.jsx
// Lazarillo en el celular (lazarillo_gestion/app/m): fuera de la barra de la app. Solo owner/admin.
import React from 'react';
import { Toaster } from 'sonner';
import { useBusiness } from '@/context/BusinessContext';
import { PanelGestionContext } from '@/gestion/panelContext';
import { ScopeGestion } from '@/gestion/compat';
import { AppMovil } from '@/componentes/gestion/movil/app-movil';

export default function GestionMovil() {
  const { activeBusinessId } = useBusiness() || {};
  return (
    <PanelGestionContext.Provider value={{ businessId: activeBusinessId }}>
      <Toaster position="top-center" />
      <ScopeGestion><AppMovil /></ScopeGestion>
    </PanelGestionContext.Provider>
  );
}
