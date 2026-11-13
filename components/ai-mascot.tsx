import "./ai-mascot.css";

export function AiMascot({ loading = false }: { loading?: boolean }) {
  return (
    <div className={loading ? "ai-mascot-peek ai-mascot-loading" : "ai-mascot-peek"} aria-hidden="true">
      <div className="ai-mascot-head">
        <span className="ai-mascot-antenna" />
        <span className="ai-mascot-shell" />
        <span className="ai-mascot-visor">
          <span className="ai-mascot-gaze">
            <span className="ai-mascot-eyes" />
          </span>
        </span>
      </div>
    </div>
  );
}
