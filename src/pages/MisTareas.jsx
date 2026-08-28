import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./MisTareas.css";

function MisTareas() {
  const navigate = useNavigate();

  const [usuarioActual, setUsuarioActual] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // =========================================================
  // CONTADORES ANIMADOS
  // =========================================================

  const [contadorPendientes, setContadorPendientes] = useState(0);
  const [contadorProceso, setContadorProceso] = useState(0);
  const [contadorPausadas, setContadorPausadas] = useState(0);

  // =========================================================
  // SLIDER
  // =========================================================

  const TAREAS_POR_PAGINA = 5;
  const [paginaActual, setPaginaActual] = useState(1);

  // =========================================================
  // CARGAR INFORMACIÓN
  // =========================================================

  useEffect(() => {
    cargarMisTareas();
  }, []);

  const cargarMisTareas = async () => {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      // -------------------------------------------------------
      // 1. OBTENER USUARIO AUTENTICADO
      // -------------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error("No se pudo verificar la sesión.");
      }

      if (!user) {
        throw new Error("No existe una sesión activa.");
      }

      // -------------------------------------------------------
      // 2. BUSCAR EL USUARIO EN LA TABLA usuarios
      // -------------------------------------------------------

      const { data: usuarioData, error: usuarioError } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, email, activo, auth_user_id")
        .eq("auth_user_id", user.id)
        .single();

      if (usuarioError) {
        console.error("Error buscando usuario:", usuarioError);

        throw new Error(
          "No se encontró el usuario asociado a la sesión actual."
        );
      }

      if (!usuarioData) {
        throw new Error("No se encontró información del usuario.");
      }

      setUsuarioActual(usuarioData);

      // -------------------------------------------------------
      // 3. CARGAR TAREAS DEL USUARIO
      // -------------------------------------------------------

      const { data: tareasData, error: tareasError } = await supabase
        .from("tareas")
        .select(`
          id,
          titulo,
          descripcion,
          fecha,
          fecha_inicio,
          fecha_fin,
          hora_inicio,
          hora_fin,
          prioridad,
          estado,
          responsable_id,
          departamento_id,
          tiempo_estimado,
          inicio_real,
          fin_real,
          tiempo_trabajado_min,
          estado_ejecucion,
          created_at,
          updated_at
        `)
        .eq("responsable_id", usuarioData.id)
        .order("fecha_inicio", { ascending: true })
        .order("hora_inicio", { ascending: true });

      if (tareasError) {
        console.error("Error cargando mis tareas:", tareasError);
        throw new Error("No se pudieron cargar tus tareas.");
      }

      setTareas(tareasData || []);
      setPaginaActual(1);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron cargar tus tareas.");
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // DETECTAR TAREA PAUSADA
  // =========================================================

  const estaPausada = (tarea) => {
    if (!tarea) {
      return false;
    }

    if (tarea.estado !== "pendiente") {
      return false;
    }

    return Boolean(localStorage.getItem(`tarea_pausa_${tarea.id}`));
  };

  // =========================================================
  // ESTADO VISUAL DE LA TAREA
  // =========================================================

  const obtenerEstadoVisual = (tarea) => {
    if (estaPausada(tarea)) {
      return "pausada";
    }

    if (tarea.estado === "en_proceso") {
      return "en_proceso";
    }

    if (tarea.estado === "completada") {
      return "completada";
    }

    if (
      tarea.estado === "cancelada" ||
      tarea.estado === "cancelado"
    ) {
      return "cancelada";
    }

    return "pendiente";
  };

  // =========================================================
  // SOLO TAREAS ACTIVAS
  // =========================================================

  const misTareasActivas = useMemo(() => {
    return tareas.filter((tarea) => {
      const estado = obtenerEstadoVisual(tarea);

      return (
        estado === "pendiente" ||
        estado === "en_proceso" ||
        estado === "pausada"
      );
    });
  }, [tareas]);

  // =========================================================
  // CONTADORES
  // =========================================================

  const cantidades = useMemo(() => {
    const pendientes = misTareasActivas.filter(
      (tarea) => obtenerEstadoVisual(tarea) === "pendiente"
    ).length;

    const enProceso = misTareasActivas.filter(
      (tarea) => obtenerEstadoVisual(tarea) === "en_proceso"
    ).length;

    const pausadas = misTareasActivas.filter(
      (tarea) => obtenerEstadoVisual(tarea) === "pausada"
    ).length;

    return {
      pendientes,
      enProceso,
      pausadas,
    };
  }, [misTareasActivas]);

  // =========================================================
  // ANIMACIÓN DE CONTADORES
  // =========================================================

  useEffect(() => {
    const animarContador = (
      valorFinal,
      setter,
      duracion = 700
    ) => {
      let inicio = 0;

      if (valorFinal === 0) {
        setter(0);
        return;
      }

      const incremento = valorFinal / (duracion / 20);

      const intervalo = setInterval(() => {
        inicio += incremento;

        if (inicio >= valorFinal) {
          setter(valorFinal);
          clearInterval(intervalo);
          return;
        }

        setter(Math.floor(inicio));
      }, 20);

      return () => clearInterval(intervalo);
    };

    const limpiarPendientes = animarContador(
      cantidades.pendientes,
      setContadorPendientes
    );

    const limpiarProceso = animarContador(
      cantidades.enProceso,
      setContadorProceso
    );

    const limpiarPausadas = animarContador(
      cantidades.pausadas,
      setContadorPausadas
    );

    return () => {
      if (limpiarPendientes) limpiarPendientes();
      if (limpiarProceso) limpiarProceso();
      if (limpiarPausadas) limpiarPausadas();
    };
  }, [
    cantidades.pendientes,
    cantidades.enProceso,
    cantidades.pausadas,
  ]);

  // =========================================================
  // PAGINACIÓN / SLIDER
  // =========================================================

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      misTareasActivas.length / TAREAS_POR_PAGINA
    )
  );

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const tareasVisibles = useMemo(() => {
    const inicio =
      (paginaActual - 1) * TAREAS_POR_PAGINA;

    const fin = inicio + TAREAS_POR_PAGINA;

    return misTareasActivas.slice(inicio, fin);
  }, [misTareasActivas, paginaActual]);

  const irPaginaAnterior = () => {
    setPaginaActual((pagina) =>
      Math.max(1, pagina - 1)
    );
  };

  const irPaginaSiguiente = () => {
    setPaginaActual((pagina) =>
      Math.min(totalPaginas, pagina + 1)
    );
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const formatearFecha = (fechaTexto) => {
    if (!fechaTexto) {
      return "Sin fecha";
    }

    const fecha = new Date(`${fechaTexto}T00:00:00`);

    if (Number.isNaN(fecha.getTime())) {
      return "Sin fecha";
    }

    return fecha.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // =========================================================
  // TEXTOS
  // =========================================================

  const obtenerNombreEstado = (tarea) => {
    const estado = obtenerEstadoVisual(tarea);

    const estados = {
      pendiente: "Pendiente",
      en_proceso: "En proceso",
      pausada: "Pausada",
      completada: "Completada",
      cancelada: "Cancelada",
    };

    return estados[estado] || "Pendiente";
  };

  const obtenerNombrePrioridad = (prioridad) => {
    const prioridades = {
      alta: "Alta",
      media: "Media",
      baja: "Baja",
    };

    return prioridades[prioridad] || "Media";
  };

  // =========================================================
  // HORA ACTUAL
  // =========================================================

  const obtenerHoraActual = () => {
    const fecha = new Date();

    const horas = String(fecha.getHours()).padStart(2, "0");
    const minutos = String(fecha.getMinutes()).padStart(2, "0");

    return `${horas}:${minutos}`;
  };

  // =========================================================
  // FECHA ACTUAL
  // =========================================================

  const obtenerFechaActual = () => {
    const fecha = new Date();

    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
  };

  // =========================================================
  // INICIAR TAREA
  // =========================================================

  const iniciarTarea = async (tarea) => {
    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const fechaActual = obtenerFechaActual();
      const horaActual = obtenerHoraActual();

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "en_proceso",
          fecha_inicio: fechaActual,
          fecha: fechaActual,
          hora_inicio: horaActual,
          hora_fin: null,
          fecha_fin: null,
        })
        .eq("id", tarea.id)
        .eq("responsable_id", usuarioActual.id);

      if (updateError) {
        throw new Error(
          updateError.message ||
            "No se pudo iniciar la tarea."
        );
      }

      setTareas((actuales) =>
        actuales.map((item) =>
          item.id === tarea.id
            ? {
                ...item,
                estado: "en_proceso",
                fecha_inicio: fechaActual,
                fecha: fechaActual,
                hora_inicio: horaActual,
                hora_fin: null,
                fecha_fin: null,
              }
            : item
        )
      );

      setMensaje(
        `"${tarea.titulo}" iniciada a las ${horaActual}.`
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || "No se pudo iniciar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // REANUDAR TAREA
  // =========================================================

  const reanudarTarea = async (tarea) => {
    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "en_proceso",
        })
        .eq("id", tarea.id)
        .eq("responsable_id", usuarioActual.id);

      if (updateError) {
        throw new Error(
          updateError.message ||
            "No se pudo reanudar la tarea."
        );
      }

      localStorage.removeItem(`tarea_pausa_${tarea.id}`);

      setTareas((actuales) =>
        actuales.map((item) =>
          item.id === tarea.id
            ? {
                ...item,
                estado: "en_proceso",
              }
            : item
        )
      );

      setMensaje(`"${tarea.titulo}" reanudada.`);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "No se pudo reanudar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // CANCELAR TAREA
  // =========================================================

  const cancelarTarea = async (tarea) => {
    const confirmar = window.confirm(
      `¿Deseas cancelar la tarea "${tarea.titulo}"?\n\nLa tarea dejará de aparecer en "Mis tareas".`
    );

    if (!confirmar) {
      return;
    }

    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "cancelada",
        })
        .eq("id", tarea.id)
        .eq("responsable_id", usuarioActual.id);

      if (updateError) {
        throw new Error(
          updateError.message ||
            "No se pudo cancelar la tarea."
        );
      }

      localStorage.removeItem(`tarea_pausa_${tarea.id}`);
      localStorage.removeItem(
        `tarea_reanudacion_${tarea.id}`
      );

      setTareas((actuales) =>
        actuales.filter(
          (item) => item.id !== tarea.id
        )
      );

      setMensaje(`"${tarea.titulo}" fue cancelada.`);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "No se pudo cancelar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // ABRIR TAREA
  // =========================================================

  const abrirTarea = (tarea) => {
    navigate(`/tareas/${tarea.id}/editar`);
  };

  // =========================================================
  // TARJETA
  // =========================================================

  const renderTarea = (tarea) => {
    const estado = obtenerEstadoVisual(tarea);
    const estaProcesando = procesando === tarea.id;

    return (
      <article
        key={tarea.id}
        className={`mi-tarea-card estado-${estado} prioridad-${
          tarea.prioridad || "media"
        }`}
      >
        {/* PARTE SUPERIOR */}

        <div className="mi-tarea-card-top">
          <div className="mi-tarea-card-titulo">
            <span className="mi-tarea-etiqueta">
              ACTIVIDAD
            </span>

            <h3>
              {tarea.titulo || "Sin título"}
            </h3>

            {tarea.descripcion && (
              <p>{tarea.descripcion}</p>
            )}
          </div>

          <span
            className={`mi-tarea-estado estado-${estado}`}
          >
            {obtenerNombreEstado(tarea)}
          </span>
        </div>

        {/* INFORMACIÓN */}

        <div className="mi-tarea-info">
          <div className="mi-tarea-info-item">
            <span>Fecha</span>

            <strong>
              {formatearFecha(
                tarea.fecha_inicio || tarea.fecha
              )}
            </strong>
          </div>

          <div className="mi-tarea-info-item">
            <span>Horario</span>

            <strong>
              {tarea.hora_inicio || "--:--"}

              {tarea.hora_fin
                ? ` - ${tarea.hora_fin}`
                : ""}
            </strong>
          </div>

          <div className="mi-tarea-info-item">
            <span>Tiempo estimado</span>

            <strong>
              {tarea.tiempo_estimado || 0} min
            </strong>
          </div>

          <div className="mi-tarea-info-item">
            <span>Prioridad</span>

            <strong
              className={`mi-tarea-prioridad prioridad-${
                tarea.prioridad || "media"
              }`}
            >
              {obtenerNombrePrioridad(
                tarea.prioridad
              )}
            </strong>
          </div>
        </div>

        {/* INFORMACIÓN PAUSA */}

        {estado === "pausada" && (
          <div className="mi-tarea-pausa-info">
            <span className="mi-tarea-pausa-icono">
              ⏸
            </span>

            <div>
              <strong>Tarea pausada</strong>

              <span>
                Puedes reanudarla para continuar con el
                trabajo.
              </span>
            </div>
          </div>
        )}

        {/* ACCIONES */}

        <div className="mi-tarea-footer">
          <button
            type="button"
            className="mi-tarea-btn editar"
            onClick={() => abrirTarea(tarea)}
            disabled={estaProcesando}
          >
            ✎ Modificar
          </button>

          {estado === "pendiente" && (
            <button
              type="button"
              className="mi-tarea-btn iniciar"
              onClick={() => iniciarTarea(tarea)}
              disabled={estaProcesando}
            >
              {estaProcesando
                ? "Procesando..."
                : "▶ Iniciar"}
            </button>
          )}

          {estado === "pausada" && (
            <button
              type="button"
              className="mi-tarea-btn reanudar"
              onClick={() => reanudarTarea(tarea)}
              disabled={estaProcesando}
            >
              {estaProcesando
                ? "Reanudando..."
                : "▶ Reanudar"}
            </button>
          )}

          {estado === "en_proceso" && (
            <button
              type="button"
              className="mi-tarea-btn continuar"
              onClick={() => abrirTarea(tarea)}
              disabled={estaProcesando}
            >
              ⏱ En proceso
            </button>
          )}

          <button
            type="button"
            className="mi-tarea-btn cancelar"
            onClick={() => cancelarTarea(tarea)}
            disabled={estaProcesando}
          >
            Cancelar
          </button>
        </div>
      </article>
    );
  };

  // =========================================================
  // CARGANDO
  // =========================================================

  if (cargando) {
    return (
      <section className="mi-tareas-page">
        <div className="mi-tareas-loading">
          <span className="mi-tareas-loader" />
          <p>Cargando tus tareas...</p>
        </div>
      </section>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="mi-tareas-page">

      {/* HEADER */}

      <div className="mi-tareas-header">
        <div>
          <span className="mi-tareas-eyebrow">
            MI ESPACIO DE TRABAJO
          </span>

          <h1>Mis tareas</h1>

          <p>
            Consulta, inicia y administra las actividades
            que tienes asignadas.
          </p>

          {usuarioActual && (
            <div className="mi-tareas-usuario">
              <span className="mi-tareas-avatar">
                {(
                  (usuarioActual.nombre?.charAt(0) || "") +
                  (usuarioActual.apellido?.charAt(0) || "")
                ).toUpperCase()}
              </span>

              <div>
                <small>Usuario</small>

                <strong>
                  {usuarioActual.nombre}{" "}
                  {usuarioActual.apellido}
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="mi-tareas-header-actions">
          <button
            type="button"
            className="mi-tareas-btn-secundario"
            onClick={cargarMisTareas}
          >
            ↻ Actualizar
          </button>

          <button
            type="button"
            className="mi-tareas-btn-principal"
            onClick={() => navigate("/tareas")}
          >
            Ver calendario
          </button>
        </div>
      </div>

      {/* MENSAJES */}

      {mensaje && (
        <div className="mi-tareas-mensaje">
          <span>✓</span>
          {mensaje}
        </div>
      )}

      {error && (
        <div className="mi-tareas-error">
          <strong>
            No se pudo completar la operación
          </strong>

          <span>{error}</span>

          <button
            type="button"
            onClick={cargarMisTareas}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* CONTADORES */}

      <div className="mi-tareas-resumen">
        <div className="mi-tareas-metrica pendiente">
          <div className="mi-tareas-metrica-top">
            <span>PENDIENTES</span>

            <span className="mi-tareas-metrica-icono">
              ○
            </span>
          </div>

          <strong className="mi-tareas-numero">
            {contadorPendientes}
          </strong>

          <p>
            Tareas que todavía no has iniciado
          </p>
        </div>

        <div className="mi-tareas-metrica proceso">
          <div className="mi-tareas-metrica-top">
            <span>EN PROCESO</span>

            <span className="mi-tareas-metrica-icono">
              ◉
            </span>
          </div>

          <strong className="mi-tareas-numero">
            {contadorProceso}
          </strong>

          <p>
            Actividades actualmente en ejecución
          </p>
        </div>

        <div className="mi-tareas-metrica pausada">
          <div className="mi-tareas-metrica-top">
            <span>PAUSADAS</span>

            <span className="mi-tareas-metrica-icono">
              ⏸
            </span>
          </div>

          <strong className="mi-tareas-numero">
            {contadorPausadas}
          </strong>

          <p>
            Actividades pendientes de reanudación
          </p>
        </div>
      </div>

      {/* LISTADO */}

      <div className="mi-tareas-contenedor">

        <div className="mi-tareas-lista-header">
          <div>
            <span className="mi-tareas-eyebrow">
              ACTIVIDADES ASIGNADAS
            </span>

            <h2>Trabajo pendiente</h2>
          </div>

          <span className="mi-tareas-total">
            {misTareasActivas.length}{" "}
            {misTareasActivas.length === 1
              ? "tarea"
              : "tareas"}
          </span>
        </div>

        {misTareasActivas.length === 0 ? (
          <div className="mi-tareas-vacio">
            <div className="mi-tareas-vacio-icono">
              ✓
            </div>

            <h3>No tienes tareas pendientes</h3>

            <p>
              En este momento no tienes actividades
              pendientes, pausadas o en proceso.
            </p>

            <button
              type="button"
              className="mi-tareas-btn-principal"
              onClick={() => navigate("/tareas")}
            >
              Ver todas las tareas
            </button>
          </div>
        ) : (
          <>
            {/* SLIDER DE TAREAS */}

            <div className="mi-tareas-slider">

              <div className="mi-tareas-lista">
                {tareasVisibles.map((tarea) =>
                  renderTarea(tarea)
                )}
              </div>

            </div>

            {/* CONTROLES DEL SLIDER */}

            {totalPaginas > 1 && (
              <div className="mi-tareas-paginacion">

                <button
                  type="button"
                  className="mi-tareas-paginacion-btn"
                  onClick={irPaginaAnterior}
                  disabled={paginaActual === 1}
                  aria-label="Ver tareas anteriores"
                >
                  <span>‹</span>
                  Anterior
                </button>

                <div className="mi-tareas-paginacion-centro">
                  <span className="mi-tareas-pagina-actual">
                    {paginaActual}
                  </span>

                  <span className="mi-tareas-pagina-separador">
                    /
                  </span>

                  <span className="mi-tareas-pagina-total">
                    {totalPaginas}
                  </span>

                  <span className="mi-tareas-pagina-texto">
                    página
                    {totalPaginas !== 1 ? "s" : ""}
                  </span>
                </div>

                <button
                  type="button"
                  className="mi-tareas-paginacion-btn"
                  onClick={irPaginaSiguiente}
                  disabled={paginaActual === totalPaginas}
                  aria-label="Ver siguientes tareas"
                >
                  Siguiente
                  <span>›</span>
                </button>

              </div>
            )}

            {/* INDICADORES */}

            {totalPaginas > 1 && (
              <div className="mi-tareas-dots">
                {Array.from(
                  { length: totalPaginas },
                  (_, indice) => (
                    <button
                      key={indice}
                      type="button"
                      className={`mi-tareas-dot ${
                        paginaActual === indice + 1
                          ? "activo"
                          : ""
                      }`}
                      onClick={() =>
                        setPaginaActual(indice + 1)
                      }
                      aria-label={`Ir a la página ${
                        indice + 1
                      }`}
                    />
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default MisTareas;