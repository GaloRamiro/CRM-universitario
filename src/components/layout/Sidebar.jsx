import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Sidebar() {
  const { profile } = useAuth();

  const esAdministrador = profile?.rol === "admin";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">G</div>

        <div>
          <h1>Gestión</h1>
          <span>Requerimientos</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="nav-link">
          <span>📊</span>
          Dashboard
        </NavLink>

        <NavLink to="/tareas" className="nav-link">
          <span>📋</span>
          Tareas
        </NavLink>

        {esAdministrador && (
          <>
            <NavLink to="/usuarios" className="nav-link">
              <span>👥</span>
              Usuarios
            </NavLink>

            <NavLink to="/departamentos" className="nav-link">
              <span>🏢</span>
              Departamentos
            </NavLink>

            <NavLink to="/reportes" className="nav-link">
              <span>📈</span>
              Reportes
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <span>CRM interno</span>
        <small>v1.0</small>
      </div>
    </aside>
  );
}

export default Sidebar;

