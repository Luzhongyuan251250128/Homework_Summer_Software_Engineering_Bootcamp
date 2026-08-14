export default function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
      <p>{title}</p>
      {action}
    </div>
  );
}
