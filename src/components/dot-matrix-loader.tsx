const GRID = 7;
const FRAMES = 12;
const CENTER = (GRID - 1) / 2;

// A ring of lit dots expanding from the centre, one step per frame.
function isOn(x: number, y: number, frame: number) {
  const dist = Math.hypot(x - CENTER, y - CENTER);
  const radius = (frame / (FRAMES - 1)) * (CENTER * Math.SQRT2 + 1) - 0.5;
  return Math.abs(dist - radius) < 0.75;
}

function keyframes(bits: string) {
  const steps = [...bits].map((b, i) => `${((i / FRAMES) * 100).toFixed(2)}%{opacity:${b}}`);
  return `@keyframes dm${bits}{${steps.join("")}100%{opacity:${bits[0]}}}`;
}

const dots = Array.from({ length: GRID * GRID }, (_, i) => {
  const x = i % GRID;
  const y = Math.floor(i / GRID);
  const bits = Array.from({ length: FRAMES }, (_, f) => (isOn(x, y, f) ? "1" : "0")).join("");
  return { x, y, bits };
});

const css = [
  ".dm-off{fill:var(--dm-off)}",
  ".dm-on{fill:var(--dm-on);opacity:0;animation-duration:var(--dm-dur);animation-iteration-count:infinite;animation-timing-function:step-end}",
  "@media (prefers-reduced-motion:reduce){.dm-on{animation:none!important}}",
  ...new Set(dots.map((d) => keyframes(d.bits))),
].join("");

export function DotMatrixLoader({
  size = 10,
  on = "var(--loader-on)",
  off = "var(--loader-off)",
  duration = "2.25s",
}: {
  size?: number;
  on?: string;
  off?: string;
  duration?: string;
}) {
  const style = { "--dm-on": on, "--dm-off": off, "--dm-dur": duration } as React.CSSProperties;

  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={style} aria-hidden="true">
      <style>{css}</style>
      {dots.map(({ x, y, bits }) => (
        <g key={`${x}-${y}`}>
          <circle className="dm-off" cx={x * 6 + 3} cy={y * 6 + 3} r={2} />
          <circle className="dm-on" cx={x * 6 + 3} cy={y * 6 + 3} r={2} style={{ animationName: `dm${bits}` }} />
        </g>
      ))}
    </svg>
  );
}
