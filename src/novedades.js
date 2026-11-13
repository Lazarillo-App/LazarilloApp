// Novedades de Lazarillo para los usuarios (Diego 13/11/2026).
// Se muestran en el ícono ✦ del header, al lado de la campanita, en todos los módulos.
//
// CÓMO SE CARGA: todo PR que cambie algo que el usuario nota suma acá UNA entrada, en el
// mismo PR. Como este archivo viaja con el front, cada sitio muestra lo que tiene publicado:
// testing ve lo de testing y lazarillo.com.ar lo de main (cuando Mairene pasa testing → main).
// Los cambios internos (velocidad del servidor, avisos, fallas invisibles) NO van.
//
// Campos:
//   id      único y que no cambie nunca ('aaaa-mm-dd-tema'): marca qué vio cada usuario.
//   fecha   'aaaa-mm-dd'.
//   modulo  recetas | tableros | resultados | rrhh | configuracion  (solapa y permiso).
//   texto   una oración en palabras del usuario. <b> permitido para el nombre de algo.
//   ruta    adónde lleva «Probar».
//   para    'gestion' (dueño y administración, por defecto) | 'todos' (también Staff).
//
// Se muestran las de los últimos 60 días, la más nueva primero.
const NOVEDADES = [
  { id: '2026-11-12-completitud-rubros', fecha: '2026-11-12', modulo: 'resultados', ruta: '/gestion',
    texto: 'Cada rubro muestra cuánto falta cargar en el mes, comparado con lo habitual.' },
  { id: '2026-11-12-receta-refresca', fecha: '2026-11-12', modulo: 'recetas', ruta: '/menu',
    texto: 'Al guardar una receta se actualiza solo ese artículo, sin recargar toda la tabla.' },
  { id: '2026-11-12-rrhh-alta-dni', fecha: '2026-11-12', modulo: 'rrhh', ruta: '/rrhh/nomina',
    texto: 'Empleados: fecha de alta y DNI en la ficha.' },
  { id: '2026-11-12-tableros-plazas', fecha: '2026-11-12', modulo: 'tableros', ruta: '/tableros', para: 'todos',
    texto: 'Cada plaza de despacho ve sus productos armados, con los ingredientes en el orden en que se sirven.' },
  { id: '2026-11-11-venden-poco', fecha: '2026-11-11', modulo: 'recetas', ruta: '/menu',
    texto: 'Nuevo sector <b>Venden poco</b>: los artículos que suman el último 5 % de lo facturado.' },
];

export default NOVEDADES;
