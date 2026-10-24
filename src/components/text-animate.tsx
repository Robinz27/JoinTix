import type { CSSProperties } from "react";

// Magic UI's TextAnimate ("blurInUp"), done with CSS so it needs no client JavaScript: the text is drawn on
// the server and starts animating before the page hydrates.
//
// Thai is why it can't just split on characters: a vowel or tone mark (ิ ่ ้ ู) is its own code point,
// and a span around it alone draws it on a dotted circle away from its letter. Intl.Segmenter cuts by
// grapheme (letter + its marks) and, for the word mode and line breaks, by word — Thai has no spaces, and
// the segmenter knows where its words end. Each word stays whole on one line (whitespace-nowrap), so a
// long heading wraps between words rather than in the middle of one.

type By = "character" | "word";

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
const words = new Intl.Segmenter("th", { granularity: "word" });

/** How many steps a piece of text takes — to start the next piece where this one ends */
export function animateSteps(text: string, by: By = "character") {
  const seg = by === "character" ? graphemes : words;
  return [...seg.segment(text)].filter((s) => s.segment.trim() !== "").length;
}

export function TextAnimate({
  children,
  by = "character",
  /** Seconds before the first piece moves */
  delay = 0,
  /** Seconds between one piece and the next */
  stagger = by === "character" ? 0.03 : 0.05,
  /** Pieces to wait for first — the length of text animated just before this */
  offset = 0,
  className = "",
}: {
  children: string;
  by?: By;
  delay?: number;
  stagger?: number;
  offset?: number;
  className?: string;
}) {
  let step = offset;
  const piece = (text: string, key: string | number) => {
    const style = { animationDelay: `${(delay + step++ * stagger).toFixed(3)}s` } as CSSProperties;
    return (
      <span key={key} className="text-animate-piece" style={style}>
        {text}
      </span>
    );
  };

  return (
    <span className={className}>
      {/* Screen readers get the sentence once, not letter by letter */}
      <span className="sr-only">{children}</span>
      <span aria-hidden>
        {[...words.segment(children)].map((w, i) => {
          if (w.segment.trim() === "") return w.segment;
          if (by === "word") return piece(w.segment, i);
          return (
            <span key={i} className="inline-block whitespace-nowrap">
              {[...graphemes.segment(w.segment)].map((g, j) => piece(g.segment, j))}
            </span>
          );
        })}
      </span>
    </span>
  );
}
