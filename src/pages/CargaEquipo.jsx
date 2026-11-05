import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./CargaEquipo.css";

const MINUTOS_JORNADA = 480;
const ZONA = "America/Guayaquil";
const DIA_MS = 86400000;
const TAMANO_PAGINA = 500;
const PERSONAS_POR_PAGINA = 6;
const TAREAS_POR_PAGINA = 12;

// Lee todas las páginas; si falla una consulta, no presenta resultados parciales.
async function consultarTodo(
  tabla,
  columnas,
  configurar = (consulta) => consulta,
) {
  const registros = [];
  for (let pagina = 0; pagina < 10000; pagina += 1) {
    const desde = pagina * TAMANO_PAGINA;
    const consulta = configurar(
      supabase.from(tabla).select(columnas).order("id", { ascending: true }),
    );
    const { data, error } = await consulta.range(
      desde,
      desde + TAMANO_PAGINA - 1,
    );
    if (error) throw new Error(`Error consultando ${tabla}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`Respuesta inválida de ${tabla}`);
    registros.push(...data);
    if (data.length < TAMANO_PAGINA) return registros;
  }
  throw new Error(
    `Se superó el límite de páginas de ${tabla}. No se mostrarán datos incompletos.`,
  );
}

function fechaEcuador(valor = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(valor);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function moverFecha(fecha, dias) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias))
    .toISOString()
    .slice(0, 10);
}

function diasInclusivos(inicio, fin) {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fin}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / DIA_MS) + 1;
}

function minutosPlanificados(tarea, fecha) {
  const inicio = tarea.fecha_inicio || tarea.fecha;
  const fin = tarea.fecha_fin || inicio;
  if (!inicio || fecha < inicio || fecha > fin) return 0;
  const dias = diasInclusivos(inicio, fin);
  if (!dias) return 0;
  const estimado = Number(tarea.tiempo_estimado);
  if (Number.isFinite(estimado) && estimado > 0) return estimado / dias;
  // Las horas guardadas son de ejecución, NO de planificación.
  // Sin estimación no se asignan minutos ficticios.
  return 0;
}

function intervaloFechaEcuador(fecha) {
  // Ecuador continental usa UTC-05:00 todo el año.
  return [
    Date.parse(`${fecha}T00:00:00-05:00`),
    Date.parse(`${moverFecha(fecha, 1)}T00:00:00-05:00`),
  ];
}

function minutosSesionEnFecha(sesion, fecha, ahoraMs) {
  const inicio = Date.parse(sesion.inicio);
  const fin = sesion.fin ? Date.parse(sesion.fin) : ahoraMs;
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio)
    return 0;
  const [diaInicio, diaFin] = intervaloFechaEcuador(fecha);
  const solapamiento = Math.max(
    0,
    Math.min(fin, diaFin) - Math.max(inicio, diaInicio),
  );
  if (!solapamiento) return 0;
  const total = fin - inicio;
  // Las sesiones cerradas usan el entero registrado por la RPC, distribuido proporcionalmente
  // si cruzan medianoche. Las abiertas se muestran provisionalmente en tiempo real.
  const minutos =
    sesion.fin && Number.isFinite(Number(sesion.duracion_minutos))
      ? Number(sesion.duracion_minutos)
      : total / 60000;
  return (minutos * solapamiento) / total;
}

// Intervalos reales por empleado para un día de Ecuador.
function analizarCruces(sesionesUsuario, fecha, ahoraMs, titulos) {
  const [desdeDia, hastaDia] = intervaloFechaEcuador(fecha);
  const intervalos = sesionesUsuario.flatMap((sesion) => {
    const inicio = Date.parse(sesion.inicio);
    const fin = sesion.fin ? Date.parse(sesion.fin) : ahoraMs;
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return [];
    const desde = Math.max(inicio, desdeDia);
    const hasta = Math.min(fin, hastaDia, ahoraMs);
    return hasta > desde
      ? [{ desde, hasta, tareaId: sesion.tarea_id, sesionId: sesion.id }]
      : [];
  });

  // Unión de intervalos: cada minuto de ocupación se cuenta una sola vez.
  const ordenados = [...intervalos].sort((a, b) => a.desde - b.desde);
  let ocupadoMs = 0;
  let extremo = -Infinity;
  for (const item of ordenados) {
    ocupadoMs += Math.max(0, item.hasta - Math.max(item.desde, extremo));
    extremo = Math.max(extremo, item.hasta);
  }

  // Barrido temporal: cruces entre tareas distintas, sin duplicar
  // minutos donde coinciden tres o más tareas.
  const eventos = intervalos
    .flatMap((i) => [
      { instante: i.desde, tipo: 1, tareaId: i.tareaId },
      { instante: i.hasta, tipo: -1, tareaId: i.tareaId },
    ])
    .sort((a, b) => a.instante - b.instante || a.tipo - b.tipo);
  const activos = new Map();
  const cruces = [];
  let anterior = null;
  for (let indice = 0; indice < eventos.length; ) {
    const instante = eventos[indice].instante;
    const tareasActivas = [...activos]
      .filter(([, n]) => n > 0)
      .map(([id]) => id);
    if (anterior !== null && instante > anterior && tareasActivas.length > 1) {
      const claves = [...tareasActivas].sort();
      const ultimo = cruces[cruces.length - 1];
      if (
        ultimo &&
        ultimo.hasta === anterior &&
        ultimo.claves.join("|") === claves.join("|")
      ) {
        ultimo.hasta = instante;
      } else {
        cruces.push({ desde: anterior, hasta: instante, claves });
      }
    }
    while (indice < eventos.length && eventos[indice].instante === instante) {
      const evento = eventos[indice++];
      const nuevo = (activos.get(evento.tareaId) || 0) + evento.tipo;
      if (nuevo <= 0) activos.delete(evento.tareaId);
      else activos.set(evento.tareaId, nuevo);
    }
    anterior = instante;
  }
  return {
    minutosOcupados: ocupadoMs / 60000,
    minutosCruce: cruces.reduce((s, c) => s + (c.hasta - c.desde) / 60000, 0),
    cruces: cruces.map((c) => ({
      ...c,
      tareas: c.claves.map((id) => titulos.get(id) || "Tarea sin título"),
      minutos: (c.hasta - c.desde) / 60000,
    })),
  };
}

function horaEcuador(ms) {
  return new Date(ms).toLocaleTimeString("es-EC", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatearHoras(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function formatearDuracion(minutos) {
  return formatearHoras(minutos);
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatearRangoTarea(tarea) {
  const inicio = tarea.fecha_inicio || tarea.fecha;
  const fin = tarea.fecha_fin || inicio;
  if (!inicio) return "Sin fecha";
  return inicio === fin
    ? formatearFecha(inicio)
    : `${formatearFecha(inicio)} → ${formatearFecha(fin)}`;
}

function textoEstado(tarea) {
  if (tarea.estado === "completada") return "Completada";
  if (tarea.estado_ejecucion === "pausada") return "Pausada";
  if (tarea.estado === "en_proceso" && tarea.estado_ejecucion === "en_proceso")
    return "En proceso";
  return "Pendiente";
}

// Resumen por tarea para la fecha consultada. No confunde horas de ejecución con agenda.
function resumenEjecucionTarea(tarea, sesiones, fecha, ahoraMs) {
  const relacionadas = sesiones.filter((s) => s.tarea_id === tarea.id);
  const minutos = relacionadas.reduce(
    (total, sesion) => total + minutosSesionEnFecha(sesion, fecha, ahoraMs),
    0,
  );
  const [inicioDia, finDia] = intervaloFechaEcuador(fecha);
  const delDia = relacionadas.filter((s) => {
    const inicio = Date.parse(s.inicio);
    const fin = s.fin ? Date.parse(s.fin) : ahoraMs;
    return (
      Number.isFinite(inicio) &&
      Number.isFinite(fin) &&
      inicio < finDia &&
      fin > inicioDia &&
      fin > inicio
    );
  });
  const abierta = delDia.some((s) => !s.fin);
  return {
    minutos,
    sesiones: delDia.length,
    abierta,
    texto: delDia.length
      ? `Trabajado este día: ${formatearHoras(minutos)} · ${delDia.length} ${delDia.length === 1 ? "sesión" : "sesiones"}${abierta ? " · En ejecución" : ""}`
      : "Sin sesiones registradas este día",
  };
}

function CargaEquipo() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [interrupciones, setInterrupciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() =>
    fechaEcuador(),
  );
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState(null);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const [paginaPersonas, setPaginaPersonas] = useState(1);
  const [paginaTareas, setPaginaTareas] = useState(1);

  const cargarDatos = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setActualizando(true);
    setError("");
    try {
      const [datosUsuarios, datosTareas, datosSesiones, datosInterrupciones] =
        await Promise.all([
          consultarTodo("usuarios", "id,nombre,apellido,email", (q) =>
            q.eq("activo", true),
          ),
          consultarTodo(
            "tareas",
            "id,titulo,descripcion,fecha,fecha_inicio,fecha_fin,hora_inicio,hora_fin,tiempo_estimado,tiempo_trabajado_min,estado,estado_ejecucion,inicio_real,fin_real,prioridad,responsable_id,departamento_id,created_at",
          ),
          consultarTodo(
            "tarea_sesiones",
            "id,tarea_id,usuario_id,inicio,fin,duracion_minutos,tipo_cierre",
          ),
          consultarTodo(
            "historial_interrupciones",
            "id,tarea_id,empleado_id,motivo,fecha,hora,tarea_interrumpidora_id",
          ),
        ]);
      setUsuarios(datosUsuarios);
      setTareas(datosTareas);
      setSesiones(datosSesiones);
      setInterrupciones(datosInterrupciones);
      setAhoraMs(Date.now());
    } catch (err) {
      console.error("Error cargando carga del equipo:", err);
      setError(err.message || "No se pudo cargar la información del equipo.");
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos(true);
  }, [cargarDatos]);
  useEffect(() => {
    const intervalo = setInterval(() => setAhoraMs(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);
  useEffect(() => {
    const actualizar = () => {
      if (document.visibilityState === "visible") cargarDatos();
    };
    const intervalo = setInterval(actualizar, 60000);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [cargarDatos]);

  const tareasDelDia = useMemo(
    () =>
      tareas.filter((t) => {
        const inicio = t.fecha_inicio || t.fecha;
        const fin = t.fecha_fin || inicio;
        return (
          inicio && fechaSeleccionada >= inicio && fechaSeleccionada <= fin
        );
      }),
    [tareas, fechaSeleccionada],
  );

  const minutosRealesPorUsuario = useMemo(() => {
    const mapa = new Map();
    for (const sesion of sesiones) {
      const minutos = minutosSesionEnFecha(sesion, fechaSeleccionada, ahoraMs);
      if (minutos)
        mapa.set(
          sesion.usuario_id,
          (mapa.get(sesion.usuario_id) || 0) + minutos,
        );
    }
    return mapa;
  }, [sesiones, fechaSeleccionada, ahoraMs]);

  const titulosPorTarea = useMemo(
    () => new Map(tareas.map((t) => [t.id, t.titulo])),
    [tareas],
  );
  const sesionesPorUsuario = useMemo(() => {
    const mapa = new Map();
    for (const sesion of sesiones) {
      if (!mapa.has(sesion.usuario_id)) mapa.set(sesion.usuario_id, []);
      mapa.get(sesion.usuario_id).push(sesion);
    }
    return mapa;
  }, [sesiones]);

  const interrupcionesDia = useMemo(
    () => interrupciones.filter((item) => item.fecha === fechaSeleccionada),
    [interrupciones, fechaSeleccionada],
  );

  const cargaUsuarios = useMemo(
    () =>
      usuarios.map((usuario) => {
        const tareasUsuario = tareasDelDia.filter(
          (t) => t.responsable_id === usuario.id,
        );
        const minutos = tareasUsuario.reduce(
          (suma, t) => suma + minutosPlanificados(t, fechaSeleccionada),
          0,
        );
        const minutosReales = minutosRealesPorUsuario.get(usuario.id) || 0;
        const analisis = analizarCruces(
          sesionesPorUsuario.get(usuario.id) || [],
          fechaSeleccionada,
          ahoraMs,
          titulosPorTarea,
        );
        const pausasUsuario = interrupcionesDia.filter(
          (i) => i.empleado_id === usuario.id,
        );
        const pausasOtraTarea = pausasUsuario.filter((i) =>
          ["otra_tarea", "cambio_tarea", "tarea_urgente"].includes(i.motivo),
        ).length;
        const desgloseInterrupciones = {
          cambio: pausasOtraTarea,
          almuerzo: pausasUsuario.filter((i) => i.motivo === "almuerzo").length,
          otras: pausasUsuario.filter(
            (i) =>
              ![
                "otra_tarea",
                "cambio_tarea",
                "tarea_urgente",
                "almuerzo",
              ].includes(i.motivo),
          ).length,
        };
        const tareaActual =
          tareas.find(
            (t) =>
              t.responsable_id === usuario.id &&
              t.estado === "en_proceso" &&
              t.estado_ejecucion === "en_proceso",
          ) || null;
        const nivel =
          minutos > MINUTOS_JORNADA
            ? "sobrecargado"
            : minutos >= 360
              ? "alta"
              : "normal";
        const historicoSinSesiones = tareasUsuario.reduce((suma, t) => {
          const tieneSesiones = sesiones.some((s) => s.tarea_id === t.id);
          return (
            suma +
            (!tieneSesiones
              ? Math.max(0, Number(t.tiempo_trabajado_min) || 0)
              : 0)
          );
        }, 0);
        return {
          ...usuario,
          tareas: tareasUsuario,
          cantidadTareas: tareasUsuario.length,
          minutos,
          minutosReales,
          historicoSinSesiones,
          horas: minutos / 60,
          minutosDisponibles: Math.max(0, MINUTOS_JORNADA - minutos),
          ocupacion: {
            ocupado: analisis.minutosOcupados,
            minutosCruzados: analisis.minutosCruce,
            cruces: analisis.cruces,
            sinHorario: minutos,
          },
          minutosCruce: analisis.minutosCruce,
          nivel,
          tareaActual,
          pausasOtraTarea,
          pausasTotales: pausasUsuario.length,
          desgloseInterrupciones,
          disponibilidad: tareaActual
            ? "En actividad"
            : nivel === "sobrecargado"
              ? "Sobrecargado"
              : nivel === "alta"
                ? "Carga alta"
                : "Disponible",
        };
      }),
    [
      usuarios,
      tareasDelDia,
      tareas,
      sesiones,
      fechaSeleccionada,
      minutosRealesPorUsuario,
      interrupcionesDia,
      sesionesPorUsuario,
      titulosPorTarea,
      ahoraMs,
    ],
  );

  const usuarioSeleccionado =
    cargaUsuarios.find((u) => u.id === usuarioSeleccionadoId) || null;
  const totalMinutos = cargaUsuarios.reduce((s, u) => s + u.minutos, 0);
  const totalReales = cargaUsuarios.reduce((s, u) => s + u.minutosReales, 0);
  const totalCruces = cargaUsuarios.reduce((s, u) => s + u.minutosCruce, 0);
  const usuariosConCruces = cargaUsuarios.filter((u) => u.minutosCruce > 0);
  const totalTareas = tareasDelDia.length;
  const usuariosConTrabajo = cargaUsuarios.filter(
    (u) => u.cantidadTareas > 0,
  ).length;
  const usuariosDisponibles = cargaUsuarios.filter(
    (u) => u.cantidadTareas === 0,
  ).length;
  const usuariosSobrecargados = cargaUsuarios.filter(
    (u) => u.nivel === "sobrecargado",
  );
  const tareasEnProceso = tareas.filter(
    (t) => t.estado === "en_proceso" && t.estado_ejecucion === "en_proceso",
  );
  const totalPaginasPersonas = Math.max(
    1,
    Math.ceil(cargaUsuarios.length / PERSONAS_POR_PAGINA),
  );
  const totalPaginasTareas = Math.max(
    1,
    Math.ceil(tareasDelDia.length / TAREAS_POR_PAGINA),
  );
  const personasVisibles = cargaUsuarios.slice(
    (Math.min(paginaPersonas, totalPaginasPersonas) - 1) * PERSONAS_POR_PAGINA,
    Math.min(paginaPersonas, totalPaginasPersonas) * PERSONAS_POR_PAGINA,
  );
  const tareasVisibles = tareasDelDia.slice(
    (Math.min(paginaTareas, totalPaginasTareas) - 1) * TAREAS_POR_PAGINA,
    Math.min(paginaTareas, totalPaginasTareas) * TAREAS_POR_PAGINA,
  );
  const totalPausasOtraTarea = cargaUsuarios.reduce(
    (s, u) => s + u.pausasOtraTarea,
    0,
  );
  const capacidadTotal = usuarios.length * MINUTOS_JORNADA;
  const porcentajeGeneral = capacidadTotal
    ? Math.min(100, (totalMinutos / capacidadTotal) * 100)
    : 0;
  const minutosDetalle = usuarioSeleccionado?.minutos || 0;
  const porcentajeDetalle = Math.min(
    100,
    (minutosDetalle / MINUTOS_JORNADA) * 100,
  );

  if (cargando)
    return (
      <section className="carga-equipo-page">
        <div className="carga-equipo-loading">
          <span className="carga-equipo-loader" />
          <p>Cargando carga del equipo...</p>
        </div>
      </section>
    );

  return (
    <section className="carga-equipo-page">
      <div className="carga-equipo-header">
        <div>
          <span className="eyebrow">GESTIÓN</span>
          <h1>Carga del equipo</h1>
          <p>
            Consulta la planificación diaria, disponibilidad y distribución de
            trabajo del equipo.
          </p>
        </div>
        <button
          type="button"
          className="carga-equipo-recargar"
          onClick={() => cargarDatos()}
          disabled={actualizando}
        >
          {actualizando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
      {error && <div className="carga-equipo-error">{error}</div>}
      <div className="carga-equipo-filtro">
        <div className="carga-fecha-consulta">
          <label htmlFor="fechaCarga">Consultar fecha</label>
          <div className="carga-fecha-controles">
            <button
              type="button"
              className="carga-fecha-btn"
              onClick={() => {
                setFechaSeleccionada((f) => moverFecha(f, -1));
                setPaginaTareas(1);
              }}
              aria-label="Día anterior"
            >
              ‹
            </button>
            <input
              id="fechaCarga"
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => {
                if (e.target.value) {
                  setFechaSeleccionada(e.target.value);
                  setPaginaTareas(1);
                }
              }}
            />
            <button
              type="button"
              className="carga-fecha-btn"
              onClick={() => {
                setFechaSeleccionada((f) => moverFecha(f, 1));
                setPaginaTareas(1);
              }}
              aria-label="Día siguiente"
            >
              ›
            </button>
            <button
              type="button"
              className="carga-fecha-hoy"
              onClick={() => {
                setFechaSeleccionada(fechaEcuador());
                setPaginaTareas(1);
              }}
            >
              Hoy
            </button>
          </div>
        </div>
        <div className="carga-equipo-fecha">
          {formatearFecha(fechaSeleccionada)}
        </div>
      </div>
      <div className="carga-equipo-resumen">
        <div className="carga-resumen-card">
          <span>Tareas del día</span>
          <strong>{totalTareas}</strong>
          <small>Actividades planificadas</small>
        </div>
        <div className="carga-resumen-card">
          <span>Trabajo planificado</span>
          <strong>{formatearHoras(totalMinutos)}</strong>
          <small>Tiempo estimado para esta fecha</small>
        </div>
        <div className="carga-resumen-card">
          <span>Personas con tareas</span>
          <strong>{usuariosConTrabajo}</strong>
          <small>{usuariosDisponibles} sin tareas planificadas</small>
        </div>
        <div className="carga-resumen-card">
          <span>Actividades en proceso</span>
          <strong>{tareasEnProceso.length}</strong>
          <small>Actualmente activas en el equipo</small>
        </div>
      </div>
      <div className="carga-equipo-progreso">
        <div className="carga-equipo-progreso-header">
          <div>
            <strong>Utilización general del equipo</strong>
            <span>
              {formatearHoras(totalMinutos)} de {formatearHoras(capacidadTotal)}{" "}
              disponibles · Trabajo registrado del día:{" "}
              {formatearHoras(totalReales)}
            </span>
          </div>
          <strong>{Math.round(porcentajeGeneral)}%</strong>
        </div>
        <div className="carga-equipo-progreso-barra">
          <div
            className="carga-equipo-progreso-fill"
            style={{ width: `${porcentajeGeneral}%` }}
          />
        </div>
      </div>
      {usuariosSobrecargados.length > 0 && (
        <div className="alerta-sobrecarga">
          <div className="alerta-icono">!</div>
          <div>
            <strong>Hay personas con sobrecarga</strong>
            <p>
              {usuariosSobrecargados.length} persona
              {usuariosSobrecargados.length !== 1 ? "s" : ""} supera la
              capacidad diaria de 8 horas.
            </p>
          </div>
        </div>
      )}
      {totalCruces > 0 && (
        <div className="alerta-sobrecarga">
          <div className="alerta-icono">!</div>
          <div>
            <strong>Cruces reales detectados</strong>
            <p>
              {usuariosConCruces.length} persona(s) presentan sesiones de
              distintas tareas superpuestas por {formatearHoras(totalCruces)}.
              Consulta el detalle para verlas.
            </p>
          </div>
        </div>
      )}
      {totalPausasOtraTarea > 0 && (
        <div className="alerta-operativa">
          <div className="alerta-operativa-icono">i</div>
          <div>
            <strong>Actividad interrumpida</strong>
            <p>
              Se han registrado {totalPausasOtraTarea} interrupciones por cambio
              de tarea o solicitud urgente en la fecha seleccionada.
            </p>
          </div>
        </div>
      )}
      <div className="carga-equipo-card">
        <div className="carga-equipo-card-header">
          <div>
            <span className="carga-card-eyebrow">EQUIPO</span>
            <h2>Distribución de trabajo</h2>
            <p>
              Selecciona una persona para consultar su planificación y
              disponibilidad.
            </p>
          </div>
          <div className="carga-equipo-card-indicador">
            {cargaUsuarios.length} personas
          </div>
        </div>
        {cargaUsuarios.length === 0 ? (
          <div className="carga-equipo-vacio">No existen usuarios activos.</div>
        ) : (
          <div className="carga-personas-grid">
            {personasVisibles.map((usuario) => {
              const porcentaje = Math.min(
                100,
                (usuario.minutos / MINUTOS_JORNADA) * 100,
              );
              const iniciales =
                `${usuario.nombre?.charAt(0) || ""}${usuario.apellido?.charAt(0) || ""}`.toUpperCase();
              return (
                <article className="persona-carga-card" key={usuario.id}>
                  <div className="persona-carga-header">
                    <div className="persona-carga-identidad">
                      <div className="persona-carga-avatar">{iniciales}</div>
                      <div>
                        <strong>
                          {usuario.nombre} {usuario.apellido}
                        </strong>
                        <span>
                          {usuario.cantidadTareas} tarea
                          {usuario.cantidadTareas !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`persona-estado persona-estado-${usuario.nivel}`}
                    >
                      {usuario.nivel === "sobrecargado"
                        ? "Sobrecargado"
                        : usuario.nivel === "alta"
                          ? "Carga alta"
                          : "Normal"}
                    </span>
                  </div>
                  <div className="persona-carga-resumen">
                    <div>
                      <span>Planificado</span>
                      <strong>{formatearHoras(usuario.minutos)}</strong>
                    </div>
                    <div>
                      <span>Capacidad</span>
                      <strong>8 h</strong>
                    </div>
                    <div>
                      <span>Interferencias</span>
                      <strong>{usuario.pausasOtraTarea}</strong>
                    </div>
                  </div>
                  <div className="persona-carga-resumen">
                    <div>
                      <span>Trabajado hoy</span>
                      <strong>{formatearHoras(usuario.minutosReales)}</strong>
                    </div>
                    <div>
                      <span>Disponible</span>
                      <strong>
                        {formatearHoras(usuario.minutosDisponibles)}
                      </strong>
                    </div>
                    <div>
                      <span>Ocupación sin cruces</span>
                      <strong>
                        {formatearHoras(usuario.ocupacion.ocupado)}
                      </strong>
                    </div>
                  </div>
                  {usuario.tareaActual && (
                    <div className="persona-actividad-actual">
                      <div className="persona-actividad-actual-top">
                        <span>ACTIVIDAD ACTUAL</span>
                        <strong>En proceso</strong>
                      </div>
                      <p>{usuario.tareaActual.titulo}</p>
                      {usuario.tareaActual.inicio_real && (
                        <small>
                          Inicio real:{" "}
                          {new Date(
                            usuario.tareaActual.inicio_real,
                          ).toLocaleTimeString("es-EC", {
                            timeZone: ZONA,
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      )}
                    </div>
                  )}
                  {usuario.ocupacion.cruces.length > 0 && (
                    <div className="persona-pausas-info">
                      <span>CRUCES REALES</span>
                      <strong>
                        {usuario.ocupacion.cruces.length} ·{" "}
                        {formatearHoras(usuario.ocupacion.minutosCruzados)}
                      </strong>
                    </div>
                  )}
                  {usuario.pausasOtraTarea > 0 && (
                    <div className="persona-pausas-info">
                      <span>CAMBIOS DE TAREA Y URGENCIAS</span>
                      <strong>{usuario.pausasOtraTarea}</strong>
                    </div>
                  )}
                  <div className="persona-carga-barra">
                    <div className="persona-carga-barra-top">
                      <span>Utilización planificada</span>
                      <strong>{Math.round(porcentaje)}%</strong>
                    </div>
                    <div className="barra-carga">
                      <div
                        className={`barra-carga-progreso nivel-${usuario.nivel}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                  <div className="persona-carga-informe">
                    {usuario.nivel === "normal" && (
                      <p className="informe-verde">
                        La planificación se encuentra dentro de la capacidad
                        diaria.
                      </p>
                    )}
                    {usuario.nivel === "alta" && (
                      <p className="informe-amarillo">
                        La persona se encuentra cerca de completar su capacidad
                        diaria.
                      </p>
                    )}
                    {usuario.nivel === "sobrecargado" && (
                      <p className="informe-rojo">
                        La planificación supera la capacidad diaria de 8 horas.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="persona-carga-boton"
                    onClick={() => setUsuarioSeleccionadoId(usuario.id)}
                  >
                    Ver carga
                  </button>
                </article>
              );
            })}
          </div>
        )}
        {totalPaginasPersonas > 1 && (
          <div
            className="carga-equipo-paginacion"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              padding: 16,
            }}
          >
            <button
              type="button"
              disabled={paginaPersonas <= 1}
              onClick={() => setPaginaPersonas((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              Página {Math.min(paginaPersonas, totalPaginasPersonas)} de{" "}
              {totalPaginasPersonas}
            </span>
            <button
              type="button"
              disabled={paginaPersonas >= totalPaginasPersonas}
              onClick={() =>
                setPaginaPersonas((p) => Math.min(totalPaginasPersonas, p + 1))
              }
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      <div className="carga-equipo-card">
        <div className="carga-equipo-card-header">
          <div>
            <span className="carga-card-eyebrow">PLANIFICACIÓN</span>
            <h2>Planificación del día</h2>
            <p>
              Actividades que ocupan esta fecha, incluyendo tareas de varios
              días.
            </p>
          </div>
          <div className="carga-equipo-card-indicador">
            {tareasDelDia.length} actividades
          </div>
        </div>
        {tareasDelDia.length === 0 ? (
          <div className="carga-equipo-vacio">
            No existen actividades planificadas para esta fecha.
          </div>
        ) : (
          <div className="planificacion-dia-lista">
            {tareasVisibles.map((tarea) => {
              const usuario = usuarios.find(
                (u) => u.id === tarea.responsable_id,
              );
              const minutos = minutosPlanificados(tarea, fechaSeleccionada);
              return (
                <div className="planificacion-dia-item" key={tarea.id}>
                  <div className="planificacion-dia-contenido">
                    <strong>{tarea.titulo}</strong>
                    <span>
                      {usuario
                        ? `${usuario.nombre} ${usuario.apellido}`
                        : "Sin responsable"}{" "}
                      · {formatearRangoTarea(tarea)}
                    </span>
                    <small>
                      {
                        resumenEjecucionTarea(
                          tarea,
                          sesiones,
                          fechaSeleccionada,
                          ahoraMs,
                        ).texto
                      }
                    </small>
                  </div>
                  <div className="planificacion-dia-meta">
                    <strong>{formatearDuracion(minutos)}</strong>
                    <span
                      className={`planificacion-estado estado-${tarea.estado}`}
                    >
                      {textoEstado(tarea)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {totalPaginasTareas > 1 && (
          <div
            className="carga-equipo-paginacion"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              padding: 16,
            }}
          >
            <button
              type="button"
              disabled={paginaTareas <= 1}
              onClick={() => setPaginaTareas((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              Página {Math.min(paginaTareas, totalPaginasTareas)} de{" "}
              {totalPaginasTareas}
            </span>
            <button
              type="button"
              disabled={paginaTareas >= totalPaginasTareas}
              onClick={() =>
                setPaginaTareas((p) => Math.min(totalPaginasTareas, p + 1))
              }
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      {usuarioSeleccionado && (
        <div
          className="carga-modal-overlay"
          onClick={() => setUsuarioSeleccionadoId(null)}
        >
          <div className="carga-modal" onClick={(e) => e.stopPropagation()}>
            <div className="carga-modal-header">
              <div>
                <span className="carga-modal-eyebrow">DETALLE DE CARGA</span>
                <h2>
                  {usuarioSeleccionado.nombre} {usuarioSeleccionado.apellido}
                </h2>
                <p>
                  Planificación correspondiente al{" "}
                  {formatearFecha(fechaSeleccionada)}
                </p>
              </div>
              <button
                type="button"
                className="carga-modal-cerrar"
                onClick={() => setUsuarioSeleccionadoId(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="carga-modal-resumen">
              <div>
                <span>Actividades</span>
                <strong>{usuarioSeleccionado.tareas.length}</strong>
              </div>
              <div>
                <span>Carga</span>
                <strong>{formatearHoras(minutosDetalle)}</strong>
              </div>
              <div>
                <span>Capacidad</span>
                <strong>8 h</strong>
              </div>
              <div>
                <span>Utilización</span>
                <strong>{Math.round(porcentajeDetalle)}%</strong>
              </div>
            </div>
            <div className="carga-modal-resumen">
              <div>
                <span>Trabajado hoy</span>
                <strong>
                  {formatearHoras(usuarioSeleccionado.minutosReales)}
                </strong>
              </div>
              <div>
                <span>Sin planificar</span>
                <strong>
                  {formatearHoras(usuarioSeleccionado.minutosDisponibles)}
                </strong>
              </div>
              <div>
                <span>Interrupciones</span>
                <strong>{usuarioSeleccionado.pausasTotales}</strong>
              </div>
              <div>
                <span>Ocupación sin cruces</span>
                <strong>
                  {formatearHoras(usuarioSeleccionado.ocupacion.ocupado)}
                </strong>
              </div>
            </div>
            {usuarioSeleccionado.ocupacion.cruces.length > 0 && (
              <div className="carga-modal-pausas">
                <div>
                  <span>CRUCES REALES DE EJECUCIÓN</span>
                  <strong>
                    {formatearHoras(
                      usuarioSeleccionado.ocupacion.minutosCruzados,
                    )}
                  </strong>
                </div>
                <p>
                  {usuarioSeleccionado.ocupacion.cruces.map((cruce, i) => (
                    <span key={i} style={{ display: "block" }}>
                      {horaEcuador(cruce.desde)}–{horaEcuador(cruce.hasta)}:{" "}
                      {cruce.tareas.join(" / ")}
                    </span>
                  ))}
                </p>
              </div>
            )}
            {usuarioSeleccionado.ocupacion.sinHorario > 0 && (
              <div className="carga-modal-pausas">
                <div>
                  <span>CARGA SIN HORARIO EXACTO</span>
                  <strong>
                    {formatearHoras(usuarioSeleccionado.ocupacion.sinHorario)}
                  </strong>
                </div>
                <p>
                  La carga asignada no tiene un horario planificado. Los cruces
                  reales se calculan exclusivamente desde las sesiones.
                </p>
              </div>
            )}
            {usuarioSeleccionado.historicoSinSesiones > 0 && (
              <div className="carga-modal-pausas">
                <div>
                  <span>TIEMPO HISTÓRICO SIN SESIONES</span>
                  <strong>
                    {formatearHoras(usuarioSeleccionado.historicoSinSesiones)}
                  </strong>
                </div>
                <p>
                  Acumulado antiguo de tareas asignadas a esta fecha. No se suma
                  al trabajo diario porque no se conoce el día real de
                  ejecución.
                </p>
              </div>
            )}
            {usuarioSeleccionado.tareaActual && (
              <div className="carga-modal-actual">
                <div>
                  <span>ACTIVIDAD ACTUAL</span>
                  <strong>En proceso</strong>
                </div>
                <p>{usuarioSeleccionado.tareaActual.titulo}</p>
                {usuarioSeleccionado.tareaActual.inicio_real && (
                  <small>
                    Iniciada a las{" "}
                    {new Date(
                      usuarioSeleccionado.tareaActual.inicio_real,
                    ).toLocaleTimeString("es-EC", {
                      timeZone: ZONA,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                )}
              </div>
            )}
            <div className="carga-modal-pausas">
              <div>
                <span>DESGLOSE DE INTERRUPCIONES</span>
                <strong>{usuarioSeleccionado.pausasTotales} en total</strong>
              </div>
              <p>Motivos registrados en Supabase para la fecha seleccionada.</p>
              <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                {[
                  {
                    etiqueta: "Cambios y urgencias",
                    cantidad: usuarioSeleccionado.desgloseInterrupciones.cambio,
                  },
                  {
                    etiqueta: "Otras pausas",
                    cantidad: usuarioSeleccionado.desgloseInterrupciones.otras,
                  },
                  {
                    etiqueta: "Almuerzo",
                    cantidad:
                      usuarioSeleccionado.desgloseInterrupciones.almuerzo,
                  },
                ].map(({ etiqueta, cantidad }) => (
                  <div
                    key={etiqueta}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ flex: "0 0 115px", fontSize: "13px" }}>
                      {etiqueta}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "9px",
                        borderRadius: "99px",
                        background: "#e2e8f0",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${usuarioSeleccionado.pausasTotales ? (cantidad / usuarioSeleccionado.pausasTotales) * 100 : 0}%`,
                          height: "100%",
                          background: "#2563eb",
                          borderRadius: "99px",
                        }}
                      />
                    </div>
                    <strong style={{ minWidth: "20px", textAlign: "right" }}>
                      {cantidad}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="carga-modal-seccion">
              <div className="carga-modal-seccion-header">
                <h3>Actividades asignadas</h3>
                <span>{usuarioSeleccionado.tareas.length}</span>
              </div>
              {usuarioSeleccionado.tareas.length === 0 ? (
                <div className="carga-modal-vacio">
                  No tiene actividades planificadas para esta fecha.
                </div>
              ) : (
                <div className="carga-modal-tareas">
                  {usuarioSeleccionado.tareas.map((tarea) => (
                    <div className="carga-modal-tarea" key={tarea.id}>
                      <div>
                        <strong>{tarea.titulo}</strong>
                        <span>{formatearRangoTarea(tarea)}</span>
                        <small>
                          {
                            resumenEjecucionTarea(
                              tarea,
                              sesiones,
                              fechaSeleccionada,
                              ahoraMs,
                            ).texto
                          }
                        </small>
                      </div>
                      <div className="carga-modal-tarea-derecha">
                        <strong>
                          {formatearDuracion(
                            minutosPlanificados(tarea, fechaSeleccionada),
                          )}
                        </strong>
                        <span
                          className={`planificacion-estado estado-${tarea.estado}`}
                        >
                          {textoEstado(tarea)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="carga-modal-footer">
              <button
                type="button"
                className="carga-modal-boton"
                onClick={() => setUsuarioSeleccionadoId(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CargaEquipo;
