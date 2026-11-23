import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, type Stats } from "node:fs";
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

export function relativePathParts(value: string): string[] {
  return value.split(/[\\/]/).filter((part) => part !== "" && part !== ".");
}

interface WritableTarget {
  existing: Stats | undefined;
  target: string;
}

/** Resolve an output path under root, rejecting symlinks in any component. */
async function resolveWritableTarget(root: string, relativePath: string): Promise<WritableTarget> {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`invalid output path: ${relativePath}`);
  }

  const parts = relativePathParts(relativePath);
  if (parts.length === 0) throw new Error(`invalid output path: ${relativePath}`);

  let current = root;
  let existing: Stats | undefined;
  for (const [index, part] of parts.entries()) {
    const shown = parts.slice(0, index + 1).join("/");
    const next = join(current, part);
    const stat = await lstat(next).catch(() => undefined);
    if (stat?.isSymbolicLink()) {
      throw new Error(`${shown} is a symlink; refusing to write`);
    }
    if (index < parts.length - 1) {
      if (stat !== undefined && !stat.isDirectory()) {
        throw new Error(`${shown} is not a directory; refusing to write`);
      }
    } else {
      existing = stat;
      if (stat !== undefined && !stat.isFile()) {
        throw new Error(`${shown} is not a regular file; refusing to write`);
      }
    }
    current = next;
  }

  await mkdir(dirname(current), { recursive: true });
  return { existing, target: current };
}

export async function assertWritableTarget(root: string, relativePath: string): Promise<void> {
  await resolveWritableTarget(root, relativePath);
}

export async function writeFileAtomic(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const { existing, target } = await resolveWritableTarget(root, relativePath);
  const mode = existing ? existing.mode & 0o777 : 0o644;
  const temp = join(dirname(target), `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  let tempCreated = false;

  try {
    const handle = await open(temp, "wx", 0o600);
    tempCreated = true;
    try {
      await handle.writeFile(content, "utf8");
    } finally {
      await handle.close();
    }
    await chmod(temp, mode);
    await rename(temp, target);
  } catch (error: unknown) {
    if (tempCreated) await unlink(temp).catch(() => undefined);
    throw error;
  }
}
