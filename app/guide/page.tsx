import { AppHeader } from "@/components/dashboard/app-header";
import { ToolGuideContent } from "@/components/dashboard/tool-guide-content";

export const dynamic = "force-dynamic";

const guideSteps = [
  "Herr Tech Video Creator",
  "Upload & Analyse",
  "Bild-Generierung",
  "Video-Queue & Export"
];

export default function GuidePage() {
  return (
    <main className="min-h-screen pb-20 text-white">
      <AppHeader
        crumb="/ guide"
        actions={[
          { href: "/", label: "Studio" },
          { href: "/projects", label: "Meine Projekte" },
          { href: "/", label: "Abmelden" }
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12 lg:px-10">
        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="panel rounded-[2rem] p-4 md:p-5">
            <div className="rounded-[1.15rem] border border-[#e8ca73]/35 bg-[#f0ce6f]/12 px-4 py-3 text-sm font-semibold text-[#f6d984]">
              📁 Herr Tech Video Creator
            </div>

            <div className="mt-6 space-y-3">
              {guideSteps.map((step, index) => (
                <div
                  key={step}
                  className={`flex w-full items-center rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold ${
                    index === 0
                      ? "border-[#e8ca73]/35 bg-[#f0ce6f]/12 text-[#f6d984]"
                      : "border-white/8 bg-white/[0.03] text-white/68"
                  }`}
                >
                  {index === 0 ? step : `${index}. ${step}`}
                </div>
              ))}
            </div>
          </aside>

          <section className="panel neon-border rounded-[2rem] p-6 md:p-8">
            <ToolGuideContent showCta />
          </section>
        </section>
      </div>
    </main>
  );
}
