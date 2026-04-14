import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { getJobs } from "@/lib/jobs";
import { getSessionStore } from "@/lib/session-store";

export const dynamic = "force-dynamic";

function formatProjectDate(value: string) {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function ProjectsPage() {
  const session = await getSessionStore();
  const jobs = await getJobs();
  const analysis = session.latestAnalysis;

  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "rendering").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;

  const cards = analysis
    ? [
        {
          id: analysis.asset.id,
          title: analysis.asset.name.replace(/\.[^.]+$/, "") || "Aktive Session",
          thumb: analysis.scenes[0]?.referenceImage ?? "",
          scenes: analysis.scenes.length,
          imageCount: analysis.scenes.filter((scene) => scene.alternatives.length > 0).length,
          updatedAt: analysis.createdAt,
          state:
            failedJobs > 0
              ? "Fehler in Queue"
              : activeJobs > 0
                ? `${completedJobs}/${jobs.length} Videos generiert`
                : completedJobs > 0
                  ? "Export bereit"
                  : analysis.scenes.some((scene) => scene.alternatives.length === 0)
                    ? "Bilder ausstehend"
                    : "Bereit für Videojobs"
        }
      ]
    : [];

  return (
    <main className="min-h-screen pb-20 text-white">
      <AppHeader
        crumb="/ projekte"
        actions={[
          { href: "/", label: "Admin" },
          { href: "/", label: "+ Neues Projekt", accent: true },
          { href: "/", label: "Abmelden" }
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-10 px-4 py-12 md:px-8 lg:px-10">
        <section className="panel neon-border rounded-[2.25rem] px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-200/68">Projektstatus</div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">Meine Projekte</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-white/42 md:text-lg">
                Gespeicherte Sessions, Bildstände und Queue-Fortschritt im selben dunklen Workflow wie in deinem
                Referenz-Tool. Von hier springst du direkt wieder in den letzten Bearbeitungsstand.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-rose-400/15 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100/72">
                {failedJobs} Fehler in Queue
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/64">
                Seite 1 / 1
              </div>
            </div>
          </div>
        </section>

        {cards.length > 0 ? (
          <section className="grid gap-4">
            {cards.map((card) => (
              <article
                key={card.id}
                className="group grid overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(19,19,26,0.95),rgba(10,10,14,0.94))] shadow-[0_28px_80px_rgba(0,0,0,0.42)] transition hover:border-violet-300/25 lg:grid-cols-[140px_1fr_240px]"
              >
                <div className="border-b border-white/6 bg-black/45 p-4 lg:border-b-0 lg:border-r">
                  {card.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.thumb} alt={card.title} className="h-28 w-full rounded-[1.1rem] object-cover lg:h-full" />
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-[1.1rem] border border-dashed border-white/10 text-white/28 lg:h-full">
                      Kein Thumb
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                    <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-violet-200/82">
                      Aktive Session
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">{card.scenes} Szenen</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">{card.imageCount}/{card.scenes} Bilder</span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold tracking-[-0.04em] text-white md:text-3xl">{card.title}</h2>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/42">
                      <span>{card.state}</span>
                      <span>{formatProjectDate(card.updatedAt)}</span>
                      <span>{completedJobs} Videos fertig</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-white/6 bg-[linear-gradient(180deg,rgba(49,34,83,0.72),rgba(26,20,39,0.9))] p-5 lg:border-l lg:border-t-0">
                  <Link
                    href="/#studio"
                    className="flex items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/10 px-4 py-4 text-base font-bold text-white transition hover:bg-white/14"
                  >
                    Weitermachen →
                  </Link>
                  <div className="rounded-[1.2rem] border border-emerald-400/18 bg-emerald-500/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">Queue</div>
                    <div className="mt-2 text-2xl font-black text-white">{activeJobs}</div>
                    <div className="text-sm text-emerald-100/65">Jobs aktiv</div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="panel neon-border rounded-[2rem] px-6 py-12 text-center md:px-10">
            <div className="mx-auto max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/68">Noch leer</div>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Dein erstes Projekt startet auf der Landingpage.
              </h2>
              <p className="mt-4 text-base leading-8 text-white/44 md:text-lg">
                Sobald du ein Video analysierst, taucht es hier als Projektkarte mit Szenenzahl, Bildstatus und
                Renderfortschritt auf.
              </p>
              <Link
                href="/"
                className="mt-8 inline-flex rounded-full border border-violet-300/40 bg-[linear-gradient(180deg,rgba(224,198,255,0.96),rgba(172,117,255,0.94))] px-6 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(176,38,255,0.24)]"
              >
                Neues Projekt anlegen
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
