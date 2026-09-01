import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";

import "./EditarTarea.css";

function EditarTarea() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [tarea, setTarea] = useState(null);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [cargandoUsuarios, setCargandoUsuarios] =
    useState(true);
  const [cargandoDepartamentos, setCargandoDepartamentos] =
    useState(true);

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    prioridad: "",
    estado: "",
    responsable_id: "",
    departamento_id: "",
  });

  const [puedeModificar, setPuedeModificar] =
    useState(false);

  // =========================================================
  // CARGAR USUARIO ACTUAL
  // =========================================================

  useEffect(() => {
    cargarUsuarioActual();
  }, []);

  const cargarUsuarioActual = async () => {
    try {
      const {
        data: { user },
        error: errorAuth,
      } = await supabase.auth.getUser();

      if (errorAuth) {
        throw errorAuth;
      }

      if (!user) {
        setUsuarioActual(null);
        return;
      }

      const { data, error: errorUsuario } =
        await supabase
          .from("usuarios")
          .select("*")
          .eq("auth_user_id", user.id)
          .single();

      if (errorUsuario) {
        console.error(
          "Error obteniendo usuario actual:",
          errorUsuario
        );

        setUsuarioActual(null);
        return;
      }

      setUsuarioActual(data);
    } catch (err) {
      console.error(
        "Error cargando usuario actual:",
        err
      );

      setUsuarioActual(null);
    }
  };

  // =========================================================
  // CARGAR TAREA
  // =========================================================

  useEffect(() => {
    cargarTarea();
  }, [id]);

  const cargarTarea = async () => {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const { data, error: errorConsulta } =
        await supabase
          .from("tareas")
          .select("*")
          .eq("id", id)
          .single();

      if (errorConsulta) {
        throw errorConsulta;
      }

      if (!data) {
        throw new Error(
          "No se encontró la tarea."
        );
      }

      setTarea(data);

      setFormulario({
        titulo: data.titulo || "",
        descripcion: data.descripcion || "",
        fecha_inicio: data.fecha_inicio
          ? data.fecha_inicio.substring(0, 10)
          : "",
        prioridad: data.prioridad || "media",
        estado: data.estado || "pendiente",
        responsable_id:
          data.responsable_id || "",
        departamento_id:
          data.departamento_id || "",
      });
    } catch (err) {
      console.error(
        "Error cargando tarea:",
        err
      );

      setError(
        err.message ||
          "No fue posible cargar la tarea."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // COMPROBAR PERMISOS
  // =========================================================

  useEffect(() => {
    if (!tarea || !usuarioActual) {
      return;
    }

    const esPropietario =
      String(tarea.responsable_id || "") ===
      String(usuarioActual.id || "");

    const rol = String(
      usuarioActual.rol ||
        usuarioActual.role ||
        usuarioActual.perfil ||
        ""
    )
      .trim()
      .toLowerCase();

    const esAdministrador =
      rol === "admin" ||
      rol === "administrador";

    const esEditor = rol === "editor";

    /*
     * REGLA:
     *
     * - Si la tarea está completada:
     *   solamente ADMIN puede modificarla.
     *
     * - Si la tarea NO está completada:
     *   se mantiene la lógica anterior:
     *   propietario, editor o administrador.
     */

    if (tarea.estado === "completada") {
      setPuedeModificar(esAdministrador);
      return;
    }

    setPuedeModificar(
      esPropietario ||
        esEditor ||
        esAdministrador
    );
  }, [tarea, usuarioActual]);

  // =========================================================
  // CARGAR USUARIOS
  // =========================================================

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        setCargandoUsuarios(true);

        const { data, error } =
          await supabase
            .from("usuarios")
            .select(
              "id, nombre, apellido, email, rol"
            )
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
      } catch (err) {
        console.error(err);

        setError(
          "No se pudieron cargar los usuarios."
        );
      } finally {
        setCargandoUsuarios(false);
      }
    };

    cargarUsuarios();
  }, []);

  // =========================================================
  // CARGAR DEPARTAMENTOS
  // =========================================================

  useEffect(() => {
    const cargarDepartamentos = async () => {
      try {
        setCargandoDepartamentos(true);

        const { data, error } =
          await supabase
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
      } catch (err) {
        console.error(err);

        setError(
          "No se pudieron cargar los departamentos."
        );
      } finally {
        setCargandoDepartamentos(false);
      }
    };

    cargarDepartamentos();
  }, []);

  // =========================================================
  // CAMBIAR CAMPOS
  // =========================================================

  const handleChange = (e) => {
    if (!puedeModificar) {
      return;
    }

    const { name, value } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));

    setMensaje("");
    setError("");
  };

  // =========================================================
  // FORMATEAR TIEMPO
  // =========================================================

  const formatearTiempo = (minutos) => {
    const total = Math.max(
      0,
      Number(minutos || 0)
    );

    const horas = Math.floor(total / 60);
    const mins = total % 60;

    return `${String(horas).padStart(
      2,
      "0"
    )}:${String(mins).padStart(
      2,
      "0"
    )}:00`;
  };

  // =========================================================
  // TEXTO ESTADO
  // =========================================================

  const obtenerTextoEstado = (estado) => {
    const estados = {
      pendiente: "Pendiente",
      en_proceso: "En proceso",
      completada: "Completada",
    };

    return (
      estados[estado] ||
      estado ||
      "Pendiente"
    );
  };

  // =========================================================
  // OBTENER NOMBRE DEL RESPONSABLE
  // =========================================================

  const obtenerNombreResponsable = () => {
    if (!tarea?.responsable_id) {
      return "Sin responsable";
    }

    const responsable = usuarios.find(
      (usuario) =>
        String(usuario.id) ===
        String(tarea.responsable_id)
    );

    if (!responsable) {
      return "Sin responsable";
    }

    return `${responsable.nombre || ""} ${
      responsable.apellido || ""
    }`.trim();
  };

  // =========================================================
  // GUARDAR CAMBIOS
  // =========================================================

  const guardarCambios = async (e) => {
    e.preventDefault();

    setMensaje("");
    setError("");

    if (!puedeModificar) {
      setError(
        "No tienes permisos para modificar esta tarea."
      );

      return;
    }

    if (!formulario.titulo.trim()) {
      setError(
        "El título de la tarea es obligatorio."
      );

      return;
    }

    if (!formulario.fecha_inicio) {
      setError(
        "La fecha programada es obligatoria."
      );

      return;
    }

    try {
      setGuardando(true);

      const {
        data,
        error: errorUpdate,
      } = await supabase
        .from("tareas")
        .update({
          titulo: formulario.titulo.trim(),
          descripcion:
            formulario.descripcion.trim() ||
            null,
          fecha_inicio:
            formulario.fecha_inicio || null,
          prioridad:
            formulario.prioridad || null,
          responsable_id:
            formulario.responsable_id || null,
          departamento_id:
            formulario.departamento_id || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (errorUpdate) {
        throw errorUpdate;
      }

      setTarea(data);

      setFormulario({
        titulo: data.titulo || "",
        descripcion: data.descripcion || "",
        fecha_inicio: data.fecha_inicio
          ? data.fecha_inicio.substring(0, 10)
          : "",
        prioridad: data.prioridad || "media",
        estado: data.estado || "pendiente",
        responsable_id:
          data.responsable_id || "",
        departamento_id:
          data.departamento_id || "",
      });

      setMensaje(
        "Cambios guardados correctamente."
      );

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(
        "Error guardando tarea:",
        err
      );

      setError(
        err.message ||
          "No fue posible guardar los cambios."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =========================================================
  // ELIMINAR TAREA
  // =========================================================

  const eliminarTarea = async () => {
    if (!puedeModificar) {
      setError(
        "No tienes permisos para eliminar esta tarea."
      );

      return;
    }

    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar esta tarea?\n\nEsta acción no se puede deshacer."
    );

    if (!confirmar) {
      return;
    }

    try {
      setEliminando(true);
      setError("");
      setMensaje("");

      const { error: errorDelete } =
        await supabase
          .from("tareas")
          .delete()
          .eq("id", id);

      if (errorDelete) {
        throw errorDelete;
      }

      navigate("/tareas");
    } catch (err) {
      console.error(
        "Error eliminando tarea:",
        err
      );

      setError(
        err.message ||
          "No fue posible eliminar la tarea."
      );

      setEliminando(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="editar-tarea-page">
        <div className="editar-tarea-loading">
          <div className="loader"></div>

          <span>
            Cargando tarea...
          </span>
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR SIN TAREA
  // =========================================================

  if (!tarea) {
    return (
      <div className="editar-tarea-page">
        <div className="editar-tarea-error-box">
          <h2>
            No se encontró la tarea
          </h2>

          <p>
            La tarea que intentas editar no
            existe o ya no está disponible.
          </p>

          <button
            type="button"
            className="editar-tarea-btn secundario"
            onClick={() =>
              navigate("/tareas")
            }
          >
            Volver a tareas
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // VARIABLES
  // =========================================================

  const estadoActual =
    tarea.estado || "pendiente";

  const tiempoActual =
    tarea.tiempo_trabajado_min || 0;

  // =========================================================
  // JSX
  // =========================================================

  return (
    <section className="editar-tarea-page">
      {/* HEADER */}

      <div className="editar-tarea-header">
        <div>
          <span className="editar-tarea-eyebrow">
            GESTIÓN
          </span>

          <h1>Editar tarea</h1>

          <p>
            Modifica la información de la
            tarea.
          </p>
        </div>

        <button
          type="button"
          className="editar-tarea-btn secundario"
          onClick={() =>
            navigate("/tareas")
          }
        >
          Volver
        </button>
      </div>

      {/* INFORMACIÓN SUPERIOR */}

      <div className="editar-tarea-tiempo-top">
        <div className="editar-tarea-tiempo-item">
          <span>
            TIEMPO DE LA TAREA
          </span>

          <strong>
            {formatearTiempo(
              tiempoActual
            )}
          </strong>
        </div>

        <div className="editar-tarea-tiempo-item">
          <span>
            QUIÉN ESTÁ HACIENDO LA TAREA
          </span>

          <strong>
            {obtenerNombreResponsable()}
          </strong>
        </div>

        <div className="editar-tarea-tiempo-item">
          <span>ESTADO</span>

          <strong
            className={`estado-texto estado-${estadoActual}`}
          >
            {obtenerTextoEstado(
              estadoActual
            )}
          </strong>
        </div>
      </div>

      {/* MENSAJE SIN PERMISOS */}

      {usuarioActual && !puedeModificar && (
        <div className="editar-tarea-permiso-denegado">
          <strong>
            🔒 Esta tarea no puede ser
            modificada
          </strong>

          <span>
            No eres el responsable de esta tarea
            y no tienes permisos de editor.
          </span>
        </div>
      )}

      {/* MENSAJE DE ÉXITO */}

      {mensaje && (
        <div className="editar-tarea-mensaje">
          ✓ {mensaje}
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div className="editar-tarea-error">
          {error}
        </div>
      )}

      {/* FORMULARIO */}

      <form
        className="editar-tarea-card"
        onSubmit={guardarCambios}
      >
        {/* INFORMACIÓN */}

        <div className="editar-tarea-section">
          <h2>
            Información de la tarea
          </h2>

          <p>
            Actualiza los datos principales
            de la actividad.
          </p>

          <div className="editar-tarea-grid">
            {/* TÍTULO */}

            <div className="editar-tarea-group full">
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
                disabled={
                  !puedeModificar ||
                  guardando ||
                  eliminando
                }
              />
            </div>

            {/* DESCRIPCIÓN */}

            <div className="editar-tarea-group full">
              <label htmlFor="descripcion">
                Descripción
              </label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={
                  formulario.descripcion
                }
                onChange={handleChange}
                placeholder="Describe qué se debe realizar..."
                rows="5"
                disabled={
                  !puedeModificar ||
                  guardando ||
                  eliminando
                }
              />
            </div>
          </div>
        </div>

        {/* FECHA */}

        <div className="editar-tarea-section">
          <h2>Fecha</h2>

          <p>
            Modifica el día programado para la
            actividad.
          </p>

          <div className="editar-tarea-grid">
            <div className="editar-tarea-group">
              <label htmlFor="fecha_inicio">
                Fecha programada
              </label>

              <input
                id="fecha_inicio"
                name="fecha_inicio"
                type="date"
                value={
                  formulario.fecha_inicio
                }
                onChange={handleChange}
                disabled={
                  !puedeModificar ||
                  guardando ||
                  eliminando
                }
              />
            </div>
          </div>
        </div>

        {/* ASIGNACIÓN */}

        <div className="editar-tarea-section">
          <h2>Asignación</h2>

          <p>
            Modifica prioridad, departamento y
            responsable.
          </p>

          <div className="editar-tarea-grid">
            {/* PRIORIDAD */}

            <div className="editar-tarea-group">
              <label htmlFor="prioridad">
                Prioridad
              </label>

              <select
                id="prioridad"
                name="prioridad"
                value={
                  formulario.prioridad
                }
                onChange={handleChange}
                disabled={
                  !puedeModificar ||
                  guardando ||
                  eliminando
                }
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

                <option value="urgente">
                  Urgente
                </option>
              </select>
            </div>

            {/* ESTADO BLOQUEADO */}

            <div className="editar-tarea-group">
              <label htmlFor="estado">
                Estado
              </label>

              <select
                id="estado"
                name="estado"
                value={formulario.estado}
                disabled
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

              <small className="editar-tarea-help">
                El estado se controla desde la
                ejecución de la tarea.
              </small>
            </div>

            {/* DEPARTAMENTO */}

            <div className="editar-tarea-group">
              <label htmlFor="departamento_id">
                Departamento
              </label>

              <select
                id="departamento_id"
                name="departamento_id"
                value={
                  formulario.departamento_id
                }
                onChange={handleChange}
                disabled={
                  !puedeModificar ||
                  cargandoDepartamentos ||
                  guardando ||
                  eliminando
                }
              >
                <option value="">
                  Sin departamento
                </option>

                {departamentos.map(
                  (departamento) => (
                    <option
                      key={departamento.id}
                      value={
                        departamento.id
                      }
                    >
                      {departamento.nombre}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* RESPONSABLE */}

            <div className="editar-tarea-group">
              <label htmlFor="responsable_id">
                Responsable
              </label>

              <select
                id="responsable_id"
                name="responsable_id"
                value={
                  formulario.responsable_id
                }
                onChange={handleChange}
                disabled={
                  !puedeModificar ||
                  cargandoUsuarios ||
                  guardando ||
                  eliminando
                }
              >
                <option value="">
                  Sin responsable
                </option>

                {usuarios.map((usuario) => (
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
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TIEMPO INFORMATIVO */}

        <div className="editar-tarea-tiempo-info">
          <div>
            <span>
              TIEMPO REGISTRADO
            </span>

            <strong>
              {formatearTiempo(
                tarea.tiempo_trabajado_min
              )}
            </strong>
          </div>

          <div>
            <span>
              ESTADO ACTUAL
            </span>

            <strong>
              {obtenerTextoEstado(
                estadoActual
              )}
            </strong>
          </div>
        </div>

        {/* ACCIONES */}

        <div className="editar-tarea-actions">
          <button
            type="button"
            className="editar-tarea-btn cancelar"
            onClick={() =>
              navigate("/tareas")
            }
            disabled={
              guardando || eliminando
            }
          >
            Cancelar
          </button>

          <button
            type="button"
            className="editar-tarea-btn eliminar"
            onClick={eliminarTarea}
            disabled={
              !puedeModificar ||
              guardando ||
              eliminando
            }
          >
            {eliminando
              ? "Eliminando..."
              : "Eliminar tarea"}
          </button>

          <button
            type="submit"
            className="editar-tarea-btn guardar"
            disabled={
              !puedeModificar ||
              guardando ||
              eliminando
            }
          >
            {guardando
              ? "Guardando..."
              : "Guardar cambios"}
          </button>
        </div>
      </form>

      {/* MENSAJE FINAL */}

      {mensaje && (
        <div className="editar-tarea-mensaje-final">
          ✓ {mensaje}
        </div>
      )}
    </section>
  );
}

export default EditarTarea;