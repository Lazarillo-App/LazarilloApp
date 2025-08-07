import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../css/Navbar.css';
import Buscador from './Buscador';

const Navbar = ({ setFiltroBusqueda, setAgrupacionSeleccionada }) => {
  const [busqueda, setBusqueda] = useState('');

  const handleBuscar = (valor) => {
    setBusqueda(valor);
    if (setFiltroBusqueda) setFiltroBusqueda(valor);
    if (setAgrupacionSeleccionada) setAgrupacionSeleccionada(null); // Limpiar agrupación al buscar
  };

  return (
    <nav className="navbar">
      <div className="logo">LOGO</div>
      <div className="nav-links">
        <Link to="/" className="nav-link">Inicio</Link>
        <Link to="/agrupaciones" className="nav-link">Agrupaciones</Link>
      </div>
      <div className="navbar-actions">
        <Buscador value={busqueda} setFiltroBusqueda={handleBuscar} />
      </div>
    </nav>
  );
};

export default Navbar;