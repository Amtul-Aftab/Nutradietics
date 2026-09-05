export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1>Nutradietics</h1>
      <p style={{ marginTop: "0.75rem", color: "#555" }}>
        A marketplace connecting clients with nutritionists and fitness
        trainers.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        Health check:{" "}
        <a href="/health" style={{ textDecoration: "underline" }}>
          /health
        </a>{" "}
        &middot;{" "}
        <a href="/api/health" style={{ textDecoration: "underline" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
