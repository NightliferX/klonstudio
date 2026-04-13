import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { extractSceneReferenceSet, extractVideoFrameDataUrl } from "@/lib/media";
import type { AnalysisRecord, AssetRecord, ScenePromptPackage, SceneRecord, TranscriptSegment, TranscriptWord } from "@/lib/types";
import { createPlaceholderReference } from "@/lib/demo";
import { makeId } from "@/lib/utils";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function normalizeWords(words: Array<{ word?: string; start?: number; end?: number }> = []): TranscriptWord[] {
  return words.map((entry, index) => ({
    word: entry.word ?? `Word ${index + 1}`,
    start: Number(entry.start ?? 0),
    end: Number(entry.end ?? entry.start ?? 0)
  }));
}

function buildFallbackAnalysis(asset: AssetRecord): AnalysisRecord {
  const sampleSegments: TranscriptSegment[] = [
    {
      id: makeId("seg"),
      start: 0,
      end: 5.6,
      text: "Reference-driven scene extracted from the uploaded clip.",
      words: [
        { word: "Reference-driven", start: 0, end: 1.4 },
        { word: "scene", start: 1.4, end: 2.1 },
        { word: "extracted", start: 2.1, end: 3.1 },
        { word: "from", start: 3.1, end: 3.5 },
        { word: "the", start: 3.5, end: 3.8 },
        { word: "uploaded", start: 3.8, end: 4.8 },
        { word: "clip.", start: 4.8, end: 5.6 }
      ]
    },
    {
      id: makeId("seg"),
      start: 5.6,
      end: 11.2,
      text: "Reference-driven scene variation for the uploaded clip.",
      words: [
        { word: "Reference-driven", start: 5.6, end: 6.9 },
        { word: "scene", start: 6.9, end: 7.5 },
        { word: "variation", start: 7.5, end: 8.5 },
        { word: "for", start: 8.5, end: 8.9 },
        { word: "the", start: 8.9, end: 9.2 },
        { word: "uploaded", start: 9.2, end: 10.1 },
        { word: "clip.", start: 10.1, end: 11.2 }
      ]
    }
  ];

  const prompts: ScenePromptPackage[] = [
    {
      visualPrompt:
        `Vertical 9:16 frame based entirely on the uploaded reference clip "${asset.name}". Preserve the exact visible subject, materials, colors, composition, lighting, camera angle, environment, and art style from the reference image. Do not invent any person, face, body, crowd, or object that is not clearly visible in the reference.`,
      motionPrompt:
        "Animate only what is already visible in the selected reference frame. Keep the movement subtle and faithful to the original subject and environment.",
      cloneDirective:
        "The supplied reference image is the only source of truth. Reproduce it exactly 1:1. Do not reinterpret the subject. Do not add humans unless they are clearly present in the reference image. Deviate only where scene adjustment explicitly instructs a change.",
      negativePrompt:
        "no invented people, no extra characters, no face hallucinations, no subject replacement, no landscape framing, no text overlays"
    },
    {
      visualPrompt:
        `Vertical 9:16 variation based on the uploaded reference clip "${asset.name}". Preserve the exact visible object or subject from the reference image. Keep the generated image anchored to the real extracted frame and avoid semantic guessing.`,
      motionPrompt:
        "Use conservative motion and camera movement derived from the existing frame only. Keep the subject identity and environment unchanged.",
      cloneDirective:
        "Replicate the reference frame 1:1 as the base image. Preserve subject identity, object shape, texture, pose, lens choice, and set design. Do not infer a human subject if the frame contains a product, fruit, 3D object, or abstract scene.",
      negativePrompt:
        "no invented humans, no anthropomorphic changes, no extra subjects, no washed-out exposure, no landscape crop"
    }
  ];

  const scenes: SceneRecord[] = sampleSegments.map((segment, index) => ({
    id: makeId("scene"),
    label: `Scene ${index + 1}`,
    start: segment.start,
    end: segment.end,
    duration: segment.end - segment.start,
    narration: segment.text,
    subtitles: segment.words,
    sceneAdjustment: "",
    referenceImage: createPlaceholderReference(`SCENE ${index + 1}`, segment.text),
    alternatives: [
      createPlaceholderReference(`ALT ${index + 1}A`, "Sharper contrast"),
      createPlaceholderReference(`ALT ${index + 1}B`, "More smoke"),
      createPlaceholderReference(`ALT ${index + 1}C`, "Closer crop")
    ],
    promptPackage: prompts[index]
  }));

  return {
    asset,
    transcriptText: sampleSegments.map((segment) => segment.text).join(" "),
    transcript: sampleSegments,
    scenes,
    createdAt: new Date().toISOString()
  };
}

