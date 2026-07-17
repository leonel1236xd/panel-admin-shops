import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const DEFAULT_COST_ITEMS = [
  { name: "Tela", type: "lote", value: 0 },
  { name: "Costura", type: "unidad", value: 0 },
  { name: "Bordado", type: "unidad", value: 0 },
  { name: "Botones", type: "unidad", value: 0 },
  { name: "Cierres", type: "unidad", value: 0 },
  { name: "Hilos", type: "lote", value: 0 },
  { name: "Etiquetas", type: "unidad", value: 0 },
  { name: "Cartones", type: "lote", value: 0 },
  { name: "Lavado de tela", type: "lote", value: 0 },
  { name: "Transporte", type: "unidad", value: 0 },
];

export default function CostosItems() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);

  // Filtros
  const [filters, setFilters] = useState({
    genero: "",
    categoria: "",
    marca: "",
  });
  const [selectedProduct, setSelectedProduct] = useState("");

  // Datos del Formulario
  const [costosData, setCostosData] = useState({
    cantidad_lote: 100,
    margen_detalle: 30,
    margen_mayor: 15,
    transporte_mayor: 0,
    items: JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS)),
  });

  // Historial
  const [historial, setHistorial] = useState([]);
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);

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

  // ─── CARGAR DATOS INICIALES ───
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: cats } = await supabase
          .from("categorias")
          .select("id, nombre")
          .order("nombre");
        const { data: brs } = await supabase
          .from("marcas")
          .select("id, nombre")
          .order("nombre");
        const { data: prods } = await supabase
          .from("productos")
          .select("id, nombre, categoria_id, marca_id, genero")
          .order("nombre");

        if (cats) setCategorias(cats);
        if (brs) setMarcas(brs);
        if (prods) setProductos(prods);
      } catch (error) {
        showToast("Error al cargar datos base", "error");
      }
    };
    fetchData();
  }, []);

  // ─── LÓGICA DE FILTRADO ───
  const filteredProducts = productos.filter((p) => {
    let match = true;
    if (filters.genero === "varon") match = match && p.genero === "hombre";
    if (filters.genero === "mujer") match = match && p.genero === "mujer";
    if (filters.categoria)
      match = match && p.categoria_id === filters.categoria;
    if (filters.marca) match = match && p.marca_id === filters.marca;
    return match;
  });

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setSelectedProduct("");
    resetCostosData();
  };

  const resetCostosData = () => {
    setCostosData({
      cantidad_lote: 100,
      margen_detalle: 30,
      margen_mayor: 15,
      transporte_mayor: 0,
      items: JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS)),
    });
  };

  // ─── CARGAR FICHA AL SELECCIONAR PRODUCTO ───
  useEffect(() => {
    const loadFicha = async () => {
      if (!selectedProduct) {
        resetCostosData();
        return;
      }
      const { data, error } = await supabase
        .from("costos_producto")
        .select("*")
        .eq("producto_id", selectedProduct)
        .maybeSingle();

      if (data) {
        setCostosData({
          cantidad_lote: data.cantidad_lote || 100,
          margen_detalle: data.margen_detalle || 30,
          margen_mayor: data.margen_mayor || 15,
          transporte_mayor: data.transporte_mayor || 0,
          items:
            data.items && data.items.length > 0
              ? data.items
              : JSON.parse(JSON.stringify(DEFAULT_COST_ITEMS)),
        });
      } else {
        resetCostosData();
      }
    };
    loadFicha();
  }, [selectedProduct]);

  // ─── MODIFICAR ÍTEMS ───
  const handleItemChange = (index, field, value) => {
    const newItems = [...costosData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCostosData({ ...costosData, items: newItems });
  };

  const addCustomItem = () => {
    setCostosData({
      ...costosData,
      items: [
        ...costosData.items,
        { name: "Nuevo Ítem", type: "unidad", value: 0 },
      ],
    });
  };

  const removeCustomItem = (index) => {
    const newItems = costosData.items.filter((_, i) => i !== index);
    setCostosData({ ...costosData, items: newItems });
  };

  // ─── CÁLCULOS EN TIEMPO REAL ───
  const batchQty = Number(costosData.cantidad_lote) || 1;
  let totalLoteCost = 0;
  let totalUnitCost = 0;

  const calculatedItems = costosData.items.map((item) => {
    const val = Number(item.value) || 0;
    let rowUnit = 0;
    let rowLote = 0;
    if (item.type === "lote") {
      rowUnit = val / batchQty;
      rowLote = val;
    } else {
      rowUnit = val;
      rowLote = val * batchQty;
    }
    totalUnitCost += rowUnit;
    totalLoteCost += rowLote;
    return { ...item, rowUnit };
  });

  const sugeridoDetalle =
    totalUnitCost * (1 + Number(costosData.margen_detalle) / 100);
  const sugeridoMayor =
    totalUnitCost * (1 + Number(costosData.margen_mayor) / 100) +
    Number(costosData.transporte_mayor);

  // ─── GUARDAR FICHA ───
  const saveCostosSheet = async () => {
    if (!selectedProduct)
      return showToast("Selecciona un producto.", "warning");

    const { data: existing } = await supabase
      .from("costos_producto")
      .select("id")
      .eq("producto_id", selectedProduct)
      .maybeSingle();
    const payload = {
      producto_id: selectedProduct,
      cantidad_lote: Number(costosData.cantidad_lote) || 1,
      margen_detalle: Number(costosData.margen_detalle) || 0,
      margen_mayor: Number(costosData.margen_mayor) || 0,
      transporte_mayor: Number(costosData.transporte_mayor) || 0,
      items: costosData.items,
    };

    let errorObj = null;
    if (existing) {
      const { error } = await supabase
        .from("costos_producto")
        .update(payload)
        .eq("id", existing.id);
      errorObj = error;
    } else {
      const { error } = await supabase.from("costos_producto").insert(payload);
      errorObj = error;
    }

    if (errorObj) showToast("Error al guardar: " + errorObj.message, "error");
    else showToast("Ficha guardada exitosamente.", "success");
  };

  // ─── HISTORIAL Y REPORTES ───
  const loadHistorial = async () => {
    try {
      const { data, error } = await supabase
        .from("costos_producto")
        .select("*, productos(nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistorial(data || []);
      setIsHistorialModalOpen(true);
    } catch (error) {
      showToast("Error al cargar historial", "error");
    }
  };

  const deleteHistorial = async (id, idProd) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta ficha de costos?"))
      return;
    try {
      const { error } = await supabase
        .from("costos_producto")
        .delete()
        .eq("id", id);
      if (error) throw error;
      showToast("Ficha eliminada");
      setHistorial(historial.filter((h) => h.id !== id));
      if (selectedProduct === idProd) resetCostosData();
    } catch (error) {
      showToast("Error al eliminar", "error");
    }
  };

  const calcHelper = (ficha) => {
    let tUnit = 0;
    const batch = ficha.cantidad_lote || 1;
    (ficha.items || []).forEach((item) => {
      const val = Number(item.value) || 0;
      tUnit += item.type === "lote" ? val / batch : val;
    });
    const sDet = tUnit * (1 + ficha.margen_detalle / 100);
    const sMay =
      tUnit * (1 + ficha.margen_mayor / 100) + ficha.transporte_mayor;
    return { tUnit, sDet, sMay };
  };

  const printAll = () => {
    const printWindow = window.open("", "_blank");
    let rowsHtml = "";
    historial.forEach((h, i) => {
      const { tUnit, sDet, sMay } = calcHelper(h);
      rowsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${
            i + 1
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
            h.productos?.nombre || "Desconocido"
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${
            h.cantidad_lote
          }</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${tUnit.toFixed(
            2
          )}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${sDet.toFixed(
            2
          )}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${sMay.toFixed(
            2
          )}</td>
        </tr>`;
    });

    printWindow.document.write(`
      <html>
        <head><title>Historial de Costos</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#333;}table{width:100%;border-collapse:collapse;margin-top:10px;}th{border-bottom:2px solid #000;padding:10px 8px;text-align:left;font-weight:bold;}</style></head>
        <body>
          <h2>Historial Global de Costos de Fabricación</h2>
          <p>Impreso el: ${new Date().toLocaleString("es-BO")}</p>
          <table>
            <thead><tr><th style="text-align:center;">N°</th><th>Producto</th><th style="text-align:center;">Cant. Lote</th><th style="text-align:right;">Costo Unit. (Bs)</th><th style="text-align:right;">Sugerido Detalle</th><th style="text-align:right;">Sugerido Mayor</th></tr></thead>
            <tbody>${
              rowsHtml ||
              '<tr><td colSpan="6" style="text-align:center;">No hay registros</td></tr>'
            }</tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printSingle = (ficha) => {
    const printWindow = window.open("", "_blank");
    const { tUnit, sDet, sMay } = calcHelper(ficha);
    const batch = ficha.cantidad_lote || 1;
    let itemsHtml = "";

    (ficha.items || []).forEach((item) => {
      const val = Number(item.value) || 0;
      const rUnit = item.type === "lote" ? val / batch : val;
      itemsHtml += `
        <tr>
          <td style="padding: 6px; border-bottom: 1px solid #ddd;">${
            item.name
          }</td>
          <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align:center;">${
            item.type
          }</td>
          <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align:right;">${val.toFixed(
            2
          )}</td>
          <td style="padding: 6px; border-bottom: 1px solid #ddd; text-align:right; font-weight:bold;">${rUnit.toFixed(
            2
          )}</td>
        </tr>`;
    });

    printWindow.document.write(`
      <html>
        <head><title>Ficha de Costos - ${
          ficha.productos?.nombre
        }</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#333;}table{width:100%;border-collapse:collapse;margin-top:10px;}th{border-bottom:1px solid #000;padding:8px;text-align:left;} .box{border:1px solid #ccc; padding:15px; border-radius:5px; margin-bottom:15px;}</style></head>
        <body>
          <h2>Ficha Técnica de Costos</h2>
          <div class="box">
            <p><strong>Producto:</strong> ${
              ficha.productos?.nombre || "Desconocido"
            }</p>
            <p><strong>Fecha de Registro:</strong> ${new Date(
              ficha.created_at
            ).toLocaleDateString("es-BO")}</p>
            <p><strong>Cantidad del Lote:</strong> ${batch} unidades</p>
          </div>
          <h3>Desglose de Insumos</h3>
          <table>
            <thead><tr><th>Ítem</th><th style="text-align:center;">Tipo</th><th style="text-align:right;">Valor (Bs)</th><th style="text-align:right;">Costo Unit. (Bs)</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="box" style="margin-top:20px; font-size:14px;">
            <p><strong>COSTO TOTAL UNITARIO:</strong> Bs ${tUnit.toFixed(2)}</p>
            <p style="color:#166534; margin-top:10px;"><strong>Venta Sugerida Detalle (Margen ${
              ficha.margen_detalle
            }%):</strong> Bs ${sDet.toFixed(2)}</p>
            <p style="color:#1e40af;"><strong>Venta Sugerida Mayor (Margen ${
              ficha.margen_mayor
            }% + Trans. ${ficha.transporte_mayor}):</strong> Bs ${sMay.toFixed(
      2
    )}</p>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      {toast.show && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="page-header">
        <div className="page-breadcrumb">PRODUCTOS / COSTOS</div>
        <div className="page-title">Ficha de Costos e Ítems</div>
        <div className="page-subtitle">
          Calcula el costo total unitario de fabricación y los precios sugeridos
          por menor y por mayor.
        </div>
      </div>

      {/* SECCIÓN FILTROS Y SELECCIÓN */}
      <div className="card" style={{ marginBottom: "20px", padding: "20px" }}>
        <div
          style={{
            display: "flex",
            gap: "15px",
            marginBottom: "15px",
            flexWrap: "wrap",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "15px",
          }}
        >
          <div style={{ flex: 1, minWidth: "150px" }}>
            <label
              className="form-label"
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              Filtrar por Género
            </label>
            <select
              className="form-select"
              style={{ padding: "6px", fontSize: "0.82rem", height: "auto" }}
              value={filters.genero}
              onChange={(e) => handleFilterChange("genero", e.target.value)}
            >
              <option value="">Todos los géneros</option>
              <option value="varon">Varón (Hombre)</option>
              <option value="mujer">Mujer (Estrella)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: "150px" }}>
            <label
              className="form-label"
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              Filtrar por Categoría
            </label>
            <select
              className="form-select"
              style={{ padding: "6px", fontSize: "0.82rem", height: "auto" }}
              value={filters.categoria}
              onChange={(e) => handleFilterChange("categoria", e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: "150px" }}>
            <label
              className="form-label"
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              Filtrar por Marca
            </label>
            <select
              className="form-select"
              style={{ padding: "6px", fontSize: "0.82rem", height: "auto" }}
              value={filters.marca}
              onChange={(e) => handleFilterChange("marca", e.target.value)}
            >
              <option value="">Todas las marcas</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "250px" }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Seleccionar Producto
            </label>
            <select
              className="form-select"
              style={{ width: "100%" }}
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">-- Elige un producto --</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: "180px" }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Cantidad lote fabricación
            </label>
            <input
              type="number"
              className="form-input"
              min="1"
              style={{ width: "100%" }}
              value={costosData.cantidad_lote}
              onChange={(e) =>
                setCostosData({ ...costosData, cantidad_lote: e.target.value })
              }
            />
          </div>
          <div style={{ display: "flex", gap: "10px", alignSelf: "flex-end" }}>
            <button
              className="btn btn-outline"
              onClick={loadHistorial}
              style={{ height: "42px", fontWeight: 700 }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ marginRight: "6px" }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Ver Historial
            </button>
            <button
              className="btn btn-primary"
              onClick={saveCostosSheet}
              style={{
                height: "42px",
                background: "#0084E6",
                borderColor: "#0084E6",
              }}
            >
              Guardar Ficha
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* LADO IZQUIERDO: DETALLE DE ÍTEMS */}
        <div className="card" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              Desglose de Costos / Insumos
            </h3>
            <button
              className="btn"
              onClick={addCustomItem}
              style={{
                background: "var(--blue-bg)",
                color: "var(--blue)",
                border: "1px solid var(--blue)",
                padding: "5px 12px",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              + Agregar Ítem
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Nombre del Ítem / Insumo</th>
                  <th style={{ width: "130px" }}>Tipo Costo</th>
                  <th style={{ width: "130px" }}>Valor (Bs)</th>
                  <th style={{ textAlign: "right", width: "130px" }}>
                    Costo Unit. (Bs)
                  </th>
                  <th style={{ width: "50px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {calculatedItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        style={{
                          width: "100%",
                          fontSize: "0.85rem",
                          padding: "6px 10px",
                        }}
                        placeholder="Nombre del ítem"
                        value={item.name}
                        onChange={(e) =>
                          handleItemChange(index, "name", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        style={{
                          width: "100%",
                          fontSize: "0.85rem",
                          padding: "6px",
                          height: "auto",
                          minHeight: 0,
                        }}
                        value={item.type}
                        onChange={(e) =>
                          handleItemChange(index, "type", e.target.value)
                        }
                      >
                        <option value="unidad">Por unidad</option>
                        <option value="lote">Lote completo</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        step="any"
                        style={{
                          width: "100%",
                          fontSize: "0.85rem",
                          padding: "6px 10px",
                          textAlign: "right",
                        }}
                        value={item.value}
                        onChange={(e) =>
                          handleItemChange(index, "value", e.target.value)
                        }
                      />
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      Bs {item.rowUnit.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => removeCustomItem(index)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--red)",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LADO DERECHO: RESUMEN Y PRECIOS SUGERIDOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            className="card"
            style={{
              padding: "20px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "15px",
              }}
            >
              Costo de Fabricación
            </h3>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontSize: "0.9rem",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                Total Costo Fijo Lote:
              </span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Bs {totalLoteCost.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
                paddingTop: "10px",
                borderTop: "2px dashed #cbd5e1",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--text-primary)",
                }}
              >
                COSTO UNITARIO:
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1.15rem",
                  color: "#dc2626",
                }}
              >
                Bs {totalUnitCost.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "15px",
              }}
            >
              Sugerencias de Venta
            </h3>

            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "15px",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  color: "#166534",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                }}
              >
                Venta al Detalle (Minorista)
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "0.82rem", color: "#166534" }}>
                  Margen de Ganancia (%):
                </span>
                <input
                  type="number"
                  className="form-input"
                  style={{
                    width: "70px",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                  value={costosData.margen_detalle}
                  onChange={(e) =>
                    setCostosData({
                      ...costosData,
                      margen_detalle: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 800,
                  borderTop: "1px solid #bbf7d0",
                  paddingTop: "8px",
                  marginTop: "8px",
                }}
              >
                <span style={{ fontSize: "0.85rem", color: "#14532d" }}>
                  Precio Sugerido:
                </span>
                <span style={{ fontSize: "1.1rem", color: "#14532d" }}>
                  Bs {sugeridoDetalle.toFixed(2)}
                </span>
              </div>
            </div>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                padding: "15px",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  color: "#1e40af",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                }}
              >
                Venta al por Mayor (Mayorista)
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "0.82rem", color: "#1e40af" }}>
                  Margen de Ganancia (%):
                </span>
                <input
                  type="number"
                  className="form-input"
                  style={{
                    width: "70px",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                  value={costosData.margen_mayor}
                  onChange={(e) =>
                    setCostosData({
                      ...costosData,
                      margen_mayor: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "0.82rem", color: "#1e40af" }}>
                  Costos Extras Mayor:
                </span>
                <input
                  type="number"
                  className="form-input"
                  style={{
                    width: "70px",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                  value={costosData.transporte_mayor}
                  onChange={(e) =>
                    setCostosData({
                      ...costosData,
                      transporte_mayor: e.target.value,
                    })
                  }
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 800,
                  borderTop: "1px solid #bfdbfe",
                  paddingTop: "8px",
                  marginTop: "8px",
                }}
              >
                <span style={{ fontSize: "0.85rem", color: "#1e3a8a" }}>
                  Precio Sugerido Mayor:
                </span>
                <span style={{ fontSize: "1.1rem", color: "#1e3a8a" }}>
                  Bs {sugeridoMayor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL DEL HISTORIAL ─── */}
      <div className={`modal-overlay ${isHistorialModalOpen ? "open" : ""}`}>
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3>Historial de Fichas de Costos</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={printAll}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Imprimir Todo
              </button>
              <button
                className="modal-close"
                onClick={() => setIsHistorialModalOpen(false)}
              >
                <svg viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="table-wrap">
              <table>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th>Producto</th>
                    <th>Fecha Guardado</th>
                    <th style={{ textAlign: "center" }}>Lote</th>
                    <th style={{ textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          color: "var(--text-muted)",
                        }}
                      >
                        No hay fichas guardadas.
                      </td>
                    </tr>
                  ) : (
                    historial.map((h) => (
                      <tr key={h.id}>
                        <td className="td-bold">
                          {h.productos?.nombre || "Desconocido"}
                        </td>
                        <td className="td-muted">
                          {new Date(h.created_at).toLocaleDateString("es-BO")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {h.cantidad_lote}
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
                              onClick={() => printSingle(h)}
                              title="Imprimir Ficha"
                              style={{ color: "#0084E6" }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                              </svg>
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() =>
                                deleteHistorial(h.id, h.producto_id)
                              }
                              title="Eliminar"
                              style={{ color: "#EF4444" }}
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
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
