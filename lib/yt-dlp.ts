import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { UPLOAD_ROOT } from "@/lib/constants";
import { ensureDir } from "@/lib/file-store";
import { makeId } from "@/lib/utils";

const execFileAsync = promisify(execFile);

export async function downloadVideoFromUrl(sourceUrl: string) {
  await ensureDir(UPLOAD_ROOT);
  const outputTemplate = path.join(UPLOAD_ROOT, `${makeId("url-import")}.%(ext)s`);
  const binary = process.env.YTDLP_BINARY || "yt-dlp";

  const { stdout } = await execFileAsync(binary, [
    sourceUrl,
    "--output",
    outputTemplate,
    "--format",
    "mp4/bestvideo+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "--no-warnings",
    "--print",
    "after_move:filepath"
  ]);

  const lines = stdout.trim().split("\n").filter(Boolean);
  const destination = lines.at(-1)?.trim();

  if (!destination) {
    throw new Error("yt-dlp completed without a file path.");
  }

  return destination;
}
