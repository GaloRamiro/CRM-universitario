function StatCard({ title, value, description, type = "default" }) {
  return (
    <article className={`stat-card stat-card-${type}`}>
      <div className="stat-card-top">
        <span>{title}</span>
      </div>

      <strong className="stat-value">{value}</strong>

      <p>{description}</p>
    </article>
  );
}

export default StatCard;