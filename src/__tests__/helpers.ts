import type { FsProbe } from "../types.js";

export function fakeProbe(files: Record<string, string>): FsProbe {
  return {
    exists: (path: string): boolean => Object.hasOwn(files, path),
    readText: (path: string): string | undefined => files[path],
    readJson: (path: string): unknown | undefined => {
      const text = files[path];
      if (text === undefined) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return undefined;
      }
    },
  };
}
