import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./TareaOlvidada.css";

function TareaOlvidada() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    fecha: "",
    hora_inicio: "",
    hora_fin: "",
    prioridad: "media",
    responsable_id: "",
    departamento_id: "",
  });

  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargandoUsuarios, setCargandoUsuarios] =
    useState(true);

  const [cargandoDepartamentos, setCargandoDepartamentos] =
    useState(true);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // =========================================================
  // CARGAR USUARIOS
  // =========================================================

  useEffect(() => {
    const cargarUsuarios = async () => {
      setCargandoUsuarios(true);

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, apellido, email")
        .eq("activo", true)
        .order("nombre");

      if (error) {
        console.error(
          "Error cargando usuarios:",
          error
        );

        setError(
          "No se pudieron cargar los usuarios."
        );
      } else {
        setUsuarios(data || []);
      }

      setCargandoUsuarios(false);
    };

    cargarUsuarios();
  }, []);

  // =========================================================
  // CARGAR DEPARTAMENTOS
  // =========================================================

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

  // =========================================================
  // CAMBIAR CAMPOS
  // =========================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));
  };

  // =========================================================
  // CALCULAR MINUTOS
  // =========================================================

  const calcularMinutos = () => {
    if (
      !formulario.hora_inicio ||
      !formulario.hora_fin
    ) {
      return 0;
    }

    const [horaInicio, minutoInicio] =
      formulario.hora_inicio
        .split(":")
        .map(Number);

    const [horaFin, minutoFin] =
      formulario.hora_fin
        .split(":")
        .map(Number);

    const inicio =
      horaInicio * 60 + minutoInicio;

    const fin =
      horaFin * 60 + minutoFin;

    return fin - inicio;
  };

  const minutosTrabajados = calcularMinutos();

  // =========================================================
  // FORMATEAR DURACIÓN
  // =========================================================

  const formatearDuracion = (minutos) => {
    if (!minutos || minutos <= 0) {
      return "0 minutos";
    }

    const horas = Math.floor(minutos / 60);

    const minutosRestantes =
      minutos % 60;

    if (horas === 0) {
      return `${minutosRestantes} minutos`;
    }

    if (minutosRestantes === 0) {
      return `${horas} ${
        horas === 1 ? "hora" : "horas"
      }`;
    }

    return `${horas} ${
      horas === 1 ? "hora" : "horas"
    } y ${minutosRestantes} minutos`;
  };

  // =========================================================
  // GUARDAR TAREA OLVIDADA
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMensaje("");
    setError("");
    setGuardando(true);

    try {
      // =======================================================
      // VALIDACIONES
      // =======================================================

      if (!formulario.titulo.trim()) {
        throw new Error(
          "El título de la tarea es obligatorio."
        );
      }

      if (!formulario.fecha) {
        throw new Error(
          "La fecha de la tarea es obligatoria."
        );
      }

      if (!formulario.hora_inicio) {
        throw new Error(
          "La hora de inicio es obligatoria."
        );
      }

      if (!formulario.hora_fin) {
        throw new Error(
          "La hora de finalización es obligatoria."
        );
      }

      if (minutosTrabajados <= 0) {
        throw new Error(
          "La hora de finalización debe ser posterior a la hora de inicio."
        );
      }

      // =======================================================
      // FECHAS Y HORAS REALES
      // =======================================================

      const inicioReal =
        `${formulario.fecha}T${formulario.hora_inicio}:00`;

      const finReal =
        `${formulario.fecha}T${formulario.hora_fin}:00`;

      // =======================================================
      // CREAR TAREA
      // =======================================================

      const { data, error: insertError } =
        await supabase
          .from("tareas")
          .insert({
            // -------------------------------------------------
            // INFORMACIÓN
            // -------------------------------------------------

            titulo:
              formulario.titulo.trim(),

            descripcion:
              formulario.descripcion.trim() ||
              null,

            // -------------------------------------------------
            // FECHA
            // -------------------------------------------------

            // La fecha ingresada por el usuario
            // es la fecha real de la actividad.

            fecha:
              formulario.fecha,

            fecha_inicio:
              formulario.fecha,

            fecha_fin:
              formulario.fecha,

            // -------------------------------------------------
            // HORARIO
            // -------------------------------------------------

            hora_inicio:
              formulario.hora_inicio,

            hora_fin:
              formulario.hora_fin,

            // -------------------------------------------------
            // ASIGNACIÓN
            // -------------------------------------------------

            prioridad:
              formulario.prioridad,

            estado:
              "completada",

            responsable_id:
              formulario.responsable_id ||
              null,

            departamento_id:
              formulario.departamento_id ||
              null,

            // =================================================
            // CONTROL DE EJECUCIÓN
            // =================================================

            inicio_real:
              inicioReal,

            fin_real:
              finReal,

            tiempo_trabajado_min:
              minutosTrabajados,

            estado_ejecucion:
              "finalizada",
          })
          .select()
          .single();

      // =======================================================
      // ERROR DE INSERCIÓN
      // =======================================================

      if (insertError) {
        console.error(
          "Error creando tarea olvidada:",
          insertError
        );

        throw new Error(
          insertError.message ||
            "No se pudo registrar la tarea olvidada."
        );
      }

      console.log(
        "Tarea olvidada registrada:",
        data
      );

      // =======================================================
      // NOTIFICACIÓN
      // =======================================================

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
              "tarea_olvidada",

            titulo:
              "Tarea registrada anteriormente",

            mensaje:
              `Se registró una tarea realizada el ${formulario.fecha}: "${formulario.titulo.trim()}".`,

            leida:
              false,
          });

        if (notificacionError) {
          console.error(
            "Error creando notificación:",
            notificacionError
          );
        }
      }

      // =======================================================
      // MENSAJE
      // =======================================================

      setMensaje(
        `Tarea registrada correctamente. Tiempo contabilizado: ${formatearDuracion(
          minutosTrabajados
        )}.`
      );

      // =======================================================
      // LIMPIAR FORMULARIO
      // =======================================================

      setFormulario({
        titulo: "",
        descripcion: "",
        fecha: "",
        hora_inicio: "",
        hora_fin: "",
        prioridad: "media",
        responsable_id: "",
        departamento_id: "",
      });

      // =======================================================
      // VOLVER A TAREAS
      // =======================================================

      setTimeout(() => {
        navigate("/tareas");
      }, 1500);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "No se pudo registrar la tarea olvidada."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="tarea-olvidada-page">

      {/* =====================================================
          ENCABEZADO
      ===================================================== */}

      <div className="tarea-olvidada-header">
        <div>
          <span className="eyebrow">
            REGISTRO RETROACTIVO
          </span>

          <h1>
            Tarea olvidada
          </h1>

          <p>
            Registra una actividad realizada
            anteriormente que no fue cargada
            en su momento.
          </p>
        </div>

        <button
          type="button"
          className="tarea-olvidada-btn tarea-olvidada-btn-cancelar"
          onClick={() =>
            navigate("/tareas")
          }
        >
          Cancelar
        </button>
      </div>

      {/* =====================================================
          AVISO
      ===================================================== */}

      <div className="tarea-olvidada-aviso">

        <strong>
          Registro de horas anteriores
        </strong>

        <span>
          Utiliza esta opción si realizaste una
          actividad en una fecha anterior y no
          pudiste registrarla en ese momento.
          Las horas ingresadas se contabilizarán
          en la carga de trabajo y en los reportes.
        </span>

      </div>

      {/* =====================================================
          FORMULARIO
      ===================================================== */}

      <form
        className="tarea-olvidada-card"
        onSubmit={handleSubmit}
      >

        {/* ===================================================
            INFORMACIÓN
        =================================================== */}

        <div className="tarea-olvidada-section">

          <h2>
            Información de la tarea
          </h2>

          <p>
            Ingresa los datos de la actividad
            que olvidaste registrar.
          </p>

          <div className="tarea-olvidada-grid">

            <div className="tarea-olvidada-group">

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

            <div className="tarea-olvidada-group">

              <label htmlFor="descripcion">
                Descripción
              </label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={formulario.descripcion}
                onChange={handleChange}
                placeholder="Describe qué se realizó..."
                rows="5"
              />

            </div>

          </div>

        </div>

        {/* ===================================================
            FECHA Y HORAS
        =================================================== */}

        <div className="tarea-olvidada-section">

          <h2>
            Fecha y horas trabajadas
          </h2>

          <p>
            Indica la fecha real y el horario
            en el que realizaste la actividad.
          </p>

          <div className="tarea-olvidada-grid">

            <div className="tarea-olvidada-group">

              <label htmlFor="fecha">
                Fecha de la tarea
              </label>

              <input
                id="fecha"
                name="fecha"
                type="date"
                value={formulario.fecha}
                onChange={handleChange}
                required
              />

              <small>
                Puedes seleccionar una fecha
                anterior.
              </small>

            </div>

            <div className="tarea-olvidada-group">

              <label htmlFor="hora_inicio">
                Hora de inicio real
              </label>

              <input
                id="hora_inicio"
                name="hora_inicio"
                type="time"
                value={formulario.hora_inicio}
                onChange={handleChange}
                required
              />

            </div>

            <div className="tarea-olvidada-group">

              <label htmlFor="hora_fin">
                Hora de finalización real
              </label>

              <input
                id="hora_fin"
                name="hora_fin"
                type="time"
                value={formulario.hora_fin}
                onChange={handleChange}
                required
              />

            </div>

          </div>

          {/* =================================================
              RESUMEN DE TIEMPO
          ================================================= */}

          <div className="tarea-olvidada-tiempo">

            <span>
              Tiempo que se contabilizará
            </span>

            <strong>
              {formatearDuracion(
                minutosTrabajados
              )}
            </strong>

          </div>

        </div>

        {/* ===================================================
            ASIGNACIÓN
        =================================================== */}

        <div className="tarea-olvidada-section">

          <h2>
            Asignación
          </h2>

          <p>
            Define quién realizó la actividad
            y a qué departamento corresponde.
          </p>

          <div className="tarea-olvidada-grid">

            {/* PRIORIDAD */}

            <div className="tarea-olvidada-group">

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

            {/* DEPARTAMENTO */}

            <div className="tarea-olvidada-group">

              <label htmlFor="departamento_id">
                Departamento
              </label>

              <select
                id="departamento_id"
                name="departamento_id"
                value={formulario.departamento_id}
                onChange={handleChange}
                disabled={
                  cargandoDepartamentos
                }
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

            <div className="tarea-olvidada-group">

              <label htmlFor="responsable_id">
                Responsable
              </label>

              <select
                id="responsable_id"
                name="responsable_id"
                value={formulario.responsable_id}
                onChange={handleChange}
                disabled={
                  cargandoUsuarios
                }
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

        {/* ===================================================
            MENSAJES
        =================================================== */}

        {mensaje && (
          <div className="tarea-olvidada-mensaje">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="tarea-olvidada-error">
            {error}
          </div>
        )}

        {/* ===================================================
            BOTONES
        =================================================== */}

        <div className="tarea-olvidada-actions">

          <button
            type="button"
            className="tarea-olvidada-btn tarea-olvidada-btn-cancelar"
            onClick={() =>
              navigate("/tareas")
            }
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="tarea-olvidada-btn tarea-olvidada-btn-guardar"
            disabled={guardando}
          >
            {guardando
              ? "Registrando..."
              : "Registrar tarea olvidada"}
          </button>

        </div>

      </form>
    </section>
  );
}

export default TareaOlvidada;

