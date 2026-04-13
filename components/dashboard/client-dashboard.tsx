"use client";

import { startTransition, useEffect, useRef, useState, useTransition } from "react";
import type { AnalysisRecord, AssetRecord, QueueProvider, SceneRecord, VideoJob } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

type Props = {
  initialAnalysis: AnalysisRecord | null;
};

type SourceMode = "url" | "upload";

async function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function StatusChip({ status, label }: { status: VideoJob["status"]; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        status === "completed" && "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
        status === "rendering" && "border-violet-400/40 bg-violet-500/10 text-violet-100",
        status === "queued" && "border-white/10 bg-white/5 text-white/60",
        status === "failed" && "border-rose-400/40 bg-rose-500/10 text-rose-200"
      )}
    >
      {label}
    </span>
  );
}

function ProviderToggle({
  provider,
  active,
  onClick
}: {
  provider: QueueProvider;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(74,222,128,0.18)]"
          : "border-white/10 bg-white/[0.03] text-white/45 hover:border-violet-400/30 hover:text-white"
      )}
    >
      {provider === "veo3" ? "Veo 3" : "Simulated"}
    </button>
  );
}

function ActionPill({
  children,
  active = false,
  onClick,
  disabled = false
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[1.25rem] border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-violet-300/60 bg-[linear-gradient(180deg,rgba(194,143,255,0.92),rgba(149,78,255,0.92))] text-black shadow-[0_0_30px_rgba(176,38,255,0.35)]"
          : "border-white/8 bg-white/[0.035] text-white/64 hover:border-violet-400/35 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export default function Dashboard({ initialAnalysis }: Props) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(initialAnalysis);
  const [activeSceneId, setActiveSceneId] = useState(initialAnalysis?.scenes[0]?.id ?? "");
  const [provider, setProvider] = useState<"veo3">("veo3");
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("Warte auf Input.");
  const [isPending, startUiTransition] = useTransition();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const ownRefInput = useRef<HTMLInputElement | null>(null);

  const activeScene = analysis?.scenes.find((scene) => scene.id === activeSceneId) ?? analysis?.scenes[0] ?? null;

  useEffect(() => {
    if (!analysis?.scenes.length) {
      return;
    }

    if (!activeSceneId) {
      setActiveSceneId(analysis.scenes[0].id);
    }
  }, [analysis, activeSceneId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (analysis || jobs.length > 0) {
      timer = setInterval(() => {
        void fetchJobs(true);
      }, Number(process.env.NEXT_PUBLIC_QUEUE_POLL_MS ?? 4000));
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [analysis, jobs.length]);

  async function fetchJobs(tick = false) {
    const response = await fetch(`/api/jobs${tick ? "?tick=1" : ""}`, { cache: "no-store" });
    const payload = (await response.json()) as { jobs: VideoJob[] };
    startTransition(() => {
      setJobs(payload.jobs);
    });
  }

  async function handleAnalyze() {
    setStatusMessage(sourceMode === "url" ? "Video wird per yt-dlp importiert..." : "Upload wird gesichert...");

    startUiTransition(async () => {
      try {
        let asset: AssetRecord;
        if (sourceMode === "url") {
          const imported = await fetch("/api/import-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urlInput })
          });

          if (!imported.ok) {
            throw new Error("Video-Link konnte nicht importiert werden.");
          }

          asset = ((await imported.json()) as { asset: AssetRecord }).asset;
        } else {
          if (!uploadedFile) {
            throw new Error("Bitte zuerst eine MP4-Datei auswaehlen.");
          }

          const formData = new FormData();
          formData.append("file", uploadedFile);

          const uploaded = await fetch("/api/upload", {
            method: "POST",
            body: formData
          });

          if (!uploaded.ok) {
            throw new Error("Upload fehlgeschlagen.");
          }

          asset = ((await uploaded.json()) as { asset: AssetRecord }).asset;
        }

        setStatusMessage("Whisper und GPT-4o analysieren das Material...");
        const analyzed = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: asset.id,
            assetName: asset.name,
            filePath: asset.filePath,
            mimeType: asset.mimeType,
            source: asset.source,
            url: asset.url
          })
        });

        if (!analyzed.ok) {
          throw new Error("Analyse fehlgeschlagen.");
        }

        const payload = (await analyzed.json()) as { analysis: AnalysisRecord };
        startTransition(() => {
          setAnalysis(payload.analysis);
          setActiveSceneId(payload.analysis.scenes[0]?.id ?? "");
        });
        await fetchJobs(false);
        setStatusMessage("Szenen erkannt. Du kannst jetzt Bilder verfeinern und Renderjobs starten.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unbekannter Fehler.");
      }
    });
  }

  async function handleGenerateAlternatives(scene: SceneRecord) {
    setStatusMessage(`GeminiGen Bildjobs fuer ${scene.label} werden vorbereitet...`);
    startUiTransition(async () => {
      const response = await fetch("/api/scenes/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene,
          adjustment: scene.sceneAdjustment
        })
      });

      const payload = (await response.json()) as { alternatives: string[] };
      startTransition(() => {
        setAnalysis((current) =>
          current
            ? {
                ...current,
                scenes: current.scenes.map((entry) =>
                  entry.id === scene.id
                    ? {
                        ...entry,
                        alternatives: payload.alternatives
                      }
                    : entry
                )
              }
            : current
        );
      });
      setStatusMessage(`Drei Bildoptionen fuer ${scene.label} wurden an GeminiGen uebergeben.`);
    });
  }

  async function handleGenerateAllPrompts() {
    if (!analysis) {
      return;
    }

    setStatusMessage("GeminiGen Bildjobs fuer alle Szenen werden gebaut...");

    startUiTransition(async () => {
      const nextScenes = await Promise.all(
        analysis.scenes.map(async (scene) => {
          const response = await fetch("/api/scenes/alternatives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scene, adjustment: scene.sceneAdjustment })
          });
          const payload = (await response.json()) as { alternatives: string[] };
          return { ...scene, alternatives: payload.alternatives };
        })
      );

      startTransition(() => {
        setAnalysis((current) => (current ? { ...current, scenes: nextScenes } : current));
      });
      setStatusMessage("Alle Szenen wurden an GeminiGen fuer Bildvarianten uebergeben.");
    });
  }

  async function handleOwnReferenceUpload(file: File) {
    const dataUrl = await readImageAsDataUrl(file);
    startTransition(() => {
      setAnalysis((current) =>
        current && activeScene
          ? {
              ...current,
              scenes: current.scenes.map((scene) =>
                scene.id === activeScene.id
                  ? {
                      ...scene,
                      referenceImage: dataUrl
                    }
                  : scene
              )
            }
          : current
      );
    });
  }

  async function handleEnqueueAll() {
    if (!analysis) {
      return;
    }

    setStatusMessage(`Render-Queue wird fuer ${analysis.scenes.length} Szenen gestartet...`);
    startUiTransition(async () => {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: analysis.scenes,
          provider
        })
      });

      if (!response.ok) {
        setStatusMessage("Queue konnte nicht gestartet werden.");
        return;
      }

      await fetchJobs(true);
      setStatusMessage("Queue gestartet. Status wird live aktualisiert.");
    });
  }

  function updateScene(patch: Partial<SceneRecord>) {
    if (!activeScene) {
      return;
    }

    startTransition(() => {
      setAnalysis((current) =>
        current
          ? {
              ...current,
              scenes: current.scenes.map((scene) =>
                scene.id === activeScene.id
                  ? {
                      ...scene,
                      ...patch
                    }
                  : scene
              )
            }
          : current
      );
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white md:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="panel panel-noise neon-border overflow-hidden rounded-[2rem] px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex rounded-full border border-violet-300/15 bg-violet-400/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200/80">
                Whisper · GPT-4o · GeminiGen · Imagen · Veo 3 · Remotion
              </div>
              <h1 className="max-w-[12ch] font-display text-[3rem] uppercase leading-[0.92] tracking-[-0.04em] md:text-[5.6rem]">
                So einfach war
                <span className="block bg-[linear-gradient(180deg,#f6d7ff_0%,#b278ff_55%,#8757ff_100%)] bg-clip-text text-transparent">
                  Content noch nie.
                </span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/48 md:text-xl">
                Lade ein lokales MP4 hoch oder ziehe einen Video-Link rein. Whisper transkribiert, GPT-4o baut Szenen
                und vertikale 9:16 Prompts, GeminiGen steuert die Imagen- und Veo-Modelle an und Remotion legt
                Wort-fuer-Wort Untertitel ueber die finalen Clips.
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.6rem] border border-white/8 bg-black/40 p-3 text-right md:min-w-[310px]">
              <div className="rounded-[1.2rem] border border-violet-400/20 bg-violet-500/10 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.28em] text-violet-200/70">Pipeline</div>
                <div className="mt-2 text-3xl font-bold text-white">{analysis?.scenes.length ?? 0}</div>
                <div className="text-sm text-white/42">Szenen erkannt</div>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.28em] text-white/42">Queue</div>
                <div className="mt-2 text-3xl font-bold text-white">{jobs.length}</div>
                <div className="text-sm text-white/42">Jobs im Scheduler</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel neon-border rounded-[2rem] p-3 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.6rem] border border-white/6 bg-black/35 p-4 md:p-5">
              <div className="mb-4 flex flex-wrap gap-3">
                <ActionPill active={sourceMode === "url"} onClick={() => setSourceMode("url")}>
                  🔗 Video-Link
                </ActionPill>
                <ActionPill active={sourceMode === "upload"} onClick={() => setSourceMode("upload")}>
                  🎞 Datei hochladen
                </ActionPill>
                <ActionPill active={false} disabled>
                  ✨ KI-Entwurf
                </ActionPill>
              </div>

              <div className="rounded-[1.45rem] border border-white/8 bg-black/30 p-4">
                <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/28">
                  {["YouTube", "Instagram", "TikTok", "X / Twitter", "Vimeo"].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/8 px-3 py-2">
                      {tag}
                    </span>
                  ))}
                </div>

                {sourceMode === "url" ? (
                  <input
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full rounded-[1.2rem] border border-white/8 bg-black/45 px-5 py-5 text-lg text-white outline-none placeholder:text-white/24 focus:border-violet-400/40"
                  />
                ) : (
                  <div className="grid gap-3">
                    <input
                      ref={uploadRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/*"
                      className="hidden"
                      onChange={(event) => setUploadedFile(event.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => uploadRef.current?.click()}
                      className="rounded-[1.2rem] border border-dashed border-violet-400/30 bg-violet-500/5 px-5 py-8 text-left transition hover:border-violet-300/50 hover:bg-violet-500/10"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-violet-200/68">MP4 Upload</div>
                      <div className="mt-2 text-xl font-semibold text-white">
                        {uploadedFile ? uploadedFile.name : "Video aus Finder waehlen"}
                      </div>
                      <div className="mt-1 text-sm text-white/42">Lokale Datei wird ins Projekt kopiert und weiterverarbeitet.</div>
                    </button>
                  </div>
                )}

                <div className="mt-5">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/30">Transkript-Sprache</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ActionPill active>Original</ActionPill>
                    <ActionPill>English</ActionPill>
                    <ActionPill>Deutsch</ActionPill>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/6 bg-black/35 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/35">Live Status</div>
                  <div className="mt-2 text-2xl font-semibold text-white">Pipeline bereit</div>
                </div>
                <div className="h-3 w-3 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(176,38,255,0.9)]" />
              </div>

              <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.025] p-4 text-sm leading-7 text-white/56">
                {statusMessage}
              </div>

              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={isPending || (sourceMode === "url" ? !urlInput : !uploadedFile)}
                className="mt-5 w-full rounded-[1.4rem] border border-violet-300/50 bg-[linear-gradient(180deg,#cda9ff,#8e4dff)] px-5 py-4 text-base font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⚡ Szenen erkennen & loslegen
              </button>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Upload", analysis?.asset.name ?? "Warte auf Quelle"],
                  ["Whisper", analysis ? "Timestamp ready" : "idle"],
                  ["Remotion", "Subtitle overlay ready"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.1rem] border border-white/8 bg-black/25 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/28">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-white/75">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel panel-noise neon-border rounded-[2rem] p-3 md:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <ActionPill onClick={() => void handleGenerateAllPrompts()} disabled={!analysis || isPending} active={Boolean(analysis)}>
                ✨ Alle Prompts erstellen ({analysis?.scenes.length ?? 0})
              </ActionPill>
              <button
                type="button"
                onClick={() => void handleEnqueueAll()}
                disabled={!analysis || isPending}
                className="rounded-full border border-violet-300/50 bg-[linear-gradient(180deg,rgba(208,167,255,0.94),rgba(142,77,255,0.92))] px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
              >
                ⚡ Alle Videos erstellen ({analysis?.scenes.length ?? 0} ausstehend)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-200/80">
                GeminiGen API
              </span>
              <ProviderToggle provider="veo3" active={provider === "veo3"} onClick={() => setProvider("veo3")} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr_0.55fr]">
            <div className="rounded-[1.6rem] border border-white/8 bg-black/30 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-white/46">Referenz waehlen</div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Mit Referenz
                </span>
              </div>

              {activeScene ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {activeScene.alternatives.map((image, index) => (
                      <button
                        type="button"
                        key={`${activeScene.id}-${index}`}
                        onClick={() => updateScene({ referenceImage: image })}
                        className={cn(
                          "group rounded-[1.2rem] border bg-black/35 p-2 text-left transition",
                          activeScene.referenceImage === image
                            ? "border-violet-300/60 shadow-[0_0_26px_rgba(176,38,255,0.24)]"
                            : "border-white/8 hover:border-violet-300/30"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`Alternative ${index + 1}`} className="h-40 w-full rounded-[0.9rem] object-cover" />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{String.fromCharCode(65 + index)}</span>
                          <span className="text-[11px] text-white/35">{activeScene.referenceImage === image ? "aktiv" : "Option"}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => ownRefInput.current?.click()}
                    className="mt-4 w-full rounded-[1rem] border border-dashed border-white/10 px-4 py-3 text-left text-sm text-white/50 transition hover:border-violet-400/35 hover:text-white"
                  >
                    ⤴ Eigenes Ref-Bild hochladen
                  </button>
                  <input
                    ref={ownRefInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleOwnReferenceUpload(file);
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => void handleGenerateAlternatives(activeScene)}
                    className="mt-4 w-full rounded-[1.1rem] border border-violet-300/40 bg-[linear-gradient(180deg,rgba(208,167,255,0.94),rgba(142,77,255,0.92))] px-4 py-3 text-sm font-black text-black transition hover:brightness-110"
                  >
                    🖼 Bild ueber GeminiGen generieren
                  </button>
                </>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-10 text-center text-white/35">
                  Nach der Analyse erscheinen hier die Referenzkarten.
                </div>
              )}
            </div>

            <div className="rounded-[1.6rem] border border-white/8 bg-black/30 p-4">
              {activeScene ? (
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="rounded-full border border-violet-300/20 bg-violet-400/5 px-4 py-2 text-sm font-bold tracking-[0.22em] text-violet-200/82">
                      {formatDuration(activeScene.start)} → {formatDuration(activeScene.end)}
                    </div>
                    <div className="text-sm text-white/34">{activeScene.duration.toFixed(1)}s</div>
                    <div className="rounded-full border border-white/8 px-3 py-1 text-sm text-white/45">#{analysis?.scenes.findIndex((scene) => scene.id === activeScene.id)! + 1}</div>
                  </div>

                  <label className="text-xs font-bold uppercase tracking-[0.22em] text-white/30">Skript</label>
                  <textarea
                    value={activeScene.narration}
                    onChange={(event) => updateScene({ narration: event.target.value })}
                    className="mt-3 min-h-[120px] rounded-[1.2rem] border border-white/8 bg-black/25 px-4 py-4 text-xl text-white outline-none placeholder:text-white/20 focus:border-violet-400/35"
                  />

                  <label className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-white/30">Szene anpassen</label>
                  <div className="mt-3 grid gap-3 md:grid-cols-[100px_1fr]">
                    <div className="rounded-[1.15rem] border border-white/8 bg-black/25 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeScene.referenceImage} alt="Referenz" className="h-24 w-full rounded-[0.85rem] object-cover" />
                      <div className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Referenz</div>
                    </div>
                    <textarea
                      value={activeScene.sceneAdjustment}
                      onChange={(event) => updateScene({ sceneAdjustment: event.target.value })}
                      placeholder="Was soll angepasst werden? z.B. Hintergrund dunkler, Neonlicht von links, Person ersetzen wie im Ref."
                      className="min-h-[112px] rounded-[1.2rem] border border-white/8 bg-black/25 px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-white/20 focus:border-violet-400/35"
                    />
                  </div>

                  <label className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-white/30">Imagen-Prompt (English)</label>
                  <textarea
                    readOnly
                    value={`${activeScene.promptPackage.cloneDirective}\n\n${activeScene.promptPackage.visualPrompt}\n\n${activeScene.sceneAdjustment ? `Scene adjustment override: ${activeScene.sceneAdjustment}` : "No scene adjustment override."}\n\nFORMAT: vertical 9:16 (Reels/TikTok/Shorts)\nNEGATIVE: ${activeScene.promptPackage.negativePrompt}`}
                    className="mt-3 min-h-[180px] rounded-[1.2rem] border border-violet-300/35 bg-black/35 px-4 py-4 text-base leading-7 text-white/88 outline-none"
                  />

                  <div className="mt-5 flex flex-wrap gap-3">
                    <ActionPill active>🖼 GeminiGen Bildjob</ActionPill>
                    <ActionPill>✏️ Prompt</ActionPill>
                    <ActionPill>👥 Charaktere</ActionPill>
                    <ActionPill>✅ Freigeben</ActionPill>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-10 text-center text-white/35">
                  Analyse starten, um Skript und Szenenanpassungen zu sehen.
                </div>
              )}
            </div>

            <div className="rounded-[1.6rem] border border-white/8 bg-black/30 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/30">Aktive Vorschau</div>
              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/8 bg-black/40">
                {activeScene ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeScene.referenceImage} alt={activeScene.label} className="aspect-[9/16] w-full object-cover" />
                    <div className="border-t border-white/8 p-4">
                      <div className="font-display text-lg uppercase tracking-[0.18em] text-white">{activeScene.label}</div>
                      <p className="mt-2 text-sm leading-6 text-white/46">{activeScene.promptPackage.motionPrompt}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center text-white/28">No preview</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[1.5rem] border border-white/8 bg-black/25 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.22em] text-white/30">Szenen</div>
                <div className="text-sm text-white/40">{analysis?.scenes.length ?? 0} generiert</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(analysis?.scenes ?? []).map((scene, index) => (
                  <button
                    type="button"
                    key={scene.id}
                    onClick={() => setActiveSceneId(scene.id)}
                    className={cn(
                      "rounded-[1.25rem] border bg-black/30 p-3 text-left transition",
                      activeSceneId === scene.id
                        ? "border-violet-300/50 shadow-[0_0_24px_rgba(176,38,255,0.2)]"
                        : "border-white/8 hover:border-violet-300/25"
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-display text-sm uppercase tracking-[0.18em] text-white">{scene.label}</span>
                      <span className="text-xs text-white/35">#{index + 1}</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={scene.referenceImage} alt={scene.label} className="aspect-[9/16] w-full rounded-[0.95rem] object-cover" />
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-white/28">
                      {formatDuration(scene.start)} → {formatDuration(scene.end)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/8 bg-black/25 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.22em] text-white/30">Render Queue</div>
              <div className="grid gap-3">
                {jobs.length > 0 ? (
                  jobs.map((job) => (
                    <div key={job.id} className="rounded-[1.2rem] border border-white/8 bg-black/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-display text-sm uppercase tracking-[0.16em] text-white">{job.label}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/28">
                            {job.service.toUpperCase()} · {job.modelName ?? job.provider.toUpperCase()} · {job.progress}%
                          </div>
                        </div>
                        <StatusChip status={job.status} label={job.statusLabel} />
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#d6b3ff,#8e4dff)]" style={{ width: `${job.progress}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-10 text-center text-white/35">
                    Sobald du Renderjobs startest, erscheint hier der Scheduler mit Ausstehend, Rendering und Completed.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
