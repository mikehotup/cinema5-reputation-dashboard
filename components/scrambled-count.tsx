import { useLayoutEffect, useRef } from "react";

const symbols = "#+?/%&";
const stepDuration = 120;
const duration = 13 * stepDuration;

export function ScrambledCount({ value, includeLetters = false }: { value: string; includeLetters?: boolean }) {
  const displayRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const display = displayRef.current;
    if (!display) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pattern = includeLetters ? /[\p{L}0-9]/gu : /[0-9]/g;
    const characterCount = value.match(pattern)?.length ?? 0;
    if (reducedMotion.matches || characterCount === 0) {
      display.textContent = value;
      return;
    }

    const start = performance.now();
    let frame = 0;
    let previousStep = -1;

    const render = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= duration || reducedMotion.matches) {
        display.textContent = value;
        return;
      }

      const step = Math.floor(elapsed / stepDuration);
      if (step !== previousStep) {
        previousStep = step;
        let characterIndex = 0;
        display.textContent = value.replace(pattern, (character) => {
          const index = characterIndex++;
          const revealStep = 6 + Math.round((6 * index) / Math.max(1, characterCount - 1));
          return step >= revealStep ? character : symbols[(step + index * 5) % symbols.length];
        });
      }
      frame = requestAnimationFrame(render);
    };

    render(start);
    return () => cancelAnimationFrame(frame);
  }, [value, includeLetters]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={displayRef} aria-hidden="true" />
    </>
  );
}
