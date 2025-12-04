// src/componentes/GlobalSearchBar.jsx
import React from 'react';
import Buscador from './Buscador';

export default function GlobalSearchBar({
  value,
  onChange,
  options,
  onPick,
}) {
  return (
    <div className="laz-global-search">
      <div className="laz-global-search-inner">
        {/* Podés cambiar el placeholder cuando sumemos recetas/insumos */}
        <Buscador
          value={value}
          opciones={options}
          placeholder="Buscar artículos, insumos, recetas…"
          onChange={onChange}
          onPick={onPick}
          clearOnFocus={false}
          clearOnPick={false}        // mantené el texto después de seleccionar
          autoFocusAfterPick={false}
        />
      </div>
    </div>
  );
}
