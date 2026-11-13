
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Moon,
  RefreshCw,
  Sun,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiMascot } from "@/components/ai-mascot";
import { ChartNote } from "@/components/chart-heading";
import { CinemaActivityChart } from "@/components/cinema-activity-chart";
import { CinemaActivityTrend } from "@/components/cinema-activity-trend";
import { CinemaRatingChart } from "@/components/cinema-rating-chart";
import { ScrambledCount } from "@/components/scrambled-count";
import { difference } from "@/lib/activity-intervals";
import { cinemaInsight, compareReviewPace, networkInsight } from "@/lib/reputation-insights";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Cinema = {
  cinema: string;
  ratings: string[];
  totalRatings: string[];
  reviews: string[];
};

type ReputationData = {
  success: boolean;
  updatedAt: string;
  dates: string[];
  rows: Cinema[];
};

type TableRow = {
  name: string;
  rating: number | null;
  ratingsTotal: number | null;
  reviewsTotal: number | null;
  ratingsGrowth: number | null;
  reviewsGrowth: number | null;
  ratingChange: number | null;
};

const metricColumns = [
  { label: "Рейтинг", valueKey: "rating", deltaKey: "ratingChange" },
  { label: "Оценки", valueKey: "ratingsTotal", deltaKey: "ratingsGrowth" },
  { label: "Отзывы", valueKey: "reviewsTotal", deltaKey: "reviewsGrowth" },
] as const;

type MetricColumn = (typeof metricColumns)[number];
type DeltaKey = MetricColumn["deltaKey"];
type SortKey = "name" | MetricColumn["valueKey"] | DeltaKey;
type DeltaRange = { min: number; max: number };

