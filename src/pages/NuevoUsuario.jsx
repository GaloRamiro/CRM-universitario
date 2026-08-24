import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./NuevoUsuario.css";

function NuevoUsuario() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    rol: "usuario",
    departamento_id: "",
    activo: true,
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cargarDepartamentos = async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("id, nombre")
        .order("nombre");

      if (error) {
        console.error("Error cargando departamentos:", error);
        setError("No se pudieron cargar los departamentos.");
      } else {
        setDepartamentos(data || []);
      }

      setCargandoDepartamentos(false);
    };

    cargarDepartamentos();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    setCargando(true);

    try {
      if (formulario.password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        "crear-usuario",
        {
          body: {
            nombre: formulario.nombre.trim(),
            apellido: formulario.apellido.trim(),
            email: formulario.email.trim().toLowerCase(),
            password: formulario.password,
            rol: formulario.rol,
            departamento_id: formulario.departamento_id || null,
            activo: formulario.activo,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || "No se pudo crear el usuario.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMensaje("Usuario creado correctamente. Regresando a usuarios...");

      setTimeout(() => {
        navigate("/usuarios");
      }, 1000);
    } catch (err) {
      setError(err.message || "No se pudo procesar el formulario.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="nuevo-usuario-page">
      <div className="nuevo-usuario-header">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Nuevo usuario</h1>
          <p>Registra una nueva persona para acceder al CRM.</p>
        </div>

        <button
          className="nuevo-usuario-cancelar"
          type="button"
          onClick={() => navigate("/usuarios")}
        >
          Cancelar
        </button>
      </div>

      <form className="nuevo-usuario-card" onSubmit={handleSubmit}>
        <div className="nuevo-usuario-section">
          <h2>Información personal</h2>
          <p>Completa los datos básicos del usuario.</p>

          <div className="nuevo-usuario-grid">
            <div className="form-group">
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formulario.nombre}
                onChange={handleChange}
                placeholder="Ej. Juan"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="apellido">Apellido</label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                value={formulario.apellido}
                onChange={handleChange}
                placeholder="Ej. Pérez"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formulario.email}
                onChange={handleChange}
                placeholder="correo@institucion.edu.ec"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña temporal</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formulario.password}
                onChange={handleChange}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
          </div>
        </div>

        <div className="nuevo-usuario-section">
          <h2>Acceso y permisos</h2>
          <p>Define el rol y departamento del usuario.</p>

          <div className="nuevo-usuario-grid">
            <div className="form-group">
              <label htmlFor="rol">Rol</label>
              <select
                id="rol"
                name="rol"
                value={formulario.rol}
                onChange={handleChange}
              >
                <option value="usuario">Usuario</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="departamento_id">Departamento</label>
              <select
                id="departamento_id"
                name="departamento_id"
                value={formulario.departamento_id}
                onChange={handleChange}
                disabled={cargandoDepartamentos}
              >
                <option value="">Sin departamento</option>
                {departamentos.map((departamento) => (
                  <option key={departamento.id} value={departamento.id}>
                    {departamento.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="nuevo-usuario-checkbox">
            <input
              name="activo"
              type="checkbox"
              checked={formulario.activo}
              onChange={handleChange}
            />
            Usuario activo
          </label>
        </div>

        {mensaje && <div className="nuevo-usuario-mensaje">{mensaje}</div>}
        {error && <div className="nuevo-usuario-error">{error}</div>}

        <div className="nuevo-usuario-actions">
          <button
            type="button"
            className="nuevo-usuario-cancelar"
            onClick={() => navigate("/usuarios")}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="nuevo-usuario-btn"
            disabled={cargando}
          >
            {cargando ? "Validando..." : "Crear usuario"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default NuevoUsuario;
