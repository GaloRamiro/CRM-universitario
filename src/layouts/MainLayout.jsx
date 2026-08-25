import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import "./MainLayout.css";

function MainLayout() {
  return (
    <div className="main-layout">

      <Sidebar />

      <main className="main-content">

        <Header />

        <div className="main-page">
          <Outlet />
        </div>

      </main>

    </div>
  );
}

export default MainLayout;

