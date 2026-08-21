import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id,
        nombre,
        apellido,
        email,
        rol,
        activo,
        departamento_id
      `)
      .eq("auth_user_id", authUser.id)
      .single();

    if (error) {
      console.error("Error cargando perfil:", error);
      setProfile(null);
      return;
    }

    setProfile(data);
  };

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const authUser = session?.user ?? null;

      setUser(authUser);

      if (authUser) {
        await cargarPerfil(authUser);
      } else {
        setProfile(null);
      }

      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;

      setUser(authUser);

      if (authUser) {
        await cargarPerfil(authUser);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}