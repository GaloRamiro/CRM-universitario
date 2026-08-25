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
    fecha_fin: "",
    hora_inicio: "",
    hora_fin: "",
    tiempo_estimado: 60,
    prioridad: "media",
    estado: "pendiente",
    responsable_id: "",
    departamento_id: "",
  });

  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(true);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
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
        console.error("Error cargando departamentos:", error);
        setError("No se pudieron cargar los departamentos.");
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
        throw new Error("El título de la tarea es obligatorio.");
      }

      if (!formulario.fecha_inicio) {
        throw new Error("La fecha de inicio es obligatoria.");
      }

      if (!formulario.fecha_fin) {
        throw new Error("La fecha de finalización es obligatoria.");
      }

      if (formulario.fecha_fin < formulario.fecha_inicio) {
        throw new Error(
          "La fecha de finalización no puede ser anterior a la fecha de inicio."
        );
      }

      if (
        formulario.hora_inicio &&
        formulario.hora_fin &&
        formulario.fecha_inicio === formulario.fecha_fin &&
        formulario.hora_fin <= formulario.hora_inicio
      ) {
        throw new Error(
          "La hora de finalización debe ser posterior a la hora de inicio."
        );
      }

      if (
        !formulario.tiempo_estimado ||
        Number(formulario.tiempo_estimado) <= 0
      ) {
        throw new Error("El tiempo estimado debe ser mayor que 0 minutos.");
      }

      // ==========================================
      // CREAR TAREA
      // ==========================================

      const { data, error: insertError } = await supabase
        .from("tareas")
        .insert({
          titulo: formulario.titulo.trim(),

          descripcion: formulario.descripcion.trim() || null,

          fecha_inicio: formulario.fecha_inicio,

          fecha_fin: formulario.fecha_fin,

          // El calendario utiliza este campo
          fecha: formulario.fecha_inicio,

          hora_inicio: formulario.hora_inicio || null,

          hora_fin: formulario.hora_fin || null,

          // Tiempo estimado en minutos
          tiempo_estimado: Number(formulario.tiempo_estimado) || 0,

          prioridad: formulario.prioridad,

          estado: formulario.estado,

          // Responsable
          responsable_id: formulario.responsable_id || null,

          // Departamento
          departamento_id: formulario.departamento_id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creando tarea:", insertError);

        throw new Error(
          insertError.message || "No se pudo crear la tarea."
        );
      }

      console.log("Tarea creada:", data);

      setMensaje("Tarea creada correctamente.");

      // ==========================================
      // LIMPIAR FORMULARIO
      // ==========================================

      setFormulario({
        titulo: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        hora_inicio: "",
        hora_fin: "",
        tiempo_estimado: 60,
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
        err.message || "No se pudo crear la tarea."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="nueva-tarea-page">

      {/* ==============================
          ENCABEZADO
      ============================== */}

      <div className="nueva-tarea-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>

          <h1>Nueva tarea</h1>

          <p>
            Registra una nueva actividad para el equipo.
          </p>
        </div>

        <button
          type="button"
          className="nueva-tarea-cancelar"
          onClick={() => navigate("/tareas")}
        >
          Cancelar
        </button>
      </div>

      {/* ==============================
          FORMULARIO
      ============================== */}

      <form
        className="nueva-tarea-card"
        onSubmit={handleSubmit}
      >

        {/* ==============================
            INFORMACIÓN
        ============================== */}

        <div className="nueva-tarea-section">

          <h2>Información de la tarea</h2>

          <p>
            Define el título y los detalles principales de la actividad.
          </p>

          <div className="nueva-tarea-grid">

            {/* TÍTULO */}

            <div className="form-group form-group-full">

              <label htmlFor="titulo">
                Título de la tarea
              </label>

              <input
                id="titulo"
                name="titulo"
                type="text"
                value={formulario.titulo}
                onChange={handleChange}
                placeholder="Ej. Diseñar 30 artes para redes sociales"
                required
              />

            </div>

            {/* DESCRIPCIÓN */}

            <div className="form-group form-group-full">

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

        {/* ==============================
            FECHAS Y HORARIOS
        ============================== */}

        <div className="nueva-tarea-section">

          <h2>Fecha y horario</h2>

          <p>
            Define cuándo comienza y termina la tarea.
          </p>

          <div className="nueva-tarea-grid">

            {/* FECHA INICIO */}

            <div className="form-group">

              <label htmlFor="fecha_inicio">
                Fecha de inicio
              </label>

              <input
                id="fecha_inicio"
                name="fecha_inicio"
                type="date"
                value={formulario.fecha_inicio}
                onChange={handleChange}
                required
              />

            </div>

            {/* FECHA FIN */}

            <div className="form-group">

              <label htmlFor="fecha_fin">
                Fecha de finalización
              </label>

              <input
                id="fecha_fin"
                name="fecha_fin"
                type="date"
                value={formulario.fecha_fin}
                onChange={handleChange}
                required
              />

            </div>

            {/* TIEMPO ESTIMADO */}

            <div className="form-group">

              <label htmlFor="tiempo_estimado">
                Tiempo estimado
              </label>

              <div className="tiempo-estimado-input">

                <input
                  id="tiempo_estimado"
                  name="tiempo_estimado"
                  type="number"
                  min="5"
                  step="5"
                  value={formulario.tiempo_estimado}
                  onChange={handleChange}
                  placeholder="60"
                  required
                />

                <span>minutos</span>

              </div>

              <small>
                Ejemplo: 60 minutos = 1 hora de trabajo.
              </small>

            </div>

            {/* HORA INICIO */}

            <div className="form-group">

              <label htmlFor="hora_inicio">
                Hora de inicio
              </label>

              <input
                id="hora_inicio"
                name="hora_inicio"
                type="time"
                value={formulario.hora_inicio}
                onChange={handleChange}
              />

            </div>

            {/* HORA FIN */}

            <div className="form-group">

              <label htmlFor="hora_fin">
                Hora de finalización
              </label>

              <input
                id="hora_fin"
                name="hora_fin"
                type="time"
                value={formulario.hora_fin}
                onChange={handleChange}
              />

            </div>

          </div>
        </div>

        {/* ==============================
            ASIGNACIÓN
        ============================== */}

        <div className="nueva-tarea-section">

          <h2>Asignación</h2>

          <p>
            Define prioridad, estado, departamento y responsable.
          </p>

          <div className="nueva-tarea-grid">

            {/* PRIORIDAD */}

            <div className="form-group">

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

            <div className="form-group">

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

                <option value="en_progreso">
                  En progreso
                </option>

                <option value="completada">
                  Completada
                </option>

              </select>

            </div>

            {/* DEPARTAMENTO */}

            <div className="form-group">

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

                {departamentos.map((departamento) => (
                  <option
                    key={departamento.id}
                    value={departamento.id}
                  >
                    {departamento.nombre}
                  </option>
                ))}

              </select>

            </div>

            {/* RESPONSABLE */}

            <div className="form-group">

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

                {usuarios.map((usuario) => (
                  <option
                    key={usuario.id}
                    value={usuario.id}
                  >
                    {usuario.nombre} {usuario.apellido}
                    {usuario.email
                      ? ` — ${usuario.email}`
                      : ""}
                  </option>
                ))}

              </select>

            </div>

          </div>
        </div>

        {/* ==============================
            MENSAJES
        ============================== */}

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

        {/* ==============================
            BOTONES
        ============================== */}

        <div className="nueva-tarea-actions">

          <button
            type="button"
            className="nueva-tarea-cancelar"
            onClick={() => navigate("/tareas")}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="nueva-tarea-btn"
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