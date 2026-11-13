"use client";

import { useId, useState } from "react";
import { ActivityUnitToggle, type ActivityUnit } from "@/components/cinema-activity-chart";
import { ChartDateAxis, measureChartScrollbar } from "@/components/chart-date-axis";
import { ActivityPeriodNote, ChartHeading } from "@/components/chart-heading";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { activityScale, difference, groupByThirtyDays, type ActivityInterval } from "@/lib/activity-intervals";
type Snapshot = {
  date: string;
  ratings: number | null;
  reviews: number | null;
};

const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const series = [
  { key: "comparisonChange", label: "Отзывы", color: "bg-emerald-700 dark:bg-emerald-300", text: "text-emerald-700 dark:text-emerald-300" },
  { key: "change", label: "Оценки", color: "bg-amber-700 dark:bg-amber-300", text: "text-amber-700 dark:text-amber-300" },
] as const;
const markerSize = "size-3.5";
const sharedMarker = "bg-linear-to-r from-emerald-700 from-50% to-amber-700 to-50% dark:from-emerald-300 dark:to-amber-300";

type TrendProps = {
  fullRange: boolean;
} & ({ snapshots: Snapshot[] } | { networkIntervals: ActivityInterval[] });

export function CinemaActivityTrend(props: TrendProps) {
  const { fullRange } = props;
  const headingId = useId();
  const [unit, setUnit] = useState<ActivityUnit>("interval");
  const { tooltip, hideTooltip, markerEvents } = useChartTooltip();
  const source = "networkIntervals" in props ? props.networkIntervals : props.snapshots.slice(1).map((last, index) => {
    const first = props.snapshots[index];
    return {
      from: first.date,
      to: last.date,
      change: difference(first.ratings, last.ratings),
      comparisonChange: difference(first.reviews, last.reviews),
    };
  });
  const normalized = fullRange && unit === "month";
  const grouped = normalized ? groupByThirtyDays(source) : null;
  const intervals = normalized ? grouped?.buckets ?? [] : source;
  const values = intervals.flatMap(({ change, comparisonChange }) =>
    [change, comparisonChange].filter((value) => value !== null)
  );
  const { ticks, y } = activityScale(values);
  const note = values.length === 0
    ? normalized && !grouped
      ? "Для разбивки по 30 дней нужны даты срезов с однозначными интервалами."
      : "За выбранный период нет данных для сравнения."
    : null;
  const dates = intervals.length ? [intervals[0].from, ...intervals.map(({ to }) => to)] : [];
  const points = intervals.length > 0 ? [
    {
      label: `${dates[0]} · Начало отсчёта`,
      change: intervals.some(({ change }) => change !== null) ? 0 : null,
      comparisonChange: intervals.some(({ comparisonChange }) => comparisonChange !== null) ? 0 : null,
    },
    ...intervals.map((interval) => ({
      ...interval,
      label: `${interval.from}–${interval.to}`,
    })),
  ] : [];
  const boundaryX = (index: number) => `${100 * index / intervals.length}%`;
  const activePoint = tooltip && points[tooltip.index];

  return (
    <section aria-labelledby={headingId} className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <ChartHeading
        id={headingId}
        title={"networkIntervals" in props ? "Общая динамика" : "Динамика оценок и отзывов"}
        note={note}
        controls={fullRange && <ActivityUnitToggle unit={unit} onUnitChange={(next) => {
          hideTooltip();
          setUnit(next);
        }} />}
      />

      {values.length > 0 && (
        <>
          <div role="region" aria-label="Линейный график изменений за период" tabIndex={0} ref={measureChartScrollbar} className="mt-10 overflow-x-auto overflow-y-hidden rounded-sm [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-ring">
            <div className="pt-4 pr-8 pb-1 pl-14" style={{ minWidth: `calc(${intervals.length * 44}px + 5.5rem)` }}>
              <div className="relative isolate h-[clamp(7rem,20svh,10rem)]">
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    aria-hidden="true"
                    className={`absolute inset-x-0 border-t ${tick === 0 ? "border-muted-foreground/50" : "border-border"}`}
                    style={{ top: `${y(tick)}%` }}
                  >
                    <span className="absolute right-full mr-4 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {number.format(tick)}
                    </span>
                  </div>
                ))}
                {series.map(({ key, color }) => points.map((point, index) => {
                  const value = point[key];
                  const next = points[index + 1]?.[key];
                  if (value === null || next == null) return null;
                  const left = boundaryX(index);
                  const right = boundaryX(index + 1);
                  const from = `${y(value)}%`;
                  const to = `${y(next)}%`;
                  return (
                    <div
                      key={`${key}-${index}`}
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-0 ${color}`}
                      style={{
                        clipPath: `polygon(${left} calc(${from} - 1px), ${right} calc(${to} - 1px), ${right} calc(${to} + 1px), ${left} calc(${from} + 1px))`,
                      }}
                    />
                  );
                }))}
                <ol className="absolute inset-0">
                  {points.map((plotPoint, index) => (
                    <li key={index} className="absolute inset-y-0" style={{ left: boundaryX(index) }}>
                      <span className="sr-only">{plotPoint.label}</span>
                      {series.map(({ key, label, color }) => {
                        const value = plotPoint[key];
                        if (value === null) return <span className="sr-only" key={key}>{label}: нет данных</span>;
                        const overlap = plotPoint.change === plotPoint.comparisonChange;
                        if (overlap && key === "comparisonChange") return null;
                        const description = `${overlap ? "Оценки и отзывы" : label}: ${number.format(value)}`;
                        return (
                          <span
                            key={key}
                            role="img"
                            aria-label={description}
                            tabIndex={0}
                            {...markerEvents(index)}
                            className={`absolute -translate-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${markerSize} ${overlap ? sharedMarker : color}`}
                            style={{ top: `${y(value)}%` }}
                          />
                        );
                      })}
                    </li>
                  ))}
                </ol>
              </div>
              <ChartDateAxis dates={dates} hasLegend />
            </div>
          </div>
          <div className="space-y-3 pl-14" style={{ marginTop: "calc(0.75rem - var(--chart-scrollbar, 0px))" }}>
            <ul aria-label="Обозначения линий" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[...series].reverse().map(({ key, label, color }) => (
                <li key={key} className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className={`shrink-0 rounded-full ${markerSize} ${color}`} />
                  {label}
                </li>
              ))}
            </ul>
            <ActivityPeriodNote lastBucketDays={grouped?.lastBucketDays} />
          </div>
        </>
      )}
      {tooltip && activePoint && (
        <ChartTooltip position={tooltip} title={activePoint.label}>
          {[...series].reverse().map(({ key, label, text }) => (
            <p key={key} className={`flex justify-between gap-2 tabular-nums ${text}`}>
              <span>{label}</span>
              <span className="font-semibold">{activePoint[key] === null ? "—" : number.format(activePoint[key])}</span>
            </p>
          ))}
        </ChartTooltip>
      )}
    </section>
  );
}
