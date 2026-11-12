"use client";

import { useState } from "react";
import { ChartDateAxis, measureChartScrollbar } from "@/components/chart-date-axis";
import { ActivityPeriodNote, ChartHeading } from "@/components/chart-heading";
import { activityScale, difference, groupByThirtyDays } from "@/lib/activity-intervals";
type ActivitySnapshot = {
  date: string;
  ratings: number | null;
  reviews: number | null;
};

const metrics = [
  { key: "ratings", label: "Оценки" },
  { key: "reviews", label: "Отзывы" },
] as const;

type Metric = (typeof metrics)[number]["key"];
export type ActivityUnit = "interval" | "month";
type ActivityPeer = { name: string } & Record<Metric, (number | null)[]>;

const format = new Intl.NumberFormat("ru-RU");
const formatRate = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const units = [
  { key: "interval", label: "Интервал" },
  { key: "month", label: "30 дней" },
] as const;

const toggleStyle = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

export function ActivityUnitToggle({
  unit,
  onUnitChange,
}: {
  unit: ActivityUnit;
  onUnitChange: (unit: ActivityUnit) => void;
}) {
  return (
    <div role="group" aria-label="Разбивка периода" className="inline-flex rounded-lg border border-border bg-background p-1">
      {units.map(({ key, label }) => (
        <button key={key} type="button" aria-pressed={unit === key} onClick={() => onUnitChange(key)} className={toggleStyle(unit === key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const seriesStyles = {
  selected: {
    bar: "bg-primary",
    label: "text-primary",
    legend: "Выбранный кинотеатр",
  },
  leader: {
    bar: "bg-sky-700 dark:bg-sky-400",
    label: "text-sky-700 dark:text-sky-400",
    legend: "Лидер периода",
  },
} as const;


function findLeader(peers: ActivityPeer[], metric: Metric) {
  let leader: { name: string; counts: (number | null)[]; change: number } | null = null;

  for (const peer of peers) {
    const counts = peer[metric];
    const change = difference(counts[0], counts.at(-1));
    if (counts.length < 2 || change === null) continue;

    if (!leader || change > leader.change ||
        (change === leader.change && peer.name.localeCompare(leader.name, "ru") < 0)) {
      leader = { name: peer.name, counts, change };
    }
  }

  return leader;
}

export function CinemaActivityChart({
  snapshots,
  peers,
  cinemaName,
  fullRange,
}: {
  snapshots: ActivitySnapshot[];
  peers: ActivityPeer[];
  cinemaName: string;
  fullRange: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("ratings");
  const [unit, setUnit] = useState<ActivityUnit>("interval");
  const leader = findLeader(peers, metric);
  const normalized = fullRange && unit === "month";
  const valueFormat = normalized ? formatRate : format;

  const snapshotIntervals = snapshots.slice(1).map((end, index) => {
    const start = snapshots[index];
    return {
      from: start.date,
      to: end.date,
      change: difference(start[metric], end[metric]),
      comparisonChange: difference(leader?.counts[index], leader?.counts[index + 1]),
    };
  });
  const grouped = normalized ? groupByThirtyDays(snapshotIntervals) : null;
  const intervals = normalized ? (grouped?.buckets ?? []) : snapshotIntervals;
  const dates = intervals.length > 0
    ? [intervals[0].from, ...intervals.map(({ to }) => to)]
    : [];
  const values = intervals.flatMap(({ change, comparisonChange }) =>
    [change, comparisonChange].filter((value) => value !== null)
  );
  const labelWidth = Math.max(2, ...values.map((value) => valueFormat.format(value).length));
  const intervalWidth = Math.max(44, (labelWidth * 7 + 6) * (leader ? 2 : 1));
  const { ticks, y } = activityScale(values);
  const note = values.length === 0
    ? normalized && !grouped
      ? "Для разбивки по 30 дней нужны даты срезов с однозначными интервалами."
      : "За выбранный период нет данных для сравнения."
    : null;

  return (
    <section
      aria-labelledby="cinema-activity-title"
      className="mt-4 rounded-xl border border-border bg-card p-4 text-card-foreground [--activity-axis-inset:3.5rem] sm:p-5"
    >
      <ChartHeading
        id="cinema-activity-title"
        title="Активность между срезами"
        note={note}
        controls={<>
          <div role="group" aria-label="Показатель активности" className="inline-flex rounded-lg border border-border bg-background p-1">
            {metrics.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)} className={toggleStyle(metric === key)}>
                {label}
              </button>
            ))}
          </div>
          {fullRange && <ActivityUnitToggle unit={unit} onUnitChange={setUnit} />}
        </>}
      />

      {values.length > 0 && (
        <div
          role="region"
          aria-label="График изменений между срезами"
          tabIndex={0}
          ref={measureChartScrollbar}
          className="mt-12 overflow-x-auto overflow-y-hidden rounded-sm [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-ring"
        >
          <div
            className="pt-6 pr-8 pb-1 pl-(--activity-axis-inset)"
            style={{ minWidth: `calc(${intervals.length * intervalWidth}px + var(--activity-axis-inset) + 2rem)` }}
          >
            <div className="relative isolate h-[clamp(7rem,20svh,10rem)]">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className={`absolute inset-x-0 border-t ${tick === 0 ? "border-muted-foreground/50" : "border-border"}`}
                  style={{ top: `${y(tick)}%` }}
                >
                  <span className="absolute right-full mr-4 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {format.format(tick)}
                  </span>
                </div>
              ))}

              <ol className="absolute inset-0 flex">
                {intervals.map(({ from, to, change, comparisonChange }, index) => {
                  const bars = [
                    { kind: "selected", name: cinemaName, value: change } as const,
                    ...(leader ? [{ kind: "leader", name: leader.name, value: comparisonChange } as const] : []),
                  ];
                  return (
                    <li key={index} className="relative flex min-w-0 flex-1 gap-1 px-1">
                      {bars.map(({ kind, name, value }) => {
                        const styles = seriesStyles[kind];
                        const top = y(Math.max(0, value ?? 0));
                        const bottom = y(Math.min(0, value ?? 0));
                        const isLeader = kind === "leader";
                        const captionBelowDates = bottom > 75;
                        const captionAtRightEdge = index === intervals.length - 1 && name.length > 11;

                        return (
                          <div key={kind} className="relative min-w-0 flex-1">
                            {value !== null && (
                              <>
                                <span
                                  role="img"
                                  aria-label={`${from}–${to}, ${styles.legend}: ${name}, ${valueFormat.format(value)}${normalized ? ", расчётное значение" : ""}`}
                                  tabIndex={isLeader ? 0 : undefined}
                                  className={`peer absolute inset-x-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring ${styles.bar}`}
                                  style={{
                                    top: `${top}%`,
                                    height: value === 0 ? "2px" : `max(2px, ${Math.abs(y(value) - y(0))}%)`,
                                    transform: value === 0 ? "translateY(-1px)" : undefined,
                                  }}
                                />
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap pb-0.5 text-[11px] font-semibold tabular-nums ${styles.label}`}
                                  style={{ top: `${top}%` }}
                                >
                                  {valueFormat.format(value)}
                                </span>
                                {isLeader && (
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute z-10 hidden w-max max-w-28 text-center text-[11px] leading-3 font-semibold wrap-break-word peer-hover:block peer-focus-visible:block ${captionAtRightEdge ? "right-0" : "left-1/2 -translate-x-1/2"} ${styles.label}`}
                                    style={{ top: captionBelowDates ? "calc(100% + 2.125rem)" : `calc(${bottom}% + 6px)` }}
                                  >
                                    {name}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ol>
            </div>
            <ChartDateAxis dates={dates} hasLegend />
          </div>
        </div>
      )}
      {values.length > 0 && (
        <div className="space-y-3 pl-(--activity-axis-inset)" style={{ marginTop: "calc(0.75rem - var(--chart-scrollbar, 0px))" }}>
          <ul aria-label="Обозначения цветов" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {(["selected", "leader"] as const).filter((kind) => kind === "selected" || leader).map((kind) => (
              <li key={kind} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className={`size-3.5 shrink-0 rounded-full ${seriesStyles[kind].bar}`} />
                {seriesStyles[kind].legend}
              </li>
            ))}
          </ul>
          <ActivityPeriodNote lastBucketDays={grouped?.lastBucketDays} />
        </div>
      )}
    </section>
  );
}
