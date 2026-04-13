import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { REFERENCE_ROOT, UPLOAD_ROOT } from "@/lib/constants";
import { ensureDir, ensureParent } from "@/lib/file-store";
import { makeId, slugify } from "@/lib/utils";

const execFileAsync = promisify(execFile);

export async function saveUploadedFile(file: File, root = UPLOAD_ROOT) {
  await ensureDir(root);
  const ext = path.extname(file.name) || ".bin";
  const fileName = `${slugify(path.basename(file.name, ext)) || "media"}-${makeId("asset")}${ext}`;
  const filePath = path.join(root, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

export async function saveBase64Image(dataUrl: string, baseName: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image payload");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const ext = mimeType.includes("png") ? ".png" : ".jpg";
  const filePath = path.join(REFERENCE_ROOT, `${slugify(baseName)}-${makeId("ref")}${ext}`);
  await ensureParent(filePath);
  await writeFile(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

export async function extractVideoFrameDataUrl(videoPath: string, timeInSeconds: number) {
  const binary = process.env.FFMPEG_BINARY || "ffmpeg";
  const safeTime = Math.max(0, Number(timeInSeconds) || 0);
  const { stdout } = await execFileAsync(binary, [
    "-ss",
    safeTime.toFixed(2),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-1",
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "pipe:1"
  ], {
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024
  });

  return `data:image/png;base64,${Buffer.from(stdout).toString("base64")}`;
}

export async function extractSceneReferenceSet(videoPath: string, start: number, end: number) {
  const duration = Math.max(0.4, end - start);
  const base = Math.max(0, start);
  const offsets = [
    Math.max(base, start + duration * 0.18),
    Math.max(base, start + duration * 0.5),
    Math.max(base, start + duration * 0.82)
  ];

  return Promise.all(offsets.map((time) => extractVideoFrameDataUrl(videoPath, time)));
}
