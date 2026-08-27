import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Reportes.css";

function Reportes() {
  // =========================================================
  // CONSTANTES
  // =========================================================

  const MINUTOS_JORNADA = 480;

  const hoy = new Date().toISOString().split("T")[0];

  // =========================================================
  // ESTADOS
  // =========================================================

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
  // NOMBRES
  // =========================================================

  const obtenerUsuario = (id) => {
    return (
      usuarios.find(
        (usuario) => usuario.id === id,
      ) || null
    );
  };

  const obtenerDepartamento = (id) => {
    return (
      departamentos.find(
        (departamento) =>
          departamento.id === id,
      ) || null
    );
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
    const departamento =
      obtenerDepartamento(id);

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

    return Number.isNaN(
      fechaLocal.getTime(),
    )
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

  // =========================================================
  // DURACIÓN DE HORARIO
  // =========================================================

  const obtenerDuracionHorario = (
    tarea,
  ) => {
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
  // MISMA LÓGICA DE CARGA DEL EQUIPO
  // =========================================================

  const obtenerMinutosPlanificados = (
    tarea,
  ) => {
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

    /*
     * Una tarea de varios días ocupa
     * una jornada completa de 8 horas
     * en cada día del rango.
     */
    if (esMultidia) {
      return MINUTOS_JORNADA;
    }

    /*
     * Si tiene horario válido,
     * utilizamos la duración real.
     */
    const duracionHorario =
      obtenerDuracionHorario(
        tarea,
      );

    if (
      duracionHorario !== null
    ) {
      return Math.min(
        duracionHorario,
        MINUTOS_JORNADA,
      );
    }

    /*
     * Si no tiene horario válido,
     * utilizamos tiempo estimado.
     */
    const tiempoEstimado =
      Number(
        tarea.tiempo_estimado,
      );

    if (
      Number.isFinite(
        tiempoEstimado,
      ) &&
      tiempoEstimado > 0
    ) {
      return Math.min(
        tiempoEstimado,
        MINUTOS_JORNADA,
      );
    }

    /*
     * Si no existe información,
     * consideramos la jornada completa.
     */
    return MINUTOS_JORNADA;
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
  //
  // Cada actividad aparece una sola vez
  // en el reporte.
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
  // GENERAR DÍAS DEL PERÍODO
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

    const actual =
      new Date(desde);

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
  //
  // MUY IMPORTANTE:
  // Aquí sí analizamos cada día del rango.
  //
  // Una tarea lunes-viernes ocupa:
  // lunes     8 h
  // martes    8 h
  // miércoles 8 h
  // jueves    8 h
  // viernes   8 h
  // =========================================================

  const cargaDiaria = useMemo(() => {
    const resultado = [];

    diasPeriodo.forEach(
      (fecha) => {
        usuarios.forEach(
          (usuario) => {
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
              tareasUsuario.length ===
              0
            ) {
              return;
            }

            const minutos =
              tareasUsuario.reduce(
                (
                  total,
                  tarea,
                ) =>
                  total +
                  obtenerMinutosPlanificados(
                    tarea,
                  ),
                0,
              );

            let nivel =
              "normal";

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
          },
        );
      },
    );

    return resultado;
  }, [
    diasPeriodo,
    usuarios,
    tareasPeriodo,
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

          /*
           * El tiempo acumulado de la persona
           * se calcula desde las jornadas,
           * no simplemente sumando cada tarea.
           *
           * Esto permite contar correctamente
           * las tareas de varios días.
           */
          const tiempo =
            diasPersona.reduce(
              (
                total,
                dia,
              ) =>
                total +
                dia.minutos,
              0,
            );

          return {
            id: usuario.id,

            nombre:
              `${usuario.nombre || ""} ${
                usuario.apellido || ""
              }`.trim(),

            email:
              usuario.email,

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
              (
                total,
                tarea,
              ) =>
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

    /*
     * El tiempo general también se obtiene
     * desde la carga diaria para respetar
     * las tareas de varios días.
     */
    const tiempo =
      cargaDiaria.reduce(
        (
          totalAcumulado,
          dia,
        ) =>
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
          b.minutos - a.minutos,
      );
  }, [cargaDiaria]);

  // =========================================================
  // ACTIVIDADES PRIORITARIAS
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
  // FORMATO HORAS
  // =========================================================

  const formatearMinutos = (
    minutos,
  ) => {
    const valor =
      Number(minutos) || 0;

    const horas = Math.floor(
      valor / 60,
    );

    const minutosRestantes =
      valor % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (
      minutosRestantes ===
      0
    ) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  // =========================================================
  // PDF
  // =========================================================

  const descargarPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const azul = [7, 74, 123];
    const azulOscuro = [
      23, 32, 51,
    ];
    const gris = [
      100, 110, 125,
    ];
    const blanco = [
      255, 255, 255,
    ];

    let y = 18;

    const nuevaPagina = () => {
      doc.addPage();
      y = 18;
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

      doc.setFontSize(14);

      doc.setTextColor(
        ...azulOscuro,
      );

      doc.text(
        titulo,
        14,
        y,
      );

      y += 6;

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
            260,
          );

        doc.text(
          lineas,
          14,
          y,
        );

        y +=
          lineas.length * 4 +
          3;
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
      ...azul,
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

    y += 13;

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

    y += 7;

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
      `Durante el período analizado se registraron ${metricas.total} actividades de trabajo, ` +
      `distribuidas entre ${metricas.personas} personas y ${metricas.departamentos} departamentos. ` +
      `Considerando la planificación diaria, la carga registrada corresponde a ${formatearMinutos(
        metricas.tiempo,
      )}. `;

    if (
      departamentoPrincipal
    ) {
      resumen +=
        `El departamento con mayor volumen de solicitudes fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} actividades, equivalentes al ${departamentoPrincipal.porcentaje.toFixed(
          1,
        )}% del total. `;
    }

    if (
      personaMayorCarga
    ) {
      resumen +=
        `La persona con mayor carga acumulada fue ${personaMayorCarga.nombre}, ` +
        `con ${formatearMinutos(
          personaMayorCarga.tiempo,
        )} de trabajo planificado. `;
    }

    resumen +=
      `Se identificaron ${metricas.diasCargaAlta} jornadas con carga alta y ` +
      `${metricas.diasSobrecargados} jornadas con sobrecarga. ` +
      `Para el análisis se considera una capacidad de 8 horas diarias por persona.`;

    const lineasResumen =
      doc.splitTextToSize(
        resumen,
        260,
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
        textColor: azulOscuro,
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 12;

    // =======================================================
    // 1. ACTIVIDADES
    // =======================================================

    encabezadoSeccion(
      "1. Actividades realizadas",
      "Detalle de las actividades registradas, qué trabajo se realizó, quién estuvo a cargo y qué departamento estuvo relacionado.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Actividad",
          "Descripción / trabajo realizado",
          "Responsable",
          "Departamento",
          "Inicio",
          "Fin",
          "Tiempo",
          "Estado",
        ],
      ],

      body: tareasPeriodo.map(
        (tarea) => [
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
        fontSize: 7,
        cellPadding: 2.5,
        textColor: azulOscuro,
        overflow: "linebreak",
      },

      columnStyles: {
        0: {
          cellWidth: 35,
        },
        1: {
          cellWidth: 62,
        },
        2: {
          cellWidth: 35,
        },
        3: {
          cellWidth: 35,
        },
        4: {
          cellWidth: 23,
        },
        5: {
          cellWidth: 23,
        },
        6: {
          cellWidth: 25,
        },
        7: {
          cellWidth: 25,
        },
      },
    });

    // =======================================================
    // 2. DEPARTAMENTOS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "2. Distribución del trabajo por departamento",
      "Permite identificar de dónde proviene la demanda de trabajo y qué departamentos concentran mayor cantidad de actividades.",
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
        textColor: azulOscuro,
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 10;

    if (
      departamentoPrincipal
    ) {
      const texto =
        `El departamento con mayor demanda durante el período fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} actividades. ` +
        `Estas actividades representan el ${departamentoPrincipal.porcentaje.toFixed(
          1,
        )}% del total registrado.`;

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(9);

      doc.setTextColor(
        ...azulOscuro,
      );

      doc.text(
        doc.splitTextToSize(
          texto,
          260,
        ),
        14,
        y,
      );

      y += 15;
    }

    // =======================================================
    // 3. CARGA POR PERSONA
    // =======================================================

    encabezadoSeccion(
      "3. Carga de trabajo por persona",
      "La carga se analiza por jornada. La capacidad de referencia es de 8 horas diarias por persona.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Responsable",
          "Actividades",
          "Carga acumulada",
          "Días trabajados",
          "Días normales",
          "Carga alta",
          "Sobrecarga",
          "Completadas",
        ],
      ],

      body:
        rendimientoPersonas.map(
          (persona) => [
            persona.nombre,

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
        fontSize: 8,
        cellPadding: 3,
        textColor: azulOscuro,
      },
    });

    // =======================================================
    // 4. JORNADAS CRÍTICAS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "4. Jornadas con mayor carga",
      "Identificación de las jornadas en las que una persona alcanzó una carga alta o superó la capacidad diaria de 8 horas.",
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
        "No se identificaron jornadas con carga alta o sobrecarga durante el período.",
        14,
        y,
      );

      y += 12;
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Fecha",
            "Responsable",
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
          textColor: azulOscuro,
        },
      });

      y =
        doc.lastAutoTable
          .finalY + 10;

      const textoCarga =
        `Durante el período se identificaron ${metricas.diasCargaAlta} jornadas con carga alta ` +
        `y ${metricas.diasSobrecargados} jornadas en las que la planificación superó la capacidad diaria de 8 horas. ` +
        `Estas situaciones permiten identificar momentos en los que puede ser necesario redistribuir actividades o revisar prioridades.`;

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(9);

      doc.setTextColor(
        ...azulOscuro,
      );

      doc.text(
        doc.splitTextToSize(
          textoCarga,
          260,
        ),
        14,
        y,
      );
    }

    // =======================================================
    // 5. PRIORIDADES
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "5. Actividades que requieren atención",
      "Actividades con prioridad alta que todavía no han sido completadas.",
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
          textColor: azulOscuro,
        },
      });
    }

    // =======================================================
    // 6. ESTADO GENERAL
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
        textColor: azulOscuro,
      },
    });

    // =======================================================
    // 7. DETALLE
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "7. Detalle completo de actividades",
      "Registro detallado de las actividades incluidas en el período seleccionado.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Actividad",
          "Responsable",
          "Departamento",
          "Inicio",
          "Fin",
          "Tiempo",
          "Prioridad",
          "Estado",
        ],
      ],

      body: tareasPeriodo.map(
        (tarea) => [
          tarea.titulo ||
            "Sin título",

          obtenerNombreUsuario(
            tarea.responsable_id,
          ),

          obtenerNombreDepartamento(
            tarea.departamento_id,
          ),

          `${formatearFecha(
            tarea.fecha_inicio ||
              tarea.fecha,
          )}\n${formatearHora(
            tarea.hora_inicio,
          )}`,

          `${formatearFecha(
            tarea.fecha_fin ||
              tarea.fecha_inicio ||
              tarea.fecha,
          )}\n${formatearHora(
            tarea.hora_fin,
          )}`,

          formatearMinutos(
            obtenerMinutosPlanificados(
              tarea,
            ),
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
        fontSize: 7,
        cellPadding: 2.5,
        textColor: azulOscuro,
      },
    });

    // =======================================================
    // 8. CONCLUSIÓN EJECUTIVA
    // =======================================================

    nuevaPagina();

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

    doc.setFontSize(18);

    doc.setTextColor(
      ...azul,
    );

    doc.text(
      "8. Conclusión ejecutiva",
      14,
      22,
    );

    y = 34;

    let conclusion =
      `Durante el período comprendido entre ${formatearFecha(
        fechaDesde,
      )} y ${formatearFecha(
        fechaHasta,
      )}, el equipo registró ${metricas.total} actividades, ` +
      `distribuidas entre ${metricas.personas} personas y ${metricas.departamentos} departamentos. ` +
      `La carga planificada representa ${formatearMinutos(
        metricas.tiempo,
      )} considerando la planificación diaria.`;

    if (
      departamentoPrincipal
    ) {
      conclusion +=
        ` El departamento con mayor volumen de actividades fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} solicitudes.`;
    }

    if (
      personaMayorCarga
    ) {
      conclusion +=
        ` La persona con mayor carga acumulada fue ${personaMayorCarga.nombre}, ` +
        `con ${formatearMinutos(
          personaMayorCarga.tiempo,
        )} de trabajo planificado.`;
    }

    conclusion +=
      ` Se identificaron ${metricas.diasCargaAlta} jornadas con carga alta y ` +
      `${metricas.diasSobrecargados} jornadas con sobrecarga, considerando una capacidad diaria de 8 horas por persona.`;

    if (
      metricas.tareasPrioritarias >
      0
    ) {
      conclusion +=
        ` Adicionalmente, existen ${metricas.tareasPrioritarias} actividades de prioridad alta que requieren seguimiento.`;
    }

    conclusion +=
      `\n\nEl objetivo de esta información es facilitar la toma de decisiones sobre distribución del trabajo, priorización de actividades y capacidad operativa del equipo.`;

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
        260,
      );

    doc.text(
      lineasConclusion,
      14,
      y,
    );

    // =======================================================
    // PIE
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
        `Informe de gestión | Período ${formatearFecha(
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
            className="reportes-btn reportes-btn-principal"
            onClick={descargarPDF}
          >
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

      {/* MÉTRICAS */}

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
            jornadas en las que se superó
            la capacidad diaria de{" "}
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
              ¿Qué hizo el equipo?
            </h2>

            <p>
              Actividades, descripción,
              responsables y departamentos
              relacionados.
            </p>

          </div>

        </div>

        <div className="tabla-contenedor">

          <table className="reporte-tabla">

            <thead>

              <tr>
                <th>Actividad</th>
                <th>Descripción</th>
                <th>Responsable</th>
                <th>Departamento</th>
                <th>Fecha</th>
                <th>Tiempo</th>
                <th>Estado</th>
              </tr>

            </thead>

            <tbody>

              {tareasPeriodo.map(
                (tarea) => (
                  <tr
                    key={tarea.id}
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
                      {formatearMinutos(
                        obtenerMinutosPlanificados(
                          tarea,
                        ),
                      )}
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

      </section>

      {/* DEPARTAMENTOS */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>

            <span className="reportes-eyebrow">
              DEMANDA
            </span>

            <h2>
              ¿Qué departamentos generan más trabajo?
            </h2>

            <p>
              Distribución de actividades y
              tiempo estimado por departamento.
            </p>

          </div>

        </div>

        <div className="tabla-contenedor">

          <table className="reporte-tabla">

            <thead>

              <tr>
                <th>Departamento</th>
                <th>Actividades</th>
                <th>Participación</th>
                <th>Tiempo estimado</th>
              </tr>

            </thead>

            <tbody>

              {rendimientoDepartamentos.map(
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

      </section>

      {/* CARGA POR PERSONA */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>

            <span className="reportes-eyebrow">
              CARGA DEL EQUIPO
            </span>

            <h2>
              ¿Quién tiene mayor carga?
            </h2>

            <p>
              La carga se analiza por jornada
              utilizando una capacidad diaria
              de 8 horas.
            </p>

          </div>

        </div>

        <div className="tabla-contenedor">

          <table className="reporte-tabla">

            <thead>

              <tr>
                <th>Responsable</th>
                <th>Actividades</th>
                <th>Carga acumulada</th>
                <th>Días trabajados</th>
                <th>Normales</th>
                <th>Carga alta</th>
                <th>Sobrecarga</th>
                <th>Completadas</th>
              </tr>

            </thead>

            <tbody>

              {rendimientoPersonas.map(
                (persona) => (
                  <tr
                    key={
                      persona.id
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
                      {persona.total}
                    </td>

                    <td>
                      {formatearMinutos(
                        persona.tiempo,
                      )}
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

                  </tr>
                ),
              )}

            </tbody>

          </table>

        </div>

        <div className="reporte-metodologia">

          <strong>
            Criterio utilizado
          </strong>

          <span>
            Capacidad diaria: 8 horas
          </span>

          <span>
            Carga alta: desde 6 horas hasta 8 horas
          </span>

          <span>
            Sobrecargado: más de 8 horas
          </span>

        </div>

      </section>

      {/* DÍAS CRÍTICOS */}

      <section className="reporte-card">

        <div className="reporte-card-header">

          <div>

            <span className="reportes-eyebrow">
              ALERTAS OPERATIVAS
            </span>

            <h2>
              Jornadas con mayor carga
            </h2>

            <p>
              Días en los que la planificación
              alcanzó niveles altos o superó la
              capacidad diaria.
            </p>

          </div>

        </div>

        {diasCriticos.length ===
        0 ? (

          <div className="reporte-vacio">

            <strong>
              No se detectaron jornadas críticas.
            </strong>

            <span>
              La planificación se mantuvo dentro
              de la capacidad disponible.
            </span>

          </div>

        ) : (

          <div className="tabla-contenedor">

            <table className="reporte-tabla">

              <thead>

                <tr>
                  <th>Fecha</th>
                  <th>Responsable</th>
                  <th>Actividades</th>
                  <th>Carga</th>
                  <th>Capacidad</th>
                  <th>Exceso</th>
                  <th>Nivel</th>
                </tr>

              </thead>

              <tbody>

                {diasCriticos.map(
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
                          {dia.nombre}
                        </strong>
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
                        {dia.exceso > 0
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
              Actividades de prioridad alta que
              todavía no han sido completadas.
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

          <div className="tabla-contenedor">

            <table className="reporte-tabla">

              <thead>

                <tr>
                  <th>Actividad</th>
                  <th>Responsable</th>
                  <th>Departamento</th>
                  <th>Fecha</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                </tr>

              </thead>

              <tbody>

                {actividadesPrioritarias.map(
                  (tarea) => (
                    <tr
                      key={tarea.id}
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

        )}

      </section>

      {/* ESTADOS */}

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

      {/* METODOLOGÍA */}

      <section className="reporte-nota">

        <strong>
          ¿Cómo se calcula la carga?
        </strong>

        <p>
          El reporte considera una jornada de
          trabajo de{" "}
          <strong>
            8 horas diarias
          </strong>{" "}
          por persona, equivalentes a 480
          minutos.
        </p>

        <p>
          Las actividades que abarcan varios
          días ocupan una jornada completa de
          8 horas en cada día del rango.
          Cuando una actividad corresponde a
          un solo día y tiene un horario definido,
          se utiliza la duración de ese horario.
          Si no existe un horario válido,
          se utiliza el tiempo estimado
          registrado.
        </p>

        <p>
          Una persona se considera{" "}
          <strong>
            sobrecargada
          </strong>{" "}
          cuando la planificación de una
          jornada supera las 8 horas disponibles.
          Esta medición permite identificar
          presión operativa y apoyar decisiones
          sobre distribución y priorización
          del trabajo.
        </p>

      </section>

    </section>
  );
}

export default Reportes;

