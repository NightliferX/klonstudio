import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import type { QueueProvider, SceneRecord } from "@/lib/types";
import { createPlaceholderReference } from "@/lib/demo";

export type GeminigenSubmissionResponse = {
  uuid?: string;
  model_name?: string;
  input_text?: string;
  status?: number;
  status_percentage?: number;
  error_message?: string;
  media_url?: string;
  thumbnail_url?: string;
};

export type GeminigenWebhookPayload = {
  event_name: string;
  event_uuid: string;
  data: GeminigenSubmissionResponse;
};

const GEMINIGEN_API_BASE_URL = process.env.GEMINIGEN_API_BASE_URL ?? "https://api.geminigen.ai/uapi/v1";

function getApiKey() {
  return process.env.GEMINIGEN_API_KEY;
}

function getImageModel() {
  return process.env.GEMINIGEN_IMAGE_MODEL ?? "imagen-4";
}

function getVideoModel() {
  return process.env.GEMINIGEN_VIDEO_MODEL ?? "veo-2";
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(",");
  const mimeType = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  return new Blob([Buffer.from(base64, "base64")], { type: mimeType });
}

function attachReferenceFields(formData: FormData, referenceImage: string) {
  if (referenceImage.startsWith("data:image/")) {
    const blob = dataUrlToBlob(referenceImage);
    formData.append("files", blob, "reference.png");
    return;
  }

  formData.append("file_urls", referenceImage);
}

async function submitForm(endpoint: string, formData: FormData) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${GEMINIGEN_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GeminiGen request failed: ${message}`);
  }

  return (await response.json()) as GeminigenSubmissionResponse;
}

async function submitJson(endpoint: string, payload: Record<string, unknown>) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${GEMINIGEN_API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GeminiGen request failed: ${message}`);
  }

  return (await response.json()) as GeminigenSubmissionResponse;
}

export function isGeminigenConfigured() {
  return Boolean(getApiKey());
}

export async function submitImageGeneration(scene: SceneRecord, slot: number) {
  const variationHint = [
    "Option A: perfect 1:1 clone with identical framing.",
    "Option B: 1:1 clone with a stronger haze and rim light unless the scene adjustment overrides it.",
    "Option C: 1:1 clone with a slightly tighter subject emphasis unless the scene adjustment overrides it."
  ][slot] ?? "Reference-driven variation.";

  const placeholder = createPlaceholderReference(`${scene.label} ${String.fromCharCode(65 + slot)}`, "Queued via GeminiGen");

  if (!isGeminigenConfigured()) {
    return {
      placeholder,
      submission: null
    };
  }

  const formData = new FormData();
  formData.append(
    "prompt",
    [
      scene.promptPackage.cloneDirective,
      scene.promptPackage.visualPrompt,
      scene.sceneAdjustment ? `Scene adjustment override: ${scene.sceneAdjustment}` : "No scene adjustment override.",
      variationHint,
      "Output format: vertical 9:16."
    ].join("\n\n")
  );
  formData.append("model", getImageModel());
  formData.append("aspect_ratio", "9:16");
  formData.append("resolution", "1K");
  formData.append("output_format", "png");
  formData.append("style", "3D Render");
  formData.append("negative_prompt", scene.promptPackage.negativePrompt);
  attachReferenceFields(formData, scene.referenceImage);

  return {
    placeholder,
    submission: await submitForm("/generate_image", formData)
  };
}

export async function submitVideoGeneration(scene: SceneRecord): Promise<{
  provider: QueueProvider;
  submission: GeminigenSubmissionResponse | null;
}> {
  if (!isGeminigenConfigured()) {
    return {
      provider: "simulated",
      submission: null
    };
  }

  const formData = new FormData();
  formData.append(
    "prompt",
    [
      scene.promptPackage.motionPrompt,
      scene.promptPackage.visualPrompt,
      scene.promptPackage.cloneDirective,
      scene.sceneAdjustment ? `Scene adjustment override: ${scene.sceneAdjustment}` : "No scene adjustment override.",
      "Keep the output vertical 9:16 and faithful to the reference."
    ].join("\n\n")
  );
  formData.append("model", getVideoModel());
  formData.append("resolution", "720p");
  formData.append("aspect_ratio", "9:16");
  formData.append("mode_image", "frame");

  if (scene.referenceImage.startsWith("data:image/")) {
    formData.append("ref_images", dataUrlToBlob(scene.referenceImage), "reference.png");
  } else {
    formData.append("ref_images", scene.referenceImage);
  }

  return {
    provider: "veo3",
    submission: await submitForm("/video-gen/veo", formData)
  };
}

export function verifyGeminigenWebhook(eventUuid: string, signatureHex: string) {
  const publicKeyPem = process.env.GEMINIGEN_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!publicKeyPem) {
    return true;
  }

  const digest = createHash("md5").update(eventUuid, "utf8").digest();
  const publicKey = createPublicKey(publicKeyPem);
  return verifySignature("sha256", digest, publicKey, Buffer.from(signatureHex, "hex"));
}

export function getSubmissionProgress(submission: GeminigenSubmissionResponse | null) {
  return Math.max(1, Math.min(99, Number(submission?.status_percentage ?? 1)));
}

export function getSubmissionModel(submission: GeminigenSubmissionResponse | null, fallback: string) {
  return submission?.model_name ?? fallback;
}

export function getSubmissionId(submission: GeminigenSubmissionResponse | null) {
  return submission?.uuid;
}
