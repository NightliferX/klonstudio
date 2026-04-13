import { readFile } from "node:fs/promises";
import OpenAI from "openai";
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
      text: "Elektrische Nacht über dem Beton, Lichtlinien pulsieren in die Kamera.",
      words: [
        { word: "Elektrische", start: 0, end: 0.8 },
        { word: "Nacht", start: 0.8, end: 1.3 },
        { word: "über", start: 1.3, end: 1.6 },
        { word: "dem", start: 1.6, end: 1.9 },
        { word: "Beton,", start: 1.9, end: 2.4 },
        { word: "Lichtlinien", start: 2.4, end: 3.2 },
        { word: "pulsieren", start: 3.2, end: 4.1 },
        { word: "in", start: 4.1, end: 4.3 },
        { word: "die", start: 4.3, end: 4.5 },
        { word: "Kamera.", start: 4.5, end: 5.6 }
      ]
    },
    {
      id: makeId("seg"),
      start: 5.6,
      end: 11.2,
      text: "Ein digitaler Avatar bewegt sich durch violetten Nebel und kalte LED-Strukturen.",
      words: [
        { word: "Ein", start: 5.6, end: 5.8 },
        { word: "digitaler", start: 5.8, end: 6.5 },
        { word: "Avatar", start: 6.5, end: 7.1 },
        { word: "bewegt", start: 7.1, end: 7.7 },
        { word: "sich", start: 7.7, end: 8.0 },
        { word: "durch", start: 8.0, end: 8.4 },
        { word: "violetten", start: 8.4, end: 9.0 },
        { word: "Nebel", start: 9.0, end: 9.5 },
        { word: "und", start: 9.5, end: 9.8 },
        { word: "kalte", start: 9.8, end: 10.2 },
        { word: "LED-Strukturen.", start: 10.2, end: 11.2 }
      ]
    }
  ];

  const prompts: ScenePromptPackage[] = [
    {
      visualPrompt:
        "Vertical 9:16 cyber-club opener, brutal black architecture, wet concrete reflections, sharp neon violet beam arrays, cinematic depth haze, hyper-detailed, tactile surfaces, fashion-film precision.",
      motionPrompt:
        "Slow dolly push through light bars, subtle smoke drift, lens breathing, high-contrast nightclub energy, premium music-video pacing.",
      cloneDirective:
        "Clone the supplied reference image with exact framing, geometry, wardrobe, background layout, and lighting ratios. Deviate only where scene adjustment explicitly instructs a change.",
      negativePrompt:
        "no extra limbs, no soft low-detail blur, no landscape framing, no text overlays, no duplicated subjects"
    },
    {
      visualPrompt:
        "Vertical 9:16 digital performer in violet mist corridor, sculptural LED lattice, glossy black PVC styling, razor-sharp editorial portraiture, cinematic atmosphere, hyperreal detail.",
      motionPrompt:
        "Elegant forward glide with controlled parallax, body micro-movements, smoke and LED shimmer, futuristic club poise.",
      cloneDirective:
        "Replicate the reference 1:1 as the base image. Preserve subject identity, styling, pose, lens choice, and set design unless the scene adjustment text overrides those elements.",
      negativePrompt:
        "no extra subjects, no washed-out exposure, no flat lighting, no landscape crop, no cartoon artifacts"
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

export async function analyzeVideoAsset(asset: AssetRecord): Promise<AnalysisRecord> {
  const client = getOpenAIClient();
  if (!client) {
    return buildFallbackAnalysis(asset);
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
            "You break transcripts into cinematic short-form video scenes. Return 9:16 vertical video prompts only. Visual prompts must be extremely detailed, production-grade, and image-model friendly."
        },
        {
          role: "user",
          content: `Split this transcript into scenes and generate prompts.\n\nTranscript:\n${transcriptText}`
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
      scenes,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("OpenAI analysis failed, using fallback scenes instead.", error);
    return buildFallbackAnalysis(asset);
  }
}
