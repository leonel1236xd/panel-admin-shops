import { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabase";
import imageCompression from "browser-image-compression";

export default function Products({ gender = "hombre" }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // SISTEMA DE NOTIFICACIONES (TOASTS)
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

  // FILTROS DE LA TABLA
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // ESTADO DEL MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState(null); // Para saber si estamos editando
  const [deleteId, setDeleteId] = useState(null); // Guarda el ID del producto a eliminar
  const [deleteImages, setDeleteImages] = useState([]); // Guarda las imágenes del producto a eliminar

  // ESTADOS DEL FORMULARIO
  const [formData, setFormData] = useState({
    nombre: "",
    sku: "",
    precio: "",
    categoria_id: "",
    marca_id: "",
    estado: "activo",
    descripcion: "",
  });

  // ESTADOS DE IMÁGENES
  const [imageFiles, setImageFiles] = useState([]); // Nuevas fotos a subir
  const [existingImages, setExistingImages] = useState([]); // Fotos que ya venían de la BD
  const [imagePreviews, setImagePreviews] = useState([]); // Para mostrar en el UI
  const fileInputRef = useRef(null);

  // ─── ESTADOS DE LA MATRIZ DE VARIANTES ───
  const [sizeType, setSizeType] = useState("jeans");
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [dropdownColor, setDropdownColor] = useState("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [variantsMatrix, setVariantsMatrix] = useState([]);

  const jeansSizes = [
    "28",
    "30",
    "32",
    "34",
    "36",
    "38",
    "40",
    "42",
    "44",
    "46",
    "48",
    "50",
    "52",
    "54",
  ];
  const shirtsSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

  // 1. CARGAR DATOS
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Categorías
      const { data: catData, error: catError } = await supabase
        .from("categorias")
        .select("*")
        .eq("genero", gender);
      if (!catError && catData) setCategories(catData);

      // 2. Cargar Marcas (Sintaxis corregida de Supabase sin el .catch)
      const { data: brandData, error: brandError } = await supabase
        .from("marcas")
        .select("*");
      if (brandError) {
        console.warn(
          "Advertencia: No se encontraron marcas o la tabla no existe.",
          brandError.message
        );
        setBrands([]);
      } else {
        setBrands(brandData || []);
      }

      // 3. Cargar Productos y Variantes
      const { data: prodData, error: prodError } = await supabase
        .from("productos")
        .select(
          "*, categorias(nombre), variantes(stock_global, color, color_hex, talla)"
        )
        .eq("genero", gender)
        .order("created_at", { ascending: false });

      if (prodError) throw prodError;
      setProducts(prodData || []);
    } catch (error) {
      showToast(`Error al cargar datos: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [gender]);

  // FILTRADO DINÁMICO
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory
      ? p.categoria_id === selectedCategory
      : true;
    const matchesStatus = selectedStatus ? p.estado === selectedStatus : true;
    return matchesSearch && matchesCat && matchesStatus;
  });

  // --- LÓGICA DE TABLA: VISIBILIDAD, ELIMINAR, EDITAR ---
  const toggleVisibility = async (id, currentVisible) => {
    const newVisible = !currentVisible;
    const { error } = await supabase
      .from("productos")
      .update({ visible: newVisible })
      .eq("id", id);
    if (error) {
      showToast("Error al cambiar visibilidad", "error");
    } else {
      showToast(newVisible ? "Producto visible" : "Producto oculto", "success");
      fetchData();
    }
  };

  // 1. Solo abre el modal guardando el ID y las imágenes del producto
  const handleDelete = (id, imagenes = []) => {
    setDeleteId(id);
    setDeleteImages(imagenes || []);
  };

  // Extrae el path dentro del bucket a partir de la URL pública guardada en BD
  // Ej: https://xxxx.supabase.co/storage/v1/object/public/productos_imagenes/hombre/123-foto.jpg
  // -> hombre/123-foto.jpg
  const getStoragePathFromUrl = (url) => {
    const marker = "/productos_imagenes/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  };

  // 2. Ejecuta la eliminación real (Este es tu código anterior adaptado)
  const confirmDelete = async () => {
    if (!deleteId) return;

    // Borrar imágenes del bucket ANTES de borrar el registro, así si algo
    // falla en storage no perdemos la referencia (el producto sigue existiendo)
    if (deleteImages.length > 0) {
      const paths = deleteImages
        .map((url) => getStoragePathFromUrl(url))
        .filter(Boolean);

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("productos_imagenes")
          .remove(paths);

        if (storageError) {
          // No detenemos el flujo: igual eliminamos el producto,
          // pero avisamos para que se pueda limpiar manualmente si hace falta
          console.error("Error al eliminar imágenes del storage:", storageError);
          showToast(
            "Producto eliminado, pero hubo un problema al borrar sus imágenes del storage",
            "error"
          );
        }
      }
    }

    await supabase.from("variantes").delete().eq("producto_id", deleteId);
    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", deleteId);

    if (error) {
      showToast("Error al eliminar producto", "error");
    } else {
      showToast("Producto eliminado correctamente", "success");
      fetchData();
    }
    setDeleteId(null); // Cierra el modal
    setDeleteImages([]);
  };

  const handleEdit = (product) => {
    setEditId(product.id);
    setFormData({
      nombre: product.nombre,
      sku: product.sku || "",
      precio: product.precio,
      categoria_id: product.categoria_id || "",
      marca_id: product.marca_id || "",
      estado: product.estado,
      descripcion: product.descripcion || "",
    });

    // Cargar Imágenes
    const imgs = product.imagenes || [];
    setExistingImages(imgs);
    setImagePreviews(imgs);
    setImageFiles([]); // Reseteamos archivos nuevos

    // Cargar Matriz
    if (product.variantes && product.variantes.length > 0) {
      setVariantsMatrix(product.variantes);

      const cMap = {};
      const sSet = new Set();
      product.variantes.forEach((v) => {
        cMap[v.color] = v.color_hex;
        sSet.add(v.talla);
      });

      setSelectedColors(
        Object.keys(cMap).map((k) => ({ name: k, hex: cMap[k] }))
      );
      setSelectedSizes([...sSet]);
      setSizeType(
        [...sSet].some((s) => shirtsSizes.includes(s)) ? "shirts" : "jeans"
      );
    }

    setIsModalOpen(true);
  };

  // --- LÓGICA DE IMÁGENES ---
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (imageFiles.length + existingImages.length + files.length > 6) {
      return showToast("Máximo 6 imágenes en total.", "error");
    }
    setImageFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (indexToRemove) => {
    // Si la imagen a borrar es de las que ya existían (URLs)
    if (indexToRemove < existingImages.length) {
      setExistingImages((prev) =>
        prev.filter((_, idx) => idx !== indexToRemove)
      );
    } else {
      // Si es de los archivos nuevos subidos ahora
      const newFilesIndex = indexToRemove - existingImages.length;
      setImageFiles((prev) => prev.filter((_, idx) => idx !== newFilesIndex));
    }

    setImagePreviews((prev) => {
      const removed = prev[indexToRemove];
      if (removed.startsWith("blob:")) URL.revokeObjectURL(removed);
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  // --- LÓGICA DE VARIANTES (Colores y Tallas) ---
  const toggleSize = (size) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const addColorFromDropdown = () => {
    if (!dropdownColor) return;
    const [name, hex] = dropdownColor.split(":");
    if (!selectedColors.find((c) => c.name === name))
      setSelectedColors([...selectedColors, { name, hex }]);
    setDropdownColor("");
  };

  const addCustomColor = () => {
    if (!customColorName.trim())
      return showToast("Ingresa el nombre del color.", "error");
    if (
      !selectedColors.find(
        (c) => c.name.toLowerCase() === customColorName.toLowerCase()
      )
    ) {
      setSelectedColors([
        ...selectedColors,
        { name: customColorName.trim(), hex: customColorHex },
      ]);
    }
    setCustomColorName("");
  };

  const removeColor = (nameToRemove) => {
    setSelectedColors(selectedColors.filter((c) => c.name !== nameToRemove));
  };

  const handleGenerateMatrix = () => {
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      return showToast("Selecciona al menos un color y una talla.", "error");
    }
    const newMatrix = [];
    selectedColors.forEach((colorObj) => {
      selectedSizes.forEach((size) => {
        newMatrix.push({
          color: colorObj.name,
          color_hex: colorObj.hex,
          talla: size,
          stock_global: 0,
        });
      });
    });
    setVariantsMatrix(newMatrix);
  };

  const handleMatrixStockChange = (index, val) => {
    const newMatrix = [...variantsMatrix];
    newMatrix[index].stock_global = Number(val);
    setVariantsMatrix(newMatrix);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({
      nombre: "",
      sku: "",
      precio: "",
      categoria_id: "",
      marca_id: "",
      estado: "activo",
      descripcion: "",
    });
    setImageFiles([]);
    setExistingImages([]);
    setImagePreviews([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setVariantsMatrix([]);
  };

  // --- GUARDAR EN BD ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ─── VALIDACIONES DE CAMPOS OBLIGATORIOS ───
    if (!formData.nombre.trim())
      return showToast("Ingresa el nombre del producto.", "error");

    if (!formData.sku.trim())
      return showToast("Ingresa el SKU del producto.", "error");

    if (
      formData.precio === "" ||
      formData.precio === null ||
      isNaN(Number(formData.precio))
    )
      return showToast("Ingresa un precio válido para el producto.", "error");

    if (Number(formData.precio) <= 0)
      return showToast("El precio debe ser mayor a 0.", "error");

    if (!formData.categoria_id)
      return showToast("Selecciona una categoría.", "error");

    if (!formData.marca_id)
      return showToast("Selecciona una marca.", "error");

    if (variantsMatrix.length === 0)
      return showToast(
        "Genera la tabla de stock e ingresa cantidades.",
        "error"
      );
    if (imageFiles.length === 0 && existingImages.length === 0)
      return showToast("Debes incluir al menos una imagen.", "error");

    setUploading(true);
    try {
      const finalImageUrls = [...existingImages]; // Mantener las que ya estaban

      // Subir solo las nuevas
      for (const file of imageFiles) {
        const options = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        const fileName = `${Date.now()}-${compressedFile.name.replace(
          /\s+/g,
          "-"
        )}`;
        const filePath = `${gender}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("productos_imagenes")
          .upload(filePath, compressedFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("productos_imagenes").getPublicUrl(filePath);
        finalImageUrls.push(publicUrl);
      }

      const payload = {
        nombre: formData.nombre.trim(),
        sku: formData.sku.trim(),
        precio: Number(formData.precio),
        categoria_id: formData.categoria_id,
        marca_id: formData.marca_id,
        estado: formData.estado,
        descripcion: formData.descripcion || null,
        genero: gender,
        imagenes: finalImageUrls,
        visible: formData.estado === "activo",
      };

      let productId = editId;

      if (editId) {
        // ACTUALIZAR PRODUCTO EXISTENTE
        const { error: updateError } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", editId);
        if (updateError) throw updateError;

        // Refrescar variantes: Borrar viejas y meter nuevas
        await supabase.from("variantes").delete().eq("producto_id", editId);
        const variantsToInsert = variantsMatrix.map((v) => ({
          producto_id: editId,
          color: v.color,
          color_hex: v.color_hex,
          talla: v.talla,
          stock_global: v.stock_global,
        }));
        await supabase.from("variantes").insert(variantsToInsert);

        showToast("Producto actualizado exitosamente.", "success");
      } else {
        // INSERTAR NUEVO PRODUCTO
        const { data: newProduct, error: insertError } = await supabase
          .from("productos")
          .insert([payload])
          .select()
          .single();
        if (insertError) throw insertError;
        productId = newProduct.id;

        const variantsToInsert = variantsMatrix.map((v) => ({
          producto_id: productId,
          color: v.color,
          color_hex: v.color_hex,
          talla: v.talla,
          stock_global: v.stock_global,
        }));
        await supabase.from("variantes").insert(variantsToInsert);

        showToast("Producto registrado exitosamente.", "success");
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error Detallado:", error);
      if (error.code === "23505" && error.message?.includes("sku")) {
        showToast(
          `Ya existe un producto con el SKU "${formData.sku.trim()}". Usa uno diferente.`,
          "error"
        );
      } else {
        showToast(`Error: ${error.message}`, "error");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* --- SISTEMA DE TOAST NOTIFICATIONS --- */}
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

      {/* HEADER */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div className="page-breadcrumb">
              CATÁLOGO / {gender === "hombre" ? "VARÓN" : "MUJER"}
            </div>
            <div className="page-title">
              Productos {gender === "hombre" ? "Varón" : "Mujer"}
            </div>
            <div className="page-subtitle">
              Gestiona tu catálogo de productos.
            </div>
          </div>
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditId(null);
                setIsModalOpen(true);
              }}
              style={
                gender === "mujer"
                  ? { background: "#E85D8A", borderColor: "#E85D8A" }
                  : {}
              }
            >
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
              Nuevo Producto
            </button>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filters-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>

      {/* TABLA */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "50px" }}></th>
                <th>Producto</th>
                <th>SKU</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Visible</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Cargando...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalStock =
                    p.variantes?.reduce((acc, v) => acc + v.stock_global, 0) ||
                    0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <img
                          src={
                            p.imagenes?.[0] || "https://via.placeholder.com/44"
                          }
                          alt={p.nombre}
                          className="td-thumb"
                        />
                      </td>
                      <td>
                        <div className="td-bold">{p.nombre}</div>
                        <div className="td-muted">
                          Stock: {totalStock} unds.
                        </div>
                      </td>
                      <td className="td-muted">{p.sku || "—"}</td>
                      <td>{p.categorias?.nombre || "—"}</td>
                      <td className="td-bold">Bs {p.precio}</td>
                      <td>
                        <span
                          className={`badge ${
                            p.estado === "activo" ? "badge-green" : "badge-gray"
                          }`}
                        >
                          {p.estado === "activo" ? "Activo" : "Archivado"}
                        </span>
                      </td>
                      <td>
                        {p.visible ? (
                          <button
                            className="btn-prod-visible is-visible"
                            onClick={() => toggleVisibility(p.id, p.visible)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "2px",
                              }}
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>{" "}
                            Visible
                          </button>
                        ) : (
                          <button
                            className="btn-prod-visible is-hidden"
                            onClick={() => toggleVisibility(p.id, p.visible)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{
                                width: "14px",
                                height: "14px",
                                marginRight: "2px",
                              }}
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>{" "}
                            Oculto
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn-icon"
                            title="Editar"
                            onClick={() => handleEdit(p)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              width="16"
                              height="16"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() => handleDelete(p.id, p.imagenes)}
                            style={{ color: "var(--red)" }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              width="16"
                              height="16"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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

      {/* MODAL DE REGISTRO / EDICIÓN */}
      <div className={`modal-overlay ${isModalOpen ? "open" : ""}`}>
        <div className="modal modal-xl">
          <div className="modal-header">
            <h3>{editId ? "Editar Producto" : "Nuevo Producto"}</h3>
            <button type="button" className="modal-close" onClick={closeModal}>
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <form id="product-form" onSubmit={handleSubmit}>
              <div className="two-cols">
                {/* LADO IZQUIERDO: IMÁGENES */}
                <div>
                  <div className="form-label" style={{ marginBottom: "12px" }}>
                    IMÁGENES (MÁX. 6)
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    style={{ display: "none" }}
                  />

                  <div
                    className="img-upload-zone"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>SUBIR IMÁGENES ({imagePreviews.length}/6 usadas)</p>
                    <p
                      style={{
                        fontSize: ".72rem",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                      }}
                    >
                      Arrastra o haz clic aquí
                    </p>
                  </div>

                  <div className="img-preview-grid">
                    {imagePreviews.map((previewUrl, index) => (
                      <div key={index} className="img-preview-slot">
                        <img src={previewUrl} alt="Preview" />
                        <button
                          type="button"
                          className="img-preview-remove"
                          onClick={() => removeImage(index)}
                        >
                          <svg viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LADO DERECHO: DATOS BÁSICOS */}
                <div>
                  <div className="form-group">
                    <label className="form-label">Nombre del Producto</label>
                    <input
                      className="form-input"
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      required
                      placeholder="Ej: Etiqueta Negra STAR OIL"
                    />
                  </div>
                  <div className="two-cols" style={{ gap: "12px" }}>
                    <div className="form-group">
                      <label className="form-label">SKU</label>
                      <input
                        className="form-input"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        placeholder={gender === "mujer"? "Ej: EST-001": "Ej: STR-001"}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Precio (Bs)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={formData.precio}
                        onChange={(e) =>
                          setFormData({ ...formData, precio: e.target.value })
                        }
                        required
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="two-cols" style={{ gap: "12px" }}>
                    <div className="form-group">
                      <label className="form-label">Categoría</label>
                      <select
                        className="form-select"
                        value={formData.categoria_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            categoria_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Seleccionar...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Marca</label>
                      <select
                        className="form-select"
                        value={formData.marca_id}
                        onChange={(e) =>
                          setFormData({ ...formData, marca_id: e.target.value })
                        }
                      >
                        <option value="">Seleccionar...</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select
                      className="form-select"
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData({ ...formData, estado: e.target.value })
                      }
                    >
                      <option value="activo">Activo</option>
                      <option value="archivado">Archivado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="full-width" style={{ marginTop: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Descripción Larga</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={formData.descripcion}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion: e.target.value })
                    }
                    placeholder="Descripción detallada del producto..."
                  ></textarea>
                </div>
              </div>

              {/* ─── CONFIGURACIÓN DE VARIANTES (ESTILO CORREGIDO Y CENTRADO) ─── */}
              <div className="full-width">
                <div className="card" style={{ background: "#F9FAFB" }}>
                  <div className="card-title">Configuración de Variantes</div>

                  {/* TALLAS */}
                  <div className="form-group" style={{ marginBottom: "16px" }}>
                    <label className="form-label">Tipo de Talla</label>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-sm size-type-btn"
                        style={
                          sizeType === "jeans"
                            ? {
                                background: "#111",
                                color: "#fff",
                                borderColor: "#111",
                              }
                            : {}
                        }
                        onClick={() => {
                          setSizeType("jeans");
                          setSelectedSizes([]);
                        }}
                      >
                        Jeans / Pantalones
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm size-type-btn"
                        style={
                          sizeType === "shirts"
                            ? {
                                background: "#111",
                                color: "#fff",
                                borderColor: "#111",
                              }
                            : {}
                        }
                        onClick={() => {
                          setSizeType("shirts");
                          setSelectedSizes([]);
                        }}
                      >
                        Camisas / Chamarras
                      </button>
                    </div>
                    <div className="size-checkbox-grid">
                      {(sizeType === "jeans" ? jeansSizes : shirtsSizes).map(
                        (s) => (
                          <label
                            key={s}
                            className="size-check"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              margin: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              className="size-cb"
                              style={{ margin: 0, cursor: "pointer" }}
                              checked={selectedSizes.includes(s)}
                              onChange={() => toggleSize(s)}
                            />
                            <span style={{ lineHeight: 1 }}>{s}</span>
                          </label>
                        )
                      )}
                    </div>
                  </div>

                  {/* COLORES */}
                  <div className="form-group">
                    <label className="form-label">Colores Disponibles</label>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      {selectedColors.map((c) => (
                        <div key={c.name} className="color-chip">
                          <div
                            className="color-dot"
                            style={{ background: c.hex }}
                          ></div>
                          <span>{c.name}</span>
                          <span
                            className="remove-color"
                            onClick={() => removeColor(c.name)}
                          >
                            &times;
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "end",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "180px" }}>
                        <select
                          className="form-select"
                          value={dropdownColor}
                          onChange={(e) => setDropdownColor(e.target.value)}
                        >
                          <option value="">Seleccionar color...</option>
                          <option value="Negro:#1C1C1C">Negro</option>
                          <option value="Jean Azul:#2C4A73">Jean Azul</option>
                          <option value="Celeste:#7AA3D4">Celeste</option>
                          <option value="Marengo:#4B525E">Marengo</option>
                          <option value="Azul:#21334E">Azul</option>
                          <option value="Hielo:#BDD2DF">Hielo</option>
                          <option value="Arena:#C2B280">Arena</option>
                          <option value="Plomo:#7E8C8D">Plomo</option>
                          <option value="Kaki:#C3B091">Kaki</option>
                          <option value="Blanco:#F9F9F9">Blanco</option>
                          <option value="Verde Pacay:#3E5D48">
                            Verde Pacay
                          </option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={addColorFromDropdown}
                      >
                        + Agregar
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: "1px solid #E5E7EB",
                      }}
                    >
                      <p
                        style={{
                          fontSize: ".72rem",
                          color: "var(--text-muted)",
                          marginBottom: "6px",
                        }}
                      >
                        Añadir color personalizado:
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "end",
                        }}
                      >
                        <input
                          className="form-input"
                          placeholder="Nombre del color"
                          style={{ flex: 1 }}
                          value={customColorName}
                          onChange={(e) => setCustomColorName(e.target.value)}
                        />
                        <input
                          type="color"
                          value={customColorHex}
                          onChange={(e) => setCustomColorHex(e.target.value)}
                          style={{
                            width: "40px",
                            height: "36px",
                            border: "none",
                            cursor: "pointer",
                            borderRadius: "4px",
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={addCustomColor}
                        >
                          + Añadir Nuevo
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleGenerateMatrix}
                    style={{ marginTop: "12px" }}
                  >
                    Generar Tabla de Stock
                  </button>

                  {/* TABLA DE VARIANTES GENERADA */}
                  {variantsMatrix.length > 0 && (
                    <div className="variant-grid table-wrap">
                      <table
                        style={{
                          background: "#fff",
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <thead style={{ background: "#F3F4F6" }}>
                          <tr>
                            <th style={{ padding: "10px 14px" }}>Color</th>
                            <th style={{ padding: "10px 14px" }}>Talla</th>
                            <th
                              style={{
                                padding: "10px 14px",
                                textAlign: "center",
                              }}
                            >
                              Cantidad Inicial
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantsMatrix.map((v, i) => (
                            <tr key={i}>
                              <td
                                className="td-bold"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "10px 14px",
                                }}
                              >
                                <div
                                  className="color-dot"
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    borderRadius: "50%",
                                    background: v.color_hex || "#000",
                                    border: "1px solid #ccc",
                                  }}
                                ></div>
                                {v.color}
                              </td>
                              <td
                                className="td-bold"
                                style={{ padding: "10px 14px" }}
                              >
                                {v.talla}
                              </td>
                              <td
                                style={{
                                  textAlign: "center",
                                  padding: "8px 14px",
                                }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  value={v.stock_global}
                                  onChange={(e) =>
                                    handleMatrixStockChange(i, e.target.value)
                                  }
                                  style={{
                                    width: "90px",
                                    padding: "6px 10px",
                                    textAlign: "center",
                                    border: "1px solid var(--border)",
                                    borderRadius: "6px",
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-outline"
              onClick={closeModal}
              disabled={uploading}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={uploading}
            >
              {uploading
                ? "Guardando..."
                : editId
                ? "Actualizar Producto"
                : "Guardar Producto"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ═══════════ */}
      <div className={`modal-overlay ${deleteId ? "open" : ""}`}>
        <div
          className="modal"
          style={{ maxWidth: "400px", textAlign: "center", padding: "10px" }}
        >
          <div className="modal-body" style={{ padding: "30px 20px" }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EF4444"
              strokeWidth="2"
              style={{ width: "56px", height: "56px", marginBottom: "16px" }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3
              style={{
                marginBottom: "10px",
                fontSize: "1.2rem",
                fontWeight: 800,
              }}
            >
              ¿Eliminar Producto?
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              Esta acción no se puede deshacer. Se eliminarán permanentemente
              sus variantes y el stock asociado.
            </p>
            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <button
                className="btn btn-outline"
                onClick={() => setDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ background: "#EF4444", borderColor: "#EF4444" }}
                onClick={confirmDelete}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}