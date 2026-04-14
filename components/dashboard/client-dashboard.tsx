"use client";

import Link from "next/link";
import { startTransition, useEffect, useState, useTransition } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import type { AnalysisRecord, AssetRecord, QueueProvider, SceneRecord, VideoJob } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

type Props = {
  initialAnalysis: AnalysisRecord | null;
  initialJobs: VideoJob[];
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

function buildSceneAlternativePayload(scene: SceneRecord) {
  return {
    id: scene.id,
    label: scene.label,
    start: scene.start,
    end: scene.end,
    duration: scene.duration,
    scriptText: scene.scriptText,
    narration: scene.narration,
    sceneAdjustment: scene.sceneAdjustment,
    referenceImage: scene.referenceImage,
    promptPackage: scene.promptPackage
  };
}

function StatusChip({ status, label }: { status: VideoJob["status"]; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        status === "completed" && "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
        status === "rendering" && "border-violet-400/35 bg-violet-500/10 text-violet-100",
        status === "queued" && "border-white/10 bg-white/5 text-white/60",
        status === "failed" && "border-rose-400/35 bg-rose-500/10 text-rose-200"
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
          ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(74,222,128,0.18)]"
          : "border-white/10 bg-white/[0.03] text-white/45 hover:border-violet-400/30 hover:text-white"
      )}
    >
      {provider === "veo3" ? "Veo 3" : provider === "grok" ? "Grok" : "Simulated"}
    </button>
  );
}

function HeroTab({
  active,
  children,
  onClick,
  disabled = false
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[1.2rem] border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-violet-300/60 bg-white/[0.03] text-white shadow-[inset_0_-1px_0_rgba(186,137,255,0.4)]"
          : "border-transparent text-white/40 hover:text-white/70"
      )}
    >
      {children}
    </button>
  );
}

function StepChip({
  index,
  label,
  active,
  muted = false
}: {
  index: number;
  label: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "rounded-full border px-4 py-2 text-sm font-semibold transition",
          active
            ? "border-violet-300/40 bg-violet-500/12 text-violet-100"
            : muted
              ? "border-white/8 bg-black/35 text-white/24"
              : "border-white/10 bg-black/35 text-white/62"
        )}
      >
        {index} {label}
      </div>
      {index < 4 ? <span className="text-white/18">→</span> : null}
    </div>
  );
}

