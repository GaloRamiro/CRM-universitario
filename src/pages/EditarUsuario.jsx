import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./NuevoUsuario.css";

function EditarUsuario() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formulario, setFormulario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    rol: "usuario",
    departamento_id: "",
    activo: true,
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      setError("");

      const [
        { data: usuario, error: usuarioError },
        { data: departamentosData, error: departamentosError },
      ] = await Promise.all([
        supabase
          .from("usuarios")
          .select("id, nombre, apellido, email, rol, activo, departamento_id")
          .eq("id", id)
          .single(),

        supabase.from("departamentos").select("id, nombre").order("nombre"),
      ]);

      if (usuarioError) {
        console.error("Error cargando usuario:", usuarioError);
        setError("No se pudo cargar el usuario.");
        setCargando(false);
        return;
      }

      if (departamentosError) {
        console.error("Error cargando departamentos:", departamentosError);
      }

      setFormulario({
        nombre: usuario.nombre || "",
        apellido: usuario.apellido || "",
        email: usuario.email || "",
        rol: usuario.rol || "usuario",
        departamento_id: usuario.departamento_id || "",
        activo: usuario.activo ?? true,
      });

      setDepartamentos(departamentosData || []);
      setCargando(false);
    };

    cargarDatos();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      if (!formulario.nombre.trim() || !formulario.apellido.trim()) {
        throw new Error("Nombre y apellido son obligatorios.");
      }

      if (!formulario.email.trim()) {
        throw new Error("El correo electrónico es obligatorio.");
      }

      const { error: updateError } = await supabase
        .from("usuarios")
        .update({
          nombre: formulario.nombre.trim(),
          apellido: formulario.apellido.trim(),
          email: formulario.email.trim().toLowerCase(),
          rol: formulario.rol,
          departamento_id: formulario.departamento_id || null,
          activo: formulario.activo,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error actualizando usuario:", updateError);
        throw new Error(
          updateError.message || "No se pudo actualizar el usuario.",
        );
      }

      setMensaje("Usuario actualizado correctamente.");

      setTimeout(() => {
        navigate("/usuarios");
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo actualizar el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <section className="nuevo-usuario-page">
        <p>Cargando usuario...</p>
      </section>
    );
  }

  if (error && !formulario.nombre) {
    return (
      <section className="nuevo-usuario-page">
        <div className="nuevo-usuario-error">{error}</div>

        <button
          className="nuevo-usuario-cancelar"
          type="button"
          onClick={() => navigate("/usuarios")}
        >
          Volver a usuarios
        </button>
      </section>
    );
  }

  return (
    <section className="nuevo-usuario-page">
      <div className="nuevo-usuario-header">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>

          <h1>Editar usuario</h1>

          <p>Modifica la información y permisos de esta cuenta.</p>
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

          <p>Actualiza los datos básicos del usuario.</p>

          <div className="nuevo-usuario-grid">
            <div className="form-group">
              <label htmlFor="nombre">Nombre</label>

              <input
                id="nombre"
                name="nombre"
                type="text"
                value={formulario.nombre}
                onChange={handleChange}
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
                required
              />
            </div>
          </div>
        </div>

        <div className="nuevo-usuario-section">
          <h2>Acceso y permisos</h2>

          <p>Modifica el rol y departamento del usuario.</p>

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
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default EditarUsuario;
