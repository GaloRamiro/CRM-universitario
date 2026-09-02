import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./NuevaTarea.css";

function NuevaTarea() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    prioridad: "media",
    estado: "pendiente",
    responsable_id: "",
    departamento_id: "",
  });

  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargandoDepartamentos, setCargandoDepartamentos] =
    useState(true);

  const [cargandoUsuarios, setCargandoUsuarios] =
    useState(true);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // CARGAR USUARIOS
  // ==========================================

  useEffect(() => {
    const cargarUsuarios = async () => {
      setCargandoUsuarios(true);

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, email")
        .eq("activo", true)
        .order("nombre");

      if (error) {
        console.error("Error cargando usuarios:", error);
        setError("No se pudieron cargar los usuarios.");
      } else {
        setUsuarios(data || []);
      }

      setCargandoUsuarios(false);
    };

    cargarUsuarios();
  }, []);

  // ==========================================
  // CARGAR DEPARTAMENTOS
  // ==========================================

  useEffect(() => {
    const cargarDepartamentos = async () => {
      setCargandoDepartamentos(true);

      const { data, error } = await supabase
        .from("departamentos")
        .select("id, nombre")
        .order("nombre");

      if (error) {
        console.error(
          "Error cargando departamentos:",
          error
        );

        setError(
          "No se pudieron cargar los departamentos."
        );
      } else {
        setDepartamentos(data || []);
      }

      setCargandoDepartamentos(false);
    };

    cargarDepartamentos();
  }, []);

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
  // GUARDAR TAREA
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMensaje("");
    setError("");
    setGuardando(true);

    try {
      // ==========================================
      // VALIDACIONES
      // ==========================================

      if (!formulario.titulo.trim()) {
        throw new Error(
          "El título de la tarea es obligatorio."
        );
      }

      if (!formulario.fecha_inicio) {
        throw new Error(
          "La fecha programada es obligatoria."
        );
      }

      // ==========================================
      // CREAR TAREA
      // ==========================================

      const { data, error: insertError } =
        await supabase
          .from("tareas")
          .insert({
            titulo: formulario.titulo.trim(),

            descripcion:
              formulario.descripcion.trim() || null,

            // Fecha en la que está programada la actividad
            fecha_inicio:
              formulario.fecha_inicio,

            // No se define una fecha de finalización.
            // El sistema la registrará cuando termine.
            fecha_fin: null,

            // Se mantiene este campo porque ya existe
            // en la estructura actual de la tabla.
            fecha:
              formulario.fecha_inicio,

            // Ya NO usamos hora_inicio como hora real.
            // La hora real será registrada posteriormente
            // cuando el responsable pulse "Iniciar".
            hora_inicio: null,

            // La hora real de finalización será registrada
            // posteriormente al terminar la tarea.
            hora_fin: null,

            prioridad:
              formulario.prioridad,

            estado:
              formulario.estado,

            responsable_id:
              formulario.responsable_id || null,

            departamento_id:
              formulario.departamento_id || null,

            // ==========================================
            // CONTROL DE EJECUCIÓN
            // ==========================================

            inicio_real: null,

            fin_real: null,

            tiempo_trabajado_min: 0,

            estado_ejecucion: "sin_iniciar",
          })
          .select()
          .single();

      if (insertError) {
        console.error(
          "Error creando tarea:",
          insertError
        );

        throw new Error(
          insertError.message ||
            "No se pudo crear la tarea."
        );
      }

      console.log("Tarea creada:", data);

      // ==========================================
      // COMPLETAR INTERRUPCIÓN PENDIENTE
      // ==========================================
      // Cuando el usuario pausó una tarea para crear otra,
      // aquí ya conocemos el departamento de la nueva tarea.
      // Ese es el departamento que debe aparecer en Reportes
      // como causante de la interrupción.
      try {
        const { data: authData } = await supabase.auth.getUser();
        const usuarioAuthId = authData?.user?.id;

        if (usuarioAuthId) {
          const { data: usuarioActual } = await supabase
            .from("usuarios")
            .select("id")
            .eq("auth_user_id", usuarioAuthId)
            .single();

          if (usuarioActual?.id) {
            const clavePendiente = `interrupcion_pendiente_${usuarioActual.id}`;
            const pendienteGuardado = localStorage.getItem(clavePendiente);

            if (pendienteGuardado) {
              const pendiente = JSON.parse(pendienteGuardado);

              const { error: interrupcionError } = await supabase
                .from("historial_interrupciones")
                .insert({
                  tarea_id: pendiente.tarea_id,
                  empleado_id: usuarioActual.id,
                  departamento_id: formulario.departamento_id || null,
                  motivo: pendiente.motivo || "otra_tarea",
                  fecha: pendiente.fecha,
                  hora: pendiente.hora,
                });

              if (interrupcionError) {
                console.error(
                  "Error registrando interrupción pendiente:",
                  interrupcionError
                );
              } else {
                localStorage.removeItem(clavePendiente);
              }
            }
          }
        }
      } catch (interrupcionError) {
        console.error(
          "No se pudo completar la interrupción pendiente:",
          interrupcionError
        );
      }

      // ==========================================
      // CREAR NOTIFICACIÓN
      // ==========================================

      if (formulario.responsable_id) {
        const {
          error: notificacionError,
        } = await supabase
          .from("notificaciones")
          .insert({
            usuario_id:
              formulario.responsable_id,

            tarea_id:
              data.id,

            tipo:
              "nueva_tarea",

            titulo:
              "Nueva tarea asignada",

            mensaje:
              `Se te ha asignado la tarea: "${formulario.titulo.trim()}".`,

            leida:
              false,
          });

        if (notificacionError) {
          console.error(
            "Error creando notificación:",
            notificacionError
          );
        } else {
          console.log(
            "Notificación creada correctamente."
          );
        }
      }

      // ==========================================
      // MENSAJE
      // ==========================================

      setMensaje(
        "Tarea creada correctamente."
      );

      // ==========================================
      // LIMPIAR FORMULARIO
      // ==========================================

      setFormulario({
        titulo: "",
        descripcion: "",
        fecha_inicio: "",
        prioridad: "media",
        estado: "pendiente",
        responsable_id: "",
        departamento_id: "",
      });

      // ==========================================
      // VOLVER A TAREAS
      // ==========================================

      setTimeout(() => {
        navigate("/tareas");
      }, 1000);

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo crear la tarea."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="nueva-tarea-page">

      {/* ==========================================
          ENCABEZADO
      ========================================== */}

      <div className="nueva-tarea-header">

        <div>
          <span className="eyebrow">
            GESTIÓN
          </span>

          <h1>
            Nueva tarea
          </h1>

          <p>
            Registra una nueva actividad para el equipo.
          </p>
        </div>

        <button
          type="button"
          className="nueva-tarea-btn nueva-tarea-btn-cancelar"
          onClick={() => navigate("/tareas")}
        >
          Cancelar
        </button>

      </div>

      {/* ==========================================
          FORMULARIO
      ========================================== */}

      <form
        className="nueva-tarea-card"
        onSubmit={handleSubmit}
      >

        {/* ==========================================
            INFORMACIÓN
        ========================================== */}

        <div className="nueva-tarea-section">

          <h2>
            Información de la tarea
          </h2>

          <p>
            Define el título y los detalles principales de la actividad.
          </p>

          <div className="nueva-tarea-grid">

            {/* TÍTULO */}

            <div className="nueva-tarea-group">

              <label htmlFor="titulo">
                Título de la tarea
              </label>

              <input
                id="titulo"
                name="titulo"
                type="text"
                value={formulario.titulo}
                onChange={handleChange}
                placeholder="Ej. Actualizar página web"
                required
              />

            </div>

            {/* DESCRIPCIÓN */}

            <div className="nueva-tarea-group">

              <label htmlFor="descripcion">
                Descripción
              </label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={formulario.descripcion}
                onChange={handleChange}
                placeholder="Describe qué se debe realizar..."
                rows="5"
              />

            </div>

          </div>

        </div>

        {/* ==========================================
            FECHA
        ========================================== */}

        <div className="nueva-tarea-section">

          <h2>
            Fecha
          </h2>

          <p>
            Define el día en el que está programada la actividad.
          </p>

          <div className="nueva-tarea-grid">

            <div className="nueva-tarea-group">

              <label htmlFor="fecha_inicio">
                Fecha programada
              </label>

              <input
                id="fecha_inicio"
                name="fecha_inicio"
                type="date"
                value={formulario.fecha_inicio}
                onChange={handleChange}
                required
              />

              <small className="nueva-tarea-help">
                La hora real de inicio la registrará el sistema cuando el responsable inicie la tarea.
              </small>

            </div>

          </div>

        </div>

        {/* ==========================================
            ASIGNACIÓN
        ========================================== */}

        <div className="nueva-tarea-section">

          <h2>
            Asignación
          </h2>

          <p>
            Define prioridad, estado, departamento y responsable.
          </p>

          <div className="nueva-tarea-grid">

            {/* PRIORIDAD */}

            <div className="nueva-tarea-group">

              <label htmlFor="prioridad">
                Prioridad
              </label>

              <select
                id="prioridad"
                name="prioridad"
                value={formulario.prioridad}
                onChange={handleChange}
              >
                <option value="baja">
                  Baja
                </option>

                <option value="media">
                  Media
                </option>

                <option value="alta">
                  Alta
                </option>
              </select>

            </div>

            {/* ESTADO */}

            <div className="nueva-tarea-group">

              <label htmlFor="estado">
                Estado
              </label>

              <select
                id="estado"
                name="estado"
                value={formulario.estado}
                onChange={handleChange}
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

            {/* DEPARTAMENTO */}

            <div className="nueva-tarea-group">

              <label htmlFor="departamento_id">
                Departamento
              </label>

              <select
                id="departamento_id"
                name="departamento_id"
                value={formulario.departamento_id}
                onChange={handleChange}
                disabled={cargandoDepartamentos}
              >

                <option value="">
                  Sin departamento
                </option>

                {departamentos.map(
                  (departamento) => (
                    <option
                      key={departamento.id}
                      value={departamento.id}
                    >
                      {departamento.nombre}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* RESPONSABLE */}

            <div className="nueva-tarea-group">

              <label htmlFor="responsable_id">
                Responsable
              </label>

              <select
                id="responsable_id"
                name="responsable_id"
                value={formulario.responsable_id}
                onChange={handleChange}
                disabled={cargandoUsuarios}
              >

                <option value="">
                  Sin responsable
                </option>

                {usuarios.map(
                  (usuario) => (
                    <option
                      key={usuario.id}
                      value={usuario.id}
                    >
                      {usuario.nombre}{" "}
                      {usuario.apellido}
                      {usuario.email
                        ? ` — ${usuario.email}`
                        : ""}
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </div>

        {/* ==========================================
            MENSAJES
        ========================================== */}

        {mensaje && (
          <div className="nueva-tarea-mensaje">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="nueva-tarea-error">
            {error}
          </div>
        )}

        {/* ==========================================
            BOTONES
        ========================================== */}

        <div className="nueva-tarea-actions">

          <button
            type="button"
            className="nueva-tarea-btn nueva-tarea-btn-cancelar"
            onClick={() => navigate("/tareas")}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="nueva-tarea-btn nueva-tarea-btn-guardar"
            disabled={guardando}
          >
            {guardando
              ? "Creando tarea..."
              : "Crear tarea"}
          </button>

        </div>

      </form>

    </section>
  );
}

export default NuevaTarea;