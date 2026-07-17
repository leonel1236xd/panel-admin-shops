import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../services/supabase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function Inicio() {
  const { activeBranch } = useOutletContext() || {};
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Modales
  const [modalStatus, setModalStatus] = useState({
    isOpen: false,
    pedidoId: null,
    newStatus: "",
  });
  const [modalView, setModalView] = useState({
    isOpen: false,
    pedido: null,
    items: [],
  });
  const [modalDelete, setModalDelete] = useState({
    isOpen: false,
    pedidoId: null,
  });

  // Escuchar cambios de la sucursal activa para recargar los datos
  useEffect(() => {
    if (activeBranch) {
      fetchPedidosRecientes();
    }
  }, [activeBranch]);

  const fetchPedidosRecientes = async () => {
    setLoading(true);
    // Traer solo pendientes de la sucursal activa, incluyendo datos del cliente
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        `
        id, total, estado, fecha,
        clientes(nombre)
      `
      )
      .eq("sucursal_id", activeBranch.id)
      .eq("estado", "Pendiente")
      .order("fecha", { ascending: false });

    if (!error && data) {
      setPedidos(data);
    }
    setLoading(false);
  };

  // --- ACCIONES DE PEDIDOS ---

  const handleStatusChangeRequest = (pedidoId, newStatus) => {
    setModalStatus({ isOpen: true, pedidoId, newStatus });
  };

  const confirmStatusChange = async () => {
    const { pedidoId, newStatus } = modalStatus;
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: newStatus })
      .eq("id", pedidoId);

    if (!error) {
      // Remover el pedido de la lista porque ya no es "Pendiente"
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
    }
    setModalStatus({ isOpen: false, pedidoId: null, newStatus: "" });
  };

  const viewPedido = async (pedido) => {
    // Traer los items de ese pedido
    const { data } = await supabase
      .from("pedido_items")
      .select("*")
      .eq("pedido_id", pedido.id);

    setModalView({ isOpen: true, pedido, items: data || [] });
  };

  const handleDeleteRequest = (pedidoId) => {
    setModalDelete({ isOpen: true, pedidoId });
  };

  const confirmDelete = async () => {
    // 1. Eliminar items primero (por la llave foránea)
    await supabase
      .from("pedido_items")
      .delete()
      .eq("pedido_id", modalDelete.pedidoId);
    // 2. Eliminar el pedido
    await supabase.from("pedidos").delete().eq("id", modalDelete.pedidoId);

    setPedidos((prev) => prev.filter((p) => p.id !== modalDelete.pedidoId));
    setModalDelete({ isOpen: false, pedidoId: null });
  };

  // --- CONFIGURACIÓN DEL GRÁFICO ---
  // Nota: Estos datos son estáticos por ahora. Puedes conectarlos a Supabase luego
  // usando un RPC o agrupando pedidos por fecha en Javascript.
  const chartData = {
    labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    datasets: [
      {
        label: "Ventas (Bs)",
        data: activeBranch ? [1200, 1900, 800, 2500, 3200, 4100, 2100] : [],
        borderColor: "#111",
        backgroundColor: "rgba(17, 17, 17, 0.05)",
        fill: true,
        tension: 0.4, // Curvas suaves
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
      x: { grid: { display: false } },
    },
  };

  if (!activeBranch)
    return <div style={{ padding: "40px" }}>Cargando sucursal...</div>;

  return (
    <div className="tab-content active">
      <div className="page-header">
        <div className="page-breadcrumb">INICIO / DASHBOARD</div>
        <div className="page-title">Resumen: {activeBranch.nombre}</div>
        <div className="page-subtitle">
          Rendimiento y pedidos pendientes de esta ubicación.
        </div>
      </div>

      {/* GRÁFICO DE VENTAS */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-title">
          Tendencias de Ventas ({activeBranch.nombre})
        </div>
        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* PEDIDOS RECIENTES */}
      <div className="card">
        <div className="card-title">Pedidos Pendientes de Atención</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    Cargando pedidos...
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    No hay pedidos pendientes en esta sucursal.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="td-bold">
                      {p.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td>{p.clientes?.nombre || "Desconocido"}</td>
                    <td className="td-muted">
                      {new Date(p.fecha).toLocaleDateString()}
                    </td>
                    <td className="td-bold">Bs {p.total}</td>
                    <td>
                      <select
                        className={`status-select status-${p.estado}`}
                        value={p.estado}
                        onChange={(e) =>
                          handleStatusChangeRequest(p.id, e.target.value)
                        }
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pagado">Pagado</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </td>
                    <td
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn-icon"
                        onClick={() => viewPedido(p)}
                        title="Ver detalles"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDeleteRequest(p.id)}
                        title="Eliminar"
                        style={{ color: "var(--red)" }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODALES ================= */}

      {/* Modal: Confirmar Cambio de Estado */}
      <div className={`modal-overlay ${modalStatus.isOpen ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Cambiar Estado</h3>
            <button
              className="modal-close"
              onClick={() => setModalStatus({ isOpen: false })}
            >
              &times;
            </button>{" "}
          </div>
          <div className="modal-body">
            <p>
              ¿Estás seguro de marcar este pedido como{" "}
              <strong>{modalStatus.newStatus}</strong>?
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              El pedido desaparecerá de esta lista.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setModalStatus({ isOpen: false })}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={confirmStatusChange}>
              Confirmar
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Eliminar Pedido */}
      <div className={`modal-overlay ${modalDelete.isOpen ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Eliminar Pedido</h3>
            <button
              className="modal-close"
              onClick={() => setModalDelete({ isOpen: false })}
            >
              &times;
            </button>
          </div>
          <div className="modal-body">
            <p style={{ color: "var(--red)" }}>
              ¿Estás seguro de eliminar este pedido permanentemente?
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Esta acción también eliminará los ítems asociados y no se puede
              deshacer.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setModalDelete({ isOpen: false })}
            >
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              Sí, Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Ver Pedido */}
      <div className={`modal-overlay ${modalView.isOpen ? "open" : ""}`}>
        <div className="modal modal-md">
          <div className="modal-header">
            <h3>Detalle del Pedido {modalView.pedido?.id?.substring(0, 8)}</h3>{" "}
            <button
              className="modal-close"
              onClick={() => setModalView({ ...modalView, isOpen: false })}
            >
              &times;
            </button>
          </div>
          <div className="modal-body">
            <p>
              <strong>Cliente:</strong> {modalView.pedido?.clientes?.nombre}
            </p>
            <p>
              <strong>Total:</strong> Bs {modalView.pedido?.total}
            </p>
            <h4 style={{ marginTop: "20px", marginBottom: "10px" }}>
              Productos:
            </h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Cant.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {modalView.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.producto_nombre}</td>
                      <td>{item.color}</td>
                      <td>{item.talla}</td>
                      <td>{item.cantidad}</td>
                      <td>Bs {item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
