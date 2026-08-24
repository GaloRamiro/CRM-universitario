import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Dashboard from "./pages/Dashboard";
import Tareas from "./pages/Tareas";
import NuevaTarea from "./pages/NuevaTarea";
import Usuarios from "./pages/Usuarios";
import Departamentos from "./pages/Departamentos";
import Reportes from "./pages/Reportes";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Página pública */}
        <Route path="/login" element={<Login />} />

        {/* Páginas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>

            {/* Inicio */}
            <Route
              index
              element={<Navigate to="/dashboard" replace />}
            />

            {/* Accesibles para usuarios autenticados */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tareas" element={<Tareas />} />
            <Route path="tareas/nueva" element={<NuevaTarea />} />

            {/* Solo administradores */}
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="departamentos" element={<Departamentos />} />
              <Route path="reportes" element={<Reportes />} />
            </Route>

          </Route>
        </Route>

        {/* Ruta desconocida */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;