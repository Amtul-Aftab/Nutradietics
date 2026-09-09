import type { MedicalHistoryEntry } from "@/lib/medical-history";
import {
  humanizeEnum,
  formatTimestamp,
  formatStandardFields,
  computeBmi,
} from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  SUMMARY: "AI summary",
  SESSION_RECORD: "Session",
};

const DETAIL_LABELS: Record<string, string> = {
  description: "Description",
  professionalType: "Professional type",
  summary: "Summary",
  diagnosis: "Diagnosis / assessment",
  plan: "Recommended plan",
};

// Detail values that are enum-like and should render human-readable.
const HUMANIZE_VALUE_KEYS = new Set(["professionalType"]);

/** Labeled row used throughout the timeline for a single term/value pair. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="history__detail">
      <dt>{label}</dt>
      {/* AI/client/professional text rendered as inert text (Req 14.4). */}
      <dd>{value}</dd>
    </div>
  );
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
      {entries.map((entry) => {
        const fieldRows = formatStandardFields(entry.standardFields);
        const bmi = computeBmi(entry.standardFields);
        const answers = entry.answers ?? [];
        const textDetails = Object.entries(entry.details).filter(
          ([, value]) => value,
        );

        return (
          <li key={entry.id} className="history__item">
            <div className="history__head">
              <span
                className={`slots__badge slots__badge--${entry.type.toLowerCase()}`}
              >
                {TYPE_LABELS[entry.type] ?? entry.type}
              </span>
              <strong className="history__title">{entry.title}</strong>
              <time className="history__when">
                {formatTimestamp(entry.at)}
              </time>
            </div>

            <dl className="history__details">
              {textDetails.map(([key, value]) => (
                <DetailRow
                  key={key}
                  label={DETAIL_LABELS[key] ?? key}
                  value={
                    HUMANIZE_VALUE_KEYS.has(key)
                      ? humanizeEnum(String(value))
                      : String(value)
                  }
                />
              ))}
            </dl>

            {/* Structured intake fields as a clean labeled grid + derived BMI. */}
            {fieldRows.length > 0 && (
              <div className="history__section">
                <p className="history__section-label">Intake details</p>
                <dl className="history__grid">
                  {fieldRows.map((f) => (
                    <div key={f.key} className="history__cell">
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                  {bmi && (
                    <div className="history__cell">
                      <dt>BMI</dt>
                      <dd>{bmi.display}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Follow-up questions and answers as readable Q/A rows. */}
            {answers.length > 0 && (
              <div className="history__section">
                <p className="history__section-label">Follow-up answers</p>
                <dl className="history__details">
                  {answers.map((qa, i) => (
                    <DetailRow key={i} label={qa.question} value={qa.answer} />
                  ))}
                </dl>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
