import { useState, useEffect } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";

export default function DashboardLayout() {
  const { user, userRole, userSucursal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [sucursales, setSucursales] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);

  const isSuperAdmin = true;

  // -- CARGAR SUCURSALES AL INICIAR --
  useEffect(() => {
    const fetchSucursales = async () => {
      const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .eq("estado", "ACTIVO")
        .order("nombre");

      if (data && data.length > 0) {
        setSucursales(data);
        const starsBranch =
          data.find((s) => s.nombre.toUpperCase().includes("STAR")) || data[0];
        setActiveBranch(starsBranch);
      }
    };
    fetchSucursales();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ─── LÓGICA DE BLOQUEO PARA VENDEDORES ───
  if (userRole === "vendedor") {
    // Si intenta ir a cualquier ruta que no sea pedidos, lo forzamos a regresar
    if (location.pathname !== "/admin/pedidos") {
      return <Navigate to="/admin/pedidos" replace />;
    }

    // Buscamos el nombre exacto de la sucursal usando el ID del vendedor
    const nombreSucursal =
      sucursales.find((s) => s.id === userSucursal)?.nombre || "Cargando...";

    return (
      <div className="vendedor-layout">
        {/* Estilos responsivos del panel de vendedor */}
        <style>{`
          .vendedor-layout {
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #F4F5F7;
          }

          .vendedor-header {
            padding: 16px 32px;
            background: #0f172a;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 10;
            flex-wrap: wrap;
          }

          .vendedor-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0; /* permite que el h2 se pueda truncar */
          }

          .vendedor-header-title {
            margin: 0;
            font-size: 1.2rem;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .vendedor-header-badge {
            background: #3b82f6;
            font-size: 0.7rem;
            padding: 4px 10px;
            border-radius: 12px;
            font-weight: 700;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .vendedor-header-right {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-shrink: 0;
          }

          .vendedor-header-email {
            font-size: 0.85rem;
            color: #cbd5e1;
            max-width: 220px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .vendedor-logout-btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 700;
            font-size: 0.8rem;
            transition: background 0.2s;
            white-space: nowrap;
          }

          .vendedor-logout-btn:hover {
            background: #dc2626;
          }

          .vendedor-main {
            flex: 1;
            overflow-y: auto;
            position: relative;
            padding: 24px;
          }

          /* Tablets */
          @media (max-width: 768px) {
            .vendedor-header {
              padding: 14px 20px;
            }

            .vendedor-header-title {
              font-size: 1.05rem;
            }

            .vendedor-main {
              padding: 16px;
            }
          }

          /* Celulares */
          @media (max-width: 480px) {
            .vendedor-header {
              padding: 12px 16px;
              flex-direction: column;
              align-items: flex-start;
              gap: 10px;
            }

            .vendedor-header-left {
              width: 100%;
              justify-content: space-between;
            }

            .vendedor-header-title {
              font-size: 0.95rem;
              max-width: 65%;
            }

            .vendedor-header-right {
              width: 100%;
              justify-content: space-between;
            }

            .vendedor-header-email {
              max-width: 60%;
            }

            .vendedor-main {
              padding: 12px;
            }
          }
        `}</style>

        {/* Cabecera del Vendedor */}
        <header className="vendedor-header">
          <div className="vendedor-header-left">
            {/* Aquí cargamos el nombre de la sucursal dinámicamente */}
            <h2 className="vendedor-header-title">🏪 {nombreSucursal}</h2>
            <span className="vendedor-header-badge">POS VENDEDOR</span>
          </div>
          <div className="vendedor-header-right">
            <span className="vendedor-header-email">{user?.email}</span>
            <button className="vendedor-logout-btn" onClick={handleLogout}>
              Salir
            </button>
          </div>
        </header>

        {/* Área Principal */}
        <main className="vendedor-main">
          <Outlet />
        </main>
      </div>
    );
  }

  const initial = user?.email ? user.email[0].toUpperCase() : "A";
  const shortName = user?.email ? user.email.split("@")[0] : "Admin";

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <svg
          viewBox="0 0 24 24"
          strokeLinecap="round"
          stroke="currentColor"
          fill="none"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <h1>STAR'S</h1>
          <span>Panel Admin</span>
        </div>

        {/* -- SELECTOR DE UBICACIÓN REAL -- */}
        <div
          className="sidebar-branch-selector"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div
            className="label"
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 700,
              letterSpacing: "1px",
              marginBottom: "6px",
            }}
          >
            Ubicación Activa
          </div>
          <select
            value={activeBranch?.id || ""}
            onChange={(e) => {
              const branch = sucursales.find((s) => s.id === e.target.value);
              setActiveBranch(branch);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.82rem",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                🏪 {sucursal.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* ─── MENÚ CALCADO EXACTAMENTE DEL HTML ORIGINAL ─── */}
        <nav className="sidebar-nav" onClick={() => setIsSidebarOpen(false)}>
          <NavLink to="/admin" end className="nav-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Inicio
          </NavLink>

          <NavLink to="/admin/pedidos" className="nav-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Pedidos
          </NavLink>

          {isSuperAdmin && (
            <>
              <NavLink to="/admin/productos" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Productos Varón
              </NavLink>

              <NavLink to="/admin/productos-mujer" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Productos de Mujer
              </NavLink>

              <NavLink to="/admin/inventario" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                Inventario
              </NavLink>

              <NavLink to="/admin/categorias" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                Categorías
              </NavLink>

              <NavLink to="/admin/marcas" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
                Marcas
              </NavLink>

              <NavLink to="/admin/novedades" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Novedades y Promos
              </NavLink>

              <NavLink to="/admin/clientes" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Clientes
              </NavLink>

              <NavLink to="/admin/costos" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                Costos / Ítems
              </NavLink>

              <NavLink to="/admin/finanzas" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Estado de Resultados
              </NavLink>

              <NavLink to="/admin/sucursales" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Sucursales
              </NavLink>

              <NavLink to="/admin/configuracion" className="nav-item">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Configuración
              </NavLink>
            </>
          )}
        </nav>

        {/* Info de usuario */}
        <div className="sidebar-user">
          <div className="user-avatar" id="user-avatar">
            {initial}
          </div>
          <div className="user-info">
            <div className="uname" id="user-name">
              {shortName}
            </div>
            <div className="uemail" id="user-email">
              {user?.email}
            </div>
          </div>
          <button
            className="btn-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <svg
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: "16px", height: "16px" }}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="main" onClick={() => setIsSidebarOpen(false)}>
        <Outlet context={{ activeBranch }} />
      </main>
    </>
  );
}