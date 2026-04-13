import path from "node:path";
import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/media";
import type { AssetRecord } from "@/lib/types";
import { makeId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const filePath = await saveUploadedFile(file);
  const asset: AssetRecord = {
    id: makeId("asset"),
    name: file.name,
    source: "local",
    filePath,
    mimeType: file.type || "video/mp4",
    createdAt: new Date().toISOString()
  };

  return NextResponse.json({
    asset,
    extension: path.extname(file.name)
  });
}
