import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import "./Header.css";

function Header({ onMenuClick }) {
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const [usuarioBD, setUsuarioBD] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const email = user?.email || "Usuario";
  const inicial = email.charAt(0).toUpperCase();

  // =========================================================
  // OBTENER USUARIO DE LA TABLA usuarios
  // =========================================================

  useEffect(() => {
    if (!user?.email) return;

    const cargarUsuarioBD = async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, email")
        .eq("email", user.email)
        .maybeSingle();

      if (error) {
        console.error("Error cargando usuario:", error);
        return;
      }

      console.log("Usuario encontrado en BD:", data);

      setUsuarioBD(data);
    };

    cargarUsuarioBD();
  }, [user]);

  // =========================================================
  // CARGAR NOTIFICACIONES
  // =========================================================

  useEffect(() => {
    if (!usuarioBD?.id) return;

    const cargarNotificaciones = async () => {
      console.log("Cargando notificaciones para usuario:", usuarioBD.id);

      const { data, error } = await supabase
        .from("notificaciones")
        .select(
          "id, usuario_id, tarea_id, tipo, titulo, mensaje, leida, fecha_creacion, fecha_lectura",
        )
        .eq("usuario_id", usuarioBD.id)
        .order("fecha_creacion", {
          ascending: false,
        })
        .limit(10);

      if (error) {
        console.error("Error cargando notificaciones:", error);
        return;
      }

      console.log("Notificaciones encontradas:", data);

      setNotificaciones(data || []);
    };

    cargarNotificaciones();

    // =========================================================
    // TIEMPO REAL
    // =========================================================

    const canal = supabase
      .channel(`notificaciones-${usuarioBD.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${usuarioBD.id}`,
        },
        (payload) => {
          console.log("Nueva notificación recibida:", payload.new);

          setNotificaciones((actuales) => {
            const existe = actuales.some(
              (notificacion) => notificacion.id === payload.new.id,
            );

            if (existe) {
              return actuales;
            }

            return [payload.new, ...actuales].slice(0, 10);
          });
        },
      )
      .subscribe((status) => {
        console.log("Estado canal notificaciones:", status);
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [usuarioBD]);

  // =========================================================
  // MARCAR COMO LEÍDA
  // =========================================================

  const marcarComoLeida = async (id) => {
    const { error } = await supabase
      .from("notificaciones")
      .update({
        leida: true,
        fecha_lectura: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error marcando notificación:", error);
      return;
    }

    setNotificaciones((actuales) =>
      actuales.map((notificacion) =>
        notificacion.id === id
          ? {
              ...notificacion,
              leida: true,
              fecha_lectura: new Date().toISOString(),
            }
          : notificacion,
      ),
    );
  };
  const abrirNotificacion = async (notificacion) => {
    await marcarComoLeida(notificacion.id);

    setMostrarNotificaciones(false);

    if (notificacion.tarea_id) {
      navigate(`/tareas/${notificacion.tarea_id}/editar`);
    }
  };
  // =========================================================
  // CONTADOR
  // =========================================================

  const noLeidas = notificaciones.filter(
    (notificacion) => !notificacion.leida,
  ).length;

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className="header-title">
          <h2>Panel de gestión</h2>

          <p>Administra y controla los requerimientos de tu equipo.</p>
        </div>
      </div>

      <div className="header-user">
        {/* =================================================
            NOTIFICACIONES
        ================================================= */}

        <div className="notification-wrapper">
          <button
            type="button"
            className="notification-button"
            onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
            aria-label="Notificaciones"
          >
            <span className="notification-icon">🔔</span>

            {noLeidas > 0 && (
              <span className="notification-badge">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </button>

          {mostrarNotificaciones && (
            <div className="notification-panel">
              <div className="notification-header">
                <div>
                  <strong>Notificaciones</strong>

                  <span>{noLeidas} sin leer</span>
                </div>
              </div>

              <div className="notification-list">
                {notificaciones.length === 0 ? (
                  <div className="notification-empty">
                    <span>🔔</span>

                    <p>No tienes notificaciones.</p>
                  </div>
                ) : (
                  notificaciones.map((notificacion) => (
                    <button
                      key={notificacion.id}
                      type="button"
                      className={`notification-item ${
                        !notificacion.leida ? "notification-unread" : ""
                      }`}
                      onClick={() => abrirNotificacion(notificacion)}
                    >
                      <div className="notification-item-icon">📋</div>

                      <div className="notification-item-content">
                        <strong>
                          {notificacion.titulo || "Nueva notificación"}
                        </strong>

                        <p>
                          {notificacion.mensaje ||
                            "Tienes una nueva actividad."}
                        </p>

                        <small>
                          {notificacion.fecha_creacion
                            ? new Date(
                                notificacion.fecha_creacion,
                              ).toLocaleString("es-EC", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : ""}
                        </small>
                      </div>

                      {!notificacion.leida && (
                        <span className="notification-dot"></span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            USUARIO
        ================================================= */}

        <div className="user-avatar">{inicial}</div>

        <div className="user-info">
          <strong>
            {usuarioBD
              ? `${usuarioBD.nombre || ""} ${usuarioBD.apellido || ""}`.trim()
              : "Usuario"}
          </strong>

          <span>{email}</span>
        </div>

        <button className="logout-button" onClick={handleLogout} type="button">
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

export default Header;
