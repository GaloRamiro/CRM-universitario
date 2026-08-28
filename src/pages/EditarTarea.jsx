import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./EditarTarea.css";

function EditarTarea() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    hora_inicio: "",
    hora_fin: "",
    prioridad: "media",
    estado: "pendiente",
    responsable_id: "",
    departamento_id: "",
  });

  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // CONTROL DE PAUSA
  // ==========================================

  const [mostrarPausa, setMostrarPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [pausando, setPausando] = useState(false);

  // ==========================================
  // CARGAR DATOS
  // ==========================================

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    setCargando(true);
    setError("");
    setMensaje("");

    try {
      const [
        { data: tareaData, error: tareaError },
        { data: usuariosData, error: usuariosError },
        { data: departamentosData, error: departamentosError },
      ] = await Promise.all([
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
            prioridad,
            estado,
            responsable_id,
            departamento_id
          `,
          )
          .eq("id", id)
          .single(),

        supabase
          .from("usuarios")
          .select("id, nombre, apellido, email")
          .eq("activo", true)
          .order("nombre"),

        supabase.from("departamentos").select("id, nombre").order("nombre"),
      ]);

      if (tareaError) {
        console.error("Error cargando tarea:", tareaError);
        throw new Error("No se pudo cargar la tarea.");
      }

      if (usuariosError) {
        console.error("Error cargando usuarios:", usuariosError);
      }

      if (departamentosError) {
        console.error("Error cargando departamentos:", departamentosError);
      }

      setFormulario({
        titulo: tareaData.titulo || "",
        descripcion: tareaData.descripcion || "",
        fecha_inicio: tareaData.fecha_inicio || "",
        fecha_fin: tareaData.fecha_fin || "",
        hora_inicio: tareaData.hora_inicio || "",
        hora_fin: tareaData.hora_fin || "",
        prioridad: tareaData.prioridad || "media",
        estado: tareaData.estado || "pendiente",
        responsable_id: tareaData.responsable_id || "",
        departamento_id: tareaData.departamento_id || "",
      });

      setUsuarios(usuariosData || []);
      setDepartamentos(departamentosData || []);
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo cargar la información de la tarea.");
    } finally {
      setCargando(false);
    }
  };

  // ==========================================
  // CAMBIAR CAMPOS
  // ==========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));
  };

  // ==========================================
  // OBTENER FECHA Y HORA ACTUAL
  // ==========================================

  const obtenerFechaActual = () => {
    const fecha = new Date();

    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
  };

  const obtenerHoraActual = () => {
    const fecha = new Date();

    const horas = String(fecha.getHours()).padStart(2, "0");

    const minutos = String(fecha.getMinutes()).padStart(2, "0");

    return `${horas}:${minutos}`;
  };

  // ==========================================
  // INICIAR TAREA
  // ==========================================

  const iniciarTarea = async () => {
    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const fechaActual = obtenerFechaActual();
      const horaActual = obtenerHoraActual();

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "en_proceso",
          fecha_inicio: fechaActual,
          fecha: fechaActual,
          hora_inicio: horaActual,
          hora_fin: null,
          fecha_fin: null,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error iniciando tarea:", updateError);

        throw new Error(updateError.message || "No se pudo iniciar la tarea.");
      }

      setFormulario((actual) => ({
        ...actual,
        estado: "en_proceso",
        fecha_inicio: fechaActual,
        fecha_fin: "",
        hora_inicio: horaActual,
        hora_fin: "",
      }));

      setMensaje(`Tarea iniciada a las ${horaActual}.`);
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo iniciar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // ==========================================
  // ABRIR PAUSA
  // ==========================================

  const abrirPausa = () => {
    setMotivoPausa("");
    setError("");
    setMensaje("");
    setMostrarPausa(true);
  };

  // ==========================================
  // CONFIRMAR PAUSA
  // ==========================================

  const confirmarPausa = async () => {
    if (!motivoPausa) {
      setError("Selecciona el motivo de la pausa.");
      return;
    }

    setPausando(true);
    setError("");
    setMensaje("");

    try {
      const horaPausa = obtenerHoraActual();

      /*
       * Por ahora utilizamos los campos existentes
       * de la tabla tareas.
       *
       * No agregamos columnas nuevas todavía.
       */

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "pendiente",
          hora_fin: null,
          fecha_fin: null,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error pausando tarea:", updateError);

        throw new Error(updateError.message || "No se pudo pausar la tarea.");
      }

      // Guardamos temporalmente la información
      // para poder continuar el flujo mientras
      // construimos el historial definitivo.
      localStorage.setItem(
        `tarea_pausa_${id}`,
        JSON.stringify({
          tarea_id: id,
          motivo: motivoPausa,
          hora: horaPausa,
          fecha: obtenerFechaActual(),
        }),
      );

      setFormulario((actual) => ({
        ...actual,
        estado: "pendiente",
        hora_fin: "",
        fecha_fin: "",
      }));

      setMostrarPausa(false);

      // ==========================================
      // SI ES OTRA TAREA O TAREA URGENTE
      // ==========================================

      if (motivoPausa === "otra_tarea" || motivoPausa === "tarea_urgente") {
        navigate("/tareas/nueva");
        return;
      }

      setMensaje(`Tarea pausada a las ${horaPausa}.`);
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo pausar la tarea.");
    } finally {
      setPausando(false);
    }
  };

  // ==========================================
  // REANUDAR TAREA
  // ==========================================

  const reanudarTarea = async () => {
    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const fechaActual = obtenerFechaActual();
      const horaActual = obtenerHoraActual();

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "en_proceso",
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error reanudando tarea:", updateError);

        throw new Error(updateError.message || "No se pudo reanudar la tarea.");
      }

      setFormulario((actual) => ({
        ...actual,
        estado: "en_proceso",
      }));

      /*
       * Guardamos temporalmente la reanudación.
       * Posteriormente esto pasará al historial
       * de actividad en Supabase.
       */
      localStorage.setItem(
        `tarea_reanudacion_${id}`,
        JSON.stringify({
          tarea_id: id,
          fecha: fechaActual,
          hora: horaActual,
        }),
      );

      setMensaje(`Tarea reanudada a las ${horaActual}.`);
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo reanudar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // ==========================================
  // TERMINAR TAREA
  // ==========================================

  const terminarTarea = async () => {
    const confirmar = window.confirm(
      "¿Confirmas que esta tarea ya está terminada?",
    );

    if (!confirmar) {
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const fechaActual = obtenerFechaActual();
      const horaActual = obtenerHoraActual();

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          estado: "completada",
          fecha_fin: fechaActual,
          hora_fin: horaActual,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error terminando tarea:", updateError);

        throw new Error(updateError.message || "No se pudo terminar la tarea.");
      }

      // Limpiar datos temporales
      localStorage.removeItem(`tarea_pausa_${id}`);

      localStorage.removeItem(`tarea_reanudacion_${id}`);

      setFormulario((actual) => ({
        ...actual,
        estado: "completada",
        fecha_fin: fechaActual,
        hora_fin: horaActual,
      }));

      setMensaje(`Tarea terminada a las ${horaActual}.`);

      setTimeout(() => {
        navigate("/tareas");
      }, 1200);
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo terminar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // ==========================================
  // GUARDAR CAMBIOS
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      if (!formulario.titulo.trim()) {
        throw new Error("El título de la tarea es obligatorio.");
      }

      if (!formulario.fecha_inicio) {
        throw new Error("La fecha de inicio es obligatoria.");
      }

      const { error: updateError } = await supabase
        .from("tareas")
        .update({
          titulo: formulario.titulo.trim(),
          descripcion: formulario.descripcion.trim() || null,
          fecha_inicio: formulario.fecha_inicio,
          fecha_fin: formulario.fecha_fin || null,
          fecha: formulario.fecha_inicio,
          hora_inicio: formulario.hora_inicio || null,
          hora_fin: formulario.hora_fin || null,
          prioridad: formulario.prioridad,
          estado: formulario.estado,
          responsable_id: formulario.responsable_id || null,
          departamento_id: formulario.departamento_id || null,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error actualizando tarea:", updateError);

        throw new Error(
          updateError.message || "No se pudo actualizar la tarea.",
        );
      }

      setMensaje("Tarea actualizada correctamente.");
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo actualizar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  // ==========================================
  // ELIMINAR TAREA
  // ==========================================

  const eliminarTarea = async () => {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.",
    );

    if (!confirmar) {
      return;
    }

    setEliminando(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("tareas")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error eliminando tarea:", deleteError);

        throw new Error(deleteError.message || "No se pudo eliminar la tarea.");
      }

      localStorage.removeItem(`tarea_pausa_${id}`);

      localStorage.removeItem(`tarea_reanudacion_${id}`);

      navigate("/tareas");
    } catch (err) {
      console.error(err);

      setError(err.message || "No se pudo eliminar la tarea.");
    } finally {
      setEliminando(false);
    }
  };

  // ==========================================
  // ESTADO DE LA TAREA
  // ==========================================

  const estaEnProceso = formulario.estado === "en_proceso";

  const estaCompletada = formulario.estado === "completada";

  const estaPausada =
    formulario.estado === "pendiente" &&
    Boolean(localStorage.getItem(`tarea_pausa_${id}`));

  // ==========================================
  // CARGANDO
  // ==========================================

  if (cargando) {
    return (
      <section className="editar-tarea-page">
        <div className="editar-tarea-loading">
          <span className="loader"></span>

          <p>Cargando tarea...</p>
        </div>
      </section>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section className="editar-tarea-page">
      {/* ==========================================
          ENCABEZADO
      ========================================== */}

      <div className="editar-tarea-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>

          <h1>Editar tarea</h1>

          <p>Consulta, actualiza y controla el avance de esta actividad.</p>
        </div>

        <button
          type="button"
          className="editar-tarea-btn cancelar"
          onClick={() => navigate("/tareas")}
        >
          Volver a tareas
        </button>
      </div>

      {/* ==========================================
          ESTADO ACTUAL
      ========================================== */}

      <div className="editar-tarea-estado">
        <div>
          <span>ESTADO ACTUAL</span>

          <strong className={`estado-${formulario.estado}`}>
            {estaCompletada
              ? "Completada"
              : estaEnProceso
                ? "En proceso"
                : estaPausada
                  ? "Pausada"
                  : "Pendiente"}
          </strong>
        </div>

        <div className="editar-tarea-controles">
          {!estaCompletada && !estaEnProceso && !estaPausada && (
            <button
              type="button"
              className="editar-tarea-btn iniciar"
              onClick={iniciarTarea}
              disabled={guardando}
            >
              ▶ Iniciar tarea
            </button>
          )}

          {estaEnProceso && (
            <button
              type="button"
              className="editar-tarea-btn pausar"
              onClick={abrirPausa}
              disabled={guardando}
            >
              ⏸ Pausar tarea
            </button>
          )}

          {estaPausada && (
            <button
              type="button"
              className="editar-tarea-btn reanudar"
              onClick={reanudarTarea}
              disabled={guardando}
            >
              ▶ Reanudar tarea
            </button>
          )}

          {estaEnProceso && (
            <button
              type="button"
              className="editar-tarea-btn terminar"
              onClick={terminarTarea}
              disabled={guardando}
            >
              ✓ Terminar tarea
            </button>
          )}
        </div>
      </div>

      {/* ==========================================
          MENSAJES
      ========================================== */}

      {mensaje && <div className="editar-tarea-mensaje">{mensaje}</div>}

      {error && <div className="editar-tarea-error">{error}</div>}

      {/* ==========================================
          FORMULARIO
      ========================================== */}

      <form className="editar-tarea-card" onSubmit={handleSubmit}>
        {/* ==========================================
            INFORMACIÓN
        ========================================== */}

        <div className="editar-tarea-section">
          <h2>Información de la tarea</h2>

          <p>Modifica los datos principales de la actividad.</p>

          <div className="editar-tarea-grid">
            <div className="form-group form-group-full">
              <label htmlFor="titulo">Título de la tarea</label>

              <input
                id="titulo"
                name="titulo"
                type="text"
                value={formulario.titulo}
                onChange={handleChange}
                disabled={estaCompletada}
              />
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="descripcion">Descripción</label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={formulario.descripcion}
                onChange={handleChange}
                rows="5"
                disabled={estaCompletada}
              />
            </div>
          </div>
        </div>

        {/* ==========================================
            FECHA
        ========================================== */}

        <div className="editar-tarea-section">
          <h2>Registro de actividad</h2>

          <p>Las fechas y horas muestran el registro de la actividad.</p>

          <div className="editar-tarea-grid">
            <div className="form-group">
              <label>Fecha de inicio</label>

              <input
                type="date"
                value={formulario.fecha_inicio}
                disabled
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Hora de inicio</label>

              <input
                type="time"
                value={formulario.hora_inicio}
                disabled
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Fecha de finalización</label>

              <input
                type="date"
                value={formulario.fecha_fin}
                disabled
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Hora de finalización</label>

              <input
                type="time"
                value={formulario.hora_fin}
                disabled
                readOnly
              />
            </div>
          </div>
        </div>

        {/* ==========================================
            ASIGNACIÓN
        ========================================== */}

        <div className="editar-tarea-section">
          <h2>Asignación</h2>

          <p>Responsable, departamento y prioridad de la actividad.</p>

          <div className="editar-tarea-grid">
            <div className="form-group">
              <label htmlFor="prioridad">Prioridad</label>

              <select
                id="prioridad"
                name="prioridad"
                value={formulario.prioridad}
                onChange={handleChange}
                disabled={estaCompletada}
              >
                <option value="baja">Baja</option>

                <option value="media">Media</option>

                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estado</label>

              <input
                type="text"
                value={
                  estaCompletada
                    ? "Completada"
                    : estaEnProceso
                      ? "En proceso"
                      : estaPausada
                        ? "Pausada"
                        : "Pendiente"
                }
                disabled
                readOnly
              />
            </div>

            <div className="form-group">
              <label htmlFor="departamento_id">Departamento</label>

              <select
                id="departamento_id"
                name="departamento_id"
                value={formulario.departamento_id}
                onChange={handleChange}
                disabled={estaCompletada}
              >
                <option value="">Sin departamento</option>

                {departamentos.map((departamento) => (
                  <option key={departamento.id} value={departamento.id}>
                    {departamento.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="responsable_id">Responsable</label>

              <select
                id="responsable_id"
                name="responsable_id"
                value={formulario.responsable_id}
                onChange={handleChange}
                disabled={estaCompletada}
              >
                <option value="">Sin responsable</option>

                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre} {usuario.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ==========================================
            BOTONES
        ========================================== */}

        <div className="editar-tarea-actions">
          <button
            type="button"
            className="editar-tarea-btn eliminar"
            onClick={eliminarTarea}
            disabled={eliminando}
          >
            {eliminando ? "Eliminando..." : "Eliminar tarea"}
          </button>

          <div className="editar-tarea-actions-right">
            <button
              type="button"
              className="editar-tarea-btn cancelar"
              onClick={() => navigate("/tareas")}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="editar-tarea-btn guardar"
              disabled={guardando || estaCompletada}
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>

      {/* ==========================================
          MODAL PAUSA
      ========================================== */}

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
                onClick={() => setMostrarPausa(false)}
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
                  name="motivoPausa"
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
                  name="motivoPausa"
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
                  name="motivoPausa"
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
                  name="motivoPausa"
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
                onClick={() => setMostrarPausa(false)}
                disabled={pausando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="editar-tarea-btn pausar"
                onClick={confirmarPausa}
                disabled={pausando}
              >
                {pausando ? "Pausando..." : "Confirmar pausa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default EditarTarea;
