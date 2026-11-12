import { difference, intervalDays } from "./activity-intervals";

type Insight = { title: string; detail?: string };
type ReviewPace = { current: number; previous: number };
type NetworkRow = {
  name: string;
  rating: number | null;
  ratingChange: number | null;
  ratingsGrowth: number | null;
  reviewsGrowth: number | null;
};
type Snapshot = {
  date: string;
  rating: number | null;
  ratings: number | null;
  reviews: number | null;
};

const signedNumber = new Intl.NumberFormat("ru-RU", { signDisplay: "exceptZero" });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const rating = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const noData: Insight = { title: "Недостаточно данных для сравнения" };

export function compareReviewPace(
  from: string,
  middle: string,
  to: string,
  previousChange: number | null,
  currentChange: number | null,
): ReviewPace | null {
  const previousDays = intervalDays(from, middle);
  const currentDays = intervalDays(middle, to);
  if (previousDays === null || currentDays === null || previousChange === null || currentChange === null
    || previousChange < 0 || currentChange < 0) {
    return null;
  }

  return { previous: previousChange / previousDays, current: currentChange / currentDays };
}

function paceInsight(pace: ReviewPace | null): Insight | null {
  if (!pace || decimal.format(pace.current) === decimal.format(pace.previous)) return null;
  return {
    title: pace.current > pace.previous ? "Темп по отзывам вырос" : "Темп по отзывам снизился",
    detail: `${decimal.format(pace.previous)} → ${decimal.format(pace.current)} в день`,
  };
}

export function networkInsight(rows: NetworkRow[], fullRange: boolean, pace: ReviewPace | null): Insight {
  const largestDrop = rows.reduce<NetworkRow | null>((largest, row) => {
    const change = row.ratingChange;
    return row.rating !== null && change !== null && change < (largest?.ratingChange ?? 0) ? row : largest;
  }, null);
  if (!fullRange && largestDrop?.rating != null && largestDrop.ratingChange !== null) {
    return {
      title: "Рейтинг снизился",
      detail: `${largestDrop.name} · ${rating.format(largestDrop.rating - largestDrop.ratingChange)} → ${rating.format(largestDrop.rating)}`,
    };
  }

  const trend = paceInsight(pace);
  if (!fullRange && trend) return trend;

  for (const [key, label] of [["reviewsGrowth", "отзывов"], ["ratingsGrowth", "оценок"]] as const) {
    const changes = rows.flatMap((row) => row[key] === null ? [] : [{ name: row.name, change: row[key] }]);
    const growing = changes.filter(({ change }) => change > 0).sort((a, b) => b.change - a.change);
    const leaders = growing.slice(0, 3);
    if (fullRange && growing.length > 3 && changes.length === rows.length && changes.every(({ change }) => change >= 0)) {
      const total = growing.reduce((sum, row) => sum + row.change, 0);
      const top = leaders.reduce((sum, row) => sum + row.change, 0);
      const share = Math.round(100 * top / total);
      return {
        title: share === 100
          ? `Три кинотеатра дали почти весь прирост ${label}`
          : `Три кинотеатра дали ${share}% прироста ${label}`,
        detail: leaders.map(({ name }) => name).join(" · "),
      };
    }
    const leader = leaders[0];
    if (leader) {
      return {
        title: `Наибольший прирост ${label}`,
        detail: `${leader.name} · ${signedNumber.format(leader.change)}`,
      };
    }
    const loss = changes.reduce<(typeof changes)[number] | null>((lowest, row) =>
      row.change < (lowest?.change ?? 0) ? row : lowest, null);
    if (loss) {
      return { title: `Счётчик ${label} снизился`, detail: `${loss.name} · ${signedNumber.format(loss.change)}` };
    }
  }

  const biggestChange = rows.reduce<NetworkRow | null>((largest, row) =>
    row.rating !== null && Math.abs(row.ratingChange ?? 0) > Math.abs(largest?.ratingChange ?? 0) ? row : largest, null);
  if (biggestChange?.rating != null && biggestChange.ratingChange !== null) {
    return {
      title: biggestChange.ratingChange > 0 ? "Рейтинг вырос" : "Рейтинг снизился",
      detail: `${biggestChange.name} · ${rating.format(biggestChange.rating - biggestChange.ratingChange)} → ${rating.format(biggestChange.rating)}`,
    };
  }

  const hasData = rows.some((row) => [row.ratingChange, row.reviewsGrowth, row.ratingsGrowth].some((value) => value !== null));
  return hasData ? { title: "По доступным срезам без изменений" } : noData;
}

export function cinemaInsight(snapshots: Snapshot[], fullRange: boolean, pace: ReviewPace | null): Insight {
  if (snapshots.length < 2) return noData;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const ratingChange = difference(first.rating, last.rating);
  const reviews = difference(first.reviews, last.reviews);
  const ratings = difference(first.ratings, last.ratings);
  const counts = [
    reviews === null ? null : `Отзывы ${signedNumber.format(reviews)}`,
    ratings === null ? null : `Оценки ${signedNumber.format(ratings)}`,
  ].filter(Boolean).join(" · ");
  const trend = paceInsight(pace);

  if (!fullRange && trend && !ratingChange) return trend;

  let peak: { from: string; to: string; change: number } | null = null;
  if (fullRange && snapshots.length > 2) {
    for (let index = 1; index < snapshots.length; index++) {
      const before = snapshots[index - 1];
      const after = snapshots[index];
      const change = difference(before.reviews, after.reviews);
      if (change !== null && change > (peak?.change ?? 0)) {
        peak = { from: before.date, to: after.date, change };
      }
    }
  }

  if (first.rating !== null && last.rating !== null) {
    const label = ratingChange === 0
      ? `Рейтинг ${rating.format(last.rating / 10)} на обе даты`
      : `Рейтинг ${rating.format(first.rating / 10)} → ${rating.format(last.rating / 10)}`;
    const detail = peak
      ? `Пик прироста отзывов · ${signedNumber.format(peak.change)} за ${peak.from}–${peak.to}`
      : trend ? `${trend.title} · ${trend.detail}` : counts;
    return { title: label, detail };
  }
  if (peak) {
    return {
      title: "Пик прироста отзывов",
      detail: `${signedNumber.format(peak.change)} за ${peak.from}–${peak.to}`,
    };
  }
  if (reviews !== null) return { title: `Отзывы ${signedNumber.format(reviews)}`, detail: ratings === null ? undefined : `Оценки ${signedNumber.format(ratings)}` };
  if (ratings !== null) return { title: `Оценки ${signedNumber.format(ratings)} за период` };
  return noData;
}
