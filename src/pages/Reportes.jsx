import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Reportes.css";

function Reportes() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // =========================================================
  // FILTRO DE FECHAS
  // =========================================================

  const hoy = new Date().toISOString().split("T")[0];

  const [fechaDesde, setFechaDesde] = useState(
    `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1
    ).padStart(2, "0")}-01`
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
        throw new Error("No se pudieron cargar las tareas.");
      }

      if (usuariosError) {
        console.error("Error usuarios:", usuariosError);
      }

      if (departamentosError) {
        console.error("Error departamentos:", departamentosError);
      }

      setTareas(tareasData || []);
      setUsuarios(usuariosData || []);
      setDepartamentos(departamentosData || []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "No se pudieron cargar los reportes."
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // NOMBRES
  // =========================================================

  const obtenerUsuario = (id) => {
    return usuarios.find((usuario) => usuario.id === id) || null;
  };

  const obtenerDepartamento = (id) => {
    return (
      departamentos.find(
        (departamento) => departamento.id === id
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
    const departamento = obtenerDepartamento(id);

    return departamento?.nombre || "Sin departamento";
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const convertirFecha = (fecha) => {
    if (!fecha) return null;

    const fechaObj = new Date(`${fecha}T00:00:00`);

    return Number.isNaN(fechaObj.getTime())
      ? null
      : fechaObj;
  };

  const formatearFecha = (fecha) => {
    const fechaObj = convertirFecha(fecha);

    if (!fechaObj) {
      return "Sin fecha";
    }

    return fechaObj.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // =========================================================
  // FECHA/HORA PARA COMPARACIONES
  // =========================================================

  const obtenerFechaInicio = (tarea) => {
    if (!tarea.fecha_inicio) return null;

    const hora = tarea.hora_inicio || "00:00";

    return new Date(
      `${tarea.fecha_inicio}T${hora}:00`
    );
  };

  const obtenerFechaFin = (tarea) => {
    if (!tarea.fecha_fin) return null;

    const hora = tarea.hora_fin || "23:59";

    return new Date(
      `${tarea.fecha_fin}T${hora}:00`
    );
  };

  // =========================================================
  // COMPROBAR SI DOS TAREAS SE SUPERPONEN
  // =========================================================

  const tareasSeSuperponen = (tareaA, tareaB) => {
    if (
      !tareaA.fecha_inicio ||
      !tareaB.fecha_inicio ||
      !tareaA.fecha_fin ||
      !tareaB.fecha_fin
    ) {
      return false;
    }

    const inicioA = obtenerFechaInicio(tareaA);
    const finA = obtenerFechaFin(tareaA);

    const inicioB = obtenerFechaInicio(tareaB);
    const finB = obtenerFechaFin(tareaB);

    if (!inicioA || !finA || !inicioB || !finB) {
      return false;
    }

    return inicioA <= finB && inicioB <= finA;
  };

  // =========================================================
  // COMPROBAR SI LA FECHA DE UNA TAREA ESTÁ DENTRO
  // DE OTRA PLANIFICACIÓN
  // =========================================================

  const tareaDentroDeOtra = (nuevaTarea, tareaExistente) => {
    if (
      !nuevaTarea.fecha_inicio ||
      !tareaExistente.fecha_inicio ||
      !tareaExistente.fecha_fin
    ) {
      return false;
    }

    const nuevaInicio = convertirFecha(
      nuevaTarea.fecha_inicio
    );

    const existenteInicio = convertirFecha(
      tareaExistente.fecha_inicio
    );

    const existenteFin = convertirFecha(
      tareaExistente.fecha_fin
    );

    if (
      !nuevaInicio ||
      !existenteInicio ||
      !existenteFin
    ) {
      return false;
    }

    return (
      nuevaInicio >= existenteInicio &&
      nuevaInicio <= existenteFin
    );
  };

  // =========================================================
  // TAREAS DENTRO DEL PERÍODO SELECCIONADO
  // =========================================================

  const tareasPeriodo = useMemo(() => {
    if (!fechaDesde || !fechaHasta) {
      return [];
    }

    const desde = convertirFecha(fechaDesde);
    const hasta = convertirFecha(fechaHasta);

    if (!desde || !hasta) {
      return [];
    }

    hasta.setHours(23, 59, 59, 999);

    return tareas.filter((tarea) => {
      if (!tarea.fecha_inicio) {
        return false;
      }

      const inicio = convertirFecha(
        tarea.fecha_inicio
      );

      const fin = convertirFecha(
        tarea.fecha_fin || tarea.fecha_inicio
      );

      if (!inicio || !fin) {
        return false;
      }

      return inicio <= hasta && fin >= desde;
    });
  }, [tareas, fechaDesde, fechaHasta]);

  // =========================================================
  // DETECTAR TRABAJO INCORPORADO
  // =========================================================

  const actividadesIncorporadas = useMemo(() => {
    const resultado = [];

    tareasPeriodo.forEach((tarea) => {
      if (!tarea.responsable_id) {
        return;
      }

      const posiblesAnteriores = tareas
        .filter((otra) => {
          if (otra.id === tarea.id) {
            return false;
          }

          if (
            otra.responsable_id !==
            tarea.responsable_id
          ) {
            return false;
          }

          if (
            !otra.fecha_inicio ||
            !otra.fecha_fin
          ) {
            return false;
          }

          return (
            otra.fecha_inicio <= tarea.fecha_inicio
          );
        })
        .sort((a, b) => {
          const fechaA = convertirFecha(
            a.fecha_inicio
          );

          const fechaB = convertirFecha(
            b.fecha_inicio
          );

          return (
            (fechaB?.getTime() || 0) -
            (fechaA?.getTime() || 0)
          );
        });

      const planificacionExistente =
        posiblesAnteriores.find((otra) =>
          tareaDentroDeOtra(tarea, otra)
        );

      if (!planificacionExistente) {
        return;
      }

      const superpuesta = tareasSeSuperponen(
        tarea,
        planificacionExistente
      );

      resultado.push({
        nueva: tarea,
        existente: planificacionExistente,
        superpuesta,
      });
    });

    return resultado;
  }, [tareas, tareasPeriodo]);

  // =========================================================
  // MÉTRICAS
  // =========================================================

  const metricas = useMemo(() => {
    const total = tareasPeriodo.length;

    const completadas = tareasPeriodo.filter(
      (tarea) => tarea.estado === "completada"
    ).length;

    const pendientes = tareasPeriodo.filter(
      (tarea) => tarea.estado === "pendiente"
    ).length;

    const enProceso = tareasPeriodo.filter(
      (tarea) => tarea.estado === "en_proceso"
    ).length;

    const tiempo = tareasPeriodo.reduce(
      (total, tarea) =>
        total +
        Number(tarea.tiempo_estimado || 0),
      0
    );

    const personas = new Set(
      tareasPeriodo
        .map((tarea) => tarea.responsable_id)
        .filter(Boolean)
    ).size;

    const departamentos = new Set(
      tareasPeriodo
        .map((tarea) => tarea.departamento_id)
        .filter(Boolean)
    ).size;

    const superpuestas =
      actividadesIncorporadas.filter(
        (actividad) => actividad.superpuesta
      ).length;

    return {
      total,
      completadas,
      pendientes,
      enProceso,
      tiempo,
      personas,
      departamentos,
      incorporadas:
        actividadesIncorporadas.length,
      superpuestas,
    };
  }, [tareasPeriodo, actividadesIncorporadas]);

  // =========================================================
  // RENDIMIENTO POR PERSONA
  // =========================================================

  const rendimientoPersonas = useMemo(() => {
    return usuarios
      .map((usuario) => {
        const tareasPersona =
          tareasPeriodo.filter(
            (tarea) =>
              tarea.responsable_id === usuario.id
          );

        const incorporadas =
          actividadesIncorporadas.filter(
            (actividad) =>
              actividad.nueva.responsable_id ===
              usuario.id
          ).length;

        const tiempo = tareasPersona.reduce(
          (total, tarea) =>
            total +
            Number(tarea.tiempo_estimado || 0),
          0
        );

        return {
          id: usuario.id,
          nombre:
            `${usuario.nombre || ""} ${
              usuario.apellido || ""
            }`.trim(),
          total: tareasPersona.length,
          completadas: tareasPersona.filter(
            (tarea) =>
              tarea.estado === "completada"
          ).length,
          enProceso: tareasPersona.filter(
            (tarea) =>
              tarea.estado === "en_proceso"
          ).length,
          pendientes: tareasPersona.filter(
            (tarea) =>
              tarea.estado === "pendiente"
          ).length,
          incorporadas,
          tiempo,
        };
      })
      .filter((persona) => persona.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [
    usuarios,
    tareasPeriodo,
    actividadesIncorporadas,
  ]);

  // =========================================================
  // RENDIMIENTO POR DEPARTAMENTO
  // =========================================================

  const rendimientoDepartamentos =
    useMemo(() => {
      return departamentos
        .map((departamento) => {
          const tareasDepartamento =
            tareasPeriodo.filter(
              (tarea) =>
                tarea.departamento_id ===
                departamento.id
            );

          const incorporadas =
            actividadesIncorporadas.filter(
              (actividad) =>
                actividad.nueva.departamento_id ===
                departamento.id
            ).length;

          const tiempo =
            tareasDepartamento.reduce(
              (total, tarea) =>
                total +
                Number(
                  tarea.tiempo_estimado || 0
                ),
              0
            );

          return {
            id: departamento.id,
            nombre: departamento.nombre,
            total: tareasDepartamento.length,
            incorporadas,
            tiempo,
          };
        })
        .filter(
          (departamento) =>
            departamento.total > 0
        )
        .sort((a, b) => b.total - a.total);
    }, [
      departamentos,
      tareasPeriodo,
      actividadesIncorporadas,
    ]);

  // =========================================================
  // FORMATEAR TIEMPO
  // =========================================================

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
  // FORMATO HORA
  // =========================================================

  const formatearHora = (hora) => {
    if (!hora) {
      return "Sin hora";
    }

    return hora.substring(0, 5);
  };

  // =========================================================
  // EXPORTAR PDF
  // =========================================================

  const descargarPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const azul = [7, 74, 123];
    const oscuro = [23, 32, 51];
    const gris = [100, 110, 125];

    let y = 18;

    // -------------------------------------------------------
    // ENCABEZADO
    // -------------------------------------------------------

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...azul);

    doc.text(
      "INFORME DE GESTIÓN DE ACTIVIDADES",
      14,
      y
    );

    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...gris);

    doc.text(
      `Período analizado: ${formatearFecha(
        fechaDesde
      )} - ${formatearFecha(fechaHasta)}`,
      14,
      y
    );

    y += 5;

    doc.text(
      `Fecha de generación: ${formatearFecha(
        hoy
      )}`,
      14,
      y
    );

    y += 10;

    // -------------------------------------------------------
    // RESUMEN
    // -------------------------------------------------------

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text("1. Resumen del período", 14, y);

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Tareas",
          "Personas",
          "Departamentos",
          "Tiempo estimado",
          "Incorporadas",
          "Superpuestas",
        ],
      ],
      body: [
        [
          metricas.total,
          metricas.personas,
          metricas.departamentos,
          formatearMinutos(metricas.tiempo),
          metricas.incorporadas,
          metricas.superpuestas,
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: azul,
        textColor: 255,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    // -------------------------------------------------------
    // ESTADOS
    // -------------------------------------------------------

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text("2. Estado de las actividades", 14, y);

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Completadas",
          "En proceso",
          "Pendientes",
        ],
      ],
      body: [
        [
          metricas.completadas,
          metricas.enProceso,
          metricas.pendientes,
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: azul,
        textColor: 255,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    // -------------------------------------------------------
    // ACTIVIDADES INCORPORADAS
    // -------------------------------------------------------

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text(
      "3. Actividades incorporadas sobre planificación existente",
      14,
      y
    );

    y += 5;

    if (actividadesIncorporadas.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...gris);

      doc.text(
        "No se detectaron actividades incorporadas sobre una planificación existente.",
        14,
        y + 5
      );

      y += 15;
    } else {
      const filas =
        actividadesIncorporadas.map(
          (actividad) => {
            const nueva = actividad.nueva;
            const existente =
              actividad.existente;

            return [
              formatearFecha(
                nueva.fecha_inicio
              ),
              obtenerNombreUsuario(
                nueva.responsable_id
              ),
              obtenerNombreDepartamento(
                nueva.departamento_id
              ),
              nueva.titulo || "Sin título",
              existente.titulo ||
                "Sin título",
              actividad.superpuesta
                ? "Coincidencia horaria"
                : "Dentro de planificación",
            ];
          }
        );

      autoTable(doc, {
        startY: y,
        head: [
          [
            "Fecha",
            "Responsable",
            "Departamento",
            "Nueva actividad",
            "Planificación existente",
            "Resultado",
          ],
        ],
        body: filas,
        theme: "grid",
        headStyles: {
          fillColor: azul,
          textColor: 255,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
      });

      y = doc.lastAutoTable.finalY + 12;
    }

    // -------------------------------------------------------
    // PERSONAS
    // -------------------------------------------------------

    if (y > 170) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text("4. Carga de trabajo por persona", 14, y);

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Responsable",
          "Tareas",
          "Completadas",
          "En proceso",
          "Pendientes",
          "Incorporadas",
          "Tiempo",
        ],
      ],
      body: rendimientoPersonas.map(
        (persona) => [
          persona.nombre,
          persona.total,
          persona.completadas,
          persona.enProceso,
          persona.pendientes,
          persona.incorporadas,
          formatearMinutos(persona.tiempo),
        ]
      ),
      theme: "grid",
      headStyles: {
        fillColor: azul,
        textColor: 255,
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    // -------------------------------------------------------
    // DEPARTAMENTOS
    // -------------------------------------------------------

    if (y > 170) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text(
      "5. Solicitudes por departamento",
      14,
      y
    );

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Departamento",
          "Solicitudes",
          "Incorporadas",
          "Tiempo estimado",
        ],
      ],
      body: rendimientoDepartamentos.map(
        (departamento) => [
          departamento.nombre,
          departamento.total,
          departamento.incorporadas,
          formatearMinutos(
            departamento.tiempo
          ),
        ]
      ),
      theme: "grid",
      headStyles: {
        fillColor: azul,
        textColor: 255,
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
    });

    y = doc.lastAutoTable.finalY + 12;

    // -------------------------------------------------------
    // DETALLE
    // -------------------------------------------------------

    doc.addPage();
    y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...oscuro);

    doc.text(
      "6. Detalle de actividades del período",
      14,
      y
    );

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Actividad",
          "Responsable",
          "Departamento",
          "Inicio",
          "Fin",
          "Estado",
          "Tiempo",
        ],
      ],
      body: tareasPeriodo.map((tarea) => [
        tarea.titulo || "Sin título",
        obtenerNombreUsuario(
          tarea.responsable_id
        ),
        obtenerNombreDepartamento(
          tarea.departamento_id
        ),
        `${formatearFecha(
          tarea.fecha_inicio
        )} ${formatearHora(
          tarea.hora_inicio
        )}`,
        `${formatearFecha(
          tarea.fecha_fin
        )} ${formatearHora(
          tarea.hora_fin
        )}`,
        tarea.estado || "Sin estado",
        formatearMinutos(
          tarea.tiempo_estimado
        ),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: azul,
        textColor: 255,
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
    });

    // -------------------------------------------------------
    // CONCLUSIÓN
    // -------------------------------------------------------

    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...azul);

    doc.text(
      "7. Conclusión del período",
      14,
      y
    );

    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...oscuro);

    const porcentaje =
      metricas.total > 0
        ? (
            (metricas.incorporadas /
              metricas.total) *
            100
          ).toFixed(1)
        : "0.0";

    const texto = `Durante el período comprendido entre ${formatearFecha(
      fechaDesde
    )} y ${formatearFecha(
      fechaHasta
    )}, se registraron ${
      metricas.total
    } actividades correspondientes a ${
      metricas.personas
    } personas y ${
      metricas.departamentos
    } departamentos.

Del total analizado, ${
      metricas.incorporadas
    } actividades fueron identificadas como incorporadas sobre una planificación existente, lo que representa el ${porcentaje}% de las actividades del período.

Se identificaron ${
      metricas.superpuestas
    } actividades con coincidencia horaria respecto de otra actividad previamente planificada para el mismo responsable.

El objetivo de esta medición es identificar la carga adicional que se incorpora sobre trabajos que ya habían sido planificados, permitiendo observar cómo se distribuye el trabajo y qué solicitudes generan mayor presión sobre la planificación existente.`;

    const lineas = doc.splitTextToSize(
      texto,
      260
    );

    doc.text(lineas, 14, y);

    // -------------------------------------------------------
    // PIE
    // -------------------------------------------------------

    const paginas =
      doc.internal.getNumberOfPages();

    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);

      doc.text(
        `Informe de gestión | Página ${i} de ${paginas}`,
        14,
        200
      );
    }

    doc.save(
      `informe-gestion-${fechaDesde}-${fechaHasta}.pdf`
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
          <p>Generando reporte...</p>
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
            No se pudo generar el reporte
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

          <h1>Reporte de trabajo</h1>

          <p>
            Analiza la carga de trabajo,
            planificación y actividades
            incorporadas durante un período
            específico.
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
            Descargar informe
          </button>
        </div>
      </div>

      {/* FILTROS */}

      <div className="reportes-filtros">
        <div className="reporte-filtro">
          <label>Fecha desde</label>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) =>
              setFechaDesde(e.target.value)
            }
          />
        </div>

        <div className="reporte-filtro">
          <label>Fecha hasta</label>

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) =>
              setFechaHasta(e.target.value)
            }
          />
        </div>

        <div className="reporte-filtro-info">
          <span>Período seleccionado</span>

          <strong>
            {formatearFecha(fechaDesde)} -{" "}
            {formatearFecha(fechaHasta)}
          </strong>
        </div>

        <div className="reporte-filtro-info">
          <span>Actividades analizadas</span>

          <strong>{metricas.total}</strong>
        </div>
      </div>

      {/* RESUMEN */}

      <div className="reportes-resumen">
        <article className="reporte-metrica">
          <span>Tareas</span>
          <strong>{metricas.total}</strong>
          <small>
            Actividades del período
          </small>
        </article>

        <article className="reporte-metrica">
          <span>Personas</span>
          <strong>{metricas.personas}</strong>
          <small>
            Integrantes con actividades
          </small>
        </article>

        <article className="reporte-metrica">
          <span>Tiempo estimado</span>
          <strong>
            {formatearMinutos(
              metricas.tiempo
            )}
          </strong>
          <small>
            Carga registrada
          </small>
        </article>

        <article className="reporte-metrica reporte-metrica-alerta">
          <span>Incorporadas</span>
          <strong>
            {metricas.incorporadas}
          </strong>
          <small>
            Sobre planificación existente
          </small>
        </article>
      </div>

      {/* ALERTA PRINCIPAL */}

      <section className="reporte-destacado">
        <div>
          <span>DETECCIÓN DE CARGA ADICIONAL</span>

          <h2>
            Actividades incorporadas sobre
            planificación existente
          </h2>

          <p>
            Se detectan cuando una persona
            recibe una nueva actividad cuya
            fecha se encuentra dentro del
            período de otra actividad que ya
            tenía planificada.
          </p>
        </div>

        <div className="reporte-destacado-numero">
          <strong>
            {metricas.incorporadas}
          </strong>

          <span>detectadas</span>
        </div>
      </section>

      {/* DETALLE INCORPORADAS */}

      <section className="reporte-card">
        <div className="reporte-card-header">
          <div>
            <span className="reporte-eyebrow">
              ÚLTIMA HORA
            </span>

            <h2>
              Actividades incorporadas
            </h2>

            <p>
              Trabajos que fueron registrados
              dentro de una planificación que
              ya existía para el mismo responsable.
            </p>
          </div>
        </div>

        {actividadesIncorporadas.length ===
        0 ? (
          <div className="reporte-vacio">
            <strong>
              No se detectaron actividades
              incorporadas.
            </strong>

            <span>
              En este período no existen
              actividades nuevas dentro de
              otra planificación.
            </span>
          </div>
        ) : (
          <div className="tabla-contenedor">
            <table className="reporte-tabla">
              <thead>
                <tr>
                  <th>Nueva actividad</th>
                  <th>Responsable</th>
                  <th>Departamento</th>
                  <th>Planificación existente</th>
                  <th>Fecha</th>
                  <th>Resultado</th>
                </tr>
              </thead>

              <tbody>
                {actividadesIncorporadas.map(
                  (actividad, index) => (
                    <tr
                      key={`${actividad.nueva.id}-${index}`}
                    >
                      <td>
                        <strong>
                          {
                            actividad.nueva
                              .titulo
                          }
                        </strong>
                      </td>

                      <td>
                        {obtenerNombreUsuario(
                          actividad.nueva
                            .responsable_id
                        )}
                      </td>

                      <td>
                        {obtenerNombreDepartamento(
                          actividad.nueva
                            .departamento_id
                        )}
                      </td>

                      <td>
                        {
                          actividad.existente
                            .titulo
                        }
                      </td>

                      <td>
                        {formatearFecha(
                          actividad.nueva
                            .fecha_inicio
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            actividad.superpuesta
                              ? "reporte-badge reporte-badge-imprevisto"
                              : "reporte-badge reporte-badge-planificado"
                          }
                        >
                          {actividad.superpuesta
                            ? "Coincidencia horaria"
                            : "Sobre planificación"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* PERSONAS */}

      <section className="reporte-card">
        <div className="reporte-card-header">
          <div>
            <span className="reporte-eyebrow">
              EQUIPO
            </span>

            <h2>
              Carga de trabajo por persona
            </h2>

            <p>
              Permite identificar qué personas
              recibieron mayor cantidad de
              actividades adicionales.
            </p>
          </div>
        </div>

        <div className="tabla-contenedor">
          <table className="reporte-tabla">
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Tareas</th>
                <th>Completadas</th>
                <th>En proceso</th>
                <th>Pendientes</th>
                <th>Incorporadas</th>
                <th>Tiempo</th>
              </tr>
            </thead>

            <tbody>
              {rendimientoPersonas.map(
                (persona) => (
                  <tr key={persona.id}>
                    <td>
                      <strong>
                        {persona.nombre}
                      </strong>
                    </td>

                    <td>{persona.total}</td>

                    <td>
                      <span className="estado estado-completado">
                        {persona.completadas}
                      </span>
                    </td>

                    <td>
                      <span className="estado estado-proceso">
                        {persona.enProceso}
                      </span>
                    </td>

                    <td>
                      <span className="estado estado-pendiente">
                        {persona.pendientes}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          persona.incorporadas > 0
                            ? "reporte-badge reporte-badge-imprevisto"
                            : "reporte-badge reporte-badge-planificado"
                        }
                      >
                        {persona.incorporadas}
                      </span>
                    </td>

                    <td>
                      {formatearMinutos(
                        persona.tiempo
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DEPARTAMENTOS */}

      <section className="reporte-card">
        <div className="reporte-card-header">
          <div>
            <span className="reporte-eyebrow">
              DEPARTAMENTOS
            </span>

            <h2>
              Solicitudes por departamento
            </h2>

            <p>
              Identifica qué departamentos
              generan más trabajo y cuántas de
              sus solicitudes se incorporan sobre
              actividades existentes.
            </p>
          </div>
        </div>

        <div className="tabla-contenedor">
          <table className="reporte-tabla">
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Solicitudes</th>
                <th>Incorporadas</th>
                <th>Tiempo estimado</th>
              </tr>
            </thead>

            <tbody>
              {rendimientoDepartamentos.map(
                (departamento) => (
                  <tr key={departamento.id}>
                    <td>
                      <strong>
                        {departamento.nombre}
                      </strong>
                    </td>

                    <td>
                      {departamento.total}
                    </td>

                    <td>
                      <span
                        className={
                          departamento.incorporadas >
                          0
                            ? "reporte-badge reporte-badge-imprevisto"
                            : "reporte-badge reporte-badge-planificado"
                        }
                      >
                        {
                          departamento.incorporadas
                        }
                      </span>
                    </td>

                    <td>
                      {formatearMinutos(
                        departamento.tiempo
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* TODAS LAS TAREAS */}

      <section className="reporte-card">
        <div className="reporte-card-header">
          <div>
            <span className="reporte-eyebrow">
              DETALLE
            </span>

            <h2>
              Actividades del período
            </h2>

            <p>
              Detalle completo de las actividades
              incluidas en el período seleccionado.
            </p>
          </div>
        </div>

        <div className="tabla-contenedor">
          <table className="reporte-tabla">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Responsable</th>
                <th>Departamento</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Tiempo</th>
              </tr>
            </thead>

            <tbody>
              {tareasPeriodo.map((tarea) => (
                <tr key={tarea.id}>
                  <td>
                    <strong>
                      {tarea.titulo ||
                        "Sin título"}
                    </strong>
                  </td>

                  <td>
                    {obtenerNombreUsuario(
                      tarea.responsable_id
                    )}
                  </td>

                  <td>
                    {obtenerNombreDepartamento(
                      tarea.departamento_id
                    )}
                  </td>

                  <td>
                    {formatearFecha(
                      tarea.fecha_inicio
                    )}

                    <small className="hora">
                      {formatearHora(
                        tarea.hora_inicio
                      )}
                    </small>
                  </td>

                  <td>
                    {formatearFecha(
                      tarea.fecha_fin
                    )}

                    <small className="hora">
                      {formatearHora(
                        tarea.hora_fin
                      )}
                    </small>
                  </td>

                  <td>
                    <span className="estado">
                      {tarea.estado ||
                        "Sin estado"}
                    </span>
                  </td>

                  <td>
                    {formatearMinutos(
                      tarea.tiempo_estimado
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* METODOLOGÍA */}

      <section className="reporte-nota">
        <strong>
          ¿Cómo se detectan las actividades
          incorporadas?
        </strong>

        <p>
          El sistema compara las actividades
          asignadas a una misma persona. Cuando
          una actividad nueva comienza dentro
          del período de una actividad que ya
          estaba planificada, se identifica como
          una actividad incorporada sobre una
          planificación existente.
        </p>

        <p>
          Si además existen horas registradas,
          el sistema comprueba si existe una
          coincidencia horaria entre ambas
          actividades.
        </p>

        <p>
          Esta medición se realiza únicamente
          en el reporte y no modifica los datos
          almacenados en Supabase.
        </p>
      </section>
    </section>
  );
}

export default Reportes;