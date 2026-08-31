import { useEffect, useMemo, useRef, useState } from "react";
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

  // =========================================================
  // POPUP — TAREAS AUTO-PAUSADAS DEL DÍA ANTERIOR
  // =========================================================

  const [mostrarAvisoDiaAnterior, setMostrarAvisoDiaAnterior] =
    useState(false);

  const [tareasAutoPausadasAyer, setTareasAutoPausadasAyer] = useState([]);

  // =========================================================
  // REF PARA EVITAR EJECUCIONES DUPLICADAS
  // =========================================================

  const procesandoAutoPausa = useRef(false);

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
        .select(`
          id,
          nombre,
          apellido,
          email,
          activo,
          auth_user_id
        `)
        .eq("auth_user_id", authData.user.id)
        .single();

      if (usuarioError) {
        throw usuarioError;
      }

      setUsuario(usuarioData);
    } catch (err) {
      console.error("Error cargando usuario:", err);

      setError(
        "No se pudo cargar la información del usuario."
      );

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

  const cargarTareas = async () => {
    setCargando(true);
    setError("");

    try {
      const { data, error: tareasError } = await supabase
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
          estado_ejecucion
        `)
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

      setError(
        err.message || "No se pudieron cargar tus tareas."
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // TAREAS ACTIVAS
  // =========================================================

  const tareasActivas = useMemo(() => {
    return tareas.filter(
      (tarea) => tarea.estado !== "completada"
    );
  }, [tareas]);

  // =========================================================
  // TAREAS EN PROCESO
  // =========================================================

  const tareasEnProceso = useMemo(() => {
    return tareas.filter(
      (tarea) => tarea.estado === "en_proceso"
    );
  }, [tareas]);

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      tareasActivas.length / TAREAS_POR_PAGINA
    )
  );

  const tareasVisibles = useMemo(() => {
    const inicio =
      (pagina - 1) * TAREAS_POR_PAGINA;

    return tareasActivas.slice(
      inicio,
      inicio + TAREAS_POR_PAGINA
    );
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
    const valor = Math.max(
      0,
      Number(minutos) || 0
    );

    const totalSegundos = Math.round(valor * 60);

    const horas = Math.floor(
      totalSegundos / 3600
    );

    const minutosRestantes = Math.floor(
      (totalSegundos % 3600) / 60
    );

    const segundos = totalSegundos % 60;

    const hh = String(horas).padStart(2, "0");
    const mm = String(minutosRestantes).padStart(
      2,
      "0"
    );
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
      Number(partes[2])
    );

    return fechaLocal.toLocaleDateString(
      "es-EC",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
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
    return Math.max(
      0,
      Number(
        tarea?.tiempo_trabajado_min
      ) || 0
    );
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
    const acumulado =
      obtenerTiempoAcumulado(tarea);

    if (
      tarea.estado !== "en_proceso" ||
      !tarea.inicio_real
    ) {
      return acumulado;
    }

    const inicio = new Date(
      tarea.inicio_real
    );

    if (Number.isNaN(inicio.getTime())) {
      return acumulado;
    }

    const ahora = new Date();

    const diferencia =
      Math.max(
        0,
        ahora.getTime() -
          inicio.getTime()
      ) / 60000;

    return acumulado + diferencia;
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

  const pausarTareaInternamente = async (
    tarea,
    fechaHoraPausa = new Date(),
    motivo = "otra_tarea"
  ) => {
    if (!tarea) {
      return null;
    }

    const ahora = fechaHoraPausa;

    const inicio = tarea.inicio_real
      ? new Date(tarea.inicio_real)
      : null;

    const acumuladoAnterior = Math.max(
      0,
      Number(
        tarea.tiempo_trabajado_min
      ) || 0
    );

    let minutosSesion = 0;

    if (
      inicio &&
      !Number.isNaN(inicio.getTime())
    ) {
      minutosSesion =
        Math.max(
          0,
          ahora.getTime() -
            inicio.getTime()
        ) / 60000;
    }

    const nuevoAcumulado = Math.round(
      acumuladoAnterior +
        minutosSesion
    );

    const { error: updateError } =
      await supabase
        .from("tareas")
        .update({
          estado: "pendiente",
          tiempo_trabajado_min:
            nuevoAcumulado,
          fin_real:
            ahora.toISOString(),
          estado_ejecucion:
            "pausada",
        })
        .eq("id", tarea.id);

    if (updateError) {
      throw updateError;
    }

    return {
      ...tarea,
      estado: "pendiente",
      tiempo_trabajado_min:
        nuevoAcumulado,
      fin_real:
        ahora.toISOString(),
      estado_ejecucion:
        "pausada",
      motivo,
    };
  };

  // =========================================================
  // EXCLUSIVIDAD
  //
  // Si existe otra tarea ejecutándose,
  // se pausa automáticamente.
  //
  // De esta manera SOLO puede existir
  // UNA tarea en proceso.
  // =========================================================

  const pausarOtrasTareasEnProceso = async (
    tareaActual,
    fechaHoraPausa = new Date()
  ) => {
    const otrasTareas =
      tareasEnProceso.filter(
        (tarea) =>
          String(tarea.id) !==
          String(tareaActual.id)
      );

    if (otrasTareas.length === 0) {
      return [];
    }

    const tareasPausadas = [];

    for (const tarea of otrasTareas) {
      const tareaPausada =
        await pausarTareaInternamente(
          tarea,
          fechaHoraPausa,
          "cambio_tarea"
        );

      if (tareaPausada) {
        tareasPausadas.push(
          tareaPausada
        );

        localStorage.setItem(
          `tarea_pausa_${tarea.id}`,
          JSON.stringify({
            tarea_id: tarea.id,
            motivo: "cambio_tarea",
            hora: obtenerHoraActual(
              fechaHoraPausa
            ),
            fecha: obtenerFechaActual(
              fechaHoraPausa
            ),
            minutos_acumulados:
              tareaPausada.tiempo_trabajado_min,
          })
        );

        localStorage.removeItem(
          `tarea_reanudacion_${tarea.id}`
        );
      }
    }

    return tareasPausadas;
  };

  // =========================================================
  // INICIAR TAREA
  //
  // Si existe otra en proceso:
  // SE PAUSA AUTOMÁTICAMENTE.
  // =========================================================

  const iniciarTarea = async (tarea) => {
    if (!tarea || guardando) {
      return;
    }

    setMensaje("");
    setError("");

    setGuardando(true);

    try {
      const ahora = new Date();

      const otrasTareas =
        tareasEnProceso.filter(
          (item) =>
            String(item.id) !==
            String(tarea.id)
        );

      if (otrasTareas.length > 0) {
        await pausarOtrasTareasEnProceso(
          tarea,
          ahora
        );
      }

      const fechaActual =
        obtenerFechaActual(ahora);

      const horaActual =
        obtenerHoraActual(ahora);

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "en_proceso",
            fecha_inicio:
              tarea.fecha_inicio ||
              fechaActual,
            fecha:
              tarea.fecha ||
              fechaActual,
            hora_inicio:
              tarea.hora_inicio ||
              horaActual,
            inicio_real:
              ahora.toISOString(),
            fin_real: null,
            estado_ejecucion:
              "en_proceso",
          })
          .eq("id", tarea.id);

      if (updateError) {
        throw updateError;
      }

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

      localStorage.setItem(
        `tarea_reanudacion_${tarea.id}`,
        JSON.stringify({
          tarea_id: tarea.id,
          fecha: fechaActual,
          hora: horaActual,
        })
      );

      await cargarTareas();

      if (otrasTareas.length > 0) {
        setMensaje(
          `Tarea "${tarea.titulo}" iniciada. Las otras tareas en proceso fueron pausadas automáticamente.`
        );
      } else {
        setMensaje(
          `Tarea "${tarea.titulo}" iniciada a las ${horaActual.substring(
            0,
            5
          )}.`
        );
      }
    } catch (err) {
      console.error(
        "Error iniciando tarea:",
        err
      );

      setError(
        err.message ||
          "No se pudo iniciar la tarea."
      );
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
    if (!tareaParaPausar) {
      return;
    }

    if (!motivoPausa) {
      setError(
        "Selecciona el motivo de la pausa."
      );
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date();

      const tareaPausada =
        await pausarTareaInternamente(
          tareaParaPausar,
          ahora,
          motivoPausa
        );

      if (!tareaPausada) {
        return;
      }

      const horaPausa =
        obtenerHoraActual(ahora);

      const fechaPausa =
        obtenerFechaActual(ahora);

      // -------------------------------------------------------
      // REGISTRO TEMPORAL DE PAUSA
      // -------------------------------------------------------

      localStorage.setItem(
        `tarea_pausa_${tareaParaPausar.id}`,
        JSON.stringify({
          tarea_id:
            tareaParaPausar.id,
          motivo: motivoPausa,
          hora: horaPausa,
          fecha: fechaPausa,
          minutos_acumulados:
            tareaPausada.tiempo_trabajado_min,
        })
      );

      localStorage.removeItem(
        `tarea_reanudacion_${tareaParaPausar.id}`
      );

      const titulo =
        tareaParaPausar.titulo;

      const tiempoFinal =
        tareaPausada.tiempo_trabajado_min;

      setMostrarPausa(false);
      setTareaParaPausar(null);
      setMotivoPausa("");

      await cargarTareas();

      setMensaje(
        `Tarea "${titulo}" pausada a las ${horaPausa.substring(
          0,
          5
        )}. Tiempo acumulado: ${formatearDuracion(
          tiempoFinal
        )}.`
      );

      // -------------------------------------------------------
      // SI ES OTRA TAREA / URGENTE
      // SE MANTIENE LA LÓGICA ANTERIOR
      // -------------------------------------------------------

      if (
        motivoPausa === "otra_tarea" ||
        motivoPausa ===
          "tarea_urgente"
      ) {
        navigate("/tareas/nueva");
        return;
      }
    } catch (err) {
      console.error(
        "Error pausando tarea:",
        err
      );

      setError(
        err.message ||
          "No se pudo pausar la tarea."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // REANUDAR
  //
  // ANTES DE REANUDAR:
  // PAUSA AUTOMÁTICAMENTE LAS OTRAS.
  // =========================================================

  const reanudarTarea = async (tarea) => {
    if (!tarea || guardando) {
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date();

      const otrasTareas =
        tareasEnProceso.filter(
          (item) =>
            String(item.id) !==
            String(tarea.id)
        );

      if (otrasTareas.length > 0) {
        await pausarOtrasTareasEnProceso(
          tarea,
          ahora
        );
      }

      const horaActual =
        obtenerHoraActual(ahora);

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "en_proceso",
            inicio_real:
              ahora.toISOString(),
            fin_real: null,
            estado_ejecucion:
              "en_proceso",
          })
          .eq("id", tarea.id);

      if (updateError) {
        throw updateError;
      }

      localStorage.setItem(
        `tarea_reanudacion_${tarea.id}`,
        JSON.stringify({
          tarea_id: tarea.id,
          fecha:
            obtenerFechaActual(ahora),
          hora: horaActual,
        })
      );

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

      await cargarTareas();

      if (otrasTareas.length > 0) {
        setMensaje(
          `Tarea "${tarea.titulo}" reanudada. Las otras tareas fueron pausadas automáticamente.`
        );
      } else {
        setMensaje(
          `Tarea "${tarea.titulo}" reanudada a las ${horaActual.substring(
            0,
            5
          )}.`
        );
      }
    } catch (err) {
      console.error(
        "Error reanudando tarea:",
        err
      );

      setError(
        err.message ||
          "No se pudo reanudar la tarea."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // TERMINAR TAREA
  // =========================================================

  const terminarTarea = async (tarea) => {
    if (!tarea || guardando) {
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmas que esta tarea ya está terminada?"
    );

    if (!confirmar) {
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const ahora = new Date();

      const inicio = tarea.inicio_real
        ? new Date(tarea.inicio_real)
        : null;

      const acumuladoAnterior =
        Math.max(
          0,
          Number(
            tarea.tiempo_trabajado_min
          ) || 0
        );

      let minutosSesion = 0;

      if (
        inicio &&
        !Number.isNaN(
          inicio.getTime()
        )
      ) {
        minutosSesion =
          Math.max(
            0,
            ahora.getTime() -
              inicio.getTime()
          ) / 60000;
      }

      const totalFinal = Math.round(
        acumuladoAnterior +
          minutosSesion
      );

      const fechaActual =
        obtenerFechaActual(ahora);

      const horaActual =
        obtenerHoraActual(ahora);

      const { error: updateError } =
        await supabase
          .from("tareas")
          .update({
            estado: "completada",
            fecha_fin: fechaActual,
            hora_fin: horaActual,
            fin_real:
              ahora.toISOString(),
            tiempo_trabajado_min:
              totalFinal,
            estado_ejecucion:
              "finalizada",
          })
          .eq("id", tarea.id);

      if (updateError) {
        throw updateError;
      }

      localStorage.removeItem(
        `tarea_pausa_${tarea.id}`
      );

      localStorage.removeItem(
        `tarea_reanudacion_${tarea.id}`
      );

      await cargarTareas();

      setMensaje(
        `Tarea terminada. Tiempo contabilizado: ${formatearDuracion(
          totalFinal
        )}.`
      );
    } catch (err) {
      console.error(
        "Error terminando tarea:",
        err
      );

      setError(
        err.message ||
          "No se pudo terminar la tarea."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // HORA DE CIERRE AUTOMÁTICO
  // =========================================================

  const obtenerFechaHoraCincoPM = () => {
    const ahora = new Date();

    const cincoPM = new Date(ahora);

    cincoPM.setHours(17, 0, 0, 0);

    return cincoPM;
  };

  // =========================================================
  // PAUSA AUTOMÁTICA A LAS 17:00
  //
  // IMPORTANTE:
  // El tiempo se calcula hasta exactamente las 17:00.
  //
  // NO se contabiliza tiempo durante la noche.
  // =========================================================

  const ejecutarPausaAutomatica = async () => {
    if (
      !usuario?.id ||
      procesandoAutoPausa.current
    ) {
      return;
    }

    const ahora = new Date();

    const cincoPM =
      obtenerFechaHoraCincoPM();

    if (ahora < cincoPM) {
      return;
    }

    const tareasProcesoActual =
      tareas.filter(
        (tarea) =>
          tarea.estado ===
            "en_proceso" &&
          tarea.responsable_id ===
            usuario.id
      );

    if (
      tareasProcesoActual.length === 0
    ) {
      return;
    }

    procesandoAutoPausa.current = true;

    try {
      const tareasPausadas = [];

      for (const tarea of tareasProcesoActual) {
        const inicio = tarea.inicio_real
          ? new Date(
              tarea.inicio_real
            )
          : null;

        let momentoPausa = cincoPM;

        // Si por alguna razón el inicio
        // fuera después de las 17:00,
        // no usamos una fecha futura.
        if (
          inicio &&
          !Number.isNaN(
            inicio.getTime()
          ) &&
          inicio > cincoPM
        ) {
          momentoPausa = ahora;
        }

        const tareaPausada =
          await pausarTareaInternamente(
            tarea,
            momentoPausa,
            "cierre_jornada"
          );

        if (tareaPausada) {
          tareasPausadas.push(
            tareaPausada
          );

          localStorage.setItem(
            `tarea_pausa_${tarea.id}`,
            JSON.stringify({
              tarea_id: tarea.id,
              motivo:
                "cierre_jornada",
              hora: obtenerHoraActual(
                momentoPausa
              ),
              fecha: obtenerFechaActual(
                momentoPausa
              ),
              minutos_acumulados:
                tareaPausada.tiempo_trabajado_min,
              pausa_automatica: true,
            })
          );

          localStorage.removeItem(
            `tarea_reanudacion_${tarea.id}`
          );
        }
      }

      if (tareasPausadas.length > 0) {
        const fechaCierre =
          obtenerFechaActual(
            cincoPM
          );

        const registro = {
          fecha: fechaCierre,
          hora: "17:00:00",
          tareas:
            tareasPausadas.map(
              (tarea) => ({
                id: tarea.id,
                titulo:
                  tarea.titulo,
                tiempo:
                  tarea.tiempo_trabajado_min,
              })
            ),
        };

        localStorage.setItem(
          `tareas_auto_pausadas_${fechaCierre}`,
          JSON.stringify(registro)
        );

        await cargarTareas();

        setMensaje(
          `La jornada terminó. ${tareasPausadas.length} ${
            tareasPausadas.length ===
            1
              ? "tarea fue pausada"
              : "tareas fueron pausadas"
          } automáticamente a las 17:00.`
        );
      }
    } catch (err) {
      console.error(
        "Error en pausa automática:",
        err
      );

      setError(
        "No se pudieron pausar automáticamente las tareas."
      );
    } finally {
      procesandoAutoPausa.current = false;
    }
  };

  // =========================================================
  // VIGILAR LAS 17:00
  // =========================================================

  useEffect(() => {
    if (!usuario?.id) {
      return;
    }

    ejecutarPausaAutomatica();

    const intervalo =
      setInterval(() => {
        ejecutarPausaAutomatica();
      }, 1000);

    return () =>
      clearInterval(intervalo);
  }, [
    usuario?.id,
    tareas,
  ]);

  // =========================================================
  // DETECTAR TAREAS AUTO-PAUSADAS DEL DÍA ANTERIOR
  //
  // SOLO SE MUESTRA SI REALMENTE EXISTIÓ
  // UNA PAUSA AUTOMÁTICA.
  // =========================================================

  useEffect(() => {
    if (!usuario?.id) {
      return;
    }

    const ayer =
      obtenerFechaAnterior();

    const clave =
      `tareas_auto_pausadas_${ayer}`;

    const registro =
      localStorage.getItem(clave);

    if (!registro) {
      return;
    }

    try {
      const datos =
        JSON.parse(registro);

      if (
        datos?.tareas &&
        datos.tareas.length > 0
      ) {
        setTareasAutoPausadasAyer(
          datos.tareas
        );

        setMostrarAvisoDiaAnterior(
          true
        );
      }
    } catch (err) {
      console.error(
        "Error leyendo aviso del día anterior:",
        err
      );
    }
  }, [usuario?.id]);

  // =========================================================
  // CERRAR AVISO DEL DÍA ANTERIOR
  // =========================================================

  const cerrarAvisoDiaAnterior = () => {
    const ayer =
      obtenerFechaAnterior();

    localStorage.removeItem(
      `tareas_auto_pausadas_${ayer}`
    );

    setMostrarAvisoDiaAnterior(false);
    setTareasAutoPausadasAyer([]);
  };

  // =========================================================
  // RENDER TARJETA
  // =========================================================

  const renderTarea = (tarea) => {
    const estaEnProceso =
      tarea.estado ===
      "en_proceso";

    const estaCompletada =
      tarea.estado ===
      "completada";

    const estaPausada =
      !estaEnProceso &&
      !estaCompletada &&
      Boolean(
        localStorage.getItem(
          `tarea_pausa_${tarea.id}`
        )
      );

    const tiempo =
      obtenerTiempoVisual(tarea);

    return (
      <article
        key={tarea.id}
        className={`mi-tarea-card ${
          estaEnProceso
            ? "mi-tarea-card-activa"
            : ""
        }`}
      >
        <div className="mi-tarea-card-top">
          <div>
            <span className="mi-tarea-card-label">
              TAREA
            </span>

            <h3>{tarea.titulo}</h3>
          </div>

          <span
            className={`mi-tarea-estado estado-${tarea.estado}`}
          >
            {estaPausada
              ? "Pausada"
              : obtenerTextoEstado(
                  tarea.estado
                )}
          </span>
        </div>

        {tarea.descripcion && (
          <p className="mi-tarea-card-description">
            {tarea.descripcion}
          </p>
        )}

        <div className="mi-tarea-meta">
          <div className="mi-tarea-meta-item">
            <span>Fecha</span>

            <strong>
              {formatearFecha(
                tarea.fecha_inicio ||
                  tarea.fecha
              )}
            </strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>Horario</span>

            <strong>
              {formatearHora(
                tarea.hora_inicio
              )}

              {tarea.hora_fin
                ? ` - ${formatearHora(
                    tarea.hora_fin
                  )}`
                : ""}
            </strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>
              Tiempo trabajado
            </span>

            <strong
              className={
                estaEnProceso
                  ? "tiempo-en-vivo"
                  : ""
              }
            >
              {formatearDuracion(
                tiempo
              )}
            </strong>
          </div>

          <div className="mi-tarea-meta-item">
            <span>Prioridad</span>

            <strong>
              {obtenerTextoPrioridad(
                tarea.prioridad
              )}
            </strong>
          </div>
        </div>

        <div className="mi-tarea-actions">
          {!estaEnProceso &&
            !estaCompletada &&
            !estaPausada && (
              <button
                type="button"
                className="mi-tarea-btn-iniciar"
                onClick={() =>
                  iniciarTarea(
                    tarea
                  )
                }
                disabled={guardando}
              >
                ▶ Iniciar
              </button>
            )}

          {estaEnProceso && (
            <button
              type="button"
              className="mi-tarea-btn-pausar"
              onClick={() =>
                abrirPausa(tarea)
              }
              disabled={guardando}
            >
              ⏸ Pausar
            </button>
          )}

          {estaPausada && (
            <button
              type="button"
              className="mi-tarea-btn-reanudar"
              onClick={() =>
                reanudarTarea(
                  tarea
                )
              }
              disabled={guardando}
            >
              ▶ Reanudar
            </button>
          )}

          {estaEnProceso && (
            <button
              type="button"
              className="mi-tarea-btn-terminar"
              onClick={() =>
                terminarTarea(
                  tarea
                )
              }
              disabled={guardando}
            >
              ✓ Terminar
            </button>
          )}

          <button
            type="button"
            className="mi-tarea-btn-editar"
            onClick={() =>
              navigate(
                `/tareas/${tarea.id}/editar`
              )
            }
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
      {/* =====================================================
          ENCABEZADO
      ===================================================== */}

      <div className="mi-tareas-header">
        <div>
          <span className="mi-tareas-eyebrow">
            CONTROL DE ACTIVIDAD
          </span>

          <h1>Mis tareas</h1>

          <p>
            Administra tus actividades y
            registra correctamente el
            tiempo trabajado.
          </p>
        </div>

        <div className="mi-tareas-header-actions">
          <button
            type="button"
            className="mi-tareas-btn mi-tareas-btn-secundario"
            onClick={() =>
              cargarTareas()
            }
          >
            Actualizar
          </button>

          <button
            type="button"
            className="mi-tareas-btn mi-tareas-btn-secundario"
            onClick={() =>
              navigate("/tareas")
            }
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
              (usuario.nombre?.charAt(
                0
              ) || "") +
              (usuario.apellido?.charAt(
                0
              ) || "")
            ).toUpperCase()}
          </div>

          <div>
            <span>
              Usuario actual
            </span>

            <strong>
              {usuario.nombre}{" "}
              {usuario.apellido}
            </strong>
          </div>
        </div>
      )}

      {/* =====================================================
          CONTADORES
      ===================================================== */}

      <div className="mi-tareas-resumen">
        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">
            Mis tareas
          </span>

          <strong className="mi-tareas-stat-number">
            {tareasActivas.length}
          </strong>

          <span className="mi-tareas-stat-text">
            Actividades activas
          </span>
        </div>

        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">
            En proceso
          </span>

          <strong className="mi-tareas-stat-number">
            {tareasEnProceso.length}
          </strong>

          <span className="mi-tareas-stat-text">
            Actividades iniciadas
          </span>
        </div>

        <div className="mi-tareas-stat">
          <span className="mi-tareas-stat-label">
            Hora actual
          </span>

          <strong className="mi-tareas-stat-number reloj-actual">
            {horaActual.toLocaleTimeString(
              "es-EC",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }
            )}
          </strong>

          <span className="mi-tareas-stat-text">
            Tiempo local
          </span>
        </div>
      </div>

      {/* =====================================================
          MENSAJES
      ===================================================== */}

      {mensaje && (
        <div className="editar-tarea-mensaje">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="editar-tarea-error">
          {error}
        </div>
      )}

      {/* =====================================================
          TAREAS
      ===================================================== */}

      <div className="mi-tareas-section-header">
        <div>
          <span>
            ACTIVIDADES
          </span>

          <h2>
            Tus tareas
          </h2>

          <p>
            Controla el inicio, pausa,
            reanudación y finalización.
          </p>
        </div>
      </div>

      {tareasVisibles.length === 0 ? (
        <div className="mi-tareas-empty">
          <strong>
            No tienes tareas activas
          </strong>

          <p>
            Las tareas completadas se
            conservan en el sistema.
          </p>
        </div>
      ) : (
        <>
          <div className="mi-tareas-grid">
            {tareasVisibles.map(
              (tarea) =>
                renderTarea(tarea)
            )}
          </div>

          {totalPaginas > 1 && (
            <div className="mi-tareas-paginacion">
              <button
                type="button"
                onClick={() =>
                  setPagina(
                    (actual) =>
                      Math.max(
                        1,
                        actual - 1
                      )
                  )
                }
                disabled={pagina === 1}
              >
                Anterior
              </button>

              <span>
                Página {pagina} de{" "}
                {totalPaginas}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPagina(
                    (actual) =>
                      Math.min(
                        totalPaginas,
                        actual + 1
                      )
                  )
                }
                disabled={
                  pagina ===
                  totalPaginas
                }
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
                <span>
                  CONTROL DE ACTIVIDAD
                </span>

                <h2>
                  ¿Por qué estás
                  pausando esta
                  tarea?
                </h2>

                <p>
                  Selecciona el
                  motivo para
                  registrar
                  correctamente la
                  interrupción.
                </p>
              </div>

              <button
                type="button"
                className="pausa-cerrar"
                onClick={
                  cerrarPausa
                }
                disabled={
                  guardando
                }
              >
                ×
              </button>
            </div>

            <div className="pausa-opciones">
              <label
                className={
                  motivoPausa ===
                  "otra_tarea"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="otra_tarea"
                  checked={
                    motivoPausa ===
                    "otra_tarea"
                  }
                  onChange={(e) =>
                    setMotivoPausa(
                      e.target.value
                    )
                  }
                />

                <div>
                  <strong>
                    Para realizar otra
                    tarea
                  </strong>

                  <span>
                    Voy a dejar esta
                    actividad
                    temporalmente
                    para atender
                    otra tarea.
                  </span>
                </div>
              </label>

              <label
                className={
                  motivoPausa ===
                  "almuerzo"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="almuerzo"
                  checked={
                    motivoPausa ===
                    "almuerzo"
                  }
                  onChange={(e) =>
                    setMotivoPausa(
                      e.target.value
                    )
                  }
                />

                <div>
                  <strong>
                    Almuerzo
                  </strong>

                  <span>
                    Pausa
                    correspondiente
                    al horario de
                    alimentación.
                  </span>
                </div>
              </label>

              <label
                className={
                  motivoPausa ===
                  "tarea_urgente"
                    ? "pausa-opcion seleccionada"
                    : "pausa-opcion"
                }
              >
                <input
                  type="radio"
                  name="motivoPausaMisTareas"
                  value="tarea_urgente"
                  checked={
                    motivoPausa ===
                    "tarea_urgente"
                  }
                  onChange={(e) =>
                    setMotivoPausa(
                      e.target.value
                    )
                  }
                />

                <div>
                  <strong>
                    Tarea urgente
                  </strong>

                  <span>
                    Debo atender una
                    actividad
                    urgente antes de
                    continuar.
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
                  checked={
                    motivoPausa ===
                    "otro"
                  }
                  onChange={(e) =>
                    setMotivoPausa(
                      e.target.value
                    )
                  }
                />

                <div>
                  <strong>
                    Otro motivo
                  </strong>

                  <span>
                    La interrupción se
                    debe a una
                    situación
                    diferente.
                  </span>
                </div>
              </label>
            </div>

            {error && (
              <div className="editar-tarea-error">
                {error}
              </div>
            )}

            <div className="pausa-modal-actions">
              <button
                type="button"
                className="editar-tarea-btn cancelar"
                onClick={
                  cerrarPausa
                }
                disabled={
                  guardando
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={
                  confirmarPausa
                }
                disabled={
                  guardando
                }
              >
                {guardando
                  ? "Pausando..."
                  : "Confirmar pausa"}
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
            <div className="dia-anterior-icono">
              ⚠
            </div>

            <div className="dia-anterior-contenido">
              <span className="dia-anterior-eyebrow">
                CONTROL DE JORNADA
              </span>

              <h2>
                Tienes tareas del día
                anterior
              </h2>

              <p>
                Ayer quedaron tareas en
                proceso sin ser pausadas
                o finalizadas. El sistema
                las pausó automáticamente
                a las <strong>17:00</strong>{" "}
                para evitar que el tiempo
                continuara contabilizándose
                durante la noche.
              </p>

              <div className="dia-anterior-lista">
                {tareasAutoPausadasAyer.map(
                  (tarea) => (
                    <div
                      className="dia-anterior-item"
                      key={tarea.id}
                    >
                      <div>
                        <strong>
                          {tarea.titulo}
                        </strong>

                        <span>
                          Tiempo acumulado:{" "}
                          {formatearDuracion(
                            tarea.tiempo
                          )}
                        </span>
                      </div>

                      <span className="dia-anterior-estado">
                        Pausada
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="dia-anterior-nota">
                <strong>
                  Recuerda:
                </strong>

                <span>
                  Al finalizar tu jornada,
                  pausa o termina tus
                  tareas para mantener un
                  registro correcto del
                  tiempo trabajado.
                </span>
              </div>
            </div>

            <div className="dia-anterior-actions">
              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={
                  cerrarAvisoDiaAnterior
                }
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