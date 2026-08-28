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

  const [contadorPendientes, setContadorPendientes] = useState(0);
  const [contadorProceso, setContadorProceso] = useState(0);
  const [contadorPausadas, setContadorPausadas] = useState(0);

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  const [paginaActual, setPaginaActual] = useState(0);
  const TAREAS_POR_PAGINA = 5;

  // =========================================================
  // RELOJ EN TIEMPO REAL
  // =========================================================

  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAhora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

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
      // 1. USUARIO AUTENTICADO
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
      // 2. USUARIO EN TABLA usuarios
      // -------------------------------------------------------

      const { data: usuarioData, error: usuarioError } =
        await supabase
          .from("usuarios")
          .select(
            "id, nombre, apellido, email, activo, auth_user_id"
          )
          .eq("auth_user_id", user.id)
          .single();

      if (usuarioError || !usuarioData) {
        console.error("Error buscando usuario:", usuarioError);

        throw new Error(
          "No se encontró el usuario asociado a la sesión actual."
        );
      }

      setUsuarioActual(usuarioData);

      // -------------------------------------------------------
      // 3. TAREAS DEL USUARIO
      // -------------------------------------------------------

      const { data: tareasData, error: tareasError } =
        await supabase
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
    } catch (err) {
      console.error(err);

      setError(
        err.message || "No se pudieron cargar tus tareas."
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // PAUSAS
  // =========================================================

  const obtenerDatosPausa = (tarea) => {
    try {
      const datos = localStorage.getItem(
        `tarea_pausa_${tarea.id}`
      );

      if (!datos) {
        return null;
      }

      return JSON.parse(datos);
    } catch {
      return null;
    }
  };

  const estaPausada = (tarea) => {
    if (!tarea) {
      return false;
    }

    if (tarea.estado !== "pendiente") {
      return false;
    }

    return Boolean(
      localStorage.getItem(`tarea_pausa_${tarea.id}`)
    );
  };

  // =========================================================
  // ESTADO VISUAL
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
  // TAREAS ACTIVAS
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
  }, [tareas, ahora]);

  // =========================================================
  // CONTADORES
  // =========================================================

  const cantidades = useMemo(() => {
    const pendientes = misTareasActivas.filter(
      (tarea) =>
        obtenerEstadoVisual(tarea) === "pendiente"
    ).length;

    const enProceso = misTareasActivas.filter(
      (tarea) =>
        obtenerEstadoVisual(tarea) === "en_proceso"
    ).length;

    const pausadas = misTareasActivas.filter(
      (tarea) =>
        obtenerEstadoVisual(tarea) === "pausada"
    ).length;

    return {
      pendientes,
      enProceso,
      pausadas,
    };
  }, [misTareasActivas]);

  // =========================================================
  // ANIMACIÓN CONTADORES
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

      const incremento =
        valorFinal / (duracion / 20);

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
  // PAGINACIÓN
  // =========================================================

  const totalPaginas = Math.ceil(
    misTareasActivas.length / TAREAS_POR_PAGINA
  );

  const tareasPagina = useMemo(() => {
    const inicio =
      paginaActual * TAREAS_POR_PAGINA;

    return misTareasActivas.slice(
      inicio,
      inicio + TAREAS_POR_PAGINA
    );
  }, [misTareasActivas, paginaActual]);

  useEffect(() => {
    if (
      paginaActual >= totalPaginas &&
      totalPaginas > 0
    ) {
      setPaginaActual(totalPaginas - 1);
    }

    if (
      totalPaginas === 0 &&
      paginaActual !== 0
    ) {
      setPaginaActual(0);
    }
  }, [totalPaginas, paginaActual]);

  const paginaAnterior = () => {
    setPaginaActual((actual) =>
      actual > 0 ? actual - 1 : actual
    );
  };

  const paginaSiguiente = () => {
    setPaginaActual((actual) =>
      actual < totalPaginas - 1
        ? actual + 1
        : actual
    );
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const formatearFecha = (fechaTexto) => {
    if (!fechaTexto) {
      return "Sin fecha";
    }

    const fecha = new Date(
      `${fechaTexto}T00:00:00`
    );

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
  // HORA
  // =========================================================

  const formatearHora = (hora) => {
    if (!hora) {
      return "--:--";
    }

    return hora.slice(0, 5);
  };

  // =========================================================
  // NOMBRES
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

  // =========================================================
  // TIEMPO TRABAJADO
  // =========================================================

  const obtenerTiempoTrabajadoSegundos = (tarea) => {
    const minutosGuardados =
      Number(tarea.tiempo_trabajado_min) || 0;

    let segundos = minutosGuardados * 60;

    const estado = obtenerEstadoVisual(tarea);

    // EN PROCESO
    if (
      estado === "en_proceso" &&
      tarea.inicio_real
    ) {
      const inicio = new Date(
        tarea.inicio_real
      ).getTime();

      if (!Number.isNaN(inicio)) {
        const segundosActuales = Math.max(
          0,
          Math.floor((ahora - inicio) / 1000)
        );

        segundos += segundosActuales;
      }
    }

    // PAUSADA
    if (estado === "pausada") {
      const datosPausa = obtenerDatosPausa(tarea);

      if (
        datosPausa &&
        Number.isFinite(
          Number(
            datosPausa.tiempoTrabajadoSegundos
          )
        )
      ) {
        segundos =
          Number(
            datosPausa.tiempoTrabajadoSegundos
          );
      }
    }

    return segundos;
  };

  const formatearTiempo = (segundos) => {
    const total = Math.max(
      0,
      Math.floor(segundos || 0)
    );

    const horas = Math.floor(total / 3600);

    const minutos = Math.floor(
      (total % 3600) / 60
    );

    const segundosRestantes = total % 60;

    return [
      String(horas).padStart(2, "0"),
      String(minutos).padStart(2, "0"),
      String(segundosRestantes).padStart(2, "0"),
    ].join(":");
  };

  // =========================================================
  // FECHA ACTUAL
  // =========================================================

  const obtenerFechaActual = () => {
    const fecha = new Date();

    const año = fecha.getFullYear();

    const mes = String(
      fecha.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
      fecha.getDate()
    ).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
  };

  // =========================================================
  // HORA ACTUAL
  // =========================================================

  const obtenerHoraActual = () => {
    const fecha = new Date();

    const horas = String(
      fecha.getHours()
    ).padStart(2, "0");

    const minutos = String(
      fecha.getMinutes()
    ).padStart(2, "0");

    const segundos = String(
      fecha.getSeconds()
    ).padStart(2, "0");

    return `${horas}:${minutos}:${segundos}`;
  };

  // =========================================================
  // INICIAR
  // =========================================================

  const iniciarTarea = async (tarea) => {
    if (!usuarioActual) {
      return;
    }

    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const fechaActual = obtenerFechaActual();
      const horaActual = obtenerHoraActual();
      const ahoraISO = new Date().toISOString();

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "en_proceso",
            fecha_inicio: fechaActual,
            fecha: fechaActual,
            hora_inicio: horaActual,
            hora_fin: null,
            fecha_fin: null,
            inicio_real: ahoraISO,
            fin_real: null,
            tiempo_trabajado_min: 0,
            estado_ejecucion: "en_proceso",
          })
          .eq("id", tarea.id)
          .eq(
            "responsable_id",
            usuarioActual.id
          );

      if (updateError) {
        throw new Error(
          updateError.message ||
            "No se pudo iniciar la tarea."
        );
      }

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

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
                inicio_real: ahoraISO,
                fin_real: null,
                tiempo_trabajado_min: 0,
                estado_ejecucion:
                  "en_proceso",
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
        err.message ||
          "No se pudo iniciar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // PAUSAR
  // =========================================================

  const pausarTarea = async (tarea) => {
    if (!usuarioActual) {
      return;
    }

    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const segundosTrabajados =
        obtenerTiempoTrabajadoSegundos(tarea);

      const minutosTrabajados = Math.floor(
        segundosTrabajados / 60
      );

      const datosPausa = {
        tiempoTrabajadoSegundos:
          segundosTrabajados,
        pausadaEn:
          new Date().toISOString(),
      };

      // IMPORTANTE:
      // Este mismo dato puede ser leído desde
      // Editar tarea para mantener sincronizados
      // ambos lugares.

      localStorage.setItem(
        `tarea_pausa_${tarea.id}`,
        JSON.stringify(datosPausa)
      );

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "pendiente",
            tiempo_trabajado_min:
              minutosTrabajados,
            estado_ejecucion: "pausada",
          })
          .eq("id", tarea.id)
          .eq(
            "responsable_id",
            usuarioActual.id
          );

      if (updateError) {
        localStorage.removeItem(
          `tarea_pausa_${tarea.id}`
        );

        throw new Error(
          updateError.message ||
            "No se pudo pausar la tarea."
        );
      }

      setTareas((actuales) =>
        actuales.map((item) =>
          item.id === tarea.id
            ? {
                ...item,
                estado: "pendiente",
                tiempo_trabajado_min:
                  minutosTrabajados,
                estado_ejecucion:
                  "pausada",
              }
            : item
        )
      );

      setMensaje(
        `"${tarea.titulo}" fue pausada.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo pausar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // REANUDAR
  // =========================================================

  const reanudarTarea = async (tarea) => {
    if (!usuarioActual) {
      return;
    }

    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const datosPausa =
        obtenerDatosPausa(tarea);

      const segundosAcumulados =
        datosPausa &&
        Number.isFinite(
          Number(
            datosPausa.tiempoTrabajadoSegundos
          )
        )
          ? Number(
              datosPausa.tiempoTrabajadoSegundos
            )
          : Number(
              tarea.tiempo_trabajado_min || 0
            ) * 60;

      const nuevoInicio = new Date(
        Date.now() -
          segundosAcumulados * 1000
      ).toISOString();

      const horaActual =
        obtenerHoraActual();

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "en_proceso",
            inicio_real: nuevoInicio,
            estado_ejecucion:
              "en_proceso",
            hora_inicio:
              tarea.hora_inicio ||
              horaActual,
          })
          .eq("id", tarea.id)
          .eq(
            "responsable_id",
            usuarioActual.id
          );

      if (updateError) {
        throw new Error(
          updateError.message ||
            "No se pudo reanudar la tarea."
        );
      }

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

      setTareas((actuales) =>
        actuales.map((item) =>
          item.id === tarea.id
            ? {
                ...item,
                estado: "en_proceso",
                inicio_real: nuevoInicio,
                estado_ejecucion:
                  "en_proceso",
              }
            : item
        )
      );

      setMensaje(
        `"${tarea.titulo}" reanudada.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo reanudar la tarea."
      );
    } finally {
      setProcesando(null);
    }
  };

  // =========================================================
  // CANCELAR / ELIMINAR
  // =========================================================

  const eliminarTarea = async (tarea) => {
    const confirmar = window.confirm(
      `¿Deseas eliminar la tarea "${tarea.titulo}"?\n\nEsta acción eliminará la tarea de forma permanente.`
    );

    if (!confirmar) {
      return;
    }

    if (!usuarioActual) {
      return;
    }

    setProcesando(tarea.id);
    setError("");
    setMensaje("");

    try {
      const { error: deleteError } =
        await supabase
          .from("tareas")
          .delete()
          .eq("id", tarea.id)
          .eq(
            "responsable_id",
            usuarioActual.id
          );

      if (deleteError) {
        throw new Error(
          deleteError.message ||
            "No se pudo eliminar la tarea."
        );
      }

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

      localStorage.removeItem(
        `tarea_reanudacion_${tarea.id}`
      );

      setTareas((actuales) =>
        actuales.filter(
          (item) => item.id !== tarea.id
        )
      );

      setMensaje(
        `"${tarea.titulo}" fue eliminada.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo eliminar la tarea."
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
    const estado =
      obtenerEstadoVisual(tarea);

    const estaProcesando =
      procesando === tarea.id;

    const tiempoReal =
      obtenerTiempoTrabajadoSegundos(
        tarea
      );

    return (
      <article
        key={tarea.id}
        className={`mi-tarea-card estado-${estado}`}
      >
        {/* CABECERA */}

        <div className="mi-tarea-card-top">
          <div className="mi-tarea-card-titulo">
            <span className="mi-tarea-etiqueta">
              ACTIVIDAD
            </span>

            <h3>
              {tarea.titulo ||
                "Sin título"}
            </h3>
          </div>

          <span
            className={`mi-tarea-estado estado-${estado}`}
          >
            {obtenerNombreEstado(tarea)}
          </span>
        </div>

        {/* INFORMACIÓN PRINCIPAL */}

        <div className="mi-tarea-info">
          <div className="mi-tarea-info-item">
            <span>Fecha</span>

            <strong>
              {formatearFecha(
                tarea.fecha_inicio ||
                  tarea.fecha
              )}
            </strong>
          </div>

          <div className="mi-tarea-info-item">
            <span>Hora</span>

            <strong>
              {formatearHora(
                tarea.hora_inicio
              )}
            </strong>
          </div>

          <div className="mi-tarea-info-item tiempo-real">
            <span>Tiempo</span>

            <strong>
              {formatearTiempo(
                tiempoReal
              )}
            </strong>
          </div>
        </div>

        {/* CRONÓMETRO */}

        {(estado === "en_proceso" ||
          estado === "pausada") && (
          <div
            className={`mi-tarea-cronometro-box ${estado}`}
          >
            <span>
              {estado === "en_proceso"
                ? "● Trabajo en curso"
                : "⏸ Tarea pausada"}
            </span>

            <strong>
              {formatearTiempo(
                tiempoReal
              )}
            </strong>
          </div>
        )}

        {/* ACCIONES */}

        <div className="mi-tarea-footer">
          <button
            type="button"
            className="mi-tarea-btn editar"
            onClick={() =>
              abrirTarea(tarea)
            }
            disabled={estaProcesando}
          >
            ✎ Modificar
          </button>

          {/* PENDIENTE */}

          {estado === "pendiente" && (
            <button
              type="button"
              className="mi-tarea-btn iniciar"
              onClick={() =>
                iniciarTarea(tarea)
              }
              disabled={estaProcesando}
            >
              {estaProcesando
                ? "Procesando..."
                : "▶ Iniciar"}
            </button>
          )}

          {/* PAUSADA */}

          {estado === "pausada" && (
            <button
              type="button"
              className="mi-tarea-btn reanudar"
              onClick={() =>
                reanudarTarea(tarea)
              }
              disabled={estaProcesando}
            >
              {estaProcesando
                ? "Reanudando..."
                : "▶ Reanudar"}
            </button>
          )}

          {/* EN PROCESO */}

          {estado === "en_proceso" && (
            <button
              type="button"
              className="mi-tarea-btn pausar"
              onClick={() =>
                pausarTarea(tarea)
              }
              disabled={estaProcesando}
            >
              {estaProcesando
                ? "Pausando..."
                : "⏸ Pausar"}
            </button>
          )}

          {/* ELIMINAR */}

          <button
            type="button"
            className="mi-tarea-btn eliminar"
            onClick={() =>
              eliminarTarea(tarea)
            }
            disabled={estaProcesando}
          >
            🗑 Eliminar
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

          <p>
            Cargando tus tareas...
          </p>
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
            Gestiona rápidamente tus
            actividades asignadas.
          </p>

          {usuarioActual && (
            <div className="mi-tareas-usuario">
              <span className="mi-tareas-avatar">
                {(
                  (usuarioActual.nombre?.charAt(
                    0
                  ) || "") +
                  (usuarioActual.apellido?.charAt(
                    0
                  ) || "")
                ).toUpperCase()}
              </span>

              <div>
                <small>
                  Usuario
                </small>

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
            onClick={() =>
              navigate("/tareas")
            }
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
          <span>PENDIENTES</span>

          <strong>
            {contadorPendientes}
          </strong>
        </div>

        <div className="mi-tareas-metrica proceso">
          <span>EN PROCESO</span>

          <strong>
            {contadorProceso}
          </strong>
        </div>

        <div className="mi-tareas-metrica pausada">
          <span>PAUSADAS</span>

          <strong>
            {contadorPausadas}
          </strong>
        </div>
      </div>

      {/* LISTADO */}

      <div className="mi-tareas-contenedor">

        <div className="mi-tareas-lista-header">
          <div>
            <span className="mi-tareas-eyebrow">
              ACTIVIDADES ASIGNADAS
            </span>

            <h2>
              Trabajo pendiente
            </h2>
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

            <h3>
              No tienes tareas pendientes
            </h3>

            <p>
              En este momento no tienes
              actividades pendientes,
              pausadas o en proceso.
            </p>

            <button
              type="button"
              className="mi-tareas-btn-principal"
              onClick={() =>
                navigate("/tareas")
              }
            >
              Ver todas las tareas
            </button>
          </div>
        ) : (
          <>
            {/* SLIDER */}

            <div className="mi-tareas-slider">

              <button
                type="button"
                className="mi-tareas-slider-btn anterior"
                onClick={
                  paginaAnterior
                }
                disabled={
                  paginaActual === 0
                }
                aria-label="Página anterior"
              >
                ‹
              </button>

              <div className="mi-tareas-lista">
                {tareasPagina.map(
                  (tarea) =>
                    renderTarea(tarea)
                )}
              </div>

              <button
                type="button"
                className="mi-tareas-slider-btn siguiente"
                onClick={
                  paginaSiguiente
                }
                disabled={
                  paginaActual >=
                  totalPaginas - 1
                }
                aria-label="Página siguiente"
              >
                ›
              </button>
            </div>

            {/* PAGINACIÓN */}

            {totalPaginas > 1 && (
              <div className="mi-tareas-paginacion">

                <button
                  type="button"
                  onClick={
                    paginaAnterior
                  }
                  disabled={
                    paginaActual === 0
                  }
                >
                  Anterior
                </button>

                <div className="mi-tareas-puntos">
                  {Array.from({
                    length: totalPaginas,
                  }).map(
                    (_, indice) => (
                      <button
                        type="button"
                        key={indice}
                        className={
                          indice ===
                          paginaActual
                            ? "activo"
                            : ""
                        }
                        onClick={() =>
                          setPaginaActual(
                            indice
                          )
                        }
                        aria-label={`Ir a página ${
                          indice + 1
                        }`}
                      />
                    )
                  )}
                </div>

                <span>
                  {paginaActual + 1} /{" "}
                  {totalPaginas}
                </span>

                <button
                  type="button"
                  onClick={
                    paginaSiguiente
                  }
                  disabled={
                    paginaActual >=
                    totalPaginas - 1
                  }
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default MisTareas;