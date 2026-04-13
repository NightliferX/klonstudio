import { IMAGE_JOB_DB_PATH } from "@/lib/constants";
import { readJsonFile, writeJsonFile } from "@/lib/file-store";
import type { PendingImageJob } from "@/lib/types";

type PendingImageJobStore = {
  jobs: PendingImageJob[];
};

const emptyStore: PendingImageJobStore = {
  jobs: []
};

async function readStore() {
  return readJsonFile<PendingImageJobStore>(IMAGE_JOB_DB_PATH, emptyStore);
}

async function saveStore(store: PendingImageJobStore) {
  await writeJsonFile(IMAGE_JOB_DB_PATH, store);
}

export async function registerPendingImageJob(job: PendingImageJob) {
  const store = await readStore();
  store.jobs.unshift(job);
  await saveStore(store);
}

export async function consumePendingImageJob(externalJobId: string) {
  const store = await readStore();
  const match = store.jobs.find((job) => job.externalJobId === externalJobId) ?? null;
  if (!match) {
    return null;
  }

  store.jobs = store.jobs.filter((job) => job.externalJobId !== externalJobId);
  await saveStore(store);
  return match;
}
