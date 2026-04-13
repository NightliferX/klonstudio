import { NextResponse } from "next/server";
import { analyzeSchema } from "@/lib/api";
import { analyzeVideoAsset } from "@/lib/openai";
import { saveLatestAnalysis } from "@/lib/session-store";
import type { AssetRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = analyzeSchema.parse(await request.json());
  const asset: AssetRecord = {
    id: payload.assetId,
    name: payload.assetName,
    source: payload.source,
    url: payload.url,
    filePath: payload.filePath,
    mimeType: payload.mimeType,
    createdAt: new Date().toISOString()
  };

  const analysis = await analyzeVideoAsset(asset);
  await saveLatestAnalysis(analysis);

  return NextResponse.json({ analysis });
}
