/**
 * Loading placeholders, from next.js-shop.
 *
 * - Route level: a `loading.tsx` next to `page.tsx` renders that page's skeleton inside <LoadingRegion>;
 *   Next shows it at once on navigation while the page loads.
 * - Section level: slow data goes in its own async component wrapped in <Suspense fallback={…Skeleton}>.
 * - Build skeletons from <Skeleton> at the real content's sizes, so nothing jumps when it swaps in.
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** A shimmering block. Size and shape come from className (e.g. "h-4 w-32 rounded-full"). */
export function Skeleton({ className = "", ...props }: DivProps) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} {...props} />;
}

/** A line of text: the bar sits centred in a box as tall as the real line, so it takes the same space */
export function SkeletonText({ lineClassName = "h-5", className = "" }: { lineClassName?: string; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center ${lineClassName}`}>
      <Skeleton className={className} />
    </div>
  );
}

/** Wraps a whole loading state: announced once to screen readers instead of every placeholder */
export function LoadingRegion({ label = "กำลังโหลด...", className = "", children, ...props }: DivProps & { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
