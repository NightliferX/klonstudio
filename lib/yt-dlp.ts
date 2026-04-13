import path from "node:path";
import ytDlp from "yt-dlp-exec";
import { UPLOAD_ROOT } from "@/lib/constants";
import { ensureDir } from "@/lib/file-store";
import { makeId } from "@/lib/utils";

export async function downloadVideoFromUrl(sourceUrl: string) {
  await ensureDir(UPLOAD_ROOT);
  const outputTemplate = path.join(UPLOAD_ROOT, `${makeId("url-import")}.%(ext)s`);
  const binary = process.env.YTDLP_BINARY;

  const result = await ytDlp(sourceUrl, {
    output: outputTemplate,
    format: "mp4/bestvideo+bestaudio/best",
    mergeOutputFormat: "mp4",
    noWarnings: true,
    ...(binary ? { binary } : {})
  });

  const lines = result.toString().trim().split("\n").filter(Boolean);
  const destination = lines.at(-1)?.replace("[Merger] Merging formats into ", "").replaceAll("\"", "");

  if (!destination) {
    throw new Error("yt-dlp completed without a file path.");
  }

  return destination;
}
