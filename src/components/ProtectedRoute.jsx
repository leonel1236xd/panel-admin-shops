import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F5F7' }}>Cargando seguridad...</div>;
  }

  // Si el usuario existe en Supabase Auth, lo dejamos pasar. Si no, al login.
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}