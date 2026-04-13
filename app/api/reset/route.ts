import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  APP_DB_PATH,
  IMAGE_JOB_DB_PATH,
  JOB_DB_PATH,
  RENDER_ROOT,
  REFERENCE_ROOT,
  STORAGE_ROOT,
  UPLOAD_ROOT
} from "@/lib/constants";

export const runtime = "nodejs";

async function removeIfExists(target: string) {
  try {
    await rm(target, { recursive: true, force: true });
  } catch {
    // Ignore missing files and partial cleanup errors so reset remains resilient.
  }
}

async function emptyDirectory(target: string) {
  try {
    const entries = await readdir(target);
    await Promise.all(entries.map((entry) => removeIfExists(path.join(target, entry))));
  } catch {
    // Ignore missing directories.
  }
}

export async function POST() {
  await Promise.all([
    removeIfExists(APP_DB_PATH),
    removeIfExists(JOB_DB_PATH),
    removeIfExists(IMAGE_JOB_DB_PATH),
    emptyDirectory(UPLOAD_ROOT),
    emptyDirectory(REFERENCE_ROOT),
    emptyDirectory(RENDER_ROOT)
  ]);

  return NextResponse.json({
    ok: true,
    storageRoot: STORAGE_ROOT
  });
}
