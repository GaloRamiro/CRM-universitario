import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MessageCircle,
  Pencil,
  UserRound,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import { supabase } from "../../lib/supabase";

import "./Header.css";

function Header({ onMenuClick }) {
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const notificationRef = useRef(null);

  const [usuarioBD, setUsuarioBD] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotificaciones, setMostrarNotificaciones] =
    useState(false);

  const [nuevaNotificacionId, setNuevaNotificacionId] =
    useState(null);

  // =========================================================
  // CERRAR SESIÓN
  // =========================================================

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
      console.log(
        "Cargando notificaciones para usuario:",
        usuarioBD.id
      );

      const { data, error } = await supabase
        .from("notificaciones")
        .select(
          "id, usuario_id, tarea_id, tipo, titulo, mensaje, leida, fecha_creacion, fecha_lectura"
        )
        .eq("usuario_id", usuarioBD.id)
        .order("fecha_creacion", {
          ascending: false,
        })
        .limit(10);

      if (error) {
        console.error(
          "Error cargando notificaciones:",
          error
        );
        return;
      }

      console.log(
        "Notificaciones encontradas:",
        data
      );

      setNotificaciones(data || []);
    };

    cargarNotificaciones();

    // =======================================================
    // TIEMPO REAL
    // =======================================================

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
          console.log(
            "Nueva notificación recibida:",
            payload.new
          );

          setNuevaNotificacionId(payload.new.id);

          setNotificaciones((actuales) => {
            const existe = actuales.some(
              (notificacion) =>
                notificacion.id === payload.new.id
            );

            if (existe) {
              return actuales;
            }

            return [
              payload.new,
              ...actuales,
            ].slice(0, 10);
          });

          // La animación dura unos segundos
          setTimeout(() => {
            setNuevaNotificacionId(null);
          }, 3000);
        }
      )
      .subscribe((status) => {
        console.log(
          "Estado canal notificaciones:",
          status
        );
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [usuarioBD]);

  // =========================================================
  // CERRAR AL HACER CLICK FUERA
  // =========================================================

  useEffect(() => {
    const manejarClickFuera = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setMostrarNotificaciones(false);
      }
    };

    document.addEventListener(
      "mousedown",
      manejarClickFuera
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        manejarClickFuera
      );
    };
  }, []);

  // =========================================================
  // CERRAR CON ESC
  // =========================================================

  useEffect(() => {
    const manejarTecla = (event) => {
      if (event.key === "Escape") {
        setMostrarNotificaciones(false);
      }
    };

    document.addEventListener(
      "keydown",
      manejarTecla
    );

    return () => {
      document.removeEventListener(
        "keydown",
        manejarTecla
      );
    };
  }, []);

  // =========================================================
  // MARCAR UNA NOTIFICACIÓN COMO LEÍDA
  // =========================================================

  const marcarComoLeida = async (id) => {
    const fechaLectura = new Date().toISOString();

    const { error } = await supabase
      .from("notificaciones")
      .update({
        leida: true,
        fecha_lectura: fechaLectura,
      })
      .eq("id", id)
      .eq("usuario_id", usuarioBD.id);

    if (error) {
      console.error(
        "Error marcando notificación:",
        error
      );
      return;
    }

    setNotificaciones((actuales) =>
      actuales.map((notificacion) =>
        notificacion.id === id
          ? {
              ...notificacion,
              leida: true,
              fecha_lectura: fechaLectura,
            }
          : notificacion
      )
    );
  };

  // =========================================================
  // MARCAR TODAS COMO LEÍDAS
  // =========================================================

  const marcarTodasComoLeidas = async () => {
    if (!usuarioBD?.id || noLeidas === 0) {
      return;
    }

    const fechaLectura = new Date().toISOString();

    const { error } = await supabase
      .from("notificaciones")
      .update({
        leida: true,
        fecha_lectura: fechaLectura,
      })
      .eq("usuario_id", usuarioBD.id)
      .eq("leida", false);

    if (error) {
      console.error(
        "Error marcando todas como leídas:",
        error
      );
      return;
    }

    setNotificaciones((actuales) =>
      actuales.map((notificacion) => ({
        ...notificacion,
        leida: true,
        fecha_lectura: fechaLectura,
      }))
    );
  };

  // =========================================================
  // ABRIR NOTIFICACIÓN
  // =========================================================

  const abrirNotificacion = async (notificacion) => {
    if (!notificacion.leida) {
      await marcarComoLeida(notificacion.id);
    }

    setMostrarNotificaciones(false);

    if (notificacion.tarea_id) {
      navigate(
        `/tareas/${notificacion.tarea_id}/editar`
      );
    }
  };

  // =========================================================
  // ICONO SEGÚN TIPO DE NOTIFICACIÓN
  // =========================================================

  const obtenerIconoNotificacion = (tipo) => {
    switch (tipo) {
      case "tarea_asignada":
        return (
          <ClipboardList
            size={17}
            strokeWidth={2}
          />
        );

      case "tarea_actualizada":
        return (
          <Pencil
            size={17}
            strokeWidth={2}
          />
        );

      case "tarea_completada":
        return (
          <CheckCircle2
            size={17}
            strokeWidth={2}
          />
        );

      case "tarea_reasignada":
        return (
          <UserRound
            size={17}
            strokeWidth={2}
          />
        );

      case "comentario":
        return (
          <MessageCircle
            size={17}
            strokeWidth={2}
          />
        );

      default:
        return (
          <Bell
            size={17}
            strokeWidth={2}
          />
        );
    }
  };

  // =========================================================
  // CONTADOR
  // =========================================================

  const noLeidas = notificaciones.filter(
    (notificacion) => !notificacion.leida
  ).length;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <header className="header">

      {/* =====================================================
          HEADER LEFT
      ===================================================== */}

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

          <p>
            Administra y controla los requerimientos
            de tu equipo.
          </p>
        </div>

      </div>

      {/* =====================================================
          HEADER USER
      ===================================================== */}

      <div className="header-user">

        {/* ===================================================
            NOTIFICACIONES
        =================================================== */}

        <div
          className="notification-wrapper"
          ref={notificationRef}
        >

          {/* BOTÓN CAMPANA */}

          <button
            type="button"
            className={`notification-button ${
              nuevaNotificacionId
                ? "notification-bell-active"
                : ""
            }`}
            onClick={() =>
              setMostrarNotificaciones(
                !mostrarNotificaciones
              )
            }
            aria-label="Notificaciones"
            aria-expanded={mostrarNotificaciones}
          >
            <span className="notification-icon">
              <Bell
                size={19}
                strokeWidth={2}
              />
            </span>

            {noLeidas > 0 && (
              <span className="notification-badge">
                {noLeidas > 9
                  ? "9+"
                  : noLeidas}
              </span>
            )}
          </button>

          {/* PANEL */}

          {mostrarNotificaciones && (
            <div className="notification-panel">

              {/* =============================================
                  CABECERA DEL PANEL
              ============================================= */}

              <div className="notification-header">

                <div>
                  <strong>
                    Notificaciones
                  </strong>

                  <span>
                    {noLeidas === 0
                      ? "Todo al día"
                      : `${noLeidas} sin leer`}
                  </span>
                </div>

                {noLeidas > 0 && (
                  <button
                    type="button"
                    className="notification-read-all"
                    onClick={
                      marcarTodasComoLeidas
                    }
                  >
                    Marcar todas
                  </button>
                )}

              </div>

              {/* =============================================
                  LISTA
              ============================================= */}

              <div className="notification-list">

                {notificaciones.length === 0 ? (

                  /* ESTADO VACÍO */

                  <div className="notification-empty">

                    <span className="notification-empty-icon">
                      <Inbox
                        size={28}
                        strokeWidth={1.8}
                      />
                    </span>

                    <strong>
                      Todo tranquilo
                    </strong>

                    <p>
                      No tienes notificaciones
                      nuevas.
                    </p>

                  </div>

                ) : (

                  /* NOTIFICACIONES */

                  notificaciones.map(
                    (notificacion) => (

                      <button
                        key={notificacion.id}
                        type="button"
                        className={`notification-item ${
                          !notificacion.leida
                            ? "notification-unread"
                            : ""
                        } ${
                          nuevaNotificacionId ===
                          notificacion.id
                            ? "notification-new"
                            : ""
                        }`}
                        onClick={() =>
                          abrirNotificacion(
                            notificacion
                          )
                        }
                      >

                        {/* ICONO */}

                        <div className="notification-item-icon">
                          {obtenerIconoNotificacion(
                            notificacion.tipo
                          )}
                        </div>

                        {/* CONTENIDO */}

                        <div className="notification-item-content">

                          <strong>
                            {notificacion.titulo ||
                              "Nueva notificación"}
                          </strong>

                          <p>
                            {notificacion.mensaje ||
                              "Tienes una nueva actividad."}
                          </p>

                          <small>
                            {notificacion.fecha_creacion
                              ? new Date(
                                  notificacion.fecha_creacion
                                ).toLocaleString(
                                  "es-EC",
                                  {
                                    dateStyle:
                                      "short",
                                    timeStyle:
                                      "short",
                                  }
                                )
                              : ""}
                          </small>

                        </div>

                        {/* PUNTO NO LEÍDO */}

                        {!notificacion.leida && (
                          <span className="notification-dot"></span>
                        )}

                      </button>
                    )
                  )
                )}

              </div>

            </div>
          )}

        </div>

        {/* ===================================================
            AVATAR
        =================================================== */}

        <div className="user-avatar">
          {inicial}
        </div>

        {/* ===================================================
            INFORMACIÓN USUARIO
        =================================================== */}

        <div className="user-info">

          <strong>
            {usuarioBD
              ? `${usuarioBD.nombre || ""} ${
                  usuarioBD.apellido || ""
                }`.trim()
              : "Usuario"}
          </strong>

          <span>
            {email}
          </span>

        </div>

        {/* ===================================================
            CERRAR SESIÓN
        =================================================== */}

        <button
          className="logout-button"
          onClick={handleLogout}
          type="button"
        >
          <span>Cerrar sesión</span>
        </button>

      </div>

    </header>
  );
}

export default Header;