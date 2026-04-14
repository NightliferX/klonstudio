import Link from "next/link";

type ToolGuideContentProps = {
  showCta?: boolean;
};

export function ToolGuideContent({ showCta = false }: ToolGuideContentProps) {
  return (
    <div className="max-w-4xl">
      <div className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-200/68">Tool Guide</div>
      <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
        Ihr habt das Video gesehen. Jetzt koennt ihr es selbst bauen.
      </h2>
      <p className="mt-4 text-base leading-8 text-white/44 md:text-lg">
        Das Tool baut Videos vollautomatisch nach: Transkription, Szenen, KI-Bilder, KI-Videos, Untertitel und finaler
        Export. Es liegt direkt im Projektflow, damit man nicht erst in externe Dokus springen muss.
      </p>
      <p className="mt-3 text-base leading-8 text-white/44 md:text-lg">
        In unter 30 Minuten laeuft das System auf eurem Rechner oder VPS. Genau wie im Referenz-Tool fuehrt dich die
        App von Upload ueber Bild-Freigabe bis zum finalen MP4.
      </p>

      <div className="mt-8 space-y-6">
        <section className="border-t border-white/10 pt-6">
          <h3 className="text-2xl font-bold tracking-[-0.04em] text-white">🛠 Was das Tool macht</h3>
          <div className="mt-4 grid gap-3 text-base leading-8 text-white/56">
            <p>Text rein — KI strukturiert Szenen — GeminiGen generiert Bilder — GeminiGen rendert Video-Clips.</p>
            <p>Whisper liefert Wort-Timestamps, Untertitel werden vorbereitet und das finale MP4 kann spaeter exportiert werden.</p>
            <p className="font-semibold text-white/78">Vollautomatisch. Komplett.</p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-6">
          <h3 className="text-2xl font-bold tracking-[-0.04em] text-white">⚙️ Was ihr braucht</h3>
          <div className="mt-4 grid gap-3 text-base leading-8 text-white/56">
            <p>Node.js, Git, pnpm, ffmpeg und yt-dlp fuer Upload, Import und Analyse.</p>
            <p>OpenAI API Key fuer Whisper plus Szenen-Analyse und GeminiGen API Key fuer Bilder und Videos.</p>
            <p>Optional Docker/VPS fuer Deployment und einen oeffentlichen Endpoint, wenn Webhooks genutzt werden sollen.</p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-6">
          <h3 className="text-2xl font-bold tracking-[-0.04em] text-white">✨ Wie der Flow aussieht</h3>
          <ol className="mt-4 grid gap-3 text-base leading-8 text-white/56">
            <li>1. Video-Link einfuegen oder MP4 hochladen.</li>
            <li>2. Analyse starten und Szenen mit Referenzframes erzeugen.</li>
            <li>3. Pro Szene Stil, Skript und Bildvarianten anpassen.</li>
            <li>4. Videojobs in die Queue legen und auf Export hinarbeiten.</li>
          </ol>
        </section>
      </div>

      {showCta ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/#studio"
            className="rounded-full border border-violet-300/40 bg-[linear-gradient(180deg,rgba(224,198,255,0.96),rgba(172,117,255,0.94))] px-6 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(176,38,255,0.24)]"
          >
            Direkt ins Studio
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-white/10 bg-black/35 px-6 py-3 text-sm font-semibold text-white/74 transition hover:border-violet-300/25 hover:text-white"
          >
            Projekte ansehen
          </Link>
        </div>
      ) : null}
    </div>
  );
}
