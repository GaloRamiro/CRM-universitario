import StatCard from "../components/ui/StatCard";

function Dashboard() {
  return (
    <section className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RESUMEN GENERAL</span>

          <h1>Dashboard</h1>

          <p>
            Consulta el estado de las solicitudes y la gestión de tu equipo.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Solicitudes"
          value="248"
          description="Solicitudes registradas"
          type="default"
        />

        <StatCard
          title="Pendientes"
          value="37"
          description="Requieren atención"
          type="warning"
        />

        <StatCard
          title="Urgentes"
          value="29"
          description="Solicitudes de última hora"
          type="danger"
        />

        <StatCard
          title="Atrasadas"
          value="18"
          description="Fuera del tiempo establecido"
          type="danger"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Solicitudes recientes</h2>

              <p>Últimos requerimientos registrados.</p>
            </div>
          </div>

          <div className="empty-state">
            <span>📋</span>

            <h3>Sin datos todavía</h3>

            <p>Cuando comencemos a registrar solicitudes aparecerán aquí.</p>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Solicitudes por tiempo</h2>

              <p>Clasificación de anticipación.</p>
            </div>
          </div>

          <div className="time-summary">
            <div className="time-item">
              <span className="dot planned"></span>
              <span>Planificadas</span>
              <strong>0</strong>
            </div>

            <div className="time-item">
              <span className="dot short"></span>
              <span>Anticipación corta</span>
              <strong>0</strong>
            </div>

            <div className="time-item">
              <span className="dot urgent"></span>
              <span>Urgentes</span>
              <strong>0</strong>
            </div>

            <div className="time-item">
              <span className="dot last-minute"></span>
              <span>Última hora</span>
              <strong>0</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
