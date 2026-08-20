import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Login.css";
function Login() {
    const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setMensaje("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
  setMensaje(error.message);
} else {
  setMensaje("Inicio de sesión correcto");
  navigate("/dashboard");
}

    setCargando(false);
  };

return (
  <main className="login-page">
    <section className="login-card">

      <div className="login-header">
        <span className="eyebrow">CRM UNIVERSITARIO</span>

        <h1>Bienvenido</h1>

        <p>
          Ingresa a tu cuenta para gestionar los requerimientos
          de tu equipo.
        </p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>

        <div className="form-group">
          <label htmlFor="email">
            Correo electrónico
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@institucion.edu.ec"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">
            Contraseña
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contraseña"
            required
          />
        </div>

        {mensaje && (
          <div className="login-message">
            {mensaje}
          </div>
        )}

        <button
          className="login-button"
          type="submit"
          disabled={cargando}
        >
          {cargando ? "Ingresando..." : "Iniciar sesión"}
        </button>

      </form>

      <div className="login-footer">
        CRM de gestión de requerimientos
      </div>

    </section>
  </main>
);
}

export default Login;