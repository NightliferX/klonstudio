import { z } from "zod";

export const urlImportSchema = z.object({
  url: z.string().url()
});

export const analyzeSchema = z.object({
  assetId: z.string(),
  assetName: z.string(),
  filePath: z.string(),
  mimeType: z.string(),
  source: z.enum(["local", "url"]),
  url: z.string().optional()
});

export const sceneAlternativeSchema = z.object({
  scene: z.object({
    id: z.string(),
    label: z.string(),
    start: z.number(),
    end: z.number(),
    duration: z.number(),
    scriptText: z.string().optional(),
    narration: z.string(),
    sceneAdjustment: z.string(),
    referenceImage: z.string(),
    promptPackage: z.object({
      visualPrompt: z.string(),
      motionPrompt: z.string(),
      cloneDirective: z.string(),
      negativePrompt: z.string()
    })
  }),
  adjustment: z.string().default("")
});

export const queueSchema = z.object({
  scenes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      start: z.number(),
      end: z.number(),
      duration: z.number(),
      scriptText: z.string(),
      narration: z.string(),
      sceneAdjustment: z.string(),
      referenceImage: z.string(),
      alternatives: z.array(z.string()),
      subtitles: z.array(
        z.object({
          word: z.string(),
          start: z.number(),
          end: z.number()
        })
      ),
      promptPackage: z.object({
        visualPrompt: z.string(),
        motionPrompt: z.string(),
        cloneDirective: z.string(),
        negativePrompt: z.string()
      })
    })
  ),
  provider: z.enum(["veo3", "grok"])
});
