
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  rating: number;
  ratingDelta: number;
  total: number;
  delta: number;
  reviews: number;
};

type SortKey = keyof TableRow;

const num = (value?: string) => Number(value || 0);
const score = (value?: string) => num(value) / 10;
const format = (value: number) => value.toLocaleString("ru-RU");

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(-1);
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [descending, setDescending] = useState(true);

  useEffect(() => {
    fetch("/api/reputation")
      .then(async (response) => {
        if (!response.ok) throw new Error("Ошибка API");
        const result: ReputationData = await response.json();
        if (!result.success) throw new Error("Нет данных");
        setData(result);
        setEnd(result.dates.length - 1);
      })
      .catch(() => setError("Не удалось загрузить данные"));
  }, []);

  const rows = useMemo<TableRow[]>(() => {
    if (!data || end < 0) return [];

    return data.rows.map((item) => ({
      name: item.cinema,
      rating: score(item.ratings[end]),
      ratingDelta:
        Math.round(
          (score(item.ratings[end]) - score(item.ratings[start])) * 10
        ) / 10,
      total: num(item.totalRatings[end]),
      delta:
        num(item.totalRatings[end]) -
        num(item.totalRatings[start]),
      reviews: num(item.reviews[end]),
    }));
  }, [data, start, end]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const result =
        sortKey === "name"
          ? a.name.localeCompare(b.name, "ru")
          : a[sortKey] - b[sortKey];

      return descending ? -result : result;
    });
  }, [rows, sortKey, descending]);

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(key !== "name");
    }
  }

  function delta(value: number, decimals = 0) {
    const text =
      decimals > 0 ? value.toFixed(decimals) : format(value);
    return `${value > 0 ? "+" : ""}${text}`;
  }

  function deltaColor(value: number) {
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
      <main className="min-h-screen bg-background p-8 text-foreground">
        Загрузка...
      </main>
    );
  }

  const totalRatings = rows.reduce((sum, r) => sum + r.total, 0);
  const totalReviews = rows.reduce((sum, r) => sum + r.reviews, 0);

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Кинотеатр" },
    { key: "rating", label: "Рейтинг" },
    { key: "ratingDelta", label: "Δ рейтинга" },
    { key: "total", label: "Оценки" },
    { key: "delta", label: "Δ оценок" },
    { key: "reviews", label: "Отзывы" },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Cinema 5 Analytics
            </p>

            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Репутация Синема 5
            </h1>

            <p className="mt-3 text-muted-foreground">
              Аналитика рейтингов и отзывов кинотеатров
            </p>
          </div>

          <ThemeToggle />
        </header>

        <div className="mt-8 flex flex-wrap gap-4">
          {[
            { label: "Начало периода", value: start, setter: setStart },
            { label: "Конец периода", value: end, setter: setEnd },
          ].map((field) => (
            <label
              key={field.label}
              className="flex flex-col gap-2 text-sm text-muted-foreground"
            >
              {field.label}
              
<Select
  value={String(field.value)}
  onValueChange={(value) => {
    if (value === null) return;

    const index = Number(value);
    field.setter(index);

    if (field.label === "Начало периода" && index > end) {
      setEnd(index);
    }

    if (field.label === "Конец периода" && index < start) {
      setStart(index);
    }
  }}
>
  <SelectTrigger className="w-32">
    <SelectValue />
  </SelectTrigger>

  <SelectContent>
    {data.dates.map((date, index) => (
      <SelectItem key={index} value={String(index)}>
        {date}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
            </label>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Кинотеатров", format(rows.length)],
            ["Всего оценок", format(totalRatings)],
            ["Текстовых отзывов", format(totalReviews)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-5 text-card-foreground"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-3xl font-bold tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[800px] table-auto text-left text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                {columns.map((column) => {
                  const active = sortKey === column.key;
                  const SortIcon = active
                    ? descending
                      ? ArrowDown
                      : ArrowUp
                    : ArrowDownUp;

                  return (
                    <th
                      key={column.key}
                      className="px-3 py-4 font-semibold"
                    >
                      <button
                        type="button"
                        onClick={() => changeSort(column.key)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-primary"
                      >
                        {column.label}
                        <SortIcon
                          size={15}
                          strokeWidth={1.75}
                          className={active ? "text-primary" : "opacity-50"}
                        />
                      </button>
                    </th>
                  );
                })}
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
                  <td className="px-3 py-4 font-semibold tabular-nums">
                    {item.rating.toFixed(1)}
                  </td>
                  <td className={`px-3 py-4 tabular-nums ${deltaColor(item.ratingDelta)}`}>
                    {delta(item.ratingDelta, 1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                    {format(item.total)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-4 tabular-nums ${deltaColor(item.delta)}`}>
                    {delta(item.delta)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                    {format(item.reviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Источник: Google Таблица · Изменения рассчитаны за выбранный период
        </p>
      </div>
    </main>
  );
}
