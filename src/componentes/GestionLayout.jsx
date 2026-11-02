// src/componentes/GestionLayout.jsx
// Marco común de Menú e Insumos: la barra (BarraGestion) queda montada arriba
// y solo cambia la página de abajo (<Outlet />). Así, al pasar de Menú a
// Insumos (o al revés) la barra no se vuelve a cargar.
//
// La vista Diseño de Menú (/menu?vista=diseno) va a pantalla completa, sin
// barra; el árbol de elementos es el mismo (solo cambian estilos) para que
// pasar de Tabla a Diseño no desmonte la página.
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import BarraGestion from './BarraGestion';
import { BarraGestionProvider } from '@/context/BarraGestionContext';

export default function GestionLayout() {
  const location = useLocation();
  // Páginas "vivas": la que ya se abrió una vez queda montada (oculta) al
  // pasar a la otra. Volver a Artículos / Menú (diseño) desde Insumos ya no
  // recarga todo — antes ArticulosMain se armaba de cero cada vez y tardaba.
  const outlet = useOutlet();
  const pagina = location.pathname.startsWith('/insumos') ? 'insumos' : 'menu';
  const vivas = useRef({});
  if (outlet) vivas.current[pagina] = outlet;
  const diseno = location.pathname.startsWith('/menu')
    && new URLSearchParams(location.search).get('vista') === 'diseno';

  // Alto real del header (medido, igual que hacían las páginas).
  const [navHeight, setNavHeight] = useState(86);
  useEffect(() => {
    const el = document.querySelector('.MuiAppBar-root');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    // bottom (no height): si hay algo arriba del header, la barra igual
    // arranca justo debajo. Se divide por el zoom global de la app (#root
    // tiene zoom 0.9 en global.css): getBoundingClientRect da px ya
    // achicados y el `top` de abajo se vuelve a achicar → la barra quedaba
    // ~8 px metida debajo del header y la separación de arriba se veía más
    // fina que la de abajo.
    const recalcular = () => {
      const r = el.getBoundingClientRect();
      const z = el.offsetHeight ? r.height / el.offsetHeight : 1;
      setNavHeight((r.bottom || 86) / (z || 1));
    };
    recalcular();
    const ro = new ResizeObserver(recalcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <BarraGestionProvider>
      <div
        style={diseno ? undefined : {
          position: 'fixed', top: navHeight, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden',
        }}
      >
        <div style={{ display: diseno ? 'none' : 'block', padding: '14px 8px 0 8px', flexShrink: 0 }}>
          <BarraGestion />
        </div>
        <div style={diseno ? undefined : { position: 'relative', flex: 1, minHeight: 0 }}>
          {Object.entries(vivas.current).map(([k, el]) => {
            const activa = k === pagina;
            // Oculta con visibility (no display:none): así no pierde el scroll
            // ni el tamaño medido de la tabla virtualizada.
            const st = !activa ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }
              : diseno ? undefined
                : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
            return <div key={k} style={st}>{el}</div>;
          })}
        </div>
      </div>
    </BarraGestionProvider>
  );
}