async function attachRealReferenceImages(asset: AssetRecord, scenes: SceneRecord[]) {
  return Promise.all(
    scenes.map(async (scene, index) => {
      try {
        const extracted = await extractSceneReferenceSet(asset.filePath, scene.start, scene.end);
        return {
          ...scene,
          referenceImage: extracted[1] ?? extracted[0] ?? scene.referenceImage,
          alternatives: [
            extracted[0] ?? scene.alternatives[0] ?? createPlaceholderReference(`ALT ${index + 1}A`, "Frame A"),
            extracted[1] ?? scene.alternatives[1] ?? createPlaceholderReference(`ALT ${index + 1}B`, "Frame B"),
            extracted[2] ?? scene.alternatives[2] ?? createPlaceholderReference(`ALT ${index + 1}C`, "Frame C")
          ]
        };
      } catch (error) {
        console.error(`Failed to extract reference frames for ${scene.label}.`, error);
        return scene;
      }
    })
  );
}

async function extractAnalysisFrames(asset: AssetRecord, segments: TranscriptSegment[]) {
  const candidateTimes =
    segments.length > 0
      ? segments.slice(0, 6).map((segment) => Math.max(0, segment.start + (segment.end - segment.start) * 0.5))
      : [0, 1.5, 3];

  const uniqueTimes = [...new Set(candidateTimes.map((time) => Number(time.toFixed(2))))].slice(0, 6);
  const frames = await Promise.all(
    uniqueTimes.map(async (time, index) => {
      try {
        const dataUrl = await extractVideoFrameDataUrl(asset.filePath, time);
        return {
          label: `Frame ${index + 1} @ ${time.toFixed(2)}s`,
          time,
          dataUrl
        };
      } catch (error) {
        console.error(`Failed to extract analysis frame at ${time}s.`, error);
        return null;
      }
    })
  );

  return frames.filter((frame): frame is { label: string; time: number; dataUrl: string } => Boolean(frame));
}

