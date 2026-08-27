import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Reportes.css";

const MINUTOS_JORNADA = 480;
const ELEMENTOS_POR_PAGINA = 10;

function Paginacion({
  paginaActual,
  totalPaginas,
  onAnterior,
  onSiguiente,
}) {
  if (totalPaginas <= 1) return null;

  return (
    <div
      className="reporte-paginacion"
      aria-label="Paginación de resultados"
    >
      <button
        type="button"
        className="reporte-paginacion-btn"
        onClick={onAnterior}
        disabled={paginaActual === 1}
      >
        Anterior
      </button>

      <span className="reporte-paginacion-info">
        Página <strong>{paginaActual}</strong> de{" "}
        <strong>{totalPaginas}</strong>
      </span>

      <button
        type="button"
        className="reporte-paginacion-btn reporte-paginacion-siguiente"
        onClick={onSiguiente}
        disabled={paginaActual === totalPaginas}
      >
        Siguiente
      </button>
    </div>
  );
}

function Reportes() {
  const hoy = new Date().toISOString().split("T")[0];

  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [fechaDesde, setFechaDesde] = useState(
    `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, "0")}-01`,
  );

  const [fechaHasta, setFechaHasta] = useState(hoy);

  const [paginaActividades, setPaginaActividades] = useState(1);
  const [paginaDepartamentos, setPaginaDepartamentos] = useState(1);
  const [paginaPersonas, setPaginaPersonas] = useState(1);
  const [paginaDiasCriticos, setPaginaDiasCriticos] = useState(1);
  const [paginaPrioridades, setPaginaPrioridades] = useState(1);

  const [paginaModalActividades, setPaginaModalActividades] =
    useState(1);

  const [paginaModalJornadas, setPaginaModalJornadas] =
    useState(1);

  const [personaSeleccionada, setPersonaSeleccionada] =
    useState(null);

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
        { data: tareasData, error: tareasError },
        { data: usuariosData, error: usuariosError },
        { data: departamentosData, error: departamentosError },
      ] = await Promise.all([
        supabase
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
            responsable_id,
            departamento_id,
            tiempo_estimado
          `)
          .order("fecha_inicio", {
            ascending: true,
          })
          .order("hora_inicio", {
            ascending: true,
          }),

        supabase
          .from("usuarios")
          .select(`
            id,
            nombre,
            apellido,
            email,
            activo
          `)
          .eq("activo", true)
          .order("nombre"),

        supabase
          .from("departamentos")
          .select(`
            id,
            nombre
          `)
          .order("nombre"),
      ]);

      if (tareasError) {
        throw new Error(
          "No se pudieron cargar las tareas.",
        );
      }

      if (usuariosError) {
        throw new Error(
          "No se pudieron cargar los usuarios.",
        );
      }

      if (departamentosError) {
        throw new Error(
          "No se pudieron cargar los departamentos.",
        );
      }

      setTareas(tareasData || []);
      setUsuarios(usuariosData || []);
      setDepartamentos(departamentosData || []);
    } catch (err) {
      console.error(
        "Error cargando reportes:",
        err,
      );

      setError(
        err.message ||
          "No se pudo cargar la información del reporte.",
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // MAPAS
  // =========================================================

  const usuariosMap = useMemo(() => {
    const mapa = {};

    usuarios.forEach((usuario) => {
      mapa[usuario.id] = usuario;
    });

    return mapa;
  }, [usuarios]);

  const departamentosMap = useMemo(() => {
    const mapa = {};

    departamentos.forEach((departamento) => {
      mapa[departamento.id] = departamento;
    });

    return mapa;
  }, [departamentos]);

  // =========================================================
  // NOMBRES
  // =========================================================

  const obtenerUsuario = (id) => {
    return usuariosMap[id] || null;
  };

  const obtenerDepartamento = (id) => {
    return departamentosMap[id] || null;
  };

  const obtenerNombreUsuario = (id) => {
    const usuario = obtenerUsuario(id);

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${
      usuario.apellido || ""
    }`.trim();
  };

  const obtenerNombreDepartamento = (id) => {
    const departamento = obtenerDepartamento(id);

    return (
      departamento?.nombre ||
      "Sin departamento"
    );
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const convertirFecha = (fecha) => {
    if (!fecha) return null;

    const partes = fecha.split("-");

    if (partes.length !== 3) {
      return null;
    }

    const fechaLocal = new Date(
      Number(partes[0]),
      Number(partes[1]) - 1,
      Number(partes[2]),
    );

    return Number.isNaN(fechaLocal.getTime())
      ? null
      : fechaLocal;
  };

  const formatearFecha = (fecha) => {
    const fechaObj = convertirFecha(fecha);

    if (!fechaObj) {
      return "Sin fecha";
    }

    return fechaObj.toLocaleDateString(
      "es-EC",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );
  };

  const formatearFechaLarga = (fecha) => {
    const fechaObj = convertirFecha(fecha);

    if (!fechaObj) {
      return "";
    }

    return fechaObj.toLocaleDateString(
      "es-EC",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );
  };

  // =========================================================
  // HORAS
  // =========================================================

  const convertirHoraAMinutos = (hora) => {
    if (!hora) return null;

    const [horas, minutos] =
      hora.split(":").map(Number);

    if (
      !Number.isFinite(horas) ||
      !Number.isFinite(minutos)
    ) {
      return null;
    }

    return horas * 60 + minutos;
  };

  const formatearHora = (hora) => {
    if (!hora) {
      return "Sin hora";
    }

    return hora.substring(0, 5);
  };

  const formatearMinutos = (minutos) => {
    const valor = Number(minutos) || 0;

    const horas = Math.floor(valor / 60);
    const minutosRestantes = valor % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (minutosRestantes === 0) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  // =========================================================
  // DURACIÓN DE HORARIO
  // =========================================================

  const obtenerDuracionHorario = (tarea) => {
    const inicio =
      convertirHoraAMinutos(
        tarea.hora_inicio,
      );

    const fin =
      convertirHoraAMinutos(
        tarea.hora_fin,
      );

    if (
      inicio === null ||
      fin === null ||
      fin <= inicio
    ) {
      return null;
    }

    return fin - inicio;
  };

  // =========================================================
  // MINUTOS PLANIFICADOS
  //
  // NO CAMBIAR ESTA LÓGICA
  // =========================================================

  const obtenerMinutosPlanificados = (tarea) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      tarea.fecha_inicio ||
      tarea.fecha;

    const esMultidia =
      inicio &&
      fin &&
      inicio !== fin;

    // 1. ACTIVIDAD DE VARIOS DÍAS
    if (esMultidia) {
      return MINUTOS_JORNADA;
    }

    // 2. ACTIVIDAD DE UN DÍA CON HORARIO
    const duracionHorario =
      obtenerDuracionHorario(tarea);

    if (duracionHorario !== null) {
      return Math.min(
        duracionHorario,
        MINUTOS_JORNADA,
      );
    }

    // 3. SIN HORARIO: TIEMPO ESTIMADO
    const tiempoEstimado =
      Number(tarea.tiempo_estimado);

    if (
      Number.isFinite(tiempoEstimado) &&
      tiempoEstimado > 0
    ) {
      return Math.min(
        tiempoEstimado,
        MINUTOS_JORNADA,
      );
    }

    // 4. SIN INFORMACIÓN: JORNADA COMPLETA
    return MINUTOS_JORNADA;
  };

  // =========================================================
  // ORIGEN DEL CÁLCULO
  // =========================================================

  const obtenerFuenteCalculo = (tarea) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      tarea.fecha_inicio ||
      tarea.fecha;

    const esMultidia =
      inicio &&
      fin &&
      inicio !== fin;

    if (esMultidia) {
      return {
        corto: "Rango de varios días",
        detalle:
          "8 horas asignadas por cada día del rango",
      };
    }

    const duracionHorario =
      obtenerDuracionHorario(tarea);

    if (duracionHorario !== null) {
      return {
        corto: "Horario",
        detalle:
          `${formatearHora(
            tarea.hora_inicio,
          )} - ${formatearHora(
            tarea.hora_fin,
          )}`,
      };
    }

    const tiempoEstimado =
      Number(tarea.tiempo_estimado);

    if (
      Number.isFinite(tiempoEstimado) &&
      tiempoEstimado > 0
    ) {
      return {
        corto: "Tiempo estimado",
        detalle:
          "Se utilizó el tiempo estimado registrado",
      };
    }

    return {
      corto: "Jornada completa",
      detalle:
        "Sin información válida; se asignaron 8 horas",
    };
  };

  // =========================================================
  // SABER SI UNA TAREA OCUPA UNA FECHA
  // =========================================================

  const tareaOcupaFecha = (
    tarea,
    fecha,
  ) => {
    const inicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    const fin =
      tarea.fecha_fin ||
      tarea.fecha_inicio ||
      tarea.fecha;

    if (!inicio) {
      return false;
    }

    return (
      fecha >= inicio &&
      fecha <= fin
    );
  };

  // =========================================================
  // TAREAS DEL PERÍODO
  // =========================================================

  const tareasPeriodo = useMemo(() => {
    if (!fechaDesde || !fechaHasta) {
      return [];
    }

    const desde =
      convertirFecha(fechaDesde);

    const hasta =
      convertirFecha(fechaHasta);

    if (!desde || !hasta) {
      return [];
    }

    return tareas.filter((tarea) => {
      const inicio =
        tarea.fecha_inicio ||
        tarea.fecha;

      const fin =
        tarea.fecha_fin ||
        tarea.fecha_inicio ||
        tarea.fecha;

      if (!inicio) {
        return false;
      }

      const fechaInicio =
        convertirFecha(inicio);

      const fechaFin =
        convertirFecha(fin);

      if (
        !fechaInicio ||
        !fechaFin
      ) {
        return false;
      }

      return (
        fechaInicio <= hasta &&
        fechaFin >= desde
      );
    });
  }, [
    tareas,
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // DÍAS DEL PERÍODO
  // =========================================================

  const diasPeriodo = useMemo(() => {
    const desde =
      convertirFecha(fechaDesde);

    const hasta =
      convertirFecha(fechaHasta);

    if (
      !desde ||
      !hasta ||
      desde > hasta
    ) {
      return [];
    }

    const dias = [];
    const actual = new Date(desde);

    while (actual <= hasta) {
      const anio =
        actual.getFullYear();

      const mes = String(
        actual.getMonth() + 1,
      ).padStart(2, "0");

      const dia = String(
        actual.getDate(),
      ).padStart(2, "0");

      dias.push(
        `${anio}-${mes}-${dia}`,
      );

      actual.setDate(
        actual.getDate() + 1,
      );
    }

    return dias;
  }, [
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // CARGA DIARIA
  // =========================================================

  const cargaDiaria = useMemo(() => {
    const resultado = [];

    diasPeriodo.forEach((fecha) => {
      usuarios.forEach((usuario) => {
        const tareasUsuario =
          tareasPeriodo.filter(
            (tarea) =>
              tarea.responsable_id ===
                usuario.id &&
              tareaOcupaFecha(
                tarea,
                fecha,
              ),
          );

        if (
          tareasUsuario.length === 0
        ) {
          return;
        }

        const minutos =
          tareasUsuario.reduce(
            (total, tarea) =>
              total +
              obtenerMinutosPlanificados(
                tarea,
              ),
            0,
          );

        let nivel = "normal";

        if (
          minutos >
          MINUTOS_JORNADA
        ) {
          nivel =
            "sobrecargado";
        } else if (
          minutos >= 360
        ) {
          nivel = "alta";
        }

        resultado.push({
          fecha,
          usuarioId:
            usuario.id,
          nombre:
            `${usuario.nombre || ""} ${
              usuario.apellido || ""
            }`.trim(),
          departamento:
            tareasUsuario[0]?.departamento_id
              ? obtenerNombreDepartamento(
                  tareasUsuario[0]
                    .departamento_id,
                )
              : "Sin departamento",
          tareas:
            tareasUsuario,
          cantidadTareas:
            tareasUsuario.length,
          minutos,
          horas:
            minutos / 60,
          exceso: Math.max(
            minutos -
              MINUTOS_JORNADA,
            0,
          ),
          nivel,
        });
      });
    });

    return resultado;
  }, [
    diasPeriodo,
    usuarios,
    tareasPeriodo,
    departamentosMap,
  ]);

  // =========================================================
  // RENDIMIENTO POR PERSONA
  // =========================================================

  const rendimientoPersonas =
    useMemo(() => {
      return usuarios
        .map((usuario) => {
          const tareasPersona =
            tareasPeriodo.filter(
              (tarea) =>
                tarea.responsable_id ===
                usuario.id,
            );

          const diasPersona =
            cargaDiaria.filter(
              (dia) =>
                dia.usuarioId ===
                usuario.id,
            );

          const tiempo =
            diasPersona.reduce(
              (total, dia) =>
                total + dia.minutos,
              0,
            );

          const departamentosPersona =
            [
              ...new Set(
                tareasPersona
                  .map(
                    (tarea) =>
                      obtenerNombreDepartamento(
                        tarea.departamento_id,
                      ),
                  ),
              ),
            ];

          return {
            id: usuario.id,

            nombre:
              `${usuario.nombre || ""} ${
                usuario.apellido || ""
              }`.trim(),

            email:
              usuario.email,

            departamento:
              departamentosPersona.join(
                ", ",
              ) ||
              "Sin departamento",

            total:
              tareasPersona.length,

            tiempo,

            diasTrabajados:
              diasPersona.length,

            diasNormales:
              diasPersona.filter(
                (dia) =>
                  dia.nivel ===
                  "normal",
              ).length,

            diasCargaAlta:
              diasPersona.filter(
                (dia) =>
                  dia.nivel ===
                  "alta",
              ).length,

            diasSobrecargados:
              diasPersona.filter(
                (dia) =>
                  dia.nivel ===
                  "sobrecargado",
              ).length,

            completadas:
              tareasPersona.filter(
                (tarea) =>
                  tarea.estado ===
                  "completada",
              ).length,

            enProceso:
              tareasPersona.filter(
                (tarea) =>
                  tarea.estado ===
                  "en_proceso",
              ).length,

            pendientes:
              tareasPersona.filter(
                (tarea) =>
                  tarea.estado ===
                  "pendiente",
              ).length,

            tareas:
              tareasPersona,

            jornadas:
              diasPersona,
          };
        })
        .filter(
          (persona) =>
            persona.total > 0,
        )
        .sort(
          (a, b) =>
            b.tiempo - a.tiempo,
        );
    }, [
      usuarios,
      tareasPeriodo,
      cargaDiaria,
      departamentosMap,
    ]);

  // =========================================================
  // DEPARTAMENTOS
  // =========================================================

  const rendimientoDepartamentos =
    useMemo(() => {
      const totalGeneral =
        tareasPeriodo.length;

      return departamentos
        .map((departamento) => {
          const tareasDepartamento =
            tareasPeriodo.filter(
              (tarea) =>
                tarea.departamento_id ===
                departamento.id,
            );

          const tiempo =
            tareasDepartamento.reduce(
              (total, tarea) =>
                total +
                obtenerMinutosPlanificados(
                  tarea,
                ),
              0,
            );

          const porcentaje =
            totalGeneral > 0
              ? (tareasDepartamento.length /
                  totalGeneral) *
                100
              : 0;

          return {
            id:
              departamento.id,

            nombre:
              departamento.nombre,

            total:
              tareasDepartamento.length,

            tiempo,

            porcentaje,
          };
        })
        .filter(
          (departamento) =>
            departamento.total > 0,
        )
        .sort(
          (a, b) =>
            b.total - a.total,
        );
    }, [
      departamentos,
      tareasPeriodo,
    ]);

  // =========================================================
  // MÉTRICAS GENERALES
  // =========================================================

  const metricas = useMemo(() => {
    const total =
      tareasPeriodo.length;

    const tiempo =
      cargaDiaria.reduce(
        (totalAcumulado, dia) =>
          totalAcumulado +
          dia.minutos,
        0,
      );

    const personas =
      new Set(
        tareasPeriodo
          .map(
            (tarea) =>
              tarea.responsable_id,
          )
          .filter(Boolean),
      ).size;

    const departamentosCantidad =
      new Set(
        tareasPeriodo
          .map(
            (tarea) =>
              tarea.departamento_id,
          )
          .filter(Boolean),
      ).size;

    const completadas =
      tareasPeriodo.filter(
        (tarea) =>
          tarea.estado ===
          "completada",
      ).length;

    const enProceso =
      tareasPeriodo.filter(
        (tarea) =>
          tarea.estado ===
          "en_proceso",
      ).length;

    const pendientes =
      tareasPeriodo.filter(
        (tarea) =>
          tarea.estado ===
          "pendiente",
      ).length;

    const diasCargaAlta =
      cargaDiaria.filter(
        (dia) =>
          dia.nivel === "alta",
      ).length;

    const diasSobrecargados =
      cargaDiaria.filter(
        (dia) =>
          dia.nivel ===
          "sobrecargado",
      ).length;

    const tareasPrioritarias =
      tareasPeriodo.filter(
        (tarea) =>
          tarea.prioridad ===
            "alta" &&
          tarea.estado !==
            "completada",
      );

    return {
      total,
      tiempo,
      personas,
      departamentos:
        departamentosCantidad,
      completadas,
      enProceso,
      pendientes,
      diasCargaAlta,
      diasSobrecargados,
      tareasPrioritarias:
        tareasPrioritarias.length,
    };
  }, [
    tareasPeriodo,
    cargaDiaria,
  ]);

  // =========================================================
  // DÍAS CRÍTICOS
  // =========================================================

  const diasCriticos = useMemo(() => {
    return [...cargaDiaria]
      .filter(
        (dia) =>
          dia.nivel ===
            "alta" ||
          dia.nivel ===
            "sobrecargado",
      )
      .sort(
        (a, b) =>
          b.minutos -
          a.minutos,
      );
  }, [cargaDiaria]);

  // =========================================================
  // PRIORIDADES
  // =========================================================

  const actividadesPrioritarias =
    useMemo(() => {
      return tareasPeriodo
        .filter(
          (tarea) =>
            tarea.prioridad ===
              "alta" &&
            tarea.estado !==
              "completada",
        )
        .sort((a, b) => {
          const fechaA =
            convertirFecha(
              a.fecha_inicio ||
                a.fecha,
            )?.getTime() || 0;

          const fechaB =
            convertirFecha(
              b.fecha_inicio ||
                b.fecha,
            )?.getTime() || 0;

          return (
            fechaA - fechaB
          );
        });
    }, [
      tareasPeriodo,
    ]);

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  const totalPaginasActividades =
    Math.max(
      1,
      Math.ceil(
        tareasPeriodo.length /
          ELEMENTOS_POR_PAGINA,
      ),
    );

  const totalPaginasDepartamentos =
    Math.max(
      1,
      Math.ceil(
        rendimientoDepartamentos.length /
          ELEMENTOS_POR_PAGINA,
      ),
    );

  const totalPaginasPersonas =
    Math.max(
      1,
      Math.ceil(
        rendimientoPersonas.length /
          ELEMENTOS_POR_PAGINA,
      ),
    );

  const totalPaginasDiasCriticos =
    Math.max(
      1,
      Math.ceil(
        diasCriticos.length /
          ELEMENTOS_POR_PAGINA,
      ),
    );

  const totalPaginasPrioridades =
    Math.max(
      1,
      Math.ceil(
        actividadesPrioritarias.length /
          ELEMENTOS_POR_PAGINA,
      ),
    );

  const actividadesPaginadas =
    tareasPeriodo.slice(
      (paginaActividades - 1) *
        ELEMENTOS_POR_PAGINA,
      paginaActividades *
        ELEMENTOS_POR_PAGINA,
    );

  const departamentosPaginados =
    rendimientoDepartamentos.slice(
      (paginaDepartamentos - 1) *
        ELEMENTOS_POR_PAGINA,
      paginaDepartamentos *
        ELEMENTOS_POR_PAGINA,
    );

  const personasPaginadas =
    rendimientoPersonas.slice(
      (paginaPersonas - 1) *
        ELEMENTOS_POR_PAGINA,
      paginaPersonas *
        ELEMENTOS_POR_PAGINA,
    );

  const diasCriticosPaginados =
    diasCriticos.slice(
      (paginaDiasCriticos - 1) *
        ELEMENTOS_POR_PAGINA,
      paginaDiasCriticos *
        ELEMENTOS_POR_PAGINA,
    );

  const prioridadesPaginadas =
    actividadesPrioritarias.slice(
      (paginaPrioridades - 1) *
        ELEMENTOS_POR_PAGINA,
      paginaPrioridades *
        ELEMENTOS_POR_PAGINA,
    );

  // =========================================================
  // REINICIAR PAGINACIÓN
  // =========================================================

  useEffect(() => {
    setPaginaActividades(1);
    setPaginaDepartamentos(1);
    setPaginaPersonas(1);
    setPaginaDiasCriticos(1);
    setPaginaPrioridades(1);
  }, [
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // TEXTOS
  // =========================================================

  const obtenerTextoEstado = (
    estado,
  ) => {
    switch (estado) {
      case "completada":
        return "Completada";

      case "en_proceso":
        return "En proceso";

      case "pendiente":
        return "Pendiente";

      default:
        return (
          estado ||
          "Sin estado"
        );
    }
  };

  const obtenerTextoPrioridad = (
    prioridad,
  ) => {
    switch (prioridad) {
      case "alta":
        return "Alta";

      case "media":
        return "Media";

      case "baja":
        return "Baja";

      default:
        return (
          prioridad ||
          "Sin prioridad"
        );
    }
  };

  const obtenerTextoCarga = (
    nivel,
  ) => {
    switch (nivel) {
      case "sobrecargado":
        return "Sobrecargado";

      case "alta":
        return "Carga alta";

      default:
        return "Normal";
    }
  };

  // =========================================================
  // DETALLE PERSONA
  // =========================================================

  const abrirDetallePersona = (
    persona,
  ) => {
    setPersonaSeleccionada(
      persona,
    );

    setPaginaModalActividades(1);
    setPaginaModalJornadas(1);
  };

  const cerrarDetallePersona = () => {
    setPersonaSeleccionada(null);
  };

  const obtenerDetallePersona = (
    persona,
  ) => {
    if (!persona) {
      return null;
    }

    const jornadas =
      [...(persona.jornadas || [])]
        .sort((a, b) =>
          a.fecha.localeCompare(
            b.fecha,
          ),
        );

    return {
      ...persona,
      jornadas,
      jornadasSobrecargadas:
        jornadas.filter(
          (jornada) =>
            jornada.nivel ===
            "sobrecargado",
        ),
    };
  };

  // =========================================================
  // PDF
  //
  // IMPORTANTE:
  // El PDF solamente se genera y descarga.
  // NO se muestra en pantalla.
  // =========================================================

  const descargarPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const azul = [
      7,
      74,
      123,
    ];

    const azulOscuro = [
      23,
      32,
      51,
    ];

    const gris = [
      100,
      110,
      125,
    ];

    const grisClaro = [
      245,
      247,
      249,
    ];

    const blanco = [
      255,
      255,
      255,
    ];

    let y = 20;

    const nuevaPagina = () => {
      doc.addPage();
      y = 20;
    };

    const encabezadoSeccion = (
      titulo,
      subtitulo = "",
    ) => {
      if (y > 175) {
        nuevaPagina();
      }

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(15);

      doc.setTextColor(
        ...azulOscuro,
      );

      doc.text(
        titulo,
        14,
        y,
      );

      y += 7;

      if (subtitulo) {
        doc.setFont(
          "helvetica",
          "normal",
        );

        doc.setFontSize(9);

        doc.setTextColor(
          ...gris,
        );

        const lineas =
          doc.splitTextToSize(
            subtitulo,
            265,
          );

        doc.text(
          lineas,
          14,
          y,
        );

        y +=
          lineas.length * 4 +
          4;
      }
    };

    // =======================================================
    // PORTADA
    // =======================================================

    doc.setFillColor(
      ...azul,
    );

    doc.rect(
      0,
      0,
      297,
      8,
      "F",
    );

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(23);

    doc.setTextColor(
      ...azulOscuro,
    );

    doc.text(
      "INFORME DE GESTIÓN DEL EQUIPO",
      14,
      y,
    );

    y += 9;

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(11);

    doc.setTextColor(
      ...gris,
    );

    doc.text(
      `Período: ${formatearFecha(
        fechaDesde,
      )} - ${formatearFecha(
        fechaHasta,
      )}`,
      14,
      y,
    );

    y += 6;

    doc.text(
      `Generado: ${formatearFecha(
        hoy,
      )}`,
      14,
      y,
    );

    y += 14;

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setFontSize(15);

    doc.setTextColor(
      ...azulOscuro,
    );

    doc.text(
      "Resumen ejecutivo",
      14,
      y,
    );

    y += 8;

    const porcentajeCompletadas =
      metricas.total > 0
        ? (
            (metricas.completadas /
              metricas.total) *
            100
          ).toFixed(1)
        : "0.0";

    const departamentoPrincipal =
      rendimientoDepartamentos[0];

    const personaMayorCarga =
      rendimientoPersonas[0];

    let resumen =
      `Durante el período analizado se registraron ${metricas.total} actividades, ` +
      `distribuidas entre ${metricas.personas} personas y ${metricas.departamentos} departamentos. ` +
      `La carga planificada acumulada corresponde a ${formatearMinutos(
        metricas.tiempo,
      )}. `;

    if (departamentoPrincipal) {
      resumen +=
        `El departamento con mayor volumen de trabajo fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} actividades, equivalentes al ${departamentoPrincipal.porcentaje.toFixed(
          1,
        )}% del total. `;
    }

    if (personaMayorCarga) {
      resumen +=
        `La persona con mayor carga acumulada fue ${personaMayorCarga.nombre}, ` +
        `con ${formatearMinutos(
          personaMayorCarga.tiempo,
        )} de planificación. `;
    }

    resumen +=
      `Se identificaron ${metricas.diasCargaAlta} jornadas con carga alta y ` +
      `${metricas.diasSobrecargados} jornadas con sobrecarga.`;

    const lineasResumen =
      doc.splitTextToSize(
        resumen,
        265,
      );

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(10);

    doc.setTextColor(
      ...azulOscuro,
    );

    doc.text(
      lineasResumen,
      14,
      y,
    );

    y +=
      lineasResumen.length *
        5 +
      10;

    // =======================================================
    // INDICADORES
    // =======================================================

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Actividades",
          "Carga planificada",
          "Personas",
          "Departamentos",
          "Completadas",
          "En proceso",
          "Pendientes",
        ],
      ],

      body: [
        [
          metricas.total,
          formatearMinutos(
            metricas.tiempo,
          ),
          metricas.personas,
          metricas.departamentos,
          `${metricas.completadas} (${porcentajeCompletadas}%)`,
          metricas.enProceso,
          metricas.pendientes,
        ],
      ],

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
        halign: "center",
      },

      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor:
          azulOscuro,
      },
    });

    y =
      doc.lastAutoTable.finalY +
      12;

    // =======================================================
    // 1. ACTIVIDADES
    // =======================================================

    encabezadoSeccion(
      "1. Actividades del período",
      "Detalle de todas las actividades registradas, incluyendo responsable, departamento, fechas, horario, estado y origen del cálculo de carga.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Actividad",
          "Descripción",
          "Responsable",
          "Departamento",
          "Inicio",
          "Fin",
          "Carga",
          "Origen cálculo",
          "Estado",
        ],
      ],

      body: tareasPeriodo.map(
        (tarea) => {
          const fuente =
            obtenerFuenteCalculo(
              tarea,
            );

          return [
            tarea.titulo ||
              "Sin título",

            tarea.descripcion ||
              "Sin descripción registrada",

            obtenerNombreUsuario(
              tarea.responsable_id,
            ),

            obtenerNombreDepartamento(
              tarea.departamento_id,
            ),

            formatearFecha(
              tarea.fecha_inicio ||
                tarea.fecha,
            ),

            formatearFecha(
              tarea.fecha_fin ||
                tarea.fecha_inicio ||
                tarea.fecha,
            ),

            formatearMinutos(
              obtenerMinutosPlanificados(
                tarea,
              ),
            ),

            fuente.corto,

            obtenerTextoEstado(
              tarea.estado,
            ),
          ];
        },
      ),

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
      },

      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor:
          azulOscuro,
        overflow: "linebreak",
      },

      columnStyles: {
        0: {
          cellWidth: 32,
        },
        1: {
          cellWidth: 50,
        },
        2: {
          cellWidth: 34,
        },
        3: {
          cellWidth: 34,
        },
        4: {
          cellWidth: 21,
        },
        5: {
          cellWidth: 21,
        },
        6: {
          cellWidth: 20,
        },
        7: {
          cellWidth: 28,
        },
        8: {
          cellWidth: 25,
        },
      },
    });

    // =======================================================
    // 2. DEPARTAMENTOS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "2. Distribución por departamento",
      "Identificación de los departamentos que concentran la demanda de trabajo.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Departamento",
          "Actividades",
          "Participación",
          "Tiempo registrado",
        ],
      ],

      body:
        rendimientoDepartamentos.map(
          (departamento) => [
            departamento.nombre,
            departamento.total,
            `${departamento.porcentaje.toFixed(
              1,
            )}%`,
            formatearMinutos(
              departamento.tiempo,
            ),
          ],
        ),

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
      },

      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor:
          azulOscuro,
      },
    });

    // =======================================================
    // 3. CARGA POR PERSONA
    // =======================================================

    y =
      doc.lastAutoTable.finalY +
      12;

    encabezadoSeccion(
      "3. Carga de trabajo por persona",
      "La carga se analiza por jornada utilizando una capacidad de referencia de 8 horas diarias por persona.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Responsable",
          "Departamento",
          "Actividades",
          "Carga acumulada",
          "Días trabajados",
          "Normales",
          "Carga alta",
          "Sobrecarga",
          "Completadas",
        ],
      ],

      body:
        rendimientoPersonas.map(
          (persona) => [
            persona.nombre,
            persona.departamento,
            persona.total,
            formatearMinutos(
              persona.tiempo,
            ),
            persona.diasTrabajados,
            persona.diasNormales,
            persona.diasCargaAlta,
            persona.diasSobrecargados,
            persona.completadas,
          ],
        ),

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
      },

      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        textColor:
          azulOscuro,
      },
    });

    // =======================================================
    // 4. JORNADAS CRÍTICAS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "4. Jornadas críticas",
      "Días en los que la planificación alcanzó entre 6 y 8 horas o superó la capacidad diaria de 8 horas.",
    );

    if (
      diasCriticos.length ===
      0
    ) {
      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(10);

      doc.setTextColor(
        ...gris,
      );

      doc.text(
        "No se identificaron jornadas críticas durante el período.",
        14,
        y,
      );
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Fecha",
            "Responsable",
            "Departamento",
            "Actividades",
            "Carga",
            "Capacidad",
            "Exceso",
            "Nivel",
          ],
        ],

        body: diasCriticos.map(
          (dia) => [
            formatearFecha(
              dia.fecha,
            ),

            dia.nombre,

            dia.departamento,

            dia.cantidadTareas,

            formatearMinutos(
              dia.minutos,
            ),

            "8 h",

            dia.exceso > 0
              ? formatearMinutos(
                  dia.exceso,
                )
              : "0 min",

            obtenerTextoCarga(
              dia.nivel,
            ),
          ],
        ),

        theme: "grid",

        headStyles: {
          fillColor: azul,
          textColor: blanco,
          fontStyle: "bold",
        },

        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor:
            azulOscuro,
        },
      });
    }

    // =======================================================
    // 5. PRIORIDADES
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "5. Actividades que requieren atención",
      "Actividades de prioridad alta que todavía no han sido completadas.",
    );

    if (
      actividadesPrioritarias.length ===
      0
    ) {
      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(10);

      doc.setTextColor(
        ...gris,
      );

      doc.text(
        "No existen actividades de prioridad alta pendientes de seguimiento.",
        14,
        y,
      );
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Actividad",
            "Responsable",
            "Departamento",
            "Fecha",
            "Prioridad",
            "Estado",
          ],
        ],

        body:
          actividadesPrioritarias.map(
            (tarea) => [
              tarea.titulo ||
                "Sin título",

              obtenerNombreUsuario(
                tarea.responsable_id,
              ),

              obtenerNombreDepartamento(
                tarea.departamento_id,
              ),

              formatearFecha(
                tarea.fecha_inicio ||
                  tarea.fecha,
              ),

              obtenerTextoPrioridad(
                tarea.prioridad,
              ),

              obtenerTextoEstado(
                tarea.estado,
              ),
            ],
          ),

        theme: "grid",

        headStyles: {
          fillColor: azul,
          textColor: blanco,
          fontStyle: "bold",
        },

        styles: {
          fontSize: 8,
          cellPadding: 3,
          textColor:
            azulOscuro,
        },
      });
    }

    // =======================================================
    // 6. ESTADO
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "6. Estado general del trabajo",
      "Distribución de las actividades según su estado actual.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Estado",
          "Cantidad",
          "Participación",
        ],
      ],

      body: [
        [
          "Completadas",
          metricas.completadas,
          metricas.total > 0
            ? `${(
                (metricas.completadas /
                  metricas.total) *
                100
              ).toFixed(1)}%`
            : "0%",
        ],

        [
          "En proceso",
          metricas.enProceso,
          metricas.total > 0
            ? `${(
                (metricas.enProceso /
                  metricas.total) *
                100
              ).toFixed(1)}%`
            : "0%",
        ],

        [
          "Pendientes",
          metricas.pendientes,
          metricas.total > 0
            ? `${(
                (metricas.pendientes /
                  metricas.total) *
                100
              ).toFixed(1)}%`
            : "0%",
        ],
      ],

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
      },

      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor:
          azulOscuro,
      },
    });

    // =======================================================
    // 7. METODOLOGÍA
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "7. Metodología de cálculo",
      "Criterios utilizados para determinar la carga planificada y la capacidad diaria.",
    );

    const metodologia = [
      [
        "Capacidad diaria",
        "8 horas por persona, equivalentes a 480 minutos.",
      ],
      [
        "Actividades de varios días",
        "Ocupan una jornada completa de 8 horas en cada día del rango.",
      ],
      [
        "Actividad de un solo día con horario",
        "Se utiliza la duración comprendida entre hora de inicio y hora de fin.",
      ],
      [
        "Sin horario válido",
        "Se utiliza el tiempo estimado registrado en la actividad.",
      ],
      [
        "Sin información válida",
        "Se considera una jornada completa de 8 horas.",
      ],
      [
        "Carga normal",
        "Menos de 6 horas.",
      ],
      [
        "Carga alta",
        "Desde 6 horas hasta 8 horas.",
      ],
      [
        "Sobrecarga",
        "Más de 8 horas en una misma jornada.",
      ],
    ];

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Criterio",
          "Regla aplicada",
        ],
      ],

      body: metodologia,

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
      },

      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor:
          azulOscuro,
      },

      columnStyles: {
        0: {
          cellWidth: 70,
        },
        1: {
          cellWidth: 190,
        },
      },
    });

    // =======================================================
    // 8. CONCLUSIÓN
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "8. Conclusión ejecutiva",
      "Síntesis general del comportamiento de la carga durante el período.",
    );

    let conclusion =
      `Durante el período comprendido entre ${formatearFecha(
        fechaDesde,
      )} y ${formatearFecha(
        fechaHasta,
      )}, el equipo registró ${metricas.total} actividades, ` +
      `distribuidas entre ${metricas.personas} personas y ${metricas.departamentos} departamentos. ` +
      `La carga planificada corresponde a ${formatearMinutos(
        metricas.tiempo,
      )}. `;

    if (
      departamentoPrincipal
    ) {
      conclusion +=
        `El departamento con mayor volumen fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} actividades. `;
    }

    if (
      personaMayorCarga
    ) {
      conclusion +=
        `La persona con mayor carga acumulada fue ${personaMayorCarga.nombre}, ` +
        `con ${formatearMinutos(
          personaMayorCarga.tiempo,
        )}. `;
    }

    conclusion +=
      `Se identificaron ${metricas.diasCargaAlta} jornadas con carga alta y ` +
      `${metricas.diasSobrecargados} jornadas con sobrecarga. `;

    if (
      metricas.tareasPrioritarias >
      0
    ) {
      conclusion +=
        `Además, existen ${metricas.tareasPrioritarias} actividades de prioridad alta que requieren seguimiento.`;
    }

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(10);

    doc.setTextColor(
      ...azulOscuro,
    );

    const lineasConclusion =
      doc.splitTextToSize(
        conclusion,
        265,
      );

    doc.text(
      lineasConclusion,
      14,
      y,
    );

    // =======================================================
    // PIE DE PÁGINA
    // =======================================================

    const paginas =
      doc.internal.getNumberOfPages();

    for (
      let i = 1;
      i <= paginas;
      i++
    ) {
      doc.setPage(i);

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(7);

      doc.setTextColor(
        120,
        120,
        120,
      );

      doc.text(
        `Informe de gestión | ${formatearFecha(
          fechaDesde,
        )} - ${formatearFecha(
          fechaHasta,
        )} | Página ${i} de ${paginas}`,
        14,
        202,
      );
    }

    doc.save(
      `informe-gestion-${fechaDesde}-${fechaHasta}.pdf`,
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (cargando) {
    return (
      <section className="reportes-page">
        <div className="reporte-cargando">
          <span className="loader" />

          <p>
            Cargando información
            del reporte...
          </p>
        </div>
      </section>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <section className="reportes-page">
        <div className="reporte-error">
          <strong>
            No se pudo cargar el reporte
          </strong>

          <p>{error}</p>

          <button
            type="button"
            className="reportes-btn reportes-btn-principal"
            onClick={cargarDatos}
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="reportes-page">

      {/* HEADER */}

      <div className="reportes-header">
        <div>
          <span className="reportes-eyebrow">
            ANÁLISIS DE GESTIÓN
          </span>

          <h1>
            Informe de gestión
          </h1>

          <p>
            Analiza qué trabajo se realizó,
            quién lo realizó, para qué
            departamento y cómo se distribuyó
            la carga del equipo durante el
            período seleccionado.
          </p>
        </div>

        <div className="reportes-header-acciones">

          <button
            type="button"
            className="reportes-btn reportes-btn-secundario"
            onClick={cargarDatos}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="reportes-btn reportes-btn-pdf"
            onClick={descargarPDF}
          >
            <span className="reportes-pdf-icon">
              PDF
            </span>

            Descargar informe PDF
          </button>

        </div>
      </div>

      {/* FILTROS */}

      <div className="reportes-filtros">

        <div className="reporte-filtro">
          <label htmlFor="fechaDesde">
            Fecha desde
          </label>

          <input
            id="fechaDesde"
            type="date"
            value={fechaDesde}
            onChange={(e) =>
              setFechaDesde(
                e.target.value,
              )
            }
          />
        </div>

        <div className="reporte-filtro">
          <label htmlFor="fechaHasta">
            Fecha hasta
          </label>

          <input
            id="fechaHasta"
            type="date"
            value={fechaHasta}
            onChange={(e) =>
              setFechaHasta(
                e.target.value,
              )
            }
          />
        </div>

        <div className="reporte-filtro-info">
          <span>
            Período seleccionado
          </span>

          <strong>
            {formatearFecha(
              fechaDesde,
            )}{" "}
            -{" "}
            {formatearFecha(
              fechaHasta,
            )}
          </strong>
        </div>

        <div className="reporte-filtro-info">
          <span>
            Actividades analizadas
          </span>

          <strong>
            {metricas.total}
          </strong>
        </div>

      </div>

      {/* KPIs */}

      <div className="reportes-resumen">

        <article className="reporte-metrica">
          <span>
            Actividades
          </span>

          <strong>
            {metricas.total}
          </strong>

          <small>
            Trabajo registrado
          </small>
        </article>

        <article className="reporte-metrica">
          <span>
            Carga planificada
          </span>

          <strong>
            {formatearMinutos(
              metricas.tiempo,
            )}
          </strong>

          <small>
            Calculada por jornada
          </small>
        </article>

        <article className="reporte-metrica">
          <span>
            Personas
          </span>

          <strong>
            {metricas.personas}
          </strong>

          <small>
            Integrantes con actividades
          </small>
        </article>

        <article className="reporte-metrica">
          <span>
            Departamentos
          </span>

          <strong>
            {metricas.departamentos}
          </strong>

          <small>
            Áreas atendidas
          </small>
        </article>

        <article className="reporte-metrica reporte-metrica-alerta">
          <span>
            Sobrecarga
          </span>

          <strong>
            {metricas.diasSobrecargados}
          </strong>

          <small>
            Jornadas detectadas
          </small>
        </article>

      </div>

      {/* RESUMEN EJECUTIVO */}

      <section className="reporte-card reporte-resumen-ejecutivo">

        <div className="reporte-card-header">
          <div>
            <span className="reportes-eyebrow">
              RESUMEN EJECUTIVO
            </span>

            <h2>
              ¿Qué está pasando con el trabajo?
            </h2>

            <p>
              Una lectura general del período
              para facilitar la toma de
              decisiones.
            </p>
          </div>
        </div>

        <div className="reporte-resumen-texto">

          <p>
            Durante el período analizado se
            registraron{" "}
            <strong>
              {metricas.total}
            </strong>{" "}
            actividades con una carga
            planificada de{" "}
            <strong>
              {formatearMinutos(
                metricas.tiempo,
              )}
            </strong>
            .
          </p>

          {rendimientoDepartamentos[0] && (
            <p>
              El departamento con mayor
              volumen de trabajo es{" "}
              <strong>
                {
                  rendimientoDepartamentos[0]
                    .nombre
                }
              </strong>
              , con{" "}
              <strong>
                {
                  rendimientoDepartamentos[0]
                    .total
                }
              </strong>{" "}
              actividades.
            </p>
          )}

          {rendimientoPersonas[0] && (
            <p>
              La persona con mayor carga
              acumulada es{" "}
              <strong>
                {
                  rendimientoPersonas[0]
                    .nombre
                }
              </strong>
              , con{" "}
              <strong>
                {formatearMinutos(
                  rendimientoPersonas[0]
                    .tiempo,
                )}
              </strong>{" "}
              de planificación acumulada.
            </p>
          )}

          <p>
            Se identificaron{" "}
            <strong>
              {metricas.diasCargaAlta}
            </strong>{" "}
            jornadas con carga alta y{" "}
            <strong>
              {metricas.diasSobrecargados}
            </strong>{" "}
            jornadas en las que se superó la
            capacidad diaria de{" "}
            <strong>
              8 horas
            </strong>
            .
          </p>

        </div>
      </section>

      {/* ACTIVIDADES */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              ACTIVIDADES
            </span>

            <h2>
              Todas las actividades
            </h2>

            <p>
              Aquí se muestran las actividades
              del período. Se presentan 10
              registros por página para mantener
              la pantalla organizada.
            </p>
          </div>

        </div>

        {tareasPeriodo.length === 0 ? (
          <div className="reporte-vacio">
            <strong>
              No existen actividades
              para el período seleccionado.
            </strong>
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">

              <table className="reporte-tabla">

                <thead>
                  <tr>
                    <th>
                      Actividad
                    </th>

                    <th>
                      Descripción
                    </th>

                    <th>
                      Responsable
                    </th>

                    <th>
                      Departamento
                    </th>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Horario
                    </th>

                    <th>
                      Carga
                    </th>

                    <th>
                      Origen
                    </th>

                    <th>
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {actividadesPaginadas.map(
                    (tarea) => {
                      const fuente =
                        obtenerFuenteCalculo(
                          tarea,
                        );

                      return (
                        <tr
                          key={
                            tarea.id
                          }
                        >

                          <td>
                            <strong>
                              {tarea.titulo ||
                                "Sin título"}
                            </strong>
                          </td>

                          <td className="descripcion-celda">
                            {tarea.descripcion ||
                              "Sin descripción"}
                          </td>

                          <td>
                            {obtenerNombreUsuario(
                              tarea.responsable_id,
                            )}
                          </td>

                          <td>
                            {obtenerNombreDepartamento(
                              tarea.departamento_id,
                            )}
                          </td>

                          <td>
                            {formatearFecha(
                              tarea.fecha_inicio ||
                                tarea.fecha,
                            )}
                          </td>

                          <td>
                            {tarea.hora_inicio &&
                            tarea.hora_fin
                              ? `${formatearHora(
                                  tarea.hora_inicio,
                                )} - ${formatearHora(
                                  tarea.hora_fin,
                                )}`
                              : "Sin horario"}
                          </td>

                          <td>
                            <strong>
                              {formatearMinutos(
                                obtenerMinutosPlanificados(
                                  tarea,
                                ),
                              )}
                            </strong>
                          </td>

                          <td>
                            <span className="reporte-fuente">
                              {fuente.corto}
                            </span>
                          </td>

                          <td>
                            <span className="estado">
                              {obtenerTextoEstado(
                                tarea.estado,
                              )}
                            </span>
                          </td>

                        </tr>
                      );
                    },
                  )}

                </tbody>

              </table>

            </div>

            <Paginacion
              paginaActual={
                paginaActividades
              }
              totalPaginas={
                totalPaginasActividades
              }
              onAnterior={() =>
                setPaginaActividades(
                  (pagina) =>
                    Math.max(
                      1,
                      pagina - 1,
                    ),
                )
              }
              onSiguiente={() =>
                setPaginaActividades(
                  (pagina) =>
                    Math.min(
                      totalPaginasActividades,
                      pagina + 1,
                    ),
                )
              }
            />
          </>
        )}

      </section>

      {/* DEPARTAMENTOS */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              DEMANDA
            </span>

            <h2>
              Distribución por departamento
            </h2>

            <p>
              Permite identificar de dónde
              proviene la demanda de trabajo.
            </p>
          </div>

        </div>

        {rendimientoDepartamentos.length ===
        0 ? (
          <div className="reporte-vacio">
            No existen departamentos
            asociados al período.
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">

              <table className="reporte-tabla">

                <thead>
                  <tr>
                    <th>
                      Departamento
                    </th>

                    <th>
                      Actividades
                    </th>

                    <th>
                      Participación
                    </th>

                    <th>
                      Tiempo
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {departamentosPaginados.map(
                    (departamento) => (
                      <tr
                        key={
                          departamento.id
                        }
                      >

                        <td>
                          <strong>
                            {
                              departamento.nombre
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            departamento.total
                          }
                        </td>

                        <td>
                          {departamento.porcentaje.toFixed(
                            1,
                          )}
                          %
                        </td>

                        <td>
                          {formatearMinutos(
                            departamento.tiempo,
                          )}
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

            <Paginacion
              paginaActual={
                paginaDepartamentos
              }
              totalPaginas={
                totalPaginasDepartamentos
              }
              onAnterior={() =>
                setPaginaDepartamentos(
                  (pagina) =>
                    Math.max(
                      1,
                      pagina - 1,
                    ),
                )
              }
              onSiguiente={() =>
                setPaginaDepartamentos(
                  (pagina) =>
                    Math.min(
                      totalPaginasDepartamentos,
                      pagina + 1,
                    ),
                )
              }
            />
          </>
        )}

      </section>

      {/* CARGA POR PERSONA */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              CARGA DEL EQUIPO
            </span>

            <h2>
              Carga por persona
            </h2>

            <p>
              Selecciona una persona para
              consultar todas sus actividades,
              departamento y jornadas críticas.
            </p>
          </div>

        </div>

        {rendimientoPersonas.length ===
        0 ? (
          <div className="reporte-vacio">
            No existen personas con actividades
            durante el período seleccionado.
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">

              <table className="reporte-tabla">

                <thead>
                  <tr>
                    <th>
                      Responsable
                    </th>

                    <th>
                      Departamento
                    </th>

                    <th>
                      Actividades
                    </th>

                    <th>
                      Carga acumulada
                    </th>

                    <th>
                      Días trabajados
                    </th>

                    <th>
                      Normales
                    </th>

                    <th>
                      Carga alta
                    </th>

                    <th>
                      Sobrecarga
                    </th>

                    <th>
                      Completadas
                    </th>

                    <th>
                      Detalle
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {personasPaginadas.map(
                    (persona) => (
                      <tr
                        key={
                          persona.id
                        }
                        className="reporte-fila-persona"
                        onClick={() =>
                          abrirDetallePersona(
                            persona,
                          )
                        }
                      >

                        <td>
                          <strong>
                            {
                              persona.nombre
                            }
                          </strong>
                        </td>

                        <td>
                          <span className="reporte-departamento">
                            {
                              persona.departamento
                            }
                          </span>
                        </td>

                        <td>
                          {
                            persona.total
                          }
                        </td>

                        <td>
                          <strong>
                            {formatearMinutos(
                              persona.tiempo,
                            )}
                          </strong>
                        </td>

                        <td>
                          {
                            persona.diasTrabajados
                          }
                        </td>

                        <td>
                          {
                            persona.diasNormales
                          }
                        </td>

                        <td>
                          <span className="reporte-badge reporte-badge-alta">
                            {
                              persona.diasCargaAlta
                            }
                          </span>
                        </td>

                        <td>
                          <span className="reporte-badge reporte-badge-sobrecarga">
                            {
                              persona.diasSobrecargados
                            }
                          </span>
                        </td>

                        <td>
                          {
                            persona.completadas
                          }
                        </td>

                        <td>
                          <button
                            type="button"
                            className="reporte-btn-detalle"
                            onClick={(e) => {
                              e.stopPropagation();

                              abrirDetallePersona(
                                persona,
                              );
                            }}
                          >
                            Ver informe
                          </button>
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

            <Paginacion
              paginaActual={
                paginaPersonas
              }
              totalPaginas={
                totalPaginasPersonas
              }
              onAnterior={() =>
                setPaginaPersonas(
                  (pagina) =>
                    Math.max(
                      1,
                      pagina - 1,
                    ),
                )
              }
              onSiguiente={() =>
                setPaginaPersonas(
                  (pagina) =>
                    Math.min(
                      totalPaginasPersonas,
                      pagina + 1,
                    ),
                )
              }
            />
          </>
        )}

      </section>

      {/* JORNADAS CRÍTICAS */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              ALERTAS OPERATIVAS
            </span>

            <h2>
              Jornadas críticas
            </h2>

            <p>
              Días en los que la planificación
              alcanzó niveles altos o superó
              la capacidad diaria.
            </p>
          </div>

        </div>

        {diasCriticos.length === 0 ? (
          <div className="reporte-vacio">
            <strong>
              No se detectaron jornadas
              críticas.
            </strong>

            <span>
              La planificación se mantuvo
              dentro de la capacidad disponible.
            </span>
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">

              <table className="reporte-tabla">

                <thead>
                  <tr>
                    <th>
                      Fecha
                    </th>

                    <th>
                      Responsable
                    </th>

                    <th>
                      Departamento
                    </th>

                    <th>
                      Actividades
                    </th>

                    <th>
                      Carga
                    </th>

                    <th>
                      Capacidad
                    </th>

                    <th>
                      Exceso
                    </th>

                    <th>
                      Nivel
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {diasCriticosPaginados.map(
                    (dia, index) => (
                      <tr
                        key={`${dia.fecha}-${dia.usuarioId}-${index}`}
                      >

                        <td>
                          {formatearFecha(
                            dia.fecha,
                          )}
                        </td>

                        <td>
                          <strong>
                            {
                              dia.nombre
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            dia.departamento
                          }
                        </td>

                        <td>
                          {
                            dia.cantidadTareas
                          }
                        </td>

                        <td>
                          {formatearMinutos(
                            dia.minutos,
                          )}
                        </td>

                        <td>
                          8 h
                        </td>

                        <td>
                          {dia.exceso >
                          0
                            ? formatearMinutos(
                                dia.exceso,
                              )
                            : "0 min"}
                        </td>

                        <td>
                          <span
                            className={
                              dia.nivel ===
                              "sobrecargado"
                                ? "reporte-badge reporte-badge-sobrecarga"
                                : "reporte-badge reporte-badge-alta"
                            }
                          >
                            {obtenerTextoCarga(
                              dia.nivel,
                            )}
                          </span>
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

            <Paginacion
              paginaActual={
                paginaDiasCriticos
              }
              totalPaginas={
                totalPaginasDiasCriticos
              }
              onAnterior={() =>
                setPaginaDiasCriticos(
                  (pagina) =>
                    Math.max(
                      1,
                      pagina - 1,
                    ),
                )
              }
              onSiguiente={() =>
                setPaginaDiasCriticos(
                  (pagina) =>
                    Math.min(
                      totalPaginasDiasCriticos,
                      pagina + 1,
                    ),
                )
              }
            />
          </>
        )}

      </section>

      {/* PRIORIDADES */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              SEGUIMIENTO
            </span>

            <h2>
              Actividades que requieren atención
            </h2>

            <p>
              Actividades de prioridad alta
              que todavía no han sido
              completadas.
            </p>
          </div>

        </div>

        {actividadesPrioritarias.length ===
        0 ? (
          <div className="reporte-vacio">
            <strong>
              No existen actividades
              prioritarias pendientes.
            </strong>

            <span>
              No se encontraron actividades
              de prioridad alta sin completar.
            </span>
          </div>
        ) : (
          <>
            <div className="tabla-contenedor">

              <table className="reporte-tabla">

                <thead>
                  <tr>
                    <th>
                      Actividad
                    </th>

                    <th>
                      Responsable
                    </th>

                    <th>
                      Departamento
                    </th>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Prioridad
                    </th>

                    <th>
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {prioridadesPaginadas.map(
                    (tarea) => (
                      <tr
                        key={
                          tarea.id
                        }
                      >

                        <td>
                          <strong>
                            {tarea.titulo ||
                              "Sin título"}
                          </strong>
                        </td>

                        <td>
                          {obtenerNombreUsuario(
                            tarea.responsable_id,
                          )}
                        </td>

                        <td>
                          {obtenerNombreDepartamento(
                            tarea.departamento_id,
                          )}
                        </td>

                        <td>
                          {formatearFecha(
                            tarea.fecha_inicio ||
                              tarea.fecha,
                          )}
                        </td>

                        <td>
                          <span className="reporte-badge reporte-badge-prioridad">
                            Alta
                          </span>
                        </td>

                        <td>
                          <span className="estado">
                            {obtenerTextoEstado(
                              tarea.estado,
                            )}
                          </span>
                        </td>

                      </tr>
                    ),
                  )}

                </tbody>

              </table>

            </div>

            <Paginacion
              paginaActual={
                paginaPrioridades
              }
              totalPaginas={
                totalPaginasPrioridades
              }
              onAnterior={() =>
                setPaginaPrioridades(
                  (pagina) =>
                    Math.max(
                      1,
                      pagina - 1,
                    ),
                )
              }
              onSiguiente={() =>
                setPaginaPrioridades(
                  (pagina) =>
                    Math.min(
                      totalPaginasPrioridades,
                      pagina + 1,
                    ),
                )
              }
            />
          </>
        )}

      </section>

      {/* ESTADO GENERAL */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>
            <span className="reportes-eyebrow">
              ESTADO
            </span>

            <h2>
              Estado general del trabajo
            </h2>

            <p>
              Distribución de las actividades
              según su estado actual.
            </p>
          </div>

        </div>

        <div className="reportes-estados">

          <div className="reporte-estado-item">
            <span>
              Completadas
            </span>

            <strong>
              {metricas.completadas}
            </strong>
          </div>

          <div className="reporte-estado-item">
            <span>
              En proceso
            </span>

            <strong>
              {metricas.enProceso}
            </strong>
          </div>

          <div className="reporte-estado-item">
            <span>
              Pendientes
            </span>

            <strong>
              {metricas.pendientes}
            </strong>
          </div>

        </div>

      </section>

      {/* METODOLOGÍA EN PANTALLA */}

      <section className="reporte-nota">

        <div className="reporte-nota-header">
          <div>
            <span className="reportes-eyebrow">
              METODOLOGÍA
            </span>

            <strong>
              ¿Cómo se calcula la carga?
            </strong>
          </div>

          <span className="reporte-nota-capacidad">
            8 h = 480 min
          </span>
        </div>

        <p>
          El reporte considera una jornada de
          trabajo de{" "}
          <strong>
            8 horas diarias
          </strong>{" "}
          por persona, equivalentes a
          480 minutos.
        </p>

        <p>
          Las actividades que abarcan varios
          días ocupan una jornada completa de
          <strong>
            {" "}8 horas en cada día del rango.
          </strong>{" "}
          Cuando una actividad corresponde a
          un solo día y tiene un horario
          definido, se utiliza la duración de
          ese horario.
        </p>

        <p>
          Si no existe un horario válido,
          se utiliza el{" "}
          <strong>
            tiempo estimado
          </strong>{" "}
          registrado. Si tampoco existe
          información válida, se considera una
          jornada completa de 8 horas.
        </p>

        <p>
          Una persona se considera{" "}
          <strong>
            sobrecargada
          </strong>{" "}
          cuando la planificación de una
          jornada supera las 8 horas
          disponibles.
        </p>

        <div className="reporte-metodologia-grid">

          <div>
            <span>
              Menos de 6 h
            </span>

            <strong>
              Normal
            </strong>
          </div>

          <div>
            <span>
              6 h a 8 h
            </span>

            <strong>
              Carga alta
            </strong>
          </div>

          <div>
            <span>
              Más de 8 h
            </span>

            <strong>
              Sobrecargado
            </strong>
          </div>

        </div>

      </section>

      {/* MODAL INFORME INDIVIDUAL */}

      {personaSeleccionada && (
        <div
          className="reporte-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              cerrarDetallePersona();
            }
          }}
        >

          <div
            className="reporte-modal"
            role="dialog"
            aria-modal="true"
          >

            {(() => {
              const detalle =
                obtenerDetallePersona(
                  personaSeleccionada,
                );

              const totalPaginasModalActividades =
                Math.max(
                  1,
                  Math.ceil(
                    detalle.tareas.length /
                      ELEMENTOS_POR_PAGINA,
                  ),
                );

              const totalPaginasModalJornadas =
                Math.max(
                  1,
                  Math.ceil(
                    detalle
                      .jornadasSobrecargadas
                      .length /
                      ELEMENTOS_POR_PAGINA,
                  ),
                );

              const actividadesModal =
                detalle.tareas.slice(
                  (paginaModalActividades -
                    1) *
                    ELEMENTOS_POR_PAGINA,

                  paginaModalActividades *
                    ELEMENTOS_POR_PAGINA,
                );

              const jornadasModal =
                detalle
                  .jornadasSobrecargadas
                  .slice(
                    (paginaModalJornadas -
                      1) *
                      ELEMENTOS_POR_PAGINA,

                    paginaModalJornadas *
                      ELEMENTOS_POR_PAGINA,
                  );

              return (
                <>

                  {/* CABECERA PERSONA */}

                  <div className="reporte-modal-header">

                    <div>

                      <span className="reportes-eyebrow">
                        INFORME INDIVIDUAL
                      </span>

                      <h2>
                        {detalle.nombre}
                      </h2>

                      <p>
                        {detalle.departamento}
                      </p>

                    </div>

                    <button
                      type="button"
                      className="reporte-modal-cerrar"
                      onClick={
                        cerrarDetallePersona
                      }
                      aria-label="Cerrar informe"
                    >
                      ×
                    </button>

                  </div>

                  {/* MÉTRICAS PERSONA */}

                  <div className="reporte-modal-metricas">

                    <article>
                      <span>
                        Actividades
                      </span>

                      <strong>
                        {detalle.total}
                      </strong>
                    </article>

                    <article>
                      <span>
                        Carga acumulada
                      </span>

                      <strong>
                        {formatearMinutos(
                          detalle.tiempo,
                        )}
                      </strong>
                    </article>

                    <article>
                      <span>
                        Días trabajados
                      </span>

                      <strong>
                        {
                          detalle.diasTrabajados
                        }
                      </strong>
                    </article>

                    <article>
                      <span>
                        Días sobrecargados
                      </span>

                      <strong>
                        {
                          detalle.diasSobrecargados
                        }
                      </strong>
                    </article>

                  </div>

                  {/* TODAS LAS ACTIVIDADES */}

                  <div className="reporte-modal-seccion">

                    <div className="reporte-modal-seccion-header">

                      <h3>
                        Todas las actividades
                      </h3>

                      <p>
                        Aquí aparecen todas las
                        actividades asignadas a
                        esta persona durante el
                        período.
                      </p>

                    </div>

                    <div className="reporte-modal-tabla-contenedor">

                      <table className="reporte-tabla reporte-tabla-modal">

                        <thead>
                          <tr>
                            <th>
                              Actividad
                            </th>

                            <th>
                              Descripción
                            </th>

                            <th>
                              Inicio
                            </th>

                            <th>
                              Fin
                            </th>

                            <th>
                              Horario
                            </th>

                            <th>
                              Departamento
                            </th>

                            <th>
                              Carga
                            </th>

                            <th>
                              Origen
                            </th>

                            <th>
                              Prioridad
                            </th>

                            <th>
                              Estado
                            </th>
                          </tr>
                        </thead>

                        <tbody>

                          {actividadesModal.map(
                            (tarea) => {
                              const fuente =
                                obtenerFuenteCalculo(
                                  tarea,
                                );

                              return (
                                <tr
                                  key={
                                    tarea.id
                                  }
                                >

                                  <td>
                                    <strong>
                                      {tarea.titulo ||
                                        "Sin título"}
                                    </strong>
                                  </td>

                                  <td className="descripcion-celda">
                                    {tarea.descripcion ||
                                      "Sin descripción"}
                                  </td>

                                  <td>
                                    {formatearFecha(
                                      tarea.fecha_inicio ||
                                        tarea.fecha,
                                    )}
                                  </td>

                                  <td>
                                    {formatearFecha(
                                      tarea.fecha_fin ||
                                        tarea.fecha_inicio ||
                                        tarea.fecha,
                                    )}
                                  </td>

                                  <td>
                                    {tarea.hora_inicio &&
                                    tarea.hora_fin
                                      ? `${formatearHora(
                                          tarea.hora_inicio,
                                        )} - ${formatearHora(
                                          tarea.hora_fin,
                                        )}`
                                      : "Sin horario"}
                                  </td>

                                  <td>
                                    {obtenerNombreDepartamento(
                                      tarea.departamento_id,
                                    )}
                                  </td>

                                  <td>
                                    <strong>
                                      {formatearMinutos(
                                        obtenerMinutosPlanificados(
                                          tarea,
                                        ),
                                      )}
                                    </strong>
                                  </td>

                                  <td>
                                    <span className="reporte-fuente">
                                      {
                                        fuente.corto
                                      }
                                    </span>
                                  </td>

                                  <td>
                                    <span className="reporte-badge reporte-badge-prioridad">
                                      {obtenerTextoPrioridad(
                                        tarea.prioridad,
                                      )}
                                    </span>
                                  </td>

                                  <td>
                                    <span className="estado">
                                      {obtenerTextoEstado(
                                        tarea.estado,
                                      )}
                                    </span>
                                  </td>

                                </tr>
                              );
                            },
                          )}

                        </tbody>

                      </table>

                    </div>

                    <Paginacion
                      paginaActual={
                        paginaModalActividades
                      }
                      totalPaginas={
                        totalPaginasModalActividades
                      }
                      onAnterior={() =>
                        setPaginaModalActividades(
                          (pagina) =>
                            Math.max(
                              1,
                              pagina - 1,
                            ),
                        )
                      }
                      onSiguiente={() =>
                        setPaginaModalActividades(
                          (pagina) =>
                            Math.min(
                              totalPaginasModalActividades,
                              pagina + 1,
                            ),
                        )
                      }
                    />

                  </div>

                  {/* JORNADAS SOBRECARGADAS */}

                  <div className="reporte-modal-seccion">

                    <div className="reporte-modal-seccion-header">

                      <h3>
                        Días críticos de{" "}
                        {detalle.nombre}
                      </h3>

                      <p>
                        Jornadas donde la suma de
                        las actividades superó
                        las 8 horas disponibles.
                      </p>

                    </div>

                    {detalle
                      .jornadasSobrecargadas
                      .length === 0 ? (
                      <div className="reporte-vacio">
                        <strong>
                          No se detectaron jornadas
                          sobrecargadas.
                        </strong>

                        <span>
                          Ninguna jornada superó
                          los 480 minutos.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="reporte-modal-jornadas">

                          {jornadasModal.map(
                            (jornada) => (
                              <article
                                className="reporte-modal-jornada"
                                key={`${jornada.fecha}-${jornada.usuarioId}`}
                              >

                                <div className="reporte-modal-jornada-top">

                                  <div>
                                    <span>
                                      Fecha
                                    </span>

                                    <strong>
                                      {formatearFecha(
                                        jornada.fecha,
                                      )}
                                    </strong>
                                  </div>

                                  <span className="reporte-badge reporte-badge-sobrecarga">
                                    Sobrecargado
                                  </span>

                                </div>

                                <div className="reporte-modal-jornada-metricas">

                                  <div>
                                    <span>
                                      Carga
                                    </span>

                                    <strong>
                                      {formatearMinutos(
                                        jornada.minutos,
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Capacidad
                                    </span>

                                    <strong>
                                      8 h
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Exceso
                                    </span>

                                    <strong>
                                      {formatearMinutos(
                                        jornada.exceso,
                                      )}
                                    </strong>
                                  </div>

                                </div>

                                <div className="reporte-modal-actividades-sobrecarga">

                                  <span>
                                    Actividades presentes
                                    en esta jornada
                                  </span>

                                  <ul>

                                    {jornada.tareas.map(
                                      (tarea) => (
                                        <li
                                          key={
                                            tarea.id
                                          }
                                        >

                                          <div>
                                            <strong>
                                              {tarea.titulo ||
                                                "Sin título"}
                                            </strong>

                                            <small>
                                              {obtenerNombreDepartamento(
                                                tarea.departamento_id,
                                              )}
                                            </small>
                                          </div>

                                          <div>
                                            <small>
                                              {tarea.hora_inicio &&
                                              tarea.hora_fin
                                                ? `${formatearHora(
                                                    tarea.hora_inicio,
                                                  )} - ${formatearHora(
                                                    tarea.hora_fin,
                                                  )}`
                                                : "Sin horario"}
                                            </small>

                                            <small>
                                              {formatearMinutos(
                                                obtenerMinutosPlanificados(
                                                  tarea,
                                                ),
                                              )}
                                            </small>
                                          </div>

                                        </li>
                                      ),
                                    )}

                                  </ul>

                                </div>

                              </article>
                            ),
                          )}

                        </div>

                        <Paginacion
                          paginaActual={
                            paginaModalJornadas
                          }
                          totalPaginas={
                            totalPaginasModalJornadas
                          }
                          onAnterior={() =>
                            setPaginaModalJornadas(
                              (pagina) =>
                                Math.max(
                                  1,
                                  pagina - 1,
                                ),
                            )
                          }
                          onSiguiente={() =>
                            setPaginaModalJornadas(
                              (pagina) =>
                                Math.min(
                                  totalPaginasModalJornadas,
                                  pagina + 1,
                                ),
                            )
                          }
                        />

                      </>
                    )}

                  </div>

                  {/* EXPLICACIÓN */}

                  <div className="reporte-modal-metodologia">

                    <strong>
                      ¿De dónde salen estos valores?
                    </strong>

                    <p>
                      La carga acumulada se obtiene
                      a partir de las jornadas
                      correspondientes al período.
                      Una actividad de varios días
                      representa 8 horas en cada
                      jornada que ocupa.
                    </p>

                    <p>
                      Para una actividad de un solo
                      día con horario válido se utiliza
                      la duración del horario. Si no
                      existe horario válido, se utiliza
                      el tiempo estimado registrado.
                    </p>

                  </div>

                  {/* FOOTER */}

                  <div className="reporte-modal-footer">

                    <span>
                      Capacidad diaria:
                      <strong>
                        {" "}8 horas
                        (480 minutos)
                      </strong>
                    </span>

                    <button
                      type="button"
                      className="reportes-btn reportes-btn-secundario"
                      onClick={
                        cerrarDetallePersona
                      }
                    >
                      Cerrar
                    </button>

                  </div>

                </>
              );
            })()}

          </div>

        </div>
      )}

    </section>
  );
}

export default Reportes;