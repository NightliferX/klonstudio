import { JOB_DB_PATH } from "@/lib/constants";
import { readJsonFile, writeJsonFile } from "@/lib/file-store";
import { getSubmissionId, getSubmissionModel, getSubmissionProgress, submitVideoGeneration } from "@/lib/geminigen";
import type { QueueSnapshot, SceneRecord, VideoJob } from "@/lib/types";
import { makeId } from "@/lib/utils";

const emptyQueue: QueueSnapshot = { jobs: [] };

async function readQueue() {
  return readJsonFile<QueueSnapshot>(JOB_DB_PATH, emptyQueue);
}

async function saveQueue(queue: QueueSnapshot) {
  await writeJsonFile(JOB_DB_PATH, queue);
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
  next.status = "rendering";
  next.progress = providerResult.provider === "simulated" ? 12 : getSubmissionProgress(providerResult.submission);
  next.statusLabel = providerResult.provider === "simulated" ? "Rendering 12%" : `Rendering ${next.progress}%`;
  next.outputUrl = providerResult.submission?.media_url;
  next.thumbnailUrl = providerResult.submission?.thumbnail_url;
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

  if (payload.status >= 2 && payload.mediaUrl) {
    target.status = "completed";
    target.statusLabel = "Completed";
    target.progress = 100;
  } else if (payload.errorMessage) {
    target.status = "failed";
    target.statusLabel = "Failed";
    target.error = payload.errorMessage;
  } else {
    target.status = "rendering";
    target.statusLabel = `Rendering ${payload.statusPercentage}%`;
  }

  await saveQueue(queue);
  return target;
}
