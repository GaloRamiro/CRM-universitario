function Header() {
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
      </div>
    </header>
  );
}

export default Header;