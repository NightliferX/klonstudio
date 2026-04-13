import path from "node:path";

export const APP_NAME = "Klonstudio";
export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const UPLOAD_ROOT = path.join(STORAGE_ROOT, "uploads");
export const REFERENCE_ROOT = path.join(STORAGE_ROOT, "references");
export const RENDER_ROOT = path.join(STORAGE_ROOT, "renders");
export const JOB_DB_PATH = path.join(STORAGE_ROOT, "jobs", "queue.json");
export const IMAGE_JOB_DB_PATH = path.join(STORAGE_ROOT, "jobs", "image-jobs.json");
export const APP_DB_PATH = path.join(STORAGE_ROOT, "jobs", "session.json");
export const DEFAULT_POLL_MS = Number(process.env.NEXT_PUBLIC_QUEUE_POLL_MS ?? 4000);