export async function analyzeVideoAsset(asset: AssetRecord): Promise<AnalysisRecord> {
  const client = getOpenAIClient();
  if (!client) {
    const fallback = buildFallbackAnalysis(asset);
    return {
      ...fallback,
      scenes: await attachRealReferenceImages(asset, fallback.scenes)
    };
  }

  try {
    const fileBuffer = await readFile(asset.filePath);
    const file = await OpenAI.toFile(fileBuffer, asset.name);
    const transcription = await client.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"]
    } as never);

    const segments = ((transcription as never as { segments?: Array<{ start?: number; end?: number; text?: string; words?: Array<{ word?: string; start?: number; end?: number }> }> }).segments ?? []).map(
      (segment) => ({
        id: makeId("seg"),
        start: Number(segment.start ?? 0),
        end: Number(segment.end ?? segment.start ?? 0),
        text: segment.text ?? "",
        words: normalizeWords(segment.words)
      })
    );

    const transcriptText = (transcription as never as { text?: string }).text ?? segments.map((segment) => segment.text).join(" ");

    const analysisFrames = await extractAnalysisFrames(asset, segments);

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_SCENE_MODEL ?? "gpt-4o",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scene_breakdown",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    start: { type: "number" },
                    end: { type: "number" },
                    narration: { type: "string" },
                    visualPrompt: { type: "string" },
                    motionPrompt: { type: "string" },
                    cloneDirective: { type: "string" },
                    negativePrompt: { type: "string" }
                  },
                  required: ["label", "start", "end", "narration", "visualPrompt", "motionPrompt", "cloneDirective", "negativePrompt"]
                }
              }
            },
            required: ["scenes"]
          }
        }
      },
      messages: [
        {
          role: "system",
          content:
            "You break transcripts into cinematic short-form video scenes. You must use the provided video frames as the visual source of truth. Never invent subjects that are not visible in the frames. Return 9:16 vertical video prompts only. Visual prompts must be extremely detailed, production-grade, and image-model friendly."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Split this video into scenes and generate prompts.",
                "Use the transcript and the attached representative video frames together.",
                "If the transcript is vague or misleading, trust the frames over the transcript for visible subject matter.",
                "Do not describe a person, vlogger, room, desk, or social media UI unless those are clearly visible in the attached frames.",
                `Uploaded asset: ${asset.name}`,
                `Transcript:\n${transcriptText}`
              ].join("\n\n")
            },
            ...analysisFrames.flatMap((frame) => [
              {
                type: "text" as const,
                text: `${frame.label}`
              },
              {
                type: "image_url" as const,
                image_url: {
                  url: frame.dataUrl
                }
              }
            ])
          ]
        }
      ]
    } as never);

    const raw = completion.choices[0]?.message?.content ?? "{\"scenes\":[]}";
    const parsed = JSON.parse(raw) as {
      scenes: Array<{
        label: string;
        start: number;
        end: number;
        narration: string;
        visualPrompt: string;
        motionPrompt: string;
        cloneDirective: string;
        negativePrompt: string;
      }>;
    };

    const generatedScenes = parsed.scenes.length > 0 ? parsed.scenes : buildFallbackAnalysis(asset).scenes.map((scene) => ({
      label: scene.label,
      start: scene.start,
      end: scene.end,
      narration: scene.narration,
      visualPrompt: scene.promptPackage.visualPrompt,
      motionPrompt: scene.promptPackage.motionPrompt,
      cloneDirective: scene.promptPackage.cloneDirective,
      negativePrompt: scene.promptPackage.negativePrompt
    }));

    const scenes: SceneRecord[] = generatedScenes.map((scene, index) => {
      const matchingWords = segments.flatMap((segment) => segment.words).filter((word) => word.start >= scene.start && word.end <= scene.end);

      return {
        id: makeId("scene"),
        label: scene.label || `Scene ${index + 1}`,
        start: scene.start,
        end: scene.end,
        duration: scene.end - scene.start,
        narration: scene.narration,
        subtitles: matchingWords,
        sceneAdjustment: "",
        referenceImage: createPlaceholderReference(`SCENE ${index + 1}`, scene.narration),
        alternatives: [
          createPlaceholderReference(`ALT ${index + 1}A`, "Prompt variation A"),
          createPlaceholderReference(`ALT ${index + 1}B`, "Prompt variation B"),
          createPlaceholderReference(`ALT ${index + 1}C`, "Prompt variation C")
        ],
        promptPackage: {
          visualPrompt: scene.visualPrompt,
          motionPrompt: scene.motionPrompt,
          cloneDirective: scene.cloneDirective,
          negativePrompt: scene.negativePrompt
        }
      };
    });

    return {
      asset,
      transcriptText,
      transcript: segments,
      scenes: await attachRealReferenceImages(asset, scenes),
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("OpenAI analysis failed, using fallback scenes instead.", error);
    const fallback = buildFallbackAnalysis(asset);
    return {
      ...fallback,
      scenes: await attachRealReferenceImages(asset, fallback.scenes)
    };
  }
}
