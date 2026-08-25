import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Reportes.css";

function Reportes() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError("");

    try {
      const [tareasResponse, usuariosResponse] = await Promise.all([
        supabase
          .from("tareas")
          .select(
            `
            id,
            titulo,
            descripcion,
            fecha,
            fecha_inicio,
            fecha_fin,
            hora_inicio,
            hora_fin,
            tiempo_estimado,
            prioridad,
            estado,
            responsable_id,
            created_at
          `,
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("usuarios")
          .select(
            `
            id,
            nombre,
            apellido,
            email,
            rol,
            departamentos (
              nombre
            )
          `,
          )
          .order("nombre"),
      ]);

      if (tareasResponse.error) {
        throw tareasResponse.error;
      }

      if (usuariosResponse.error) {
        throw usuariosResponse.error;
      }

      setTareas(tareasResponse.data || []);
      setUsuarios(usuariosResponse.data || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      setError("No se pudieron cargar los datos del reporte.");
    } finally {
      setCargando(false);
    }
  };

  // ============================================================
  // MAPA DE USUARIOS
  // ============================================================

  const usuariosMap = useMemo(() => {
    const mapa = {};

    usuarios.forEach((usuario) => {
      mapa[usuario.id] = usuario;
    });

    return mapa;
  }, [usuarios]);

  // ============================================================
  // FUNCIONES AUXILIARES
  // ============================================================

  const obtenerNombreResponsable = (responsableId) => {
    const usuario = usuariosMap[responsableId];

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();
  };

  const obtenerDepartamento = (responsableId) => {
    const usuario = usuariosMap[responsableId];

    return usuario?.departamentos?.nombre || "Sin departamento";
  };

  const formatearMinutos = (minutos) => {
    if (!minutos) {
      return "0 min";
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    if (minutosRestantes === 0) {
      return `${horas} h`;
    }

    return `${horas} h ${minutosRestantes} min`;
  };

  const porcentaje = (cantidad, total) => {
    if (!total) {
      return 0;
    }

    return Math.round((cantidad / total) * 100);
  };

  // ============================================================
  // ESTADÍSTICAS GENERALES
  // ============================================================

  const estadisticas = useMemo(() => {
    const total = tareas.length;

    const pendientes = tareas.filter(
      (tarea) => tarea.estado === "pendiente",
    ).length;

    const enProceso = tareas.filter(
      (tarea) =>
        tarea.estado === "en_proceso" || tarea.estado === "en_progreso",
    ).length;

    const completadas = tareas.filter(
      (tarea) => tarea.estado === "completada",
    ).length;

    const altaPrioridad = tareas.filter(
      (tarea) => tarea.prioridad === "alta",
    ).length;

    const tiempoTotal = tareas.reduce(
      (total, tarea) => total + Number(tarea.tiempo_estimado || 0),
      0,
    );

    const promedio = total > 0 ? Math.round(tiempoTotal / total) : 0;

    return {
      total,
      pendientes,
      enProceso,
      completadas,
      altaPrioridad,
      tiempoTotal,
      promedio,
    };
  }, [tareas]);

  // ============================================================
  // TAREAS SOLICITADAS CON POCA ANTICIPACIÓN
  // ============================================================

  const tareasUltimaHora = useMemo(() => {
    return tareas
      .map((tarea) => {
        if (!tarea.created_at || !tarea.fecha_inicio) {
          return null;
        }

        const creada = new Date(tarea.created_at);

        // --------------------------------------------------------
        // CONVERTIR FECHA DE INICIO
        // --------------------------------------------------------

        let fecha = tarea.fecha_inicio;

        // Si viene como YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          // Se mantiene ese formato
        }

        // Si viene como MM/DD/YYYY
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
          const [mes, dia, anio] = fecha.split("/");

          fecha = `${anio}-${mes}-${dia}`;
        }

        // --------------------------------------------------------
        // CONVERTIR HORA
        // --------------------------------------------------------

        let hora = tarea.hora_inicio || "00:00";

        // Si viene como 04:30 PM
        const hora12 = hora.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

        if (hora12) {
          let horas = Number(hora12[1]);
          const minutos = hora12[2];
          const periodo = hora12[3].toUpperCase();

          if (periodo === "PM" && horas !== 12) {
            horas += 12;
          }

          if (periodo === "AM" && horas === 12) {
            horas = 0;
          }

          hora = `${String(horas).padStart(2, "0")}:${minutos}`;
        }

        // --------------------------------------------------------
        // CREAR FECHA COMPLETA
        // --------------------------------------------------------

        const horaInicio = tarea.hora_inicio
          ? String(tarea.hora_inicio).slice(0, 8)
          : "00:00:00";

        const fechaInicio = new Date(`${tarea.fecha_inicio}T${horaInicio}`);

        // --------------------------------------------------------
        // DEBUG
        // --------------------------------------------------------

        console.log("=================================");
        console.log("TAREA:", tarea.titulo);
        console.log("Fecha guardada:", tarea.fecha_inicio);
        console.log("Hora guardada:", tarea.hora_inicio);
        console.log("Creada:", creada);
        console.log("Inicio:", fechaInicio);

        // Si la fecha sigue siendo inválida, ignoramos la tarea
        if (isNaN(fechaInicio.getTime())) {
          console.warn("❌ No se pudo convertir la fecha de inicio:", tarea);

          return null;
        }

        // --------------------------------------------------------
        // CALCULAR ANTICIPACIÓN
        // --------------------------------------------------------

        const diferencia = (fechaInicio.getTime() - creada.getTime()) / 60000;

        console.log("Anticipación:", diferencia, "minutos");

        return {
          ...tarea,
          minutosAnticipacion: diferencia,
        };
      })

      .filter(
        (tarea) =>
          tarea &&
          tarea.minutosAnticipacion >= 0 &&
          tarea.minutosAnticipacion <= 120,
      )

      .sort((a, b) => a.minutosAnticipacion - b.minutosAnticipacion);
  }, [tareas]);

  // ============================================================
  // DEPARTAMENTOS
  // ============================================================

  const departamentos = useMemo(() => {
    const conteo = {};

    tareas.forEach((tarea) => {
      const departamento = obtenerDepartamento(tarea.responsable_id);

      if (!conteo[departamento]) {
        conteo[departamento] = 0;
      }

      conteo[departamento]++;
    });

    return Object.entries(conteo)
      .map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [tareas, usuariosMap]);

  // ============================================================
  // RESPONSABLES
  // ============================================================

  const responsables = useMemo(() => {
    const conteo = {};

    tareas.forEach((tarea) => {
      if (!tarea.responsable_id) {
        return;
      }

      const usuario = usuariosMap[tarea.responsable_id];

      if (!usuario) {
        return;
      }

      const nombre = `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();

      if (!conteo[usuario.id]) {
        conteo[usuario.id] = {
          nombre: nombre || "Usuario",
          cantidad: 0,
        };
      }

      conteo[usuario.id].cantidad++;
    });

    return Object.values(conteo).sort((a, b) => b.cantidad - a.cantidad);
  }, [tareas, usuariosMap]);

  // ============================================================
  // ESTADOS
  // ============================================================

  const estados = useMemo(() => {
    return [
      {
        nombre: "Pendientes",
        cantidad: estadisticas.pendientes,
        clase: "pendiente",
      },
      {
        nombre: "En proceso",
        cantidad: estadisticas.enProceso,
        clase: "proceso",
      },
      {
        nombre: "Completadas",
        cantidad: estadisticas.completadas,
        clase: "completada",
      },
    ];
  }, [estadisticas]);

  // ============================================================
  // TIEMPO POR DEPARTAMENTO
  // ============================================================

  const tiempoPorDepartamento = useMemo(() => {
    const conteo = {};

    tareas.forEach((tarea) => {
      const departamento = obtenerDepartamento(tarea.responsable_id);

      if (!conteo[departamento]) {
        conteo[departamento] = 0;
      }

      conteo[departamento] += Number(tarea.tiempo_estimado || 0);
    });

    return Object.entries(conteo)
      .map(([nombre, minutos]) => ({
        nombre,
        minutos,
      }))
      .sort((a, b) => b.minutos - a.minutos);
  }, [tareas, usuariosMap]);

  // ============================================================
  // GENERAR PDF
  // ============================================================

  const generarPDF = () => {
    const doc = new jsPDF();

    const fechaReporte = new Date().toLocaleString("es-EC");

    // ENCABEZADO

    doc.setFontSize(22);
    doc.setTextColor(7, 74, 123);
    doc.text("CRM Gestión de Requerimientos", 14, 20);

    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Reporte global de gestión", 14, 30);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${fechaReporte}`, 14, 37);

    // RESUMEN

    autoTable(doc, {
      startY: 45,
      head: [["Indicador", "Resultado"]],
      body: [
        ["Total de tareas", estadisticas.total],
        ["Pendientes", estadisticas.pendientes],
        ["En proceso", estadisticas.enProceso],
        ["Completadas", estadisticas.completadas],
        ["Alta prioridad", estadisticas.altaPrioridad],
        ["Tiempo estimado total", formatearMinutos(estadisticas.tiempoTotal)],
        ["Tiempo promedio por tarea", formatearMinutos(estadisticas.promedio)],
        ["Solicitudes con <= 2 horas", tareasUltimaHora.length],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [7, 74, 123],
      },
    });

    // DEPARTAMENTOS

    let posicion = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.setTextColor(7, 74, 123);

    doc.text("Departamentos con mayor cantidad de tareas", 14, posicion);

    autoTable(doc, {
      startY: posicion + 5,
      head: [["Posición", "Departamento", "Tareas"]],
      body: departamentos.map((departamento, index) => [
        index + 1,
        departamento.nombre,
        departamento.cantidad,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [7, 74, 123],
      },
    });

    // RESPONSABLES

    posicion = doc.lastAutoTable.finalY + 15;

    if (posicion > 250) {
      doc.addPage();
      posicion = 20;
    }

    doc.setFontSize(14);
    doc.text("Carga por responsable", 14, posicion);

    autoTable(doc, {
      startY: posicion + 5,
      head: [["Posición", "Responsable", "Tareas"]],
      body: responsables.map((responsable, index) => [
        index + 1,
        responsable.nombre,
        responsable.cantidad,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [7, 74, 123],
      },
    });

    // TAREAS DE ÚLTIMA HORA

    posicion = doc.lastAutoTable.finalY + 15;

    if (posicion > 240) {
      doc.addPage();
      posicion = 20;
    }

    doc.setFontSize(14);

    doc.text("Solicitudes con poca anticipación", 14, posicion);

    autoTable(doc, {
      startY: posicion + 5,
      head: [["Tarea", "Departamento", "Responsable", "Anticipación"]],
      body: tareasUltimaHora.map((tarea) => [
        tarea.titulo,
        obtenerDepartamento(tarea.responsable_id),
        obtenerNombreResponsable(tarea.responsable_id),
        `${Math.round(tarea.minutosAnticipacion)} min`,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [7, 74, 123],
      },
    });

    // PIE DE PÁGINA

    const totalPaginas = doc.internal.getNumberOfPages();

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      doc.setPage(pagina);

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);

      doc.text(
        `CRM Gestión de Requerimientos · Página ${pagina} de ${totalPaginas}`,
        14,
        290,
      );
    }

    doc.save("reporte-global-crm.pdf");
  };

  // ============================================================
  // CARGANDO
  // ============================================================

  if (cargando) {
    return (
      <section className="reportes-page">
        <div className="reportes-loading">
          Cargando información del reporte...
        </div>
      </section>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <section className="reportes-page">
        <div className="reportes-error">{error}</div>
      </section>
    );
  }

  // ============================================================
  // INTERFAZ
  // ============================================================

  return (
    <section className="reportes-page">
      {/* HEADER */}

      <div className="reportes-header">
        <div>
          <span className="eyebrow">ANÁLISIS</span>

          <h1>Reportes</h1>

          <p>
            Analiza la carga de trabajo, prioridades y solicitudes realizadas
            por los departamentos.
          </p>
        </div>

        <button type="button" className="reportes-btn" onClick={generarPDF}>
          Descargar PDF
        </button>
      </div>

      {/* RESUMEN */}

      <div className="reportes-resumen">
        <div className="reporte-card">
          <span>Total de tareas</span>
          <strong>{estadisticas.total}</strong>
          <small>Registradas en el sistema</small>
        </div>

        <div className="reporte-card">
          <span>Pendientes</span>
          <strong>{estadisticas.pendientes}</strong>
          <small>Esperando atención</small>
        </div>

        <div className="reporte-card">
          <span>En proceso</span>
          <strong>{estadisticas.enProceso}</strong>
          <small>Actualmente trabajando</small>
        </div>

        <div className="reporte-card">
          <span>Completadas</span>
          <strong>{estadisticas.completadas}</strong>
          <small>Tareas finalizadas</small>
        </div>

        <div className="reporte-card">
          <span>Alta prioridad</span>
          <strong>{estadisticas.altaPrioridad}</strong>
          <small>Requieren atención</small>
        </div>

        <div className="reporte-card">
          <span>Última hora</span>
          <strong>{tareasUltimaHora.length}</strong>
          <small>Solicitudes con ≤ 2 horas</small>
        </div>
      </div>

      {/* GRÁFICOS */}

      <div className="reportes-graficos">
        {/* ESTADOS */}

        <div className="reporte-panel grafico-panel">
          <div className="reporte-panel-header">
            <div>
              <h2>Estado de las tareas</h2>

              <p>Distribución general de las actividades.</p>
            </div>
          </div>

          <div className="estado-grafico">
            {estados.map((estado) => {
              const porcentajeEstado = porcentaje(
                estado.cantidad,
                estadisticas.total,
              );

              return (
                <div className="estado-item" key={estado.nombre}>
                  <div className="estado-item-header">
                    <span>{estado.nombre}</span>

                    <strong>
                      {estado.cantidad} · {porcentajeEstado}%
                    </strong>
                  </div>

                  <div className="estado-barra">
                    <span
                      className={`estado-barra-fill ${estado.clase}`}
                      style={{
                        width: `${porcentajeEstado}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DEPARTAMENTOS */}

        <div className="reporte-panel grafico-panel">
          <div className="reporte-panel-header">
            <div>
              <h2>Solicitudes por departamento</h2>

              <p>Volumen de requerimientos recibidos.</p>
            </div>
          </div>

          <div className="departamentos-grafico">
            {departamentos.slice(0, 6).map((departamento) => {
              const porcentajeDepartamento = porcentaje(
                departamento.cantidad,
                departamentos[0]?.cantidad || 0,
              );

              return (
                <div
                  className="departamento-grafico-item"
                  key={departamento.nombre}
                >
                  <div className="departamento-grafico-label">
                    <span>{departamento.nombre}</span>

                    <strong>{departamento.cantidad}</strong>
                  </div>

                  <div className="departamento-grafico-barra">
                    <span
                      style={{
                        width: `${porcentajeDepartamento}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RANKINGS */}

      <div className="reportes-grid">
        {/* DEPARTAMENTOS */}

        <div className="reporte-panel">
          <div className="reporte-panel-header">
            <div>
              <h2>Departamentos</h2>

              <p>Departamentos que generan más requerimientos.</p>
            </div>
          </div>

          {departamentos.length === 0 ? (
            <p className="reporte-vacio">Todavía no existen datos.</p>
          ) : (
            <div className="ranking-list">
              {departamentos.map((departamento, index) => (
                <div className="ranking-item" key={departamento.nombre}>
                  <span className="ranking-position">{index + 1}</span>

                  <div className="ranking-info">
                    <strong>{departamento.nombre}</strong>

                    <div className="ranking-bar">
                      <span
                        style={{
                          width: `${
                            departamentos[0]
                              ? (departamento.cantidad /
                                  departamentos[0].cantidad) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <strong>{departamento.cantidad}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESPONSABLES */}

        <div className="reporte-panel">
          <div className="reporte-panel-header">
            <div>
              <h2>Responsables</h2>

              <p>Personas con mayor carga de tareas.</p>
            </div>
          </div>

          {responsables.length === 0 ? (
            <p className="reporte-vacio">Todavía no existen datos.</p>
          ) : (
            <div className="ranking-list">
              {responsables.slice(0, 5).map((responsable, index) => (
                <div className="ranking-item" key={responsable.nombre}>
                  <span className="ranking-position">{index + 1}</span>

                  <div className="ranking-info">
                    <strong>{responsable.nombre}</strong>

                    <small>{responsable.cantidad} tareas</small>
                  </div>

                  <strong>{responsable.cantidad}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ÚLTIMA HORA */}

      <div className="reporte-panel reporte-panel-full">
        <div className="reporte-panel-header">
          <div>
            <h2>Solicitudes de última hora</h2>

            <p>Tareas creadas con dos horas o menos de anticipación.</p>
          </div>

          <span className="reporte-alerta">
            {tareasUltimaHora.length} detectadas
          </span>
        </div>

        {tareasUltimaHora.length === 0 ? (
          <div className="reporte-vacio">
            No se detectaron solicitudes de última hora.
          </div>
        ) : (
          <div className="reportes-table-container">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Departamento</th>
                  <th>Responsable</th>
                  <th>Fecha inicio</th>
                  <th>Anticipación</th>
                  <th>Prioridad</th>
                </tr>
              </thead>

              <tbody>
                {tareasUltimaHora.map((tarea) => (
                  <tr key={tarea.id}>
                    <td>
                      <strong>{tarea.titulo}</strong>
                    </td>

                    <td>{obtenerDepartamento(tarea.responsable_id)}</td>

                    <td>{obtenerNombreResponsable(tarea.responsable_id)}</td>

                    <td>
                      {tarea.fecha_inicio}

                      {tarea.hora_inicio ? ` · ${tarea.hora_inicio}` : ""}
                    </td>

                    <td>
                      <span className="urgente-badge">
                        {Math.round(tarea.minutosAnticipacion)} min
                      </span>
                    </td>

                    <td>{tarea.prioridad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TIEMPO DE TRABAJO */}

      <div className="reporte-panel reporte-panel-full">
        <div className="reporte-panel-header">
          <div>
            <h2>Tiempo de trabajo</h2>

            <p>Resumen del tiempo estimado de las tareas.</p>
          </div>
        </div>

        <div className="tiempo-resumen">
          <div>
            <span>Tiempo estimado total</span>

            <strong>{formatearMinutos(estadisticas.tiempoTotal)}</strong>
          </div>

          <div>
            <span>Promedio por tarea</span>

            <strong>{formatearMinutos(estadisticas.promedio)}</strong>
          </div>

          <div>
            <span>Tareas alta prioridad</span>

            <strong>{estadisticas.altaPrioridad}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Reportes;
