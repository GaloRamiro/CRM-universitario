import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./CargaEquipo.css";

function CargaEquipo() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // =========================================================
  // CONSTANTES
  // =========================================================

  const MINUTOS_JORNADA = 480;

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
              responsable_id
            `,
          )
          .order("fecha_inicio", {
            ascending: true,
          })
          .order("hora_inicio", {
            ascending: true,
          }),
      ]);

      if (usuariosError) {
        throw usuariosError;
      }

      if (tareasError) {
        throw tareasError;
      }

      setUsuarios(usuariosData || []);
      setTareas(tareasData || []);
    } catch (err) {
      console.error("Error cargando carga del equipo:", err);

      setError(
        err.message ||
          "No se pudo cargar la información del equipo.",
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // UTILIDADES DE FECHA
  // =========================================================

  const convertirFecha = (fecha) => {
    if (!fecha) return null;

    const [anio, mes, dia] = fecha.split("-");

    return new Date(
      Number(anio),
      Number(mes) - 1,
      Number(dia),
    );
  };

  const formatearFechaISO = (fecha) => {
    if (!fecha) return "";

    return `${fecha.getFullYear()}-${String(
      fecha.getMonth() + 1,
    ).padStart(2, "0")}-${String(
      fecha.getDate(),
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // SABER SI UNA TAREA ESTÁ ACTIVA EN UNA FECHA
  // =========================================================

  const tareaOcupaFecha = (tarea, fecha) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      tarea.fecha_inicio ||
      tarea.fecha;

    if (!inicio) return false;

    return (
      fecha >= inicio &&
      fecha <= fin
    );
  };

  // =========================================================
  // TAREAS DEL DÍA
  // =========================================================

  const tareasDelDia = useMemo(() => {
    return tareas.filter((tarea) =>
      tareaOcupaFecha(
        tarea,
        fechaSeleccionada,
      ),
    );
  }, [tareas, fechaSeleccionada]);

  // =========================================================
  // CONVERTIR HORA A MINUTOS
  // =========================================================

  const convertirHoraAMinutos = (hora) => {
    if (!hora) return null;

    const [horas, minutos] =
      hora.split(":").map(Number);

    if (
      !Number.isFinite(horas) ||
      !Number.isFinite(minutos)
    ) {
      return null;
    }

    return horas * 60 + minutos;
  };

  // =========================================================
  // DURACIÓN HORARIA
  // =========================================================

  const obtenerDuracionHorario = (tarea) => {
    const inicio =
      convertirHoraAMinutos(
        tarea.hora_inicio,
      );

    const fin =
      convertirHoraAMinutos(
        tarea.hora_fin,
      );

    if (
      inicio === null ||
      fin === null ||
      fin <= inicio
    ) {
      return null;
    }

    return fin - inicio;
  };

  // =========================================================
  // MINUTOS PLANIFICADOS
  // =========================================================

  const obtenerMinutosPlanificados = (tarea) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      tarea.fecha_inicio ||
      tarea.fecha;

    const esMultidia =
      inicio &&
      fin &&
      inicio !== fin;

    /*
     * Una tarea de varios días ocupa
     * una jornada completa de 8 horas
     * en cada día del rango.
     */
    if (esMultidia) {
      return MINUTOS_JORNADA;
    }

    const duracionHorario =
      obtenerDuracionHorario(tarea);

    if (duracionHorario !== null) {
      return Math.min(
        duracionHorario,
        MINUTOS_JORNADA,
      );
    }

    const tiempoEstimado = Number(
      tarea.tiempo_estimado,
    );

    if (
      Number.isFinite(tiempoEstimado) &&
      tiempoEstimado > 0
    ) {
      return Math.min(
        tiempoEstimado,
        MINUTOS_JORNADA,
      );
    }

    return MINUTOS_JORNADA;
  };

  // =========================================================
  // DETECTAR INTERFERENCIAS
  // =========================================================

  const detectarInterferencias = (
    tareasUsuario,
  ) => {
    const interferencias = [];

    for (
      let i = 0;
      i < tareasUsuario.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < tareasUsuario.length;
        j++
      ) {
        const tareaA =
          tareasUsuario[i];

        const tareaB =
          tareasUsuario[j];

        const inicioA =
          convertirHoraAMinutos(
            tareaA.hora_inicio,
          );

        const finA =
          convertirHoraAMinutos(
            tareaA.hora_fin,
          );

        const inicioB =
          convertirHoraAMinutos(
            tareaB.hora_inicio,
          );

        const finB =
          convertirHoraAMinutos(
            tareaB.hora_fin,
          );

        if (
          inicioA === null ||
          finA === null ||
          inicioB === null ||
          finB === null
        ) {
          continue;
        }

        const hayCruce =
          inicioA < finB &&
          inicioB < finA;

        if (!hayCruce) {
          continue;
        }

        const inicioCruce =
          Math.max(
            inicioA,
            inicioB,
          );

        const finCruce =
          Math.min(
            finA,
            finB,
          );

        const minutosCruce =
          finCruce -
          inicioCruce;

        interferencias.push({
          tareaA,
          tareaB,
          inicioCruce,
          finCruce,
          minutosCruce,
        });
      }
    }

    return interferencias;
  };

  // =========================================================
  // FORMATEAR HORARIO
  // =========================================================

  const formatearHora = (minutos) => {
    if (
      minutos === null ||
      minutos === undefined
    ) {
      return "--:--";
    }

    const horas = Math.floor(
      minutos / 60,
    );

    const minutosRestantes =
      minutos % 60;

    return `${String(horas).padStart(
      2,
      "0",
    )}:${String(
      minutosRestantes,
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // CARGA POR PERSONA
  // =========================================================

  const cargaUsuarios = useMemo(() => {
    return usuarios.map((usuario) => {
      const tareasUsuario =
        tareasDelDia.filter(
          (tarea) =>
            tarea.responsable_id ===
            usuario.id,
        );

      const minutos =
        tareasUsuario.reduce(
          (total, tarea) =>
            total +
            obtenerMinutosPlanificados(
              tarea,
            ),
          0,
        );

      const horas = minutos / 60;

      const exceso = Math.max(
        minutos -
          MINUTOS_JORNADA,
        0,
      );

      const interferencias =
        detectarInterferencias(
          tareasUsuario,
        );

      let nivel = "normal";

      if (
        minutos >
        MINUTOS_JORNADA
      ) {
        nivel = "sobrecargado";
      } else if (
        minutos >= 360
      ) {
        nivel = "alta";
      }

      return {
        ...usuario,
        tareas: tareasUsuario,
        cantidadTareas:
          tareasUsuario.length,
        minutos,
        horas,
        exceso,
        interferencias,
        cantidadInterferencias:
          interferencias.length,
        nivel,
      };
    });
  }, [usuarios, tareasDelDia]);

  // =========================================================
  // RESUMEN GENERAL
  // =========================================================

  const totalMinutos = useMemo(() => {
    return tareasDelDia.reduce(
      (total, tarea) =>
        total +
        obtenerMinutosPlanificados(
          tarea,
        ),
      0,
    );
  }, [tareasDelDia]);

  const usuariosSobrecargados =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.nivel ===
        "sobrecargado",
    );

  const usuariosCargaAlta =
    cargaUsuarios.filter(
      (usuario) =>
        usuario.nivel === "alta",
    );

  const totalInterferencias =
    cargaUsuarios.reduce(
      (total, usuario) =>
        total +
        usuario.cantidadInterferencias,
      0,
    );

  // =========================================================
  // BARRA GENERAL DEL EQUIPO
  // =========================================================

  const capacidadTotalEquipo =
    usuarios.length *
    MINUTOS_JORNADA;

  const porcentajeCargaEquipo =
    capacidadTotalEquipo > 0
      ? Math.min(
          (totalMinutos /
            capacidadTotalEquipo) *
            100,
          100,
        )
      : 0;

  // =========================================================
  // FORMATEAR HORAS
  // =========================================================

  const formatearHoras = (minutos) => {
    if (!minutos) {
      return "0 h";
    }

    const horas = Math.floor(
      minutos / 60,
    );

    const minutosRestantes =
      minutos % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (minutosRestantes === 0) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  // =========================================================
  // FORMATEAR FECHA
  // =========================================================

  const formatearFecha = (fecha) => {
    if (!fecha) return "";

    const fechaLocal =
      convertirFecha(fecha);

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
  // CAMBIAR FECHA
  // =========================================================

  const cambiarFecha = (dias) => {
    const fecha =
      convertirFecha(
        fechaSeleccionada,
      );

    fecha.setDate(
      fecha.getDate() + dias,
    );

    setFechaSeleccionada(
      formatearFechaISO(fecha),
    );
  };

  // =========================================================
  // IR A HOY
  // =========================================================

  const irHoy = () => {
    const hoy = new Date();

    setFechaSeleccionada(
      formatearFechaISO(hoy),
    );
  };

  // =========================================================
  // MODAL
  // =========================================================

  const abrirDetalleUsuario = (
    usuario,
  ) => {
    setUsuarioSeleccionado(usuario);
  };

  const cerrarDetalleUsuario = () => {
    setUsuarioSeleccionado(null);
  };

  // =========================================================
  // RENDER CARGANDO
  // =========================================================

  if (cargando) {
    return (
      <section className="carga-equipo-page">
        <div className="carga-equipo-card">
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

      {/* ENCABEZADO */}

      <div className="carga-equipo-header">
        <div>
          <span className="eyebrow">
            GESTIÓN
          </span>

          <h1>
            Carga del equipo
          </h1>

          <p>
            Controla la planificación y
            distribución de trabajo del equipo.
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

      {/* ERROR */}

      {error && (
        <div className="carga-equipo-error">
          {error}
        </div>
      )}

      {/* CONSULTA DE FECHA */}

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

            <button
              type="button"
              className="carga-fecha-hoy"
              onClick={irHoy}
            >
              Hoy
            </button>

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

          </div>
        </div>

        <div className="carga-equipo-fecha">
          {formatearFecha(
            fechaSeleccionada,
          )}
        </div>

      </div>

      {/* RESUMEN */}

      <div className="carga-equipo-resumen">

        <div className="carga-resumen-card">
          <span>
            Tareas del día
          </span>

          <strong>
            {tareasDelDia.length}
          </strong>
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
        </div>

        <div className="carga-resumen-card">
          <span>
            Carga alta
          </span>

          <strong>
            {usuariosCargaAlta.length}
          </strong>
        </div>

        <div className="carga-resumen-card">
          <span>
            Sobrecargados
          </span>

          <strong>
            {usuariosSobrecargados.length}
          </strong>
        </div>

      </div>

      {/* BARRA GENERAL DEL EQUIPO */}

      <div className="carga-equipo-progreso">

        <div className="carga-equipo-progreso-header">
          <div>
            <strong>
              Carga general del equipo
            </strong>

            <span>
              {formatearHoras(totalMinutos)} de{" "}
              {formatearHoras(
                capacidadTotalEquipo,
              )} disponibles
            </span>
          </div>

          <strong>
            {Math.round(
              porcentajeCargaEquipo,
            )}
            %
          </strong>
        </div>

        <div className="carga-equipo-progreso-barra">
          <div
            className="carga-equipo-progreso-fill"
            style={{
              width: `${porcentajeCargaEquipo}%`,
            }}
          />
        </div>

      </div>

      {/* ALERTA */}

      {(usuariosSobrecargados.length > 0 ||
        totalInterferencias > 0) && (
        <div className="alerta-sobrecarga">

          <div className="alerta-icono">
            !
          </div>

          <div>
            <strong>
              Se detectaron conflictos de
              planificación
            </strong>

            <p>
              {usuariosSobrecargados.length >
                0 &&
                `${usuariosSobrecargados.length} persona${
                  usuariosSobrecargados.length ===
                  1
                    ? ""
                    : "s"
                } sobrecargada${
                  usuariosSobrecargados.length ===
                  1
                    ? ""
                    : "s"
                }.`}

              {usuariosSobrecargados.length >
                0 &&
                totalInterferencias > 0 &&
                " "}

              {totalInterferencias > 0 &&
                `${totalInterferencias} interferencia${
                  totalInterferencias === 1
                    ? ""
                    : "s"
                } detectada${
                  totalInterferencias === 1
                    ? ""
                    : "s"
                }.`}
            </p>
          </div>

        </div>
      )}

      {/* PERSONAS */}

      <div className="carga-equipo-card">

        <div className="carga-equipo-card-header">

          <div>
            <h2>
              Equipo
            </h2>

            <p>
              Selecciona una persona para
              consultar su planificación.
            </p>
          </div>

        </div>

        {cargaUsuarios.length === 0 ? (
          <div className="carga-equipo-vacio">
            No existen usuarios activos.
          </div>
        ) : (
          <div className="carga-personas-grid">

            {cargaUsuarios.map(
              (usuario) => {

                const porcentaje = Math.min(
                  (usuario.minutos /
                    MINUTOS_JORNADA) *
                    100,
                  100,
                );

                return (
                  <article
                    className="persona-carga-card"
                    key={usuario.id}
                  >

                    {/* CABECERA */}

                    <div className="persona-carga-header">

                      <div className="persona-carga-identidad">

                        <div className="persona-carga-avatar">
                          {(
                            usuario.nombre?.charAt(
                              0,
                            ) || ""
                          ).toUpperCase()}

                          {(
                            usuario.apellido?.charAt(
                              0,
                            ) || ""
                          ).toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {usuario.nombre}{" "}
                            {usuario.apellido}
                          </strong>

                          <span>
                            {usuario.cantidadTareas}{" "}
                            {usuario.cantidadTareas ===
                            1
                              ? "tarea"
                              : "tareas"}
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
                          {
                            usuario.cantidadInterferencias
                          }
                        </strong>
                      </div>

                    </div>

                    {/* BARRA */}

                    <div className="persona-carga-barra">

                      <div className="persona-carga-barra-top">

                        <span>
                          Utilización
                        </span>

                        <strong>
                          {Math.round(
                            (usuario.minutos /
                              MINUTOS_JORNADA) *
                              100,
                          )}
                          %
                        </strong>

                      </div>

                      <div className="barra-carga">

                        <div
                          className="barra-carga-progreso"
                          style={{
                            width: `${porcentaje}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* INFORME */}

                    <div className="persona-carga-informe">

                      {usuario.nivel ===
                        "sobrecargado" && (
                        <p className="informe-rojo">
                          Supera la capacidad
                          diaria en{" "}
                          <strong>
                            {formatearHoras(
                              usuario.exceso,
                            )}
                          </strong>
                          .
                        </p>
                      )}

                      {usuario.nivel ===
                        "alta" && (
                        <p className="informe-amarillo">
                          La persona está cerca
                          de su capacidad diaria.
                        </p>
                      )}

                      {usuario.nivel ===
                        "normal" && (
                        <p className="informe-verde">
                          La planificación se
                          encuentra dentro de la
                          capacidad diaria.
                        </p>
                      )}

                      {usuario.cantidadInterferencias >
                        0 && (
                        <p className="informe-interferencia">
                          Hay{" "}
                          <strong>
                            {
                              usuario.cantidadInterferencias
                            }
                          </strong>{" "}
                          interferencia
                          {usuario.cantidadInterferencias ===
                          1
                            ? ""
                            : "s"}{" "}
                          horaria
                          {usuario.cantidadInterferencias ===
                          1
                            ? ""
                            : "s"}.
                        </p>
                      )}

                    </div>

                    {/* BOTÓN */}

                    <button
                      type="button"
                      className="persona-carga-boton"
                      onClick={() =>
                        abrirDetalleUsuario(
                          usuario,
                        )
                      }
                    >
                      Ver carga
                    </button>

                  </article>
                );
              },
            )}

          </div>
        )}

      </div>

      {/* TAREAS GENERALES */}

      <div className="carga-equipo-card">

        <div className="carga-equipo-card-header">

          <div>
            <h2>
              Planificación del día
            </h2>

            <p>
              Actividades que ocupan esta fecha,
              incluyendo tareas de varios días.
            </p>
          </div>

        </div>

        {tareasDelDia.length === 0 ? (
          <div className="carga-equipo-vacio">
            No existen tareas para esta fecha.
          </div>
        ) : (
          <div className="lista-tareas-carga">

            {tareasDelDia.map(
              (tarea) => {

                const usuario =
                  usuarios.find(
                    (item) =>
                      item.id ===
                      tarea.responsable_id,
                  );

                return (
                  <div
                    className="tarea-carga-item"
                    key={tarea.id}
                  >

                    <div>

                      <strong>
                        {tarea.titulo}
                      </strong>

                      <span>
                        {usuario
                          ? `${usuario.nombre} ${usuario.apellido}`
                          : "Sin responsable"}

                        {" · "}

                        {tarea.fecha_inicio}

                        {tarea.fecha_fin &&
                          tarea.fecha_fin !==
                            tarea.fecha_inicio &&
                          ` → ${tarea.fecha_fin}`}
                      </span>

                      {tarea.hora_inicio &&
                        tarea.hora_fin && (
                          <span>
                            Horario:{" "}
                            {tarea.hora_inicio} -{" "}
                            {tarea.hora_fin}
                          </span>
                        )}

                    </div>

                    <div className="tarea-carga-tiempo">
                      {formatearHoras(
                        obtenerMinutosPlanificados(
                          tarea,
                        ),
                      )}
                    </div>

                  </div>
                );
              },
            )}

          </div>
        )}

      </div>

      {/* =====================================================
          MODAL DE PERSONA
      ===================================================== */}

      {usuarioSeleccionado && (
        <div
          className="carga-modal-overlay"
          onClick={
            cerrarDetalleUsuario
          }
        >

          <div
            className="carga-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CABECERA MODAL */}

            <div className="carga-modal-header">

              <div>

                <span className="carga-modal-eyebrow">
                  DETALLE DE CARGA
                </span>

                <h2>
                  {
                    usuarioSeleccionado.nombre
                  }{" "}
                  {
                    usuarioSeleccionado.apellido
                  }
                </h2>

                <p>
                  Planificación del{" "}
                  {formatearFecha(
                    fechaSeleccionada,
                  )}
                </p>

              </div>

              <button
                type="button"
                className="carga-modal-cerrar"
                onClick={
                  cerrarDetalleUsuario
                }
                aria-label="Cerrar"
              >
                ×
              </button>

            </div>

            {/* RESUMEN MODAL */}

            <div className="carga-modal-resumen">

              <div>
                <span>
                  Tareas
                </span>

                <strong>
                  {
                    usuarioSeleccionado.cantidadTareas
                  }
                </strong>
              </div>

              <div>
                <span>
                  Planificado
                </span>

                <strong>
                  {formatearHoras(
                    usuarioSeleccionado.minutos,
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
                  {
                    usuarioSeleccionado.cantidadInterferencias
                  }
                </strong>
              </div>

            </div>

            {/* BARRA MODAL */}

            <div className="carga-modal-progreso">

              <div className="carga-modal-progreso-header">
                <span>
                  Utilización de la jornada
                </span>

                <strong>
                  {Math.round(
                    (usuarioSeleccionado.minutos /
                      MINUTOS_JORNADA) *
                      100,
                  )}
                  %
                </strong>
              </div>

              <div className="carga-modal-progreso-barra">
                <div
                  className="carga-modal-progreso-fill"
                  style={{
                    width: `${Math.min(
                      (usuarioSeleccionado.minutos /
                        MINUTOS_JORNADA) *
                        100,
                      100,
                    )}%`,
                  }}
                />
              </div>

            </div>

            {/* ALERTA */}

            {usuarioSeleccionado.nivel ===
              "sobrecargado" && (
              <div className="carga-modal-alerta carga-modal-alerta-roja">

                <strong>
                  Persona sobrecargada
                </strong>

                <p>
                  La planificación supera la
                  capacidad diaria de 8 horas
                  en{" "}
                  <strong>
                    {formatearHoras(
                      usuarioSeleccionado.exceso,
                    )}
                  </strong>
                  .
                </p>

              </div>
            )}

            {/* TAREAS */}

            <div className="carga-modal-seccion">

              <div className="carga-modal-seccion-header">

                <h3>
                  Tareas planificadas
                </h3>

                <span>
                  {
                    usuarioSeleccionado.cantidadTareas
                  }
                </span>

              </div>

              {usuarioSeleccionado.tareas
                .length === 0 ? (
                <div className="carga-modal-vacio">
                  Esta persona no tiene tareas
                  planificadas para esta fecha.
                </div>
              ) : (
                <div className="carga-modal-tareas">

                  {usuarioSeleccionado.tareas.map(
                    (tarea) => {

                      const duracion =
                        obtenerMinutosPlanificados(
                          tarea,
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
                              {tarea.fecha_inicio}

                              {tarea.fecha_fin &&
                                tarea.fecha_fin !==
                                  tarea.fecha_inicio &&
                                ` → ${tarea.fecha_fin}`}
                            </span>

                            {tarea.hora_inicio &&
                              tarea.hora_fin && (
                                <span>
                                  {tarea.hora_inicio}{" "}
                                  -{" "}
                                  {tarea.hora_fin}
                                </span>
                              )}

                          </div>

                          <strong className="carga-modal-tarea-tiempo">
                            {formatearHoras(
                              duracion,
                            )}
                          </strong>

                        </div>
                      );
                    },
                  )}

                </div>
              )}

            </div>

            {/* INTERFERENCIAS */}

            {usuarioSeleccionado
              .interferencias
              .length > 0 && (

              <div className="carga-modal-seccion">

                <div className="carga-modal-seccion-header">

                  <h3>
                    Interferencias detectadas
                  </h3>

                  <span className="contador-interferencia">
                    {
                      usuarioSeleccionado
                        .interferencias
                        .length
                    }
                  </span>

                </div>

                <div className="carga-interferencias">

                  {usuarioSeleccionado.interferencias.map(
                    (
                      interferencia,
                      index,
                    ) => (

                      <div
                        className="carga-interferencia"
                        key={`${interferencia.tareaA.id}-${interferencia.tareaB.id}-${index}`}
                      >

                        <div className="interferencia-titulo">
                          Interferencia{" "}
                          {index + 1}
                        </div>

                        <div className="interferencia-tareas">

                          <div>
                            <strong>
                              {
                                interferencia
                                  .tareaA
                                  .titulo
                              }
                            </strong>

                            <span>
                              {
                                interferencia
                                  .tareaA
                                  .hora_inicio
                              }{" "}
                              -{" "}
                              {
                                interferencia
                                  .tareaA
                                  .hora_fin
                              }
                            </span>
                          </div>

                          <div>
                            <strong>
                              {
                                interferencia
                                  .tareaB
                                  .titulo
                              }
                            </strong>

                            <span>
                              {
                                interferencia
                                  .tareaB
                                  .hora_inicio
                              }{" "}
                              -{" "}
                              {
                                interferencia
                                  .tareaB
                                  .hora_fin
                              }
                            </span>
                          </div>

                        </div>

                        <div className="interferencia-detalle">

                          <strong>
                            Se cruzan de{" "}
                            {formatearHora(
                              interferencia.inicioCruce,
                            )}{" "}
                            a{" "}
                            {formatearHora(
                              interferencia.finCruce,
                            )}
                          </strong>

                          <span>
                            Tiempo de interferencia:{" "}
                            {formatearHoras(
                              interferencia.minutosCruce,
                            )}
                          </span>

                        </div>

                      </div>

                    ),
                  )}

                </div>

              </div>
            )}

            {/* CIERRE */}

            <div className="carga-modal-footer">

              <button
                type="button"
                className="carga-modal-boton"
                onClick={
                  cerrarDetalleUsuario
                }
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