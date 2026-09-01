import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";

import "./Departamentos.css";

function Departamentos() {

  const navigate = useNavigate();

  const [departamentos, setDepartamentos] = useState([]);

  const [nombre, setNombre] = useState("");

  const [descripcion, setDescripcion] = useState("");

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");

  const [error, setError] = useState("");

  const cargarDepartamentos = async () => {

    setCargando(true);

    setError("");

    const { data, error } = await supabase
      .from("departamentos")
      .select("id, nombre, descripcion")
      .order("nombre", { ascending: true });

    if (error) {

      console.error(
        "Error cargando departamentos:",
        error
      );

      setError(
        "No se pudieron cargar los departamentos."
      );

      setDepartamentos([]);

    } else {

      setDepartamentos(data || []);

    }

    setCargando(false);
  };

  useEffect(() => {
    cargarDepartamentos();
  }, []);

  const handleSubmit = async (e) => {

    e.preventDefault();

    setMensaje("");

    setError("");

    const nombreLimpio = nombre.trim();

    const descripcionLimpia =
      descripcion.trim();

    if (!nombreLimpio) {

      setError(
        "El nombre del departamento es obligatorio."
      );

      return;
    }

    if (!descripcionLimpia) {

      setError(
        "La descripción del departamento es obligatoria."
      );

      return;
    }

    setGuardando(true);

    const { data, error } = await supabase
      .from("departamentos")
      .insert({
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      })
      .select()
      .single();

    if (error) {

      console.error(
        "Error creando departamento:",
        error
      );

      if (error.code === "23505") {

        setError(
          "Ya existe un departamento con ese nombre."
        );

      } else {

        setError(
          error.message ||
            "No se pudo crear el departamento."
        );
      }

      setGuardando(false);

      return;
    }

    setDepartamentos((actuales) =>
      [...actuales, data].sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre)
      )
    );

    setNombre("");

    setDescripcion("");

    setMensaje(
      "Departamento creado correctamente."
    );

    setGuardando(false);
  };

  const editarDepartamento = (id) => {

    navigate(
      `/departamentos/${id}/editar`
    );
  };

  return (

    <section className="departamentos-page">

      {/* ENCABEZADO */}

      <div className="departamentos-header">

        <div>

          <span className="eyebrow">
            ORGANIZACIÓN
          </span>

          <h1>
            Departamentos
          </h1>

          <p>
            Administra las áreas y departamentos
            del sistema.
          </p>

        </div>

      </div>

      {/* NUEVO DEPARTAMENTO */}

      <div className="departamentos-card">

        <div className="departamentos-section">

          <h2>
            Nuevo departamento
          </h2>

          <p>
            Agrega un nuevo departamento al CRM.
          </p>

        </div>

        <form onSubmit={handleSubmit}>

          <div className="departamentos-form">

            <div className="form-group">

              <label htmlFor="nombre">
                Nombre del departamento
              </label>

              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) =>
                  setNombre(e.target.value)
                }
                placeholder="Ej. Marketing"
                disabled={guardando}
              />

            </div>

            <div className="form-group">

              <label htmlFor="descripcion">
                Descripción
              </label>

              <textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) =>
                  setDescripcion(
                    e.target.value
                  )
                }
                placeholder="Ej. Área de marketing y comunicación"
                disabled={guardando}
              />

            </div>

          </div>

          {mensaje && (
            <div className="departamentos-mensaje">
              {mensaje}
            </div>
          )}

          {error && (
            <div className="departamentos-error">
              {error}
            </div>
          )}

          <div className="departamentos-actions">

            <button
              type="submit"
              className="departamentos-btn"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : "Crear departamento"}
            </button>

          </div>

        </form>

      </div>

      {/* DEPARTAMENTOS REGISTRADOS */}

      <div className="departamentos-card">

        <div className="departamentos-section">

          <h2>
            Departamentos registrados
          </h2>

          <p>
            Consulta y administra las áreas
            disponibles en el CRM.
          </p>

        </div>

        <div className="departamentos-lista">

          {cargando ? (

            <p>
              Cargando departamentos...
            </p>

          ) : departamentos.length === 0 ? (

            <p>
              No existen departamentos registrados.
            </p>

          ) : (

            departamentos.map(
              (departamento) => (

                <div
                  className="departamento-item"
                  key={departamento.id}
                >

                  <div className="departamento-info">

                    <strong>
                      {departamento.nombre}
                    </strong>

                    <p>
                      {
                        departamento.descripcion ||
                        "Sin descripción"
                      }
                    </p>

                  </div>

                  <div className="departamento-item-actions">

                    <button
                      type="button"
                      className="departamento-btn-editar"
                      onClick={() =>
                        editarDepartamento(
                          departamento.id
                        )
                      }
                    >
                      Editar
                    </button>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>

    </section>

  );
}

export default Departamentos;