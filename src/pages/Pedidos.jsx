import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";

export default function Pedidos() {
  const { userRole, userSucursal } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [sucursalFilter, setSucursalFilter] = useState(
    userRole === "vendedor" ? userSucursal : "todas"
  );
  // Maestros para el POS
  const [sucursales, setSucursales] = useState([]);
  const [clientesRegistrados, setClientesRegistrados] = useState([]);
  const [productos, setProductos] = useState([]);
  const [branchInventory, setBranchInventory] = useState([]); // Stock dinámico de la sucursal seleccionada
  const [estrellaBrandId, setEstrellaBrandId] = useState(null);

  // Estados de Modales
  const [isVentaModalOpen, setIsVentaModalOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderItems, setViewOrderItems] = useState([]);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [statusChange, setStatusChange] = useState({
    id: null,
    oldStatus: "",
    newStatus: "",
  });

  // Variables de Venta Manual (POS)
  const [saleClientSelect, setSaleClientSelect] = useState("");
  const [saleClientName, setSaleClientName] = useState("");
  const [saleClientPhone, setSaleClientPhone] = useState("");
  const [saleClientCity, setSaleClientCity] = useState("");

  const [saleSucursal, setSaleSucursal] = useState(
    userRole === "vendedor" ? userSucursal : ""
  );
  const [saleStatus, setSaleStatus] = useState("Completado");
  const [saleEnvio, setSaleEnvio] = useState(0);
  const [saleDescuento, setSaleDescuento] = useState(0);

  const [saleProductSelect, setSaleProductSelect] = useState("");
  const [saleVariantSelect, setSaleVariantSelect] = useState("");
  const [saleItemQty, setSaleItemQty] = useState(1);
  const [saleItems, setSaleItems] = useState([]);

  const [currentVariantStock, setCurrentVariantStock] = useState("—");
  const [currentVariantPrice, setCurrentVariantPrice] = useState("—");

  // Toasts
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000
    );
  };

  // ─── CARGA INICIAL DE DATOS ───
  const fetchPedidos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pedidos")
        .select("*, clientes(nombre), sucursales(nombre), pedido_items(*)")
        .order("fecha", { ascending: false });

      if (fechaInicio) query = query.gte("fecha", `${fechaInicio}T00:00:00`);
      if (fechaFin) query = query.lte("fecha", `${fechaFin}T23:59:59`);
      if (estadoFilter) query = query.eq("estado", estadoFilter);
      if (sucursalFilter !== "todas")
        query = query.eq("sucursal_id", sucursalFilter);

      const { data, error } = await query;
      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      showToast(`Error al cargar pedidos: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMaestros = async () => {
    try {
      const { data: sucs } = await supabase
        .from("sucursales")
        .select("id, nombre, tipo")
        .order("nombre");
      const { data: clis } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre");

      // SOLUCIÓN: Agregamos "genero" a la consulta y quitamos la búsqueda de marcas
      const { data: prods, error: prodsErr } = await supabase
        .from("productos")
        .select(
          "id, nombre, precio, genero, imagenes, variantes(id, color, talla, stock_global)"
        )
        .order("nombre");

      if (prodsErr) throw prodsErr;

      setSucursales(sucs || []);
      setClientesRegistrados(clis || []);
      setProductos(prods || []);
    } catch (error) {
      console.error("Error cargando maestros:", error);
      showToast("Error al cargar el catálogo de productos", "error");
    }
  };

  useEffect(() => {
    fetchPedidos();
    fetchMaestros();

    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    setFechaFin(today.toISOString().split("T")[0]);
    setFechaInicio(monthAgo.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fechaInicio, fechaFin, estadoFilter, sucursalFilter]);

  // ─── LÓGICA DINÁMICA DE INVENTARIO (NUEVO ORDEN LINEAL) ───
  // Cuando se selecciona una sucursal, cargamos su inventario
  useEffect(() => {
    if (!saleSucursal) {
      setBranchInventory([]);
      setSaleProductSelect("");
      setSaleVariantSelect("");
      return;
    }
    const fetchBranchStock = async () => {
      const suc = sucursales.find((s) => s.id === saleSucursal);
      if (suc && (suc.tipo === "almacen" || suc.tipo === "secundaria")) {
        const { data } = await supabase
          .from("inventario_sucursales")
          .select("variante_id, stock_local")
          .eq("sucursal_id", saleSucursal);
        setBranchInventory(data || []);
      } else {
        setBranchInventory([]); // Si es tienda principal, usaremos el stock_global directo de 'productos'
      }
    };
    fetchBranchStock();
  }, [saleSucursal, sucursales]);

  // Helper para saber cuánto stock tiene una variante en la sucursal actual
  const getVariantStock = (variante) => {
    const suc = sucursales.find((s) => s.id === saleSucursal);
    if (suc && (suc.tipo === "almacen" || suc.tipo === "secundaria")) {
      const inv = branchInventory.find((i) => i.variante_id === variante.id);
      return inv ? inv.stock_local : 0;
    }
    return variante.stock_global || 0; // Tienda principal usa stock_global
  };

  // Filtramos PRODUCTOS que tengan al menos 1 variante con stock > 0 Y que pertenezcan a la marca de la sucursal
  const availableProducts = productos.filter((p) => {
    if (!saleSucursal) return false;

    // 1. Verificamos a qué tienda corresponde utilizando el GÉNERO
    const sucursalElegida = sucursales.find((s) => s.id === saleSucursal);
    const esSucursalEstrella = sucursalElegida?.nombre
      .toLowerCase()
      .includes("estrella");

    let correspondeMarca = true;
    if (esSucursalEstrella) {
      correspondeMarca = p.genero === "mujer"; // Estrella -> SOLO muestra ropa de Mujer
    } else {
      correspondeMarca = p.genero !== "mujer"; // Star's -> Muestra Hombre / Unisex
    }

    // 2. Verificamos que tenga variantes con stock en esa sucursal
    const tieneStock =
      p.variantes && p.variantes.some((v) => getVariantStock(v) > 0);

    return correspondeMarca && tieneStock;
  });

  // Filtramos VARIANTES del producto seleccionado con stock > 0
  const activeProduct = availableProducts.find(
    (p) => p.id === saleProductSelect
  );
  const availableVariants = activeProduct
    ? activeProduct.variantes.filter((v) => getVariantStock(v) > 0)
    : [];

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setSaleProductSelect(pId);
    setSaleVariantSelect("");
    setCurrentVariantStock("—");
    setCurrentVariantPrice("—");
  };

  const handleVariantChange = (e) => {
    const vId = e.target.value;
    setSaleVariantSelect(vId);

    if (!vId) {
      setCurrentVariantStock("—");
      setCurrentVariantPrice("—");
      return;
    }

    const variante = availableVariants.find((v) => v.id === vId);
    setCurrentVariantPrice(`Bs ${activeProduct.precio}`);
    setCurrentVariantStock(getVariantStock(variante));
  };

  const handleAddToCart = () => {
    if (!saleProductSelect || !saleVariantSelect)
      return showToast("Selecciona producto y variante", "error");
    if (saleItemQty < 1) return;

    const variante = availableVariants.find((v) => v.id === saleVariantSelect);
    const stockDisponible = getVariantStock(variante);

    // Verificamos cuánto hay en el carrito para no exceder
    const qtyInCart =
      saleItems.find((i) => i.variante.id === variante.id)?.cantidad || 0;

    if (qtyInCart + saleItemQty > stockDisponible) {
      return showToast(
        `Stock insuficiente. Límite disponible: ${stockDisponible}`,
        "warning"
      );
    }

    setSaleItems((prev) => {
      const exists = prev.find((i) => i.variante.id === variante.id);
      if (exists) {
        return prev.map((i) =>
          i.variante.id === variante.id
            ? {
                ...i,
                cantidad: i.cantidad + saleItemQty,
                subtotal: (i.cantidad + saleItemQty) * activeProduct.precio,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          producto: activeProduct,
          variante,
          cantidad: saleItemQty,
          precio: activeProduct.precio,
          subtotal: saleItemQty * activeProduct.precio,
        },
      ];
    });

    setSaleItemQty(1);
    showToast("Producto agregado al carrito");
  };

  const handleRemoveItem = (vId) => {
    setSaleItems((prev) => prev.filter((i) => i.variante.id !== vId));
  };

  const subtotalVenta = saleItems.reduce((acc, item) => acc + item.subtotal, 0);
  const totalVenta = subtotalVenta + Number(saleEnvio) - Number(saleDescuento);

  // ─── GUARDAR VENTA EN BD Y REINICIAR FORMULARIO ───
  const saveManualSale = async () => {
    // Garantizar que el vendedor no envíe ventas falsas a otra tienda
    const sucursalFinal = userRole === "vendedor" ? userSucursal : saleSucursal;

    if (!sucursalFinal) return showToast("Selecciona una sucursal", "error");
    if (saleItems.length === 0)
      return showToast("El carrito está vacío", "error");
    if (!saleClientSelect && !saleClientName.trim())
      return showToast("Ingresa el nombre del cliente", "error");

    let clientId = saleClientSelect;

    try {
      if (!clientId) {
        const { data: cData, error: cErr } = await supabase
          .from("clientes")
          .insert([
            {
              nombre: saleClientName.trim(),
              telefono: saleClientPhone.trim() || null,
              ciudad: saleClientCity.trim() || null,
            },
          ])
          .select();
        if (cErr) throw cErr;
        clientId = cData[0].id;
      }

      // INSERTAMOS EL PEDIDO CON LA SUCURSAL SEGURA
      const { data: pData, error: pErr } = await supabase
        .from("pedidos")
        .insert([
          {
            cliente_id: clientId,
            sucursal_id: sucursalFinal, // <--- AQUI USAMOS LA VARIABLE PROTEGIDA
            subtotal: subtotalVenta,
            envio: Number(saleEnvio),
            total: totalVenta < 0 ? 0 : totalVenta,
            estado: saleStatus,
            fecha: new Date().toISOString(),
          },
        ])
        .select();
      if (pErr) throw pErr;

      const pedidoId = pData[0].id;

      const itemsToInsert = saleItems.map((item) => ({
        pedido_id: pedidoId,
        producto_id: item.producto.id,
        producto_nombre: item.producto.nombre,
        imagen_url: item.producto.imagenes?.[0] || null,
        color: item.variante.color,
        talla: item.variante.talla,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        total: item.subtotal,
      }));

      const { error: iErr } = await supabase
        .from("pedido_items")
        .insert(itemsToInsert);
      if (iErr) throw iErr;

      showToast("Venta registrada con éxito");

      // VACIADO TOTAL DEL FORMULARIO
      setSaleItems([]);
      setSaleClientSelect("");
      setSaleClientName("");
      setSaleClientPhone("");
      setSaleClientCity("");

      // SOLUCIÓN: Si es vendedor, NO le borramos su sucursal fija. Si es admin, sí obligamos a re-elegir.
      if (userRole !== "vendedor") {
        setSaleSucursal("");
      }

      setSaleProductSelect("");
      setSaleVariantSelect("");
      setSaleStatus("Completado");
      setSaleEnvio(0);
      setSaleDescuento(0);
      setCurrentVariantStock("—");
      setCurrentVariantPrice("—");
      setSaleItemQty(1);

      setIsVentaModalOpen(false);
      fetchPedidos();
      fetchMaestros(); // Refresca inventario global por si acaso
    } catch (error) {
      showToast(`Error al registrar venta: ${error.message}`, "error");
    }
  };

  // ─── ACCIONES DE TABLA E IMPRESIÓN ───
  const filteredPedidos = pedidos.filter(
    (p) =>
      (p.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.clientes?.nombre || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleViewOrder = async (pedido) => {
    setViewOrder(pedido);
    const { data } = await supabase
      .from("pedido_items")
      .select("*")
      .eq("pedido_id", pedido.id);
    setViewOrderItems(data || []);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteOrderId) return;
    try {
      const { error } = await supabase
        .from("pedidos")
        .delete()
        .eq("id", deleteOrderId);
      if (error) throw error;
      showToast("Pedido eliminado correctamente");
      fetchPedidos();
    } catch (error) {
      showToast(`Error al eliminar: ${error.message}`, "error");
    } finally {
      setDeleteOrderId(null);
    }
  };

  const handleStatusChange = (pedidoId, oldStatus, newStatus) => {
    if (oldStatus === newStatus) return;
    setStatusChange({ id: pedidoId, oldStatus, newStatus });
  };

  const confirmStatusChange = async () => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: statusChange.newStatus })
        .eq("id", statusChange.id);
      if (error) throw error;
      showToast("Estado actualizado");
      fetchPedidos();
    } catch (error) {
      showToast(`Error al actualizar estado`, "error");
    } finally {
      setStatusChange({ id: null, oldStatus: "", newStatus: "" });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const now = new Date();
    const shopName =
      sucursalFilter === "todas"
        ? "star's online"
        : sucursales.find((s) => s.id === sucursalFilter)?.nombre ||
          "star's online";

    let rowsHtml = "";
    let count = 1;
    let totalGeneral = 0;

    filteredPedidos.forEach((pedido) => {
      const dateStr = new Date(pedido.fecha).toLocaleString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (pedido.pedido_items && pedido.pedido_items.length > 0) {
        pedido.pedido_items.forEach((item) => {
          rowsHtml += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${count++}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${dateStr}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
                item.producto_nombre || "-"
              }</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">-</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
                item.color || "-"
              }</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${
                item.talla || "-"
              }</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${Number(
                item.precio_unitario
              ).toFixed(2)}</td>
            </tr>
          `;
          totalGeneral += Number(item.total);
        });
      }
    });

    const htmlContent = `
      <html>
        <head>
          <title>Reporte de Ventas</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #333; }
            h2 { font-size: 16px; margin: 0 0 5px 0; }
            h3 { font-size: 14px; margin: 0 0 20px 0; }
            .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 4px; margin-bottom: 20px; font-size: 12px; }
            .info-grid strong { text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { border-bottom: 2px solid #000; padding: 10px 8px; text-align: left; font-weight: bold; }
            .total-row { font-size: 14px; font-weight: bold; text-align: left; margin-top: 20px; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h2>Reporte de Ventas - ${shopName}</h2>
          <h3>REPORTE DE VENTAS DETALLADAS</h3>
          <div class="info-grid">
            <strong>Impreso el:</strong> <span>${now.toLocaleString("es-BO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}</span>
            <strong>TIENDA:</strong> <span>${shopName}</span>
            <strong>ESTADO:</strong> <span>${
              estadoFilter ? estadoFilter.toUpperCase() : "TODOS"
            }</span>
            <strong>FECHAS:</strong> <span>Del ${
              fechaInicio
                ? new Date(fechaInicio).toLocaleDateString("es-BO")
                : "Inicio"
            } al ${
      fechaFin ? new Date(fechaFin).toLocaleDateString("es-BO") : "Fin"
    }</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center;">N°</th>
                <th>Fecha</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Color</th>
                <th style="text-align: center;">Talla</th>
                <th style="text-align: right;">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${
                rowsHtml ||
                '<tr><td colSpan="7" style="text-align:center; padding: 20px;">No hay ventas en este periodo</td></tr>'
              }
            </tbody>
          </table>
          <div class="total-row">TOTAL GENERAL: ${totalGeneral.toFixed(
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
      {toast.show && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === "success" ? (
              <svg
                className="toast-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                className="toast-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-breadcrumb">VENTAS / PEDIDOS</div>
            <div className="page-title">Gestión de Pedidos</div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                <label
                  style={{
                    fontSize: ".65rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  Desde
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  style={{ padding: "6px 10px", width: "135px" }}
                />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                <label
                  style={{
                    fontSize: ".65rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  Hasta
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  style={{ padding: "6px 10px", width: "135px" }}
                />
              </div>
              <button
                className="btn"
                onClick={handlePrint}
                style={{
                  background: "#22C55E",
                  color: "#fff",
                  padding: "8px 18px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              >
                IMPRIMIR
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setIsVentaModalOpen(true)}
            >
              + Realizar Venta
            </button>
          </div>
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
            placeholder="Buscar pedidos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Ocultamos este select si es un vendedor */}
        {userRole === "admin" && (
          <select
            className="filter-select"
            value={sucursalFilter}
            onChange={(e) => setSucursalFilter(e.target.value)}
          >
            <option value="todas">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
        <select
          className="filter-select"
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Pagado">Pagado</option>
          <option value="Completado">Completado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>

      {/* ─── TABLA PRINCIPAL DE PEDIDOS ─── */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead style={{ background: "#3C5A64", color: "#fff" }}>
              <tr>
                <th style={{ background: "#3C5A64", color: "#fff" }}>ID</th>
                <th style={{ background: "#3C5A64", color: "#fff" }}>
                  Cliente
                </th>
                <th style={{ background: "#3C5A64", color: "#fff" }}>
                  Sucursal
                </th>
                <th style={{ background: "#3C5A64", color: "#fff" }}>Fecha</th>
                <th style={{ background: "#3C5A64", color: "#fff" }}>Total</th>
                <th style={{ background: "#3C5A64", color: "#fff" }}>Estado</th>
                <th
                  style={{
                    background: "#3C5A64",
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredPedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "40px" }}
                  >
                    No se encontraron pedidos.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="td-bold" style={{ fontSize: "0.8rem" }}>
                      {p.id.split("-")[0].toUpperCase()}
                    </td>
                    <td>{p.clientes?.nombre || "Cliente Anónimo"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {p.sucursales?.nombre || "Desconocida"}
                    </td>
                    <td className="td-muted">
                      {new Date(p.fecha).toLocaleString("es-BO")}
                    </td>
                    <td className="td-bold">Bs {p.total}</td>
                    <td>
                      <select
                        value={p.estado}
                        onChange={(e) =>
                          handleStatusChange(p.id, p.estado, e.target.value)
                        }
                        style={{
                          background:
                            p.estado === "Completado"
                              ? "#DEF7EC"
                              : p.estado === "Cancelado"
                              ? "#FDE8E8"
                              : p.estado === "Pagado"
                              ? "#E1EFFE"
                              : "#FEF3C7",
                          color:
                            p.estado === "Completado"
                              ? "#03543F"
                              : p.estado === "Cancelado"
                              ? "#9B1C1C"
                              : p.estado === "Pagado"
                              ? "#1E429F"
                              : "#D97706",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontWeight: 700,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pagado">Pagado</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          className="btn-icon"
                          onClick={() => handleViewOrder(p)}
                          title="Ver Detalle"
                          style={{
                            color: "#0084E6",
                            fontWeight: 700,
                            fontSize: ".8rem",
                          }}
                        >
                          VER
                        </button>
                        {p.estado === "Pendiente" && (
                          <button
                            className="btn-icon"
                            onClick={() => setDeleteOrderId(p.id)}
                            title="Eliminar"
                            style={{ color: "#EF4444" }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: REALIZAR VENTA (POS) ─── */}
      <div className={`modal-overlay ${isVentaModalOpen ? "open" : ""}`}>
        <div
          className="modal modal-lg"
          style={{ maxWidth: "1000px", width: "95%" }}
        >
          <div className="modal-header">
            <h3>Realizar Nueva Venta / Pedido</h3>
            <button
              className="modal-close"
              onClick={() => setIsVentaModalOpen(false)}
            >
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div
            className="modal-body"
            style={{
              display: "flex",
              gap: "24px",
              padding: "20px",
              flexWrap: "wrap",
            }}
          >
            {/* COLUMNA IZQUIERDA: CLIENTE Y OPCIONES */}
            <div
              style={{
                flex: 1,
                minWidth: "300px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h4
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "6px",
                  fontWeight: 700,
                }}
              >
                1. Datos del Cliente
              </h4>

              <div className="form-group">
                <label className="form-label">
                  Buscar Cliente Registrado (Opcional)
                </label>
                <select
                  className="form-select"
                  value={saleClientSelect}
                  onChange={(e) => {
                    setSaleClientSelect(e.target.value);
                    if (e.target.value) {
                      const c = clientesRegistrados.find(
                        (cli) => cli.id === e.target.value
                      );
                      setSaleClientName(c.nombre || "");
                      setSaleClientPhone(c.telefono || "");
                      setSaleClientCity(c.ciudad || "");
                    } else {
                      setSaleClientName("");
                      setSaleClientPhone("");
                      setSaleClientCity("");
                    }
                  }}
                >
                  <option value="">-- Cliente Nuevo --</option>
                  {clientesRegistrados.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.telefono})
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div className="form-group">
                  <label className="form-label">Nombre Completo *</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Juan Perez"
                    value={saleClientName}
                    onChange={(e) => setSaleClientName(e.target.value)}
                    disabled={saleClientSelect !== ""}
                  />
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Teléfono</label>
                    <input
                      className="form-input"
                      placeholder="Ej: 77712345"
                      value={saleClientPhone}
                      onChange={(e) => setSaleClientPhone(e.target.value)}
                      disabled={saleClientSelect !== ""}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Ciudad</label>
                    <select
                      className="form-select"
                      value={saleClientCity}
                      onChange={(e) => setSaleClientCity(e.target.value)}
                      disabled={saleClientSelect !== ""}
                    >
                      <option value="">Seleccionar ciudad...</option>
                      <option value="Beni">Beni</option>
                      <option value="Chuquisaca">Chuquisaca</option>
                      <option value="Cochabamba">Cochabamba</option>
                      <option value="La Paz">La Paz</option>
                      <option value="Oruro">Oruro</option>
                      <option value="Pando">Pando</option>
                      <option value="Potosí">Potosí</option>
                      <option value="Santa Cruz">Santa Cruz</option>
                      <option value="Tarija">Tarija</option>
                    </select>
                  </div>
                </div>
              </div>

              <h4
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "6px",
                  fontWeight: 700,
                  marginTop: "12px",
                }}
              >
                Opciones de la Venta
              </h4>

              <div style={{ display: "flex", gap: "12px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Costo Envío (Bs)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={saleEnvio}
                    onChange={(e) => setSaleEnvio(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Descuento (Bs)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={saleDescuento}
                    onChange={(e) => setSaleDescuento(e.target.value)}
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Estado de Venta *</label>
                <select
                  className="form-select"
                  value={saleStatus}
                  onChange={(e) => setSaleStatus(e.target.value)}
                >
                  <option value="Completado">Completado</option>
                  <option value="Pagado">Pagado</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>
            </div>

            {/* COLUMNA DERECHA: SUCURSAL, PRODUCTOS Y CARRITO (FLUJO LINEAL) */}
            <div
              style={{
                flex: 1.4,
                minWidth: "350px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h4
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "6px",
                  fontWeight: 700,
                  color: "#0084E6",
                }}
              >
                2. Elegir Punto de Venta
              </h4>
              <div className="form-group">
                <label className="form-label">
                  Sucursal (Al elegir, se cargará su stock disponible) *
                </label>
                <select
                  className="form-select"
                  value={saleSucursal}
                  onChange={(e) => setSaleSucursal(e.target.value)}
                  style={{ border: "2px solid #0084E6" }}
                  disabled={userRole === "vendedor"}
                >
                  <option value="">-- SELECCIONA LA SUCURSAL PRIMERO --</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <h4
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "6px",
                  fontWeight: 700,
                  marginTop: "8px",
                }}
              >
                3. Agregar Productos
              </h4>

              <div
                style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
              >
                <div className="form-group" style={{ flex: 1.5 }}>
                  <label className="form-label">Seleccionar Producto</label>
                  <select
                    className="form-select"
                    value={saleProductSelect}
                    onChange={handleProductChange}
                    disabled={!saleSucursal}
                  >
                    <option value="">
                      {saleSucursal
                        ? "Selecciona un producto..."
                        : "Bloqueado (Falta sucursal)"}
                    </option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Variante (Disponible)</label>
                  <select
                    className="form-select"
                    value={saleVariantSelect}
                    onChange={handleVariantChange}
                    disabled={!saleProductSelect}
                  >
                    <option value="">
                      {saleProductSelect ? "Selecciona variante..." : "..."}
                    </option>
                    {availableVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.color} - T{v.talla} (Stock: {getVariantStock(v)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "var(--border-light)",
                    padding: "10px",
                    borderRadius: "6px",
                    fontSize: ".8rem",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    P.Unit: <strong>{currentVariantPrice}</strong>
                  </span>
                </div>
                <div className="form-group" style={{ width: "80px" }}>
                  <label className="form-label">Cant.</label>
                  <input
                    type="number"
                    className="form-input"
                    value={saleItemQty}
                    onChange={(e) => setSaleItemQty(parseInt(e.target.value))}
                    min="1"
                    disabled={!saleVariantSelect}
                  />
                </div>
                <button
                  className="btn btn-outline"
                  onClick={handleAddToCart}
                  style={{
                    height: "38px",
                    background: saleVariantSelect ? "#0084E6" : "transparent",
                    color: saleVariantSelect ? "#fff" : "inherit",
                  }}
                  type="button"
                  disabled={!saleVariantSelect}
                >
                  Agregar
                </button>
              </div>

              <div
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  marginTop: "10px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    fontSize: ".78rem",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead
                    style={{
                      background: "#f3f4f6",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    <tr>
                      <th style={{ padding: "8px", textAlign: "left" }}>
                        Producto
                      </th>
                      <th style={{ padding: "8px", textAlign: "center" }}>
                        Cant
                      </th>
                      <th style={{ padding: "8px", textAlign: "right" }}>
                        Subtotal
                      </th>
                      <th style={{ padding: "8px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Carrito vacío
                        </td>
                      </tr>
                    ) : (
                      saleItems.map((item) => (
                        <tr key={item.variante.id}>
                          <td
                            style={{
                              padding: "8px",
                              borderBottom: "1px solid var(--border-light)",
                            }}
                          >
                            <strong>{item.producto.nombre}</strong>
                            <br />
                            <span style={{ color: "var(--text-secondary)" }}>
                              {item.variante.color} - T{item.variante.talla}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              borderBottom: "1px solid var(--border-light)",
                            }}
                          >
                            {item.cantidad}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              borderBottom: "1px solid var(--border-light)",
                            }}
                          >
                            {item.subtotal}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              borderBottom: "1px solid var(--border-light)",
                            }}
                          >
                            <button
                              onClick={() => handleRemoveItem(item.variante.id)}
                              style={{
                                color: "#EF4444",
                                fontWeight: 800,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              X
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  alignSelf: "flex-end",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: ".9rem",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "1.2rem",
                    fontWeight: 900,
                    color: "#111",
                  }}
                >
                  <span>Total Venta:</span>
                  <span>Bs {totalVenta < 0 ? 0 : totalVenta}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setIsVentaModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={saveManualSale}
              style={{
                background: "#0084E6",
                borderColor: "#0084E6",
                fontSize: "1.05rem",
                padding: "10px 24px",
              }}
            >
              Registrar Venta
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL: VER DETALLE DEL PEDIDO ─── */}
      <div className={`modal-overlay ${viewOrder ? "open" : ""}`}>
        <div className="modal modal-md">
          <div className="modal-header">
            <h3>
              Detalle del Pedido {viewOrder?.id.split("-")[0].toUpperCase()}
            </h3>
            <button className="modal-close" onClick={() => setViewOrder(null)}>
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
                background: "#F9FAFB",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cliente:
                </p>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {viewOrder?.clientes?.nombre || "Anónimo"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Fecha:
                </p>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {viewOrder &&
                    new Date(viewOrder.fecha).toLocaleString("es-BO")}
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: "center" }}>Cant.</th>
                    <th style={{ textAlign: "right" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrderItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {item.producto_nombre}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.color} - T{item.talla}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>{item.cantidad}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        Bs {item.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                textAlign: "right",
                marginTop: "16px",
                fontSize: "1.1rem",
                fontWeight: 800,
              }}
            >
              TOTAL: Bs {viewOrder?.total}
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setViewOrder(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL: CONFIRMACIÓN CAMBIO DE ESTADO ─── */}
      <div className={`modal-overlay ${statusChange.id ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Cambiar Estado</h3>
            <button
              className="modal-close"
              onClick={() =>
                setStatusChange({ id: null, oldStatus: "", newStatus: "" })
              }
            >
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <p>
              ¿Estás seguro de cambiar el estado de{" "}
              <strong>{statusChange.oldStatus}</strong> a{" "}
              <strong style={{ color: "#0084E6" }}>
                {statusChange.newStatus}
              </strong>
              ?
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() =>
                setStatusChange({ id: null, oldStatus: "", newStatus: "" })
              }
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={confirmStatusChange}>
              Confirmar
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODAL: CONFIRMACIÓN ELIMINAR PEDIDO ─── */}
      <div className={`modal-overlay ${deleteOrderId ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Eliminar Pedido</h3>
            <button
              className="modal-close"
              onClick={() => setDeleteOrderId(null)}
            >
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ color: "#EF4444", fontWeight: 600 }}>¡Atención!</p>
            <p style={{ fontSize: ".88rem", color: "var(--text-secondary)" }}>
              ¿Estás seguro de que deseas eliminar este pedido pendiente? Esta
              acción no se puede deshacer.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setDeleteOrderId(null)}
            >
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={confirmDeleteOrder}>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
