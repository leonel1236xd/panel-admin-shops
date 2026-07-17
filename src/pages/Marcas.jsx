import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

export default function Marcas() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editId, setEditId] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({ nombre: "", slug: "" });

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

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("marcas")
        .select("*")
        .order("nombre");
      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setFormData({ nombre: newName, slug: slugify(newName) });
  };

  const openModal = (brand = null) => {
    if (brand) {
      setEditId(brand.id);
      setFormData({ nombre: brand.nombre, slug: brand.slug });
    } else {
      setEditId(null);
      setFormData({ nombre: "", slug: "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim())
      return showToast("El nombre es obligatorio", "error");

    const payload = {
      nombre: formData.nombre.trim(),
      slug: formData.slug.trim() || slugify(formData.nombre),
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from("marcas")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
        showToast("Marca actualizada");
      } else {
        const { error } = await supabase.from("marcas").insert([payload]);
        if (error) throw error;
        showToast("Marca creada");
      }
      setIsModalOpen(false);
      fetchBrands();
    } catch (error) {
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("marcas")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      showToast("Marca eliminada");
      fetchBrands();
    } catch (error) {
      showToast(`Error al eliminar: Verifica que no esté en uso.`, "error");
    } finally {
      setDeleteId(null);
    }
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

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">Marcas</div>
            <div className="page-subtitle">
              Gestiona las marcas de tus productos.
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
              Nueva Marca
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Slug</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="3"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Cargando...
                  </td>
                </tr>
              ) : brands.length === 0 ? (
                <tr>
                  <td
                    colSpan="3"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No hay marcas
                  </td>
                </tr>
              ) : (
                brands.map((b) => (
                  <tr key={b.id}>
                    <td className="td-bold">{b.nombre}</td>
                    <td className="td-muted">{b.slug}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn-icon"
                          onClick={() => openModal(b)}
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
                          onClick={() => setDeleteId(b.id)}
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

      {/* MODAL CREAR/EDITAR MARCA */}
      <div className={`modal-overlay ${isModalOpen ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>{editId ? "Editar Marca" : "Nueva Marca"}</h3>
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
            <form id="brand-form" onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nombre de la Marca</label>
                <input
                  className="form-input"
                  value={formData.nombre}
                  onChange={handleNameChange}
                  required
                  placeholder="Ej: STAR OIL"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug</label>
                <input
                  className="form-input"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="star-oil"
                />
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
              Guardar Marca
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
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
              ¿Estás seguro de que deseas eliminar esta marca? Esta acción no se
              puede deshacer.
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
