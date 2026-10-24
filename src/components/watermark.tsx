/**
 * Big faint word behind a heading (LOGIN, SIGNUP…), from next.js-shop: letters rise in once, then a shine
 * sweeps across on a loop. Styles: .watermark-letter / .watermark-shine in globals.css.
 * `className` positions and sizes it (it's absolutely positioned inside a `relative` parent).
 */
export function Watermark({ text, className }: { text: string; className: string }) {
  const letters = [...text];
  // The shine starts as the last letter finishes rising (delay + 0.9s rise)
  const shineDelay = `${(letters.length - 1) * 90 + 100 + 900}ms`;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute leading-none font-black tracking-tight whitespace-nowrap select-none ${className}`}
    >
      {letters.map((c, i) => (
        <span key={i} className="watermark-letter" style={{ "--i": i } as React.CSSProperties}>
          {c}
        </span>
      ))}
      <span className="watermark-shine absolute inset-0" style={{ "--shine-delay": shineDelay } as React.CSSProperties}>
        {letters.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </span>
    </span>
  );
}
