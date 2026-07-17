import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function Novedades() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros idénticos a tu HTML
  const [genderFilter, setGenderFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isNovelty, setIsNovelty] = useState(false);
  const [isPromo, setIsPromo] = useState(false);

  // Notificaciones (Toasts)
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

  // Cargar BD
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargamos categorías y marcas de forma independiente
      const { data: catData } = await supabase.from("categorias").select("*");
      const { data: brandData } = await supabase.from("marcas").select("*");

      // 2. Cargamos productos (sin el .catch)
      const { data: prodsData, error: prodsError } = await supabase
        .from("productos")
        .select(
          "id, nombre, sku, precio, imagenes, is_novelty, is_promo, categoria_id, marca_id, genero"
        )
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (prodsError) throw prodsError;

      if (catData) setCategories(catData);
      if (brandData) setBrands(brandData);
      if (prodsData) setProducts(prodsData);
    } catch (error) {
      showToast(`Error al cargar: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lógica del Modal calcada de tu HTML
  const openModal = (product) => {
    setSelectedProduct(product);
    setIsNovelty(product.is_novelty || false);
    setIsPromo(product.is_promo || false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSave = async () => {
    if (!selectedProduct) return;

    // 1. Actualización visual instantánea (UX)
    setProducts(
      products.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, is_novelty: isNovelty, is_promo: isPromo }
          : p
      )
    );

    // 2. Guardar en Base de Datos
    const { error } = await supabase
      .from("productos")
      .update({ is_novelty: isNovelty, is_promo: isPromo })
      .eq("id", selectedProduct.id);

    if (error) {
      showToast("Error al actualizar.", "error");
      fetchData(); // Si falla, recarga los datos reales
    } else {
      showToast("Configuración guardada.", "success");
    }
    closeModal();
  };

  // Filtros cruzados
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchGender = genderFilter ? p.genero === genderFilter : true;
    const matchCat = categoryFilter ? p.categoria_id === categoryFilter : true;
    const matchBrand = brandFilter ? p.marca_id === brandFilter : true;
    return matchSearch && matchGender && matchCat && matchBrand;
  });

  const selectedCount = products.filter(
    (p) => p.is_novelty || p.is_promo
  ).length;

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

      {/* HEADER IDÉNTICO A ADMIN.HTML */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-title">Novedades y Promociones</div>
            <div className="page-subtitle">
              Selecciona los productos que aparecen en la sección 'Novedades y
              Promociones' del inicio.
            </div>
          </div>
          <div className="page-actions">
            <span
              className="badge badge-blue"
              style={{ fontSize: ".8rem", padding: "6px 16px" }}
            >
              {selectedCount} SELECCIONADOS
            </span>
          </div>
        </div>
      </div>

      <div className="filters-row" style={{ marginBottom: "20px" }}>
        <div className="search-box">
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          style={{ width: "160px" }}
        >
          <option value="">Todos los géneros</option>
          <option value="mujer">Para Mujer</option>
          <option value="hombre">Para Hombre</option>
        </select>
        <select
          className="filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: "200px" }}
        >
          <option value="">Todas las categorías</option>
          {categories
            .filter((c) => (genderFilter ? c.genero === genderFilter : true))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
        <select
          className="filter-select"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          style={{ width: "200px" }}
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* GRILLA IDÉNTICA A ADMIN.HTML */}
      <div className="novelty-grid">
        {loading ? (
          <p
            style={{
              color: "var(--text-muted)",
              gridColumn: "1/-1",
              textAlign: "center",
              padding: "40px",
            }}
          >
            Cargando productos...
          </p>
        ) : filteredProducts.length === 0 ? (
          <p
            style={{
              color: "var(--text-muted)",
              gridColumn: "1/-1",
              textAlign: "center",
              padding: "40px",
            }}
          >
            No se encontraron productos.
          </p>
        ) : (
          filteredProducts.map((p) => {
            const isConfigured = p.is_novelty || p.is_promo;
            return (
              <div className="novelty-card" key={p.id}>
                <img
                  src={
                    p.imagenes?.[0] ||
                    "https://via.placeholder.com/400x500?text=Sin+Imagen"
                  }
                  alt={p.nombre}
                  loading="lazy"
                />
                <div className="novelty-card-body">
                  <h4>{p.nombre}</h4>
                  <p>
                    {p.sku || "Sin SKU"} • Bs {p.precio}
                  </p>
                </div>
                <button
                  className={`novelty-btn ${isConfigured ? "active" : ""}`}
                  onClick={() => openModal(p)}
                >
                  {isConfigured ? (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      CONFIGURADO
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      DESTACAR
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL CONFIGURAR NOVEDADES Y PROMOCIONES */}
      <div className={`modal-overlay ${isModalOpen ? "open" : ""}`}>
        <div className="modal modal-sm">
          <div className="modal-header">
            <h3>Configurar Producto</h3>
            <button className="modal-close" onClick={closeModal}>
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body" style={{ padding: "20px 24px" }}>
            <p
              style={{
                fontSize: ".88rem",
                marginBottom: "20px",
                color: "var(--text-secondary)",
              }}
            >
              {selectedProduct?.nombre}
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: ".95rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isNovelty}
                  onChange={(e) => setIsNovelty(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    accentColor: "#E85D8A",
                  }}
                />
                Aparece en Novedades
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: ".95rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isPromo}
                  onChange={(e) => setIsPromo(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    accentColor: "#E85D8A",
                  }}
                />
                Aparece en Promociones
              </label>
            </div>
          </div>
          <div className="modal-footer" style={{ padding: "16px 24px" }}>
            <button className="btn btn-outline" onClick={closeModal}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              style={{ background: "#E85D8A", borderColor: "#E85D8A" }}
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
