export type UploadSource = "local" | "url";

export type AssetRecord = {
  id: string;
  name: string;
  source: UploadSource;
  url?: string;
  filePath: string;
  mimeType: string;
  createdAt: string;
};

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
};

export type ScenePromptPackage = {
  visualPrompt: string;
  motionPrompt: string;
  cloneDirective: string;
  negativePrompt: string;
};

export type SceneRecord = {
  id: string;
  label: string;
  start: number;
  end: number;
  duration: number;
  scriptText: string;
  narration: string;
  subtitles: TranscriptWord[];
  sceneAdjustment: string;
  referenceImage: string;
  alternatives: string[];
  promptPackage: ScenePromptPackage;
};

export type AnalysisRecord = {
  asset: AssetRecord;
  transcriptText: string;
  transcript: TranscriptSegment[];
  scenes: SceneRecord[];
  createdAt: string;
};

export type JobStatus = "queued" | "rendering" | "completed" | "failed";

export type QueueProvider = "veo3" | "grok" | "simulated";

export type VideoJob = {
  id: string;
  sceneId: string;
  label: string;
  provider: QueueProvider;
  service: "geminigen";
  modelName?: string;
  status: JobStatus;
  progress: number;
  statusLabel: string;
  outputUrl?: string;
  thumbnailUrl?: string;
  externalJobId?: string;
  externalHistoryId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type QueueSnapshot = {
  jobs: VideoJob[];
};

export type PendingImageJob = {
  externalJobId: string;
  sceneId: string;
  slot: number;
  placeholderUrl: string;
  createdAt: string;
};
