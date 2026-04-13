import { writeFile } from "node:fs/promises";
import path from "node:path";
import { REFERENCE_ROOT, UPLOAD_ROOT } from "@/lib/constants";
import { ensureDir, ensureParent } from "@/lib/file-store";
import { makeId, slugify } from "@/lib/utils";

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
