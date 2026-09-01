import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./EditarDepartamento.css";

function EditarDepartamento() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDepartamento();
  }, [id]);

  const cargarDepartamento = async () => {
    setCargando(true);
    setError("");

    const { data, error } = await supabase
      .from("departamentos")
      .select("id, nombre, descripcion")
      .eq("id", id)
      .single();

    if (error) {
      console.error(
        "Error cargando departamento:",
        error
      );

      setError(
        "No se pudo cargar la información del departamento."
      );

      setCargando(false);
      return;
    }

    setNombre(data?.nombre || "");
    setDescripcion(data?.descripcion || "");

    setCargando(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMensaje("");

    const nombreLimpio = nombre.trim();
    const descripcionLimpia = descripcion.trim();

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

    const { error } = await supabase
      .from("departamentos")
      .update({
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      })
      .eq("id", id);

    if (error) {
      console.error(
        "Error actualizando departamento:",
        error
      );

      if (error.code === "23505") {
        setError(
          "Ya existe un departamento con ese nombre."
        );
      } else {
        setError(
          error.message ||
            "No se pudo actualizar el departamento."
        );
      }

      setGuardando(false);
      return;
    }

    setMensaje(
      "Departamento actualizado correctamente."
    );

    setGuardando(false);

    setTimeout(() => {
      navigate("/departamentos");
    }, 800);
  };

  if (cargando) {
    return (
      <section className="editar-departamento-page">
        <div className="editar-departamento-loading">
          <span className="editar-departamento-loader" />
          <p>
            Cargando departamento...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="editar-departamento-page">

      <div className="editar-departamento-header">

        <div>
          <span className="eyebrow">
            ORGANIZACIÓN
          </span>

          <h1>Editar departamento</h1>

          <p>
            Actualiza la información del departamento.
          </p>
        </div>

      </div>

      {error && (
        <div className="editar-departamento-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="editar-departamento-mensaje">
          {mensaje}
        </div>
      )}

      <div className="editar-departamento-card">

        <div className="editar-departamento-section">

          <h2>
            Información del departamento
          </h2>

          <p>
            Modifica los datos y guarda los cambios.
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="editar-departamento-form"
        >

          <div className="editar-departamento-form-group">

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

          <div className="editar-departamento-form-group">

            <label htmlFor="descripcion">
              Descripción
            </label>

            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) =>
                setDescripcion(e.target.value)
              }
              placeholder="Ej. Área de marketing y comunicación"
              disabled={guardando}
            />

          </div>

          <div className="editar-departamento-actions">

            <button
              type="button"
              className="editar-departamento-btn-secundario"
              onClick={() =>
                navigate("/departamentos")
              }
              disabled={guardando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="editar-departamento-btn-principal"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : "Guardar cambios"}
            </button>

          </div>

        </form>

      </div>

    </section>
  );
}

export default EditarDepartamento;

