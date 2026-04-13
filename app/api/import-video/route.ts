import path from "node:path";
import { NextResponse } from "next/server";
import { urlImportSchema } from "@/lib/api";
import type { AssetRecord } from "@/lib/types";
import { makeId } from "@/lib/utils";
import { downloadVideoFromUrl } from "@/lib/yt-dlp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = urlImportSchema.parse(await request.json());
  const filePath = await downloadVideoFromUrl(payload.url);
  const asset: AssetRecord = {
    id: makeId("asset"),
    name: path.basename(filePath),
    source: "url",
    url: payload.url,
    filePath,
    mimeType: "video/mp4",
    createdAt: new Date().toISOString()
  };

  return NextResponse.json({ asset });
}
