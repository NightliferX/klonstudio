import { NextResponse } from "next/server";
import { sceneAlternativeSchema } from "@/lib/api";
import { submitImageGeneration } from "@/lib/geminigen";
import { registerPendingImageJob } from "@/lib/image-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = sceneAlternativeSchema.parse(await request.json());
    const scene = {
      ...payload.scene,
      scriptText: payload.scene.scriptText ?? payload.scene.narration,
      sceneAdjustment: payload.adjustment,
      alternatives: [],
      subtitles: []
    };

    const alternatives = await Promise.all(
      [0, 1, 2].map(async (slot) => {
        const result = await submitImageGeneration(scene, slot);

        if (result.submission?.uuid) {
          await registerPendingImageJob({
            externalJobId: result.submission.uuid,
            sceneId: scene.id,
            slot,
            placeholderUrl: result.placeholder,
            createdAt: new Date().toISOString()
          });
        }

        return result.submission?.media_url ?? result.placeholder;
      })
    );

    return NextResponse.json({ alternatives });
  } catch (error) {
    console.error("Failed to generate GeminiGen alternatives.", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Image generation failed."
      },
      { status: 500 }
    );
  }
}
