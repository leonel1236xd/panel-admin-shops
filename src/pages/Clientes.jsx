import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [lineaFilter, setLineaFilter] = useState(""); // Opcional para futuros reportes

  // Modal Detail
  const [selectedClient, setSelectedClient] = useState(null);

  // ─── CARGAR CLIENTES Y PROCESAR DATOS ───
  // ─── CARGAR CLIENTES Y PROCESAR DATOS ───
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        // VIAJAMOS DE: clientes -> pedidos -> pedido_items -> productos (para traer el genero)
        .select(
          "*, pedidos(id, total, estado, fecha, pedido_items(productos(genero)))"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const clientesProcesados = (data || []).map((cli) => {
        const validPedidos =
          cli.pedidos?.filter((p) => p.estado !== "Cancelado") || [];
        const totalGastado = validPedidos.reduce(
          (sum, p) => sum + Number(p.total),
          0
        );
        const cantidadPedidos = validPedidos.length;

        const sortedPedidos = [...(cli.pedidos || [])].sort(
          (a, b) => new Date(b.fecha) - new Date(a.fecha)
        );
        const ultimoPedido =
          sortedPedidos.length > 0 ? sortedPedidos[0].fecha : null;
        const estadoReal =
          sortedPedidos.length > 0 ? sortedPedidos[0].estado : "Sin pedidos";

        // RECOLECTAMOS LOS GÉNEROS DE LA ROPA COMPRADA DIRECTO DE LA BD
        const generosComprados = new Set();
        (cli.pedidos || []).forEach((p) => {
          (p.pedido_items || []).forEach((item) => {
            if (item.productos && item.productos.genero) {
              generosComprados.add(item.productos.genero.toLowerCase());
            }
          });
        });

        // Guardamos todo en el cliente, incluyendo el array de lineas ('mujer', 'hombre', etc)
        return {
          ...cli,
          totalGastado,
          cantidadPedidos,
          ultimoPedido,
          estado: estadoReal,
          lineas: Array.from(generosComprados),
        };
      });

      setClientes(clientesProcesados);
    } catch (error) {
      console.error(`Error al cargar clientes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  // ─── FILTROS ───
  // ─── FILTROS ───
  const filteredClientes = clientes.filter((c) => {
    const matchesSearch =
      (c.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.telefono || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.ciudad || "").toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro del ComboBox de Estados
    let matchesEstado = true;
    if (estadoFilter) {
      matchesEstado = c.estado?.toLowerCase() === estadoFilter.toLowerCase();
    }

    // Filtro del ComboBox de Línea de Ropa (Ahora lee tu columna "genero")
    let matchesLinea = true;
    if (lineaFilter) {
      const comproMujer = c.lineas?.includes("mujer");
      const comproHombre = c.lineas?.includes("hombre");

      if (lineaFilter === "mujer") matchesLinea = comproMujer;
      if (lineaFilter === "hombre") matchesLinea = comproHombre;
      if (lineaFilter === "ambos") matchesLinea = comproMujer && comproHombre;
    }

    return matchesSearch && matchesEstado && matchesLinea;
  });

  // ─── UTILS (Basados en tu admin.html) ───
  const getInitials = (name) => {
    if (!name) return "C";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const formatBs = (n) =>
    (Number(n) || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 }) +
    " Bs";

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const statusBadgeClass = (s) => {
    if (s === "Pendiente") return "badge-yellow";
    if (s === "Pagado") return "badge-green";
    if (s === "Completado") return "badge-blue";
    if (s === "Activo") return "badge-green";
    return "badge-gray";
  };

  // ─── IMPRESIÓN DEL REPORTE ───
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const now = new Date();

    let rowsHtml = "";
    let sumaTotalGlobal = 0;

    filteredClientes.forEach((cli) => {
      const ultimoDate = cli.ultimoPedido
        ? new Date(cli.ultimoPedido).toLocaleDateString("es-BO")
        : "-";
      rowsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
            cli.nombre
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
            cli.telefono || "-"
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
            cli.ciudad || "-"
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
            cli.estado
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${
            cli.cantidadPedidos
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${cli.totalGastado.toFixed(
            2
          )}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${ultimoDate}</td>
        </tr>
      `;
      sumaTotalGlobal += cli.totalGastado;
    });

    const htmlContent = `
      <html>
        <head>
          <title>Reporte de Clientes</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #333; }
            h2 { font-size: 16px; margin: 0 0 5px 0; }
            h3 { font-size: 14px; margin: 0 0 20px 0; }
            .info-grid { display: grid; grid-template-columns: 120px 1fr; gap: 4px; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { border-bottom: 2px solid #000; padding: 10px 8px; text-align: left; font-weight: bold; }
            .total-row { font-size: 14px; font-weight: bold; text-align: left; margin-top: 20px; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h2>Reporte de Clientes - star's online</h2>
          <h3>REPORTE DETALLADO DE CARTERA</h3>
          <div class="info-grid">
            <strong>Impreso el:</strong> <span>${now.toLocaleString("es-BO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}</span>
            <strong>TOTAL CLIENTES:</strong> <span>${
              filteredClientes.length
            } registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>TELÉFONO</th>
                <th>CIUDAD</th>
                <th>ESTADO</th>
                <th style="text-align: center;">PEDIDOS</th>
                <th style="text-align: right;">TOTAL GASTADO</th>
                <th style="text-align: right;">ÚLTIMO PEDIDO</th>
              </tr>
            </thead>
            <tbody>
              ${
                rowsHtml ||
                '<tr><td colSpan="7" style="text-align:center; padding: 20px;">No hay clientes registrados</td></tr>'
              }
            </tbody>
          </table>
          <div class="total-row">VOLUMEN TOTAL DE COMPRAS: ${sumaTotalGlobal.toFixed(
            2
          )} Bs</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <>
      <div className="page-header">
        <div className="page-breadcrumb">VENTAS / CLIENTES</div>
        <div className="page-title">Clientes</div>
        <div className="page-subtitle">
          Compradores que han realizado pedidos a través del sistema.
        </div>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente">Con pedido Pendiente</option>
          <option value="Pagado">Con pedido Pagado</option>
          <option value="Completado">Con pedido Completado</option>
        </select>
        <select
          className="filter-select"
          value={lineaFilter}
          onChange={(e) => setLineaFilter(e.target.value)}
        >
          <option value="">Todas las líneas de ropa</option>
          <option value="mujer">Compró Ropa de Mujer (Estrella)</option>
          <option value="hombre">Compró Ropa de Hombre (Varón)</option>
          <option value="ambos">Compró Ambos (Mujer y Hombre)</option>
        </select>
        <button
          onClick={handlePrint}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 18px",
            borderRadius: "8px",
            background: "#111827",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 700,
            transition: "background 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#374151")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#111827")}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Imprimir
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th style={{ textAlign: "center" }}>Pedidos</th>
                <th>Total Gastado</th>
                <th>Último Pedido</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No se encontraron clientes.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div className="client-cell">
                        <div className="client-avatar">
                          {getInitials(c.nombre)}
                        </div>
                        <span className="td-bold">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="td-muted">{c.telefono || "—"}</td>
                    <td>{c.ciudad || "—"}</td>
                    <td>
                      <td>
                        <span className={`badge ${statusBadgeClass(c.estado)}`}>
                          {c.estado}
                        </span>
                      </td>{" "}
                    </td>
                    <td className="td-bold" style={{ textAlign: "center" }}>
                      {c.cantidadPedidos}
                    </td>
                    <td className="td-bold">{formatBs(c.totalGastado)}</td>
                    <td className="td-muted">
                      {c.ultimoPedido ? formatDate(c.ultimoPedido) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: CLIENT DETAIL ─── */}
      <div className={`modal-overlay ${selectedClient ? "open" : ""}`}>
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3>Perfil del Cliente</h3>
            <button
              className="modal-close"
              onClick={() => setSelectedClient(null)}
            >
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body" id="client-detail-body">
            {selectedClient && (
              <div className="client-detail">
                <div className="client-header">
                  <div className="client-avatar-lg">
                    {getInitials(selectedClient.nombre)}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 900,
                        marginBottom: "4px",
                      }}
                    >
                      {selectedClient.nombre}
                    </h2>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                      }}
                    >
                      {selectedClient.telefono
                        ? `📞 ${selectedClient.telefono}`
                        : "Sin teléfono"}{" "}
                      •{" "}
                      {selectedClient.ciudad
                        ? `📍 ${selectedClient.ciudad}`
                        : "Sin ciudad"}
                    </p>
                  </div>
                </div>
                <div className="client-stats">
                  <div className="client-stat">
                    <div className="stat-val">
                      {selectedClient.cantidadPedidos}
                    </div>
                    <div className="stat-label">Pedidos Completados</div>
                  </div>
                  <div className="client-stat">
                    <div className="stat-val">
                      {formatBs(selectedClient.totalGastado)}
                    </div>
                    <div className="stat-label">Total Gastado</div>
                  </div>
                  <div className="client-stat">
                    <div className="stat-val" style={{ fontSize: "1.1rem" }}>
                      {selectedClient.ultimoPedido
                        ? formatDate(selectedClient.ultimoPedido)
                        : "—"}
                    </div>
                    <div className="stat-label">Último Pedido</div>
                  </div>
                </div>

                <h4
                  style={{
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "8px",
                    marginBottom: "16px",
                    fontWeight: 800,
                  }}
                >
                  Historial de Pedidos
                </h4>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nro Pedido</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClient.pedidos?.length > 0 ? (
                        selectedClient.pedidos
                          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                          .map((p) => (
                            <tr key={p.id}>
                              <td className="td-bold">
                                {p.id.split("-")[0].toUpperCase()}
                              </td>
                              <td className="td-muted">
                                {formatDate(p.fecha)}
                              </td>
                              <td className="td-bold">{formatBs(p.total)}</td>
                              <td>
                                <span
                                  className={`badge ${statusBadgeClass(
                                    p.estado
                                  )}`}
                                >
                                  {p.estado}
                                </span>
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            style={{
                              textAlign: "center",
                              padding: "20px",
                              color: "var(--text-muted)",
                            }}
                          >
                            No hay pedidos registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
