import { APP_DB_PATH } from "@/lib/constants";
import { readJsonFile, writeJsonFile } from "@/lib/file-store";
import type { AnalysisRecord, SceneRecord } from "@/lib/types";

type SessionStore = {
  latestAnalysis: AnalysisRecord | null;
};

const emptyStore: SessionStore = {
  latestAnalysis: null
};

function normalizeScenes(scenes: SceneRecord[] | undefined): SceneRecord[] {
  return (scenes ?? []).map((scene) => ({
    ...scene,
    scriptText:
      scene.scriptText ??
      scene.subtitles?.map((word) => word.word).join(" ").trim() ??
      scene.narration ??
      "",
    narration: scene.narration ?? "",
    sceneAdjustment: scene.sceneAdjustment ?? "",
    referenceImage: scene.referenceImage ?? "",
    alternatives: Array.isArray(scene.alternatives) ? scene.alternatives : [],
    subtitles: Array.isArray(scene.subtitles) ? scene.subtitles : [],
    promptPackage: {
      visualPrompt: scene.promptPackage?.visualPrompt ?? "",
      motionPrompt: scene.promptPackage?.motionPrompt ?? "",
      cloneDirective: scene.promptPackage?.cloneDirective ?? "",
      negativePrompt: scene.promptPackage?.negativePrompt ?? ""
    }
  }));
}

function normalizeAnalysis(record: AnalysisRecord | null): AnalysisRecord | null {
  if (!record) {
    return null;
  }

  return {
    ...record,
    transcriptText: record.transcriptText ?? "",
    transcript: Array.isArray(record.transcript) ? record.transcript : [],
    scenes: normalizeScenes(record.scenes)
  };
}

export async function getSessionStore() {
  const store = await readJsonFile<SessionStore>(APP_DB_PATH, emptyStore);
  return {
    latestAnalysis: normalizeAnalysis(store.latestAnalysis)
  };
}

export async function saveLatestAnalysis(record: AnalysisRecord) {
  await writeJsonFile(APP_DB_PATH, { latestAnalysis: record });
}

export async function updateLatestScenes(scenes: SceneRecord[]) {
  const store = await getSessionStore();
  if (!store.latestAnalysis) {
    return;
  }

  await writeJsonFile(APP_DB_PATH, {
    latestAnalysis: {
      ...store.latestAnalysis,
      scenes
    }
  });
}

export async function updateSceneAlternative(sceneId: string, slot: number, assetUrl: string, replaceIfSelected?: string) {
  const store = await getSessionStore();
  if (!store.latestAnalysis) {
    return;
  }

  const nextScenes = store.latestAnalysis.scenes.map((scene) => {
    if (scene.id !== sceneId) {
      return scene;
    }

    const currentAlternative = scene.alternatives[slot];
    const nextAlternatives = [...scene.alternatives];
    nextAlternatives[slot] = assetUrl;

    return {
      ...scene,
      alternatives: nextAlternatives,
      referenceImage:
        replaceIfSelected && scene.referenceImage === replaceIfSelected
          ? assetUrl
          : scene.referenceImage === currentAlternative
            ? assetUrl
            : scene.referenceImage
    };
  });

  await writeJsonFile(APP_DB_PATH, {
    latestAnalysis: {
      ...store.latestAnalysis,
      scenes: nextScenes
    }
  });
}
