import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import StatCard from "../components/ui/StatCard";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [paginaActual, setPaginaActual] = useState(1);
  const TAREAS_POR_PAGINA = 5;

  const [estadisticas, setEstadisticas] = useState({
    solicitudes: 0,
    pendientes: 0,
    urgentes: 0,
    atrasadas: 0,
    planificadas: 0,
    anticipacionCorta: 0,
    urgentesTiempo: 0,
    ultimaHora: 0,
  });

  const [tareasRecientes, setTareasRecientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargarDashboard = async () => {
      setCargando(true);
      setError("");

      try {
        const { data: tareas, error: tareasError } = await supabase
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
            tiempo_estimado,
            created_at,
            responsable_id,
            departamento_id,
            usuarios:responsable_id (
              nombre,
              apellido
            ),
            departamentos:departamento_id (
              nombre
            )
          `)
          .order("created_at", { ascending: false });

        if (tareasError) {
          console.error("Error cargando dashboard:", tareasError);
          throw new Error(
            "No se pudieron cargar los datos del dashboard."
          );
        }

        const listaTareas = tareas || [];
        const ahora = new Date();

        const pendientes = listaTareas.filter(
          (tarea) => tarea.estado === "pendiente"
        ).length;

        const urgentes = listaTareas.filter(
          (tarea) => tarea.prioridad === "alta"
        ).length;

        const atrasadas = listaTareas.filter((tarea) => {
          if (
            tarea.estado === "completada" ||
            !tarea.fecha_fin
          ) {
            return false;
          }

          const fechaFin = new Date(
            `${tarea.fecha_fin}T23:59:59`
          );

          return fechaFin < ahora;
        }).length;

        let planificadas = 0;
        let anticipacionCorta = 0;
        let urgentesTiempo = 0;
        let ultimaHora = 0;

        listaTareas.forEach((tarea) => {
          if (!tarea.created_at || !tarea.fecha_inicio) {
            return;
          }

          const creada = new Date(tarea.created_at);

          const inicio = new Date(
            `${tarea.fecha_inicio}T00:00:00`
          );

          const diferenciaHoras =
            (inicio - creada) / (1000 * 60 * 60);

          if (diferenciaHoras >= 72) {
            planificadas++;
          } else if (diferenciaHoras >= 24) {
            anticipacionCorta++;
          } else if (diferenciaHoras >= 1) {
            urgentesTiempo++;
          } else {
            ultimaHora++;
          }
        });

        setEstadisticas({
          solicitudes: listaTareas.length,
          pendientes,
          urgentes,
          atrasadas,
          planificadas,
          anticipacionCorta,
          urgentesTiempo,
          ultimaHora,
        });

        setTareasRecientes(listaTareas);
        setPaginaActual(1);
      } catch (err) {
        console.error(err);

        setError(
          err.message || "No se pudieron cargar los datos."
        );
      } finally {
        setCargando(false);
      }
    };

    cargarDashboard();
  }, []);

  // ----------------------------------------
  // PAGINACIÓN
  // ----------------------------------------

  const totalPaginas = Math.ceil(
    tareasRecientes.length / TAREAS_POR_PAGINA
  );

  const indiceInicial =
    (paginaActual - 1) * TAREAS_POR_PAGINA;

  const indiceFinal =
    indiceInicial + TAREAS_POR_PAGINA;

  const tareasPagina = tareasRecientes.slice(
    indiceInicial,
    indiceFinal
  );

  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual((pagina) => pagina - 1);
    }
  };

  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual((pagina) => pagina + 1);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <section className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            RESUMEN GENERAL
          </span>

          <h1>Dashboard</h1>

          <p>
            Consulta el estado de las solicitudes y la gestión de tu equipo.
          </p>
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <div className="stats-grid">
        <StatCard
          title="Solicitudes"
          value={
            cargando
              ? "..."
              : estadisticas.solicitudes
          }
          description="Solicitudes registradas"
          type="default"
        />

        <StatCard
          title="Pendientes"
          value={
            cargando
              ? "..."
              : estadisticas.pendientes
          }
          description="Requieren atención"
          type="warning"
        />

        <StatCard
          title="Urgentes"
          value={
            cargando
              ? "..."
              : estadisticas.urgentes
          }
          description="Solicitudes de prioridad alta"
          type="danger"
        />

        <StatCard
          title="Atrasadas"
          value={
            cargando
              ? "..."
              : estadisticas.atrasadas
          }
          description="Fuera del tiempo establecido"
          type="danger"
        />
      </div>

      <div className="dashboard-grid">

        {/* SOLICITUDES RECIENTES */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Solicitudes recientes</h2>

              <p>
                Últimos requerimientos registrados.
              </p>
            </div>
          </div>

          {cargando ? (
            <div className="empty-state">
              <span>⏳</span>

              <h3>
                Cargando solicitudes...
              </h3>

              <p>
                Estamos obteniendo la información del sistema.
              </p>
            </div>
          ) : tareasRecientes.length === 0 ? (
            <div className="empty-state">
              <span>📋</span>

              <h3>
                Sin datos todavía
              </h3>

              <p>
                Cuando comencemos a registrar solicitudes aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              <div className="recent-tasks">
                {tareasPagina.map((tarea) => {
                  const nombreResponsable =
                    tarea.usuarios
                      ? `${tarea.usuarios.nombre || ""} ${
                          tarea.usuarios.apellido || ""
                        }`.trim()
                      : "Sin responsable";

                  return (
                    <button
                      type="button"
                      className="recent-task"
                      key={tarea.id}
                      onClick={() =>
                        navigate(
                          `/tareas/${tarea.id}/editar`
                        )
                      }
                    >
                      <div className="recent-task-info">
                        <strong>
                          {tarea.titulo}
                        </strong>

                        <span>
                          {nombreResponsable}
                        </span>
                      </div>

                      <div className="recent-task-meta">
                        <span
                          className={`priority-badge priority-${tarea.prioridad}`}
                        >
                          {tarea.prioridad || "media"}
                        </span>

                        <span
                          className={`status-badge status-${tarea.estado}`}
                        >
                          {tarea.estado === "en_progreso"
                            ? "En progreso"
                            : tarea.estado === "completada"
                              ? "Completada"
                              : "Pendiente"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* PAGINACIÓN */}
              {totalPaginas > 1 && (
                <div className="recent-tasks-pagination">
                  <button
                    type="button"
                    onClick={paginaAnterior}
                    disabled={paginaActual === 1}
                  >
                    ← Anterior
                  </button>

                  <span>
                    Página {paginaActual} de {totalPaginas}
                  </span>

                  <button
                    type="button"
                    onClick={paginaSiguiente}
                    disabled={
                      paginaActual === totalPaginas
                    }
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* SOLICITUDES POR TIEMPO */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Solicitudes por tiempo</h2>

              <p>
                Clasificación según la anticipación con la que fueron creadas.
              </p>
            </div>
          </div>

          <div className="time-summary">

            <div className="time-item">
              <span className="dot planned"></span>

              <span>
                Planificadas
              </span>

              <strong>
                {cargando
                  ? "..."
                  : estadisticas.planificadas}
              </strong>
            </div>

            <div className="time-item">
              <span className="dot short"></span>

              <span>
                Anticipación corta
              </span>

              <strong>
                {cargando
                  ? "..."
                  : estadisticas.anticipacionCorta}
              </strong>
            </div>

            <div className="time-item">
              <span className="dot urgent"></span>

              <span>
                Urgentes
              </span>

              <strong>
                {cargando
                  ? "..."
                  : estadisticas.urgentesTiempo}
              </strong>
            </div>

            <div className="time-item">
              <span className="dot last-minute"></span>

              <span>
                Última hora
              </span>

              <strong>
                {cargando
                  ? "..."
                  : estadisticas.ultimaHora}
              </strong>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

export default Dashboard;

