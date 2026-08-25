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
                fecha,
                fecha_inicio,
                fecha_fin,
                tiempo_estimado,
                estado,
                prioridad,
                responsable_id
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
    } catch (err) {
      console.error("Error cargando carga del equipo:", err);
      setError(err.message || "No se pudo cargar la información del equipo.");
    } finally {
      setCargando(false);
    }
  };

  /*
   * Tareas correspondientes al día seleccionado.
   *
   * Se utiliza fecha_inicio como referencia principal.
   */
  const tareasDelDia = useMemo(() => {
    return tareas.filter((tarea) => {
      const fecha = tarea.fecha_inicio || tarea.fecha;

      return fecha === fechaSeleccionada;
    });
  }, [tareas, fechaSeleccionada]);

  /*
   * Construimos la carga de cada usuario.
   */
  const cargaUsuarios = useMemo(() => {
    return usuarios.map((usuario) => {
      const tareasUsuario = tareasDelDia.filter(
        (tarea) => tarea.responsable_id === usuario.id,
      );

      const minutos = tareasUsuario.reduce((total, tarea) => {
        return total + Number(tarea.tiempo_estimado || 0);
      }, 0);

      const horas = minutos / 60;

      /*
       * Jornada de referencia:
       *
       * 0 - 5 horas  = normal
       * 5 - 7 horas  = alta
       * más de 7 h   = sobrecargado
       */
      let nivel = "normal";

      if (horas > 7) {
        nivel = "sobrecargado";
      } else if (horas > 5) {
        nivel = "alta";
      }

      return {
        ...usuario,
        tareas: tareasUsuario,
        cantidadTareas: tareasUsuario.length,
        minutos,
        horas,
        nivel,
      };
    });
  }, [usuarios, tareasDelDia]);

  const totalMinutos = useMemo(() => {
    return tareasDelDia.reduce((total, tarea) => {
      return total + Number(tarea.tiempo_estimado || 0);
    }, 0);
  }, [tareasDelDia]);

  const usuariosSobrecargados = cargaUsuarios.filter(
    (usuario) => usuario.nivel === "sobrecargado",
  );

  const usuariosCargaAlta = cargaUsuarios.filter(
    (usuario) => usuario.nivel === "alta",
  );

  const formatearHoras = (minutos) => {
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (minutosRestantes === 0) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "";

    const [anio, mes, dia] = fecha.split("-");

    const fechaLocal = new Date(Number(anio), Number(mes) - 1, Number(dia));

    return fechaLocal.toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (cargando) {
    return (
      <section className="carga-equipo-page">
        <div className="carga-equipo-card">
          <p>Cargando carga del equipo...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="carga-equipo-page">
      <div className="carga-equipo-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>

          <h1>Carga del equipo</h1>

          <p>
            Controla cuánto trabajo tiene asignado cada integrante del equipo.
          </p>
        </div>

        <button
          type="button"
          className="carga-equipo-recargar"
          onClick={cargarDatos}
        >
          ↻ Actualizar
        </button>
      </div>

      {error && <div className="carga-equipo-error">{error}</div>}

      <div className="carga-equipo-filtro">
        <div>
          <label htmlFor="fechaCarga">Consultar fecha</label>

          <input
            id="fechaCarga"
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
        </div>

        <div className="carga-equipo-fecha">
          {formatearFecha(fechaSeleccionada)}
        </div>
      </div>

      <div className="carga-equipo-resumen">
        <div className="carga-resumen-card">
          <span>Tareas del día</span>
          <strong>{tareasDelDia.length}</strong>
        </div>

        <div className="carga-resumen-card">
          <span>Trabajo estimado</span>
          <strong>{formatearHoras(totalMinutos)}</strong>
        </div>

        <div className="carga-resumen-card carga-alta">
          <span>Carga alta</span>
          <strong>{usuariosCargaAlta.length}</strong>
        </div>

        <div className="carga-resumen-card carga-roja">
          <span>Sobrecargados</span>
          <strong>{usuariosSobrecargados.length}</strong>
        </div>
      </div>

      {usuariosSobrecargados.length > 0 && (
        <div className="alerta-sobrecarga">
          <div className="alerta-icono">⚠</div>

          <div>
            <strong>Hay personas sobrecargadas</strong>

            <p>
              Revisa la distribución de tareas antes de asignar nuevas
              actividades.
            </p>
          </div>
        </div>
      )}

      <div className="carga-equipo-card">
        <div className="carga-equipo-card-header">
          <div>
            <h2>Distribución de trabajo</h2>

            <p>Carga estimada por responsable para el día seleccionado.</p>
          </div>
        </div>

        {cargaUsuarios.length === 0 ? (
          <div className="carga-equipo-vacio">No existen usuarios activos.</div>
        ) : (
          <div className="carga-tabla-wrapper">
            <table className="carga-tabla">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Tareas</th>
                  <th>Tiempo estimado</th>
                  <th>Carga</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {cargaUsuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>
                      <div className="responsable-info">
                        <strong>
                          {usuario.nombre} {usuario.apellido}
                        </strong>

                        {usuario.email && <small>{usuario.email}</small>}
                      </div>
                    </td>

                    <td>{usuario.cantidadTareas}</td>

                    <td>
                      <strong>{formatearHoras(usuario.minutos)}</strong>
                    </td>

                    <td>
                      <div className="barra-carga">
                        <div
                          className={`barra-carga-progreso nivel-${usuario.nivel}`}
                          style={{
                            width: `${Math.min(
                              (usuario.minutos / 480) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </td>

                    <td>
                      {usuario.nivel === "sobrecargado" && (
                        <span className="badge badge-rojo">
                          🔴 Sobrecargado
                        </span>
                      )}

                      {usuario.nivel === "alta" && (
                        <span className="badge badge-amarillo">
                          🟡 Carga alta
                        </span>
                      )}

                      {usuario.nivel === "normal" && (
                        <span className="badge badge-verde">🟢 Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="carga-equipo-card">
        <div className="carga-equipo-card-header">
          <div>
            <h2>Tareas asignadas</h2>

            <p>Actividades consideradas para calcular la carga.</p>
          </div>
        </div>

        {tareasDelDia.length === 0 ? (
          <div className="carga-equipo-vacio">
            No existen tareas para esta fecha.
          </div>
        ) : (
          <div className="lista-tareas-carga">
            {tareasDelDia.map((tarea) => {
              const usuario = usuarios.find(
                (item) => item.id === tarea.responsable_id,
              );

              return (
                <div className="tarea-carga-item" key={tarea.id}>
                  <div>
                    <strong>{tarea.titulo}</strong>

                    <span>
                      {usuario
                        ? `${usuario.nombre} ${usuario.apellido}`
                        : "Sin responsable"}
                    </span>
                  </div>

                  <div className="tarea-carga-tiempo">
                    {formatearHoras(Number(tarea.tiempo_estimado || 0))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default CargaEquipo;
