import { useAuth } from "../../context/AuthContext";

import "./Header.css";

function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const email = user?.email || "Usuario";
  const inicial = email.charAt(0).toUpperCase();

  return (
    <header className="header">
      <div className="header-title">
        <h2>Panel de gestión</h2>
        <p>
          Administra y controla los requerimientos de tu equipo.
        </p>
      </div>

      <div className="header-user">
        <div className="user-avatar">
          {inicial}
        </div>

        <div className="user-info">
          <strong>Usuario</strong>
          <span>{email}</span>
        </div>

        <button
          className="logout-button"
          onClick={handleLogout}
          type="button"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

export default Header;