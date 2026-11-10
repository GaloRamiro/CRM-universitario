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

  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);

  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(true);

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
        console.error("Error cargando usuarios:", error);

        setError("No se pudieron cargar los usuarios.");
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
        console.error("Error cargando departamentos:", error);

        setError("No se pudieron cargar los departamentos.");
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
    const cambiaAgenda = name === "fecha" || name === "responsable_id";

    if (cambiaAgenda) setTramoElegido(null);

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
      ...(cambiaAgenda ? { hora_inicio: "", hora_fin: "" } : {}),
    }));
  };

  // =========================================================
  // CALCULAR MINUTOS
  // =========================================================

  const calcularMinutos = () => {
    if (!formulario.hora_inicio || !formulario.hora_fin) {
      return 0;
    }

    const [horaInicio, minutoInicio] = formulario.hora_inicio
      .split(":")
      .map(Number);

    const [horaFin, minutoFin] = formulario.hora_fin.split(":").map(Number);

    const inicio = horaInicio * 60 + minutoInicio;

    const fin = horaFin * 60 + minutoFin;

    return fin - inicio;
  };

  const minutosTrabajados = calcularMinutos();
  const fechaHorario = formulario.fecha;
  const responsableHorario = formulario.responsable_id;
  const claveHorario = `${responsableHorario}/${fechaHorario}`;
  const [agenda, setAgenda] = useState(null);
  const [tramoElegido, setTramoElegido] = useState(null);
  useEffect(() => {
    if (!fechaHorario || !responsableHorario) return;

    let cancelado = false;

    const consultarAgenda = async () => {
      const diaInicio = Date.parse(`${fechaHorario}T00:00:00-05:00`);
      const diaFin = diaInicio + 86_400_000;

      const [sesiones, anteriores, almuerzos] = await Promise.all([
        supabase
          .from("tarea_sesiones")
          .select("inicio,fin,tareas(titulo)")
          .eq("usuario_id", responsableHorario)
          .lt("inicio", new Date(diaFin).toISOString())
          .or(`fin.is.null,fin.gt.${new Date(diaInicio).toISOString()}`),
        supabase
          .from("tareas")
          .select("titulo,hora_inicio,hora_fin,tarea_sesiones(id)")
          .eq("responsable_id", responsableHorario)
          .eq("estado", "completada")
          .or(
            `fecha_inicio.eq.${fechaHorario},and(fecha_inicio.is.null,fecha.eq.${fechaHorario})`,
          ),
        supabase.rpc("crm_almuerzos_del_dia", {
          p_usuario_id: responsableHorario,
          p_fecha: fechaHorario,
        }),
      ]);

      if (cancelado) return;

      if (sesiones.error || anteriores.error || almuerzos.error) {
        setAgenda({
          clave: claveHorario,
          error: "No se pudo consultar el horario.",
        });
        return;
      }

      const aMinutos = (hora) => {
        const [h, m, s = 0] = hora.split(":").map(Number);
        return h * 60 + m + s / 60;
      };

      const ocupados = [
        ...sesiones.data.map(({ inicio, fin, tareas }) => [
          Math.floor((Date.parse(inicio) - diaInicio) / 60_000),
          fin ? Math.ceil((Date.parse(fin) - diaInicio) / 60_000) : 1440,
          tareas?.titulo || "Sesión registrada",
        ]),
        ...anteriores.data
          .filter(
            (tarea) =>
              tarea.hora_inicio &&
              tarea.hora_fin &&
              tarea.tarea_sesiones.length === 0,
          )
          .map(({ hora_inicio, hora_fin, titulo }) => [
            Math.floor(aMinutos(hora_inicio)),
            Math.ceil(aMinutos(hora_fin)),
            titulo,
          ]),
      ].sort((a, b) => a[0] - b[0]);

      const pausasAlmuerzo = almuerzos.data
        .map(({ inicio, fin, regreso_registrado }) => [
          Math.max(480, Math.floor((Date.parse(inicio) - diaInicio) / 60_000)),
          Math.min(1020, Math.ceil((Date.parse(fin) - diaInicio) / 60_000)),
          regreso_registrado ? "Almuerzo" : "Almuerzo sin regreso registrado",
        ])
        .filter(([desde, hasta]) => desde < hasta);

      const bloqueos = [...ocupados, ...pausasAlmuerzo].sort(
        (a, b) => a[0] - b[0],
      );
      const ultimoMinuto = Math.floor((Date.now() - diaInicio) / 60_000);
      const fin = Math.min(1020, ultimoMinuto);
      const libres = [];
      let cursor = 480;

      for (const [desde, hasta] of bloqueos) {
        if (hasta <= cursor || desde >= fin) continue;
        if (desde > cursor) libres.push([cursor, desde]);
        cursor = Math.max(cursor, hasta);
      }

      if (cursor < fin) libres.push([cursor, fin]);

      setAgenda({
        clave: claveHorario,
        libres,
        ocupados,
        almuerzos: pausasAlmuerzo,
      });
    };

    consultarAgenda();

    return () => {
      cancelado = true;
    };
  }, [claveHorario, fechaHorario, responsableHorario]);

  const agendaVisible = agenda?.clave === claveHorario ? agenda : null;

  const formatearHoraLibre = (minutos) =>
    `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(
      minutos % 60,
    ).padStart(2, "0")}`;
  const tramoActual =
    tramoElegido?.clave === claveHorario
      ? agendaVisible?.libres?.find(([desde]) => desde === tramoElegido.desde)
      : null;

  const inicioElegido = formulario.hora_inicio
    ? formulario.hora_inicio
        .split(":")
        .reduce((horas, parte) => horas * 60 + Number(parte), 0)
    : null;

  const agendaDelDia = [
    ...(agendaVisible?.libres ?? []).map(([desde, hasta]) => ({
      desde,
      hasta,
      tipo: "libre",
      titulo: "Horario libre",
    })),
    ...(agendaVisible?.ocupados ?? [])
      .map(([desde, hasta, titulo]) => ({
        desde: Math.max(480, desde),
        hasta: Math.min(1020, hasta),
        tipo: "ocupado",
        titulo,
      }))
      .filter(({ desde, hasta }) => desde < hasta),
    ...(agendaVisible?.almuerzos ?? []).map(([desde, hasta, titulo]) => ({
      desde,
      hasta,
      tipo: "almuerzo",
      titulo,
    })),
  ].sort((a, b) => a.desde - b.desde);

  const aplicarHorario = (inicio, duracion) => {
    setFormulario((actual) => ({
      ...actual,
      hora_inicio: formatearHoraLibre(inicio),
      hora_fin: formatearHoraLibre(inicio + duracion),
    }));
  };

  const seleccionarTramo = (desde, hasta) => {
    setTramoElegido({ clave: claveHorario, desde });
    aplicarHorario(desde, Math.min(30, hasta - desde));
  };
  // =========================================================
  // FORMATEAR DURACIÓN
  // =========================================================

  const formatearDuracion = (minutos) => {
    if (!minutos || minutos <= 0) {
      return "0 minutos";
    }

    const horas = Math.floor(minutos / 60);

    const minutosRestantes = minutos % 60;

    if (horas === 0) {
      return `${minutosRestantes} minutos`;
    }

    if (minutosRestantes === 0) {
      return `${horas} ${horas === 1 ? "hora" : "horas"}`;
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
        throw new Error("El título de la tarea es obligatorio.");
      }

      if (!formulario.fecha) {
        throw new Error("La fecha de la tarea es obligatoria.");
      }

      if (!formulario.hora_inicio) {
        throw new Error("La hora de inicio es obligatoria.");
      }

      if (!formulario.hora_fin) {
        throw new Error("La hora de finalización es obligatoria.");
      }

      if (minutosTrabajados <= 0) {
        throw new Error(
          "La hora de finalización debe ser posterior a la hora de inicio.",
        );
      }

      if (!formulario.responsable_id) {
        throw new Error("Selecciona quién realizó la tarea.");
      }

      const { data: tareaId, error: insertError } = await supabase.rpc(
        "crm_registrar_tarea_olvidada",
        {
          p_titulo: formulario.titulo,
          p_descripcion: formulario.descripcion,
          p_fecha: formulario.fecha,
          p_hora_inicio: formulario.hora_inicio,
          p_hora_fin: formulario.hora_fin,
          p_prioridad: formulario.prioridad,
          p_responsable_id: formulario.responsable_id,
          p_departamento_id: formulario.departamento_id || null,
        },
      );

      const data = { id: tareaId };

      // =======================================================
      // ERROR DE INSERCIÓN
      // =======================================================

      if (insertError) {
        console.error("Error creando tarea olvidada:", insertError);

        throw new Error(
          insertError.message || "No se pudo registrar la tarea olvidada.",
        );
      }

      console.log("Tarea olvidada registrada:", data);

      // =======================================================
      // NOTIFICACIÓN
      // =======================================================

      if (formulario.responsable_id) {
        const { error: notificacionError } = await supabase
          .from("notificaciones")
          .insert({
            usuario_id: formulario.responsable_id,

            tarea_id: data.id,

            tipo: "tarea_olvidada",

            titulo: "Tarea registrada anteriormente",

            mensaje: `Se registró una tarea realizada el ${formulario.fecha}: "${formulario.titulo.trim()}".`,

            leida: false,
          });

        if (notificacionError) {
          console.error("Error creando notificación:", notificacionError);
        }
      }

      // =======================================================
      // MENSAJE
      // =======================================================

      setMensaje(
        `Tarea registrada correctamente. Tiempo contabilizado: ${formatearDuracion(
          minutosTrabajados,
        )}.`,
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

      setError(err.message || "No se pudo registrar la tarea olvidada.");
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
          <span className="eyebrow">REGISTRO RETROACTIVO</span>

          <h1>Tarea olvidada</h1>

          <p>
            Registra una actividad realizada anteriormente que no fue cargada en
            su momento.
          </p>
        </div>

        <button
          type="button"
          className="tarea-olvidada-btn tarea-olvidada-btn-cancelar"
          onClick={() => navigate("/tareas")}
        >
          Cancelar
        </button>
      </div>

      {/* =====================================================
          AVISO
      ===================================================== */}

      <div className="tarea-olvidada-aviso">
        <strong>Registro de horas anteriores</strong>

        <span>
          Utiliza esta opción si realizaste una actividad en una fecha anterior
          y no pudiste registrarla en ese momento. Las horas ingresadas se
          contabilizarán en la carga de trabajo y en los reportes.
        </span>
      </div>

      {/* =====================================================
          FORMULARIO
      ===================================================== */}

      <form className="tarea-olvidada-card" onSubmit={handleSubmit}>
        {/* ===================================================
            INFORMACIÓN
        =================================================== */}
        <div className="tarea-olvidada-section">
          <h2>Información de la tarea</h2>

          <p>Ingresa los datos de la actividad que olvidaste registrar.</p>

          <div className="tarea-olvidada-grid">
            <div className="tarea-olvidada-group">
              <label htmlFor="titulo">Título de la tarea</label>

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
              <label htmlFor="descripcion">Descripción</label>

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
            ASIGNACIÓN
        =================================================== */}
        <div className="tarea-olvidada-section">
          <h2>Asignación</h2>

          <p>
            Define quién realizó la actividad y a qué departamento corresponde.
          </p>

          <div className="tarea-olvidada-grid">
            {/* PRIORIDAD */}

            <div className="tarea-olvidada-group">
              <label htmlFor="prioridad">Prioridad</label>

              <select
                id="prioridad"
                name="prioridad"
                value={formulario.prioridad}
                onChange={handleChange}
              >
                <option value="baja">Baja</option>

                <option value="media">Media</option>

                <option value="alta">Alta</option>
              </select>
            </div>

            {/* DEPARTAMENTO */}

            <div className="tarea-olvidada-group">
              <label htmlFor="departamento_id">Departamento</label>

              <select
                id="departamento_id"
                name="departamento_id"
                value={formulario.departamento_id}
                onChange={handleChange}
                disabled={cargandoDepartamentos}
              >
                <option value="">Sin departamento</option>

                {departamentos.map((departamento) => (
                  <option key={departamento.id} value={departamento.id}>
                    {departamento.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* RESPONSABLE */}

            <div className="tarea-olvidada-group">
              <label htmlFor="responsable_id">Responsable</label>

              <select
                id="responsable_id"
                name="responsable_id"
                value={formulario.responsable_id}
                onChange={handleChange}
                disabled={cargandoUsuarios}
              >
                <option value="">Selecciona un responsable</option>

                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre} {usuario.apellido}
                    {usuario.email ? ` — ${usuario.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="tarea-olvidada-section">
          <h2>Fecha y horas trabajadas</h2>

          <p>
            Indica la fecha real y el horario en el que realizaste la actividad.
          </p>

          <div className="tarea-olvidada-grid">
            <div className="tarea-olvidada-group">
              <label htmlFor="fecha">Fecha de la tarea</label>

              <input
                id="fecha"
                name="fecha"
                type="date"
                value={formulario.fecha}
                onChange={handleChange}
                required
              />

              <small>Puedes seleccionar una fecha anterior.</small>
            </div>
            <div className="tarea-olvidada-group agenda-dia">
              <strong>Agenda del día</strong>

              {!fechaHorario || !responsableHorario ? (
                <p>Selecciona la fecha y el responsable.</p>
              ) : !agendaVisible ? (
                <p>Consultando horarios…</p>
              ) : agendaVisible.error ? (
                <p>{agendaVisible.error}</p>
              ) : (
                <>
                  <ul className="agenda-lista">
                    {agendaDelDia.map(
                      ({ desde, hasta, tipo, titulo }, indice) => (
                        <li
                          key={`${tipo}-${desde}-${hasta}-${indice}`}
                          className={`agenda-fila agenda-fila--${tipo}`}
                        >
                          <strong>
                            {formatearHoraLibre(desde)}–
                            {formatearHoraLibre(hasta)}
                          </strong>{" "}
                          {tipo === "libre" ? (
                            <button
                              type="button"
                              aria-pressed={tramoActual?.[0] === desde}
                              onClick={() => seleccionarTramo(desde, hasta)}
                            >
                              {tramoActual?.[0] === desde
                                ? "Horario seleccionado"
                                : "Usar este horario"}
                            </button>
                          ) : (
                            <span>
                              {tipo === "ocupado" ? "Ocupado · " : ""}
                              {titulo}
                            </span>
                          )}
                        </li>
                      ),
                    )}
                  </ul>

                  {agendaVisible.libres.length === 0 && (
                    <p>
                      No hay tramos libres para registrar una tarea en este día.
                    </p>
                  )}

                  {tramoActual && inicioElegido !== null && (
                    <>
                      <label htmlFor="inicio-dentro-del-tramo">
                        Empezar en
                      </label>
                      <select
                        id="inicio-dentro-del-tramo"
                        value={inicioElegido}
                        onChange={(e) => {
                          const inicio = Number(e.currentTarget.value);
                          aplicarHorario(
                            inicio,
                            Math.min(
                              minutosTrabajados,
                              tramoActual[1] - inicio,
                            ),
                          );
                        }}
                      >
                        {Array.from(
                          { length: tramoActual[1] - tramoActual[0] },
                          (_, indice) => tramoActual[0] + indice,
                        ).map((inicio) => (
                          <option key={inicio} value={inicio}>
                            {formatearHoraLibre(inicio)}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="duracion-tarea-olvidada">
                        Duración en minutos
                      </label>
                      <select
                        id="duracion-tarea-olvidada"
                        value={minutosTrabajados}
                        onChange={(e) =>
                          aplicarHorario(
                            inicioElegido,
                            Number(e.currentTarget.value),
                          )
                        }
                      >
                        {Array.from(
                          { length: tramoActual[1] - inicioElegido },
                          (_, indice) => indice + 1,
                        ).map((minutos) => (
                          <option key={minutos} value={minutos}>
                            {minutos} min
                          </option>
                        ))}
                      </select>

                      <p aria-live="polite">
                        Se registrará de{" "}
                        <strong>{formulario.hora_inicio}</strong> a{" "}
                        <strong>{formulario.hora_fin}</strong> ·{" "}
                        {minutosTrabajados} min
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* =================================================
              RESUMEN DE TIEMPO
          ================================================= */}

          <div className="tarea-olvidada-tiempo">
            <span>Tiempo que se contabilizará</span>

            <strong>{formatearDuracion(minutosTrabajados)}</strong>
          </div>
        </div>
        {/* ===================================================
            MENSAJES
        =================================================== */}
        {mensaje && <div className="tarea-olvidada-mensaje">{mensaje}</div>}
        {error && <div className="tarea-olvidada-error">{error}</div>}
        {/* ===================================================
            BOTONES
        =================================================== */}
        <div className="tarea-olvidada-actions">
          <button
            type="button"
            className="tarea-olvidada-btn tarea-olvidada-btn-cancelar"
            onClick={() => navigate("/tareas")}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="tarea-olvidada-btn tarea-olvidada-btn-guardar"
            disabled={guardando || !tramoActual}
          >
            {guardando ? "Registrando..." : "Registrar tarea olvidada"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default TareaOlvidada;
