import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './componentes/Navbar';
import TablaArticulos from './componentes/TablaArticulos';
import Agrupaciones from './componentes/Agrupaciones';
import AgrupacionesList from './componentes/AgrupacionesList';

const App = () => {
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [agrupacionSeleccionada, setAgrupacionSeleccionada] = useState(null);
  const [agrupaciones, setAgrupaciones] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);

  const recargarAgrupaciones = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/agrupaciones`);
      const data = await response.json();
      setAgrupaciones(data);
    } catch (error) {
      console.error('Error al cargar agrupaciones:', error);
    }
  };

  useEffect(() => {
    recargarAgrupaciones();
  }, [])

 return (
    <>
      <Navbar
        setFiltroBusqueda={setFiltroBusqueda}
        setAgrupacionSeleccionada={setAgrupacionSeleccionada}
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
          element={
            <Agrupaciones actualizarAgrupaciones={recargarAgrupaciones} />
          }
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