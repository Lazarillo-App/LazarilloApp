import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Navbar.css';
import Buscador from './Buscador';

const Navbar = ({ filtroBusqueda, setFiltroBusqueda, setAgrupacionSeleccionada, sugerencias = [] }) => {

  const handleBuscar = (valor) => {
    setFiltroBusqueda(valor);
    setAgrupacionSeleccionada?.(null);
  };

  return (
    <nav className="navbar">
      <div className="logo">LOGO</div>
      <div className="nav-links">
        <Link to="/" className="nav-link">Inicio</Link>
        <Link to="/agrupaciones" className="nav-link">Agrupaciones</Link>
      </div>
      <div className="navbar-actions">
        <Buscador
          value={filtroBusqueda} 
          setFiltroBusqueda={handleBuscar}
          opciones={sugerencias}
        />
      </div>
    </nav>
  );
};

export default Navbar;