import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './componentes/Navbar';
import TablaArticulos from './componentes/TablaArticulos';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';
import { obtenerToken, obtenerArticulos } from './servicios/apiMaxiRest';

const App = () => {
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [categorias, setCategorias] = useState([]); 

  const sugerencias = categorias
  .flatMap(cat => cat.subrubros.flatMap(sub => sub.articulos))
  .map(art => art.nombre);

  const recargarAgrupaciones = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones`);
      const data = await response.json();
      setAgrupaciones(data);
    } catch (error) {
      console.error('Error al cargar agrupaciones:', error);
    }
  };

  const cargarCategorias = async () => {
    try {
      const token = await obtenerToken();
      const data = await obtenerArticulos(token, '2025-01-01', '2025-04-01');
      setCategorias(data);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
    }
  };

  useEffect(() => {
    recargarAgrupaciones();
    cargarCategorias();
  }, []);

  return (
    <>
      <Navbar
        filtroBusqueda={filtroBusqueda}
        setFiltroBusqueda={setFiltroBusqueda}
        setAgrupacionSeleccionada={setAgrupacionSeleccionada}
        sugerencias={sugerencias}
      />
      <Routes>
        <Route
          path="/"
          element={
            <TablaArticulos
              filtroBusqueda={filtroBusqueda}
              setFiltroBusqueda={setFiltroBusqueda}
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
      </Routes>
    </>
  );
};

export default App;