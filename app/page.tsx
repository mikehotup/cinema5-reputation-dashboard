
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b1020] p-10 text-white">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
        Cinema 5 Analytics
      </p>

      <h1 className="text-4xl font-bold">
        Репутация Синема 5
      </h1>

      <p className="mt-4 text-slate-400">
        Аналитика рейтингов и отзывов кинотеатров
      </p>

      <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-800/60 p-8">
        <p className="text-sm text-slate-400">
          Статус проекта
        </p>
        <p className="mt-2 text-2xl font-semibold text-emerald-400">
          Дашборд запущен ✓
        </p>
      </div>
    </main>
  );
}