import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Reportes.css";

function Reportes() {
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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
            tiempo_estimado,
            inicio_real,
            fin_real,
            tiempo_trabajado_min,
            estado_ejecucion
          `)
          .order("fecha_inicio", { ascending: true }),

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
          .from("departamentos")
          .select(`
            id,
            nombre,
            activo
          `)
          .order("nombre", { ascending: true }),
      ]);

      if (tareasError) {
        throw tareasError;
      }

      if (usuariosError) {
        throw usuariosError;
      }

      if (departamentosError) {
        throw departamentosError;
      }

      setTareas(tareasData || []);
      setUsuarios(usuariosData || []);
      setDepartamentos(departamentosData || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      setError(
        err.message || "No se pudieron cargar los datos de reportes."
      );
    } finally {
      setCargando(false);
    }
  };

  // =========================================================
  // FECHAS
  // =========================================================

  const obtenerFecha = (tarea) => {
    return tarea?.fecha_inicio || tarea?.fecha || null;
  };

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((tarea) => {
      const fecha = obtenerFecha(tarea);

      if (!fecha) {
        return true;
      }

      if (fechaDesde && fecha < fechaDesde) {
        return false;
      }

      if (fechaHasta && fecha > fechaHasta) {
        return false;
      }

      return true;
    });
  }, [tareas, fechaDesde, fechaHasta]);

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
  // FORMATO
  // =========================================================

  const formatearDuracion = (minutos) => {
    const valor = Math.max(0, Number(minutos) || 0);

    const horas = Math.floor(valor / 60);
    const minutosRestantes = Math.round(valor % 60);

    if (horas === 0) {
      return `${minutosRestantes} min`;
    }

    return `${horas}h ${String(minutosRestantes).padStart(2, "0")}m`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "Sin fecha";
    }

    const partes = String(fecha).split("-");

    if (partes.length !== 3) {
      return "Sin fecha";
    }

    const fechaLocal = new Date(
      Number(partes[0]),
      Number(partes[1]) - 1,
      Number(partes[2])
    );

    return fechaLocal.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const obtenerNombreUsuario = (id) => {
    const usuario = usuariosMap[id];

    if (!usuario) {
      return "Sin responsable";
    }

    return `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();
  };

  const obtenerIniciales = (id) => {
    const usuario = usuariosMap[id];

    if (!usuario) {
      return "?";
    }

    const inicial1 = usuario.nombre?.charAt(0) || "";
    const inicial2 = usuario.apellido?.charAt(0) || "";

    return `${inicial1}${inicial2}`.toUpperCase();
  };

  const obtenerNombreDepartamento = (id) => {
    const departamento = departamentosMap[id];

    if (!departamento) {
      return "Sin departamento";
    }

    return departamento.nombre;
  };

  // =========================================================
  // INTERRUPCIONES
  // =========================================================
  //
  // NO SE CUENTAN:
  // - almuerzo
  // - cierre_jornada
  //
  // SÍ SE CUENTAN:
  // - otra_tarea
  // - tarea_urgente
  // - otro
  //
  // Los motivos se obtienen de localStorage porque allí
  // MisTareas registra cada pausa.
  // =========================================================

  const obtenerInterrupciones = useMemo(() => {
    const interrupciones = [];

    Object.keys(localStorage).forEach((clave) => {
      if (!clave.startsWith("tarea_pausa_")) {
        return;
      }

      try {
        const registro = JSON.parse(localStorage.getItem(clave));

        if (!registro) {
          return;
        }

        if (
          registro.motivo === "almuerzo" ||
          registro.motivo === "cierre_jornada"
        ) {
          return;
        }

        const tarea = tareas.find(
          (item) => String(item.id) === String(registro.tarea_id)
        );

        if (!tarea) {
          return;
        }

        interrupciones.push({
          tareaId: tarea.id,
          titulo: tarea.titulo,
          responsableId: tarea.responsable_id,
          departamentoId: tarea.departamento_id,
          motivo: registro.motivo,
          fecha: registro.fecha,
          hora: registro.hora,
        });
      } catch (err) {
        console.error(
          "Error leyendo interrupción:",
          clave,
          err
        );
      }
    });

    return interrupciones;
  }, [tareas]);

  // =========================================================
  // ESTADÍSTICAS GENERALES
  // =========================================================

  const estadisticas = useMemo(() => {
    const totalTareas = tareasFiltradas.length;

    const tareasCompletadas = tareasFiltradas.filter(
      (tarea) => tarea.estado === "completada"
    ).length;

    const tareasEnProceso = tareasFiltradas.filter(
      (tarea) => tarea.estado === "en_proceso"
    ).length;

    const tiempoTotal = tareasFiltradas.reduce(
      (total, tarea) =>
        total + (Number(tarea.tiempo_trabajado_min) || 0),
      0
    );

    const interrupciones = obtenerInterrupciones.filter((interrupcion) => {
      if (!fechaDesde && !fechaHasta) {
        return true;
      }

      if (!interrupcion.fecha) {
        return true;
      }

      if (fechaDesde && interrupcion.fecha < fechaDesde) {
        return false;
      }

      if (fechaHasta && interrupcion.fecha > fechaHasta) {
        return false;
      }

      return true;
    });

    return {
      totalTareas,
      tareasCompletadas,
      tareasEnProceso,
      tiempoTotal,
      totalInterrupciones: interrupciones.length,
    };
  }, [
    tareasFiltradas,
    obtenerInterrupciones,
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // CARGA POR PERSONA
  // =========================================================

  const cargaPersonas = useMemo(() => {
    const mapa = {};

    tareasFiltradas.forEach((tarea) => {
      const responsableId = tarea.responsable_id;

      if (!responsableId) {
        return;
      }

      if (!mapa[responsableId]) {
        mapa[responsableId] = {
          id: responsableId,
          tareas: 0,
          tiempo: 0,
          interrupciones: 0,
        };
      }

      mapa[responsableId].tareas += 1;
      mapa[responsableId].tiempo +=
        Number(tarea.tiempo_trabajado_min) || 0;
    });

    const interrupcionesPeriodo = obtenerInterrupciones.filter(
      (interrupcion) => {
        if (!fechaDesde && !fechaHasta) {
          return true;
        }

        if (!interrupcion.fecha) {
          return true;
        }

        if (fechaDesde && interrupcion.fecha < fechaDesde) {
          return false;
        }

        if (fechaHasta && interrupcion.fecha > fechaHasta) {
          return false;
        }

        return true;
      }
    );

    interrupcionesPeriodo.forEach((interrupcion) => {
      if (!mapa[interrupcion.responsableId]) {
        mapa[interrupcion.responsableId] = {
          id: interrupcion.responsableId,
          tareas: 0,
          tiempo: 0,
          interrupciones: 0,
        };
      }

      mapa[interrupcion.responsableId].interrupciones += 1;
    });

    return Object.values(mapa).sort((a, b) => {
      if (b.tareas !== a.tareas) {
        return b.tareas - a.tareas;
      }

      return b.tiempo - a.tiempo;
    });
  }, [
    tareasFiltradas,
    obtenerInterrupciones,
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // CARGA POR DEPARTAMENTO
  // =========================================================

  const cargaDepartamentos = useMemo(() => {
    const mapa = {};

    tareasFiltradas.forEach((tarea) => {
      const departamentoId = tarea.departamento_id;

      if (!departamentoId) {
        return;
      }

      if (!mapa[departamentoId]) {
        mapa[departamentoId] = {
          id: departamentoId,
          tareas: 0,
          tiempo: 0,
          interrupciones: 0,
        };
      }

      mapa[departamentoId].tareas += 1;
      mapa[departamentoId].tiempo +=
        Number(tarea.tiempo_trabajado_min) || 0;
    });

    const interrupcionesPeriodo = obtenerInterrupciones.filter(
      (interrupcion) => {
        if (!fechaDesde && !fechaHasta) {
          return true;
        }

        if (!interrupcion.fecha) {
          return true;
        }

        if (fechaDesde && interrupcion.fecha < fechaDesde) {
          return false;
        }

        if (fechaHasta && interrupcion.fecha > fechaHasta) {
          return false;
        }

        return true;
      }
    );

    interrupcionesPeriodo.forEach((interrupcion) => {
      if (!mapa[interrupcion.departamentoId]) {
        mapa[interrupcion.departamentoId] = {
          id: interrupcion.departamentoId,
          tareas: 0,
          tiempo: 0,
          interrupciones: 0,
        };
      }

      mapa[interrupcion.departamentoId].interrupciones += 1;
    });

    return Object.values(mapa).sort((a, b) => {
      if (b.tareas !== a.tareas) {
        return b.tareas - a.tareas;
      }

      return b.interrupciones - a.interrupciones;
    });
  }, [
    tareasFiltradas,
    obtenerInterrupciones,
    fechaDesde,
    fechaHasta,
  ]);

  // =========================================================
  // DEPARTAMENTO QUE GENERA MÁS INTERRUPCIONES
  // =========================================================

  const departamentoMayorInterrupcion = useMemo(() => {
    if (cargaDepartamentos.length === 0) {
      return null;
    }

    return [...cargaDepartamentos].sort(
      (a, b) => b.interrupciones - a.interrupciones
    )[0];
  }, [cargaDepartamentos]);

  // =========================================================
  // PERSONA CON MÁS INTERRUPCIONES
  // =========================================================

  const personaMayorInterrupcion = useMemo(() => {
    if (cargaPersonas.length === 0) {
      return null;
    }

    return [...cargaPersonas].sort(
      (a, b) => b.interrupciones - a.interrupciones
    )[0];
  }, [cargaPersonas]);

  // =========================================================
  // CARGA RELATIVA
  // =========================================================

  const mayorTiempo = useMemo(() => {
    if (cargaPersonas.length === 0) {
      return 0;
    }

    return Math.max(
      ...cargaPersonas.map((persona) => persona.tiempo)
    );
  }, [cargaPersonas]);

  // =========================================================
  // MOTIVO HUMANO
  // =========================================================

  const obtenerTextoMotivo = (motivo) => {
    if (motivo === "otra_tarea") {
      return "Otra tarea";
    }

    if (motivo === "tarea_urgente") {
      return "Tarea urgente";
    }

    if (motivo === "otro") {
      return "Otro motivo";
    }

    return "Interrupción";
  };

  // =========================================================
  // LIMPIAR FILTROS
  // =========================================================

  const limpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
  };

  // =========================================================
  // CARGANDO
  // =========================================================

  if (cargando) {
    return (
      <section className="reportes-page">
        <div className="reportes-loading">
          <span className="reportes-loader" />
          <p>Cargando reportes...</p>
        </div>
      </section>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <section className="reportes-page">
      {/* =====================================================
          ENCABEZADO
      ===================================================== */}

      <div className="reportes-header">
        <div>
          <span className="reportes-eyebrow">
            ANÁLISIS OPERATIVO
          </span>

          <h1>Reportes</h1>

          <p>
            Consulta la carga de trabajo, las tareas ejecutadas
            y las interrupciones registradas.
          </p>
        </div>

        <button
          type="button"
          className="reportes-btn-actualizar"
          onClick={cargarDatos}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* =====================================================
          FILTROS
      ===================================================== */}

      <div className="reportes-filtros">
        <div className="reportes-filtro">
          <label>Desde</label>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>

        <div className="reportes-filtro">
          <label>Hasta</label>

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>

        {(fechaDesde || fechaHasta) && (
          <button
            type="button"
            className="reportes-btn-limpiar"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="reportes-error">
          {error}
        </div>
      )}

      {/* =====================================================
          INDICADORES
      ===================================================== */}

      <div className="reportes-stats">
        <article className="reportes-stat-card">
          <span className="reportes-stat-label">
            Tareas
          </span>

          <strong>{estadisticas.totalTareas}</strong>

          <small>
            Actividades registradas
          </small>
        </article>

        <article className="reportes-stat-card">
          <span className="reportes-stat-label">
            Completadas
          </span>

          <strong>
            {estadisticas.tareasCompletadas}
          </strong>

          <small>
            Actividades finalizadas
          </small>
        </article>

        <article className="reportes-stat-card">
          <span className="reportes-stat-label">
            Tiempo trabajado
          </span>

          <strong>
            {formatearDuracion(
              estadisticas.tiempoTotal
            )}
          </strong>

          <small>
            Tiempo registrado
          </small>
        </article>

        <article className="reportes-stat-card reportes-stat-interrupciones">
          <span className="reportes-stat-label">
            Interrupciones
          </span>

          <strong>
            {estadisticas.totalInterrupciones}
          </strong>

          <small>
            Interrupciones operativas
          </small>
        </article>
      </div>

      {/* =====================================================
          PERSONA CON MÁS INTERRUPCIONES
      ===================================================== */}

      {personaMayorInterrupcion &&
        personaMayorInterrupcion.interrupciones > 0 && (
          <div className="reportes-highlight">
            <div className="reportes-highlight-icon">
              !
            </div>

            <div>
              <span>
                PERSONA CON MÁS INTERRUPCIONES
              </span>

              <strong>
                {obtenerNombreUsuario(
                  personaMayorInterrupcion.id
                )}
              </strong>

              <p>
                Registró{" "}
                <b>
                  {personaMayorInterrupcion.interrupciones}
                </b>{" "}
                interrupciones durante el periodo
                seleccionado.
              </p>
            </div>
          </div>
        )}

      {/* =====================================================
          CARGA POR PERSONA
      ===================================================== */}

      <section className="reportes-section">
        <div className="reportes-section-header">
          <div>
            <span>PERSONAS EJECUTORAS</span>

            <h2>Carga por persona</h2>

            <p>
              Personas responsables de ejecutar las tareas
              registradas en el sistema.
            </p>
          </div>
        </div>

        {cargaPersonas.length === 0 ? (
          <div className="reportes-empty">
            No existen datos para el periodo seleccionado.
          </div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Tareas</th>
                  <th>Tiempo trabajado</th>
                  <th>Interrupciones</th>
                  <th>Carga</th>
                </tr>
              </thead>

              <tbody>
                {cargaPersonas.map((persona) => {
                  const porcentaje =
                    mayorTiempo > 0
                      ? Math.round(
                          (persona.tiempo /
                            mayorTiempo) *
                            100
                        )
                      : 0;

                  return (
                    <tr key={persona.id}>
                      <td>
                        <div className="reportes-persona">
                          <div className="reportes-avatar">
                            {obtenerIniciales(
                              persona.id
                            )}
                          </div>

                          <strong>
                            {obtenerNombreUsuario(
                              persona.id
                            )}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span className="reportes-number">
                          {persona.tareas}
                        </span>
                      </td>

                      <td>
                        {formatearDuracion(
                          persona.tiempo
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            persona.interrupciones > 0
                              ? "reportes-badge reportes-badge-warning"
                              : "reportes-badge reportes-badge-success"
                          }
                        >
                          {persona.interrupciones}
                        </span>
                      </td>

                      <td>
                        <div className="reportes-carga">
                          <div className="reportes-carga-barra">
                            <span
                              style={{
                                width: `${porcentaje}%`,
                              }}
                            />
                          </div>

                          <small>
                            {porcentaje}%
                          </small>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================
          DEPARTAMENTOS
      ===================================================== */}

      <section className="reportes-section">
        <div className="reportes-section-header">
          <div>
            <span>DEPARTAMENTOS SOLICITANTES</span>

            <h2>Tareas por departamento</h2>

            <p>
              Departamentos que originan las solicitudes de
              trabajo ejecutadas por las personas.
            </p>
          </div>
        </div>

        {cargaDepartamentos.length === 0 ? (
          <div className="reportes-empty">
            No existen datos de departamentos.
          </div>
        ) : (
          <div className="reportes-departamentos-grid">
            {cargaDepartamentos.map((departamento) => {
              const porcentaje =
                estadisticas.totalTareas > 0
                  ? Math.round(
                      (departamento.tareas /
                        estadisticas.totalTareas) *
                        100
                    )
                  : 0;

              return (
                <article
                  className="reportes-departamento-card"
                  key={departamento.id}
                >
                  <div className="reportes-departamento-top">
                    <div>
                      <span>DEPARTAMENTO</span>

                      <h3>
                        {obtenerNombreDepartamento(
                          departamento.id
                        )}
                      </h3>
                    </div>

                    <strong>
                      {departamento.tareas}
                    </strong>
                  </div>

                  <div className="reportes-departamento-barra">
                    <span
                      style={{
                        width: `${porcentaje}%`,
                      }}
                    />
                  </div>

                  <div className="reportes-departamento-meta">
                    <span>
                      {porcentaje}% de las tareas
                    </span>

                    <span>
                      {formatearDuracion(
                        departamento.tiempo
                      )}
                    </span>
                  </div>

                  <div className="reportes-departamento-interrupciones">
                    <span>
                      Interrupciones generadas
                    </span>

                    <strong>
                      {departamento.interrupciones}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================
          INTERRUPCIONES
      ===================================================== */}

      <section className="reportes-section">
        <div className="reportes-section-header">
          <div>
            <span>CONTROL DE ACTIVIDAD</span>

            <h2>Interrupciones</h2>

            <p>
              Interrupciones operativas registradas durante
              la ejecución de tareas.
            </p>
          </div>
        </div>

        <div className="reportes-interrupciones-grid">
          <article className="reportes-interrupcion-resumen">
            <span>Total</span>

            <strong>
              {estadisticas.totalInterrupciones}
            </strong>

            <small>
              Interrupciones contabilizadas
            </small>
          </article>

          <article className="reportes-interrupcion-resumen">
            <span>Principal departamento</span>

            <strong>
              {departamentoMayorInterrupcion &&
              departamentoMayorInterrupcion.interrupciones > 0
                ? obtenerNombreDepartamento(
                    departamentoMayorInterrupcion.id
                  )
                : "Sin datos"}
            </strong>

            <small>
              {departamentoMayorInterrupcion &&
              departamentoMayorInterrupcion.interrupciones > 0
                ? `${departamentoMayorInterrupcion.interrupciones} interrupciones`
                : "No existen interrupciones"}
            </small>
          </article>

          <article className="reportes-interrupcion-resumen">
            <span>Principal motivo</span>

            <strong>
              {(() => {
                const motivos = {};

                obtenerInterrupciones.forEach(
                  (interrupcion) => {
                    if (
                      fechaDesde &&
                      interrupcion.fecha &&
                      interrupcion.fecha < fechaDesde
                    ) {
                      return;
                    }

                    if (
                      fechaHasta &&
                      interrupcion.fecha &&
                      interrupcion.fecha > fechaHasta
                    ) {
                      return;
                    }

                    motivos[interrupcion.motivo] =
                      (motivos[interrupcion.motivo] || 0) +
                      1;
                  }
                );

                const mayor =
                  Object.entries(motivos).sort(
                    (a, b) => b[1] - a[1]
                  )[0];

                return mayor
                  ? obtenerTextoMotivo(mayor[0])
                  : "Sin datos";
              })()}
            </strong>

            <small>
              Motivo más registrado
            </small>
          </article>
        </div>

        {obtenerInterrupciones.length > 0 && (
          <div className="reportes-interrupciones-nota">
            <span>✓</span>

            <p>
              El cálculo de interrupciones considera
              únicamente pausas operativas. Las pausas por
              <strong> almuerzo </strong>
              y el
              <strong> cierre automático de jornada </strong>
              no forman parte de este indicador.
            </p>
          </div>
        )}
      </section>

      {/* =====================================================
          FUENTE DE DATOS
      ===================================================== */}

      <div className="reportes-fuente">
        <div className="reportes-fuente-icono">
          i
        </div>

        <div>
          <strong>
            Fuente de datos
          </strong>

          <p>
            Información obtenida del sistema interno de
            gestión de tareas. Los datos se calculan a partir
            de las tareas registradas, personas responsables,
            departamentos solicitantes, estados de ejecución,
            fechas, horas y tiempo trabajado.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Reportes;

