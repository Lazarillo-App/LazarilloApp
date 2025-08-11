import React, { useState, useEffect, useMemo } from 'react';
import { obtenerToken, obtenerArticulos } from '../servicios/apiMaxiRest';
import SidebarCategorias from './SidebarCategorias';
import '../css/TablaArticulos.css';

const TablaArticulos = ({
  filtroBusqueda, setFiltroBusqueda,
  agrupacionSeleccionada, setAgrupacionSeleccionada,
  agrupaciones, categoriaSeleccionada, setCategoriaSeleccionada,
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

  const baseById = useMemo(() => {
    const list = categorias.flatMap(c =>
      c.subrubros.flatMap(s => s.articulos)
    );
    return new Map(list.map(a => [a.id, a]));
  }, [categorias]);

  let articulosAMostrar = [];

  if (categoriaSeleccionada && agrupacionSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros
      .flatMap(sub => sub.articulos)
      .filter(art => (agrupacionSeleccionada.articulos || []).some(a => a.id === art.id));
  } else if (categoriaSeleccionada) {
    articulosAMostrar = categoriaSeleccionada.subrubros.flatMap(sub => sub.articulos);
  } else if (agrupacionSeleccionada) {
    // 🔥 Hidratar artículos de la agrupación con el maestro
    const arr = agrupacionSeleccionada.articulos || [];
    articulosAMostrar = arr.map(a => {
      const b = baseById.get(a.id) || {};
      return {
        ...b, ...a,
        nombre: a.nombre || b.nombre || `#${a.id}`,
        categoria: a.categoria || b.categoria || 'Sin categoría',
        subrubro: a.subrubro || b.subrubro || 'Sin subrubro',
        precio: Number(a.precio ?? b.precio ?? 0),
        costo: Number(a.costo ?? b.costo ?? 0),
      };
    });
  } else {
    articulosAMostrar = categorias.flatMap(c =>
      c.subrubros.flatMap(s => s.articulos)
    );
  }

  const articulosFiltrados = filtroBusqueda
    ? articulosAMostrar.filter((art) =>
      (art.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase())
    )
    : articulosAMostrar;

  const calcularCostoPorcentaje = (art) => {
    const precio = Number(art.precio) || 0;
    const costo = Number(art.costo) || 0;
    return precio > 0 ? ((costo / precio) * 100).toFixed(2) : 0;
  };

  const calcularSugerido = (art) => {
    const objetivo = Number(objetivos[art.id]) || 0; // %
    const costo = Number(art.costo) || 0;
    const den = 100 - objetivo;
    return den > 0 ? costo * (100 / den) : 0;
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
        setBusqueda={setFiltroBusqueda}
      />

      <div className="tabla-content">
        <h2>Gestión de Artículos</h2>

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