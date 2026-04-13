import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export async function ensureDir(target: string) {
  await mkdir(target, { recursive: true });
}

export async function ensureParent(filePath: string) {
  await ensureDir(path.dirname(filePath));
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, data: JsonValue) {
  await ensureParent(filePath);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
