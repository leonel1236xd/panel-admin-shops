import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor completa todos los campos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? "Credenciales inválidas. Verifica tu correo y contraseña."
          : error.message
      );
      setLoading(false);
    } else {
      navigate("/admin"); // Login exitoso -> Redirige al panel
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-header">
          <h1>STAR'S</h1>
          <p>Panel de Administración</p>
        </div>

        {errorMsg && <div className="error-message show">{errorMsg}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              className={`form-input ${errorMsg ? "error" : ""}`}
              placeholder="admin@ejemplo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg("");
              }}
            />
          </div>

          <div className="form-group">
            <label>CONTRASEÑA</label>
            {/* Este div relativo es el truco */}
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errorMsg ? "error" : ""}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg("");
                }}
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6B7280",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn-login ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? <div className="spinner"></div> : "Ingresar al Panel"}
          </button>
        </form>

        <div className="login-footer">&copy; 2026 STAR'S Premium Denim.</div>
      </div>
    </div>
  );
}
