import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../services/supabase";

const LETTER_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

function sortSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);
    if (isNumA && isNumB) return numA - numB;
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;
    const idxA = LETTER_ORDER.indexOf((a || "").toUpperCase());
    const idxB = LETTER_ORDER.indexOf((b || "").toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (a || "").localeCompare(b || "");
  });
}

// Agrupa las variantes de un producto por color, calculando totales por talla.
function groupByColor(producto, uniqueSizes) {
  const colorsMap = {};
  const sizeSums = {};
  uniqueSizes.forEach((sz) => (sizeSums[sz] = 0));

  (producto.variantes || []).forEach((v) => {
    if (!colorsMap[v.color]) {
      colorsMap[v.color] = {
        hex: v.color_hex || "#E5E7EB",
        sizes: {},
        variants: {},
        total: 0,
      };
    }
    const stock = v.stock_global || 0;
    colorsMap[v.color].sizes[v.talla] = stock;
    colorsMap[v.color].variants[v.talla] = v;
    colorsMap[v.color].total += stock;
    if (sizeSums[v.talla] !== undefined) sizeSums[v.talla] += stock;
  });

  const colorKeys = Object.keys(colorsMap);
  const productTotal = colorKeys.reduce((sum, k) => sum + colorsMap[k].total, 0);

  return { colorsMap, colorKeys, sizeSums, productTotal };
}

