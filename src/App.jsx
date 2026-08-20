import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import Dashboard from "./pages/Dashboard";

import Tareas from "./pages/Tareas";
import NuevaTarea from "./pages/NuevaTarea";
import Usuarios from "./pages/Usuarios";
import Departamentos from "./pages/Departamentos";
import Reportes from "./pages/Reportes";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tareas" element={<Tareas />} />
          <Route path="tareas/nueva" element={<NuevaTarea />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="departamentos" element={<Departamentos />} />
          <Route path="reportes" element={<Reportes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;