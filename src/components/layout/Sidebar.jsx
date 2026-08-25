import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.css";

function Icon({ children }) {
  return (
    <svg
      className="sidebar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const { profile } = useAuth();

  const [colapsado, setColapsado] = useState(false);

  const esAdministrador = profile?.rol === "admin";

  const linkClass = ({ isActive }) =>
    `nav-link ${isActive ? "nav-link-activo" : ""}`;

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`sidebar
        ${colapsado ? "sidebar-colapsado" : ""}
        ${mobileOpen ? "sidebar-open" : ""}
      `}
    >
      {/* ==========================================
          MARCA
      ========================================== */}

      <div className="sidebar-brand">
        <div className="brand-icon">G</div>

        {!colapsado && (
          <div className="brand-text">
            <h1>Gestión</h1>
            <span>Requerimientos</span>
          </div>
        )}

        {/* BOTÓN COLAPSAR DESKTOP */}

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setColapsado(!colapsado)}
          title={colapsado ? "Expandir menú" : "Ocultar menú"}
          aria-label={
            colapsado ? "Expandir menú" : "Ocultar menú"
          }
        >
          <Icon>
            {colapsado ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </Icon>
        </button>
      </div>

      {/* ==========================================
          NAVEGACIÓN
      ========================================== */}

      <nav className="sidebar-nav">

        {/* DASHBOARD */}

        <NavLink
          to="/dashboard"
          className={linkClass}
          title={colapsado ? "Dashboard" : ""}
          onClick={handleLinkClick}
        >
          <Icon>
            <rect
              x="3"
              y="3"
              width="7"
              height="7"
            />

            <rect
              x="14"
              y="3"
              width="7"
              height="7"
            />

            <rect
              x="3"
              y="14"
              width="7"
              height="7"
            />

            <rect
              x="14"
              y="14"
              width="7"
              height="7"
            />
          </Icon>

          {!colapsado && <span>Dashboard</span>}
        </NavLink>

        {/* TAREAS */}

        <NavLink
          to="/tareas"
          className={linkClass}
          title={colapsado ? "Tareas" : ""}
          onClick={handleLinkClick}
        >
          <Icon>
            <rect
              x="4"
              y="3"
              width="16"
              height="18"
              rx="2"
            />

            <line
              x1="8"
              y1="8"
              x2="16"
              y2="8"
            />

            <line
              x1="8"
              y1="12"
              x2="16"
              y2="12"
            />

            <line
              x1="8"
              y1="16"
              x2="13"
              y2="16"
            />
          </Icon>

          {!colapsado && <span>Tareas</span>}
        </NavLink>

        {/* CARGA DEL EQUIPO */}

        <NavLink
          to="/carga-equipo"
          className={linkClass}
          title={colapsado ? "Carga del equipo" : ""}
          onClick={handleLinkClick}
        >
          <Icon>
            <circle
              cx="9"
              cy="7"
              r="3"
            />

            <circle
              cx="17"
              cy="8"
              r="2.5"
            />

            <path
              d="M3 21v-2a6 6 0 0 1 12 0v2"
            />

            <path
              d="M14 14a5 5 0 0 1 7 4v3"
            />
          </Icon>

          {!colapsado && <span>Carga</span>}
        </NavLink>

        {/* ==========================================
            ADMINISTRACIÓN
        ========================================== */}

        {esAdministrador && (
          <>
            {/* USUARIOS */}

            <NavLink
              to="/usuarios"
              className={linkClass}
              title={colapsado ? "Usuarios" : ""}
              onClick={handleLinkClick}
            >
              <Icon>
                <path
                  d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                />

                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />

                <path
                  d="M22 21v-2a4 4 0 0 0-3-3.87"
                />

                <path
                  d="M16 3.13a4 4 0 0 1 0 7.75"
                />
              </Icon>

              {!colapsado && <span>Usuarios</span>}
            </NavLink>

            {/* DEPARTAMENTOS */}

            <NavLink
              to="/departamentos"
              className={linkClass}
              title={colapsado ? "Departamentos" : ""}
              onClick={handleLinkClick}
            >
              <Icon>
                <path d="M3 21h18" />

                <path
                  d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"
                />

                <path d="M9 7h2" />
                <path d="M13 7h2" />

                <path d="M9 11h2" />
                <path d="M13 11h2" />

                <path d="M9 15h2" />
                <path d="M13 15h2" />
              </Icon>

              {!colapsado && (
                <span>Departamentos</span>
              )}
            </NavLink>

            {/* REPORTES */}

            <NavLink
              to="/reportes"
              className={linkClass}
              title={colapsado ? "Reportes" : ""}
              onClick={handleLinkClick}
            >
              <Icon>
                <line
                  x1="4"
                  y1="19"
                  x2="4"
                  y2="10"
                />

                <line
                  x1="10"
                  y1="19"
                  x2="10"
                  y2="5"
                />

                <line
                  x1="16"
                  y1="19"
                  x2="16"
                  y2="12"
                />

                <line
                  x1="22"
                  y1="19"
                  x2="22"
                  y2="8"
                />
              </Icon>

              {!colapsado && <span>Reportes</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* ==========================================
          FOOTER
      ========================================== */}

      <div className="sidebar-footer">
        {!colapsado ? (
          <>
            <span>CRM interno</span>
            <small>v1.0</small>
          </>
        ) : (
          <small>v1.0</small>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;

