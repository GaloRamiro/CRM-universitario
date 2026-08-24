import "./Usuarios.css";

function Usuarios() {
  return (
    <section className="usuarios-page">
      <div className="usuarios-header">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Usuarios</h1>
          <p>Administra los usuarios y permisos del sistema.</p>
        </div>

        <button className="usuarios-btn">
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
              <tr>
                <td>
                  <div className="usuario-cell">
                    <div className="usuario-avatar">A</div>

                    <div>
                      <strong>Administrador</strong>
                      <span>Administrador del sistema</span>
                    </div>
                  </div>
                </td>

                <td>tu-correo-de-prueba@gmail.com</td>

                <td>
                  <span className="rol-badge rol-admin">
                    Administrador
                  </span>
                </td>

                <td>Administración</td>

                <td>
                  <span className="estado-badge activo">
                    Activo
                  </span>
                </td>

                <td>
                  <button className="accion-btn">
                    Editar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Usuarios;