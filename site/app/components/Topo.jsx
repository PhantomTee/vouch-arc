const CHARSET = " .:-=+*#%@";

function genRow(cols, row, seed) {
  let s = "";
  for (let c = 0; c < cols; c++) {
    const v =
      Math.sin((c / cols) * Math.PI * 2 * 3 + row * 0.4 + seed) * 0.6 +
      Math.sin((c / cols) * Math.PI * 2 * 7 - row * 0.15 + seed * 1.7) * 0.4;
    const n = (v + 1) / 2;
    const idx = Math.min(CHARSET.length - 1, Math.floor(n * CHARSET.length));
    s += CHARSET[idx];
  }
  return s;
}

// Deterministic ASCII contour texture: a Tempo-style topographic line-art
// background, rendered as density characters instead of SVG paths.
export default function Topo({ rows = 10, cols = 220, seed = 0 }) {
  const lines = [];
  for (let r = 0; r < rows; r++) lines.push(genRow(cols, r, seed));
  return (
    <div className="topo topo-mask" aria-hidden="true">
      <pre>{lines.join("\n")}</pre>
    </div>
  );
}
