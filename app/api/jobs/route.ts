import { NextResponse } from "next/server";
import { queueSchema } from "@/lib/api";
import { enqueueSceneJobs, getJobs, processPendingJobs } from "@/lib/jobs";
import { getSessionStore, updateLatestScenes } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldTick = url.searchParams.get("tick") === "1";

  if (shouldTick) {
    const session = await getSessionStore();
    const sceneMap = Object.fromEntries((session.latestAnalysis?.scenes ?? []).map((scene) => [scene.id, scene]));
    await processPendingJobs(sceneMap);
  }

  const jobs = await getJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const payload = queueSchema.parse(await request.json());
  await updateLatestScenes(payload.scenes);
  const jobs = await enqueueSceneJobs(payload.scenes, payload.provider);
  return NextResponse.json({ jobs });
}
