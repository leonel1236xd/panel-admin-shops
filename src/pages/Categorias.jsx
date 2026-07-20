import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

// Función para auto-generar el slug
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

export default function Categorias() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editId, setEditId] = useState(null);

  // Formulario (Removido imagen_url, añadido genero por defecto 'hombre')
  const [formData, setFormData] = useState({
    nombre: "",
    slug: "",
    descripcion: "",
    genero: "hombre",
  });

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

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categorias")
        .select("*, productos(id)")
        .order("nombre");
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter((c) =>
    (c.nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setFormData({ ...formData, nombre: newName, slug: slugify(newName) });
  };

  const openModal = (cat = null) => {
    if (cat) {
      setEditId(cat.id);
      setFormData({
        nombre: cat.nombre,
        slug: cat.slug,
        descripcion: cat.descripcion || "",
        genero: cat.genero || "hombre", // Recupera el género de la BD
      });
    } else {
      setEditId(null);
      setFormData({ nombre: "", slug: "", descripcion: "", genero: "hombre" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim())
      return showToast("El nombre es obligatorio", "error");
    if (!formData.genero) return showToast("El género es obligatorio", "error");

    const payload = {
      nombre: formData.nombre.trim(),
      slug: formData.slug.trim() || slugify(formData.nombre),
      descripcion: formData.descripcion || null,
      genero: formData.genero, // Se guarda el género correctamente
    };

    try {
      // Verificamos si ya existe una categoría con el mismo slug PARA ESE GÉNERO
      // (permite el mismo nombre/slug en hombre y en mujer, pero no repetido
      // dentro del mismo género)
      let dupQuery = supabase
        .from("categorias")
        .select("id")
        .eq("slug", payload.slug)
        .eq("genero", payload.genero);

      if (editId) dupQuery = dupQuery.neq("id", editId);

      const { data: dupData, error: dupError } = await dupQuery;
      if (dupError) throw dupError;

      if (dupData && dupData.length > 0) {
        return showToast(
          `Ya existe una categoría "${formData.nombre}" para ${
            formData.genero === "mujer" ? "Mujer" : "Hombre"
          }`,
          "error"
        );
      }

      if (editId) {
        const { error } = await supabase
          .from("categorias")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
        showToast("Categoría actualizada");
      } else {
        const { error } = await supabase.from("categorias").insert([payload]);
        if (error) throw error;
        showToast("Categoría creada");
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (error) {
      // Traducimos el error de restricción única de Postgres a un mensaje claro
      if (error.code === "23505") {
        showToast(
          `Ya existe una categoría con ese nombre para ${
            formData.genero === "mujer" ? "Mujer" : "Hombre"
          }`,
          "error"
        );
      } else {
        showToast(`Error: ${error.message}`, "error");
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      showToast("Categoría eliminada");
      fetchCategories();
    } catch (error) {
      showToast(
        `Error al eliminar: Verifica que no haya productos usando esta categoría.`,
        "error"
      );
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
            <div className="page-title">Categorías</div>
            <div className="page-subtitle">
              Organiza tus productos en colecciones y jerarquías.
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => openModal()}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva Categoría
            </button>
          </div>
        </div>
      </div>

      {/* ─── FILTROS ─── */}
      <div className="filters-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar categorías..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <span
          style={{
            fontSize: ".82rem",
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          {filteredCategories.length} categorías
        </span>
      </div>

      {/* ─── TABLA ─── */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Género (Tienda)</th>
                <th>Slug</th>
                <th>Productos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No se encontraron categorías
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => (
                  <tr key={c.id}>
                    <td className="td-bold">{c.nombre}</td>
                    <td>
                      {/* Distinción visual rápida del género */}
                      <span
                        className={`badge ${
                          c.genero === "mujer" ? "badge-pink" : "badge-blue"
                        }`}
                        style={
                          c.genero === "mujer"
                            ? {
                                background: "#FCE7F3",
                                color: "#DB2777",
                                borderColor: "#FBCFE8",
                              }
                            : {}
                        }
                      >
                        {c.genero === "mujer"
                          ? "ESTRELLA (Mujer)"
                          : "STAR'S (Varón)"}
                      </span>
                    </td>
                    <td className="td-muted">{c.slug}</td>
                    <td>{c.productos?.length || 0} productos</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn-icon"
                          onClick={() => openModal(c)}
                          title="Editar"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#6B7280"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => setDeleteId(c.id)}
                          title="Eliminar"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL CREAR/EDITAR CATEGORÍA ─── */}
      <div className={`modal-overlay ${isModalOpen ? "open" : ""}`}>
        <div className="modal modal-md">
          <div className="modal-header">
            <h3>{editId ? "Editar Categoría" : "Nueva Categoría"}</h3>
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
          <div className="modal-body">
            <form id="category-form" onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nombre de la Categoría</label>
                <input
                  className="form-input"
                  value={formData.nombre}
                  onChange={handleNameChange}
                  required
                  placeholder="Ej: Jeans Premium"
                />
              </div>

              {/* NUEVO COMBOBOX DE GÉNERO */}
              <div className="form-group">
                <label className="form-label">Género (Tienda)</label>
                <select
                  className="form-select"
                  value={formData.genero}
                  onChange={(e) =>
                    setFormData({ ...formData, genero: e.target.value })
                  }
                  required
                >
                  <option value="hombre">Para Hombre (STAR'S)</option>
                  <option value="mujer">Para Mujer (ESTRELLA)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Slug (URL)</label>
                <input
                  className="form-input"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="jeans-premium"
                />
                <p
                  style={{
                    fontSize: ".68rem",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                  }}
                >
                  Se genera automáticamente del nombre
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  placeholder="Descripción para SEO..."
                ></textarea>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Guardar Categoría
            </button>
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
              ¿Estás seguro de que deseas eliminar esta categoría? Esta acción
              no se puede deshacer.
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