import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { chmod, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import type { FsProbe, PathKind } from "./types.js";

export function createNodeFsProbe(root: string): FsProbe {
  const at = (path: string): string => join(root, path);

  return {
    exists(path: string): boolean {
      return existsSync(at(path));
    },
    kind(path: string): PathKind {
      try {
        return lstatSync(at(path)).isFile() ? "file" : "other";
      } catch {
        return "missing";
      }
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

export async function assertWritableTarget(root: string, relativePath: string): Promise<void> {
  const target = join(root, relativePath);
  const existing = await lstat(target).catch(() => undefined);
  if (existing && !existing.isFile()) {
    throw new Error(`${relativePath} is not a regular file; refusing to write`);
  }
  await mkdir(dirname(target), { recursive: true });
}

export async function writeFileAtomic(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = join(root, relativePath);
  await assertWritableTarget(root, relativePath);
  const existing = await lstat(target).catch(() => undefined);
  const mode = existing ? existing.mode & 0o777 : 0o644;
  const temp = join(
    dirname(target),
    `.${basename(relativePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
  await chmod(temp, mode);

  try {
    await rename(temp, target);
  } catch (error: unknown) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}
