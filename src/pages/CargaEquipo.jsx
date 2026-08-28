import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import "./CargaEquipo.css";

const MINUTOS_JORNADA = 480;

function CargaEquipo() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [pausasRegistradas, setPausasRegistradas] = useState([]);

  // =========================================================
  // CARGAR DATOS
  // =========================================================

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError("");

    try {
      const [
        { data: usuariosData, error: usuariosError },
        { data: tareasData, error: tareasError },
      ] = await Promise.all([
        supabase
          .from("usuarios")
          .select("id, nombre, apellido, email")
          .eq("activo", true)
          .order("nombre"),

        supabase
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
              tiempo_estimado,
              estado,
              prioridad,
              responsable_id,
              departamento_id,
              created_at
            `,
          )
          .order("fecha_inicio", { ascending: true }),
      ]);

      if (usuariosError) {
        throw usuariosError;
      }

      if (tareasError) {
        throw tareasError;
      }

      setUsuarios(usuariosData || []);
      setTareas(tareasData || []);

      cargarPausasLocalStorage();
    } catch (err) {
      console.error("Error cargando carga del equipo:", err);

      setError(
        err.message || "No se pudo cargar la información del equipo.",
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // PAUSAS TEMPORALES
  // =========================================================

  const cargarPausasLocalStorage = () => {
    const pausas = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (!key || !key.startsWith("tarea_pausa_")) {
          continue;
        }

        const valor = localStorage.getItem(key);

        if (!valor) {
          continue;
        }

        try {
          const pausa = JSON.parse(valor);

          if (pausa && pausa.tarea_id) {
            pausas.push(pausa);
          }
        } catch (parseError) {
          console.warn(
            "No se pudo interpretar una pausa:",
            parseError,
          );
        }
      }
    } catch (storageError) {
      console.warn(
        "No se pudieron leer las pausas:",
        storageError,
      );
    }

    setPausasRegistradas(pausas);
  };

  // =========================================================
  // CAMBIAR FECHA
  // =========================================================

  const cambiarFecha = (cantidad) => {
    const fecha = new Date(
      `${fechaSeleccionada}T12:00:00`,
    );

    fecha.setDate(fecha.getDate() + cantidad);

    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    setFechaSeleccionada(`${año}-${mes}-${dia}`);
  };

  const irAHoy = () => {
    setFechaSeleccionada(
      new Date().toISOString().split("T")[0],
    );
  };

  // =========================================================
  // DETERMINAR SI UNA TAREA OCUPA UNA FECHA
  // =========================================================

  const tareaOcupaFecha = (tarea, fecha) => {
    const inicio = tarea.fecha_inicio || tarea.fecha;

    if (!inicio) {
      return false;
    }

    const fin = tarea.fecha_fin || inicio;

    return fecha >= inicio && fecha <= fin;
  };

  // =========================================================
  // TAREAS DEL DÍA
  // =========================================================

  const tareasDelDia = useMemo(() => {
    return tareas.filter((tarea) =>
      tareaOcupaFecha(tarea, fechaSeleccionada),
    );
  }, [tareas, fechaSeleccionada]);

  // =========================================================
  // CONVERTIR HORA A SEGUNDOS
  // =========================================================

  const convertirHoraASegundos = (hora) => {
    if (!hora) {
      return null;
    }

    const partes = String(hora).split(":");

    const horas = Number(partes[0] || 0);
    const minutos = Number(partes[1] || 0);
    const segundos = Number(partes[2] || 0);

    if (
      Number.isNaN(horas) ||
      Number.isNaN(minutos) ||
      Number.isNaN(segundos)
    ) {
      return null;
    }

    return horas * 3600 + minutos * 60 + segundos;
  };

  // =========================================================
  // CALCULAR MINUTOS DE UNA TAREA PARA LA FECHA
  // =========================================================

  const calcularMinutosTarea = (tarea, fecha) => {
    const inicio = tarea.fecha_inicio || tarea.fecha;
    const fin = tarea.fecha_fin || inicio;

    if (!inicio) {
      return 0;
    }

    // -------------------------------------------------------
    // TAREA DE VARIOS DÍAS
    // -------------------------------------------------------

    if (inicio !== fin) {
      return MINUTOS_JORNADA;
    }

    // -------------------------------------------------------
    // TAREA DE UN SOLO DÍA CON HORARIO
    // -------------------------------------------------------

    if (
      tarea.hora_inicio != null &&
      tarea.hora_fin != null &&
      tarea.hora_inicio !== "" &&
      tarea.hora_fin !== ""
    ) {
      const segundosInicio =
        convertirHoraASegundos(tarea.hora_inicio);

      const segundosFin =
        convertirHoraASegundos(tarea.hora_fin);

      if (
        segundosInicio !== null &&
        segundosFin !== null
      ) {
        let diferenciaSegundos =
          segundosFin - segundosInicio;

        // Cruce de medianoche
        if (diferenciaSegundos < 0) {
          diferenciaSegundos += 24 * 60 * 60;
        }

        return diferenciaSegundos / 60;
      }
    }

    // -------------------------------------------------------
    // TIEMPO ESTIMADO
    // -------------------------------------------------------

    const estimado = Number(
      tarea.tiempo_estimado || 0,
    );

    if (estimado > 0) {
      return estimado;
    }

    // -------------------------------------------------------
    // VALOR POR DEFECTO
    // -------------------------------------------------------

    return MINUTOS_JORNADA;
  };

  // =========================================================
  // CARGA POR PERSONA
  // =========================================================

  const cargaUsuarios = useMemo(() => {
    return usuarios.map((usuario) => {
      const tareasUsuario = tareasDelDia.filter(
        (tarea) =>
          tarea.responsable_id === usuario.id,
      );

      const minutos = tareasUsuario.reduce(
        (total, tarea) => {
          return (
            total +
            calcularMinutosTarea(
              tarea,
              fechaSeleccionada,
            )
          );
        },
        0,
      );

      const horas = minutos / 60;

      let nivel = "normal";

      if (minutos > MINUTOS_JORNADA) {
        nivel = "sobrecargado";
      } else if (minutos >= 360) {
        nivel = "alta";
      }

      // -----------------------------------------------------
      // TAREA ACTUAL
      // -----------------------------------------------------

      const tareaActual =
        tareasUsuario.find(
          (tarea) =>
            tarea.estado === "en_proceso",
        ) || null;

      // -----------------------------------------------------
      // PAUSAS PARA OTRA TAREA
      // -----------------------------------------------------

      const pausasOtraTarea =
        pausasRegistradas.filter((pausa) => {
          if (pausa.motivo !== "otra_tarea") {
            return false;
          }

          return tareasUsuario.some(
            (tarea) =>
              String(tarea.id) ===
              String(pausa.tarea_id),
          );
        });

      // -----------------------------------------------------
      // PAUSAS TOTALES
      // -----------------------------------------------------

      const pausasTotales =
        pausasRegistradas.filter((pausa) =>
          tareasUsuario.some(
            (tarea) =>
              String(tarea.id) ===
              String(pausa.tarea_id),
          ),
        );

      // -----------------------------------------------------
      // DISPONIBILIDAD
      // -----------------------------------------------------

      let disponibilidad = "Disponible";

      if (tareaActual) {
        disponibilidad = "En actividad";
      } else if (nivel === "sobrecargado") {
        disponibilidad = "Sobrecargado";
      } else if (nivel === "alta") {
        disponibilidad = "Carga alta";
      }

      return {
        ...usuario,
        tareas: tareasUsuario,
        cantidadTareas: tareasUsuario.length,
        minutos,
        horas,
        nivel,
        tareaActual,
        pausasOtraTarea:
          pausasOtraTarea.length,
        pausasTotales:
          pausasTotales.length,
        disponibilidad,
      };
    });
  }, [
    usuarios,
    tareasDelDia,
    fechaSeleccionada,
    pausasRegistradas,
  ]);

  // =========================================================
  // RESUMEN GENERAL
  // =========================================================

  const totalMinutos = useMemo(() => {
    return cargaUsuarios.reduce(
      (total, usuario) =>
        total + usuario.minutos,
      0,
    );
  }, [cargaUsuarios]);

  const totalTareas = tareasDelDia.length;

  const usuariosConTrabajo =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.cantidadTareas > 0,
    ).length;

  const usuariosDisponibles =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.cantidadTareas === 0,
    ).length;

  const usuariosCargaAlta =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.nivel === "alta",
    );

  const usuariosSobrecargados =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.nivel === "sobrecargado",
    );

  const tareasEnProceso =
    tareasDelDia.filter(
      (tarea) =>
        tarea.estado === "en_proceso",
    );

  const totalPausasOtraTarea =
    cargaUsuarios.reduce(
      (total, usuario) =>
        total + usuario.pausasOtraTarea,
      0,
    );

  // =========================================================
  // PORCENTAJE GENERAL
  // =========================================================

  const capacidadTotal =
    usuarios.length * MINUTOS_JORNADA;

  const porcentajeGeneral =
    capacidadTotal > 0
      ? Math.min(
          (totalMinutos / capacidadTotal) * 100,
          100,
        )
      : 0;

  // =========================================================
  // FORMATEAR HORAS
  // =========================================================

  const formatearHoras = (minutos) => {
    const minutosNumero = Math.max(
      0,
      Math.round(Number(minutos) || 0),
    );

    const horas = Math.floor(
      minutosNumero / 60,
    );

    const minutosRestantes =
      minutosNumero % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (minutosRestantes === 0) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  // =========================================================
  // FORMATEAR DURACIÓN CON SEGUNDOS
  // =========================================================

  const formatearDuracion = (minutos) => {
    const segundosTotales = Math.max(
      0,
      Math.round(
        (Number(minutos) || 0) * 60,
      ),
    );

    if (segundosTotales < 60) {
      return `${segundosTotales} s`;
    }

    const horas = Math.floor(
      segundosTotales / 3600,
    );

    const minutosRestantes =
      Math.floor(
        (segundosTotales % 3600) / 60,
      );

    const segundosRestantes =
      segundosTotales % 60;

    if (horas > 0) {
      if (minutosRestantes === 0) {
        return `${horas} h`;
      }

      return `${horas} h ${minutosRestantes} min`;
    }

    if (segundosRestantes === 0) {
      return `${minutosRestantes} min`;
    }

    return `${minutosRestantes} min ${segundosRestantes} s`;
  };

  // =========================================================
  // FORMATEAR FECHA
  // =========================================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "";
    }

    const [
      anio,
      mes,
      dia,
    ] = fecha.split("-");

    const fechaLocal = new Date(
      Number(anio),
      Number(mes) - 1,
      Number(dia),
    );

    return fechaLocal.toLocaleDateString(
      "es-EC",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );
  };

  // =========================================================
  // FORMATEAR RANGO DE TAREA
  // =========================================================

  const formatearRangoTarea = (tarea) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      inicio;

    if (!inicio) {
      return "Sin fecha";
    }

    if (inicio === fin) {
      return formatearFecha(inicio);
    }

    return `${formatearFecha(
      inicio,
    )} → ${formatearFecha(fin)}`;
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
  // ABRIR MODAL
  // =========================================================

  const abrirDetalle = (usuario) => {
    setUsuarioSeleccionado(usuario);
  };

  const cerrarDetalle = () => {
    setUsuarioSeleccionado(null);
  };

  // =========================================================
  // CARGA REAL DEL DETALLE
  // =========================================================
  //
  // IMPORTANTE:
  // El modal NO toma usuarioSeleccionado.minutos.
  //
  // Recalcula la carga desde las mismas actividades
  // que aparecen visualmente en el modal.
  //
  // Esto evita que el resumen muestre, por ejemplo,
  // 1 h 2 min cuando las actividades visibles suman 2 min.
  //
  // =========================================================

  const minutosDetalle = useMemo(() => {
    if (!usuarioSeleccionado) {
      return 0;
    }

    return usuarioSeleccionado.tareas.reduce(
      (total, tarea) => {
        return (
          total +
          calcularMinutosTarea(
            tarea,
            fechaSeleccionada,
          )
        );
      },
      0,
    );
  }, [
    usuarioSeleccionado,
    fechaSeleccionada,
  ]);

  const porcentajeDetalle =
    Math.min(
      (minutosDetalle / MINUTOS_JORNADA) * 100,
      100,
    );

  // =========================================================
  // CARGANDO
  // =========================================================

  if (cargando) {
    return (
      <section className="carga-equipo-page">
        <div className="carga-equipo-loading">
          <span className="carga-equipo-loader" />

          <p>
            Cargando carga del equipo...
          </p>
        </div>
      </section>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="carga-equipo-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="carga-equipo-header">
        <div>
          <span className="eyebrow">
            GESTIÓN
          </span>

          <h1>
            Carga del equipo
          </h1>

          <p>
            Consulta la planificación diaria,
            disponibilidad y distribución de trabajo
            del equipo.
          </p>
        </div>

        <button
          type="button"
          className="carga-equipo-recargar"
          onClick={cargarDatos}
        >
          Actualizar
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="carga-equipo-error">
          {error}
        </div>
      )}

      {/* =====================================================
          FILTRO DE FECHA
      ===================================================== */}

      <div className="carga-equipo-filtro">

        <div className="carga-fecha-consulta">
          <label htmlFor="fechaCarga">
            Consultar fecha
          </label>

          <div className="carga-fecha-controles">

            <button
              type="button"
              className="carga-fecha-btn"
              onClick={() =>
                cambiarFecha(-1)
              }
              aria-label="Día anterior"
            >
              ‹
            </button>

            <input
              id="fechaCarga"
              type="date"
              value={fechaSeleccionada}
              onChange={(e) =>
                setFechaSeleccionada(
                  e.target.value,
                )
              }
            />

            <button
              type="button"
              className="carga-fecha-btn"
              onClick={() =>
                cambiarFecha(1)
              }
              aria-label="Día siguiente"
            >
              ›
            </button>

            <button
              type="button"
              className="carga-fecha-hoy"
              onClick={irAHoy}
            >
              Hoy
            </button>

          </div>
        </div>

        <div className="carga-equipo-fecha">
          {formatearFecha(
            fechaSeleccionada,
          )}
        </div>

      </div>

      {/* =====================================================
          RESUMEN
      ===================================================== */}

      <div className="carga-equipo-resumen">

        <div className="carga-resumen-card">
          <span>
            Tareas del día
          </span>

          <strong>
            {totalTareas}
          </strong>

          <small>
            Actividades planificadas
          </small>
        </div>

        <div className="carga-resumen-card">
          <span>
            Trabajo planificado
          </span>

          <strong>
            {formatearHoras(
              totalMinutos,
            )}
          </strong>

          <small>
            Considerando la jornada diaria
          </small>
        </div>

        <div className="carga-resumen-card">
          <span>
            Personas trabajando
          </span>

          <strong>
            {usuariosConTrabajo}
          </strong>

          <small>
            {usuariosDisponibles} disponibles
          </small>
        </div>

        <div className="carga-resumen-card">
          <span>
            Actividades en proceso
          </span>

          <strong>
            {tareasEnProceso.length}
          </strong>

          <small>
            Actualmente activas
          </small>
        </div>

      </div>

      {/* =====================================================
          INDICADOR GENERAL
      ===================================================== */}

      <div className="carga-equipo-progreso">

        <div className="carga-equipo-progreso-header">

          <div>
            <strong>
              Utilización general del equipo
            </strong>

            <span>
              {formatearHoras(
                totalMinutos,
              )}{" "}
              de{" "}
              {formatearHoras(
                capacidadTotal,
              )} disponibles
            </span>
          </div>

          <strong>
            {Math.round(
              porcentajeGeneral,
            )}
            %
          </strong>

        </div>

        <div className="carga-equipo-progreso-barra">

          <div
            className="carga-equipo-progreso-fill"
            style={{
              width: `${porcentajeGeneral}%`,
            }}
          />

        </div>

      </div>

      {/* =====================================================
          ALERTA SOBRECARGA
      ===================================================== */}

      {usuariosSobrecargados.length > 0 && (
        <div className="alerta-sobrecarga">

          <div className="alerta-icono">
            !
          </div>

          <div>

            <strong>
              Hay personas con sobrecarga
            </strong>

            <p>
              {usuariosSobrecargados.length}{" "}
              persona
              {usuariosSobrecargados.length !== 1
                ? "s"
                : ""}{" "}
              supera la capacidad diaria de
              8 horas.
            </p>

          </div>

        </div>
      )}

      {/* =====================================================
          ALERTA DE PAUSAS
      ===================================================== */}

      {totalPausasOtraTarea > 0 && (
        <div className="alerta-operativa">

          <div className="alerta-operativa-icono">
            i
          </div>

          <div>

            <strong>
              Actividad interrumpida
            </strong>

            <p>
              Se han registrado{" "}
              {totalPausasOtraTarea}{" "}
              pausa
              {totalPausasOtraTarea !== 1
                ? "s"
                : ""}{" "}
              para atender otra tarea.
            </p>

          </div>

        </div>
      )}

      {/* =====================================================
          PERSONAS
      ===================================================== */}

      <div className="carga-equipo-card">

        <div className="carga-equipo-card-header">

          <div>

            <span className="carga-card-eyebrow">
              EQUIPO
            </span>

            <h2>
              Distribución de trabajo
            </h2>

            <p>
              Selecciona una persona para consultar
              su planificación y disponibilidad.
            </p>

          </div>

          <div className="carga-equipo-card-indicador">
            {cargaUsuarios.length} personas
          </div>

        </div>

        {cargaUsuarios.length === 0 ? (

          <div className="carga-equipo-vacio">
            No existen usuarios activos.
          </div>

        ) : (

          <div className="carga-personas-grid">

            {cargaUsuarios.map((usuario) => {

              const porcentaje =
                Math.min(
                  (usuario.minutos /
                    MINUTOS_JORNADA) *
                    100,
                  100,
                );

              const iniciales =
                `${usuario.nombre?.charAt(0) || ""}${usuario.apellido?.charAt(0) || ""}`.toUpperCase();

              return (

                <article
                  className="persona-carga-card"
                  key={usuario.id}
                >

                  {/* IDENTIDAD */}

                  <div className="persona-carga-header">

                    <div className="persona-carga-identidad">

                      <div className="persona-carga-avatar">
                        {iniciales}
                      </div>

                      <div>

                        <strong>
                          {usuario.nombre}{" "}
                          {usuario.apellido}
                        </strong>

                        <span>
                          {usuario.cantidadTareas}{" "}
                          tarea
                          {usuario.cantidadTareas !== 1
                            ? "s"
                            : ""}
                        </span>

                      </div>

                    </div>

                    <span
                      className={`persona-estado persona-estado-${usuario.nivel}`}
                    >
                      {usuario.nivel ===
                      "sobrecargado"
                        ? "Sobrecargado"
                        : usuario.nivel ===
                            "alta"
                          ? "Carga alta"
                          : "Normal"}
                    </span>

                  </div>

                  {/* RESUMEN */}

                  <div className="persona-carga-resumen">

                    <div>
                      <span>
                        Planificado
                      </span>

                      <strong>
                        {formatearHoras(
                          usuario.minutos,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Capacidad
                      </span>

                      <strong>
                        8 h
                      </strong>
                    </div>

                    <div>
                      <span>
                        Interferencias
                      </span>

                      <strong>
                        {usuario.pausasOtraTarea}
                      </strong>
                    </div>

                  </div>

                  {/* ACTIVIDAD ACTUAL */}

                  {usuario.tareaActual && (
                    <div className="persona-actividad-actual">

                      <div className="persona-actividad-actual-top">

                        <span>
                          ACTIVIDAD ACTUAL
                        </span>

                        <strong>
                          En proceso
                        </strong>

                      </div>

                      <p>
                        {usuario.tareaActual.titulo}
                      </p>

                      {usuario.tareaActual.hora_inicio && (
                        <small>
                          Inicio{" "}
                          {usuario.tareaActual.hora_inicio}
                        </small>
                      )}

                    </div>
                  )}

                  {/* PAUSAS */}

                  {usuario.pausasOtraTarea > 0 && (
                    <div className="persona-pausas-info">

                      <span>
                        PAUSAS PARA OTRA TAREA
                      </span>

                      <strong>
                        {usuario.pausasOtraTarea}
                      </strong>

                    </div>
                  )}

                  {/* UTILIZACIÓN */}

                  <div className="persona-carga-barra">

                    <div className="persona-carga-barra-top">

                      <span>
                        Utilización
                      </span>

                      <strong>
                        {Math.round(
                          porcentaje,
                        )}
                        %
                      </strong>

                    </div>

                    <div className="barra-carga">

                      <div
                        className={`barra-carga-progreso nivel-${usuario.nivel}`}
                        style={{
                          width: `${porcentaje}%`,
                        }}
                      />

                    </div>

                  </div>

                  {/* INFORME */}

                  <div className="persona-carga-informe">

                    {usuario.nivel ===
                      "normal" && (
                      <p className="informe-verde">
                        La planificación se encuentra
                        dentro de la capacidad diaria.
                      </p>
                    )}

                    {usuario.nivel ===
                      "alta" && (
                      <p className="informe-amarillo">
                        La persona se encuentra cerca
                        de completar su capacidad diaria.
                      </p>
                    )}

                    {usuario.nivel ===
                      "sobrecargado" && (
                      <p className="informe-rojo">
                        La planificación supera la
                        capacidad diaria de 8 horas.
                      </p>
                    )}

                  </div>

                  {/* BOTÓN */}

                  <button
                    type="button"
                    className="persona-carga-boton"
                    onClick={() =>
                      abrirDetalle(usuario)
                    }
                  >
                    Ver carga
                  </button>

                </article>

              );
            })}

          </div>

        )}

      </div>

      {/* =====================================================
          PLANIFICACIÓN DEL DÍA
      ===================================================== */}

      <div className="carga-equipo-card">

        <div className="carga-equipo-card-header">

          <div>

            <span className="carga-card-eyebrow">
              PLANIFICACIÓN
            </span>

            <h2>
              Planificación del día
            </h2>

            <p>
              Actividades que ocupan esta fecha,
              incluyendo tareas de varios días.
            </p>

          </div>

          <div className="carga-equipo-card-indicador">
            {tareasDelDia.length} actividades
          </div>

        </div>

        {tareasDelDia.length === 0 ? (

          <div className="carga-equipo-vacio">
            No existen actividades planificadas
            para esta fecha.
          </div>

        ) : (

          <div className="planificacion-dia-lista">

            {tareasDelDia.map((tarea) => {

              const usuario =
                usuarios.find(
                  (item) =>
                    item.id ===
                    tarea.responsable_id,
                );

              const minutos =
                calcularMinutosTarea(
                  tarea,
                  fechaSeleccionada,
                );

              return (

                <div
                  className="planificacion-dia-item"
                  key={tarea.id}
                >

                  <div className="planificacion-dia-contenido">

                    <strong>
                      {tarea.titulo}
                    </strong>

                    <span>
                      {usuario
                        ? `${usuario.nombre} ${usuario.apellido}`
                        : "Sin responsable"}{" "}
                      ·{" "}
                      {formatearRangoTarea(
                        tarea,
                      )}
                    </span>

                    {(tarea.hora_inicio ||
                      tarea.hora_fin) && (
                      <small>
                        Horario:{" "}
                        {tarea.hora_inicio ||
                          "--:--"}{" "}
                        -{" "}
                        {tarea.hora_fin ||
                          "--:--"}
                      </small>
                    )}

                  </div>

                  <div className="planificacion-dia-meta">

                    <strong>
                      {formatearDuracion(
                        minutos,
                      )}
                    </strong>

                    <span
                      className={`planificacion-estado estado-${tarea.estado}`}
                    >
                      {obtenerTextoEstado(
                        tarea.estado,
                      )}
                    </span>

                  </div>

                </div>

              );
            })}

          </div>

        )}

      </div>

      {/* =====================================================
          MODAL DE DETALLE
      ===================================================== */}

      {usuarioSeleccionado && (

        <div
          className="carga-modal-overlay"
          onClick={cerrarDetalle}
        >

          <div
            className="carga-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="carga-modal-header">

              <div>

                <span className="carga-modal-eyebrow">
                  DETALLE DE CARGA
                </span>

                <h2>
                  {usuarioSeleccionado.nombre}{" "}
                  {usuarioSeleccionado.apellido}
                </h2>

                <p>
                  Planificación correspondiente
                  al{" "}
                  {formatearFecha(
                    fechaSeleccionada,
                  )}
                </p>

              </div>

              <button
                type="button"
                className="carga-modal-cerrar"
                onClick={cerrarDetalle}
                aria-label="Cerrar"
              >
                ×
              </button>

            </div>

            {/* =================================================
                RESUMEN MODAL
                AHORA USA minutosDetalle
                ================================================= */}

            <div className="carga-modal-resumen">

              <div>
                <span>
                  Actividades
                </span>

                <strong>
                  {
                    usuarioSeleccionado.tareas
                      .length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Carga
                </span>

                <strong>
                  {formatearHoras(
                    minutosDetalle,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Capacidad
                </span>

                <strong>
                  8 h
                </strong>
              </div>

              <div>
                <span>
                  Utilización
                </span>

                <strong>
                  {Math.round(
                    porcentajeDetalle,
                  )}
                  %
                </strong>
              </div>

            </div>

            {/* =================================================
                ACTIVIDAD ACTUAL
            ================================================= */}

            {usuarioSeleccionado.tareaActual && (
              <div className="carga-modal-actual">

                <div>

                  <span>
                    ACTIVIDAD ACTUAL
                  </span>

                  <strong>
                    En proceso
                  </strong>

                </div>

                <p>
                  {
                    usuarioSeleccionado
                      .tareaActual.titulo
                  }
                </p>

                {usuarioSeleccionado
                  .tareaActual
                  .hora_inicio && (
                  <small>
                    Iniciada a las{" "}
                    {
                      usuarioSeleccionado
                        .tareaActual
                        .hora_inicio
                    }
                  </small>
                )}

              </div>
            )}

            {/* =================================================
                PAUSAS
            ================================================= */}

            <div className="carga-modal-pausas">

              <div>

                <span>
                  PAUSAS PARA OTRA TAREA
                </span>

                <strong>
                  {
                    usuarioSeleccionado
                      .pausasOtraTarea
                  }
                </strong>

              </div>

              <p>
                Registros temporales de
                interrupciones utilizadas para
                atender otra actividad.
              </p>

            </div>

            {/* =================================================
                LISTA DE TAREAS
            ================================================= */}

            <div className="carga-modal-seccion">

              <div className="carga-modal-seccion-header">

                <h3>
                  Actividades asignadas
                </h3>

                <span>
                  {
                    usuarioSeleccionado.tareas
                      .length
                  }
                </span>

              </div>

              {usuarioSeleccionado.tareas
                .length === 0 ? (

                <div className="carga-modal-vacio">
                  No tiene actividades
                  planificadas para esta fecha.
                </div>

              ) : (

                <div className="carga-modal-tareas">

                  {usuarioSeleccionado.tareas.map(
                    (tarea) => {

                      const minutos =
                        calcularMinutosTarea(
                          tarea,
                          fechaSeleccionada,
                        );

                      return (

                        <div
                          className="carga-modal-tarea"
                          key={tarea.id}
                        >

                          <div>

                            <strong>
                              {tarea.titulo}
                            </strong>

                            <span>
                              {formatearRangoTarea(
                                tarea,
                              )}
                            </span>

                            {(tarea.hora_inicio ||
                              tarea.hora_fin) && (
                              <small>
                                {tarea.hora_inicio ||
                                  "--:--"}{" "}
                                -{" "}
                                {tarea.hora_fin ||
                                  "--:--"}
                              </small>
                            )}

                          </div>

                          <div className="carga-modal-tarea-derecha">

                            <strong>
                              {formatearDuracion(
                                minutos,
                              )}
                            </strong>

                            <span
                              className={`planificacion-estado estado-${tarea.estado}`}
                            >
                              {obtenerTextoEstado(
                                tarea.estado,
                              )}
                            </span>

                          </div>

                        </div>

                      );
                    },
                  )}

                </div>

              )}

            </div>

            {/* FOOTER */}

            <div className="carga-modal-footer">

              <button
                type="button"
                className="carga-modal-boton"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>

            </div>

          </div>

        </div>

      )}

    </section>
  );
}

export default CargaEquipo;