import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import Products from "./pages/Products";
import Novedades from "./pages/Novedades";
import Categorias from "./pages/Categorias";
import Marcas from "./pages/Marcas";
import Sucursales from "./pages/Sucursales";
import Pedidos from "./pages/Pedidos";
import Clientes from "./pages/Clientes";
import Inventario from "./pages/Inventario";
import CostosItems from "./pages/CostosItems";
import Finanzas from "./pages/Finanzas";
import Configuraciones from "./pages/Configuraciones";
import Inicio from "./pages/Inicio";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
            <Route index element={<Inicio />} />

              {/* Rutas reales conectadas a los componentes */}
              <Route path="productos" element={<Products gender="hombre" />} />
              <Route
                path="productos-mujer"
                element={<Products gender="mujer" />}
              />
              <Route path="novedades" element={<Novedades />} />
              <Route path="categorias" element={<Categorias />} />
              <Route path="marcas" element={<Marcas />} />
              <Route path="sucursales" element={<Sucursales />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="costos" element={<CostosItems />} />
              <Route path="finanzas" element={<Finanzas />} />
              <Route path="configuracion" element={<Configuraciones />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
