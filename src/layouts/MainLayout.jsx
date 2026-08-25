import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

import "./MainLayout.css";

function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const abrirMenu = () => {
    setMobileOpen(true);
  };

  const cerrarMenu = () => {
    setMobileOpen(false);
  };

  return (
    <div className="main-layout">

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={cerrarMenu}
      />

      <div className="main-content">

        <Header
          onMenuClick={abrirMenu}
        />

        <main className="page-content">
          <Outlet />
        </main>

      </div>

      {mobileOpen && (
        <button
          type="button"
          className="mobile-overlay"
          onClick={cerrarMenu}
          aria-label="Cerrar menú"
        />
      )}

    </div>
  );
}

export default MainLayout;