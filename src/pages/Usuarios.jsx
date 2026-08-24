import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
        created_at,
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
    <section className="page">
      <span className="eyebrow">ADMINISTRACIÓN</span>

      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>
            Administra los usuarios y permisos del sistema.
          </p>
        </div>

        <button type="button">
          + Nuevo usuario
        </button>
      </div>

      {cargando && <p>Cargando usuarios...</p>}

      {error && <p>{error}</p>}

      {!cargando && !error && (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Departamento</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <strong>
                      {usuario.nombre} {usuario.apellido}
                    </strong>
                  </td>

                  <td>{usuario.email}</td>

                  <td>
                    {usuario.rol}
                  </td>

                  <td>
                    {usuario.departamentos?.nombre || "Sin departamento"}
                  </td>

                  <td>
                    {usuario.activo ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {usuarios.length === 0 && (
            <p>No existen usuarios registrados.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default Usuarios;