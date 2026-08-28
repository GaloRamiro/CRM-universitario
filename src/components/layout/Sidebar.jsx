import { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

function Sidebar({ mobileOpen = false, onClose }) {
  const [colapsado, setColapsado] = useState(false);

  const cerrarMenuMovil = () => {
    if (onClose) {
      onClose();
    }
  };

  const obtenerClaseLink = ({ isActive }) =>
    `nav-link ${isActive ? "nav-link-activo" : ""}`;

  return (
    <aside
      className={`sidebar ${
        colapsado ? "sidebar-colapsado" : ""
      } ${mobileOpen ? "sidebar-open" : ""}`}
    >
      {/* =====================================================
          MARCA
      ====================================================== */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <span>GC</span>
        </div>

        <div className="brand-text">
          <h1>CRM Universitario</h1>
          <span>Gestión de tareas</span>
        </div>

        {/* Cerrar menú en móvil */}
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={cerrarMenuMovil}
          aria-label="Cerrar menú"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        {/* Botón colapsar */}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setColapsado(!colapsado)}
          aria-label={
            colapsado
              ? "Expandir menú"
              : "Colapsar menú"
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {colapsado ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <path d="m15 18-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* =====================================================
          NAVEGACIÓN
      ====================================================== */}
      <nav className="sidebar-nav">

        {/* DASHBOARD */}
        <NavLink
          to="/dashboard"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>

          <span>Dashboard</span>
        </NavLink>

        {/* TAREAS */}
        <NavLink
          to="/tareas"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect
              x="5"
              y="3"
              width="14"
              height="18"
              rx="2"
            />
            <path d="M9 8h6" />
            <path d="M9 12h6" />
            <path d="M9 16h4" />
          </svg>

          <span>Tareas</span>
        </NavLink>

        {/* MIS TAREAS */}
        <NavLink
          to="/mis-tareas"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect
              x="5"
              y="4"
              width="14"
              height="16"
              rx="2"
            />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
            <path d="M8 17h4" />
          </svg>

          <span>Mis tareas</span>
        </NavLink>

        {/* CARGA DE EQUIPO */}
        <NavLink
          to="/carga-equipo"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6" />
            <path d="M14 15c2.8-.5 5.2 1.2 6 4.5" />
          </svg>

          <span>Carga</span>
        </NavLink>

        {/* =================================================
            ADMINISTRACIÓN
        ================================================== */}

        <NavLink
          to="/usuarios"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20c.6-4 2.5-6 6-6s5.4 2 6 6" />
            <path d="M16 11a3 3 0 1 0 0-6" />
            <path d="M16 14c2.8.1 4.5 2 5 5" />
          </svg>

          <span>Usuarios</span>
        </NavLink>

        <NavLink
          to="/departamentos"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M5 21h14" />
            <path d="M7 21V5h10v16" />
            <path d="M9 8h2" />
            <path d="M13 8h2" />
            <path d="M9 12h2" />
            <path d="M13 12h2" />
            <path d="M9 16h2" />
            <path d="M13 16h2" />
          </svg>

          <span>Departamentos</span>
        </NavLink>

        <NavLink
          to="/reportes"
          className={obtenerClaseLink}
          onClick={cerrarMenuMovil}
        >
          <svg
            className="sidebar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M5 20V11" />
            <path d="M10 20V7" />
            <path d="M15 20V4" />
            <path d="M20 20V9" />
          </svg>

          <span>Reportes</span>
        </NavLink>
      </nav>

      {/* =====================================================
          FOOTER
      ====================================================== */}
      <div className="sidebar-footer">
        <span>CRM Universitario</span>
        <small>v1.0</small>
      </div>
    </aside>
  );
}

export default Sidebar;