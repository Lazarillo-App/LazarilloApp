import React, { useState, useEffect } from 'react';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import SidebarCategorias from './SidebarCategorias';
import '../css/TablaArticulos.css';

const TablaArticulos = ({
  filtroBusqueda,
  setFiltroBusqueda,
  agrupacionSeleccionada,
  setAgrupacionSeleccionada,
  agrupaciones,
  categoriaSeleccionada,
  setCategoriaSeleccionada,
}) => {
  const [categorias, setCategorias] = useState([]);
  const [objetivos, setObjetivos] = useState({});
  const [manuales, setManuales] = useState({});
  const [fechaDesde, setFechaDesde] = useState('2025-01-01');
  const [fechaHasta, setFechaHasta] = useState('2025-04-01');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const token = await obtenerToken();
        const articulosData = await obtenerArticulos(token, fechaDesde, fechaHasta);
        const categoriasData = articulosData.map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre,
          subrubros: categoria.subrubros,
        }));
        setCategorias(categoriasData);
      } catch (error) {
        console.error('Error al cargar los datos:', error);
      }
    };

    cargarDatos();
  }, [fechaDesde, fechaHasta]);

  let articulosAMostrar = [];

  if (categoriaSeleccionada && agrupacionSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros
      .flatMap(subrubro => subrubro.articulos)
      .filter(art => agrupacionSeleccionada.articulos.some(a => a.id === art.id));
  } else if (categoriaSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(subrubro => subrubro.articulos);
  } else if (agrupacionSeleccionada) {
    articulosAMostrar = agrupacionSeleccionada.articulos || [];
  } else {
    articulosAMostrar = categorias.flatMap(categoria =>
      categoria.subrubros.flatMap(subrubro => subrubro.articulos)
    );
  }

  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter((articulo) =>
        articulo.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase())
      )
    : articulosAMostrar;

  const calcularCostoPorcentaje = (articulo) => {
    return articulo.precio > 0 ? ((articulo.costo / articulo.precio) * 100).toFixed(2) : 0;
  };

  const calcularSugerido = (articulo) => {
    const objetivo = objetivos[articulo.id] || 0;
    return articulo.costo * (100 / (100 - objetivo));
  };

  const handleObjetivoChange = (id, value) => {
    setObjetivos({ ...objetivos, [id]: value });
  };

  const handleManualChange = (id, value) => {
    setManuales({ ...manuales, [id]: value });
  };

  const agruparPorRubroYSubrubro = (articulos) => {
    const agrupados = {};

    articulos.forEach((articulo) => {
      const categoria = categorias.find(categoria =>
        categoria.subrubros.some(subrubro =>
          subrubro.articulos.some(a => a.id === articulo.id)
        )
      );

      if (categoria) {
        const rubro = categoria.nombre;
        const subrubro = categoria.subrubros.find(subrubro =>
          subrubro.articulos.some(a => a.id === articulo.id)
        )?.nombre || 'Sin subrubro';

        if (!agrupados[rubro]) agrupados[rubro] = {};
        if (!agrupados[rubro][subrubro]) agrupados[rubro][subrubro] = [];

        agrupados[rubro][subrubro].push(articulo);
      }
    });

    return agrupados;
  };

  const articulosAgrupados = agruparPorRubroYSubrubro(articulosFiltrados);

  return (
    <div className="tabla-articulos-container">
      <SidebarCategorias
        categorias={categorias}
        setCategoriaSeleccionada={setCategoriaSeleccionada}
        agrupaciones={agrupaciones}
        agrupacionSeleccionada={agrupacionSeleccionada}
        setAgrupacionSeleccionada={setAgrupacionSeleccionada}
        setFiltroBusqueda={setFiltroBusqueda}
        categoriaSeleccionada={categoriaSeleccionada}
      />
      <div className="tabla-content">
        <h1>Gestión de Artículos</h1>

        <div className="filtros-fechas">
          <label>Desde:</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <label>Hasta:</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>

        {articulosFiltrados.length === 0 ? (
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', color: '#777' }}>
            No hay artículos para mostrar en esta agrupación o categoría seleccionada.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Precio</th>
                <th>Costo ($)</th>
                <th>Costo (%)</th>
                <th>Objetivo (%)</th>
                <th>Sugerido ($)</th>
                <th>Manual ($)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(articulosAgrupados).map((rubro) => (
                <React.Fragment key={rubro}>
                  {Object.keys(articulosAgrupados[rubro]).map((subrubro) => (
                    <React.Fragment key={subrubro}>
                      <tr className="rubro-row">
                        <td colSpan="9"><strong>{rubro} - {subrubro}</strong></td>
                      </tr>
                      {articulosAgrupados[rubro][subrubro].map((articulo) => (
                        <tr key={articulo.id}>
                          <td>{articulo.id}</td>
                          <td>{articulo.nombre}</td>
                          <td>${articulo.precio}</td>
                          <td>${articulo.costo}</td>
                          <td>{calcularCostoPorcentaje(articulo)}%</td>
                          <td>
                            <input
                              type="number"
                              value={objetivos[articulo.id] || ''}
                              onChange={(e) => handleObjetivoChange(articulo.id, e.target.value)}
                              style={{ width: '60px' }}
                            />
                          </td>
                          <td>${calcularSugerido(articulo).toFixed(2)}</td>
                          <td>
                            <input
                              type="number"
                              value={manuales[articulo.id] || ''}
                              onChange={(e) => handleManualChange(articulo.id, e.target.value)}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TablaArticulos;