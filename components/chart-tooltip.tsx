"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = { index: number; x: number; y: number; below: boolean };
type MarkerEvents = Pick<HTMLAttributes<HTMLSpanElement>, "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur" | "onKeyDown">;

export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const open = tooltip !== null;

  useEffect(() => {
    if (!open) return;
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  const hideTooltip = () => setTooltip(null);

  function markerEvents(index: number): MarkerEvents {
    const show = (event: { currentTarget: HTMLSpanElement }) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const below = bounds.top < 90;
      setTooltip({
        index,
        x: (bounds.left + bounds.right) / 2,
        y: below ? bounds.bottom + 8 : bounds.top - 8,
        below,
      });
    };

    return {
      onPointerEnter: show,
      onPointerLeave: (event) => {
        if (!event.currentTarget.matches(":focus-visible")) hideTooltip();
      },
      onFocus: show,
      onBlur: hideTooltip,
      onKeyDown: (event) => {
        if (event.key === "Escape") hideTooltip();
      },
    };
  }

  return { tooltip, hideTooltip, markerEvents };
}

export function ChartTooltip({ position, title, children }: {
  position: TooltipPosition;
  title: string;
  children: ReactNode;
}) {
  return createPortal(
    <div
      role="tooltip"
      className={`pointer-events-none fixed z-50 w-48 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-4 text-popover-foreground shadow-md ${position.below ? "" : "-translate-y-full"}`}
      style={{ left: `clamp(6.5rem, ${position.x}px, calc(100vw - 6.5rem))`, top: position.y }}
    >
      <p className="mb-1.5 font-medium">{title}</p>
      {children}
    </div>,
    document.body
  );
}
