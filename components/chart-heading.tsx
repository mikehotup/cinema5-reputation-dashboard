import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

export function ChartHeading({
  id,
  title,
  note,
  controls,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
      {note && (
        <div className="sm:col-span-2"><ChartNote>{note}</ChartNote></div>
      )}
      {controls && (
        <div className="flex flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-1">
          {controls}
        </div>
      )}
    </header>
  );
}

export function ChartNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
      <CircleAlert aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function ActivityPeriodNote({ lastBucketDays }: { lastBucketDays?: number }) {
  if (lastBucketDays === undefined) {
    return <ChartNote>Длительность интервала зависит от даты следующего среза данных в таблице.</ChartNote>;
  }

  return (
    <ChartNote>
      Расчётные значения: изменения распределены равномерно между датами срезов.
      {lastBucketDays > 0 && ` Последний отрезок — ${lastBucketDays} дн.`}
    </ChartNote>
  );
}
