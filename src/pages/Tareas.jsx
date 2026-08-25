import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Tareas.css";

function Tareas() {
  const navigate = useNavigate();

  const [vista, setVista] = useState("semana");
  const [fechaActual, setFechaActual] = useState(new Date());
  const [filtroEstado, setFiltroEstado] = useState("todas");

  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // =========================================================
  // CARGAR INFORMACIÓN
  // =========================================================

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError("");

    try {
      const [
        { data: tareasData, error: tareasError },
        { data: usuariosData, error: usuariosError },
        { data: departamentosData, error: departamentosError },
      ] = await Promise.all([
        supabase
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
            tiempo_estimado
          `)
          .order("fecha_inicio", { ascending: true })
          .order("hora_inicio", { ascending: true }),

        supabase
          .from("usuarios")
          .select("id, nombre, apellido, email, activo")
          .eq("activo", true)
          .order("nombre"),

        supabase
          .from("departamentos")
          .select("id, nombre")
          .order("nombre"),
      ]);

      if (tareasError) {
        console.error("Error cargando tareas:", tareasError);
        throw new Error("No se pudieron cargar las tareas.");
      }

      if (usuariosError) {
        console.error("Error cargando usuarios:", usuariosError);
      }

      if (departamentosError) {
        console.error("Error cargando departamentos:", departamentosError);
      }

      setTareas(tareasData || []);
      setUsuarios(usuariosData || []);
      setDepartamentos(departamentosData || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // NOMBRES
  // =========================================================

  const obtenerUsuario = (id) => {
    if (!id) return null;

    return usuarios.find((usuario) => usuario.id === id) || null;
  };

  const obtenerDepartamento = (id) => {
    if (!id) return null;

    return (
      departamentos.find((departamento) => departamento.id === id) || null
    );
  };

  const obtenerNombreUsuario = (id) => {
    const usuario = obtenerUsuario(id);

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();
  };

  const obtenerNombreDepartamento = (id) => {
    const departamento = obtenerDepartamento(id);

    return departamento?.nombre || "Sin departamento";
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const nombresMeses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const nombresDias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  const formatearFecha = (fecha) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
  };

  const formatearFechaBonita = (fechaTexto) => {
    if (!fechaTexto) return "Sin fecha";

    const fecha = new Date(`${fechaTexto}T00:00:00`);

    return `${fecha.getDate()} de ${
      nombresMeses[fecha.getMonth()]
    }`;
  };

  const formatearFechaCompleta = (fechaTexto) => {
    if (!fechaTexto) return "Sin fecha";

    const fecha = new Date(`${fechaTexto}T00:00:00`);

    return `${nombresDias[fecha.getDay()]} ${fecha.getDate()} de ${
      nombresMeses[fecha.getMonth()]
    } ${fecha.getFullYear()}`;
  };

  // =========================================================
  // NAVEGACIÓN DEL CALENDARIO
  // =========================================================

  const cambiarFecha = (cantidad) => {
    const nuevaFecha = new Date(fechaActual);

    if (vista === "dia") {
      nuevaFecha.setDate(nuevaFecha.getDate() + cantidad);
    }

    if (vista === "semana") {
      nuevaFecha.setDate(nuevaFecha.getDate() + cantidad * 7);
    }

    if (vista === "mes") {
      nuevaFecha.setMonth(nuevaFecha.getMonth() + cantidad);
    }

    if (vista === "anio") {
      nuevaFecha.setFullYear(nuevaFecha.getFullYear() + cantidad);
    }

    setFechaActual(nuevaFecha);
  };

  const irHoy = () => {
    setFechaActual(new Date());
  };

  // =========================================================
  // SEMANA
  // =========================================================

  const inicioSemana = useMemo(() => {
    const fecha = new Date(fechaActual);
    const dia = fecha.getDay();

    fecha.setDate(fecha.getDate() - dia);
    fecha.setHours(0, 0, 0, 0);

    return fecha;
  }, [fechaActual]);

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const fecha = new Date(inicioSemana);

      fecha.setDate(inicioSemana.getDate() + index);

      return fecha;
    });
  }, [inicioSemana]);

  // =========================================================
  // FILTROS
  // =========================================================

  const tareasFiltradas = useMemo(() => {
    if (filtroEstado === "todas") {
      return tareas;
    }

    return tareas.filter((tarea) => tarea.estado === filtroEstado);
  }, [tareas, filtroEstado]);

  const tareasDeFecha = (fecha) => {
    const fechaTexto = formatearFecha(fecha);

    return tareasFiltradas.filter((tarea) => {
      const fechaTarea = tarea.fecha || tarea.fecha_inicio;

      return fechaTarea === fechaTexto;
    });
  };

  // =========================================================
  // TEXTOS
  // =========================================================

  const nombreEstado = (estado) => {
    const estados = {
      pendiente: "Pendiente",
      en_proceso: "En proceso",
      completada: "Completada",
    };

    return estados[estado] || estado || "Pendiente";
  };

  const nombrePrioridad = (prioridad) => {
    const prioridades = {
      alta: "Alta",
      media: "Media",
      baja: "Baja",
    };

    return prioridades[prioridad] || prioridad || "Media";
  };

  const obtenerTituloFecha = () => {
    if (vista === "dia") {
      return `${nombresDias[fechaActual.getDay()]} ${
        fechaActual.getDate()
      } de ${nombresMeses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    }

    if (vista === "mes") {
      return `${nombresMeses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
    }

    if (vista === "anio") {
      return fechaActual.getFullYear();
    }

    const inicio = diasSemana[0];
    const fin = diasSemana[6];

    return `${inicio.getDate()} ${
      nombresMeses[inicio.getMonth()]
    } - ${fin.getDate()} ${
      nombresMeses[fin.getMonth()]
    } ${fin.getFullYear()}`;
  };

  // =========================================================
  // ICONOS / AVATAR
  // =========================================================

  const obtenerIniciales = (id) => {
    const usuario = obtenerUsuario(id);

    if (!usuario) {
      return "SR";
    }

    const nombre = usuario.nombre?.charAt(0) || "";
    const apellido = usuario.apellido?.charAt(0) || "";

    return `${nombre}${apellido}`.toUpperCase();
  };

  // =========================================================
  // TARJETA DE TAREA
  // =========================================================

  const renderTarea = (tarea, modo = "normal") => {
    const fecha = tarea.fecha || tarea.fecha_inicio;

    const responsable = obtenerNombreUsuario(tarea.responsable_id);
    const departamento = obtenerNombreDepartamento(
      tarea.departamento_id
    );

    const iniciales = obtenerIniciales(tarea.responsable_id);

    return (
      <article
        key={tarea.id}
        className={`tarea-card-item prioridad-${tarea.prioridad || "media"} ${
          modo === "mes" ? "tarea-card-mes" : ""
        }`}
        onClick={() => navigate(`/tareas/${tarea.id}/editar`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/tareas/${tarea.id}/editar`);
          }
        }}
      >
        {/* ENCABEZADO */}

        <div className="tarea-card-top">
          <div className="tarea-card-titulo">
            <strong>{tarea.titulo || "Sin título"}</strong>

            {tarea.descripcion && (
              <p>{tarea.descripcion}</p>
            )}
          </div>

          <span
            className={`tarea-status estado-${tarea.estado || "pendiente"}`}
          >
            {nombreEstado(tarea.estado)}
          </span>
        </div>

        {/* INFORMACIÓN PRINCIPAL */}

        <div className="tarea-card-info">
          <div className="tarea-info-item">
            <span className="tarea-info-label">Fecha</span>

            <span className="tarea-info-value">
              {formatearFechaBonita(fecha)}
            </span>
          </div>

          <div className="tarea-info-item">
            <span className="tarea-info-label">Horario</span>

            <span className="tarea-info-value">
              {tarea.hora_inicio || "--:--"}
              {tarea.hora_fin
                ? ` - ${tarea.hora_fin}`
                : ""}
            </span>
          </div>

          <div className="tarea-info-item">
            <span className="tarea-info-label">Tiempo</span>

            <span className="tarea-info-value">
              {tarea.tiempo_estimado || 0} min
            </span>
          </div>
        </div>

        {/* FOOTER */}

        <div className="tarea-card-footer">
          <div className="tarea-responsable">
            <span className="tarea-avatar">
              {iniciales}
            </span>

            <div>
              <small>Responsable</small>

              <strong>{responsable}</strong>
            </div>
          </div>

          <div className="tarea-departamento">
            <small>Departamento</small>

            <strong>{departamento}</strong>
          </div>

          <span
            className={`tarea-prioridad prioridad-${tarea.prioridad || "media"}`}
          >
            {nombrePrioridad(tarea.prioridad)}
          </span>
        </div>
      </article>
    );
  };

  // =========================================================
  // VISTA DÍA
  // =========================================================

  const renderDia = () => {
    const tareasHoy = tareasDeFecha(fechaActual);

    return (
      <div className="vista-dia">
        <div className="vista-dia-header">
          <div>
            <span className="vista-eyebrow">
              AGENDA DIARIA
            </span>

            <h2>
              {formatearFechaCompleta(
                formatearFecha(fechaActual)
              )}
            </h2>
          </div>

          <span className="contador-tareas">
            {tareasHoy.length}{" "}
            {tareasHoy.length === 1 ? "tarea" : "tareas"}
          </span>
        </div>

        {tareasHoy.length === 0 ? (
          <div className="estado-vacio">
            <strong>No hay tareas para este día</strong>

            <span>
              Puedes crear una nueva tarea desde el botón
              superior.
            </span>
          </div>
        ) : (
          <div className="lista-tareas-dia">
            {tareasHoy.map((tarea) =>
              renderTarea(tarea)
            )}
          </div>
        )}
      </div>
    );
  };

  // =========================================================
  // VISTA SEMANA
  // =========================================================

  const renderSemana = () => {
    return (
      <div className="calendario-semana">
        {diasSemana.map((dia) => {
          const tareasDia = tareasDeFecha(dia);

          const esHoy =
            formatearFecha(dia) ===
            formatearFecha(new Date());

          return (
            <div
              className={`dia-columna ${
                esHoy ? "dia-hoy" : ""
              }`}
              key={formatearFecha(dia)}
            >
              <div className="dia-header">
                <span>
                  {nombresDias[dia.getDay()]}
                </span>

                <strong>{dia.getDate()}</strong>

                <small>
                  {tareasDia.length}{" "}
                  {tareasDia.length === 1
                    ? "tarea"
                    : "tareas"}
                </small>
              </div>

              <div className="dia-tareas">
                {tareasDia.length > 0 ? (
                  tareasDia.map((tarea) =>
                    renderTarea(tarea)
                  )
                ) : (
                  <div className="dia-sin-tareas">
                    Sin tareas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // =========================================================
  // VISTA MES
  // =========================================================

  const renderMes = () => {
    const primerDia = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth(),
      1
    );

    const ultimoDia = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth() + 1,
      0
    );

    const espaciosIniciales = primerDia.getDay();

    const dias = [];

    for (
      let i = 0;
      i < espaciosIniciales;
      i++
    ) {
      dias.push(null);
    }

    for (
      let dia = 1;
      dia <= ultimoDia.getDate();
      dia++
    ) {
      dias.push(
        new Date(
          fechaActual.getFullYear(),
          fechaActual.getMonth(),
          dia
        )
      );
    }

    return (
      <div className="calendario-mes">
        {nombresDias.map((dia) => (
          <div
            className="mes-dia-nombre"
            key={dia}
          >
            {dia}
          </div>
        ))}

        {dias.map((dia, index) => {
          if (!dia) {
            return (
              <div
                className="mes-celda vacia"
                key={`vacia-${index}`}
              />
            );
          }

          const tareasDia = tareasDeFecha(dia);

          const esHoy =
            formatearFecha(dia) ===
            formatearFecha(new Date());

          return (
            <div
              className={`mes-celda ${
                esHoy ? "mes-hoy" : ""
              }`}
              key={formatearFecha(dia)}
            >
              <div className="mes-celda-header">
                <strong>{dia.getDate()}</strong>

                {tareasDia.length > 0 && (
                  <span>
                    {tareasDia.length}
                  </span>
                )}
              </div>

              <div className="mes-tareas">
                {tareasDia
                  .slice(0, 3)
                  .map((tarea) =>
                    renderTarea(
                      tarea,
                      "mes"
                    )
                  )}

                {tareasDia.length > 3 && (
                  <span className="mes-mas">
                    +{tareasDia.length - 3} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // =========================================================
  // VISTA AÑO
  // =========================================================

  const renderAnio = () => {
    return (
      <div className="calendario-anio">
        {nombresMeses.map((mes, index) => {
          const tareasMes =
            tareasFiltradas.filter((tarea) => {
              const fechaTarea =
                tarea.fecha || tarea.fecha_inicio;

              if (!fechaTarea) {
                return false;
              }

              const fecha = new Date(
                `${fechaTarea}T00:00:00`
              );

              return (
                fecha.getFullYear() ===
                  fechaActual.getFullYear() &&
                fecha.getMonth() === index
              );
            });

          return (
            <div
              className="anio-mes"
              key={mes}
            >
              <div className="anio-mes-header">
                <div>
                  <span>MES</span>

                  <h3>{mes}</h3>
                </div>

                <strong>
                  {tareasMes.length}
                </strong>
              </div>

              <div className="anio-mes-lista">
                {tareasMes.length === 0 ? (
                  <span className="anio-sin-tareas">
                    Sin tareas
                  </span>
                ) : (
                  tareasMes
                    .slice(0, 4)
                    .map((tarea) =>
                      renderTarea(
                        tarea,
                        "mes"
                      )
                    )
                )}

                {tareasMes.length > 4 && (
                  <span className="anio-mas">
                    +{tareasMes.length - 4} tareas más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="tareas-page">

      {/* HEADER */}

      <div className="tareas-header">
        <div>
          <span className="eyebrow">
            GESTIÓN
          </span>

          <h1>Tareas</h1>

          <p>
            Organiza, consulta y controla las
            actividades del equipo.
          </p>
        </div>

        <button
          className="tareas-btn-principal"
          type="button"
          onClick={() =>
            navigate("/tareas/nueva")
          }
        >
          + Nueva tarea
        </button>
      </div>

      {/* CONTENEDOR */}

      <div className="tareas-card">

        {/* TOOLBAR */}

        <div className="tareas-toolbar">

          <div className="tareas-vistas">
            {[
              ["anio", "Año"],
              ["mes", "Mes"],
              ["semana", "Semana"],
              ["dia", "Día"],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                className={
                  vista === valor
                    ? "vista-activa"
                    : ""
                }
                onClick={() =>
                  setVista(valor)
                }
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="tareas-filtros">
            <select
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(
                  e.target.value
                )
              }
            >
              <option value="todas">
                Todos los estados
              </option>

              <option value="pendiente">
                Pendientes
              </option>

              <option value="en_proceso">
                En proceso
              </option>

              <option value="completada">
                Completadas
              </option>
            </select>
          </div>
        </div>

        {/* NAVEGACIÓN */}

        <div className="tareas-navegacion">

          <div className="tareas-navegacion-botones">

            <button
              type="button"
              onClick={() =>
                cambiarFecha(-1)
              }
              aria-label="Anterior"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={irHoy}
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() =>
                cambiarFecha(1)
              }
              aria-label="Siguiente"
            >
              ›
            </button>

          </div>

          <h2>
            {obtenerTituloFecha()}
          </h2>

        </div>

        {/* CONTENIDO */}

        {cargando && (
          <div className="tareas-contenido">
            <div className="estado-cargando">
              <span className="loader" />
              <p>Cargando tareas...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="tareas-contenido">
            <div className="estado-error">
              <strong>
                No se pudieron cargar las tareas
              </strong>

              <span>{error}</span>

              <button
                type="button"
                onClick={cargarDatos}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {!cargando && !error && (
          <div className="tareas-contenido">

            {vista === "dia" &&
              renderDia()}

            {vista === "semana" &&
              renderSemana()}

            {vista === "mes" &&
              renderMes()}

            {vista === "anio" &&
              renderAnio()}

          </div>
        )}

      </div>
    </section>
  );
}

export default Tareas;