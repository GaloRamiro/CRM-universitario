import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Reportes.css";

function Reportes() {
  const [tareas, setTareas] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [interrupciones, setInterrupciones] = useState([]);

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
        tareasResponse,
        departamentosResponse,
        usuariosResponse,
        interrupcionesResponse,
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
            tiempo_estimado,
            inicio_real,
            fin_real,
            tiempo_trabajado_min,
            estado_ejecucion
          `)
          .order("fecha_inicio", { ascending: true }),

        supabase
          .from("departamentos")
          .select(`
            id,
            nombre
          `)
          .order("nombre", { ascending: true }),

        supabase
          .from("usuarios")
          .select(`
            id,
            nombre,
            apellido,
            email,
            activo
          `)
          .order("nombre", { ascending: true }),

        supabase
          .from("historial_interrupciones")
          .select(`
            id,
            tarea_id,
            empleado_id,
            departamento_id,
            motivo,
            fecha,
            hora,
            created_at
          `)
          .order("created_at", { ascending: true }),
      ]);

      if (tareasResponse.error) {
        throw tareasResponse.error;
      }

      if (departamentosResponse.error) {
        throw departamentosResponse.error;
      }

      if (usuariosResponse.error) {
        throw usuariosResponse.error;
      }

      if (interrupcionesResponse.error) {
        console.warn(
          "No se pudo cargar historial_interrupciones:",
          interrupcionesResponse.error
        );

        setInterrupciones([]);
      } else {
        setInterrupciones(
          interrupcionesResponse.data || []
        );
      }

      setTareas(tareasResponse.data || []);
      setDepartamentos(departamentosResponse.data || []);
      setUsuarios(usuariosResponse.data || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);

      setError(
        err.message ||
          "No se pudieron cargar los datos de reportes."
      );
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
      Number(partes[2])
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
    const valor = Math.max(
      0,
      Number(minutos) || 0
    );

    const horas = Math.floor(valor / 60);

    const minutosRestantes = Math.round(
      valor % 60
    );

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    return `${horas} h ${String(
      minutosRestantes
    ).padStart(2, "0")} min`;
  };

  const obtenerNombreUsuario = (id) => {
    const usuario = usuarios.find(
      (item) =>
        String(item.id) === String(id)
    );

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${
      usuario.apellido || ""
    }`.trim();
  };

  const obtenerNombreDepartamento = (id) => {
    const departamento = departamentos.find(
      (item) =>
        String(item.id) === String(id)
    );

    return (
      departamento?.nombre ||
      "Sin departamento"
    );
  };

  // =========================================================
  // RANGO DE FECHAS DEL PERÍODO
  // =========================================================

  const obtenerRangoPeriodo = () => {
    if (
      fechaDesde ||
      fechaHasta
    ) {
      return {
        inicio: fechaDesde
          ? obtenerFecha(fechaDesde)
          : null,

        fin: fechaHasta
          ? obtenerFecha(fechaHasta)
          : null,
      };
    }

    if (periodo === "todo") {
      return {
        inicio: null,
        fin: null,
      };
    }

    const hoy = new Date();

    hoy.setHours(
      23,
      59,
      59,
      999
    );

    const inicio = new Date(hoy);

    if (periodo === "mes") {
      inicio.setDate(1);
      inicio.setHours(
        0,
        0,
        0,
        0
      );
    }

    if (periodo === "trimestre") {
      inicio.setMonth(
        hoy.getMonth() - 2
      );

      inicio.setDate(1);

      inicio.setHours(
        0,
        0,
        0,
        0
      );
    }

    if (periodo === "semestre") {
      inicio.setMonth(
        hoy.getMonth() - 5
      );

      inicio.setDate(1);

      inicio.setHours(
        0,
        0,
        0,
        0
      );
    }

    if (periodo === "año") {
      inicio.setMonth(0);
      inicio.setDate(1);

      inicio.setHours(
        0,
        0,
        0,
        0
      );
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
    const { inicio, fin } =
      obtenerRangoPeriodo();

    if (!inicio && !fin) {
      return tareas;
    }

    return tareas.filter((tarea) => {
      const fecha =
        obtenerFecha(
          tarea.fecha_inicio ||
            tarea.fecha
        );

      if (!fecha) {
        return false;
      }

      if (
        inicio &&
        fecha < inicio
      ) {
        return false;
      }

      if (
        fin &&
        fecha > fin
      ) {
        return false;
      }

      return true;
    });
  }, [
    tareas,
    periodo,
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // FILTRO DE INTERRUPCIONES
  // =========================================================

  const interrupcionesFiltradas =
    useMemo(() => {
      const { inicio, fin } =
        obtenerRangoPeriodo();

      if (!inicio && !fin) {
        return interrupciones;
      }

      return interrupciones.filter(
        (item) => {
          const fecha =
            obtenerFecha(
              item.fecha ||
                item.created_at
            );

          if (!fecha) {
            return false;
          }

          if (
            inicio &&
            fecha < inicio
          ) {
            return false;
          }

          if (
            fin &&
            fecha > fin
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      interrupciones,
      periodo,
      fechaDesde,
      fechaHasta,
    ]);

  // =========================================================
  // MÉTRICAS GENERALES
  // =========================================================

  const metricas = useMemo(() => {
    const total =
      tareasFiltradas.length;

    const completadas =
      tareasFiltradas.filter(
        (tarea) =>
          tarea.estado ===
          "completada"
      ).length;

    const enProceso =
      tareasFiltradas.filter(
        (tarea) =>
          tarea.estado ===
          "en_proceso"
      ).length;

    const pendientes =
      tareasFiltradas.filter(
        (tarea) =>
          tarea.estado !==
            "completada" &&
          tarea.estado !==
            "en_proceso"
      ).length;

    const minutosTrabajados =
      tareasFiltradas.reduce(
        (
          totalMinutos,
          tarea
        ) =>
          totalMinutos +
          (Number(
            tarea.tiempo_trabajado_min
          ) || 0),
        0
      );

    const tiempoEstimado =
      tareasFiltradas.reduce(
        (
          totalMinutos,
          tarea
        ) =>
          totalMinutos +
          (Number(
            tarea.tiempo_estimado
          ) || 0),
        0
      );

    const porcentajeCompletado =
      total > 0
        ? Math.round(
            (completadas /
              total) *
              100
          )
        : 0;

    return {
      total,
      completadas,
      enProceso,
      pendientes,
      minutosTrabajados,
      tiempoEstimado,
      porcentajeCompletado,
      interrupciones:
        interrupcionesFiltradas.length,
    };
  }, [
    tareasFiltradas,
    interrupcionesFiltradas,
  ]);

  // =========================================================
  // TAREAS POR DEPARTAMENTO SOLICITANTE
  // =========================================================

  const tareasPorDepartamento =
    useMemo(() => {
      const mapa = {};

      tareasFiltradas.forEach(
        (tarea) => {
          const nombre =
            obtenerNombreDepartamento(
              tarea.departamento_id
            );

          if (!mapa[nombre]) {
            mapa[nombre] = {
              nombre,
              total: 0,
              completadas: 0,
              pendientes: 0,
              enProceso: 0,
              minutos: 0,
              prioridadAlta: 0,
            };
          }

          mapa[nombre].total += 1;

          if (
            tarea.estado ===
            "completada"
          ) {
            mapa[
              nombre
            ].completadas += 1;
          } else if (
            tarea.estado ===
            "en_proceso"
          ) {
            mapa[
              nombre
            ].enProceso += 1;
          } else {
            mapa[
              nombre
            ].pendientes += 1;
          }

          mapa[
            nombre
          ].minutos +=
            Number(
              tarea.tiempo_trabajado_min
            ) || 0;

          if (
            tarea.prioridad ===
            "alta"
          ) {
            mapa[
              nombre
            ].prioridadAlta += 1;
          }
        }
      );

      return Object.values(
        mapa
      ).sort(
        (a, b) =>
          b.total - a.total
      );
    }, [
      tareasFiltradas,
      departamentos,
    ]);

  // =========================================================
  // INTERRUPCIONES POR DEPARTAMENTO
  // =========================================================

  const interrupcionesPorDepartamento =
    useMemo(() => {
      const mapa = {};

      interrupcionesFiltradas.forEach(
        (interrupcion) => {
          const id =
            interrupcion.departamento_id;

          const nombre =
            obtenerNombreDepartamento(
              id
            );

          if (!mapa[id]) {
            mapa[id] = {
              id,
              nombre,
              interrupciones: 0,
              tareasAfectadas:
                new Set(),
              empleados:
                new Set(),
            };
          }

          mapa[id].interrupciones += 1;

          if (
            interrupcion.tarea_id
          ) {
            mapa[
              id
            ].tareasAfectadas.add(
              String(
                interrupcion.tarea_id
              )
            );
          }

          if (
            interrupcion.empleado_id
          ) {
            mapa[
              id
            ].empleados.add(
              String(
                interrupcion.empleado_id
              )
            );
          }
        }
      );

      return Object.values(
        mapa
      )
        .map((item) => ({
          ...item,
          tareasAfectadas:
            item.tareasAfectadas
              .size,
          empleados:
            item.empleados.size,
        }))
        .sort(
          (a, b) =>
            b.interrupciones -
            a.interrupciones
        );
    }, [
      interrupcionesFiltradas,
      departamentos,
      usuarios,
    ]);

  // =========================================================
  // INTERRUPCIONES POR EMPLEADO EJECUTOR
  // =========================================================

  const interrupcionesPorEmpleado =
    useMemo(() => {
      const mapa = {};

      interrupcionesFiltradas.forEach(
        (interrupcion) => {
          const id =
            interrupcion.empleado_id;

          const nombre =
            obtenerNombreUsuario(
              id
            );

          if (!mapa[id]) {
            mapa[id] = {
              id,
              nombre,
              interrupciones: 0,
              tareasAfectadas:
                new Set(),
              departamentos:
                new Set(),
            };
          }

          mapa[id].interrupciones += 1;

          if (
            interrupcion.tarea_id
          ) {
            mapa[
              id
            ].tareasAfectadas.add(
              String(
                interrupcion.tarea_id
              )
            );
          }

          if (
            interrupcion.departamento_id
          ) {
            mapa[
              id
            ].departamentos.add(
              String(
                interrupcion.departamento_id
              )
            );
          }
        }
      );

      return Object.values(
        mapa
      )
        .map((item) => ({
          ...item,
          tareasAfectadas:
            item.tareasAfectadas
              .size,
          departamentos:
            item.departamentos
              .size,
        }))
        .sort(
          (a, b) =>
            b.interrupciones -
            a.interrupciones
        );
    }, [
      interrupcionesFiltradas,
      usuarios,
    ]);

  // =========================================================
  // CARGA DE TRABAJO POR EMPLEADO
  // =========================================================

  const cargaPorEmpleado =
    useMemo(() => {
      const mapa = {};

      tareasFiltradas.forEach(
        (tarea) => {
          const id =
            tarea.responsable_id;

          const nombre =
            obtenerNombreUsuario(
              id
            );

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

          if (
            tarea.estado ===
            "completada"
          ) {
            mapa[
              id
            ].completadas += 1;
          } else {
            mapa[
              id
            ].pendientes += 1;
          }

          mapa[
            id
          ].minutos +=
            Number(
              tarea.tiempo_trabajado_min
            ) || 0;
        }
      );

      return Object.values(
        mapa
      ).sort(
        (a, b) =>
          b.tareas - a.tareas
      );
    }, [
      tareasFiltradas,
      usuarios,
    ]);

  // =========================================================
  // TAREAS PRIORITARIAS
  // =========================================================

  const tareasPrioritarias =
    useMemo(() => {
      return tareasFiltradas
        .filter(
          (tarea) =>
            tarea.prioridad ===
            "alta"
        )
        .sort((a, b) => {
          const estadoA =
            a.estado ===
            "completada"
              ? 0
              : 1;

          const estadoB =
            b.estado ===
            "completada"
              ? 0
              : 1;

          return (
            estadoB - estadoA
          );
        })
        .slice(0, 10);
    }, [tareasFiltradas]);

  // =========================================================
  // DETALLE DE INTERRUPCIONES
  // =========================================================

  const detalleInterrupciones =
    useMemo(() => {
      return interrupcionesFiltradas
        .map((interrupcion) => {
          const tarea =
            tareas.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  interrupcion.tarea_id
                )
            );

          return {
            ...interrupcion,
            tarea,
            empleado:
              obtenerNombreUsuario(
                interrupcion.empleado_id
              ),
            departamento:
              obtenerNombreDepartamento(
                interrupcion.departamento_id
              ),
          };
        })
        .sort((a, b) => {
          const fechaA =
            obtenerFecha(
              a.fecha ||
                a.created_at
            );

          const fechaB =
            obtenerFecha(
              b.fecha ||
                b.created_at
            );

          if (
            !fechaA ||
            !fechaB
          ) {
            return 0;
          }

          return (
            fechaB - fechaA
          );
        });
    }, [
      interrupcionesFiltradas,
      tareas,
      usuarios,
      departamentos,
    ]);

  // =========================================================
  // PERÍODO HUMANO
  // =========================================================

  const obtenerPeriodoTexto = () => {
    if (
      fechaDesde ||
      fechaHasta
    ) {
      if (
        fechaDesde &&
        fechaHasta
      ) {
        return `Del ${formatearFecha(
          fechaDesde
        )} al ${formatearFecha(
          fechaHasta
        )}`;
      }

      if (fechaDesde) {
        return `Desde ${formatearFecha(
          fechaDesde
        )}`;
      }

      return `Hasta ${formatearFecha(
        fechaHasta
      )}`;
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

      const anchoPagina =
        doc.internal.pageSize.getWidth();

      const altoPagina =
        doc.internal.pageSize.getHeight();

      const fechaGeneracion =
        new Date().toLocaleString(
          "es-EC"
        );

      let pagina = 1;

      // -------------------------------------------------------
      // ENCABEZADO
      // -------------------------------------------------------

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(20);

      doc.text(
        "INFORME EJECUTIVO DE GESTIÓN",
        20,
        24
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(10);

      doc.text(
        "Análisis de tareas, carga operativa e interrupciones",
        20,
        31
      );

      doc.setFontSize(9);

      doc.text(
        `Período: ${obtenerPeriodoTexto()}`,
        20,
        39
      );

      doc.text(
        `Generado: ${fechaGeneracion}`,
        20,
        45
      );

      doc.setLineWidth(0.5);

      doc.line(
        20,
        50,
        anchoPagina - 20,
        50
      );

      // -------------------------------------------------------
      // RESUMEN EJECUTIVO
      // -------------------------------------------------------

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "1. Resumen ejecutivo",
        20,
        61
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(10);

      let resumen =
        `Durante el período analizado se registraron ` +
        `${metricas.total} tareas. ` +
        `De este total, ${metricas.completadas} ` +
        `fueron completadas, lo que representa ` +
        `un cumplimiento del ${metricas.porcentajeCompletado}%. `;

      resumen +=
        `El tiempo de trabajo registrado asciende a ` +
        `${formatearDuracion(
          metricas.minutosTrabajados
        )}. `;

      resumen +=
        `Se identificaron ${metricas.interrupciones} ` +
        `interrupciones registradas durante la ejecución ` +
        `de las actividades. `;

      if (
        interrupcionesPorDepartamento.length >
        0
      ) {
        resumen +=
          `El departamento con mayor número de interrupciones fue ` +
          `${interrupcionesPorDepartamento[0].nombre}, ` +
          `con ${interrupcionesPorDepartamento[0].interrupciones} registros.`;
      }

      const resumenLineas =
        doc.splitTextToSize(
          resumen,
          anchoPagina - 40
        );

      doc.text(
        resumenLineas,
        20,
        70
      );

      // -------------------------------------------------------
      // INDICADORES
      // -------------------------------------------------------

      const yIndicadores =
        70 +
        resumenLineas.length *
          5 +
        10;

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "2. Indicadores generales",
        20,
        yIndicadores
      );

      autoTable(doc, {
        startY:
          yIndicadores + 6,

        head: [
          [
            "Indicador",
            "Resultado",
          ],
        ],

        body: [
          [
            "Total de tareas",
            metricas.total,
          ],
          [
            "Tareas completadas",
            metricas.completadas,
          ],
          [
            "Tareas en proceso",
            metricas.enProceso,
          ],
          [
            "Tareas pendientes",
            metricas.pendientes,
          ],
          [
            "Cumplimiento",
            `${metricas.porcentajeCompletado}%`,
          ],
          [
            "Tiempo trabajado",
            formatearDuracion(
              metricas.minutosTrabajados
            ),
          ],
          [
            "Tiempo estimado",
            formatearDuracion(
              metricas.tiempoEstimado
            ),
          ],
          [
            "Interrupciones",
            metricas.interrupciones,
          ],
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

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "3. Tareas por departamento solicitante",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        "Este análisis identifica qué departamentos concentran la demanda de trabajo.",
        20,
        27
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
            "Prioridad alta",
            "Tiempo",
          ],
        ],

        body:
          tareasPorDepartamento.map(
            (item) => [
              item.nombre,
              item.total,
              item.completadas,
              item.pendientes,
              item.enProceso,
              item.prioridadAlta,
              formatearDuracion(
                item.minutos
              ),
            ]
          ),

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

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "4. Interrupciones por departamento solicitante",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        "El análisis identifica qué departamentos generaron interrupciones durante la ejecución de las actividades.",
        20,
        27
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

        body:
          interrupcionesPorDepartamento.map(
            (item) => [
              item.nombre,
              item.interrupciones,
              item.tareasAfectadas,
              item.empleados,
            ]
          ),

        styles: {
          fontSize: 8,
          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------
      // INTERRUPCIONES POR EMPLEADO
      // -------------------------------------------------------

      doc.addPage();

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "5. Empleados afectados por interrupciones",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        "Los empleados representan a las personas ejecutoras de las actividades y se mide cuántas interrupciones afectaron su trabajo.",
        20,
        27
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

        body:
          interrupcionesPorEmpleado.map(
            (item) => [
              item.nombre,
              item.interrupciones,
              item.tareasAfectadas,
              item.departamentos,
            ]
          ),

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

      doc.addPage();

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "6. Detalle de interrupciones",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        "Se detalla cuándo ocurrió la interrupción, qué departamento la generó, qué empleado fue afectado y qué tarea estaba ejecutando.",
        20,
        27
      );

      autoTable(doc, {
        startY: 34,

        head: [
          [
            "Fecha",
            "Hora",
            "Departamento",
            "Empleado",
            "Tarea afectada",
            "Motivo",
          ],
        ],

        body:
          detalleInterrupciones.map(
            (item) => [
              formatearFecha(
                item.fecha ||
                  item.created_at
              ),

              item.hora ||
                "Sin hora",

              item.departamento,

              item.empleado,

              item.tarea?.titulo ||
                "Tarea no identificada",

              item.motivo ||
                "Sin motivo registrado",
            ]
          ),

        styles: {
          fontSize: 7,
          cellPadding: 2,
        },

        headStyles: {
          fontStyle: "bold",
        },

        columnStyles: {
          0: {
            cellWidth: 20,
          },

          1: {
            cellWidth: 15,
          },

          2: {
            cellWidth: 28,
          },

          3: {
            cellWidth: 30,
          },

          4: {
            cellWidth: 38,
          },

          5: {
            cellWidth: 40,
          },
        },
      });

      // -------------------------------------------------------
      // CARGA POR EMPLEADO
      // -------------------------------------------------------

      doc.addPage();

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "7. Carga operativa por empleado",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        "Los empleados representan a las personas ejecutoras de las actividades.",
        20,
        27
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

        body:
          cargaPorEmpleado.map(
            (item) => [
              item.nombre,
              item.tareas,
              item.completadas,
              item.pendientes,
              formatearDuracion(
                item.minutos
              ),
            ]
          ),

        styles: {
          fontSize: 8,
          cellPadding: 2.5,
        },

        headStyles: {
          fontStyle: "bold",
        },
      });

      // -------------------------------------------------------
      // ACTIVIDADES PRIORITARIAS
      // -------------------------------------------------------

      doc.addPage();

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "8. Actividades prioritarias",
        20,
        20
      );

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

        body:
          tareasPrioritarias.map(
            (tarea) => [
              tarea.titulo,

              obtenerNombreDepartamento(
                tarea.departamento_id
              ),

              obtenerNombreUsuario(
                tarea.responsable_id
              ),

              tarea.estado ===
              "completada"
                ? "Completada"
                : tarea.estado ===
                  "en_proceso"
                ? "En proceso"
                : "Pendiente",

              formatearDuracion(
                tarea.tiempo_trabajado_min
              ),
            ]
          ),

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

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(14);

      doc.text(
        "9. Conclusiones ejecutivas",
        20,
        20
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(10);

      const departamentoMayor =
        tareasPorDepartamento[0];

      const departamentoMayorInterrupciones =
        interrupcionesPorDepartamento[0];

      const empleadoMayorInterrupciones =
        interrupcionesPorEmpleado[0];

      const conclusiones = [
        `La organización registró ${metricas.total} tareas durante el período analizado.`,

        `El nivel de cumplimiento registrado fue del ${metricas.porcentajeCompletado}%.`,

        departamentoMayor
          ? `El departamento con mayor demanda fue ${departamentoMayor.nombre}, con ${departamentoMayor.total} tareas.`
          : "No existe información suficiente para determinar el departamento con mayor demanda.",

        departamentoMayorInterrupciones
          ? `El departamento que generó mayor cantidad de interrupciones fue ${departamentoMayorInterrupciones.nombre}, con ${departamentoMayorInterrupciones.interrupciones} registros.`
          : "No existen interrupciones registradas suficientes para identificar un departamento con mayor nivel de interrupción.",

        empleadoMayorInterrupciones
          ? `${empleadoMayorInterrupciones.nombre} fue el empleado ejecutor más afectado por interrupciones, con ${empleadoMayorInterrupciones.interrupciones} registros.`
          : "No existen interrupciones registradas suficientes para identificar un empleado ejecutor con mayor nivel de interrupción.",

        `El tiempo total registrado de trabajo fue de ${formatearDuracion(
          metricas.minutosTrabajados
        )}.`,
      ];

      let y = 32;

      conclusiones.forEach(
        (
          conclusion,
          index
        ) => {
          const lineas =
            doc.splitTextToSize(
              `${index + 1}. ${conclusion}`,
              anchoPagina - 45
            );

          doc.text(
            lineas,
            23,
            y
          );

          y +=
            lineas.length *
              5 +
            5;
        }
      );

      // -------------------------------------------------------
      // FUENTE DE DATOS
      // -------------------------------------------------------

      y += 5;

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(12);

      doc.text(
        "Fuente de información",
        20,
        y
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      y += 7;

      const fuente =
        "Los datos de este informe provienen del sistema interno de gestión de tareas, principalmente de las tablas de tareas, usuarios, departamentos e historial de interrupciones de Supabase. El informe se genera automáticamente a partir de los registros disponibles en el período seleccionado.";

      const fuenteLineas =
        doc.splitTextToSize(
          fuente,
          anchoPagina - 40
        );

      doc.text(
        fuenteLineas,
        20,
        y
      );

      // -------------------------------------------------------
      // PIE DE PÁGINA
      // -------------------------------------------------------

      const totalPaginas =
        doc.internal.getNumberOfPages();

      for (
        pagina = 1;
        pagina <=
        totalPaginas;
        pagina++
      ) {
        doc.setPage(
          pagina
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.text(
          "Informe ejecutivo de gestión — Sistema interno de tareas",
          20,
          altoPagina - 12
        );

        doc.text(
          `Página ${pagina} de ${totalPaginas}`,
          anchoPagina - 42,
          altoPagina - 12
        );
      }

      doc.save(
        `informe-ejecutivo-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error(
        "Error generando PDF:",
        err
      );

      setError(
        "No se pudo generar el informe PDF."
      );
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

          <p>
            Analizando información de gestión...
          </p>
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
          <span className="reportes-eyebrow">
            ANÁLISIS DE GESTIÓN
          </span>

          <h1>Reportes</h1>

          <p>
            Analiza la carga de trabajo,
            la demanda de los
            departamentos y las
            interrupciones durante la
            ejecución de actividades.
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
            {generandoPDF
              ? "Generando informe..."
              : "Generar informe PDF"}
          </button>

        </div>
      </header>

      {/* FILTROS */}

      <div className="reportes-filtros">

        <div className="reportes-filtro-periodo">

          <div>
            <span>
              Período de análisis
            </span>

            <strong>
              {obtenerPeriodoTexto()}
            </strong>
          </div>

          <select
            value={periodo}
            onChange={(e) =>
              setPeriodo(
                e.target.value
              )
            }
          >
            <option value="todo">
              Todo el historial
            </option>

            <option value="mes">
              Mes actual
            </option>

            <option value="trimestre">
              Últimos 3 meses
            </option>

            <option value="semestre">
              Últimos 6 meses
            </option>

            <option value="año">
              Año actual
            </option>
          </select>

        </div>

        <div className="reportes-fechas">

          <label>
            <span>
              Fecha desde
            </span>

            <input
              type="date"
              value={fechaDesde}
              onChange={(e) =>
                setFechaDesde(
                  e.target.value
                )
              }
            />
          </label>

          <label>
            <span>
              Fecha hasta
            </span>

            <input
              type="date"
              value={fechaHasta}
              onChange={(e) =>
                setFechaHasta(
                  e.target.value
                )
              }
            />
          </label>

          {(fechaDesde ||
            fechaHasta ||
            periodo !== "todo") && (
            <button
              type="button"
              className="reportes-btn-limpiar"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar filtros
            </button>
          )}

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="reportes-alerta">
          {error}
        </div>
      )}

      {/* INDICADORES */}

      <div className="reportes-stats">

        <article className="reportes-stat">
          <span>
            Tareas registradas
          </span>

          <strong>
            {metricas.total}
          </strong>

          <small>
            Actividades del período
          </small>
        </article>

        <article className="reportes-stat">
          <span>
            Completadas
          </span>

          <strong>
            {metricas.completadas}
          </strong>

          <small>
            {
              metricas.porcentajeCompletado
            }
            % de cumplimiento
          </small>
        </article>

        <article className="reportes-stat">
          <span>
            Tiempo trabajado
          </span>

          <strong className="reportes-stat-tiempo">
            {formatearDuracion(
              metricas.minutosTrabajados
            )}
          </strong>

          <small>
            Tiempo registrado
          </small>
        </article>

        <article className="reportes-stat reportes-stat-interrupciones">
          <span>
            Interrupciones
          </span>

          <strong>
            {metricas.interrupciones}
          </strong>

          <small>
            Registros de interrupción
          </small>
        </article>

      </div>

      {/* ESTADO GENERAL */}

      <div className="reportes-layout">

        <article className="reportes-panel">

          <div className="reportes-panel-header">
            <div>
              <span>
                ESTADO OPERATIVO
              </span>

              <h2>
                Situación de las tareas
              </h2>
            </div>
          </div>

          <div className="reportes-estado-grid">

            <div className="reportes-estado-item">
              <span>
                Completadas
              </span>

              <strong>
                {metricas.completadas}
              </strong>
            </div>

            <div className="reportes-estado-item">
              <span>
                En proceso
              </span>

              <strong>
                {metricas.enProceso}
              </strong>
            </div>

            <div className="reportes-estado-item">
              <span>
                Pendientes
              </span>

              <strong>
                {metricas.pendientes}
              </strong>
            </div>

          </div>

        </article>

        <article className="reportes-panel">

          <div className="reportes-panel-header">
            <div>
              <span>
                TIEMPO
              </span>

              <h2>
                Uso de jornada
              </h2>
            </div>
          </div>

          <div className="reportes-tiempo">

            <div>
              <span>
                Registrado
              </span>

              <strong>
                {formatearDuracion(
                  metricas.minutosTrabajados
                )}
              </strong>
            </div>

            <div>
              <span>
                Estimado
              </span>

              <strong>
                {formatearDuracion(
                  metricas.tiempoEstimado
                )}
              </strong>
            </div>

          </div>

        </article>

      </div>

      {/* DEPARTAMENTOS */}

      <section className="reportes-panel reportes-panel-grande">

        <div className="reportes-panel-header">
          <div>
            <span>
              DEMANDA ORGANIZACIONAL
            </span>

            <h2>
              Tareas por departamento
            </h2>

            <p>
              Departamentos solicitantes y
              volumen de actividades generadas.
            </p>
          </div>
        </div>

        {tareasPorDepartamento.length ===
        0 ? (
          <div className="reportes-vacio">
            No existen tareas para el
            período seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">

            <table className="reportes-table">

              <thead>
                <tr>
                  <th>
                    Departamento
                  </th>

                  <th>
                    Tareas
                  </th>

                  <th>
                    Completadas
                  </th>

                  <th>
                    Pendientes
                  </th>

                  <th>
                    En proceso
                  </th>

                  <th>
                    Prioridad alta
                  </th>

                  <th>
                    Tiempo
                  </th>
                </tr>
              </thead>

              <tbody>
                {tareasPorDepartamento.map(
                  (item) => (
                    <tr
                      key={
                        item.nombre
                      }
                    >
                      <td>
                        <strong>
                          {
                            item.nombre
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          item.total
                        }
                      </td>

                      <td>
                        {
                          item.completadas
                        }
                      </td>

                      <td>
                        {
                          item.pendientes
                        }
                      </td>

                      <td>
                        {
                          item.enProceso
                        }
                      </td>

                      <td>
                        {
                          item.prioridadAlta
                        }
                      </td>

                      <td>
                        {formatearDuracion(
                          item.minutos
                        )}
                      </td>
                    </tr>
                  )
                )}
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
              <span>
                INTERFERENCIAS
              </span>

              <h2>
                Interrupciones por departamento
              </h2>

              <p>
                Departamentos que generaron
                interrupciones sobre actividades
                en ejecución.
              </p>
            </div>
          </div>

          {interrupcionesPorDepartamento.length ===
          0 ? (
            <div className="reportes-vacio">
              No existen interrupciones
              registradas en este período.
            </div>
          ) : (
            <div className="reportes-lista">

              {interrupcionesPorDepartamento.map(
                (item) => (
                  <div
                    className="reportes-lista-item"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.nombre}
                      </strong>

                      <span>
                        {
                          item.tareasAfectadas
                        }{" "}
                        tareas afectadas
                      </span>
                    </div>

                    <strong className="reportes-numero-alerta">
                      {
                        item.interrupciones
                      }
                    </strong>
                  </div>
                )
              )}

            </div>
          )}

        </section>

        <section className="reportes-panel">

          <div className="reportes-panel-header">
            <div>
              <span>
                IMPACTO OPERATIVO
              </span>

              <h2>
                Empleados afectados
              </h2>

              <p>
                Personas ejecutoras cuyo trabajo
                recibió interrupciones.
              </p>
            </div>
          </div>

          {interrupcionesPorEmpleado.length ===
          0 ? (
            <div className="reportes-vacio">
              No existen interrupciones
              registradas.
            </div>
          ) : (
            <div className="reportes-lista">

              {interrupcionesPorEmpleado
                .slice(0, 8)
                .map((item) => (
                  <div
                    className="reportes-lista-item"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.nombre}
                      </strong>

                      <span>
                        {
                          item.tareasAfectadas
                        }{" "}
                        tareas afectadas
                      </span>
                    </div>

                    <strong className="reportes-numero-alerta">
                      {
                        item.interrupciones
                      }
                    </strong>
                  </div>
                ))}

            </div>
          )}

        </section>

      </div>

      {/* DETALLE DE INTERRUPCIONES */}

      <section className="reportes-panel reportes-panel-grande">

        <div className="reportes-panel-header">
          <div>
            <span>
              TRAZABILIDAD
            </span>

            <h2>
              Detalle de interrupciones
            </h2>

            <p>
              Permite identificar cuándo ocurrió
              cada interferencia, quién la generó,
              quién fue afectado y qué tarea se
              encontraba ejecutando.
            </p>
          </div>
        </div>

        {detalleInterrupciones.length ===
        0 ? (
          <div className="reportes-vacio">
            No existen interrupciones para
            mostrar en el período seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">

            <table className="reportes-table">

              <thead>
                <tr>
                  <th>
                    Fecha
                  </th>

                  <th>
                    Hora
                  </th>

                  <th>
                    Departamento
                  </th>

                  <th>
                    Empleado ejecutor
                  </th>

                  <th>
                    Tarea afectada
                  </th>

                  <th>
                    Motivo
                  </th>
                </tr>
              </thead>

              <tbody>
                {detalleInterrupciones
                  .slice(0, 15)
                  .map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          {formatearFecha(
                            item.fecha ||
                              item.created_at
                          )}
                        </td>

                        <td>
                          {
                            item.hora
                          }
                        </td>

                        <td>
                          {
                            item.departamento
                          }
                        </td>

                        <td>
                          <strong>
                            {
                              item.empleado
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            item.tarea
                              ?.titulo ||
                            "Tarea no identificada"
                          }
                        </td>

                        <td>
                          {
                            item.motivo ||
                            "Sin motivo registrado"
                          }
                        </td>
                      </tr>
                    )
                  )}
              </tbody>

            </table>

          </div>
        )}

        {detalleInterrupciones.length >
          15 && (
          <div className="reportes-nota-tabla">
            Se muestran las 15 interrupciones
            más recientes en pantalla. El
            informe PDF contiene el detalle
            completo.
          </div>
        )}

      </section>

      {/* CARGA POR EMPLEADO */}

      <section className="reportes-panel reportes-panel-grande">

        <div className="reportes-panel-header">
          <div>
            <span>
              CAPACIDAD OPERATIVA
            </span>

            <h2>
              Carga de trabajo por empleado
            </h2>

            <p>
              Distribución de las actividades
              ejecutadas por las personas
              responsables.
            </p>
          </div>
        </div>

        {cargaPorEmpleado.length ===
        0 ? (
          <div className="reportes-vacio">
            No existen datos de carga
            operativa para este período.
          </div>
        ) : (
          <div className="reportes-table-wrapper">

            <table className="reportes-table">

              <thead>
                <tr>
                  <th>
                    Empleado
                  </th>

                  <th>
                    Tareas
                  </th>

                  <th>
                    Completadas
                  </th>

                  <th>
                    Pendientes
                  </th>

                  <th>
                    Tiempo trabajado
                  </th>
                </tr>
              </thead>

              <tbody>
                {cargaPorEmpleado.map(
                  (item) => (
                    <tr
                      key={item.id}
                    >
                      <td>
                        <strong>
                          {
                            item.nombre
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          item.tareas
                        }
                      </td>

                      <td>
                        {
                          item.completadas
                        }
                      </td>

                      <td>
                        {
                          item.pendientes
                        }
                      </td>

                      <td>
                        {formatearDuracion(
                          item.minutos
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* PRIORIDADES */}

      <section className="reportes-panel reportes-panel-grande">

        <div className="reportes-panel-header">
          <div>
            <span>
              SEGUIMIENTO
            </span>

            <h2>
              Actividades prioritarias
            </h2>

            <p>
              Actividades de prioridad alta
              dentro del período analizado.
            </p>
          </div>
        </div>

        {tareasPrioritarias.length ===
        0 ? (
          <div className="reportes-vacio">
            No existen actividades
            prioritarias para mostrar.
          </div>
        ) : (
          <div className="reportes-table-wrapper">

            <table className="reportes-table">

              <thead>
                <tr>
                  <th>
                    Actividad
                  </th>

                  <th>
                    Departamento
                  </th>

                  <th>
                    Ejecutor
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Tiempo
                  </th>
                </tr>
              </thead>

              <tbody>
                {tareasPrioritarias.map(
                  (tarea) => (
                    <tr
                      key={
                        tarea.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            tarea.titulo
                          }
                        </strong>
                      </td>

                      <td>
                        {obtenerNombreDepartamento(
                          tarea.departamento_id
                        )}
                      </td>

                      <td>
                        {obtenerNombreUsuario(
                          tarea.responsable_id
                        )}
                      </td>

                      <td>
                        <span className="reportes-estado">
                          {tarea.estado ===
                          "completada"
                            ? "Completada"
                            : tarea.estado ===
                              "en_proceso"
                            ? "En proceso"
                            : "Pendiente"}
                        </span>
                      </td>

                      <td>
                        {formatearDuracion(
                          tarea.tiempo_trabajado_min
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>

    </section>
  );
}

export default Reportes;