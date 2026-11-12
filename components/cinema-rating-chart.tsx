"use client";

import { ChartDateAxis } from "@/components/chart-date-axis";
import { ChartHeading } from "@/components/chart-heading";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
type RatingSnapshot = {
  date: string;
  rating: number | null;
};

const formatRating = (tenths: number) => (tenths / 10).toFixed(1);

export function CinemaRatingChart({ snapshots }: { snapshots: RatingSnapshot[] }) {
  const { tooltip, markerEvents } = useChartTooltip();
  const ratings = snapshots.flatMap(({ rating }) => rating === null ? [] : [rating]);
  const lowest = Math.min(50, ...ratings);
  const highest = Math.max(0, ...ratings);
  const step = Math.max(1, Math.ceil((highest - lowest + 1) / 3));
  const top = Math.min(50, Math.ceil((highest + 1) / step) * step);
  const bottom = Math.max(0, top - step * 4);
  const ticks = Array.from({ length: 5 }, (_, index) => top - index * step)
    .filter((tick) => tick > bottom);
  ticks.push(bottom);

  const intervals = Math.max(1, snapshots.length - 1);
  const x = (index: number) => (index / intervals) * 100;
  const y = (rating: number) => ((top - rating) / (top - bottom)) * 100;
  const activePoint = tooltip && snapshots[tooltip.index];

  return (
    <section
      aria-labelledby="cinema-rating-title"
      className="mt-8 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5"
    >
      <ChartHeading
        id="cinema-rating-title"
        title="Динамика рейтинга"
        note={ratings.length === 0 && "За выбранный период нет данных о рейтинге."}
      />

      {ratings.length > 0 && (
          <div
            role="region"
            aria-label="График рейтинга по датам срезов"
            tabIndex={0}
            className="mt-10 overflow-x-auto overflow-y-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="pt-4 pr-8 pb-1 pl-14" style={{ minWidth: `calc(${intervals * 44}px + 5.5rem)` }}>
              <div className="relative isolate h-[clamp(7rem,20svh,10rem)]">
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-border"
                    style={{ top: `${y(tick)}%` }}
                  >
                    <span className="absolute right-full mr-4 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {formatRating(tick)}
                    </span>
                  </div>
                ))}

                {snapshots.map(({ rating }, index) => {
                  const next = snapshots[index + 1]?.rating;
                  if (rating === null || next == null) return null;
                  const left = `${x(index)}%`;
                  const right = `${x(index + 1)}%`;
                  const from = `${y(rating)}%`;
                  const to = `${y(next)}%`;

                  return (
                    <div
                      key={index}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-primary"
                      style={{
                        clipPath: `polygon(${left} calc(${from} - 1px), ${right} calc(${to} - 1px), ${right} calc(${to} + 1px), ${left} calc(${from} + 1px))`,
                      }}
                    />
                  );
                })}

                <ol className="absolute inset-0">
                  {snapshots.map(({ date, rating }, index) => (
                    <li key={index} className="absolute inset-y-0" style={{ left: `${x(index)}%` }}>
                      {rating === null ? (
                        <span className="sr-only">{date}: нет данных</span>
                      ) : (
                        <span
                          role="img"
                          aria-label={`${date}, рейтинг: ${formatRating(rating)}`}
                          tabIndex={0}
                          {...markerEvents(index)}
                          className="absolute size-3.5 -translate-1/2 rounded-full bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          style={{ top: `${y(rating)}%` }}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <ChartDateAxis dates={snapshots.map(({ date }) => date)} />
            </div>
          </div>
      )}
      {tooltip && activePoint && activePoint.rating !== null && (
        <ChartTooltip position={tooltip} title={activePoint.date}>
          <p className="flex justify-between gap-2 tabular-nums text-primary">
            <span>Рейтинг</span>
            <span className="font-semibold">{formatRating(activePoint.rating)}</span>
          </p>
        </ChartTooltip>
      )}
    </section>
  );
}