function SceneAction({
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
        "rounded-full border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-violet-300/45 bg-[linear-gradient(180deg,rgba(224,198,255,0.96),rgba(172,117,255,0.94))] text-black shadow-[0_0_24px_rgba(176,38,255,0.24)]"
          : "border-white/10 bg-black/35 text-white/70 hover:border-violet-300/25 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function getJobLabel(job?: VideoJob) {
  if (!job) {
    return "Noch kein Renderjob";
  }

  if (job.status === "queued") {
    return "Ausstehend";
  }

  if (job.status === "rendering") {
    return `${job.statusLabel}`;
  }

  if (job.status === "failed") {
    return "Fehler";
  }

  return "Completed";
}

export default function Dashboard({ initialAnalysis, initialJobs }: Props) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [urlInput, setUrlInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(initialAnalysis);
  const [focusedSceneId, setFocusedSceneId] = useState(initialAnalysis?.scenes[0]?.id ?? "");
  const [provider, setProvider] = useState<"veo3" | "grok">("veo3");
  const [jobs, setJobs] = useState<VideoJob[]>(initialJobs);
  const [statusMessage, setStatusMessage] = useState<string>("Warte auf dein erstes Video.");
  const [isPending, startUiTransition] = useTransition();

  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "rendering").length;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const readyScenes = analysis?.scenes.filter((scene) => scene.alternatives.length > 0).length ?? 0;

  useEffect(() => {
    if (!analysis?.scenes.length) {
      return;
    }

    if (!focusedSceneId) {
      setFocusedSceneId(analysis.scenes[0].id);
    }
  }, [analysis, focusedSceneId]);

  useEffect(() => {
    if (initialJobs.length > 0) {
      void fetchJobs(true);
      if (!initialAnalysis) {
        setStatusMessage("Gespeicherte Render-Queue wurde wiederhergestellt.");
      }
    }
  }, [initialAnalysis, initialJobs.length]);

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

  function updateScene(sceneId: string, patch: Partial<SceneRecord>) {
    startTransition(() => {
      setAnalysis((current) =>
        current
          ? {
              ...current,
              scenes: current.scenes.map((scene) =>
                scene.id === sceneId
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
          setFocusedSceneId(payload.analysis.scenes[0]?.id ?? "");
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
      try {
        const response = await fetch("/api/scenes/alternatives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scene: buildSceneAlternativePayload(scene),
            adjustment: scene.sceneAdjustment
          })
        });

        const payload = (await response.json()) as { alternatives?: string[]; error?: string };
        if (!response.ok || !payload.alternatives) {
          throw new Error(payload.error ?? "Bildgenerierung fehlgeschlagen.");
        }

        startTransition(() => {
          setAnalysis((current) =>
            current
              ? {
                  ...current,
                  scenes: current.scenes.map((entry) =>
                    entry.id === scene.id
                      ? {
                          ...entry,
                          alternatives: payload.alternatives ?? entry.alternatives,
                          referenceImage: payload.alternatives?.[0] ?? entry.referenceImage
                        }
                      : entry
                  )
                }
              : current
          );
        });
        setStatusMessage(`Drei Bildoptionen fuer ${scene.label} wurden an GeminiGen uebergeben.`);
      } catch (error) {
        console.error(error);
        setStatusMessage(error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.");
      }
    });
  }

  async function handleGenerateAllPrompts() {
    if (!analysis) {
      return;
    }

    setStatusMessage("GeminiGen Bildjobs fuer alle Szenen werden gebaut...");

    startUiTransition(async () => {
      try {
        const nextScenes = await Promise.all(
          analysis.scenes.map(async (scene) => {
            const response = await fetch("/api/scenes/alternatives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scene: buildSceneAlternativePayload(scene),
                adjustment: scene.sceneAdjustment
              })
            });
            const payload = (await response.json()) as { alternatives?: string[]; error?: string };
            if (!response.ok || !payload.alternatives) {
              throw new Error(payload.error ?? `Bildgenerierung fuer ${scene.label} fehlgeschlagen.`);
            }
            return {
              ...scene,
              alternatives: payload.alternatives,
              referenceImage: payload.alternatives[0] ?? scene.referenceImage
            };
          })
        );

        startTransition(() => {
          setAnalysis((current) => (current ? { ...current, scenes: nextScenes } : current));
        });
        setStatusMessage("Alle Szenen wurden an GeminiGen fuer Bildvarianten uebergeben.");
      } catch (error) {
        console.error(error);
        setStatusMessage(error instanceof Error ? error.message : "Bildgenerierung fehlgeschlagen.");
      }
    });
  }

  async function handleOwnReferenceUpload(sceneId: string, file: File) {
    const dataUrl = await readImageAsDataUrl(file);
    updateScene(sceneId, { referenceImage: dataUrl });
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

  async function handleEnqueueScene(scene: SceneRecord) {
    setStatusMessage(`${scene.label} wird in die Render-Queue gelegt...`);
    startUiTransition(async () => {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [scene],
          provider
        })
      });

      if (!response.ok) {
        setStatusMessage(`Queue fuer ${scene.label} konnte nicht gestartet werden.`);
        return;
      }

      await fetchJobs(true);
      setStatusMessage(`${scene.label} wurde an den Scheduler uebergeben.`);
    });
  }

  async function handleResetWorkspace() {
    const confirmed = window.confirm(
      "Willst du wirklich Analyse, Queue, Uploads, Referenzen und Render-Dateien loeschen? Dieser Schritt kann nicht rueckgaengig gemacht werden."
    );

    if (!confirmed) {
      return;
    }

    setStatusMessage("Workspace wird zurueckgesetzt...");

    startUiTransition(async () => {
      try {
        const response = await fetch("/api/reset", {
          method: "POST"
        });

        if (!response.ok) {
          throw new Error("Reset fehlgeschlagen.");
        }

        startTransition(() => {
          setAnalysis(null);
          setJobs([]);
          setFocusedSceneId("");
          setUploadedFile(null);
          setUrlInput("");
        });

        setStatusMessage("Workspace geleert. Du kannst jetzt wieder bei null starten.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Reset fehlgeschlagen.");
      }
    });
  }

  return (
    <main className="min-h-screen pb-20 text-white">
      <AppHeader
        crumb="/ social video creator"
        actions={[
          { href: "/", label: "Admin" },
          { href: "/projects", label: "Meine Projekte" },
          { href: "/", label: "Abmelden" }
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1660px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12 lg:px-10">
        <section className="relative overflow-hidden rounded-[2.4rem] px-4 py-8 md:px-8 md:py-12">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(206,171,255,0.45),transparent)]" />
          <div className="mx-auto flex max-w-[960px] flex-col items-start">
            <div className="rounded-full border border-violet-300/14 bg-violet-500/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200/78">
              Whisper · Claude · Imagen · Kling · Veo3
            </div>
            <h1 className="mt-8 max-w-[10ch] text-[3.2rem] font-black leading-[0.92] tracking-[-0.07em] text-white md:text-[5.7rem]">
              So einfach war
              <span className="block bg-[linear-gradient(180deg,#f7e0ff_0%,#c192ff_48%,#8b5cff_100%)] bg-clip-text text-transparent">
                Content noch nie.
              </span>
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/40 md:text-xl">
              Video hochladen, KI uebernimmt den Rest. Szenen erkennen, Bilder und Videos generieren, Untertitel rein,
              fertig exportieren. Kein Editor. Kein Studio. Kein Aufwand.
            </p>

            <div className="panel neon-border mt-10 w-full max-w-[760px] rounded-[2rem] p-3 md:p-4">
              <div className="grid gap-4 rounded-[1.7rem] border border-white/6 bg-black/40 p-3 md:p-4">
                <div className="flex flex-wrap gap-2 border-b border-white/6 pb-3">
                  <HeroTab active={sourceMode === "url"} onClick={() => setSourceMode("url")}>
                    🔗 Video-Link
                  </HeroTab>
                  <HeroTab active={sourceMode === "upload"} onClick={() => setSourceMode("upload")}>
                    🎞 Datei hochladen
                  </HeroTab>
                  <HeroTab disabled>✨ KI-Entwurf</HeroTab>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/26">
                  {["YouTube", "Instagram", "TikTok", "Twitter/X", "Vimeo"].map((tag) => (
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
                    className="w-full rounded-[1.15rem] border border-white/8 bg-black/45 px-5 py-5 text-lg text-white outline-none placeholder:text-white/22 focus:border-violet-400/40"
                  />
                ) : (
                  <label className="block cursor-pointer rounded-[1.25rem] border border-dashed border-violet-300/25 bg-violet-500/[0.06] px-5 py-7 transition hover:border-violet-300/45 hover:bg-violet-500/[0.09]">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/*"
                      className="hidden"
                      onChange={(event) => setUploadedFile(event.target.files?.[0] ?? null)}
                    />
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/70">MP4 Upload</div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {uploadedFile ? uploadedFile.name : "Video auswaehlen und direkt analysieren"}
                    </div>
                    <div className="mt-1 text-sm text-white/42">Lokale Datei wird ins Projekt kopiert und weiterverarbeitet.</div>
                  </label>
                )}

                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/28">Transkript-Sprache</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <HeroTab active>Original</HeroTab>
                    <HeroTab>English</HeroTab>
                    <HeroTab>Deutsch</HeroTab>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={isPending || (sourceMode === "url" ? !urlInput : !uploadedFile)}
                className="mt-4 w-full rounded-[1.4rem] bg-[linear-gradient(180deg,#2c2b2e,#1e1c21)] px-5 py-4 text-base font-black text-white transition hover:bg-[linear-gradient(180deg,#35333a,#232229)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⚡ Szenen erkennen & loslegen
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="panel neon-border rounded-[2rem] px-5 py-5 md:px-6">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Live Status</div>
            <div className="mt-3 text-lg leading-8 text-white/72">{statusMessage}</div>
          </div>

          <div className="grid gap-4">
            <div className="panel rounded-[2rem] px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-violet-200/64">Pipeline</div>
              <div className="mt-2 text-4xl font-black tracking-[-0.06em] text-white">{analysis?.scenes.length ?? 0}</div>
              <div className="text-sm text-white/42">Szenen erkannt</div>
            </div>
            <div className="panel rounded-[2rem] px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-white/32">Queue</div>
              <div className="mt-2 text-4xl font-black tracking-[-0.06em] text-white">{jobs.length}</div>
              <div className="text-sm text-white/42">Jobs im Scheduler</div>
            </div>
          </div>
        </section>

        {analysis ? (
          <section id="studio" className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <StepChip index={1} label="Upload & Analyse" />
              <StepChip index={2} label="Bilder generieren" active />
              <StepChip index={3} label="Videos generieren" muted={readyScenes === 0} />
              <StepChip index={4} label="Export" muted={completedJobs === 0} />
            </div>

            <div className="panel neon-border rounded-[2.2rem] px-5 py-6 md:px-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">
                      {analysis.scenes.length} Szenen
                    </h2>
                    <p className="mt-3 max-w-4xl text-base leading-8 text-white/38 md:text-lg">
                      Waehle einen Screenshot als Vorlage, passe Stil und Skript an und generiere das KI-Bild pro
                      Szene, bevor du es fuer die Videogenerierung freigibst.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <SceneAction>🎨 Stil-Vorgaben</SceneAction>
                    <SceneAction active onClick={() => void handleGenerateAllPrompts()} disabled={isPending}>
                      ⚡ Alle generieren ({analysis.scenes.length} offen)
                    </SceneAction>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-3">
                    <SceneAction active onClick={() => void handleEnqueueAll()} disabled={isPending}>
                      ⚡ Alle Videos erstellen
                    </SceneAction>
                    <SceneAction onClick={() => void handleResetWorkspace()} disabled={isPending}>
                      Reset Projekt
                    </SceneAction>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-200/80">
                      GeminiGen API
                    </span>
                    <ProviderToggle provider="veo3" active={provider === "veo3"} onClick={() => setProvider("veo3")} />
                    <ProviderToggle provider="grok" active={provider === "grok"} onClick={() => setProvider("grok")} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {analysis.scenes.map((scene, index) => {
                const sceneJob = jobs.find((job) => job.sceneId === scene.id);
                const promptText = `${scene.promptPackage.cloneDirective}\n\n${scene.promptPackage.visualPrompt}\n\n${
                  scene.sceneAdjustment ? `Scene adjustment override: ${scene.sceneAdjustment}` : "No scene adjustment override."
                }\n\nFORMAT: vertical 9:16 (Reels/TikTok/Shorts)\nNEGATIVE: ${scene.promptPackage.negativePrompt}`;
                const inputId = `own-ref-${scene.id}`;

                return (
                  <article
                    key={scene.id}
                    className={cn(
                      "panel rounded-[2rem] p-3 transition md:p-4",
                      focusedSceneId === scene.id ? "neon-border" : "border border-white/6"
                    )}
                    onClick={() => setFocusedSceneId(scene.id)}
                  >
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_180px]">
                      <div className="rounded-[1.5rem] border border-white/8 bg-black/35 p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/34">Referenz waehlen</div>
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                            Mit Referenz
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {scene.alternatives.map((image, altIndex) => (
                            <button
                              type="button"
                              key={`${scene.id}-${altIndex}`}
                              onClick={() => updateScene(scene.id, { referenceImage: image })}
                              className={cn(
                                "rounded-[1rem] border bg-black/40 p-2 text-left transition",
                                scene.referenceImage === image
                                  ? "border-violet-300/60 shadow-[0_0_26px_rgba(176,38,255,0.24)]"
                                  : "border-white/8 hover:border-violet-300/30"
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image} alt={`Alternative ${altIndex + 1}`} className="aspect-[9/16] w-full rounded-[0.85rem] object-cover" />
                              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/64">
                                <span>{String.fromCharCode(65 + altIndex)}</span>
                                <span>{scene.referenceImage === image ? "aktiv" : "Option"}</span>
                              </div>
                            </button>
                          ))}
                        </div>

                        <label
                          htmlFor={inputId}
                          className="mt-4 flex cursor-pointer items-center rounded-[1rem] border border-dashed border-white/10 px-4 py-3 text-sm text-white/56 transition hover:border-violet-400/35 hover:text-white"
                        >
                          ⤴ Eigenes Ref-Bild
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleOwnReferenceUpload(scene.id, file);
                            }
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => void handleGenerateAlternatives(scene)}
                          className="mt-4 w-full rounded-[1.15rem] border border-violet-300/45 bg-[linear-gradient(180deg,rgba(224,198,255,0.96),rgba(172,117,255,0.94))] px-4 py-3 text-sm font-black text-black transition hover:brightness-110"
                        >
                          🖼 Bild generieren
                        </button>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/8 bg-black/35 p-4">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                          <div className="rounded-full border border-violet-300/25 bg-violet-500/10 px-4 py-2 text-sm font-bold tracking-[0.22em] text-violet-100">
                            {formatDuration(scene.start)} → {formatDuration(scene.end)}
                          </div>
                          <div className="text-sm text-white/34">{scene.duration.toFixed(1)}s</div>
                          <div className="rounded-full border border-white/8 px-3 py-1 text-sm text-white/45">#{index + 1}</div>
                          {sceneJob ? <StatusChip status={sceneJob.status} label={getJobLabel(sceneJob)} /> : null}
                        </div>

                        <label className="text-xs font-bold uppercase tracking-[0.22em] text-white/30">Skript bearbeiten</label>
                        <textarea
                          value={scene.scriptText}
                          onChange={(event) => updateScene(scene.id, { scriptText: event.target.value })}
                          className="mt-3 min-h-[108px] w-full rounded-[1.2rem] border border-white/8 bg-black/25 px-4 py-4 text-lg leading-8 text-white outline-none placeholder:text-white/20 focus:border-violet-400/35"
                        />

                        <label className="mt-5 block text-xs font-bold uppercase tracking-[0.22em] text-white/30">Szene anpassen</label>
                        <div className="mt-3 grid gap-3 md:grid-cols-[92px_1fr]">
                          <div className="rounded-[1.05rem] border border-white/8 bg-black/25 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={scene.referenceImage} alt="Referenz" className="h-20 w-full rounded-[0.8rem] object-cover" />
                            <div className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">
                              Referenz
                            </div>
                          </div>
                          <textarea
                            value={scene.sceneAdjustment}
                            onChange={(event) => updateScene(scene.id, { sceneAdjustment: event.target.value })}
                            placeholder="Was soll angepasst werden? z.B. Hintergrund dunkler, Neonlicht von links, Person ersetzen wie im Bild ..."
                            className="min-h-[108px] rounded-[1.2rem] border border-white/8 bg-black/25 px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-white/20 focus:border-violet-400/35"
                          />
                        </div>

                        <details className="mt-5 rounded-[1.2rem] border border-white/8 bg-black/25 p-4">
                          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.22em] text-white/36">
                            Imagen-Prompt (English)
                          </summary>
                          <textarea
                            readOnly
                            value={promptText}
                            className="mt-4 min-h-[170px] w-full rounded-[1rem] border border-violet-300/25 bg-black/35 px-4 py-4 text-sm leading-7 text-white/86 outline-none"
                          />
                        </details>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <SceneAction active onClick={() => void handleGenerateAlternatives(scene)}>
                            🖼 Bild generieren
                          </SceneAction>
                          <SceneAction>✏️ Prompt</SceneAction>
                          <SceneAction>👥 Charaktere</SceneAction>
                          <SceneAction onClick={() => void handleEnqueueScene(scene)} disabled={isPending}>
                            ▶ Video
                          </SceneAction>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/8 bg-black/35 p-4">
                        <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/28">Live Preview</div>
                        <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/8 bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={scene.referenceImage} alt={scene.label} className="aspect-[9/16] w-full object-cover" />
                        </div>

                        <div className="mt-4">
                          <div className="text-sm font-bold uppercase tracking-[0.16em] text-white">{scene.label}</div>
                          <p className="mt-2 text-sm leading-6 text-white/42">{scene.narration}</p>
                        </div>

                        <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-black/30 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">Job Status</div>
                          <div className="mt-2 text-sm font-semibold text-white/76">{sceneJob ? sceneJob.statusLabel : "Noch nicht gestartet"}</div>
                          {sceneJob ? (
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#d6b3ff,#8e4dff)]"
                                style={{ width: `${sceneJob.progress}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="panel neon-border rounded-[2rem] px-6 py-12 text-center md:px-10">
            <div className="mx-auto max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/68">Bereit wenn du bereit bist</div>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Nach der Analyse erscheint hier dein kompletter Szenen-Workspace.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/42 md:text-lg">
                Referenzkarten, Skript, Szenenanpassung, Bildgenerierung und Video-Queue werden dann in genau dieser
                Produktionsansicht aufgebaut.
              </p>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="panel rounded-[2rem] p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Workspace</div>
                <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">Projektstatus</div>
              </div>
              <Link href="/projects" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/68 transition hover:border-violet-300/25 hover:text-white">
                Projekte ansehen
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.35rem] border border-white/8 bg-black/30 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/28">Upload</div>
                <div className="mt-2 text-base font-semibold text-white/78">{analysis?.asset.name ?? "Noch keine Quelle"}</div>
              </div>
              <div className="rounded-[1.35rem] border border-white/8 bg-black/30 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/28">Bild-Stand</div>
                <div className="mt-2 text-base font-semibold text-white/78">
                  {analysis ? `${readyScenes}/${analysis.scenes.length} Szenen mit Varianten` : "Warte auf Analyse"}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-white/8 bg-black/30 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/28">Export</div>
                <div className="mt-2 text-base font-semibold text-white/78">
                  {completedJobs > 0 ? `${completedJobs} Clips fertig` : "Noch kein Render abgeschlossen"}
                </div>
              </div>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-5 md:p-6">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/30">Render Queue</div>
            <div className="grid gap-3">
              {jobs.length > 0 ? (
                jobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="rounded-[1.2rem] border border-white/8 bg-black/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold uppercase tracking-[0.16em] text-white">{job.label}</div>
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

            {jobs.length > 6 ? (
              <div className="mt-3 text-right text-sm text-white/36">{jobs.length - 6} weitere Jobs in der Queue</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
