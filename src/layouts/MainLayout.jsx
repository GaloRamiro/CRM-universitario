import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

function MainLayout() {
  return (
    <div className="app">
      <Sidebar />

      <div className="main">
        <Header />

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;