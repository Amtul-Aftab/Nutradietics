// A small, friendly "thinking" character shown during AI steps. Purely
// visual (CSS + inline SVG, no logic): a bobbing circular avatar with dot eyes
// and a smile, a coral corner badge, a row of three pulsing dots, and a short
// status message. Uses the app palette (teal, coral, sage).

export function ThinkingIndicator({ message }: { message: string }) {
  return (
    <div className="thinking" role="status" aria-live="polite">
      <div className="thinking__avatar">
        <svg
          className="thinking__face"
          viewBox="0 0 64 64"
          width="72"
          height="72"
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="30" fill="var(--sage)" />
          <circle cx="32" cy="32" r="30" fill="none" stroke="var(--teal)" strokeWidth="2" />
          {/* eyes */}
          <circle cx="24" cy="28" r="3.2" fill="var(--teal)" />
          <circle cx="40" cy="28" r="3.2" fill="var(--teal)" />
          {/* smile */}
          <path
            d="M22 38 Q32 46 42 38"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        {/* corner badge */}
        <span className="thinking__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M12 2l2.4 5.9L20.5 8l-4.5 4 1.4 6.4L12 15.6 6.6 18.4 8 12 3.5 8l6.1-.1z"
              fill="#fff"
            />
          </svg>
        </span>
      </div>

      <div className="thinking__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <p className="thinking__message">{message}</p>
      <p className="ai-credit">Powered by Google Gemini</p>
    </div>
  );
}
