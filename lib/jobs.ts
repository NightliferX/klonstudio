import { JOB_DB_PATH } from "@/lib/constants";
import { readJsonFile, writeJsonFile } from "@/lib/file-store";
import {
  fetchGenerationStatus,
  getSubmissionHistoryId,
  getSubmissionId,
  getSubmissionMediaUrl,
  getSubmissionModel,
  getSubmissionProgress,
  getSubmissionThumbnailUrl,
  submitVideoGeneration
} from "@/lib/geminigen";
import type { QueueSnapshot, SceneRecord, VideoJob } from "@/lib/types";
import { makeId } from "@/lib/utils";

const emptyQueue: QueueSnapshot = { jobs: [] };

async function readQueue() {
  return readJsonFile<QueueSnapshot>(JOB_DB_PATH, emptyQueue);
}

async function saveQueue(queue: QueueSnapshot) {
  await writeJsonFile(JOB_DB_PATH, queue);
}

function getSmoothProgress(job: VideoJob) {
  const elapsedMs = Date.now() - Date.parse(job.createdAt);
  const checkpoints = [
    { afterMs: 5_000, progress: 4 },
    { afterMs: 15_000, progress: 8 },
    { afterMs: 30_000, progress: 15 },
    { afterMs: 60_000, progress: 26 },
    { afterMs: 120_000, progress: 41 },
    { afterMs: 180_000, progress: 56 },
    { afterMs: 300_000, progress: 72 },
    { afterMs: 420_000, progress: 84 },
    { afterMs: 600_000, progress: 92 },
    { afterMs: 900_000, progress: 96 }
  ];

  return checkpoints.reduce((best, point) => (elapsedMs >= point.afterMs ? point.progress : best), job.progress);
}

export async function getJobs() {
  const queue = await readQueue();
  return queue.jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function enqueueSceneJobs(scenes: SceneRecord[], provider: "veo3") {
  const queue = await readQueue();
  const now = new Date().toISOString();
  const jobs = scenes.map<VideoJob>((scene, index) => ({
    id: makeId("job"),
    sceneId: scene.id,
    label: scene.label,
    provider,
    service: "geminigen",
    status: "queued",
    progress: 0,
    statusLabel: index === 0 ? "Ausstehend" : "Wartet auf Slot",
    createdAt: now,
    updatedAt: now
  }));

  queue.jobs.unshift(...jobs);
  await saveQueue(queue);
  return jobs;
}

export async function processPendingJobs(sceneMap: Record<string, SceneRecord>) {
  const queue = await readQueue();
  const active = queue.jobs.find((job) => job.status === "rendering");
  if (active?.provider === "simulated") {
    if (active.progress < 45) {
      active.progress = 45;
      active.statusLabel = "Rendering 45%";
      active.updatedAt = new Date().toISOString();
      await saveQueue(queue);
      return queue.jobs;
    }

    if (active.progress < 82) {
      active.progress = 82;
      active.statusLabel = "Rendering 82%";
      active.updatedAt = new Date().toISOString();
      await saveQueue(queue);
      return queue.jobs;
    }

    active.status = "completed";
    active.progress = 100;
    active.statusLabel = "Completed";
    active.updatedAt = new Date().toISOString();
    await saveQueue(queue);
    return queue.jobs;
  }

  if (active) {
    let didChange = false;

    if (active.externalHistoryId) {
      try {
        const remote = await fetchGenerationStatus(active.externalHistoryId);
        const mediaUrl = getSubmissionMediaUrl(remote);
        const thumbnailUrl = getSubmissionThumbnailUrl(remote);
        const remoteProgress = getSubmissionProgress(remote);

        active.progress = Math.max(active.progress, remoteProgress, getSmoothProgress(active));
        active.outputUrl = mediaUrl ?? active.outputUrl;
        active.thumbnailUrl = thumbnailUrl ?? active.thumbnailUrl;

        if (Number(remote?.status ?? 0) >= 3 || remote?.error_message) {
          active.status = "failed";
          active.statusLabel = "Failed";
          active.error = remote?.error_message ?? active.error;
        } else if (Number(remote?.status ?? 0) >= 2 && (mediaUrl ?? active.outputUrl)) {
          active.status = "completed";
          active.progress = 100;
          active.statusLabel = "Completed";
        } else {
          active.status = "rendering";
          active.statusLabel = remote?.status_desc?.trim() || `Rendering ${active.progress}%`;
        }

        active.updatedAt = new Date().toISOString();
        didChange = true;
      } catch {
        const smoothedProgress = Math.max(active.progress, getSmoothProgress(active));
        if (smoothedProgress !== active.progress) {
          active.progress = smoothedProgress;
          active.statusLabel = `Rendering ${active.progress}%`;
          active.updatedAt = new Date().toISOString();
          didChange = true;
        }
      }
    } else {
      const smoothedProgress = Math.max(active.progress, getSmoothProgress(active));
      if (smoothedProgress !== active.progress) {
        active.progress = smoothedProgress;
        active.statusLabel = `Rendering ${active.progress}%`;
        active.updatedAt = new Date().toISOString();
        didChange = true;
      }
    }

    if (didChange) {
      await saveQueue(queue);
    }

    return queue.jobs;
  }

  const next = queue.jobs.find((job) => job.status === "queued");
  if (!next) {
    return queue.jobs;
  }

  const scene = sceneMap[next.sceneId];
  if (!scene) {
    next.status = "failed";
    next.statusLabel = "Scene missing";
    next.error = "The scene payload is no longer available.";
    next.updatedAt = new Date().toISOString();
    await saveQueue(queue);
    return queue.jobs;
  }

  const providerResult = await submitVideoGeneration(scene);

  next.provider = providerResult.provider;
  next.modelName = getSubmissionModel(providerResult.submission, process.env.GEMINIGEN_VIDEO_MODEL ?? "veo-3");
  next.externalJobId = getSubmissionId(providerResult.submission);
  next.externalHistoryId = getSubmissionHistoryId(providerResult.submission);
  next.status = "rendering";
  next.progress = providerResult.provider === "simulated" ? 12 : getSubmissionProgress(providerResult.submission);
  next.statusLabel = providerResult.provider === "simulated" ? "Rendering 12%" : `Rendering ${next.progress}%`;
  next.outputUrl = getSubmissionMediaUrl(providerResult.submission);
  next.thumbnailUrl = getSubmissionThumbnailUrl(providerResult.submission);
  next.updatedAt = new Date().toISOString();

  await saveQueue(queue);
  return queue.jobs;
}

export async function updateJobFromWebhook(
  externalJobId: string,
  payload: { status: number; statusPercentage: number; mediaUrl?: string; thumbnailUrl?: string; errorMessage?: string }
) {
  const queue = await readQueue();
  const target = queue.jobs.find((job) => job.externalJobId === externalJobId);
  if (!target) {
    return null;
  }

  target.progress = payload.statusPercentage;
  target.outputUrl = payload.mediaUrl ?? target.outputUrl;
  target.thumbnailUrl = payload.thumbnailUrl ?? target.thumbnailUrl;
  target.updatedAt = new Date().toISOString();

  if (payload.status >= 3 || payload.errorMessage) {
    target.status = "failed";
    target.statusLabel = "Failed";
    target.error = payload.errorMessage;
  } else if (payload.status >= 2 && (payload.mediaUrl ?? target.outputUrl)) {
    target.status = "completed";
    target.statusLabel = "Completed";
    target.progress = 100;
  } else {
    target.status = "rendering";
    target.statusLabel = `Rendering ${payload.statusPercentage}%`;
  }

  await saveQueue(queue);
  return target;
}
