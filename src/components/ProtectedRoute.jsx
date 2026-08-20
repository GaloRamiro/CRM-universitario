import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function ProtectedRoute() {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    const obtenerSesion = async () => {
      const { data } = await supabase.auth.getSession();

      setSesion(data.session);
      setCargando(false);
    };

    obtenerSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      setCargando(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (cargando) {
    return <p>Verificando sesión...</p>;
  }

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;