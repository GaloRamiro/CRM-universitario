import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./MisTareas.css";

function MisTareas() {
  const navigate = useNavigate();

  // =========================================================
  // ESTADOS
  // =========================================================

  const [usuario, setUsuario] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [horaActual, setHoraActual] = useState(new Date());

  const [pagina, setPagina] = useState(1);
  const TAREAS_POR_PAGINA = 6;

  // =========================================================
  // POPUP — MOTIVO DE PAUSA
  // =========================================================

  const [mostrarPausa, setMostrarPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [tareaParaPausar, setTareaParaPausar] = useState(null);
  const [mostrarSelectorOtraTarea, setMostrarSelectorOtraTarea] =
    useState(false);
  const [tareaSeleccionadaOtra, setTareaSeleccionadaOtra] = useState(null);

  // =========================================================
  // POPUP — TAREAS AUTO-PAUSADAS DEL DÍA ANTERIOR
  // =========================================================

  const [mostrarAvisoDiaAnterior, setMostrarAvisoDiaAnterior] = useState(false);

  const [tareasAutoPausadasAyer, setTareasAutoPausadasAyer] = useState([]);

  // =========================================================
  // CARGAR HORA
  // =========================================================

  useEffect(() => {
    const intervalo = setInterval(() => {
      setHoraActual(new Date());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  // =========================================================
  // OBTENER FECHA ACTUAL
  // =========================================================

  const obtenerFechaActual = (fecha = new Date()) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
  };

  // =========================================================
  // OBTENER FECHA ANTERIOR
  // =========================================================

  const obtenerFechaAnterior = () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - 1);

    return obtenerFechaActual(fecha);
  };

  // =========================================================
  // OBTENER HORA ACTUAL
  // =========================================================

  const obtenerHoraActual = (fecha = new Date()) => {
    const horas = String(fecha.getHours()).padStart(2, "0");
    const minutos = String(fecha.getMinutes()).padStart(2, "0");
    const segundos = String(fecha.getSeconds()).padStart(2, "0");

    return `${horas}:${minutos}:${segundos}`;
  };

  // =========================================================
  // OBTENER HORA EN FORMATO HH:MM
  // =========================================================

  const obtenerHoraCorta = (fecha = new Date()) => {
    return obtenerHoraActual(fecha).substring(0, 5);
  };

  // =========================================================
  // CARGAR USUARIO
  // =========================================================

  useEffect(() => {
    cargarUsuario();
  }, []);

  const cargarUsuario = async () => {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData?.user) {
        navigate("/login");
        return;
      }

      const { data: usuarioData, error: usuarioError } = await supabase
        .from("usuarios")
        .select(
          `
          id,
          nombre,
          apellido,
          email,
          activo,
          auth_user_id
        `,
        )
        .eq("auth_user_id", authData.user.id)
        .single();

      if (usuarioError) {
        throw usuarioError;
      }

      setUsuario(usuarioData);
    } catch (err) {
      console.error("Error cargando usuario:", err);

      setError("No se pudo cargar la información del usuario.");

      setCargando(false);
    }
  };

  // =========================================================
  // CARGAR TAREAS
  // =========================================================

  useEffect(() => {
    if (!usuario?.id) {
      return;
    }

    cargarTareas();
  }, [usuario?.id]);

  const cargarTareas = async (silencioso = false) => {
    if (!silencioso) setCargando(true);

    try {
      const { data, error: tareasError } = await supabase
        .from("tareas")
        .select(
          `
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
          estado_ejecucion
        `,
        )
        .eq("responsable_id", usuario.id)
        .order("fecha_inicio", {
          ascending: true,
        })
        .order("hora_inicio", {
          ascending: true,
        });

      if (tareasError) {
        throw tareasError;
      }

      setTareas(data || []);
    } catch (err) {
      console.error("Error cargando tareas:", err);

      if (!silencioso)
        setError(err.message || "No se pudieron cargar tus tareas.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  // =========================================================
  // TAREAS ACTIVAS
  // =========================================================

  const tareasActivas = useMemo(() => {
    return tareas.filter((tarea) => tarea.estado !== "completada");
  }, [tareas]);

  // =========================================================
  // TAREAS EN PROCESO
  // =========================================================

  const tareasEnProceso = useMemo(() => {
    return tareas.filter((tarea) => tarea.estado === "en_proceso");
  }, [tareas]);

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  const totalPaginas = Math.max(
    1,
    Math.ceil(tareasActivas.length / TAREAS_POR_PAGINA),
  );

  const tareasVisibles = useMemo(() => {
    const inicio = (pagina - 1) * TAREAS_POR_PAGINA;

    return tareasActivas.slice(inicio, inicio + TAREAS_POR_PAGINA);
  }, [tareasActivas, pagina]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  // =========================================================
  // FORMATEAR DURACIÓN
  // =========================================================

  const formatearDuracion = (minutos) => {
    const valor = Math.max(0, Number(minutos) || 0);

    const totalSegundos = Math.round(valor * 60);

    const horas = Math.floor(totalSegundos / 3600);

    const minutosRestantes = Math.floor((totalSegundos % 3600) / 60);

    const segundos = totalSegundos % 60;

    const hh = String(horas).padStart(2, "0");
    const mm = String(minutosRestantes).padStart(2, "0");
    const ss = String(segundos).padStart(2, "0");

    return `${hh}:${mm}:${ss}`;
  };

  // =========================================================
  // FORMATEAR FECHA
  // =========================================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "Sin fecha";
    }

    const partes = String(fecha).split("-");

    if (partes.length !== 3) {
      return "Sin fecha";
    }

    const fechaLocal = new Date(
      Number(partes[0]),
      Number(partes[1]) - 1,
      Number(partes[2]),
    );

    return fechaLocal.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // =========================================================
  // FORMATEAR HORA
  // =========================================================

  const formatearHora = (hora) => {
    if (!hora) {
      return "--:--";
    }

    return String(hora).substring(0, 5);
  };

  // =========================================================
  // ESTADO HUMANO
  // =========================================================

  const obtenerTextoEstado = (estado) => {
    if (estado === "en_proceso") {
      return "En proceso";
    }

    if (estado === "completada") {
      return "Completada";
    }

    return "Pendiente";
  };

  // =========================================================
  // PRIORIDAD HUMANA
  // =========================================================

  const obtenerTextoPrioridad = (prioridad) => {
    if (prioridad === "alta") {
      return "Alta";
    }

    if (prioridad === "baja") {
      return "Baja";
    }

    return "Media";
  };

  // =========================================================
  // TIEMPO ACUMULADO
  //
  // NO SE REINICIA AL PAUSAR.
  // =========================================================

  const obtenerTiempoAcumulado = (tarea) => {
    return Math.max(0, Number(tarea?.tiempo_trabajado_min) || 0);
  };

  // =========================================================
  // TIEMPO VISUAL
  //
  // EN PROCESO:
  // acumulado + sesión actual.
  //
  // PAUSADA:
  // solamente acumulado.
  //
  // Se actualiza cada segundo porque horaActual
  // cambia cada segundo.
  // =========================================================

  const obtenerTiempoVisual = (tarea) => {
    const acumulado = obtenerTiempoAcumulado(tarea);

    if (
      tarea.estado !== "en_proceso" ||
      tarea.estado_ejecucion !== "en_proceso" ||
      !tarea.inicio_real
    ) {
      return acumulado;
    }

    const inicio = new Date(tarea.inicio_real);
    if (Number.isNaN(inicio.getTime())) {
      return acumulado;
    }

    const ahora = horaActual;

    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(inicio);
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
    const cierreSesion = new Date(`${p.year}-${p.month}-${p.day}T22:00:00Z`);

    const fin =
      inicio.getTime() < cierreSesion.getTime()
        ? Math.min(ahora.getTime(), cierreSesion.getTime())
        : ahora.getTime();

    const minutosSesion = Math.max(0, (fin - inicio.getTime()) / 60000);

    return acumulado + minutosSesion;
  };

  // =========================================================
  // PAUSAR UNA TAREA INTERNAMENTE
  //
  // Esta función se utiliza para:
  //
  // 1. Exclusividad
  // 2. Pausa automática de las 17:00
  //
  // NO REINICIA EL TIEMPO.
  // =========================================================

  const ejecutarAccion = async (
    tareaId,
    accion,
    motivo = null,
    interrumpidaId = null,
  ) => {
    console.log("CRM - Enviando acción:", {
      tareaId,
      accion,
      motivo,
      interrumpidaId,
    });

    const { data, error: rpcError } = await supabase.rpc("crm_accion_tarea", {
      p_tarea_id: tareaId,
      p_accion: accion,
      p_motivo: motivo,
      p_interrumpida_id: interrumpidaId,
    });

    if (rpcError) {
      console.error("CRM - Error Supabase:", {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      });

      throw rpcError;
    }

    console.log("CRM - Acción completada:", {
      id: data?.id,
      estado: data?.estado,
      estado_ejecucion: data?.estado_ejecucion,
      inicio_real: data?.inicio_real,
      tiempo_trabajado_min: data?.tiempo_trabajado_min,
    });

    return data;
  };

  // =========================================================
  // EXCLUSIVIDAD
  //
  // Si existe otra tarea ejecutándose,
  // se pausa automáticamente.
  //
  // Además, se registra la interrupción
  // permanentemente en Supabase para que
  // pueda ser utilizada por Reportes.
  //
  // De esta manera SOLO puede existir
  // UNA tarea en proceso.
  // =========================================================
  // La exclusividad y el historial ahora se gestionan en la RPC transaccional.

  // =========================================================
  // INICIAR TAREA
  //
  // Si existe otra en proceso:
  // SE PAUSA AUTOMÁTICAMENTE.
  // =========================================================

  const iniciarTarea = async (tarea) => {
    if (!tarea || guardando) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await ejecutarAccion(tarea.id, "iniciar");
      await cargarTareas();
      setMensaje(`Tarea "${tarea.titulo}" iniciada correctamente.`);
    } catch (err) {
      setError(err.message || "No se pudo iniciar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // ABRIR POPUP DE PAUSA
  // =========================================================

  const abrirPausa = (tarea) => {
    if (!tarea) {
      return;
    }

    setTareaParaPausar(tarea);
    setMotivoPausa("");
    setError("");
    setMensaje("");
    setMostrarPausa(true);
  };

  // =========================================================
  // CERRAR POPUP DE PAUSA
  // =========================================================

  const cerrarPausa = () => {
    if (guardando) {
      return;
    }

    setMostrarPausa(false);
    setMotivoPausa("");
    setTareaParaPausar(null);
  };

  // =========================================================
  // CONFIRMAR PAUSA MANUAL
  //
  // CONSERVA EL TIEMPO.
  // =========================================================

  const confirmarPausa = async () => {
    if (!tareaParaPausar || guardando) return;
    if (!motivoPausa) {
      setError("Selecciona el motivo de la pausa.");
      return;
    }
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const tareaOrigen = tareaParaPausar;
      const motivo = motivoPausa;
      const pausada = await ejecutarAccion(tareaOrigen.id, "pausar", motivo);
      if (motivo === "tarea_urgente") {
        localStorage.setItem(
          `interrupcion_pendiente_${usuario.id}`,
          JSON.stringify({
            tarea_id: tareaOrigen.id,
            motivo,
            fecha: obtenerFechaActual(),
            hora: obtenerHoraActual(),
          }),
        );
      }
      localStorage.removeItem(`tarea_reanudacion_${tareaOrigen.id}`);
      localStorage.setItem(
        `tarea_pausa_${tareaOrigen.id}`,
        JSON.stringify({
          tarea_id: tareaOrigen.id,
          motivo,
          minutos_acumulados: pausada.tiempo_trabajado_min,
        }),
      );
      setMostrarPausa(false);
      setMotivoPausa("");
      await cargarTareas();
      setMensaje(
        `Tarea "${tareaOrigen.titulo}" pausada. Tiempo acumulado: ${formatearDuracion(pausada.tiempo_trabajado_min)}.`,
      );
      if (motivo === "tarea_urgente") {
        setTareaParaPausar(null);
        navigate("/tareas/nueva");
      } else if (motivo === "otra_tarea") {
        setTareaParaPausar(tareaOrigen);
        setTareaSeleccionadaOtra(null);
        setMostrarSelectorOtraTarea(true);
      } else {
        setTareaParaPausar(null);
      }
    } catch (err) {
      setError(err.message || "No se pudo pausar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // SELECCIONAR OTRA TAREA YA EXISTENTE
  //
  // Para "Para realizar otra tarea" NO se crea una tarea nueva.
  // El usuario selecciona una tarea que ya existe en Mis tareas.
  // Esa tarea será la que genera la interrupción.
  // =========================================================
  const seleccionarOtraTarea = async () => {
    if (!tareaSeleccionadaOtra || !tareaParaPausar || guardando) {
      setError("Selecciona la tarea que vas a realizar.");
      return;
    }
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const origen = tareaParaPausar;
      const destino = tareaSeleccionadaOtra;
      if (String(origen.id) === String(destino.id))
        throw new Error("Selecciona otra tarea.");
      await ejecutarAccion(destino.id, "iniciar", null, origen.id);
      localStorage.removeItem(`tarea_pausa_${origen.id}`);
      setMostrarSelectorOtraTarea(false);
      setTareaSeleccionadaOtra(null);
      setTareaParaPausar(null);
      setMotivoPausa("");
      await cargarTareas();
      setMensaje(
        `Tarea "${destino.titulo}" iniciada. Se registró como interrupción de "${origen.titulo}".`,
      );
    } catch (err) {
      setError(err.message || "No se pudo iniciar la tarea seleccionada.");
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // CANCELAR SELECCIÓN DE OTRA TAREA
  // =========================================================
  const cancelarSeleccionOtraTarea = () => {
    if (guardando) {
      return;
    }

    setMostrarSelectorOtraTarea(false);
    setTareaSeleccionadaOtra(null);
    setTareaParaPausar(null);
    setMotivoPausa("");
    setError("");
  };

  // =========================================================
  // REANUDAR
  //
  // ANTES DE REANUDAR:
  // PAUSA AUTOMÁTICAMENTE LAS OTRAS.
  // =========================================================

  const reanudarTarea = async (tarea) => {
    console.log("BOTÓN REANUDAR PRESIONADO:", {
      id: tarea?.id,
      titulo: tarea?.titulo,
      guardando,
    });

    if (!tarea || guardando) return;

    if (!tarea || guardando) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await ejecutarAccion(tarea.id, "reanudar");
      localStorage.removeItem(`tarea_pausa_${tarea.id}`);
      await cargarTareas();
      setMensaje(`Tarea "${tarea.titulo}" reanudada.`);
    } catch (err) {
      console.error("ERROR AL REANUDAR TAREA:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        tareaId: tarea.id,
      });

      setError(`Error al reanudar: ${err.message || "Error desconocido"}`);
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // TERMINAR TAREA
  // =========================================================

  const terminarTarea = async (tarea) => {
    if (!tarea || guardando) return;
    if (!window.confirm("¿Confirmas que esta tarea ya está terminada?")) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const finalizada = await ejecutarAccion(tarea.id, "terminar");
      localStorage.removeItem(`tarea_pausa_${tarea.id}`);
      localStorage.removeItem(`tarea_reanudacion_${tarea.id}`);
      await cargarTareas();
      setMensaje(
        `Tarea terminada. Tiempo contabilizado: ${formatearDuracion(finalizada.tiempo_trabajado_min)}.`,
      );
    } catch (err) {
      setError(err.message || "No se pudo terminar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // VIGILAR LAS 17:00
  // =========================================================

  /* =========================================================
   SINCRONIZACIÓN CON SUPABASE
   La pausa automática la realiza pg_cron.
   React únicamente consulta el estado actualizado.
========================================================= */

  useEffect(() => {
    if (!usuario?.id) return;

    const sincronizar = () => {
      if (document.visibilityState === "visible") {
        cargarTareas(true);
      }
    };

    const intervalo = setInterval(sincronizar, 60000);

    document.addEventListener("visibilitychange", sincronizar);

    window.addEventListener("focus", sincronizar);

    return () => {
      clearInterval(intervalo);

      document.removeEventListener("visibilitychange", sincronizar);

      window.removeEventListener("focus", sincronizar);
    };
  }, [usuario?.id]);

  // =========================================================
  // DETECTAR TAREAS AUTO-PAUSADAS DEL DÍA ANTERIOR
  //
  // SOLO SE MUESTRA SI REALMENTE EXISTIÓ
  // UNA PAUSA AUTOMÁTICA.
  // =========================================================

  useEffect(() => {
    if (!usuario?.id) return;
    const ayer = obtenerFechaAnterior();
    const clave = `aviso_auto_pausa_${usuario.id}_${ayer}`;
    if (localStorage.getItem(clave)) return;
    let cancelado = false;
    const revisar = async () => {
      const { data, error: consultaError } = await supabase
        .from("tareas")
        .select("id,titulo,tiempo_trabajado_min,fin_real,estado_ejecucion")
        .eq("responsable_id", usuario.id)
        .eq("estado_ejecucion", "pausada")
        .gte("fin_real", `${ayer}T22:00:00Z`)
        .lt("fin_real", `${ayer}T22:00:01Z`);
      if (consultaError || cancelado || !data?.length) return;
      setTareasAutoPausadasAyer(
        data.map((t) => ({
          id: t.id,
          titulo: t.titulo,
          tiempo: t.tiempo_trabajado_min,
        })),
      );
      setMostrarAvisoDiaAnterior(true);
    };
    revisar();
    return () => {
      cancelado = true;
    };
  }, [usuario?.id]);

  const cerrarAvisoDiaAnterior = () => {
    const ayer = obtenerFechaAnterior();
    localStorage.setItem(`aviso_auto_pausa_${usuario.id}_${ayer}`, "1");
    setMostrarAvisoDiaAnterior(false);
    setTareasAutoPausadasAyer([]);
  };

  // =========================================================
  // RENDER TARJETA
  // =========================================================

  const renderTarea = (tarea) => {
    const estaEnProceso = tarea.estado === "en_proceso";

    const estaCompletada = tarea.estado === "completada";

    const estaPausada =
      !estaEnProceso && !estaCompletada && tarea.estado_ejecucion === "pausada";

    const tiempo = obtenerTiempoVisual(tarea);

    return (
      <article
        key={tarea.id}
        className={`mi-tarea-card ${
          estaEnProceso ? "mi-tarea-card-activa" : ""
        }`}
      >
        <div className="mi-tarea-card-top">
          <div>
            <span className="mi-tarea-card-label">TAREA</span>

            <h3>{tarea.titulo}</h3>
          </div>

          <span className={`mi-tarea-estado estado-${tarea.estado}`}>
            {estaPausada ? "Pausada" : obtenerTextoEstado(tarea.estado)}
          </span>
        </div>

        {tarea.descripcion && (
          <p className="mi-tarea-card-description">{tarea.descripcion}</p>
        )}

        <div className="mi-tarea-meta">
          <div className="mi-tarea-meta-item">
            <span>Fecha</span>

            <strong>{formatearFecha(tarea.fecha_inicio || tarea.fecha)}</strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>Horario</span>

            <strong>
              {formatearHora(tarea.hora_inicio)}

              {tarea.hora_fin ? ` - ${formatearHora(tarea.hora_fin)}` : ""}
            </strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>Tiempo trabajado</span>

            <strong className={estaEnProceso ? "tiempo-en-vivo" : ""}>
              {formatearDuracion(tiempo)}
            </strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>Prioridad</span>

            <strong>{obtenerTextoPrioridad(tarea.prioridad)}</strong>
          </div>
        </div>

        <div className="mi-tarea-actions">
          {!estaEnProceso && !estaCompletada && !estaPausada && (
            <button
              type="button"
              className="mi-tarea-btn-iniciar"
              onClick={() => iniciarTarea(tarea)}
              disabled={guardando}
            >
              ▶ Iniciar
            </button>
          )}

          {estaEnProceso && (
            <button
              type="button"
              className="mi-tarea-btn-pausar"
              onClick={() => abrirPausa(tarea)}
              disabled={guardando}
            >
              ⏸ Pausar
            </button>
          )}

          {estaPausada && (
            <button
              type="button"
              className="mi-tarea-btn-reanudar"
              onClick={() => reanudarTarea(tarea)}
              disabled={guardando}
            >
              ▶ Reanudar
            </button>
          )}

          {estaEnProceso && (
            <button
              type="button"
              className="mi-tarea-btn-terminar"
              onClick={() => terminarTarea(tarea)}
              disabled={guardando}
            >
              ✓ Terminar
            </button>
          )}

          <button
            type="button"
            className="mi-tarea-btn-editar"
            onClick={() => navigate(`/tareas/${tarea.id}/editar`)}
          >
            Editar
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
          <span className="loader" />

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
      {/* =====================================================
          ENCABEZADO
      ===================================================== */}

      <div className="mi-tareas-header">
        <div>
          <span className="mi-tareas-eyebrow">CONTROL DE ACTIVIDAD</span>

          <h1>Mis tareas</h1>

          <p>
            Administra tus actividades y registra correctamente el tiempo
            trabajado.
          </p>
        </div>

        <div className="mi-tareas-header-actions">
          <button
            type="button"
            className="mi-tareas-btn mi-tareas-btn-secundario"
            onClick={() => cargarTareas()}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="mi-tareas-btn mi-tareas-btn-secundario"
            onClick={() => navigate("/tareas")}
          >
            Ver tareas
          </button>
        </div>
      </div>

      {/* =====================================================
          USUARIO
      ===================================================== */}

      {usuario && (
        <div className="mi-tareas-usuario">
          <div className="mi-tareas-avatar">
            {(
              (usuario.nombre?.charAt(0) || "") +
              (usuario.apellido?.charAt(0) || "")
            ).toUpperCase()}
          </div>

          <div>
            <span>Usuario actual</span>

            <strong>
              {usuario.nombre} {usuario.apellido}
            </strong>
          </div>
        </div>
      )}

      {/* =====================================================
          CONTADORES
      ===================================================== */}

      <div className="mi-tareas-resumen">
        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">Mis tareas</span>

          <strong className="mi-tareas-stat-number">
            {tareasActivas.length}
          </strong>

          <span className="mi-tareas-stat-text">Actividades activas</span>
        </div>

        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">En proceso</span>

          <strong className="mi-tareas-stat-number">
            {tareasEnProceso.length}
          </strong>

          <span className="mi-tareas-stat-text">Actividades iniciadas</span>
        </div>

        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">Hora actual</span>

          <strong className="mi-tareas-stat-number reloj-actual">
            {horaActual.toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </strong>

          <span className="mi-tareas-stat-text">Tiempo local</span>
        </div>
      </div>

      {/* =====================================================
          MENSAJES
      ===================================================== */}

      {mensaje && <div className="editar-tarea-mensaje">{mensaje}</div>}

      {error && <div className="editar-tarea-error">{error}</div>}

      {/* =====================================================
          TAREAS
      ===================================================== */}

      <div className="mi-tareas-section-header">
        <div>
          <span>ACTIVIDADES</span>

          <h2>Tus tareas</h2>

          <p>Controla el inicio, pausa, reanudación y finalización.</p>
        </div>
      </div>

      {tareasVisibles.length === 0 ? (
        <div className="mi-tareas-empty">
          <strong>No tienes tareas activas</strong>

          <p>Las tareas completadas se conservan en el sistema.</p>
        </div>
      ) : (
        <>
          <div className="mi-tareas-grid">
            {tareasVisibles.map((tarea) => renderTarea(tarea))}
          </div>

          {totalPaginas > 1 && (
            <div className="mi-tareas-paginacion">
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={pagina === 1}
              >
                Anterior
              </button>

              <span>
                Página {pagina} de {totalPaginas}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPagina((actual) => Math.min(totalPaginas, actual + 1))
                }
                disabled={pagina === totalPaginas}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* =====================================================
          POPUP — MOTIVO DE PAUSA
      ===================================================== */}

      {mostrarPausa && (
        <div className="pausa-overlay">
          <div className="pausa-modal">
            <div className="pausa-modal-header">
              <div>
                <span>CONTROL DE ACTIVIDAD</span>

                <h2>¿Por qué estás pausando esta tarea?</h2>

                <p>
                  Selecciona el motivo para registrar correctamente la
                  interrupción.
                </p>
              </div>

              <button
                type="button"
                className="pausa-cerrar"
                onClick={cerrarPausa}
                disabled={guardando}
              >
                ×
              </button>
            </div>

            <div className="pausa-opciones">
              <label
                className={
                  motivoPausa === "otra_tarea"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="otra_tarea"
                  checked={motivoPausa === "otra_tarea"}
                  onChange={(e) => setMotivoPausa(e.target.value)}
                />

                <div>
                  <strong>Para realizar otra tarea</strong>

                  <span>
                    Voy a dejar esta actividad temporalmente para atender otra
                    tarea.
                  </span>
                </div>
              </label>

              <label
                className={
                  motivoPausa === "almuerzo"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="almuerzo"
                  checked={motivoPausa === "almuerzo"}
                  onChange={(e) => setMotivoPausa(e.target.value)}
                />

                <div>
                  <strong>Almuerzo</strong>

                  <span>Pausa correspondiente al horario de alimentación.</span>
                </div>
              </label>

              <label
                className={
                  motivoPausa === "tarea_urgente"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="tarea_urgente"
                  checked={motivoPausa === "tarea_urgente"}
                  onChange={(e) => setMotivoPausa(e.target.value)}
                />

                <div>
                  <strong>Tarea urgente</strong>

                  <span>
                    Debo atender una actividad urgente antes de continuar.
                  </span>
                </div>
              </label>

              <label
                className={
                  motivoPausa === "otro"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="otro"
                  checked={motivoPausa === "otro"}
                  onChange={(e) => setMotivoPausa(e.target.value)}
                />

                <div>
                  <strong>Otro motivo</strong>

                  <span>
                    La interrupción se debe a una situación diferente.
                  </span>
                </div>
              </label>
            </div>

            {error && <div className="editar-tarea-error">{error}</div>}

            <div className="pausa-modal-actions">
              <button
                type="button"
                className="editar-tarea-btn cancelar"
                onClick={cerrarPausa}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={confirmarPausa}
                disabled={guardando}
              >
                {guardando ? "Pausando..." : "Confirmar pausa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          POPUP — SELECCIONAR OTRA TAREA EXISTENTE
      ===================================================== */}

      {mostrarSelectorOtraTarea && (
        <div className="pausa-overlay">
          <div className="pausa-modal">
            <div className="pausa-modal-header">
              <div>
                <span>CAMBIO DE ACTIVIDAD</span>

                <h2>¿Qué tarea vas a realizar ahora?</h2>

                <p>
                  Selecciona una tarea que ya existe en Mis tareas. No se creará
                  una nueva actividad.
                </p>
              </div>

              <button
                type="button"
                className="pausa-cerrar"
                onClick={cancelarSeleccionOtraTarea}
                disabled={guardando}
              >
                ×
              </button>
            </div>

            <div className="pausa-opciones">
              {tareasActivas
                .filter(
                  (tarea) =>
                    String(tarea.id) !== String(tareaParaPausar?.id) &&
                    tarea.estado !== "completada",
                )
                .map((tarea) => (
                  <label
                    key={tarea.id}
                    className={
                      String(tareaSeleccionadaOtra?.id) === String(tarea.id)
                        ? "pausa-opcion seleccionada"
                        : "pausa-opcion"
                    }
                  >
                    <input
                      type="radio"
                      name="tareaOtraMisTareas"
                      value={tarea.id}
                      checked={
                        String(tareaSeleccionadaOtra?.id) === String(tarea.id)
                      }
                      onChange={() => setTareaSeleccionadaOtra(tarea)}
                    />

                    <div>
                      <strong>{tarea.titulo}</strong>

                      <span>
                        {tarea.descripcion ||
                          "Tarea disponible para continuar."}
                      </span>
                    </div>
                  </label>
                ))}

              {tareasActivas.filter(
                (tarea) =>
                  String(tarea.id) !== String(tareaParaPausar?.id) &&
                  tarea.estado !== "completada",
              ).length === 0 && (
                <div className="editar-tarea-error">
                  No tienes otra tarea disponible para seleccionar.
                </div>
              )}
            </div>

            {error && <div className="editar-tarea-error">{error}</div>}

            <div className="pausa-modal-actions">
              <button
                type="button"
                className="editar-tarea-btn cancelar"
                onClick={cancelarSeleccionOtraTarea}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={seleccionarOtraTarea}
                disabled={guardando || !tareaSeleccionadaOtra}
              >
                {guardando ? "Iniciando..." : "Iniciar tarea"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          POPUP — AVISO DEL DÍA ANTERIOR
      ===================================================== */}

      {mostrarAvisoDiaAnterior && (
        <div className="pausa-overlay">
          <div className="dia-anterior-modal">
            <div className="dia-anterior-icono">⚠</div>

            <div className="dia-anterior-contenido">
              <span className="dia-anterior-eyebrow">CONTROL DE JORNADA</span>

              <h2>Tienes tareas del día anterior</h2>

              <p>
                Ayer quedaron tareas en proceso sin ser pausadas o finalizadas.
                El sistema las pausó automáticamente a las{" "}
                <strong>17:00</strong> para evitar que el tiempo continuara
                contabilizándose durante la noche.
              </p>

              <div className="dia-anterior-lista">
                {tareasAutoPausadasAyer.map((tarea) => (
                  <div className="dia-anterior-item" key={tarea.id}>
                    <div>
                      <strong>{tarea.titulo}</strong>

                      <span>
                        Tiempo acumulado: {formatearDuracion(tarea.tiempo)}
                      </span>
                    </div>

                    <span className="dia-anterior-estado">Pausada</span>
                  </div>
                ))}
              </div>

              <div className="dia-anterior-nota">
                <strong>Recuerda:</strong>

                <span>
                  Al finalizar tu jornada, pausa o termina tus tareas para
                  mantener un registro correcto del tiempo trabajado.
                </span>
              </div>
            </div>

            <div className="dia-anterior-actions">
              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={cerrarAvisoDiaAnterior}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MisTareas;
