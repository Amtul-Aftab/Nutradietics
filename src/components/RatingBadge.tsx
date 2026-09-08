// Shows average rating + review count, or "No reviews yet" (Req 16.5, 16.6).

export function RatingBadge({
  average,
  count,
}: {
  average: number | null;
  count: number;
}) {
  if (count === 0 || average == null) {
    return <span className="rating rating--empty">No reviews yet</span>;
  }
  return (
    <span className="rating">
      <span className="rating__star" aria-hidden="true">
        {"\u2605"}
      </span>
      <strong>{average.toFixed(1)}</strong>
      <span className="rating__count">
        ({count} review{count === 1 ? "" : "s"})
      </span>
    </span>
  );
}
