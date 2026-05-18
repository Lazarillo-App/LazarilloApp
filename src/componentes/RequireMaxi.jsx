// src/componentes/RequireMaxi.jsx
// Maxi es ahora opcional — el negocio puede funcionar sin credenciales.
// Este componente ya no bloquea el acceso; simplemente renderiza los hijos.
export default function RequireMaxi({ children }) {
  return <>{children}</>;
}