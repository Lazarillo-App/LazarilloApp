// src/componentes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Soporta ambos usos:
  //  - <Route element={<ProtectedRoute/>}><Route .../></Route>
  //  - <ProtectedRoute>{...children}</ProtectedRoute>
  return children ? children : <Outlet />;
}
