import { NextResponse } from "next/server";
import { consumePendingImageJob } from "@/lib/image-jobs";
import { verifyGeminigenWebhook, type GeminigenWebhookPayload } from "@/lib/geminigen";
import { updateJobFromWebhook } from "@/lib/jobs";
import { updateSceneAlternative } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature");
  const payload = (await request.json()) as GeminigenWebhookPayload;

  if (signature && !verifyGeminigenWebhook(payload.event_uuid, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (
    payload.event_name === "IMAGE_GENERATION_COMPLETED" &&
    payload.data.uuid &&
    (payload.data.media_url || payload.data.generate_result)
  ) {
    const pendingImage = await consumePendingImageJob(payload.data.uuid);
    if (pendingImage) {
      await updateSceneAlternative(
        pendingImage.sceneId,
        pendingImage.slot,
        payload.data.media_url ?? payload.data.generate_result ?? pendingImage.placeholderUrl,
        pendingImage.placeholderUrl
      );
    }
  }

  if (payload.event_name === "VIDEO_GENERATION_COMPLETED" && payload.data.uuid) {
    await updateJobFromWebhook(payload.data.uuid, {
      status: Number(payload.data.status ?? 2),
      statusPercentage: Number(payload.data.status_percentage ?? 100),
      mediaUrl: payload.data.media_url ?? payload.data.generate_result,
      thumbnailUrl: payload.data.thumbnail_url ?? payload.data.thumbnail_small,
      errorMessage: payload.data.error_message
    });
  }

  return NextResponse.json({ ok: true });
}
