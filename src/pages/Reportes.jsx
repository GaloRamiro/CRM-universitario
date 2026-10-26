import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import jsPDF from "jspdf";

import autoTable from "jspdf-autotable";

import "./Reportes.css";

// Paginación estable: evita el límite habitual de 1.000 registros de Supabase.
async function consultarTodas(tabla, columnas) {
  const tamano = 500;
  const resultado = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order("id", { ascending: true })
      .range(desde, desde + tamano - 1);
    if (error) throw error;
    resultado.push(...(data || []));
    if (!data || data.length < tamano) break;
  }
  return resultado;
}

const TZ_REPORTE = "America/Guayaquil";
const fechaLocalISO = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_REPORTE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
};

function Reportes() {
  const [tareas, setTareas] = useState([]);

  const [departamentos, setDepartamentos] = useState([]);

  const [usuarios, setUsuarios] = useState([]);

  const [departamentoSeleccionado, setDepartamentoSeleccionado] =
    useState("todos");

  const [interrupciones, setInterrupciones] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [ahora, setAhora] = useState(Date.now());

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [generandoPDF, setGenerandoPDF] = useState(false);

  const [periodo, setPeriodo] = useState("todo");

  // NUEVO: filtro manual por fechas

  const [fechaDesde, setFechaDesde] = useState("");

  const [fechaHasta, setFechaHasta] = useState("");

  // =========================================================

  // CARGAR DATOS

  // =========================================================

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);

    setError("");

    try {
      const [
        datosTareas,
        datosDepartamentos,
        datosUsuarios,
        datosInterrupciones,
        datosSesiones,
      ] = await Promise.all([
        consultarTodas(
          "tareas",
          "id,titulo,descripcion,fecha,fecha_inicio,fecha_fin,hora_inicio,hora_fin,prioridad,estado,responsable_id,departamento_id,tiempo_estimado,inicio_real,fin_real,tiempo_trabajado_min,estado_ejecucion",
        ),
        consultarTodas("departamentos", "id,nombre"),
        consultarTodas("usuarios", "id,nombre,apellido,email,activo"),
        consultarTodas(
          "historial_interrupciones",
          "id,tarea_id,empleado_id,departamento_id,tarea_interrumpidora_id,motivo,fecha,hora,created_at",
        ),
        consultarTodas(
          "tarea_sesiones",
          "id,tarea_id,usuario_id,inicio,fin,duracion_minutos,tipo_cierre",
        ),
      ]);
      setTareas(datosTareas);
      setDepartamentos(
        datosDepartamentos.sort((a, b) =>
          (a.nombre || "").localeCompare(b.nombre || ""),
        ),
      );
      setUsuarios(datosUsuarios);
      setInterrupciones(datosInterrupciones);
      setSesiones(datosSesiones);
      setAhora(Date.now());
    } catch (err) {
      console.error("Error cargando reportes:", err);

      setError(err.message || "No se pudieron cargar los datos de reportes.");
    } finally {
      setCargando(false);
    }
  };

  // =========================================================

  // UTILIDADES

  // =========================================================

  const obtenerFecha = (valor) => {
    if (!valor) return null;

    const partes = String(valor).split("-");

    if (partes.length !== 3) {
      const fecha = new Date(valor);

      if (Number.isNaN(fecha.getTime())) {
        return null;
      }

      return fecha;
    }

    return new Date(
      Number(partes[0]),

      Number(partes[1]) - 1,

      Number(partes[2]),
    );
  };

  const formatearFecha = (valor) => {
    const fecha = obtenerFecha(valor);

    if (!fecha) {
      return "Sin fecha";
    }

    return fecha.toLocaleDateString("es-EC", {
      day: "2-digit",

      month: "2-digit",

      year: "numeric",
    });
  };

  const formatearFechaLarga = (valor) => {
    const fecha = obtenerFecha(valor);

    if (!fecha) {
      return "Sin fecha";
    }

    return fecha.toLocaleDateString("es-EC", {
      day: "2-digit",

      month: "long",

      year: "numeric",
    });
  };

  const formatearDuracion = (minutos) => {
    const valor = Math.max(0, Number(minutos) || 0);

    const horas = Math.floor(valor / 60);

    const minutosRestantes = Math.round(valor % 60);

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    return `${horas} h ${String(minutosRestantes).padStart(2, "0")} min`;
  };

  const obtenerNombreUsuario = (id) => {
    const usuario = usuarios.find((item) => String(item.id) === String(id));

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();
  };

  const obtenerNombreDepartamento = (id) => {
    const departamento = departamentos.find(
      (item) => String(item.id) === String(id),
    );

    return departamento?.nombre || "Sin departamento";
  };

  // =========================================================

  // RANGO DE FECHAS DEL PERÍODO

  // =========================================================

  const obtenerRangoPeriodo = () => {
    if (fechaDesde || fechaHasta) {
      return {
        inicio: fechaDesde ? obtenerFecha(fechaDesde) : null,

        fin: fechaHasta ? obtenerFecha(fechaHasta) : null,
      };
    }

    if (periodo === "todo") {
      return {
        inicio: null,

        fin: null,
      };
    }

    const hoy = new Date();

    hoy.setHours(23, 59, 59, 999);

    const inicio = new Date(hoy);

    if (periodo === "mes") {
      inicio.setDate(1);

      inicio.setHours(0, 0, 0, 0);
    }

    if (periodo === "trimestre") {
      inicio.setMonth(hoy.getMonth() - 2);

      inicio.setDate(1);

      inicio.setHours(0, 0, 0, 0);
    }

    if (periodo === "semestre") {
      inicio.setMonth(hoy.getMonth() - 5);

      inicio.setDate(1);

      inicio.setHours(0, 0, 0, 0);
    }

    if (periodo === "año") {
      inicio.setMonth(0);

      inicio.setDate(1);

      inicio.setHours(0, 0, 0, 0);
    }

    return {
      inicio,

      fin: hoy,
    };
  };

  // =========================================================

  // FILTRO DE TAREAS

  // =========================================================

  const tareasFiltradas = useMemo(() => {
    const { inicio, fin } = obtenerRangoPeriodo();

    if (!inicio && !fin) {
      return tareas;
    }

    return tareas.filter((tarea) => {
      const fecha = obtenerFecha(tarea.fecha_inicio || tarea.fecha);

      if (!fecha) {
        return false;
      }

      if (inicio && fecha < inicio) {
        return false;
      }

      if (fin && fecha > fin) {
        return false;
      }

      return true;
    });
  }, [tareas, periodo, fechaDesde, fechaHasta]);

  // =========================================================

  // FILTRO DE INTERRUPCIONES

  // =========================================================

  const interrupcionesFiltradas = useMemo(() => {
    const { inicio, fin } = obtenerRangoPeriodo();

    if (!inicio && !fin) {
      return interrupciones;
    }

    return interrupciones.filter((item) => {
      const fecha = obtenerFecha(item.fecha || item.created_at);

      if (!fecha) {
        return false;
      }

      if (inicio && fecha < inicio) {
        return false;
      }

      if (fin && fecha > fin) {
        return false;
      }

      return true;
    });
  }, [interrupciones, periodo, fechaDesde, fechaHasta]);

  // =========================================================

  // TRAZABILIDAD OPERATIVA

  //

  // La trazabilidad muestra únicamente interrupciones causadas

  // por una nueva tarea: cambio de tarea o tarea urgente.

  // Almuerzo, otros motivos y cierre de jornada no representan

  // una interrupción entre departamentos y por eso no aparecen aquí.

  // =========================================================

  const interrupcionesOperativas = useMemo(() => {
    return interrupcionesFiltradas.filter(
      (interrupcion) =>
        interrupcion.motivo === "cambio_tarea" ||
        interrupcion.motivo === "tarea_urgente" ||
        (interrupcion.motivo === "otra_tarea" &&
          Boolean(interrupcion.tarea_interrumpidora_id)),
    );
  }, [interrupcionesFiltradas]);

  // =========================================================

  // DEPARTAMENTO DE LA TAREA AFECTADA

  // =========================================================

  const obtenerDepartamentoInterrupcion = (interrupcion) => {
    if (!interrupcion) {
      return null;
    }

    // El departamento mostrado en los reportes debe corresponder

    // a la tarea que fue afectada/interrumpida.

    // tarea_id identifica la tarea que estaba ejecutándose.

    if (interrupcion.tarea_id) {
      const tareaAfectada = tareas.find(
        (item) => String(item.id) === String(interrupcion.tarea_id),
      );

      if (tareaAfectada?.departamento_id) {
        return tareaAfectada.departamento_id;
      }
    }

    // Compatibilidad con registros históricos donde el departamento

    // sí quedó almacenado directamente en historial_interrupciones.

    return interrupcion.departamento_id || null;
  };

  // =========================================================

  // DEPARTAMENTO QUE GENERÓ LA INTERRUPCIÓN

  // =========================================================

  const obtenerDepartamentoGeneradorInterrupcion = (interrupcion) => {
    if (!interrupcion) {
      return null;
    }

    // En trazabilidad solo se consideran interrupciones operativas:

    // cambio de tarea y tarea urgente.

    // Para estos eventos, departamento_id representa el departamento

    // de la nueva tarea que provocó la interrupción.

    if (
      interrupcion.motivo === "cambio_tarea" ||
      interrupcion.motivo === "tarea_urgente"
    ) {
      if (interrupcion.tarea_interrumpidora_id) {
        const tareaInterrumpidora = tareas.find(
          (item) =>
            String(item.id) === String(interrupcion.tarea_interrumpidora_id),
        );

        if (tareaInterrumpidora?.departamento_id) {
          return tareaInterrumpidora.departamento_id;
        }
      }

      return interrupcion.departamento_id || null;
    }

    return null;
  };

  // =========================================================

  // TAREA QUE GENERÓ LA INTERRUPCIÓN

  // =========================================================

  const obtenerTareaGeneradoraInterrupcion = (interrupcion) => {
    if (!interrupcion?.tarea_interrumpidora_id) {
      return null;
    }

    return (
      tareas.find(
        (item) =>
          String(item.id) === String(interrupcion.tarea_interrumpidora_id),
      ) || null
    );
  };

  // =========================================================

  // MÉTRICAS GENERALES

  // =========================================================

  const metricas = useMemo(() => {
    const total = tareasFiltradas.length;

    const completadas = tareasFiltradas.filter(
      (tarea) => tarea.estado === "completada",
    ).length;

    const enProceso = tareasFiltradas.filter(
      (tarea) => tarea.estado === "en_proceso",
    ).length;

    const pendientes = tareasFiltradas.filter(
      (tarea) => tarea.estado !== "completada" && tarea.estado !== "en_proceso",
    ).length;

    const minutosTrabajados = tareasFiltradas.reduce(
      (totalMinutos, tarea) =>
        totalMinutos + (Number(tarea.tiempo_trabajado_min) || 0),

      0,
    );

    const tiempoEstimado = tareasFiltradas.reduce(
      (totalMinutos, tarea) =>
        totalMinutos + (Number(tarea.tiempo_estimado) || 0),

      0,
    );

    const porcentajeCompletado =
      total > 0 ? Math.round((completadas / total) * 100) : 0;

    return {
      total,

      completadas,

      enProceso,

      pendientes,

      minutosTrabajados,

      tiempoEstimado,

      porcentajeCompletado,

      interrupciones: interrupcionesFiltradas.length,
    };
  }, [tareasFiltradas, interrupcionesFiltradas]);

  // =========================================================

  // TAREAS POR DEPARTAMENTO SOLICITANTE

  // =========================================================

  // =========================================================
  // SESIONES REALES: tiempo por intervalo y fecha local de Ecuador.
  // No se suma al acumulado de tareas: son dos vistas del mismo trabajo.
  // =========================================================
  const analisisSesiones = useMemo(() => {
    const idsTareas = new Set(tareasFiltradas.map((t) => String(t.id)));
    const { inicio, fin } = obtenerRangoPeriodo();
    const desdeISO = inicio
      ? `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`
      : "";
    const hastaISO = fin
      ? `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`
      : "";
    const porEmpleado = new Map();
    const porDepartamento = new Map();
    const mapaTareas = new Map(tareas.map((t) => [String(t.id), t]));
    let minutos = 0;
    let cerradas = 0;
    let abiertas = 0;
    let registros = 0;
    let sesionesSinDuracion = 0;
    const dias = new Set();

    for (const sesion of sesiones) {
      if (!idsTareas.has(String(sesion.tarea_id))) continue;
      const tarea = mapaTareas.get(String(sesion.tarea_id));
      if (!tarea || !sesion.inicio) continue;
      const inicioMs = new Date(sesion.inicio).getTime();
      const finMs = sesion.fin ? new Date(sesion.fin).getTime() : ahora;
      if (
        !Number.isFinite(inicioMs) ||
        !Number.isFinite(finMs) ||
        finMs < inicioMs
      )
        continue;
      // Recorte exacto al período en horario Ecuador (UTC-5, sin horario de verano).
      const limiteInicio = desdeISO
        ? new Date(`${desdeISO}T00:00:00-05:00`).getTime()
        : -Infinity;
      const limiteFin = hastaISO
        ? new Date(`${hastaISO}T00:00:00-05:00`).getTime() + 86400000
        : Infinity;
      const a = Math.max(inicioMs, limiteInicio);
      const b = Math.min(finMs, limiteFin);
      if (b <= a) continue;
      const duracionIntervalo = Math.max(0, (finMs - inicioMs) / 60000);
      const duracionContabilizada =
        sesion.fin && sesion.duracion_minutos != null
          ? Math.max(0, Number(sesion.duracion_minutos) || 0)
          : duracionIntervalo;
      const minutosSesion =
        duracionIntervalo > 0
          ? duracionContabilizada * ((b - a) / (finMs - inicioMs))
          : 0;
      if (sesion.fin && sesion.duracion_minutos == null) sesionesSinDuracion++;
      registros++;
      if (sesion.fin) cerradas++;
      else abiertas++;
      minutos += minutosSesion;
      dias.add(fechaLocalISO(a));
      const empleadoId = String(
        sesion.usuario_id || tarea.responsable_id || "",
      );
      const departamentoId = String(tarea.departamento_id || "");
      porEmpleado.set(
        empleadoId,
        (porEmpleado.get(empleadoId) || 0) + minutosSesion,
      );
      porDepartamento.set(
        departamentoId,
        (porDepartamento.get(departamentoId) || 0) + minutosSesion,
      );
    }
    return {
      minutos: Math.round(minutos),
      cerradas,
      abiertas,
      registros,
      sesionesSinDuracion,
      dias: dias.size,
      porEmpleado,
      porDepartamento,
    };
  }, [
    sesiones,
    tareas,
    tareasFiltradas,
    periodo,
    fechaDesde,
    fechaHasta,
    ahora,
  ]);

  const tareasPorDepartamento = useMemo(() => {
    const mapa = {};

    tareasFiltradas.forEach((tarea) => {
      const nombre = obtenerNombreDepartamento(tarea.departamento_id);

      if (!mapa[nombre]) {
        mapa[nombre] = {
          nombre,

          total: 0,

          completadas: 0,

          pendientes: 0,

          enProceso: 0,

          minutos: 0,

          prioridadBaja: 0,

          prioridadMedia: 0,

          prioridadAlta: 0,
        };
      }

      mapa[nombre].total += 1;

      if (tarea.estado === "completada") {
        mapa[nombre].completadas += 1;
      } else if (tarea.estado === "en_proceso") {
        mapa[nombre].enProceso += 1;
      } else {
        mapa[nombre].pendientes += 1;
      }

      mapa[nombre].minutos += Number(tarea.tiempo_trabajado_min) || 0;

      if (tarea.prioridad === "baja") {
        mapa[nombre].prioridadBaja += 1;
      }

      if (tarea.prioridad === "media") {
        mapa[nombre].prioridadMedia += 1;
      }

      if (tarea.prioridad === "alta") {
        mapa[nombre].prioridadAlta += 1;
      }
    });

    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [tareasFiltradas, departamentos]);

  // =========================================================

  // INTERRUPCIONES POR DEPARTAMENTO AFECTADO

  // =========================================================

  const interrupcionesPorDepartamento = useMemo(() => {
    const mapa = {};

    interrupcionesOperativas.forEach((interrupcion) => {
      const id = obtenerDepartamentoInterrupcion(interrupcion);

      const nombre = obtenerNombreDepartamento(id);

      if (!mapa[id]) {
        mapa[id] = {
          id,

          nombre,

          interrupciones: 0,

          tareasAfectadas: new Set(),

          empleados: new Set(),
        };
      }

      mapa[id].interrupciones += 1;

      if (interrupcion.tarea_id) {
        mapa[id].tareasAfectadas.add(String(interrupcion.tarea_id));
      }

      if (interrupcion.empleado_id) {
        mapa[id].empleados.add(String(interrupcion.empleado_id));
      }
    });

    return Object.values(mapa)

      .map((item) => ({
        ...item,

        tareasAfectadas: item.tareasAfectadas.size,

        empleados: item.empleados.size,
      }))

      .sort((a, b) => b.interrupciones - a.interrupciones);
  }, [interrupcionesOperativas, departamentos, usuarios]);

  // =========================================================

  // INTERRUPCIONES POR EMPLEADO EJECUTOR

  // =========================================================

  // Ranking de departamentos que ORIGINAN interrupciones.
  // No se confunde con el departamento afectado.
  const interrupcionesPorDepartamentoGenerador = useMemo(() => {
    const mapa = new Map();
    interrupcionesOperativas.forEach((evento) => {
      const id = obtenerDepartamentoGeneradorInterrupcion(evento);
      const clave = id ? String(id) : "no_identificado";
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: clave,
          nombre: id ? obtenerNombreDepartamento(id) : "No identificado",
          interrupciones: 0,
          tareasSolicitadas: new Set(),
          empleadosInterrumpidos: new Set(),
        });
      }
      const fila = mapa.get(clave);
      fila.interrupciones += 1;
      if (evento.tarea_interrumpidora_id)
        fila.tareasSolicitadas.add(String(evento.tarea_interrumpidora_id));
      if (evento.empleado_id)
        fila.empleadosInterrumpidos.add(String(evento.empleado_id));
    });
    return [...mapa.values()]
      .map((fila) => ({
        ...fila,
        tareasSolicitadas: fila.tareasSolicitadas.size,
        empleadosInterrumpidos: fila.empleadosInterrumpidos.size,
      }))
      .sort((a, b) => b.interrupciones - a.interrupciones);
  }, [interrupcionesOperativas, tareas, departamentos]);

  const interrupcionesPorEmpleado = useMemo(() => {
    const mapa = {};

    interrupcionesOperativas.forEach((interrupcion) => {
      const id = interrupcion.empleado_id;

      const nombre = obtenerNombreUsuario(id);

      if (!mapa[id]) {
        mapa[id] = {
          id,

          nombre,

          interrupciones: 0,

          tareasAfectadas: new Set(),

          departamentos: new Set(),
        };
      }

      mapa[id].interrupciones += 1;

      if (interrupcion.tarea_id) {
        mapa[id].tareasAfectadas.add(String(interrupcion.tarea_id));
      }

      const departamentoInterrupcion =
        obtenerDepartamentoInterrupcion(interrupcion);

      if (departamentoInterrupcion) {
        mapa[id].departamentos.add(String(departamentoInterrupcion));
      }
    });

    return Object.values(mapa)

      .map((item) => ({
        ...item,

        tareasAfectadas: item.tareasAfectadas.size,

        departamentos: item.departamentos.size,
      }))

      .sort((a, b) => b.interrupciones - a.interrupciones);
  }, [interrupcionesOperativas, usuarios]);

  // =========================================================

  // TRABAJO POR DEPARTAMENTO

  // =========================================================

  const trabajoPorDepartamento = useMemo(() => {
    const mapaDepartamentos = {};

    tareasFiltradas.forEach((tarea) => {
      const departamentoId = tarea.departamento_id;

      const responsableId = tarea.responsable_id;

      if (!mapaDepartamentos[departamentoId]) {
        mapaDepartamentos[departamentoId] = {
          id: departamentoId,

          nombre: obtenerNombreDepartamento(departamentoId),

          empleados: {},

          tareas: 0,

          minutos: 0,
        };
      }

      const departamento = mapaDepartamentos[departamentoId];

      if (!departamento.empleados[responsableId]) {
        departamento.empleados[responsableId] = {
          id: responsableId,

          nombre: obtenerNombreUsuario(responsableId),

          tareas: [],

          minutos: 0,
        };
      }

      const empleado = departamento.empleados[responsableId];

      empleado.tareas.push(tarea);

      empleado.minutos += Number(tarea.tiempo_trabajado_min) || 0;

      departamento.tareas += 1;

      departamento.minutos += Number(tarea.tiempo_trabajado_min) || 0;
    });

    return Object.values(mapaDepartamentos)

      .map((departamento) => ({
        ...departamento,

        empleados: Object.values(departamento.empleados).sort(
          (a, b) => b.tareas.length - a.tareas.length,
        ),
      }))

      .sort((a, b) => b.tareas - a.tareas);
  }, [tareasFiltradas, departamentos, usuarios]);

  // =========================================================

  // CARGA DE TRABAJO POR EMPLEADO

  // =========================================================

  const cargaPorEmpleado = useMemo(() => {
    const mapa = {};

    tareasFiltradas.forEach((tarea) => {
      const id = tarea.responsable_id;

      const nombre = obtenerNombreUsuario(id);

      if (!mapa[id]) {
        mapa[id] = {
          id,

          nombre,

          tareas: 0,

          completadas: 0,

          pendientes: 0,

          minutos: 0,
        };
      }

      mapa[id].tareas += 1;

      if (tarea.estado === "completada") {
        mapa[id].completadas += 1;
      } else {
        mapa[id].pendientes += 1;
      }

      mapa[id].minutos += Number(tarea.tiempo_trabajado_min) || 0;
    });

    return Object.values(mapa).sort((a, b) => b.tareas - a.tareas);
  }, [tareasFiltradas, usuarios]);

  // =========================================================

  // TAREAS PRIORITARIAS

  // =========================================================

  const tareasPrioritarias = useMemo(() => {
    return tareasFiltradas

      .filter((tarea) => tarea.prioridad === "alta")

      .sort((a, b) => {
        const estadoA = a.estado === "completada" ? 0 : 1;

        const estadoB = b.estado === "completada" ? 0 : 1;

        return estadoB - estadoA;
      })

      .slice(0, 10);
  }, [tareasFiltradas]);

  // =========================================================

  // DETALLE DE INTERRUPCIONES

  // =========================================================

  const detalleInterrupciones = useMemo(() => {
    return interrupcionesOperativas

      .map((interrupcion) => {
        const tarea = tareas.find(
          (item) => String(item.id) === String(interrupcion.tarea_id),
        );

        return {
          ...interrupcion,

          tarea,

          empleado: obtenerNombreUsuario(interrupcion.empleado_id),

          departamento: obtenerNombreDepartamento(
            obtenerDepartamentoInterrupcion(interrupcion),
          ),

          departamentoGenerador: obtenerNombreDepartamento(
            obtenerDepartamentoGeneradorInterrupcion(interrupcion),
          ),

          tareaGeneradora: obtenerTareaGeneradoraInterrupcion(interrupcion),
        };
      })

      .sort((a, b) => {
        const fechaA = obtenerFecha(a.fecha || a.created_at);

        const fechaB = obtenerFecha(b.fecha || b.created_at);

        if (!fechaA || !fechaB) {
          return 0;
        }

        return fechaB - fechaA;
      });
  }, [interrupcionesOperativas, tareas, usuarios, departamentos]);

  // =========================================================

  // PERÍODO HUMANO

  // =========================================================

  const obtenerPeriodoTexto = () => {
    if (fechaDesde || fechaHasta) {
      if (fechaDesde && fechaHasta) {
        return `Del ${formatearFecha(fechaDesde)} al ${formatearFecha(
          fechaHasta,
        )}`;
      }

      if (fechaDesde) {
        return `Desde ${formatearFecha(fechaDesde)}`;
      }

      return `Hasta ${formatearFecha(fechaHasta)}`;
    }

    if (periodo === "mes") {
      return "Mes actual";
    }

    if (periodo === "trimestre") {
      return "Últimos 3 meses";
    }

    if (periodo === "semestre") {
      return "Últimos 6 meses";
    }

    if (periodo === "año") {
      return "Año actual";
    }

    return "Todo el historial disponible";
  };

  // =========================================================

  // LIMPIAR FILTROS

  // =========================================================

  const limpiarFiltros = () => {
    setPeriodo("todo");

    setFechaDesde("");

    setFechaHasta("");
  };

  // =========================================================

  // PDF EJECUTIVO

  // =========================================================

  const generarPDF = () => {
    setGenerandoPDF(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",

        unit: "mm",

        format: "a4",
      });

      const anchoPagina = doc.internal.pageSize.getWidth();

      const altoPagina = doc.internal.pageSize.getHeight();

      const fechaGeneracion = new Date().toLocaleString("es-EC");

      let pagina = 1;

      // -------------------------------------------------------

      // ENCABEZADO

      // -------------------------------------------------------

      doc.setFont("helvetica", "bold");

      doc.setFontSize(20);

      doc.text("INFORME EJECUTIVO DE GESTIÓN", 20, 24);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(10);

      doc.text("Análisis de tareas, carga operativa e interrupciones", 20, 31);

      doc.setFontSize(9);

      doc.text(`Período: ${obtenerPeriodoTexto()}`, 20, 39);

      doc.text(`Generado: ${fechaGeneracion}`, 20, 45);

      doc.setLineWidth(0.5);

      doc.line(20, 50, anchoPagina - 20, 50);

      // -------------------------------------------------------

      // RESUMEN EJECUTIVO

      // -------------------------------------------------------

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("1. Resumen ejecutivo", 20, 61);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(10);

      let resumen =
        `Durante el período analizado se registraron ` +
        `${metricas.total} tareas. ` +
        `De este total, ${metricas.completadas} ` +
        `fueron completadas, lo que representa ` +
        `un cumplimiento del ${metricas.porcentajeCompletado}%. `;

      resumen +=
        `El tiempo de trabajo registrado asciende a ` +
        `${formatearDuracion(metricas.minutosTrabajados)}. `;

      resumen +=
        `Se identificaron ${metricas.interrupciones} ` +
        `interrupciones registradas durante la ejecución ` +
        `de las actividades. `;

      if (interrupcionesPorDepartamento.length > 0) {
        resumen +=
          `El departamento más afectado por interrupciones fue ` +
          `${interrupcionesPorDepartamento[0].nombre}, ` +
          `con ${interrupcionesPorDepartamento[0].interrupciones} registros.`;
      }

      const resumenLineas = doc.splitTextToSize(resumen, anchoPagina - 40);

      doc.text(resumenLineas, 20, 70);

      // -------------------------------------------------------

      // INDICADORES

      // -------------------------------------------------------

      const yIndicadores = 70 + resumenLineas.length * 5 + 10;

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("2. Indicadores generales", 20, yIndicadores);

      autoTable(doc, {
        startY: yIndicadores + 6,

        head: [["Indicador", "Resultado"]],

        body: [
          ["Total de tareas", metricas.total],

          ["Tareas completadas", metricas.completadas],

          ["Tareas en proceso", metricas.enProceso],

          ["Tareas pendientes", metricas.pendientes],

          ["Cumplimiento", `${metricas.porcentajeCompletado}%`],

          ["Tiempo trabajado", formatearDuracion(metricas.minutosTrabajados)],

          ["Tiempo estimado", formatearDuracion(metricas.tiempoEstimado)],

          ["Interrupciones", metricas.interrupciones],
        ],

        styles: {
          fontSize: 9,

          cellPadding: 3,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------

      // DEPARTAMENTOS

      // -------------------------------------------------------

      doc.addPage();

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("3. Tareas por departamento solicitante", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "Este análisis identifica qué departamentos concentran la demanda de trabajo.",

        20,

        27,
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Departamento",

            "Tareas",

            "Completadas",

            "Pendientes",

            "En proceso",

            "Prioridad baja",

            "Prioridad media",

            "Prioridad alta",

            "Tiempo",
          ],
        ],

        body: tareasPorDepartamento.map((item) => [
          item.nombre,

          item.total,

          item.completadas,

          item.pendientes,

          item.enProceso,

          item.prioridadBaja,

          item.prioridadMedia,

          item.prioridadAlta,

          formatearDuracion(item.minutos),
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------

      // INTERRUPCIONES POR DEPARTAMENTO

      // -------------------------------------------------------

      doc.addPage();

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("4. Interrupciones por departamento afectado", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "El análisis identifica qué departamentos fueron afectados por interrupciones durante la ejecución de las actividades.",

        20,

        27,
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Departamento",

            "Interrupciones",

            "Tareas afectadas",

            "Empleados afectados",
          ],
        ],

        body: interrupcionesPorDepartamento.map((item) => [
          item.nombre,

          item.interrupciones,

          item.tareasAfectadas,

          item.empleados,
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------
      // RANKING DE DEPARTAMENTOS QUE GENERAN INTERRUPCIONES
      // -------------------------------------------------------
      doc.addPage("a4", "portrait");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Ranking: departamentos que generan interrupciones", 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "Distingue el origen de la solicitud del departamento afectado.",
        20,
        27,
      );
      autoTable(doc, {
        startY: 34,
        head: [
          [
            "Departamento de origen",
            "Interrupciones",
            "Tareas nuevas",
            "Empleados afectados",
          ],
        ],
        body: interrupcionesPorDepartamentoGenerador.map((item) => [
          item.nombre,
          item.interrupciones,
          item.tareasSolicitadas,
          item.empleadosInterrumpidos,
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fontStyle: "bold" },
      });

      // -------------------------------------------------------

      // INTERRUPCIONES POR EMPLEADO

      // -------------------------------------------------------

      doc.addPage();

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("5. Empleados afectados por interrupciones", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "Los empleados representan a las personas ejecutoras de las actividades y se mide cuántas interrupciones afectaron su trabajo.",

        20,

        27,
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Empleado ejecutor",

            "Interrupciones",

            "Tareas afectadas",

            "Departamentos",
          ],
        ],

        body: interrupcionesPorEmpleado.map((item) => [
          item.nombre,

          item.interrupciones,

          item.tareasAfectadas,

          item.departamentos,
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------

      // DETALLE DE INTERRUPCIONES

      // -------------------------------------------------------

      // Esta sección usa A4 horizontal porque contiene 8 columnas.

      // Así evitamos que el texto se comprima verticalmente en el PDF.

      doc.addPage("a4", "landscape");

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("6. Trazabilidad de interrupciones operativas", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "Se detallan únicamente cambios de tarea y solicitudes urgentes: origen de la nueva tarea, departamento afectado, empleado y tarea interrumpida.",

        20,

        27,
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Fecha",

            "Hora",

            "Departamento de origen",

            "Tarea que generó",

            "Departamento afectado",

            "Empleado",

            "Tarea afectada",

            "Motivo",
          ],
        ],

        body: detalleInterrupciones.map((item) => [
          formatearFecha(item.fecha || item.created_at),

          item.hora || "Sin hora",

          item.departamentoGenerador || "No identificado",

          item.tareaGeneradora?.titulo || "Tarea generadora no registrada",

          item.departamento,

          item.empleado,

          item.tarea?.titulo || "Tarea afectada no identificada",

          item.motivo || "Sin motivo registrado",
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.2,

          overflow: "linebreak",

          valign: "middle",
        },

        headStyles: {
          fontStyle: "bold",

          valign: "middle",
        },

        bodyStyles: {
          valign: "middle",
        },

        columnStyles: {
          // A4 horizontal: 297 mm de ancho.

          // Márgenes de 20 mm => 257 mm disponibles.

          // Las columnas suman exactamente 257 mm.

          0: {
            cellWidth: 18,
          },

          1: {
            cellWidth: 14,
          },

          2: {
            cellWidth: 32,
          },

          3: {
            cellWidth: 48,
          },

          4: {
            cellWidth: 32,
          },

          5: {
            cellWidth: 30,
          },

          6: {
            cellWidth: 55,
          },

          7: {
            cellWidth: 28,
          },
        },

        margin: {
          left: 20,

          right: 20,
        },

        tableWidth: "wrap",

        didParseCell: (data) => {
          if (data.section === "body") {
            data.cell.styles.minCellHeight = 10;
          }
        },
      });

      // -------------------------------------------------------

      // CARGA POR EMPLEADO

      // -------------------------------------------------------

      // Regresamos a A4 vertical para el resto del informe.

      doc.addPage("a4", "portrait");

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("7. Carga operativa por empleado", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "Los empleados representan a las personas ejecutoras de las actividades.",

        20,

        27,
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Empleado",

            "Tareas",

            "Completadas",

            "Pendientes",

            "Tiempo trabajado",
          ],
        ],

        body: cargaPorEmpleado.map((item) => [
          item.nombre,

          item.tareas,

          item.completadas,

          item.pendientes,

          formatearDuracion(item.minutos),
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------

      // TRABAJO POR DEPARTAMENTO

      // -------------------------------------------------------

      doc.addPage("a4", "portrait");

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("8. Trabajo por departamento", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      doc.text(
        "Detalle de las personas que trabajaron, las tareas realizadas y el tiempo empleado.",

        20,

        27,
      );

      let posicionYDepartamento = 34;

      trabajoPorDepartamento.forEach((departamento) => {
        // -------------------------------------------------------

        // ENCABEZADO DEL DEPARTAMENTO

        // -------------------------------------------------------

        if (posicionYDepartamento > 250) {
          doc.addPage("a4", "portrait");

          posicionYDepartamento = 20;
        }

        doc.setFont("helvetica", "bold");

        doc.setFontSize(12);

        doc.text(
          departamento.nombre,

          20,

          posicionYDepartamento,
        );

        doc.setFont("helvetica", "normal");

        doc.setFontSize(8);

        doc.text(
          `Total de tareas: ${departamento.tareas} | Tiempo total: ${formatearDuracion(departamento.minutos)}`,

          20,

          posicionYDepartamento + 6,
        );

        posicionYDepartamento += 12;

        // -------------------------------------------------------

        // PERSONAS DEL DEPARTAMENTO

        // -------------------------------------------------------

        departamento.empleados.forEach((empleado) => {
          if (posicionYDepartamento > 245) {
            doc.addPage("a4", "portrait");

            posicionYDepartamento = 20;
          }

          doc.setFont("helvetica", "bold");

          doc.setFontSize(9);

          doc.text(
            empleado.nombre,

            20,

            posicionYDepartamento,
          );

          doc.setFont("helvetica", "normal");

          doc.setFontSize(8);

          doc.text(
            `${empleado.tareas.length} tareas | Tiempo trabajado: ${formatearDuracion(empleado.minutos)}`,

            20,

            posicionYDepartamento + 5,
          );

          autoTable(doc, {
            startY: posicionYDepartamento + 9,

            head: [["Tarea solicitada", "Estado", "Tiempo trabajado"]],

            body: empleado.tareas.map((tarea) => [
              tarea.titulo,

              tarea.estado === "completada"
                ? "Completada"
                : tarea.estado === "en_proceso"
                  ? "En proceso"
                  : "Pendiente",

              formatearDuracion(tarea.tiempo_trabajado_min),
            ]),

            styles: {
              fontSize: 8,

              cellPadding: 2.5,
            },

            headStyles: {
              fontStyle: "bold",
            },

            columnStyles: {
              0: {
                cellWidth: 90,
              },

              1: {
                cellWidth: 55,
              },

              2: {
                cellWidth: 45,
              },
            },

            margin: {
              left: 20,

              right: 20,
            },
          });

          posicionYDepartamento = doc.lastAutoTable.finalY + 10;
        });

        // Separación entre departamentos

        posicionYDepartamento += 5;
      });

      // -------------------------------------------------------

      // ACTIVIDADES PRIORITARIAS

      // -------------------------------------------------------

      doc.addPage();

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("9. Actividades prioritarias", 20, 20);

      autoTable(doc, {
        startY: 28,

        head: [
          [
            "Actividad",

            "Departamento solicitante",

            "Ejecutor",

            "Estado",

            "Tiempo",
          ],
        ],

        body: tareasPrioritarias.map((tarea) => [
          tarea.titulo,

          obtenerNombreDepartamento(tarea.departamento_id),

          obtenerNombreUsuario(tarea.responsable_id),

          tarea.estado === "completada"
            ? "Completada"
            : tarea.estado === "en_proceso"
              ? "En proceso"
              : "Pendiente",

          formatearDuracion(tarea.tiempo_trabajado_min),
        ]),

        styles: {
          fontSize: 8,

          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------

      // CONCLUSIONES

      // -------------------------------------------------------

      doc.addPage();

      doc.setFont("helvetica", "bold");

      doc.setFontSize(14);

      doc.text("11. Conclusiones ejecutivas", 20, 20);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(10);

      const departamentoMayor = tareasPorDepartamento[0];

      const departamentoMayorInterrupciones = interrupcionesPorDepartamento[0];

      const departamentoMayorGenerador =
        interrupcionesPorDepartamentoGenerador[0];

      const empleadoMayorInterrupciones = interrupcionesPorEmpleado[0];

      const conclusiones = [
        `La organización registró ${metricas.total} tareas durante el período analizado.`,

        `El nivel de cumplimiento registrado fue del ${metricas.porcentajeCompletado}%.`,

        departamentoMayor
          ? `El departamento con mayor demanda fue ${departamentoMayor.nombre}, con ${departamentoMayor.total} tareas.`
          : "No existe información suficiente para determinar el departamento con mayor demanda.",

        departamentoMayorInterrupciones
          ? `El departamento más afectado por interrupciones fue ${departamentoMayorInterrupciones.nombre}, con ${departamentoMayorInterrupciones.interrupciones} registros.`
          : "No existen interrupciones registradas suficientes para identificar un departamento con mayor nivel de interrupción.",

        departamentoMayorGenerador
          ? `El departamento que generó más interrupciones fue ${departamentoMayorGenerador.nombre}, con ${departamentoMayorGenerador.interrupciones} eventos.`
          : "No se identificaron departamentos generadores de interrupciones en el período.",

        empleadoMayorInterrupciones
          ? `${empleadoMayorInterrupciones.nombre} fue el empleado ejecutor más afectado por interrupciones, con ${empleadoMayorInterrupciones.interrupciones} registros.`
          : "No existen interrupciones registradas suficientes para identificar un empleado ejecutor con mayor nivel de interrupción.",

        `El tiempo total registrado de trabajo fue de ${formatearDuracion(
          metricas.minutosTrabajados,
        )}.`,
      ];

      let y = 32;

      conclusiones.forEach((conclusion, index) => {
        const lineas = doc.splitTextToSize(
          `${index + 1}. ${conclusion}`,

          anchoPagina - 45,
        );

        doc.text(lineas, 23, y);

        y += lineas.length * 5 + 5;
      });

      // -------------------------------------------------------

      // FUENTE DE DATOS

      // -------------------------------------------------------

      y += 5;

      doc.setFont("helvetica", "bold");

      doc.setFontSize(12);

      doc.text("Fuente de información", 20, y);

      doc.setFont("helvetica", "normal");

      doc.setFontSize(9);

      y += 7;

      const fuente =
        "Los datos de este informe provienen del sistema interno de gestión de tareas, principalmente de las tablas de tareas, usuarios, departamentos, tarea_sesiones e historial_interrupciones de Supabase. El informe se genera automáticamente a partir de los registros disponibles en el período seleccionado.";

      const fuenteLineas = doc.splitTextToSize(fuente, anchoPagina - 40);

      doc.text(fuenteLineas, 20, y);

      // -------------------------------------------------------

      // PIE DE PÁGINA

      // -------------------------------------------------------

      const totalPaginas = doc.internal.getNumberOfPages();

      for (pagina = 1; pagina <= totalPaginas; pagina++) {
        doc.setPage(pagina);

        // Cada página puede tener orientación diferente.

        const anchoPaginaActual = doc.internal.pageSize.getWidth();

        const altoPaginaActual = doc.internal.pageSize.getHeight();

        doc.setFont("helvetica", "normal");

        doc.setFontSize(8);

        doc.text(
          "Informe ejecutivo de gestión — Sistema interno de tareas",

          20,

          altoPaginaActual - 12,
        );

        doc.text(
          `Página ${pagina} de ${totalPaginas}`,

          anchoPaginaActual - 42,

          altoPaginaActual - 12,
        );
      }

      doc.save(
        `informe-ejecutivo-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error("Error generando PDF:", err);

      setError("No se pudo generar el informe PDF.");
    } finally {
      setGenerandoPDF(false);
    }
  };

  // =========================================================

  // CARGANDO

  // =========================================================

  if (cargando) {
    return (
      <section className="reportes-page">
        <div className="reportes-loading">
          <span className="reportes-loader" />

          <p>Analizando información de gestión...</p>
        </div>
      </section>
    );
  }

  // =========================================================

  // RENDER

  // =========================================================

  return (
    <section className="reportes-page">
      {/* ENCABEZADO */}

      <header className="reportes-header">
        <div>
          <span className="reportes-eyebrow">ANÁLISIS DE GESTIÓN</span>

          <h1>Reportes</h1>

          <p>
            Analiza la carga de trabajo, la demanda de los departamentos y las
            interrupciones durante la ejecución de actividades.
          </p>
        </div>

        <div className="reportes-header-actions">
          <button
            type="button"
            className="reportes-btn reportes-btn-secundario"
            onClick={cargarDatos}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="reportes-btn reportes-btn-principal"
            onClick={generarPDF}
            disabled={generandoPDF}
          >
            {generandoPDF ? "Generando informe..." : "Generar informe PDF"}
          </button>
        </div>
      </header>

      {/* FILTROS */}

      <div className="reportes-filtros">
        <div className="reportes-filtro-periodo">
          <div>
            <span>Período de análisis</span>

            <strong>{obtenerPeriodoTexto()}</strong>
          </div>

          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="todo">Todo el historial</option>

            <option value="mes">Mes actual</option>

            <option value="trimestre">Últimos 3 meses</option>

            <option value="semestre">Últimos 6 meses</option>

            <option value="año">Año actual</option>
          </select>
        </div>

        <div className="reportes-fechas">
          <label>
            <span>Fecha desde</span>

            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </label>

          <label>
            <span>Fecha hasta</span>

            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </label>

          {(fechaDesde || fechaHasta || periodo !== "todo") && (
            <button
              type="button"
              className="reportes-btn-limpiar"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ERROR */}

      {error && <div className="reportes-alerta">{error}</div>}

      {/* INDICADORES */}

      <div className="reportes-stats">
        <article className="reportes-stat">
          <span>Tareas registradas</span>

          <strong>{metricas.total}</strong>

          <small>Actividades del período</small>
        </article>

        <article className="reportes-stat">
          <span>Completadas</span>

          <strong>{metricas.completadas}</strong>

          <small>{metricas.porcentajeCompletado}% de cumplimiento</small>
        </article>

        <article className="reportes-stat">
          <span>Tiempo trabajado</span>

          <strong className="reportes-stat-tiempo">
            {formatearDuracion(metricas.minutosTrabajados)}
          </strong>

          <small>Tiempo registrado</small>
        </article>

        <article className="reportes-stat reportes-stat-interrupciones">
          <span>Interrupciones</span>

          <strong>{metricas.interrupciones}</strong>

          <small>Registros de interrupción</small>
        </article>
      </div>

      {/* SESIONES REALES */}
      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>TRAZABILIDAD TEMPORAL</span>
            <h2>Tiempo de ejecución por sesiones</h2>
            <p>
              Registros de inicio, pausa y finalización. Este tiempo no se suma
              al acumulado histórico de tareas para evitar duplicaciones.
            </p>
          </div>
        </div>
        <div className="reportes-estado-grid">
          <div className="reportes-estado-item">
            <span>Tiempo en sesiones</span>
            <strong>{formatearDuracion(analisisSesiones.minutos)}</strong>
          </div>
          <div className="reportes-estado-item">
            <span>Sesiones cerradas</span>
            <strong>{analisisSesiones.cerradas}</strong>
          </div>
          <div className="reportes-estado-item">
            <span>Sesiones abiertas</span>
            <strong>{analisisSesiones.abiertas}</strong>
          </div>
        </div>
        <p>
          Las sesiones anteriores a la instalación del registro automático
          pueden no estar disponibles. Las sesiones abiertas se actualizan
          aproximadamente cada minuto.
        </p>
        {analisisSesiones.sesionesSinDuracion > 0 && (
          <p>
            Atención: {analisisSesiones.sesionesSinDuracion} sesiones cerradas
            no tienen duración contabilizada; se estimó su tiempo por intervalo.
          </p>
        )}
      </section>

      {/* ESTADO GENERAL */}

      <div className="reportes-layout">
        <article className="reportes-panel">
          <div className="reportes-panel-header">
            <div>
              <span>ESTADO OPERATIVO</span>

              <h2>Situación de las tareas</h2>
            </div>
          </div>

          <div className="reportes-estado-grid">
            <div className="reportes-estado-item">
              <span>Completadas</span>

              <strong>{metricas.completadas}</strong>
            </div>

            <div className="reportes-estado-item">
              <span>En proceso</span>

              <strong>{metricas.enProceso}</strong>
            </div>

            <div className="reportes-estado-item">
              <span>Pendientes</span>

              <strong>{metricas.pendientes}</strong>
            </div>
          </div>
        </article>

        <article className="reportes-panel">
          <div className="reportes-panel-header">
            <div>
              <span>TIEMPO</span>

              <h2>Uso de jornada</h2>
            </div>
          </div>

          <div className="reportes-tiempo">
            <div>
              <span>Registrado</span>

              <strong>{formatearDuracion(metricas.minutosTrabajados)}</strong>
            </div>

            <div>
              <span>Estimado</span>

              <strong>{formatearDuracion(metricas.tiempoEstimado)}</strong>
            </div>
          </div>
        </article>
      </div>

      {/* DEPARTAMENTOS */}

      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>DEMANDA ORGANIZACIONAL</span>

            <h2>Tareas por departamento</h2>

            <p>
              Departamentos solicitantes y volumen de actividades generadas.
            </p>
          </div>
        </div>

        {tareasPorDepartamento.length === 0 ? (
          <div className="reportes-vacio">
            No existen tareas para el período seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Departamento</th>

                  <th>Tareas</th>

                  <th>Completadas</th>

                  <th>Pendientes</th>

                  <th>En proceso</th>

                  <th>Prioridad baja</th>

                  <th>Prioridad media</th>

                  <th>Prioridad alta</th>

                  <th>Tiempo</th>
                </tr>
              </thead>

              <tbody>
                {tareasPorDepartamento.map((item) => (
                  <tr key={item.nombre}>
                    <td>
                      <strong>{item.nombre}</strong>
                    </td>

                    <td>{item.total}</td>

                    <td>{item.completadas}</td>

                    <td>{item.pendientes}</td>

                    <td>{item.enProceso}</td>

                    <td>{item.prioridadBaja}</td>

                    <td>{item.prioridadMedia}</td>

                    <td>{item.prioridadAlta}</td>

                    <td>{formatearDuracion(item.minutos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* INTERRUPCIONES */}

      <div className="reportes-layout">
        <section className="reportes-panel">
          <div className="reportes-panel-header">
            <div>
              <span>INTERFERENCIAS</span>

              <h2>Interrupciones operativas por departamento</h2>

              <p>
                Impacto de cambios de tarea y solicitudes urgentes sobre los
                departamentos afectados.
              </p>
            </div>
          </div>

          {interrupcionesPorDepartamento.length === 0 ? (
            <div className="reportes-vacio">
              No existen interrupciones registradas en este período.
            </div>
          ) : (
            <div className="reportes-lista">
              {interrupcionesPorDepartamento.map((item) => (
                <div className="reportes-lista-item" key={item.id}>
                  <div>
                    <strong>{item.nombre}</strong>

                    <span>{item.tareasAfectadas} tareas afectadas</span>
                  </div>

                  <strong className="reportes-numero-alerta">
                    {item.interrupciones}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="reportes-panel">
          <div className="reportes-panel-header">
            <div>
              <span>IMPACTO OPERATIVO</span>

              <h2>Empleados afectados</h2>

              <p>
                Personas cuyo trabajo fue interrumpido por otra tarea o por una
                solicitud urgente.
              </p>
            </div>
          </div>

          {interrupcionesPorEmpleado.length === 0 ? (
            <div className="reportes-vacio">
              No existen interrupciones registradas.
            </div>
          ) : (
            <div className="reportes-lista">
              {interrupcionesPorEmpleado.slice(0, 8).map((item) => (
                <div className="reportes-lista-item" key={item.id}>
                  <div>
                    <strong>{item.nombre}</strong>

                    <span>{item.tareasAfectadas} tareas afectadas</span>
                  </div>

                  <strong className="reportes-numero-alerta">
                    {item.interrupciones}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* RANKING DE DEPARTAMENTOS QUE GENERAN INTERRUPCIONES */}
      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>ORIGEN DE SOLICITUDES</span>
            <h2>Departamentos que más interrumpen</h2>
            <p>
              Ranking de departamentos que solicitan nuevas tareas mientras
              otras actividades están en ejecución. Es diferente del ranking de
              departamentos afectados.
            </p>
          </div>
        </div>
        {interrupcionesPorDepartamentoGenerador.length === 0 ? (
          <div className="reportes-vacio">
            No existen interrupciones operativas en el período seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Departamento que interrumpe</th>
                  <th>Interrupciones</th>
                  <th>Tareas nuevas identificadas</th>
                  <th>Empleados interrumpidos</th>
                </tr>
              </thead>
              <tbody>
                {interrupcionesPorDepartamentoGenerador.map((item, indice) => (
                  <tr key={item.id}>
                    <td>{indice + 1}</td>
                    <td>
                      <strong>{item.nombre}</strong>
                    </td>
                    <td>{item.interrupciones}</td>
                    <td>{item.tareasSolicitadas}</td>
                    <td>{item.empleadosInterrumpidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DETALLE DE INTERRUPCIONES */}

      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>TRAZABILIDAD</span>

            <h2>Detalle de interrupciones</h2>

            <p>
              Esta trazabilidad registra únicamente cambios de tarea y tareas
              urgentes. Permite ver las dos partes del evento: qué tarea generó
              la interrupción y qué tarea estaba ejecutando la persona cuando
              tuvo que cambiar de actividad.
            </p>
          </div>
        </div>

        {detalleInterrupciones.length === 0 ? (
          <div className="reportes-vacio">
            No existen interrupciones operativas para mostrar en el período
            seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Fecha</th>

                  <th>Hora</th>

                  <th>Departamento de origen</th>

                  <th>Tarea que generó</th>

                  <th>Departamento afectado</th>

                  <th>Empleado ejecutor</th>

                  <th>Tarea afectada</th>

                  <th>Motivo</th>
                </tr>
              </thead>

              <tbody>
                {detalleInterrupciones.slice(0, 15).map((item) => (
                  <tr key={item.id}>
                    <td>{formatearFecha(item.fecha || item.created_at)}</td>

                    <td>{item.hora}</td>

                    <td>
                      <strong>
                        {item.departamentoGenerador || "No identificado"}
                      </strong>
                    </td>

                    <td>
                      {item.tareaGeneradora?.titulo ||
                        "Tarea generadora no registrada"}
                    </td>

                    <td>{item.departamento}</td>

                    <td>
                      <strong>{item.empleado}</strong>
                    </td>

                    <td>{item.tarea?.titulo || "Tarea no identificada"}</td>

                    <td>{item.motivo || "Sin motivo registrado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detalleInterrupciones.length > 15 && (
          <div className="reportes-nota-tabla">
            Se muestran las 15 interrupciones más recientes en pantalla. El
            informe PDF contiene el detalle completo.
          </div>
        )}
      </section>

      {/* TRABAJO POR DEPARTAMENTO */}

      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>DETALLE OPERATIVO</span>

            <h2>Trabajo por departamento</h2>

            <p>
              Personas que trabajaron, tareas solicitadas y tiempo empleado
              durante el período analizado.
            </p>
          </div>

          <div>
            <select
              value={departamentoSeleccionado}
              onChange={(e) => setDepartamentoSeleccionado(e.target.value)}
              className="reportes-select"
            >
              <option value="todos">Todos los departamentos</option>

              {departamentos.map((departamento) => (
                <option key={departamento.id} value={departamento.id}>
                  {departamento.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {trabajoPorDepartamento

          .filter(
            (departamento) =>
              departamentoSeleccionado === "todos" ||
              String(departamento.id) === String(departamentoSeleccionado),
          )

          .map((departamento) => (
            <div
              key={departamento.id}
              className="reportes-departamento-detalle"
            >
              <div className="reportes-departamento-detalle-header">
                <div>
                  <span>DEPARTAMENTO</span>

                  <h3>{departamento.nombre}</h3>
                </div>

                <div>
                  <strong>{departamento.tareas} tareas</strong>

                  <span>{formatearDuracion(departamento.minutos)}</span>
                </div>
              </div>

              {departamento.empleados.map((empleado) => (
                <div key={empleado.id} className="reportes-empleado-detalle">
                  <div className="reportes-empleado-detalle-header">
                    <strong>{empleado.nombre}</strong>

                    <span>
                      {empleado.tareas.length} tareas ·{" "}
                      {formatearDuracion(empleado.minutos)}
                    </span>
                  </div>

                  <div className="reportes-table-wrapper">
                    <table className="reportes-table">
                      <thead>
                        <tr>
                          <th>Tarea solicitada</th>

                          <th>Estado</th>

                          <th>Tiempo trabajado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {empleado.tareas.map((tarea) => (
                          <tr key={tarea.id}>
                            <td>
                              <strong>{tarea.titulo}</strong>
                            </td>

                            <td>
                              {tarea.estado === "completada"
                                ? "Completada"
                                : tarea.estado === "en_proceso"
                                  ? "En proceso"
                                  : "Pendiente"}
                            </td>

                            <td>
                              {formatearDuracion(tarea.tiempo_trabajado_min)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </section>

      {/* CARGA POR EMPLEADO */}

      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>CAPACIDAD OPERATIVA</span>

            <h2>Carga de trabajo por empleado</h2>

            <p>
              Distribución de las actividades ejecutadas por las personas
              responsables.
            </p>
          </div>
        </div>

        {cargaPorEmpleado.length === 0 ? (
          <div className="reportes-vacio">
            No existen datos de carga operativa para este período.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Empleado</th>

                  <th>Tareas</th>

                  <th>Completadas</th>

                  <th>Pendientes</th>

                  <th>Tiempo trabajado</th>
                </tr>
              </thead>

              <tbody>
                {cargaPorEmpleado.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nombre}</strong>
                    </td>

                    <td>{item.tareas}</td>

                    <td>{item.completadas}</td>

                    <td>{item.pendientes}</td>

                    <td>{formatearDuracion(item.minutos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* PRIORIDADES */}

      <section className="reportes-panel reportes-panel-grande">
        <div className="reportes-panel-header">
          <div>
            <span>SEGUIMIENTO</span>

            <h2>Actividades prioritarias</h2>

            <p>Actividades de prioridad alta dentro del período analizado.</p>
          </div>
        </div>

        {tareasPrioritarias.length === 0 ? (
          <div className="reportes-vacio">
            No existen actividades prioritarias para mostrar.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Actividad</th>

                  <th>Departamento</th>

                  <th>Ejecutor</th>

                  <th>Estado</th>

                  <th>Tiempo</th>
                </tr>
              </thead>

              <tbody>
                {tareasPrioritarias.map((tarea) => (
                  <tr key={tarea.id}>
                    <td>
                      <strong>{tarea.titulo}</strong>
                    </td>

                    <td>{obtenerNombreDepartamento(tarea.departamento_id)}</td>

                    <td>{obtenerNombreUsuario(tarea.responsable_id)}</td>

                    <td>
                      <span className="reportes-estado">
                        {tarea.estado === "completada"
                          ? "Completada"
                          : tarea.estado === "en_proceso"
                            ? "En proceso"
                            : "Pendiente"}
                      </span>
                    </td>

                    <td>{formatearDuracion(tarea.tiempo_trabajado_min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default Reportes;
