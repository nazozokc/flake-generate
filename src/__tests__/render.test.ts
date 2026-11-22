import { describe, expect, it } from "vitest";
import { renderFlake } from "../render/flake.js";
import type { ProjectInfo } from "../types.js";

const nodeProject: ProjectInfo = {
  name: "demo",
  detections: [
    {
      ecosystem: "node",
      label: "Node.js",
      markers: ["pnpm-lock.yaml", "tsconfig.json"],
      packages: ["nodejs_24", "pnpm", "typescript"],
      notes: [],
    },
  ],
  warnings: [],
};

const emptyProject: ProjectInfo = {
  name: "empty",
  detections: [],
  warnings: ["No lockfiles or project markers found; generated an empty devShell."],
};

describe("renderFlake", () => {
  it("renders a grouped, readable flake", () => {
    expect(renderFlake(nodeProject)).toMatchSnapshot();
  });

  it("renders an empty devShell when nothing is detected", () => {
    expect(renderFlake(emptyProject)).toMatchSnapshot();
  });

  it("is deterministic", () => {
    expect(renderFlake(nodeProject)).toBe(renderFlake(nodeProject));
  });

  it("quotes project names safely", () => {
    const quoted = renderFlake({ ...nodeProject, name: 'say "hi" $x' });
    expect(quoted).toContain('description = "say \\"hi\\" $x development environment";');
  });
});
