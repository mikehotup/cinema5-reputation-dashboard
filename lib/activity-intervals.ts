export type ActivityInterval = {
  from: string;
  to: string;
  change: number | null;
  comparisonChange: number | null;
};

const dayMs = 86_400_000;
const daysPerBucket = 30;
const formatDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function difference(before: number | null | undefined, after: number | null | undefined) {
  return before == null || after == null ? null : after - before;
}

export function activityScale(values: number[]) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const targetStep = Math.max(1, (max - min) / 4);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= targetStep) ?? 10) * magnitude;
  const bottom = Math.floor(min / step) * step;
  const top = max === 0 && min === 0 ? step : Math.ceil(max / step) * step;
  const ticks = Array.from({ length: (top - bottom) / step + 1 }, (_, index) => bottom + index * step);

  return { ticks, y: (value: number) => ((top - value) / (top - bottom)) * 100 };
}

export function intervalDays(from: string, to: string) {
  const pattern = /^(\d{1,2})\.(\d{1,2})$/;
  const first = pattern.exec(from);
  const last = pattern.exec(to);
  if (!first || !last) return null;

  const [, startDay, startMonth] = first.map(Number);
  const [, endDay, endMonth] = last.map(Number);
  const nextYear = endMonth * 32 + endDay < startMonth * 32 + startDay ? 1 : 0;
  function utcDay(year: number, month: number, day: number) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? date.getTime() / dayMs
      : NaN;
  }

  // Dates contain no year. Only calculate a rate when leap years cannot change the duration.
  const durations = [2023, 2024, 2025].map((year) =>
    utcDay(year + nextYear, endMonth, endDay) - utcDay(year, startMonth, startDay)
  );
  const [days] = durations;
  return days > 0 && durations.every((duration) => duration === days) ? days : null;
}

export function groupByThirtyDays(intervals: ActivityInterval[]) {
  if (intervals.length === 0) return null;
  const slices = [];
  let totalDays = 0;
  for (const interval of intervals) {
    const days = intervalDays(interval.from, interval.to);
    if (days === null) return null;
    slices.push({ ...interval, startDay: totalDays, endDay: totalDays + days, days });
    totalDays += days;
  }

  const [day, month] = intervals[0].from.split(".").map(Number);
  const origin = Date.UTC(2024, month - 1, day);
  const dateAt = (offset: number) => formatDate.format(origin + offset * dayMs);
  const buckets: ActivityInterval[] = [];
  let sliceIndex = 0;
  for (let start = 0; start < totalDays; start += daysPerBucket) {
    const end = Math.min(start + daysPerBucket, totalDays);
    let change: number | null = 0;
    let comparisonChange: number | null = 0;

    // The source gives cumulative snapshots, so distribute changes evenly between observations.
    while (sliceIndex < slices.length && slices[sliceIndex].startDay < end) {
      const slice = slices[sliceIndex];
      const overlap = Math.min(end, slice.endDay) - Math.max(start, slice.startDay);
      const share = overlap / slice.days;
      change = change === null || slice.change === null ? null : change + slice.change * share;
      comparisonChange = comparisonChange === null || slice.comparisonChange === null
        ? null
        : comparisonChange + slice.comparisonChange * share;
      if (slice.endDay > end) break;
      sliceIndex++;
    }

    buckets.push({
      from: dateAt(start),
      to: dateAt(end),
      change,
      comparisonChange,
    });
  }

  return { buckets, lastBucketDays: totalDays % daysPerBucket };
}
