import type { MedicalHistoryEntry } from "@/lib/medical-history";

const TYPE_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  SUMMARY: "AI summary",
  SESSION_RECORD: "Session",
};

const DETAIL_LABELS: Record<string, string> = {
  description: "Description",
  professionalType: "Professional type",
  standardFields: "Intake fields",
  followUpAnswers: "Follow-up answers",
  summary: "Summary",
  diagnosis: "Diagnosis / assessment",
  plan: "Recommended plan",
};

function formatWhen(at: string): string {
  return new Date(at).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MedicalHistoryTimeline({
  entries,
}: {
  entries: MedicalHistoryEntry[];
}) {
  if (entries.length === 0) {
    return <p className="slots__empty">No medical history yet.</p>;
  }

  return (
    <ol className="history">
      {entries.map((entry) => (
        <li key={entry.id} className="history__item">
          <div className="history__head">
            <span
              className={`slots__badge slots__badge--${entry.type.toLowerCase()}`}
            >
              {TYPE_LABELS[entry.type] ?? entry.type}
            </span>
            <strong className="history__title">{entry.title}</strong>
            <time className="history__when">{formatWhen(entry.at)}</time>
          </div>
          <dl className="history__details">
            {Object.entries(entry.details)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <div key={key} className="history__detail">
                  <dt>{DETAIL_LABELS[key] ?? key}</dt>
                  {/* AI/client/professional text rendered as inert text (Req 14.4). */}
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
