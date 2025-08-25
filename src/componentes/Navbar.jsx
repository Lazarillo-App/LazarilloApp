// src/componentes/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
        <Link to="/" className="logo">LOGO</Link>

      <div className="nav-links">
        <Link to="/" className="nav-link">Inicio</Link>
        <Link to="/agrupaciones" className="nav-link">Agrupaciones</Link>
        <Link to="/insumos" className="nav-link">Insumos</Link>
      </div>
    </nav>
  );
};

export default Navbar;