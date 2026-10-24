import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export type { IconSvgElement };

/**
 * Hugeicons with the site's defaults: a thin 1.5 stroke to match Google Sans Flex, sized by className,
 * and hidden from screen readers (the text next to it, or the button's aria-label, carries the meaning).
 */
export function Icon({
  icon,
  className = "size-4",
  strokeWidth = 1.5,
}: {
  icon: IconSvgElement;
  className?: string;
  strokeWidth?: number;
}) {
  return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} className={className} aria-hidden="true" focusable="false" />;
}
