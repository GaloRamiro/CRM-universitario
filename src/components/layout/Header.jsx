import { supabase } from "../../lib/supabase";
import "./Header.css";

function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="header">
      <div className="header-title">
        <h2>Panel de gestión</h2>
        <p>
          Administra y controla los requerimientos de tu equipo.
        </p>
      </div>

      <div className="header-user">
        <div className="user-avatar">G</div>

        <div className="user-info">
          <strong>Usuario</strong>
          <span>Administrador</span>
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