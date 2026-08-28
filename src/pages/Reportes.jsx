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
  const ELEMENTOS_POR_PAGINA = 5;

  const hoy = new Date().toISOString().split("T")[0];

  // =========================================================
  // ESTADOS
  // =========================================================

  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);

  const [pausasRegistradas, setPausasRegistradas] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [fechaDesde, setFechaDesde] = useState(
    `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, "0")}-01`,
  );

  const [fechaHasta, setFechaHasta] = useState(hoy);

  const [pestanaActiva, setPestanaActiva] = useState("resumen");

  const [paginaActividades, setPaginaActividades] = useState(1);
  const [paginaPersonas, setPaginaPersonas] = useState(1);

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
            tiempo_estimado,
            created_at
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

      // =====================================================
      // PAUSAS / INTERRUPCIONES
      // =====================================================

      const pausas = [];

      try {
        for (
          let i = 0;
          i < localStorage.length;
          i += 1
        ) {
          const key = localStorage.key(i);

          if (
            !key ||
            !key.startsWith("tarea_pausa_")
          ) {
            continue;
          }

          const valor =
            localStorage.getItem(key);

          if (!valor) {
            continue;
          }

          try {
            const pausa = JSON.parse(valor);

            if (
              pausa &&
              pausa.tarea_id
            ) {
              pausas.push(pausa);
            }
          } catch (parseError) {
            console.warn(
              "No se pudo interpretar una pausa:",
              parseError,
            );
          }
        }
      } catch (storageError) {
        console.warn(
          "No se pudieron leer las pausas:",
          storageError,
        );
      }

      setPausasRegistradas(pausas);
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
        (usuario) =>
          String(usuario.id) === String(id),
      ) || null
    );
  };

  const obtenerDepartamento = (id) => {
    return (
      departamentos.find(
        (departamento) =>
          String(departamento.id) ===
          String(id),
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
    if (!fecha) {
      return null;
    }

    const partes = String(fecha).split("-");

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
    const fechaObj =
      convertirFecha(fecha);

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
    const fechaObj =
      convertirFecha(fecha);

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
    if (!hora) {
      return null;
    }

    const partes = String(hora)
      .split(":")
      .map(Number);

    const horas = partes[0];
    const minutos = partes[1];

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

    return String(hora).substring(0, 5);
  };

  // =========================================================
  // DURACIÓN
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
  // MISMA LÓGICA DE CARGA
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

    // Tarea de varios días
    if (esMultidia) {
      return MINUTOS_JORNADA;
    }

    // Horario real
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

    // Tiempo estimado
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

    // Sin información
    return MINUTOS_JORNADA;
  };

  // =========================================================
  // UNA TAREA OCUPA UNA FECHA
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
    if (
      !fechaDesde ||
      !fechaHasta
    ) {
      return [];
    }

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
  ]);

  // =========================================================
  // RENDIMIENTO PERSONAS
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

          const jornadas =
            cargaDiaria.filter(
              (dia) =>
                dia.usuarioId ===
                usuario.id,
            );

          const tiempo =
            jornadas.reduce(
              (total, dia) =>
                total + dia.minutos,
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

            tareas:
              tareasPersona,

            jornadas,

            tiempo,

            diasTrabajados:
              jornadas.length,

            diasNormales:
              jornadas.filter(
                (dia) =>
                  dia.nivel ===
                  "normal",
              ).length,

            diasCargaAlta:
              jornadas.filter(
                (dia) =>
                  dia.nivel ===
                  "alta",
              ).length,

            diasSobrecargados:
              jornadas.filter(
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
  // TRAZABILIDAD
  // =========================================================

  const obtenerNivelUrgencia = (
    tarea,
  ) => {
    if (!tarea?.created_at) {
      return "No determinado";
    }

    const fechaInicio =
      tarea.fecha_inicio ||
      tarea.fecha;

    if (!fechaInicio) {
      return "No determinado";
    }

    const horaInicio =
      tarea.hora_inicio ||
      "00:00:00";

    const inicio = new Date(
      `${fechaInicio}T${horaInicio}`,
    );

    const solicitud =
      new Date(
        tarea.created_at,
      );

    if (
      Number.isNaN(
        inicio.getTime(),
      ) ||
      Number.isNaN(
        solicitud.getTime(),
      )
    ) {
      return "No determinado";
    }

    const horas =
      (inicio.getTime() -
        solicitud.getTime()) /
      3600000;

    if (horas < 1) {
      return "Última hora";
    }

    if (horas < 24) {
      return "Urgente";
    }

    if (horas < 72) {
      return "Anticipación corta";
    }

    return "Planificada";
  };

  const tareasUrgentes = useMemo(() => {
    return tareasPeriodo
      .filter((tarea) => {
        const nivel =
          obtenerNivelUrgencia(
            tarea,
          );

        return (
          nivel === "Urgente" ||
          nivel === "Última hora"
        );
      })
      .sort((a, b) => {
        const fa =
          convertirFecha(
            a.fecha_inicio ||
              a.fecha,
          )?.getTime() || 0;

        const fb =
          convertirFecha(
            b.fecha_inicio ||
              b.fecha,
          )?.getTime() || 0;

        return fa - fb;
      });
  }, [tareasPeriodo]);

  // =========================================================
  // CRUCE DE TAREAS
  // =========================================================

  const minutosCruce = (
    a,
    b,
  ) => {
    const fechaA =
      a.fecha_inicio ||
      a.fecha;

    const fechaAFin =
      a.fecha_fin ||
      fechaA;

    const fechaB =
      b.fecha_inicio ||
      b.fecha;

    const fechaBFin =
      b.fecha_fin ||
      fechaB;

    if (
      !fechaA ||
      !fechaB
    ) {
      return 0;
    }

    const inicioA =
      new Date(
        `${fechaA}T${
          a.hora_inicio ||
          "00:00:00"
        }`,
      );

    const finA =
      new Date(
        `${fechaAFin}T${
          a.hora_fin ||
          "23:59:59"
        }`,
      );

    const inicioB =
      new Date(
        `${fechaB}T${
          b.hora_inicio ||
          "00:00:00"
        }`,
      );

    const finB =
      new Date(
        `${fechaBFin}T${
          b.hora_fin ||
          "23:59:59"
        }`,
      );

    if (
      [
        inicioA,
        finA,
        inicioB,
        finB,
      ].some((fecha) =>
        Number.isNaN(
          fecha.getTime(),
        ),
      )
    ) {
      return 0;
    }

    const inicioCruce =
      Math.max(
        inicioA.getTime(),
        inicioB.getTime(),
      );

    const finCruce =
      Math.min(
        finA.getTime(),
        finB.getTime(),
      );

    return finCruce >
      inicioCruce
      ? Math.round(
          (finCruce -
            inicioCruce) /
            60000,
        )
      : 0;
  };

  // =========================================================
  // RELACIÓN DE PAUSAS
  // =========================================================

  const obtenerTareaInterrumpida = (
    pausa,
  ) => {
    const posibles = [
      pausa?.tarea_interrumpida_id,
      pausa?.tarea_interrumpida,
      pausa?.tarea_anterior_id,
      pausa?.tarea_origen_id,
      pausa?.tarea_pausada_id,
    ].filter(Boolean);

    return posibles.length
      ? posibles[0]
      : null;
  };

  const obtenerTareaInterrupcion = (
    pausa,
  ) => {
    const posibles = [
      pausa?.otra_tarea_id,
      pausa?.tarea_interrupcion_id,
      pausa?.nueva_tarea_id,
      pausa?.tarea_destino_id,
    ].filter(Boolean);

    return posibles.length
      ? posibles[0]
      : null;
  };

  const obtenerInterventor = (
    pausa,
    tareaQueInterrumpe,
  ) => {
    const posibles = [
      pausa?.intervenido_por_id,
      pausa?.interventor_id,
      pausa?.usuario_interventor_id,
      pausa?.solicitante_id,
      pausa?.creado_por,
      pausa?.usuario_id,
    ].filter(Boolean);

    if (
      posibles.length
    ) {
      return obtenerNombreUsuario(
        posibles[0],
      );
    }

    if (
      tareaQueInterrumpe
        ?.responsable_id
    ) {
      return obtenerNombreUsuario(
        tareaQueInterrumpe.responsable_id,
      );
    }

    return "No determinado";
  };

  // =========================================================
  // INTERFERENCIAS
  // =========================================================

  const interferencias =
    useMemo(() => {
      const resultado = [];
      const vistos = new Set();

      usuarios.forEach((usuario) => {
        const tareasUsuario =
          tareasPeriodo.filter(
            (tarea) =>
              tarea.responsable_id ===
              usuario.id,
          );

        for (
          let i = 0;
          i <
          tareasUsuario.length;
          i += 1
        ) {
          for (
            let j = i + 1;
            j <
            tareasUsuario.length;
            j += 1
          ) {
            const a =
              tareasUsuario[i];

            const b =
              tareasUsuario[j];

            const duracion =
              minutosCruce(
                a,
                b,
              );

            if (
              duracion <= 0
            ) {
              continue;
            }

            const idA =
              String(a.id);

            const idB =
              String(b.id);

            const clave = [
              idA,
              idB,
            ]
              .sort()
              .join("-");

            if (
              vistos.has(
                `${usuario.id}-${clave}`,
              )
            ) {
              continue;
            }

            vistos.add(
              `${usuario.id}-${clave}`,
            );

            const inicioA =
              new Date(
                `${a.fecha_inicio || a.fecha}T${
                  a.hora_inicio ||
                  "00:00:00"
                }`,
              );

            const inicioB =
              new Date(
                `${b.fecha_inicio || b.fecha}T${
                  b.hora_inicio ||
                  "00:00:00"
                }`,
              );

            const tareaInterrumpida =
              inicioA <= inicioB
                ? a
                : b;

            const tareaInterrumpe =
              inicioA <= inicioB
                ? b
                : a;

            const pausa =
              pausasRegistradas.find(
                (item) => {
                  if (
                    item.motivo !==
                    "otra_tarea"
                  ) {
                    return false;
                  }

                  const pausada =
                    obtenerTareaInterrumpida(
                      item,
                    );

                  const nueva =
                    obtenerTareaInterrupcion(
                      item,
                    );

                  return (
                    String(
                      pausada || "",
                    ) ===
                      String(
                        tareaInterrumpida.id,
                      ) &&
                    String(
                      nueva || "",
                    ) ===
                      String(
                        tareaInterrumpe.id,
                      )
                  );
                },
              );

            resultado.push({
              id: `${usuario.id}-${clave}`,

              fecha:
                tareaInterrumpida.fecha_inicio ||
                tareaInterrumpida.fecha,

              usuario,

              tareaInterrumpida,

              tareaInterrumpe,

              duracion,

              pausaRegistrada:
                Boolean(pausa),

              interventor:
                obtenerInterventor(
                  pausa,
                  tareaInterrumpe,
                ),
            });
          }
        }
      });

      return resultado.sort(
        (a, b) => {
          const fechaA =
            convertirFecha(
              a.fecha,
            )?.getTime() || 0;

          const fechaB =
            convertirFecha(
              b.fecha,
            )?.getTime() || 0;

          return (
            fechaA - fechaB
          );
        },
      );
    }, [
      usuarios,
      tareasPeriodo,
      pausasRegistradas,
    ]);

  // =========================================================
  // MAPA DE TAREAS INTERRUMPIDAS
  // =========================================================

  const tareasInterrumpidasIds =
    useMemo(() => {
      const mapa = new Map();

      interferencias.forEach(
        (item) => {
          const id =
            String(
              item
                .tareaInterrumpida
                .id,
            );

          if (!mapa.has(id)) {
            mapa.set(id, []);
          }

          mapa
            .get(id)
            .push(item);
        },
      );

      return mapa;
    }, [interferencias]);

  // =========================================================
  // MAPA DE TAREAS QUE PROVOCARON INTERFERENCIA
  // =========================================================

  const tareasInterrumpenIds =
    useMemo(() => {
      const mapa = new Map();

      interferencias.forEach(
        (item) => {
          const id =
            String(
              item
                .tareaInterrumpe
                .id,
            );

          if (!mapa.has(id)) {
            mapa.set(id, []);
          }

          mapa
            .get(id)
            .push(item);
        },
      );

      return mapa;
    }, [interferencias]);

  // =========================================================
  // ESTADO VISUAL DE UNA TAREA
  // =========================================================

  const obtenerEstadoInterferencia =
    (tarea) => {
      const id =
        String(tarea.id);

      const interrumpidas =
        tareasInterrumpidasIds.get(
          id,
        ) || [];

      if (
        interrumpidas.length > 0
      ) {
        return {
          tipo: "interrumpida",
          clase: "tarea-indicador-rojo",
          texto: "Interrumpida",
          detalles:
            interrumpidas,
        };
      }

      return {
        tipo: "fluida",
        clase: "tarea-indicador-verde",
        texto: "Fluyó sin interrupciones",
        detalles: [],
      };
    };

  // =========================================================
  // DÍAS CON MAYOR INTERFERENCIA
  // =========================================================

  const diasMayorInterferencia =
    useMemo(() => {
      const mapa = {};

      interferencias.forEach(
        (item) => {
          if (!mapa[item.fecha]) {
            mapa[item.fecha] = {
              fecha: item.fecha,
              cantidad: 0,
              minutos: 0,
            };
          }

          mapa[item.fecha]
            .cantidad += 1;

          mapa[item.fecha]
            .minutos +=
            item.duracion;
        },
      );

      return Object.values(
        mapa,
      ).sort((a, b) => {
        if (
          b.cantidad !==
          a.cantidad
        ) {
          return (
            b.cantidad -
            a.cantidad
          );
        }

        return (
          b.minutos -
          a.minutos
        );
      });
    }, [interferencias]);

  // =========================================================
  // MÉTRICAS
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
          dia.nivel ===
          "alta",
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
      urgentes:
        tareasUrgentes.length,
      interferencias:
        interferencias.length,
      diasMayorInterferencia:
        diasMayorInterferencia.length,
    };
  }, [
    tareasPeriodo,
    cargaDiaria,
    tareasUrgentes,
    interferencias,
    diasMayorInterferencia,
  ]);

  // =========================================================
  // DÍAS CRÍTICOS
  // =========================================================

  const diasCriticos = useMemo(() => {
    return [...cargaDiaria]
      .filter(
        (dia) =>
          dia.nivel === "alta" ||
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
    }, [tareasPeriodo]);

  // =========================================================
  // PAGINACIÓN
  // =========================================================

  const actividadesVisibles =
    useMemo(() => {
      const inicio =
        (paginaActividades -
          1) *
        ELEMENTOS_POR_PAGINA;

      return tareasPeriodo.slice(
        inicio,
        inicio +
          ELEMENTOS_POR_PAGINA,
      );
    }, [
      tareasPeriodo,
      paginaActividades,
    ]);

  const personasVisibles =
    useMemo(() => {
      const inicio =
        (paginaPersonas -
          1) *
        ELEMENTOS_POR_PAGINA;

      return rendimientoPersonas.slice(
        inicio,
        inicio +
          ELEMENTOS_POR_PAGINA,
      );
    }, [
      rendimientoPersonas,
      paginaPersonas,
    ]);

  const totalPaginasActividades =
    Math.max(
      1,
      Math.ceil(
        tareasPeriodo.length /
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

  useEffect(() => {
    setPaginaActividades(1);
    setPaginaPersonas(1);
  }, [
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    if (
      paginaActividades >
      totalPaginasActividades
    ) {
      setPaginaActividades(
        totalPaginasActividades,
      );
    }
  }, [
    paginaActividades,
    totalPaginasActividades,
  ]);

  useEffect(() => {
    if (
      paginaPersonas >
      totalPaginasPersonas
    ) {
      setPaginaPersonas(
        totalPaginasPersonas,
      );
    }
  }, [
    paginaPersonas,
    totalPaginasPersonas,
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
  // FORMATO
  // =========================================================

  const formatearMinutos = (
    minutos,
  ) => {
    const valor = Math.max(
      0,
      Math.round(
        Number(minutos) || 0,
      ),
    );

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
    const rojo = [
      185, 45, 45,
    ];
    const verde = [
      40, 125, 78,
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
          lineas.length *
            4 +
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

    const departamentoPrincipal =
      rendimientoDepartamentos[0];

    const personaMayorCarga =
      rendimientoPersonas[0];

    let resumen =
      `Durante el período analizado se registraron ${metricas.total} actividades, ` +
      `distribuidas entre ${metricas.personas} personas y ${metricas.departamentos} departamentos. ` +
      `La carga planificada corresponde a ${formatearMinutos(
        metricas.tiempo,
      )}. `;

    if (
      departamentoPrincipal
    ) {
      resumen +=
        `El departamento con mayor volumen fue ${departamentoPrincipal.nombre}, ` +
        `con ${departamentoPrincipal.total} actividades. `;
    }

    if (
      personaMayorCarga
    ) {
      resumen +=
        `La persona con mayor carga acumulada fue ${personaMayorCarga.nombre}, ` +
        `con ${formatearMinutos(
          personaMayorCarga.tiempo,
        )}. `;
    }

    resumen +=
      `Se identificaron ${metricas.diasCargaAlta} jornadas con carga alta, ` +
      `${metricas.diasSobrecargados} jornadas con sobrecarga, ` +
      `${metricas.urgentes} solicitudes urgentes y ` +
      `${metricas.interferencias} interferencias.`;

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
          metricas.completadas,
          metricas.enProceso,
          metricas.pendientes,
        ],
      ],

      theme: "grid",

      headStyles: {
        fillColor: azul,
        textColor: blanco,
        fontStyle: "bold",
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
    // 1 ACTIVIDADES
    // =======================================================

    encabezadoSeccion(
      "1. Actividades y trazabilidad",
      "El indicador identifica si cada actividad tuvo una interrupción registrada o si fluyó sin una interrupción identificada.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Indicador",
          "Actividad",
          "Departamento",
          "Responsable",
          "Fecha",
          "Tiempo",
          "Estado",
          "Situación",
        ],
      ],

      body: tareasPeriodo.map(
        (tarea) => {
          const estado =
            obtenerEstadoInterferencia(
              tarea,
            );

          return [
            estado.tipo ===
            "interrumpida"
              ? "INTER"
              : "FLUYE",

            tarea.titulo ||
              "Sin título",

            obtenerNombreDepartamento(
              tarea.departamento_id,
            ),

            obtenerNombreUsuario(
              tarea.responsable_id,
            ),

            formatearFecha(
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

            estado.texto,
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
        textColor: azulOscuro,
        overflow: "linebreak",
      },

      didParseCell: (
        data,
      ) => {
        if (
          data.section ===
            "body" &&
          data.column.index ===
            0
        ) {
          const valor =
            data.cell.raw;

          if (
            valor ===
            "INTER"
          ) {
            data.cell.styles.textColor =
              rojo;

            data.cell.styles.fontStyle =
              "bold";
          }

          if (
            valor ===
            "FLUYE"
          ) {
            data.cell.styles.textColor =
              verde;

            data.cell.styles.fontStyle =
              "bold";
          }
        }
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 10;

    // =======================================================
    // 1.1 DETALLE DE INTERRUPCIONES
    // =======================================================

    encabezadoSeccion(
      "1.1 Detalle de interrupciones",
      "Cuando una actividad fue identificada como interrumpida se muestra qué actividad se cruzó con ella y quién aparece asociado como interventor o responsable de la actividad que generó el cruce.",
    );

    if (
      interferencias.length ===
      0
    ) {
      doc.setFontSize(9);
      doc.setTextColor(
        ...verde,
      );

      doc.text(
        "No se registraron interrupciones durante el período.",
        14,
        y,
      );

      y += 10;
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Fecha",
            "Tarea interrumpida",
            "Actividad que generó el cruce",
            "Responsable",
            "Intervino / solicitó",
            "Tiempo",
            "Registro",
          ],
        ],

        body:
          interferencias.map(
            (item) => [
              formatearFecha(
                item.fecha,
              ),

              item
                .tareaInterrumpida
                .titulo ||
                "Sin título",

              item
                .tareaInterrumpe
                .titulo ||
                "Sin título",

              obtenerNombreUsuario(
                item
                  .tareaInterrumpida
                  .responsable_id,
              ),

              item.interventor,

              formatearMinutos(
                item.duracion,
              ),

              item.pausaRegistrada
                ? "Interrupción registrada"
                : "Cruce planificado",
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
      });
    }

    // =======================================================
    // 2 DEPARTAMENTOS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "2. Distribución por departamento",
      "Permite identificar qué departamentos concentran la demanda de trabajo.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Departamento",
          "Actividades",
          "Participación",
          "Tiempo",
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

    // =======================================================
    // 3 PERSONAS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "3. Carga por persona",
      "La carga se calcula por jornada utilizando una capacidad de 8 horas diarias.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Responsable",
          "Actividades",
          "Carga acumulada",
          "Días",
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
    // 4 JORNADAS CRÍTICAS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "4. Jornadas con mayor carga",
      "Jornadas con carga alta o con planificación superior a la capacidad diaria.",
    );

    if (
      diasCriticos.length ===
      0
    ) {
      doc.setFontSize(9);
      doc.setTextColor(
        ...gris,
      );

      doc.text(
        "No se identificaron jornadas críticas.",
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
            "Actividades",
            "Carga",
            "Capacidad",
            "Exceso",
            "Nivel",
          ],
        ],

        body:
          diasCriticos.map(
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
    }

    // =======================================================
    // 5 URGENCIAS
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "5. Solicitudes urgentes y de última hora",
      "La urgencia se determina comparando el momento de creación con el inicio planificado de la actividad.",
    );

    if (
      tareasUrgentes.length ===
      0
    ) {
      doc.setFontSize(9);
      doc.setTextColor(
        ...verde,
      );

      doc.text(
        "No se identificaron solicitudes urgentes durante el período.",
        14,
        y,
      );
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Fecha",
            "Actividad",
            "Departamento",
            "Responsable",
            "Tiempo",
            "Urgencia",
            "Estado",
          ],
        ],

        body:
          tareasUrgentes.map(
            (tarea) => [
              formatearFecha(
                tarea.fecha_inicio ||
                  tarea.fecha,
              ),

              tarea.titulo ||
                "Sin título",

              obtenerNombreDepartamento(
                tarea.departamento_id,
              ),

              obtenerNombreUsuario(
                tarea.responsable_id,
              ),

              formatearMinutos(
                obtenerMinutosPlanificados(
                  tarea,
                ),
              ),

              obtenerNivelUrgencia(
                tarea,
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
    // 6 TRAZABILIDAD
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "6. Trazabilidad de interferencias",
      "Fechas que concentraron mayor cantidad de cruces entre actividades.",
    );

    if (
      diasMayorInterferencia.length ===
      0
    ) {
      doc.setFontSize(9);
      doc.setTextColor(
        ...verde,
      );

      doc.text(
        "No existen días con interferencias registradas.",
        14,
        y,
      );
    } else {
      autoTable(doc, {
        startY: y,

        head: [
          [
            "Fecha",
            "Interferencias",
            "Tiempo acumulado",
          ],
        ],

        body:
          diasMayorInterferencia.map(
            (dia) => [
              formatearFecha(
                dia.fecha,
              ),

              dia.cantidad,

              formatearMinutos(
                dia.minutos,
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
    // 7 LEYENDA
    // =======================================================

    nuevaPagina();

    encabezadoSeccion(
      "7. Indicadores de flujo de trabajo",
      "Los indicadores permiten identificar rápidamente el comportamiento de cada actividad dentro del período analizado.",
    );

    autoTable(doc, {
      startY: y,

      head: [
        [
          "Indicador",
          "Significado",
        ],
      ],

      body: [
        [
          "ROJO",
          "La actividad fue identificada como interrumpida por un cruce con otra actividad del mismo responsable.",
        ],
        [
          "VERDE",
          "No se identificó una interrupción para la actividad dentro de la información disponible.",
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

      didParseCell: (
        data,
      ) => {
        if (
          data.section ===
            "body" &&
          data.column.index ===
            0
        ) {
          if (
            data.cell.raw ===
            "ROJO"
          ) {
            data.cell.styles.textColor =
              rojo;

            data.cell.styles.fontStyle =
              "bold";
          }

          if (
            data.cell.raw ===
            "VERDE"
          ) {
            data.cell.styles.textColor =
              verde;

            data.cell.styles.fontStyle =
              "bold";
          }
        }
      },
    });

    y =
      doc.lastAutoTable
        .finalY + 12;

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(9);

    doc.setTextColor(
      ...azulOscuro,
    );

    const metodologia =
      `Fuente de los datos: información registrada en las tablas de tareas, usuarios y departamentos del sistema, complementada con los registros temporales de pausas almacenados para las actividades. ` +
      `La capacidad diaria utilizada es de 480 minutos, equivalentes a 8 horas. ` +
      `Las tareas de varios días consideran 8 horas por cada día ocupado; las tareas de un día con horario válido utilizan la diferencia entre hora de inicio y hora de fin; ` +
      `cuando no existe un horario válido se utiliza el tiempo estimado registrado y, si tampoco existe información válida, se considera una jornada de 8 horas. ` +
      `Las interferencias se identifican comparando los intervalos de las actividades asignadas al mismo responsable.`;

    const lineasMetodologia =
      doc.splitTextToSize(
        metodologia,
        260,
      );

    doc.text(
      lineasMetodologia,
      14,
      y,
    );

    // =======================================================
    // 8 CONCLUSIÓN
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

    let conclusion =
      `Durante el período comprendido entre ${formatearFecha(
        fechaDesde,
      )} y ${formatearFecha(
        fechaHasta,
      )}, se registraron ${metricas.total} actividades. ` +
      `La carga planificada fue de ${formatearMinutos(
        metricas.tiempo,
      )}. ` +
      `Se identificaron ${metricas.urgentes} solicitudes urgentes y ${metricas.interferencias} interferencias. `;

    if (
      metricas.interferencias >
      0
    ) {
      conclusion +=
        `Las actividades marcadas en rojo corresponden a trabajos que presentaron una interrupción identificable, mientras que las actividades marcadas en verde no presentan una interrupción registrada dentro de la información analizada. `;
    } else {
      conclusion +=
        `No se identificaron interrupciones durante el período analizado. `;
    }

    conclusion +=
      `La información permite revisar distribución de trabajo, capacidad operativa, prioridades y trazabilidad de las gestiones.`;

    doc.setFont(
      "helvetica",
      "normal",
    );

    doc.setFontSize(10);

    doc.setTextColor(
      ...azulOscuro,
    );

    doc.text(
      doc.splitTextToSize(
        conclusion,
        260,
      ),
      14,
      34,
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

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="reportes-header">
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
      </header>

      {/* =====================================================
          FILTROS
      ===================================================== */}

      <section className="reportes-filtros">
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
      </section>

      {/* =====================================================
          BENTO SUPERIOR
      ===================================================== */}

      <section className="reportes-bento-superior">

        <article className="bento-card bento-card-principal">
          <span className="bento-label">
            RESUMEN DEL PERÍODO
          </span>

          <h2>
            ¿Qué ocurrió con el trabajo?
          </h2>

          <p>
            El período registra{" "}
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

          <div className="bento-principal-metricas">
            <div>
              <span>
                Personas
              </span>

              <strong>
                {metricas.personas}
              </strong>
            </div>

            <div>
              <span>
                Departamentos
              </span>

              <strong>
                {metricas.departamentos}
              </strong>
            </div>

            <div>
              <span>
                Completadas
              </span>

              <strong>
                {metricas.completadas}
              </strong>
            </div>
          </div>
        </article>

        <article className="bento-card">
          <span className="bento-label">
            CAPACIDAD
          </span>

          <strong className="bento-number">
            {formatearMinutos(
              metricas.tiempo,
            )}
          </strong>

          <span className="bento-muted">
            Carga planificada
          </span>

          <div className="bento-mini-line">
            <span>
              8 h
            </span>

            <span>
              Capacidad diaria
            </span>
          </div>
        </article>

        <article className="bento-card">
          <span className="bento-label">
            URGENCIAS
          </span>

          <strong className="bento-number">
            {metricas.urgentes}
          </strong>

          <span className="bento-muted">
            Solicitudes urgentes
          </span>

          <div className="bento-mini-line">
            <span>
              {tareasUrgentes.filter(
                (tarea) =>
                  obtenerNivelUrgencia(
                    tarea,
                  ) ===
                  "Última hora",
              ).length}
            </span>

            <span>
              Última hora
            </span>
          </div>
        </article>

        <article className="bento-card bento-card-interferencias">
          <div className="bento-card-top">
            <span className="bento-label">
              INTERFERENCIAS
            </span>

            <span
              className={
                interferencias.length >
                0
                  ? "bento-status bento-status-red"
                  : "bento-status bento-status-green"
              }
            />
          </div>

          <strong className="bento-number">
            {metricas.interferencias}
          </strong>

          <span className="bento-muted">
            Cruces identificados
          </span>

          <div className="bento-mini-line">
            <span>
              {diasMayorInterferencia.length}
            </span>

            <span>
              días afectados
            </span>
          </div>
        </article>

      </section>

      {/* =====================================================
          NAVEGACIÓN
      ===================================================== */}

      <nav className="reportes-pestanas">
        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "resumen"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "resumen",
            )
          }
        >
          Resumen
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "actividades"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "actividades",
            )
          }
        >
          Actividades
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "departamentos"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "departamentos",
            )
          }
        >
          Departamentos
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "personas"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "personas",
            )
          }
        >
          Carga por persona
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "alertas"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "alertas",
            )
          }
        >
          Alertas
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "trazabilidad"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "trazabilidad",
            )
          }
        >
          Trazabilidad
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "prioridades"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "prioridades",
            )
          }
        >
          Prioridades
        </button>

        <button
          type="button"
          className={`reportes-pestana ${
            pestanaActiva ===
            "estado"
              ? "activa"
              : ""
          }`}
          onClick={() =>
            setPestanaActiva(
              "estado",
            )
          }
        >
          Estado
        </button>
      </nav>

      {/* =====================================================
          RESUMEN
      ===================================================== */}

      {pestanaActiva ===
        "resumen" && (
        <div className="reportes-bento-contenido">

          <article className="bento-section bento-section-grande">
            <div className="bento-section-header">
              <div>
                <span className="reportes-eyebrow">
                  RESUMEN EJECUTIVO
                </span>

                <h2>
                  Lectura general del período
                </h2>
              </div>
            </div>

            <div className="resumen-ejecutivo-grid">

              <div>
                <span>
                  Mayor demanda
                </span>

                <strong>
                  {rendimientoDepartamentos[0]
                    ?.nombre ||
                    "Sin datos"}
                </strong>

                <small>
                  {rendimientoDepartamentos[0]
                    ? `${rendimientoDepartamentos[0].total} actividades`
                    : ""}
                </small>
              </div>

              <div>
                <span>
                  Mayor carga
                </span>

                <strong>
                  {rendimientoPersonas[0]
                    ?.nombre ||
                    "Sin datos"}
                </strong>

                <small>
                  {rendimientoPersonas[0]
                    ? formatearMinutos(
                        rendimientoPersonas[0]
                          .tiempo,
                      )
                    : ""}
                </small>
              </div>

              <div>
                <span>
                  Jornadas sobrecargadas
                </span>

                <strong>
                  {
                    metricas.diasSobrecargados
                  }
                </strong>

                <small>
                  Más de 8 horas
                </small>
              </div>

            </div>
          </article>

          <article className="bento-section bento-section-interferencias">
            <div className="bento-section-header">
              <div>
                <span className="reportes-eyebrow">
                  FLUJO
                </span>

                <h2>
                  Comportamiento de las tareas
                </h2>
              </div>
            </div>

            <div className="flujo-resumen">

              <div className="flujo-item">
                <span className="indicador-punto indicador-punto-verde" />

                <div>
                  <strong>
                    Tareas que fluyeron
                  </strong>

                  <small>
                    Sin interrupción identificada
                  </small>
                </div>

                <strong>
                  {
                    tareasPeriodo.filter(
                      (tarea) =>
                        obtenerEstadoInterferencia(
                          tarea,
                        ).tipo ===
                        "fluida",
                    ).length
                  }
                </strong>
              </div>

              <div className="flujo-item">
                <span className="indicador-punto indicador-punto-rojo" />

                <div>
                  <strong>
                    Tareas interrumpidas
                  </strong>

                  <small>
                    Presentaron un cruce identificado
                  </small>
                </div>

                <strong>
                  {
                    tareasPeriodo.filter(
                      (tarea) =>
                        obtenerEstadoInterferencia(
                          tarea,
                        ).tipo ===
                        "interrumpida",
                    ).length
                  }
                </strong>
              </div>

            </div>
          </article>

        </div>
      )}

      {/* =====================================================
          ACTIVIDADES
      ===================================================== */}

      {pestanaActiva ===
        "actividades" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                ACTIVIDADES
              </span>

              <h2>
                ¿Qué hizo el equipo?
              </h2>

              <p>
                Cada actividad muestra un
                indicador de flujo para identificar
                rápidamente si tuvo una interrupción.
              </p>
            </div>

            <span className="bento-contador">
              {tareasPeriodo.length} actividades
            </span>
          </div>

          <div className="actividades-bento">

            {actividadesVisibles.map(
              (tarea) => {
                const estado =
                  obtenerEstadoInterferencia(
                    tarea,
                  );

                const interrupciones =
                  estado.detalles;

                return (
                  <article
                    className={`actividad-bento ${
                      estado.tipo ===
                      "interrumpida"
                        ? "actividad-bento-interrumpida"
                        : ""
                    }`}
                    key={tarea.id}
                  >

                    <div className="actividad-bento-top">

                      <div className="actividad-titulo-wrap">

                        <span
                          className={`indicador-punto ${estado.clase}`}
                          title={
                            estado.texto
                          }
                        />

                        <div>
                          <strong>
                            {tarea.titulo ||
                              "Sin título"}
                          </strong>

                          <small>
                            {
                              obtenerNombreDepartamento(
                                tarea.departamento_id,
                              )
                            }
                          </small>
                        </div>

                      </div>

                      <span className="actividad-tiempo">
                        {formatearMinutos(
                          obtenerMinutosPlanificados(
                            tarea,
                          ),
                        )}
                      </span>

                    </div>

                    <p className="actividad-descripcion">
                      {tarea.descripcion ||
                        "Sin descripción registrada."}
                    </p>

                    <div className="actividad-meta">

                      <span>
                        Responsable
                        <strong>
                          {obtenerNombreUsuario(
                            tarea.responsable_id,
                          )}
                        </strong>
                      </span>

                      <span>
                        Fecha
                        <strong>
                          {formatearFecha(
                            tarea.fecha_inicio ||
                              tarea.fecha,
                          )}
                        </strong>
                      </span>

                      <span>
                        Estado
                        <strong>
                          {obtenerTextoEstado(
                            tarea.estado,
                          )}
                        </strong>
                      </span>

                    </div>

                    {estado.tipo ===
                      "interrumpida" && (
                      <div className="actividad-interrupcion">

                        <div>
                          <span>
                            TAREA INTERRUMPIDA
                          </span>

                          <strong>
                            Interferencia detectada
                          </strong>
                        </div>

                        {interrupciones.map(
                          (item) => (
                            <div
                              className="interrupcion-detalle"
                              key={item.id}
                            >
                              <small>
                                Actividad que generó el cruce
                              </small>

                              <strong>
                                {
                                  item
                                    .tareaInterrumpe
                                    .titulo
                                }
                              </strong>

                              <small>
                                Intervino / solicitó
                              </small>

                              <strong>
                                {
                                  item.interventor
                                }
                              </strong>
                            </div>
                          ),
                        )}

                      </div>
                    )}

                    {estado.tipo ===
                      "fluida" && (
                      <div className="actividad-flujo">

                        <span className="indicador-punto indicador-punto-verde" />

                        <span>
                          Fluyó sin interrupciones
                        </span>

                      </div>
                    )}

                  </article>
                );
              },
            )}

          </div>

          {totalPaginasActividades >
            1 && (
            <div className="reporte-paginacion">

              <button
                type="button"
                onClick={() =>
                  setPaginaActividades(
                    (pagina) =>
                      Math.max(
                        1,
                        pagina - 1,
                      ),
                  )
                }
                disabled={
                  paginaActividades ===
                  1
                }
              >
                Anterior
              </button>

              <span>
                Página{" "}
                {paginaActividades}{" "}
                de{" "}
                {
                  totalPaginasActividades
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setPaginaActividades(
                    (pagina) =>
                      Math.min(
                        totalPaginasActividades,
                        pagina + 1,
                      ),
                  )
                }
                disabled={
                  paginaActividades ===
                  totalPaginasActividades
                }
              >
                Siguiente
              </button>

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          DEPARTAMENTOS
      ===================================================== */}

      {pestanaActiva ===
        "departamentos" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                DEMANDA
              </span>

              <h2>
                ¿Qué departamentos generan más trabajo?
              </h2>
            </div>
          </div>

          <div className="departamentos-bento">

            {rendimientoDepartamentos.map(
              (departamento) => (
                <article
                  className="departamento-bento"
                  key={departamento.id}
                >
                  <span>
                    {
                      departamento.nombre
                    }
                  </span>

                  <strong>
                    {
                      departamento.total
                    }
                  </strong>

                  <small>
                    actividades
                  </small>

                  <div className="departamento-linea">
                    <span
                      style={{
                        width: `${Math.min(
                          departamento.porcentaje,
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="departamento-footer">
                    <span>
                      {departamento.porcentaje.toFixed(
                        1,
                      )}
                      %
                    </span>

                    <strong>
                      {formatearMinutos(
                        departamento.tiempo,
                      )}
                    </strong>
                  </div>
                </article>
              ),
            )}

          </div>

        </section>
      )}

      {/* =====================================================
          PERSONAS
      ===================================================== */}

      {pestanaActiva ===
        "personas" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                CARGA DEL EQUIPO
              </span>

              <h2>
                ¿Quién tiene mayor carga?
              </h2>

              <p>
                Selecciona una persona para
                consultar el detalle.
              </p>
            </div>
          </div>

          <div className="personas-bento">

            {personasVisibles.map(
              (persona) => (
                <article
                  className="persona-bento"
                  key={persona.id}
                  onClick={() =>
                    setPersonaSeleccionada(
                      persona,
                    )
                  }
                >

                  <div className="persona-bento-header">

                    <div className="persona-avatar">
                      {persona.nombre
                        .split(" ")
                        .map(
                          (parte) =>
                            parte.charAt(
                              0,
                            ),
                        )
                        .join("")
                        .substring(
                          0,
                          2,
                        )
                        .toUpperCase()}
                    </div>

                    <div>
                      <strong>
                        {
                          persona.nombre
                        }
                      </strong>

                      <small>
                        {
                          persona.total
                        }{" "}
                        actividades
                      </small>
                    </div>

                  </div>

                  <div className="persona-bento-metricas">

                    <div>
                      <span>
                        Carga
                      </span>

                      <strong>
                        {formatearMinutos(
                          persona.tiempo,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Días
                      </span>

                      <strong>
                        {
                          persona.diasTrabajados
                        }
                      </strong>
                    </div>

                  </div>

                  <div className="persona-carga-barra">
                    <span
                      style={{
                        width: `${Math.min(
                          (persona.tiempo /
                            Math.max(
                              1,
                              persona.diasTrabajados,
                            ) /
                            MINUTOS_JORNADA) *
                            100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="persona-bento-footer">

                    <span>
                      Normal{" "}
                      {
                        persona.diasNormales
                      }
                    </span>

                    <span>
                      Alta{" "}
                      {
                        persona.diasCargaAlta
                      }
                    </span>

                    <span>
                      Sobre{" "}
                      {
                        persona.diasSobrecargados
                      }
                    </span>

                  </div>

                  <div className="persona-ver">
                    Ver detalle →
                  </div>

                </article>
              ),
            )}

          </div>

          {totalPaginasPersonas >
            1 && (
            <div className="reporte-paginacion">

              <button
                type="button"
                onClick={() =>
                  setPaginaPersonas(
                    (pagina) =>
                      Math.max(
                        1,
                        pagina - 1,
                      ),
                  )
                }
                disabled={
                  paginaPersonas ===
                  1
                }
              >
                Anterior
              </button>

              <span>
                Página{" "}
                {paginaPersonas} de{" "}
                {
                  totalPaginasPersonas
                }
              </span>

              <button
                type="button"
                onClick={() =>
                  setPaginaPersonas(
                    (pagina) =>
                      Math.min(
                        totalPaginasPersonas,
                        pagina + 1,
                      ),
                  )
                }
                disabled={
                  paginaPersonas ===
                  totalPaginasPersonas
                }
              >
                Siguiente
              </button>

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          ALERTAS
      ===================================================== */}

      {pestanaActiva ===
        "alertas" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                ALERTAS OPERATIVAS
              </span>

              <h2>
                Jornadas con mayor carga
              </h2>
            </div>
          </div>

          {diasCriticos.length ===
          0 ? (
            <div className="reporte-vacio">
              <strong>
                No se detectaron jornadas críticas.
              </strong>

              <span>
                La planificación se mantuvo
                dentro de la capacidad disponible.
              </span>
            </div>
          ) : (
            <div className="alertas-bento">

              {diasCriticos.map(
                (dia, index) => (
                  <article
                    className={`alerta-bento ${
                      dia.nivel ===
                      "sobrecargado"
                        ? "alerta-bento-sobrecarga"
                        : ""
                    }`}
                    key={`${dia.fecha}-${dia.usuarioId}-${index}`}
                  >

                    <span className="bento-label">
                      {formatearFecha(
                        dia.fecha,
                      )}
                    </span>

                    <strong>
                      {dia.nombre}
                    </strong>

                    <div className="alerta-metricas">

                      <div>
                        <span>
                          Actividades
                        </span>

                        <strong>
                          {
                            dia.cantidadTareas
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Carga
                        </span>

                        <strong>
                          {formatearMinutos(
                            dia.minutos,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Exceso
                        </span>

                        <strong>
                          {formatearMinutos(
                            dia.exceso,
                          )}
                        </strong>
                      </div>

                    </div>

                    <span
                      className={`reporte-badge ${
                        dia.nivel ===
                        "sobrecargado"
                          ? "reporte-badge-sobrecarga"
                          : "reporte-badge-alta"
                      }`}
                    >
                      {obtenerTextoCarga(
                        dia.nivel,
                      )}
                    </span>

                  </article>
                ),
              )}

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          TRAZABILIDAD
      ===================================================== */}

      {pestanaActiva ===
        "trazabilidad" && (
        <div className="reportes-bento-contenido">

          <section className="bento-section">

            <div className="bento-section-header">
              <div>
                <span className="reportes-eyebrow">
                  TRAZABILIDAD
                </span>

                <h2>
                  ¿Qué ocurrió durante el período?
                </h2>

                <p>
                  Relación entre departamento,
                  actividad, responsable, fecha,
                  duración, urgencia e interferencias.
                </p>
              </div>
            </div>

            <div className="trazabilidad-kpis">

              <article>
                <span>
                  Tareas urgentes
                </span>

                <strong>
                  {
                    tareasUrgentes.length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Interferencias
                </span>

                <strong>
                  {
                    interferencias.length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Días afectados
                </span>

                <strong>
                  {
                    diasMayorInterferencia.length
                  }
                </strong>
              </article>

              <article>
                <span>
                  Tiempo de interferencia
                </span>

                <strong>
                  {formatearMinutos(
                    interferencias.reduce(
                      (
                        total,
                        item,
                      ) =>
                        total +
                        item.duracion,
                      0,
                    ),
                  )}
                </strong>
              </article>

            </div>

          </section>

          <section className="bento-section">

            <div className="bento-section-header">
              <div>
                <span className="reportes-eyebrow">
                  INTERFERENCIAS
                </span>

                <h2>
                  Tareas que fueron interrumpidas
                </h2>
              </div>
            </div>

            {interferencias.length ===
            0 ? (
              <div className="reporte-vacio">
                <strong>
                  No se detectaron interferencias.
                </strong>

                <span>
                  No existen cruces identificables
                  durante el período.
                </span>
              </div>
            ) : (
              <div className="interferencias-bento">

                {interferencias.map(
                  (item) => (
                    <article
                      className="interferencia-bento"
                      key={item.id}
                    >

                      <div className="interferencia-bento-indicador">
                        <span className="indicador-punto indicador-punto-rojo" />
                      </div>

                      <div className="interferencia-bento-contenido">

                        <span className="bento-label">
                          {
                            formatearFecha(
                              item.fecha,
                            )
                          }
                        </span>

                        <strong>
                          {
                            item
                              .tareaInterrumpida
                              .titulo
                          }
                        </strong>

                        <small>
                          Tarea interrumpida
                        </small>

                        <div className="interferencia-relacion">

                          <span>
                            Interrumpida por
                          </span>

                          <strong>
                            {
                              item
                                .tareaInterrumpe
                                .titulo
                            }
                          </strong>

                        </div>

                        <div className="interferencia-persona">

                          <span>
                            Intervino / solicitó
                          </span>

                          <strong>
                            {
                              item.interventor
                            }
                          </strong>

                        </div>

                      </div>

                      <div className="interferencia-tiempo">
                        {formatearMinutos(
                          item.duracion,
                        )}
                      </div>

                    </article>
                  ),
                )}

              </div>
            )}

          </section>

          <section className="bento-section">

            <div className="bento-section-header">
              <div>
                <span className="reportes-eyebrow">
                  DÍAS DE MAYOR INTERFERENCIA
                </span>

                <h2>
                  Fechas que concentraron más cruces
                </h2>
              </div>
            </div>

            <div className="dias-interferencia-bento">

              {diasMayorInterferencia.map(
                (dia) => (
                  <article
                    key={dia.fecha}
                  >
                    <span>
                      {
                        formatearFecha(
                          dia.fecha,
                        )
                      }
                    </span>

                    <strong>
                      {dia.cantidad}
                    </strong>

                    <small>
                      interferencias
                    </small>

                    <em>
                      {formatearMinutos(
                        dia.minutos,
                      )}
                    </em>
                  </article>
                ),
              )}

            </div>

          </section>

        </div>
      )}

      {/* =====================================================
          PRIORIDADES
      ===================================================== */}

      {pestanaActiva ===
        "prioridades" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                SEGUIMIENTO
              </span>

              <h2>
                Actividades que requieren atención
              </h2>
            </div>
          </div>

          {actividadesPrioritarias.length ===
          0 ? (
            <div className="reporte-vacio">
              <strong>
                No existen actividades prioritarias pendientes.
              </strong>

              <span>
                No se encontraron actividades
                de prioridad alta sin completar.
              </span>
            </div>
          ) : (
            <div className="prioridades-bento">

              {actividadesPrioritarias.map(
                (tarea) => (
                  <article
                    key={tarea.id}
                  >

                    <div className="prioridad-top">
                      <span className="reporte-badge reporte-badge-prioridad">
                        Alta
                      </span>

                      <span>
                        {
                          formatearFecha(
                            tarea.fecha_inicio ||
                              tarea.fecha,
                          )
                        }
                      </span>
                    </div>

                    <strong>
                      {
                        tarea.titulo
                      }
                    </strong>

                    <p>
                      {
                        obtenerNombreDepartamento(
                          tarea.departamento_id,
                        )
                      }
                    </p>

                    <div>
                      <span>
                        Responsable
                      </span>

                      <strong>
                        {
                          obtenerNombreUsuario(
                            tarea.responsable_id,
                          )
                        }
                      </strong>
                    </div>

                  </article>
                ),
              )}

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          ESTADO
      ===================================================== */}

      {pestanaActiva ===
        "estado" && (
        <section className="bento-section">

          <div className="bento-section-header">
            <div>
              <span className="reportes-eyebrow">
                ESTADO
              </span>

              <h2>
                Estado general del trabajo
              </h2>
            </div>
          </div>

          <div className="estado-bento">

            <article>
              <span>
                Completadas
              </span>

              <strong>
                {
                  metricas.completadas
                }
              </strong>

              <small>
                {metricas.total > 0
                  ? `${(
                      (metricas.completadas /
                        metricas.total) *
                      100
                    ).toFixed(
                      1,
                    )}% del total`
                  : "0%"}
              </small>
            </article>

            <article>
              <span>
                En proceso
              </span>

              <strong>
                {
                  metricas.enProceso
                }
              </strong>

              <small>
                {metricas.total > 0
                  ? `${(
                      (metricas.enProceso /
                        metricas.total) *
                      100
                    ).toFixed(
                      1,
                    )}% del total`
                  : "0%"}
              </small>
            </article>

            <article>
              <span>
                Pendientes
              </span>

              <strong>
                {
                  metricas.pendientes
                }
              </strong>

              <small>
                {metricas.total > 0
                  ? `${(
                      (metricas.pendientes /
                        metricas.total) *
                      100
                    ).toFixed(
                      1,
                    )}% del total`
                  : "0%"}
              </small>
            </article>

          </div>

        </section>
      )}

      {/* =====================================================
          MODAL PERSONA
      ===================================================== */}

      {personaSeleccionada && (
        <div
          className="reporte-modal-overlay"
          onClick={() =>
            setPersonaSeleccionada(
              null,
            )
          }
        >
          <div
            className="reporte-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="reporte-modal-header">

              <div>
                <span className="reportes-eyebrow">
                  DETALLE DE CARGA
                </span>

                <h2>
                  {
                    personaSeleccionada.nombre
                  }
                </h2>

                <p>
                  {
                    personaSeleccionada.total
                  }{" "}
                  actividades ·{" "}
                  {formatearMinutos(
                    personaSeleccionada.tiempo,
                  )}{" "}
                  planificados
                </p>
              </div>

              <button
                type="button"
                className="reporte-modal-cerrar"
                onClick={() =>
                  setPersonaSeleccionada(
                    null,
                  )
                }
                aria-label="Cerrar"
              >
                ×
              </button>

            </div>

            <div className="reporte-modal-metricas">

              <article>
                <span>
                  Días trabajados
                </span>

                <strong>
                  {
                    personaSeleccionada.diasTrabajados
                  }
                </strong>
              </article>

              <article>
                <span>
                  Normales
                </span>

                <strong>
                  {
                    personaSeleccionada.diasNormales
                  }
                </strong>
              </article>

              <article>
                <span>
                  Carga alta
                </span>

                <strong>
                  {
                    personaSeleccionada.diasCargaAlta
                  }
                </strong>
              </article>

              <article>
                <span>
                  Sobrecarga
                </span>

                <strong>
                  {
                    personaSeleccionada.diasSobrecargados
                  }
                </strong>
              </article>

            </div>

            <div className="reporte-modal-seccion">

              <div className="reporte-modal-seccion-header">
                <h3>
                  Actividades asignadas
                </h3>

                <p>
                  Las actividades mantienen
                  el indicador de flujo.
                </p>
              </div>

              <div className="reporte-modal-tareas">

                {personaSeleccionada.tareas.map(
                  (tarea) => {
                    const estado =
                      obtenerEstadoInterferencia(
                        tarea,
                      );

                    return (
                      <div
                        className="reporte-modal-tarea"
                        key={tarea.id}
                      >

                        <div className="modal-tarea-identidad">

                          <span
                            className={`indicador-punto ${estado.clase}`}
                          />

                          <div>
                            <strong>
                              {
                                tarea.titulo
                              }
                            </strong>

                            <span>
                              {
                                formatearFecha(
                                  tarea.fecha_inicio ||
                                    tarea.fecha,
                                )
                              }
                            </span>

                            <small>
                              {
                                obtenerNombreDepartamento(
                                  tarea.departamento_id,
                                )
                              }
                            </small>
                          </div>

                        </div>

                        <div className="modal-tarea-derecha">

                          <strong>
                            {formatearMinutos(
                              obtenerMinutosPlanificados(
                                tarea,
                              ),
                            )}
                          </strong>

                          <span>
                            {
                              estado.texto
                            }
                          </span>

                        </div>

                      </div>
                    );
                  },
                )}

              </div>

            </div>

            <div className="reporte-modal-seccion">

              <div className="reporte-modal-seccion-header">
                <h3>
                  Jornadas críticas
                </h3>
              </div>

              <div className="reporte-modal-jornadas">

                {personaSeleccionada.jornadas
                  .filter(
                    (dia) =>
                      dia.nivel ===
                        "alta" ||
                      dia.nivel ===
                        "sobrecargado",
                  )
                  .map(
                    (dia) => (
                      <div
                        className="reporte-modal-jornada"
                        key={`${dia.fecha}-${dia.usuarioId}`}
                      >

                        <div>
                          <strong>
                            {
                              formatearFecha(
                                dia.fecha,
                              )
                            }
                          </strong>

                          <span>
                            {
                              dia.cantidadTareas
                            }{" "}
                            tareas ·{" "}
                            {formatearMinutos(
                              dia.minutos,
                            )}
                          </span>
                        </div>

                        <span
                          className={`reporte-badge ${
                            dia.nivel ===
                            "sobrecargado"
                              ? "reporte-badge-sobrecarga"
                              : "reporte-badge-alta"
                          }`}
                        >
                          {obtenerTextoCarga(
                            dia.nivel,
                          )}
                        </span>

                      </div>
                    ),
                  )}

              </div>

            </div>

            <div className="reporte-modal-footer">

              <span>
                Capacidad de referencia:
                <strong>
                  {" "}
                  8 horas diarias
                </strong>
              </span>

              <button
                type="button"
                className="reportes-btn reportes-btn-secundario"
                onClick={() =>
                  setPersonaSeleccionada(
                    null,
                  )
                }
              >
                Cerrar
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =====================================================
          METODOLOGÍA
      ===================================================== */}

      <section className="reporte-nota">

        <strong>
          ¿Cómo se calculan estos datos?
        </strong>

        <p>
          El reporte utiliza una jornada de
          <strong>
            {" "}
            8 horas diarias
          </strong>
          , equivalentes a 480 minutos por
          persona.
        </p>

        <p>
          Las tareas de varios días ocupan
          una jornada completa de 8 horas en
          cada día del rango. Las tareas de un
          solo día con horario válido utilizan
          la duración entre hora de inicio y
          hora de fin. Si no existe un horario
          válido se utiliza el tiempo estimado
          registrado.
        </p>

        <p>
          <strong>
            Punto rojo:
          </strong>{" "}
          la actividad presenta una interrupción
          identificada mediante el cruce de
          actividades.{" "}
          <strong>
            Punto verde:
          </strong>{" "}
          no se identificó una interrupción para
          esa actividad dentro de la información
          disponible.
        </p>

        <p>
          Las interferencias permiten identificar
          qué actividad fue afectada, qué actividad
          generó el cruce y quién aparece asociado
          como responsable o solicitante cuando
          existe esa información.
        </p>

      </section>

    </section>
  );
}

export default Reportes;