function getDeltaRange(rows: TableRow[], key: DeltaKey): DeltaRange {
  let min = 0;
  let max = 0;
  for (const row of rows) {
    const value = row[key];
    if (value === null || !Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function deltaTint(value: number | null, { min, max }: DeltaRange) {
  if (value === null || !Number.isFinite(value) || value === 0) return undefined;
  const fraction = value / (value > 0 ? max : min);
  if (fraction >= 1) return undefined;

  const strength = 40 + fraction * 60;
  const color = value > 0 ? "var(--color-emerald-500)" : "var(--destructive)";
  return { color: `color-mix(in oklab, ${color} ${strength}%, var(--muted-foreground))` };
}
type ViewMode = "network" | "cinema";

type RefreshStatus =
  | { type: "success"; lastSuccessfulAt: Date }
  | { type: "error"; lastSuccessfulAt: Date | null };

const snapshotNumber = (raw?: string) => {
  if (!raw?.trim()) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

function periodChange(values: string[], start: number, end: number) {
  return difference(snapshotNumber(values[start]), snapshotNumber(values[end]));
}

function networkPeriodChange(cinemas: Cinema[], key: "totalRatings" | "reviews", start: number, end: number) {
  if (cinemas.length === 0) return null;

  let total = 0;
  for (const cinema of cinemas) {
    const change = periodChange(cinema[key], start, end);
    if (change === null) return null;
    total += change;
  }
  return total;
}

const ratingPoints = (tenths: number | null) => tenths === null ? null : tenths / 10;
const format = (value: number) => value.toLocaleString("ru-RU");
const summaryCardClassName = "min-h-28 rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-5";
const formatRefreshTime = (value: Date) =>
  value.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Переключить тему"
      disabled={!mounted}
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </Button>
  );
}

export default function Home() {
  const [data, setData] = useState<ReputationData | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(-1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [descending, setDescending] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("network");
  const [selectedCinema, setSelectedCinema] = useState("");
  const lastSuccessfulAtRef = useRef<Date | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showRefreshStatus = useCallback((status: RefreshStatus) => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }

    setRefreshStatus(status);
    statusTimerRef.current = setTimeout(() => {
      setRefreshStatus(null);
      statusTimerRef.current = null;
    }, 5000);
  }, []);

  const loadData = useCallback(
    async (showStatus: boolean) => {
      setIsRefreshing(true);

      if (showStatus) {
        setRefreshStatus(null);
        if (statusTimerRef.current) {
          clearTimeout(statusTimerRef.current);
          statusTimerRef.current = null;
        }
      }

      try {
        const response = await fetch(`/api/reputation?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Ошибка API");

        const result: ReputationData = await response.json();
        if (!result.success) throw new Error("Нет данных");

        const refreshedAt = new Date();
        lastSuccessfulAtRef.current = refreshedAt;
        setData(result);
        setError("");
        setEnd((current) =>
          current < 0
            ? result.dates.length - 1
            : Math.min(current, result.dates.length - 1)
        );
        setStart((current) =>
          Math.min(current, Math.max(result.dates.length - 2, 0))
        );

        if (showStatus) {
          showRefreshStatus({
            type: "success",
            lastSuccessfulAt: refreshedAt,
          });
        }
      } catch {
        if (showStatus) {
          showRefreshStatus({
            type: "error",
            lastSuccessfulAt: lastSuccessfulAtRef.current,
          });
        } else {
          setError("Не удалось загрузить данные");
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [showRefreshStatus]
  );

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      loadData(false);
    }, 0);

    return () => {
      clearTimeout(initialLoadTimer);
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, [loadData]);

  const fullRange = start === 0 && end === (data?.dates.length ?? 0) - 1;
  const showDelta = !fullRange;
  const activeSortKey = showDelta
    ? sortKey
    : metricColumns.find(({ deltaKey }) => deltaKey === sortKey)?.valueKey ?? sortKey;

  const rows = useMemo<TableRow[]>(() => {
    if (!data || end < 0) return [];

    return data.rows.map((item) => {
      return {
        name: item.cinema,
        rating: ratingPoints(snapshotNumber(item.ratings[end])),
        ratingsTotal: snapshotNumber(item.totalRatings[end]),
        reviewsTotal: snapshotNumber(item.reviews[end]),
        ratingsGrowth: periodChange(item.totalRatings, start, end),
        reviewsGrowth: periodChange(item.reviews, start, end),
        ratingChange: ratingPoints(periodChange(item.ratings, start, end)),
      };
    });
  }, [data, start, end]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (activeSortKey === "name") {
        const result = a.name.localeCompare(b.name, "ru");
        return descending ? -result : result;
      }

      const first = a[activeSortKey];
      const second = b[activeSortKey];
      if (first === null || second === null) return Number(first === null) - Number(second === null);
      const result = first - second;
      return descending ? -result : result;
    });
  }, [rows, activeSortKey, descending]);

  function changeSort(key: SortKey) {
    if (activeSortKey === key) {
      setSortKey(key);
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(key !== "name");
    }
  }

  function delta(value: number | null, decimals = 0) {
    if (value === null) return "—";
    const text =
      decimals > 0 ? value.toFixed(decimals) : format(value);
    return `${value > 0 ? "+" : ""}${text}`;
  }

  function deltaColor(value: number | null) {
    if (value === null) return "text-muted-foreground";
    if (value > 0) return "text-emerald-500";
    if (value < 0) return "text-destructive";
    return "text-muted-foreground";
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background p-8 text-destructive">
        {error}
      </main>
    );
  }

  if (!data || end < 0) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-8 text-foreground">
        <div role="status" className="flex flex-col items-center gap-2">
          <AiMascot loading />
          <p className="text-center">
            <ScrambledCount value="Загрузка..." includeLetters />
          </p>
        </div>
      </main>
    );
  }

  const periodRatings = rows.reduce((sum, r) => sum + (r.ratingsGrowth ?? 0), 0);
  const periodReviews = rows.reduce((sum, r) => sum + (r.reviewsGrowth ?? 0), 0);
  const deltaRanges = {
    ratingChange: getDeltaRange(rows, "ratingChange"),
    ratingsGrowth: getDeltaRange(rows, "ratingsGrowth"),
    reviewsGrowth: getDeltaRange(rows, "reviewsGrowth"),
  };
  const cinemaOptions = [...data.rows].sort((a, b) => a.cinema.localeCompare(b.cinema, "ru"));
  const cinema = viewMode === "cinema"
    ? cinemaOptions.find((item) => item.cinema === selectedCinema) ?? cinemaOptions[0]
    : undefined;
  const selectedCinemaRow = rows.find((row) => row.name === cinema?.cinema);
  const cinemaSnapshots = cinema && data.dates.slice(start, end + 1).map((date, index) => {
    const snapshotIndex = start + index;
    const rating = snapshotNumber(cinema.ratings[snapshotIndex]);
    return {
      date,
      rating: rating !== null && rating <= 50 ? rating : null,
      ratings: snapshotNumber(cinema.totalRatings[snapshotIndex]),
      reviews: snapshotNumber(cinema.reviews[snapshotIndex]),
    };
  });
  const networkIntervals = viewMode === "network" ? data.dates.slice(start + 1, end + 1).map((to, offset) => {
    const fromIndex = start + offset;
    return {
      from: data.dates[fromIndex],
      to,
      change: networkPeriodChange(data.rows, "totalRatings", fromIndex, fromIndex + 1),
      comparisonChange: networkPeriodChange(data.rows, "reviews", fromIndex, fromIndex + 1),
    };
  }) : null;
  const summaryRatings =
    viewMode === "network" ? periodRatings : (selectedCinemaRow?.ratingsGrowth ?? 0);
  const summaryReviews =
    viewMode === "network"
      ? periodReviews
      : (selectedCinemaRow?.reviewsGrowth ?? 0);

  const lastInterval = start > 0 && start === end - 1 && end === data.dates.length - 1;
  let reviewPace = null;
  if (lastInterval) {
    const cinemas = viewMode === "network" ? data.rows : cinema ? [cinema] : [];
    const changes = cinemas.map(({ reviews }) => ({
      previous: periodChange(reviews, start - 1, start),
      current: periodChange(reviews, start, end),
    }));
    if (changes.length > 0 && changes.every(({ previous, current }) => previous !== null && current !== null)) {
      reviewPace = compareReviewPace(
        data.dates[start - 1],
        data.dates[start],
        data.dates[end],
        changes.reduce((sum, { previous }) => sum + (previous ?? 0), 0),
        changes.reduce((sum, { current }) => sum + (current ?? 0), 0),
      );
    }
  }
  const insight = viewMode === "network" && start < end
    ? networkInsight(rows, fullRange, reviewPace)
    : cinemaInsight(cinemaSnapshots || [], fullRange, reviewPace);

  function sortButton(key: SortKey, label: string, ariaLabel?: string) {
    const active = activeSortKey === key;
    const SortIcon = active
      ? descending
        ? ArrowDown
        : ArrowUp
      : ArrowDownUp;

    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => changeSort(key)}
        className={`group inline-flex items-center gap-1 whitespace-nowrap text-xs transition-colors hover:text-primary focus-visible:text-primary ${
          active ? "text-primary" : ""
        }`}
      >
        {label}
        <SortIcon
          size={15}
          strokeWidth={1.75}
          aria-hidden="true"
          className={active ? undefined : "opacity-45 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"}
        />
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
          <h1 className="min-w-0">
            <span className="sr-only">Синема 5 — репутация в Яндекс Картах</span>
            <Image
              src="/reputation-logo-light.svg"
              alt=""
              width={457}
              height={42}
              className="h-auto w-full max-w-[457px] dark:hidden"
            />
            <Image
              src="/reputation-logo-dark.svg"
              alt=""
              width={457}
              height={42}
              className="hidden h-auto w-full max-w-[457px] dark:block"
            />
          </h1>

          {refreshStatus && (
            <div
              role="status"
              className={`fixed inset-x-4 bottom-4 z-30 ml-auto flex w-fit items-center gap-1.5 rounded-md border bg-card px-2.5 py-2 text-xs tabular-nums shadow-xs animate-in fade-in lg:absolute lg:inset-x-auto lg:right-20 lg:top-1/2 lg:bottom-auto lg:max-w-sm lg:-translate-y-1/2 ${
                refreshStatus.type === "success"
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/30 text-destructive"
              }`}
            >
              {refreshStatus.type === "success" ? (
                <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
              ) : (
                <XCircle size={15} className="shrink-0" aria-hidden="true" />
              )}
              <span>
                {refreshStatus.type === "success"
                  ? `Success · ${formatRefreshTime(refreshStatus.lastSuccessfulAt)}`
                  : refreshStatus.lastSuccessfulAt
                    ? `Error · последнее успешное: ${formatRefreshTime(refreshStatus.lastSuccessfulAt)}`
                    : "Error · успешных обновлений ещё не было"}
              </span>
            </div>
          )}
          <div className="col-start-2 row-start-1 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Обновить данные"
              title="Обновить данные"
              disabled={isRefreshing}
              onClick={() => loadData(true)}
            >
              <RefreshCw
                size={18}
                className={isRefreshing ? "animate-spin" : undefined}
              />
            </Button>

            <ThemeToggle />
          </div>
        </header>

        <div className="mt-[2.4rem] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 lg:flex lg:gap-x-8">
          <div
            role="group"
            aria-label="Уровень статистики"
            className="inline-flex h-10 shrink-0 justify-self-start rounded-lg border border-border bg-card p-1"
          >
            {[
              { value: "network" as const, label: "Сеть" },
              { value: "cinema" as const, label: "Кинотеатр" },
            ].map((option) => {
              const active = viewMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setViewMode(option.value)}
                  className={`rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div role="group" aria-label="Период" className="col-span-2 row-start-2 flex items-center gap-2 sm:gap-3">
            <Select
              value={String(start)}
              onValueChange={(value) => {
                if (value === null) return;

                const index = Number(value);
                if (index >= data.dates.length - 1) return;

                setStart(index);
                setEnd(data.dates.length - 1);
              }}
            >
              <SelectTrigger className="w-24 data-[size=default]:h-10 sm:w-32" aria-label="Начало периода">
                <SelectValue>
                  {(value) => data.dates[Number(value)] ?? ""}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {data.dates.map((date, index) => (
                  <SelectItem
                    key={index}
                    value={String(index)}
                    disabled={index === data.dates.length - 1}
                  >
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground/60" />

            <Select
              value={String(end)}
              onValueChange={(value) => {
                if (value === null) return;

                const index = Number(value);
                if (index <= start) return;

                setEnd(index);
              }}
            >
              <SelectTrigger className="w-24 data-[size=default]:h-10 sm:w-32" aria-label="Конец периода">
                <SelectValue>
                  {(value) => data.dates[Number(value)] ?? ""}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {data.dates.map((date, index) => (
                  <SelectItem
                    key={index}
                    value={String(index)}
                    disabled={index <= start}
                  >
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {viewMode === "cinema" && selectedCinemaRow && (
            <Select
              value={selectedCinemaRow.name}
              onValueChange={(value) => {
                if (value !== null) setSelectedCinema(String(value));
              }}
            >
              <SelectTrigger
                className="col-start-2 row-start-1 w-56 min-w-0 max-w-full data-[size=default]:h-10"
                aria-label="Выбрать кинотеатр"
              >
                <SelectValue className="min-w-0">
                  <span className="truncate">{selectedCinemaRow.name}</span>
                </SelectValue>
              </SelectTrigger>

              <SelectContent align="start">
                {cinemaOptions.map((item) => (
                  <SelectItem key={item.cinema} value={item.cinema}>
                    {item.cinema}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          {[
            { label: "Оценки", value: format(summaryRatings) },
            { label: "Отзывы", value: format(summaryReviews) },
          ].map(({ label, value }) => (
            <div key={label} className={`${summaryCardClassName} w-max`}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">
                <ScrambledCount value={value} />
              </p>
            </div>
          ))}
          <section className={`${summaryCardClassName} relative min-w-0 basis-full grow lg:basis-0`} aria-labelledby="insights-heading">
            <AiMascot />
            <h2 id="insights-heading" className="text-sm text-muted-foreground">AI-инсайты</h2>
            <div className="mt-2.5 space-y-1" aria-live="polite">
              <p className="text-sm font-semibold sm:text-base">{insight.title}</p>
              {insight.detail && <p className="text-xs text-muted-foreground sm:text-sm">{insight.detail}</p>}
            </div>
          </section>
        </div>

        {cinemaSnapshots && cinema && (
          <>
            <CinemaRatingChart snapshots={cinemaSnapshots} />
            <CinemaActivityTrend
              snapshots={cinemaSnapshots}
              fullRange={fullRange}
            />
            <CinemaActivityChart
              snapshots={cinemaSnapshots}
              cinemaName={cinema.cinema}
              fullRange={fullRange}
              peers={data.rows.map((item) => ({
                name: item.cinema,
                ratings: cinemaSnapshots.map((_, index) => snapshotNumber(item.totalRatings[start + index])),
                reviews: cinemaSnapshots.map((_, index) => snapshotNumber(item.reviews[start + index])),
              }))}
            />
          </>
        )}

        {networkIntervals && <CinemaActivityTrend networkIntervals={networkIntervals} fullRange={fullRange} />}

        {viewMode === "network" && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[800px] table-auto text-left text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="px-3 py-4 text-xs font-medium">
                  {sortButton("name", "Кинотеатр")}
                </th>

                {metricColumns.map((column) => (
                  <th
                    key={column.label}
                    className="px-3 py-4 text-xs font-medium"
                  >
                    <div className="inline-flex items-center gap-3">
                      {sortButton(column.valueKey, column.label)}
                      {showDelta && sortButton(
                        column.deltaKey,
                        "изм.",
                        `Сортировать по изменению: ${column.label.toLowerCase()}`
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((item) => (
                <tr
                  key={item.name}
                  className="border-t border-border transition-colors hover:bg-accent/40"
                >
                  <td className="whitespace-nowrap px-3 py-4 font-medium">
                    {item.name}
                  </td>
                  {metricColumns.map(({ valueKey, deltaKey }) => {
                    const isRating = valueKey === "rating";
                    const value = item[valueKey];
                    const change = item[deltaKey];
                    return (
                      <td key={valueKey} className="whitespace-nowrap px-3 py-4 tabular-nums">
                        <div className="flex items-baseline gap-3">
                          <span className={isRating ? "font-semibold" : undefined}>
                            <ScrambledCount value={value === null ? "—" : isRating ? value.toFixed(1) : format(value)} />
                          </span>
                          {showDelta && change !== 0 && (
                            <span className={`text-xs ${deltaColor(change)}`} style={deltaTint(change, deltaRanges[deltaKey])}>
                              <ScrambledCount value={delta(change, isRating ? 1 : 0)} />
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}

        <div className="mt-5">
          <ChartNote>
            Источник: Google Таблица
            {viewMode === "network" && showDelta && ` · Сравнение со срезом ${data.dates[start]}`}
          </ChartNote>
        </div>
      </div>
    </main>
  );
}
