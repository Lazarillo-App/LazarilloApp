// src/componentes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const hasToken = !!localStorage.getItem('token');
  const loc = useLocation();
  if (!hasToken) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children ?? <Outlet />;
}
