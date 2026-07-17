import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ─── NUEVOS ESTADOS PARA GESTIÓN ───
  const [catalog, setCatalog] = useState([]); // Todo el catálogo de productos y variantes
  const [localStock, setLocalStock] = useState([]); // El stock específico de la sucursal abierta
  const [empleados, setEmpleados] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
    nombre: "",
    rol: "Vendedor",
  });

  // Modales y Pestañas
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("datos");

  // Formulario Completo Original
  const initialFormState = {
    nombre: "",
    tipo: "tienda",
    ciudad: "Cochabamba",
    nit: "",
    direccion: "",
    whatsapp: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    logo: "",
    estado: "ACTIVO",
    horario_atencion: "Lun - Sáb: 9:00 AM - 7:00 PM | Dom: 10:00 AM - 4:00 PM",
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
    envios: "Cochabamba y toda Bolivia",
  };
  const [formData, setFormData] = useState(initialFormState);

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
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Sucursales
      const { data: sucs, error: sucsErr } = await supabase
        .from("sucursales")
        .select("*")
        .order("created_at", { ascending: true });
      if (sucsErr) throw sucsErr;
      setSucursales(sucs || []);

      // 2. Cargar Catálogo (Productos activos y sus variantes)
      const { data: prods } = await supabase
        .from("productos")
        .select("id, nombre, imagenes, variantes(id, color, talla)")
        .eq("estado", "activo");
      setCatalog(prods || []);
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSucursales = sucursales.filter(
    (s) =>
      (s.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.ciudad || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── ABRIR MODAL Y CARGAR INVENTARIO/EMPLEADOS ───
  const openModal = async (sucursal = null, viewOnly = false) => {
    setIsViewOnly(viewOnly);
    setActiveTab("datos");

    if (sucursal) {
      setEditId(sucursal.id);
      setFormData({
        nombre: sucursal.nombre || "",
        tipo: sucursal.tipo || "tienda",
        ciudad: sucursal.ciudad || "Cochabamba",
        nit: sucursal.nit || "",
        direccion: sucursal.direccion || "",
        whatsapp: sucursal.whatsapp || "",
        facebook: sucursal.facebook || "",
        instagram: sucursal.instagram || "",
        tiktok: sucursal.tiktok || "",
        logo: sucursal.logo || "",
        estado: sucursal.estado || "ACTIVO",
        horario_atencion: sucursal.horario_atencion || "",
        facebook_url: sucursal.facebook_url || "",
        instagram_url: sucursal.instagram_url || "",
        tiktok_url: sucursal.tiktok_url || "",
        envios: sucursal.envios || "",
      });

      // Cargar el stock físico y los empleados de ESTA sucursal
      const { data: stockData } = await supabase
        .from("inventario_sucursales")
        .select("*")
        .eq("sucursal_id", sucursal.id);
      setLocalStock(stockData || []);

      const { data: empData } = await supabase
        .from("empleados")
        .select("*")
        .eq("sucursal_id", sucursal.id);
      setEmpleados(empData || []);
    } else {
      setEditId(null);
      setFormData(initialFormState);
      setLocalStock([]);
      setEmpleados([]);
    }
    setIsModalOpen(true);
  };

  // ─── LÓGICA MÁGICA DE INVENTARIO ───
  const updateLocalStock = async (productoId, varianteId, delta) => {
    if (!editId) return; // Solo si la sucursal ya está creada

    // Buscar cuánto stock tiene ahorita
    const currentItem = localStock.find(
      (item) => item.variante_id === varianteId
    );
    const currentQty = currentItem ? currentItem.stock_local : 0;
    const newQty = Math.max(0, currentQty + delta); // Evitar que el stock baje de 0

    // 1. Actualización visual instantánea (UX Perfecta)
    setLocalStock((prev) => {
      const exists = prev.find((p) => p.variante_id === varianteId);
      if (exists)
        return prev.map((p) =>
          p.variante_id === varianteId ? { ...p, stock_local: newQty } : p
        );
      return [
        ...prev,
        {
          sucursal_id: editId,
          producto_id: productoId,
          variante_id: varianteId,
          stock_local: newQty,
        },
      ];
    });

    // 2. Guardado en Base de Datos (Upsert)
    const { error } = await supabase.from("inventario_sucursales").upsert(
      {
        sucursal_id: editId,
        producto_id: productoId,
        variante_id: varianteId,
        stock_local: newQty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sucursal_id,variante_id" }
    );

    if (error) {
      showToast("Error al actualizar stock", "error");
      // Podríamos revertir el estado aquí si falla, pero para mantenerlo ágil, solo avisamos.
    }
  };

  const setExactLocalStock = async (productoId, varianteId, newValue) => {
    if (!editId) return;
    const parsedValue = Math.max(0, parseInt(newValue) || 0); // Evita números negativos o vacíos

    // 1. Actualización visual instantánea
    setLocalStock((prev) => {
      const exists = prev.find((p) => p.variante_id === varianteId);
      if (exists)
        return prev.map((p) =>
          p.variante_id === varianteId ? { ...p, stock_local: parsedValue } : p
        );
      return [
        ...prev,
        {
          sucursal_id: editId,
          producto_id: productoId,
          variante_id: varianteId,
          stock_local: parsedValue,
        },
      ];
    });

    // 2. Guardado en la BD
    await supabase.from("inventario_sucursales").upsert(
      {
        sucursal_id: editId,
        producto_id: productoId,
        variante_id: varianteId,
        stock_local: parsedValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sucursal_id,variante_id" }
    );
  };

  const addEmployee = async () => {
    if (!newEmployee.nombre.trim())
      return showToast("Ingresa el nombre del empleado", "error");

    const { data, error } = await supabase
      .from("empleados")
      .insert({
        sucursal_id: editId,
        nombre: newEmployee.nombre,
        rol: newEmployee.rol,
      })
      .select();

    if (error) {
      showToast("Error al asignar empleado", "error");
    } else if (data) {
      setEmpleados([...empleados, data[0]]);
      setNewEmployee({ nombre: "", rol: "Vendedor" });
      showToast("Empleado asignado");
    }
  };

  const removeEmployee = async (id) => {
    const { error } = await supabase.from("empleados").delete().eq("id", id);
    if (error) {
      showToast("Error al eliminar empleado", "error");
    } else {
      setEmpleados(empleados.filter((emp) => emp.id !== id));
      showToast("Empleado eliminado");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isViewOnly) return setIsModalOpen(false);
    if (!formData.nombre.trim())
      return showToast("El nombre es obligatorio", "error");

    try {
      if (editId) {
        const { error } = await supabase
          .from("sucursales")
          .update(formData)
          .eq("id", editId);
        if (error) throw error;
        showToast("Tienda actualizada correctamente");
      } else {
        const { error } = await supabase.from("sucursales").insert([formData]);
        if (error) throw error;
        showToast("Nueva tienda registrada");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("sucursales")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      showToast("Tienda eliminada");
      fetchData();
    } catch (error) {
      showToast(`Error al eliminar.`, "error");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      {/* ─── TOASTS ─── */}
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
            <div className="page-breadcrumb">ADMINISTRACIÓN / SUCURSALES</div>
            <div className="page-title">Tiendas</div>
            <div className="page-subtitle">
              Gestiona los diferentes puntos de venta y almacenes.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => openModal()}
            style={{
              background: "#0084E6",
              borderColor: "#0084E6",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>+</span>{" "}
            AGREGAR TIENDA
          </button>
        </div>
      </div>

      <div className="filters-row" style={{ marginBottom: "24px" }}>
        <div className="search-box" style={{ flex: 1, maxWidth: "600px" }}>
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ─── DISEÑO ORIGINAL DE TARJETAS RESTAURADO ─── */}
      {loading ? (
        <p
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-muted)",
          }}
        >
          Cargando sucursales...
        </p>
      ) : filteredSucursales.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-muted)",
          }}
        >
          No se encontraron resultados.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {filteredSucursales.map((s) => (
            <div
              key={s.id}
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  padding: "24px",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      backgroundColor: "#EFF6FF" /* Fondo azul clarito */,
                      color: "#0084E6" /* Color de la letra */,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      fontWeight: "bold",
                      overflow: "hidden",
                      border: "1px solid #E5E7EB",
                      flexShrink: 0,
                    }}
                  >
                    {s.logo ? (
                      <img
                        src={s.logo}
                        alt={s.nombre}
                        onError={(e) => {
                          // Si el enlace existe pero está roto, ocultamos la imagen y mostramos la inicial
                          e.target.style.display = "none";
                          e.target.parentNode.innerText = s.nombre
                            ? s.nombre.charAt(0).toUpperCase()
                            : "T";
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : // Si no hay logo, mostramos la primera letra del nombre
                    s.nombre ? (
                      s.nombre.charAt(0).toUpperCase()
                    ) : (
                      "T"
                    )}
                  </div>
                  {s.estado === "ACTIVO" ? (
                    <span
                      style={{
                        background: "#DEF7EC",
                        color: "#03543F",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontWeight: 800,
                        fontSize: "0.7rem",
                      }}
                    >
                      ACTIVO
                    </span>
                  ) : (
                    <span
                      style={{
                        background: "#FDE8E8",
                        color: "#9B1C1C",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontWeight: 800,
                        fontSize: "0.7rem",
                      }}
                    >
                      INACTIVO
                    </span>
                  )}
                </div>
                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  {s.nombre}
                </h3>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {s.ciudad} {s.direccion ? `- ${s.direccion}` : ""}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    background: "#F3F4F6",
                    color: "#4B5563",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {s.tipo.toUpperCase()}
                </span>
              </div>

              <div style={{ padding: "20px 24px", flexGrow: 1 }}>
                <div
                  style={{ display: "flex", gap: "16px", marginBottom: "20px" }}
                >
                  {s.whatsapp && (
                    <a
                      href={`https://wa.me/${s.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#10B981" }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </a>
                  )}
                  {s.facebook_url && (
                    <a
                      href={s.facebook_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#3B82F6" }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                      </svg>
                    </a>
                  )}
                  {s.instagram_url && (
                    <a
                      href={s.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#E85D8A" }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="20"
                          height="20"
                          rx="5"
                          ry="5"
                        />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                      </svg>
                    </a>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  <p style={{ margin: "0 0 8px", display: "flex", gap: "8px" }}>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ lineHeight: 1.4 }}>
                      <strong>Horarios:</strong>
                      <br />
                      {s.horario_atencion}
                    </span>
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div
                style={{
                  padding: "16px 24px",
                  background: "#F9FAFB",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <button
                  onClick={() => openModal(s)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "6px",
                    color: "var(--text-primary)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Administrar
                </button>
                <button
                  onClick={() => setDeleteId(s.id)}
                  style={{
                    padding: "10px 14px",
                    background: "#fff",
                    border: "1px solid #FECACA",
                    color: "#EF4444",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL TIPO PESTAÑAS (TABS) ─── */}
      <div className={`modal-overlay ${isModalOpen ? "open" : ""}`}>
        <div
          className="modal modal-lg"
          style={{
            maxWidth: "800px",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh",
          }}
        >
          <div className="modal-header">
            <h3>
              {isViewOnly
                ? "Datos de Tienda"
                : editId
                ? "Gestión de Tienda"
                : "Nueva Tienda"}
            </h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => setIsModalOpen(false)}
            >
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            className="modal-body"
            style={{ flexGrow: 1, overflowY: "auto", padding: "24px" }}
          >
            {/* MENÚ DE PESTAÑAS (Solo visible si ya se creó la tienda) */}
            {editId && (
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  borderBottom: "2px solid var(--border)",
                  marginBottom: "24px",
                }}
              >
                <button
                  onClick={() => setActiveTab("datos")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "10px 4px",
                    cursor: "pointer",
                    fontWeight: activeTab === "datos" ? 800 : 500,
                    color:
                      activeTab === "datos"
                        ? "#0084E6"
                        : "var(--text-secondary)",
                    borderBottom:
                      activeTab === "datos"
                        ? "3px solid #0084E6"
                        : "3px solid transparent",
                    marginBottom: "-2px",
                  }}
                >
                  Datos Generales
                </button>
                <button
                  onClick={() => setActiveTab("inventario")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "10px 4px",
                    cursor: "pointer",
                    fontWeight: activeTab === "inventario" ? 800 : 500,
                    color:
                      activeTab === "inventario"
                        ? "#0084E6"
                        : "var(--text-secondary)",
                    borderBottom:
                      activeTab === "inventario"
                        ? "3px solid #0084E6"
                        : "3px solid transparent",
                    marginBottom: "-2px",
                  }}
                >
                  Inventario Local
                </button>
                <button
                  onClick={() => setActiveTab("empleados")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "10px 4px",
                    cursor: "pointer",
                    fontWeight: activeTab === "empleados" ? 800 : 500,
                    color:
                      activeTab === "empleados"
                        ? "#0084E6"
                        : "var(--text-secondary)",
                    borderBottom:
                      activeTab === "empleados"
                        ? "3px solid #0084E6"
                        : "3px solid transparent",
                    marginBottom: "-2px",
                  }}
                >
                  Empleados
                </button>
              </div>
            )}

            {/* PESTAÑA 1: DATOS */}
            {activeTab === "datos" && (
              <form id="sucursal-form" onSubmit={handleSave}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Nombre *
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      required
                      placeholder="Nombre de la tienda"
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Tipo *
                    </label>
                    <select
                      className="form-select"
                      disabled={isViewOnly}
                      required
                      value={formData.tipo}
                      onChange={(e) =>
                        setFormData({ ...formData, tipo: e.target.value })
                      }
                    >
                      <option value="tienda">Tienda (Principal)</option>
                      <option value="almacen">Almacén / Secundaria</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      NIT
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="Ej: 987654321"
                      value={formData.nit}
                      onChange={(e) =>
                        setFormData({ ...formData, nit: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Ciudad
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="Ej: Cochabamba"
                      value={formData.ciudad}
                      onChange={(e) =>
                        setFormData({ ...formData, ciudad: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Dirección
                  </label>
                  <input
                    className="form-input"
                    disabled={isViewOnly}
                    placeholder="Ej: Av. Ayacucho Esq. Heroinas"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Horarios de Atención
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="Lun - Sáb: 9:00 AM..."
                      value={formData.horario_atencion}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          horario_atencion: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Envíos
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="Cochabamba y toda Bolivia"
                      value={formData.envios}
                      onChange={(e) =>
                        setFormData({ ...formData, envios: e.target.value })
                      }
                    />
                  </div>
                </div>

                <h4
                  style={{
                    margin: "24px 0 16px",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "8px",
                    fontSize: "1rem",
                  }}
                >
                  Redes Sociales
                </h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">WhatsApp (Número)</label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="Ej: 59165432100"
                      value={formData.whatsapp}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsapp: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Facebook (URL completa)
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="https://facebook.com/..."
                      value={formData.facebook_url}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facebook_url: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Instagram (URL completa)
                    </label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="https://instagram.com/..."
                      value={formData.instagram_url}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          instagram_url: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">TikTok (URL completa)</label>
                    <input
                      className="form-input"
                      disabled={isViewOnly}
                      placeholder="https://tiktok.com/@..."
                      value={formData.tiktok_url}
                      onChange={(e) =>
                        setFormData({ ...formData, tiktok_url: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label">Logo (URL de imagen)</label>
                  <input
                    className="form-input"
                    disabled={isViewOnly}
                    placeholder="https://miservidor.com/logo.jpg"
                    value={formData.logo}
                    onChange={(e) =>
                      setFormData({ ...formData, logo: e.target.value })
                    }
                  />
                </div>

                <div
                  className="form-group"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "24px",
                    padding: "16px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <input
                    type="checkbox"
                    id="suc-activo-check"
                    disabled={isViewOnly}
                    checked={formData.estado === "ACTIVO"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estado: e.target.checked ? "ACTIVO" : "INACTIVO",
                      })
                    }
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label
                    htmlFor="suc-activo-check"
                    style={{
                      fontWeight: 700,
                      cursor: "pointer",
                      userSelect: "none",
                      margin: 0,
                    }}
                  >
                    Sucursal Activa y visible
                  </label>
                </div>
              </form>
            )}

            {/* PESTAÑA 2: INVENTARIO DINÁMICO */}
            {activeTab === "inventario" && (
              <div>
                <div
                  style={{
                    background: "#EFF6FF",
                    color: "#1E3A8A",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>Aviso:</strong> Aquí ajustas el stock físico exclusivo
                  de <strong>{formData.nombre}</strong>. Usa los botones + / -
                  para actualizar en tiempo real.
                </div>
                <div className="table-wrap">
                  <table>
                    <thead style={{ background: "#F3F4F6" }}>
                      <tr>
                        <th style={{ padding: "10px 14px" }}>Producto</th>
                        <th style={{ padding: "10px 14px" }}>
                          Variante (Color / Talla)
                        </th>
                        <th
                          style={{ textAlign: "center", padding: "10px 14px" }}
                        >
                          Stock Local
                        </th>
                        <th
                          style={{ textAlign: "center", padding: "10px 14px" }}
                        >
                          Ajustar
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.map((prod) =>
                        prod.variantes?.map((vari) => {
                          // Busca si esta variante ya tiene stock registrado para esta sucursal
                          const stockRecord = localStock.find(
                            (s) => s.variante_id === vari.id
                          );
                          const qty = stockRecord ? stockRecord.stock_local : 0;

                          return (
                            <tr key={vari.id}>
                              <td
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "10px 14px",
                                }}
                              >
                                <img
                                  src={
                                    prod.imagenes?.[0] ||
                                    "https://via.placeholder.com/30"
                                  }
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                  }}
                                  alt=""
                                />
                                <span className="td-bold">{prod.nombre}</span>
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <span
                                  style={{
                                    background: "#F3F4F6",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    marginRight: "6px",
                                  }}
                                >
                                  {vari.color}
                                </span>
                                <span
                                  style={{
                                    background: "#E5E7EB",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  Talla {vari.talla}
                                </span>
                              </td>
                              <td
                                style={{
                                  textAlign: "center",
                                  fontWeight: 800,
                                  fontSize: "1.1rem",
                                  color: qty > 0 ? "#10B981" : "#EF4444",
                                }}
                              >
                                {qty}
                              </td>
                              {/* 1. Celda del Input Directo */}
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="number"
                                  value={qty === 0 ? "" : qty}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setExactLocalStock(
                                      prod.id,
                                      vari.id,
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    width: "60px",
                                    height: "34px",
                                    textAlign: "center",
                                    fontWeight: 800,
                                    fontSize: "1.1rem",
                                    color: qty > 0 ? "#10B981" : "#EF4444",
                                    border: "1px solid var(--border)",
                                    borderRadius: "6px",
                                    outline: "none",
                                  }}
                                />
                              </td>

                              {/* 2. Celda de los botones +/- */}
                              <td
                                style={{
                                  textAlign: "center",
                                  padding: "10px 14px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLocalStock(prod.id, vari.id, -1)
                                    }
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      borderRadius: "6px",
                                      border: "1px solid var(--border)",
                                      background: "#fff",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 800,
                                    }}
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLocalStock(prod.id, vari.id, 1)
                                    }
                                    style={{
                                      width: "30px",
                                      height: "30px",
                                      borderRadius: "6px",
                                      border: "1px solid var(--border)",
                                      background: "#fff",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 800,
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PESTAÑA 3: EMPLEADOS (Próximo paso) */}
            {activeTab === "empleados" && (
              <div>
                <div
                  style={{
                    background: "#F9FAFB",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    marginBottom: "20px",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nombre del empleado..."
                    className="form-input"
                    style={{ flex: 1 }}
                    value={newEmployee.nombre}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, nombre: e.target.value })
                    }
                  />
                  <select
                    className="form-select"
                    style={{ width: "180px" }}
                    value={newEmployee.rol}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, rol: e.target.value })
                    }
                  >
                    <option value="Vendedor">Vendedor</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Almacenero">Almacenero</option>
                    <option value="Gerente">Gerente</option>
                  </select>
                  <button
                    type="button"
                    onClick={addEmployee}
                    className="btn btn-primary"
                    style={{ background: "#0084E6", borderColor: "#0084E6" }}
                  >
                    Asignar
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre del Empleado</th>
                        <th>Rol</th>
                        <th style={{ textAlign: "center" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empleados.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            style={{
                              textAlign: "center",
                              padding: "30px",
                              color: "var(--text-muted)",
                            }}
                          >
                            No hay empleados asignados a esta sucursal.
                          </td>
                        </tr>
                      ) : (
                        empleados.map((emp) => (
                          <tr key={emp.id}>
                            <td className="td-bold">{emp.nombre}</td>
                            <td>
                              <span
                                style={{
                                  background: "#E5E7EB",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                }}
                              >
                                {emp.rol}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                onClick={() => removeEmployee(emp.id)}
                                style={{
                                  color: "#EF4444",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              {isViewOnly ? "Cerrar" : "Cancelar"}
            </button>
            {!isViewOnly && activeTab === "datos" && (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ background: "#0084E6", borderColor: "#0084E6" }}
              >
                Guardar Datos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL CONFIRMACIÓN ELIMINAR ─── */}
      <div className={`modal-overlay ${deleteId ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Confirmar Eliminación</h3>
            <button className="modal-close" onClick={() => setDeleteId(null)}>
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: ".88rem", color: "var(--text-secondary)" }}>
              ¿Estás seguro de que deseas eliminar esta tienda permanentemente?
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setDeleteId(null)}
            >
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
