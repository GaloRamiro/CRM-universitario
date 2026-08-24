import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Usuarios.css";

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarUsuarios = async () => {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id,
        nombre,
        apellido,
        email,
        rol,
        activo,
        departamentos (
          nombre
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando usuarios:", error);
      setError("No se pudieron cargar los usuarios.");
      setUsuarios([]);
    } else {
      setUsuarios(data || []);
    }

    setCargando(false);
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return (
    <section className="usuarios-page">
      <div className="usuarios-header">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Usuarios</h1>
          <p>Administra los usuarios y permisos del sistema.</p>
        </div>

        <button className="usuarios-btn" type="button">
          + Nuevo usuario
        </button>
      </div>

      <div className="usuarios-card">
        <div className="usuarios-card-header">
          <div>
            <h2>Usuarios registrados</h2>
            <p>Gestiona las cuentas que tienen acceso al CRM.</p>
          </div>

          <div className="usuarios-search">
            <input
              type="text"
              placeholder="Buscar usuario..."
            />
          </div>
        </div>

        <div className="usuarios-table-container">
          {cargando && (
            <p>Cargando usuarios...</p>
          )}

          {error && (
            <p>{error}</p>
          )}

          {!cargando && !error && (
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => {
                  const inicial = usuario.nombre
                    ? usuario.nombre.charAt(0).toUpperCase()
                    : "U";

                  return (
                    <tr key={usuario.id}>
                      <td>
                        <div className="usuario-cell">
                          <div className="usuario-avatar">
                            {inicial}
                          </div>

                          <div>
                            <strong>
                              {usuario.nombre} {usuario.apellido}
                            </strong>

                            <span>
                              Usuario del sistema
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{usuario.email}</td>

                      <td>
                        <span
                          className={`rol-badge ${
                            usuario.rol === "admin"
                              ? "rol-admin"
                              : ""
                          }`}
                        >
                          {usuario.rol}
                        </span>
                      </td>

                      <td>
                        {usuario.departamentos?.nombre ||
                          "Sin departamento"}
                      </td>

                      <td>
                        <span
                          className={`estado-badge ${
                            usuario.activo ? "activo" : ""
                          }`}
                        >
                          {usuario.activo
                            ? "Activo"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <button
                          className="accion-btn"
                          type="button"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!cargando && !error && usuarios.length === 0 && (
            <p>No existen usuarios registrados.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default Usuarios;
