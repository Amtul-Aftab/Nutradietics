// Displays a professional's profile photo, or a neutral initials placeholder
// when none exists (Req 15.4). Plain <img> is used (Supabase public URL).

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export function Avatar({
  url,
  name,
  size = 48,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const dimension = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name}'s profile photo`}
        className="avatar avatar--img"
        style={dimension}
      />
    );
  }
  return (
    <span
      className="avatar avatar--placeholder"
      style={{ ...dimension, fontSize: size * 0.4 }}
      aria-label={`${name} (no photo)`}
    >
      {initials(name)}
    </span>
  );
}
