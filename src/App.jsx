// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import Navbar from './componentes/Navbar';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import Insumos from './componentes/Insumos';

import { obtenerToken, obtenerArticulos } from './servicios/apiMaxiRest';
import { obtenerAgrupaciones as apiObtenerAgrupaciones } from './servicios/apiAgrupaciones';

import { SearchProvider } from './servicios/searchContext';

// 🔹 nuevo contenedor con el calendario arriba y paso de fechas a la tabla
import ArticulosMain from './paginas/ArticulosMain';

// (Opcional) si querés tener a mano funciones en consola:
import { obtenerVentas } from './servicios/apiVentas';
window.apiVentas = { obtenerVentas };

const App = () => {
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]);

  // Sugerencias para el autocompletado (basadas en artículos visibles)
  const sugerencias = (Array.isArray(categorias) ? categorias : [])
    .flatMap(cat => (cat?.subrubros || []).flatMap(sub => sub?.articulos || []))
    .map(art => art?.nombre)
    .filter(Boolean);

  const recargarAgrupaciones = async () => {
    try {
      const data = await apiObtenerAgrupaciones();
      setAgrupaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar agrupaciones:', e);
      setAgrupaciones([]); // defensivo
    }
  };

  const cargarCategorias = async () => {
    try {
      const token = await obtenerToken();
      const data = await obtenerArticulos(token, '2025-01-01', '2025-04-01');
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar artículos:', e);
      setCategorias([]); // defensivo
    }
  };

  useEffect(() => {
    recargarAgrupaciones();
    cargarCategorias();
  }, []);

  return (
    <SearchProvider>
      {/* Navbar usa el buscador global internamente */}
      <Navbar
        setAgrupacionSeleccionada={setAgrupacionSeleccionada}
        sugerencias={sugerencias}
      />

      <Routes>
        {/* 🟩 Página principal: calendario arriba + tabla dentro */}
        <Route
          path="/"
          element={
            <ArticulosMain
              agrupacionSeleccionada={agrupacionSeleccionada}
              setAgrupacionSeleccionada={setAgrupacionSeleccionada}
              agrupaciones={agrupaciones}
              categoriaSeleccionada={categoriaSeleccionada}
              setCategoriaSeleccionada={setCategoriaSeleccionada}
            />
          }
        />

        <Route
          path="/agrupaciones"
          element={<Agrupaciones actualizarAgrupaciones={recargarAgrupaciones} />}
        />
        <Route
          path="/agrupacioneslist"
          element={<AgrupacionesList agrupaciones={agrupaciones} />}
        />
        <Route path="/insumos" element={<Insumos />} />
      </Routes>
    </SearchProvider>
  );
};

export default App;