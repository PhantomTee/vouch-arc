const FILL = "█";
const EMPTY = "░";

export default function Gauge({ score = 0, max = 3 }) {
  const positive = score >= 0;
  const filled = Math.min(max, Math.abs(score));
  const bar = FILL.repeat(filled) + EMPTY.repeat(Math.max(0, max - filled));
  return (
    <span className={`gauge ${positive ? "up" : "down"}`}>
      <span className="bar">[{bar}]</span>
      <span className="val">{positive && score > 0 ? `+${score}` : score}</span>
    </span>
  );
}
