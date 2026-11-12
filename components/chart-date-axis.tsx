export function ChartDateAxis({
  dates,
  hasLegend = false,
}: {
  dates: string[];
  hasLegend?: boolean;
}) {
  const divisions = Math.max(1, dates.length - 1);

  return (
    <div aria-hidden="true" className={`pointer-events-none relative border-t border-border ${hasLegend ? "h-14" : "h-9"}`}>
      {dates.map((date, index) => (
        <span
          key={index}
          className="absolute -translate-x-1/2 whitespace-nowrap pt-4 text-xs tabular-nums text-muted-foreground before:absolute before:top-0 before:left-1/2 before:h-1 before:border-l before:border-border"
          style={{ left: `${100 * index / divisions}%` }}
        >
          {date}
        </span>
      ))}
    </div>
  );
}

// Keep the gap below the dates constant when only one chart needs a scrollbar.
export function measureChartScrollbar(chart: HTMLDivElement | null) {
  const section = chart?.parentElement;
  if (!chart || !section) return;

  const update = () => {
    section.style.setProperty("--chart-scrollbar", `${chart.offsetHeight - chart.clientHeight}px`);
  };
  const observer = new ResizeObserver(update);
  observer.observe(chart, { box: "border-box" });
  update();

  return () => {
    observer.disconnect();
    section.style.removeProperty("--chart-scrollbar");
  };
}
