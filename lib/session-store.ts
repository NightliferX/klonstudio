import { APP_DB_PATH } from "@/lib/constants";
import { readJsonFile, writeJsonFile } from "@/lib/file-store";
import type { AnalysisRecord, SceneRecord } from "@/lib/types";

type SessionStore = {
  latestAnalysis: AnalysisRecord | null;
};

const emptyStore: SessionStore = {
  latestAnalysis: null
};

export async function getSessionStore() {
  return readJsonFile<SessionStore>(APP_DB_PATH, emptyStore);
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
