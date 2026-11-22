import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { FsProbe } from "./types.js";

export function createNodeFsProbe(root: string): FsProbe {
  const at = (path: string): string => join(root, path);

  return {
    exists(path: string): boolean {
      return existsSync(at(path));
    },
    readText(path: string): string | undefined {
      try {
        return readFileSync(at(path), "utf8");
      } catch {
        return undefined;
      }
    },
    readJson(path: string): unknown | undefined {
      const text = this.readText(path);
      if (text === undefined) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return undefined;
      }
    },
  };
}

export function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || isAbsolute(value)) return false;
  return !value.split(/[\\/]/).includes("..");
}

export async function writeFileAtomic(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = join(root, relativePath);
  const existing = await lstat(target).catch(() => undefined);

  if (existing && !existing.isFile()) {
    throw new Error(`${relativePath} is not a regular file; refusing to write`);
  }

  const temp = join(dirname(target), `.${relativePath}.${process.pid}.${randomUUID()}.tmp`);
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }

  try {
    await rename(temp, target);
  } catch (error: unknown) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}
