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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarTareas();
  }, []);

  const cargarTareas = async () => {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
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
        tiempo_estimado
      `,
      )
      .order("fecha_inicio", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      console.error("Error cargando tareas:", error);
      setError("No se pudieron cargar las tareas.");
      setTareas([]);
      setCargando(false);
      return;
    }

    const tareasFormateadas = (data || []).map((tarea) => ({
      id: tarea.id,
      titulo: tarea.titulo || "Sin título",
      descripcion: tarea.descripcion || "",
      fecha: tarea.fecha || tarea.fecha_inicio,
      fechaInicio: tarea.fecha_inicio,
      fechaFin: tarea.fecha_fin,
      horaInicio: tarea.hora_inicio || "00:00",
      horaFin: tarea.hora_fin || "00:00",
      responsable: tarea.responsable_id || "Sin responsable",
      estado: tarea.estado || "pendiente",
      prioridad: tarea.prioridad || "media",
      tiempoEstimado: tarea.tiempo_estimado || 60,
    }));

    setTareas(tareasFormateadas);
    setCargando(false);
  };

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

  const tareasFiltradas = tareas.filter((tarea) => {
    if (filtroEstado === "todas") {
      return true;
    }

    return tarea.estado === filtroEstado;
  });

  const tareasDeFecha = (fecha) => {
    const fechaTexto = formatearFecha(fecha);

    return tareasFiltradas.filter((tarea) => {
      return tarea.fecha === fechaTexto;
    });
  };

  const obtenerTituloFecha = () => {
    if (vista === "dia") {
      return `${nombresDias[fechaActual.getDay()]} ${fechaActual.getDate()} de ${nombresMeses[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
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
    } - ${fin.getDate()} ${nombresMeses[fin.getMonth()]} ${fin.getFullYear()}`;
  };

  const nombreEstado = (estado) => {
    const estados = {
      pendiente: "Pendiente",
      en_proceso: "En proceso",
      completada: "Completada",
    };

    return estados[estado] || estado;
  };

  const nombrePrioridad = (prioridad) => {
    const prioridades = {
      alta: "Alta",
      media: "Media",
      baja: "Baja",
    };

    return prioridades[prioridad] || prioridad;
  };

  const renderTarea = (tarea) => (
    <div
      key={tarea.id}
      className={`tarea-item prioridad-${tarea.prioridad}`}
      onClick={() => navigate(`/tareas/${tarea.id}/editar`)}
      role="button"
      tabIndex={0}
    >
      <div className="tarea-hora">
        {tarea.horaInicio}
        <span>{tarea.horaFin}</span>
      </div>

      <div className="tarea-contenido">
        <strong>{tarea.titulo}</strong>

        {tarea.descripcion && <p>{tarea.descripcion}</p>}

        <div className="tarea-meta">
          <span className={`tarea-estado estado-${tarea.estado}`}>
            {nombreEstado(tarea.estado)}
          </span>

          <span className={`tarea-prioridad prioridad-${tarea.prioridad}`}>
            {nombrePrioridad(tarea.prioridad)}
          </span>

          <span>
            {tarea.responsable === "Sin responsable"
              ? "Sin responsable"
              : tarea.responsable}
          </span>
        </div>
      </div>
    </div>
  );

  const renderDia = () => {
    const tareasHoy = tareasDeFecha(fechaActual);

    return (
      <div className="tareas-dia">
        <div className="tareas-dia-header">
          <div>
            <span className="eyebrow">AGENDA DIARIA</span>

            <h2>
              {nombresDias[fechaActual.getDay()]} {fechaActual.getDate()}
            </h2>
          </div>

          <span>
            {tareasHoy.length} tarea
            {tareasHoy.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="horario-dia">
          {Array.from({ length: 12 }, (_, index) => {
            const hora = index + 7;

            const tareasHora = tareasHoy.filter((tarea) => {
              const horaInicio = parseInt(tarea.horaInicio.split(":")[0], 10);

              return horaInicio === hora;
            });

            return (
              <div className="franja-horaria" key={hora}>
                <div className="hora">{String(hora).padStart(2, "0")}:00</div>

                <div className="franja-contenido">
                  {tareasHora.map(renderTarea)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSemana = () => (
    <div className="calendario-semana">
      {diasSemana.map((dia) => {
        const tareasDia = tareasDeFecha(dia);

        const esHoy = formatearFecha(dia) === formatearFecha(new Date());

        return (
          <div
            className={`dia-columna ${esHoy ? "dia-hoy" : ""}`}
            key={formatearFecha(dia)}
          >
            <div className="dia-header">
              <span>{nombresDias[dia.getDay()].slice(0, 3)}</span>

              <strong>{dia.getDate()}</strong>
            </div>

            <div className="dia-tareas">
              {tareasDia.length > 0 ? (
                tareasDia.map(renderTarea)
              ) : (
                <span className="sin-tareas">Sin tareas</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderMes = () => {
    const primerDia = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth(),
      1,
    );

    const ultimoDia = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth() + 1,
      0,
    );

    const espaciosIniciales = primerDia.getDay();

    const dias = [];

    for (let i = 0; i < espaciosIniciales; i++) {
      dias.push(null);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      dias.push(
        new Date(fechaActual.getFullYear(), fechaActual.getMonth(), dia),
      );
    }

    return (
      <div className="calendario-mes">
        {nombresDias.map((dia) => (
          <div className="mes-dia-nombre" key={dia}>
            {dia.slice(0, 3)}
          </div>
        ))}

        {dias.map((dia, index) => {
          if (!dia) {
            return <div className="mes-celda vacia" key={index} />;
          }

          const tareasDia = tareasDeFecha(dia);

          return (
            <div className="mes-celda" key={formatearFecha(dia)}>
              <strong>{dia.getDate()}</strong>

              <div className="mes-tareas">
                {tareasDia.slice(0, 3).map((tarea) => (
                  <div
                    key={tarea.id}
                    className={`mes-tarea prioridad-${tarea.prioridad}`}
                  >
                    {tarea.titulo}
                  </div>
                ))}

                {tareasDia.length > 3 && (
                  <span>+{tareasDia.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAnio = () => (
    <div className="calendario-anio">
      {nombresMeses.map((mes, index) => {
        const tareasMes = tareasFiltradas.filter((tarea) => {
          if (!tarea.fecha) return false;

          const fecha = new Date(`${tarea.fecha}T00:00:00`);

          return (
            fecha.getFullYear() === fechaActual.getFullYear() &&
            fecha.getMonth() === index
          );
        });

        return (
          <div className="anio-mes" key={mes}>
            <h3>{mes}</h3>

            <div className="anio-contador">
              <strong>{tareasMes.length}</strong>

              <span>{tareasMes.length === 1 ? "tarea" : "tareas"}</span>
            </div>

            {tareasMes.slice(0, 3).map((tarea) => (
              <div className="anio-tarea" key={tarea.id}>
                <strong>{tarea.titulo}</strong>
                <span>{tarea.fecha}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="tareas-page">
      <div className="tareas-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>

          <h1>Tareas</h1>

          <p>Organiza, consulta y controla las actividades del equipo.</p>
        </div>

        <button
          className="tareas-btn-principal"
          type="button"
          onClick={() => navigate("/tareas/nueva")}
        >
          + Nueva tarea
        </button>
      </div>

      <div className="tareas-card">
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
                className={vista === valor ? "vista-activa" : ""}
                onClick={() => setVista(valor)}
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="tareas-filtros">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todas">Todos los estados</option>

              <option value="pendiente">Pendientes</option>

              <option value="en_proceso">En proceso</option>

              <option value="completada">Completadas</option>
            </select>
          </div>
        </div>

        <div className="tareas-navegacion">
          <div className="tareas-navegacion-botones">
            <button type="button" onClick={() => cambiarFecha(-1)}>
              ‹
            </button>

            <button type="button" onClick={irHoy}>
              Hoy
            </button>

            <button type="button" onClick={() => cambiarFecha(1)}>
              ›
            </button>
          </div>

          <h2>{obtenerTituloFecha()}</h2>
        </div>

        {cargando && (
          <div className="tareas-contenido">
            <p>Cargando tareas...</p>
          </div>
        )}

        {error && (
          <div className="tareas-contenido">
            <p>{error}</p>
          </div>
        )}

        {!cargando && !error && (
          <div className="tareas-contenido">
            {vista === "dia" && renderDia()}
            {vista === "semana" && renderSemana()}
            {vista === "mes" && renderMes()}
            {vista === "anio" && renderAnio()}
          </div>
        )}
      </div>
    </section>
  );
}

export default Tareas;
