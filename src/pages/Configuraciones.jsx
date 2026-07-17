import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

// Mapea cada pestaña del panel a la fila real de la tabla `sucursales`
const NOMBRE_POR_TAB = {
  stars: "STAR'S",
  estrella: "Estrella",
};

const CAMPOS_VACIOS = {
  whatsapp: "",
  instagram: "",
  instagram_url: "",
  tiktok: "",
  tiktok_url: "",
  facebook: "",
  facebook_url: "",
  direccion: "",
  ciudad: "",
  horario_atencion: "",
  envios: "",
};

export default function Configuraciones() {
  const [activeTab, setActiveTab] = useState("stars"); // 'stars' | 'estrella'
  const [loading, setLoading] = useState(true);

  // Estado unificado para ambas sucursales. Guardamos también el `id` de cada
  // fila (lo necesitamos para el update, ya que la PK de sucursales es `id`, no `nombre`)
  const [config, setConfig] = useState({
    stars: { id: null, ...CAMPOS_VACIOS },
    estrella: { id: null, ...CAMPOS_VACIOS },
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

  // ─── CARGAR DATOS ───
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("sucursales")
        .select("*")
        .in("nombre", Object.values(NOMBRE_POR_TAB));

      if (error) {
        showToast("Error al cargar configuración desde sucursales", "error");
        console.error(error);
      } else if (data && data.length > 0) {
        const newConfig = { ...config };
        data.forEach((row) => {
          const tabKey = Object.keys(NOMBRE_POR_TAB).find(
            (key) => NOMBRE_POR_TAB[key] === row.nombre
          );
          if (tabKey) {
            newConfig[tabKey] = { ...newConfig[tabKey], ...row };
          }
        });
        setConfig(newConfig);
      } else {
        showToast(
          "No se encontraron sucursales con esos nombres. Revisa NOMBRE_POR_TAB.",
          "error"
        );
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  // ─── HANDLERS ───
  const handleInputChange = (catalog, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [catalog]: { ...prev[catalog], [field]: value },
    }));
  };

  // ─── GUARDAR TODO ───
  const saveConfigurations = async () => {
    showToast("Guardando configuraciones...");

    // Actualizamos cada sucursal por separado (no usamos upsert por nombre,
    // porque la PK real es `id` y las filas ya existen)
    const updates = Object.keys(NOMBRE_POR_TAB).map(async (tabKey) => {
      const campos = config[tabKey];
      // Nunca mandamos id, created_at, tipo ni estado en el update
      const payload = {
        whatsapp: campos.whatsapp,
        instagram: campos.instagram,
        instagram_url: campos.instagram_url,
        tiktok: campos.tiktok,
        tiktok_url: campos.tiktok_url,
        facebook: campos.facebook,
        facebook_url: campos.facebook_url,
        direccion: campos.direccion,
        ciudad: campos.ciudad,
        horario_atencion: campos.horario_atencion,
        envios: campos.envios,
      };

      return supabase
        .from("sucursales")
        .update(payload)
        .eq("nombre", NOMBRE_POR_TAB[tabKey]);
    });

    const results = await Promise.all(updates);
    const anyError = results.find((r) => r.error);

    if (anyError) {
      showToast("Error al guardar cambios", "error");
      console.error(anyError.error);
    } else {
      showToast("Configuración actualizada con éxito", "success");
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
            <div className="page-breadcrumb">
              ADMINISTRACIÓN / CONFIGURACIÓN
            </div>
            <div className="page-title">Configuración General</div>
            <div className="page-subtitle">
              Modifica la información de contacto visible en los catálogos web
              de clientes.
            </div>
          </div>
          <button
            onClick={saveConfigurations}
            id="btn-save-cfg"
            style={{
              padding: "10px 22px",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0f172a")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ width: "15px", height: "15px" }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Guardar Todo
          </button>
        </div>
      </div>

      {/* CATALOG TABS */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #e2e8f0",
          marginBottom: "20px",
          marginTop: "8px",
        }}
      >
        <button
          onClick={() => setActiveTab("stars")}
          style={{
            padding: "10px 22px",
            background: "transparent",
            border: "none",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            cursor: "pointer",
            marginBottom: "-2px",
            fontWeight: activeTab === "stars" ? 700 : 600,
            borderBottom:
              activeTab === "stars"
                ? "3px solid #0f172a"
                : "3px solid transparent",
            color: activeTab === "stars" ? "#0f172a" : "#94a3b8",
          }}
        >
          📦 Star's Jeans
        </button>
        <button
          onClick={() => setActiveTab("estrella")}
          style={{
            padding: "10px 22px",
            background: "transparent",
            border: "none",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            cursor: "pointer",
            marginBottom: "-2px",
            fontWeight: activeTab === "estrella" ? 700 : 600,
            borderBottom:
              activeTab === "estrella"
                ? "3px solid #0f172a"
                : "3px solid transparent",
            color: activeTab === "estrella" ? "#0f172a" : "#94a3b8",
          }}
        >
          👗 Estrella Mujer
        </button>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-muted)",
          }}
        >
          Cargando datos...
        </div>
      ) : (
        <>
          {["stars", "estrella"].map(
            (tabKey) =>
              activeTab === tabKey && (
                <div
                  key={tabKey}
                  id={`cfg-panel-${tabKey}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    maxWidth: "900px",
                  }}
                >
                  {/* WhatsApp */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="#16a34a"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.567 4.136 1.559 5.859L.057 23.386a.5.5 0 0 0 .611.665l5.71-1.5A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.986 0-3.847-.55-5.433-1.505l-.39-.232-4.016 1.057 1.077-3.937-.254-.406A9.944 9.944 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        WhatsApp
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Número (con código de país, sin +)
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="59172261616"
                      style={{ fontSize: "0.9rem", letterSpacing: "1px" }}
                      value={config[tabKey].whatsapp}
                      onChange={(e) =>
                        handleInputChange(tabKey, "whatsapp", e.target.value)
                      }
                    />
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Ej: <strong>59172261616</strong>
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#e1306c"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
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
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        Instagram
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Usuario
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="@usuario"
                      style={{ marginBottom: "8px" }}
                      value={config[tabKey].instagram}
                      onChange={(e) =>
                        handleInputChange(tabKey, "instagram", e.target.value)
                      }
                    />
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      URL del perfil
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://instagram.com/usuario"
                      value={config[tabKey].instagram_url}
                      onChange={(e) =>
                        handleInputChange(
                          tabKey,
                          "instagram_url",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* TikTok */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#010101"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        TikTok
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Usuario
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="@usuario"
                      style={{ marginBottom: "8px" }}
                      value={config[tabKey].tiktok}
                      onChange={(e) =>
                        handleInputChange(tabKey, "tiktok", e.target.value)
                      }
                    />
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      URL del perfil
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://tiktok.com/@usuario"
                      value={config[tabKey].tiktok_url}
                      onChange={(e) =>
                        handleInputChange(tabKey, "tiktok_url", e.target.value)
                      }
                    />
                  </div>

                  {/* Facebook */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1877f2"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        Facebook
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Nombre de página
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginBottom: "8px" }}
                      value={config[tabKey].facebook}
                      onChange={(e) =>
                        handleInputChange(tabKey, "facebook", e.target.value)
                      }
                    />
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      URL de la página
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://facebook.com/..."
                      value={config[tabKey].facebook_url}
                      onChange={(e) =>
                        handleInputChange(
                          tabKey,
                          "facebook_url",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* Ubicación (ciudad + dirección) */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        Ubicación
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Ciudad
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Cochabamba"
                      style={{ marginBottom: "8px" }}
                      value={config[tabKey].ciudad}
                      onChange={(e) =>
                        handleInputChange(tabKey, "ciudad", e.target.value)
                      }
                    />
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Dirección
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Av. Ejemplo #123"
                      value={config[tabKey].direccion}
                      onChange={(e) =>
                        handleInputChange(tabKey, "direccion", e.target.value)
                      }
                    />
                  </div>

                  {/* Horario */}
                  <div className="card" style={{ padding: "20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        Horario de Atención
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Horario (usa "|" para separar líneas)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Lun - Sáb: 9:00 AM - 7:00 PM | Dom: 10:00 AM - 4:00 PM"
                      value={config[tabKey].horario_atencion}
                      onChange={(e) =>
                        handleInputChange(
                          tabKey,
                          "horario_atencion",
                          e.target.value
                        )
                      }
                    />
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Usa <strong>|</strong> para separar en dos líneas en el
                      catálogo
                    </div>
                  </div>

                  {/* Envíos */}
                  <div
                    className="card"
                    style={{ padding: "20px", gridColumn: "1/-1" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "14px",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "10px",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="2"
                        style={{ width: "18px", height: "18px" }}
                      >
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        Envíos
                      </span>
                    </div>
                    <label
                      className="form-label"
                      style={{
                        fontSize: "0.75rem",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      Texto de cobertura de envíos
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Cochabamba y toda Bolivia"
                      value={config[tabKey].envios}
                      onChange={(e) =>
                        handleInputChange(tabKey, "envios", e.target.value)
                      }
                    />
                  </div>
                </div>
              )
          )}
        </>
      )}
    </>
  );
}