export default function Inventario({ onEditProduct }) {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  // Modal de ajuste rápido de stock
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [quickStock, setQuickStock] = useState(null); // { variantId, prodName, color, talla, currentStock }
  const [addValue, setAddValue] = useState(0);
  const [reduceValue, setReduceValue] = useState(0);

  // Toasts
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prods, error } = await supabase
        .from("productos")
        .select(
          "*, categorias(id, nombre), marcas(id, nombre), variantes(id, color, color_hex, talla, stock_global)"
        )
        .eq("estado", "activo")
        .order("nombre");

      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre");
      const { data: brs } = await supabase
        .from("marcas")
        .select("id, nombre")
        .order("nombre");

      if (error) throw error;

      setProductos(prods || []);
      setCategorias(cats || []);
      setMarcas(brs || []);
    } catch (error) {
      showToast(`Error al cargar inventario: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    return productos.filter((p) => {
      const matchesSearch =
        (p.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter === "" || p.genero === genderFilter;
      const matchesCat = catFilter === "" || p.categoria_id === catFilter;
      const matchesBrand = brandFilter === "" || p.marca_id === brandFilter;
      return matchesSearch && matchesGender && matchesCat && matchesBrand;
    });
  }, [productos, searchTerm, genderFilter, catFilter, brandFilter]);

  // Tallas únicas presentes en los productos filtrados (columnas dinámicas de la matriz)
  const uniqueSizes = useMemo(() => {
    const sizes = [];
    filteredProducts.forEach((p) => {
      (p.variantes || []).forEach((v) => {
        if (!sizes.includes(v.talla)) sizes.push(v.talla);
      });
    });
    return sortSizes(sizes);
  }, [filteredProducts]);

  const grandTotalStock = useMemo(() => {
    let total = 0;
    filteredProducts.forEach((p) => {
      (p.variantes || []).forEach((v) => {
        total += v.stock_global || 0;
      });
    });
    return total;
  }, [filteredProducts]);

  const openQuickStock = (variant, prodName, color, talla) => {
    setQuickStock({
      variantId: variant.id,
      prodName,
      color,
      talla,
      currentStock: variant.stock_global || 0,
    });
    setAddValue(0);
    setReduceValue(0);
    setIsStockModalOpen(true);
  };

  const handleAddChange = (val) => {
    setReduceValue(0);
    setAddValue(parseInt(val, 10) || 0);
  };

  const handleReduceChange = (val) => {
    setAddValue(0);
    setReduceValue(parseInt(val, 10) || 0);
  };

  const newTotalPreview = () => {
    if (!quickStock) return 0;
    if (addValue > 0) return quickStock.currentStock + addValue;
    if (reduceValue > 0) {
      const t = quickStock.currentStock - reduceValue;
      return t < 0 ? 0 : t;
    }
    return quickStock.currentStock;
  };

  const applyQuickStock = async (mode) => {
    if (!quickStock) return;
    let finalStock;
    if (mode === "add") {
      finalStock = quickStock.currentStock + addValue;
    } else {
      finalStock = quickStock.currentStock - reduceValue;
    }
    if (finalStock < 0) finalStock = 0;

    try {
      const { error } = await supabase
        .from("variantes")
        .update({ stock_global: finalStock })
        .eq("id", quickStock.variantId);
      if (error) throw error;
      showToast("Stock actualizado correctamente");
      setIsStockModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(`Error al actualizar el stock: ${error.message}`, "error");
    }
  };

  const handleEditProduct = (producto) => {
    if (onEditProduct) {
      onEditProduct(producto.id);
    } else {
      showToast("Ve a la pestaña Productos para editar este producto.");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast(
        "Error: Bloqueador de ventanas emergentes activo. Permite ventanas emergentes para imprimir.",
        "error"
      );
      return;
    }

    const now = new Date();
    const formattedDate =
      now.toLocaleDateString("es-BO") + " " + now.toLocaleTimeString("es-BO");

    const selectedCatText =
      categorias.find((c) => c.id === catFilter)?.nombre || "Todas las categorías";
    const selectedBrandText =
      marcas.find((m) => m.id === brandFilter)?.nombre || "Todas las marcas";
    const selectedGenderText =
      genderFilter === "mujer"
        ? "Para Mujer"
        : genderFilter === "hombre"
        ? "Para Hombre"
        : "Todos los géneros";

    let globalIndex = 1;
    let bodyRows = "";

    filteredProducts.forEach((p) => {
      const { colorsMap, colorKeys, sizeSums, productTotal } = groupByColor(p, uniqueSizes);

      if (colorKeys.length === 0) {
        bodyRows += `
          <tr>
            <td>${globalIndex++}</td>
            <td>${p.categorias?.nombre || "—"}</td>
            <td class="td-bold">${p.nombre}</td>
            <td>—</td>
            <td colspan="${uniqueSizes.length || 1}" class="text-center">Sin variantes</td>
            <td class="td-bold">0</td>
          </tr>`;
        return;
      }

      const rowspanVal = colorKeys.length + 1;
      colorKeys.forEach((colorName, idx) => {
        const colorData = colorsMap[colorName];
        const isFirst = idx === 0;
        const sizeCells = uniqueSizes
          .map((sz) => {
            const stock = colorData.sizes[sz];
            return stock !== undefined
              ? `<td class="text-center">${stock}</td>`
              : `<td class="text-center" style="color:#ccc">—</td>`;
          })
          .join("");

        bodyRows += `<tr>`;
        if (isFirst) {
          bodyRows += `
            <td rowspan="${rowspanVal}">${globalIndex++}</td>
            <td rowspan="${rowspanVal}">${p.categorias?.nombre || "—"}</td>
            <td rowspan="${rowspanVal}" class="td-bold">${p.nombre}</td>`;
        }
        bodyRows += `
          <td>${colorName}</td>
          ${sizeCells}
          <td class="td-bold">${colorData.total}</td>`;
        if (isFirst) {
          bodyRows += `<td rowspan="${rowspanVal}" class="td-bold">${productTotal}</td>`;
        }
        bodyRows += `</tr>`;
      });

      const subtotalCells = uniqueSizes
        .map((sz) => `<td class="text-center td-bold">${sizeSums[sz]}</td>`)
        .join("");
      bodyRows += `
        <tr style="background:#f1f5f9">
          <td class="td-bold" style="text-align:right">SUMA TALLAS:</td>
          ${subtotalCells}
          <td class="td-bold">${productTotal}</td>
          <td></td>
        </tr>`;
    });

    const sizeHeaders = uniqueSizes.map((sz) => `<th>${sz}</th>`).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Inventario</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 30px; padding: 0; font-size: 11px; line-height: 1.4; }
          .header-container { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #334155; padding-bottom:15px; margin-bottom:20px; }
          .header-logo { font-size:22px; font-weight:800; letter-spacing:2px; color:#0f172a; }
          .report-title { font-size:15px; font-weight:800; margin-top:5px; text-transform:uppercase; color:#1e293b; }
          .meta-info { text-align:right; font-size:10px; color:#64748b; }
          .meta-info strong { color:#334155; }
          .filters-summary { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 15px; margin-bottom:20px; display:flex; gap:20px; font-size:10px; }
          .filters-summary div { flex:1; }
          .filters-summary strong { color:#334155; }
          table { width:100%; border-collapse:collapse; margin-bottom:30px; }
          th { background:#334155 !important; color:#fff !important; font-weight:700; text-transform:uppercase; font-size:9px; letter-spacing:.5px; padding:8px 10px; border:1px solid #475569; }
          td { padding:8px 10px; border:1px solid #cbd5e1; vertical-align:middle; }
          .td-bold { font-weight:700; }
          .text-center { text-align:center; }
          tfoot tr { background:#f1f5f9; font-weight:800; }
          tfoot td { border-top:2px solid #334155; border-bottom:2px solid #334155; font-size:12px; }
          @media print {
            body { margin:15px; font-size:10px; }
            th { background:#475569 !important; color:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            tfoot tr { background:#e2e8f0 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div>
            <div class="header-logo">INVENTARIO</div>
            <div class="report-title">Reporte de Inventario Global</div>
          </div>
          <div class="meta-info">
            <div><strong>Fecha de Impresión:</strong> ${formattedDate}</div>
          </div>
        </div>
        <div class="filters-summary">
          <div><strong>Género:</strong> ${selectedGenderText}</div>
          <div><strong>Categoría:</strong> ${selectedCatText}</div>
          <div><strong>Marca:</strong> ${selectedBrandText}</div>
          <div><strong>Total productos:</strong> ${filteredProducts.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>NRO</th><th>CATEGORÍA</th><th>NOMBRE</th><th>COLORES</th>
              ${sizeHeaders || "<th>TALLA</th>"}
              <th>TOTAL GENERAL</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="${3 + uniqueSizes.length + 1}" style="text-align:right">SUMA TOTAL:</td>
              <td>${grandTotalStock}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function(){ window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  let renderIndex = 1;

  return (
    <div id="tab-inventario" style={{ display: "block" }}>
      {toast.show && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === "success" ? (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
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
        <div className="page-breadcrumb">LOGÍSTICA / INVENTARIO</div>
        <div className="page-title">Inventario Global</div>
        <div className="page-subtitle">Gestión masiva de existencias y SKUs de todo el catálogo.</div>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            id="search-inventario"
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          id="filter-gender-inventario"
          style={{ width: "160px" }}
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
        >
          <option value="">Todos los géneros</option>
          <option value="mujer">Para Mujer</option>
          <option value="hombre">Para Hombre</option>
        </select>
        <select
          className="filter-select"
          id="filter-cat-inventario"
          style={{ width: "200px" }}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          id="filter-brand-inventario"
          style={{ width: "200px" }}
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <button
          className="btn"
          onClick={handlePrint}
          id="btn-print-inventario"
          style={{
            background: "#3C5A64",
            borderColor: "#3C5A64",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "42px",
            marginLeft: "auto",
            color: "white",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Imprimir Reporte
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "left", padding: "12px 14px" }} rowSpan={2}>NRO</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "left", padding: "12px 14px" }} rowSpan={2}>CATEGORÍA</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "left", padding: "12px 14px" }} rowSpan={2}>NOMBRE</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "left", padding: "12px 14px" }} rowSpan={2}>COLORES</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "center", padding: "12px 14px" }} colSpan={uniqueSizes.length || 1}>TALLAS</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "left", padding: "12px 14px" }} rowSpan={2}>TOTAL GENERAL</th>
                <th style={{ background: "#3C5A64", color: "#fff", textAlign: "center", padding: "12px 14px" }} rowSpan={2}>ACCIONES</th>
              </tr>
              <tr>
                {uniqueSizes.length > 0 ? (
                  uniqueSizes.map((sz) => (
                    <th key={sz} style={{ background: "#3C5A64", color: "#fff", textAlign: "center", minWidth: "60px", padding: "10px 14px" }}>
                      {sz}
                    </th>
                  ))
                ) : (
                  <th style={{ background: "#3C5A64", color: "#fff", padding: "12px 14px" }}>Talla</th>
                )}
              </tr>
            </thead>
            <tbody id="inventory-body">
              {loading ? (
                <tr>
                  <td colSpan={uniqueSizes.length + 7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    Cargando inventario...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={uniqueSizes.length + 7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const { colorsMap, colorKeys, sizeSums, productTotal } = groupByColor(p, uniqueSizes);

                  if (colorKeys.length === 0) {
                    const nro = renderIndex++;
                    return (
                      <tr key={p.id}>
                        <td>{nro}</td>
                        <td>{p.categorias?.nombre || "—"}</td>
                        <td className="td-bold" style={{ textTransform: "uppercase" }}>{p.nombre}</td>
                        <td>—</td>
                        <td colSpan={uniqueSizes.length || 1} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                          Sin variantes
                        </td>
                        <td className="td-bold">0</td>
                        <td className="td-bold">0</td>
                        <td style={{ textAlign: "center" }}>
                          <button className="btn-icon" title="Editar Producto" style={{ color: "#FFA500" }} onClick={() => handleEditProduct(p)}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const nro = renderIndex++;
                  const rowspanVal = colorKeys.length + 1;

                  return (
                    <React.Fragment key={p.id}>
                      {colorKeys.map((colorName, idx) => {
                        const colorData = colorsMap[colorName];
                        const isFirst = idx === 0;
                        return (
                          <tr key={`${p.id}-${colorName}`}>
                            {isFirst && (
                              <>
                                <td rowSpan={rowspanVal}>{nro}</td>
                                <td rowSpan={rowspanVal}>{p.categorias?.nombre || "—"}</td>
                                <td rowSpan={rowspanVal} className="td-bold" style={{ textTransform: "uppercase" }}>
                                  {p.nombre}
                                </td>
                              </>
                            )}
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: colorData.hex,
                                  marginRight: "6px",
                                  verticalAlign: "middle",
                                  border: "1px solid #ddd",
                                }}
                              ></span>
                              {colorName}
                            </td>
                            {uniqueSizes.map((sz) => {
                              const stock = colorData.sizes[sz];
                              const variant = colorData.variants[sz];
                              return (
                                <td key={sz} style={{ textAlign: "center" }}>
                                  {stock !== undefined ? (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                      <span style={{ fontWeight: 700 }}>{stock}</span>
                                      <button
                                        className="btn-icon"
                                        style={{ padding: "2px" }}
                                        title="Ajustar stock"
                                        onClick={() => openQuickStock(variant, p.nombre, colorName, sz)}
                                      >
                                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#6B7280" strokeWidth="2.5">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#ccc" }}>—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="td-bold" style={{ fontSize: "1.05rem" }}>{colorData.total}</td>
                            {isFirst && (
                              <>
                                <td rowSpan={rowspanVal} className="td-bold" style={{ fontSize: "1.15rem", background: "#F3F4F6" }}>
                                  {productTotal}
                                </td>
                                <td rowSpan={rowspanVal} style={{ textAlign: "center" }}>
                                  <button className="btn-icon" title="Editar Producto" style={{ color: "#FFA500" }} onClick={() => handleEditProduct(p)}>
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}

                      {/* Fila de subtotales por talla del producto */}
                      <tr style={{ background: "#F3F4F6", fontWeight: "bold", borderBottom: "2px solid #D1D5DB" }}>
                        <td style={{ color: "#3C5A64", fontWeight: 800, textAlign: "right", padding: "8px 12px" }}>SUMA TALLAS:</td>
                        {uniqueSizes.map((sz) => (
                          <td key={sz} style={{ textAlign: "center", fontWeight: 800, color: "#3C5A64", background: "#F3F4F6" }}>
                            {sizeSums[sz]}
                          </td>
                        ))}
                        <td className="td-bold" style={{ fontSize: "1.05rem", color: "#3C5A64", background: "#F3F4F6" }}>
                          {productTotal}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!loading && filteredProducts.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f3f4f6", fontWeight: "bold" }}>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 800, padding: "12px 14px", borderTop: "2px solid var(--border)" }}>
                    SUMA TOTAL:
                  </td>
                  <td colSpan={uniqueSizes.length + 1} style={{ borderTop: "2px solid var(--border)" }}></td>
                  <td style={{ fontWeight: 900, fontSize: "1.2rem", padding: "12px 14px", borderTop: "2px solid var(--border)", textAlign: "left", color: "#111" }}>
                    {grandTotalStock}
                  </td>
                  <td style={{ borderTop: "2px solid var(--border)" }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ─── MODAL: AJUSTE RÁPIDO DE STOCK ─── */}
      <div className={`modal-overlay ${isStockModalOpen ? "open" : ""}`} id="modal-quick-stock">
        <div className="modal modal-md">
          <div className="modal-header">
            <h3>Ajustar Stock</h3>
            <button className="modal-close" onClick={() => setIsStockModalOpen(false)}>
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body" id="quick-stock-body">
            {quickStock && (
              <>
                <p style={{ fontSize: ".88rem", marginBottom: "16px" }}>
                  <strong>{quickStock.prodName}</strong> — {quickStock.color} / {quickStock.talla}
                </p>
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--border-light)",
                      padding: "24px 12px",
                      borderRadius: "8px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: ".72rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                      Stock Actual
                    </div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, marginTop: "8px", color: "var(--text-primary)" }}>
                      {quickStock.currentStock}
                    </div>
                  </div>
                  <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ background: "#fff", border: "1px dashed var(--border)", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: ".72rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                        Añadir al Stock
                      </div>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={addValue}
                        onChange={(e) => handleAddChange(e.target.value)}
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 800,
                          textAlign: "center",
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          padding: 0,
                          marginTop: "2px",
                        }}
                      />
                    </div>
                    <div style={{ background: "#fff", border: "1px dashed var(--border)", padding: "8px 12px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: ".72rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                        Reducir Stock
                      </div>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={reduceValue}
                        onChange={(e) => handleReduceChange(e.target.value)}
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: 800,
                          textAlign: "center",
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          padding: 0,
                          marginTop: "2px",
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "center", fontSize: ".85rem", marginTop: "8px", color: "var(--text-secondary)", fontWeight: 700 }}>
                  Nuevo Stock Total:{" "}
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 900,
                      color: addValue > 0 ? "var(--green)" : reduceValue > 0 ? "var(--red)" : "var(--text-primary)",
                    }}
                  >
                    {newTotalPreview()}
                  </span>
                  {addValue > 0 && (
                    <span style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--green)" }}> (+{addValue} unidades)</span>
                  )}
                  {reduceValue > 0 && (
                    <span style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--red)" }}> (-{reduceValue} unidades)</span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setIsStockModalOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-outline"
              style={{ color: "var(--red)", borderColor: "var(--red)" }}
              onClick={() => applyQuickStock("reduce")}
            >
              Reducir
            </button>
            <button className="btn btn-primary" onClick={() => applyQuickStock("add")}>
              Añadir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}