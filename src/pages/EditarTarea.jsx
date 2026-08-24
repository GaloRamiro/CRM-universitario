import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./EditarTarea.css";

function EditarTarea() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    horaInicio: "",
    horaFin: "",
    prioridad: "media",
    estado: "pendiente",
    responsableId: "",
  });

  useEffect(() => {
    cargarTarea();
  }, [id]);

  const cargarTarea = async () => {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
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
        responsable_id
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error cargando tarea:", error);
      setError("No se pudo cargar la tarea.");
      setCargando(false);
      return;
    }

    setFormulario({
      titulo: data.titulo || "",
      descripcion: data.descripcion || "",
      fechaInicio: data.fecha_inicio || data.fecha || "",
      fechaFin: data.fecha_fin || data.fecha_inicio || data.fecha || "",
      horaInicio: data.hora_inicio || "",
      horaFin: data.hora_fin || "",
      prioridad: data.prioridad || "media",
      estado: data.estado || "pendiente",
      responsableId: data.responsable_id || "",
    });

    setCargando(false);
  };

  const cambiarCampo = (campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const guardarCambios = async (e) => {
    e.preventDefault();

    setGuardando(true);
    setError("");
    setMensaje("");

    if (!formulario.titulo.trim()) {
      setError("El título de la tarea es obligatorio.");
      setGuardando(false);
      return;
    }

    if (!formulario.fechaInicio) {
      setError("La fecha de inicio es obligatoria.");
      setGuardando(false);
      return;
    }

    if (!formulario.fechaFin) {
      setError("La fecha de finalización es obligatoria.");
      setGuardando(false);
      return;
    }

    const datosActualizados = {
      titulo: formulario.titulo.trim(),
      descripcion: formulario.descripcion.trim(),
      fecha: formulario.fechaInicio,
      fecha_inicio: formulario.fechaInicio,
      fecha_fin: formulario.fechaFin,
      hora_inicio: formulario.horaInicio || null,
      hora_fin: formulario.horaFin || null,
      prioridad: formulario.prioridad,
      estado: formulario.estado,
      responsable_id: formulario.responsableId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tareas")
      .update(datosActualizados)
      .eq("id", id);

    if (error) {
      console.error("Error actualizando tarea:", error);
      setError(error.message || "No se pudo actualizar la tarea.");
      setGuardando(false);
      return;
    }

    setMensaje("Tarea actualizada correctamente.");

    setTimeout(() => {
      navigate("/tareas");
    }, 700);
  };

  if (cargando) {
    return (
      <section className="editar-tarea-page">
        <div className="editar-tarea-card estado-carga">
          <div className="spinner"></div>
          <p>Cargando tarea...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="editar-tarea-page">

      <div className="editar-tarea-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>

          <h1>Editar tarea</h1>

          <p>
            Modifica la información y asignación de esta actividad.
          </p>
        </div>

        <button
          type="button"
          className="btn-secundario"
          onClick={() => navigate("/tareas")}
        >
          ← Volver a tareas
        </button>
      </div>

      <form
        className="editar-tarea-card"
        onSubmit={guardarCambios}
      >

        <div className="formulario-seccion">
          <div className="seccion-titulo">
            <span>01</span>

            <div>
              <h2>Información de la tarea</h2>
              <p>Define el título y los detalles principales.</p>
            </div>
          </div>

          <div className="campo campo-completo">
            <label htmlFor="titulo">
              Título de la tarea
            </label>

            <input
              id="titulo"
              type="text"
              value={formulario.titulo}
              onChange={(e) =>
                cambiarCampo("titulo", e.target.value)
              }
              placeholder="Ej. Actualizar página institucional"
            />
          </div>

          <div className="campo campo-completo">
            <label htmlFor="descripcion">
              Descripción
            </label>

            <textarea
              id="descripcion"
              rows="5"
              value={formulario.descripcion}
              onChange={(e) =>
                cambiarCampo("descripcion", e.target.value)
              }
              placeholder="Describe la tarea..."
            />
          </div>
        </div>

        <div className="formulario-seccion">

          <div className="seccion-titulo">
            <span>02</span>

            <div>
              <h2>Fecha y horario</h2>
              <p>Define cuándo comienza y termina la tarea.</p>
            </div>
          </div>

          <div className="formulario-grid">

            <div className="campo">
              <label htmlFor="fechaInicio">
                Fecha de inicio
              </label>

              <input
                id="fechaInicio"
                type="date"
                value={formulario.fechaInicio}
                onChange={(e) =>
                  cambiarCampo(
                    "fechaInicio",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="campo">
              <label htmlFor="fechaFin">
                Fecha de finalización
              </label>

              <input
                id="fechaFin"
                type="date"
                value={formulario.fechaFin}
                onChange={(e) =>
                  cambiarCampo(
                    "fechaFin",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="campo">
              <label htmlFor="horaInicio">
                Hora de inicio
              </label>

              <input
                id="horaInicio"
                type="time"
                value={formulario.horaInicio}
                onChange={(e) =>
                  cambiarCampo(
                    "horaInicio",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="campo">
              <label htmlFor="horaFin">
                Hora de finalización
              </label>

              <input
                id="horaFin"
                type="time"
                value={formulario.horaFin}
                onChange={(e) =>
                  cambiarCampo(
                    "horaFin",
                    e.target.value
                  )
                }
              />
            </div>

          </div>
        </div>

        <div className="formulario-seccion">

          <div className="seccion-titulo">
            <span>03</span>

            <div>
              <h2>Asignación</h2>
              <p>Define prioridad y estado de la actividad.</p>
            </div>
          </div>

          <div className="formulario-grid">

            <div className="campo">
              <label htmlFor="prioridad">
                Prioridad
              </label>

              <select
                id="prioridad"
                value={formulario.prioridad}
                onChange={(e) =>
                  cambiarCampo(
                    "prioridad",
                    e.target.value
                  )
                }
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="estado">
                Estado
              </label>

              <select
                id="estado"
                value={formulario.estado}
                onChange={(e) =>
                  cambiarCampo(
                    "estado",
                    e.target.value
                  )
                }
              >
                <option value="pendiente">
                  Pendiente
                </option>

                <option value="en_proceso">
                  En proceso
                </option>

                <option value="completada">
                  Completada
                </option>
              </select>
            </div>

          </div>
        </div>

        {error && (
          <div className="mensaje-error">
            <strong>⚠</strong>
            <span>{error}</span>
          </div>
        )}

        {mensaje && (
          <div className="mensaje-exito">
            <strong>✓</strong>
            <span>{mensaje}</span>
          </div>
        )}

        <div className="acciones-formulario">

          <button
            type="button"
            className="btn-cancelar"
            onClick={() => navigate("/tareas")}
            disabled={guardando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-guardar"
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : "Guardar cambios"}
          </button>

        </div>

      </form>
    </section>
  );
}

export default EditarTarea;